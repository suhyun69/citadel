import type { CharacterId, PresetDef, UniqueBuildingId } from '@/data/types';
import { defIdOf } from '../state/ids';
import type { PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';
import type { GameHooks, HookSource } from './hooks';
import { architect } from './characters/architect';
import { assassin } from './characters/assassin';
import { bishop } from './characters/bishop';
import { king } from './characters/king';
import { magician } from './characters/magician';
import { merchant } from './characters/merchant';
import { thief } from './characters/thief';
import { warlord } from './characters/warlord';
import { dragon_gate } from './buildings/dragon_gate';
import { factory } from './buildings/factory';
import { ghost_district } from './buildings/ghost_district';
import { imperial_treasury } from './buildings/imperial_treasury';
import { keep } from './buildings/keep';
import { laboratory } from './buildings/laboratory';
import { library } from './buildings/library';
import { map_room } from './buildings/map_room';
import { quarry } from './buildings/quarry';
import { school_of_magic } from './buildings/school_of_magic';
import { smithy } from './buildings/smithy';
import { statue } from './buildings/statue';
import { thieves_den } from './buildings/thieves_den';
import { wishing_well } from './buildings/wishing_well';

/**
 * 구현된 카드 효과만 등록한다. `Partial<Record<…>>` 인 것이 중요하다 —
 * 전체 카드를 한 번에 만들지 않으므로, 미구현 카드는 여기 없고
 * `missingCards()` 가 그것을 프리셋 단위로 알려준다.
 */
export const CHARACTER_EFFECTS: Partial<Record<CharacterId, GameHooks>> = {
  assassin,
  thief,
  magician,
  king,
  bishop,
  merchant,
  architect,
  warlord,
};

export const BUILDING_EFFECTS: Partial<Record<UniqueBuildingId, GameHooks>> = {
  dragon_gate,
  factory,
  ghost_district,
  imperial_treasury,
  keep,
  laboratory,
  library,
  map_room,
  quarry,
  school_of_magic,
  smithy,
  statue,
  thieves_den,
  wishing_well,
};

/**
 * 훅 합성 순서. 도시 건설 순서가 아니라 이 배열 순서로 정렬한다.
 *
 * 기본 조합에는 순서 충돌이 없지만(도서관 단독), 후순위의 천문대+도서관은
 * 순서를 틀리면 3장 뽑고 1장만 남긴다. 계약을 지금 박아두는 편이
 * 나중에 훅마다 priority 필드를 다는 것보다 싸다.
 */
export const EFFECT_ORDER: readonly UniqueBuildingId[] = [
  // draw 를 바꾸는 것이 먼저, keep 을 바꾸는 것이 나중
  'observatory',
  'library',
];

function orderIndex(id: UniqueBuildingId): number {
  const i = EFFECT_ORDER.indexOf(id);
  return i === -1 ? EFFECT_ORDER.length : i;
}

/** 지금 이 플레이어에게 활성인 훅: 캐릭터 능력 + 자기 도시의 특수 건물. */
export function collectHookSources(state: GameState, player: PlayerId): HookSource[] {
  const p = state.players[player];
  if (!p) return [];
  const out: HookSource[] = [];

  if (p.character) {
    const hooks = CHARACTER_EFFECTS[p.character.characterId];
    if (hooks) out.push({ hooks, owner: player, from: { kind: 'character', id: p.character.characterId } });
  }

  const fromCity: HookSource[] = [];
  for (const entry of p.city) {
    const defId = defIdOf(entry.card) as UniqueBuildingId;
    const hooks = BUILDING_EFFECTS[defId];
    if (hooks) fromCity.push({ hooks, owner: player, from: { kind: 'building', id: defId, card: entry.card } });
  }
  fromCity.sort((a, b) => {
    const ai = a.from.kind === 'building' ? orderIndex(a.from.id) : 0;
    const bi = b.from.kind === 'building' ? orderIndex(b.from.id) : 0;
    return ai - bi;
  });

  out.push(...fromCity);
  return out;
}

export function collectHooks(state: GameState, player: PlayerId): GameHooks[] {
  return collectHookSources(state, player).map((s) => s.hooks);
}

/** 프리셋에 들어 있으나 아직 효과가 구현되지 않은 카드. */
export function missingCards(preset: PresetDef): {
  characters: CharacterId[];
  uniques: UniqueBuildingId[];
} {
  const characters = preset.characters.filter((id) => !(id in CHARACTER_EFFECTS));
  if (preset.rank9 && !(preset.rank9 in CHARACTER_EFFECTS)) characters.push(preset.rank9);
  const uniques = preset.uniques.filter((id) => !(id in BUILDING_EFFECTS));
  return { characters, uniques };
}

export const isPlayable = (preset: PresetDef): boolean => {
  const m = missingCards(preset);
  return m.characters.length === 0 && m.uniques.length === 0;
};
