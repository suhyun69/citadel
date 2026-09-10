import type { BuildingDefId, UniqueBuildingId, CharacterId, PresetId } from './generated';
import { BUILDING_DEFS, CHARACTER_DEFS, PRESETS } from './generated';

export type { BuildingDefId, UniqueBuildingId, CharacterId, PresetId };

/** 건물 종류 5가지. 캐릭터 수입과 게임 종료 점수(5종 보너스)에 쓰인다. */
export type BuildingKind = 'religious' | 'military' | 'noble' | 'trade' | 'unique';

export const BUILDING_KINDS: readonly BuildingKind[] = [
  'religious',
  'military',
  'noble',
  'trade',
  'unique',
] as const;

export interface BuildingDef {
  readonly id: BuildingDefId;
  /** 한글 원문. 표시용이며 동작의 근거가 아니다. */
  readonly title: string;
  readonly kind: BuildingKind;
  /** null = 규칙상 건설 자체가 불가능한 카드(비밀 금고). 0으로 뭉개지 않는다. */
  readonly cost: number | null;
  readonly text: string;
  /** 덱에 들어가는 장수. 기본 건물은 동명 카드가 여러 장이다. */
  readonly copies: number;
}

export interface CharacterDef {
  readonly id: CharacterId;
  readonly name: string;
  readonly rank: number;
  readonly text: string;
}

export interface PresetDef {
  readonly id: PresetId;
  readonly name: string;
  readonly description: string;
  /** 순번 1~8, 각 1장. 코드젠이 보장한다. */
  readonly characters: readonly CharacterId[];
  /** 순번 9번. 선택 사항이며 3·8인 게임에서는 필수. */
  readonly rank9: CharacterId | null;
  /** 특수 건물 14장. */
  readonly uniques: readonly UniqueBuildingId[];
}

/** 생성된 상수가 위 인터페이스와 어긋나면 여기서 컴파일이 깨진다. */
const _buildings: Readonly<Record<BuildingDefId, BuildingDef>> = BUILDING_DEFS;
const _characters: Readonly<Record<CharacterId, CharacterDef>> = CHARACTER_DEFS;
const _presets: Readonly<Record<PresetId, PresetDef>> = PRESETS;
void _buildings;
void _characters;
void _presets;

export const buildingDef = (id: BuildingDefId): BuildingDef => BUILDING_DEFS[id];
export const characterDef = (id: CharacterId): CharacterDef => CHARACTER_DEFS[id];
export const presetDef = (id: PresetId): PresetDef => PRESETS[id];

/** 건설비용이 실제로 존재하는 건물. `비밀 금고`만 여기서 탈락한다. */
export type ConstructibleDef = BuildingDef & { cost: number };
export const isConstructible = (d: BuildingDef): d is ConstructibleDef => d.cost !== null;

export const isUnique = (d: BuildingDef): boolean => d.kind === 'unique';
