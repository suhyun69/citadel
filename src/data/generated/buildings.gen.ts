// 이 파일은 `npm run gen` 이 생성합니다. 직접 수정하지 마세요.
// 원본: building.md

export const BUILDING_DEFS = {
  armory: { id: 'armory', title: "병기고", kind: 'unique', cost: 3, copies: 1, text: "자기 차례에, 병기고를 파괴하고 다른 건물 1채를 파괴할 수 있습니다." },
  barracks: { id: 'barracks', title: "병영", kind: 'military', cost: 3, copies: 3, text: "" },
  basilica: { id: 'basilica', title: "바실리카", kind: 'unique', cost: 4, copies: 1, text: "게임이 종료되었을 때, 자기 도시의 건물 중 건설비용이 홀수인 건물당 추가로 1점을 받습니다." },
  capitol: { id: 'capitol', title: "의사당", kind: 'unique', cost: 5, copies: 1, text: "게임이 종료되었을 때 자기 도시에 같은 종류의 건물이 최소 3채 건설되어 있다면 추가로 3점을 받습니다." },
  castle: { id: 'castle', title: "성", kind: 'noble', cost: 4, copies: 4, text: "" },
  cathedral: { id: 'cathedral', title: "대성당", kind: 'religious', cost: 5, copies: 2, text: "" },
  chapel: { id: 'chapel', title: "예배당", kind: 'religious', cost: 2, copies: 3, text: "" },
  docks: { id: 'docks', title: "부두", kind: 'trade', cost: 3, copies: 3, text: "" },
  dragon_gate: { id: 'dragon_gate', title: "드래곤 게이트", kind: 'unique', cost: 6, copies: 1, text: "게임이 종료되면 추가로 2점을 받습니다." },
  factory: { id: 'factory', title: "공장", kind: 'unique', cost: 5, copies: 1, text: "특수 건물을 건설할 때 금화 1닢을 적게 냅니다." },
  fortress: { id: 'fortress', title: "요새", kind: 'military', cost: 5, copies: 2, text: "" },
  framework: { id: 'framework', title: "골조", kind: 'unique', cost: 3, copies: 1, text: "골조를 파괴하면 건설비용 지불 없이 건물 1채를 건설할 수 있습니다." },
  ghost_district: { id: 'ghost_district', title: "유령 지구", kind: 'unique', cost: 2, copies: 1, text: "게임이 종료되면 유령 지구를 원하는 종류의 건물로 간주합니다." },
  gold_mine: { id: 'gold_mine', title: "금광", kind: 'unique', cost: 6, copies: 1, text: "자원 얻기 행동으로 금화를 얻는다면, 금화 1닢을 추가로 얻습니다." },
  graveyard: { id: 'graveyard', title: "공동묘지", kind: 'unique', cost: 5, copies: 1, text: "자기 도시의 아무 건물 1채를 파괴하면 건설비용 지불 없이 공동묘지를 건설할 수 있습니다." },
  great_wall: { id: 'great_wall', title: "장성", kind: 'unique', cost: 6, copies: 1, text: "8번 캐릭터는 장성이 있는 도시 건물(장성 제외)에 능력을 사용할 때 금화 1닢을 더 내야 합니다." },
  harbor: { id: 'harbor', title: "항구", kind: 'trade', cost: 4, copies: 3, text: "" },
  imperial_treasury: { id: 'imperial_treasury', title: "제국 보고", kind: 'unique', cost: 5, copies: 1, text: "게임이 종료되면 개인 금고에 남아있는 금화 1닢당 1점씩을 추가로 받습니다." },
  ivory_tower: { id: 'ivory_tower', title: "상아탑", kind: 'unique', cost: 5, copies: 1, text: "게임이 종료되었을 때 자기 도시에 특수 건물이 상아탑뿐이라면 추가로 5점을 받습니다." },
  keep: { id: 'keep', title: "외성", kind: 'unique', cost: 3, copies: 1, text: "절대로 8번 캐릭터 능력의 목표가 되지 않습니다." },
  laboratory: { id: 'laboratory', title: "실험실", kind: 'unique', cost: 5, copies: 1, text: "차례마다 한 번, 손에 든 카드 1장을 버리고 금화 2닢을 받습니다." },
  library: { id: 'library', title: "도서관", kind: 'unique', cost: 6, copies: 1, text: "자원 얻기 행동으로 건물 카드를 얻는다면, 가져간 카드를 전부 손에 듭니다." },
  manor: { id: 'manor', title: "저택", kind: 'noble', cost: 3, copies: 5, text: "" },
  map_room: { id: 'map_room', title: "지도 보관실", kind: 'unique', cost: 5, copies: 1, text: "게임이 종료되면 손에 든 건물 카드 1장당 1점씩을 추가로 받습니다." },
  market: { id: 'market', title: "시장", kind: 'trade', cost: 2, copies: 4, text: "" },
  monastery: { id: 'monastery', title: "수도원", kind: 'religious', cost: 3, copies: 3, text: "" },
  monument: { id: 'monument', title: "기념물", kind: 'unique', cost: 4, copies: 1, text: "자기 도시에 건물이 5채 이상 건설되어 있다면 기념물을 건설할 수 없습니다. 기념물은 도시 완성을 판별할 때 건물 2채로 간주합니다." },
  museum: { id: 'museum', title: "박물관", kind: 'unique', cost: 4, copies: 1, text: "차례마다 한 번, 손에 든 건물 카드 1장을 박물관 아래 넣습니다. 게임이 종료되면 박물관 아래 있는 카드 1장당 1점을 받습니다." },
  observatory: { id: 'observatory', title: "천문대", kind: 'unique', cost: 4, copies: 1, text: "자원 얻기 행동으로 건물 카드를 얻는다면, (2장이 아니라) 3장을 가져가서 살펴봅니다." },
  palace: { id: 'palace', title: "궁전", kind: 'noble', cost: 5, copies: 3, text: "" },
  park: { id: 'park', title: "공원", kind: 'unique', cost: 6, copies: 1, text: "자기 차례를 끝냈을 때 손에 든 건물 카드가 없다면, 카드 2장을 받습니다." },
  poor_house: { id: 'poor_house', title: "구빈원", kind: 'unique', cost: 4, copies: 1, text: "자기 차례를 끝냈을 때 자기 개인 금고에 금화가 없다면 금화 1닢을 받습니다." },
  prison: { id: 'prison', title: "감옥", kind: 'military', cost: 2, copies: 3, text: "" },
  quarry: { id: 'quarry', title: "채석장", kind: 'unique', cost: 5, copies: 1, text: "이미 자신의 도시에 있는 건물과 이름이 똑같은 건물을 건설할 수 있습니다." },
  school_of_magic: { id: 'school_of_magic', title: "마법학교", kind: 'unique', cost: 6, copies: 1, text: "자신의 도시 건물 종류에 따라 자원을 받는 능력을 사용할 때, 마법학교를 원하는 종류의 건물로 간주합니다." },
  secret_vault: { id: 'secret_vault', title: "비밀 금고", kind: 'unique', cost: null, copies: 1, text: "비밀 금고는 절대로 도시에 건설할 수 없습니다. 게임이 종료되었을 때, 손에 든 비밀 금고를 공개하고 추가로 3점을 받습니다." },
  smithy: { id: 'smithy', title: "대장간", kind: 'unique', cost: 5, copies: 1, text: "차례마다 한 번, 금화 2닢을 내고 카드 3장을 받습니다." },
  stables: { id: 'stables', title: "마구간", kind: 'unique', cost: 2, copies: 1, text: "마구간 건설은 이번 차례의 건설 횟수에 포함되지 않습니다." },
  statue: { id: 'statue', title: "동상", kind: 'unique', cost: 3, copies: 1, text: "게임이 종료되었을 때 왕관을 가지고 있다면 추가로 5점을 받습니다." },
  tavern: { id: 'tavern', title: "술집", kind: 'trade', cost: 1, copies: 5, text: "" },
  temple: { id: 'temple', title: "사원", kind: 'religious', cost: 1, copies: 3, text: "" },
  theater: { id: 'theater', title: "극장", kind: 'unique', cost: 6, copies: 1, text: "선택 단계가 종료될 때, 다른 플레이어와 캐릭터 카드를 바꿀 수 있습니다." },
  thieves_den: { id: 'thieves_den', title: "도적 소굴", kind: 'unique', cost: 6, copies: 1, text: "도적 소굴을 건설할 때 건설비용의 일부 또는 전부를 (금화가 아니라) 건물 카드로 낼 수 있습니다(금화 1닢당 카드 1장)." },
  town_hall: { id: 'town_hall', title: "시청", kind: 'trade', cost: 5, copies: 2, text: "" },
  trading_post: { id: 'trading_post', title: "교역소", kind: 'trade', cost: 2, copies: 3, text: "" },
  watchtower: { id: 'watchtower', title: "망루", kind: 'military', cost: 1, copies: 3, text: "" },
  wishing_well: { id: 'wishing_well', title: "소원의 우물", kind: 'unique', cost: 5, copies: 1, text: "게임이 종료되면 자기 도시에 건설된 특수 건물 1채당(소원의 우물 포함) 추가로 1점씩을 받습니다." },
} as const;

export type BuildingDefId = keyof typeof BUILDING_DEFS;

/** kind === 'unique' 인 건물만 좁힌 유니온. 효과 레지스트리의 키가 된다. */
export type UniqueBuildingId = 'armory' | 'basilica' | 'capitol' | 'dragon_gate' | 'factory' | 'framework' | 'ghost_district' | 'gold_mine' | 'graveyard' | 'great_wall' | 'imperial_treasury' | 'ivory_tower' | 'keep' | 'laboratory' | 'library' | 'map_room' | 'monument' | 'museum' | 'observatory' | 'park' | 'poor_house' | 'quarry' | 'school_of_magic' | 'secret_vault' | 'smithy' | 'stables' | 'statue' | 'theater' | 'thieves_den' | 'wishing_well';

export const BUILDING_IDS = Object.keys(BUILDING_DEFS) as BuildingDefId[];
