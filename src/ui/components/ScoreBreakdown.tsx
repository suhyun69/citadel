'use client';

import { useEffect } from 'react';
import { buildingDef } from '@/data/types';
import { explainScore } from '@/engine';
import { defIdOf, type PlayerId } from '@/engine/state/ids';
import type { GameState } from '@/engine/state/game-state';
import { KIND_LABEL, cardTitle, characterName } from '../format';

/** 한 줄짜리 항목. 값이 0이어도 왜 0인지 보여준다. */
function Section({
  title,
  points,
  children,
}: {
  title: string;
  points: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="bd-section">
      <div className="bd-head">
        <span className="bd-title">{title}</span>
        <span className={`bd-points ${points === 0 ? 'zero' : ''}`}>{points}</span>
      </div>
      {children ? <div className="bd-body">{children}</div> : null}
    </div>
  );
}

/**
 * 점수가 어떻게 나왔는지 풀어 보여준다.
 *
 * 총점만으로는 특수 건물이 무슨 일을 했는지 알 수 없다 — 특히 유령 지구는
 * 어떤 종류로 계산됐느냐에 따라 5종 보너스와 소원의 우물이 함께 움직인다.
 */
export function ScoreBreakdown({
  state,
  player,
  onClose,
}: {
  state: GameState;
  player: PlayerId;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const x = explainScore(state, player);
  const hasGhost = x.buildings.some((b) => defIdOf(b.card) === 'ghost_district');

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`P${player} 점수 계산 내역`}
      >
        <header className="bd-top">
          <span className="bd-who">P{player} 점수 계산</span>
          <span className="bd-total">{x.total}점</span>
          <button className="bd-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <Section title="건물 건설비용" points={x.buildingCost}>
          {x.buildings.length === 0 ? (
            <span className="muted">건물 없음</span>
          ) : (
            <div className="bd-cards">
              {/* 타일 색은 원래 종류가 아니라 **점수 계산에 쓰인 종류**다 —
                  유령 지구를 군사로 셌다면 여기서도 군사로 보여야 설명이 어긋나지 않는다. */}
              {x.buildings.map((b) => (
                <span key={b.card} className={`tile ${b.kind}`}>
                  {cardTitle(b.card)}
                  <span className="c">{b.cost}</span>
                </span>
              ))}
            </div>
          )}
        </Section>

        <Section title="5종 보너스" points={x.allKindsBonus}>
          <div className="bd-kinds">
            {x.kindsPresent.map((k) => (
              <span key={k} className={`tile ${k}`}>
                {KIND_LABEL[k]}
              </span>
            ))}
            {x.kindsMissing.map((k) => (
              <span key={k} className="tile missing">
                {KIND_LABEL[k]}
              </span>
            ))}
          </div>
          <span className="muted">
            {x.kindsMissing.length === 0
              ? '다섯 종류를 모두 갖춰 3점'
              : `${x.kindsMissing.map((k) => KIND_LABEL[k]).join('·')} 이(가) 없어 0점`}
          </span>
        </Section>

        <Section title="도시 완성" points={x.completion.points}>
          <span className="muted">
            {!x.completion.completed
              ? '도시를 완성하지 못함'
              : x.completion.first
                ? '가장 먼저 완성 — 4점'
                : '완성 — 2점'}
          </span>
        </Section>

        <Section title="특수 건물" points={x.uniqueBonus}>
          {x.items.length === 0 ? (
            <span className="muted">점수를 주는 특수 건물 없음</span>
          ) : (
            <ul className="bd-items">
              {x.items.map((item, i) => {
                const name =
                  item.kind === 'building'
                    ? buildingDef(item.building).title
                    : characterName(item.character);
                const text = item.kind === 'building' ? buildingDef(item.building).text : '';
                return (
                  <li key={i}>
                    <div className="bd-item-head">
                      <span>{name}</span>
                      <span className={item.points === 0 ? 'zero' : ''}>+{item.points}</span>
                    </div>
                    {text ? <div className="muted">{text}</div> : null}
                  </li>
                );
              })}
            </ul>
          )}

          {hasGhost ? (
            <div className="bd-note">
              유령 지구를{' '}
              <b>{x.wildcardAs ? KIND_LABEL[x.wildcardAs] : '특수'}</b> 건물로 계산했습니다
              {x.wildcardAs ? ' — 그만큼 특수 건물 수에서는 빠집니다.' : '.'}
            </div>
          ) : null}
        </Section>
      </div>
    </div>
  );
}
