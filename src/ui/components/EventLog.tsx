'use client';

import { memo, useEffect, useRef } from 'react';
import type { GameEvent } from '@/engine/types/event';
import { formatEvent } from '../format';

const Row = memo(function Row({ event }: { event: GameEvent }) {
  const f = formatEvent(event);
  if (!f) return null;
  return <div className={`row d${f.depth} ${f.tone ?? ''}`}>{f.text}</div>;
});

export function EventLog({ log }: { log: readonly GameEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div className="panel">
      <h2>진행 기록</h2>
      <div className="log" ref={ref}>
        {log.map((e, i) => (
          <Row key={i} event={e} />
        ))}
      </div>
    </div>
  );
}
