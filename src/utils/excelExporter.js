import * as XLSX from 'xlsx';

/**
 * Export leads array to an Excel (.xlsx) file and trigger browser download
 */
export function downloadExcel(leads = [], filenamePrefix = 'LeadMap_Pro_Leads') {
  if (!leads || leads.length === 0) return;

  const formattedData = leads.map((lead, idx) => ({
    '#': idx + 1,
    'Business Name': lead.name || '',
    'Phone Number': lead.phone || 'Not Listed',
    'Email Address': lead.email || 'Not Listed',
    'Has Website?': lead.hasWebsite ? 'Yes' : 'No (Qualified Prospect)',
    'Website URL': lead.websiteUrl || 'No Website',
    'Category': lead.category || '',
    'Rating': lead.rating || 'N/A',
    'Reviews Count': lead.reviews || '0',
    'Full Address': lead.address || '',
    'Worker Thread': `Worker #${lead.workerId || 1}`,
    'Scraped At': lead.scrapedAt || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Define column widths for optimal display in Microsoft Excel / LibreOffice
  worksheet['!cols'] = [
    { wch: 6 },   // #
    { wch: 32 },  // Business Name
    { wch: 22 },  // Phone Number
    { wch: 30 },  // Email Address
    { wch: 24 },  // Has Website?
    { wch: 38 },  // Website URL
    { wch: 26 },  // Category
    { wch: 10 },  // Rating
    { wch: 15 },  // Reviews Count
    { wch: 45 },  // Full Address
    { wch: 16 },  // Worker Thread
    { wch: 16 }   // Scraped At
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Captured Leads');

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${timestamp}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
