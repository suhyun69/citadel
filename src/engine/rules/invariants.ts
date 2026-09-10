import { buildDeck } from '../setup';
import type { CardId } from '../types/ids';
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

  // 도시에 이름이 같은 건물이 둘 이상이면, 그것을 허용하는 효과(채석장)가 있어야 한다.
  // M1 단계에서는 효과가 없으므로 항상 위반이면 버그다.
  for (const p of state.players) {
    const titles = p.city.map((e) => e.card.split('#')[0]);
    const dupes = titles.filter((t, i) => titles.indexOf(t) !== i);
    if (dupes.length > 0 && !hasDuplicateAllowance(state, p.id)) {
      problems.push(`P${p.id} 의 도시에 동명 건물이 있습니다: ${[...new Set(dupes)].join(', ')}`);
    }
  }

  if (state.pending && state.pending.player >= state.players.length) {
    problems.push(`pending 의 대상 플레이어가 범위를 벗어났습니다: ${state.pending.player}`);
  }

  return problems;
}

function hasDuplicateAllowance(state: GameState, player: number): boolean {
  // 채석장이 도시에 있는지 확인. 구현 전 단계에서는 항상 false 다.
  return state.players[player]?.city.some((e) => e.card.startsWith('quarry#')) ?? false;
}

export function assertInvariants(state: GameState, context = ''): void {
  const problems = checkInvariants(state);
  if (problems.length === 0) return;
  throw new Error(
    `불변식 위반${context ? ` (${context})` : ''} — seed=${state.config.seed}, round=${state.round}\n` +
      problems.map((p) => `  • ${p}`).join('\n'),
  );
}
