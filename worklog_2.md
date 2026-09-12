# 시타델 — 엔진을 GameMaster / Player / Character 인터페이스로 재작성

## Context

기본 조합으로 봇 대전이 완주하는 엔진이 이미 있다(브랜치 `worklog_1`, 커밋 `f5fd476`). 규칙은 맞게 돌아가지만 **구조가 게임의 언어로 읽히지 않는다**. 지금은 `step(state)` / `applyChoice(state, choice)` 라는 자료구조 변환 함수 두 개가 전부라, "게임 마스터가 라운드를 진행하고, 플레이어에게 선택지를 주고, 승인해서 적용한다" 는 실제 진행이 코드에 드러나지 않는다.

이번 작업은 그 진행을 **인터페이스 계층으로 드러내는 엔진 재작성**이다.

```
GameMaster   라운드 진행, 왕관 이동, 각 플레이어에게 보여줄 것 정리, 승인·적용
  └ Player   자기 금화·손패·도시, 지금 받은 질문과 고를 수 있는 선택지
      └ Character   이 캐릭터가 지금 쓸 수 있는 능력
```

### 확정된 세 가지

1. **불변 상태 + 인터페이스.** 인터페이스는 읽기 좋은 표면이고, 그 아래는 지금처럼 직렬화 가능한 `GameState` 값이다. 시드 재현·리플레이·카드 68장 불변식이 그대로 유지된다.
2. **엔진만 새로.** `src/data`(코드젠)·`src/bot`·`src/ui`·`tests` 는 유지한다. 조사 결과 **봇은 `query`/`rng`/`types`/`view` 만 참조하고 `machine`/`setup` 은 건드리지 않으므로**, 구동 API 를 바꿔도 봇은 거의 그대로 살아남는다.
3. **pull 방식.** 봇이 `state.pending` 을 읽는 대신, `gm.optionsFor(player)` 로 묻고 `gm.submit(player, choice)` 로 제출한다.

### 이번 재작성이 노리는 것 / 노리지 않는 것

규칙 동작은 **하나도 바꾸지 않는다.** 그래서 기존 테스트 78개와 1000판 퍼즈가 그대로 **재작성의 합격 기준**이 된다. 규칙을 고치면서 구조를 바꾸면 무엇이 깨졌는지 알 수 없다.

### 작업 브랜치

이 리포의 기본 브랜치는 `main` 이 아니라 **`master`** 다(원격 HEAD 도 `origin/master`). 그것을 base 로 `v2` 브랜치를 만들어 거기서만 작업한다.

```bash
git switch master && git switch -c v2
```

`master` 와 `worklog_1` 은 지금 같은 커밋(`f5fd476`)이므로 base 선택이 내용에 영향을 주지 않는다. 기존 엔진은 `master` 에 그대로 남아, 골든 대조(§7)가 깨졌을 때 언제든 돌아가 비교할 수 있다.

---

## 1. 세 인터페이스

```ts
// engine/master/types.ts

/** 게임 전체 진행을 맡는 주체. 상태를 들고 앞으로 굴린다. */
export interface GameMaster {
  /** 지금 상태의 스냅샷. 언제나 JSON 직렬화 가능하다. */
  snapshot(): GameState;

  round(): number;
  phase(): Phase;
  isOver(): boolean;
  result(): MatchResult | null;

  players(): readonly Player[];
  player(id: PlayerId): Player;
  /** 왕관 주인. 선택 단계의 시작점이자 호명 권한자다. */
  crownHolder(): Player;
  /** 지금 호명 중인 순번. 선택 단계면 null. */
  calledRank(): number | null;

  /** 지금 답을 기다리는 플레이어. null 이면 advance() 로 진행할 수 있다. */
  awaiting(): Player | null;
  /** 입력이 필요 없는 전이를 한 단계 진행한다. */
  advance(): void;

  /** 이 플레이어가 지금 받은 질문. 답할 차례가 아니면 null. */
  promptFor(player: PlayerId): Prompt | null;
  /** 그 질문의 합법 선택지. 열거할 수 없는 질문이면 null. */
  optionsFor(player: PlayerId): Choice[] | null;
  /** 승인만 하고 적용하지 않는다. 봇이 자기 수를 미리 검산할 때 쓴다. */
  approve(player: PlayerId, choice: Choice): Approval;
  /** 승인 후 적용. 거절되면 적용하지 않고 이유를 돌려준다. */
  submit(player: PlayerId, choice: Choice): Approval;

  /** 관전·디버깅용 전지적 로그. 플레이어용은 Player.view() 가 걸러준다. */
  log(): readonly GameEvent[];
}

export type Approval = { ok: true } | { ok: false; reason: string };
```

