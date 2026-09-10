# 시타델(Citadels) — AI 봇 대전 구현 계획

## Context

`/Users/suhyun.p/Documents/citadel`에는 코드가 없고 한글 규칙 데이터 md만 있다(`howto.md` 규칙서 전문, `character.md` 캐릭터 27장, `building.md` 건물 84장). 이걸로 플레이 가능한 게임을 만든다.

**이번 범위 — 네 가지 제약**

1. **AI 봇 only.** 봇들끼리 게임을 완주하는 것이 이번 목표. 사람 1인 투입은 나중.
2. **기본 조합("첫 게임" 세트)에 필요한 기능만 먼저 구현.** 캐릭터 8장 + 기본 건물 54장 + 특수 건물 14장 = **덱 68장**.
3. **추천 조합 6종(다른 모드)은 후순위.** 데이터로만 기록해두고 구현하지 않는다.
4. **Next.js + TypeScript.**

의도한 결과: UI 없이 검증 가능한 순수 TS 엔진 위에서 봇 4~7명이 기본 조합을 완주하고, 그것을 브라우저에서 관전할 수 있는 상태.

### 범위 확정 — 기본 조합이 실제로 요구하는 것

| 캐릭터 8종 | 능력 |
|---|---|
| 1 암살자 | 캐릭터 지목 → 대상 차례 스킵 |
| 2 도둑 | 캐릭터 지목 → 공개 시 금화 전액 강탈 (1번·암살당한 캐릭터 지목 불가) |
| 3 마술사 | 손패 통째 교환 or 원하는 만큼 버리고 같은 수 뽑기 |
| 4 왕 | 왕관 획득(강제) + 귀족 수만큼 금화. 암살당해도 라운드 종료 시 왕관 |
| 5 주교 | 8번 능력 면역(도시 전체) + 종교 수만큼 금화. 암살당하면 면역 소멸 |
| 6 상인 | +1금화 + 상업 수만큼 금화 |
| 7 건축가 | +2카드 + 건설 3채 |
| 8 장군 | 건물 파괴(비용 = 건설비용 −1) + 군사 수만큼 금화. 완성된 도시 불가 |

특수 건물 14종: 드래곤 게이트(종료 +2), 공장(특수 건설 −1금화), 유령 지구(종료 시 임의 종류), 제국 보고(종료 시 금화당 1점), 외성(8번 면역, 자기 카드만), 실험실(차례당 1회 카드→금화2), 도서관(뽑은 카드 전부 보유), 지도 보관실(종료 시 손패당 1점), 채석장(동명 건물 허용), 마법학교(수입 시 임의 종류), 대장간(차례당 1회 금화2→카드3), 동상(종료 시 왕관이면 +5), 도적 소굴(카드로 지불), 소원의 우물(종료 시 특수 건물당 1점).

**기본 조합에 없는 것 = 지금 만들지 않는 것:** 금광·천문대·마구간·구빈원·공원·박물관·장성·극장·병기고·골조·공동묘지·의사당·바실리카·기념물·상아탑·비밀 금고, 그리고 마녀·치안판사·협박범·세리·예술가·수도원장 등 나머지 캐릭터 19종. 이들이 요구하는 훅·상태 필드는 §5에 "지금 만들지 않는 훅"으로 명시만 해둔다.

---

## 설계를 관통하는 세 원칙

**1. 엔진은 React/Next를 모른다.** `src/engine`은 순수 TypeScript. Node에서 `tsx`로 단독 실행 가능. 봇 대전을 UI 없이 검증하려면 이게 전제다.

**2. 엔진은 행동을 "실행"하지 않고 선택을 "요청"한다.** 입력이 필요한 지점에서 `state.pending`에 멈추고, 봇이 그 pending을 받아 선택을 돌려준다. **사람은 나중에 같은 `Agent` 인터페이스에 다른 구현을 꽂는 것으로 들어온다** — 봇(동기)/사람(비동기)의 비대칭은 `Promise` 하나로 흡수되고, 엔진 자체는 async를 모른다. 제약 1이 "나중"이라고 해서 이 이음매까지 미루면 나중에 전면 재작성이 된다. **이음매만 만들고 구현은 미룬다.**

**3. 행동은 미루되 카디널리티는 지금 정한다.** 후순위 작업에 확정적으로 존재하는 것(예술가의 장식, 박물관의 tuck)은 필드 없이 **객체 자리만** 잡아두고, 범위 밖인 것(2~3인 변형)은 스칼라로 두고 나중 비용을 명시한다.

---

## 1. 디렉터리 구조

**모노레포 아님. 단일 Next.js 앱 + 폴더 경계 + ESLint 강제.** 엔진의 소비자가 이 앱 하나뿐이라 workspace로 얻을 게 "import 경계" 하나인데 그건 `no-restricted-imports` + tsconfig paths로 공짜다.

```
citadel/
├─ howto.md  character.md  building.md      # SSOT (사람이 편집)
├─ preset.md                                 # ★ 신규 — 카드 조합 SSOT
├─ scripts/codegen/{generate,slug-map,validate,errata}.ts
├─ src/
│  ├─ data/
│  │  ├─ types.ts                 # BuildingDef, CharacterDef, PresetDef, BuildingKind
│  │  └─ generated/{buildings,characters,presets}.gen.ts
│  ├─ engine/          # ★ 순수 TS. react/next/dom import 금지
│  │  ├─ index.ts                 # 공개 API 4개
│  │  ├─ types/{ids,state,decision,event}.ts
│  │  ├─ rng.ts  setup.ts  machine.ts
│  │  ├─ phases/{selection,action,turn,scoring}.ts
│  │  ├─ rules/{selection-table,build,income,invariants}.ts
│  │  ├─ effects/
│  │  │  ├─ hooks.ts  registry.ts
│  │  │  ├─ characters/*.ts       # assassin, thief, magician, king, bishop, merchant, architect, warlord
│  │  │  └─ buildings/*.ts        # library, factory, quarry, school_of_magic, keep, …  (14)
│  │  ├─ query.ts  view.ts
│  ├─ bot/
│  │  ├─ agent.ts  random.ts  scripted.ts
│  │  └─ heuristic/{index,policies}.ts
│  ├─ runtime/runner.ts  runtime/replay.ts
│  ├─ dev/simulate.ts             # 헤드리스 CLI
│  ├─ app/{layout,page}.tsx  app/watch/page.tsx
│  └─ ui/{match-controller.ts,hooks/,components/}
└─ tests/
```

