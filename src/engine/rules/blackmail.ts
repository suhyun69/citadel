import type { CharacterId } from '@/data/types';
import { holderOf } from '../effects/characters/_shared';
import { BLACKMAILER_ID } from '../effects/characters/blackmailer';
import type { GameState, TurnState } from '../state/game-state';
import type { Prompt } from '../state/prompt';
import type { PlayerId } from '../state/ids';

/** 뇌물은 가진 금화의 절반, 소수점 버림. 1닢뿐이면 0닢이다 (howto.md:268). */
export const bribeAmount = (gold: number): number => Math.floor(gold / 2);

export interface BlackmailToken {
  character: CharacterId;
  /** 꽃 자수 손수건. 이쪽만 실제 협박 대상이고 나머지는 허풍이다. */
  sealed: boolean;
}

/** 이 플레이어의 캐릭터에 붙어 있는 협박 토큰. */
export function blackmailOn(state: GameState, player: PlayerId): BlackmailToken | null {
  const character = state.players[player]?.character?.characterId;
  if (!character) return null;
  return state.action?.declared.blackmail.find((b) => b.character === character) ?? null;
}

/**
 * 협박당한 플레이어가 답해야 할 질문.
 *
 * 자원 얻기는 이미 끝난 뒤이고, 캐릭터 능력과 건물 효과는 아직 하나도 쓰지
 * 않은 시점이다 — 규칙이 못 박은 순서 그대로다(howto.md:270).
 */
export function bribePrompt(state: GameState, turn: TurnState): Prompt | null {
  if (turn.stolen) return null;

  const token = blackmailOn(state, turn.playerId);
  if (!token) return null;

  const blackmailer = holderOf(state, BLACKMAILER_ID);
  if (blackmailer === null) return null;

  const gold = state.players[turn.playerId]?.gold ?? 0;
  return {
    type: 'bribe',
    player: turn.playerId,
    text:
      `협박당했습니다 — 금화 ${bribeAmount(gold)}닢을 바치면 ` +
      `토큰을 앞면을 보지 않고 치웁니다`,
    to: blackmailer,
    amount: bribeAmount(gold),
  };
}

/** 토큰 하나를 판에서 뗀다. 뇌물을 받았든 공개했든 역할이 끝난 것은 같다. */
export function removeToken(state: GameState, character: CharacterId): void {
  const a = state.action;
  if (!a) return;
  a.declared.blackmail = a.declared.blackmail.filter((b) => b.character !== character);
}
