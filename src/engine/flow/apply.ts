import { produce } from 'immer';
import type { UniqueBuildingId } from '@/data/types';
import {
  resolveBuildPayment,
  resolveDiscardCard,
  resolveMagicianMode,
  resolveNamedCharacter,
  resolveWarlordTarget,
} from '../effects/resolvers';
import type { GameState } from '../state/game-state';
import type { CardId } from '../state/ids';
import type { Choice, Prompt } from '../state/prompt';
import { applySelectCharacter } from './selection';
import { applyGatherMode, applyKeepDrawn, applyMainAction } from './turn';

/**
 * 승인된 답을 상태에 반영한다.
 *
 * **승인은 여기서 하지 않는다** — 게임 마스터가 `approveChoice` 로 먼저 걸러낸
 * 뒤에만 부른다. 검증을 두 벌 두면 언젠가 둘이 어긋난다.
 */
export function applyApprovedChoice(state: GameState, prompt: Prompt, choice: Choice): GameState {
  return produce(state, (s) => {
    s.pending = null;

    switch (choice.type) {
      case 'selectCharacter':
        applySelectCharacter(s, choice.characterId);
        return;
      case 'gatherMode':
        applyGatherMode(s, choice.mode);
        return;
      case 'keepDrawn':
        applyKeepDrawn(s, choice.keep);
        return;
      case 'mainAction':
        applyMainAction(s, choice.action);
        return;
      case 'namedCharacter':
        resolveNamedCharacter(
          s,
          (prompt as { purpose: 'assassinate' | 'rob' }).purpose,
          choice.characterId,
        );
        return;
      case 'magicianMode':
        resolveMagicianMode(s, prompt.player, choice);
        return;
      case 'warlordTarget':
        resolveWarlordTarget(s, prompt.player, choice.target);
        return;
      case 'discardCard':
        resolveDiscardCard(
          s,
          prompt.player,
          (prompt as { source: UniqueBuildingId }).source,
          choice.card,
        );
        return;
      case 'buildPayment':
        resolveBuildPayment(
          s,
          prompt.player,
          (prompt as { card: CardId }).card,
          choice.gold,
          choice.cards,
        );
        return;
    }
  });
}