**ESLint 경계:** `data`→없음 / `engine`→`data`만 / `bot`→`engine,data` / `runtime`→`bot,engine,data` / `app,ui`→전부.

의존성은 짧게: `next react typescript immer vitest tsx eslint`. **xstate는 쓰지 않는다** — 상태 기계가 `step()` 하나에 담기는 크기이고, 직렬화 가능한 pending 상태를 xstate 내부 상태와 이중 관리하게 된다.

---

## 2. 데이터 파이프라인 (md → TS)

`npm run gen` → `predev`/`prebuild`에 연결. CI에서 `npm run gen && git diff --exit-code`.

파싱 대상은 `character.md`, `building.md`, `preset.md` 셋. **`howto.md`는 산문이라 파싱하지 않고** 사람이 읽는 규칙 참조로만 남긴다. 능력의 동작은 텍스트가 아니라 `effects/` 코드에 있고, md의 description은 표시용이다.

### 검증 (실패 시 throw — 침묵 통과 금지)

| 대상 | 검증 |
|---|---|
| 건물 | 종교11 / 군사11 / 귀족12 / 상업20 / 특수30 = **84**, 기본 54 |
| 캐릭터 | 순번 1~9 각 3장 = **27** |
| 공통 | 동일 title의 cost 일관성 · cost 빈칸은 `비밀 금고`만 허용 |
| `SLUG_MAP` | 건물 title **47개** + 캐릭터 **27개** 전부 커버. 누락/잉여 = 에러 |
| 프리셋 | **순번 1~8 각각 정확히 1장** · `rank9`는 비었거나 순번 9 캐릭터 1장 · 특수 건물 **정확히 14장**, 전부 `kind==='unique'` · 중복 없음 |

**순번 완전성 검증이 이 파이프라인에서 가장 값어치 있는 규칙이다.** 실제로 howto.md 원문의 추천 조합 2개에 6번 캐릭터가 빠져 있었고(사용자가 교역상·연금술사로 보정), 이 검사가 그 부류를 잡는다.

**한글 오타 대응 = `slug-map.ts`를 오타 감지기로 쓴다.** 한글→ascii 매핑은 어차피 수동 테이블이 필요하다. 그 테이블을 허용 문자열 화이트리스트로 삼으면 `상인`→`사인` 같은 오타가 빌드를 깨뜨린다. 파서는 NFC 정규화 + trim만 하고 "똑똑한 교정"은 하지 않는다.

**슬러그 주의:** `외성`(8번 면역)과 `장성`(8번 추가비용)은 다른 카드다. 각각 `keep` / `great_wall`.

### 신규 파일 `preset.md`

추천 조합을 howto.md 산문에서 파싱하는 건 취약하다(조합마다 제목+표가 반복되는 구조). 기존 md와 같은 파이프 테이블로 분리한다.

```markdown
|name|description|characters|rank9|uniques|
|---|---|---|---|---|
|기본 조합|처음 배울 때 쓰는 세트|암살자, 도둑, 마술사, 왕, 주교, 상인, 건축가, 장군||드래곤 게이트, 공장, 유령 지구, 제국 보고, 외성, 실험실, 도서관, 지도 보관실, 채석장, 마법학교, 대장간, 동상, 도적 소굴, 소원의 우물|
```

`rank9`를 별도 컬럼으로 뺀 이유: 9번은 선택 사항이고 인원수 제약(왕비는 5인 미만 불가)이 붙어서, 괄호 표기를 파싱하는 것보다 컬럼 분리가 타입·검증 모두 깔끔하다.

**추천 조합 6행은 지금 넣지 않는다.** 제약 3에 따라 모드를 열 때 한 행씩 추가한다. 6종의 카드 목록은 이미 전수 검증해뒀고 §11에 순서와 함께 정리돼 있다.

---

## 3. 핵심 타입

### 카드 인스턴스는 문자열 하나로

기본 건물은 동명 카드가 여러 장(사원×3, 저택×5)이라 "정의"와 "실물 카드"를 구분해야 한다. 별도 인스턴스 테이블 대신 **ID에 인코딩**한다 — 카드에 고유 상태가 없고, `deck: CardId[]` 하나로 덱 전체가 표현되며 JSON 스냅샷을 사람이 읽을 수 있다.

```ts
export type PlayerId = number & { readonly __b: 'PlayerId' };  // 좌석 index
export type CardId   = string & { readonly __b: 'CardId' };    // "temple#2"
export const defIdOf = (c: CardId): BuildingDefId => /* '#' 앞 */;
```

