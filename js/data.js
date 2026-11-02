'use strict';
// ───────────────────────────────────────────────
// 게임 데이터: 시간, 등급, 건물, 계열·세력, 천하 지리, 이름
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
// walkRows: 발판의 문 쪽에서 사람이 드나들 수 있는 줄 수 (마당/밭). 처음 방향(dir 0)이면 아래쪽(+y) 줄들
// w, h: 처음 방향의 발판. 놓인 건물의 발판은 b.w, b.h (dir 1·3 이면 서로 바뀐다, world.js footOf)
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
  // 갈래 건물: 그 갈래를 걸을 때만 짓는다. 효과는 JH.perk 에 접힌다(일꾼이 하나 이상일 때)
  hall_jeong: {
    name: '의협당', hanja: '義', w: 3, h: 3, top: 1.1, cost: { wood: 80, stone: 60, silver: 160 }, hp: 420, time: 16, workers: 2,
    cat: 'martial', rank: 2, route: 'jeong', unique: true, fighter: true, upkeep: 1,
    desc: '정파의 협객들이 모여 의를 논하고 무예를 닦는 집. 무사 수련 +25%, 날마다 명성이 오른다. 정파의 길에서만 짓는다.',
  },
  altar_ma: {
    name: '혈제단', hanja: '祭', w: 2, h: 2, top: 0.8, cost: { wood: 30, stone: 60, silver: 120 }, hp: 260, time: 12, workers: 1,
    cat: 'martial', rank: 2, route: 'ma', unique: true,
    desc: '붉은 달에 피를 바치는 제단. 무사 공격력 +15%, 날마다 은자가 들지만 민심이 가라앉는다. 마교의 길에서만 짓는다.',
  },
  ancestral: {
    name: '종가', hanja: '宗', w: 3, h: 3, top: 1.2, cost: { wood: 90, stone: 50, silver: 180 }, hp: 380, time: 16, workers: 2,
    cat: 'civic', rank: 2, route: 'sega', unique: true, indoor: true,
    desc: '세가의 위패를 모신 큰집. 열흘마다 세가 무인이 객경으로 찾아오고 명성이 오른다. 세가의 길에서만 짓는다.',
  },
  blackmarket: {
    name: '흑시', hanja: '暗', w: 3, h: 2, top: 0.8, cost: { wood: 60, stone: 20, silver: 140 }, hp: 240, time: 12, workers: 2,
    cat: 'trade', rank: 2, route: 'heuk', unique: true, indoor: true,
    desc: '밤에만 서는 검은 장. 시장보다 은자를 더 벌지만 관부의 눈총을 산다. 흑도의 길에서만 짓는다.',
  },
  gambling: {
    name: '도박장', hanja: '賭', w: 3, h: 2, top: 1.0, cost: { wood: 60, stone: 30, silver: 160 }, hp: 240, time: 12, workers: 2,
    cat: 'trade', rank: 2, route: 'sa', unique: true, indoor: true,
    desc: '투전판이 밤낮으로 돈다. 시장보다 은자를 훨씬 더 벌지만 민심이 조금 내려간다. 사파의 길에서만 짓는다.',
  },
  horsemarket: {
    name: '호시', hanja: '互', w: 3, h: 3, top: 0.7, cost: { wood: 80, stone: 20, silver: 150 }, hp: 280, time: 14, workers: 2,
    cat: 'trade', rank: 2, route: 'saeoe', unique: true,
    desc: '새외 상인과 말과 인삼을 바꾸는 장. 교역 수입이 들고 무사 체력이 오른다. 새외의 길에서만 짓는다.',
  },
  yamen: {
    name: '관아', hanja: '衙', w: 3, h: 3, top: 1.2, cost: { wood: 80, stone: 70, silver: 200 }, hp: 460, time: 18, workers: 2,
    cat: 'civic', rank: 2, route: 'gwan', unique: true, indoor: true,
    desc: '현령이 업무를 보는 관청. 세금 +10%, 민심이 오르고 상소 기한이 하루 늘어난다. 관의 길에서만 짓는다.',
  },
  stage: {
    name: '연무대', hanja: '臺', w: 3, h: 3, top: 0.6, cost: { wood: 60, stone: 60, silver: 120 }, hp: 300, time: 12, workers: 1,
    cat: 'martial', rank: 2, route: 'free', unique: true,
    desc: '누구나 올라 비무를 겨루는 대. 날마다 명성이 오르고 무림대회가 자주 열린다. 홀로 서는 길에서만 짓는다.',
  },
};
// 돌릴 수 있는 방향 (b.dir: 0 문이 +y · 1 +x · 2 −y · 3 −x, docs/architecture.md §2.2). 따로 적지 않으면 네 방향 모두.
// 문 쪽에 걸어 다니는 마당(walkRows)이 발판 일부인 무관·표국은 마당을 화면 앞쪽에 그려야 하니 앞을 보는 0·1 만.
// 영주관·우물은 돌리지 않고, 목책·석벽·성문은 이웃 담장을 따라 저절로 돈다
for (const k in BDEF) {
  const d = BDEF[k];
  d.dirs = ['manor', 'well', 'wall', 'stonewall', 'gate'].includes(k) ? [0] : d.walkRows && d.walkRows < d.h ? [0, 1] : [0, 1, 2, 3];
}
const BUILD_ORDER = ['house', 'house2', 'farm', 'fishery', 'lumber', 'quarry', 'warehouse', 'smithy', 'market', 'inn', 'escort',
  'blackmarket', 'gambling', 'horsemarket', 'clinic', 'well', 'shrine', 'pavilion', 'ancestral', 'yamen',
  'dojo', 'hall_jeong', 'altar_ma', 'stage', 'tower', 'wall', 'stonewall', 'gate'];

// 도구 (길, 벌채, 철거)
const TOOLS = {
  road: { name: '길', hanja: '道', cost: { silver: 1 }, desc: '사람들이 더 빨리 다닌다. 물 위에 놓으면 다리가 된다 (목재 6). 끌어서 깔 수 있다.' },
  clear: { name: '벌채', hanja: '伐', cost: { silver: 2 }, desc: '숲을 베어 땅을 고른다. 목재를 조금 얻는다.' },
  demolish: { name: '철거', hanja: '毁', cost: {}, desc: '건물이나 길을 허문다. 재료의 절반을 돌려받는다.' },
};

