# 강호(江湖) 확장 설계 — 천하도, 일곱 계열, 갈림길

이 문서는 세력 확장의 설계이자 모듈 사이의 약속이다. `docs/architecture.md`의 규칙(투영, 저장, 훅, Bus, 한자 풀이)은 그대로 지킨다. 여기서 정한 이름·모양·호출 순서는 바꾸지 않는다. 바꿔야 하면 이 문서를 먼저 고친다.

## 0. 목표 (영주의 요청)

1. 세력이 너무 적다 → **일곱 계열**(정파·마교·무림세가·흑도·사파·새외무림·관)과 중립 상단. 세력은 모두 스물여섯.
2. **시작 고을**을 고르면 그 둘레 세력이 이웃이 되고, 땅 생김(숲·물·산·기름진 들·추위)과 고을 성질도 달라진다.
3. 내 마을 지도 말고도 **천하도(天下圖)** 로 천하의 판도, 전쟁, 계열별 세력 양상과 그 흐름을 본다.
4. 할 일이 너무 적다 → 외부 세력이 일으키는 **다채로운 사건**, **의뢰(파견)**, **외교**(사신·교역·동맹·현상금·첩자·중재), **전쟁 지원**.
5. 길이 하나뿐이다 → 제4장 **갈림길**에서 어느 계열과 손잡느냐, 또는 홀로 서느냐에 따라 제5·6장, 절정, 결말이 갈린다. 갈래는 **여덟**이다.

### 0.1 튜토리얼 보호 (가장 먼저 지킬 것)

- 제1~3장은 지금처럼 흑풍채와 관부만으로 돌아가야 한다. `Story.allowJianghu()` 훅을 둔다. 제4장(index 3) 이상이면 참이고, 안내를 건너뛰었다면 8일째부터 참이다. 이야기 모듈이 없으면 참이다.
- 이것이 거짓인 동안: 전쟁이 일어나지 않고, 의뢰가 붙지 않고, 새 외교 단추(사신·교역·동맹·현상금·첩자·지원·중재)를 쓸 수 없고, 강호에서 오는 두루마리와 소식 알림도 없고, 고을 성질의 원군(요하 변성의 진북군, `JH.siteAid`)도 오지 않는다. 힘의 자연 성장만 돈다. 예물과 산하는 지금처럼 쓴다.
- 흑풍채의 처음 힘은 100이다. §4.3의 힘 배수가 1이 되어 위협과 습격이 지금과 같다.
- 흑풍채(`heukpung`)는 힘이 25 아래로 내려가지 않는다. 멸문시킬 수 있는 것은 이야기가 부를 때(`JH.dissolve`)뿐이다. 관부(`gwanbu`)는 10 아래로 내려가지 않는다.
- 흑풍채 현상금은 `allowJianghu()`가 참일 때만 걸 수 있다.
- 사건마다 `tier`를 둔다(§9). `Story.allowEvent`는 자기 id 목록에 없는 사건을 `tier`로 거른다. `tier`가 없으면 heavy로 친다. `EV`에 없는 id(상소함이 묻는 `'petition'`)는 light로 친다(제1장에만 막히고, 제2·3장과 건너뛴 판에서는 예전처럼 나온다).

## 1. 계열 (data.js `CAMPS`, `CAMP_ORDER`, `CAMP_ATT`, `RIVALRIES`)

```js
CAMPS[key] = {
  name: '정파', hanja: '正派', seal: '正', color: '#4f7fb8', dark: '#1f3550',
  desc: '…',
  perk: { train: 1.5, happy: 3, aid: true },  // 주군일 때 (§5)
  perkText: '무사 수련 +50%, 민심 +3, 습격 때 원군',
  route: 'jeong',                             // 이 계열을 주군으로 두면 걷는 갈래 (§8). 상단은 'free'
  tribute: 1,                                 // 공물 배수 (상단 0.6, 그 밖 1)
}
CAMP_ORDER = ['jeong', 'sega', 'gwan', 'sang', 'saeoe', 'sa', 'heuk', 'ma']
```

| key | 이름 | 표 | `perk` (주군일 때, 동맹이면 §5의 절반 규칙) |
| --- | --- | --- | --- |
| jeong | 정파(正派) | 正 | `train 1.5`, `happy 3`, `aid` |
| ma | 마교(魔敎) | 魔 | `atk 1.3`, `dailySilver 0.4`(인구당), `happy -10`, `aid` |
| sega | 무림세가(武林世家) | 家 | `heroEvery 12`(날마다 세가 무인 하나가 객경으로 온다), `fame 0.3`(하루), `aid` |
| heuk | 흑도(黑道) | 黑 | `dailySilver 0.3`, `bandit 0.5`, `gwanRel -1` |
| sa | 사파(邪派) | 邪 | `dailySilver 0.35`, `gwanRel -1`, `aid` |
| saeoe | 새외무림(塞外武林) | 外 | `hp 1.2`, `trade 1.15`, `gwanRel -0.5`, `aid` |
| gwan | 관(官) | 官 | `tax 1.15`, `bandit 0.5`, `aid` |
| sang | 상단(商團) | 商 | `trade 1.3` (`aid` 없음) |

- `bandit`은 흑도 계열 이웃의 위협 증가에 곱한다. `gwanRel`은 하루에 한 번 `changeRel('gwanbu', x)`로 쓴다(번짐 없음). 다만 관부와의 관계가 −15 아래면 더 깎지 않는다. 눈총만으로는 관부가 위협을 쌓는 −20 아래로 내려가지 않는다(의뢰·현상금·싸움으로 깎인 것은 그대로다).
- 같은 한자가 여러 뜻으로 쓰이므로, `HANJA_GLOSS`에는 계열 이름(`正派 魔敎 武林世家 黑道 邪派 塞外武林 官 商團`)을 낱말째 넣는다. 한 글자 표(`家 黑 官`)는 이미 다른 풀이가 있으면 '鐵'처럼 두 뜻을 함께 적은 풀이로 바꾼다.

`CAMP_ATT[a][b]`는 −100..100이고 대칭이다. 같은 계열끼리는 +50이다. 적지 않은 칸은 0이다.

- jeong–ma −90, jeong–sa −50, jeong–heuk −60, jeong–sega +30, jeong–gwan +10, jeong–saeoe −20
- ma–sega −60, ma–gwan −70, ma–sa −10, ma–saeoe −10
- sega–sa −30, sega–heuk −40, sega–gwan +20, sega–saeoe −10
- heuk–gwan −70, heuk–sa +20, heuk–sang −20
- sa–gwan −40
- saeoe–gwan −45
- gwan–sang +10

`RIVALRIES = [[a, b], …]`: 같은 계열 안의 숙적 짝이다(세가 분쟁·흑도 쟁패에 쓴다). 예: `['baengni','sanggwan']`, `['heuksu','gwiyeong']`, `['cheolhyeol','chilsal']`.

**관계 번짐** `JH.relSpread(k, d)`: 다른 세력 Y의 관계가 `d × CAMP_ATT[camp(k)][camp(Y)] / 100 × 0.5`만큼 움직인다(k 자신과 noLord 세력은 빼고, 소수 그대로). 갈래가 독립(`free`)이면 번짐은 절반이다. 예물·사신·의뢰 결과·산하·동맹·끊기에만 부른다. 습격 결과에는 부르지 않는다. 지금의 `rivals` 규칙(sim.js의 becomeVassal·endRaid)은 이것으로 바꾼다. Δ: 산하 +40, 동맹 +25, 주종·동맹 끊기 −40.

## 2. 세력 (data.js `FACTIONS`, `FACTION_ORDER`)

`FACTIONS`는 지금처럼 id로 찾는 사전이다. 기존 여섯 id(`cheongun cheolhyeol heukpung hyeolwol gwanbu geumryong`)는 **그대로 둔다**.

