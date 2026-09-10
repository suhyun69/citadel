/**
 * md(SSOT) → TypeScript 상수 생성기.
 *
 *   npm run gen
 *
 * 파싱 대상은 character.md / building.md / preset.md 셋뿐이다.
 * howto.md 는 산문이라 파싱하지 않는다 — 능력의 "동작"은 텍스트가 아니라
 * src/engine/effects/ 의 코드에 있고, md의 description 은 표시용이다.
 *
 * 검증에 실패하면 파일을 쓰지 않고 즉시 종료한다(침묵 통과 금지).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTable, splitList, type Row } from './parse';
import { BUILDING_SLUGS, CHARACTER_SLUGS } from './slug-map';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'src', 'data', 'generated');

const KIND_FROM_KO = {
  종교: 'religious',
  군사: 'military',
  귀족: 'noble',
  상업: 'trade',
  특수: 'unique',
} as const;
type KindKo = keyof typeof KIND_FROM_KO;
type Kind = (typeof KIND_FROM_KO)[KindKo];

/** 규칙상 건설 자체가 불가능한 카드. cost 칸이 비어 있어도 되는 유일한 예외. */
const NEVER_CONSTRUCTIBLE = new Set(['비밀 금고']);

/** 도시에 건물이 N채면 완성 — 4~7인 기준. 데이터 검증에는 쓰이지 않고 주석용. */
const EXPECTED = {
  total: 84,
  byKind: { religious: 11, military: 11, noble: 12, trade: 20, unique: 30 },
  basic: 54,
  distinctTitles: 47,
  characters: 27,
  perRank: 3,
  presetCharacters: 8,
  presetUniques: 14,
} as const;

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

// ─────────────────────────────────────────── 건물

interface BuildingOut {
  id: string;
  title: string;
  kind: Kind;
  cost: number | null;
  text: string;
  copies: number;
}

function buildBuildings(): Map<string, BuildingOut> {
  const rows = parseTable(join(ROOT, 'building.md'));
  const byTitle = new Map<string, BuildingOut>();
  const kindCount: Record<string, number> = {};

  for (const [i, r] of rows.entries()) {
    const where = `building.md 데이터 ${i + 1}행`;
    const koKind = r['type'] ?? '';
    const title = r['title'] ?? '';
    const costCell = (r['cost'] ?? '').trim();
    const text = r['description'] ?? '';

    if (!(koKind in KIND_FROM_KO)) {
      fail(`${where}: 알 수 없는 건물 종류 "${koKind}"`);
      continue;
    }
    const kind = KIND_FROM_KO[koKind as KindKo];
    kindCount[kind] = (kindCount[kind] ?? 0) + 1;

    const id = (BUILDING_SLUGS as Record<string, string>)[title];
    if (!id) {
      fail(`${where}: 슬러그가 없는 건물 "${title}" — 오타이거나 slug-map.ts 갱신 필요`);
      continue;
    }

    let cost: number | null;
    if (costCell === '') {
      if (!NEVER_CONSTRUCTIBLE.has(title)) {
        fail(`${where}: "${title}" 의 cost 가 비어 있습니다 (허용: ${[...NEVER_CONSTRUCTIBLE].join(', ')})`);
        continue;
      }
      cost = null;
    } else {
      cost = Number(costCell);
      if (!Number.isInteger(cost) || cost < 1) {
        fail(`${where}: "${title}" 의 cost "${costCell}" 가 자연수가 아닙니다`);
        continue;
      }
    }

    const prev = byTitle.get(title);
    if (prev) {
      if (prev.kind !== kind) fail(`"${title}": 종류가 엇갈립니다 (${prev.kind} vs ${kind})`);
      if (prev.cost !== cost) fail(`"${title}": cost 가 엇갈립니다 (${prev.cost} vs ${cost})`);
      if (prev.text !== text) fail(`"${title}": description 이 엇갈립니다`);
      prev.copies += 1;
    } else {
      byTitle.set(title, { id, title, kind, cost, text, copies: 1 });
    }
  }

  if (rows.length !== EXPECTED.total) fail(`건물 총 ${rows.length}장 (기대 ${EXPECTED.total}장)`);
  for (const [kind, want] of Object.entries(EXPECTED.byKind)) {
    const got = kindCount[kind] ?? 0;
    if (got !== want) fail(`${kind} 건물 ${got}장 (기대 ${want}장)`);
  }
  if (byTitle.size !== EXPECTED.distinctTitles) {
    fail(`서로 다른 건물 title ${byTitle.size}개 (기대 ${EXPECTED.distinctTitles}개)`);
  }

  const unused = Object.keys(BUILDING_SLUGS).filter((t) => !byTitle.has(t));
  if (unused.length) fail(`slug-map 에만 있고 building.md 에 없는 건물: ${unused.join(', ')}`);

  return byTitle;
}