// 계열 (docs/jianghu.md §1)
// perk: 주군일 때의 혜택 (동맹이면 절반 규칙, JH.perk). route: 이 계열을 주군으로 두면 걷는 갈래. tribute: 공물 배수
const CAMPS = {
  jeong: {
    name: '정파', hanja: '正派', seal: '正', color: '#4f7fb8', dark: '#1f3550',
    desc: '의협과 법도를 앞세우는 명문 정파들. 마교와 사파를 용납하지 않고, 관과는 대체로 사이가 좋다.',
    perk: { train: 1.5, happy: 3, aid: true }, perkText: '무사 수련 +50%, 민심 +3, 습격 때 원군', route: 'jeong', tribute: 1,
  },
  ma: {
    name: '마교', hanja: '魔敎', seal: '魔', color: '#7a3394', dark: '#2c0f36',
    desc: '정파가 사악하다 꺼리는 교파들. 힘을 숭상하고 강호를 제 발아래 두려 한다.',
    perk: { atk: 1.3, dailySilver: 0.4, happy: -10, aid: true }, perkText: '무사 공격력 +30%, 매일 은자(인구당), 민심 -10, 습격 때 원군', route: 'ma', tribute: 1,
  },
  sega: {
    name: '무림세가', hanja: '武林世家', seal: '家', color: '#3f8a5a', dark: '#173a26',
    desc: '대대로 무공과 재물을 잇는 무림의 명가들. 가문의 이름과 혼맥을 무엇보다 따진다.',
    perk: { heroEvery: 12, fame: 0.3, aid: true }, perkText: '12일마다 세가 무인이 객경으로 온다, 매일 명성, 습격 때 원군', route: 'sega', tribute: 1,
  },
  heuk: {
    name: '흑도', hanja: '黑道', seal: '黑', color: '#4a4a52', dark: '#18181c',
    desc: '밤의 장사와 칼로 먹고사는 검은 길의 무리. 산채와 수채, 살수와 밀정이 여기에 든다.',
    perk: { dailySilver: 0.3, bandit: 0.5, gwanRel: -1 }, perkText: '매일 은자(인구당), 흑도의 위협 절반. 관부의 눈총', route: 'heuk', tribute: 1,
  },
  sa: {
    name: '사파', hanja: '邪派', seal: '邪', color: '#a83a2e', dark: '#4a1712',
    desc: '이익을 좇아 수단을 가리지 않는 방회와 문파. 도박장과 독, 강 나루를 쥐고 있다.',
    perk: { dailySilver: 0.35, gwanRel: -1, aid: true }, perkText: '매일 은자(인구당), 습격 때 원군. 관부의 눈총', route: 'sa', tribute: 1,
  },
  saeoe: {
    name: '새외무림', hanja: '塞外武林', seal: '外', color: '#b8743a', dark: '#45290f',
    desc: '중원 바깥 변경과 바다의 무림. 중원의 법도를 따르지 않고, 교역과 침공을 함께 한다.',
    perk: { hp: 1.2, trade: 1.15, gwanRel: -0.5, aid: true }, perkText: '무사 체력 +20%, 교역 수입 +15%, 습격 때 원군. 관부의 눈총', route: 'saeoe', tribute: 1,
  },
  gwan: {
    name: '관', hanja: '官', seal: '官', color: '#c79a2c', dark: '#4a3810',
    desc: '황제의 이름으로 다스리는 관청과 관군. 세금과 법을 쥐고 흑도와 사파를 토벌한다.',
    perk: { tax: 1.15, bandit: 0.5, aid: true }, perkText: '세금 수입 +15%, 흑도의 위협 절반, 습격 때 원군', route: 'gwan', tribute: 1,
  },
  sang: {
    name: '상단', hanja: '商團', seal: '商', color: '#2f8f8f', dark: '#123838',
    desc: '은자를 따라 움직이는 상회와 표국. 싸움에 끼지 않고 누구와도 거래한다.',
    perk: { trade: 1.3 }, perkText: '시장·객잔·표국 수입 +30%', route: 'free', tribute: 0.6,
  },
};
const CAMP_ORDER = ['jeong', 'sega', 'gwan', 'sang', 'saeoe', 'sa', 'heuk', 'ma'];
// 계열 사이의 감정 −100..100 (대칭). 같은 계열은 +50, 적지 않은 칸은 0
const CAMP_ATT = {};
for (const a of CAMP_ORDER) { CAMP_ATT[a] = {}; for (const b of CAMP_ORDER) CAMP_ATT[a][b] = a === b ? 50 : 0; }
for (const [a, b, v] of [
  ['jeong', 'ma', -90], ['jeong', 'sa', -50], ['jeong', 'heuk', -60], ['jeong', 'sega', 30], ['jeong', 'gwan', 10], ['jeong', 'saeoe', -20],
  ['ma', 'sega', -60], ['ma', 'gwan', -70], ['ma', 'sa', -10], ['ma', 'saeoe', -10],
  ['sega', 'sa', -30], ['sega', 'heuk', -40], ['sega', 'gwan', 20], ['sega', 'saeoe', -10],
  ['heuk', 'gwan', -70], ['heuk', 'sa', 20], ['heuk', 'sang', -20],
  ['sa', 'gwan', -40], ['saeoe', 'gwan', -45], ['gwan', 'sang', 10],
]) CAMP_ATT[a][b] = CAMP_ATT[b][a] = v;
// 같은 계열 안의 숙적 (세가 분쟁·흑도 쟁패)
const RIVALRIES = [['baengni', 'sanggwan'], ['heuksu', 'gwiyeong'], ['cheolhyeol', 'chilsal'], ['heungnyeon', 'cheongwi']];