```ts
export type BuildingKind = 'religious'|'military'|'noble'|'trade'|'unique';
export const KIND_FROM_KO = { 종교:'religious', 군사:'military', 귀족:'noble',
                              상업:'trade', 특수:'unique' } as const;

export interface BuildingDef {
  readonly id: BuildingDefId;    // 생성된 유니온 (47개)
  readonly title: string;        // 한글 원문 (표시용)
  readonly kind: BuildingKind;
  readonly cost: number | null;  // null = 건설 불가 (비밀 금고 1장, 기본 조합엔 없음)
  readonly text: string;         // 표시용. 동작의 근거가 아님
  readonly copies: number;
}
export type UniqueBuildingId = Extract<BuildingDefId, /* kind==='unique' 30개 */>;

export interface CharacterDef {
  readonly id: CharacterId; readonly rank: 1|2|3|4|5|6|7|8|9;
  readonly name: string; readonly text: string;
  readonly incomeKind?: BuildingKind;   // 왕=noble, 주교=religious, 상인=trade, 장군=military
}

export interface PresetDef {
  readonly id: PresetId; readonly name: string; readonly description: string;
  readonly characters: readonly CharacterId[];    // 순번 1~8, 정확히 8장
  readonly rank9: CharacterId | null;
  readonly uniques: readonly UniqueBuildingId[];  // 정확히 14장
}
```

`cost: number|null` 유지 — `비밀 금고`는 비용이 "없는" 게 아니라 건설 개념이 적용되지 않는 카드다. `cost: 0`으로 뭉개면 언젠가 "0금화로 건설 가능"이 된다. 좁히기 헬퍼 `isConstructible(d): d is BuildingDef & {cost:number}`를 둔다. (기본 조합엔 없지만 데이터에는 84장 전부 들어오므로 타입은 지금 필요하다.)

**특수 건물 효과에 DSL을 만들지 않는다.** 효과가 서로 너무 달라서 DSL은 결국 "N개 함수 + 인터프리터"가 된다. `id → 훅 구현` 레지스트리가 답이다(§5).

### 게임 상태

```ts
export interface MatchConfig {
  readonly seed: number;
  readonly playerCount: number;                     // 4~7 (기본 조합은 9번이 없어 3·8인 불가)
  readonly presetId: PresetId;
  readonly characterIds: readonly CharacterId[];    // 프리셋에서 파생, 순번당 1장
  readonly uniqueBuildingIds: readonly UniqueBuildingId[];
  readonly targetCitySize: number;                  // 7
}

export interface CityEntry { card: CardId; }        // ← 객체 자리만 확보 (원칙 3)
export interface CharacterSlot { characterId: CharacterId; revealed: boolean; killed: boolean; turnDone: boolean; }

export interface PlayerState {
  id: PlayerId; gold: number; hand: CardId[]; city: CityEntry[];
  character: CharacterSlot | null;                  // ← 스칼라 (2~3인 변형은 범위 밖)
  cityCompletedAtRound: number | null;
}

export interface GameState {
  readonly config: MatchConfig;
  rng: RngState; round: number;
  phase: 'selection'|'action'|'scoring'|'finished';
  crowned: PlayerId; players: PlayerState[];
  deck: CardId[];                      // 앞에서 뽑고(shift) 뒤로 넣는다(push)
  selection: SelectionState | null;
  action: ActionPhaseState | null;
  pending: PendingDecision | null;     // ★ null이면 step()으로 진행 가능
  log: GameEvent[];
  firstCompleted: PlayerId | null; result: MatchResult | null;
}

export interface ActionPhaseState {
  rankCursor: number;                  // 1..8
  turn: TurnState | null;
  declared: { assassinTarget: CharacterId | null; thiefTarget: CharacterId | null };
}

export interface TurnState {
  playerId: PlayerId; characterId: CharacterId;
  stage: 'gather'|'main'|'ending';
  buildsUsed: number; buildLimit: number;
  abilityUsed: boolean;
  usedOncePerTurn: UniqueBuildingId[]; // 실험실/대장간
  pendingSub: unknown | null;          // 다단계 능력 중간 상태 (마술사)
}
```

`CityEntry`를 단일 필드 객체로 두는 건 원칙 3의 적용이다 — 예술가(장식)와 박물관(tuck)이 후순위 작업에 확정적으로 존재하므로, `CardId[]`로 뒀다가 나중에 도시를 읽는 코드를 전부 뜯느니 지금 객체로 시작한다. 반대로 `character`는 스칼라다 — 캐릭터 2장은 2~3인 변형에서만 필요하고 그건 범위 밖이다(열게 되면 배열 전환 리팩터가 든다는 것을 여기 명시해둔다).

규칙상 버린 카드/파괴된 카드는 모두 "더미 맨 아래"로 가므로 **별도 버림더미가 필요 없다**(howto.md:75, 99).

---

## 4. 상태 전이 + ★ 의사결정 이음매

```ts
// engine/index.ts — 공개 API는 이 4개가 전부
export function createMatch(config: MatchConfig): GameState;
export function step(state: GameState): GameState;                   // 입력 불필요한 전이 수행
export function applyChoice(s: GameState, c: AnyChoice): GameState;  // 검증 후 반영
export function isOver(state: GameState): boolean;
```

`step()`은 순번 호명, 아무도 안 가진 캐릭터 건너뛰기, 암살당한 캐릭터 스킵, 라운드 정산, 종료 판정을 자동 수행하고, 입력이 필요해지면 `pending`을 채우고 반환한다. 둘 다 **순수 함수**(내부는 immer `produce`).

**이벤트 소싱은 쓰지 않는다.** 서버 권위/네트워크 복제가 없어 이벤트 적용 로직을 이중 구현할 이유가 없다. `GameEvent`는 리듀서의 **부산물**로 `state.log`에 push하고, 용도는 관전 UI 로그, 골든 스냅샷 테스트, 봇 관측이다.

### 결정론적 RNG

셔플이 최소 3곳에서 일어난다(초기 덱, 매 라운드 캐릭터, 4번 캐릭터 앞면 버림 재추첨). 전부 상태의 일부여야 리플레이가 된다.

