import { characterDef, type CharacterId } from '@/data/types';
import { shuffle } from '../rng';
import {
  LAST_PICKER_GETS_DISCARD_AT,
  NEVER_FACE_UP_RANK,
  discardCounts,
} from '../rules/selection-table';
import { seatOrder } from '../setup';
import type { PendingDecision } from '../types/decision';
import type { GameState, SelectionState } from '../types/state';

/** 라운드 시작: 캐릭터를 섞고 정해진 수만큼 버린다. */
export function startSelection(state: GameState): void {
  state.round += 1;
  state.log.push({ t: 'roundStart', round: state.round, crowned: state.crowned });

  const counts = discardCounts(state.config.playerCount);
  const [shuffled, rng] = shuffle(state.rng, state.config.characterIds);
  state.rng = rng;

  const pool: CharacterId[] = shuffled;
  const faceUp: CharacterId[] = [];

  // 4번 캐릭터는 절대로 앞면으로 버릴 수 없다 (howto.md:66).
  // pool 이 이미 섞여 있으므로, 앞에서부터 4번이 아닌 첫 카드를 집으면
  // "다시 넣고 섞어 재추첨" 과 같은 분포가 된다.
  for (let i = 0; i < counts.faceUp; i++) {
    const idx = pool.findIndex((id) => characterDef(id).rank !== NEVER_FACE_UP_RANK);
    if (idx === -1) break; // 남은 게 전부 4번 — 기본 조합에서는 일어나지 않는다
    faceUp.push(...pool.splice(idx, 1));
  }

  // 뒷면 버림에는 4번 제한이 없다.
  const faceDown: CharacterId[] = pool.splice(0, counts.faceDown);

  state.log.push({ t: 'charactersDiscarded', faceUp: [...faceUp], faceDownCount: faceDown.length });

  state.selection = {
    pool,
    faceUp,
    faceDown,
    order: seatOrder(state.crowned, state.config.playerCount),
    cursor: 0,
  } satisfies SelectionState;
}

/** 7인 게임에서 마지막으로 고르는 플레이어인가 (howto.md:70). */
export function isLastPickerWithDiscard(state: GameState, sel: SelectionState): boolean {
  return (
    state.config.playerCount === LAST_PICKER_GETS_DISCARD_AT &&
    sel.cursor === state.config.playerCount - 1
  );
}

/**
 * 지금 고를 차례인 플레이어에게 보여줄 선택지.
 *
 * 7인 규칙: 마지막 픽커는 맨 처음 **뒷면으로** 버린 카드까지 2장 중에 고른다.
 * 앞면 버림이 아니다.
 */
export function selectionOptions(state: GameState, sel: SelectionState): CharacterId[] {
  const options = [...sel.pool];
  if (isLastPickerWithDiscard(state, sel) && sel.faceDown.length > 0) {
    options.push(sel.faceDown[0] as CharacterId);
  }
  return options;
}

export function selectionPending(state: GameState, sel: SelectionState): PendingDecision {
  const player = sel.order[sel.cursor];
  if (player === undefined) throw new Error('선택 단계 커서가 범위를 벗어났습니다');
  const options = selectionOptions(state, sel);
  return {
    type: 'selectCharacter',
    player,
    prompt: `캐릭터를 1장 고르세요 (${options.length}장 중)`,
    options,
    poolSize: options.length,
  };
}

export function applySelectCharacter(state: GameState, characterId: CharacterId): void {
  const sel = state.selection;
  if (!sel) throw new Error('선택 단계가 아닙니다');
  const player = sel.order[sel.cursor];
  if (player === undefined) throw new Error('선택 단계 커서가 범위를 벗어났습니다');

  const fromPool = sel.pool.indexOf(characterId);
  if (fromPool !== -1) {
    sel.pool.splice(fromPool, 1);
  } else {
    const fromDiscard = sel.faceDown.indexOf(characterId);
    if (fromDiscard === -1) throw new Error(`고를 수 없는 캐릭터입니다: ${characterId}`);
    sel.faceDown.splice(fromDiscard, 1);
  }

  const p = state.players[player];
  if (!p) throw new Error(`알 수 없는 플레이어: ${player}`);
  p.character = { characterId, revealed: false, killed: false, turnDone: false };

  state.log.push({ t: 'characterPicked', player, character: characterId });
  sel.cursor += 1;
}

/** 모두 고른 뒤: 남은 카드는 뒷면으로 버리고 행동 단계로 넘어간다. */
export function finishSelection(state: GameState): void {
  const sel = state.selection;
  if (!sel) throw new Error('선택 단계가 아닙니다');

  sel.faceDown.push(...sel.pool.splice(0));

  state.selection = null;
  state.phase = 'action';
  state.action = {
    rankCursor: 1,
    turn: null,
    declared: { assassinTarget: null, thiefTarget: null },
  };
}
