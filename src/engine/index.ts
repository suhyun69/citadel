export { step, applyChoice, isOver } from './machine';
export { createMatch, createMatchUnchecked, matchConfig, buildDeck, seatOrder } from './setup';
export { legalChoices, isLegal } from './query';
export { viewFor, redactEvent } from './view';
export { assertInvariants, checkInvariants } from './rules/invariants';
export { isPlayable, missingCards } from './effects/registry';
export { computeResult, scoreFor } from './phases/scoring';

export type { GameState, MatchConfig, PlayerState, CityEntry, CharacterSlot, PlayerScore, MatchResult } from './types/state';
export type { PendingDecision, AnyChoice, ChoiceOf, MainAction, DecisionType } from './types/decision';
export type { GameEvent } from './types/event';
export type { PlayerId, CardId } from './types/ids';
export type { PlayerView } from './view';
export type { GameHooks, EffectCtx, ScoreCtx } from './effects/hooks';
