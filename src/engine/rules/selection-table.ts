/**
 * 선택 단계의 인원수별 예외 규칙. 여기 한 곳에만 모아 둔다.
 * 출처: howto.md 59~70행 (캐릭터 8장 기준).
 */

export interface DiscardCounts {
  readonly faceUp: number;
  readonly faceDown: number;
}

/** 캐릭터 8장을 쓸 때 인원수별 버림 장수 (howto.md:59~64). */
export const DISCARD_TABLE: Readonly<Record<number, DiscardCounts>> = {
  4: { faceUp: 2, faceDown: 1 },
  5: { faceUp: 1, faceDown: 1 },
  6: { faceUp: 0, faceDown: 1 },
  7: { faceUp: 0, faceDown: 1 },
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;

/**
 * 4번 캐릭터(왕·황제·대공)는 절대로 앞면으로 버릴 수 없다 (howto.md:66).
 * 뽑히면 되돌려 섞고 다시 뽑는다.
 */
export const NEVER_FACE_UP_RANK = 4;

/**
 * 7인 게임 특수 규칙 (howto.md:70): 마지막으로 고르는 플레이어는 맨 처음
 * **뒷면으로** 버린 카드까지 2장 중 1장을 고른다. 앞면 버림이 아니다.
 */
export const LAST_PICKER_GETS_DISCARD_AT = 7;

export function discardCounts(playerCount: number): DiscardCounts {
  const row = DISCARD_TABLE[playerCount];
  if (!row) {
    throw new Error(
      `${playerCount}인 게임은 지원하지 않습니다 (기본 조합은 ${MIN_PLAYERS}~${MAX_PLAYERS}인). ` +
        `3인·8인은 9번 캐릭터가 필요하고, 2인 변형은 이번 범위 밖입니다.`,
    );
  }
  return row;
}
