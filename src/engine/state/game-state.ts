import type { CharacterId, PresetId, UniqueBuildingId } from '@/data/types';
import type { RngState } from '../rng';
import type { Prompt } from './prompt';
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
  /**
   * 박물관 아래 깔린 카드.
   *
   * 없을 때 `undefined` 로 두는 것이 중요하다 — 골든 해시는 최종 상태를
   * JSON 으로 찍으므로, 박물관이 없는 조합에서 빈 배열이라도 들어가면
   * 규칙이 바뀐 것처럼 보인다.
   */
  beneath?: CardId[];
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
  /**
   * 마녀가 남의 능력을 복사해 차례를 진행하는 동안만 채워진다.
   *
   * `character` 는 그대로 마녀다 — 호명과 지목은 여전히 마녀를 가리키고,
   * 바뀌는 것은 **이 차례에 어떤 능력이 붙는가** 뿐이다(howto.md:230).
   */
  actingAs?: CharacterId;
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
  /** 극장 주인에게 교환 여부를 이미 물었는가. */
  theaterDone?: boolean;
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
  /**
   * 이번 차례에 이미 쓴 능력 키. 캐릭터 능력과 "차례마다 한 번" 건물
   * (실험실·대장간)을 같은 방식으로 다룬다.
   */
  usedAbilities: string[];
  /**
   * 다단계 능력의 중간 상태. 마법사는 상대 고르기 → 카드 고르기 →
   * 바로 지을지까지 세 단계라, 그 사이 선택을 들고 있어야 한다.
   */
  pendingSub: { kind: 'wizardTarget'; player: PlayerId } | { kind: 'wizardTaken'; card: CardId } | null;
  /** 이번 차례에 **금화를 내고** 지은 건물 수. 치안판사는 그중 첫 채만 노린다. */
  paidBuilds: number;
  /** 치안판사의 판단을 기다리며 멈춰 있는 건설. */
  pendingSeizure: { card: CardId; gold: number; cardsPaid: CardId[] } | null;
  /**
   * 이번 차례에 **건설비용으로** 낸 금화. 연금술사가 돌려받는 몫이며,
   * 대장간이나 재산세로 나간 금화는 여기 들어오지 않는다(howto.md:362).
   */
  buildGoldPaid: number;
  /** 마녀가 빼앗아 대신 진행하는 차례인가 (howto.md:230). */
  stolen?: boolean;
  /**
   * 마녀가 선언하고 **멈춘** 차례인가.
   *
   * 멈춘 차례에는 차례 종료 효과가 붙지 않는다 — 공원·구빈원은 마녀가
   * 이어받은 차례를 마칠 때 판정하고, 이어받지 못했다면 그 라운드에는
   * 아예 발동하지 않는다(howto.md:456, 459).
   */
  suspended?: boolean;
}

export interface ActionPhaseState {
  /** 지금 호명 중인 순번 (1..8) */
  rankCursor: number;
  turn: TurnState | null;
  /** 차례 시작 시 선언되는 지목들 */
  declared: {
    assassinTarget: CharacterId | null;
    thiefTarget: CharacterId | null;
    /**
     * 치안판사의 영장. 셋 중 인장(sealed)이 찍힌 하나만 실제 몰수 대상이고,
     * 나머지 둘은 허풍이다 — 엔진은 읽지 않지만 기록해 둔다.
     */
    warrants: { character: CharacterId; sealed: boolean }[];
    /** 마녀가 마법을 건 캐릭터. 그 차례가 오면 마녀가 이어받는다. */
    witchTarget: CharacterId | null;
    /**
     * 협박범의 토큰. 인장(sealed)이 찍힌 하나만 실제 협박 대상이고 나머지는
     * 허풍이다 — 영장과 달리 **둘** 뿐이다(howto.md:266).
     */
    blackmail: { character: CharacterId; sealed: boolean }[];
  };
  /** 라운드 종료 훅을 이미 돌렸는가. 황제가 거기서 질문을 띄울 수 있어 필요하다. */
  roundEndDone?: boolean;
  /** 마법에 걸린 캐릭터의 차례가 방금 끝났다 — 다음은 마녀가 이어받는다. */
  witchPending?: boolean;
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
  pending: Prompt | null;
  log: GameEvent[];
  /**
   * 세리 토큰 위에 쌓인 재산세. **라운드를 넘겨 남는다**(howto.md:442) —
   * 그래서 라운드마다 새로 만드는 ActionPhaseState 가 아니라 여기에 둔다.
   */
  taxPot?: number;
  /** 가장 먼저 도시를 완성한 플레이어 (4점) */
  firstCompleted: PlayerId | null;
  result: MatchResult | null;
}