```ts
export type RngState = number & { readonly __b: 'RngState' };   // mulberry32
export const shuffle: <T>(r: RngState, a: readonly T[]) => [T[], RngState];
```

**`src/engine`·`src/bot` 어디서도 `Math.random()`을 호출하지 않는다.** ESLint `no-restricted-globals`로 금지. 이것만으로 "시드 + 선택 로그 = 완전 재현"이 보장된다. 리플레이는 `{ config, choices }` — 수백 바이트다. **봇 대전은 버그 재현이 전부이므로 이게 이번 범위의 핵심 도구다.**

### 왜 "pending을 상태에 넣고 멈추는가"

| 대안 | 문제 |
|---|---|
| 콜백 주입 | 나중에 사람을 넣으려면 엔진 전체가 async가 되고 상태 스냅샷이 불가능 |
| 제너레이터 코루틴 | 표현력은 최고지만 **중간 상태를 직렬화할 수 없음** → 저장/복원/스냅샷 테스트가 막힘 |
| **pending in state** | 엔진은 동기 순수 함수 유지, 상태는 항상 JSON 직렬화 가능, 봇/리플레이/테스트/(나중의)사람이 전부 같은 경로 |

비동기는 `runtime/runner.ts` **한 파일에만** 존재한다.

### 기본 조합에 필요한 결정 8종

```ts
export interface DecisionMap {
  selectCharacter: { d:{ options:CharacterId[]; poolSize:number }; c:{ characterId:CharacterId } };
  gatherMode:      { d:{ goldAmount:number; drawCount:number };    c:{ mode:'gold'|'cards' } };
  keepDrawn:       { d:{ drawn:CardId[]; keep:number };            c:{ keep:CardId[] } };  // 도서관이면 keep===drawn.length → 자동 통과
  mainAction:      { d:{ options:MainAction[] };                   c:{ action:MainAction } };
  namedCharacter:  { d:{ purpose:'assassinate'|'rob'; options:CharacterId[] }; c:{ characterId:CharacterId } };
  magicianMode:    { d:{ canSwapWith:PlayerId[]; handSize:number };
                     c:{ mode:'swap'; target:PlayerId } | { mode:'redraw'; discard:CardId[] } };
  warlordTarget:   { d:{ options:{player:PlayerId;card:CardId;price:number}[]; canSkip:true };
                     c:{ target:{player:PlayerId;card:CardId} | null } };
  buildPayment:    { d:{ card:CardId; cost:number; maxCards:number };   // 도적 소굴
                     c:{ gold:number; cards:CardId[] } };
}
export type PendingDecision = { [K in keyof DecisionMap]:
  DecisionMap[K]['d'] & { readonly type:K; readonly player:PlayerId; readonly prompt:string } }[keyof DecisionMap];
export type ChoiceOf<D extends PendingDecision> = DecisionMap[D['type']]['c'];
export type AnyChoice = { [K in keyof DecisionMap]: DecisionMap[K]['c'] & {type:K} }[keyof DecisionMap];
```

**차례는 "메뉴 루프"다.** 이게 "능력은 차례 중 아무 때나"(howto.md:215) 규칙을 자연스럽게 표현한다 — 주교가 건설 전/후 어느 쪽에서든 수입을 받고, 상인이 언제든 능력을 쓴다.

```ts
export type MainAction =
  | { t:'build'; card:CardId }
  | { t:'useAbility' }                                // 세부는 후속 pending
  | { t:'useBuilding'; building:UniqueBuildingId }    // 실험실/대장간
  | { t:'endTurn' };
```

`pending.player`가 현재 턴 플레이어와 달라도 되게 설계한다 — 지금은 쓰이지 않지만 후순위 캐릭터(치안판사의 몰수 판단 등)가 구조 변경 없이 들어오는 자리다. 필드 하나 값이라 비용이 없다.

### Agent — 지금은 봇만, 나중에 사람이 같은 구멍에

```ts
// bot/agent.ts
export interface Agent {
  readonly name: string;
  decide<D extends PendingDecision>(view: PlayerView, decision: D): Promise<ChoiceOf<D>>;
  observe?(events: GameEvent[], view: PlayerView): void;
}
```

봇은 내부가 완전 동기이고 `Promise.resolve`로 감싸질 뿐이다. `decide`를 지금부터 `Promise`로 두는 유일한 이유는 **나중에 사람과 Web Worker를 같은 인터페이스로 받기 위해서**이며, 이게 원칙 2가 말하는 "이음매만 만들고 구현은 미룬다"의 실체다.

```ts
// runtime/runner.ts — 이게 전부
export async function runMatch(init, agents: ReadonlyMap<PlayerId,Agent>, opts = {}) {
  let s = init;
  while (!isOver(s)) {
    if (s.pending) {
      const d = s.pending;
      const choice = await agents.get(d.player)!.decide(viewFor(s, d.player), d);
      s = applyChoice(s, { ...choice, type: d.type } as AnyChoice);
    } else s = step(s);
    opts.onState?.(s);
  }
  return s;
}
```

사람을 넣을 때 이 러너는 바뀌지 않는다 — `agents` 맵에 `HumanAgent`(promise를 붙잡아두고 UI가 resolve)를 넣는 것이 전부다.

### 리댁션 — 봇에게 `GameState`를 주지 않는다

봇 전용 단계라고 편의로 전체 상태를 주면 봇이 상대 손패를 보고 짜여지고, 사람을 넣는 순간 "봇은 알지만 사람은 모르는 정보"가 드러나며 봇을 다시 짜야 한다. 처음부터 `PlayerView`만 준다.

