import { characterDef, type CharacterId } from '@/data/types';
import { makeCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { playerId, type PlayerId } from '../types/ids';
import type { GameState } from '../types/state';
import { startTurn } from './turn';

export function maxRank(state: GameState): number {
  return state.config.characterIds.reduce((n, id) => Math.max(n, characterDef(id).rank), 0);
}

function characterAtRank(state: GameState, rank: number): CharacterId | null {
  return state.config.characterIds.find((id) => characterDef(id).rank === rank) ?? null;
}

function ownerOf(state: GameState, character: CharacterId): PlayerId | null {
  const i = state.players.findIndex((p) => p.character?.characterId === character);
  return i === -1 ? null : playerId(i);
}

/**
 * 다음 순번을 호명한다. 한 번 호출에 한 가지 전이만 수행하고,
 * 입력이 필요해지면 machine 이 pending 을 세운다.
 */
export function callNextRank(state: GameState): void {
  const a = state.action;
  if (!a) throw new Error('행동 단계가 아닙니다');

  const rank = a.rankCursor;
  const character = characterAtRank(state, rank);
  if (!character) {
    a.rankCursor += 1;
    return;
  }

  state.log.push({ t: 'rankCalled', rank });
  const owner = ownerOf(state, character);

  if (owner === null) {
    // 아무도 고르지 않은 캐릭터. 버려졌거나 애초에 뽑히지 않았다.
    state.log.push({ t: 'rankAbsent', rank });
    a.rankCursor += 1;
    return;
  }

  const slot = state.players[owner]?.character;
  if (!slot) throw new Error('캐릭터 슬롯이 비어 있습니다');

  slot.revealed = true;
  state.log.push({ t: 'characterRevealed', player: owner, character });

  // 공개 시점에 반응하는 능력(도둑의 정산)은 소유자와 무관하게 전부 물어본다.
  for (let i = 0; i < state.players.length; i++) {
    const watcher = playerId(i);
    const ctx = makeCtx(state, watcher);
    for (const h of collectHooks(state, watcher)) h.onCharacterRevealed?.(owner, character, ctx);
  }

  if (slot.killed) {
    state.log.push({ t: 'skipped', player: owner, character, reason: 'killed' });
    slot.turnDone = true;
    a.rankCursor += 1;
    return;
  }

  startTurn(state, owner, character);
}

export function finishTurn(state: GameState): void {
  const a = state.action;
  if (!a?.turn) throw new Error('진행 중인 차례가 없습니다');
  const slot = state.players[a.turn.playerId]?.character;
  if (slot) slot.turnDone = true;
  a.turn = null;
  a.rankCursor += 1;
}

/** 모든 순번이 끝났다. 라운드를 마무리하고 다음 라운드나 점수 계산으로 넘어간다. */
export function endRound(state: GameState): void {
  for (let i = 0; i < state.players.length; i++) {
    const p = playerId(i);
    const ctx = makeCtx(state, p);
    for (const h of collectHooks(state, p)) h.onRoundEnd?.(ctx);
  }

  state.log.push({ t: 'roundEnd', round: state.round });

  const someoneCompleted = state.players.some((p) => p.cityCompletedAtRound !== null);
  if (someoneCompleted) {
    state.phase = 'scoring';
    state.action = null;
    return;
  }

  if (state.round >= state.config.maxRounds) {
    throw new Error(
      `${state.config.maxRounds}라운드가 지나도 도시를 완성한 플레이어가 없습니다 ` +
        `(seed=${state.config.seed}, players=${state.config.playerCount}). ` +
        `진행이 막히는 버그일 가능성이 큽니다.`,
    );
  }

  // 캐릭터 회수 후 새 라운드
  for (const p of state.players) p.character = null;
  state.action = null;
  state.phase = 'selection';
}
