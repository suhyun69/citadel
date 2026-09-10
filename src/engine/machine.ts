import { produce, setAutoFreeze } from 'immer';
import { callNextRank, endRound, finishTurn, maxRank } from './phases/action';
import { finishScoring } from './phases/scoring';
import {
  applySelectCharacter,
  finishSelection,
  selectionPending,
  startSelection,
} from './phases/selection';
import {
  applyGatherMode,
  applyKeepDrawn,
  applyMainAction,
  gatherPending,
  gatherPlan,
  keepDrawnPending,
  mainActionPending,
} from './phases/turn';
import {
  resolveMagicianMode,
  resolveNamedCharacter,
  resolveWarlordTarget,
} from './effects/resolvers';
import { isLegal } from './query';
import type { AnyChoice } from './types/decision';
import type { GameState } from './types/state';

// 상태를 얼려 두면 실수로 draft 밖에서 변형하는 버그가 즉시 드러난다.
setAutoFreeze(true);

/**
 * 입력이 필요 없는 전이를 한 단계 수행한다.
 * 입력이 필요해지면 `state.pending` 을 채우고 멈춘다.
 */
export function step(state: GameState): GameState {
  if (state.pending) {
    throw new Error(`대기 중인 결정이 있습니다(${state.pending.type}). applyChoice 를 먼저 부르세요.`);
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
    s.pending = selectionPending(s, sel);
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
        s.pending = keepDrawnPending(s, turn);
        return;
      }
      s.pending = gatherPending(s, turn);
      return;
    }
    case 'main':
      s.pending = mainActionPending(s, turn);
      return;
    case 'ending':
      finishTurn(s);
      return;
  }
}

/** 에이전트의 선택을 검증하고 반영한다. pending 을 비우고 돌려준다. */
export function applyChoice(state: GameState, choice: AnyChoice): GameState {
  const pending = state.pending;
  if (!pending) throw new Error('대기 중인 결정이 없습니다');
  if (pending.type !== choice.type) {
    throw new Error(`결정 종류가 맞지 않습니다: ${pending.type} 에 ${choice.type} 응답`);
  }
  if (!isLegal(state, pending, choice)) {
    throw new Error(`합법적이지 않은 선택입니다: ${JSON.stringify(choice)}`);
  }

  return produce(state, (s) => {
    s.pending = null;
    switch (choice.type) {
      case 'selectCharacter':
        applySelectCharacter(s, choice.characterId);
        return;
      case 'gatherMode':
        applyGatherMode(s, choice.mode);
        return;
      case 'keepDrawn':
        applyKeepDrawn(s, choice.keep);
        return;
      case 'mainAction':
        applyMainAction(s, choice.action);
        return;
      case 'namedCharacter':
        resolveNamedCharacter(s, (pending as { purpose: 'assassinate' | 'rob' }).purpose, choice.characterId);
        return;
      case 'magicianMode':
        resolveMagicianMode(s, pending.player, choice);
        return;
      case 'warlordTarget':
        resolveWarlordTarget(s, pending.player, choice.target);
        return;
      default:
        throw new Error(`아직 처리하지 않는 선택입니다: ${choice.type}`);
    }
  });
}

export const isOver = (state: GameState): boolean => state.phase === 'finished';
