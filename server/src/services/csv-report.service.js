/**
 * CSV Report Service
 *
 * Generates RFC 4180 compliant CSV exports with:
 * - UTF-8 Byte Order Mark (\uFEFF) for Microsoft Excel compatibility across English, Arabic, Tamil, and Sinhala
 * - Strict formula injection protection (=, +, -, @) across all textual cells
 * - Quote doubling and delimiter escaping
 * - Safe numeric preservation
 */

/**
 * Sanitizes and escapes a single cell for CSV output.
 *
 * @param {any} value
 * @returns {string}
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);

  // If it's a numeric type or valid pure number string, preserve as is
  const isPureNumber = typeof value === 'number' || (!isNaN(Number(str)) && !str.startsWith('+') && !str.startsWith('0') && str.trim() !== '');

  // Formula injection defense: text starting with =, +, -, or @ must be prefixed with a single apostrophe (')
  if (!isPureNumber && str.length > 0) {
    const firstChar = str.charAt(0);
    if (firstChar === '=' || firstChar === '+' || firstChar === '-' || firstChar === '@') {
      str = `'${str}`;
    }
  }

  // RFC 4180 escaping: wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Serializes headers and tabular rows to a UTF-8 CSV string with BOM.
 *
 * @param {{ headers: string[], rows: (string|number|null|undefined)[][] }} param0
 * @returns {string}
 */
export function generateCsvString({ headers, rows }) {
  const BOM = '\uFEFF';
  const headerLine = headers.map(escapeCsvCell).join(',');

  if (!rows || rows.length === 0) {
    return `${BOM}${headerLine}\r\n`;
  }

  const rowLines = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  return `${BOM}${headerLine}\r\n${rowLines}\r\n`;
}