// ─────────────────────────────────────────── 캐릭터

interface CharacterOut {
  id: string;
  name: string;
  rank: number;
  text: string;
}

function buildCharacters(): Map<string, CharacterOut> {
  const rows = parseTable(join(ROOT, 'character.md'));
  const byName = new Map<string, CharacterOut>();
  const perRank: Record<number, number> = {};

  for (const [i, r] of rows.entries()) {
    const where = `character.md 데이터 ${i + 1}행`;
    const name = r['name'] ?? '';
    const rank = Number((r['no'] ?? '').trim());
    const text = r['description'] ?? '';

    if (!Number.isInteger(rank) || rank < 1 || rank > 9) {
      fail(`${where}: 순번 "${r['no']}" 가 1~9 가 아닙니다`);
      continue;
    }
    const id = (CHARACTER_SLUGS as Record<string, string>)[name];
    if (!id) {
      fail(`${where}: 슬러그가 없는 캐릭터 "${name}" — 오타이거나 slug-map.ts 갱신 필요`);
      continue;
    }
    if (byName.has(name)) {
      fail(`${where}: 캐릭터 "${name}" 가 중복 정의되었습니다`);
      continue;
    }
    perRank[rank] = (perRank[rank] ?? 0) + 1;
    byName.set(name, { id, name, rank, text });
  }

  if (rows.length !== EXPECTED.characters) {
    fail(`캐릭터 총 ${rows.length}장 (기대 ${EXPECTED.characters}장)`);
  }
  for (let rank = 1; rank <= 9; rank++) {
    const got = perRank[rank] ?? 0;
    if (got !== EXPECTED.perRank) fail(`순번 ${rank}번 캐릭터 ${got}장 (기대 ${EXPECTED.perRank}장)`);
  }
  const unused = Object.keys(CHARACTER_SLUGS).filter((n) => !byName.has(n));
  if (unused.length) fail(`slug-map 에만 있고 character.md 에 없는 캐릭터: ${unused.join(', ')}`);

  return byName;
}

// ─────────────────────────────────────────── 프리셋

interface PresetOut {
  id: string;
  name: string;
  description: string;
  characters: string[];
  rank9: string | null;
  uniques: string[];
}

function buildPresets(
  buildings: Map<string, BuildingOut>,
  characters: Map<string, CharacterOut>,
): PresetOut[] {
  const rows: Row[] = parseTable(join(ROOT, 'preset.md'));
  const out: PresetOut[] = [];
  const seenIds = new Set<string>();

  for (const r of rows) {
    const id = (r['id'] ?? '').trim();
    const name = (r['name'] ?? '').trim();
    const where = `preset.md "${name || id}"`;

    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      fail(`${where}: id "${id}" 는 소문자 ascii 슬러그여야 합니다`);
      continue;
    }
    if (seenIds.has(id)) {
      fail(`${where}: id "${id}" 중복`);
      continue;
    }
    seenIds.add(id);

    // 캐릭터 — 순번 1~8 각각 정확히 1장
    const charNames = splitList(r['characters'] ?? '');
    const charIds: string[] = [];
    const byRank = new Map<number, string>();
    let charOk = true;

    for (const n of charNames) {
      const c = characters.get(n);
      if (!c) {
        fail(`${where}: 알 수 없는 캐릭터 "${n}"`);
        charOk = false;
        continue;
      }
      if (c.rank === 9) {
        fail(`${where}: 9번 캐릭터 "${n}" 는 characters 가 아니라 rank9 칸에 적어야 합니다`);
        charOk = false;
        continue;
      }
      const dup = byRank.get(c.rank);
      if (dup) {
        fail(`${where}: 순번 ${c.rank}번이 둘입니다 ("${dup}", "${n}")`);
        charOk = false;
        continue;
      }
      byRank.set(c.rank, n);
      charIds.push(c.id);
    }
    for (let rank = 1; rank <= 8; rank++) {
      if (!byRank.has(rank)) {
        fail(`${where}: 순번 ${rank}번 캐릭터가 없습니다 (1~8 각 1장 필요)`);
        charOk = false;
      }
    }
    if (charNames.length !== EXPECTED.presetCharacters) {
      fail(`${where}: 캐릭터 ${charNames.length}장 (기대 ${EXPECTED.presetCharacters}장)`);
      charOk = false;
    }

    // 9번 (선택)
    const rank9Name = (r['rank9'] ?? '').trim();
    let rank9: string | null = null;
    if (rank9Name !== '') {
      const c = characters.get(rank9Name);
      if (!c) fail(`${where}: 알 수 없는 9번 캐릭터 "${rank9Name}"`);
      else if (c.rank !== 9) fail(`${where}: "${rank9Name}" 는 순번 ${c.rank}번이라 rank9 에 올 수 없습니다`);
      else rank9 = c.id;
    }

    // 특수 건물 — 정확히 14장, 전부 unique
    const uniqueTitles = splitList(r['uniques'] ?? '');
    const uniqueIds: string[] = [];
    const seenTitles = new Set<string>();
    for (const t of uniqueTitles) {
      const b = buildings.get(t);
      if (!b) {
        fail(`${where}: 알 수 없는 건물 "${t}"`);
        continue;
      }
      if (b.kind !== 'unique') {
        fail(`${where}: "${t}" 는 특수 건물이 아닙니다 (${b.kind})`);
        continue;
      }
      if (seenTitles.has(t)) {
        fail(`${where}: 특수 건물 "${t}" 중복`);
        continue;
      }
      seenTitles.add(t);
      uniqueIds.push(b.id);
    }
    if (uniqueTitles.length !== EXPECTED.presetUniques) {
      fail(`${where}: 특수 건물 ${uniqueTitles.length}장 (기대 ${EXPECTED.presetUniques}장)`);
    }

    if (!charOk) continue;
    out.push({ id, name, description: (r['description'] ?? '').trim(), characters: charIds, rank9, uniques: uniqueIds });
  }

  if (out.length === 0 && errors.length === 0) fail('preset.md 에 조합이 하나도 없습니다');
  return out;
}

