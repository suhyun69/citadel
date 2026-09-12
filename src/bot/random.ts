import { legalChoices } from '@/engine/options/enumerate';
import { nextInt, pick, seedRng, shuffle, type RngState } from '@/engine/rng';
import type { Choice, Prompt } from '@/engine/state/prompt';
import type { PlayerView } from '@/engine/view';
import type { Agent } from './agent';

/**
 * 합법 수 중 무작위. 열거 불가한 결정(마술사의 버릴 카드 부분집합, 도적 소굴의
 * 지불 조합)은 뷰에 담긴 제약으로 직접 구성한다.
 */
export function randomChoice(
  view: PlayerView,
  d: Prompt,
  rng: RngState,
): [Choice, RngState] {
  const enumerated = legalChoices(d);
  if (enumerated && enumerated.length > 0) {
    const [choice, s] = pick(rng, enumerated);
    return [choice as Choice, s];
  }

  switch (d.type) {
    case 'magicianMode': {
      const hand = view.me.hand;
      let s = rng;
      if (d.canSwapWith.length > 0) {
        const [roll, afterRoll] = nextInt(s, 2);
        s = afterRoll;
        if (roll === 0) {
          const [target, afterPick] = pick(s, d.canSwapWith);
          return [{ type: 'magicianMode', mode: 'swap', target: target! }, afterPick];
        }
      }
      const [n, afterN] = nextInt(s, hand.length + 1);
      const [shuffled, afterShuffle] = shuffle(afterN, hand);
      return [{ type: 'magicianMode', mode: 'redraw', discard: shuffled.slice(0, n) }, afterShuffle];
    }
    case 'buildPayment': {
      // 건설 중인 카드는 도시로 가므로 지불에 쓸 수 없다.
      const hand = view.me.hand.filter((c) => c !== d.card);
      const maxCards = Math.min(d.maxCards, hand.length, d.cost);
      const minCards = Math.max(0, d.cost - view.me.gold);
      const [n, afterN] = nextInt(rng, Math.max(1, maxCards - minCards + 1));
      const cards = Math.min(minCards + n, maxCards);
      const [shuffled, afterShuffle] = shuffle(afterN, hand);
      return [
        { type: 'buildPayment', gold: d.cost - cards, cards: shuffled.slice(0, cards) },
        afterShuffle,
      ];
    }
    default:
      throw new Error(`합법 수를 만들 수 없습니다: ${d.type}`);
  }
}

/**
 * 순수 무작위 봇. 전략은 없지만 **퍼저로서는 휴리스틱 봇보다 훨씬 낫다** —
 * 사람이라면 절대 안 밟을 상태 공간을 밟아 엔진 버그를 드러낸다.
 */
export class RandomAgent implements Agent {
  #rng: RngState;

  constructor(
    readonly name: string,
    seed: number,
  ) {
    this.#rng = seedRng(seed);
  }

  decide<D extends Prompt>(view: PlayerView, d: D) {
    const [choice, rng] = randomChoice(view, d, this.#rng);
    this.#rng = rng;
    return Promise.resolve(choice as never);
  }
}
