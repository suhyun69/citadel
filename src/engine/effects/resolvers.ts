import type { CharacterId } from '@/data/types';
import { draw, returnToBottom } from '../rules/deck';
import { destroyPrice } from '../rules/rank8';
import type { Choice } from '../state/prompt';
import type { CardId, PlayerId } from '../state/ids';
import type { GameState } from '../state/game-state';
import { holderOf } from './characters/_shared';
import { LABORATORY_GOLD } from './buildings/laboratory';
import { placeBuilding } from '../flow/turn';
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
  purpose: 'assassinate' | 'rob',
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
    const mine = me.hand;
    me.hand = other.hand;
    other.hand = mine;
    state.log.push({ t: 'gained', player: self, cards: me.hand.length, reason: '마술사 손패 교환' });
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

  state.log.push({ t: 'gained', player: self, cards: got.length, reason: '마술사 카드 교체' });
}

export function resolveWarlordTarget(
  state: GameState,
  self: PlayerId,
  target: { player: PlayerId; card: CardId } | null,
): void {
  if (!target) return;

  const owner = state.players[target.player];
  const me = state.players[self];
  if (!owner || !me) throw new Error('알 수 없는 플레이어');

  const idx = owner.city.findIndex((e) => e.card === target.card);
  if (idx === -1) throw new Error(`도시에 없는 건물입니다: ${target.card}`);

  const price = destroyPrice(target.card);
  if (me.gold < price) throw new Error('파괴비용이 부족합니다');

  me.gold -= price;
  const [removed] = owner.city.splice(idx, 1);
  if (removed) returnToBottom(state, [removed.card]);

  state.log.push({ t: 'destroyed', by: self, target: target.player, card: target.card, paid: price });
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
