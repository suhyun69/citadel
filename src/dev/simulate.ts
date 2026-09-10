/**
 * 헤드리스 봇 대전 시뮬레이터.
 *
 *   npm run sim -- --seed 0 --players 4 --verbose
 *   npm run sim -- --seeds 200 --players 4,5,6,7
 *
 * UI 없이 엔진을 돌려보는 곳이다. 능력이 아직 stub 이어도 완주해야 한다.
 */
import { RandomAgent } from '@/bot/random';
import { missingCards } from '@/engine/effects/registry';
import { createMatchUnchecked, matchConfig } from '@/engine/setup';
import { titleOf } from '@/engine/types/ids';
import type { GameEvent } from '@/engine/types/event';
import type { GameState } from '@/engine/types/state';
import { runMatch, seatAgents } from '@/runtime/runner';
import { buildingDef, characterDef, presetDef, type PresetId } from '@/data/types';

interface Args {
  seed: number;
  seeds: number;
  players: number[];
  verbose: boolean;
  preset: PresetId;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  return {
    seed: Number(get('--seed') ?? 0),
    seeds: Number(get('--seeds') ?? 1),
    players: (get('--players') ?? '4').split(',').map(Number),
    verbose: argv.includes('--verbose'),
    preset: (get('--preset') ?? 'basic') as PresetId,
  };
}

function describe(e: GameEvent): string {
  switch (e.t) {
    case 'roundStart':
      return `\n── 라운드 ${e.round} (왕관: P${e.crowned})`;
    case 'charactersDiscarded':
      return `   버림: 앞면 [${e.faceUp.map((c) => characterDef(c).name).join(', ')}], 뒷면 ${e.faceDownCount}장`;
    case 'rankCalled':
      return `  ${e.rank}번 호명`;
    case 'rankAbsent':
      return `    (아무도 없음)`;
    case 'characterRevealed':
      return `    P${e.player} = ${characterDef(e.character).name}`;
    case 'skipped':
      return `    P${e.player} 암살당해 차례를 쉽니다`;
    case 'gained':
      return `    P${e.player} +${e.gold ? `금화 ${e.gold}` : `카드 ${e.cards}`} (${e.reason})`;
    case 'built':
      return `    P${e.player} 건설: ${titleOf(e.card)} (${e.paid}닢)`;
    case 'destroyed':
      return `    P${e.by} 가 P${e.target} 의 ${titleOf(e.card)} 파괴 (${e.paid}닢)`;
    case 'stolen':
      return `    P${e.by} 가 P${e.from} 에게서 금화 ${e.gold}닢 강탈`;
    case 'crownMoved':
      return `    왕관 → P${e.to} (${e.reason})`;
    case 'deckExhausted':
      return `    ⚠ 더미 고갈: ${e.wanted}장 요청, ${e.got}장 획득`;
    case 'cityCompleted':
      return `    ★ P${e.player} 도시 완성${e.first ? ' (최초!)' : ''}`;
    case 'gameOver':
      return `\n게임 종료 — 승자 P${e.winner}`;
    default:
      return '';
  }
}

function report(state: GameState): void {
  const r = state.result;
  if (!r) return;
  console.log('\n점수');
  for (const s of [...r.scores].sort((a, b) => b.total - a.total)) {
    const p = state.players[s.player];
    console.log(
      `  P${s.player}  총 ${String(s.total).padStart(2)}점  ` +
        `(건물 ${s.buildingCost} + 5종 ${s.allKindsBonus} + 완성 ${s.completionBonus} + 특수 ${s.uniqueBonus})  ` +
        `도시 ${p?.city.length ?? 0}채, 금화 ${p?.gold ?? 0}닢`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const preset = presetDef(args.preset);
  const missing = missingCards(preset);

  if (missing.characters.length || missing.uniques.length) {
    console.log(
      `⚠ "${preset.name}" 에 아직 효과가 없는 카드가 있습니다 — 골격만 검증합니다.\n` +
        `   캐릭터: ${missing.characters.map((c) => characterDef(c).name).join(', ') || '없음'}\n` +
        `   특수 건물: ${missing.uniques.map((u) => buildingDef(u).title).join(', ') || '없음'}\n`,
    );
  }

  let games = 0;
  let totalRounds = 0;
  const started = Date.now();

  for (const playerCount of args.players) {
    for (let i = 0; i < args.seeds; i++) {
      const seed = args.seed + i;
      const config = matchConfig({ seed, playerCount, presetId: args.preset });
      const state = createMatchUnchecked(config);
      const agents = seatAgents(
        Array.from({ length: playerCount }, (_, n) => new RandomAgent(`bot${n}`, seed * 100 + n)),
      );

      const final = await runMatch(state, agents, { verifyInvariants: true });
      games += 1;
      totalRounds += final.round;

      if (args.verbose) {
        for (const e of final.log) {
          const line = describe(e);
          if (line) console.log(line);
        }
        report(final);
      }
    }
  }

  const ms = Date.now() - started;
  console.log(
    `\n${games}판 완주 — 평균 ${(totalRounds / games).toFixed(1)}라운드, ${ms}ms (판당 ${(ms / games).toFixed(1)}ms)`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
