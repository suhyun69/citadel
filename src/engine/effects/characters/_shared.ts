import { characterDef, type BuildingKind, type CharacterId } from '@/data/types';
import { countIncome } from '../../rules/income';
import type { MainAction } from '../../types/decision';
import { playerId, type PlayerId } from '../../types/ids';
import type { GameState } from '../../types/state';
import type { EffectCtx } from '../hooks';

export const isUsed = (ctx: EffectCtx, ability: string): boolean =>
  ctx.turn?.usedAbilities.includes(ability) ?? true;

export function markUsed(ctx: EffectCtx, ability: string): void {
  ctx.turn?.usedAbilities.push(ability);
}

/** 아직 안 쓴 능력이면 메뉴에 하나 노출한다. */
export const abilityOption = (ctx: EffectCtx, ability: string): MainAction[] =>
  isUsed(ctx, ability) ? [] : [{ t: 'useAbility', ability }];

/** `useAbility` 액션이 이 키에 해당하는지. 남의 능력은 그냥 흘려보낸다. */
export const matches = (action: MainAction, ability: string): boolean =>
  action.t === 'useAbility' && action.ability === ability;

/**
 * 종류별 수입. 왕·주교·상인·장군이 공유한다.
 *
 * 능력으로 노출하는 이유는 시점이 전략적이기 때문이다 — 규칙서는 주교를
 * 예로 들어 "건설 전에 받을지 후에 받을지" 고르라고 한다(howto.md:215).
 * 자동 지급으로 만들면 그 선택이 사라진다.
 */
export function grantKindIncome(ctx: EffectCtx, kind: BuildingKind, ability: string): void {
  markUsed(ctx, ability);
  const n = countIncome(ctx.state, ctx.self, kind, ctx);
  if (n <= 0) return;
  const p = ctx.state.players[ctx.self];
  if (!p) return;
  p.gold += n;
  ctx.push({ t: 'gained', player: ctx.self, gold: n, reason: `${kind} 건물 ${n}채` });
}

/** 이번 게임에 쓰이는 캐릭터 전부. */
export const charactersInGame = (state: GameState): readonly CharacterId[] =>
  state.config.characterIds;

/** 이 캐릭터를 가진 플레이어. 아무도 안 골랐으면 null. */
export function holderOf(state: GameState, character: CharacterId): PlayerId | null {
  const i = state.players.findIndex((p) => p.character?.characterId === character);
  return i === -1 ? null : playerId(i);
}

export const rankOf = (character: CharacterId): number => characterDef(character).rank;

export const isKilled = (ctx: EffectCtx): boolean =>
  ctx.state.players[ctx.self]?.character?.killed ?? false;