```js
FACTIONS[id] = {
  name, hanja,            // 문장 한 글자. 스물여섯 모두 다르게, 갈래 건물 한자와도 겹치지 않게
  camp,                   // CAMPS 키
  type,                   // 보이는 글. 기본은 `${CAMPS[camp].name}(${CAMPS[camp].hanja})`. 흑풍채는 '흑도(黑道) · 산채', 관부는 '관(官) · 현청'으로 둔다(계열 이름이 카드에 보이게)
  color, dark, desc,
  unit, leader,           // 군사가 있는 세력만. leader.hat 은 선택 (없으면 unit.hat)
  military, baseSize, growth,
  goals,                  // ['loot'|'occupy'|'punish', …]. events.js chooseGoal 이 이것을 읽는다
  startRel,               // 이웃일 때 첫 관계. local 이 아니면 −15 이상
  home,                   // REGIONS 키. 'local' 이면 고을 곁에 본산이 생긴다
  power,                  // 처음 힘 30..120
  noLord,                 // 산하·동맹 불가 (산적 떼)
  temper: { greed, honor, aggro },   // 0..1
  perk,                   // 문자열. data.js 끝에서 CAMPS[camp].perkText 로 채운다 (noLord 는 비움). events.js·ui.js 가 읽는다
}
FACTION_ORDER  // 스물여섯 id 전부, CAMP_ORDER 순서로
```

| 계열 | id · 이름 · 문장 · 본산 |
| --- | --- |
| 정파 | `cheongun` 청운검문 靑 shaanxi · `baekhak` 백학문 鶴 hubei · `geumgang` 금강사 剛 henan · `taeheo` 태허관 虛 sichuan |
| 마교 | `hyeolwol` 혈월교 血 xiyu · `heungnyeon` 흑련교 蓮 yungui · `cheongwi` 천귀문 鬼 hunan |
| 무림세가 | `baengni` 백리세가 百 hebei · `jegal` 제갈세가 葛 hubei · `sanggwan` 상관세가 上 jiangnan |
| 흑도 | `heukpung` 흑풍채 黑 local · `heuksu` 흑수채 水 fujian · `gwiyeong` 귀영문 影 henan · `hyeolyeong` 혈영루 樓 shandong |
| 사파 | `cheolhyeol` 철혈방 鐵 jiangnan · `mandok` 만독곡 毒 guangdong · `chilsal` 칠살문 殺 shanxi |
| 새외 | `bingseol` 빙설궁 氷 beihai · `geumryun` 금륜사 輪 xizang · `yasu` 야수궁 獸 nanman · `haerang` 해랑도 狼 donghai |
| 관 | `gwanbu` 관부(현청) 官 local · `geumui` 금의위 錦 hebei · `jinbuk` 진북군 北 liaodong |
| 상단 | `geumryong` 금룡상회 金 jiangnan · `malli` 만리표국 鏢 henan |

- 그림에 쓸 수 있는 값은 이것뿐이다. 모자: `straw farmer band hood mask helmet guard`, 그리고 새로 그릴 `bald`(머리카락 없음, 불문)와 `fur`(털모자, 새외). 무기: `sword blade spear axe bow fist`, 그리고 새로 그릴 `staff`(곤). 새 값 셋은 sprites.js가 그린다. 그리기 전에도 data.js가 먼저 써도 된다(없으면 무난하게 그려진다).
- sprites.js의 '흑풍채 우두머리는 band' 특례는 `leader.hat` 자료로 옮긴다.
- 관부와 흑풍채는 local이다. 어느 고을에서 시작하든 곁에 있고 늘 이웃이다.

## 3. 천하 지리 (data.js `REGIONS`, `SITES`)

천하도 좌표는 가로 1000 × 세로 700이다. 동쪽이 오른쪽, 북쪽이 위(y가 작을수록 북쪽).

```js
REGIONS[key] = { name: '섬서', hanja: '陝西', x, y, outer: false, desc }
SITES[key] = {
  name: '운무곡', hanja: '雲霧谷', region: 'shaanxi', x, y,
  desc: '한 줄',
  biome: { forest, water, hills, fertile, cold },   // 0.2..0.8
  near: [id, id, id, id],    // local 둘(흑풍채·관부)과 상단 하나는 빼고 적는다. 계열이 모두 다르고 관·상단은 넣지 않는다
  sang: 'geumryong' | 'malli',
  trait: { text: '…', perk: { … }, ev: { eventId: 배수 } },  // 고을 성질
  stars: 1..3,               // 어려움
  first: true,               // '처음이라면' 표시 (하남 들녘 하나)
}
```

지역 열여덟(키 · 이름 · 중심):

- 중원 열둘: `hebei` 하북 河北 (680,170) · `shanxi` 산서 山西 (560,200) · `shaanxi` 섬서 陝西 (430,270) · `shandong` 산동 山東 (790,250) · `henan` 하남 河南 (620,310) · `hubei` 호북 湖北 (560,400) · `sichuan` 사천 四川 (360,410) · `jiangnan` 강남 江南 (790,400) · `hunan` 호남 湖南 (560,500) · `yungui` 운귀 雲貴 (380,540) · `fujian` 복건 福建 (790,530) · `guangdong` 광동 廣東 (620,600)
- 새외 여섯(`outer: true`): `beihai` 북해 北海 (520,40) · `liaodong` 요동 遼東 (860,120) · `xiyu` 서역 西域 (110,200) · `xizang` 서장 西藏 (150,460) · `nanman` 남만 南蠻 (330,650) · `donghai` 동해 東海 (950,420)

지역 경계는 중심점들의 보로노이로 그린다. 황하와 장강은 고정된 곡선이다.

고을 열둘 (`near`는 local 둘과 상단을 뺀 넷이다):

| 키 | 이름 | 지역 · 자리 | 이웃 넷 | 상단 | 별 | 성질 |
| --- | --- | --- | --- | --- | --- | --- |
| `henan_field` | 낙수 들녘 洛水原 | henan (600,330) | geumgang, gwiyeong, chilsal, baengni | malli | 1 (first) | 중원 한복판: 시장 수입 ×1.1 |
| `shaanxi_valley` | 운무곡 雲霧谷 | shaanxi (430,255) | cheongun, chilsal, hyeolwol, jegal | malli | 2 | 험한 산골: 돌이 흔하다 |
| `jiangnan_water` | 연우 수향 煙雨水鄕 | jiangnan (780,390) | sanggwan, cheolhyeol, heuksu, baekhak | geumryong | 1 | 강남 물길: 교역 ×1.15 |
| `sichuan_basin` | 파촉 분지 巴蜀盆地 | sichuan (360,415) | taeheo, heungnyeon, geumryun, jegal | malli | 2 | 깊은 숲: 목재가 흔하다 |
| `yungui_frontier` | 묘강 변경 苗疆邊境 | yungui (390,560) | heungnyeon, mandok, yasu, taeheo | geumryong | 2 | 남쪽 밀림: 약재 의뢰가 잦고 겨울이 없다 |
| `hebei_road` | 북평 관도 北平官道 | hebei (690,175) | baengni, hyeolyeong, bingseol, geumgang | malli | 2 | 황도 가까이: 세금 ×1.1, 관 사건이 잦다 |
| `shandong_coast` | 봉래 해안 蓬萊海岸 | shandong (800,270) | hyeolyeong, haerang, cheolhyeol, baengni | geumryong | 2 | 바닷가: 어장 ×1.2, 해적 소문 |
| `liaodong_border` | 요하 변성 遼河邊城 | liaodong (840,140) | bingseol, baengni, hyeolyeong, chilsal | malli | 3 | 국경: 진북군이 원군을 보낸다, 겨울이 혹독하다 |
| `hubei_river` | 한수 나루 漢水渡 | hubei (570,390) | baekhak, jegal, cheongwi, gwiyeong | malli | 2 | 나루터: 표국 수입 ×1.2 |
| `hunan_forest` | 상강 숲 湘江林 | hunan (560,500) | cheongwi, baekhak, mandok, yasu | geumryong | 2 | 깊은 숲: 사냥과 약초 |
| `xiyu_oasis` | 월천 오아시스 月泉綠洲 | xiyu (170,230) | hyeolwol, geumryun, cheongun, chilsal | geumryong | 3 | 비단길: 새외 상인 사건 ×2, 메마른 땅 |
| `fujian_port` | 민강 포구 閩江浦口 | fujian (790,520) | heuksu, haerang, sanggwan, cheolhyeol | geumryong | 2 | 포구: 교역 ×1.1, 수적이 잦다 |

