import type { CharacterId } from '@/data/types';
import { discardEntry, draw, returnToBottom } from '../rules/deck';
import { destroyPrice, rank8Surcharge } from '../rules/rank8';
import type { Choice } from '../state/prompt';
import { defIdOf, defOf, type CardId, type PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';
import { holderOf } from './characters/_shared';
import { BLACKMAILER_ID } from './characters/blackmailer';
import { takeTithe } from './characters/abbot';
import { blackmailOn, bribeAmount, removeToken } from '../rules/blackmail';
import { pick } from '../rng';
import { LABORATORY_GOLD } from './buildings/laboratory';
import { noteCompletion, placeBuilding } from '../flow/turn';
import { buildCost } from '../rules/build';
import { makeCtx } from './ctx';
import type { UniqueBuildingId } from '@/data/types';

/**
 * 효과가 띄운 결정의 처리.
 *
 * 훅 안에 콜백을 저장해두고 부르는 방식은 쓸 수 없다 — 상태가 직렬화
 * 가능해야 리플레이·저장·스냅샷 테스트가 성립하기 때문이다. 대신 결정에
 * 실린 정보(`purpose` 등)만으로 어디로 보낼지 정한다.
 */

export function resolveNamedCharacter(
  state: GameState,
  purpose: 'assassinate' | 'rob' | 'bewitch',
  character: CharacterId,
): void {
  const a = state.action;
  if (!a) throw new Error('행동 단계가 아닙니다');

  // 지목은 공개 선언이다 — 대상이 실제로 판에 있든 없든 기록에 남는다.
  const by = a.turn?.playerId;
  if (by !== undefined) state.log.push({ t: 'declared', by, purpose, target: character });

  if (purpose === 'assassinate') {
    a.declared.assassinTarget = character;
    const victim = holderOf(state, character);
    if (victim !== null) {
      const slot = state.players[victim]?.character;
      if (slot) slot.killed = true;
    }
    return;
  }

  if (purpose === 'bewitch') {
    a.declared.witchTarget = character;
    // 선언과 동시에 차례가 멈춘다 (howto.md:226). 멈춘 차례에는 차례 종료
    // 효과가 붙지 않으므로 suspended 로 표시해 둔다.
    if (a.turn) {
      a.turn.suspended = true;
      a.turn.stage = 'ending';
    }
    return;
  }

  a.declared.thiefTarget = character;
}

export function resolveMagicianMode(
  state: GameState,
  self: PlayerId,
  choice: Extract<Choice, { type: 'magicianMode' }>,
): void {
  const me = state.players[self];
  if (!me) throw new Error('알 수 없는 플레이어');

  if (choice.mode === 'swap') {
    const other = state.players[choice.target];
    if (!other) throw new Error('알 수 없는 교환 상대');
    const given = [...me.hand];
    const received = [...other.hand];
    me.hand = received.slice();
    other.hand = given.slice();

    state.log.push({
      t: 'handSwapped',
      by: self,
      partner: choice.target,
      given,
      received,
      givenCount: given.length,
      receivedCount: received.length,
    });
    return;
  }

  const discard = [...choice.discard];
  for (const card of discard) {
    const i = me.hand.indexOf(card);
    if (i === -1) throw new Error(`손에 없는 카드입니다: ${card}`);
    me.hand.splice(i, 1);
  }

  // 뽑기를 먼저 하고 버린 카드를 맨 아래로 보낸다. 반대로 하면 더미가 얇을 때
  // 방금 버린 카드를 그대로 다시 뽑는 일이 생긴다.
  const got = draw(state, discard.length);
  me.hand.push(...got);
  returnToBottom(state, discard);

  state.log.push({ t: 'gained', player: self, cards: got.length, reason: '마술사 교체' });
}

/**
 * 8번 캐릭터의 대상 처리.
 *
 * 장군은 **부수고**(비용은 은행에), 육군대장은 **가져온다**(비용은 주인에게).
 * 같은 질문을 쓰지만 돈이 흐르는 곳과 카드가 가는 곳이 정반대다.
 */
export function resolveRank8Target(
  state: GameState,
  self: PlayerId,
  purpose: 'destroy' | 'capture',
  target: { player: PlayerId; card: CardId } | null,
): void {
  if (!target) return;

  const owner = state.players[target.player];
  const me = state.players[self];
  if (!owner || !me) throw new Error('알 수 없는 플레이어');

  const idx = owner.city.findIndex((e) => e.card === target.card);
  const entry = owner.city[idx];
  if (!entry) throw new Error(`도시에 없는 건물입니다: ${target.card}`);

  const price =
    purpose === 'destroy'
      ? destroyPrice(state, target.player, entry)
      : (defOf(entry.card).cost ?? 0) + rank8Surcharge(state, target.player, entry);

  if (me.gold < price) throw new Error('비용이 부족합니다');
  me.gold -= price;

  const [removed] = owner.city.splice(idx, 1);
  if (!removed) throw new Error('건물을 꺼내지 못했습니다');

  if (purpose === 'destroy') {
    discardEntry(state, removed);
    state.log.push({
      t: 'destroyed',
      by: self,
      target: target.player,
      card: target.card,
      paid: price,
    });
    return;
  }

  // 점령은 파괴와 달리 상대에게 값을 치르고 내 도시로 가져온다.
  // **엔트리 통째로** 옮긴다 — 박물관 아래 깔린 카드는 박물관을 따라간다.
  owner.gold += price;
  me.city.push(removed);
  state.log.push({ t: 'captured', by: self, from: target.player, card: target.card, paid: price });
  noteCompletion(state, self);
}

export function resolveDiscardCard(
  state: GameState,
  self: PlayerId,
  source: UniqueBuildingId,
  card: CardId,
): void {
  const p = state.players[self];
  if (!p) throw new Error('알 수 없는 플레이어');
  const i = p.hand.indexOf(card);
  if (i === -1) throw new Error(`손에 없는 카드입니다: ${card}`);

  p.hand.splice(i, 1);
  returnToBottom(state, [card]);

  if (source === 'laboratory') {
    p.gold += LABORATORY_GOLD;
    state.log.push({ t: 'gained', player: self, gold: LABORATORY_GOLD, reason: '실험실' });
    return;
  }
  throw new Error(`처리할 수 없는 버리기 출처입니다: ${source}`);
}

export function resolveBuildPayment(
  state: GameState,
  self: PlayerId,
  card: CardId,
  gold: number,
  cards: readonly CardId[],
): void {
  placeBuilding(state, self, card, gold, cards);
}

/** 골조를 부수고 공짜로 한 채 짓는다. */
export function resolveFreeBuild(
  state: GameState,
  self: PlayerId,
  source: UniqueBuildingId,
  card: CardId,
): void {
  const p = state.players[self];
  if (!p) throw new Error('알 수 없는 플레이어');

  const idx = p.city.findIndex((e) => defIdOf(e.card) === source);
  if (idx === -1) throw new Error(`도시에 ${source} 이(가) 없습니다`);

  const [removed] = p.city.splice(idx, 1);
  if (removed) {
    discardEntry(state, removed);
    state.log.push({
      t: 'buildingEffect',
      player: self,
      building: source,
      effect: { kind: 'sacrificed', card: removed.card, toBuild: card },
    });
  }

  // 비용도 없고 건설 횟수에도 포함하지 않는다 (ERRATA: framework.ts 주석 참고)
  placeBuilding(state, self, card, 0, [], { countsTowardLimit: false });
}

/** 공동묘지: 건물 1채를 부수고 짓거나, 평소대로 금화를 낸다. */
export function resolveSacrificeBuild(
  state: GameState,
  self: PlayerId,
  card: CardId,
  cost: number,
  sacrifice: CardId | null,
): void {
  const p = state.players[self];
  if (!p) throw new Error('알 수 없는 플레이어');

  if (sacrifice === null) {
    placeBuilding(state, self, card, cost, []);
    return;
  }

  const idx = p.city.findIndex((e) => e.card === sacrifice);
  if (idx === -1) throw new Error(`도시에 없는 건물입니다: ${sacrifice}`);

  const [removed] = p.city.splice(idx, 1);
  if (removed) discardEntry(state, removed);

  state.log.push({
    t: 'buildingEffect',
    player: self,
    building: defIdOf(card) as UniqueBuildingId,
    effect: { kind: 'sacrificed', card: sacrifice, toBuild: card },
  });

  placeBuilding(state, self, card, 0, []);
}

/**
 * 상대 한 명을 고른 결과. 무엇을 위한 선택이었는지는 `purpose` 가 말해준다.
 *
 * 훅에 콜백을 저장해 둘 수 없으므로(상태가 직렬화 가능해야 한다), 질문에
 * 실어 보낸 purpose 만으로 갈 곳을 정한다.
 */
export function resolvePickPlayer(
  state: GameState,
  self: PlayerId,
  purpose: 'wizardTake' | 'emperorCrown' | 'abbotTax',
  target: PlayerId,
): void {
  if (purpose === 'emperorCrown') {
    giveCrown(state, self, target);
    return;
  }
  if (purpose === 'abbotTax') {
    takeTithe(state, self, target);
    return;
  }

  const turn = state.action?.turn;
  const hand = state.players[target]?.hand ?? [];
  if (!turn) throw new Error('진행 중인 차례가 없습니다');

  turn.pendingSub = { kind: 'wizardTarget', player: target };
  if (hand.length === 0) return;

  state.pending = {
    type: 'takeCard',
    player: self,
    text: `P${target} 의 손패에서 1장을 가져옵니다`,
    from: target,
    options: [...hand],
  };
}

/** 마법사: 고른 카드를 가져오고, 낼 수 있으면 바로 지을지 묻는다. */
export function resolveTakeCard(state: GameState, self: PlayerId, card: CardId): void {
  const turn = state.action?.turn;
  if (!turn) throw new Error('진행 중인 차례가 없습니다');

  const sub = turn.pendingSub;
  if (sub?.kind !== 'wizardTarget') throw new Error('가져올 상대가 정해지지 않았습니다');

  const from = state.players[sub.player];
  const me = state.players[self];
  if (!from || !me) throw new Error('알 수 없는 플레이어');

  const idx = from.hand.indexOf(card);
  if (idx === -1) throw new Error(`상대 손에 없는 카드입니다: ${card}`);
  from.hand.splice(idx, 1);
  me.hand.push(card);

  state.log.push({ t: 'tookCard', by: self, from: sub.player, card });

  turn.pendingSub = { kind: 'wizardTaken', card };

  const ctx = makeCtx(state, self);
  const cost = buildCost(state, self, defOf(card), ctx);
  if (me.gold < cost) {
    turn.pendingSub = null;
    return;
  }

  state.pending = {
    type: 'buildTaken',
    player: self,
    text: `${defOf(card).title} 을(를) 지금 지을까요? (${cost}닢, 건설 횟수에 포함되지 않음)`,
    card,
    cost,
  };
}

/** 마법사: 가져온 카드를 그 자리에서 짓는다. 건설 횟수에는 포함되지 않는다. */
export function resolveBuildTaken(state: GameState, self: PlayerId, build: boolean): void {
  const turn = state.action?.turn;
  const sub = turn?.pendingSub;
  if (turn) turn.pendingSub = null;
  if (!build || sub?.kind !== 'wizardTaken') return;

  const ctx = makeCtx(state, self);
  const cost = buildCost(state, self, defOf(sub.card), ctx);
  placeBuilding(state, self, sub.card, cost, [], { countsTowardLimit: false });
}

/** 치안판사: 영장 3장을 붙인다. 인장은 하나뿐이다. */
export function resolveWarrants(
  state: GameState,
  sealed: CharacterId,
  decoys: readonly CharacterId[],
): void {
  const a = state.action;
  if (!a) throw new Error('행동 단계가 아닙니다');

  a.declared.warrants = [
    { character: sealed, sealed: true },
    ...decoys.map((character) => ({ character, sealed: false })),
  ];

  // 어느 쪽에 인장이 있는지는 공개하지 않는다 — 셋 중 하나라는 사실만 공개다.
  state.log.push({
    t: 'warrantsIssued',
    by: a.turn?.playerId ?? (0 as PlayerId),
    characters: [sealed, ...decoys],
  });
}

/** 치안판사: 멈춰 있던 건설을 몰수하거나 그냥 통과시킨다. */
export function resolveSeize(state: GameState, magistrate: PlayerId, seize: boolean): void {
  const turn = state.action?.turn;
  const held = turn?.pendingSeizure;
  if (!turn || !held) throw new Error('멈춰 있는 건설이 없습니다');

  turn.pendingSeizure = null;
  const builder = turn.playerId;

  if (!seize) {
    // 통과 — 평소대로 짓는다. 이미 한 번 물었으므로 다시 묻지 않도록
    // paidBuilds 를 먼저 올려 canSeize 가 걸리지 않게 한다.
    turn.paidBuilds += 1;
    placeBuilding(state, builder, held.card, held.gold, held.cardsPaid);
    return;
  }

  const from = state.players[builder];
  const to = state.players[magistrate];
  if (!from || !to) throw new Error('알 수 없는 플레이어');

  // 건설비용 금화는 애초에 빠져나가지 않았다. 다만 도적 소굴처럼 카드로 낸
  // 몫은 돌려받지 못한다(howto.md 건물 상세 설명).
  const idx = from.hand.indexOf(held.card);
  if (idx === -1) throw new Error(`손에 없는 카드입니다: ${held.card}`);
  from.hand.splice(idx, 1);

  for (const paid of held.cardsPaid) {
    const i = from.hand.indexOf(paid);
    if (i !== -1) from.hand.splice(i, 1);
  }
  returnToBottom(state, held.cardsPaid);

  // 몰수당해도 건설 행동 한 번은 쓴 것으로 친다(howto.md:244).
  turn.buildsUsed += 1;
  turn.paidBuilds += 1;

  to.city.push({ card: held.card });
  state.log.push({ t: 'seized', by: magistrate, from: builder, card: held.card });
  noteCompletion(state, magistrate);
}

/** 박물관: 손패 1장을 박물관 아래로 넣는다. */
export function resolveTuckCard(state: GameState, self: PlayerId, card: CardId): void {
  const p = state.players[self];
  if (!p) throw new Error('알 수 없는 플레이어');

  const entry = p.city.find((e) => defIdOf(e.card) === 'museum');
  if (!entry) throw new Error('도시에 박물관이 없습니다');

  const i = p.hand.indexOf(card);
  if (i === -1) throw new Error(`손에 없는 카드입니다: ${card}`);
  p.hand.splice(i, 1);

  entry.beneath = [...(entry.beneath ?? []), card];
  state.log.push({
    t: 'buildingEffect',
    player: self,
    building: 'museum',
    effect: { kind: 'tucked', total: entry.beneath.length },
  });
}

/**
 * 병기고: 자신과 목표를 함께 부순다.
 *
 * 값은 어느 쪽에도 치르지 않는다. 두 채 모두 파괴이므로 카드는 더미 아래로
 * 가고, 점령처럼 누군가의 도시로 옮겨가지 않는다.
 */
export function resolveArmoryTarget(
  state: GameState,
  self: PlayerId,
  target: { player: PlayerId; card: CardId },
): void {
  const me = state.players[self];
  if (!me) throw new Error('알 수 없는 플레이어');

  const mine = me.city.findIndex((e) => defIdOf(e.card) === 'armory');
  if (mine === -1) throw new Error('도시에 병기고가 없습니다');
  const [armoryEntry] = me.city.splice(mine, 1);
  if (armoryEntry) {
    discardEntry(state, armoryEntry);
    state.log.push({ t: 'destroyed', by: self, target: self, card: armoryEntry.card, paid: 0 });
  }

  const owner = state.players[target.player];
  if (!owner) throw new Error('알 수 없는 플레이어');
  const idx = owner.city.findIndex((e) => e.card === target.card);
  if (idx === -1) throw new Error(`도시에 없는 건물입니다: ${target.card}`);

  const [removed] = owner.city.splice(idx, 1);
  if (!removed) throw new Error('건물을 꺼내지 못했습니다');
  discardEntry(state, removed);
  state.log.push({ t: 'destroyed', by: self, target: target.player, card: target.card, paid: 0 });
}

/**
 * 극장: 선택 단계가 끝날 때 캐릭터 카드를 통째로 바꾼다.
 *
 * 슬롯을 통째로 맞바꾼다 — 이 시점에는 아직 아무도 공개되거나 암살당하지
 * 않았으므로 딸려 있는 상태도 전부 초기값이다.
 */
export function resolveTheaterSwap(
  state: GameState,
  self: PlayerId,
  target: PlayerId | null,
): void {
  if (target === null) return;

  const me = state.players[self];
  const other = state.players[target];
  if (!me || !other) throw new Error('알 수 없는 플레이어');
  if (!me.character || !other.character) throw new Error('아직 캐릭터를 고르지 않았습니다');

  const mine = me.character;
  me.character = other.character;
  other.character = mine;

  state.log.push({ t: 'charactersSwapped', by: self, partner: target });
}

/**
 * 황제: 왕관을 넘기고 그 대가를 받는다.
 *
 * 암살당한 황제의 대리인은 왕관만 옮기고 대가를 받지 않는다(howto.md:308).
 * 그 구분은 **진행 중인 차례가 있는가** 로 한다 — 대리인은 라운드 종료 훅에서
 * 오므로 차례가 없다.
 */
export function giveCrown(state: GameState, emperor: PlayerId, target: PlayerId): void {
  state.crowned = target;
  state.log.push({ t: 'crownMoved', to: target, reason: '황제' });

  if (!state.action?.turn) return;

  const to = state.players[target];
  if (!to) return;

  const canGold = to.gold > 0;
  const canCard = to.hand.length > 0;

  if (canGold && canCard) {
    state.pending = {
      type: 'emperorTribute',
      player: emperor,
      text: `P${target}에게서 금화 1닢과 카드 1장 중 무엇을 가져올까요?`,
      from: target,
      canGold,
      canCard,
    };
    return;
  }
  // 한쪽뿐이면 고를 것이 없고, 둘 다 없으면 아무것도 못 가져온다.
  if (canGold) takeTribute(state, emperor, 'gold');
  else if (canCard) takeTribute(state, emperor, 'card');
}

export const EMPEROR_TRIBUTE_GOLD = 1;

/**
 * 황제가 새 왕관 주인에게서 받는 대가.
 *
 * 카드는 **무작위로** 집는다(howto.md:306). 어떤 카드였는지는 로그에 적지
 * 않는다 — 두 사람만 아는 정보이고, 장수만 적어도 무슨 일이 있었는지는 남는다.
 */
export function takeTribute(state: GameState, emperor: PlayerId, take: 'gold' | 'card'): void {
  const from = state.crowned;
  const giver = state.players[from];
  const me = state.players[emperor];
  if (!giver || !me) return;

  if (take === 'gold') {
    if (giver.gold < EMPEROR_TRIBUTE_GOLD) return;
    giver.gold -= EMPEROR_TRIBUTE_GOLD;
    me.gold += EMPEROR_TRIBUTE_GOLD;
    state.log.push({ t: 'paid', player: from, gold: EMPEROR_TRIBUTE_GOLD, reason: '황제 조공' });
    state.log.push({ t: 'gained', player: emperor, gold: EMPEROR_TRIBUTE_GOLD, reason: '황제 조공' });
    return;
  }

  const [card, rng] = pick(state.rng, giver.hand);
  state.rng = rng;
  if (card === undefined) return;

  giver.hand.splice(giver.hand.indexOf(card), 1);
  me.hand.push(card);
  state.log.push({ t: 'gained', player: emperor, cards: 1, reason: '황제 조공' });
}

/** 수도원장: 종교 건물 수만큼을 금화와 카드로 나눠 받는다. */
export function resolveAbbotIncome(
  state: GameState,
  self: PlayerId,
  gold: number,
  cards: number,
): void {
  const p = state.players[self];
  if (!p) throw new Error('알 수 없는 플레이어');

  if (gold > 0) {
    p.gold += gold;
    state.log.push({ t: 'gained', player: self, gold, reason: '세금(종교)' });
  }
  if (cards > 0) {
    const got = draw(state, cards);
    p.hand.push(...got);
    state.log.push({ t: 'gained', player: self, cards: got.length, reason: '세금(종교)' });
  }
}

/** 협박범: 토큰 2개를 붙인다. 꽃 자수는 하나뿐이다. */
export function resolveBlackmailTokens(
  state: GameState,
  sealed: CharacterId,
  decoy: CharacterId,
): void {
  const a = state.action;
  if (!a) throw new Error('행동 단계가 아닙니다');

  a.declared.blackmail = [
    { character: sealed, sealed: true },
    { character: decoy, sealed: false },
  ];

  // 어느 쪽이 꽃 자수인지는 공개하지 않는다 — 둘 중 하나라는 사실만 공개다.
  state.log.push({
    t: 'blackmailed',
    by: a.turn?.playerId ?? (0 as PlayerId),
    characters: [sealed, decoy],
  });
}

/**
 * 협박당한 플레이어의 답.
 *
 * 뇌물을 바치면 토큰은 **앞면을 보지 않고** 치워진다 — 꽃 자수였는지는
 * 끝내 아무도 모른다. 바치지 않으면 공개 여부가 협박범에게 넘어간다.
 */
export function resolveBribe(state: GameState, victim: PlayerId, pay: boolean): void {
  const token = blackmailOn(state, victim);
  if (!token) return;

  const blackmailer = holderOf(state, BLACKMAILER_ID);
  if (blackmailer === null) {
    removeToken(state, token.character);
    return;
  }

  if (pay) {
    const v = state.players[victim];
    const b = state.players[blackmailer];
    const amount = bribeAmount(v?.gold ?? 0);
    if (v && b && amount > 0) {
      v.gold -= amount;
      b.gold += amount;
      state.log.push({ t: 'paid', player: victim, gold: amount, reason: '뇌물' });
      state.log.push({ t: 'gained', player: blackmailer, gold: amount, reason: '뇌물' });
    }
    removeToken(state, token.character);
    return;
  }

  // 공개는 **선택 사항**이다 (howto.md:268). 협박범에게 넘긴다.
  state.pending = {
    type: 'revealBlackmail',
    player: blackmailer,
    text: `P${victim}가 뇌물을 거절했습니다 — 협박 토큰을 공개할까요?`,
    target: victim,
    character: token.character,
  };
}

/** 협박범: 토큰을 뒤집는다. 꽃 자수였다면 금고를 통째로 가져온다. */
export function resolveRevealBlackmail(
  state: GameState,
  blackmailer: PlayerId,
  victim: PlayerId,
  character: CharacterId,
  reveal: boolean,
): void {
  const token = state.action?.declared.blackmail.find((b) => b.character === character);
  removeToken(state, character);
  if (!reveal || !token) return;

  state.log.push({ t: 'blackmailRevealed', by: blackmailer, target: victim, sealed: token.sealed });
  if (!token.sealed) return;

  const v = state.players[victim];
  const b = state.players[blackmailer];
  if (!v || !b || v.gold <= 0) return;

  const amount = v.gold;
  v.gold = 0;
  b.gold += amount;
  state.log.push({ t: 'stolen', by: blackmailer, from: victim, gold: amount });
}
