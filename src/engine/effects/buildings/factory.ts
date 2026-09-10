import type { GameHooks } from '../hooks';

/** 공장 — 특수 건물을 건설할 때 금화 1닢을 적게 낸다. */
export const factory: GameHooks = {
  modifyBuildCost: (cost, def) => (def.kind === 'unique' ? Math.max(0, cost - 1) : cost),
};
