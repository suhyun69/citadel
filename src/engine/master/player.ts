import { isCityComplete } from '../rules/build';
import type { CityEntry, PlayerState } from '../state/game-state';
import type { CardId, PlayerId } from '../state/ids';
import type { Choice, Prompt } from '../state/prompt';
import { viewFor, type PlayerView } from '../view';
import { CharacterHandle } from './character';
import type { Approval, Character, MasterAccess, Player } from './types';

/**
 * 플레이어 핸들.
 *
 * 상태를 들지 않고 매번 현재 상태에서 읽는다. 그래서 핸들을 오래 붙들고
 * 있어도 낡지 않는다 — submit() 으로 상태가 교체돼도 다음 호출은 새 값을 본다.
 */
export class PlayerHandle implements Player {
  readonly #character: CharacterHandle;

  constructor(
    private readonly master: MasterAccess,
    readonly id: PlayerId,
  ) {
    this.#character = new CharacterHandle(master, id);
  }

  #self(): PlayerState {
    const p = this.master.state().players[this.id];
    if (!p) throw new Error(`알 수 없는 플레이어: ${this.id}`);
    return p;
  }

  gold(): number {
    return this.#self().gold;
  }
  hand(): readonly CardId[] {
    return this.#self().hand;
  }
  city(): readonly CityEntry[] {
    return this.#self().city;
  }
  isCityComplete(): boolean {
    return isCityComplete(this.master.state(), this.id);
  }
  hasCrown(): boolean {
    return this.master.state().crowned === this.id;
  }

  character(): Character | null {
    return this.#self().character ? this.#character : null;
  }

  view(): PlayerView {
    return viewFor(this.master.state(), this.id);
  }

  prompt(): Prompt | null {
    return this.master.promptFor(this.id);
  }
  options(): Choice[] | null {
    return this.master.optionsFor(this.id);
  }
  submit(choice: Choice): Approval {
    return this.master.submit(this.id, choice);
  }
}
