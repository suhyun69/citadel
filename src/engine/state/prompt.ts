import type { CharacterId, UniqueBuildingId } from '@/data/types';
import type { CardId, PlayerId } from './ids';

/**
 * 차례 중 고를 수 있는 행동. 차례를 "메뉴 루프"로 표현한 것이다.
 *
 * 규칙서는 "능력 사용 시점이 정해져 있지 않다면 자기 차례 중 아무 때나"
 * 라고 한다(howto.md:215). 메뉴 루프는 이걸 자연스럽게 담는다 — 주교가
 * 건설 전/후 어느 쪽에서든 수입을 받고, 상인이 언제든 능력을 쓴다.
 */
export type MainAction =
  | { readonly t: 'build'; readonly card: CardId }
  /**
   * 캐릭터 능력. `ability` 는 카드가 스스로 정의하는 키다 — 한 캐릭터가 능력을
   * 둘 이상 가질 수 있기 때문에 필요하다(장군은 수입과 파괴가 별개다).
   * 충돌을 막기 위해 `'warlord.destroy'` 처럼 카드 이름을 앞에 붙인다.
   */
  | { readonly t: 'useAbility'; readonly ability: string }
  | { readonly t: 'useBuilding'; readonly building: UniqueBuildingId }
  | { readonly t: 'endTurn' };

/**
 * 게임 마스터가 던지는 질문(`d`)과 플레이어가 돌려주는 답(`c`)을 타입 레벨에서
 * 쌍으로 묶는다. 여기에 항목을 추가하면 선택지 열거·승인·적용 세 곳의 switch 가
 * 전부 컴파일 에러를 내므로, 어느 하나를 빠뜨릴 수 없다.
 */
export interface PromptMap {
  /** 선택 단계: 돌아온 캐릭터 더미에서 1장 고르기 */
  selectCharacter: {
    d: { options: readonly CharacterId[]; poolSize: number };
    c: { characterId: CharacterId };
  };
  /** 자원 얻기 행동 (필수) */
  gatherMode: {
    d: { goldAmount: number; drawCount: number };
    c: { mode: 'gold' | 'cards' };
  };
  /** 뽑은 카드 중 보유할 것 고르기. 도서관이 있으면 keep === drawn.length */
  keepDrawn: {
    d: { drawn: readonly CardId[]; keep: number };
    c: { keep: readonly CardId[] };
  };
  /** 차례 메뉴. options 에는 항상 endTurn 이 들어 있다. */
  mainAction: {
    d: { options: readonly MainAction[] };
    c: { action: MainAction };
  };
  /** 암살자 / 도둑의 캐릭터 지목 */
  namedCharacter: {
    d: { purpose: 'assassinate' | 'rob'; options: readonly CharacterId[] };
    c: { characterId: CharacterId };
  };
  /** 마술사: 손패 통째 교환 or 원하는 만큼 버리고 같은 수 뽑기 */
  magicianMode: {
    d: { canSwapWith: readonly PlayerId[]; handSize: number };
    c:
      | { mode: 'swap'; target: PlayerId }
      | { mode: 'redraw'; discard: readonly CardId[] };
  };
  /** 장군: 파괴할 건물 (건너뛰기 가능) */
  warlordTarget: {
    d: {
      options: readonly { player: PlayerId; card: CardId; price: number }[];
      canSkip: true;
    };
    c: { target: { player: PlayerId; card: CardId } | null };
  };
  /** 실험실: 손패 1장을 버린다. source 로 어느 건물이 물었는지 구분한다. */
  discardCard: {
    d: { source: UniqueBuildingId; options: readonly CardId[] };
    c: { card: CardId };
  };
  /** 도적 소굴: 건설비용을 금화/카드로 나눠 내기 */
  buildPayment: {
    d: { card: CardId; cost: number; maxCards: number };
    c: { gold: number; cards: readonly CardId[] };
  };
}

export type PromptType = keyof PromptMap;

/**
 * 게임 마스터가 특정 플레이어에게 던진 질문.
 *
 * `player` 가 현재 차례 플레이어와 달라도 된다 — 지금은 쓰이지 않지만,
 * 남의 차례에 끼어드는 후순위 캐릭터(치안판사 등)가 구조 변경 없이 들어올 자리다.
 */
export type Prompt = {
  [K in PromptType]: PromptMap[K]['d'] & {
    readonly type: K;
    readonly player: PlayerId;
    readonly text: string;
  };
}[PromptType];

/** 이 질문에 대한 답의 타입. */
export type ChoiceOf<P extends Prompt> = PromptMap[P['type']]['c'];

/** 플레이어가 돌려주는 답. `type` 이 어느 질문에 대한 것인지 말해준다. */
export type Choice = {
  [K in PromptType]: PromptMap[K]['c'] & { readonly type: K };
}[PromptType];

export type PromptOfType<K extends PromptType> = Extract<Prompt, { type: K }>;
export type ChoiceOfType<K extends PromptType> = Extract<Choice, { type: K }>;