```ts
/** 한 플레이어. 자기 시점의 정보와 지금 할 수 있는 것. */
export interface Player {
  readonly id: PlayerId;

  gold(): number;
  hand(): readonly CardId[];
  city(): readonly CityEntry[];
  isCityComplete(): boolean;
  hasCrown(): boolean;

  /** 이번 라운드에 고른 캐릭터. 선택 전이면 null. */
  character(): Character | null;

  /**
   * 이 플레이어가 볼 수 있는 것만 모은 것.
   * "플레이어들의 카드를 모아 한 플레이어에게 보여주는" 일이 여기서 일어난다 —
   * 남의 손패는 장수만, 남의 캐릭터는 공개된 것만 담긴다.
   */
  view(): PlayerView;

  prompt(): Prompt | null;
  options(): Choice[] | null;
  submit(choice: Choice): Approval;
}
```

```ts
/** 플레이어가 이번 라운드에 맡은 캐릭터. */
export interface Character {
  readonly id: CharacterId;
  readonly rank: number;
  readonly name: string;
  readonly text: string;

  isRevealed(): boolean;
  isKilled(): boolean;
  hasActed(): boolean;

  /** 이 캐릭터가 **자기 능력으로** 지금 제공하는 선택지. */
  abilities(): readonly AbilityOption[];
  /** 종류별 수입을 받는 캐릭터라면 지금 받을 금액. 아니면 null. */
  pendingIncome(): { kind: BuildingKind; amount: number } | null;
}
```

### ★ Character 가 선택지 전부를 주지는 않는다

요청하신 그림대로면 `Character.abilities()` 가 플레이어의 선택지처럼 보이지만, **이 게임에서는 틀린 모델이다.** 차례 메뉴는 세 곳에서 모인다([turn.ts:132](src/engine/phases/turn.ts:132)):

| 출처 | 예 |
|---|---|
| 캐릭터 능력 | 암살자의 지목, 장군의 파괴, 주교의 수입 |
| **도시의 특수 건물** | 실험실(카드→금화), 대장간(금화→카드) |
| 기본 행동 | 건설, 차례 종료 |

그래서 **`Player.options()` 가 권위 있는 목록**이고, `Character.abilities()` 는 그중 캐릭터가 기여한 부분만 보여주는 창이다. 이 구분을 흐리면 실험실·대장간이 조용히 사라진다. 인터페이스 주석에 이유를 남긴다.

---

## 2. 상태 모델 — 불변 값 위의 커서

`GameMaster` 는 **불변 상태를 가리키는 커서**다. 상태 값 자체는 매번 새로 만들어지고 절대 변형되지 않는다.

```ts
class Master implements GameMaster {
  #state: GameState;          // 불변 값. 교체만 한다.
  #history: Choice[] = [];    // 리플레이용 선택 로그

  advance(): void { this.#state = advanceState(this.#state); }

  submit(id: PlayerId, choice: Choice): Approval {
    const verdict = this.approve(id, choice);
    if (!verdict.ok) return verdict;
    this.#state = applyChoice(this.#state, choice);
    this.#history.push(choice);
    return { ok: true };
  }

  snapshot(): GameState { return this.#state; }
}
```

`Player` 와 `Character` 는 **핸들**이다 — 자기 상태를 들지 않고 `(master, playerId)` 만 들고 매번 현재 상태에서 읽는다. 그래서 핸들을 오래 붙들고 있어도 낡지 않는다.

이 구조가 지키는 것:

