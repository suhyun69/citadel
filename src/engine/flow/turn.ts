import { buildingDef, characterDef } from '@/data/types';
import { makeCtx } from '../effects/ctx';
import { collectHooks } from '../effects/registry';
import { canBuild, isCityComplete } from '../rules/build';
import { draw, returnToBottom } from '../rules/deck';
import type { MainAction, Prompt } from '../state/prompt';
import { defIdOf, titleOf, type CardId, type PlayerId } from '../state/ids';
import type { GameState, TurnState } from '../state/game-state';

/** 자원 얻기 행동의 기본값 (howto.md:75). */
export const GATHER_GOLD = 2;
export const GATHER_DRAW = 2;
export const GATHER_KEEP = 1;
export const BASE_BUILD_LIMIT = 1;

export interface GatherPlan {
  gold: number;
  draw: number;
  keep: number;
}

/** 효과가 반영된 자원 얻기 수치. 도서관이면 keep === draw 가 된다. */
export function gatherPlan(state: GameState, player: PlayerId): GatherPlan {
  const ctx = makeCtx(state, player);
  let plan = { draw: GATHER_DRAW, keep: GATHER_KEEP };
  for (const h of collectHooks(state, player)) {
    if (h.modifyGatherCards) plan = h.modifyGatherCards(plan, ctx);
  }
  return { gold: GATHER_GOLD, draw: plan.draw, keep: Math.min(plan.keep, plan.draw) };
}

export function buildLimitFor(state: GameState, player: PlayerId): number {
  const ctx = makeCtx(state, player);
  let limit = BASE_BUILD_LIMIT;
  for (const h of collectHooks(state, player)) {
    if (h.modifyBuildLimit) limit = h.modifyBuildLimit(limit, ctx);
  }
  return Math.max(0, limit);
}

export function startTurn(state: GameState, player: PlayerId, characterId: import('@/data/types').CharacterId): void {
  const a = state.action;
  if (!a) throw new Error('행동 단계가 아닙니다');

  a.turn = {
    playerId: player,
    characterId,
    stage: 'gather',
    buildsUsed: 0,
    buildLimit: buildLimitFor(state, player),
    drawn: null,
    usedAbilities: [],
  } satisfies TurnState;

  const ctx = makeCtx(state, player);
  for (const h of collectHooks(state, player)) h.onTurnStart?.(ctx);
}

export function gatherPrompt(state: GameState, turn: TurnState): Prompt {
  const plan = gatherPlan(state, turn.playerId);
  return {
    type: 'gatherMode',
    player: turn.playerId,
    text: `자원 얻기: 금화 ${plan.gold}닢 또는 카드 ${plan.draw}장`,
    goldAmount: plan.gold,
    drawCount: plan.draw,
  };
}

export function applyGatherMode(state: GameState, mode: 'gold' | 'cards'): void {
  const turn = state.action?.turn;
  if (!turn) throw new Error('진행 중인 차례가 없습니다');
  const p = state.players[turn.playerId];
  if (!p) throw new Error('알 수 없는 플레이어');

  const plan = gatherPlan(state, turn.playerId);
  if (mode === 'gold') {
    p.gold += plan.gold;
    state.log.push({ t: 'gained', player: turn.playerId, gold: plan.gold, reason: '자원얻기' });
    turn.stage = 'main';
  } else {
    turn.drawn = draw(state, plan.draw);
  }
}

export function keepDrawnPrompt(state: GameState, turn: TurnState): Prompt {
  const plan = gatherPlan(state, turn.playerId);
  const drawn = turn.drawn ?? [];
  return {
    type: 'keepDrawn',
    player: turn.playerId,
    text: `뽑은 ${drawn.length}장 중 ${plan.keep}장을 손에 듭니다`,
    drawn: [...drawn],
    keep: Math.min(plan.keep, drawn.length),
  };
}

export function applyKeepDrawn(state: GameState, keep: readonly CardId[]): void {
  const turn = state.action?.turn;
  if (!turn || !turn.drawn) throw new Error('고를 카드가 없습니다');
  const p = state.players[turn.playerId];
  if (!p) throw new Error('알 수 없는 플레이어');

  const rest = turn.drawn.filter((c) => !keep.includes(c));
  p.hand.push(...keep);
  returnToBottom(state, rest);

  state.log.push({ t: 'gained', player: turn.playerId, cards: keep.length, reason: '자원얻기' });
  turn.drawn = null;
  turn.stage = 'main';
}