- 그래서 고을마다 갈래가 다섯(이웃 넷의 계열 + 관), 그리고 독립이 열린다. 여섯 무림 계열은 저마다 여섯 고을 이상에 이웃으로 들어간다.
- `biome`은 0.2~0.8 사이다. 효과는 이렇다. 모두 0.5일 때 지금과 같다.
  - forest·water·hills → 지형(§11).
  - fertile → 논밭 수확 ×(1 + 0.4(f − 0.5)).
  - cold → 겨울 논밭 ×(1 − 0.6(c − 0.5)), 겨울 식량 소비 ×(1 + 0.4(c − 0.5)).
  - 이 배수는 sim.js의 `farmMul(si)`, `fishMul(si)`(겨울 ×0.6과 `JH.perk('fish')`), `foodUseMul(si)`, `isWinter(si)`(넷째 철이고 `trait.noWinter`가 아님) 하나로 셈한다. economyStep과 육방의 식량 내다보기가 함께 쓴다. 겨울이 없는 고을은 넷째 철을 봄처럼 거두고 눈도 그리지 않는다.
- `trait.perk`는 `JH.perk`에 그대로 접힌다. `trait.ev`는 events.js가 사건 가중치에 곱한다.

## 4. 천하 상태 (js/jianghu.js, `S.jh`)

`js/jianghu.js`는 새 모듈 `JH`다. 스크립트 순서는 events.js 다음, admin.js 앞이다. 저장되는 상태 `S.jh`는 순수 JSON이다:

```js
S.jh = {
  v: 1,
  site: 'henan_field',
  seed,                          // 천하를 만든 씨앗 (마을 씨앗과 같다)
  seats: { [id]: { x, y } },     // 본산 자리. 흑풍채는 고을의 북쪽(−90°±20°) 40~60, 관부는 서쪽 관도 방향 40~60
  power: { [id]: number },       // 0 이면 멸문
  dead: { [id]: day },           // 멸문한 날 (30일 뒤 힘 30으로 다시 일어날 수 있다)
  near: [id, …],                 // 이웃 = 흑풍채, 관부, SITES.near 넷, 상단 하나
  wars: [War],
  news: [{ day, text, kind, f: [ids] }],   // 최근 40개, 새것이 앞
  hist: [{ day, camp: { [camp]: power합 } }],   // 닷새마다, 최근 12개
  quests: [Quest],
  qlog: [Quest],                 // 끝난 의뢰 최근 10개
  pacts: [id],                   // 동맹 (주군은 지금처럼 S.vassal)
  route: null,                   // 갈래 (§8). 이야기 모듈만 바꾼다
  routeSwitches: 0,
  spies: { [id]: day },          // 첩자의 끝날 (dayOf)
  trade: { [id]: day },          // 교역 협정의 끝날 (dayOf)
  grudge: { [id]: day },         // 현상금 원한의 끝날 (dayOf)
  cd: { [kind + ':' + id]: day },// 외교 대기 (dayOf). 예물은 지금처럼 S.flags['gift_' + id]
  lastScroll: day,               // 강호 두루마리를 띄운 마지막 날
  nextWarCheck: day,
  victory: null,                 // 이긴 갈래 (천하도에 문장을 찍는다)
}
```

- **시간 단위**: `v.away.until`과 `Quest.back`은 `S.time`(시진)이다. `expires`, `spies`, `trade`, `grudge`, `cd`, `dead`, `day` 값은 `dayOf()`(날)이다.
- **저장 규칙**: `S.jh`, 의뢰, 사건 data 안에 `path chat wt bmap hitT flash exit`라는 이름의 키나 `_`로 시작하는 키를 두지 않는다(serialize가 버린다). 길목은 `exitIdx`(번호)로 둔다.
- **이웃**: `SITES[site].near` + local 둘 + `SITES[site].sang`. 멸문한 이웃은 열흘 뒤 자리가 채워진다. 그 고을에서 영향(`power / (1 + (d/120)^2)`)이 가장 크고 같은 계열이 아직 이웃에 없는 세력이 들어오고, '새 세력이 빈자리를 차지했다'는 소식이 남는다.
- **첫 관계**: 이웃은 `startRel`이고, 본산이 같은 지역이면 +10이다. 이웃이 아니면 0이다. 흑풍채의 위협은 지금처럼 35에서 시작한다.

### 4.1 순수 함수 (S 없이)

새 게임 고르기 화면은 아직 `S`가 없을 때 돈다. 그래서 다음 둘은 `S`를 읽지 않고 `mulberry32(seed + 상수)`만 쓴다. `Math.random`은 쓰지 않는다. 미리 본 천하가 실제 게임과 같아야 한다.

- `JH.makeWorld(seed) → { seed, seats, power }`: local이 아닌 스물네 세력의 본산(지역 중심 ±40)과 힘(`power × 0.8..1.2`).
- `JH.siteInfo(world, siteKey) → { near: [ids], localSeats: { heukpung, gwanbu }, stars, routes: [camp…], rel: { [id]: 첫 관계 } }`.
- `JH.newWorld(siteKey, seed)`: 위 둘로 `S.jh`를 만들고, `S.factions`를 스물여섯 모두 채우고, `World.exits[i].toward = [id…]`를 붙인다.

### 4.2 하루 흐름 `JH.daily()`

sim.js `dailyTick`에서 관계 되돌림과 growthCheck 다음, `hook(Admin,'daily')` 앞에서 부른다. 그래야 자동 저장에 담긴다.

- **힘**: `power += growth × 3 × (1 − power/200) × rnd(0.5, 1.5)`(로지스틱). 전쟁 결과로 오르내린다. 멸문 30일 뒤 30%의 확률로 힘 30으로 다시 일어난다(소식). local 둘은 이야기만 멸문시키므로 다시 일어나지 않는다.
- **전쟁**(`allowJianghu()`일 때만): 사흘마다 새 전쟁을 따진다. 동시에 최대 셋이다. 후보는 거리 400 안의 두 세력이다. 계열끼리 `CAMP_ATT ≤ −40`이거나 `RIVALRIES` 짝이어야 한다(숙적 짝은 가중치 0.4). 갈래가 정해지기 전에는 local 세력을 빼고, 영주의 주군·동맹이 한쪽이면 가중치 ×0.5다. 이름: 정마대전(정파 대 마교), 정사대전(정파 대 사파·흑도), 토벌전(관 대 흑도·사파), 새외 침공(새외 대 관·정파), 세가 분쟁, 흑도 쟁패, 그 밖에는 '○○과 ○○의 싸움'.

```js
War = { id, a: [ids], b: [ids], name, since, score, mine: { a: 0, b: 0 }, front: { x, y }, scripted: false }
```

  - 날마다 `score += (힘a − 힘b) / 80 + rnd(−0.8, 0.8)`. 힘a는 a 쪽 힘의 합이다. 영주의 몫은 낸 그때 `score`에 바로 더해지고 줄지 않는다. 쌓인 몫은 `mine`에 따로 적는다(보여 주기용).
  - |score| ≥ 10이면 끝난다. 진 쪽은 힘 −30%, 이긴 쪽은 +15%다. 20일이 지나면 점수 부호로 승패를 가리고, 이때 진 쪽은 −15%만 깎인다.
  - `scripted` 전쟁(이야기가 연다)도 같은 규칙이다. 다만 열린 지 닷새 안에는 영주의 몫(지원·원군 의뢰)만으로 끝나지 않는다: 그 몫이 |score|를 10 넘게 밀면 9.5에서 멈춘다(날마다의 흐름으로는 끝날 수 있다). 지면 갈래가 실패하는 것은 아니다. 진 쪽 힘만 깎이고, 이야기가 열흘 뒤 다시 연다.
  - 멸문: 힘이 0 이하가 되면 `JH.dissolve(id)`를 부른다(§4.4).
- **소식**: 전쟁 시작·끝, 멸문·재기, 힘이 열흘에 +30 넘게 오름, 빈자리 채움, 무림대회. `JH.news()`. 이웃이 얽힌 큰 소식은 logMsg와 알림으로도 띄운다.
- **강호 두루마리**(굴림 없이 JH가 바로 띄운다, 하루에 하나까지): 이웃이 전쟁에 들면 `jh_war_sides`(양쪽 사신이 편을 들라 한다), 이웃이 멸문하면 `jh_survivors`, 이웃이 열흘에 힘 +30이면 `jh_surge`, 동맹이 전쟁에 들면 `jh_pact_call`. `S.eventQueue.push({ id, data })`로 넣고, 그 사건은 events.js가 만든다(§9).
- **의뢰**(§6) 붙이기·기한 처리, 첩자·교역·원한 기한, 동맹 관계 30 아래 깨짐, 닷새마다 `hist`.
- **고을 성질과 혜택의 날마다 몫**: `dailySilver`, `fame`, `gwanRel`, `heroEvery`(세가).