- **시드 재현** — `{ config, history }` 만으로 판이 되살아난다. `replay()` 는 그대로 쓴다.
- **스냅샷 테스트** — `gm.snapshot()` 이 JSON 이라 지문 비교가 가능하다.
- **카드 68장 불변식** — 상태 값이 통째로 검사 가능하다([invariants.ts](src/engine/rules/invariants.ts)).

### pull 방식인데 왜 pending 이 아직 필요한가

내부적으로는 "지금 누구에게 무엇을 묻는가" 를 상태에 들고 있어야 한다. 그러지 않으면 중단된 판을 저장했다 이어갈 수 없다. **바뀌는 것은 봇이 그걸 직접 읽지 않는다는 점**이다 — `gm.promptFor(id)` / `gm.optionsFor(id)` 가 유일한 통로가 되고, 상태의 그 필드는 구현 세부가 된다.

---

## 3. 디렉터리 — 무엇을 다시 짓고 무엇을 그대로 두는가

```
src/engine/
├─ index.ts              ◆ 재작성 — createGame(config): GameMaster
├─ master/               ◆ 신규 — 인터페이스 계층
│  ├─ types.ts             GameMaster / Player / Character / Approval
│  ├─ master.ts            Master 구현 (커서)
│  ├─ player.ts            Player 핸들
│  └─ character.ts         Character 핸들
├─ flow/                 ◆ 재작성 — 구 phases/ 를 진행 단계로 재정리
│  ├─ advance.ts           입력 없는 전이 (구 machine.advance)
│  ├─ selection.ts         선택 단계
│  ├─ action.ts            순번 호명
│  ├─ turn.ts              한 차례
│  └─ scoring.ts           점수 계산
├─ options/              ◆ 재작성 — 구 query.ts
│  ├─ enumerate.ts         합법 선택지 열거
│  └─ approve.ts           승인 (구 isLegal)
├─ state/                ○ 이름만 정리 — 구 types/
│  ├─ game-state.ts        GameState, Phase, TurnState …
│  ├─ prompt.ts            Prompt / Choice  (구 PendingDecision / AnyChoice)
│  ├─ event.ts  ids.ts
├─ rules/                ● 그대로 — build, income, rank8, deck, selection-table, invariants
├─ effects/              ● 그대로 — hooks, registry, ctx, resolvers, characters/(8), buildings/(14)
├─ rng.ts                ● 그대로
└─ view.ts               ○ Player.view() 뒤로 들어감
```

◆ 재작성 · ○ 이동/개명 · ● 유지

**규칙과 카드 효과는 손대지 않는다.** 이번 변경은 "누가 무엇을 시키는가" 이지 "규칙이 무엇인가" 가 아니다. `rules/` 와 `effects/` 22개 파일이 그대로 살아남는 것이 이 재작성이 안전한 이유다.

### 개명

`PendingDecision` → `Prompt`, `AnyChoice` → `Choice`. GameMaster 문맥에서 훨씬 자연스럽고, tsc 가 모든 호출부를 잡아주는 기계적 변경이다(약 30곳). 별칭은 남기지 않는다 — 두 이름이 공존하면 어느 쪽이 정본인지 흐려진다.

---

## 4. 루프가 어떻게 바뀌는가

```ts
// 지금 — 봇이 상태 내부를 들여다본다
while (!isOver(state)) {
  if (state.pending) {
    const choice = await agent.decide(viewFor(state, state.pending.player), state.pending);
    state = applyChoice(state, choice);
  } else state = step(state);
}

// 새로 — 게임 마스터에게 묻고 제출한다
while (!gm.isOver()) {
  const player = gm.awaiting();
  if (!player) { gm.advance(); continue; }

  const choice = await agent.decide(player.view(), player.prompt()!);
  const verdict = player.submit(choice);
  if (!verdict.ok) throw new Error(`거절됨: ${verdict.reason}`);
}
```

`Agent` 인터페이스는 **바뀌지 않는다** — 여전히 `decide(view, prompt)` 다. 봇 코드는 `PendingDecision` → `Prompt` 개명 외에 손댈 것이 없다.

---

## 5. 주변 레이어가 받는 영향