// ─────────────────────────────────────────── 출력

const BANNER = `// 이 파일은 \`npm run gen\` 이 생성합니다. 직접 수정하지 마세요.
// 원본: `;

const q = (s: string) => JSON.stringify(s);

function emitBuildings(byTitle: Map<string, BuildingOut>): string {
  const defs = [...byTitle.values()].sort((a, b) => a.id.localeCompare(b.id));
  const body = defs
    .map(
      (d) =>
        `  ${d.id}: { id: '${d.id}', title: ${q(d.title)}, kind: '${d.kind}', cost: ${d.cost}, copies: ${d.copies}, text: ${q(d.text)} },`,
    )
    .join('\n');
  const uniques = defs.filter((d) => d.kind === 'unique').map((d) => `'${d.id}'`).join(' | ');
  return `${BANNER}building.md

export const BUILDING_DEFS = {
${body}
} as const;

export type BuildingDefId = keyof typeof BUILDING_DEFS;

/** kind === 'unique' 인 건물만 좁힌 유니온. 효과 레지스트리의 키가 된다. */
export type UniqueBuildingId = ${uniques};

export const BUILDING_IDS = Object.keys(BUILDING_DEFS) as BuildingDefId[];
`;
}

function emitCharacters(byName: Map<string, CharacterOut>): string {
  const defs = [...byName.values()].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  const body = defs
    .map((d) => `  ${d.id}: { id: '${d.id}', name: ${q(d.name)}, rank: ${d.rank}, text: ${q(d.text)} },`)
    .join('\n');
  return `${BANNER}character.md

export const CHARACTER_DEFS = {
${body}
} as const;

export type CharacterId = keyof typeof CHARACTER_DEFS;

export const CHARACTER_IDS = Object.keys(CHARACTER_DEFS) as CharacterId[];
`;
}

function emitPresets(presets: PresetOut[]): string {
  const body = presets
    .map(
      (p) =>
        `  ${p.id}: {
    id: '${p.id}',
    name: ${q(p.name)},
    description: ${q(p.description)},
    characters: [${p.characters.map((c) => `'${c}'`).join(', ')}],
    rank9: ${p.rank9 ? `'${p.rank9}'` : 'null'},
    uniques: [${p.uniques.map((u) => `'${u}'`).join(', ')}],
  },`,
    )
    .join('\n');
  return `${BANNER}preset.md

export const PRESETS = {
${body}
} as const;

export type PresetId = keyof typeof PRESETS;

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
`;
}

// ─────────────────────────────────────────── main

const buildings = buildBuildings();
const characters = buildCharacters();
const presets = buildPresets(buildings, characters);

if (errors.length) {
  console.error(`\n코드젠 실패 — ${errors.length}건\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'buildings.gen.ts'), emitBuildings(buildings));
writeFileSync(join(OUT, 'characters.gen.ts'), emitCharacters(characters));
writeFileSync(join(OUT, 'presets.gen.ts'), emitPresets(presets));
writeFileSync(
  join(OUT, 'index.ts'),
  `${BANNER}building.md, character.md, preset.md

export * from './buildings.gen';
export * from './characters.gen';
export * from './presets.gen';
`,
);

const totalCards = [...buildings.values()].reduce((n, b) => n + b.copies, 0);
console.log(
  `코드젠 완료 — 건물 ${buildings.size}종/${totalCards}장, 캐릭터 ${characters.size}장, 프리셋 ${presets.length}종`,
);
