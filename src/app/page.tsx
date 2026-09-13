'use client';

import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '@/engine/rules/selection-table';
import { ALL_PRESETS, characterDef, presetDef, type PresetId } from '@/data/types';
import { CharacterTrack } from '@/ui/components/CharacterTrack';
import { EventLog } from '@/ui/components/EventLog';
import { PlayerBoards } from '@/ui/components/PlayerBoards';
import { ScorePanel } from '@/ui/components/ScorePanel';
import { useMatch } from '@/ui/useMatch';

const SPEEDS = [
  { label: '느리게', ms: 900 },
  { label: '보통', ms: 450 },
  { label: '빠르게', ms: 150 },
  { label: '즉시', ms: 0 },
];

export default function WatchPage() {
  const { controller, snapshot } = useMatch();
  const { state, setup, paused, running, speedMs } = snapshot;

  const [seed, setSeed] = useState(setup.seed);
  const [playerCount, setPlayerCount] = useState(setup.playerCount);
  const [botKind, setBotKind] = useState(setup.botKind);
  const [presetId, setPresetId] = useState<PresetId>(setup.presetId);
  const [useRank9, setUseRank9] = useState(setup.useRank9);
  const [error, setError] = useState<string | null>(null);

  const chosen = presetDef(presetId);
  const preset = presetDef(state.config.presetId);
  const finished = state.phase === 'finished';

  const start = () => {
    try {
      controller.start({ seed, playerCount, botKind, presetId, useRank9 });
      setError(null);
    } catch (err) {
      // 왕비가 5명 미만 게임에 들어가는 등, 규칙이 막는 조합이 있다.
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="page">
      <header className="top">
        <h1>시타델 — 봇 대전 관전</h1>
        <span className="sub">
          {preset.name} · 캐릭터 {state.config.characterIds.length}장 · 덱{' '}
          {54 + state.config.uniqueBuildingIds.length}장
        </span>
      </header>

      <div className="controls">
        <label>
          조합
          <select
            value={presetId}
            onChange={(e) => {
              setPresetId(e.target.value as PresetId);
              setUseRank9(false);
            }}
          >
            {ALL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {chosen.rank9 ? (
          <label title={`9번 캐릭터 ${characterDef(chosen.rank9).name} 를 넣습니다`}>
            <input
              type="checkbox"
              checked={useRank9}
              onChange={(e) => setUseRank9(e.target.checked)}
            />
            {characterDef(chosen.rank9).name}
          </label>
        ) : null}

        <label>
          시드
          <input
            type="number"
            value={seed}
            min={0}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>

        <label>
          인원
          <select value={playerCount} onChange={(e) => setPlayerCount(Number(e.target.value))}>
            {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i).map(
              (n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          봇
          <select value={botKind} onChange={(e) => setBotKind(e.target.value)}>
            <option value="normal">보통</option>
            <option value="easy">쉬움</option>
            <option value="random">무작위</option>
          </select>
        </label>

        <button className="primary" onClick={start}>
          새 판 시작
        </button>

        <span className="spacer" />

        <button onClick={() => controller.toggle()} disabled={!running}>
          {paused ? '재생' : '일시정지'}
        </button>
        <button onClick={() => controller.stepOnce()} disabled={!running}>
          한 스텝
        </button>

        <label>
          속도
          <select value={speedMs} onChange={(e) => controller.setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s.ms} value={s.ms}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="layout">
        <div>
          <PlayerBoards state={state} />
          {finished ? <ScorePanel state={state} /> : null}
        </div>

        <div>
          <CharacterTrack state={state} />
          <EventLog log={state.log} />
        </div>
      </div>
    </div>
  );
}
