import { produce, setAutoFreeze } from 'immer';
import type { GameState } from '../state/game-state';
import { callNextRank, endRound, finishTurn, maxRank } from './action';
import { finishScoring } from './scoring';
import { finishSelection, selectionPrompt, startSelection } from './selection';
import { applyKeepDrawn, gatherPlan, gatherPrompt, keepDrawnPrompt, mainActionPrompt } from './turn';

// 상태를 얼려 두면 실수로 draft 밖에서 변형하는 버그가 즉시 드러난다.
setAutoFreeze(true);

/**
 * 입력이 필요 없는 전이를 **한 단계** 수행한다.
 *
 * 진행하다 누군가에게 물어야 할 것이 생기면 `state.pending` 에 질문을 세우고
 * 멈춘다. 게임 마스터는 그 질문을 꺼내 해당 플레이어에게 건넨다.
 */
export function advanceState(state: GameState): GameState {
  if (state.pending) {
    throw new Error(`먼저 답해야 할 질문이 있습니다(${state.pending.type})`);
  }
  if (state.phase === 'finished') throw new Error('이미 끝난 게임입니다');
  return produce(state, advance);
}

function advance(s: GameState): void {
  switch (s.phase) {
    case 'selection':
      advanceSelection(s);
      return;
    case 'action':
      advanceAction(s);
      return;
    case 'scoring':
      finishScoring(s);
      return;
    case 'finished':
      return;
  }
}

function advanceSelection(s: GameState): void {
  if (!s.selection) {
    startSelection(s);
    return;
  }
  const sel = s.selection;
  if (sel.cursor < sel.order.length) {
    s.pending = selectionPrompt(s, sel);
    return;
  }
  finishSelection(s);
}

function advanceAction(s: GameState): void {
  const a = s.action;
  if (!a) throw new Error('행동 단계 상태가 없습니다');

  if (!a.turn) {
    if (a.rankCursor > maxRank(s)) {
      endRound(s);
      return;
    }
    callNextRank(s);
    return;
  }

  const turn = a.turn;
  switch (turn.stage) {
    case 'gather': {
      if (turn.drawn) {
        const plan = gatherPlan(s, turn.playerId);
        // 도서관이 있거나 더미가 모자라 적게 뽑힌 경우 — 고를 게 없으니 그냥 다 가진다.
        if (turn.drawn.length <= plan.keep) {
          applyKeepDrawn(s, [...turn.drawn]);
          return;
        }
        s.pending = keepDrawnPrompt(s, turn);
        return;
      }
      s.pending = gatherPrompt(s, turn);
      return;
    }
    case 'main':
      s.pending = mainActionPrompt(s, turn);
      return;
    case 'ending':
      finishTurn(s);
      return;
  }
}
