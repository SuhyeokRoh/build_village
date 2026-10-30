'use strict';
// ───────────────────────────────────────────────
// 게임 데이터: 시간, 등급, 건물, 세력, 이름
// ───────────────────────────────────────────────
const SEASONS = ['봄', '여름', '가을', '겨울'];
const DAYS_PER_SEASON = 10;
const SHICHEN = [
  ['자시', '子時'], ['축시', '丑時'], ['인시', '寅時'], ['묘시', '卯時'], ['진시', '辰時'], ['사시', '巳時'],
  ['오시', '午時'], ['미시', '未時'], ['신시', '申時'], ['유시', '酉時'], ['술시', '戌時'], ['해시', '亥時'],
];
function shichenOf(hour) { return SHICHEN[Math.floor(((hour + 1) % 24) / 2)]; }

const RESOURCES = {
  silver: { name: '은자', hanja: '銀', unit: '냥' },
  food: { name: '식량', hanja: '食', unit: '섬' },
  wood: { name: '목재', hanja: '木', unit: '' },
  stone: { name: '석재', hanja: '石', unit: '' },
  weapons: { name: '병장기', hanja: '兵', unit: '' },
};

// 인구에 따른 마을 등급
const RANKS = [
  { name: '촌(村)', short: '村', minPop: 0 },
  { name: '마을', short: '里', minPop: 15 },
  { name: '읍(邑)', short: '邑', minPop: 35 },
  { name: '진(鎭)', short: '鎭', minPop: 70 },
  { name: '현성(縣城)', short: '城', minPop: 120 },
];

// 무공 경지
const REALMS = ['삼류', '이류', '일류', '절정', '초절정', '화경', '현경'];
function realmOf(m) { return REALMS[clamp(Math.floor(m), 0, REALMS.length - 1)]; }

// 건물 정의
// light: [x, y, 반경(타일), 색, 높이?] — 발판 좌상단 기준 타일 단위. 높이(월드 px)가 없으면 lightLift(기본 16)만큼 땅에서 띄운다
// walkRows: 발판 아래쪽에서 사람이 드나들 수 있는 줄 수 (마당/밭)
const BUILD_CATS = [
  { id: 'home', name: '주거' },
  { id: 'prod', name: '생산' },
  { id: 'trade', name: '상업' },
  { id: 'civic', name: '민생' },
  { id: 'martial', name: '무림·방어' },
  { id: 'tools', name: '길·정리' },
];

