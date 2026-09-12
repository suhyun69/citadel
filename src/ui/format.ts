import { KIND_LABEL_KO, characterDef, type BuildingKind, type CharacterId } from '@/data/types';
import { defOf, titleOf, type CardId } from '@/engine/state/ids';
import type { GameEvent } from '@/engine/state/event';

export const characterName = (id: CharacterId): string => characterDef(id).name;

/** 종류의 한글 이름. 데이터 레이어의 정의를 그대로 쓴다. */
export const KIND_LABEL = KIND_LABEL_KO;

export const kindOf = (card: CardId): BuildingKind => defOf(card).kind;
export const costOf = (card: CardId): number => defOf(card).cost ?? 0;
export const cardTitle = titleOf;

export interface FormattedEvent {
  /** 행동 주체. 있으면 줄 맨 앞에 `P0` 으로 붙는다. */
  actor?: number;
  /** 무슨 행동인지. 대괄호로 감싸 표시한다. */
  tag?: string;
  /** 그 행동의 내용. */
  detail: string;
  /** 들여쓰기 깊이. 0=라운드, 1=순번, 2=행동 */
  depth: 0 | 1 | 2;
  tone?: 'good' | 'bad' | 'note';
}

/** 한 줄로 합친 문자열. `P1 [건설] 병영 (3닢)` */
export function lineOf(e: FormattedEvent): string {
  const head = e.actor === undefined ? '' : `P${e.actor} `;
  const tag = e.tag ? `[${e.tag}] ` : '';
  return `${head}${tag}${e.detail}`;
}

/**
 * 이벤트 하나를 사람이 읽는 한 줄로. 관전 로그와 CLI 가 함께 쓴다.
 *
 * 문구는 `P0 [행동] 내용` 으로 통일한다 — 무슨 일이 있었는지가 대괄호 안에
 * 먼저 오므로, 긴 로그를 훑을 때 눈이 행동 종류를 따라갈 수 있다.
 */
export function formatEvent(e: GameEvent): FormattedEvent | null {
  switch (e.t) {
    case 'roundStart':
      return { detail: `라운드 ${e.round} · 왕관 P${e.crowned}`, depth: 0 };

    case 'charactersDiscarded':
      return {
        tag: '버림',
        detail: e.faceUp.length
          ? `${e.faceUp.map(characterName).join(', ')} (+뒷면 ${e.faceDownCount})`
          : `뒷면 ${e.faceDownCount}장`,
        depth: 1,
        tone: 'note',
      };

    case 'characterPicked':
      // 관전은 전지적 시점이라 보여준다. 사람이 참여하는 화면에서는
      // redactEvent 가 남의 선택을 이미 걸러낸다.
      return { actor: e.player, tag: '선택', detail: characterName(e.character), depth: 1, tone: 'note' };

    case 'rankCalled':
      return { detail: `${e.rank}번 호명`, depth: 1 };

    case 'rankAbsent':
      return { detail: '아무도 없음', depth: 2, tone: 'note' };

    case 'characterRevealed':
      return { actor: e.player, detail: `— ${characterName(e.character)}`, depth: 2 };

    case 'declared':
      return {
        actor: e.by,
        tag: e.purpose === 'assassinate' ? '암살' : '절도',
        detail: `→ ${characterName(e.target)}`,
        depth: 2,
        tone: 'bad',
      };

    case 'skipped':
      return { actor: e.player, tag: '암살당함', detail: '차례를 쉼', depth: 2, tone: 'bad' };

    case 'gained':
      return {
        actor: e.player,
        tag: e.reason,
        detail: e.gold ? `+금화 ${e.gold}` : `+카드 ${e.cards}`,
        depth: 2,
        tone: 'good',
      };

    case 'paid':
      return { actor: e.player, tag: e.reason, detail: `−금화 ${e.gold}`, depth: 2 };

    case 'built':
      return {
        actor: e.player,
        tag: '건설',
        detail: `${cardTitle(e.card)} (${e.paid}닢)`,
        depth: 2,
        tone: 'good',
      };

    case 'destroyed':
      return {
        actor: e.by,
        tag: '파괴',
        detail: `P${e.target} 의 ${cardTitle(e.card)} (${e.paid}닢)`,
        depth: 2,
        tone: 'bad',
      };

    case 'stolen':
      return {
        actor: e.by,
        tag: '강탈',
        detail: `P${e.from} 에게서 금화 ${e.gold}닢`,
        depth: 2,
        tone: 'bad',
      };

    case 'crownMoved':
      return { actor: e.to, tag: '왕관', detail: e.reason, depth: 2, tone: 'note' };

    case 'deckExhausted':
      return { tag: '더미 고갈', detail: `${e.wanted}장 중 ${e.got}장`, depth: 2, tone: 'note' };

    case 'cityCompleted':
      return {
        actor: e.player,
        tag: '도시 완성',
        detail: e.first ? '최초' : '',
        depth: 2,
        tone: 'good',
      };

    case 'roundEnd':
      return null;

    case 'gameOver':
      return { detail: `게임 종료 · 승자 P${e.winner}`, depth: 0, tone: 'good' };

    default:
      return null;
  }
}
