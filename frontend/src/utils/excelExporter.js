import ExcelJS from 'exceljs';

/**
 * Export leads array to a professionally formatted Excel (.xlsx) file matching the Google Off-White Theme.
 * Includes clean Excel Hyperlinks for Google Maps Links, formatted headers, Google 4-Color summary cards,
 * zebra striping, and exact cell bounds (no raw string overflow!).
 */
export async function downloadExcel(leads = [], options = {}) {
  if (!leads || leads.length === 0) return;

  // Extract category, location, or custom prefix
  let category = '';
  let location = '';
  let customPrefix = '';

  if (typeof options === 'string') {
    customPrefix = options;
  } else if (options && typeof options === 'object') {
    category = options.category || '';
    location = options.location || '';
    customPrefix = options.filenamePrefix || '';
  }

  // Fallback to category of first lead if not passed
  if (!category && leads[0]?.category && leads[0].category !== 'N/A') {
    category = leads[0].category;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Google Maps Lead Finder';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Qualified Leads', {
    views: [{ showGridLines: true }]
  });

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
    { cell: 'G4', valCell: 'G5', label: 'NO-WEBSITE PROSPECTS', val: `${noWebsiteCount} (${Math.round((noWebsiteCount/totalLeads)*100 || 0)}%)`, color: 'B06000', bg: 'FEF7E0', border: 'FEEFC3' },
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

  // ROW 7: Table Headers (No Reviews column)
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
    const mapUrl = lead.placeUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.name} ${lead.address || ''}`)}`;

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
      '' // Col 10 will be set as Google Maps Link below
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

      // Col 1: Index
      if (colNumber === 1) {
        cell.font = { name: 'Calibri', size: 9, color: { argb: '6B7280' }, bold: true };
      }

      // Col 2: Business Name
      if (colNumber === 2) {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '111827' } };
      }

      // Col 3: Phone
      if (colNumber === 3) {
        if (phoneVal !== 'Not Listed') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '111827' } };
        } else {
          cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '9CA3AF' } };
        }
      }

      // Col 4: Email (Clickable mailto link if present)
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

      // Col 5: Website Status
      if (colNumber === 5) {
        if (!hasWeb) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE8E6' } };
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'EA4335' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E6F4EA' } };
          cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '34A853' } };
        }
      }

      // Col 6: Website URL (Formula HYPERLINK)
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

      // Col 8: Rating
      if (colNumber === 8) {
        if (lead.rating && parseFloat(lead.rating) >= 4.0) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'B06000' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF7E0' } };
        }
      }
    });

    // Col 10: Clean Compact Google Maps Location Link (Formula HYPERLINK)
    const mapCell = row.getCell(10);
    const safeMapUrl = mapUrl.replace(/"/g, '""');
    mapCell.value = {
      formula: `HYPERLINK("${safeMapUrl}", "Open Location Pin 📍")`,
      result: 'Open Location Pin 📍'
    };
    mapCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1A73E8' }, underline: true };
    mapCell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // SUMMARY FOOTER ROW
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

  // Generate Excel buffer & download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;

  // Generate filename based on Niche (Category) and Location
  const sanitize = (str) => {
    if (!str) return '';
    return str
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
  };

  const timestamp = new Date().toISOString().slice(0, 10);
  let finalFileName = '';

  if (customPrefix) {
    finalFileName = `${sanitize(customPrefix)}_${timestamp}.xlsx`;
  } else {
    const cleanCat = sanitize(category) || 'Leads';
    const cleanLoc = sanitize(location ? location.split(',').slice(0, 2).join(' ') : '') || 'Area';
    finalFileName = `${cleanCat}_${cleanLoc}_${timestamp}.xlsx`;
  }

  anchor.download = finalFileName;

  document.body.appendChild(anchor);
  anchor.click();

  // Safely delay cleanup so the browser download engine completes file transfer before URL revocation
  setTimeout(() => {
    try {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // Ignore cleanup errors
    }
  }, 10000);
}