const BDEF = {
  manor: {
    name: '영주관', hanja: '領', w: 3, h: 3, top: 1.4, cost: {}, hp: 900, time: 0, housing: 6,
    cat: null, unique: true, storage: 200,
    desc: '마을의 심장. 이곳이 무너지면 마을은 다른 세력의 손에 넘어간다.',
    light: [[0.45, 2.75, 3.2, '#ffb25a'], [2.55, 2.75, 3.2, '#ffb25a']], lightLift: 22,
  },
  house: {
    name: '초가', hanja: '家', w: 2, h: 2, top: 0.6, cost: { wood: 20 }, hp: 140, time: 5, housing: 5,
    cat: 'home', desc: '짚으로 지붕을 얹은 소박한 집. 다섯 식구가 산다.',
  },
  house2: {
    name: '기와집', hanja: '宅', w: 2, h: 2, top: 0.8, cost: { wood: 30, stone: 25, silver: 40 }, hp: 260, time: 9, housing: 8,
    cat: 'home', rank: 1, happy: 1.2, desc: '기와를 얹은 번듯한 집. 여덟 식구가 살고 민심이 조금 오른다.',
  },
  farm: {
    name: '논밭', hanja: '田', w: 3, h: 3, top: 0, cost: { wood: 10, silver: 10 }, hp: 80, time: 4, workers: 3,
    cat: 'prod', walkRows: 3, ground: true, desc: '곡식을 기른다. 가을에 수확이 가장 많고 겨울엔 거의 자라지 않는다.',
  },
  fishery: {
    name: '어장', hanja: '漁', w: 2, h: 2, top: 0.5, cost: { wood: 25 }, hp: 120, time: 5, workers: 2,
    cat: 'prod', needs: 'water', desc: '물가에 지어 물고기를 잡는다. 계절을 덜 탄다. 강물과 맞닿아야 한다.',
  },
  lumber: {
    name: '벌목장', hanja: '木', w: 2, h: 2, top: 0.5, cost: { wood: 10, silver: 10 }, hp: 120, time: 4, workers: 3,
    cat: 'prod', needs: 'forest', desc: '주변 숲에서 나무를 벤다. 숲이 가까울수록 많이 난다.',
  },
  quarry: {
    name: '채석장', hanja: '石', w: 2, h: 2, top: 0.4, cost: { wood: 25 }, hp: 160, time: 6, workers: 3,
    cat: 'prod', needs: 'rock', desc: '바위산에서 돌을 캔다. 바위가 가까워야 한다.',
  },
  warehouse: {
    name: '창고', hanja: '倉', w: 2, h: 2, top: 0.7, cost: { wood: 40 }, hp: 220, time: 7, storage: 250,
    cat: 'prod', desc: '식량·목재·석재·병장기를 각각 250씩 더 쌓아둘 수 있다.',
  },
  smithy: {
    name: '대장간', hanja: '鐵', w: 2, h: 2, top: 0.8, cost: { wood: 30, stone: 30, silver: 50 }, hp: 200, time: 9, workers: 2,
    cat: 'prod', rank: 1, desc: '석재와 목재로 병장기를 만든다. 병장기를 갖춘 무사는 훨씬 강하다.',
    light: [[1.0, 1.7, 2.2, '#ff7a2a']], lightLift: 8,
  },
  market: {
    name: '시장', hanja: '市', w: 3, h: 2, top: 0.6, cost: { wood: 40, silver: 40 }, hp: 180, time: 9, workers: 2,
    cat: 'trade', rank: 1, happy: 5, desc: '장이 서면 은자가 돈다. 인구가 많을수록 수입이 늘고 민심이 오른다.',
    light: [[1.5, 1.8, 2.4, '#ffbe6a']], lightLift: 14,
  },
  inn: {
    name: '객잔', hanja: '客', w: 3, h: 2, top: 1.3, cost: { wood: 60, stone: 20, silver: 80 }, hp: 260, time: 12, workers: 2,
    cat: 'trade', rank: 1, happy: 3, indoor: true,
    desc: '떠돌이 무인과 나그네가 머무는 곳. 은자와 명성을 벌고, 이따금 고수가 찾아온다.',
    light: [[0.4, 1.9, 2.6, '#ff9a4a'], [2.6, 1.9, 2.6, '#ff9a4a']], lightLift: 20,
  },
  escort: {
    name: '표국', hanja: '鏢', w: 3, h: 3, top: 1.0, cost: { wood: 80, stone: 60, silver: 200 }, hp: 380, time: 18, workers: 4,
    cat: 'trade', rank: 2, fighter: true, walkRows: 1,
    desc: '표사들이 상단의 짐을 호위해 큰 은자를 번다. 습격 때는 표사들도 칼을 든다. 관도와 길로 이어져야 제값을 한다.',
    light: [[0.3, 2.9, 2.4, '#ffb25a'], [2.7, 2.9, 2.4, '#ffb25a']], lightLift: 18,
  },
  clinic: {
    name: '의원', hanja: '藥', w: 2, h: 2, top: 0.7, cost: { wood: 40, silver: 60 }, hp: 160, time: 9, workers: 1,
    cat: 'civic', rank: 1, indoor: true, desc: '다친 이를 돌보고 역병을 막는다. 부상자 회복이 빨라진다.',
    light: [[1.0, 1.9, 1.8, '#ffd27a']], lightLift: 14,
  },
  shrine: {
    name: '사당', hanja: '祠', w: 2, h: 2, top: 0.9, cost: { wood: 30, stone: 30, silver: 30 }, hp: 200, time: 9,
    cat: 'civic', happy: 8, fame: 0.4, desc: '조상과 산신께 제를 올리는 곳. 민심과 명성이 오른다.',
    light: [[1.0, 1.8, 2.0, '#ffcf6a']], lightLift: 10,
  },
  well: {
    name: '우물', hanja: '井', w: 1, h: 1, top: 0.4, cost: { stone: 10 }, hp: 120, time: 3,
    cat: 'civic', happy: 1, desc: '맑은 물. 민심이 조금 오르고 불이 나도 빨리 끌 수 있다.',
  },
  pavilion: {
    name: '정자', hanja: '亭', w: 2, h: 2, top: 0.8, cost: { wood: 30, stone: 10, silver: 30 }, hp: 140, time: 7,
    cat: 'civic', rank: 1, happy: 4, desc: '연못가의 정자. 저녁이면 사람들이 모여 담소를 나눈다.',
    light: [[1.0, 1.2, 1.8, '#ffcf8a']], lightLift: 20,
  },
  dojo: {
    name: '무관', hanja: '武', w: 3, h: 3, top: 1.1, cost: { wood: 60, stone: 40, silver: 100 }, hp: 420, time: 14, workers: 4,
    cat: 'martial', fighter: true, walkRows: 2, upkeep: 1,
    desc: '장정들이 무공을 익히는 곳. 여기서 일하는 이는 마을을 지키는 무사가 된다. 무사 한 명당 매일 은자 1냥.',
    light: [[0.25, 1.05, 2.4, '#ffa04a'], [2.75, 1.05, 2.4, '#ffa04a']], lightLift: 18,
  },
  tower: {
    name: '망루', hanja: '望', w: 1, h: 1, top: 2.0, cost: { wood: 25 }, hp: 200, time: 5, workers: 1,
    cat: 'martial', fighter: true, indoor: true, range: 6.5, upkeep: 0.5,
    desc: '궁수 한 명이 올라 멀리서 다가오는 적에게 화살을 쏜다.',
    light: [[0.5, 0.5, 2.6, '#ffa04a', 64]],
  },
  wall: {
    name: '목책', hanja: '柵', w: 1, h: 1, top: 0.4, cost: { wood: 3 }, hp: 160, time: 0.6,
    cat: 'martial', line: true, desc: '날카로운 말뚝 울타리. 적은 이것을 부숴야 지나갈 수 있다. 끌어서 길게 세울 수 있다.',
  },
  stonewall: {
    name: '석벽', hanja: '城', w: 1, h: 1, top: 0.6, cost: { stone: 6 }, hp: 520, time: 1.2,
    cat: 'martial', rank: 2, line: true, desc: '돌로 쌓은 튼튼한 성벽. 끌어서 길게 쌓을 수 있다.',
  },
  gate: {
    name: '성문', hanja: '門', w: 1, h: 1, top: 0.9, cost: { wood: 15 }, hp: 380, time: 2,
    cat: 'martial', desc: '마을 사람은 지나다니지만 적은 부숴야 들어온다.',
    light: [[0.5, 0.6, 1.8, '#ffa04a']], lightLift: 24,
  },
};
const BUILD_ORDER = ['house', 'house2', 'farm', 'fishery', 'lumber', 'quarry', 'warehouse', 'smithy', 'market', 'inn', 'escort',
  'clinic', 'well', 'shrine', 'pavilion', 'dojo', 'tower', 'wall', 'stonewall', 'gate'];

