/**
 * generate-all-verification-artifacts.js
 *
 * Generates the 10 production-quality A4 PDF artifacts and rasterized PNG page images
 * for complete visual verification of:
 * - Module A: A4 Batch Student ID Card Print Studio (Front, Back, Duplex, Calibration)
 * - Module B: Student Credential Label Printing Studio (QR, Barcode, Dual, Minimal, Professional, Compact)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import QRCode from '../../madrasanexa/node_modules/qrcode/lib/server.js';
import JsBarcode from '../../madrasanexa/node_modules/jsbarcode/bin/JsBarcode.js';
import { renderCardSheetPdf, resolveChromeExecutablePath, closeSharedBrowser } from '../src/services/pdf-report.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Destination directories
const workspaceOutDir = path.resolve(__dirname, '../../pdf-artifacts');
const artifactOutDir = 'C:\\Users\\mhdna\\.gemini\\antigravity\\brain\\4f586434-0e69-4cad-b8b5-d3d4c31beabb\\pdf-artifacts';

fs.mkdirSync(workspaceOutDir, { recursive: true });
fs.mkdirSync(artifactOutDir, { recursive: true });

// Sample Institutional Logo as Base64 Data URI (Crisp Emerald Green Emblem)
const rawSvgLogo = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="#0F5A47" stroke="#34D399" stroke-width="4"/><path d="M50 20 L75 35 L75 65 L50 80 L25 65 L25 35 Z" fill="#FFFFFF"/><text x="50" y="58" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0F5A47" text-anchor="middle">MNX</text></svg>';
const SAMPLE_LOGO_DATA_URI = 'data:image/svg+xml;base64,' + Buffer.from(rawSvgLogo).toString('base64');

// Mock Student Dataset (8 diverse realistic students)
const MOCK_STUDENTS = [
  { id: 'stu-001', admissionNo: 'ADM-2026-001', fullName: 'Muhammad Abdullah Al-Hussaini', className: 'Hifz Class A', admissionDate: '2024-01-10', tokenHint: '...4a1f', rawToken: 'MNX1_4a1f9e2b8c7d6e5a4f3b2c1d0e9f8a7b' },
  { id: 'stu-002', admissionNo: 'ADM-2026-002', fullName: 'Fathima Zahra Bint Bilal', className: 'Alimiyyah 1st Year', admissionDate: '2024-01-12', tokenHint: '...8b2c', rawToken: 'MNX1_8b2c7d6e5a4f3b2c1d0e9f8a7b6c5d4e' },
  { id: 'stu-003', admissionNo: 'ADM-2026-003', fullName: 'Umar Farooq Mohamed Rizwan', className: 'Hifz Class B', admissionDate: '2024-02-01', tokenHint: '...1c3d', rawToken: 'MNX1_1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f' },
  { id: 'stu-004', admissionNo: 'ADM-2026-004', fullName: 'Amina Khadijah Sulaiman', className: 'Primary Grade 3', admissionDate: '2024-02-15', tokenHint: '...9e4f', rawToken: 'MNX1_9e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b' },
  { id: 'stu-005', admissionNo: 'ADM-2026-005', fullName: 'Zaid Ibn Harithah Nuwair', className: 'Tajweed Intermediate', admissionDate: '2024-03-01', tokenHint: '...5f5a', rawToken: 'MNX1_5f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c' },
  { id: 'stu-006', admissionNo: 'ADM-2026-006', fullName: 'Mariam Siddiqah Al-Ansari', className: 'Qur\'an Elementary', admissionDate: '2024-03-10', tokenHint: '...3a6b', rawToken: 'MNX1_3a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d' },
  { id: 'stu-007', admissionNo: 'ADM-2026-007', fullName: 'Bilal Ibn Rabah Mohamed', className: 'Hifz Class A', admissionDate: '2024-04-05', tokenHint: '...7c7d', rawToken: 'MNX1_7c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f' },
  { id: 'stu-008', admissionNo: 'ADM-2026-008', fullName: 'Safiyyah Zainab Al-Hashimi', className: 'Alimiyyah 2nd Year', admissionDate: '2024-04-12', tokenHint: '...2b8c', rawToken: 'MNX1_2b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e' },
];

const INSTITUTION_INFO = {
  name: 'Al-Huda Islamic Academy',
  code: 'MNX-HDA-01',
  phone: '+94 11 234 5678',
  email: 'info@alhuda.edu.lk',
  academicYear: '2025/2026',
};

// SVG Generators
async function generateQrSvg(token, sizeMm = 23.4) {
  return await QRCode.toString(token, {
    type: 'svg',
    version: 3,
    errorCorrectionLevel: 'M',
    margin: 0,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}

function generateBarcodeSvg(admissionNo, barWidth = 1.3, height = 24) {
  const Cls = JsBarcode.getModule('CODE128');
  const encoder = new Cls(admissionNo, {});
  const { data } = encoder.encode();
  const totalWidth = data.length * barWidth;
  let rects = '';
  for (let i = 0; i < data.length; i++) {
    if (data[i] === '1') {
      rects += `<rect x="${(i * barWidth).toFixed(2)}" y="0" width="${barWidth.toFixed(2)}" height="${height}" fill="#0F172A" />`;
    }
  }
  return `<svg viewBox="0 0 ${totalWidth.toFixed(2)} ${height}" width="${totalWidth.toFixed(2)}px" height="${height}px" xmlns="http://www.w3.org/2000/svg" style="display:block; max-width:100%; height:auto;">${rects}</svg>`;
}

// Standalone Stylesheets
function getCardSheetCss() {
  return `
    @page { size: 210mm 297mm portrait; margin: 0mm; }
    * { box-sizing: border-box !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #0F172A !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; -webkit-font-smoothing: antialiased; }
    .a4-print-page { width: 210mm !important; height: 297mm !important; page-break-after: always !important; break-after: page !important; overflow: hidden !important; position: relative !important; background: #ffffff !important; box-sizing: border-box !important; }
    .a4-print-page:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    .absolute { position: absolute !important; }
    .relative { position: relative !important; }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .items-center { align-items: center !important; }
    .justify-center { justify-content: center !important; }
    .justify-between { justify-content: space-between !important; }
    .grid { display: grid !important; }
    .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
    .overflow-hidden { overflow: hidden !important; }
    .shrink-0 { flex-shrink: 0 !important; }
    .min-w-0 { min-width: 0 !important; }
    .w-full { width: 100% !important; }
    .h-full { height: 100% !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .text-center { text-align: center !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }
    [data-card-side="front"], [data-card-side="back"] { width: 85.60mm !important; height: 53.98mm !important; border-radius: 3.18mm !important; background-color: #ffffff !important; border: 1px solid #e2e8f0 !important; overflow: hidden !important; position: relative !important; box-sizing: border-box !important; }
  `;
}

function getLabelSheetCss() {
  return `
    @page { size: 210mm 297mm portrait; margin: 0mm; }
    * { box-sizing: border-box !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { width: 210mm !important; margin: 0 !important; padding: 0 !important; background: #ffffff !important; color: #0F172A !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important; -webkit-font-smoothing: antialiased; }
    .a4-print-page { width: 210mm !important; height: 297mm !important; page-break-after: always !important; break-after: page !important; overflow: hidden !important; position: relative !important; background: #ffffff !important; box-sizing: border-box !important; }
    .a4-print-page:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    .absolute { position: absolute !important; }
    .relative { position: relative !important; }
    .flex { display: flex !important; }
    .flex-col { flex-direction: column !important; }
    .flex-1 { flex: 1 1 0% !important; }
    .items-center { align-items: center !important; }
    .justify-center { justify-content: center !important; }
    .justify-between { justify-content: space-between !important; }
    .overflow-hidden { overflow: hidden !important; }
    .shrink-0 { flex-shrink: 0 !important; }
    .min-w-0 { min-width: 0 !important; }
    .w-full { width: 100% !important; }
    .h-full { height: 100% !important; }
    .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
    .text-center { text-align: center !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .font-medium { font-weight: 500 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }
    .student-credential-label { position: relative !important; background-color: #ffffff !important; color: #0F172A !important; box-sizing: border-box !important; overflow: hidden !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; }
  `;
}

// Card Markup Builders
function buildCardFrontHtml(student) {
  const initials = student.fullName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'ST';
  const nameLength = student.fullName.length;
  const nameFontSize = nameLength > 32 ? '2.2mm' : nameLength > 22 ? '2.5mm' : '2.9mm';
  const nameLineHeight = nameLength > 32 ? '2.6mm' : nameLength > 22 ? '2.9mm' : '3.4mm';

  return `
    <div class="relative bg-white text-stone-900 overflow-hidden select-none border border-stone-200/90" style="width: 85.60mm; height: 53.98mm; border-radius: 3.18mm; box-sizing: border-box;" data-card-side="front">
      <div class="absolute inset-0 pointer-events-none" style="opacity: 0.035; background-image: radial-gradient(circle at 50% 50%, #0F5A47 1px, transparent 1px); background-size: 4mm 4mm;"></div>
      <div class="relative h-full flex flex-col justify-between" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 2.8mm; position: relative; box-sizing: border-box;">

        <!-- Header -->
        <div style="display: flex; align-items: center; gap: 2.2mm; padding-bottom: 1.8mm; border-bottom: 1px solid #e2e8f0;">
          <div style="width: 8.5mm; height: 8.5mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; border-radius: 1.2mm; overflow: hidden; border: 1px solid #e2e8f0;">
            <img src="${SAMPLE_LOGO_DATA_URI}" alt="${INSTITUTION_INFO.name}" style="width: 100%; height: 100%; object-fit: contain; padding: 0.3mm;" />
          </div>
          <div style="min-width: 0; flex: 1;">
            <h2 style="font-size: 2.6mm; font-weight: 800; color: #0F172A; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 3.0mm; letter-spacing: -0.01em;">${INSTITUTION_INFO.name}</h2>
            <div style="display: flex; align-items: center; gap: 1.5mm; margin-top: 0.3mm;">
              <span style="font-size: 1.8mm; font-weight: 700; color: #0F5A47; text-transform: uppercase; letter-spacing: 0.02em;">STUDENT ID CARD</span>
              <span style="font-size: 1.6mm; color: #94a3b8;">•</span>
              <span style="font-size: 1.8mm; font-family: monospace; color: #64748b;">${INSTITUTION_INFO.academicYear}</span>
            </div>
          </div>
        </div>

        <!-- Body: Photo + Details -->
        <div style="display: flex; gap: 2.6mm; align-items: center; padding: 1.2mm 0; flex: 1;">
          <div style="width: 21.5mm; height: 27.0mm; flex-shrink: 0; background-color: #f1f5f9; border-radius: 1.8mm; border: 1px solid #cbd5e1; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; position: relative;">
            <span style="font-size: 3.8mm; font-weight: 800; color: #0F5A47; letter-spacing: 0.05em;">${initials}</span>
            <span style="font-size: 1.3mm; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-top: 0.8mm; letter-spacing: 0.05em;">PHOTO</span>
          </div>

          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
            <h3 style="font-size: ${nameFontSize}; line-height: ${nameLineHeight}; font-weight: 800; color: #0F172A; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; letter-spacing: -0.01em; margin-bottom: 1.0mm;">${student.fullName}</h3>

            <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.0mm 2.0mm; padding-top: 0.8mm; border-top: 1px solid #f1f5f9;">
              <div>
                <span style="display: block; font-size: 1.4mm; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.02em;">ADMISSION NO</span>
                <span style="display: block; font-size: 2.0mm; font-family: monospace; font-weight: 700; color: #0F172A; margin-top: 0.2mm;">${student.admissionNo}</span>
              </div>
              <div>
                <span style="display: block; font-size: 1.4mm; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.02em;">CLASS</span>
                <span style="display: block; font-size: 2.0mm; font-weight: 700; color: #0F172A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.2mm;">${student.className}</span>
              </div>
              <div>
                <span style="display: block; font-size: 1.4mm; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.02em;">ISSUED</span>
                <span style="display: block; font-size: 1.8mm; color: #475569; font-weight: 500; margin-top: 0.2mm;">Jan 2026</span>
              </div>
              <div>
                <span style="display: block; font-size: 1.4mm; font-weight: 600; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.02em;">STATUS</span>
                <span style="display: block; font-size: 1.8mm; font-weight: 700; color: #0F5A47; margin-top: 0.2mm;">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 1.2mm;">
          <span style="font-size: 1.6mm; font-family: monospace; font-weight: 700; color: #0F5A47; letter-spacing: 0.03em;">CARD v1</span>
          <span style="font-size: 1.4mm; color: #64748b; font-weight: 500;">Authorized Student Identity</span>
          <span style="font-size: 1.4mm; font-family: monospace; color: #94a3b8;">${INSTITUTION_INFO.code}</span>
        </div>

      </div>
    </div>
  `;
}

async function buildCardBackHtml(student) {
  const qrSvg = await generateQrSvg(student.rawToken, 24);
  const barcodeSvg = generateBarcodeSvg(student.admissionNo, 1.2, 18);

  return `
    <div class="relative bg-white text-stone-900 overflow-hidden select-none border border-stone-200/90" style="width: 85.60mm; height: 53.98mm; border-radius: 3.18mm; box-sizing: border-box;" data-card-side="back">
      <div class="absolute inset-0 pointer-events-none" style="opacity: 0.03; background-image: radial-gradient(circle at 50% 50%, #0F172A 1px, transparent 1px); background-size: 4mm 4mm;"></div>
      <div class="relative h-full flex flex-col justify-between" style="height: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 2.8mm; position: relative; box-sizing: border-box;">

        <!-- Top Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 1.4mm; border-bottom: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 1.5mm; min-width: 0;">
            <span style="font-size: 2.2mm; font-weight: 700; color: #0F172A; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${INSTITUTION_INFO.name}</span>
          </div>
          <span style="font-size: 1.7mm; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-family: monospace; flex-shrink: 0;">Official Badge</span>
        </div>

        <!-- Center: QR + Barcode -->
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 3.0mm; padding: 1.0mm 0; flex: 1;">
          <!-- QR Box -->
          <div style="width: 25.0mm; height: 25.0mm; flex-shrink: 0; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 1.8mm; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.6mm; box-sizing: border-box;">
            ${qrSvg}
          </div>

          <!-- Barcode + Info -->
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="width: 100%; display: flex; justify-content: center; overflow: hidden;">
              ${barcodeSvg}
            </div>
            <span style="font-size: 1.8mm; font-family: monospace; font-weight: 700; color: #0F172A; margin-top: 0.5mm; letter-spacing: 0.05em;">${student.admissionNo}</span>
            <span style="font-size: 1.4mm; color: #64748b; margin-top: 0.5mm;">Token: ${student.tokenHint}</span>
          </div>
        </div>

        <!-- Bottom Notice -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 1.2mm; display: flex; justify-content: space-between; align-items: center; font-size: 1.5mm; color: #64748b;">
          <span>If found, please return to institution office</span>
          <span style="font-weight: 600; color: #0F5A47;">Tel: ${INSTITUTION_INFO.phone}</span>
        </div>

      </div>
    </div>
  `;
}

// 8-Card Sheet Builder (2x4 Grid on A4)
async function buildA4CardSheetPageHtml({ students, sheetType = 'front', mirrorColumns = false, pageNumber = 1, totalPages = 1 }) {
  const cardWidth = 85.60;
  const cardHeight = 53.98;
  const gutterX = 10.0;
  const gutterY = 4.0;
  const marginX = 14.40;
  const marginY = 34.54;

  const colPositions = [marginX, marginX + cardWidth + gutterX];
  const rowPositions = [
    marginY,
    marginY + cardHeight + gutterY,
    marginY + (cardHeight + gutterY) * 2,
    marginY + (cardHeight + gutterY) * 3,
  ];

  let slotsHtml = '';
  for (let r = 0; r < 4; r++) {
    const rowY = rowPositions[r];
    const s0 = students[r * 2];
    const s1 = students[r * 2 + 1];

    const leftStudent = mirrorColumns ? s1 : s0;
    const rightStudent = mirrorColumns ? s0 : s1;

    // Col 0
    slotsHtml += `
      <div class="absolute" style="left: ${colPositions[0]}mm; top: ${rowY}mm; width: ${cardWidth}mm; height: ${cardHeight}mm; box-sizing: border-box;">
        <!-- Crop Marks -->
        <div class="absolute" style="left: -3.0mm; top: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; top: 0; left: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; top: 0; left: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="right: -3.0mm; top: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; top: 0; right: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; top: 0; right: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="left: -3.0mm; bottom: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; bottom: 0; left: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; bottom: 0; left: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="right: -3.0mm; bottom: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; bottom: 0; right: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; bottom: 0; right: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        ${leftStudent ? (sheetType === 'front' ? buildCardFrontHtml(leftStudent) : await buildCardBackHtml(leftStudent)) : '<div style="width:100%;height:100%;border:1px dashed #cbd5e1;border-radius:3.18mm;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:2mm;">Unallocated Slot</div>'}
      </div>
    `;

    // Col 1
    slotsHtml += `
      <div class="absolute" style="left: ${colPositions[1]}mm; top: ${rowY}mm; width: ${cardWidth}mm; height: ${cardHeight}mm; box-sizing: border-box;">
        <!-- Crop Marks -->
        <div class="absolute" style="left: -3.0mm; top: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; top: 0; left: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; top: 0; left: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="right: -3.0mm; top: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; top: 0; right: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; top: 0; right: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="left: -3.0mm; bottom: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; bottom: 0; left: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; bottom: 0; left: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        <div class="absolute" style="right: -3.0mm; bottom: -3.0mm; width: 3.0mm; height: 3.0mm;"><div style="position: absolute; bottom: 0; right: 0; width: 3mm; height: 0.25mm; background: #000;"></div><div style="position: absolute; bottom: 0; right: 0; height: 3mm; width: 0.25mm; background: #000;"></div></div>
        ${rightStudent ? (sheetType === 'front' ? buildCardFrontHtml(rightStudent) : await buildCardBackHtml(rightStudent)) : '<div style="width:100%;height:100%;border:1px dashed #cbd5e1;border-radius:3.18mm;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:2mm;">Unallocated Slot</div>'}
      </div>
    `;
  }

  const sheetTypeLabel = sheetType === 'front' ? 'A4 BATCH: FRONT SHEET' : mirrorColumns ? 'A4 BATCH: BACK SHEET (DUPLEX MIRRORED)' : 'A4 BATCH: BACK SHEET (STANDARD)';

  return `
    <div class="a4-print-page" style="width: 210.00mm; height: 297.00mm; box-sizing: border-box; position: relative; background: #ffffff;">
      <!-- Top Header Band -->
      <div style="position: absolute; top: 6mm; left: 14.4mm; right: 14.4mm; height: 8mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 1mm; font-size: 1.8mm; font-family: monospace; color: #64748b; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 2mm;">
          <span style="font-weight: 700; text-transform: uppercase; color: #0F172A;">${INSTITUTION_INFO.name}</span>
          <span>•</span>
          <span style="color: #0F5A47; font-weight: 600;">${INSTITUTION_INFO.academicYear}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 3mm;">
          <span style="font-weight: 700; color: #1e293b;">${sheetTypeLabel}</span>
          <span style="background-color: #f1f5f9; padding: 0.4mm 1.5mm; border-radius: 0.5mm; font-weight: 700; color: #1e293b;">PAGE ${pageNumber} OF ${totalPages}</span>
        </div>
      </div>

      <!-- 2x4 Grid -->
      ${slotsHtml}

      <!-- Bottom Footer Band -->
      <div style="position: absolute; bottom: 6mm; left: 14.4mm; right: 14.4mm; height: 8mm; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e8f0; paddingTop: 1mm; font-size: 1.6mm; font-family: monospace; color: #64748b; box-sizing: border-box;">
        <span>MadrasaNexa Gate F • ISO-7810 ID-1 • Exact 85.60 × 53.98 mm</span>
        <span style="font-weight: 600; color: #334155;">Duplex Instruction: Flip on Long Edge • Print Scale: 100% (Do not fit to printable area)</span>
      </div>
    </div>
  `;
}

// Calibration Sheet Builder
function buildCalibrationSheetPageHtml() {
  const cardWidth = 85.60;
  const cardHeight = 53.98;
  const gutterX = 10.0;
  const gutterY = 4.0;
  const marginX = 14.40;
  const marginY = 34.54;

  const colPositions = [marginX, marginX + cardWidth + gutterX];
  const rowPositions = [
    marginY,
    marginY + cardHeight + gutterY,
    marginY + (cardHeight + gutterY) * 2,
    marginY + (cardHeight + gutterY) * 3,
  ];

  let boxesHtml = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const x = colPositions[c];
      const y = rowPositions[r];
      const slotNum = r * 2 + c + 1;
      boxesHtml += `
        <div class="absolute" style="left: ${x}mm; top: ${y}mm; width: ${cardWidth}mm; height: ${cardHeight}mm; border: 1px solid #0F5A47; border-radius: 3.18mm; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(15, 90, 71, 0.02);">
          <!-- Center crosshair -->
          <div style="position: absolute; width: 10mm; height: 0.25mm; background: #0F5A47;"></div>
          <div style="position: absolute; height: 10mm; width: 0.25mm; background: #0F5A47;"></div>
          <span style="font-size: 2.2mm; font-weight: 700; color: #0F5A47; font-family: monospace;">CR80 SLOT #${slotNum}</span>
          <span style="font-size: 1.6mm; color: #64748b; margin-top: 1mm;">85.60 × 53.98 mm</span>
        </div>
      `;
    }
  }

  return `
    <div class="a4-print-page" style="width: 210.00mm; height: 297.00mm; box-sizing: border-box; position: relative; background: #ffffff;">
      <!-- Header with 50mm ruler -->
      <div style="position: absolute; top: 6mm; left: 14.4mm; right: 14.4mm; text-align: center;">
        <h2 style="font-size: 2.6mm; font-weight: 800; color: #0F172A; text-transform: uppercase;">${INSTITUTION_INFO.name} • A4 ID CARD CALIBRATION SHEET</h2>
        <p style="font-size: 1.8mm; color: #64748b; margin-top: 0.5mm;">ISO/IEC 7810 ID-1 (CR80) 2×4 Grid Verification • Target Dimensions: 85.60 × 53.98 mm</p>

        <!-- 50mm Metric Calibration Ruler -->
        <div style="margin-top: 2mm; display: flex; align-items: center; justify-content: center; gap: 2mm;">
          <span style="font-size: 1.8mm; font-family: monospace; font-weight: 700; color: #334155;">0mm</span>
          <div style="width: 50.0mm; height: 6.0mm; border-bottom: 0.5mm solid #0F172A; position: relative;">
            <div style="position: absolute; left: 0; bottom: 0; width: 0.5mm; height: 4mm; background: #0F172A;"></div>
            <div style="position: absolute; left: 10mm; bottom: 0; width: 0.25mm; height: 3mm; background: #0F172A;"></div>
            <div style="position: absolute; left: 20mm; bottom: 0; width: 0.25mm; height: 3mm; background: #0F172A;"></div>
            <div style="position: absolute; left: 25mm; bottom: 0; width: 0.5mm; height: 4mm; background: #0F5A47;"></div>
            <div style="position: absolute; left: 30mm; bottom: 0; width: 0.25mm; height: 3mm; background: #0F172A;"></div>
            <div style="position: absolute; left: 40mm; bottom: 0; width: 0.25mm; height: 3mm; background: #0F172A;"></div>
            <div style="position: absolute; right: 0; bottom: 0; width: 0.5mm; height: 4mm; background: #0F172A;"></div>
          </div>
          <span style="font-size: 1.8mm; font-family: monospace; font-weight: 700; color: #334155;">50mm</span>
        </div>
      </div>

      <!-- 8 Wireframe Boxes -->
      ${boxesHtml}

      <!-- Footer Instructions -->
      <div style="position: absolute; bottom: 6mm; left: 14.4mm; right: 14.4mm; border-top: 1px solid #e2e8f0; padding-top: 1mm; display: flex; justify-content: space-between; font-size: 1.6mm; font-family: monospace; color: #64748b;">
        <span>Verify 50mm ruler with physical caliper • Expected tolerance: ±0.2 mm</span>
        <span style="font-weight: 700; color: #0F5A47;">Printer Scaling: 100% / Actual Size</span>
      </div>
    </div>
  `;
}

// Individual Credential Label Builder
async function buildIndividualLabelHtml({ student, style = 'professional', credentialMode = 'qr_only', cuttingGuide = 'dotted', widthMm, heightMm }) {
  const isCompact = style === 'compact';
  const isMinimal = style === 'minimal';
  const borderStyle = cuttingGuide === 'dotted' ? 'border: 1px dashed #cbd5e1;' : cuttingGuide === 'solid' ? 'border: 1px solid #cbd5e1;' : 'border: 1px solid transparent;';

  let qrSize = isCompact ? 16 : isMinimal ? Math.min(26, heightMm - 16) : Math.min(24, heightMm - 18);
  if (credentialMode === 'qr_and_barcode') {
    qrSize = isCompact ? 14 : 17;
  }

  const qrSvg = (credentialMode === 'qr_only' || credentialMode === 'qr_and_barcode') ? await generateQrSvg(student.rawToken, qrSize) : '';
  const barcodeSvg = (credentialMode === 'barcode_only' || credentialMode === 'qr_and_barcode') ? generateBarcodeSvg(student.admissionNo, isCompact ? 0.9 : 1.1, isCompact ? 14 : 18) : '';

  let cornerTicks = '';
  if (cuttingGuide === 'corners') {
    cornerTicks = `
      <div style="position: absolute; top: 0; left: 0; width: 2.5mm; height: 2.5mm;"><div style="position: absolute; top: 0; left: 0; width: 2.5mm; height: 0.25mm; background: #94a3b8;"></div><div style="position: absolute; top: 0; left: 0; height: 2.5mm; width: 0.25mm; background: #94a3b8;"></div></div>
      <div style="position: absolute; top: 0; right: 0; width: 2.5mm; height: 2.5mm;"><div style="position: absolute; top: 0; right: 0; width: 2.5mm; height: 0.25mm; background: #94a3b8;"></div><div style="position: absolute; top: 0; right: 0; height: 2.5mm; width: 0.25mm; background: #94a3b8;"></div></div>
      <div style="position: absolute; bottom: 0; left: 0; width: 2.5mm; height: 2.5mm;"><div style="position: absolute; bottom: 0; left: 0; width: 2.5mm; height: 0.25mm; background: #94a3b8;"></div><div style="position: absolute; bottom: 0; left: 0; height: 2.5mm; width: 0.25mm; background: #94a3b8;"></div></div>
      <div style="position: absolute; bottom: 0; right: 0; width: 2.5mm; height: 2.5mm;"><div style="position: absolute; bottom: 0; right: 0; width: 2.5mm; height: 0.25mm; background: #94a3b8;"></div><div style="position: absolute; bottom: 0; right: 0; height: 2.5mm; width: 0.25mm; background: #94a3b8;"></div></div>
    `;
  }

  const nameFontSize = isCompact ? '2.2mm' : isMinimal ? '2.6mm' : '2.5mm';
  const nameLineHeight = isCompact ? '2.6mm' : isMinimal ? '3.0mm' : '2.9mm';
  const padding = isCompact ? '1.5mm' : '2.5mm';

  let opticalZoneHtml = '';
  if (credentialMode === 'qr_only') {
    opticalZoneHtml = `<div style="display: flex; align-items: center; justify-content: center; flex: 1; padding: 0.5mm 0;"><div style="width: ${qrSize}mm; height: ${qrSize}mm; display: flex; align-items: center; justify-content: center; background: #ffffff;">${qrSvg}</div></div>`;
  } else if (credentialMode === 'barcode_only') {
    opticalZoneHtml = `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 0.5mm 0; overflow: hidden;"><div style="max-width: 100%; display: flex; justify-content: center;">${barcodeSvg}</div><span style="font-size: 1.8mm; font-family: monospace; font-weight: 700; color: #0F172A; margin-top: 0.5mm;">${student.admissionNo}</span></div>`;
  } else {
    // Both QR and Barcode
    opticalZoneHtml = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 2.0mm; flex: 1; padding: 0.5mm 0;">
        <div style="width: ${qrSize}mm; height: ${qrSize}mm; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">${qrSvg}</div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
          <div style="max-width: 100%; display: flex; justify-content: center;">${barcodeSvg}</div>
          <span style="font-size: 1.6mm; font-family: monospace; font-weight: 700; color: #0F172A; margin-top: 0.3mm;">${student.admissionNo}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="student-credential-label" style="width: ${widthMm}mm; height: ${heightMm}mm; padding: ${padding}; box-sizing: border-box; background: #ffffff; ${borderStyle} position: relative; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between;">
      ${cornerTicks}
      ${style === 'professional' ? '<div style="position: absolute; top: 0; left: 0; right: 0; height: 0.8mm; background: #0F5A47;"></div>' : ''}

      <!-- Top: Name & Admission -->
      <div style="width: 100%; text-align: center; flex-shrink: 0; padding-top: ${style === 'professional' ? '0.6mm' : '0.2mm'};">
        <h4 style="font-size: ${nameFontSize}; line-height: ${nameLineHeight}; font-weight: 700; color: #0F172A; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${student.fullName}</h4>
        <div style="margin-top: 0.4mm; display: flex; justify-content: center;">
          <span style="font-size: 1.8mm; font-family: monospace; font-weight: 700; color: #0F5A47; background: rgba(15, 90, 71, 0.08); padding: 0.2mm 1.5mm; border-radius: 0.4mm;">${student.admissionNo}</span>
        </div>
      </div>

      <!-- Center: Optical Zone -->
      ${opticalZoneHtml}

      <!-- Bottom: Institution -->
      <div style="text-align: center; flex-shrink: 0; padding-top: 0.3mm; border-top: 1px solid #f1f5f9;">
        <span style="font-size: 1.4mm; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.03em;">${INSTITUTION_INFO.name}</span>
      </div>
    </div>
  `;
}

// Full A4 Label Sheet Page Builder
async function buildA4LabelSheetPageHtml({ students, style = 'professional', credentialMode = 'qr_only', cuttingGuide = 'dotted', columns, rows, labelWidth, labelHeight, gapX, gapY, marginX, marginY }) {
  let labelsHtml = '';
  const totalSlots = columns * rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const idx = r * columns + c;
      const student = students[idx % students.length]; // Repeat mock students if sheet has more slots
      const posX = marginX + c * (labelWidth + gapX);
      const posY = marginY + r * (labelHeight + gapY);

      const labelInnerHtml = await buildIndividualLabelHtml({
        student,
        style,
        credentialMode,
        cuttingGuide,
        widthMm: labelWidth,
        heightMm: labelHeight,
      });

      labelsHtml += `
        <div class="absolute" style="left: ${posX}mm; top: ${posY}mm; width: ${labelWidth}mm; height: ${labelHeight}mm; box-sizing: border-box;">
          ${labelInnerHtml}
        </div>
      `;
    }
  }

  return `
    <div class="a4-print-page" style="width: 210.00mm; height: 297.00mm; box-sizing: border-box; position: relative; background: #ffffff;">
      <!-- Top Header Band -->
      <div style="position: absolute; top: 4mm; left: ${marginX}mm; right: ${marginX}mm; height: 7mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.8mm; font-size: 1.8mm; font-family: monospace; color: #64748b; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 2mm;">
          <span style="font-weight: 700; text-transform: uppercase; color: #0F172A;">${INSTITUTION_INFO.name}</span>
          <span>•</span>
          <span style="color: #0F5A47; font-weight: 600;">STUDENT CREDENTIAL LABELS (${credentialMode.toUpperCase().replace(/_/g, ' ')})</span>
        </div>
        <div style="display: flex; align-items: center; gap: 3mm;">
          <span>${columns}×${rows} Grid · ${labelWidth}×${labelHeight} mm</span>
          <span style="background-color: #f1f5f9; padding: 0.4mm 1.5mm; border-radius: 0.5mm; font-weight: 700; color: #1e293b;">PAGE 1 OF 1</span>
        </div>
      </div>

      <!-- Labels Grid -->
      ${labelsHtml}

      <!-- Bottom Footer Band -->
      <div style="position: absolute; bottom: 4mm; left: ${marginX}mm; right: ${marginX}mm; height: 7mm; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 0.8mm; font-size: 1.6mm; font-family: monospace; color: #64748b; box-sizing: border-box;">
        <span>MadrasaNexa Credential Studio · ISO Standard A4 (210 × 297 mm)</span>
        <span style="font-weight: 600; color: #334155;">Print Scale: 100% / Actual Size (Disable "Fit to Printable Area") · Cut along lines</span>
      </div>
    </div>
  `;
}

// Complete Document Wrappers
function wrapCardSheetDoc(pagesHtml, title) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${getCardSheetCss()}</style></head><body>${pagesHtml}</body></html>`;
}

function wrapLabelSheetDoc(pagesHtml, title) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${getLabelSheetCss()}</style></head><body>${pagesHtml}</body></html>`;
}

// Master Artifact Generation Runner
async function generateAllArtifacts() {
  console.log('================================================================');
  console.log('  MadrasaNexa A4 PDF Generation & Visual Verification Suite     ');
  console.log('================================================================\n');

  const generatedArtifacts = [];

  // Helper to compile, render PDF, save, and capture high-res PNG
  async function produceArtifact({ id, filename, title, isLabel, htmlContent, pageCount = 1 }) {
    console.log(`Generating [${id}] -> ${filename}...`);
    const fullHtml = isLabel ? wrapLabelSheetDoc(htmlContent, title) : wrapCardSheetDoc(htmlContent, title);

    // 1. Render PDF Buffer using server production service
    const pdfBuffer = await renderCardSheetPdf({ html: fullHtml });

    // Save PDF to workspace and artifact directories
    const wsPdfPath = path.join(workspaceOutDir, filename);
    const artPdfPath = path.join(artifactOutDir, filename);
    fs.writeFileSync(wsPdfPath, pdfBuffer);
    fs.writeFileSync(artPdfPath, pdfBuffer);
    console.log(`  ✓ PDF saved (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

    // 2. High-res Screenshot of Pages to PNG using Puppeteer
    const executablePath = resolveChromeExecutablePath();
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath,
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 }); // 2x retina A4
      await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });

      const pageElements = await page.$$('.a4-print-page');
      const pngFilenames = [];

      for (let i = 0; i < pageElements.length; i++) {
        const pngName = pageElements.length > 1
          ? filename.replace('.pdf', `-p${i + 1}.png`)
          : filename.replace('.pdf', '.png');

        const wsPngPath = path.join(workspaceOutDir, pngName);
        const artPngPath = path.join(artifactOutDir, pngName);

        await pageElements[i].screenshot({ path: wsPngPath });
        fs.copyFileSync(wsPngPath, artPngPath);
        pngFilenames.push(pngName);
        console.log(`  ✓ Rendered page ${i + 1} screenshot -> ${pngName}`);
      }

      generatedArtifacts.push({
        id,
        filename,
        pdfSizeKb: Number((pdfBuffer.length / 1024).toFixed(1)),
        pages: pageElements.length,
        pngFiles: pngFilenames,
      });
    } finally {
      await browser.close();
    }
  }

  // ==========================================
  // CANONICAL PRESETS FROM LabelPrintStudioModal.tsx
  // ==========================================
  const CANONICAL_STYLE_PRESETS = {
    minimal: {
      columns: 3,
      rows: 6,
      labelWidth: 58,
      labelHeight: 40,
      gapX: 5,
      gapY: 5,
      marginX: 13,
      marginY: 16,
    },
    professional: {
      columns: 3,
      rows: 5,
      labelWidth: 60,
      labelHeight: 48,
      gapX: 4,
      gapY: 5,
      marginX: 11,
      marginY: 16,
    },
    compact: {
      columns: 4,
      rows: 8,
      labelWidth: 45,
      labelHeight: 30,
      gapX: 4,
      gapY: 3.5,
      marginX: 9,
      marginY: 14.5,
    },
  };

  const runLabelsOnly = process.argv.includes('--labels-only');

  // ==========================================
  // MODULE A: A4 BATCH STUDENT ID CARD STUDIO
  // ==========================================
  if (!runLabelsOnly) {
    console.log('\n--- Module A: Batch Student ID Card Artifacts ---');

    // 1. test-batch-cards-front.pdf
    const frontHtml = await buildA4CardSheetPageHtml({ students: MOCK_STUDENTS, sheetType: 'front', pageNumber: 1, totalPages: 1 });
    await produceArtifact({
      id: 'A1',
      filename: 'test-batch-cards-front.pdf',
      title: 'Al-Huda Islamic Academy - Batch ID Cards Front',
      isLabel: false,
      htmlContent: frontHtml,
    });

    // 2. test-batch-cards-back.pdf
    const backHtml = await buildA4CardSheetPageHtml({ students: MOCK_STUDENTS, sheetType: 'back', mirrorColumns: false, pageNumber: 1, totalPages: 1 });
    await produceArtifact({
      id: 'A2',
      filename: 'test-batch-cards-back.pdf',
      title: 'Al-Huda Islamic Academy - Batch ID Cards Back',
      isLabel: false,
      htmlContent: backHtml,
    });

    // 3. test-batch-cards-duplex.pdf (2 Pages: Page 1 Front, Page 2 Back Mirrored)
    const duplexP1 = await buildA4CardSheetPageHtml({ students: MOCK_STUDENTS, sheetType: 'front', pageNumber: 1, totalPages: 2 });
    const duplexP2 = await buildA4CardSheetPageHtml({ students: MOCK_STUDENTS, sheetType: 'back', mirrorColumns: true, pageNumber: 2, totalPages: 2 });
    await produceArtifact({
      id: 'A3',
      filename: 'test-batch-cards-duplex.pdf',
      title: 'Al-Huda Islamic Academy - Batch ID Cards Duplex',
      isLabel: false,
      htmlContent: duplexP1 + duplexP2,
      pageCount: 2,
    });

    // 4. test-batch-cards-calibration.pdf
    const calibHtml = buildCalibrationSheetPageHtml();
    await produceArtifact({
      id: 'A4',
      filename: 'test-batch-cards-calibration.pdf',
      title: 'Al-Huda Islamic Academy - A4 Calibration Sheet',
      isLabel: false,
      htmlContent: calibHtml,
    });
  }

  // ==========================================
  // MODULE B: CREDENTIAL LABEL PRINTING STUDIO
  // (Using Canonical Approved Configurations)
  // ==========================================
  console.log('\n--- Module B: Student Credential Label Artifacts (Canonical Presets) ---');

  // 5. test-labels-qr.pdf (Professional preset: 60x48mm, 3x5, margins 11x16, gaps 4x5)
  const labelsQrHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'professional',
    credentialMode: 'qr_only',
    cuttingGuide: 'dotted',
    ...CANONICAL_STYLE_PRESETS.professional,
  });
  await produceArtifact({
    id: 'B1',
    filename: 'test-labels-qr.pdf',
    title: 'Al-Huda Islamic Academy - Credential Labels QR Only (Canonical Professional 60x48mm)',
    isLabel: true,
    htmlContent: labelsQrHtml,
  });

  // 6. test-labels-barcode.pdf (Professional preset: 60x48mm, 3x5, margins 11x16, gaps 4x5)
  const labelsBarcodeHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'professional',
    credentialMode: 'barcode_only',
    cuttingGuide: 'dotted',
    ...CANONICAL_STYLE_PRESETS.professional,
  });
  await produceArtifact({
    id: 'B2',
    filename: 'test-labels-barcode.pdf',
    title: 'Al-Huda Islamic Academy - Credential Labels Barcode Only (Canonical Professional 60x48mm)',
    isLabel: true,
    htmlContent: labelsBarcodeHtml,
  });

  // 7. test-labels-dual.pdf (Professional preset: 60x48mm, 3x5, margins 11x16, gaps 4x5)
  const labelsDualHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'professional',
    credentialMode: 'qr_and_barcode',
    cuttingGuide: 'dotted',
    ...CANONICAL_STYLE_PRESETS.professional,
  });
  await produceArtifact({
    id: 'B3',
    filename: 'test-labels-dual.pdf',
    title: 'Al-Huda Islamic Academy - Credential Labels Dual (Canonical Professional 60x48mm)',
    isLabel: true,
    htmlContent: labelsDualHtml,
  });

  // 8. test-labels-minimal.pdf (Minimal preset: 58x40mm, 3x6, margins 13x16, gaps 5x5)
  const labelsMinimalHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'minimal',
    credentialMode: 'qr_only',
    cuttingGuide: 'solid',
    ...CANONICAL_STYLE_PRESETS.minimal,
  });
  await produceArtifact({
    id: 'B4',
    filename: 'test-labels-minimal.pdf',
    title: 'Al-Huda Islamic Academy - Minimal Credential Labels (Canonical Minimal 58x40mm)',
    isLabel: true,
    htmlContent: labelsMinimalHtml,
  });

  // 9. test-labels-professional.pdf (Professional preset: 60x48mm, 3x5, margins 11x16, gaps 4x5)
  const labelsProfessionalHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'professional',
    credentialMode: 'qr_only',
    cuttingGuide: 'dotted',
    ...CANONICAL_STYLE_PRESETS.professional,
  });
  await produceArtifact({
    id: 'B5',
    filename: 'test-labels-professional.pdf',
    title: 'Al-Huda Islamic Academy - Professional Credential Labels (Canonical Professional 60x48mm)',
    isLabel: true,
    htmlContent: labelsProfessionalHtml,
  });

  // 10. test-labels-compact.pdf (Compact preset: 45x30mm, 4x8, margins 9x14.5, gaps 4x3.5)
  const labelsCompactHtml = await buildA4LabelSheetPageHtml({
    students: MOCK_STUDENTS,
    style: 'compact',
    credentialMode: 'qr_only',
    cuttingGuide: 'corners',
    ...CANONICAL_STYLE_PRESETS.compact,
  });
  await produceArtifact({
    id: 'B6',
    filename: 'test-labels-compact.pdf',
    title: 'Al-Huda Islamic Academy - Compact Credential Labels (Canonical Compact 45x30mm)',
    isLabel: true,
    htmlContent: labelsCompactHtml,
  });

  await closeSharedBrowser();

  console.log('\n================================================================');
  console.log('  All 10 PDF Artifacts and PNG Previews Successfully Generated! ');
  console.log('================================================================');
  console.table(generatedArtifacts);
}

generateAllArtifacts().catch((err) => {
  console.error('Fatal generation error:', err);
  process.exit(1);
});
