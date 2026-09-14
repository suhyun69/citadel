import type { CharacterId } from '@/data/types';
import type { GameState } from '../../state/game-state';
import type { GameHooks } from '../hooks';
import { charactersInGame, rankOf } from './_shared';

export const WITCH_ID = 'witch' as CharacterId;

/**
 * 마법을 걸 수 있는 캐릭터.
 *
 * 1번 캐릭터는 뺀다 — 마녀 자신이 1번이고, 자기에게 마법을 거는 것은 규칙이
 * 그리는 그림(능력을 **빼앗아** 쓴다)에 담기지 않는다.
 */
export const bewitchTargets = (state: GameState): CharacterId[] =>
  charactersInGame(state).filter((id) => rankOf(id) !== 1);

/**
 * 마녀 — 남의 능력과 건설 기회를 통째로 빼앗아 자기가 쓴다.
 *
 * 훅이 비어 있는 것은 이 카드가 아무것도 안 해서가 아니라, 하는 일이 전부
 * **차례의 모양 자체를 바꾸는** 것이기 때문이다. 규칙은 마녀에게 선택지를
 * 주지 않는다 — "반드시 자원 얻기 행동을 먼저 한 뒤에, 반드시 마법을 걸
 * 캐릭터의 이름을 선언하고 자기 차례를 멈춥니다"(howto.md:226). 그래서
 * 차례 메뉴가 아예 열리지 않고, rules/witch.ts 가 흐름에서 직접 처리한다.
 */
export const witch: GameHooks = {};
