import { produce } from 'immer';
import type { UniqueBuildingId } from '@/data/types';
import {
  resolveBuildPayment,
  resolveBuildTaken,
  resolveFreeBuild,
  resolvePickPlayer,
  resolveSeize,
  resolveWarrants,
  resolveTakeCard,
  resolveSacrificeBuild,
  resolveTuckCard,
  resolveArmoryTarget,
  resolveTheaterSwap,
  resolveAbbotIncome,
  resolveBlackmailTokens,
  resolveBribe,
  resolveRevealBlackmail,
  takeTribute,
  resolveDiscardCard,
  resolveMagicianMode,
  resolveNamedCharacter,
  resolveRank8Target,
} from '../effects/resolvers';
import type { GameState } from '../state/game-state';
import type { CardId, PlayerId } from '../state/ids';
import type { CharacterId } from '@/data/types';
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
          (prompt as { purpose: 'assassinate' | 'rob' | 'bewitch' }).purpose,
          choice.characterId,
        );
        return;
      case 'magicianMode':
        resolveMagicianMode(s, prompt.player, choice);
        return;
      case 'rank8Target':
        resolveRank8Target(
          s,
          prompt.player,
          (prompt as { purpose: 'destroy' | 'capture' }).purpose,
          choice.target,
        );
        return;
      case 'discardCard':
        resolveDiscardCard(
          s,
          prompt.player,
          (prompt as { source: UniqueBuildingId }).source,
          choice.card,
        );
        return;
      case 'warrants':
        resolveWarrants(s, choice.sealed, choice.decoys);
        return;
      case 'seize':
        resolveSeize(s, prompt.player, choice.seize);
        return;
      case 'pickPlayer':
        resolvePickPlayer(
          s,
          prompt.player,
          (prompt as { purpose: 'wizardTake' | 'emperorCrown' | 'abbotTax' }).purpose,
          choice.player,
        );
        return;
      case 'takeCard':
        resolveTakeCard(s, prompt.player, choice.card);
        return;
      case 'buildTaken':
        resolveBuildTaken(s, prompt.player, choice.build);
        return;
      case 'freeBuild':
        resolveFreeBuild(
          s,
          prompt.player,
          (prompt as { source: UniqueBuildingId }).source,
          choice.card,
        );
        return;
      case 'sacrificeBuild':
        resolveSacrificeBuild(
          s,
          prompt.player,
          (prompt as { card: CardId }).card,
          (prompt as { cost: number }).cost,
          choice.sacrifice,
        );
        return;
      case 'abbotIncome':
        resolveAbbotIncome(s, prompt.player, choice.gold, choice.cards);
        return;
      case 'emperorTribute':
        takeTribute(s, prompt.player, choice.take);
        return;
      case 'blackmailTokens':
        resolveBlackmailTokens(s, choice.sealed, choice.decoy);
        return;
      case 'bribe':
        resolveBribe(s, prompt.player, choice.pay);
        return;
      case 'revealBlackmail':
        resolveRevealBlackmail(
          s,
          prompt.player,
          (prompt as { target: PlayerId }).target,
          (prompt as { character: CharacterId }).character,
          choice.reveal,
        );
        return;
      case 'tuckCard':
        resolveTuckCard(s, prompt.player, choice.card);
        return;
      case 'armoryTarget':
        resolveArmoryTarget(s, prompt.player, choice.target);
        return;
      case 'theaterSwap':
        resolveTheaterSwap(s, prompt.player, choice.target);
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
