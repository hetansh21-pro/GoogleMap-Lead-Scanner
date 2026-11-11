import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import puppeteer from 'puppeteer-core';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Global State
let activeJob = null;
let currentLeads = [];
let lastScanMeta = { category: 'Plumber', location: 'Ahmedabad' };
let scanStats = {
  scannedCount: 0,
  qualifiedCount: 0,
  skippedCount: 0,
  status: 'idle', // 'idle' | 'running' | 'paused' | 'stopped'
  startTime: null,
  endTime: null,
  activeWorkers: 0,
  workerDetails: []
};

// Helper: Format & Clean Phone Number with High Precision
function formatPhoneNumber(phoneStr) {
  if (!phoneStr || typeof phoneStr !== 'string') return null;

  let cleaned = phoneStr
    .replace(/^phone:tel:/i, '')
    .replace(/^tel:/i, '')
    .replace(/^Phone:\s*/i, '')
    .replace(/^Call\s*/i, '')
    .replace(/^Mobile:\s*/i, '')
    .replace(/^Phone number:\s*/i, '')
    .replace(/^Contact:\s*/i, '')
    .trim();

  cleaned = cleaned.split('\n')[0].trim();

  const digitsOnly = cleaned.replace(/\D/g, '');

  if (digitsOnly.length < 7 || digitsOnly.length > 15) return null;

  // Filter out pincodes/zipcodes (e.g. 6-digit Indian pincodes like 380015 or 5-digit US zipcodes)
  if (digitsOnly.length === 6) return null;
  if (/^(19|20)\d{2}$/.test(digitsOnly)) return null; // Filter years 1900-2099
  if (/^000+$/.test(digitsOnly)) return null;

  // 1. Indian Standard Formatting
  // 10-digit mobile number starting with 6, 7, 8, 9
  if (digitsOnly.length === 10 && /^[6-9]/.test(digitsOnly)) {
    return `+91 ${digitsOnly.slice(0, 5)} ${digitsOnly.slice(5)}`;
  }

  // 11-digit starting with 0 (e.g. 09769092042 mobile or 07926581234 landline)
  if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    const mobilePart = digitsOnly.slice(1);
    if (/^[6-9]/.test(mobilePart)) {
      return `+91 ${mobilePart.slice(0, 5)} ${mobilePart.slice(5)}`;
    }
    if (digitsOnly.startsWith('079') || digitsOnly.startsWith('022') || digitsOnly.startsWith('011') || digitsOnly.startsWith('033') || digitsOnly.startsWith('044')) {
      return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 7)} ${digitsOnly.slice(7)}`;
    }
    return `${digitsOnly.slice(0, 4)} ${digitsOnly.slice(4)}`;
  }

  // 12-digit starting with 91 (e.g. 919769092042)
  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    const mobilePart = digitsOnly.slice(2);
    if (/^[6-9]/.test(mobilePart)) {
      return `+91 ${mobilePart.slice(0, 5)} ${mobilePart.slice(5)}`;
    }
    return `+91 ${mobilePart}`;
  }

  // 13-digit starting with 0091
  if (digitsOnly.length === 13 && digitsOnly.startsWith('0091')) {
    const mobilePart = digitsOnly.slice(4);
    if (/^[6-9]/.test(mobilePart)) {
      return `+91 ${mobilePart.slice(0, 5)} ${mobilePart.slice(5)}`;
    }
    return `+91 ${mobilePart}`;
  }

  // 2. US / International Standard Formatting
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }

  const matchFormatted = cleaned.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{2,5}/);
  if (matchFormatted) {
    return matchFormatted[0].trim();
  }

  return cleaned;
}

// Helper: Extract & Validate Phone Numbers from raw string or fallback card text
function extractValidPhone(primaryText, fallbackText) {
  if (primaryText) {
    const formatted = formatPhoneNumber(primaryText);
    if (formatted) return formatted;
  }

  if (fallbackText && typeof fallbackText === 'string') {
    const phoneRegex = /(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,5}\)?[-.\s]?\d{3,5}[-.\s]?\d{2,5}|\+?\d{8,14}/g;
    const matches = fallbackText.match(phoneRegex) || [];

    for (const match of matches) {
      const trimmed = match.trim();
      const formatted = formatPhoneNumber(trimmed);
      if (formatted) return formatted;
    }
  }

  return null;
}

// Helper: Extract Email from Text with Strict Domain Blacklisting
function extractEmails(text) {
  if (!text || typeof text !== 'string') return [];
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const matches = text.match(emailRegex) || [];

  const blacklistedDomains = [
    'duckduckgo.com',
    'google.com',
    'googleusercontent.com',
    'schema.org',
    'w3.org',
    'sentry.io',
    'github.com',
    'cloudflare.com',
    'example.com',
    'domain.com',
    'yandex.com',
    'bing.com'
  ];

  return [...new Set(matches)].filter(email => {
    const lower = email.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.svg') || lower.endsWith('.webp') || lower.endsWith('.gif')) {
      return false;
    }
    const domain = lower.split('@')[1] || '';
    if (blacklistedDomains.some(b => domain.includes(b))) {
      return false;
    }
    return true;
  });
}

// Helper: Scrape Business Website Homepage & Contact page for Emails & Phones
async function scrapeWebsiteContact(websiteUrl) {
  if (!websiteUrl || typeof websiteUrl !== 'string' || websiteUrl.includes('google.com')) {
    return { email: null, phone: null };
  }
  try {
    const cleanUrl = websiteUrl.startsWith('http') ? websiteUrl : `http://${websiteUrl}`;
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 3500,
      maxContentLength: 1024 * 512,
      maxRedirects: 2
    });

    if (typeof response.data !== 'string') return { email: null, phone: null };

    const $ = cheerio.load(response.data);
    const pageText = $('body').text() || '';
    let emails = extractEmails(pageText);

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const em = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (em && em.includes('@')) emails.push(em);
    });
    emails = extractEmails(emails.join(' '));

    let telPhone = null;
    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const clean = extractValidPhone(href);
      if (clean && !telPhone) telPhone = clean;
    });

    let textPhone = telPhone || extractValidPhone(pageText);

    if (!emails[0] || !textPhone) {
      const pathsToProbe = ['/contact', '/about'];
      for (const p of pathsToProbe) {
        if (emails[0] && textPhone) break;
        try {
          const probeUrl = new URL(p, cleanUrl).href;
          const probeRes = await axios.get(probeUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
            timeout: 2500,
            maxContentLength: 1024 * 256
          });
          if (typeof probeRes.data === 'string') {
            const probe$ = cheerio.load(probeRes.data);
            const contactText = probe$('body').text() || '';

            probe$('a[href^="mailto:"]').each((_, el) => {
              const href = probe$(el).attr('href') || '';
              const em = href.replace(/^mailto:/i, '').split('?')[0].trim();
              if (em && em.includes('@')) emails.push(em);
            });

            if (!emails[0]) emails = extractEmails(contactText);
            if (!textPhone) textPhone = extractValidPhone(contactText);
          }
        } catch (e) { }
      }
    }

    return {
      email: emails[0] || null,
      phone: textPhone || null
    };
  } catch (err) {
    return { email: null, phone: null };
  }
}

