import { canBuild } from '../../rules/build';
import { makeCtx } from '../ctx';
import type { GameHooks } from '../hooks';
import { isUse, markUsed, onceOption } from './_shared';

/**
 * 골조 — 골조를 부수고 건물 1채를 공짜로 짓는다.
 *
 * ERRATA: md 는 이 건설이 차례의 건설 횟수에 포함되는지 말하지 않는다.
 * 건물 상세 설명이 "그 다음에 금화를 내고 건설하는 건물" 을 전제하므로
 * **횟수에 포함하지 않는 쪽**으로 해석했다. 규칙서 확인 시 정정할 것.
 */
export const framework: GameHooks = {
  turnActions(ctx) {
    const hand = ctx.state.players[ctx.self]?.hand ?? [];
    return onceOption(ctx, 'framework', hand.length > 0);
  },

  performAction(action, ctx) {
    if (!isUse(action, 'framework')) return false;

    // 사용 처리를 **먼저** 한다. 나중에 하면, 지을 카드가 없어 일찍 돌아갈 때
    // 같은 선택지가 메뉴에 계속 남아 봇이 무한히 고른다.
    markUsed(ctx, 'framework');

    const p = ctx.state.players[ctx.self];
    if (!p) return true;

    // 비용만 빼고 나머지 제약(동명 건물 등)은 그대로 걸린다.
    const buildCtx = makeCtx(ctx.state, ctx.self);
    const options = p.hand.filter((card) => {
      const check = canBuild(ctx.state, ctx.self, card, buildCtx);
      return check.ok || check.reason === 'tooExpensive';
    });
    if (options.length === 0) return true;

    ctx.ask({
      type: 'freeBuild',
      player: ctx.self,
      text: '골조를 부수고 건물 1채를 공짜로 짓습니다',
      source: 'framework',
      options,
    });
    return true;
  },
};

