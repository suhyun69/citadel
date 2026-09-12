import type { BuildingKind, CharacterId } from '@/data/types';
import type { CityEntry, GameState, MatchResult, Phase } from '../state/game-state';
import type { CardId, PlayerId } from '../state/ids';
import type { Choice, MainAction, Prompt } from '../state/prompt';
import type { GameEvent } from '../state/event';
import type { PlayerView } from '../view';
import type { Approval } from '../options/approve';

export type { Approval };

/**
 * 게임 전체 진행을 맡는 주체.
 *
 * 라운드를 굴리고, 왕관을 옮기고, 각 플레이어에게 보여줄 것을 정리하고,
 * 제출된 답을 승인해 적용한다. 안쪽은 불변 상태 값이고 이 객체는 그 값을
 * 가리키는 커서다 — 그래서 스냅샷을 찍어 저장했다가 이어갈 수 있다.
 */
export interface GameMaster {
  /** 지금 상태. 언제나 JSON 직렬화 가능하다. */
  snapshot(): GameState;
  /** 지금까지 제출된 답. 시드와 함께 판을 통째로 재현한다. */
  history(): readonly Choice[];

  round(): number;
  phase(): Phase;
  isOver(): boolean;
  result(): MatchResult | null;
  /** 남은 건물 카드 더미 장수. */
  deckCount(): number;

  players(): readonly Player[];
  player(id: PlayerId): Player;
  /** 왕관 주인. 선택 단계의 시작점이자 호명 권한자다. */
  crownHolder(): Player;
  /** 지금 호명 중인 순번. 선택 단계면 null. */
  calledRank(): number | null;

  /** 지금 답을 기다리는 플레이어. null 이면 advance() 로 진행할 수 있다. */
  awaiting(): Player | null;
  /** 입력이 필요 없는 전이를 한 단계 진행한다. */
  advance(): void;

  /** 이 플레이어에게 던져진 질문. 답할 차례가 아니면 null. */
  promptFor(id: PlayerId): Prompt | null;
  /** 그 질문의 합법적인 답. 열거할 수 없는 질문이면 null. */
  optionsFor(id: PlayerId): Choice[] | null;
  /** 승인만 하고 적용하지 않는다. 제출 전에 미리 검산할 때 쓴다. */
  approve(id: PlayerId, choice: Choice): Approval;
  /** 승인 후 적용. 거절되면 아무것도 바뀌지 않는다. */
  submit(id: PlayerId, choice: Choice): Approval;

  /** 전지적 로그. 플레이어 시점은 Player.view() 가 걸러준다. */
  log(): readonly GameEvent[];
}

/** 한 플레이어. 자기 시점의 정보와 지금 할 수 있는 것. */
export interface Player {
  readonly id: PlayerId;

  gold(): number;
  hand(): readonly CardId[];
  city(): readonly CityEntry[];
  isCityComplete(): boolean;
  hasCrown(): boolean;

  /** 이번 라운드에 맡은 캐릭터. 아직 고르기 전이면 null. */
  character(): Character | null;

  /**
   * 이 플레이어가 볼 수 있는 것만 모은 것.
   *
   * "플레이어들의 카드를 모아 한 플레이어에게 보여주는" 일이 여기서 일어난다 —
   * 남의 손패는 장수만, 남의 캐릭터는 공개된 것만 담긴다. 봇은 언제나 이것만
   * 받는다. 전체 상태를 주면 상대 손패를 보고 짜여지고, 사람이 들어오는 순간
   * 봇을 다시 짜야 한다.
   */
  view(): PlayerView;

  prompt(): Prompt | null;
  /**
   * 지금 고를 수 있는 답 전부.
   *
   * ★ 차례 메뉴는 캐릭터 능력만으로 이뤄지지 않는다. 도시의 특수 건물
   *   (실험실·대장간)과 기본 행동(건설·차례 종료)이 함께 모인다. 그래서
   *   **권위 있는 목록은 여기**이고 Character.abilities() 는 그중 캐릭터가
   *   기여한 부분을 보여주는 창일 뿐이다.
   */
  options(): Choice[] | null;
  submit(choice: Choice): Approval;
}

/** 플레이어가 이번 라운드에 맡은 캐릭터. */
export interface Character {
  readonly id: CharacterId;
  readonly rank: number;
  readonly name: string;
  readonly text: string;

  /** 호명되어 정체가 공개되었는가. */
  isRevealed(): boolean;
  /** 암살당했는가. 공개 전이라도 지목 시점에 정해진다. */
  isKilled(): boolean;
  /** 이번 라운드 차례를 이미 마쳤는가. */
  hasActed(): boolean;

  /** 이 캐릭터가 **자기 능력으로** 지금 내놓는 선택지. Player.options() 의 부분집합이다. */
  abilities(): readonly MainAction[];

  /**
   * 종류별 수입을 받는 캐릭터라면 지금 받게 될 금액. 아니면 null.
   * 실제 지급은 능력을 써야 일어난다 — 이건 미리 보기일 뿐이다.
   */
  pendingIncome(): { kind: BuildingKind; amount: number } | null;
}

/**
 * 핸들이 마스터 내부를 읽는 통로. 공개 API 가 아니다.
 *
 * Player·Character 는 상태를 들지 않는다 — 이 접근자로 매번 현재 상태를
 * 읽는다. 스냅샷을 들고 있으면 submit() 이후 낡은 값을 보게 된다.
 */
export interface MasterAccess {
  state(): GameState;
  promptFor(id: PlayerId): Prompt | null;
  optionsFor(id: PlayerId): Choice[] | null;
  submit(id: PlayerId, choice: Choice): Approval;
}
