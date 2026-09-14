import { buildingDef, characterDef, type UniqueBuildingId } from '@/data/types';
import { makeCtx } from '../effects/ctx';
import { buildingsProviding, collectHooks } from '../effects/registry';
import { canBuild, hasSameTitle, isBuildFree, isCityComplete, sacrificeOptions } from '../rules/build';
import { canSeize } from '../rules/seizure';
import { payPropertyTax } from '../rules/tax';
import { draw, returnToBottom } from '../rules/deck';
import type { MainAction, Prompt } from '../state/prompt';
import { defIdOf, defOf, titleOf, type CardId, type PlayerId } from '../state/ids';
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
  let gold = GATHER_GOLD;
  for (const h of collectHooks(state, player)) {
    if (h.modifyGatherCards) plan = h.modifyGatherCards(plan, ctx);
    if (h.modifyGatherGold) gold = h.modifyGatherGold(gold, ctx);
  }
  return { gold, draw: plan.draw, keep: Math.min(plan.keep, plan.draw) };
}

export function buildLimitFor(state: GameState, player: PlayerId): number {
  const ctx = makeCtx(state, player);
  let limit = BASE_BUILD_LIMIT;
  for (const h of collectHooks(state, player)) {
    if (h.modifyBuildLimit) limit = h.modifyBuildLimit(limit, ctx);
  }
  return Math.max(0, limit);
}

export function startTurn(
  state: GameState,
  player: PlayerId,
  characterId: import('@/data/types').CharacterId,
  opts: { stolen?: boolean } = {},
): void {
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
    pendingSub: null,
    paidBuilds: 0,
    pendingSeizure: null,
    buildGoldPaid: 0,
    // 빼앗은 차례라는 표시는 차례 시작 훅보다 **먼저** 서 있어야 한다.
    // 왕·대공이 그것을 보고 왕관을 가져가지 않는다(howto.md:232).
    ...(opts.stolen ? { stolen: true } : {}),
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

    // 금광 — 기본 2닢보다 많이 받았다면 누가 얹어줬는지 적는다
    if (plan.gold > GATHER_GOLD) {
      for (const b of buildingsProviding(state, turn.playerId, 'modifyGatherGold')) {
        state.log.push({
          t: 'buildingEffect',
          player: turn.playerId,
          building: b.id,
          effect: { kind: 'extraGold', gold: plan.gold - GATHER_GOLD },
        });
      }
    }
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

  // 도서관 — 원래는 1장만 남기는데 전부 가져갔다면 그 이유를 적는다
  if (keep.length > GATHER_KEEP) {
    for (const b of buildingsProviding(state, turn.playerId, 'modifyGatherCards')) {
      state.log.push({
        t: 'buildingEffect',
        player: turn.playerId,
        building: b.id,
        effect: { kind: 'keptAllDrawn', cards: keep.length },
      });
    }
  }

  state.log.push({ t: 'gained', player: turn.playerId, cards: keep.length, reason: '자원얻기' });
  turn.drawn = null;
  turn.stage = 'main';
}

