import { defOf } from '@/engine/types/ids';
import type { AnyChoice, PendingDecision } from '@/engine/types/decision';
import type { PlayerView } from '@/engine/view';
import {
  biggestOpponentHand,
  cardValue,
  characterValue,
  cityDefIds,
  leaderId,
  missingKinds,
  toGo,
} from './evaluate';

/**
 * 결정 하나를 어떻게 고를지에 대한 규칙 묶음.
 *
 * `score` 는 열거된 후보에 점수를 매기고, `construct` 는 열거할 수 없는
 * 결정(마술사의 버릴 카드 부분집합 등)을 직접 만든다. 둘 다 없으면
 * HeuristicAgent 가 무작위로 떨어진다 — 그래서 정책을 한 줄도 안 쓴
 * 상태에서도 봇이 게임을 완주한다.
 */
export interface Policy {
  readonly id: string;
  score?(view: PlayerView, d: PendingDecision, candidate: AnyChoice): number | undefined;
  construct?(view: PlayerView, d: PendingDecision): AnyChoice | undefined;
}

/** 능력 키별 기본 우선순위. 값이 클수록 먼저 쓴다. */
function abilityScore(view: PlayerView, ability: string): number {
  switch (ability) {
    // 공짜 자원은 무조건 먼저. 건설 전에 받아야 그 돈으로 지을 수 있다.
    case 'merchant.bonus':
      return 9;
    case 'architect.draw':
      return 8.5;
    case 'king.income':
    case 'bishop.income':
    case 'merchant.income':
    case 'warlord.income':
      // 수입은 건설 전에 받는 편이 낫다 — 방금 지은 건물 1채보다
      // 지금 못 짓는 건물을 짓게 되는 쪽이 크다.
      return 8;
    case 'warlord.destroy':
      return toGo(view) <= 2 ? 1 : 3.5;
    case 'assassin.kill':
      return 7;
    case 'thief.rob':
      return 6.5;
    case 'magician.magic':
      return biggestOpponentHand(view) > view.me.hand.length + 1 ? 6 : 0.5;
    default:
      return 1;
  }
}

export const normalPolicy: Policy = {
  id: 'normal',

  score(view, d, candidate) {
    switch (d.type) {
      case 'selectCharacter':
        return candidate.type === 'selectCharacter'
          ? characterValue(view, candidate.characterId)
          : undefined;

      case 'gatherMode': {
        if (candidate.type !== 'gatherMode') return undefined;
        // 지을 만한 카드를 2장 이상 들고 있으면 금화가 병목이다.
        const usable = view.me.hand.filter((c) => cardValue(view, c) > 0).length;
        if (candidate.mode === 'cards') return usable < 2 ? 10 : 3;
        return usable < 2 ? 2 : 10;
      }

      case 'keepDrawn': {
        if (candidate.type !== 'keepDrawn') return undefined;
        return candidate.keep.reduce((n, c) => n + cardValue(view, c), 0);
      }

      case 'mainAction': {
        if (candidate.type !== 'mainAction') return undefined;
        const a = candidate.action;
        if (a.t === 'endTurn') return 0;
        if (a.t === 'useAbility') return abilityScore(view, a.ability);
        if (a.t === 'useBuilding') return a.building === 'smithy' ? 4 : 4.5;

        // 건설이 최우선. 마지막 한 채를 채우는 수는 압도적으로 크다.
        const def = defOf(a.card);
        let v = 12 + (def.cost ?? 0) * 0.5;
        if (missingKinds(view).includes(def.kind)) v += 3;
        if (toGo(view) === 1) v += 100;
        return v;
      }

      case 'namedCharacter': {
        if (candidate.type !== 'namedCharacter') return undefined;
        // 상대가 고를 법한, 가장 강한 캐릭터를 노린다.
        const target = candidate.characterId;
        if (d.purpose === 'assassinate') {
          if (target === 'architect') return 10;
          if (target === 'king') return 8;
          if (target === 'warlord') return 7;
          if (target === 'bishop') return 5;
          return 3;
        }
        // 도둑: 금화를 많이 쥐고 있을 캐릭터를 노린다.
        if (target === 'merchant') return 10;
        if (target === 'king') return 8;
        if (target === 'warlord') return 6;
        return 3;
      }

      case 'warlordTarget': {
        if (candidate.type !== 'warlordTarget') return undefined;
        if (!candidate.target) return 0.5; // 건너뛰기
        const leader = leaderId(view);
        const opp = view.opponents.find((o) => o.id === candidate.target?.player);
        const def = defOf(candidate.target.card);
        const price = Math.max(0, (def.cost ?? 0) - 1);
        if (candidate.target.player === view.me.id) return -5; // 내 건물은 안 부순다
        return (
          (def.cost ?? 0) * 1.5 +
          (candidate.target.player === leader ? 4 : 0) +
          (opp ? opp.city.length * 0.5 : 0) -
          price
        );
      }

      case 'discardCard':
        return candidate.type === 'discardCard' ? -cardValue(view, candidate.card) : undefined;

      default:
        return undefined;
    }
  },

  construct(view, d) {
    if (d.type === 'magicianMode') {
      // 상대 손패가 내 것보다 확실히 많으면 통째로 바꾼다.
      let best: { id: (typeof d.canSwapWith)[number]; n: number } | null = null;
      for (const id of d.canSwapWith) {
        const opp = view.opponents.find((o) => o.id === id);
        if (opp && (!best || opp.handCount > best.n)) best = { id, n: opp.handCount };
      }
      if (best && best.n > view.me.hand.length + 1) {
        return { type: 'magicianMode', mode: 'swap', target: best.id };
      }
      // 아니면 쓸모없는 카드만 버리고 새로 뽑는다.
      const junk = view.me.hand.filter((c) => cardValue(view, c) <= 0);
      return { type: 'magicianMode', mode: 'redraw', discard: junk };
    }

    if (d.type === 'buildPayment') {
      // 금화를 먼저 쓰고, 모자란 만큼만 카드로 낸다. 카드가 곧 미래의 건물이다.
      const need = Math.max(0, d.cost - view.me.gold);
      const count = Math.min(need, d.maxCards);
      const junkFirst = view.me.hand
        .filter((c) => c !== d.card)
        .sort((a, b) => cardValue(view, a) - cardValue(view, b))
        .slice(0, count);
      return { type: 'buildPayment', gold: d.cost - junkFirst.length, cards: junkFirst };
    }

    return undefined;
  },
};

/** 정책 없이 무작위로만 두는 봇. 비교 기준선. */
export const randomPolicy: Policy = { id: 'random' };

/** 건설만 우선하고 나머지는 무작위. 중간 난이도. */
export const easyPolicy: Policy = {
  id: 'easy',
  score(view, d, candidate) {
    if (d.type !== 'mainAction' || candidate.type !== 'mainAction') return undefined;
    const a = candidate.action;
    if (a.t === 'build') return 10 + (defOf(a.card).cost ?? 0) * 0.2;
    if (a.t === 'useAbility') return a.ability.endsWith('.income') ? 5 : 2;
    return 0;
  },
};

export const POLICIES: Record<string, Policy> = {
  random: randomPolicy,
  easy: easyPolicy,
  normal: normalPolicy,
};

/** cityDefIds 를 정책 밖에서도 쓸 수 있게 재수출한다. */
export { cityDefIds };
