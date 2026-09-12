export { createGame, gameFromConfig, gameFromState } from './master/master';
export type { GameMaster, Player, Character, Approval } from './master/types';

export { matchConfig, buildDeck, seatOrder } from './setup';
export type { MatchOptions } from './setup';
export { legalChoices, sameAction } from './options/enumerate';
export { approveChoice, isLegal } from './options/approve';
export { viewFor, redactEvent } from './view';
export { assertInvariants, checkInvariants } from './rules/invariants';
export { isPlayable, missingCards } from './effects/registry';
export { computeResult, scoreFor } from './flow/scoring';

export type {
  GameState,
  MatchConfig,
  PlayerState,
  CityEntry,
  CharacterSlot,
  PlayerScore,
  MatchResult,
  Phase,
} from './state/game-state';
export type { Prompt, Choice, ChoiceOf, MainAction, PromptType } from './state/prompt';
export type { GameEvent } from './state/event';
export type { PlayerId, CardId } from './state/ids';
export type { PlayerView } from './view';
export type { GameHooks, EffectCtx, ScoreCtx } from './effects/hooks';