```ts
export interface PlayerView {
  me: { id:PlayerId; gold:number; hand:CardId[]; city:CityEntry[]; character:CharacterSlot|null };
  opponents: { id:PlayerId; gold:number; handCount:number; city:CityEntry[];
               revealedCharacter: CharacterId|null }[];   // 호명되어 공개된 것만
  round:number; crowned:PlayerId; deckCount:number;
  faceUpDiscards: CharacterId[]; faceDownCount:number;    // 뒷면은 장수만
  charactersInGame: readonly CharacterId[]; calledRank: number|null;
  log: GameEvent[];                                        // redactEvent 통과분
  config: MatchConfig;
}
export function viewFor(s: GameState, p: PlayerId): PlayerView;
export function redactEvent(e: GameEvent, viewer: PlayerId): GameEvent | null;
```

관전 UI는 전지적 시점(`GameState`)을 봐도 되지만 **봇은 언제나 `PlayerView`만** 받는다.

### 합법 수

```ts
export function legalChoices(s, d): AnyChoice[] | null;   // 열거 불가 시 null
export function isLegal(s, d, c): boolean;                 // 항상 구현. applyChoice가 무조건 호출
export function randomLegal(s, d): [AnyChoice, RngState];  // 퍼즈 테스트 기반
```

기본 조합에서 조합 폭발이 나는 건 **마술사의 버릴 카드 부분집합(2^n)** 과 도적 소굴의 지불 조합뿐이다. 그때만 `null`을 반환하고 봇이 `d`의 제약을 직접 해석한다.

---

## 5. 효과 훅 — 기본 조합에 필요한 것만

**id → handler 레지스트리.** switch 하드코딩을 피하는 이유는 막연한 확장성이 아니다: 카드가 22종(캐릭터 8 + 특수 14)이고 발동 시점이 제각각이라, switch로 쓰면 `turn.ts` 하나에 22개 분기가 모인다.

```ts
// engine/effects/hooks.ts — 기본 조합이 실제로 쓰는 13개
export interface GameHooks {
  modifyGatherCards?(plan:{draw:number;keep:number}, ctx):{draw:number;keep:number}; // 도서관
  modifyBuildLimit?(limit:number, ctx): number;              // 건축가(3)
  modifyBuildCost?(cost:number, def:BuildingDef, ctx): number;  // 공장(특수 −1)
  allowsDuplicateTitle?(def:BuildingDef, ctx): boolean;      // 채석장
  paymentOptions?(def:BuildingDef, ctx): PaymentOption[];    // 도적 소굴
  countsAsKind?(entry:CityEntry, want:BuildingKind, ctx): boolean;  // 마법학교 (수입 한정)
  immuneToRank8?(entry:CityEntry, ctx): boolean;             // 주교(도시 전체), 외성(자기 카드)
  turnActions?(ctx): MainAction[];                           // 메뉴에 노출
  performAction?(action:MainAction, ctx): void;
  onTurnStart?(ctx): void;                                   // 왕: 왕관 획득(강제)
  onRoundEnd?(ctx): void;                                    // 암살된 왕의 왕관 계승
  onCharacterRevealed?(who:PlayerId, c:CharacterId, ctx): void;  // 도둑 정산
  endGameScore?(ctx:ScoreCtx): number;                       // 드래곤 게이트/제국 보고/지도 보관실/동상/소원의 우물
  scoringKindOverride?(entry:CityEntry, ctx:ScoreCtx): BuildingKind|'wildcard'|null;  // 유령 지구
}
```

`EffectCtx`는 immer draft, `self: PlayerId`, `push(event)`, 그리고 **`ask(d: PendingDecision)`** — 훅 안에서 추가 입력이 필요하면 pending을 세운다.

```ts
// engine/effects/registry.ts
export const CHARACTER_EFFECTS = { assassin, thief, magician, king, bishop, merchant, architect, warlord }
  satisfies Partial<Record<CharacterId, GameHooks>>;
export const BUILDING_EFFECTS = { dragon_gate, factory, ghost_district, imperial_treasury, keep,
  laboratory, library, map_room, quarry, school_of_magic, smithy, statue, thieves_den, wishing_well }
  satisfies Partial<Record<UniqueBuildingId, GameHooks>>;

export function collectHooks(s: GameState, p: PlayerId): GameHooks[];   // 캐릭터 + 자기 도시 특수건물
export function missingCards(preset: PresetDef): { characters: CharacterId[]; uniques: UniqueBuildingId[] };
```

`createMatch`는 핸들러가 없는 카드가 프리셋에 있으면 **무엇이 빠졌는지 나열하며 throw**한다. 후순위 모드를 실수로 실행하는 것을 막고, 나중에 모드를 열 때 "무엇을 더 만들어야 하는지"가 그대로 목록으로 나온다.

### ★ 마법학교와 유령 지구는 정반대다 — 메커니즘을 공유시키면 안 된다

둘 다 "원하는 종류로 간주"지만 적용 시점이 배타적이다.

| 카드 | 원문 | 적용 범위 |
|---|---|---|
| 마법학교 | "**자원을 받는 능력**을 사용할 때" (building.md:84) | **수입 계산만.** 종료 점수(5종 보너스·소원의 우물)에는 무관 |
| 유령 지구 | "**게임이 종료되면**" (building.md:58) | **점수 계산만.** 수입 계산에는 무관 |

그래서 `countsAsKind`(수입)와 `scoringKindOverride`(점수)를 별도 훅으로 분리한다. 한 훅으로 합치면 마법학교가 5종 보너스를 채우거나 유령 지구가 주교 수입을 늘리는 버그가 조용히 생긴다. 추가로 howto.md의 건물 상세 설명은 **유령 지구를 특수 이외의 종류로 쓰면 더 이상 특수 건물이 아니게 되어 소원의 우물 점수에서 빠진다**고 명시한다 — 즉 유령 지구의 종류 선택은 5종 보너스와 소원의 우물 사이의 트레이드오프다. 선택 주체는 규칙상 플레이어지만 숨은 정보가 없으므로 **최종 점수를 최대화하는 값으로 엔진이 자동 결정**하고, 근거 주석을 남긴다.

