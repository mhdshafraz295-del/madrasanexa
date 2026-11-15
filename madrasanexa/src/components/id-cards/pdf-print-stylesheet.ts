/**
 * pdf-print-stylesheet.ts
 *
 * Dedicated standalone print and PDF stylesheet generator for MadrasaNexa.
 * Injects self-contained, physical millimetre-exact CSS rules into HTML payloads
 * sent to server-side Puppeteer (renderCardSheetPdf) and browser print windows.
 *
 * Guarantees zero reliance on external stylesheets or live application DOM trees.
 */

/**
 * Pre-converts an HTTP/HTTPS image URL into an inlined base64 Data URI.
 * Allows Puppeteer (which aborts non-data URLs for SSRF security) to render images with 100% fidelity.
 */
export async function convertImageUrlToDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Already a Data URI
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  try {
    // Attempt browser fetch + blob conversion
    const response = await fetch(trimmed, { mode: 'cors' });
    if (!response.ok) return null;

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    // Fallback via Image + Canvas
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 100;
          canvas.height = img.naturalHeight || img.height || 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = trimmed;
    });
  }
}

/**
 * Self-contained CSS stylesheet for A4 CR80 Student ID Card Batch Printing.
 */
export function getA4CardSheetPrintCss(): string {
  return `
    @page {
      size: 210mm 297mm portrait;
      margin: 0mm;
    }
    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0F172A !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    .a4-print-page {
      width: 210mm !important;
      height: 297mm !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: hidden !important;
      position: relative !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
    }
    .a4-print-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Core Layout Utilities */
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
    .block { display: block !important; }
    .text-center { text-align: center !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }
    .font-extrabold { font-weight: 800 !important; }

    /* CR80 Card Specific Classes */
    [data-card-side="front"], [data-card-side="back"] {
      width: 85.60mm !important;
      height: 53.98mm !important;
      border-radius: 3.18mm !important;
      background-color: #ffffff !important;
      border: 1px solid #e2e8f0 !important;
      overflow: hidden !important;
      position: relative !important;
      box-sizing: border-box !important;
    }
  `;
}

/**
 * Self-contained CSS stylesheet for A4 Student Credential Label Sheet Printing.
 */
export function getA4LabelSheetPrintCss(): string {
  return `
    @page {
      size: 210mm 297mm portrait;
      margin: 0mm;
    }
    * {
      box-sizing: border-box !important;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #0F172A !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
    }
    .a4-print-page {
      width: 210mm !important;
      height: 297mm !important;
      page-break-after: always !important;
      break-after: page !important;
      overflow: hidden !important;
      position: relative !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
    }
    .a4-print-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Core Layout Utilities */
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
    .line-clamp-1 { display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
    .line-clamp-2 { display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
    .block { display: block !important; }
    .text-center { text-align: center !important; }
    .uppercase { text-transform: uppercase !important; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
    .font-medium { font-weight: 500 !important; }
    .font-semibold { font-weight: 600 !important; }
    .font-bold { font-weight: 700 !important; }

    /* Cutting Boundary Guides */
    .border-dashed { border-style: dashed !important; }
    .border-solid { border-style: solid !important; }
    .border-stone-200 { border-color: #e7e5e4 !important; }
    .border-stone-300 { border-color: #d6d3d1 !important; }
    .border-slate-300 { border-color: #cbd5e1 !important; }

    /* Label Container Class */
    .student-credential-label {
      position: relative !important;
      background-color: #ffffff !important;
      color: #0F172A !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
  `;
}

/**
 * Builds the complete, self-contained HTML document for A4 Card Sheet PDF generation.
 */
export function buildSelfContainedCardSheetPdfHtml(params: {
  bodyHtml: string;
  title: string;
}): string {
  const { bodyHtml, title } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    ${getA4CardSheetPrintCss()}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

/**
 * Builds the complete, self-contained HTML document for A4 Credential Label Sheet PDF generation.
 */
export function buildSelfContainedLabelSheetPdfHtml(params: {
  bodyHtml: string;
  title: string;
}): string {
  const { bodyHtml, title } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    ${getA4LabelSheetPrintCss()}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}
