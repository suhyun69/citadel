import type { Clock } from '@/runtime/runner';

/** 관전 중단 신호. runMatch 루프를 밖에서 끊기 위한 것이다. */
export class Aborted extends Error {
  constructor() {
    super('관전이 중단되었습니다');
    this.name = 'Aborted';
  }
}

/**
 * 스로틀링되지 않는 양보(yield).
 *
 * `setTimeout(fn, 0)` 은 중첩되면 4ms 로 클램프되고, 탭이 백그라운드로 가면
 * 1초까지 늘어난다. MessageChannel 은 그 제한을 받지 않으므로 "즉시" 속도가
 * 실제로 즉시가 된다. 매크로태스크라 브라우저가 중간에 화면을 그릴 수도 있다.
 */
function yieldToBrowser(): Promise<void> {
  if (typeof MessageChannel !== 'function') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

/**
 * 재생/일시정지/한 스텝을 가진 Clock.
 *
 * 엔진에는 setTimeout 이 없다. 속도 조절은 전부 여기서 일어나고,
 * 테스트는 즉시 해소되는 Clock 을 대신 넣는다.
 */
export class Pacer implements Clock {
  paused = false;
  speedMs = 450;
  aborted = false;

  #release: (() => void) | null = null;

  delay(): Promise<void> {
    if (this.aborted) return Promise.resolve();
    if (this.paused) {
      return new Promise<void>((resolve) => {
        this.#release = resolve;
      });
    }
    if (this.speedMs <= 0) return yieldToBrowser();
    return new Promise<void>((resolve) => setTimeout(resolve, this.speedMs));
  }

  /** 일시정지 상태에서 결정 하나만 진행시킨다. */
  stepOnce(): void {
    const release = this.#release;
    this.#release = null;
    release?.();
  }

  play(): void {
    this.paused = false;
    this.stepOnce();
  }

  pause(): void {
    this.paused = true;
  }

  abort(): void {
    this.aborted = true;
    this.paused = false;
    this.stepOnce();
  }
}