**종류별 수입은 훅이 아니라 공통 함수.** `rules/income.ts`의 `countIncome(state, player, kind)`가 `countsAsKind`를 물어본다 — 왕·주교·상인·장군 네 곳에서 같은 로직을 쓰기 때문이다. (howto.md:100 예시가 마법학교를 군사 건물로 세는 것을 확인해준다.)

### 지금 만들지 않는 훅 (후순위 모드용)

`modifyGatherGold`(금광) · `isBuildFree`(마구간·교역상·마법사) · `rank8Surcharge`(장성) · `onTurnEnd`(연금술사·구빈원·공원) · `onSelectionEnd`(극장) · `onAnyPlayerBuild`(세리) · `interceptBuild`(치안판사) · 수입 자원 선택(수도원장) · `CityEntry.decorations`(예술가) · `CityEntry.tuck`(박물관) · `CityEntry.paidWith`(도적 소굴 몰수 환급 — 치안판사가 있어야 의미).

**훅 합성 순서 규약은 지금 세운다.** 기본 조합에는 순서 충돌이 없지만(도서관 단독), 후순위의 천문대+도서관은 순서를 틀리면 3장 뽑고 1장만 남긴다. `collectHooks`가 도시 건설 순서가 아니라 **`EFFECT_ORDER` 상수 배열 순서로 정렬**한다는 계약만 지금 박아둔다 — 상수 하나이고, 나중에 훅에 priority 필드를 다는 것보다 싸다.

---

## 6. 턴 진행 상태 기계

```
createMatch: 프리셋 검증 → 덱(54기본+14특수) 셔플 → 각 4장 → 각 2금화 → 왕관 = 좌석 0
   ▼
[selection] 캐릭터 8장 셔플
   ├ 앞면 버림 × F(인원수)   ※ 4번(왕)이 뽑히면 되돌리고 재추첨 (howto.md:66)
   ├ 뒷면 버림 × 1
   ├ 왕관 주인부터 시계방향 1장씩 pick     ← pending: selectCharacter
   │   ※ 7인: 마지막 플레이어는 처음 뒷면 버린 카드까지 2장 중 1장 (howto.md:70)
   └ 잔여 1장 뒷면 버림
   ▼
[action] rankCursor 1…8
   ├ 보유자 없음 → 이벤트만 남기고 다음 순번
   ├ 보유자 암살됨 → reveal, skip
   └ 보유자 있음 → onCharacterRevealed(도둑 정산) → [turn]
        ├ 'gather' : pending gatherMode → (cards면) pending keepDrawn
        ├ 'main'   : ★ 루프 — pending mainAction (build∗/useAbility/useBuilding∗/endTurn)
        │              build → 비용판정·지불·배치 → 7채 판정
        │              useAbility/useBuilding → 훅 performAction (내부 추가 pending 가능)
        └ 'ending' : 다음 순번
   ▼
[roundEnd] onRoundEnd(암살된 왕의 왕관 계승) → 완성자 있으면 [scoring], 아니면 캐릭터 회수 후 [selection]
   ▼
[scoring] 건설비용 합 + 5종 3점 + 선완성 4점/후완성 2점 + endGameScore
          동점 시 마지막 라운드 캐릭터 순번이 늦은 쪽 승 (howto.md:120)
```

예외 규칙이 흩어지지 않도록 `rules/selection-table.ts` 한 파일에 모은다:

```ts
export const DISCARD_TABLE = {   // 캐릭터 8장 기준 (howto.md:59~66)
  4:{faceUp:2,faceDown:1}, 5:{faceUp:1,faceDown:1},
  6:{faceUp:0,faceDown:1}, 7:{faceUp:0,faceDown:1},
} as const;
export const NEVER_FACE_UP_RANK = 4;
export const LAST_PICKER_GETS_DISCARD_AT = 7;   // 7인 특수 규칙
```

**7인 규칙 주의:** "처음 버렸던 카드"는 맨 처음 **뒷면으로** 버린 1장(`selection.faceDown[0]`)이지 앞면 버림이 아니다.

9번 캐릭터를 쓰는 표(howto.md:162~168)는 후순위 모드에서만 필요하므로 지금 넣지 않는다.

---

## 7. 봇 AI

```ts
export interface Policy {
  score?(view: PlayerView, d: PendingDecision, candidate: AnyChoice): number;
  construct?(view: PlayerView, d: PendingDecision): AnyChoice | undefined;  // 열거 불가 결정만
}
export class HeuristicAgent implements Agent { /* legalChoices → score 최댓값, 동점은 rng */ }
```

**폴백 체인 `construct → score → randomLegal`이 핵심이다.** 정책을 한 줄도 안 쓴 상태에서 봇이 게임을 완주한다 → M1에서 `RandomAgent`만으로 엔진을 검증하고, 이후 결정 타입 하나씩 정책을 채운다. 이번 범위가 봇 대전이므로 이 순서가 곧 개발 순서다.

휴리스틱 방향: 캐릭터 선택(손패·금화 적합도 + 선두 견제), 자원(금화 < 최저 건설비면 금화, 손패 ≤ 1이면 카드), 건설(비용 대비 점수 + 5종 보너스 기여 + 자기 캐릭터 수입 시너지, 7채 리치면 완성 우선), 암살·도둑(금화 많은 플레이어가 고를 법한 순번 추정 — 초기엔 고정 휴리스틱), 장군(선두의 최고가 파괴 가능 건물).

