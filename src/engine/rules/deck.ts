import type { GameEvent } from '../state/event';
import type { CardId } from '../state/ids';
import type { GameState } from '../state/game-state';

/**
 * 건물 카드 더미에서 뽑는다. 앞에서 뽑고 뒤로 넣는다.
 *
 * ERRATA: howto.md 는 더미가 소진되는 경우를 다루지 않는다. 68장 중 4인
 * 기준 16장을 나눠주고 시작하므로 실제로 바닥날 수 있다. 여기서는 조용히
 * 실패시키되(요청보다 적게 줌) `deckExhausted` 이벤트를 남긴다. 게임을
 * 멈추는 것보다 낫고, 불변식도 이 상황을 허용한다.
 */
export function draw(state: GameState, count: number): CardId[] {
  const got = state.deck.splice(0, count);
  if (got.length < count) {
    state.log.push({ t: 'deckExhausted', wanted: count, got: got.length } satisfies GameEvent);
  }
  return got;
}

/** 버린 카드·파괴된 카드는 모두 더미 맨 아래로 간다 (howto.md:75, 99). */
export function returnToBottom(state: GameState, cards: readonly CardId[]): void {
  state.deck.push(...cards);
}
