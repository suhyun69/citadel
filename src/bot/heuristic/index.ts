import { legalChoices } from '@/engine/query';
import { nextInt, seedRng, type RngState } from '@/engine/rng';
import type { Choice, ChoiceOf, Prompt } from '@/engine/state/prompt';
import type { PlayerView } from '@/engine/view';
import type { Agent } from '../agent';
import { randomChoice } from '../random';
import { normalPolicy, type Policy } from './policies';

/**
 * 정책 기반 봇.
 *
 * 핵심은 폴백 체인 `construct → score → randomLegal` 이다. 정책이 어떤
 * 결정 타입을 다루지 않으면 조용히 무작위로 떨어지므로, 정책을 한 줄도
 * 안 쓴 상태에서도 게임이 끝까지 돌아간다. 덕분에 결정 타입 하나씩
 * 정책을 채워 넣으며 개선할 수 있다.
 */
export class HeuristicAgent implements Agent {
  #rng: RngState;

  constructor(
    readonly name: string,
    seed: number,
    private readonly policy: Policy = normalPolicy,
  ) {
    this.#rng = seedRng(seed);
  }

  decide<D extends Prompt>(view: PlayerView, d: D): Promise<ChoiceOf<D>> {
    return Promise.resolve(this.#pick(view, d) as ChoiceOf<D>);
  }

  #pick(view: PlayerView, d: Prompt): Choice {
    const built = this.policy.construct?.(view, d);
    if (built) return built;

    const options = legalChoices(d);
    if (!options || options.length === 0) {
      const [choice, rng] = randomChoice(view, d, this.#rng);
      this.#rng = rng;
      return choice;
    }

    let best: Choice[] = [];
    let bestScore = -Infinity;
    let scored = false;

    for (const option of options) {
      const s = this.policy.score?.(view, d, option);
      if (s === undefined) continue;
      scored = true;
      if (s > bestScore) {
        bestScore = s;
        best = [option];
      } else if (s === bestScore) {
        best.push(option);
      }
    }

    if (!scored || best.length === 0) {
      const [choice, rng] = randomChoice(view, d, this.#rng);
      this.#rng = rng;
      return choice;
    }

    // 동점은 무작위로 갈라 결정론을 유지하면서 편향을 없앤다.
    const [i, rng] = nextInt(this.#rng, best.length);
    this.#rng = rng;
    return best[i] as Choice;
  }
}

export { normalPolicy, easyPolicy, randomPolicy, POLICIES } from './policies';
export type { Policy } from './policies';
