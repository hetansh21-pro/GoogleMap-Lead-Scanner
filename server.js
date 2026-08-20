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
        } catch (e) {}
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

// Helper: Detect Chrome/Chromium Binary
function getChromeExecutablePath() {
  const paths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// Browser Scraper Class (Single Chrome Instance with Parallel Worker Tabs)
class MultiWorkerScraper {
  constructor(config) {
    const targetLimit = parseInt(config.targetLeads) || parseInt(config.maxResults) || 100;
    const reqWorkers = parseInt(config.workerCount) || 2;
    const effectiveWorkers = Math.min(Math.max(reqWorkers, 1), 4); // Cap at 4 workers to prevent memory crash

    const websiteFilter = config.websiteFilter || (config.onlyNoWebsite ? 'no_website' : 'all');
    this.config = {
      category: config.category || 'Plumber',
      location: config.location || 'Ahmedabad',
      lat: config.lat || null,
      lng: config.lng || null,
      workerCount: effectiveWorkers,
      websiteFilter: websiteFilter,
      onlyNoWebsite: websiteFilter === 'no_website',
      deepExtraction: config.deepExtraction ?? true,
      liveChrome: config.liveChrome ?? true,
      n8nWebhookUrl: config.n8nWebhookUrl || '',
      maxResults: targetLimit,
      targetLeads: targetLimit
    };
    this.browser = null;
    this.isStopping = false;
    this.isPaused = false;
    this.seenNames = new Set();
    this.subQueryQueue = [];
  }

  async stop() {
    this.isStopping = true;
    if (this.browser) {
      try {
        const pages = await this.browser.pages().catch(() => []);
        for (const p of pages) {
          try { await p.close(); } catch (e) {}
        }
        await this.browser.close();
      } catch (e) { }
      try {
        const proc = this.browser.process();
        if (proc) proc.kill('SIGKILL');
      } catch (e) {}
      this.browser = null;
    }
  }

  buildSubQueries(category, location) {
    const cleanCat = category.trim();
    const cleanLoc = location.trim();
    const zones = [
      '', 'Central', 'Downtown', 'North', 'South', 'East', 'West',
      'Main Market', 'City Center', 'Commercial Area', 'Suburbs',
      'Business District', 'Plaza', 'Outer', 'Market', 'Station Road',
      'Highway', 'Industrial Area', 'Zone 1', 'Zone 2', 'Zone 3',
      'Ring Road', 'Old City', 'New City', 'Extension', 'Complex'
    ];

    const base = zones.map(z => z ? `${cleanCat} in ${cleanLoc} ${z}` : `${cleanCat} in ${cleanLoc}`);
    base.push(`${cleanCat} near ${cleanLoc}`, `${cleanCat} ${cleanLoc}`);
    return Array.from(new Set(base));
  }

  async run() {
    const { category, location, workerCount, liveChrome } = this.config;

    this.subQueryQueue = this.buildSubQueries(category, location);

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
        '--window-size=1280,800',
        '--lang=en-US',
        '--no-first-run',
        '--no-zygote',
        '--js-flags=--max-old-space-size=512',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-extensions',
        '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
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
    io.emit('scan_completed', { leads: currentLeads, stats: scanStats });
  }

  async runWorker(workerIndex, existingPages) {
    const workerId = workerIndex + 1;
    let workerPage = null;

    try {
      if (!this.browser) return;

      this.updateWorkerStatus(workerId, 'Opening Chrome tab...');
      if (workerIndex === 0 && existingPages && existingPages.length > 0) {
        workerPage = existingPages[0];
      } else {
        workerPage = await this.browser.newPage();
      }

      // Safe page crash listeners
      workerPage.on('error', err => console.error(`Worker ${workerId} page error:`, err.message));
      workerPage.on('pageerror', err => console.error(`Worker ${workerId} page script error:`, err.message));

      // Optimize memory by blocking heavy media and images
      try {
        await workerPage.setRequestInterception(true);
        workerPage.on('request', (req) => {
          const resourceType = req.resourceType();
          if (['image', 'media', 'font'].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });
      } catch (e) {}

      await workerPage.setUserAgent(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      );

      while (!this.isStopping && scanStats.qualifiedCount < this.config.targetLeads && this.subQueryQueue.length > 0) {
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

        const searchQuery = this.subQueryQueue.shift();
        if (!searchQuery) break;

        await this.processQuery(workerId, workerPage, searchQuery);
      }

      this.updateWorkerStatus(workerId, `Completed worker tasks`);
    } catch (err) {
      console.error(`Worker ${workerId} error:`, err);
      this.updateWorkerStatus(workerId, `Error: ${err.message}`);
    } finally {
      if (workerPage && workerIndex > 0) {
        try { await workerPage.close(); } catch (e) {}
      }
    }
  }

  async processQuery(workerId, workerPage, searchQuery) {
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    this.updateWorkerStatus(workerId, `Opening feed: "${searchQuery}"`);

    try {
      await workerPage.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      return;
    }

    let processedInWorker = 0;
    let emptyPasses = 0;

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

      // Extract all valid place items currently visible in feed with high precision
      const placeItems = await workerPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]') || document.body;
        const cards = Array.from(feed.querySelectorAll('div.Nv2PK, div[role="article"]'));

        const items = [];
        cards.forEach((card, idx) => {
          const link = card.querySelector('a[href*="/maps/place/"]');
          if (!link) return;

          const href = link.getAttribute('href') || '';
          if (!href) return;

          // Extract business name from headline element or aria-label
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

        this.updateWorkerStatus(workerId, `Opening place page: "${item.name.substring(0, 22)}..."`);

        let detail = null;
        try {
          // Navigate directly to dedicated place page (google.com/maps/place/BusinessName/...)
          await workerPage.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
          await Promise.race([
            workerPage.waitForSelector('h1', { timeout: 4000 }),
            workerPage.waitForSelector('button[data-item-id="address"]', { timeout: 4000 }),
            workerPage.waitForSelector('button[data-item-id*="phone"]', { timeout: 4000 }),
            new Promise(r => setTimeout(r, 2000))
          ]).catch(() => {});
          await new Promise(r => setTimeout(r, 1200));

          // Extract complete details from the dedicated Google Maps place page
          detail = await workerPage.evaluate((bName, cRating, cReviews, cPhone, cWebsite) => {
            const body = document.body;
            const mainPane = body.querySelector('div[role="main"]') || body.querySelector('div.m6QErb') || body;
            const fullText = body.innerText || '';

            // 1. Business Name (from H1 on place page)
            const h1El = body.querySelector('h1.DUwfe, h1');
            let officialName = h1El ? h1El.innerText.trim() : '';
            if (!officialName || officialName.toLowerCase() === 'results') {
              officialName = bName;
            }

            // 2. Address Row (Location Pin Icon)
            let address = null;
            const addressBtn = body.querySelector('button[data-item-id="address"], button[aria-label*="Address"], button[aria-label*="address"]');
            if (addressBtn) {
              const aria = addressBtn.getAttribute('aria-label') || '';
              address = aria.replace(/^Address:\s*/i, '').trim() || addressBtn.innerText.trim();
            }

            // 3. Phone Extraction (All DOM buttons, text rows, aria-labels & tooltip attributes)
            let rawPhoneCandidate = null;

            // Check explicit Phone elements
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

            // Check all info text rows (div.Io6YTe, button.Csj9le)
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

            // Match regex in full body text
            if (!rawPhoneCandidate) {
              const phoneMatch = fullText.match(/(?:0|\+?91)?[-.\s]?[6-9]\d{4}[-.\s]?\d{5}|0\d{2,4}[-.\s]?\d{6,8}/);
              if (phoneMatch) rawPhoneCandidate = phoneMatch[0];
            }

            // Fallback to card phone candidate if place DOM was empty
            if (!rawPhoneCandidate && cPhone) {
              rawPhoneCandidate = cPhone;
            }

            // 4. Website Row (Comprehensive extraction across all DOM structures)
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

            // 5. Opening Hours Row (Clock Icon)
            let openingHours = null;
            const hoursBtn = body.querySelector('button[data-item-id*="oh"], div[aria-label*="Hours"], div[aria-label*="Open"], div[aria-label*="Closed"]');
            if (hoursBtn) {
              const aria = hoursBtn.getAttribute('aria-label') || '';
              openingHours = aria.replace(/^Hours:\s*/i, '').replace(/^Opening hours:\s*/i, '').trim() || hoursBtn.innerText.trim();
            }

            // 6. Plus Code Row (Grid Icon)
            let plusCode = null;
            const plusCodeBtn = body.querySelector('button[data-item-id="oloc"]');
            if (plusCodeBtn) {
              const aria = plusCodeBtn.getAttribute('aria-label') || '';
              plusCode = aria.replace(/^Plus code:\s*/i, '').trim() || plusCodeBtn.innerText.trim();
            }

            // 7. Rating & Reviews
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

            // 8. Price Range (Money Icon)
            let priceRange = null;
            const priceMatch = fullText.match(/(?:₹|\$|€|£)[\d,–\s]+per person/i) || fullText.match(/(?:₹|\$|€|£){1,4}/);
            if (priceMatch) priceRange = priceMatch[0];

            // 9. Category
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

          // Return to search results feed page
          await workerPage.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 1200));
        } catch (err) {
          detail = {
            name: item.name,
            hasWebsite: !!item.cardWebsite,
            websiteUrl: item.cardWebsite || null,
            rawPhoneCandidate: null,
            rating: item.cardRating || 'N/A',
            reviews: item.cardReviews || '0',
            address: null,
            categoryText: this.config.category,
            openingHours: 'Not Listed',
            plusCode: 'N/A',
            priceRange: 'N/A',
            rawText: item.cardSnippet
          };
          await workerPage.goto(mapsUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
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

        let phoneClean = extractValidPhone(detail.rawPhoneCandidate, item.cardSnippet || detail.rawText);
        let emailFound = extractEmails(detail.rawText)[0] || null;

        // Try website contact page first if domain exists
        if (detail.websiteUrl && (!phoneClean || !emailFound)) {
          this.updateWorkerStatus(workerId, `Scraping website: "${item.name.substring(0, 18)}..."`);
          const webContact = await scrapeWebsiteContact(detail.websiteUrl);
          if (!emailFound && webContact.email) emailFound = webContact.email;
          if (!phoneClean && webContact.phone) phoneClean = webContact.phone;
        }

        // Automatic Web Deep Search fallback if phone or email still missing
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
      }

      if (newItemsInPass === 0) {
        emptyPasses++;
      } else {
        emptyPasses = 0;
      }

      if (emptyPasses >= 5) {
        this.updateWorkerStatus(workerId, `Completed area "${searchQuery}". Moving to next area...`);
        break;
      }

      // Scroll down workerPage continuously to load more listings in the feed
      const isEnd = await workerPage.evaluate(() => {
        const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[tabindex="-1"]');
        if (feed) {
          feed.scrollBy(0, 3500);
        } else {
          window.scrollBy(0, 3500);
        }
        return document.body.innerText.includes("You've reached the end of the list");
      });

      if (isEnd) {
        this.updateWorkerStatus(workerId, `Reached end of feed for "${searchQuery}"`);
        break;
      }

      await new Promise(r => setTimeout(r, 2000));
    }
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
  currentLeads = [];
  scanStats = {
    scannedCount: 0,
    qualifiedCount: 0,
    skippedCount: 0,
    status: 'running',
    startTime: new Date().toISOString(),
    endTime: null,
    activeWorkers: Math.min(Math.max(parseInt(config.workerCount) || 3, 1), 8),
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

// CSV Export Endpoint
app.get('/api/export/csv', (req, res) => {
  const headers = ['ID', 'Business Name', 'Phone Number', 'Email', 'Has Website', 'Website URL', 'Rating', 'Reviews', 'Address', 'Category', 'Opening Hours', 'Price Range', 'Plus Code', 'Google Maps Link', 'Scraped At'];
  const rows = currentLeads.map(l => [
    `"${l.id}"`,
    `"${(l.name || '').replace(/"/g, '""')}"`,
    `"${(l.phone || '').replace(/"/g, '""')}"`,
    `"${(l.email || '').replace(/"/g, '""')}"`,
    `"${l.hasWebsite ? 'Yes' : 'No'}"`,
    `"${(l.websiteUrl || '').replace(/"/g, '""')}"`,
    `"${l.rating}"`,
    `"${l.reviews}"`,
    `"${(l.address || '').replace(/"/g, '""')}"`,
    `"${(l.category || '').replace(/"/g, '""')}"`,
    `"${(l.openingHours || '').replace(/"/g, '""')}"`,
    `"${(l.priceRange || '').replace(/"/g, '""')}"`,
    `"${(l.plusCode || '').replace(/"/g, '""')}"`,
    `"${(l.placeUrl || '').replace(/"/g, '""')}"`,
    `"${l.scrapedAt}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=google_maps_leads.csv');
  res.status(200).send(csvContent);
});

// Excel (.xlsx) Export Endpoint
app.get('/api/export/excel', (req, res) => {
  const formattedData = currentLeads.map((l, idx) => ({
    '#': idx + 1,
    'Business Name': l.name || '',
    'Phone Number': l.phone || 'Not Listed',
    'Email Address': l.email || 'Not Listed',
    'Has Website?': l.hasWebsite ? 'Yes' : 'No (Qualified)',
    'Website URL': l.websiteUrl || 'No Website',
    'Rating': l.rating || 'N/A',
    'Reviews': l.reviews || '0',
    'Address': l.address || '',
    'Category': l.category || '',
    'Opening Hours': l.openingHours || 'Not Listed',
    'Price Range': l.priceRange || 'N/A',
    'Plus Code': l.plusCode || 'N/A',
    'Google Maps Link': l.placeUrl || '',
    'Worker Thread': `Worker #${l.workerId || 1}`,
    'Scraped At': l.scrapedAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 32 }, { wch: 22 }, { wch: 30 },
    { wch: 22 }, { wch: 38 }, { wch: 10 }, { wch: 15 },
    { wch: 45 }, { wch: 25 }, { wch: 25 }, { wch: 18 },
    { wch: 20 }, { wch: 45 }, { wch: 15 }, { wch: 15 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Captured Leads');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=google_maps_leads.xlsx');
  res.send(buffer);
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('Client connected to Socket.io:', socket.id);
  socket.emit('stats_update', scanStats);
  socket.emit('initial_leads', currentLeads);
});

// Vite Static Serve handling for Production / Preview mode
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const DEFAULT_PORT = parseInt(process.env.PORT) || 3001;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️ Port ${DEFAULT_PORT} is in use. Retrying in 1 second...`);
    setTimeout(() => {
      server.close();
      server.listen(DEFAULT_PORT, () => {
        console.log(`🚀 Google Maps Lead Generator Server running on http://localhost:${DEFAULT_PORT}`);
      });
    }, 1000);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(DEFAULT_PORT, () => {
  console.log(`🚀 Google Maps Lead Generator Server running on http://localhost:${DEFAULT_PORT}`);
});

async function cleanupProcesses() {
  if (activeJob) {
    await activeJob.stop().catch(() => {});
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

