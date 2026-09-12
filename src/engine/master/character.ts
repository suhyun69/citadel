import { characterDef, type BuildingKind } from '@/data/types';
import { makeCtx } from '../effects/ctx';
import { collectHookSources } from '../effects/registry';
import { countIncome } from '../rules/income';
import type { CharacterSlot } from '../state/game-state';
import type { PlayerId } from '../state/ids';
import type { MainAction } from '../state/prompt';
import type { Character, MasterAccess } from './types';

/**
 * 캐릭터 핸들.
 *
 * 상태를 들지 않고 `PlayerState.character` 슬롯을 매번 읽는 창이다. 능력의
 * 실제 구현은 effects/characters/ 에 그대로 있다 — 여기에 로직을 옮기면
 * 훅 레지스트리와 이중화된다.
 */
export class CharacterHandle implements Character {
  constructor(
    private readonly master: MasterAccess,
    private readonly owner: PlayerId,
  ) {}

  #slot(): CharacterSlot {
    const slot = this.master.state().players[this.owner]?.character;
    if (!slot) throw new Error(`P${this.owner} 는 캐릭터를 가지고 있지 않습니다`);
    return slot;
  }

  get id() {
    return this.#slot().characterId;
  }
  get rank() {
    return characterDef(this.id).rank;
  }
  get name() {
    return characterDef(this.id).name;
  }
  get text() {
    return characterDef(this.id).text;
  }

  isRevealed(): boolean {
    return this.#slot().revealed;
  }
  isKilled(): boolean {
    return this.#slot().killed;
  }
  hasActed(): boolean {
    return this.#slot().turnDone;
  }

  /** 캐릭터 훅만 골라 물어본다. 도시의 특수 건물은 Player.options() 가 챙긴다. */
  abilities(): readonly MainAction[] {
    const state = this.master.state();
    if (state.action?.turn?.playerId !== this.owner) return [];

    const ctx = makeCtx(state, this.owner);
    return collectHookSources(state, this.owner)
      .filter((s) => s.from.kind === 'character')
      .flatMap((s) => s.hooks.turnActions?.(ctx) ?? []);
  }

  pendingIncome(): { kind: BuildingKind; amount: number } | null {
    const state = this.master.state();
    const source = collectHookSources(state, this.owner).find(
      (s) => s.from.kind === 'character' && s.hooks.incomeKind,
    );
    const kind = source?.hooks.incomeKind;
    if (!kind) return null;

    return { kind, amount: countIncome(state, this.owner, kind, makeCtx(state, this.owner)) };
  }
}