| 레이어 | 영향 | 이유 |
|---|---|---|
| `src/data` | 없음 | 코드젠·카드 데이터는 엔진 구조와 무관 |
| `src/bot` | 개명만 | `query`/`rng`/`types`/`view` 만 참조 — 구동 API 를 안 씀 |
| `src/runtime/runner.ts` | 재작성(작음) | 위 루프로 교체. 30줄 남짓 |
| `src/runtime/replay.ts` | 소폭 | `{config, history}` 를 GameMaster 로 재생 |
| `src/ui` | 소폭 | `GameState` 직접 읽기 → `gm.snapshot()`. 컴포넌트는 그대로 |
| `tests` | 개명 + 헬퍼 조정 | [builder.ts](tests/helpers/builder.ts) 가 GameMaster 를 만들도록 |

---

## 6. 마일스톤

| # | 내용 | 완료 정의 |
|---|---|---|
| **R0** | 골든 스냅샷 확보 | 현재 엔진으로 시드 0~49 × 4~7인의 승자·점수·최종 상태 지문을 `tests/golden/` 에 기록. **재작성 전에 반드시 먼저 한다** |
| **R1** | `state/` 정리 + 개명 | `Prompt`/`Choice` 로 바뀐 상태에서 기존 78개 테스트 전부 통과 (구조는 아직 그대로) |
| **R2** | `master/` 3인터페이스 + `flow/` | `createGame()` 이 GameMaster 를 돌려주고, 새 루프로 헤드리스 완주 |
| **R3** | 주변 레이어 이관 | runner·replay·ui·tests 가 GameMaster 만 쓰게 됨. 구 `step`/`applyChoice` 공개 API 제거 |
| **R4** | 골든 대조 | R0 스냅샷과 **완전 일치**. 78개 테스트 + 1000판 퍼즈 통과 |

R1 을 따로 두는 이유: 개명과 구조 변경을 한 커밋에 섞으면, 깨졌을 때 둘 중 무엇 때문인지 가릴 수 없다.

---

## 7. 검증

```bash
npx vitest run                      # 기존 78개 — 규칙이 안 변했음을 증명
npm run fuzz                        # 1000판 × 불변식
npx vitest run tests/golden.spec.ts # ★ R0 스냅샷과 비트 단위 일치
npm run arena -- --a normal --b random   # 승률 99.5% 유지 (봇 행동 불변)
npm run sim -- --seed 0 --players 4 --verbose
npm run dev                         # 관전 화면 완주
```

**골든 대조가 이번 작업의 핵심 검증이다.** 규칙을 안 바꿨으므로 같은 시드는 같은 판이 나와야 한다. 이것이 성립하려면 **RNG 소비 순서가 똑같아야 한다** — 셔플·뽑기 호출 순서를 바꾸지 않도록 `flow/` 를 옮길 때 주의한다. 만약 순서가 불가피하게 달라지면 골든은 폐기하고 78개 테스트 + 퍼즈로 판정하되, **그 사실을 커밋 메시지에 명시**한다. 조용히 넘어가면 회귀를 놓친다.

---

## 8. 하지 않는 것

규칙 변경 · 카드 효과 수정 · 추천 조합 6모드 추가 · 사람 1인 투입 · 봇 정책 개선 · UI 재디자인 · 상태를 가변 객체로 바꾸기 · `Prompt`/`Choice` 외의 개명

---

## 9. 미리 짚어둘 위험

1. **핸들이 낡는 문제** — `Player` 핸들이 상태 스냅샷을 들고 있으면 `submit()` 이후 낡은 값을 읽는다. 핸들은 반드시 `(master, id)` 만 들고 매번 현재 상태에서 읽도록 한다.
2. **`Character` 를 상태로 착각하기** — 캐릭터 핸들은 `PlayerState.character` 슬롯을 읽는 창일 뿐이고, 능력의 실제 구현은 `effects/characters/` 에 그대로 남는다. 핸들에 로직을 옮기면 훅 레지스트리와 이중화된다.
3. **`approve` 와 `submit` 의 중복 검증** — `submit` 은 반드시 `approve` 를 거치게 하고, 검증 로직을 두 벌 쓰지 않는다.

---

# 진행 기록

R0~R4 완료. 엔진이 `GameMaster → Player → Character` 인터페이스로 다시 서고, **규칙은 한 줄도 바뀌지 않았다.**