// 도구 (길, 벌채, 철거)
const TOOLS = {
  road: { name: '길', hanja: '道', cost: { silver: 1 }, desc: '사람들이 더 빨리 다닌다. 물 위에 놓으면 다리가 된다 (목재 6). 끌어서 깔 수 있다.' },
  clear: { name: '벌채', hanja: '伐', cost: { silver: 2 }, desc: '숲을 베어 땅을 고른다. 목재를 조금 얻는다.' },
  demolish: { name: '철거', hanja: '毁', cost: {}, desc: '건물이나 길을 허문다. 재료의 절반을 돌려받는다.' },
};

// 세력
const FACTIONS = {
  cheongun: {
    name: '청운검문', hanja: '靑', type: '정파(正派)', color: '#4f7fb8', dark: '#1f3550',
    desc: '구름 위의 검을 좇는 명문 정파. 의협을 중시하지만 체면도 그만큼 따진다.',
    unit: { name: '청운검수', hp: 55, atk: 7, weapon: 'sword', hat: 'band', cloth: '#dfe7ee', cloth2: '#4f7fb8' },
    leader: { title: '청운검객', hp: 300, atk: 18 },
    rivals: ['hyeolwol', 'cheolhyeol'], military: true, startRel: 10, baseSize: 6, growth: 0.3, goals: ['punish'],
    perk: '무사 수련 속도 +50%, 습격 때 원군 파견',
  },
  cheolhyeol: {
    name: '철혈방', hanja: '鐵', type: '사파(邪派)', color: '#a83a2e', dark: '#4a1712',
    desc: '강 나루와 도박장을 쥔 사파 방회. 돈이 되는 일이라면 가리지 않는다.',
    unit: { name: '철혈방도', hp: 46, atk: 6, weapon: 'blade', hat: 'band', cloth: '#3a2a26', cloth2: '#a83a2e' },
    leader: { title: '철혈향주', hp: 260, atk: 16 },
    rivals: ['cheongun'], military: true, startRel: -5, baseSize: 6, growth: 0.35, goals: ['loot', 'occupy'],
    perk: '도박장 수입(매일 은자), 습격 때 원군 파견. 관부의 눈총',
  },
  heukpung: {
    name: '흑풍채', hanja: '黑', type: '녹림(綠林)', color: '#4a403a', dark: '#1c1714',
    desc: '뒷산 험한 산채에 터를 잡은 산적 떼. 약한 마을의 곡식과 은자를 노린다.',
    unit: { name: '흑풍채 산적', hp: 32, atk: 4, weapon: 'axe', hat: 'hood', cloth: '#5a4a3c', cloth2: '#26201b' },
    leader: { title: '흑풍채주', hp: 180, atk: 12 },
    rivals: [], military: true, startRel: -30, baseSize: 4, growth: 0.3, goals: ['loot'], noLord: true,
  },
  hyeolwol: {
    name: '혈월교', hanja: '血', type: '마교(魔敎)', color: '#7a3394', dark: '#2c0f36',
    desc: '붉은 달을 섬기는 사교. 강호를 피로 물들이려는 야망을 숨기지 않는다.',
    unit: { name: '혈월교도', hp: 62, atk: 9, weapon: 'blade', hat: 'mask', cloth: '#2a1630', cloth2: '#b0263a' },
    leader: { title: '혈월사자', hp: 360, atk: 22 },
    rivals: ['cheongun', 'gwanbu'], military: true, startRel: -10, baseSize: 6, growth: 0.32, goals: ['occupy', 'loot'],
    perk: '무사 공격력 +30%, 은자 하사. 민심 -10, 정파와 관부의 적의',
  },
  gwanbu: {
    name: '관부', hanja: '官', type: '관청(官廳)', color: '#c79a2c', dark: '#4a3810',
    desc: '황제의 이름으로 세금을 걷고 법을 집행하는 현청. 무림의 일에는 되도록 끼지 않는다.',
    unit: { name: '관병', hp: 44, atk: 5, weapon: 'spear', hat: 'helmet', cloth: '#7a2a22', cloth2: '#c79a2c' },
    leader: { title: '관군 교위', hp: 240, atk: 14 },
    rivals: ['hyeolwol'], military: true, startRel: 20, baseSize: 8, growth: 0.35, goals: ['occupy'],
    perk: '세금 수입 +15%, 산적의 위협 절반',
  },
  geumryong: {
    name: '금룡상회', hanja: '金', type: '상단(商團)', color: '#cfa13a', dark: '#4a3a12',
    desc: '대륙을 오가는 거상들의 연합. 은자만 된다면 누구와도 거래한다.',
    rivals: [], military: false, startRel: 0,
    perk: '시장·객잔·표국 수입 +30%',
  },
};
const FACTION_ORDER = ['cheongun', 'cheolhyeol', 'heukpung', 'hyeolwol', 'gwanbu', 'geumryong'];