/** 차례 메뉴. 항상 endTurn 이 들어 있어 교착이 생기지 않는다. */
export function mainActionOptions(state: GameState, turn: TurnState): MainAction[] {
  const p = state.players[turn.playerId];
  if (!p) return [{ t: 'endTurn' }];
  const ctx = makeCtx(state, turn.playerId);

  const options: MainAction[] = [];
  const seenTitles = new Set<string>();
  for (const card of p.hand) {
    // 손에 같은 건물이 여러 장 있어도 선택지는 하나로 충분하다.
    const defId = defIdOf(card);
    if (seenTitles.has(defId)) continue;
    if (canBuild(state, turn.playerId, card, ctx).ok) {
      seenTitles.add(defId);
      options.push({ t: 'build', card });
    }
  }

  for (const h of collectHooks(state, turn.playerId)) {
    if (h.turnActions) options.push(...h.turnActions(ctx));
  }

  options.push({ t: 'endTurn' });
  return options;
}

export function mainActionPrompt(state: GameState, turn: TurnState): Prompt {
  return {
    type: 'mainAction',
    player: turn.playerId,
    text: `${characterDef(turn.characterId).name} 차례: 무엇을 하시겠습니까?`,
    options: mainActionOptions(state, turn),
  };
}

export function applyBuild(state: GameState, card: CardId): void {
  const turn = state.action?.turn;
  if (!turn) throw new Error('진행 중인 차례가 없습니다');

  const ctx = makeCtx(state, turn.playerId);
  const check = canBuild(state, turn.playerId, card, ctx);
  if (!check.ok) throw new Error(`건설할 수 없습니다: ${titleOf(card)} (${check.reason})`);

  // 도적 소굴처럼 카드로도 낼 수 있는 건물은 지불 방식을 물어본다.
  if (check.maxCards > 0) {
    ctx.ask({
      type: 'buildPayment',
      player: turn.playerId,
      text: `${titleOf(card)} 건설비용 ${check.cost}닢을 금화와 카드로 나눠 냅니다`,
      card,
      cost: check.cost,
      maxCards: check.maxCards,
    });
    return;
  }

  placeBuilding(state, turn.playerId, card, check.cost, []);
}

/** 실제 배치. 지불이 끝난 뒤 한 번만 부른다. */
export function placeBuilding(
  state: GameState,
  player: PlayerId,
  card: CardId,
  gold: number,
  cardsPaid: readonly CardId[],
): void {
  const turn = state.action?.turn;
  const p = state.players[player];
  if (!p) throw new Error('알 수 없는 플레이어');

  const idx = p.hand.indexOf(card);
  if (idx === -1) throw new Error(`손에 없는 카드입니다: ${card}`);
  p.hand.splice(idx, 1);

  for (const paid of cardsPaid) {
    const i = p.hand.indexOf(paid);
    if (i === -1) throw new Error(`지불에 쓸 수 없는 카드입니다: ${paid}`);
    p.hand.splice(i, 1);
  }
  returnToBottom(state, cardsPaid);

  p.gold -= gold;
  p.city.push({ card });
  if (turn) turn.buildsUsed += 1;

  state.log.push({ t: 'built', player, card, paid: gold });
  noteCompletion(state, player);
}

/** 도시가 방금 완성되었는지 기록한다. 선완성 4점 / 후완성 2점의 근거. */
export function noteCompletion(state: GameState, player: PlayerId): void {
  const p = state.players[player];
  if (!p || p.cityCompletedAtRound !== null) return;
  if (!isCityComplete(state, player)) return;

  p.cityCompletedAtRound = state.round;
  const first = state.firstCompleted === null;
  if (first) state.firstCompleted = player;
  state.log.push({ t: 'cityCompleted', player, first });
}

export function applyMainAction(state: GameState, action: MainAction): void {
  const turn = state.action?.turn;
  if (!turn) throw new Error('진행 중인 차례가 없습니다');

  switch (action.t) {
    case 'build':
      applyBuild(state, action.card);
      return;
    case 'endTurn':
      turn.stage = 'ending';
      return;
    case 'useAbility':
    case 'useBuilding': {
      const ctx = makeCtx(state, turn.playerId);
      let handled = false;
      for (const h of collectHooks(state, turn.playerId)) {
        if (h.performAction?.(action, ctx)) {
          handled = true;
          break;
        }
      }
      if (!handled) {
        const what =
          action.t === 'useBuilding' ? buildingDef(action.building).title : action.ability;
        throw new Error(`처리할 수 없는 행동입니다: ${what}`);
      }
      return;
    }
  }
}