// 세력 (docs/jianghu.md §2)
// home: REGIONS 키 ('local' 이면 고을 곁). power: 처음 힘 30..120. temper: 탐욕·명분·호전 0..1
// type·perk 는 아래에서 계열로 채운다 (흑풍채·관부의 type 만 따로)
const FACTIONS = {
  // 정파
  cheongun: {
    name: '청운검문', hanja: '靑', camp: 'jeong', type: '정파(正派)', color: '#4f7fb8', dark: '#1f3550',
    desc: '구름 위의 검을 좇는 명문 정파. 의협을 중시하지만 체면도 그만큼 따진다.',
    unit: { name: '청운검수', hp: 55, atk: 7, weapon: 'sword', hat: 'band', cloth: '#dfe7ee', cloth2: '#4f7fb8' },
    leader: { title: '청운검객', hp: 300, atk: 18 },
    military: true, startRel: 10, baseSize: 6, growth: 0.3, goals: ['punish'],
    home: 'shaanxi', power: 95, temper: { greed: 0.2, honor: 0.8, aggro: 0.4 },
  },
  baekhak: {
    name: '백학문', hanja: '鶴', camp: 'jeong', color: '#6a9cb4', dark: '#1f3a48',
    desc: '호숫가에 터를 잡은 문파. 흰 학의 몸놀림을 본뜬 경공과 검법으로 이름나, 다툼보다 중재를 즐긴다.',
    unit: { name: '백학문도', hp: 48, atk: 7, weapon: 'sword', hat: 'straw', cloth: '#efeee8', cloth2: '#2a2a30' },
    leader: { title: '백학장로', hp: 280, atk: 17 },
    military: true, startRel: 10, baseSize: 5, growth: 0.3, goals: ['punish'],
    home: 'hubei', power: 75, temper: { greed: 0.15, honor: 0.85, aggro: 0.25 },
  },
  geumgang: {
    name: '금강사', hanja: '剛', camp: 'jeong', color: '#a0682a', dark: '#3c240c',
    desc: '깊은 산의 오래된 절. 금강처럼 굳센 몸을 닦는 무승들이 세상의 존경을 받지만, 마교와 사파에는 한 치도 물러서지 않는다.',
    unit: { name: '금강무승', hp: 60, atk: 6, weapon: 'staff', hat: 'bald', cloth: '#c8873a', cloth2: '#7a2e1e' },
    leader: { title: '금강나한', hp: 340, atk: 17 },
    military: true, startRel: 15, baseSize: 6, growth: 0.28, goals: ['punish'],
    home: 'henan', power: 110, temper: { greed: 0.1, honor: 0.9, aggro: 0.2 },
  },
  taeheo: {
    name: '태허관', hanja: '虛', camp: 'jeong', color: '#5a7a8c', dark: '#1e2c34',
    desc: '사천 깊은 산의 도관. 텅 빈 하늘의 이치를 좇는 도사들이 곤과 부적을 함께 쓴다.',
    unit: { name: '태허도사', hp: 46, atk: 7, weapon: 'staff', hat: 'band', cloth: '#5a6a7a', cloth2: '#e2dccb' },
    leader: { title: '태허진인', hp: 290, atk: 19 },
    military: true, startRel: 5, baseSize: 5, growth: 0.3, goals: ['punish'],
    home: 'sichuan', power: 70, temper: { greed: 0.15, honor: 0.75, aggro: 0.3 },
  },
  // 마교
  hyeolwol: {
    name: '혈월교', hanja: '血', camp: 'ma', type: '마교(魔敎)', color: '#7a3394', dark: '#2c0f36',
    desc: '붉은 달을 섬기는 사교. 강호를 피로 물들이려는 야망을 숨기지 않는다.',
    unit: { name: '혈월교도', hp: 62, atk: 9, weapon: 'blade', hat: 'mask', cloth: '#2a1630', cloth2: '#b0263a' },
    leader: { title: '혈월사자', hp: 360, atk: 22 },
    military: true, startRel: -10, baseSize: 6, growth: 0.32, goals: ['occupy', 'loot'],
    home: 'xiyu', power: 100, temper: { greed: 0.5, honor: 0.2, aggro: 0.8 },
  },
  heungnyeon: {
    name: '흑련교', hanja: '蓮', camp: 'ma', color: '#4a3a66', dark: '#191326',
    desc: '안개 낀 늪에 숨어 검은 연꽃을 섬기는 비밀 교단. 병을 고쳐 준다며 신도를 모으고, 모인 신도로 칼을 만든다.',
    unit: { name: '흑련교도', hp: 50, atk: 8, weapon: 'staff', hat: 'hood', cloth: '#221a2c', cloth2: '#6a9a6e' },
    leader: { title: '흑련법사', hp: 320, atk: 20 },
    military: true, startRel: -10, baseSize: 6, growth: 0.32, goals: ['occupy', 'loot'],
    home: 'yungui', power: 75, temper: { greed: 0.5, honor: 0.15, aggro: 0.7 },
  },
  cheongwi: {
    name: '천귀문', hanja: '鬼', camp: 'ma', color: '#6a4a6e', dark: '#25172a',
    desc: '안개 골짜기의 마문. 귀신 탈을 쓴 문도들이 밤에만 움직이고, 맨손으로 뼈를 꺾는다.',
    unit: { name: '천귀문도', hp: 54, atk: 8, weapon: 'fist', hat: 'mask', cloth: '#2e2a2e', cloth2: '#b8b4c4' },
    leader: { title: '천귀문주', hp: 330, atk: 21 },
    military: true, startRel: -15, baseSize: 5, growth: 0.33, goals: ['loot', 'punish'],
    home: 'hunan', power: 65, temper: { greed: 0.4, honor: 0.1, aggro: 0.75 },
  },
  // 무림세가
  baengni: {
    name: '백리세가', hanja: '百', camp: 'sega', color: '#3f7a5a', dark: '#163024',
    desc: '관도를 쥔 오래된 무가. 대대로 창법을 잇고 관과도 가까워, 가문의 체면을 목숨처럼 여긴다.',
    unit: { name: '백리가 창수', hp: 52, atk: 7, weapon: 'spear', hat: 'band', cloth: '#e8e2d0', cloth2: '#3f7a5a' },
    leader: { title: '백리가주', hp: 300, atk: 18 },
    military: true, startRel: 5, baseSize: 6, growth: 0.3, goals: ['punish'],
    home: 'hebei', power: 85, temper: { greed: 0.35, honor: 0.6, aggro: 0.4 },
  },
  jegal: {
    name: '제갈세가', hanja: '葛', camp: 'sega', color: '#5a8a3a', dark: '#213613',
    desc: '진법과 기관술을 대대로 잇는 학자 무가. 칼보다 셈으로 싸우고, 손익이 맞으면 누구와도 손잡는다.',
    unit: { name: '제갈가 무사', hp: 44, atk: 7, weapon: 'sword', hat: 'hood', cloth: '#d8dcc4', cloth2: '#2f5a2a' },
    leader: { title: '제갈군사', hp: 270, atk: 18, hat: 'straw' },
    military: true, startRel: 5, baseSize: 5, growth: 0.3, goals: ['punish'],
    home: 'hubei', power: 80, temper: { greed: 0.3, honor: 0.65, aggro: 0.3 },
  },
  sanggwan: {
    name: '상관세가', hanja: '上', camp: 'sega', color: '#2f8a76', dark: '#11342c',
    desc: '강남의 부유한 무가. 비단 장사로 쌓은 재물과 날랜 도법을 함께 자랑하며, 백리세가와는 대를 이은 앙숙이다.',
    unit: { name: '상관가 도객', hp: 48, atk: 7, weapon: 'blade', hat: 'straw', cloth: '#f0e0c4', cloth2: '#2f8a76' },
    leader: { title: '상관가주', hp: 290, atk: 18 },
    military: true, startRel: 0, baseSize: 6, growth: 0.32, goals: ['punish', 'loot'],
    home: 'jiangnan', power: 80, temper: { greed: 0.55, honor: 0.45, aggro: 0.4 },
  },
  // 흑도 (흑풍채는 힘 100: 위협·습격 배수가 1이라 튜토리얼의 압박이 예전 그대로다)
  heukpung: {
    name: '흑풍채', hanja: '黑', camp: 'heuk', type: '흑도(黑道) · 산채', color: '#4a403a', dark: '#1c1714',
    desc: '뒷산 험한 산채에 터를 잡은 산적 떼. 약한 마을의 곡식과 은자를 노린다.',
    unit: { name: '흑풍채 산적', hp: 32, atk: 4, weapon: 'axe', hat: 'hood', cloth: '#5a4a3c', cloth2: '#26201b' },
    leader: { title: '흑풍채주', hp: 180, atk: 12, hat: 'band' },
    military: true, startRel: -30, baseSize: 4, growth: 0.3, goals: ['loot'], noLord: true,
    home: 'local', power: 100, temper: { greed: 0.9, honor: 0.1, aggro: 0.7 },
  },
  heuksu: {
    name: '흑수채', hanja: '水', camp: 'heuk', color: '#2f4858', dark: '#0f1a22',
    desc: '물길을 누비는 수적 떼. 배를 세워 통행세를 받고, 안 내면 배째로 가라앉힌다.',
    unit: { name: '흑수채 수적', hp: 38, atk: 5, weapon: 'axe', hat: 'band', cloth: '#2e3e4a', cloth2: '#a8b4b8' },
    leader: { title: '흑수채주', hp: 220, atk: 14 },
    military: true, startRel: -10, baseSize: 5, growth: 0.33, goals: ['loot'],
    home: 'fujian', power: 60, temper: { greed: 0.85, honor: 0.15, aggro: 0.6 },
  },
  gwiyeong: {
    name: '귀영문', hanja: '影', camp: 'heuk', color: '#3a3a4a', dark: '#121218',
    desc: '뒷골목을 쥔 그림자 조직. 장물과 밀정과 뒷거래가 모두 이들의 손을 거친다.',
    unit: { name: '귀영문 그림자', hp: 36, atk: 6, weapon: 'blade', hat: 'hood', cloth: '#1e1e24', cloth2: '#56566a' },
    leader: { title: '귀영문주', hp: 220, atk: 15, hat: 'mask' },
    military: true, startRel: -10, baseSize: 4, growth: 0.32, goals: ['loot'],
    home: 'henan', power: 55, temper: { greed: 0.75, honor: 0.2, aggro: 0.45 },
  },
  hyeolyeong: {
    name: '혈영루', hanja: '樓', camp: 'heuk', color: '#5e2a30', dark: '#200d10',
    desc: '항구의 누각에 숨은 살수 조직. 값만 맞으면 누구의 목이든 가져오고, 흔적은 남기지 않는다.',
    unit: { name: '혈영루 살수', hp: 40, atk: 8, weapon: 'sword', hat: 'mask', cloth: '#1a1418', cloth2: '#9a1e26' },
    leader: { title: '혈영루주', hp: 240, atk: 20 },
    military: true, startRel: -15, baseSize: 4, growth: 0.3, goals: ['punish', 'loot'],
    home: 'shandong', power: 50, temper: { greed: 0.7, honor: 0.3, aggro: 0.6 },
  },
  // 사파
  cheolhyeol: {
    name: '철혈방', hanja: '鐵', camp: 'sa', type: '사파(邪派)', color: '#a83a2e', dark: '#4a1712',
    desc: '강 나루와 도박장을 쥔 사파 방회. 돈이 되는 일이라면 가리지 않는다.',
    unit: { name: '철혈방도', hp: 46, atk: 6, weapon: 'blade', hat: 'band', cloth: '#3a2a26', cloth2: '#a83a2e' },
    leader: { title: '철혈향주', hp: 260, atk: 16 },
    military: true, startRel: -5, baseSize: 6, growth: 0.35, goals: ['loot', 'occupy'],
    home: 'jiangnan', power: 85, temper: { greed: 0.8, honor: 0.3, aggro: 0.55 },
  },
  mandok: {
    name: '만독곡', hanja: '毒', camp: 'sa', color: '#6a7a2a', dark: '#242a0c',
    desc: '남쪽 독초 골짜기의 독문. 독과 해독약을 함께 팔아 양쪽에서 값을 받는다.',
    unit: { name: '만독곡 독수', hp: 42, atk: 7, weapon: 'fist', hat: 'hood', cloth: '#2e3a1e', cloth2: '#9ab83a' },
    leader: { title: '만독곡주', hp: 250, atk: 18, hat: 'mask' },
    military: true, startRel: -10, baseSize: 5, growth: 0.32, goals: ['loot', 'punish'],
    home: 'guangdong', power: 65, temper: { greed: 0.7, honor: 0.2, aggro: 0.5 },
  },
  chilsal: {
    name: '칠살문', hanja: '殺', camp: 'sa', color: '#8a2a3a', dark: '#330e15',
    desc: '황토 고원의 칼잡이 문파. 일곱 번 찍어 끝을 본다는 잔혹한 도끼질로 이름을 떨친다.',
    unit: { name: '칠살문도', hp: 50, atk: 8, weapon: 'axe', hat: 'mask', cloth: '#3a2224', cloth2: '#c9b28a' },
    leader: { title: '칠살문주', hp: 280, atk: 19 },
    military: true, startRel: -15, baseSize: 5, growth: 0.34, goals: ['loot', 'occupy'],
    home: 'shanxi', power: 70, temper: { greed: 0.6, honor: 0.25, aggro: 0.8 },
  },
  // 새외무림
  bingseol: {
    name: '빙설궁', hanja: '氷', camp: 'saeoe', color: '#8ab4cc', dark: '#2a4250',
    desc: '얼음벌판 너머의 궁. 차가운 검기를 다루는 무인들이 이따금 남쪽으로 내려와 중원을 시험한다.',
    unit: { name: '빙설궁 검수', hp: 52, atk: 8, weapon: 'sword', hat: 'fur', cloth: '#e8f0f4', cloth2: '#6a9ab8' },
    leader: { title: '빙설궁 사자', hp: 320, atk: 20 },
    military: true, startRel: -5, baseSize: 5, growth: 0.3, goals: ['punish', 'loot'],
    home: 'beihai', power: 80, temper: { greed: 0.3, honor: 0.6, aggro: 0.5 },
  },
  geumryun: {
    name: '금륜사', hanja: '輪', camp: 'saeoe', color: '#b5652a', dark: '#45240c',
    desc: '하늘에 닿은 고원의 금빛 절. 수행승들이 맨손 무공과 법륜을 다루며, 중원의 비급을 탐낸다.',
    unit: { name: '금륜사 무승', hp: 58, atk: 7, weapon: 'fist', hat: 'bald', cloth: '#8a2a24', cloth2: '#d6a63a' },
    leader: { title: '금륜법왕', hp: 340, atk: 19 },
    military: true, startRel: 0, baseSize: 5, growth: 0.3, goals: ['punish'],
    home: 'xizang', power: 90, temper: { greed: 0.4, honor: 0.55, aggro: 0.45 },
  },
  yasu: {
    name: '야수궁', hanja: '獸', camp: 'saeoe', color: '#7a5a32', dark: '#2c1f10',
    desc: '남쪽 밀림의 부족 연맹. 짐승을 길들여 부리고, 창을 든 사냥꾼들이 밀림의 주인 노릇을 한다.',
    unit: { name: '야수궁 사냥꾼', hp: 44, atk: 6, weapon: 'spear', hat: 'hood', cloth: '#6a4a2a', cloth2: '#c8a870' },
    leader: { title: '야수궁주', hp: 260, atk: 16, hat: 'fur' },
    military: true, startRel: -10, baseSize: 6, growth: 0.35, goals: ['loot'],
    home: 'nanman', power: 60, temper: { greed: 0.6, honor: 0.3, aggro: 0.65 },
  },
  haerang: {
    name: '해랑도', hanja: '狼', camp: 'saeoe', color: '#3a5a7a', dark: '#142230',
    desc: '동쪽 바다의 섬들에 둥지를 튼 해적 무리. 늑대 가죽을 두르고 바닷가 고을을 노린다.',
    unit: { name: '해랑도 해적', hp: 42, atk: 6, weapon: 'blade', hat: 'fur', cloth: '#3a4a5a', cloth2: '#8a8a80' },
    leader: { title: '해랑도주', hp: 250, atk: 16 },
    military: true, startRel: -10, baseSize: 6, growth: 0.35, goals: ['loot'],
    home: 'donghai', power: 65, temper: { greed: 0.8, honor: 0.15, aggro: 0.7 },
  },
  // 관
  gwanbu: {
    name: '관부', hanja: '官', camp: 'gwan', type: '관(官) · 현청', color: '#c79a2c', dark: '#4a3810',
    desc: '황제의 이름으로 세금을 걷고 법을 집행하는 현청. 무림의 일에는 되도록 끼지 않는다.',
    unit: { name: '관병', hp: 44, atk: 5, weapon: 'spear', hat: 'helmet', cloth: '#7a2a22', cloth2: '#c79a2c' },
    leader: { title: '관군 교위', hp: 240, atk: 14 },
    military: true, startRel: 20, baseSize: 8, growth: 0.35, goals: ['punish', 'occupy'],
    home: 'local', power: 70, temper: { greed: 0.4, honor: 0.6, aggro: 0.3 },
  },
  geumui: {
    name: '금의위', hanja: '錦', camp: 'gwan', color: '#a8323a', dark: '#3e1014',
    desc: '황제 직속의 감찰 무관. 비단옷 아래 칼을 숨기고 반역과 사교의 뿌리를 캐낸다.',
    unit: { name: '금의위 위사', hp: 50, atk: 7, weapon: 'blade', hat: 'helmet', cloth: '#b0303a', cloth2: '#d6a63a' },
    leader: { title: '금의위 천호', hp: 300, atk: 18 },
    military: true, startRel: 0, baseSize: 6, growth: 0.32, goals: ['punish', 'occupy'],
    home: 'hebei', power: 100, temper: { greed: 0.45, honor: 0.5, aggro: 0.5 },
  },
  jinbuk: {
    name: '진북군', hanja: '北', camp: 'gwan', color: '#6a6a3a', dark: '#262612',
    desc: '요동 국경을 지키는 변방군. 혹독한 추위 속에 단련된 병사들이 새외의 침입을 막는다.',
    unit: { name: '진북군 병사', hp: 48, atk: 6, weapon: 'spear', hat: 'fur', cloth: '#5a5a40', cloth2: '#8a6a3a' },
    leader: { title: '진북군 장수', hp: 280, atk: 16, hat: 'helmet' },
    military: true, startRel: 5, baseSize: 8, growth: 0.35, goals: ['punish', 'occupy'],
    home: 'liaodong', power: 110, temper: { greed: 0.3, honor: 0.65, aggro: 0.45 },
  },
  // 상단
  geumryong: {
    name: '금룡상회', hanja: '金', camp: 'sang', type: '상단(商團)', color: '#cfa13a', dark: '#4a3a12',
    desc: '대륙을 오가는 거상들의 연합. 은자만 된다면 누구와도 거래한다.',
    military: false, startRel: 0, growth: 0.3, goals: [],
    home: 'jiangnan', power: 90, temper: { greed: 0.8, honor: 0.5, aggro: 0.1 },
  },
  malli: {
    name: '만리표국', hanja: '鏢', camp: 'sang', color: '#2f8f8a', dark: '#123634',
    desc: '천하의 길을 잇는 큰 표국. 이곳에서 떠난 표기가 만 리 밖까지 닿는다.',
    military: false, startRel: 5, growth: 0.3, goals: [],
    home: 'henan', power: 60, temper: { greed: 0.5, honor: 0.7, aggro: 0.15 },
  },
};
for (const k in FACTIONS) {
  const F = FACTIONS[k], C = CAMPS[F.camp];
  if (!F.type) F.type = `${C.name}(${C.hanja})`;
  F.perk = F.noLord ? '' : C.perkText;
}
const FACTION_ORDER = CAMP_ORDER.flatMap(c => Object.keys(FACTIONS).filter(k => FACTIONS[k].camp === c));

