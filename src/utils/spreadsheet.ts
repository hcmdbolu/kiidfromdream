import * as XLSX from 'xlsx';

export interface ParsedSpreadsheet {
  headers: string[];
  rows: string[][];
}

/**
 * Parses a CSV, TXT, XLS, or XLSX file into normalized string headers & rows.
 * Uses raw: false so phone numbers and barcodes preserve leading zeros.
 */
export async function parseSpreadsheetFile(
  file: File,
  csvFallback: (text: string) => ParsedSpreadsheet
): Promise<ParsedSpreadsheet> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', raw: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { headers: [], rows: [] };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });
    const nonEmpty = matrix.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim() !== '')
    );
    if (nonEmpty.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = nonEmpty[0].map((h) => String(h ?? '').trim());
    const rows = nonEmpty.slice(1).map((r) =>
      headers.map((_, idx) => String(r[idx] ?? '').trim())
    );
    return { headers, rows };
  }

  const text = await file.text();
  return csvFallback(text);
}

/**
 * Exports an array of flat objects to a formatted .xlsx Excel workbook download.
 */
export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, any>[]
): void {
  const safeSheetName = sheetName.slice(0, 31) || 'Report';
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
  const finalName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalName);
}
