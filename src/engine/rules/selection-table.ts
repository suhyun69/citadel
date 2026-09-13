/**
 * 선택 단계의 인원수별 예외 규칙. 여기 한 곳에만 모아 둔다.
 * 출처: howto.md 59~70행 (캐릭터 8장 기준).
 */

export interface DiscardCounts {
  readonly faceUp: number;
  readonly faceDown: number;
}

/**
 * [캐릭터 장수][플레이어 수] → 버림 장수.
 *
 * 9번 캐릭터를 쓰면 더미가 한 장 늘어 앞면 버림도 한 장씩 늘어난다
 * (howto.md:59~64, 162~168).
 */
export const DISCARD_TABLE: Readonly<Record<number, Readonly<Record<number, DiscardCounts>>>> = {
  8: {
    4: { faceUp: 2, faceDown: 1 },
    5: { faceUp: 1, faceDown: 1 },
    6: { faceUp: 0, faceDown: 1 },
    7: { faceUp: 0, faceDown: 1 },
  },
  9: {
    4: { faceUp: 3, faceDown: 1 },
    5: { faceUp: 2, faceDown: 1 },
    6: { faceUp: 1, faceDown: 1 },
    7: { faceUp: 0, faceDown: 1 },
  },
};

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 7;

/**
 * 4번 캐릭터(왕·황제·대공)는 절대로 앞면으로 버릴 수 없다 (howto.md:66).
 * 뽑히면 되돌려 섞고 다시 뽑는다.
 */
export const NEVER_FACE_UP_RANK = 4;

/**
 * 마지막으로 고르는 플레이어가 뒷면 버림 카드까지 2장 중에 고르는 인원수
 * (howto.md:70). 캐릭터가 한 장 늘면 이 인원수도 한 명 늘어난다.
 */
export const LAST_PICKER_GETS_DISCARD_AT: Readonly<Record<number, number>> = { 8: 7, 9: 8 };

export function discardCounts(characterCount: number, playerCount: number): DiscardCounts {
  const row = DISCARD_TABLE[characterCount]?.[playerCount];
  if (!row) {
    throw new Error(
      `캐릭터 ${characterCount}장 / ${playerCount}인 조합은 지원하지 않습니다 ` +
        `(${MIN_PLAYERS}~${MAX_PLAYERS}인). 3인·8인 게임과 2인 변형은 이번 범위 밖입니다.`,
    );
  }
  return row;
}