`JH.hourly()`는 hourlyTick에서 부른다. 의뢰에서 돌아오는 사람을 처리한다.

### 4.3 위협·습격과 힘

- `raidSize(k)`에 `clamp(power/100, 0.6, 1.5)`를 곱한다.
- 위협 증가(threatTick)는 **이웃만** 따진다. 곱하는 값: `clamp(power/100, 0.5, 1.5)`. 그 세력이 다른 곳과 전쟁 중이면 ×0.5, 내 주군·동맹과 전쟁 중이면 ×1.5다. 원한이 있으면 ×1.3이고, 흑도 계열이면 `JH.perk('bandit')`를 곱한다.
- 위협 상한은 100이다. 습격 하나가 끝나면 다른 이웃의 위협이 모두 −20 된다.
- 습격은 그 세력 본산 쪽 길목으로 온다: `JH.exitFor(id) → number[]`(길목 번호, 좋은 순서). World.exits는 늘 [서 0, 동 1, 북 2, 남 3]이다. 고을에서 본산까지 |dx| > |dy|이면 동/서, 아니면 북(dy<0)/남이다. 둘째 후보는 그다음 가까운 방향이다. 흑풍채는 늘 [2, 0]이다(튜토리얼이 북쪽 길목을 쓴다). `pickExit(k) = World.exits[pick(JH.exitFor(k))]`이고, `S.jh`가 없으면 `[0,1,2,3]`에서 고른다.
- **원군**: 습격 한 번에 한 무리만 온다. 주군이 먼저이고, 없으면 동맹 하나가 절반 규모로 온다(그 동맹이 전쟁 중이 아닐 때만). 요동 변성은 성질로 관부 원군이 따로 한 무리 온다. `JH.aidFor(raidFaction) → { id, n } | null`.

### 4.4 멸문 `JH.dissolve(id, opts)`

- 힘 0, `dead[id] = day`, 이웃에서 뺀다(열흘 뒤 빈자리 채움), 전쟁에서 빼고, 걸린 습격(`S.scheduled`의 raid, `S.eventQueue`의 `_raid`)을 지운다.
- 주군이었으면 `S.vassal = null`이 된다(관계·위협 벌칙 없음). `Bus.emit('vassal', null)`을 보내고, 이야기는 이것을 듣고 갈래를 옮긴다(§8.3). 동맹이었으면 동맹을 끝낸다. 점령군이었으면 점령이 끝나고 점령군은 달아난다.
- 영주의 주군은 이야기가 부르지 않는 한 힘 25 아래로 내려가지 않는다(물러날 뿐 망하지 않는다). local 둘은 §0.1을 따른다.
- 소식(`'○○이 멸문했다'`)을 남기고, 이웃이었으면 `jh_survivors` 두루마리를 띄운다. `opts.quiet`이면 둘 다 하지 않는다(이야기가 흑풍채를 조용히 흡수할 때, §8.2).
- local 둘(흑풍채·관부)은 멸문하면 다시 일어나지 않는다(§4.2).

### 4.5 옛 저장

`S.jh`가 없으면 `JH.onLoad()`가 `JH.migrate()`를 부른다. 이때 고을은 `henan_field`이고 천하는 `S.seed`로 만든다. **이웃은 옛 여섯**(`cheongun cheolhyeol heukpung hyeolwol gwanbu geumryong`) 그대로다. 옛 관계·위협·산하·점령은 그대로 두고, 나머지 스무 세력은 관계 0으로 더한다. 산하가 있고 제4장 이후라면 이야기가 그 계열을 갈래로 정한다(Story.onLoad).

## 5. 산하·동맹·혜택 (`JH.perk`)

- **산하**(`S.vassal`): 지금처럼 이웃이고 관계 40 이상이어야 든다. 매일 공물을 바친다(`4 + 인구×0.25`에 계열 `tribute`를 곱한다). 갈림길 카드로 들면 관계 조건 없이 선납 은자 100이다(§8.1).
- **동맹**(`S.jh.pacts`): 이웃이고 관계 60 이상, 명성 60 이상이어야 한다. 그 세력이 주군 계열과 `CAMP_ATT ≤ −40`이면 안 되고, 흑풍채 같은 noLord도 안 된다. 동맹은 진(rank 3)이 되기 전에는 하나, 현성(rank 4)이면 둘까지 맺는다. 공물은 없다. 관계 30 아래로 떨어지면 깨진다.
- 주군과 동맹은 관계 되돌림(30 위 −0.5/일)에서 빠진다.
- **혜택 접기** `JH.perk(name)`:
  - 곱하는 값(`train atk hp tax trade bandit`): 주군은 그대로, 동맹은 `1 + (m − 1)/2`.
  - 더하는 값(`happy fame dailySilver gwanRel petitionDays tournament`): 주군은 그대로, 동맹은 절반.
  - `heroEvery`: 동맹이면 ×2.
  - 동맹이 주군과 같은 계열이면 겹치지 않는다(주군 것만).
  - 고을 성질(`SITES[site].trait.perk`)과 갈래 건물(§8.4, 쓸 수 있고 일꾼이 하나 이상)도 여기에 접는다.
  - 결과는 기억해 두고 주군·동맹·갈래·`built`·`buildingDestroyed`·`day` 때, 그리고 일꾼이 다시 배치될 때(sim.js `refreshAssign` 끝의 `hook(JH, 'touch')`) 다시 셈한다(사람마다 매 걸음 불러도 싸게).
  - `JH.perk('aid')`는 쓰지 않는다. 원군은 `JH.aidFor`다.
- sim.js `happinessFactors`의 훅 목록에 JH를 더한다. `JH.happinessFactors()`는 `['정파의 비호(청운검문)', 3]`처럼 주군·동맹·갈래 건물마다 줄을 따로 돌려준다. 지금의 `S.vassal === '…'` 줄은 지운다.

## 6. 의뢰와 파견

```js
Quest = {
  id, fid, kind,          // 'escort' 호위 · 'suppress' 토벌 · 'scout' 정탐 · 'retrieve' 탈환 · 'war' 원군 · 'assassin' 암살 · 'smuggle' 밀수 · 'herb' 약재
  title, text,
  target,                 // 토벌·암살 대상 세력 id, 원군이면 War id. 없으면 null
  need: { n, martial },   // 권하는 사람 수와 무공 합. 화면에는 경지로 적는다 ('이류 둘')
  days,                   // 1~3 (원군 4)
  reward: { silver, fame, rel },
  risk,                   // 0..0.5
  expires,                // dayOf
  state: 'open' | 'away' | 'done' | 'failed',
  party: [villagerId],
  back,                   // S.time
  ok,                     // 결과 (끝난 뒤)
}
```