// 천하 지리 (docs/jianghu.md §3): 천하도 1000 × 700, 동쪽이 오른쪽, 북쪽이 위
const REGIONS = {
  hebei: { name: '하북', hanja: '河北', x: 680, y: 170, outer: false, desc: '황도가 가까운 북쪽 들. 관도가 사방으로 뻗는다.' },
  shanxi: { name: '산서', hanja: '山西', x: 560, y: 200, outer: false, desc: '황토 고원과 메마른 골짜기. 거친 칼잡이들의 땅.' },
  shaanxi: { name: '섬서', hanja: '陝西', x: 430, y: 270, outer: false, desc: '옛 도읍이 있던 산과 협곡. 검문의 본산이 구름 속에 있다.' },
  shandong: { name: '산동', hanja: '山東', x: 790, y: 250, outer: false, desc: '바다에 닿은 동쪽 땅. 항구와 소금밭이 많다.' },
  henan: { name: '하남', hanja: '河南', x: 620, y: 310, outer: false, desc: '황하가 적시는 중원의 한복판. 큰길과 이름난 절이 모인다.' },
  hubei: { name: '호북', hanja: '湖北', x: 560, y: 400, outer: false, desc: '장강과 한수가 만나는 호수의 땅. 나루와 배가 많다.' },
  sichuan: { name: '사천', hanja: '四川', x: 360, y: 410, outer: false, desc: '산으로 둘러싸인 분지. 길이 험하고 숲이 깊다.' },
  jiangnan: { name: '강남', hanja: '江南', x: 790, y: 400, outer: false, desc: '장강 남쪽의 물의 고장. 비단과 은자가 넘친다.' },
  hunan: { name: '호남', hanja: '湖南', x: 560, y: 500, outer: false, desc: '상강이 흐르는 숲과 안개의 땅.' },
  yungui: { name: '운귀', hanja: '雲貴', x: 380, y: 540, outer: false, desc: '구름 낀 고원과 밀림. 여러 부족이 섞여 산다.' },
  fujian: { name: '복건', hanja: '福建', x: 790, y: 530, outer: false, desc: '산이 바다로 내려앉은 땅. 포구마다 배와 수적이 들끓는다.' },
  guangdong: { name: '광동', hanja: '廣東', x: 620, y: 600, outer: false, desc: '남쪽 끝의 덥고 습한 땅. 독초와 약재가 자란다.' },
  beihai: { name: '북해', hanja: '北海', x: 520, y: 40, outer: true, desc: '얼음 바다 너머의 눈벌판.' },
  liaodong: { name: '요동', hanja: '遼東', x: 860, y: 120, outer: true, desc: '동북쪽 국경 너머. 겨울이 길고 말 탄 무리가 오간다.' },
  xiyu: { name: '서역', hanja: '西域', x: 110, y: 200, outer: true, desc: '모래 바다와 비단길의 오아시스.' },
  xizang: { name: '서장', hanja: '西藏', x: 150, y: 460, outer: true, desc: '하늘에 닿은 고원. 금빛 절이 있다.' },
  nanman: { name: '남만', hanja: '南蠻', x: 330, y: 650, outer: true, desc: '남쪽 밀림의 부족들. 짐승을 부린다.' },
  donghai: { name: '동해', hanja: '東海', x: 950, y: 420, outer: true, desc: '동쪽 바다의 섬들. 해적이 뱃길을 노린다.' },
};
// 시작 고을. near: local 둘(흑풍채·관부)과 상단을 뺀 이웃 넷 (계열이 모두 다르다). biome: 0.2..0.8, 0.5 이면 지금 마을과 같다
// trait.perk 는 JH.perk 에, trait.ev 는 사건 가중치에 곱한다. quest·noWinter·aid 는 엔진이 읽는 덧붙임
const SITES = {
  henan_field: {
    name: '낙수 들녘', hanja: '洛水原', region: 'henan', x: 600, y: 330,
    desc: '낙수 강가의 넓은 들. 길이 사방으로 열려 처음 다스리기에 알맞다.',
    biome: { forest: 0.4, water: 0.55, hills: 0.35, fertile: 0.7, cold: 0.45 },
    near: ['geumgang', 'gwiyeong', 'chilsal', 'baengni'], sang: 'malli',
    trait: { text: '중원 한복판: 시장 수입 ×1.1', perk: { trade: 1.1 }, ev: {} },
    stars: 1, first: true,
  },
  shaanxi_valley: {
    name: '운무곡', hanja: '雲霧谷', region: 'shaanxi', x: 430, y: 255,
    desc: '구름과 안개가 늘 걸린 산골. 땅은 거칠지만 검문의 본산이 가깝다.',
    biome: { forest: 0.5, water: 0.4, hills: 0.8, fertile: 0.35, cold: 0.6 },
    near: ['cheongun', 'chilsal', 'hyeolwol', 'jegal'], sang: 'malli',
    trait: { text: '험한 산골: 돌이 흔하다', perk: {}, ev: {} },
    stars: 2,
  },
  jiangnan_water: {
    name: '연우 수향', hanja: '煙雨水鄕', region: 'jiangnan', x: 780, y: 390,
    desc: '안개비 내리는 물의 고장. 물길마다 배가 오가고 은자가 돈다.',
    biome: { forest: 0.4, water: 0.8, hills: 0.25, fertile: 0.7, cold: 0.3 },
    near: ['sanggwan', 'cheolhyeol', 'heuksu', 'baekhak'], sang: 'geumryong',
    trait: { text: '강남 물길: 교역 ×1.15', perk: { trade: 1.15 }, ev: {} },
    stars: 1,
  },
  sichuan_basin: {
    name: '파촉 분지', hanja: '巴蜀盆地', region: 'sichuan', x: 360, y: 415,
    desc: '산으로 둘러싸인 분지의 숲 마을. 길은 험하지만 나무가 끝없다.',
    biome: { forest: 0.8, water: 0.5, hills: 0.6, fertile: 0.6, cold: 0.4 },
    near: ['taeheo', 'heungnyeon', 'geumryun', 'jegal'], sang: 'malli',
    trait: { text: '깊은 숲: 목재가 흔하다', perk: {}, ev: {} },
    stars: 2,
  },
  yungui_frontier: {
    name: '묘강 변경', hanja: '苗疆邊境', region: 'yungui', x: 390, y: 560,
    desc: '남쪽 밀림 끝의 변경 마을. 약초가 넘치고, 독과 짐승도 그만큼 많다.',
    biome: { forest: 0.75, water: 0.55, hills: 0.6, fertile: 0.55, cold: 0.2 },
    near: ['heungnyeon', 'mandok', 'yasu', 'taeheo'], sang: 'geumryong',
    trait: { text: '남쪽 밀림: 약재 의뢰가 잦고 겨울이 없다', perk: {}, ev: {}, quest: { herb: 2 }, noWinter: true },
    stars: 2,
  },
  hebei_road: {
    name: '북평 관도', hanja: '北平官道', region: 'hebei', x: 690, y: 175,
    desc: '황도로 가는 관도 곁 마을. 관의 눈이 가깝고 오가는 이가 많다.',
    biome: { forest: 0.3, water: 0.4, hills: 0.35, fertile: 0.55, cold: 0.65 },
    near: ['baengni', 'hyeolyeong', 'bingseol', 'geumgang'], sang: 'malli',
    trait: { text: '황도 가까이: 세금 ×1.1, 관 사건이 잦다', perk: { tax: 1.1 }, ev: { gwanbu_tax: 2, inspection: 2, conscription: 1.5 } },
    stars: 2,
  },
  shandong_coast: {
    name: '봉래 해안', hanja: '蓬萊海岸', region: 'shandong', x: 800, y: 270,
    desc: '바다를 낀 해안 마을. 고기가 잘 잡히지만 해적의 소문이 끊이지 않는다.',
    biome: { forest: 0.3, water: 0.75, hills: 0.45, fertile: 0.5, cold: 0.5 },
    near: ['hyeolyeong', 'haerang', 'cheolhyeol', 'baengni'], sang: 'geumryong',
    trait: { text: '바닷가: 어장 ×1.2, 해적 소문', perk: { fish: 1.2 }, ev: { pirates: 2 } },
    stars: 2,
  },
  liaodong_border: {
    name: '요하 변성', hanja: '遼河邊城', region: 'liaodong', x: 840, y: 140,
    desc: '국경 성채 곁의 추운 마을. 겨울이 길고 새외 무리가 자주 넘본다.',
    biome: { forest: 0.55, water: 0.45, hills: 0.55, fertile: 0.35, cold: 0.8 },
    near: ['bingseol', 'baengni', 'hyeolyeong', 'chilsal'], sang: 'malli',
    trait: { text: '국경: 진북군이 원군을 보낸다, 겨울이 혹독하다', perk: {}, ev: {}, aid: 'jinbuk' },
    stars: 3,
  },
  hubei_river: {
    name: '한수 나루', hanja: '漢水渡', region: 'hubei', x: 570, y: 390,
    desc: '한수를 건너는 나루 마을. 짐과 표물이 끊임없이 오간다.',
    biome: { forest: 0.45, water: 0.7, hills: 0.35, fertile: 0.65, cold: 0.4 },
    near: ['baekhak', 'jegal', 'cheongwi', 'gwiyeong'], sang: 'malli',
    trait: { text: '나루터: 표국 수입 ×1.2', perk: { escort: 1.2 }, ev: {} },
    stars: 2,
  },
  hunan_forest: {
    name: '상강 숲', hanja: '湘江林', region: 'hunan', x: 560, y: 500,
    desc: '상강 기슭의 깊은 숲 마을. 사냥감과 약초가 많지만 숲은 어둡다.',
    biome: { forest: 0.8, water: 0.55, hills: 0.5, fertile: 0.55, cold: 0.35 },
    near: ['cheongwi', 'baekhak', 'mandok', 'yasu'], sang: 'geumryong',
    trait: { text: '깊은 숲: 사냥과 약초', perk: {}, ev: { tiger: 1.5 }, quest: { herb: 1.5 } },
    stars: 2,
  },
  xiyu_oasis: {
    name: '월천 오아시스', hanja: '月泉綠洲', region: 'xiyu', x: 170, y: 230,
    desc: '사막 한가운데 달 모양 샘가의 마을. 비단길 상인이 쉬어 가고, 땅은 메마르다.',
    biome: { forest: 0.2, water: 0.25, hills: 0.5, fertile: 0.25, cold: 0.55 },
    near: ['hyeolwol', 'geumryun', 'cheongun', 'chilsal'], sang: 'geumryong',
    trait: { text: '비단길: 새외 상인 사건 ×2, 메마른 땅', perk: {}, ev: { saeoe_merchant: 2 } },
    stars: 3,
  },
  fujian_port: {
    name: '민강 포구', hanja: '閩江浦口', region: 'fujian', x: 790, y: 520,
    desc: '민강 어귀의 포구 마을. 배가 드나들며 장사가 되지만 수적도 드나든다.',
    biome: { forest: 0.5, water: 0.75, hills: 0.6, fertile: 0.45, cold: 0.25 },
    near: ['heuksu', 'haerang', 'sanggwan', 'cheolhyeol'], sang: 'geumryong',
    trait: { text: '포구: 교역 ×1.1, 수적이 잦다', perk: { trade: 1.1 }, ev: { pirates: 2 } },
    stars: 2,
  },
};

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
  '武': ['굳셀 무', '무예·무력. 위쪽 띠에서는 무사·객경·망루를 합친 마을의 방어력, 건물로는 무관.'],
  '名': ['이름 명', '명성. 강호에 알려진 정도. 높을수록 사람과 고수와 사건이 몰려온다.'],
  '村': ['마을 촌', '촌. 가장 작은 마을 등급.'],
  '里': ['마을 리', '마을. 인구 15명 이상. 기와집·시장·객잔 등을 지을 수 있다.'],
  '邑': ['고을 읍', '읍. 인구 35명 이상. 표국과 석벽을 지을 수 있다.'],
  '鎭': ['진압할 진', '진. 인구 70명 이상의 큰 고을.'],
  '城': ['재 성', '현성. 인구 120명 이상. 성벽을 두른 고을. 최종 목표의 하나.'],
  '領': ['거느릴 령', '영주관. 영주가 머물며 다스리는 곳.'],
  '家': ['집 가', '초가 / 무림세가. 짚으로 지붕을 얹은 집, 또는 대대로 무공을 잇는 무림 명가 계열의 표.'],
  '宅': ['집 택', '기와집. 기와를 얹은 번듯한 집.'],
  '田': ['밭 전', '논밭. 곡식을 기른다.'],
  '漁': ['고기 잡을 어', '어장. 물고기를 잡는다.'],
  '倉': ['곳집 창', '창고. 물자를 더 쌓아 둔다.'],
  '鐵': ['쇠 철', '대장간 / 철혈방. 쇠를 다루는 곳, 또는 쇠처럼 냉혹한 사파 방회.'],
  '市': ['저자 시', '시장. 장이 서는 곳.'],
  '客': ['손 객', '객잔 / 손님. 나그네가 묵는 곳. 떠돌이 고수가 찾아온다.'],
  '鏢': ['표 표', '표국 / 만리표국. 상단의 짐(표물)을 호위하는 무인들, 또는 천하의 길을 잇는 큰 표국.'],
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
  '黑': ['검을 흑', '흑풍채 / 흑도. 뒷산의 산적 떼, 또는 산채·수채·살수가 모인 검은 길 계열의 표.'],
  '血': ['피 혈', '혈월교. 붉은 달을 섬기는 마교.'],
  '官': ['벼슬 관', '관부 / 관(官). 세금을 걷고 법을 집행하는 현청, 또는 관청과 관군이 모인 계열과 그 표.'],
  '金': ['쇠 금', '금룡상회. 대륙을 오가는 거상 연합. 또는 돈과 관련된 일.'],
  // 세력의 갈래 (세력 창)
  '正派': ['정파', '의협과 법도를 앞세우는 무림의 바른 갈래. 청운검문·백학문·금강사·태허관이 여기에 든다.'],
  '邪派': ['사파', '이익을 좇아 수단을 가리지 않는 무림의 갈래. 철혈방·만독곡·칠살문이 여기에 든다.'],
  '綠林': ['녹림', '「푸른 숲」, 곧 산속에 숨어 사는 도적 무리. 흑도의 산채로, 흑풍채가 여기에 든다.'],
  '魔敎': ['마교', '정파가 사악하다고 꺼리는 무림의 교파. 혈월교·흑련교·천귀문이 여기에 든다.'],
  '官廳': ['관청', '나라의 일을 보는 관아. 관부가 여기에 든다.'],
  '商團': ['상단', '장사꾼들이 모여 꾸린 무리. 금룡상회·만리표국이 여기에 든다.'],
  '武林世家': ['무림세가', '대대로 무공과 재물을 잇는 무림의 명문 가문. 백리세가·제갈세가·상관세가가 여기에 든다.'],
  '黑道': ['흑도', '밤의 장사와 칼로 먹고사는 검은 길. 흑풍채·흑수채·귀영문·혈영루가 여기에 든다.'],
  '塞外武林': ['새외무림', '변방 요새 바깥, 중원 밖의 무림. 빙설궁·금륜사·야수궁·해랑도가 여기에 든다.'],
  '正': ['바를 정', '바름. 정파(正派) 계열의 표.'],
  '邪': ['간사할 사', '바르지 못함. 사파(邪派) 계열의 표.'],
  '派': ['갈래 파', '갈래, 무리.'],
  '綠': ['푸를 록', '푸른 빛.'],
  '林': ['수풀 림', '숲.'],
  '魔': ['마귀 마', '마귀, 사악한 것. 마교(魔敎) 계열의 표.'],
  '敎': ['가르칠 교', '가르침, 교파.'],
  '團': ['둥글 단', '모임, 무리.'],
  '外': ['바깥 외', '바깥. 새외무림(塞外武林) 계열의 표.'],
  // 세력 문장 (세력 창·천하도)
  '鶴': ['학 학', '백학문. 흰 학의 몸놀림을 본뜬 경공과 검법의 정파.'],
  '剛': ['굳셀 강', '금강사. 금강처럼 굳센 몸을 닦는 무승들의 절.'],
  '虛': ['빌 허', '태허관. 텅 빈 하늘의 이치를 좇는 도사들의 도관.'],
  '蓮': ['연꽃 련', '흑련교. 검은 연꽃을 섬기는 마교의 비밀 교단.'],
  '鬼': ['귀신 귀', '천귀문. 귀신 탈을 쓰고 밤에 움직이는 마문.'],
  '百': ['일백 백', '백리세가. 대대로 창법을 잇는 하북의 무가.'],
  '葛': ['칡 갈', '제갈세가. 진법과 기관술을 잇는 학자 무가.'],
  '上': ['윗 상', '위, 윗사람. 또는 상관세가. 비단 장사로 일어선 강남의 무가.'],
  '水': ['물 수', '흑수채. 물길을 누비는 수적 떼.'],
  '影': ['그림자 영', '귀영문. 장물과 밀정을 쥔 그림자 조직.'],
  '樓': ['다락 루', '높은 다락. 또는 혈영루. 항구 누각에 숨은 살수 조직.'],
  '毒': ['독 독', '만독곡. 독과 해독약을 함께 파는 독문.'],
  '殺': ['죽일 살', '칠살문. 잔혹한 도끼질로 이름난 사파.'],
  '氷': ['얼음 빙', '빙설궁. 북해 얼음벌판 너머의 궁.'],
  '輪': ['바퀴 륜', '금륜사. 서장 고원의 금빛 절.'],
  '獸': ['짐승 수', '야수궁. 짐승을 부리는 남만의 부족 연맹.'],
  '狼': ['이리 랑', '해랑도. 동쪽 바다 섬들의 해적 무리.'],
  '錦': ['비단 금', '금의위. 비단옷 아래 칼을 숨긴 황제 직속 감찰 무관.'],
  '北': ['북녘 북', '진북군. 요동 국경을 지키는 변방군.'],
  // 천하도
  '天下': ['천하', '하늘 아래 온 세상.'],
  '天下圖': ['천하도', '천하의 판도를 그린 지도. 계열의 세력과 전쟁, 고을을 한눈에 본다.'],
  '河北': ['하북', '황하 북쪽 땅. 황도가 가깝고 관도가 사방으로 뻗는다.'],
  '山西': ['산서', '큰 산줄기 서쪽의 황토 고원.'],
  '陝西': ['섬서', '옛 도읍이 있던 산과 협곡의 땅.'],
  '山東': ['산동', '큰 산줄기 동쪽, 바다에 닿은 땅.'],
  '河南': ['하남', '황하 남쪽, 중원의 한복판.'],
  '湖北': ['호북', '큰 호수 북쪽. 장강과 한수가 만나는 물의 땅.'],
  '四川': ['사천', '네 줄기 강이 흐르는 산속 분지.'],
  '江南': ['강남', '장강 남쪽의 물의 고장.'],
  '湖南': ['호남', '큰 호수 남쪽. 상강이 흐르는 숲과 안개의 땅.'],
  '雲貴': ['운귀', '운남과 귀주. 구름 낀 고원과 밀림.'],
  '福建': ['복건', '산이 바다로 내려앉은 동남쪽 땅.'],
  '廣東': ['광동', '남쪽 끝의 덥고 습한 땅.'],
  '北海': ['북해', '북쪽 끝 얼음 바다와 눈벌판. 새외의 땅.'],
  '遼東': ['요동', '요하 동쪽, 동북쪽 국경 너머. 새외의 땅.'],
  '西域': ['서역', '서쪽 사막과 비단길의 오아시스들. 새외의 땅.'],
  '西藏': ['서장', '하늘에 닿은 서쪽 고원. 새외의 땅.'],
  '南蠻': ['남만', '남쪽 밀림의 부족들이 사는 땅. 새외의 땅.'],
  '東海': ['동해', '동쪽 바다와 섬들. 새외의 땅.'],
  // 시작 고을
  '洛水原': ['낙수 들녘', '낙수 강가의 넓은 들.'],
  '雲霧谷': ['운무곡', '구름과 안개의 골짜기.'],
  '煙雨水鄕': ['연우 수향', '안개비 내리는 물의 고장.'],
  '巴蜀盆地': ['파촉 분지', '파와 촉, 곧 사천의 옛 이름. 산으로 둘러싸인 분지.'],
  '苗疆邊境': ['묘강 변경', '남쪽 부족들의 땅과 맞닿은 변경.'],
  '北平官道': ['북평 관도', '북쪽 도읍 북평으로 가는 나라의 큰길.'],
  '蓬萊海岸': ['봉래 해안', '신선이 산다는 봉래의 이름을 딴 바닷가.'],
  '遼河邊城': ['요하 변성', '요하 강가의 국경 성채.'],
  '漢水渡': ['한수 나루', '한수를 건너는 나루.'],
  '湘江林': ['상강 숲', '상강 기슭의 깊은 숲.'],
  '月泉綠洲': ['월천 오아시스', '달 모양 샘이 솟는 사막의 푸른 땅.'],
  '閩江浦口': ['민강 포구', '민강 어귀의 포구.'],
  // 갈래 건물
  '義': ['옳을 의', '의협당. 정파의 협객들이 모여 의를 논하고 무예를 닦는 집.'],
  '祭': ['제사 제', '혈제단. 붉은 달에 피를 바치는 마교의 제단.'],
  '宗': ['마루 종', '종가. 세가의 위패를 모신 큰집.'],
  '暗': ['어두울 암', '흑시. 밤에만 서는 검은 장.'],
  '賭': ['내기 도', '도박장. 투전판이 밤낮으로 도는 곳.'],
  '互': ['서로 호', '호시. 새외 상인과 말과 인삼을 서로 바꾸는 장.'],
  '衙': ['마을 아', '관아. 현령이 업무를 보는 관청.'],
  '臺': ['대 대', '연무대. 누구나 올라 비무를 겨루는 대.'],
  // 사건 두루마리에 나오는 말
  '客卿': ['객경', '손님으로 모셔 높이 대접하는 고수. 객잔에 묵는 떠돌이 고수를 모시면 마을을 지켜 준다.'],
  '卿': ['벼슬 경', '높은 벼슬, 또는 그런 사람을 높여 부르는 말.'],
  '淸河劍訣': ['청하검결', '맑은 강물 같은 검법의 구결을 적은 비급.'],
  '淸': ['맑을 청', '맑음.'],
  '河': ['물 하', '강, 물.'],
  '劍': ['칼 검', '칼, 검법.'],
  '訣': ['비결 결', '비결, 외워 익히는 구결.'],
  '賊': ['도둑 적', '도적·산적과 얽힌 일.'],
  '稅': ['세금 세', '세금과 관련된 일.'],
  '傷': ['다칠 상', '다친 사람과 얽힌 일.'],
  '秘': ['숨길 비', '비밀·비급과 얽힌 일.'],
  '疫': ['전염병 역', '역병.'],
  '旱': ['가물 한', '가뭄.'],
  '豊': ['풍년 풍', '풍년.'],
  '商': ['장사 상', '장사·상단과 얽힌 일. 상단(商團) 계열의 표.'],
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
