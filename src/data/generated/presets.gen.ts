// 이 파일은 `npm run gen` 이 생성합니다. 직접 수정하지 마세요.
// 원본: preset.md

export const PRESETS = {
  basic: {
    id: 'basic',
    name: "기본 조합",
    description: "처음 배울 때 쓰는 세트",
    characters: ['assassin', 'thief', 'magician', 'king', 'bishop', 'merchant', 'architect', 'warlord'],
    rank9: null,
    uniques: ['dragon_gate', 'factory', 'ghost_district', 'imperial_treasury', 'keep', 'laboratory', 'library', 'map_room', 'quarry', 'school_of_magic', 'smithy', 'statue', 'thieves_den', 'wishing_well'],
  },
} as const;

export type PresetId = keyof typeof PRESETS;

export const PRESET_IDS = Object.keys(PRESETS) as PresetId[];
