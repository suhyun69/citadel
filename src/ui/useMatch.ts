'use client';

import { useState, useSyncExternalStore } from 'react';
import { MatchController, type Snapshot } from './match-controller';

/**
 * 컨트롤러는 `useState` 의 지연 초기화로 만든다.
 *
 * `useMemo` 는 캐시일 뿐이라 React 가 값을 버리고 다시 만들 수 있다. 그러면
 * 속도 변경은 옛 인스턴스로, 시작 버튼은 새 인스턴스로 가서 조작이 조용히
 * 어긋난다. 인스턴스 동일성이 필요한 값은 상태로 들고 있어야 한다.
 */
export function useMatch(): { controller: MatchController; snapshot: Snapshot } {
  const [controller] = useState(() => new MatchController());
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return { controller, snapshot };
}