- **붙이기**(`allowJianghu()`일 때, 평균 하루 하나): 열린 의뢰는 셋까지다(객잔이 있으면 +1, 표국이 있으면 +1). 꽉 차면 새로 붙지 않는다. 이웃이 대부분 내고, 먼 세력은 객잔·표국이 있을 때만 낸다. 갈래가 정해지면 새 의뢰의 40% 이상이 갈래 계열 것이고, 갈래 계열 의뢰는 늘 하나 이상 열려 있다. 의뢰는 두루마리로 띄우지 않는다. [세력] 단추에 배지를 단다(`JH.badge()` → 열린 의뢰 수).
- **계열에 어울리는 종류**: 정파·관 → 토벌·정탐·원군 / 세가 → 탈환·호위·원군 / 흑도·사파 → 밀수·암살·정탐 / 마교 → 암살·원군 / 새외 → 약재·호위 / 상단 → 호위·약재.
- **보상**: 은자 ≈ `20 × n × days × (1 + risk)`, 명성 2~8, 관계 6~10.
- **보내기** `JH.dispatch(qid, ids) → { ok, text, why }`: 무사(`role === 'guard'`)나 객경을 1~4명 보낸다. 동시에 나가 있는 무리는 하나다(읍은 둘, 진 이상은 셋). 습격이 대기 중이거나 벌어지는 중이면 막힌다. 화면에는 '남는 무력 X · 가장 센 위협 Y%(쳐들어오면 약 Z명)'과 성공 확률을 바로 보인다(`JH.chance(qid, ids)`).
- **성공 확률**: `p = clamp(0.65 + (무공합 − need.martial) × 0.12 + 0.08 × (n − need.n), 0.15, 0.95)`.
- **파견 중**: 보낸 이에게 `v.away = { q: qid, until, exitIdx, gone: false }`를 단다. **`v.job`은 그대로 둔다**(자리는 남고 역할은 무사 그대로).
  - units.js: `desiredAct`가 맨 먼저 `'away'`를 돌려준다. `'away'` 행동은 `World.exits[exitIdx]`로 걸어가고, 닿으면 `gone = true; inside = true; insideB = 0`으로 숨긴다(기존의 숨김 처리를 그대로 탄다).
  - units.js는 `unitsReturn(v)`도 낸다: 길목 칸에 놓고 `inside = false`로 하고 `v.away`를 지우고 `act = null`로 한다.
- **돌아오기**: `JH.hourly()`만 판정한다. `S.time ≥ until`이면 성공을 굴리고, 보상·관계(+번짐)를 주고 `unitsReturn`을 부른다.
  - 토벌·암살이 성공하면 대상 힘 −8~−15, 대상과 관계 −15다.
  - 밀수·암살은 관 계열 이웃과 관계 −4다.
  - 원군이 성공하면 그 전쟁 점수에 +3, 실패하면 +0.5다.
  - 실패: 보상 없음, 관계 −3. 다치거나 죽는 것은 실패했을 때만이다. 다칠 확률은 `risk`(체력 1/3), 죽을 확률은 `risk × 0.2`이고, 객경은 죽지 않는다.
  - 결과는 마을 기록과 알림으로 남기고 `qlog`에 적는다.
- **불러들이기** `JH.recall(qid)`: 6시진 뒤 돌아오고, 의뢰는 실패, 관계 −3.
- **파견 중인 사람을 빼는 곳**: events.js `fighters()`/`civilians()`, sim.js refreshAssign의 일 없는 이 목록·`defensePower`·봉기 인원·굶주림/불만/품삯 때문에 떠나는 이 고르기, petitions.js `petFree`, 순찰. ui.js·tips.js에는 `'away'` 행동 글(`'○○의 의뢰로 길을 떠남'`)을 더한다. `popCount`와 살아 있는 사람 수에는 넣는다.

## 7. 외교 `JH.act(kind, id, opts) → { ok, text, why }`

모두 `allowJianghu()`일 때만 쓴다(예물은 늘 쓸 수 있다). `JH.canAct(kind, id) → { ok, why, cost }`로 단추를 켜고 끈다.

| kind | 조건 | 값 | 효과 |
| --- | --- | --- | --- |
| `gift` 예물 | 하루 한 번 (`S.flags['gift_'+id]`) | 은자 50 | 관계 +6, 번짐 |
| `envoy` 사신 | 관계 ≥ −60, 세력마다 5일 대기 | 은자 60 + 인구 | 관계 +10~+14, 위협 −15, 번짐 |
| `trade` 교역 협정 | 관계 ≥ 20, 상단·새외·세가(이웃이 아니어도 된다), 동시에 둘 | 은자 60 | 20일 동안 매일 은자 `2 + 시장 수 × 2`, 관계 +3 |
| `pact` 동맹 / `unpact` | §5 | — | 동맹을 맺는다(번짐 +25). 끊으면 관계 −25, 번짐 −40 |
| `bounty` 현상금 | 관(관부·금의위) 관계 ≥ 20, 대상은 흑도·사파·마교 이웃. 대상마다 15일 대기. 관 계열 힘 합이 대상 힘×0.8 이상 | 은자 120 | 대상 힘 −20, 위협 0, 대상과 관계 −20, 관부 관계 −5, 10일 원한 |
| `spy` 첩자 | 세력마다 10일 대기 | 은자 30 | 10일 동안 정확한 위협 %, 다음 습격 예상(날·길목·규모), 전쟁을 보인다. 길목은 습격이 정해졌으면 그 길목, 아니면 올 수 있는 둘('○○ 또는 ○○ 쪽으로'). 20% 들킴: 관계 −15 |
| `support` 전쟁 지원 | 전쟁 중인 한쪽. 그 쪽에 이웃이 있어야. 한 싸움에 하루 전황 +3까지(`JH.supportLeft`, `w.paid = { day, amt }`) | `{silver, food, weapons}` (하루 몫을 넘기면 그만큼 줄여서 받는다) | 점수 += 은자/50 + 식량/80 + 병장기/5. 그 쪽 관계 +5, 반대쪽 −8 |
| `mediate` 중재 | 서로 싸우는 이웃 둘과 모두 관계 ≥ 0 | 은자 150 | 전쟁이 끝난다(무승부), 명성 +15, 양쪽 관계 +5 |

- 첩자가 없으면 위협은 낱말로만 보인다: 잠잠(30 미만) · 술렁(70 미만) · 칼을 간다(그 이상). `JH.threatWord(id)`, `JH.spied(id)`.
- 세력 카드에는 '힘 85 · 쳐들어오면 약 12명'(`JH.raidEstimate(id)`)을 보인다.

## 8. 갈림길 — 여덟 갈래 (story.js)

### 8.1 제4장 「갈림길(岐路)」

- 목표: 천하도 열어 보기(`flag('sheet_worldmap')`), 세력 살펴보기, 인구 35(읍), **길 정하기**.
- 장이 열리면 총관이 말하고 `crossroads` 두루마리를 띄운다(events.js가 그린다, §9).
  - 선택지는 이웃 계열마다 하나(관 포함, 흑풍채·상단 제외)다. 카드에는 대표 세력(그 계열 이웃), 혜택, 공물, 이 길의 적(관계가 −20 아래로 떨어질 이웃의 이름과 힘), 제5·6장 제목, 결말 칭호가 적힌다.
  - 그 밖의 선택지: [홀로 서겠소](독립), [더 지켜보겠소](나중에 총관 메뉴에서 다시 연다).
  - 자료는 `Story.routeCards() → [{ camp, fid, perkText, tribute, foes: [ids], ch5, ch6, title }]`이다.
  - 고르면 `Story.chooseRoute(camp | 'free')`를 부른다. 계열을 고르면 그 세력이 포섭 제안(`offer` 사건, `data.special = true`)을 보내고, 받아들이면 관계가 40 아래여도 산하가 된다(선납 은자 100). 독립이면 바로 정해진다.
- 갈래가 정해지는 때: 주군이 생기면 그 계열(상단은 `free`), 독립을 고르면 `free`다. 제4장 전에 이미 산하였다면 '잠정 갈래'로 보이고, 제4장에서는 확정만 묻는다.
- 정해지면 `S.jh.route = key`가 되고 `Bus.emit('routeChosen', key)`가 나간다(ui.js는 건설 띠를 다시 그린다).

### 8.2 갈래 정의

```js
ROUTES[key] = { name, seal, foes: [camp…], title /* 결말 칭호 */, ch5: CH모양, ch6: CH모양, ending: [대사…], heukpung: '흑풍채의 끝 한 줄' }
```

`ch5`와 `ch6`는 지금 `CH`의 장과 꼭 같은 모양이다(`{ title, seal, steps:[{ id, … }], skip, reward, rewardWhy, end }`). 장을 읽는 곳은 모두 `chDef(i)` 하나를 거친다(i ≥ 4이면 갈래의 ch5/ch6, 갈래가 없으면 독립). 단계 id는 갈래마다 다르게 짓는다(`st.acks`가 id로 기억한다).

모든 갈래의 제5장에는 **진(인구 70)**, 제6장에는 **현성(인구 120)** 이 들어가고, 그 위에 갈래 목표가 얹힌다:

| 갈래 | 제5장 | 제6장 (절정) | 숙적 | 결말 칭호 | 흑풍채의 끝 |
| --- | --- | --- | --- | --- | --- |
| jeong 정파 | 무림맹의 깃발: 진, 의협당, 정파 의뢰 3 | 정마대전: 현성, 짜인 전쟁(정파 편) 승리, 마교 대습격 격퇴 | ma, sa, heuk | 협의의 보루 | 교화되어 투항 |
| ma 마교 | 붉은 달 아래: 진, 혈제단, 마교 의뢰 3 | 천마강림: 현성, 정파·관 연합 토벌 격퇴(짜인 습격), 짜인 전쟁 승리 | jeong, gwan, sega | 붉은 달의 성 | 피의 제물 |
| sega 세가 | 혼맹: 진, 종가, 혼담 받아들이기, 객경 2 | 가문의 이름: 현성, 무림대회 우승(이야기가 8일마다 연다), 마교·흑도의 세가 습격 격퇴 | ma, heuk | 천하명가 | 가문 무사들이 소탕 |
| heuk 흑도 | 밤의 장부: 진, 흑시, 밀수 의뢰 3 | 하룻밤의 왕: 현성, 관의 토벌 격퇴(짜인 습격), 흑풍채 흡수 | gwan, jeong | 밤의 왕 | 흡수해 수하로 |
| sa 사파 | 강 나루의 주인: 진, 도박장, 사파 의뢰 3 | 사파 회맹: 현성, 정파 토벌대 격퇴(짜인 습격), 짜인 전쟁 승리 | jeong, gwan | 사파의 맹주 | 회맹에 머리를 숙인다 |
| saeoe 새외 | 변경의 시장: 진, 호시, 새외 의뢰 3 | 관문을 열다: 현성, 관의 토벌 격퇴(짜인 습격), 새외 세력 둘과 교역 협정 | gwan, jeong | 새외의 관문 | 새외 무인들이 쫓아낸다 |
| gwan 관 | 현령의 인장: 진, 관아, 현상금 2, 민심 60 | 토벌령: 현성, 짜인 토벌전(관 편) 승리, 흑풍채 멸문 | heuk, sa, ma | 황명의 현성 | 토벌령으로 멸문 |
| free 독립 | 누구의 깃발도 아니다: 진, 명성 200, 연무대, 이웃(noLord 빼고) 관계 모두 −30 이상 | 천하제일촌: 현성, 이 장에서 얻은 명성 250(장이 열릴 때의 명성 `cg.f0`부터 센다. 옛 저장은 모든 명성), 두 계열의 최후통첩 격퇴(짜인 습격 둘) | (가장 센 이웃 둘) | 천하제일촌 | 연무대 비무에서 굴복 |

- **짜인 절정**: 제6장이 시작되면 이야기가 `JH.startWar(aIds, bIds, name, { scripted: true, front: 고을 곁 })`로 전쟁을 연다. 갈래 계열 이웃(없으면 가장 가까운 같은 계열)과 숙적 계열 이웃(없으면 가장 가까운)이 맞선다. 그리고 며칠 뒤 `Events.raidWarning(foeId, 1.3, { goal, delay, exitIdx: exitFor(foeId)[0], size, emul })`로 대습격을 보낸다. 길목은 총관의 안내 표시가 짚는 그곳이다. 지더라도 갈래가 실패하지는 않는다. 열흘 뒤 총관이 말하고 다시 연다. 다시 올 때마다 무리는 0.85배씩 줄고(12명 아래로는 줄이지 않는다, `cx.rl` 진 횟수), 한 사람의 체력·공격은 첫 판의 날짜(`cx.rd0`)에 맞춘다(`emul = (1 + 첫날×0.018) / (1 + 오늘×0.018)`). 이기면 둘 다 처음으로 돌린다.
- **흑풍채의 끝**: 제6장 목표 하나 또는 사건이다. 관은 `JH.dissolve('heukpung', { story: true })`, 흑도는 흡수(`JH.dissolve('heukpung', { story: true, quiet: true })`로 소식 없이 거두고 매일 은자 3), 나머지는 사건 한 장면.
- **승리**: 마지막 장의 목표를 다 이루면 `finishChapter`가 `S.victory = true`, `S.victoryTitle = ROUTES[k].title`, `S.jh.victory = k`를 정하고 `Events.victory({ title, text, stamp })`를 부른다. 숙적 계열 이웃의 힘이 −50%가 되고, 천하도의 내 고을에 갈래 문장이 찍힌다.
- sim.js의 '현성·명성 400 승리'는 `hook(Story, 'ownsVictory') !== true`일 때만 쓴다(이야기 모듈이 있으면 이야기가 승리를 맡는다).

### 8.3 갈래 바꾸기

- 제5장 이후에 주군을 바꾸면 갈래도 바뀐다. 옛 계열에 번짐 Δ −40, 옛 주군의 위협은 60이 되고, 그 장의 목표는 새 갈래 것으로 처음부터 시작한다. 총관이 한마디 한다. 바꾸기는 한 번까지(`S.jh.routeSwitches`)이고, 두 번째부터는 독립이 된다.
- 받아들이기 전에 알린다: 포섭(`offer`)과 보호비(`protection`) 두루마리의 글과 선택지, 세력 창의 [산하에 든다] 말풍선에 `Story.switchNote(id)`('갈래가 ○○의 길로 바뀌고, 이 장의 할 일도 처음부터 다시 한다…')를 붙인다.
- 주군이 멸문하면(이야기가 일부러 없앤 것이 아닐 때는 일어나지 않는다, §4.4) 갈래는 거리 400 안에서 같은 계열 가운데 가장 센 세력에게 넘어간다. 그런 세력이 없으면 독립이 된다.
- 옛 저장: 제4장 이후인데 갈래가 없으면 주군 계열로, 주군이 없으면 독립으로 정한다(`Story.onLoad`).

### 8.4 갈래 건물

`BDEF`에 여덟 개를 더한다. 모두 `rank: 2`(읍)이고 `route: '<갈래 key>'`다. 하나씩만 지을 수 있다(`unique`). `BUILD_ORDER`에도 넣는다. `canPlace`는 `def.route && (!S.jh || S.jh.route !== def.route)`이면 '갈래가 다르다'는 까닭으로 막는다. 건설 띠는 갈래가 맞지 않는 건물을 아예 감춘다.

| 키 | 이름 · 한자 | 크기 | cat | 일손 | 효과 (`JH.perk`에 접힌다. 일꾼이 하나 이상이어야 한다) |
| --- | --- | --- | --- | --- | --- |
| `hall_jeong` | 의협당 義 | 3×3 | martial | 2 (fighter) | train ×1.25, fame +0.5 |
| `altar_ma` | 혈제단 祭 | 2×2 | martial | 1 | atk ×1.15, dailySilver +0.2, happy −3 |
| `ancestral` | 종가 宗 | 3×3 | life | 2 | heroEvery 10, fame +0.4 |
| `blackmarket` | 흑시 暗 | 3×2 | trade | 2 | 은자 수입(시장의 1.2배, economyStep), gwanRel −0.5 |
| `gambling` | 도박장 賭 | 3×2 | trade | 2 | 은자 수입(시장의 1.5배, economyStep), happy −1 |
| `horsemarket` | 호시 互 | 3×3 | trade | 2 | 교역 수입(시장처럼, economyStep), hp ×1.1 |
| `yamen` | 관아 衙 | 3×3 | life | 2 | tax ×1.1, happy +3, petitionDays +1 |
| `stage` | 연무대 臺 | 3×3 | martial | 1 | fame +0.6, tournament +1 (무림대회 가중치) |

- cat 값은 지금 BUILD_CATS의 id에서 고른다(실제 id를 확인할 것).
- 일손이 있는 건물마다 다음을 함께 채운다: `JOB_PRIORITY`(sim.js), `JOB_NAME`·`WORK_TEXT`(ui.js), `TOOL_OF`(units.js).
- shrine의 `fame` 0.4(지금은 쓰이지 않음)는 그대로 둔다.
- 그림은 sprites.js가 그린다. 그림이 아직 없으면 초가로 그려진다.

## 9. 사건 (events.js)