// 이름
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍',
  '전', '고', '문', '양', '손', '배', '백', '허', '남', '심', '노', '하', '곽', '성', '차', '주', '우', '구', '진', '위'];
const RARE_SURNAMES = ['제갈', '남궁', '독고', '모용', '황보', '사마', '당', '팽', '악', '단'];
const GIVEN_M = ['철', '무', '강', '혁', '진', '호', '산', '운', '풍', '석', '학', '준', '명', '광', '덕', '수', '천', '웅', '범', '용', '태', '현', '청', '한', '도', '평', '일', '성'];
const GIVEN_F = ['연', '화', '설', '매', '란', '옥', '향', '희', '영', '아', '소', '월', '비', '하', '련', '은', '령', '선', '주', '혜'];
const FOLK_M = ['돌쇠', '마당쇠', '개똥이', '억쇠', '칠복이', '만석이', '복동이', '먹쇠', '삼돌이', '덕팔이', '판수', '말똥이'];
const FOLK_F = ['꽃분이', '삼월이', '언년이', '복순이', '점순이', '간난이', '분이', '옥분이', '말순이', '곱단이'];
const HERO_TITLES = ['검객', '도객', '권사', '창객', '낭인', '협객', '은거기인', '여협', '취개'];
const EPITHETS = ['청풍', '일검', '광도', '무영', '철권', '비연', '월하', '독행', '백의', '취선', '추혼', '낙화', '뇌전', '한설'];

