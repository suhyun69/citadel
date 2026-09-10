import type { BuildingDefId } from '@/data/types';
import { buildingDef } from '@/data/types';

/** 좌석 index (0-based). 시계 방향 순서이기도 하다. */
export type PlayerId = number & { readonly __brand: 'PlayerId' };
export const playerId = (n: number): PlayerId => n as PlayerId;

/**
 * 실물 카드 1장. `${BuildingDefId}#${n}` 형식이다.
 *
 * 기본 건물은 동명 카드가 여러 장이라(사원 3장, 저택 5장) "정의"와 "실물"을
 * 구분해야 하는데, 카드에 고유 상태가 없으므로 별도 인스턴스 테이블 대신
 * ID 문자열에 인코딩한다. 덕분에 덱 전체가 `CardId[]` 하나로 표현되고
 * JSON 스냅샷을 사람이 읽을 수 있다.
 */
export type CardId = string & { readonly __brand: 'CardId' };

export const cardId = (def: BuildingDefId, copy: number): CardId => `${def}#${copy}` as CardId;

export function defIdOf(card: CardId): BuildingDefId {
  const hash = card.indexOf('#');
  return (hash === -1 ? card : card.slice(0, hash)) as BuildingDefId;
}

export const defOf = (card: CardId) => buildingDef(defIdOf(card));

/** 카드의 표시 이름(한글). 로그와 UI 에 쓴다. */
export const titleOf = (card: CardId): string => defOf(card).title;
