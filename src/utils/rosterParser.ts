import { GroupPod, ParsedCsvPreview, Student } from '../types/classroom';

export const SAMPLE_STUDENT_NAMES: string[] = [
  '陳怡君',
  '林冠宇',
  '張宇軒',
  '黃詩涵',
  '李承恩',
  '王宥希',
  '吳柏翰',
  '劉欣怡',
  '蔡宗翰',
  '楊子晴',
  '許哲維',
  '鄭羽彤',
  '謝承翰',
  '郭芷瑄',
  '洪梓軒',
  '曾品妍',
  '邱柏叡',
  '廖晨希',
  '周家豪',
  '徐若瑄',
  '賴威廷',
  '葉思穎',
  '莊凱翔',
  '蘇子涵',
];

let idCounter = 0;
export function createStudent(name: string): Student {
  idCounter += 1;
  return {
    id: `stu-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
  };
}

export function createStudentsFromNames(names: string[]): Student[] {
  return names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map(createStudent);
}

/**
 * Parse pasted text containing student names separated by newlines, tabs,
 * commas (ASCII or full-width), Chinese enumeration comma, or semicolons.
 */
export function parsePastedNames(rawText: string, deduplicate = true): string[] {
  const tokens = rawText
    .split(/[\r\n\t,;，、；]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (!deduplicate) {
    return tokens;
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      unique.push(token);
    }
  }
  return unique;
}

/**
 * Decode an uploaded File buffer as UTF-8 first, falling back to Big5
 * for legacy school administration CSV exports.
 */
export async function decodeCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    try {
      const big5 = new TextDecoder('big5', { fatal: false }).decode(buffer);
      return big5.replace(/^\uFEFF/, '');
    } catch {
      return new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    }
  }
}

/**
 * RFC-4180 compliant lightweight CSV parser supporting quoted fields & newlines.
 */
export function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
      i += 1;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  currentRow.push(currentCell.trim());
  if (currentRow.some((cell) => cell.length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

const HEADER_KEYWORDS = ['姓名', '名字', '學生', '學生姓名', 'name', 'student', '座號', '學號', 'id', 'no', '性別', '班級'];
const NAME_COLUMN_KEYWORDS = ['姓名', '名字', '學生姓名', '學生', 'name', 'student name', 'student'];

export function buildCsvPreview(fileName: string, csvText: string): ParsedCsvPreview {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return {
      fileName,
      rows: [],
      headers: [],
      hasHeader: false,
      detectedColumnIndex: 0,
    };
  }

  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalizedRows = rows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) {
      padded.push('');
    }
    return padded;
  });

  const firstRow = normalizedRows[0];
  const hasHeader = firstRow.some((cell) => {
    const lower = cell.toLowerCase();
    return HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
  });

  let detectedColumnIndex = 0;
  if (hasHeader) {
    const matchedIdx = firstRow.findIndex((cell) => {
      const lower = cell.toLowerCase();
      return NAME_COLUMN_KEYWORDS.some((kw) => lower === kw || lower.includes(kw));
    });
    if (matchedIdx !== -1) {
      detectedColumnIndex = matchedIdx;
    }
  } else if (maxCols > 1) {
    // Pick the first column whose cells look like names rather than pure numbers
    const sampleRows = normalizedRows.slice(0, Math.min(8, normalizedRows.length));
    let bestCol = 0;
    let bestScore = -1;
    for (let col = 0; col < maxCols; col += 1) {
      let score = 0;
      for (const row of sampleRows) {
        const val = row[col] ?? '';
        if (val.length > 0 && !/^\d+$/.test(val)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    detectedColumnIndex = bestCol;
  }

  const headers = Array.from({ length: maxCols }, (_, idx) =>
    hasHeader && firstRow[idx] ? firstRow[idx] : `第 ${idx + 1} 欄`
  );

  return {
    fileName,
    rows: normalizedRows,
    headers,
    hasHeader,
    detectedColumnIndex,
  };
}

export function extractNamesFromCsvPreview(
  preview: ParsedCsvPreview,
  columnIndex: number,
  skipHeader: boolean,
  deduplicate = true
): string[] {
  const startIdx = skipHeader ? 1 : 0;
  const rawNames = preview.rows
    .slice(startIdx)
    .map((row) => (row[columnIndex] ?? '').trim())
    .filter((name) => name.length > 0);

  if (!deduplicate) {
    return rawNames;
  }

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of rawNames) {
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(name);
    }
  }
  return unique;
}

export function findDuplicateCounts(names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const duplicates = new Map<string, number>();
  for (const [name, count] of counts.entries()) {
    if (count > 1) {
      duplicates.set(name, count);
    }
  }
  return duplicates;
}

export function deduplicateNames(names: string[]): { unique: string[]; removedCount: number } {
  const seen = new Set<string>();
  const unique: string[] = [];
  let removedCount = 0;

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    if (seen.has(name)) {
      removedCount += 1;
    } else {
      seen.add(name);
      unique.push(name);
    }
  }

  return { unique, removedCount };
}

export function exportGroupsToCsv(groups: GroupPod[]): void {
  const lines = ['組別,組內編號,學生姓名'];
  for (const group of groups) {
    group.members.forEach((member, idx) => {
      const escapedName = `"${member.name.replace(/"/g, '""')}"`;
      lines.push(`${group.name},${idx + 1},${escapedName}`);
    });
  }
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `課堂自動分組結果_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
