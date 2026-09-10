import { readFileSync } from 'node:fs';

/**
 * 마크다운 파이프 테이블 파서.
 *
 * 정규화는 NFC + trim 까지만 한다. "똑똑한 교정"은 하지 않는다 — 오타는
 * slug-map 조회에서 실패해야 하고, 여기서 조용히 고쳐지면 안 된다.
 */
export type Row = Record<string, string>;

export function parseTable(path: string): Row[] {
  const text = readFileSync(path, 'utf8').normalize('NFC');
  const lines = text.split('\n');

  let header: string[] | null = null;
  const rows: Row[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('|')) continue;

    const cells = splitRow(line);
    // 구분행 (|---|---|)
    if (cells.every((c) => /^:?-{3,}:?$/.test(c))) continue;

    if (header === null) {
      header = cells;
      continue;
    }
    if (cells.length !== header.length) {
      throw new Error(
        `${path}: 열 개수 불일치 (헤더 ${header.length}개, 행 ${cells.length}개)\n  ${line}`,
      );
    }
    const row: Row = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    rows.push(row);
  }

  if (header === null) throw new Error(`${path}: 테이블을 찾지 못했습니다`);
  return rows;
}

function splitRow(line: string): string[] {
  // 앞뒤 파이프 제거 후 분할. 셀 안의 파이프는 지원하지 않는다(데이터에 없음).
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((c) => c.trim());
}

/** "가, 나, 다" → ['가','나','다']. 빈 문자열은 빈 배열. */
export function splitList(cell: string): string[] {
  const t = cell.trim();
  if (t === '') return [];
  return t.split(',').map((s) => s.trim()).filter((s) => s !== '');
}