난이도는 `Policy` 프리셋 교체(`easy/normal/hard`). **MCTS·탐색은 넣지 않는다.** 필요해지면 `Agent`를 구현하는 별도 `SearchAgent`가 `GameState`를 복제해 `step`/`applyChoice`로 시뮬레이션하면 된다 — 순수 함수 엔진이라 공짜다.

---

## 8. 테스트 전략

`vitest` 하나. 브라우저 없이 전부 돈다.

**데이터** — 84/54/종류별 장수, 캐릭터 27·순번당 3, 기본 조합 프리셋의 순번 1~8 완전 + 특수 14장, 덱 총 68장.

**불변식** (`rules/invariants.ts`, 개발 모드에서 매 step):
- **카드 총량 보존: `deck + Σhand + Σcity === 68`** — 가장 강력한 그물. 카드 분실·복제를 즉시 잡는다
- 모든 `CardId`가 게임 전체에 정확히 1번 등장
- `gold >= 0`. ⚠️ **금화 총량 보존은 불변식이 아니다** — 은행 금화는 무제한(howto.md:107). 대신 `stolen` 이벤트만큼 한쪽이 줄고 한쪽이 늘었는지 검사
- 도시 동명 중복은 채석장이 있을 때만 허용
- `pending !== null`이면 `legalChoices`가 빈 배열이 아님(교착 방지)
- 라운드 상한(40) 초과 시 실패

**퍼즈** — `for seed 0..999 × players 4..7`: 랜덤봇으로 완주, 매 step 불변식 통과, 승자 1명 이상. **랜덤봇이 휴리스틱봇보다 훨씬 좋은 퍼저다**(이상한 상태 공간을 밟는다). CI는 seed 0~199, 전체는 `npm run fuzz`.

**결정론** — 같은 시드+같은 봇 → 최종 상태 JSON 해시 동일. `replay(config, choiceLog)` → 원본과 일치. 이벤트 로그 골든 스냅샷.

**카드별 단위 테스트** — `tests/fixtures/state-builder.ts`로 상태를 조립:
```ts
aGame().players(3)
  .player(0,{gold:5, hand:['temple#1','castle#2'], city:['library#1']})
  .player(1,{gold:3, city:['keep#1','tavern#1']})
  .assign(0,'warlord').assign(1,'bishop').atTurn(0,'main').build();
```

기본 조합에서 반드시 덮어야 할 상호작용:
- **마법학교는 수입에만, 유령 지구는 점수에만** — 마법학교가 5종 보너스·소원의 우물에 영향 없음 / 유령 지구가 주교 수입에 영향 없음
- **유령 지구 × 소원의 우물** — 특수 이외 종류로 쓰면 소원의 우물 점수에서 빠짐
- 장군 vs 주교(도시 전체 면역) / vs 외성(자기 카드만) / vs 완성된 도시(불가)
- 장군 파괴 비용 = 건설비용 − 1, 비용 1은 무료, 파괴 카드는 더미 맨 아래
- 공장 + 도적 소굴 (특수 −1금화를 카드로 지불)
- 채석장으로 동명 2채 → 5종 보너스에서 종류가 두 번 세어지지 않는지
- 도서관 보유 시 자원 얻기가 2장 전부 보유로 바뀌는지
- 암살된 왕이 라운드 종료 시 왕관을 가져가고 다음 라운드 선택 순서가 바뀌는지
- 주교가 암살당하면 8번 면역이 사라지는지
- 도둑이 1번 캐릭터·암살당한 캐릭터를 지목할 수 없는지 (howto.md:253)
- 건축가 3채 + 7채 도달 시 라운드 종료 판정

---

## 9. UI — 봇 대전 관전 뷰

사람이 아직 안 들어오므로 이번 UI의 목적은 **입력이 아니라 관전**이다. 완전 클라이언트 사이드, Server Action 없음, DB 없음.

```
app/layout.tsx      Server Component (정적 셸)
app/watch/page.tsx  'use client' — 여기부터 전부 클라이언트
```

**React 밖에 스토어를 둔다** — 엔진 루프가 렌더 사이클과 무관해야 하고 `GameState`가 커서 리렌더 통제가 필요하다. `MatchController` + `useSyncExternalStore`.

- **봇 연출 딜레이는 `Clock` 주입**: 테스트 `{delay:()=>Promise.resolve()}`, UI `{delay:ms=>new Promise(r=>setTimeout(r,ms))}`. **엔진에 `setTimeout`이 들어가지 않는다.**
- 컨트롤: 시드 입력, 인원수(4~7), 재생/일시정지/한 스텝, 속도. **시드를 넣으면 같은 판이 재현된다** — 봇 버그 조사의 주 도구.
- 컴포넌트: `<CityBoard>`(플레이어별 도시·금화·손패 수), `<CharacterTrack>`(순번 1~8, 앞면 버림, 현재 호명), `<EventLog>`, `<ScorePanel>`.
- **`<DecisionPanel>`은 만들지 않는다** — 사람이 들어올 때 추가한다. 그때 `PendingDecision.type`으로 switch하는 유일한 UI 지점이 된다.
- 저장은 `{config, choiceLog}`를 localStorage에 넣고 `replay()`로 복원 — `GameState` 전체 직렬화 불필요.

---

## 10. 마일스톤

