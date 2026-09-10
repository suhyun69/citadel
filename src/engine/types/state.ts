import type { CharacterId, PresetId, UniqueBuildingId } from '@/data/types';
import type { RngState } from '../rng';
import type { PendingDecision } from './decision';
import type { GameEvent } from './event';
import type { CardId, PlayerId } from './ids';

export interface MatchConfig {
  readonly seed: number;
  /** 4~7인. 기본 조합은 9번 캐릭터가 없어 3인·8인 게임을 할 수 없다. */
  readonly playerCount: number;
  readonly presetId: PresetId;
  /** 프리셋에서 파생. 순번 오름차순, 순번당 1장. */
  readonly characterIds: readonly CharacterId[];
  readonly uniqueBuildingIds: readonly UniqueBuildingId[];
  /** 이 채수를 지으면 도시가 완성된다. 4~7인은 7채. */
  readonly targetCitySize: number;
  /** 무한 루프 방지용 상한. 정상 게임은 한참 못 미친다. */
  readonly maxRounds: number;
}

/**
 * 도시에 놓인 건물 1채.
 *
 * 지금은 카드 한 장뿐이지만 객체로 둔다 — 후순위 작업에 예술가(장식)와
 * 박물관(아래에 깔린 카드)이 확정적으로 있고, 그때 `CardId[]` 였다면
 * 도시를 읽는 코드를 전부 뜯어야 한다. 행동은 미루되 카디널리티는 지금 정한다.
 */
export interface CityEntry {
  card: CardId;
}

export interface CharacterSlot {
  characterId: CharacterId;
  /** 호명되어 정체가 공개되었는가 */
  revealed: boolean;
  /** 암살당했는가 */
  killed: boolean;
  turnDone: boolean;
}

export interface PlayerState {
  id: PlayerId;
  gold: number;
  hand: CardId[];
  city: CityEntry[];
  /**
   * 이번 라운드에 고른 캐릭터. 스칼라인 이유는 2~3인 변형(플레이어당 2장)이
   * 이번 범위 밖이기 때문이다. 열게 되면 배열 전환 리팩터가 든다.
   */
  character: CharacterSlot | null;
  /** 도시를 완성한 라운드. null 이면 미완성. */
  cityCompletedAtRound: number | null;
}

export type Phase = 'selection' | 'action' | 'scoring' | 'finished';

export interface SelectionState {
  /** 돌려가며 뽑는 남은 더미 */
  pool: CharacterId[];
  /** 앞면으로 버린 카드 (공개) */
  faceUp: CharacterId[];
  /** 뒷면으로 버린 카드 (비공개). 7인 규칙에서 faceDown[0] 이 마지막 픽커에게 간다. */
  faceDown: CharacterId[];
  /** 왕관 주인부터 시계 방향 */
  order: PlayerId[];
  cursor: number;
}

export type TurnStage = 'gather' | 'main' | 'ending';

export interface TurnState {
  playerId: PlayerId;
  characterId: CharacterId;
  stage: TurnStage;
  buildsUsed: number;
  buildLimit: number;
  /** 자원 얻기로 뽑아서 아직 고르지 않은 카드 */
  drawn: CardId[] | null;
  abilityUsed: boolean;
  /** 차례당 1회 제한이 있는 건물(실험실/대장간)의 사용 기록 */
  usedOncePerTurn: UniqueBuildingId[];
}

export interface ActionPhaseState {
  /** 지금 호명 중인 순번 (1..8) */
  rankCursor: number;
  turn: TurnState | null;
  /** 차례 시작 시 선언되는 지목들 */
  declared: {
    assassinTarget: CharacterId | null;
    thiefTarget: CharacterId | null;
  };
}

export interface PlayerScore {
  player: PlayerId;
  buildingCost: number;
  allKindsBonus: number;
  completionBonus: number;
  uniqueBonus: number;
  total: number;
}

export interface MatchResult {
  scores: PlayerScore[];
  winner: PlayerId;
}

export interface GameState {
  readonly config: MatchConfig;
  rng: RngState;
  round: number;
  phase: Phase;
  crowned: PlayerId;
  players: PlayerState[];
  /** 건물 카드 더미. 앞에서 뽑고(shift) 뒤로 넣는다(push). */
  deck: CardId[];
  selection: SelectionState | null;
  action: ActionPhaseState | null;
  /** null 이면 step() 으로 진행할 수 있다. 채워져 있으면 applyChoice() 를 기다린다. */
  pending: PendingDecision | null;
  log: GameEvent[];
  /** 가장 먼저 도시를 완성한 플레이어 (4점) */
  firstCompleted: PlayerId | null;
  result: MatchResult | null;
}
