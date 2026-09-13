import type { BuildingKind, CharacterId, UniqueBuildingId } from '@/data/types';
import type { CardId, PlayerId } from './ids';

/**
 * 상태 전이의 부산물. 이벤트로 상태를 재구성하지는 않는다(이벤트 소싱 아님) —
 * 서버 권위도 네트워크 복제도 없는데 적용 로직을 이중으로 만들 이유가 없다.
 * 용도는 관전 UI 로그, 골든 스냅샷 테스트, 봇 관측 셋이다.
 */
export type GameEvent =
  | { t: 'roundStart'; round: number; crowned: PlayerId }
  | { t: 'charactersDiscarded'; faceUp: CharacterId[]; faceDownCount: number }
  | { t: 'characterPicked'; player: PlayerId; character: CharacterId }
  | { t: 'rankCalled'; rank: number }
  | { t: 'characterRevealed'; player: PlayerId; character: CharacterId }
  | { t: 'rankAbsent'; rank: number }
  | { t: 'skipped'; player: PlayerId; character: CharacterId; reason: 'killed' }
  /**
   * 암살자·도둑의 지목. 규칙상 **공개 선언**이므로(howto.md:220, 251)
   * 누구에게도 가려지지 않는다.
   */
  | { t: 'declared'; by: PlayerId; purpose: 'assassinate' | 'rob'; target: CharacterId }
  /**
   * 마술사의 손패 교환.
   *
   * **교환이 일어났다는 사실은 공개**지만 어떤 카드였는지는 두 당사자만 안다.
   * 그래서 카드 목록과 장수를 따로 들고 다니며, redactEvent 가 제3자 시점에서
   * 목록만 비운다.
   */
  | {
      t: 'handSwapped';
      by: PlayerId;
      partner: PlayerId;
      /** 마술사가 넘긴 카드. 당사자가 아니면 빈 배열. */
      given: readonly CardId[];
      /** 마술사가 받은 카드. 당사자가 아니면 빈 배열. */
      received: readonly CardId[];
      givenCount: number;
      receivedCount: number;
    }
  /**
   * 특수 건물이 조용히 바꾼 것.
   *
   * 실험실·대장간처럼 **행동으로 쓰는** 건물은 이미 자기 이벤트를 남긴다.
   * 여기 담기는 것은 수치를 슬쩍 고치는 쪽이다 — 그냥 두면 로그만 봐서는
   * 왜 싸게 지어졌는지, 왜 같은 건물을 두 채 지었는지 알 수 없다.
   *
   * ⚠ 반드시 **적용 시점**에만 남긴다. gatherPlan·countIncome 같은 조회
   *   함수는 여러 번 불리므로 거기서 남기면 로그가 중복된다.
   */
  | {
      t: 'buildingEffect';
      player: PlayerId;
      building: UniqueBuildingId;
      effect: BuildingEffect;
    }
  | { t: 'gained'; player: PlayerId; gold?: number; cards?: number; reason: string }
  | { t: 'paid'; player: PlayerId; gold: number; reason: string }
  | { t: 'built'; player: PlayerId; card: CardId; paid: number }
  | { t: 'destroyed'; by: PlayerId; target: PlayerId; card: CardId; paid: number }
  | { t: 'captured'; by: PlayerId; from: PlayerId; card: CardId; paid: number }
  | { t: 'stolen'; by: PlayerId; from: PlayerId; gold: number }
  | { t: 'tookCard'; by: PlayerId; from: PlayerId; card: CardId }
  /** 영장 발부. 셋 중 어느 쪽에 인장이 있는지는 공개하지 않는다. */
  | { t: 'warrantsIssued'; by: PlayerId; characters: CharacterId[] }
  | { t: 'seized'; by: PlayerId; from: PlayerId; card: CardId }
  | { t: 'crownMoved'; to: PlayerId; reason: string }
  | { t: 'deckExhausted'; wanted: number; got: number }
  | { t: 'cityCompleted'; player: PlayerId; first: boolean }
  | { t: 'roundEnd'; round: number }
  | { t: 'gameOver'; winner: PlayerId };

/** 특수 건물이 실제로 바꾼 내용. 문구는 화면이 만든다. */
export type BuildingEffect =
  /** 도서관 — 뽑은 카드를 전부 보유 */
  | { kind: 'keptAllDrawn'; cards: number }
  /** 공장 — 특수 건물 할인 */
  | { kind: 'discounted'; card: CardId; saved: number }
  /** 채석장 — 동명 건물 건설 */
  | { kind: 'builtDuplicate'; card: CardId }
  /** 마법학교 — 수입 계산에서 다른 종류로 간주 */
  | { kind: 'countedAsKind'; as: BuildingKind; extra: number }
  /** 도적 소굴 — 건설비용을 카드로 지불 */
  | { kind: 'paidWithCards'; card: CardId; gold: number; cards: number }
  /** 골조·공동묘지 — 건물을 부수고 그 자리에 짓기 */
  | { kind: 'sacrificed'; card: CardId; toBuild: CardId };
