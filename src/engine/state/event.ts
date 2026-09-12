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
