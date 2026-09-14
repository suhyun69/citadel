import { produce, setAutoFreeze } from 'immer';
import type { GameState } from '../state/game-state';
import { callNextRank, endRound, finishTurn, maxRank, runRoundEndHooks } from './action';
import { finishScoring } from './scoring';
import { finishSelection, selectionPrompt, startSelection } from './selection';
import { theaterPrompt } from '../effects/buildings/theater';
import { bribePrompt } from '../rules/blackmail';
import { bewitchPrompt, isBewitched, startStolenTurn } from '../rules/witch';
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

  // 모두 고른 **뒤** 극장이 한 번 끼어든다 (howto.md 극장).
  if (!sel.theaterDone) {
    const ask = theaterPrompt(s);
    if (ask) {
      sel.theaterDone = true;
      s.pending = ask;
      return;
    }
  }

  finishSelection(s);
}

function advanceAction(s: GameState): void {
  const a = s.action;
  if (!a) throw new Error('행동 단계 상태가 없습니다');

  if (!a.turn) {
    // 마법에 걸린 캐릭터의 차례가 방금 끝났다면, 순번을 넘기기 전에
    // 마녀가 그 자리를 이어받는다 (howto.md:230).
    if (a.witchPending) {
      a.witchPending = false;
      if (startStolenTurn(s)) return;
    }

    if (a.rankCursor > maxRank(s)) {
      // 훅을 먼저 돌리고 한 번 돌아온다. 황제처럼 여기서 묻는 카드가 있다.
      if (!a.roundEndDone) {
        a.roundEndDone = true;
        runRoundEndHooks(s);
        return;
      }
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
    case 'main': {
      // 협박 대응이 가장 먼저다 — 캐릭터 능력도 건물 효과도 그 전에는
      // 쓸 수 없다 (howto.md:270).
      const bribe = bribePrompt(s, turn);
      if (bribe) {
        s.pending = bribe;
        return;
      }

      // 마법에 걸린 캐릭터는 자원 얻기만 하고 즉시 차례를 마친다.
      if (!turn.stolen && isBewitched(s, turn.playerId)) {
        turn.stage = 'ending';
        return;
      }

      // 마녀에게는 차례 메뉴가 열리지 않는다. 선언하고 멈추는 것이 전부다.
      const bewitch = bewitchPrompt(s, turn);
      if (bewitch) {
        s.pending = bewitch;
        return;
      }

      s.pending = mainActionPrompt(s, turn);
      return;
    }
    case 'ending':
      finishTurn(s);
      return;
  }
}
