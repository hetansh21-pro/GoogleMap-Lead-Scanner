import ExcelJS from 'exceljs';

/**
 * Export leads array to a professionally styled Excel (.xlsx) file with modern executive design,
 * color-coded status badges, formatted headers, zebra striping, and auto-adjusted column widths.
 */
export async function downloadExcel(leads = [], filenamePrefix = 'LeadMap_Pro_Leads') {
  if (!leads || leads.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LeadMap Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Qualified Leads', {
    views: [{ showGridLines: true }]
  });

  // Calculate summary metrics
  const totalLeads = leads.length;
  const noWebsiteCount = leads.filter(l => !l.hasWebsite).length;
  const withPhoneCount = leads.filter(l => l.phone && l.phone !== 'Not Listed').length;
  const withEmailCount = leads.filter(l => l.email && l.email !== 'Not Listed').length;

  // --- 1. TITLE BANNER HEADER (Rows 1 - 3) ---
  worksheet.mergeCells('A1:J1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'LEADMAP PRO — QUALIFIED B2B LEADS REPORT';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } }; // Dark slate / navy
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 32;

  worksheet.mergeCells('A2:J2');
  const subtitleCell = worksheet.getCell('A2');
  subtitleCell.value = `Generated on: ${new Date().toLocaleString()} | Verified Business Contacts & Prospecting Data`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: '94A3B8' } };
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  // Row 3: Blank separator
  worksheet.getRow(3).height = 10;

  // --- 2. SUMMARY METRICS CARDS (Row 4 & 5) ---
  worksheet.mergeCells('A4:C4');
  worksheet.mergeCells('D4:F4');
  worksheet.mergeCells('G4:I4');
  worksheet.mergeCells('J4:L4');

  const cardConfig = [
    { cell: 'A4', valCell: 'A5', label: 'TOTAL LEADS EXTRACTED', val: totalLeads, color: '1E293B' },
    { cell: 'D4', valCell: 'D5', label: 'NO-WEBSITE PROSPECTS', val: `${noWebsiteCount} (${Math.round((noWebsiteCount/totalLeads)*100 || 0)}%)`, color: '166534' },
    { cell: 'G4', valCell: 'G5', label: 'PHONE NUMBERS FOUND', val: `${withPhoneCount}`, color: '1E40AF' },
    { cell: 'J4', valCell: 'J5', label: 'EMAILS EXTRACTED', val: `${withEmailCount}`, color: '6B21A8' }
  ];

  worksheet.getRow(4).height = 18;
  worksheet.getRow(5).height = 24;

  cardConfig.forEach(card => {
    const lbl = worksheet.getCell(card.cell);
    lbl.value = card.label;
    lbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '64748B' } };
    lbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
    lbl.alignment = { horizontal: 'center', vertical: 'middle' };

    const val = worksheet.getCell(card.valCell);
    val.value = card.val;
    val.font = { name: 'Calibri', size: 14, bold: true, color: { argb: card.color } };
    val.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
    val.alignment = { horizontal: 'center', vertical: 'middle' };

    // Apply light border to summary cards
    [card.cell, card.valCell].forEach(c => {
      worksheet.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
      };
    });
  });

  // Row 6: Blank separator
  worksheet.getRow(6).height = 12;

  // --- 3. DATA TABLE COLUMNS DEFINITION ---
  const headers = [
    '#',
    'Business Name',
    'Phone Number',
    'Email Address',
    'Has Website?',
    'Website URL',
    'Category',
    'Rating',
    'Reviews',
    'Full Address'
  ];

  const colWidths = [
    { wch: 6 },   // #
    { wch: 32 },  // Business Name
    { wch: 22 },  // Phone Number
    { wch: 30 },  // Email Address
    { wch: 24 },  // Has Website?
    { wch: 38 },  // Website URL
    { wch: 26 },  // Category
    { wch: 10 },  // Rating
    { wch: 14 },  // Reviews
    { wch: 45 }   // Full Address
  ];

  // Set column widths
  colWidths.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = col.wch;
  });

  // Add Header Row at Row 7
  const headerRow = worksheet.getRow(7);
  headerRow.values = headers;
  headerRow.height = 30;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } }; // Dark Slate
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: '0F172A' } },
      bottom: { style: 'medium', color: { argb: '0F172A' } },
      left: { style: 'thin', color: { argb: '334155' } },
      right: { style: 'thin', color: { argb: '334155' } }
    };
  });

  // --- 4. DATA ROWS POPULATION & STYLING ---
  leads.forEach((lead, idx) => {
    const rowNum = 8 + idx;
    const row = worksheet.getRow(rowNum);
    row.height = 24;

    const hasWeb = !!lead.hasWebsite;
    const webText = hasWeb ? 'Yes' : 'No (Qualified Prospect)';
    const phoneVal = lead.phone || 'Not Listed';
    const emailVal = lead.email || 'Not Listed';
    const webUrlVal = lead.websiteUrl || 'No Website';
    const ratingVal = lead.rating ? `${lead.rating} ★` : 'N/A';

    row.values = [
      idx + 1,
      lead.name || 'N/A',
      phoneVal,
      emailVal,
      webText,
      webUrlVal,
      lead.category || 'N/A',
      ratingVal,
      lead.reviews || '0',
      lead.address || 'N/A'
    ];

    // Alternating zebra striping color
    const isEven = idx % 2 === 0;
    const rowBgColor = isEven ? 'FFFFFF' : 'F8FAFC';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      // Base styling
      cell.font = { name: 'Calibri', size: 10, color: { argb: '1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBgColor } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } }
      };

      // Center align specific columns (#, Has Website, Rating, Reviews)
      if ([1, 5, 8, 9].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Column 1: # Index
      if (colNumber === 1) {
        cell.font = { name: 'Calibri', size: 9, color: { argb: '64748B' }, bold: true };
      }

      // Column 2: Business Name
      if (colNumber === 2) {
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: '0F172A' } };
      }

      // Column 3: Phone Number formatting
      if (colNumber === 3) {
        if (phoneVal !== 'Not Listed') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '0F172A' } };
        } else {
          cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '94A3B8' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FEFCE8' : 'FEF9C3' } }; // subtle amber hint
        }
      }

      // Column 4: Email formatting
      if (colNumber === 4) {
        if (emailVal !== 'Not Listed') {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '1D4ED8' } }; // Blue text
        } else {
          cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '94A3B8' } };
        }
      }

      // Column 5: Has Website? BADGE STYLING
      if (colNumber === 5) {
        if (!hasWeb) {
          // Highlight "No (Qualified Prospect)" with vibrant soft green pill fill
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } }; // Soft light green
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: '15803D' } }; // Dark emerald text
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
          cell.font = { name: 'Calibri', size: 9.5, color: { argb: '475569' } };
        }
      }

      // Column 6: Website URL formatting
      if (colNumber === 6) {
        if (hasWeb && webUrlVal !== 'No Website') {
          cell.font = { name: 'Calibri', size: 9.5, color: { argb: '2563EB' }, underline: true };
        } else {
          cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: '94A3B8' } };
        }
      }

      // Column 8: Rating Badge
      if (colNumber === 8) {
        if (lead.rating && parseFloat(lead.rating) >= 4.0) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'A16207' } }; // Gold rating
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } };
        }
      }
    });
  });

  // --- 5. SUMMARY FOOTER ROW ---
  const lastDataRow = 7 + leads.length;
  const footerRow = worksheet.getRow(lastDataRow + 1);
  footerRow.height = 28;

  worksheet.mergeCells(`A${lastDataRow + 1}:D${lastDataRow + 1}`);
  const summaryCell = worksheet.getCell(`A${lastDataRow + 1}`);
  summaryCell.value = `TOTAL RECORDS: ${leads.length} LEADS | QUALIFIED PROSPECTS: ${noWebsiteCount}`;
  summaryCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '0F172A' } };
  summaryCell.alignment = { horizontal: 'left', vertical: 'middle' };

  for (let c = 1; c <= 10; c++) {
    const cell = footerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
    cell.border = {
      top: { style: 'double', color: { argb: '0F172A' } },
      bottom: { style: 'medium', color: { argb: '0F172A' } }
    };
  }

  // --- 6. TRIGGER BROWSER DOWNLOAD ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;

  const timestamp = new Date().toISOString().slice(0, 10);
  anchor.download = `${filenamePrefix}_${timestamp}.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