/** 차례 메뉴. 항상 endTurn 이 들어 있어 교착이 생기지 않는다. */
export function mainActionOptions(state: GameState, turn: TurnState): MainAction[] {
  const p = state.players[turn.playerId];
  if (!p) return [{ t: 'endTurn' }];
  const ctx = makeCtx(state, turn.playerId);

  const hooks = collectHooks(state, turn.playerId);
  const options: MainAction[] = [];

  // 마녀와 마법에 걸린 캐릭터는 건설 행동 자체가 없다 (howto.md:226).
  if (!hooks.some((h) => h.blocksBuild?.(ctx))) {
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
  }

  for (const h of hooks) {
    if (h.turnActions) options.push(...h.turnActions(ctx));
  }

  // "반드시" 해야 할 일이 남아 있으면 차례를 끝낼 수 없다. 그런 훅은 대신
  // 고를 행동을 항상 하나 내놓으므로, 여기서 메뉴가 비는 일은 없다.
  const blocked = options.length > 0 && hooks.some((h) => h.blocksEndTurn?.(ctx));
  if (!blocked) options.push({ t: 'endTurn' });
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

  const p = state.players[turn.playerId];
  if (!p) throw new Error('알 수 없는 플레이어');

  const ctx = makeCtx(state, turn.playerId);
  const check = canBuild(state, turn.playerId, card, ctx);
  if (!check.ok) throw new Error(`건설할 수 없습니다: ${titleOf(card)} (${check.reason})`);

  // 공동묘지처럼 건물을 부숴 대신할 수 있으면 먼저 물어본다.
  const sacrificeable = sacrificeOptions(state, turn.playerId, defOf(card), ctx);
  if (sacrificeable.length > 0) {
    ctx.ask({
      type: 'sacrificeBuild',
      player: turn.playerId,
      text: `${titleOf(card)}: 건물 1채를 부수고 짓거나, 금화 ${check.cost}닢을 냅니다`,
      card,
      cost: check.cost,
      canPayGold: p.gold >= check.cost,
      options: sacrificeable,
    });
    return;
  }

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
  opts: { countsTowardLimit?: boolean } = {},
): void {
  const turn = state.action?.turn;
  const p = state.players[player];
  if (!p) throw new Error('알 수 없는 플레이어');

  const idx = p.hand.indexOf(card);
  if (idx === -1) throw new Error(`손에 없는 카드입니다: ${card}`);

  // 치안판사가 이 건설을 노리고 있다면 여기서 한 번 멈춘다. 아직 아무것도
  // 옮기지 않았으므로, 몰수되더라도 "건설비용을 돌려받는" 정산이 필요 없다.
  const magistrate = canSeize(state, player, card, gold);
  if (magistrate !== null && turn) {
    turn.pendingSeizure = { card, gold, cardsPaid: [...cardsPaid] };
    state.pending = {
      type: 'seize',
      player: magistrate,
      text: `P${player} 가 ${titleOf(card)} 을(를) 짓습니다 — 영장을 공개할까요?`,
      builder: player,
      card,
    };
    return;
  }

  // 건물이 도시에 들어가기 **전에** 기록해야 한다 — 중복 판정은 이 카드 자신을
  // 세면 안 되고, 할인은 이 건설을 설명하는 것이므로 건설 줄보다 앞서야 한다.
  noteBuildEffects(state, player, card, gold, cardsPaid);

  p.hand.splice(idx, 1);

  for (const paid of cardsPaid) {
    const i = p.hand.indexOf(paid);
    if (i === -1) throw new Error(`지불에 쓸 수 없는 카드입니다: ${paid}`);
    p.hand.splice(i, 1);
  }
  returnToBottom(state, cardsPaid);

  p.gold -= gold;
  p.city.push({ card });

  // 교역상의 상업 건물이나 마구간은 "한 채 지었다" 로 세지 않는다.
  const counts =
    (opts.countsTowardLimit ?? true) && !isBuildFree(state, player, defOf(card), makeCtx(state, player));
  if (turn && counts) turn.buildsUsed += 1;
  if (turn && gold > 0) turn.paidBuilds += 1;
  // 연금술사가 돌려받는 몫. 대장간·재산세로 나간 금화는 여기 들어오지 않는다.
  if (turn) turn.buildGoldPaid += gold;

  state.log.push({ t: 'built', player, card, paid: gold });

  // 재산세는 건설이 끝난 **뒤** 남은 금화에서 낸다 (howto.md:440).
  payPropertyTax(state, player);
  noteCompletion(state, player);
}

/**
 * 이 건설에 관여한 특수 건물을 로그에 남긴다.
 *
 * 수치만 바꾸는 효과들이라 그냥 두면 로그에 흔적이 없다 — 5닢짜리가 4닢에
 * 지어지거나 같은 건물이 두 채 서는 것이 규칙 위반처럼 보인다.
 */
function noteBuildEffects(
  state: GameState,
  player: PlayerId,
  card: CardId,
  gold: number,
  cardsPaid: readonly CardId[],
): void {
  const def = defOf(card);

  // 공장 — 낸 값이 정가보다 적으면 누가 깎아줬는지 적는다
  const saved = (def.cost ?? 0) - (gold + cardsPaid.length);
  if (saved > 0) {
    for (const b of buildingsProviding(state, player, 'modifyBuildCost')) {
      state.log.push({
        t: 'buildingEffect',
        player,
        building: b.id,
        effect: { kind: 'discounted', card, saved },
      });
    }
  }

  // 채석장 — 이미 같은 이름이 서 있는데도 지을 수 있었던 이유
  if (hasSameTitle(state, player, def)) {
    for (const b of buildingsProviding(state, player, 'allowsDuplicateTitle')) {
      state.log.push({
        t: 'buildingEffect',
        player,
        building: b.id,
        effect: { kind: 'builtDuplicate', card },
      });
    }
  }

  // 도적 소굴 — 카드로 낸 몫. 건설 줄의 "N닢" 은 금화만 세므로 여기서 보충한다.
  if (cardsPaid.length > 0) {
    state.log.push({
      t: 'buildingEffect',
      player,
      building: def.id as UniqueBuildingId,
      effect: { kind: 'paidWithCards', card, gold, cards: cardsPaid.length },
    });
  }
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
      const usedBefore = turn.usedAbilities.length;

      let handled = false;
      for (const h of collectHooks(state, turn.playerId)) {
        if (h.performAction?.(action, ctx)) {
          handled = true;
          break;
        }
      }

      // 능력을 썼는데 사용 처리도 안 하고 질문도 안 띄웠다면, 그 선택지는
      // 메뉴에 그대로 남아 봇이 영원히 다시 고른다. 무한 루프 대신
      // 여기서 소리 나게 터뜨린다.
      if (handled && !state.pending && turn.usedAbilities.length === usedBefore) {
        const what = action.t === 'useBuilding' ? action.building : action.ability;
        throw new Error(
          `${what} 이(가) 아무 일도 하지 않았습니다 — markUsed 를 빠뜨렸을 가능성이 큽니다`,
        );
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
