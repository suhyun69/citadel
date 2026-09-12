import { characterDef, type CharacterId } from '@/data/types';
import { defOf, titleOf, type CardId } from '@/engine/state/ids';
import type { GameEvent } from '@/engine/state/event';
import type { BuildingKind } from '@/data/types';

export const characterName = (id: CharacterId): string => characterDef(id).name;

export const KIND_LABEL: Record<BuildingKind, string> = {
  religious: '종교',
  military: '군사',
  noble: '귀족',
  trade: '상업',
  unique: '특수',
};

export const kindOf = (card: CardId): BuildingKind => defOf(card).kind;
export const costOf = (card: CardId): number => defOf(card).cost ?? 0;
export const cardTitle = titleOf;

export interface FormattedEvent {
  text: string;
  /** 들여쓰기 깊이. 0=라운드, 1=순번, 2=행동 */
  depth: 0 | 1 | 2;
  tone?: 'good' | 'bad' | 'note';
}

/** 이벤트 하나를 사람이 읽는 한 줄로. 관전 로그와 CLI 가 함께 쓴다. */
export function formatEvent(e: GameEvent): FormattedEvent | null {
  switch (e.t) {
    case 'roundStart':
      return { text: `라운드 ${e.round} · 왕관 P${e.crowned}`, depth: 0 };
    case 'charactersDiscarded':
      return {
        text: e.faceUp.length
          ? `버림: ${e.faceUp.map(characterName).join(', ')} (+뒷면 ${e.faceDownCount})`
          : `뒷면으로 ${e.faceDownCount}장 버림`,
        depth: 1,
        tone: 'note',
      };
    case 'characterPicked':
      // 관전은 전지적 시점이라 보여준다. 사람이 참여하는 화면에서는
      // redactEvent 가 남의 선택을 이미 걸러낸다.
      return { text: `P${e.player} 선택 ${characterName(e.character)}`, depth: 1, tone: 'note' };
    case 'rankCalled':
      return { text: `${e.rank}번 호명`, depth: 1 };
    case 'rankAbsent':
      return { text: '아무도 없음', depth: 2, tone: 'note' };
    case 'characterRevealed':
      return { text: `P${e.player} — ${characterName(e.character)}`, depth: 2 };
    case 'skipped':
      return { text: `P${e.player} 암살당해 차례를 쉼`, depth: 2, tone: 'bad' };
    case 'gained':
      return {
        text: `P${e.player} +${e.gold ? `금화 ${e.gold}` : `카드 ${e.cards}`} · ${e.reason}`,
        depth: 2,
        tone: 'good',
      };
    case 'paid':
      return { text: `P${e.player} −금화 ${e.gold} · ${e.reason}`, depth: 2 };
    case 'built':
      return { text: `P${e.player} 건설 ${cardTitle(e.card)} (${e.paid}닢)`, depth: 2, tone: 'good' };
    case 'destroyed':
      return {
        text: `P${e.by} → P${e.target} ${cardTitle(e.card)} 파괴 (${e.paid}닢)`,
        depth: 2,
        tone: 'bad',
      };
    case 'stolen':
      return { text: `P${e.by} ← P${e.from} 금화 ${e.gold}닢 강탈`, depth: 2, tone: 'bad' };
    case 'crownMoved':
      return { text: `왕관 → P${e.to} (${e.reason})`, depth: 2, tone: 'note' };
    case 'deckExhausted':
      return { text: `더미 고갈: ${e.wanted}장 중 ${e.got}장`, depth: 2, tone: 'note' };
    case 'cityCompleted':
      return { text: `P${e.player} 도시 완성${e.first ? ' (최초)' : ''}`, depth: 2, tone: 'good' };
    case 'roundEnd':
      return null;
    case 'gameOver':
      return { text: `게임 종료 · 승자 P${e.winner}`, depth: 0, tone: 'good' };
    default:
      return null;
  }
}