- **EV마다 `tier`**: `'light' | 'hostile' | 'heavy' | 'gloomy'`. 새 사건에는 꼭 단다. 지금 있는 사건에도 단다(Story의 id 목록과 같게).
- `init`은 같은 data로 두 번 불러도 같아야 한다(`if (d.k) return`). `data._init`은 저장되지 않으므로, 불러온 뒤 다시 init이 불린다.
- 대상 세력은 `JH.pickNear(camp, filter)`로 고른다. `cond`도 이것으로 대상이 있는지 본다.
- `chooseGoal(k)`는 `FACTIONS[k].goals`를 읽는다. 'occupy'는 마을에 쓸 수 있는 무관이 있고(봉기할 무사를 기를 수 있어야 한다) 인구 문턱이 넘을 때만 쓴다. 문턱은 마교 20, 나머지 28이다(관도 28. 관부의 goals 는 `['punish', 'occupy']`).
- 점령(sim.js): 점령군은 날마다 은자(120냥이 넘는 몫에서 25%, 적어도 8)와 식량 15%를 빼앗는다. 몸값은 150 + 날×5 + 인구×3이고 상한은 100 + 인구×8이다. 우두머리는 수비대에 남지 않는다. 스무 날을 버티면 점령군이 물러간다(`Bus 'liberated' 'withdraw'`). 점령이 끝나면(몸값·봉기·물러감) 보름 동안 그 세력의 위협이 쌓이지 않는다(`S.jh.cd['occ:' + k]`).
- 두루마리에는 닫기 단추가 없으므로, 사건마다 은자·식량이 없고 무사가 모두 떠나 있어도 고를 수 있는 선택지를 하나는 둔다(`ok` 없이). UI는 그래도 모두 잠기면 '물러선다'를 덧붙인다.
- 마교의 제물 요구(`ma_tribute`)에서 바칠 것이 없어 빈 수레로 돌려보내면 위협만 쌓이고, 그날 밤의 습격(35%)은 바칠 수 있었는데 거절했을 때만 굴린다.
- 지금 사건 가운데 특정 세력에 묶인 것은 계열 일반으로 넓힌다. `cheongun_offer`/`hyeolwol_offer`는 `offer`(이웃 가운데 산하를 들일 수 있는 세력 하나)가 되고, `gang_protection`은 이웃 흑도·사파가 된다. 옛 id는 지우지 말고 `cond: () => false`로 남긴다(저장된 큐 호환).
- **새 사건은 서른 이상**이다. 계열마다 셋 이상, 그리고 계열마다 `S.scheduled`로 이어지는 2~3단 사건 하나씩. 예:
  - 정파: 무림맹 소집, 협객의 방문, 정파의 감찰(마교와 가까우면 문책), 비무 초청.
  - 마교: 제물 요구, 마공 비급의 유혹, 마교 첩자 색출, 마교도의 은신 요청.
  - 세가: 혼담(받아들이면 그 세가와 관계 +20, 동맹 조건에서 명성 조건이 빠지고, 가문 무인이 객경으로 온다 — 세가 갈래 제5장 목표), 후계 다툼(편 들기 → 열흘 뒤 결과), 비급 거래.
  - 흑도: 밀수 제안, 장물 거래, 수적 출몰, 살수 의뢰.
  - 사파: 도박장 개설 제안, 독 거래, 사파 회맹 초대.
  - 새외: 새외 상인(말·인삼), 새외 무인 방문, 국경 침입 소문, 포로 송환.
  - 관: 토벌령(관 편에 서기), 수배자 은닉 청, 관직 제의, 염세 단속.
  - 전쟁 번짐: 전쟁 난민, 군량 징발, 패잔병, 전장 줍기.
  - 천하 소식: 무림대회 개최, 천하의 기운(전쟁 결과에 따른 교역 변화).
- **JH가 바로 넣는 사건 id**(events.js가 반드시 만든다): `jh_war_sides` `{ war }`(양쪽 편들기·중립. 편을 들면 `JH.act('support', …)`의 작은 몫), `jh_survivors` `{ f }`, `jh_surge` `{ f }`, `jh_pact_call` `{ war, f }`. 이야기가 넣는 것: `crossroads`(§8.1), `offer` `{ k, special }`.
- 강호에서 오는 두루마리(위의 것과 계열 사건)에는 세력 문장과 [천하도에서 보기] 선택지를 둘 수 있다(`WorldMap.open('view', { focus: id })`).
- 가중치: 갈래 계열 사건 ×2, 숙적 계열의 적대 사건 ×1.5, 고을 `trait.ev` 배수. 이웃이 아닌 세력의 사건은 객잔·표국이 있거나 그 세력이 전쟁 중일 때만, 가중치 ×0.3.
- 본문·표의 한자는 모두 풀이가 있어야 한다. 새 한자는 `HANJA_GLOSS`에 더한다(data.js 몫이므로, events.js는 본문 안에서 `<span data-tip-title data-tip>`로 직접 풀이를 달아도 된다).
- `_victory`는 `Events.victory(data)`의 `data.title/text/stamp`로 만든다(없으면 지금 글).

## 10. 천하도 (js/worldmap.js, css/worldmap.css)

- API: `WorldMap.open(mode, opts)`, `WorldMap.close()`, `WorldMap.isOpen()`, `WorldMap.mode()`.
  - `'pick'`: `{ seed, world, onPick(siteKey), onCancel() }`.
  - `'view'`: `{ focus?: factionId | warId }`.
- 겹: `#worldmap`. 보기 모드는 z-index 29다(시트 30, 사건 두루마리 35, 알림 34, 말풍선 60이 그 위에 뜬다. 총관 카드는 시간을 멈출 때(z 32)만 위에 뜨고, 곁말은 천하도 아래에 남는다. 보기 모드가 열려 있는 동안 다음 두루마리는 펼치지 않고 기다린다). 고르기 모드는 z-index 52로 제목 화면(50) 위에 뜬다. 그래서 `#tooltip`은 60으로 올린다(style.css).
- 보기 모드가 열려 있으면 시간을 멈춘다(main.js 루프가 `WorldMap.isOpen()`을 본다). 열고 닫을 때 `Bus.emit('sheetOpen'|'sheetClose', 'worldmap')`을 보낸다. 그러면 이야기의 `flag('sheet_worldmap')`이 그대로 선다.
- 자기 `requestAnimationFrame` 루프와 키 처리(Esc 닫기)를 갖는다. 열려 있는 동안 main.js는 지도 이동 키를 마을에 보내지 않는다. Esc는 시트를 먼저 닫고, 그다음 천하도를 닫는다.
- **그림**(캔버스 하나, 한지 바탕):
  - 지역 보로노이 경계와 지역 이름. 이름은 DOM 글자로 얹고 `data-tip-title`을 단다. 캔버스 글자에는 말풍선이 안 뜬다.
  - 두 강, 산맥 무늬.
  - **영역은 계열 색 여덟으로** 칠한다(반투명). 세력 경계선은 가늘게, 본산은 문장 원(세력 색)으로.
  - 전쟁은 교차한 칼에 맥박을 주고, 맞선 본산들 사이에 점선을 긋는다.
  - 내 고을은 금빛 별과 이웃 반경 원이다. 이긴 갈래는 문장을 찍는다.
  - 의뢰 표시.
  - 보기 전환: [계열 · 나와의 관계 · 위협].
  - 다 보이는 배율에서는 이웃 문장과 계열 덩어리만 그리고, 나머지 문장은 확대하면 보인다.
  - 끌어서 옮기고 휠·두 손가락으로 확대한다. 누르는 자리는 44px 이상이다.
- **판**(데스크톱은 오른쪽, 폰은 아래 접이식):
  - **세력 양상**: 계열별 힘 띠 그래프. 계열마다 세력 수와 전쟁 표시를 붙이고, `S.jh.hist`로 ▲▼ 흐름을 보인다.
  - 고른 세력의 카드: 계열, 힘, 나와의 관계(첩자가 없으면 위협은 낱말), 이웃 여부, 전쟁(전황 막대, 영주의 몫을 따로 칠한다), [세력 창에서 보기] → `UI.openSheet('factions')` 다음 그 세력으로 스크롤한다(`UI.factionFocus = id`).
  - 최근 소식 열 개.
