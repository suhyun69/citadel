import { buildDeck } from '../setup';
import { defIdOf, type CardId } from '../types/ids';
import type { GameState, MatchConfig } from '../types/state';

/**
 * 개발 모드에서 매 step 마다 검사하는 불변식.
 *
 * 카드 총량 보존이 가장 강력한 그물이다. 기본 조합의 덱은 68장이고, 그
 * 68장은 언제나 더미·손패·도시·(자원 얻기로 뽑아 아직 고르지 않은 카드)
 * 넷 중 어딘가에 정확히 한 번 있어야 한다. 카드를 잃어버리거나 복제하는
 * 버그를 즉시 잡는다.
 *
 * ⚠️ 금화 총량은 불변식이 아니다 — 은행 금화는 무제한이다(howto.md:107).
 */
/** 덱 크기는 config 마다 고정이다. 매 스텝 재구성하지 않는다. */
const deckSizeCache = new WeakMap<MatchConfig, number>();

function expectedDeckSize(config: MatchConfig): number {
  let n = deckSizeCache.get(config);
  if (n === undefined) {
    n = buildDeck(config).length;
    deckSizeCache.set(config, n);
  }
  return n;
}

export function checkInvariants(state: GameState): string[] {
  const problems: string[] = [];
  const expectedTotal = expectedDeckSize(state.config);

  const seen = new Map<CardId, string>();
  const note = (card: CardId, where: string): void => {
    const prev = seen.get(card);
    if (prev) problems.push(`카드 ${card} 가 ${prev} 와 ${where} 양쪽에 있습니다`);
    else seen.set(card, where);
  };

  state.deck.forEach((c) => note(c, '더미'));
  for (const p of state.players) {
    p.hand.forEach((c) => note(c, `P${p.id} 손패`));
    p.city.forEach((e) => note(e.card, `P${p.id} 도시`));
    if (p.gold < 0) problems.push(`P${p.id} 의 금화가 음수입니다 (${p.gold})`);
  }
  const drawn = state.action?.turn?.drawn;
  if (drawn) drawn.forEach((c) => note(c, '뽑아둔 카드'));

  if (seen.size !== expectedTotal) {
    problems.push(`카드 총량이 ${seen.size}장입니다 (기대 ${expectedTotal}장)`);
  }

  // 동명 건물은 채석장이 있어야 지을 수 있다. 다만 "지금 채석장이 있는가" 로는
  // 판정할 수 없다 — 채석장으로 합법적으로 지은 뒤 장군이 채석장을 파괴하면
  // 동명 건물만 남기 때문이다. 최종 상태만 보는 검사가 답할 수 있는 것은
  // "이 게임의 카드 구성에 채석장이 아예 없는데 동명 건물이 있는가" 까지다.
  if (!state.config.uniqueBuildingIds.includes('quarry')) {
    for (const p of state.players) {
      const titles = p.city.map((e) => defIdOf(e.card));
      const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
      if (dupes.length > 0) {
        problems.push(`P${p.id} 의 도시에 동명 건물이 있습니다: ${[...new Set(dupes)].join(', ')}`);
      }
    }
  }

  if (state.pending && state.pending.player >= state.players.length) {
    problems.push(`pending 의 대상 플레이어가 범위를 벗어났습니다: ${state.pending.player}`);
  }

  return problems;
}

export function assertInvariants(state: GameState, context = ''): void {
  const problems = checkInvariants(state);
  if (problems.length === 0) return;
  throw new Error(
    `불변식 위반${context ? ` (${context})` : ''} — seed=${state.config.seed}, ` +
      `players=${state.config.playerCount}, round=${state.round}\n` +
      problems.map((p) => `  • ${p}`).join('\n'),
  );
}
