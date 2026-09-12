import type { CharacterId } from '@/data/types';
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
  | { t: 'gained'; player: PlayerId; gold?: number; cards?: number; reason: string }
  | { t: 'paid'; player: PlayerId; gold: number; reason: string }
  | { t: 'built'; player: PlayerId; card: CardId; paid: number }
  | { t: 'destroyed'; by: PlayerId; target: PlayerId; card: CardId; paid: number }
  | { t: 'stolen'; by: PlayerId; from: PlayerId; gold: number }
  | { t: 'crownMoved'; to: PlayerId; reason: string }
  | { t: 'deckExhausted'; wanted: number; got: number }
  | { t: 'cityCompleted'; player: PlayerId; first: boolean }
  | { t: 'roundEnd'; round: number }
  | { t: 'gameOver'; winner: PlayerId };