- **고르기 모드**:
  - 고을 표시는 `[data-site=KEY]`, 누르면 카드가 뜬다. 카드에는 이름, 지역, 땅 생김 막대 다섯, 성질 한 줄, 이웃 문장들, 열린 갈래 칩, 별, '처음이라면' 표시가 있다.
  - 단추: [이곳에 부임한다] `#wm-go`, [아무 곳이나] `#wm-random`, [돌아가기] `#wm-back`.
  - 아래쪽에 밀어서 넘기는 고을 카드 띠(◀ ▶)를 둔다.
  - 처음 열 때는 '처음이라면' 고을이 골라져 있다.
- 폰(390×844)에서도 써지게 한다. 지도가 위, 판이 아래다.

## 11. 화면·흐름의 나머지

- **열기**: 데스크톱은 `#menubar`의 [천하도] `#btn-worldmap`(한자 天下, 640px 이하에서는 감춘다). 폰에서는 [세력] 창 맨 위의 [천하도 펼치기] 단추로 연다.
- **새 게임**: [새로 시작] 또는 이름 칸 Enter → `seed = 무작위` → `WorldMap.open('pick', { seed, world: JH.makeWorld(seed), onPick: k => enterGame(true, k, seed), onCancel: () => {} })`.
  - 서명: `enterGame(isNew, siteKey, seed)`, `newGame(name, siteKey = 'henan_field', seed = 무작위)`.
  - 불러오기에 실패했을 때의 대신 시작도 기본 고을로 한다. newGame은 `S.jh`를 만든 뒤 `Bus.emit('siteChosen', siteKey)`를 보낸다.
- **newGame 순서**: `S = {…}` → `genWorld(seed, SITES[site].biome)` → `JH.newWorld(site, seed)`(S.jh, near, S.factions 스물여섯, 길목 toward) → 기본 마을 → Admin/Petitions/Story init → setupNewGame → refreshAssign.
- **deserialize 순서**: `genWorld(st.seed, (st.jh && SITES[st.jh.site] || {}).biome)` → 타일 불러오기 → `S = st` → `hook(JH, 'onLoad')`(옛 저장 migrate, 길목 toward 다시 붙이기) → 습격 길목 복원 → refreshAssign → refreshLive → Admin/Petitions/Story onLoad.
- **dailyTick 순서**: … 관계 되돌림 → growthCheck → `hook(JH, 'daily')` → Admin/Petitions/Story daily → Bus 'day' → 자동 저장.
- **마을 지도** `genWorld(seed, biome)`:
  - biome은 분류 문턱만 옮긴다. 0.5에서 정확히 0이 되게: 바위 `m > 0.66 − (hills − 0.5) × 0.16`, 숲 `w > 0.55 − (forest − 0.5) × 0.14`, 흙 `d > 0.68 − (fertile − 0.5) × 0.1`.
  - 광장에서 반경 10 안에서는 biome을 쓰지 않는다(지금 문턱 그대로).
  - 강폭은 water로 넓어지거나 좁아지되, 한 줄에 두 번 뽑는 수는 그대로다.
  - 호수 같은 덧붙임은 따로 `mulberry32(seed ^ 0x5bd1)`을 쓴다. 광장 12칸 안과 길 위에는 두지 않는다. 주 난수 `r()`의 뽑는 횟수를 바꾸지 않는다.
  - 그래서 길·길목·tvar·광장은 땅 생김과 상관없이 같다.
  - 북쪽 길목과 산길은 늘 남는다.
- **길목 이름**: `World.exits[i].toward`(그 방향 이웃 id들)를 render.js가 지도 가장자리 길목 곁에 작은 문장으로 그린다. tips.js는 길목에 커서를 올리면 '북쪽 산길 — 흑풍채, 칠살문 쪽'을 띄운다.
- **세력 창**(ui.js `factionsHTML`):
  - 맨 위에 탭 [세력 · 의뢰 · 소식]을 두고, 갈래가 정해졌으면 갈래 표를 둔다. 폰에서는 [천하도 펼치기] 단추도 둔다.
  - 세력 탭: **이웃** 카드를 먼저 보인다. 카드는 접힌 꼴(문장, 이름, 계열, 관계 막대, 위협 낱말, 주된 행동 하나)이고, 누르면 펼쳐져 단추가 나온다: 예물, 사신, 교역, 산하/동맹, 현상금, 첩자, 전쟁 지원, 중재. 단추마다 `JH.canAct`의 까닭을 말풍선으로 단다.
  - 먼 세력은 계열별로 접힌 목록이다(관계, 힘, 전쟁만 보이고, 예물·사신·교역만 할 수 있다. 교역은 상단·새외·세가에만 단다).
  - 의뢰 탭: 열린 의뢰 카드에서 보낼 사람(1~4)을 고른다. 성공 확률 %와 남는 무력이 바로 보이고, [보낸다]를 누른다. 다녀오는 중인 의뢰는 남은 날과 [불러들이기]가 있고, 지난 결과가 이어진다.
  - 소식 탭: `S.jh.news`.
  - [세력] 단추에는 `JH.badge()` 배지를 단다.
- **도움말·README**: 계열, 천하도, 의뢰, 외교, 갈림길을 짧게 적는다.

## 12. 구현 나눔

1단계(핵심, 차례로):
- **data**: data.js — CAMPS, CAMP_ORDER, CAMP_ATT, RIVALRIES, FACTIONS(26), FACTION_ORDER, REGIONS, SITES, 갈래 건물 BDEF·BUILD_ORDER, HANJA_GLOSS(계열·세력 문장·지역·고을·갈래 건물).
- **engine**:
  - jianghu.js(새): JH 전부.
  - sim.js: newGame/deserialize/dailyTick/hourlyTick 순서; 혜택은 JH.perk; threatTick은 이웃만; raidSize·pickExit; 원군은 JH.aidFor; rivals → relSpread; 파견 중인 사람 빼기; canPlace 갈래; JOB_PRIORITY; 승리 판정; 땅 생김 효과.
  - world.js: genWorld biome.
  - units.js: away 행동, unitsReturn, atk/hp 혜택.
  - main.js: 새 게임 흐름, 천하도가 열려 있으면 멈춤·키.
  - index.html: script/link 태그, `#worldmap` 겹, `#btn-worldmap`.
  - worldmap.js 자리 채움(고르기 모드면 곧바로 `onPick('henan_field')`).
  - architecture.md 갱신.

2단계(나란히, 파일이 겹치지 않게):
- **worldmap**: worldmap.js, css/worldmap.css, e2e 하네스의 고르기 단계.
- **events**: events.js. 옛 세력 사건 셋(`gang_protection` `cheongun_offer` `hyeolwol_offer`)은 `cond: () => false`로 두고 `offer`가 `JH.pickNear`로 고른다(§9). 그래야 이웃이 아닌 세력이 주군이 되지 않는다.
- **story**: story.js, css/story.css. `HANJA_GLOSS`에 더할 때 data.js의 풀이를 덮어쓰지 않는다(`上`·`樓`에는 세력 문장의 뜻이 함께 적혀 있다). `Story.allowJianghu()`는 §0.1(제4장, index 3)을 따른다.
- **ui**: ui.js, css/style.css, tips.js.
- **art**: sprites.js, render.js(갈래 건물 여덟, bald/fur/staff, leader.hat, 길목 문장). 넷째 철이라도 `isWinter()`가 거짓이면(겨울이 없는 고을) 눈 대신 가을로 그린다.
- **admin**: admin.js, petitions.js(ADM_EXIT_PREF → JH.exitFor, 병방이 이웃 위협을 본다, expectedIncome의 혜택, petFree, 상소 기한 petitionDays, 관 갈래의 상소). 식량 내다보기는 sim.js의 `farmMul(si)`·`fishMul(si)`·`foodUseMul(si)`로 셈한다(§3).

**Bus 새 이벤트**: `jhNews (item)`, `warStart (war)`, `warEnd (war, winnerSide)`, `questNew (q)`, `questDone (q, ok)`, `pactChanged (id, on)`, `routeChosen (route)`, `siteChosen (siteKey)`, `vassal (id|null)`(산하가 바뀔 때 sim.js가 보낸다).

**훅**: `Story.allowJianghu()`, `Story.ownsVictory()`, `Story.routeCards()`, `Story.chooseRoute(k)`, `JH.onLoad`, `JH.daily`, `JH.hourly`, `JH.happinessFactors`.
