/**
 * 한글 카드 이름 → ascii 슬러그 수동 매핑.
 *
 * 이 테이블은 단순한 번역표가 아니라 **오타 감지기**다. 파서는 md에서 읽은 이름이
 * 이 테이블에 없으면 실패한다. 따라서 md에서 `상인`이 `사인`으로 바뀌는 순간
 * 빌드가 깨진다. 반대로 여기에만 있고 md에 없는 키도 에러다.
 * 이 파일을 고칠 때는 반드시 md 원문과 함께 확인할 것.
 */

/** 건물 title → 슬러그. 서로 다른 title 47개 (기본 17 + 특수 30). */
export const BUILDING_SLUGS = {
  // 종교 4
  사원: 'temple',
  예배당: 'chapel',
  수도원: 'monastery',
  대성당: 'cathedral',
  // 군사 4
  망루: 'watchtower',
  감옥: 'prison',
  병영: 'barracks',
  요새: 'fortress',
  // 귀족 3
  저택: 'manor',
  성: 'castle',
  궁전: 'palace',
  // 상업 6
  술집: 'tavern',
  교역소: 'trading_post',
  시장: 'market',
  부두: 'docks',
  항구: 'harbor',
  시청: 'town_hall',
  // 특수 30
  마구간: 'stables',
  '유령 지구': 'ghost_district',
  병기고: 'armory',
  골조: 'framework',
  외성: 'keep',
  동상: 'statue',
  박물관: 'museum',
  기념물: 'monument',
  구빈원: 'poor_house',
  바실리카: 'basilica',
  천문대: 'observatory',
  의사당: 'capitol',
  공동묘지: 'graveyard',
  상아탑: 'ivory_tower',
  공장: 'factory',
  '제국 보고': 'imperial_treasury',
  실험실: 'laboratory',
  '지도 보관실': 'map_room',
  채석장: 'quarry',
  대장간: 'smithy',
  '소원의 우물': 'wishing_well',
  장성: 'great_wall',
  공원: 'park',
  금광: 'gold_mine',
  극장: 'theater',
  '드래곤 게이트': 'dragon_gate',
  도서관: 'library',
  마법학교: 'school_of_magic',
  '도적 소굴': 'thieves_den',
  '비밀 금고': 'secret_vault',
} as const;

/** 캐릭터 name → 슬러그. 순번 1~9 × 3종 = 27개. */
export const CHARACTER_SLUGS = {
  암살자: 'assassin',
  마녀: 'witch',
  치안판사: 'magistrate',
  도둑: 'thief',
  첩자: 'spy',
  협박범: 'blackmailer',
  마술사: 'magician',
  마법사: 'wizard',
  예언자: 'seer',
  왕: 'king',
  황제: 'emperor',
  대공: 'archduke',
  주교: 'bishop',
  수도원장: 'abbot',
  추기경: 'cardinal',
  상인: 'merchant',
  연금술사: 'alchemist',
  교역상: 'trader',
  건축가: 'architect',
  항해사: 'navigator',
  학자: 'scholar',
  장군: 'warlord',
  외교관: 'diplomat',
  육군대장: 'marshal',
  예술가: 'artist',
  왕비: 'queen',
  세리: 'tax_collector',
} as const;

export type BuildingTitleKo = keyof typeof BUILDING_SLUGS;
export type CharacterNameKo = keyof typeof CHARACTER_SLUGS;
