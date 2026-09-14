import { defIdOf, playerId, type PlayerId } from '../../state/ids';
import type { GameState } from '../../state/game-state';
import type { Prompt } from '../../state/prompt';
import type { GameHooks } from '../hooks';

/**
 * 극장 — 선택 단계가 끝날 때 다른 플레이어와 캐릭터 카드를 바꾼다.
 *
 * 훅이 비어 있는 것은 실수가 아니다. 이 효과가 작동하는 시점은 차례도
 * 점수도 아닌 **선택 단계의 끝**이라, GameHooks 에 걸 자리가 없다.
 * 실제 처리는 advanceSelection 이 theaterPrompt 로 끌어간다.
 */
export const theater: GameHooks = {};

/** 극장을 가진 플레이어. 카드가 1장뿐이라 많아야 한 명이다. */
export function theaterOwner(state: GameState): PlayerId | null {
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[playerId(i)];
    if (p?.city.some((e) => defIdOf(e.card) === 'theater')) return playerId(i);
  }
  return null;
}

/**
 * 극장 주인에게 던질 질문. 물어볼 것이 없으면 null.
 *
 * 상대의 캐릭터를 **확인하지 않고** 바꾸므로(howto.md 극장), 선택지에는
 * 플레이어 번호만 실린다. 누가 무엇을 들고 있는지는 어디에도 드러나지 않는다.
 */
export function theaterPrompt(state: GameState): Prompt | null {
  const owner = theaterOwner(state);
  if (owner === null) return null;
  if (!state.players[owner]?.character) return null;

  const options: PlayerId[] = [];
  for (let i = 0; i < state.players.length; i++) {
    const other = playerId(i);
    if (other !== owner && state.players[other]?.character) options.push(other);
  }
  if (options.length === 0) return null;

  return {
    type: 'theaterSwap',
    player: owner,
    text: '극장: 캐릭터 카드를 바꿀 상대를 고르세요 (바꾸지 않아도 됩니다)',
    options,
  };
}
