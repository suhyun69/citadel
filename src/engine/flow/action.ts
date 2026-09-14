import { characterDef, type CharacterId } from '@/data/types';
import { makeCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { playerId, type PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';
import { startTurn } from './turn';
import { noteBewitchedTurnDone } from '../rules/witch';

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

  const player = a.turn.playerId;
  const stolen = a.turn.stolen === true;

  // 마녀가 선언하고 멈춘 차례에는 차례 종료 효과가 붙지 않는다. 공원·구빈원은
  // 마녀가 이어받은 차례를 마칠 때 판정하고, 이어받지 못한 라운드에는 아예
  // 발동하지 않는다(howto.md:456, 459).
  if (!a.turn.suspended) {
    // 차례가 끝나는 시점에 반응하는 건물들 (구빈원·공원)
    const ctx = makeCtx(state, player);
    const hooks = collectHooks(state, player);
    for (const h of hooks) h.onTurnEnd?.(ctx);
    // 연금술사의 환급은 그 **뒤**다 — 구빈원이 먼저 판정해야 한다(howto.md:461).
    for (const h of hooks) h.onTurnEndLate?.(ctx);
  }

  // 마법에 걸린 캐릭터의 차례였다면 다음은 마녀가 이어받는다.
  noteBewitchedTurnDone(state, player);

  const me = state.players[player];
  // 마녀가 빼앗아 쓰던 차례라면, 빌려온 능력을 여기서 돌려놓는다.
  if (me) delete me.actingAs;

  // 빼앗은 차례는 마녀 자신의 차례가 아니다 — 마녀의 캐릭터는 이미
  // 자기 순번에 끝났고, 여기서 turnDone 을 다시 건드릴 것이 없다.
  if (!stolen) {
    const slot = me?.character;
    if (slot) slot.turnDone = true;
  }

  a.turn = null;
  if (!stolen) a.rankCursor += 1;
}

/**
 * 라운드 종료 훅만 먼저 돌린다.
 *
 * 마무리(endRound)와 나눠 둔 이유는 **여기서 질문이 날 수 있기 때문**이다 —
 * 암살당한 황제는 라운드가 끝날 때 왕관을 누구에게 줄지 고른다(howto.md:308).
 * 한 함수에 두면 질문을 띄운 채로 단계까지 넘어가 버린다.
 */
export function runRoundEndHooks(state: GameState): void {
  for (let i = 0; i < state.players.length; i++) {
    const p = playerId(i);
    const ctx = makeCtx(state, p);
    for (const h of collectHooks(state, p)) h.onRoundEnd?.(ctx);
  }
}

/** 모든 순번이 끝났다. 라운드를 마무리하고 다음 라운드나 점수 계산으로 넘어간다. */
export function endRound(state: GameState): void {
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