// Helper: Deep Fallback Web Search for missing Contact / Email
async function deepSearchContact(businessName, locationStr) {
  try {
    const cleanName = (businessName || '').replace(/["']/g, '').trim();
    const cleanLoc = (locationStr || '').replace(/["']/g, '').trim();
    const query = encodeURIComponent(`${cleanName} ${cleanLoc} phone OR contact OR mobile`);
    const searchUrl = `https://html.duckduckgo.com/html/?q=${query}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      },
      timeout: 4500,
      maxContentLength: 1024 * 512
    });

    if (typeof response.data !== 'string') return { email: null, extraEmails: [], phoneFallback: null };

    const $ = cheerio.load(response.data);
    const pageText = $('body').text();
    const emails = extractEmails(pageText);
    const validPhone = extractValidPhone(null, pageText);

    return {
      email: emails[0] || null,
      extraEmails: emails,
      phoneFallback: validPhone || null
    };
  } catch (err) {
    return { email: null, extraEmails: [], phoneFallback: null };
  }
}

// Send lead to n8n webhook if configured
async function sendToN8nWebhook(webhookUrl, leadData) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, {
      event: 'lead_scraped',
      timestamp: new Date().toISOString(),
      lead: leadData
    }, { timeout: 5000 });
  } catch (err) {
    console.error(`n8n webhook delivery failed to ${webhookUrl}:`, err.message);
  }
}

// Helper: Detect Chrome/Chromium Binary across Linux, macOS, and Windows
function getChromeExecutablePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const paths = [
    // Linux
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/brave-browser',
    '/opt/brave.com/brave/brave',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    // Windows
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
    ...(process.env.LOCALAPPDATA ? [`${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`] : []),
    ...(process.env.PROGRAMFILES ? [`${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`] : []),
    ...(process.env['PROGRAMFILES(X86)'] ? [`${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`] : [])
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Browser Scraper Class (Lightweight Multi-Worker with In-Place Extraction & Tab Recycling)
class MultiWorkerScraper {
  constructor(config) {
    const targetLimit = parseInt(config.targetLeads) || parseInt(config.maxResults) || 100;
    const reqWorkers = parseInt(config.workerCount) || 2;
    // Cap at 4 max workers: protects low-end hardware from OOM crashes
    const effectiveWorkers = Math.min(Math.max(reqWorkers, 1), 4);

    const websiteFilter = config.websiteFilter || (config.onlyNoWebsite ? 'no_website' : 'all');
    this.config = {
      category: config.category || 'Plumber',
      location: config.location || 'Ahmedabad',
      subLocations: Array.isArray(config.subLocations) ? config.subLocations : [],
      isBulkMode: config.isBulkMode ?? true,
      lat: config.lat || null,
      lng: config.lng || null,
      workerCount: effectiveWorkers,
      websiteFilter: websiteFilter,
      onlyNoWebsite: websiteFilter === 'no_website',
      deepExtraction: config.deepExtraction ?? true,
      liveChrome: config.liveChrome ?? false,
      n8nWebhookUrl: config.n8nWebhookUrl || '',
      maxResults: targetLimit,
      targetLeads: targetLimit
    };
    this.browser = null;
    this.isStopping = false;
    this.isPaused = false;
    this.seenNames = new Set();
    this.subQueryQueue = [];
    this.generatedQueries = new Set();
  }

  // Create or configure a clean, lightweight Puppeteer page
  async createNewWorkerPage(workerId, existingPage = null) {
    if (!this.browser) return null;
    let page = existingPage;
    if (!page) {
      page = await this.browser.newPage();
    }
    page.on('error', err => console.error(`Worker ${workerId} page error:`, err.message));
    page.on('pageerror', () => {});

    try {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        const url = req.url().toLowerCase();
        // Block images, media, fonts, analytics & heavy tracking to keep RAM below ~80MB per tab
        if (
          ['image', 'media', 'font'].includes(resourceType) ||
          url.includes('google-analytics.com') ||
          url.includes('googletagmanager.com') ||
          url.includes('doubleclick.net') ||
          url.endsWith('.png') ||
          url.endsWith('.jpg') ||
          url.endsWith('.jpeg') ||
          url.endsWith('.webp') ||
          url.endsWith('.woff') ||
          url.endsWith('.woff2')
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });
    } catch (e) {}

    await page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    return page;
  }

  async stop() {
    this.isStopping = true;
    if (this.browser) {
      try {
        const pages = await this.browser.pages().catch(() => []);
        for (const p of pages) {
          try { await p.close(); } catch (e) { }
        }
        await this.browser.close();
      } catch (e) { }
      try {
        const proc = this.browser.process();
        if (proc) proc.kill('SIGKILL');
      } catch (e) { }
      this.browser = null;
    }
  }

  buildSubQueries(category, location, subLocations = []) {
    const cleanCat = category.trim();
    const cleanLoc = location.trim();
    const citySimpleName = cleanLoc.split(',')[0].trim();
    const queries = [];

    if (Array.isArray(subLocations) && subLocations.length > 0) {
      subLocations.forEach(sub => {
        let cleanSub = (sub || '').trim();
        cleanSub = cleanSub.replace(/\s*\([^)]*\)/g, '').trim();
        if (cleanSub) {
          if (cleanSub.toLowerCase().includes(citySimpleName.toLowerCase())) {
            queries.push(`${cleanCat} in ${cleanSub}`);
            queries.push(`${cleanCat} near ${cleanSub}`);
          } else {
            queries.push(`${cleanCat} in ${cleanSub}, ${citySimpleName}`);
            queries.push(`${cleanCat} near ${cleanSub}, ${citySimpleName}`);
          }
        }
      });
    }

    queries.push(`${cleanCat} in ${cleanLoc}`);
    queries.push(`${cleanCat} in ${citySimpleName}`);
    queries.push(`${cleanCat} near ${citySimpleName}`);

    const unique = Array.from(new Set(queries));
    unique.forEach(q => this.generatedQueries.add(q));
    return unique;
  }

  // Dynamic Query Replenishment:
  // When target is high (e.g. 500, 1000+) and initial sub-queries run low,
  // automatically inject semantic sub-niches (Cafe, Fast Food, Pure Veg, Dhaba, etc.)
  // and area grids so the query queue NEVER runs dry until targetLeads is 100% reached!
  replenishSubQueriesIfLow() {
    if (this.isStopping || scanStats.qualifiedCount >= this.config.targetLeads) return;

    const { category, location, subLocations } = this.config;
    const cleanCat = category.trim();
    const cleanLoc = location.trim();
    const citySimpleName = cleanLoc.split(',')[0].trim();

    const catLower = cleanCat.toLowerCase();
    let nicheList = [];

    if (['restaurant', 'cafe', 'food', 'dining', 'eatery', 'bar', 'dhaba', 'bakery', 'kitchen', 'pizza', 'burger', 'sweets'].some(k => catLower.includes(k))) {
      nicheList = [
        'Cafe', 'Fast Food', 'Pure Veg Restaurant', 'Punjabi Restaurant',
        'Gujarati Thali Restaurant', 'South Indian Restaurant', 'Pizza Restaurant',
        'Bakery & Cake Shop', 'Dhaba', 'Family Restaurant', 'Biryani',
        'Chinese Restaurant', 'Sweet Shop & Farsan', 'Street Food & Snacks',
        'Rooftop Restro & Cafe', 'North Indian Restaurant', 'Bhojanalay',
        'Ice Cream Parlour', 'Juice Bar & Shakes', 'Sandwich & Quick Bites'
      ];
    } else if (['dentist', 'dental', 'teeth'].some(k => catLower.includes(k))) {
      nicheList = [
        'Dental Clinic', 'Dentist', 'Orthodontist', 'Dental Surgeon',
        'Root Canal Specialist', 'Teeth Cleaning & Whitening', 'Pediatric Dentist',
        'Dental Care Center', 'Cosmetic Dental Clinic'
      ];
    } else if (['doctor', 'clinic', 'hospital', 'physician', 'medical'].some(k => catLower.includes(k))) {
      nicheList = [
        'Clinic', 'Doctor Clinic', 'General Physician', 'Multi Specialty Hospital',
        'Pediatrician Clinic', 'Dermatologist & Skin Clinic', 'ENT Specialist',
        'Orthopedic Clinic', 'Diagnostic Center & Pathology Lab', 'Eye Hospital'
      ];
    } else if (['gym', 'fitness', 'workout', 'yoga', 'crossfit'].some(k => catLower.includes(k))) {
      nicheList = [
        'Gym', 'Fitness Club', 'CrossFit Gym', 'Yoga Studio & Classes',
        'Bodybuilding & Unisex Gym', 'Personal Fitness Training', 'Zumba & Aerobics Center',
        'Health & Fitness Center', 'Pilates Studio'
      ];
    } else if (['real estate', 'property', 'builder', 'broker', 'realtor'].some(k => catLower.includes(k))) {
      nicheList = [
        'Real Estate Agent', 'Property Dealer', 'Real Estate Consultant',
        'Property Broker', 'Builders & Developers', 'Commercial Property Consultant',
        'Residential Real Estate', 'Rental Property Agent'
      ];
    } else if (['plumber', 'plumbing'].some(k => catLower.includes(k))) {
      nicheList = [
        'Plumbing Contractor', 'Plumber', 'Sanitary & Plumbing Services',
        'Emergency Plumber', 'Bathroom Fitting Services', 'Drain Cleaning Specialist',
        'Water Tank Cleaning & Repair', 'Pipe Fitting Contractor'
      ];
    } else if (['electrician', 'electrical'].some(k => catLower.includes(k))) {
      nicheList = [
        'Electrical Contractor', 'Electrician', 'Wiring & Lighting Contractor',
        'Home Electrical Repair', 'Industrial Electrical Services', 'Inverter & Battery Repair',
        'Emergency Electrician'
      ];
    } else if (['hvac', 'ac repair', 'air conditioning', 'cooling'].some(k => catLower.includes(k))) {
      nicheList = [
        'AC Repair & Service', 'HVAC Contractor', 'AC Installation & Gas Refill',
        'Split & Window AC Service', 'Ducting & Central AC Services', 'Refrigerator Repair'
      ];
    } else if (['car', 'auto', 'garage', 'mechanic', 'vehicle', 'repair'].some(k => catLower.includes(k))) {
      nicheList = [
        'Auto Garage', 'Car Service Center', 'Car Mechanic', 'Car AC Repair & Gas',
        'Car Denting & Painting', 'Wheel Alignment & Balancing', 'Car Wash & Detailing',
        'Multi Brand Car Workshop', 'Tyre Shop & Service'
      ];
    } else if (['lawyer', 'advocate', 'law firm', 'legal', 'attorney'].some(k => catLower.includes(k))) {
      nicheList = [
        'Advocate', 'Law Firm', 'High Court Advocate', 'Civil Lawyer',
        'Criminal Defence Lawyer', 'Family Court & Divorce Lawyer', 'Corporate Legal Consultant',
        'Property Documentation Lawyer', 'Notary Public'
      ];
    } else if (['salon', 'spa', 'beauty', 'parlour', 'hair'].some(k => catLower.includes(k))) {
      nicheList = [
        'Unisex Salon', 'Beauty Parlour', 'Hair Salon & Hair Spa', 'Luxury Day Spa',
        'Bridal Makeup Artist & Studio', 'Nail Art & Extension Studio', 'Skin Care & Laser Clinic'
      ];
    } else if (['web', 'software', 'digital', 'seo', 'it services', 'tech'].some(k => catLower.includes(k))) {
      nicheList = [
        'Web Design & Development Agency', 'Digital Marketing Company', 'Software Company',
        'SEO Agency', 'Mobile App Development', 'Social Media Marketing', 'IT Support & Networking'
      ];
    } else if (['school', 'coaching', 'classes', 'tuition', 'education', 'academy'].some(k => catLower.includes(k))) {
      nicheList = [
        'Coaching Classes', 'Tuition Center', 'Commerce & Science Classes',
        'IELTS & Spoken English Institute', 'CBSE Coaching', 'Pre School & Daycare',
        'Music & Dance Academy', 'Competitive Exam Coaching'
      ];
    } else if (['hotel', 'resort', 'lodge', 'guest house', 'stay'].some(k => catLower.includes(k))) {
      nicheList = [
        'Budget Hotel', '3 Star Hotel', 'Luxury Boutique Hotel', 'Business Hotel',
        'Guest House & Lodge', 'Resort', 'Service Apartments', 'Homestay'
      ];
    } else if (['photographer', 'photo', 'studio', 'videography'].some(k => catLower.includes(k))) {
      nicheList = [
        'Wedding Photographer', 'Photography Studio', 'Pre Wedding Shoot Specialist',
        'Commercial Product Photographer', 'Maternity & Baby Photographer', 'Videographer'
      ];
    } else {
      nicheList = [
        `Top ${cleanCat}`, `Best ${cleanCat}`, `${cleanCat} Center`,
        `${cleanCat} Agency`, `${cleanCat} Store & Showroom`, `${cleanCat} Services`,
        `Famous ${cleanCat}`, `Affordable ${cleanCat}`, `Professional ${cleanCat}`,
        `${cleanCat} Dealer & Supplier`, `${cleanCat} Contractor`
      ];
    }

    const areas = (Array.isArray(subLocations) && subLocations.length > 0)
      ? subLocations
      : [citySimpleName];

    const newQueries = [];
    for (const niche of nicheList) {
      for (const area of areas) {
        let cleanArea = (area || '').trim().replace(/\s*\([^)]*\)/g, '').trim();
        if (!cleanArea) continue;
        const q1 = `${niche} in ${cleanArea}, ${citySimpleName}`;
        if (!this.generatedQueries.has(q1)) {
          this.generatedQueries.add(q1);
          newQueries.push(q1);
        }
      }
    }

    // Include Ahmedabad pin-code grids if relevant
    if (citySimpleName.toLowerCase().includes('ahmedabad')) {
      const pinGrids = [
        '380009', '380015', '380052', '380058', '380054', '380008', '380059',
        '382481', '382350', '382330', '382424', '380007', '380013', '380061'
      ];
      for (const pin of pinGrids) {
        const qPin = `${cleanCat} in Ahmedabad ${pin}`;
        if (!this.generatedQueries.has(qPin)) {
          this.generatedQueries.add(qPin);
          newQueries.push(qPin);
        }
      }
    }

    // Shuffle newly generated queries so multi-workers distribute cleanly across areas
    for (let i = newQueries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newQueries[i], newQueries[j]] = [newQueries[j], newQueries[i]];
    }

    if (newQueries.length > 0) {
      this.subQueryQueue.push(...newQueries);
    }
  }

  async run() {
    const { category, location, subLocations, workerCount, liveChrome } = this.config;

    this.subQueryQueue = this.buildSubQueries(category, location, subLocations);

    scanStats.activeWorkers = workerCount;
    scanStats.workerDetails = Array.from({ length: workerCount }, (_, i) => ({
      id: i + 1,
      query: this.subQueryQueue[i % this.subQueryQueue.length] || `${category} in ${location}`,
      status: 'Opening Chrome Window...',
      scanned: 0,
      qualified: 0
    }));
    io.emit('stats_update', scanStats);

    const chromePath = getChromeExecutablePath();
    const launchOptions = {
      executablePath: chromePath,
      headless: !liveChrome,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--window-size=1280,800',
        '--lang=en-US',
        '--no-first-run',
        '--no-zygote',
        '--js-flags=--max-old-space-size=256',
        '--disk-cache-size=1',
        '--media-cache-size=1',
        '--disable-application-cache',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,CalculateNativeWinOcclusion',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--mute-audio',
        '--no-default-browser-check'
      ],
      defaultViewport: { width: 1280, height: 800 }
    };

    try {
      this.browser = await puppeteer.launch(launchOptions);
    } catch (err) {
      console.error('Failed to launch Chrome browser:', err);
      scanStats.status = 'error';
      io.emit('stats_update', scanStats);
      return;
    }

    const existingPages = await this.browser.pages();

    const workerPromises = Array.from({ length: workerCount }, (_, workerIndex) => {
      return this.runWorker(workerIndex, existingPages);
    });

    await Promise.allSettled(workerPromises);

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) { }
      this.browser = null;
    }

    scanStats.status = 'completed';
    scanStats.endTime = new Date().toISOString();
    scanStats.activeWorkers = 0;
    io.emit('stats_update', scanStats);
    io.emit('scan_completed', {
      leads: currentLeads,
      stats: scanStats,
      category: this.config.category,
      location: this.config.location
    });
  }

  async runWorker(workerIndex, existingPages) {
    const workerId = workerIndex + 1;
    let workerPage = null;

    try {
      if (!this.browser) return;

      this.updateWorkerStatus(workerId, 'Opening Chrome tab...');
      const firstExisting = (workerIndex === 0 && existingPages && existingPages.length > 0) ? existingPages[0] : null;
      workerPage = await this.createNewWorkerPage(workerId, firstExisting);

      while (!this.isStopping && scanStats.qualifiedCount < this.config.targetLeads) {
        if (scanStats.status === 'paused') {
          this.updateWorkerStatus(workerId, 'Paused');
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }

        if (scanStats.qualifiedCount >= this.config.targetLeads) {
          this.isStopping = true;
          this.updateWorkerStatus(workerId, `🎯 Target reached (${scanStats.qualifiedCount}/${this.config.targetLeads})`);
          break;
        }

        // Keep queue replenished so task NEVER terminates early before reaching targetLeads
        if (this.subQueryQueue.length <= this.config.workerCount * 2) {
          this.replenishSubQueriesIfLow();
        }

        const searchQuery = this.subQueryQueue.shift();
        if (!searchQuery) break;

        workerPage = await this.processQuery(workerId, workerPage, searchQuery);
      }

      this.updateWorkerStatus(workerId, `Completed worker tasks`);
    } catch (err) {
      console.error(`Worker ${workerId} error:`, err);
      this.updateWorkerStatus(workerId, `Error: ${err.message}`);
    } finally {
      if (workerPage) {
        try { await workerPage.close(); } catch (e) { }
      }
    }
  }

  async processQuery(workerId, workerPage, searchQuery) {
    const { lat, lng, isBulkMode, subLocations } = this.config;
    let mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    // Only lock to specific lat/lng coordinates if NOT in bulk mode and no sub-locations are used.
    // In bulk mode, each sub-area query (e.g. Bopal, Naroda, Satellite) MUST let Google Maps
    // naturally center on that neighborhood, otherwise all queries are trapped in the center!
    const hasSubAreas = (Array.isArray(subLocations) && subLocations.length > 0) || isBulkMode;
    if (lat && lng && !hasSubAreas) {
      mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}/@${lat},${lng},14z`;
    }
    this.updateWorkerStatus(workerId, `Opening feed: "${searchQuery}"`);

    try {
      await workerPage.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      return workerPage;
    }

    // PHASE 1: DEEP FEED HARVESTING
    // Pre-scroll the Google Maps feed 12-15 times to load 40-70+ cards before detail processing
    this.updateWorkerStatus(workerId, `Harvesting listings feed: "${searchQuery}"...`);
    let lastHarvestCount = 0;
    let noNewCardsHarvest = 0;
    const maxScrolls = 14;

    for (let scrollIdx = 0; scrollIdx < maxScrolls; scrollIdx++) {
      if (this.isStopping || scanStats.qualifiedCount >= this.config.targetLeads) break;

      const feedInfo = await workerPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[tabindex="-1"]');
        if (feed) {
          feed.scrollTop = feed.scrollHeight;
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
        const count = document.querySelectorAll('div.Nv2PK, div[role="article"]').length;
        const reachedEnd = document.body.innerText.includes("You've reached the end of the list");
        return { count, reachedEnd };
      }).catch(() => ({ count: 0, reachedEnd: false }));

      if (feedInfo.reachedEnd) break;
      if (feedInfo.count === lastHarvestCount && feedInfo.count > 0) {
        noNewCardsHarvest++;
        if (noNewCardsHarvest >= 3) break;
      } else {
        noNewCardsHarvest = 0;
      }
      lastHarvestCount = feedInfo.count;

      await new Promise(r => setTimeout(r, 700));
    }

    let processedInWorker = 0;
    let emptyPasses = 0;
    let prevCardCount = 0;

    while (!this.isStopping && scanStats.qualifiedCount < this.config.targetLeads) {
      if (scanStats.status === 'paused') {
        this.updateWorkerStatus(workerId, 'Paused');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      if (scanStats.qualifiedCount >= this.config.targetLeads) {
        this.isStopping = true;
        this.updateWorkerStatus(workerId, `🎯 Target reached (${scanStats.qualifiedCount}/${this.config.targetLeads})`);
        break;
      }

      this.updateWorkerStatus(workerId, `Scanning listings: "${searchQuery}"`);

      const placeItems = await workerPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]') || document.body;
        const cards = Array.from(feed.querySelectorAll('div.Nv2PK, div[role="article"]'));

        const items = [];
        cards.forEach((card, idx) => {
          const link = card.querySelector('a[href*="/maps/place/"]');
          if (!link) return;

          const href = link.getAttribute('href') || '';
          if (!href) return;

          const headlineEl = card.querySelector('div.fontHeadlineSmall, div.qBF1Pd, span.OSrA2b');
          let name = headlineEl ? headlineEl.innerText.trim() : (link.getAttribute('aria-label') || '').trim();
          if (!name || name.toLowerCase() === 'results') {
            name = link.innerText.trim();
          }

          name = name.split('\n')[0].replace(/^[0-9]+\.\s*/, '').trim();

          const cardText = card.innerText || '';
          const ratingMatch = cardText.match(/(\d\.\d)/);
          const reviewMatch = cardText.match(/\(([\d,]+)\)/);
          const phoneCardMatch = cardText.match(/(?:\+?91|0)?[-.\s]?[6-9]\d{4}[-.\s]?\d{5}|0\d{2,4}[-.\s]?\d{6,8}/);

          let cardWebsite = null;
          const cardWebEl = card.querySelector('a[data-value="Website"], a[aria-label*="website" i], a[aria-label*="Website"], a[aria-label*="site" i], a[data-tooltip*="website" i], a.lI9fbf');
          if (cardWebEl && cardWebEl.href && !cardWebEl.href.includes('google.com') && !cardWebEl.href.includes('google.co') && !cardWebEl.href.includes('googleusercontent.com')) {
            cardWebsite = cardWebEl.href;
          } else {
            const extLinks = Array.from(card.querySelectorAll('a[href^="http"]'));
            for (const el of extLinks) {
              const href = el.href || '';
              if (href && !href.includes('google.com') && !href.includes('google.co') && !href.includes('googleusercontent.com') && !href.includes('ggpht.com') && !href.includes('schema.org') && !href.includes('gstatic.com')) {
                cardWebsite = href;
                break;
              }
            }
          }

          const rating = ratingMatch ? ratingMatch[1] : null;
          const reviews = reviewMatch ? reviewMatch[1].replace(/,/g, '') : null;
          const cardPhone = phoneCardMatch ? phoneCardMatch[0] : null;

          if (name && name.length >= 2 && name.toLowerCase() !== 'results' && !name.toLowerCase().includes('sponsored')) {
            items.push({
              index: idx,
              name: name,
              url: href.startsWith('http') ? href : `https://www.google.com${href}`,
              cardSnippet: cardText,
              cardRating: rating,
              cardReviews: reviews,
              cardPhone: cardPhone,
              cardWebsite: cardWebsite
            });
          }
        });

        return items;
      });

      let newItemsInPass = 0;

      for (const item of placeItems) {
        if (this.isStopping || scanStats.qualifiedCount >= this.config.targetLeads) break;

        const normKey = item.name.toLowerCase().replace(/\s+/g, ' ');
        if (this.seenNames.has(normKey)) {
          continue;
        }

        this.seenNames.add(normKey);
        newItemsInPass++;
        scanStats.scannedCount++;
        processedInWorker++;

        this.updateWorkerStatus(workerId, `Reading details: "${item.name.substring(0, 22)}..."`);

        let detail = null;
        try {
          const clicked = await workerPage.evaluate((targetIndex, targetName) => {
            const feed = document.querySelector('div[role="feed"]') || document.body;
            const cards = Array.from(feed.querySelectorAll('div.Nv2PK, div[role="article"]'));
            let targetCard = cards[targetIndex];
            if (!targetCard || !targetCard.innerText.includes(targetName)) {
              targetCard = cards.find(c => (c.innerText || '').includes(targetName)) || targetCard;
            }
            if (targetCard) {
              targetCard.scrollIntoView({ block: 'center' });
              const link = targetCard.querySelector('a[href*="/maps/place/"]') || targetCard;
              link.click();
              return true;
            }
            return false;
          }, item.index, item.name).catch(() => false);

          if (clicked) {
            await Promise.race([
              workerPage.waitForSelector('h1.DUwfe, button[data-item-id="address"], button[data-item-id*="phone"]', { timeout: 3500 }),
              new Promise(r => setTimeout(r, 1200))
            ]).catch(() => {});
          }

          detail = await workerPage.evaluate((bName, cRating, cReviews, cPhone, cWebsite) => {
            const body = document.body;
            const mainPane = body.querySelector('div[role="main"]') || body.querySelector('div.m6QErb') || body;
            const fullText = body.innerText || '';

            const h1El = body.querySelector('h1.DUwfe, h1');
            let officialName = h1El ? h1El.innerText.trim() : '';
            if (!officialName || officialName.toLowerCase() === 'results') {
              officialName = bName;
            }

            let address = null;
            const addressBtn = body.querySelector('button[data-item-id="address"], button[aria-label*="Address"], button[aria-label*="address"]');
            if (addressBtn) {
              const aria = addressBtn.getAttribute('aria-label') || '';
              address = aria.replace(/^Address:\s*/i, '').trim() || addressBtn.innerText.trim();
            }

            let rawPhoneCandidate = null;
            const phoneEls = Array.from(body.querySelectorAll('button[data-item-id*="phone"], [data-item-id*="phone"], button[aria-label*="Phone"], button[aria-label*="phone"], button[aria-label*="Call"], button[aria-label*="Mobile"], button[data-tooltip*="phone"], button[data-tooltip*="Phone"], button[data-tooltip*="Call"], a[href^="tel:"], [data-item-id^="phone"]'));
            for (const el of phoneEls) {
              const dataId = el.getAttribute('data-item-id') || '';
              const aria = el.getAttribute('aria-label') || '';
              const tooltip = el.getAttribute('data-tooltip') || '';
              const href = el.getAttribute('href') || '';
              const innerText = (el.innerText || '').trim();

              if (dataId.includes('phone:tel:')) {
                rawPhoneCandidate = dataId.split('phone:tel:')[1];
                break;
              } else if (href.startsWith('tel:')) {
                rawPhoneCandidate = href.replace('tel:', '');
                break;
              } else if (aria && /\d{5,}/.test(aria)) {
                rawPhoneCandidate = aria;
                break;
              } else if (tooltip && /\d{5,}/.test(tooltip)) {
                rawPhoneCandidate = tooltip;
                break;
              } else if (innerText && /\d{5,}/.test(innerText)) {
                rawPhoneCandidate = innerText;
                break;
              }
            }

            if (!rawPhoneCandidate) {
              const ioRows = Array.from(body.querySelectorAll('div.Io6YTe, button.Csj9le, button[data-item-id], [aria-label]'));
              for (const row of ioRows) {
                const txt = (row.innerText || row.getAttribute('aria-label') || '').trim();
                const digits = txt.replace(/\D/g, '');
                if (digits.length >= 7 && digits.length <= 13 && (txt.includes('+') || txt.startsWith('0') || /^[6-9]/.test(digits))) {
                  rawPhoneCandidate = txt;
                  break;
                }
              }
            }

            if (!rawPhoneCandidate) {
              const phoneMatch = fullText.match(/(?:0|\+?91)?[-.\s]?[6-9]\d{4}[-.\s]?\d{5}|0\d{2,4}[-.\s]?\d{6,8}/);
              if (phoneMatch) rawPhoneCandidate = phoneMatch[0];
            }

            if (!rawPhoneCandidate && cPhone) {
              rawPhoneCandidate = cPhone;
            }

            let websiteUrl = cWebsite || null;

            if (!websiteUrl) {
              const websiteEl = body.querySelector('a[data-item-id="authority"], [data-item-id="authority"] a, a[aria-label*="website" i], a[aria-label*="Website"], a[aria-label*="site" i], a[data-tooltip*="website" i], button[data-item-id="authority"]');
              if (websiteEl) {
                const href = websiteEl.getAttribute('href') || websiteEl.href || '';
                if (href && !href.includes('google.com') && !href.includes('google.co') && !href.includes('googleusercontent.com')) {
                  websiteUrl = href;
                }
              }
            }

            if (!websiteUrl) {
              const links = Array.from(mainPane.querySelectorAll('a[href^="http"]'));
              for (const l of links) {
                const href = l.getAttribute('href') || l.href || '';
                if (href && !href.includes('google.com') && !href.includes('google.co') && !href.includes('googleusercontent.com') && !href.includes('ggpht.com') && !href.includes('schema.org') && !href.includes('gstatic.com') && !href.includes('w3.org')) {
                  websiteUrl = href;
                  break;
                }
              }
            }

            const hasWebsiteLink = !!websiteUrl;

            let openingHours = null;
            const hoursBtn = body.querySelector('button[data-item-id*="oh"], div[aria-label*="Hours"], div[aria-label*="Open"], div[aria-label*="Closed"]');
            if (hoursBtn) {
              const aria = hoursBtn.getAttribute('aria-label') || '';
              openingHours = aria.replace(/^Hours:\s*/i, '').replace(/^Opening hours:\s*/i, '').trim() || hoursBtn.innerText.trim();
            }

            let plusCode = null;
            const plusCodeBtn = body.querySelector('button[data-item-id="oloc"]');
            if (plusCodeBtn) {
              const aria = plusCodeBtn.getAttribute('aria-label') || '';
              plusCode = aria.replace(/^Plus code:\s*/i, '').trim() || plusCodeBtn.innerText.trim();
            }

            let rating = null;
            let reviews = null;
            const ratingEl = body.querySelector('div.F7v250 span[aria-hidden="true"], span.MW4et');
            if (ratingEl) rating = ratingEl.innerText.trim();
            if (!rating) {
              const ratingMatch = fullText.match(/(\d\.\d)\s*(?:\(|\n|★|stars)/i);
              if (ratingMatch) rating = ratingMatch[1];
            }
            if (!rating && cRating) rating = cRating;

            const reviewEl = body.querySelector('button[jsaction*="reviews"], span.UY7F9');
            if (reviewEl) {
              const revText = reviewEl.innerText || reviewEl.getAttribute('aria-label') || '';
              const revMatch = revText.match(/([\d,]+)/);
              if (revMatch) reviews = revMatch[1].replace(/,/g, '');
            }
            if (!reviews) {
              const reviewMatch = fullText.match(/\(([\d,]+)\)\s*(?:·|reviews)/i) || fullText.match(/([\d,]+)\s+reviews/i);
              if (reviewMatch) reviews = reviewMatch[1].replace(/,/g, '');
            }
            if (!reviews && cReviews) reviews = cReviews;

            let priceRange = null;
            const priceMatch = fullText.match(/(?:₹|\$|€|£)[\d,–\s]+per person/i) || fullText.match(/(?:₹|\$|€|£){1,4}/);
            if (priceMatch) priceRange = priceMatch[0];

            let categoryText = null;
            const catBtn = body.querySelector('button[jsaction*="category"], button.Dkftq');
            if (catBtn) categoryText = catBtn.innerText.trim();

            return {
              name: officialName || bName,
              hasWebsite: hasWebsiteLink,
              websiteUrl,
              rawPhoneCandidate,
              rating: rating || 'N/A',
              reviews: reviews || '0',
              address: address || null,
              categoryText: categoryText || null,
              openingHours: openingHours || 'Not Listed',
              plusCode: plusCode || 'N/A',
              priceRange: priceRange || 'N/A',
              rawText: fullText.substring(0, 4000)
            };
          }, item.name, item.cardRating, item.cardReviews, item.cardPhone, item.cardWebsite);

          // In-page Back to Feed (Fast & keeps feed scroll position intact!)
          await workerPage.evaluate(() => {
            const backBtn = document.querySelector('button[aria-label="Back"], button[jsaction*="back"], button[data-tooltip="Back"]');
            if (backBtn) {
              backBtn.click();
            } else {
              window.history.back();
            }
          }).catch(() => {});
          await workerPage.waitForSelector('div[role="feed"]', { timeout: 3500 }).catch(() => {});
          await new Promise(r => setTimeout(r, 350));
        } catch (err) {
          detail = {
            name: item.name,
            hasWebsite: !!item.cardWebsite,
            websiteUrl: item.cardWebsite || null,
            rawPhoneCandidate: item.cardPhone || null,
            rating: item.cardRating || 'N/A',
            reviews: item.cardReviews || '0',
            address: item.cardSnippet ? (item.cardSnippet.split('\n')[1] || this.config.location) : this.config.location,
            categoryText: this.config.category,
            openingHours: 'Not Listed',
            plusCode: 'N/A',
            priceRange: 'N/A',
            rawText: item.cardSnippet || ''
          };
        }

        const isNoWebsiteOnly = this.config.websiteFilter === 'no_website' || this.config.onlyNoWebsite;
        const isHasWebsiteOnly = this.config.websiteFilter === 'has_website';

        if (isNoWebsiteOnly && detail.hasWebsite) {
          scanStats.skippedCount++;
          io.emit('lead_skipped', {
            name: detail.name,
            reason: 'Has Website (' + (detail.websiteUrl || 'Domain present') + ' - Excluded)'
          });
          this.updateWorkerProgress(workerId, scanStats.scannedCount);
          continue;
        }

        if (isHasWebsiteOnly && !detail.hasWebsite) {
          scanStats.skippedCount++;
          io.emit('lead_skipped', {
            name: detail.name,
            reason: 'No Website (Skipped - Has Website filter active)'
          });
          this.updateWorkerProgress(workerId, scanStats.scannedCount);
          continue;
        }

        const targetCityName = (this.config.location || '').split(',')[0].trim().toLowerCase();
        if (targetCityName && targetCityName.length >= 3 && detail.address) {
          const addrLower = detail.address.toLowerCase();
          if (!targetCityName.includes('ahmedabad') && addrLower.includes('ahmedabad') && !addrLower.includes(targetCityName)) {
            scanStats.skippedCount++;
            io.emit('lead_skipped', {
              name: detail.name,
              reason: `Outside target location (${targetCityName} requested, found ${detail.address})`
            });
            this.updateWorkerProgress(workerId, scanStats.scannedCount);
            continue;
          }
        }

        let phoneClean = extractValidPhone(detail.rawPhoneCandidate, item.cardSnippet || detail.rawText);
        let emailFound = extractEmails(detail.rawText)[0] || null;

        if (detail.websiteUrl && (!phoneClean || !emailFound)) {
          this.updateWorkerStatus(workerId, `Scraping website: "${item.name.substring(0, 18)}..."`);
          const webContact = await scrapeWebsiteContact(detail.websiteUrl);
          if (!emailFound && webContact.email) emailFound = webContact.email;
          if (!phoneClean && webContact.phone) phoneClean = webContact.phone;
        }

        if (!phoneClean || !emailFound) {
          this.updateWorkerStatus(workerId, `Deep web search for contact: "${item.name.substring(0, 18)}..."`);
          const deepData = await deepSearchContact(detail.name, this.config.location);
          if (!emailFound && deepData.email) emailFound = deepData.email;
          if (!phoneClean && deepData.phoneFallback) phoneClean = deepData.phoneFallback;
        }

        const lead = {
          id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          name: detail.name,
          phone: phoneClean || 'Not Listed',
          email: emailFound || 'Not Listed',
          hasWebsite: detail.hasWebsite,
          websiteUrl: detail.websiteUrl || 'No Website',
          rating: detail.rating || 'N/A',
          reviews: detail.reviews || '0',
          address: detail.address || `${this.config.location}`,
          category: detail.categoryText || this.config.category,
          openingHours: detail.openingHours || 'Not Listed',
          plusCode: detail.plusCode || 'N/A',
          priceRange: detail.priceRange || 'N/A',
          placeUrl: item.url,
          source: 'Google Maps',
          scrapedAt: new Date().toLocaleTimeString(),
          workerId: workerId
        };

        currentLeads.unshift(lead);
        scanStats.qualifiedCount++;
        this.updateWorkerProgress(workerId, scanStats.scannedCount, true);

        io.emit('lead_found', lead);
        io.emit('stats_update', scanStats);

        if (scanStats.qualifiedCount >= this.config.targetLeads) {
          this.isStopping = true;
          this.updateWorkerStatus(workerId, `🎯 Goal of ${this.config.targetLeads} leads reached! Finishing...`);
          break;
        }

        if (this.config.n8nWebhookUrl) {
          sendToN8nWebhook(this.config.n8nWebhookUrl, lead);
        }

        // Tab Memory Recycling:
        // Automatically close and reopen the worker tab every 35 leads
        // This clears Chromium V8 heap and Blink DOM completely, locking RAM usage below ~100MB
        if (processedInWorker >= 35) {
          this.updateWorkerStatus(workerId, '♻️ Recycling tab memory...');
          try {
            await workerPage.close();
          } catch (e) {}
          workerPage = await this.createNewWorkerPage(workerId);
          processedInWorker = 0;
          await workerPage.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          await workerPage.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) feed.scrollTop = feed.scrollHeight;
          }).catch(() => {});
          await new Promise(r => setTimeout(r, 800));
        }
      }

      const currentCardCount = placeItems.length;
      if (currentCardCount <= prevCardCount && newItemsInPass === 0) {
        emptyPasses++;
      } else {
        emptyPasses = 0;
      }
      prevCardCount = currentCardCount;

      if (emptyPasses >= 6) {
        this.updateWorkerStatus(workerId, `Completed area "${searchQuery}". Moving to next area...`);
        break;
      }

      const isEnd = await workerPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[tabindex="-1"]');
        if (feed) {
          feed.scrollTop = feed.scrollHeight;
          feed.scrollBy(0, 3500);
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }
        return document.body.innerText.includes("You've reached the end of the list");
      }).catch(() => false);

      if (isEnd) {
        this.updateWorkerStatus(workerId, `Reached end of feed for "${searchQuery}"`);
        break;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    return workerPage;
  }

  updateWorkerStatus(workerId, statusText) {
    const worker = scanStats.workerDetails.find(w => w.id === workerId);
    if (worker) {
      worker.status = statusText;
      io.emit('stats_update', scanStats);
    }
  }

  updateWorkerProgress(workerId, scanned, isQualified = false) {
    const worker = scanStats.workerDetails.find(w => w.id === workerId);
    if (worker) {
      worker.scanned = scanned;
      if (isQualified) worker.qualified = (worker.qualified || 0) + 1;
      io.emit('stats_update', scanStats);
    }
  }
}

// API Routes
app.post('/api/start-scan', async (req, res) => {
  if (activeJob && scanStats.status === 'running') {
    return res.status(400).json({ error: 'A scan job is already running' });
  }

  const config = req.body;
  lastScanMeta = {
    category: config.category || 'Leads',
    location: config.location || 'Area'
  };
  currentLeads = [];
  scanStats = {
    scannedCount: 0,
    qualifiedCount: 0,
    skippedCount: 0,
    status: 'running',
    startTime: new Date().toISOString(),
    endTime: null,
    activeWorkers: Math.min(Math.max(parseInt(config.workerCount) || 2, 1), 4),
    workerDetails: []
  };

  activeJob = new MultiWorkerScraper(config);

  activeJob.run().catch(err => {
    console.error('Scan job overall failure:', err);
    scanStats.status = 'error';
    io.emit('stats_update', scanStats);
  });

  res.json({ success: true, message: 'Scan job initiated', config });
});

app.post('/api/stop-scan', async (req, res) => {
  if (activeJob) {
    await activeJob.stop();
    scanStats.status = 'stopped';
    scanStats.activeWorkers = 0;
    io.emit('stats_update', scanStats);
  }
  res.json({ success: true, message: 'Scan job stopped' });
});

app.post('/api/pause-scan', (req, res) => {
  if (activeJob) {
    activeJob.isPaused = !activeJob.isPaused;
    scanStats.status = activeJob.isPaused ? 'paused' : 'running';
    io.emit('stats_update', scanStats);
  }
  res.json({ success: true, status: scanStats.status });
});

app.get('/api/leads', (req, res) => {
  res.json({ leads: currentLeads, stats: scanStats });
});

app.post('/api/test-n8n', async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) return res.status(400).json({ error: 'Webhook URL is required' });

  try {
    const testLead = {
      id: 'test_lead_999',
      name: 'Sample Plumbing Co.',
      phone: '+1 555-019-2831',
      email: 'contact@sampleplumbing.com',
      hasWebsite: false,
      websiteUrl: 'No Website',
      rating: '4.8',
      reviews: '42',
      address: '123 Main Street, Downtown',
      category: 'Plumber',
      source: 'n8n Test Event',
      scrapedAt: new Date().toLocaleTimeString()
    };
    await sendToN8nWebhook(webhookUrl, testLead);
    res.json({ success: true, message: 'Test lead sent to n8n Webhook successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// In-memory Geocoding Cache (5 min TTL)
const geocodeCache = new Map();
function getCachedGeocode(key) {
  const item = geocodeCache.get(key);
  if (item && Date.now() - item.ts < 300000) return item.data;
  if (item) geocodeCache.delete(key);
  return null;
}
function setCachedGeocode(key, data) {
  if (geocodeCache.size > 200) {
    const firstKey = geocodeCache.keys().next().value;
    geocodeCache.delete(firstKey);
  }
  geocodeCache.set(key, { ts: Date.now(), data });
}

// Geocoding Proxy & Autocomplete Search Endpoint
app.get('/api/geocode/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  const lat = req.query.lat ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng ? parseFloat(req.query.lng) : null;

  if (!query) {
    return res.json({ results: [] });
  }

  const cacheKey = `search_${query.toLowerCase()}_${lat || ''}_${lng || ''}`;
  const cached = getCachedGeocode(cacheKey);
  if (cached) {
    return res.json({ results: cached });
  }

  try {
    const results = [];
    const seen = new Set();

    // 1. Query Photon API (Komoot - fast, fuzzy autocomplete & proximity bias)
    try {
      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`;
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        photonUrl += `&lat=${lat}&lon=${lng}`;
      }
      const photonRes = await axios.get(photonUrl, {
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });

      if (photonRes.data && Array.isArray(photonRes.data.features)) {
        for (const f of photonRes.data.features) {
          const p = f.properties || {};
          const coords = f.geometry && f.geometry.coordinates;
          if (!coords || coords.length < 2) continue;

          const itemLat = parseFloat(coords[1]);
          const itemLng = parseFloat(coords[0]);
          const name = p.name || query;
          const parts = [
            name,
            p.district || p.suburb || p.neighbourhood || p.street,
            p.city || p.town,
            p.state,
            p.country
          ].filter(Boolean);
          const displayName = Array.from(new Set(parts)).join(', ');
          const coordKey = `${itemLat.toFixed(3)},${itemLng.toFixed(3)}`;

          if (!seen.has(coordKey) && !seen.has(displayName.toLowerCase())) {
            seen.add(coordKey);
            seen.add(displayName.toLowerCase());
            results.push({
              id: p.osm_id || `${itemLat}_${itemLng}`,
              name: name,
              displayName: displayName,
              suburb: p.suburb || p.district || p.neighbourhood || '',
              city: p.city || p.town || p.county || '',
              state: p.state || '',
              country: p.country || '',
              lat: itemLat,
              lng: itemLng,
              type: p.type || p.osm_value || 'area',
              source: 'photon'
            });
          }
        }
      }
    } catch (err) {
      console.warn('Photon geocode search failed:', err.message);
    }

    // 2. Fallback to OpenStreetMap Nominatim if results are sparse or Photon failed
    if (results.length < 3) {
      try {
        const nomRes = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            format: 'json',
            q: query,
            limit: 8,
            addressdetails: 1
          },
          headers: {
            'User-Agent': 'LeadGeneratorApp/2.0 (contact: admin@leadgen.local)'
          },
          timeout: 6000
        });

        if (Array.isArray(nomRes.data)) {
          for (const item of nomRes.data) {
            const itemLat = parseFloat(item.lat);
            const itemLng = parseFloat(item.lon);
            const coordKey = `${itemLat.toFixed(3)},${itemLng.toFixed(3)}`;
            const addr = item.address || {};
            const name = item.name || query;
            const parts = [
              name,
              addr.suburb || addr.neighbourhood || addr.residential || addr.road,
              addr.city || addr.town || addr.village || addr.county,
              addr.state,
              addr.country
            ].filter(Boolean);
            const displayName = Array.from(new Set(parts)).join(', ') || item.display_name;

            if (!seen.has(coordKey) && !seen.has(displayName.toLowerCase())) {
              seen.add(coordKey);
              seen.add(displayName.toLowerCase());
              results.push({
                id: item.place_id || `${itemLat}_${itemLng}`,
                name: name,
                displayName: displayName,
                suburb: addr.suburb || addr.neighbourhood || '',
                city: addr.city || addr.town || addr.village || '',
                state: addr.state || '',
                country: addr.country || '',
                lat: itemLat,
                lng: itemLng,
                type: item.type || item.class || 'area',
                source: 'nominatim'
              });
            }
          }
        }
      } catch (nomErr) {
        console.warn('Nominatim fallback failed:', nomErr.message);
      }
    }

    setCachedGeocode(cacheKey, results);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message, results: [] });
  }
});

// Reverse Geocoding Endpoint
app.get('/api/geocode/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng query params are required' });
  }

  const cacheKey = `reverse_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const cached = getCachedGeocode(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    // 1. Try Photon reverse
    try {
      const photonRes = await axios.get(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
        headers: { 'Accept': 'application/json' },
        timeout: 5000
      });
      if (photonRes.data && Array.isArray(photonRes.data.features) && photonRes.data.features.length > 0) {
        const p = photonRes.data.features[0].properties || {};
        const parts = [
          p.name,
          p.district || p.suburb || p.neighbourhood || p.street,
          p.city || p.town,
          p.state,
          p.country
        ].filter(Boolean);
        const displayName = Array.from(new Set(parts)).join(', ');
        const result = {
          success: true,
          name: p.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          displayName: displayName || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          suburb: p.suburb || p.district || p.neighbourhood || '',
          city: p.city || p.town || p.county || '',
          state: p.state || '',
          country: p.country || '',
          lat,
          lng,
          source: 'photon'
        };
        setCachedGeocode(cacheKey, result);
        return res.json(result);
      }
    } catch (e) {
      console.warn('Photon reverse failed, trying Nominatim fallback:', e.message);
    }

    // 2. Fallback to Nominatim reverse
    try {
      const nomRes = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'json',
          lat,
          lon: lng,
          addressdetails: 1
        },
        headers: {
          'User-Agent': 'LeadGeneratorApp/2.0 (contact: admin@leadgen.local)'
        },
        timeout: 5000
      });

      if (nomRes.data) {
        const addr = nomRes.data.address || {};
        const name = nomRes.data.name || addr.suburb || addr.neighbourhood || addr.city || addr.town;
        const parts = [
          name,
          addr.suburb || addr.neighbourhood,
          addr.city || addr.town || addr.village,
          addr.state,
          addr.country
        ].filter(Boolean);

        const result = {
          success: true,
          name: name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          displayName: Array.from(new Set(parts)).join(', ') || nomRes.data.display_name,
          suburb: addr.suburb || addr.neighbourhood || '',
          city: addr.city || addr.town || addr.village || '',
          state: addr.state || '',
          country: addr.country || '',
          lat,
          lng,
          source: 'nominatim'
        };
        setCachedGeocode(cacheKey, result);
        return res.json(result);
      }
    } catch (nomErr) {
      console.warn('Nominatim reverse fallback failed:', nomErr.message);
    }

    const fallbackResult = {
      success: true,
      name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng
    };
    res.json(fallbackResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Export Endpoint
app.get('/api/export/csv', (req, res) => {
  const headers = ['ID', 'Business Name', 'Phone Number', 'Email', 'Has Website', 'Website URL', 'Rating', 'Address', 'Category', 'Opening Hours', 'Price Range', 'Plus Code', 'Google Maps Link', 'Scraped At'];
  const rows = currentLeads.map(l => [
    `"${l.id}"`,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${l.hasWebsite ? 'Yes' : 'No'}"`,
    `"${(l.websiteUrl || '').replace(/"/g, '""')}"`,
    `"${l.rating}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.openingHours || '').replace(/"/g, '""')}"`,
    `"${(l.priceRange || '').replace(/"/g, '""')}"`,
    `"${(l.plusCode || '').replace(/"/g, '""')}"`,
    `"${(l.placeUrl || '').replace(/"/g, '""')}"`,
    `"${l.scrapedAt}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const sanitize = (str) => (str || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const cat = sanitize(lastScanMeta.category) || 'Leads';
  const loc = sanitize((lastScanMeta.location || '').split(',').slice(0, 2).join(' ')) || 'Area';
  const dateStr = new Date().toISOString().slice(0, 10);
  const csvFileName = `${cat}_${loc}_${dateStr}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${csvFileName}"`);
  res.status(200).send(csvContent);
});

// Excel (.xlsx) Export Endpoint
app.get('/api/export/excel', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Google Maps Lead Finder';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Qualified Leads', {
      views: [{ showGridLines: true }]
    });

    const leads = currentLeads || [];
    const totalLeads = leads.length;
    const noWebsiteCount = leads.filter(l => !l.hasWebsite).length;
    const withPhoneCount = leads.filter(l => l.phone && l.phone !== 'Not Listed').length;
    const withEmailCount = leads.filter(l => l.email && l.email !== 'Not Listed').length;

    // ROW 1: Title Banner (Merged A1:J1)
    worksheet.mergeCells('A1:J1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'GOOGLE MAPS LEAD SCANNER — QUALIFIED PROSPECTING REPORT';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A73E8' } }; // Google Primary Blue
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 34;

    // ROW 2: Subtitle Banner (Merged A2:J2)
    worksheet.mergeCells('A2:J2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = `Generated on: ${new Date().toLocaleString()}`;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '5F6368' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F6F3EB' } }; // Warm Off-White Cream
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(2).height = 22;

    worksheet.getRow(3).height = 10;

    // ROWS 4 & 5: Summary Cards (A-J = 10 columns exact)
    worksheet.mergeCells('A4:C4');
    worksheet.mergeCells('A5:C5');
    worksheet.mergeCells('D4:F4');
    worksheet.mergeCells('D5:F5');
    worksheet.mergeCells('G4:H4');
    worksheet.mergeCells('G5:H5');
    worksheet.mergeCells('I4:J4');
    worksheet.mergeCells('I5:J5');

    const cardConfig = [
      { cell: 'A4', valCell: 'A5', label: 'EXTRACTED LEADS', val: totalLeads, color: '137333', bg: 'E6F4EA', border: 'CEEAD6' },
      { cell: 'D4', valCell: 'D5', label: 'PHONE NUMBERS FOUND', val: `${withPhoneCount}`, color: '1A73E8', bg: 'E8F0FE', border: 'D2E3FC' },
      { cell: 'G4', valCell: 'G5', label: 'NO-WEBSITE PROSPECTS', val: `${noWebsiteCount} (${Math.round((noWebsiteCount / totalLeads) * 100 || 0)}%)`, color: 'B06000', bg: 'FEF7E0', border: 'FEEFC3' },
      { cell: 'I4', valCell: 'I5', label: 'EMAILS FOUND', val: `${withEmailCount}`, color: 'C5221F', bg: 'FCE8E6', border: 'FAD2CF' }
    ];

    worksheet.getRow(4).height = 18;
    worksheet.getRow(5).height = 26;

    cardConfig.forEach(card => {
      const lbl = worksheet.getCell(card.cell);
      lbl.value = card.label;
      lbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '5F6368' } };
      lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
      lbl.alignment = { horizontal: 'center', vertical: 'middle' };

      const val = worksheet.getCell(card.valCell);
      val.value = card.val;
      val.font = { name: 'Calibri', size: 15, bold: true, color: { argb: card.color } };
      val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: card.bg } };
      val.alignment = { horizontal: 'center', vertical: 'middle' };

      [card.cell, card.valCell].forEach(c => {
        worksheet.getCell(c).border = {
          top: { style: 'thin', color: { argb: card.border } },
          bottom: { style: 'thin', color: { argb: card.border } },
          left: { style: 'thin', color: { argb: card.border } },
          right: { style: 'thin', color: { argb: card.border } }
        };
      });
    });

    worksheet.getRow(6).height = 12;

    // ROW 7: Table Headers
    const headers = [
      '#',
      'Business Name',
      'Phone Number',
      'Email Address',
      'Website Status',
      'Website URL',
      'Category',
      'Rating',
      'Full Address',
      'Google Maps Link'
    ];

    const colWidths = [
      { wch: 6 },   // #
      { wch: 32 },  // Business Name
      { wch: 20 },  // Phone Number
      { wch: 28 },  // Email Address
      { wch: 20 },  // Website Status
      { wch: 32 },  // Website URL
      { wch: 24 },  // Category
      { wch: 10 },  // Rating
      { wch: 42 },  // Full Address
      { wch: 22 }   // Google Maps Link
    ];

    colWidths.forEach((col, idx) => {
      worksheet.getColumn(idx + 1).width = col.wch;
    });

    const headerRow = worksheet.getRow(7);
    headerRow.values = headers;
    headerRow.height = 30;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A73E8' } }; // Google Blue Header
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'medium', color: { argb: '1557B0' } },
        bottom: { style: 'medium', color: { argb: '1557B0' } },
        left: { style: 'thin', color: { argb: '4285F4' } },
        right: { style: 'thin', color: { argb: '4285F4' } }
      };
    });

    // DATA ROWS (Row 8+)
    leads.forEach((lead, idx) => {
      const rowNum = 8 + idx;
      const row = worksheet.getRow(rowNum);
      row.height = 24;

      const hasWeb = !!lead.hasWebsite;
      const webStatusText = hasWeb ? 'HAS WEBSITE' : '🚫 NO WEBSITE';
      const phoneVal = lead.phone || 'Not Listed';
      const emailVal = lead.email || 'Not Listed';
      const webUrlVal = lead.websiteUrl || 'No Website';
      const ratingVal = lead.rating ? `${lead.rating} ★` : 'N/A';
      const mapUrl = lead.placeUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name || ''} ${lead.address || ''}`.trim())}`;

      row.values = [
        idx + 1,
        lead.name || 'N/A',
        phoneVal,
        emailVal,
        webStatusText,
        webUrlVal,
        lead.category || 'N/A',
        ratingVal,
        lead.address || 'N/A',
        ''
      ];

      const isEven = idx % 2 === 0;
      const rowBgColor = isEven ? 'FFFFFF' : 'FBF8F2';

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10, color: { argb: '1F2937' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E6E0D4' } },
          bottom: { style: 'thin', color: { argb: 'E6E0D4' } },
          left: { style: 'thin', color: { argb: 'E6E0D4' } },
          right: { style: 'thin', color: { argb: 'E6E0D4' } }
        };

        if ([1, 5, 8, 10].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        if (colNumber === 1) {
          cell.font = { name: 'Calibri', size: 9, color: { argb: '6B7280' }, bold: true };
        }
        if (colNumber === 2) {
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '111827' } };
        }
        if (colNumber === 3) {
          if (phoneVal !== 'Not Listed') {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '111827' } };
          } else {
            cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '9CA3AF' } };
          }
        }
        if (colNumber === 4) {
          if (emailVal !== 'Not Listed') {
            const safeEmail = emailVal.replace(/"/g, '""');
            cell.value = {
              formula: `HYPERLINK("mailto:${safeEmail}", "${safeEmail}")`,
              result: emailVal
            };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1A73E8' }, underline: true };
          } else {
            cell.value = 'Not Listed';
            cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '9CA3AF' } };
          }
        }
        if (colNumber === 5) {
          if (!hasWeb) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE8E6' } };
            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'EA4335' } };
          } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6F4EA' } };
            cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '34A853' } };
          }
        }
        if (colNumber === 6) {
          if (hasWeb && webUrlVal !== 'No Website') {
            const targetWebUrl = webUrlVal.startsWith('http') ? webUrlVal : `https://${webUrlVal}`;
            const safeWebUrl = targetWebUrl.replace(/"/g, '""');
            const safeWebText = webUrlVal.replace(/"/g, '""');
            cell.value = {
              formula: `HYPERLINK("${safeWebUrl}", "${safeWebText}")`,
              result: webUrlVal
            };
            cell.font = { name: 'Calibri', size: 9.5, color: { argb: '1A73E8' }, underline: true };
          } else {
            cell.value = 'No Website';
            cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '9CA3AF' } };
          }
        }
        if (colNumber === 8) {
          if (lead.rating && parseFloat(lead.rating) >= 4.0) {
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'B06000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF7E0' } };
          }
        }
      });

      const mapCell = row.getCell(10);
      const safeMapUrl = mapUrl.replace(/"/g, '""');
      mapCell.value = {
        formula: `HYPERLINK("${safeMapUrl}", "Open Location Pin 📍")`,
        result: 'Open Location Pin 📍'
      };
      mapCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1A73E8' }, underline: true };
      mapCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    const lastDataRow = 7 + leads.length;
    const footerRow = worksheet.getRow(lastDataRow + 1);
    footerRow.height = 28;

    worksheet.mergeCells(`A${lastDataRow + 1}:D${lastDataRow + 1}`);
    const summaryCell = worksheet.getCell(`A${lastDataRow + 1}`);
    summaryCell.value = `TOTAL RECORDS: ${leads.length} LEADS | NO-WEBSITE PROSPECTS: ${noWebsiteCount}`;
    summaryCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1F2937' } };
    summaryCell.alignment = { horizontal: 'left', vertical: 'middle' };

    for (let c = 1; c <= 10; c++) {
      const cell = footerRow.getCell(c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F6F3EB' } };
      cell.border = {
        top: { style: 'double', color: { argb: '1A73E8' } },
        bottom: { style: 'medium', color: { argb: '1A73E8' } }
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const sanitize = (str) => (str || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
    const cat = sanitize(lastScanMeta.category) || 'Leads';
    const loc = sanitize((lastScanMeta.location || '').split(',').slice(0, 2).join(' ')) || 'Area';
    const dateStr = new Date().toISOString().slice(0, 10);
    const excelFileName = `${cat}_${loc}_${dateStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFileName}"`);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error generating styled Excel file:', err);
    res.status(500).json({ error: 'Failed to generate Excel file' });
  }
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io:', socket.id);
  socket.emit('stats_update', scanStats);
  socket.emit('initial_leads', currentLeads);
});

// Static frontend build handling if frontend/dist exists
const frontendDistPath = path.join(__dirname, '../frontend/dist');
const localDistPath = path.join(__dirname, 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else if (fs.existsSync(localDistPath)) {
  app.use(express.static(localDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(localDistPath, 'index.html'));
  });
}

const DEFAULT_PORT = parseInt(process.env.PORT) || 3000;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Port ${DEFAULT_PORT} is in use. Retrying in 1 second...`);
    setTimeout(() => {
      server.close();
      server.listen(DEFAULT_PORT, '0.0.0.0', () => {
        console.log(`🚀 Google Maps Lead Generator Server running on http://0.0.0.0:${DEFAULT_PORT}`);
      });
    }, 1000);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(DEFAULT_PORT, '0.0.0.0', () => {
  console.log(`🚀 Lead Generator Backend Server running on http://0.0.0.0:${DEFAULT_PORT}`);
});

async function cleanupProcesses() {
  if (activeJob) {
    await activeJob.stop().catch(() => { });
  }
}
process.on('SIGINT', async () => {
  await cleanupProcesses();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await cleanupProcesses();
  process.exit(0);
});
