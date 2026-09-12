import type { UniqueBuildingId } from '@/data/types';
import type { MainAction } from '../../state/prompt';
import { defIdOf } from '../../state/ids';
import type { CityEntry } from '../../state/game-state';
import type { EffectCtx } from '../hooks';

/** 이 도시 엔트리가 그 특수 건물인가. 훅은 도시의 모든 건물에 대해 불린다. */
export const isCard = (entry: CityEntry, id: UniqueBuildingId): boolean =>
  defIdOf(entry.card) === id;

export const usedThisTurn = (ctx: EffectCtx, id: UniqueBuildingId): boolean =>
  ctx.turn?.usedAbilities.includes(id) ?? true;

export function markUsed(ctx: EffectCtx, id: UniqueBuildingId): void {
  ctx.turn?.usedAbilities.push(id);
}

/** "차례마다 한 번" 건물의 메뉴 노출. */
export const onceOption = (ctx: EffectCtx, id: UniqueBuildingId, available: boolean): MainAction[] =>
  available && !usedThisTurn(ctx, id) ? [{ t: 'useBuilding', building: id }] : [];

export const isUse = (action: MainAction, id: UniqueBuildingId): boolean =>
  action.t === 'useBuilding' && action.building === id;
