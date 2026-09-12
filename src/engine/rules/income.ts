import type { BuildingKind } from '@/data/types';
import { collectHooks } from '../effects/registry';
import type { EffectCtx } from '../effects/hooks';
import { defOf, type PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';

/**
 * 종류별 수입 계산. 왕·주교·상인·장군 네 곳이 같은 로직을 쓰므로 훅이 아니라
 * 공통 함수로 둔다.
 *
 * ★ 여기서만 `countsAsKind` 를 묻는다. 마법학교는 원문이 "자원을 받는 능력을
 *   사용할 때"라 수입 계산에만 걸리고, 게임 종료 점수(5종 보너스·소원의 우물)
 *   에는 관여하지 않는다. 점수 쪽은 scoringKindOverride 가 따로 담당한다.
 */
export function countIncome(
  state: GameState,
  player: PlayerId,
  kind: BuildingKind,
  ctx: EffectCtx,
): number {
  const p = state.players[player];
  if (!p) return 0;
  const hooks = collectHooks(state, player);

  let n = 0;
  for (const entry of p.city) {
    if (defOf(entry.card).kind === kind) {
      n += 1;
      continue;
    }
    if (hooks.some((h) => h.countsAsKind?.(entry, kind, ctx))) n += 1;
  }
  return n;
}