function makeName(sex, folk) {
  if (folk) return pick(sex === 'f' ? FOLK_F : FOLK_M);
  const sur = Math.random() < 0.06 ? pick(RARE_SURNAMES) : pick(SURNAMES);
  const pool = sex === 'f' ? GIVEN_F : GIVEN_M;
  return sur + pick(pool) + (Math.random() < 0.75 ? pick(pool) : '');
}

const VILLAGE_NAMES = ['청석촌', '하운촌', '송림촌', '백하촌', '도화촌', '월계촌', '낙안촌', '풍림촌', '운산촌', '청하촌'];

// 한자 풀이: 화면의 한자 위에 커서를 올리면 이 풀이가 뜬다 (js/tips.js)
// [훈음, 설명]
const HANJA_GLOSS = {
  '銀': ['은 은', '은자. 마을의 돈. 세금과 장사로 벌고, 건설·품삯·공물에 쓴다.'],
  '食': ['밥 식', '식량. 한 사람이 하루에 2섬을 먹는다. 떨어지면 굶주림으로 민심이 무너진다.'],
  '木': ['나무 목', '목재. 벌목장에서 얻는다. 거의 모든 건물에 들어간다.'],
  '石': ['돌 석', '석재. 채석장에서 얻는다. 튼튼한 건물과 성벽, 병장기에 쓴다.'],
  '兵': ['군사 병', '병장기. 대장간에서 만든다. 있으면 무사와 궁수가 더 세게 친다.'],
  '人': ['사람 인', '인구 / 집. 빈 집이 있어야 새 식구가 찾아온다.'],
  '心': ['마음 심', '민심. 백성의 마음. 높으면 사람이 모이고 세금이 잘 걷히며, 25 아래면 사람들이 떠난다.'],
  '武': ['굳셀 무', '무력. 무사·객경·망루를 합친 마을의 방어력.'],
  '名': ['이름 명', '명성. 강호에 알려진 정도. 높을수록 사람과 고수와 사건이 몰려온다.'],
  '村': ['마을 촌', '촌. 가장 작은 마을 등급.'],
  '里': ['마을 리', '마을. 인구 15명 이상. 기와집·시장·객잔 등을 지을 수 있다.'],
  '邑': ['고을 읍', '읍. 인구 35명 이상. 표국과 석벽을 지을 수 있다.'],
  '鎭': ['진압할 진', '진. 인구 70명 이상의 큰 고을.'],
  '城': ['재 성', '현성. 인구 120명 이상. 성벽을 두른 고을. 최종 목표의 하나.'],
  '領': ['거느릴 령', '영주관. 영주가 머물며 다스리는 곳.'],
  '家': ['집 가', '초가. 짚으로 지붕을 얹은 집.'],
  '宅': ['집 택', '기와집. 기와를 얹은 번듯한 집.'],
  '田': ['밭 전', '논밭. 곡식을 기른다.'],
  '漁': ['고기 잡을 어', '어장. 물고기를 잡는다.'],
  '倉': ['곳집 창', '창고. 물자를 더 쌓아 둔다.'],
  '鐵': ['쇠 철', '대장간 / 철혈방. 쇠를 다루는 곳, 또는 쇠처럼 냉혹한 사파 방회.'],
  '市': ['저자 시', '시장. 장이 서는 곳.'],
  '客': ['손 객', '객잔 / 손님. 나그네가 묵는 곳. 떠돌이 고수가 찾아온다.'],
  '鏢': ['표 표', '표국. 상단의 짐(표물)을 호위하는 무인들.'],
  '藥': ['약 약', '의원. 병을 고치는 곳.'],
  '祠': ['사당 사', '사당. 조상과 산신께 제를 올리는 곳.'],
  '井': ['우물 정', '우물. 마실 물이자 불을 끄는 물.'],
  '亭': ['정자 정', '정자. 쉬어 가는 누각.'],
  '望': ['바랄 망', '망루. 멀리 내다보는 높은 대.'],
  '柵': ['울타리 책', '목책. 말뚝을 박아 세운 울타리.'],
  '門': ['문 문', '성문. 마을 사람만 드나드는 문.'],
  '道': ['길 도', '길. 사람들이 더 빨리 다닌다.'],
  '伐': ['칠 벌', '벌채. 숲의 나무를 벤다.'],
  '毁': ['헐 훼', '철거. 건물을 허문다.'],
  '靑': ['푸를 청', '청운검문. 구름 위의 검을 좇는 정파.'],
  '黑': ['검을 흑', '흑풍채. 뒷산의 산적 떼.'],
  '血': ['피 혈', '혈월교. 붉은 달을 섬기는 마교.'],
  '官': ['벼슬 관', '관부. 세금을 걷고 법을 집행하는 현청.'],
  '金': ['쇠 금', '금룡상회. 대륙을 오가는 거상 연합. 또는 돈과 관련된 일.'],
  '賊': ['도둑 적', '도적·산적과 얽힌 일.'],
  '稅': ['세금 세', '세금과 관련된 일.'],
  '傷': ['다칠 상', '다친 사람과 얽힌 일.'],
  '秘': ['숨길 비', '비밀·비급과 얽힌 일.'],
  '疫': ['전염병 역', '역병.'],
  '旱': ['가물 한', '가뭄.'],
  '豊': ['풍년 풍', '풍년.'],
  '商': ['장사 상', '장사·상단과 얽힌 일.'],
  '民': ['백성 민', '백성과 얽힌 일.'],
  '亂': ['어지러울 란', '난리·전쟁.'],
  '鬪': ['싸울 투', '싸움·결투.'],
  '火': ['불 화', '불·화재.'],
  '節': ['마디 절', '명절.'],
  '諜': ['염탐할 첩', '첩자.'],
  '窟': ['굴 굴', '동굴.'],
  '囍': ['쌍희 희', '혼례의 경사.'],
  '修': ['닦을 수', '수련.'],
  '才': ['재주 재', '타고난 재능.'],
  '虎': ['범 호', '호랑이.'],
  '降': ['항복할 항', '투항.'],
  '告': ['알릴 고', '알림.'],
  '任': ['맡길 임', '임명.'],
  '戰': ['싸울 전', '전투의 결과.'],
  '復': ['회복할 복', '되찾음.'],
  '敗': ['패할 패', '패배.'],
  '陷': ['빠질 함', '함락.'],
  '終': ['마칠 종', '끝.'],
  '事': ['일 사', '사건.'],
  '疏': ['트일 소', '상소. 백성이 영주에게 올리는 글.'],
  '吏': ['벼슬아치 리', '이방(吏房). 인사와 행정을 맡는 부서.'],
  '戶': ['지게 호', '호방(戶房). 호구·세금·곡식을 맡는 부서.'],
  '禮': ['예도 례', '예방(禮房). 제사·잔치·교육·민심을 맡는 부서.'],
  '刑': ['형벌 형', '형방(刑房). 치안과 재판을 맡는 부서.'],
  '工': ['장인 공', '공방(工房). 건설과 길을 맡는 부서.'],
  '房': ['방 방', '관아의 부서. 육방(六房)은 여섯 부서를 말한다.'],
  '領主館': ['영주관', '영주가 머물며 다스리는 관아.'],
  '客棧': ['객잔', '나그네가 묵어가는 여관 겸 주막.'],
  '鏢局': ['표국', '표사들이 상단의 짐을 호위하는 곳.'],
  '武館': ['무관', '무예를 가르치는 도장.'],
  '酒': ['술 주', '술을 판다는 깃발.'],
  '江湖村領主記': ['강호촌 영주기', '강호(무림 세계)에 있는 마을의 영주 이야기.'],
};
// 시진의 현대 시각
const SHICHEN_HOURS = ['밤 11시~새벽 1시', '새벽 1~3시', '새벽 3~5시', '새벽 5~7시', '아침 7~9시', '오전 9~11시', '낮 11시~오후 1시', '오후 1~3시', '오후 3~5시', '저녁 5~7시', '저녁 7~9시', '밤 9~11시'];
function glossOf(text) {
  const g = HANJA_GLOSS[text];
  if (g) return { title: `${text} · ${g[0]}`, body: g[1] };
  const chars = [...String(text)].filter(ch => HANJA_GLOSS[ch]);
  if (!chars.length) return null;
  return { title: text, body: chars.map(ch => `${ch} (${HANJA_GLOSS[ch][0]})`).join(' · ') };
}
