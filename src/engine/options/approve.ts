import type { GameState } from '../state/game-state';
import type { Choice, Prompt } from '../state/prompt';
import { sameAction } from './enumerate';

/** 게임 마스터의 판정. 거절하면 이유를 함께 돌려준다. */
export type Approval = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export const ACCEPTED: Approval = { ok: true };
const reject = (reason: string): Approval => ({ ok: false, reason });

/**
 * 제출된 답이 규칙에 맞는가.
 *
 * 적용 직전에 반드시 한 번 통과해야 한다. 승인과 적용이 검증을 두 벌 갖지
 * 않도록, 적용 경로는 이 함수만 부른다.
 */
export function approveChoice(state: GameState, prompt: Prompt, choice: Choice): Approval {
  if (prompt.type !== choice.type) {
    return reject(`질문은 ${prompt.type} 인데 답은 ${choice.type} 입니다`);
  }

  switch (prompt.type) {
    case 'selectCharacter':
      return choice.type === 'selectCharacter' && prompt.options.includes(choice.characterId)
        ? ACCEPTED
        : reject('고를 수 없는 캐릭터입니다');

    case 'gatherMode':
      return choice.type === 'gatherMode' && (choice.mode === 'gold' || choice.mode === 'cards')
        ? ACCEPTED
        : reject('자원 얻기 방식이 올바르지 않습니다');

    case 'keepDrawn': {
      if (choice.type !== 'keepDrawn') return reject('답의 종류가 맞지 않습니다');
      if (choice.keep.length !== prompt.keep) {
        return reject(`${prompt.keep}장을 골라야 합니다 (받은 값: ${choice.keep.length}장)`);
      }
      if (new Set(choice.keep).size !== choice.keep.length) return reject('같은 카드를 두 번 골랐습니다');
      return choice.keep.every((card) => prompt.drawn.includes(card))
        ? ACCEPTED
        : reject('뽑지 않은 카드를 골랐습니다');
    }

    case 'mainAction':
      return choice.type === 'mainAction' && prompt.options.some((o) => sameAction(o, choice.action))
        ? ACCEPTED
        : reject('지금 할 수 없는 행동입니다');

    case 'namedCharacter':
      return choice.type === 'namedCharacter' && prompt.options.includes(choice.characterId)
        ? ACCEPTED
        : reject('지목할 수 없는 캐릭터입니다');

    case 'discardCard':
      return choice.type === 'discardCard' && prompt.options.includes(choice.card)
        ? ACCEPTED
        : reject('버릴 수 없는 카드입니다');

    case 'warlordTarget': {
      if (choice.type !== 'warlordTarget') return reject('답의 종류가 맞지 않습니다');
      if (choice.target === null) {
        return prompt.canSkip ? ACCEPTED : reject('건너뛸 수 없습니다');
      }
      const target = choice.target;
      return prompt.options.some((o) => o.player === target.player && o.card === target.card)
        ? ACCEPTED
        : reject('파괴할 수 없는 건물입니다');
    }

    case 'magicianMode': {
      if (choice.type !== 'magicianMode') return reject('답의 종류가 맞지 않습니다');
      if (choice.mode === 'swap') {
        return prompt.canSwapWith.includes(choice.target)
          ? ACCEPTED
          : reject('교환할 수 없는 상대입니다');
      }
      const hand = state.players[prompt.player]?.hand ?? [];
      if (new Set(choice.discard).size !== choice.discard.length) {
        return reject('같은 카드를 두 번 버렸습니다');
      }
      return choice.discard.every((card) => hand.includes(card))
        ? ACCEPTED
        : reject('손에 없는 카드를 버리려 합니다');
    }

    case 'buildPayment': {
      if (choice.type !== 'buildPayment') return reject('답의 종류가 맞지 않습니다');
      const p = state.players[prompt.player];
      if (!p) return reject('알 수 없는 플레이어입니다');

      if (choice.gold < 0) return reject('금화를 음수로 낼 수 없습니다');
      if (choice.cards.length > prompt.maxCards) {
        return reject(`카드는 최대 ${prompt.maxCards}장까지만 낼 수 있습니다`);
      }
      if (choice.gold + choice.cards.length !== prompt.cost) {
        return reject(`건설비용 ${prompt.cost}닢에 맞춰 내야 합니다`);
      }
      if (choice.gold > p.gold) return reject('가진 금화보다 많이 낼 수 없습니다');
      // 건설 중인 카드 자신으로는 그 건설비용을 낼 수 없다 — 도시로 가는 카드다.
      if (choice.cards.includes(prompt.card)) return reject('건설 중인 카드로는 지불할 수 없습니다');
      if (new Set(choice.cards).size !== choice.cards.length) {
        return reject('같은 카드를 두 번 냈습니다');
      }
      return choice.cards.every((card) => p.hand.includes(card))
        ? ACCEPTED
        : reject('손에 없는 카드를 내려 합니다');
    }
  }
}

/** 예/아니오만 필요할 때. */
export const isLegal = (state: GameState, prompt: Prompt, choice: Choice): boolean =>
  approveChoice(state, prompt, choice).ok;