| # | 내용 | 완료 정의 |
|---|---|---|
| **M0** | 코드젠 + `preset.md`(기본 조합 1행) | `npm run gen` 2회에 git diff 없음. 데이터·프리셋 검증 통과. md 한 글자를 일부러 바꿔 `slug-map`이 실제로 실패시키는지, 프리셋에서 6번을 지우면 순번 완전성 검증이 잡는지 확인 |
| **M1** | 엔진 골격 + **랜덤봇 헤드리스 완주** (능력 전부 no-op stub) | `npx tsx src/dev/simulate.ts --seed 0 --players 4` 정상 종료. seed 0~999 × 4~7인 전부 40라운드 내 종료 + 매 step 불변식 통과. 리플레이 재현 일치 |
| **M2** | 캐릭터 8종 | 캐릭터별 단위 테스트 통과. M1 퍼즈 유지. 로그에 암살·절도·파괴가 실제 등장 |
| **M3** | 특수 건물 14종 + 점수 계산 | `missingCards(기본 조합)`이 빈 결과. §8의 상호작용 테스트 전부 통과(특히 마법학교/유령 지구 비대칭). 점수 골든 테스트 |
| **M4** | 휴리스틱 봇 | `HeuristicAgent` vs `RandomAgent` 4인 200판 승률 > 70%. 프리셋 3종 |
| **M5** | 관전 UI | 브라우저에서 봇 4~7명 대전 완주 관전. 시드 재현 동작. 새로고침 후 localStorage 리플레이 복원 |

**M1이 이번 계획의 분수령이다.** 능력이 전부 stub인 상태에서 봇들이 68장 불변식을 지키며 완주하면 골격이 옳은 것이고, 그 뒤 M2~M3는 카드를 한 장씩 채우는 반복 작업이 된다.

---

## 11. 후순위 작업 (이번 범위 밖)

### 사람 1인 투입
`runtime/human-agent.ts`(promise를 붙잡아두고 UI가 resolve) 추가 + `<DecisionPanel>` 추가. **`src/engine`·`src/bot`·`src/data`는 변경 0줄이어야 한다** — 이것이 §4 이음매 설계가 옳았는지의 판정 기준이다.

### 추천 조합 6모드
`preset.md`에 행을 추가하고 부족한 카드를 구현한다. 7개 프리셋의 합집합은 **캐릭터 27장 + 특수 건물 30장 전부**이므로, 전부 열면 곧 전체 구현이다. 엔진 코어를 건드리는 캐릭터(**마녀** 능력 복사, **치안판사** 몰수, **협박범** 응답 강제, **세리** 전역 재산세)를 뒤로 미루면서 누적 신규 카드를 최소화한 순서:

| 순서 | 모드 | 신규 캐릭터 | 신규 특수 건물 | 코어 개입 |
|---|---|---|---|---|
| 1 | 권력욕의 개 | 대공, 추기경, 항해사, 세리(9) | 병기고, 바실리카, 금광, 상아탑, 기념물, 박물관 | 세리(9번을 끄면 코어 무손상으로 선검증) |
| 2 | 왔노라 보았노라 이겼노라 | 첩자, 예언자, 교역상, 학자, 외교관, 예술가(9) | 의사당, 천문대, 비밀 금고, 마구간 | 없음 |
| 3 | 귀족이여 야망을 가져라 | 치안판사, 마법사, 육군대장, 왕비(9) | 골조, 장성, 공동묘지, 공원, 구빈원 | **치안판사** |
| 4 | 사절단의 품격 | 마녀, 황제 | — | **마녀** (최대 난관) |
| 5 | 정치놀음 | 협박범, 수도원장, 연금술사 | 극장 | **협박범** |
| 6 | 첩자는 웃지 않는다 | **0장** | **0장** | 마녀+협박범+세리가 한 판에 — 통합 테스트 전용 |

9번 캐릭터를 켜면 선택 단계 버림 장수 표가 9장 열로 바뀌고(howto.md:162~168), **왕비는 5인 미만 불가**(howto.md:212)라 인원수 제약이 프리셋에서 파생돼야 한다.

### 그 밖에
2~3인 변형(플레이어당 캐릭터 2장 — `PlayerState.character`를 배열로 바꾸는 리팩터 필요) · 사용자 정의 조합 편집기 · Web Worker/탐색 봇 · i18n.

---

## 12. 검증 방법 (엔드투엔드)

```bash
npm run gen && git diff --exit-code        # M0: 코드젠 멱등성
npx vitest run                             # 데이터/불변식/카드별 단위 테스트
npx tsx src/dev/simulate.ts --seed 0 --players 4 --verbose   # 한 판 로그 육안 확인
npm run fuzz                               # seed 0~999 × 4~7인 랜덤봇 퍼즈
npx tsc --noEmit && npx eslint .           # 타입 + 폴더 경계 위반 검사
npm run dev                                # M5 이후 브라우저 관전
```

**가장 중요한 신호 두 개:** ① 퍼즈에서 카드 총량 68 불변식이 깨지지 않는 것, ② 같은 시드가 항상 같은 판을 재현하는 것.

---

## 13. 명시적으로 하지 않는 것 (과설계 방지)

모노레포 · 이벤트 소싱 · xstate · 효과 DSL · Server Action/DB/인증 · 멀티플레이/네트워크 · Web Worker/MCTS · i18n · 9번 캐릭터 · 2~3인 변형 · 후순위 훅 11종(§5 목록) · `<DecisionPanel>`

## 14. 남은 규칙 공백 → `errata.ts`에 기록

사용자가 `howto.md`에 장군 상세 규칙과 건물 상세 설명을 채워 넣어 이전의 주요 공백은 해소됐다. 남은 것:

1. **건물 카드 더미 소진** — howto.md에 언급 없음. 68장 중 4인 기준 16장 배분 후 52장이라 실제 소진 가능. 제안: 더미가 비면 뽑기가 조용히 실패(0장)하고 `deckExhausted` 이벤트를 남기며, 불변식이 이를 허용
2. **동점 처리** — "순번이 더 늦은 플레이어 승"(howto.md:120)을 마지막 라운드 캐릭터 순번 기준으로 해석
3. **유령 지구의 종류 선택 주체** — 규칙상 플레이어 선택이나, 숨은 정보가 없으므로 최종 점수 최대화로 엔진이 자동 결정(§5)
