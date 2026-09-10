import { describe, expect, it } from 'vitest';
import { CHARACTER_DEFS, PRESETS, type BuildingDefId } from '@/data/generated';
import { isPlayable, missingCards } from '@/engine/effects/registry';
import {
  ALL_BUILDINGS as buildings,
  ALL_CHARACTERS as characters,
  BUILDING_KINDS,
  buildingDef,
  isConstructible,
  presetDef,
  type BuildingKind,
} from '@/data/types';

describe('건물 데이터', () => {
  it('서로 다른 title 47종, 총 84장', () => {
    expect(buildings).toHaveLength(47);
    expect(buildings.reduce((n, b) => n + b.copies, 0)).toBe(84);
  });

  it('종류별 장수가 구성물 목록과 일치한다', () => {
    const count = (kind: BuildingKind) =>
      buildings.filter((b) => b.kind === kind).reduce((n, b) => n + b.copies, 0);
    expect(count('religious')).toBe(11);
    expect(count('military')).toBe(11);
    expect(count('noble')).toBe(12);
    expect(count('trade')).toBe(20);
    expect(count('unique')).toBe(30);
  });

  it('기본 건물은 54장이고 특수 건물만 효과 텍스트를 가진다', () => {
    const basic = buildings.filter((b) => b.kind !== 'unique');
    expect(basic.reduce((n, b) => n + b.copies, 0)).toBe(54);
    expect(basic.every((b) => b.text === '')).toBe(true);
    expect(buildings.filter((b) => b.kind === 'unique').every((b) => b.text !== '')).toBe(true);
  });

  it('건설 불가 카드는 비밀 금고 하나뿐이다', () => {
    const notConstructible = buildings.filter((b) => !isConstructible(b));
    expect(notConstructible.map((b) => b.id)).toEqual(['secret_vault']);
  });

  it('모든 종류가 BUILDING_KINDS 에 들어 있다', () => {
    for (const b of buildings) expect(BUILDING_KINDS).toContain(b.kind);
  });
});

describe('캐릭터 데이터', () => {
  it('27장이고 순번 1~9 각 3장이다', () => {
    expect(characters).toHaveLength(27);
    for (let rank = 1; rank <= 9; rank++) {
      expect(characters.filter((c) => c.rank === rank)).toHaveLength(3);
    }
  });
});

describe('프리셋 데이터', () => {
  it('기본 조합은 순번 1~8 각 1장 + 특수 건물 14장', () => {
    const p = PRESETS.basic;
    expect(p.characters).toHaveLength(8);
    expect(p.rank9).toBeNull();

    const ranks = p.characters.map((id) => CHARACTER_DEFS[id].rank).sort((a, b) => a - b);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(p.uniques).toHaveLength(14);
    expect(p.uniques.every((id) => buildingDef(id).kind === 'unique')).toBe(true);
    expect(new Set(p.uniques).size).toBe(14);
  });

  it('기본 조합의 덱은 기본 54장 + 특수 14장 = 68장', () => {
    const basicCards = buildings
      .filter((b) => b.kind !== 'unique')
      .reduce((n, b) => n + b.copies, 0);
    const uniqueCards = PRESETS.basic.uniques
      .map((id) => buildingDef(id).copies)
      .reduce((n, c) => n + c, 0);
    expect(basicCards + uniqueCards).toBe(68);
  });

  it('기본 조합의 특수 건물은 전부 1장짜리다', () => {
    for (const id of PRESETS.basic.uniques) expect(buildingDef(id).copies).toBe(1);
  });

  it('기본 조합에 건설 불가 카드가 들어 있지 않다', () => {
    for (const id of PRESETS.basic.uniques as readonly BuildingDefId[]) {
      expect(isConstructible(buildingDef(id))).toBe(true);
    }
  });
});

describe('프리셋 플레이 가능 여부', () => {
  it('기본 조합은 카드 22종이 모두 구현되어 플레이할 수 있다', () => {
    const preset = presetDef('basic');
    expect(missingCards(preset)).toEqual({ characters: [], uniques: [] });
    expect(isPlayable(preset)).toBe(true);
  });

  it('createMatch 가 미구현 카드를 막는다', () => {
    // 아직 효과가 없는 특수 건물을 억지로 끼운 프리셋
    const broken = { ...presetDef('basic'), uniques: [...presetDef('basic').uniques, 'theater'] as never };
    expect(missingCards(broken).uniques).toContain('theater');
  });
});
