import type { BuildingDef, BuildingKind, UniqueBuildingId } from '@/data/types';
import type { CharacterId } from '@/data/types';
import type { MainAction, PendingDecision } from '../types/decision';
import type { GameEvent } from '../types/event';
import type { CardId, PlayerId } from '../types/ids';
import type { CityEntry, GameState, TurnState } from '../types/state';

/** 훅이 상태를 만지는 창구. state 는 immer draft 다. */
export interface EffectCtx {
  readonly state: GameState;
  /** 이 훅을 소유한 플레이어 */
  readonly self: PlayerId;
  readonly turn: TurnState | null;
  push(e: GameEvent): void;
  /** 훅 안에서 추가 입력이 필요하면 pending 을 세운다. */
  ask(d: PendingDecision): void;
}

export interface ScoreCtx {
  readonly state: GameState;
  readonly self: PlayerId;
}

export interface PaymentOption {
  readonly kind: 'gold' | 'cards';
  readonly maxCards: number;
}

/**
 * 카드 효과가 게임에 개입하는 지점들.
 *
 * 여기 있는 것은 **기본 조합 22종(캐릭터 8 + 특수 건물 14)이 실제로 쓰는 훅만**이다.
 * 후순위 모드가 요구하는 훅(금광의 modifyGatherGold, 치안판사의 interceptBuild,
 * 세리의 onAnyPlayerBuild 등)은 그 모드를 열 때 추가한다.
 *
 * ★ countsAsKind 와 scoringKindOverride 를 절대 합치지 말 것.
 *   마법학교는 원문이 "자원을 받는 능력을 사용할 때"라 **수입에만** 걸리고,
 *   유령 지구는 "게임이 종료되면"이라 **점수에만** 걸린다. 하나로 합치면
 *   마법학교가 5종 보너스를 채우거나 유령 지구가 주교 수입을 늘리는 버그가
 *   조용히 생긴다.
 */
export interface GameHooks {
  /** 도서관: 뽑은 카드를 전부 보유 */
  modifyGatherCards?(plan: { draw: number; keep: number }, ctx: EffectCtx): { draw: number; keep: number };
  /** 건축가: 3채 */
  modifyBuildLimit?(limit: number, ctx: EffectCtx): number;
  /** 공장: 특수 건물 −1금화 */
  modifyBuildCost?(cost: number, def: BuildingDef, ctx: EffectCtx): number;
  /** 채석장: 이름이 같은 건물도 건설 가능 */
  allowsDuplicateTitle?(def: BuildingDef, ctx: EffectCtx): boolean;
  /** 도적 소굴: 카드로 지불 */
  paymentOptions?(def: BuildingDef, ctx: EffectCtx): PaymentOption[];
  /** 마법학교: 수입 계산에서만 임의 종류로 간주 */
  countsAsKind?(entry: CityEntry, want: BuildingKind, ctx: EffectCtx): boolean;
  /** 주교(도시 전체) / 외성(자기 카드만): 8번 캐릭터 능력의 대상이 되지 않음 */
  immuneToRank8?(entry: CityEntry, ctx: EffectCtx): boolean;
  /** 차례 메뉴에 노출할 행동 */
  turnActions?(ctx: EffectCtx): MainAction[];
  /** 위에서 고른 행동 실행 */
  performAction?(action: MainAction, ctx: EffectCtx): void;
  /** 왕: 왕관 획득(강제) */
  onTurnStart?(ctx: EffectCtx): void;
  /** 암살당한 왕의 왕관 계승 */
  onRoundEnd?(ctx: EffectCtx): void;
  /** 도둑: 목표 캐릭터가 공개될 때 정산 */
  onCharacterRevealed?(who: PlayerId, character: CharacterId, ctx: EffectCtx): void;
  /** 드래곤 게이트 / 제국 보고 / 지도 보관실 / 동상 / 소원의 우물 */
  endGameScore?(ctx: ScoreCtx): number;
  /** 유령 지구: 게임 종료 시에만 임의 종류로 간주 */
  scoringKindOverride?(entry: CityEntry, ctx: ScoreCtx): BuildingKind | 'wildcard' | null;
}

/** 훅이 붙은 주체. 로그와 디버깅에 쓴다. */
export interface HookSource {
  readonly hooks: GameHooks;
  readonly owner: PlayerId;
  readonly from: { kind: 'character'; id: CharacterId } | { kind: 'building'; id: UniqueBuildingId; card: CardId };
}