| # | 내용 | 커밋 |
|---|---|---|
| R0 | 골든 스냅샷 400판 고정 | `b676bda` |
| R1 | `Prompt`/`Choice` 개명 + `state/` 정리 | `3025bba` |
| R2 | `master/` 3인터페이스 + `flow/` + `options/` | `34bbad8` |
| R3 | 주변 레이어 이관, 구 API 제거 | `14dc5cd` |

## 검증 결과

| 항목 | 결과 |
|---|---|
| 골든 400판 | **완전 일치** — 라운드·승자·점수·선택 수·최종 상태 해시 |
| 테스트 | 96개 통과 (재작성 전 78 + 인터페이스 전용 15 + 골든 3) |
| 1000판 퍼즈 | 통과 |
| 아레나 | normal vs random 99.5%, 평균 25.9 vs 8.9 — 재작성 전과 **같은 숫자** |
| 시뮬레이터 | 시드 12 → P3 30점(23+3+4) — 재작성 전과 동일 |
| 관전 UI | 시드 0 → P1 27점 — 재작성 전과 동일 |

골든이 비트 단위로 맞았다는 것은 **RNG 소비 순서가 그대로 살아남았다**는 뜻이다. 구조를 옮기면서 셔플·뽑기 호출 순서를 건드리지 않았다는 증거이고, 이 재작성이 안전했다는 가장 강한 신호다.

## 설계에서 실제로 값어치가 있었던 것

- **커서 모델.** `GameMaster` 가 불변 상태를 가리키는 참조를 교체할 뿐이라, pull 방식 API 를 얻으면서도 스냅샷·리플레이·불변식이 전부 살아남았다.
- **핸들은 상태를 들지 않는다.** `Player`/`Character` 가 `(master, id)` 만 들고 매번 현재 상태를 읽는다. 스냅샷을 캐시했다면 `submit()` 직후 낡은 값을 보게 됐을 것이다. 테스트로 못 박아뒀다.
- **`approve` 가 이유를 돌려준다.** 불리언이던 `isLegal` 을 판정+이유로 바꾸니, 거절이 디버깅 가능한 사건이 됐다. `submit` 은 반드시 `approve` 를 거치므로 검증이 한 벌뿐이다.
- **규칙을 안 건드린 것.** `rules/` 와 `effects/` 22개 파일을 그대로 두었기에 골든 대조가 성립했다. 규칙과 구조를 같이 바꿨다면 무엇이 깨졌는지 알 수 없었을 것이다.

## 계획에서 바뀐 것

- **`GameHooks.incomeKind` 추가.** `Character.pendingIncome()` 이 답하려면 "이 캐릭터가 어떤 종류를 세는가" 를 알아야 한다. 핸들에 매핑을 따로 만들면 지급 코드와 어긋나므로, 선언을 지급 코드 옆(각 캐릭터 파일)에 두었다.
- **`Prompt.prompt` → `Prompt.text`.** 타입과 필드가 이름을 공유하면 `p.prompt` 가 읽히지 않는다. 개명의 직접적 여파라 함께 처리했다.
- **기존 스펙은 `snapshot()` 경유로 최소 수정.** 700줄짜리 어서션을 다시 쓰는 대신 접근 경로만 옮기고, 새 인터페이스는 `tests/master.spec.ts` 15개로 따로 검증했다.

## 알아둘 것

- `Character.abilities()` 는 **선택지 전부가 아니다.** 차례 메뉴는 캐릭터 능력 + 도시의 특수 건물(실험실·대장간) + 기본 행동에서 모이므로, 권위 있는 목록은 `Player.options()` 다. 이 구분이 무너지면 건물 능력이 조용히 사라진다 — `tests/master.spec.ts` 의 마지막 테스트가 이걸 지킨다.
- `npm run golden` 으로 골든을 다시 뜰 수 있다. **규칙을 의도적으로 바꿀 때만** 다시 뜨고, 그 사실을 커밋에 남긴다.
- macOS `sed` 는 `\b` 워드 경계를 지원하지 않는다. 식별자 일괄 치환은 python 을 쓴다.
