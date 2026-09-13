import { defIdOf, playerId, type CardId, type PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';

/** 치안판사를 맡은 플레이어. 없으면 null. */
export function magistrateSeat(state: GameState): PlayerId | null {
  const i = state.players.findIndex((p) => p.character?.characterId === 'magistrate');
  return i === -1 ? null : playerId(i);
}

/**
 * 이 건설을 치안판사가 가로챌 수 있는가.
 *
 * 규칙이 네 겹으로 좁혀 놓았다(howto.md:242~246):
 *  1. 인장 찍힌 영장을 받은 캐릭터여야 한다
 *  2. **금화를 내고** 짓는 건물이어야 한다 — 골조·공동묘지로 공짜로 짓는
 *     건물은 몰수할 수 없다
 *  3. 그 차례에 금화를 내고 짓는 **첫** 건물이어야 한다
 *  4. 치안판사 도시에 같은 이름이 이미 있으면 가져올 수 없다
 */
export function canSeize(
  state: GameState,
  builder: PlayerId,
  card: CardId,
  gold: number,
): PlayerId | null {
  const action = state.action;
  const turn = action?.turn;
  if (!action || !turn || turn.playerId !== builder) return null;

  if (gold <= 0) return null;
  if (turn.paidBuilds > 0) return null;

  const sealed = action.declared.warrants.find((w) => w.sealed)?.character;
  if (!sealed) return null;
  if (state.players[builder]?.character?.characterId !== sealed) return null;

  const magistrate = magistrateSeat(state);
  if (magistrate === null || magistrate === builder) return null;

  const already = state.players[magistrate]?.city.some((e) => defIdOf(e.card) === defIdOf(card));
  if (already) return null;

  return magistrate;
}
