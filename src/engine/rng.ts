/**
 * 결정론적 난수. mulberry32 — 상태가 uint32 하나라 GameState 에 그대로 담긴다.
 *
 * 엔진 어디에서도 Math.random() 을 부르지 않는다(eslint 로 강제). 그래야
 * "시드 + 선택 로그 = 완전 재현" 이 성립하고, 봇 대전에서 버그를 만났을 때
 * 시드만으로 그 판을 그대로 되살릴 수 있다.
 */
export type RngState = number & { readonly __brand: 'RngState' };

export const seedRng = (seed: number): RngState => (seed >>> 0) as RngState;

function next(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const s = t as RngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

/** [0, maxExclusive) 정수. maxExclusive <= 0 이면 0 을 준다. */
export function nextInt(state: RngState, maxExclusive: number): [number, RngState] {
  if (maxExclusive <= 0) return [0, state];
  const [f, s] = next(state);
  return [Math.floor(f * maxExclusive), s];
}

/** Fisher-Yates. 원본을 건드리지 않는다. */
export function shuffle<T>(state: RngState, items: readonly T[]): [T[], RngState] {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    let j: number;
    [j, s] = nextInt(s, i + 1);
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return [out, s];
}

/** 무작위 원소 하나. 빈 배열이면 undefined. */
export function pick<T>(state: RngState, items: readonly T[]): [T | undefined, RngState] {
  if (items.length === 0) return [undefined, state];
  const [i, s] = nextInt(state, items.length);
  return [items[i], s];
}
