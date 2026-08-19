/**
 * Sanitization utilities.
 * Protect against HTML/script injection from spreadsheet values.
 */

export function sanitizeDisplayText(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeExcelValue(input: string | number | null | undefined): string | number {
  if (input === null || input === undefined) return '';
  if (typeof input === 'number') return input;
  const str = String(input);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .substring(0, 200);
}
