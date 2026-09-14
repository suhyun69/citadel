import { holderOf } from '../effects/characters/_shared';
import { WITCH_ID, bewitchTargets } from '../effects/characters/witch';
import { startTurn } from '../flow/turn';
import type { GameState, TurnState } from '../state/game-state';
import type { Prompt } from '../state/prompt';
import type { PlayerId } from '../state/ids';

/**
 * 마녀가 아직 선언하지 않았다면 던질 질문.
 *
 * 차례 메뉴 대신 이 질문이 나간다. 규칙이 마녀에게 다른 선택지를 주지
 * 않기 때문이다(howto.md:226) — 건설도, 건물 효과도, 다른 능력도 없다.
 */
export function bewitchPrompt(state: GameState, turn: TurnState): Prompt | null {
  if (turn.stolen) return null;
  if (turn.characterId !== WITCH_ID) return null;
  if (state.action?.declared.witchTarget) return null;

  const options = bewitchTargets(state);
  if (options.length === 0) return null;

  return {
    type: 'namedCharacter',
    player: turn.playerId,
    text: '마법을 걸 캐릭터를 지목하세요 (선언한 뒤 차례가 멈춥니다)',
    purpose: 'bewitch',
    options,
  };
}

/** 이 플레이어의 캐릭터가 이번 라운드에 마법에 걸렸는가. */
export function isBewitched(state: GameState, player: PlayerId): boolean {
  const target = state.action?.declared.witchTarget;
  if (!target) return false;
  return state.players[player]?.character?.characterId === target;
}

/**
 * 마녀가 이어받을 차례를 연다.
 *
 * `actingAs` 를 **먼저** 세우는 것이 중요하다 — startTurn 이 건설 한도를
 * 계산하고 차례 시작 훅을 돌리므로, 그 전에 빌려온 능력이 붙어 있어야
 * 건축가의 3채나 황제의 왕관 넘기기가 제대로 걸린다.
 */
export function startStolenTurn(state: GameState): boolean {
  const target = state.action?.declared.witchTarget;
  if (!target) return false;

  const witch = holderOf(state, WITCH_ID);
  if (witch === null) return false;

  const p = state.players[witch];
  if (!p) return false;

  p.actingAs = target;
  startTurn(state, witch, target, { stolen: true });
  return true;
}

/** 마녀가 빼앗을 차례를 예약한다. 마법에 걸린 캐릭터의 차례가 끝나는 순간. */
export function noteBewitchedTurnDone(state: GameState, player: PlayerId): void {
  const a = state.action;
  if (!a) return;
  if (!isBewitched(state, player)) return;
  a.witchPending = true;
}
