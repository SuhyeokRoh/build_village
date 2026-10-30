# 강호촌 영주기 — 구조와 모듈 규약

이 문서는 여러 사람이 동시에 다른 모듈을 고쳐도 서로 부딪히지 않도록 정한 약속이다.
코드는 빌드 단계 없이 `<script>` 태그로 순서대로 읽히는 전역 스크립트다(ES 모듈 아님). 외부 라이브러리·이미지 없음.

## 1. 파일과 담당

| 파일 | 내용 | 담당 |
| --- | --- | --- |
| `js/util.js` | 상수, 난수, 노이즈, `Store`, 조사 `pp()`/`josa()`, `escapeHtml`, **`Bus`**, **`hook()`** | 공통(고치지 말 것) |
| `js/data.js` | 시간·등급·경지·`BDEF`(건물)·`FACTIONS`·이름·**`HANJA_GLOSS`/`glossOf()`** | 공통(값 추가는 가능) |
| `js/world.js` | 지형 생성, 점유(`World.occ`), `walkable`, A* `findPath`, `doorOf` | 공통 |
| `js/sprites.js` | 건물·나무·사람 그림, `buildingSprite`, `treeSprite`, `drawFigure`, `iconCanvas` | **등각 그림** |
| `js/render.js` | 투영, 지형 캐시, 깊이 정렬, 조명, 효과, 오버레이, 미니맵 | **등각 렌더러** |
| `js/main.js` | 입력, 카메라, 게임 루프, 시작 | **등각 렌더러** (훅 호출은 지울 것) |
| `js/units.js` | 사람의 하루, 이동, 전투 | 공통 |
| `js/sim.js` | 경제, 건설, 배치, 민심, 습격, 점령, 저장 | 공통 |
| `js/events.js` | 무작위 사건, 습격 경보 | 공통 |
| `js/jianghu.js` | **`JH`**: 천하의 세력·힘·이웃, 전쟁, 의뢰와 파견, 외교, 산하·동맹·고을·갈래 건물의 혜택 (`S.jh`). 설계는 `docs/jianghu.md` | 공통(엔진) |
| `js/ui.js` | 상단 띠, 건설 메뉴, 선택 패널, 세력·현황 창, 사건 두루마리 | 공통 |
| `js/tips.js` | `data-tip` 풀이 말풍선, 지도 위 풀이 | 공통 |
| `js/story.js` + `css/story.css` | 이야기·튜토리얼·총관 | **이야기** |
| `js/petitions.js` + `css/petitions.css` | 상소 | **상소** |
| `js/admin.js` + `css/admin.css` | 육방과 예산, 자동 건설 | **육방** |
| `js/worldmap.js` + `css/worldmap.css` | 천하도(天下圖): 새 게임의 고을 고르기, 천하의 판도 보기 | **천하도** |

**담당이 아닌 파일은 고치지 않는다.** 다른 모듈이 필요한 것은 아래 훅·`Bus`·공개 함수로만 주고받는다.
꼭 공통 파일을 고쳐야 한다면 최소한으로 고치고 보고서에 정확히 적는다.

스크립트 순서(`index.html`): util → data → world → sprites → render → units → sim → events → jianghu → admin → petitions → story → tips → ui → worldmap → main.
스타일 순서: style → admin → petitions → story → worldmap.
모듈 객체(`Story`, `Admin`, `Petitions`, `JH`, `WorldMap`)는 `const`로 전역에 둔다. 다른 파일은 **실행 시점에만** 이들을 부른다.

## 2. 좌표와 투영

- 게임 논리는 **타일 좌표**만 쓴다. 지도는 `MW × MH = 64 × 48` 타일. 사람 위치 `u.x, u.y`는 실수 타일 좌표이고 타일 중심은 `정수 + 0.5`.
- 건물은 발판 좌상단 `(b.x, b.y)`, 크기 `(b.w, b.h)` 타일.
- 타일 ↔ 월드 픽셀 ↔ 화면 픽셀 변환은 `render.js`의 다음 함수만 한다. 다른 파일은 이것만 부른다.

| 함수 | 뜻 |
| --- | --- |
| `worldOf(tx, ty)` → `{x, y}` | 타일 좌표의 월드 픽셀(카메라 적용 전). 땅 위의 점. |
| `tileOfWorld(wx, wy)` → `{x, y}` | 역변환(땅 높이 0 기준) |
| `screenToTile(sx, sy)` → `{x, y}` | 화면(CSS 픽셀) → 실수 타일 좌표 |
| `tileToScreen(tx, ty)` → `{x, y}` | 실수 타일 좌표 → 화면 |
| `centerOnTile(tx, ty)` | 카메라를 그 타일에 맞춘다 |
| `pickAt(sx, sy)` → `{u}` / `{b}` / `null` | 화면 좌표의 사람(우선)이나 건물 |
| `clampCamera()` | 카메라를 지도 안으로 |

- `Cam.x, Cam.y`는 월드 픽셀(투영 뒤)이고 `Cam.zoom`은 배율. 다른 모듈은 `Cam`을 직접 바꾸지 말고 `UI.focusOn(tx, ty)`(부드럽게) 또는 `centerOnTile`(즉시)을 쓴다.
- `UI.camTarget = { tx, ty }` (타일 좌표). `main.js` 루프가 `worldOf`로 투영해 따라간다.
- **효과**: `addFx({ kind, tx, ty, lift, ... })`, `floatText(tx, ty, text, color, big, lift)` — 타일 좌표 + 땅에서 띄울 높이 `lift`(월드 픽셀).
  `kind`: `'slash'`(dir, big, color), `'ring'`(r, color), `'spark'`, `'text'`.
- **화살**: `G.projectiles.push({ x0, y0, z0, x1, y1, z1, t, dur, target, dmg, src })` — 타일 좌표와 높이(월드 픽셀).
- **표지**: `G.markers = [{ x, y, text }]` — 이야기 모듈이 가리키는 곳(타일 좌표, 보통 건물 가운데). 렌더러가 위아래로 까딱이는 화살표와 이름표를 그린다. 조명 위에 그린다.

### 2.1 등각(2.5D) 투영 규격

- 마름모 타일 `TW = 64`, `TH = 32` (월드 픽셀). `worldOf(tx, ty) = { x: (tx - ty) * 32, y: (tx + ty) * 16 }` (+ 렌더러가 정한 상수 원점 이동 가능).
- 축: 타일 `x + 1`은 화면에서 오른쪽 아래, `y + 1`은 왼쪽 아래. 카메라는 북서쪽 하늘에서 내려다본다. 보이는 건물 벽은 **왼쪽 앞면(남서, y+h 쪽)** 과 **오른쪽 앞면(남동, x+w 쪽)**.
- 깊이 정렬: 뒤에서 앞으로 `(x + y)` 가 커지는 순서. 건물은 발판 **가운데** `b.x + b.y + (b.w + b.h) / 2` 기준(앞 모서리 기준이면 큰 건물 바로 앞의 작은 건물이 뒤로 숨는다. 가로세로 차이가 1칸 이하인 발판에서는 가운데 기준이 늘 맞다), 사람은 `u.x + u.y`(바로 곁 건물과의 앞뒤를 따로 따져 고친다), 나무는 `tx + ty + 1`. 같은 값이면 땅 → 건물 → 나무 → 사람. 논밭은 모든 것보다 먼저 그린다.
- **건물 그림 규약**: `buildingSprite(type, w, h, season, state, extra)` → `{ c, ox, oy, w, h }`.
  캔버스 `c`를 월드 좌표 `(worldOf(b.x, b.y).x + ox, worldOf(b.x, b.y).y + oy)`에 크기 `(w, h)`로 그린다.
  즉 `(ox, oy)`는 발판의 **위쪽 꼭짓점**(타일 `(b.x, b.y)`의 북쪽 꼭짓점)에서 캔버스 왼쪽 위까지의 거리.
  `state`: `'done' | 'build' | 'ruin'`. `'build'`일 때 `extra`는 진척도 문자열(`'0.25'` 등), 선형 건물(목책·석벽)은 `extra`가 이웃 마스크 문자열.
  이웃 마스크(타일 기준): 북 `y-1` = 1, 동 `x+1` = 2, 남 `y+1` = 4, 서 `x-1` = 8.
  내부 해상도는 `SS = 2`배로 그려 확대해도 또렷하게.
- **나무**: `treeSprite(v, season)` → `{ c, w, h, ax, ay }`. 타일 중심 `worldOf(tx + 0.5, ty + 0.5)`에서 `(-ax, -ay)` 만큼 옮겨 그린다(`ax, ay`는 캔버스 안의 밑동 위치).
- **사람**: `drawFigure(c, x, y, look, pose)` — `(x, y)`는 발 위치(월드 픽셀) = `worldOf(u.x, u.y)` + 작은 개별 흔들림.
- 망루 위 궁수, 영주관 깃발 등은 건물 발판 위쪽 꼭짓점 기준 오프셋으로 그린다. `SPRITE_META[type]`이 `height`, `eave`, `smoke`, `flag`, `archer` 같은 값을 월드 픽셀로 알려 준다. 망루 발판은 타일 가운데에서 56px 위, 망루 화살은 `z0 = 70`에서 쏜다.
- 성문은 목책·석벽처럼 `extra`로 이웃 마스크를 받아 벽이 놓인 방향에 맞춰 돈다.
- 불빛: `BDEF[type].light = [[u, v, r, color, lift?], ...]`(발판 기준 타일 좌표), `lightLift`는 땅에서 띄울 기본 높이.
- 망루 사거리 원은 타일 공간의 원을 그대로 투영한 타원(반지름 `r·32·√2` × `r·16·√2`).
- 지형은 마름모로 미리 그린 큰 캐시 캔버스. 바위산은 높이감 있는 바위 덩어리/벼랑, 물은 낮게, 길은 이웃과 이어진 마름모 길, 물 위 길은 다리.
- 입력 역변환: `screenToTile`이 마름모 기준으로 정확해야 한다(건설 미리보기·선택이 맞아야 함).

## 3. 상태와 저장

- 전역 `S`가 저장되는 게임 상태 전부다. `serialize()`가 `JSON.stringify(S)`로 저장하며 **이름이 `_`로 시작하는 키**와 `path, chat, wt, bmap, hitT, flash, exit`는 버린다.
  - 그래서 습격 길목은 객체 대신 번호로 남긴다: `S.raid.exitIdx`와 `S.scheduled`의 습격 항목 `exitIdx`는 `World.exits`의 번호이고, `deserialize()`가 이것으로 `exit`을 되살린다. 사람(유닛)의 `exit`은 그냥 버리고 다시 찾는다.
- 모듈 상태는 `S.story`, `S.admin`, `S.petitions`에 **순수 JSON**(숫자·문자열·배열·객체)으로만 둔다. 함수·DOM·Map 금지. 다른 객체는 id로 가리킨다(`S.bmap.get(id)`, `S.villagers.find(v => v.id === id)`).
- 저장되지 않는 일시 상태는 모듈 객체 안이나 `G`(렌더러용), 또는 `_` 접두 키에 둔다.
- 불러온 뒤 `onLoad()`가 불린다. 옛 저장(모듈 상태 없음)도 받아들여야 한다.

### 3.1 천하 상태 `S.jh`

- 모양은 `docs/jianghu.md` §4 그대로다(`site seed seats power dead near wars news hist quests qlog pacts route routeSwitches spies trade grudge cd lastScroll nextWarCheck victory`). 엔진이 쓰는 덧붙임 넷: `seq`(전쟁·의뢰 id 번호), `mark: { [id]: [day, power] }`(열흘 기세 기준점), `vacant: [day…]`(멸문한 이웃의 빈자리가 채워질 날), `heroAcc`(세가 객경이 올 때까지 쌓인 몫).
- **시간 단위**: `v.away.until`·`Quest.back`은 `S.time`(시각). `expires`·`spies`·`trade`·`grudge`·`cd`·`dead`·`day`·`since`는 `dayOf()`(날). 끝날 값은 '그날이 되면 끝'이다(`spies[id] > dayOf()`이면 살아 있다).
- `S.jh`, 의뢰, 사건 data에는 `path chat wt bmap hitT flash exit` 키나 `_` 키를 두지 않는다. 길목은 `exitIdx`(번호)로 둔다. `World.exits[i].toward`(그 방향 이웃 id들)는 저장되지 않고 `JH.attachExits()`가 불러올 때·이웃이 바뀔 때 다시 붙인다.
- `hist`는 닷새마다 하나, 오래된 것이 앞이고 최근 12개다. `news`는 새것이 앞이고 40개, `qlog`는 새것이 앞이고 10개다.
- 의뢰로 떠난 사람: `v.away = { q, until, exitIdx, gone }`. `v.job`·역할은 그대로 두고, 길목에 닿으면 `inside = true, insideB = 0`으로 숨는다. 돌아오는 것은 `JH.hourly()`만 정하고 `unitsReturn(v)`(units.js)가 길목에 다시 놓는다. 파견 중인 사람은 `defensePower`, 일 없는 이 목록, 봉기 인원, 굶주림·불만·품삯으로 떠나는 이 고르기에서 빠진다. `popCount`와 살아 있는 사람 수에는 든다.
- 옛 저장(`S.jh` 없음)은 `JH.onLoad()`가 `JH.migrate()`로 받는다: 고을은 낙수 들녘, 천하는 `S.seed`, 이웃은 옛 여섯(`cheongun cheolhyeol heukpung hyeolwol gwanbu geumryong`), 옛 관계·위협·산하·점령은 그대로, 나머지 스무 세력은 관계 0.

## 4. 훅 — 핵심 코드가 모듈을 부르는 때

`hook(Mod, '이름', ...인자)` 형태로 부른다. 없거나 예외가 나도 게임은 계속된다(예외는 콘솔에 남음 — 남기지 말 것).

| 훅 | 부르는 곳 / 때 |
| --- | --- |
| `Admin.init()`, `Petitions.init()`, `Story.init()` | `newGame` 기본 마을을 만든 직후. `S.<모듈>` 을 만든다 |
| `Story.setupNewGame()` | 위 `init`들 다음. 시작 마을을 꾸민다(쓰러져 가는 마을). 이 뒤에 `refreshAssign()` |
| `X.onLoad()` | `deserialize` 끝 |
| `Story.onEnterGame(isNew)` | 제목 화면을 닫고 게임에 들어올 때(새 게임·이어하기 모두). 첫 인사·튜토리얼 UI를 띄운다 |
| `Story.tick(dtH)` | 매 시뮬레이션 단계 (`dtH` = 게임 시간, 보통 0.02시간 이하) |
| `X.hourly()` | 매 게임 시각 정각 (`hourlyTick`, 일자리 재배치 뒤) |
| `X.daily()` | 매일 묘시(6시) `dailyTick` 끝무렵: 세금·품삯·공물 다음 → `JH` → `Admin` → `Petitions` → `Story` 순 |
| `X.uiTick()` | 약 0.22초마다(UI 갱신) |
| `Admin.taxMul()` → 수 | 하루 세금 배율 |
| `X.happinessFactors()` → `[[이름, 값], ...]` | 민심 목표치 계산에 더해짐(마을 현황 창에도 표시) |
| `Story.isPausing()` → bool | true면 시간이 멈춘다(사건 두루마리처럼) |
| `Story.allowThreat()` → bool | false면 세력의 위협이 쌓이지 않는다(튜토리얼 초반 보호) |
| `Story.allowEvent(id)` → bool | false면 그 무작위 사건이 나오지 않는다 |
| `Story.openAdvisor()` | 메뉴의 [총관] 버튼 |
| `JH.onLoad()` | `deserialize`에서 `S = st` 바로 뒤(건물 사전·점유를 되살린 다음). 옛 저장 migrate, 빠진 키 채우기, 길목 `toward` 다시 붙이기 |
| `JH.daily()` | `dailyTick`에서 관계 되돌림 → growthCheck 다음, `Admin.daily` 앞 (자동 저장에 담긴다) |
| `JH.hourly()` | `hourlyTick`에서 `Admin.hourly` 앞. 의뢰에서 돌아오는 사람, 위협 상한 100 |
| `JH.happinessFactors()` | 민심 요인 목록에 주군·동맹·갈래 건물마다 줄을 더한다 (예: `['정파의 비호(청운검문)', 3]`) |
| `Story.allowJianghu()` → bool | false면 전쟁·의뢰·새 외교·강호 두루마리·소식 알림이 없다(힘의 자연 성장과 예물·산하만). **훅이 없으면** JH가 대신 정한다: 제3장(index 2) 이상, 또는 안내를 건너뛰고 8일째부터. 이야기 모듈이 없으면 true |
| `Story.ownsVictory()` → bool | true면 sim.js의 '현성·명성 400 승리'를 쓰지 않는다(이야기가 승리를 정한다) |
| `Story.routeCards()`, `Story.chooseRoute(k)` | 갈림길 카드와 고르기 (`docs/jianghu.md` §8.1) |

### 4.1 호출 순서

- **newGame(name, siteKey = 'henan_field', seed = 무작위)**: `S = {…}` → `genWorld(seed, SITES[site].biome)` → `JH.newWorld(site, seed)`(S.jh, 이웃, `S.factions` 스물여섯, 길목 toward) → 기본 마을 → Admin/Petitions/Story `init` → `setupNewGame` → `refreshAssign` → `Bus.emit('siteChosen', site)`.
- **deserialize**: `genWorld(st.seed, (st.jh && SITES[st.jh.site] || {}).biome)` → 타일 불러오기 → `S = st` → 건물 사전·점유 → `hook(JH, 'onLoad')` → 습격 길목 복원 → `refreshAssign` → `refreshLive` → Admin/Petitions/Story `onLoad`.
- **dailyTick**: 세금(`JH.perk('tax')`) → 품삯 → 공물(`(4 + 인구×0.25) × CAMPS[계열].tribute`) → 점령 수탈 → … → `threatTick`(이웃만) → 관계 되돌림(주군·동맹 빼고) → growthCheck → `hook(JH, 'daily')` → Admin/Petitions/Story `daily` → Bus `'day'` → 자동 저장.
- **새 게임 흐름**(main.js): [새로 시작]·이름 칸 Enter → `seed` → `WorldMap.open('pick', { seed, world: JH.makeWorld(seed), onPick: k => enterGame(true, k, seed), onCancel })`. 불러오기에 실패하면 기본 고을로 새로 시작한다.

## 5. Bus 이벤트

`Bus.on(이름, fn)`으로 듣고 `Bus.emit(이름, ...)`으로 알린다.

| 이름 | 인자 | 때 |
| --- | --- | --- |
| `placed` | `b` | 영주(또는 육방)가 건물을 놓음(공사 시작) |
| `built` | `b` | 공사 완료 |
| `repairStarted` | `b` | 폐허 다시 짓기 시작 |
| `demolished` | `b` | 철거 |
| `destroyed` | `b` | 습격·화재로 무너짐 |
| `road` | `x, y` | 길 한 칸을 깖 |
| `rankUp` | `rank` | 마을 등급 상승 |
| `arrived` | `n` | 새 식구 도착 |
| `day` | `day` | 하루가 시작됨(묘시) |
| `raidWarning` | `k, goal, size` | 습격 경보가 대기열에 들어감 |
| `raidStart` | `raid` | 적이 쳐들어옴 |
| `raidEnd` | `result, raid` | `'win' / 'lost' / 'liberated' / 'uprising_failed'` |
| `occupied` | `k` | 마을이 점령됨 |
| `liberated` | `how` | `'uprising' / 'ransom' / 'dissolve'`(점령군의 세력이 멸문함) |
| `vassal` | `k \| null` | 주군이 생기거나 끊김 (sim.js `becomeVassal`·`breakVassal`, 주군이 멸문하면 `JH.dissolve`) |
| `eventResolved` | `id, label` | 사건 두루마리에서 선택함 |
| `select` | `obj` | 지도에서 무엇을 고름(`{u}`/`{b}`/null) |
| `tool` | `key \| null` | 건설 도구 고름 |
| `sheetOpen` / `sheetClose` | `kind` | 큰 창 열고 닫음(`'factions','village','help','admin','petitions'`) |
| `camMoved` | – | 영주가 지도를 움직이거나 확대함 |
| `budgetChanged` | `deptId, amount` | 육방 예산 바뀜 (**Admin이 보냄**) |
| `deptBuilt` | `deptId, b` | 부서가 스스로 건물을 놓음 (**Admin**) |
| `petitionNew` | `p` | 상소 들어옴 (**Petitions**) |
| `petitionResolved` | `p, choiceId` | 상소 처리함 (**Petitions**) |
| `storyStep` | `chapter, step` | 튜토리얼 단계가 바뀜 (**Story**) |
| `jhNews` | `item` | 천하 소식 하나 (`{ day, text, kind, f }`, **JH**) |
| `warStart` | `war` | 전쟁이 일어남 (**JH**) |
| `warEnd` | `war, winnerSide` | 전쟁이 끝남. `'a' / 'b' / null`(무승부) (**JH**) |
| `questNew` | `q` | 의뢰가 붙음 (**JH**) |
| `questDone` | `q, ok` | 의뢰에서 돌아옴 (**JH**) |
| `pactChanged` | `id, on` | 동맹을 맺거나 끊김 (**JH**·sim) |
| `routeChosen` | `route` | 갈래가 정해짐 (**Story**) |
| `siteChosen` | `siteKey` | 새 게임의 고을이 정해짐 (`newGame` 끝) |

## 6. 화면 통합

- 큰 창: `UI.registerSheet(kind, { html: () => 문자열, onClick: e => {}, live: true })`. 메뉴 버튼 `#btn-admin` → `'admin'`, `#btn-petitions` → `'petitions'`가 이미 연결돼 있다. `live`가 true면 0.22초마다 `html()`을 다시 부르고 문자열이 달라질 때만 DOM을 바꾼다. 입력 칸(슬라이더)이 있으면 `live: false`로 두고 직접 갱신하거나, 문자열이 자주 안 바뀌게 만든다.
- 클릭은 `#sheet-body`에서 위임되어 `onClick(e)`로 온다. 끝나면 `UI.renderSheet()`가 불린다.
- 메뉴: `#btn-story`(총관), `#btn-admin`(육방), `#btn-petitions`(상소함, 안의 `#petition-badge`에 미처리 수). 
- 알림: `UI.toast(text, 'good'|'bad'|'')`, 기록: `logMsg(text, 'good'|'bad'|'war'|'')`, 사건 두루마리: `Events.notice(title, html, stampHanja)`, `Events.queue(id, data)`.
- 모듈이 자기 DOM을 만들 때는 `#app` 안에 붙이고, 자기 CSS 파일에서만 꾸민다. `z-index`: 지도 위 띠·패널 14~20, 튜토리얼 강조(하이라이트) 25 근처, 천하도 보기 29, 큰 창 30, 사건 두루마리 35, 첫 화면 50, 천하도 고르기 52, 말풍선 `#tooltip` 60.
- 천하도: 겹은 `#worldmap`(index.html에 있다). 메뉴의 `#btn-worldmap`(`.wide-only`, 640px 이하에서 감춘다)은 main.js가 `WorldMap.open('view', {})`에 잇는다. 천하도가 열려 있으면 main.js 루프가 시간을 멈추고 지도 이동·확대 키를 마을에 보내지 않는다. Esc는 시트가 열려 있으면 main.js가 시트를 닫고 `e.preventDefault()`한다. worldmap.js는 `e.defaultPrevented`나 `UI.sheet`가 있으면 Esc를 넘기고, 키를 써 버렸으면 `e.preventDefault()`한다(main.js는 그 키를 무시한다).
- 디자인 언어: 옻칠한 어두운 나무 패널(`--lacquer*`), 금박(`--gold`), 먹과 한지(`--paper`, `--ink`), 주홍 인장(`--cinnabar`). 글꼴 `--font-display`(Song Myung, 제목), `--font-body`(Gowun Batang, 본문), `--font-ui`(IBM Plex Sans KR, 숫자·라벨). 이모지 쓰지 말 것.
- **한자에는 반드시 풀이를 단다**: `data-tip-title="賊 · 도둑 적"` `data-tip="설명"`. 한 글자는 `HANJA_GLOSS`에 있으면 `data-tip-title` 만 줘도 `glossOf`로 풀이된다. 새 한자를 쓰면 `HANJA_GLOSS`에 더한다.
- 사용자 입력(마을 이름)이 HTML에 들어갈 때는 `escapeHtml`. 한국어 조사는 `${이름}${pp(이름, '이/가')}`.
- 폰 너비(390px)에서도 써져야 한다(`@media (max-width: 860px)` 에서 `#topbar`가 2줄(`--top-h` 92px), `max-width: 640px` 에서는 이름·시각 / 銀食木石兵 / 人心武名 3줄(`--top-h` 108px), 건설 띠 140px). 위 띠 아래에 붙는 것은 숫자 대신 `var(--top-h)`로 놓는다.
- `alert/confirm/prompt` 금지(아티팩트에서 동작 안 함). 확인은 화면 안에서.

## 7. 모듈이 쓸 수 있는 핵심 함수 (일부)

- 시간: `dayOf()`, `hourOf()`, `seasonIdx()`, `dateText()`, `isNight()`
- 자원: `S.res.{silver,food,wood,stone,weapons}`, `canAfford(cost)`, `pay(cost)`, `addRes(k, n)`, `costText(cost)`, `storageCap()`
- 사람: `popCount()`, `housingTotal()`, `livingVillagers()`, `newVillager(opts)`, `makeHero()`, `spawnHero(h, at)`, `fighters()`, `civilians()`
- 건물: `BDEF`, `canPlace(type, x, y)` → `{ok, why, poor}`, `tryBuild(type, x, y)` → `{ok, b}`(비용 냄), `placeBuilding(type, x, y, done)`(비용 없음), `repair(b)`, `repairCost(b)`, `demolish(b)`, `getB(id)`, `usable(b)`, `countType(type)`, `setRoad(x, y, free)`, `canPlaceRoad(x, y)`, `doorOf(b)`, `countTilesNear(rect, T.FOREST, r)`, `World.tile/isRoad/bAt/occ`, `walkable(x, y)`, `findPath(...)`
- 민심: `S.happy`, `happinessFactors()`, `happinessTarget()`, `addMod(id, days)`(이미 더 길게 걸린 효과는 줄이지 않는다), `hasMod(id)`, `S.tax`
- 강호: `rel(k)`, `changeRel(k, d)`, `addFame(n)`, `S.factions[k].threat`, `becomeVassal(k)`, `breakVassal(silent)`, `defensePower(excl?)`(파견 중인 사람과 `excl` Set의 id는 뺀다), `threatGain(k)`, `Events.raidWarning(k, mul, { goal, size, delay, exitIdx })`, `scheduleRaid`, `raidSize(k)`(힘을 곱한다), `pickExit(k)`, `S.raid`, `S.occupation`
- 천하(`JH`, `docs/jianghu.md` §4~§7):
  - 순수(S 없이): `makeWorld(seed)` → `{ seed, seats, power }`, `siteInfo(world, siteKey)` → `{ near, localSeats, stars, routes, rel }`(routes는 계열 다섯이고 독립은 늘 열린다)
  - 만들기·불러오기: `newWorld(siteKey, seed)`, `migrate()`, `onLoad()`, `attachExits()`
  - 조회: `allowJianghu()`, `near()`(복사본), `isNear(id)`, `campOf(id)`, `isAlive(id)`, `pickNear(camp|[camps]|null, filter?)` → id | null, `power(id)`, `biome()`, `trait()`(고을 성질: `perk ev quest noWinter aid`)
  - 혜택: `perk(name)`(곱하는 값 기본 1: `train atk hp tax trade bandit fish escort` / 더하는 값 기본 0: `happy fame dailySilver gwanRel petitionDays tournament` / `heroEvery` 기본 0 = 없음), `happinessFactors()`, `relSpread(k, d)`
  - 습격: `exitFor(id)` → 길목 번호 둘(좋은 순서, 흑풍채는 늘 `[2, 0]`), `aidFor(raidFaction)` → `{ id, n } | null`, `siteAid(raidFaction)`(고을 성질의 원군), `raidEstimate(id)`, `threatWord(id)`, `spied(id)`, `intel(id)`(첩자가 있을 때: `{ threat, eta, exitIdx, size, war }`)
  - 전쟁: `startWar(aIds, bIds, name?, { scripted, front })` → War, `addScore(war|id, side, amt, mine = true)`, `endWar(war|id, winner, how)`, `warOf(id)`, `warById(wid)`, `sideOf(war, id)`, `sidePower(war, side)`
  - 소식·멸문: `news(text, kind, ids)`, `dissolve(id, { story })`(흑풍채·관부·주군은 `story`일 때만)
  - 의뢰: `badge()`(열린 의뢰 수), `quest(qid)`, `canSend(v)`, `chance(qid, ids)`, `dispatchInfo(qid, ids)` → `{ p, spare, threat: { id, word, pct, n } }`, `dispatch(qid, ids)`, `recall(qid)` → `{ ok, text, why }`, `questCap()`, `partyCap()`, `makeQuest(fid, kind?)`
  - 외교: `canAct(kind, id, opts)` → `{ ok, why, cost }`, `act(kind, id, opts)` → `{ ok, text, why }`. kind: `gift envoy trade pact unpact bounty spy support mediate`, 그리고 편의로 `vassal unvassal`(`becomeVassal`·`breakVassal`). `support`는 `id` = 도울 편의 세력, `opts = { war, silver, food, weapons }`. `mediate`는 `id` = 전쟁 id나 싸우는 세력 id. 예물·산하는 `allowJianghu()`가 거짓이어도 쓸 수 있다. 동맹의 명성 조건은 `S.flags['pact_nofame_' + id]`가 서 있으면 빠진다(세가 혼담).
  - 강호 두루마리 `jh_war_sides { war }`, `jh_survivors { f }`, `jh_surge { f }`, `jh_pact_call { war, f }`는 JH가 `S.eventQueue`에 바로 넣는다(하루 하나). `EV[id]`가 없으면 넣지 않는다.
- 기타: `markDirty()`(일자리 다시 배치), `refreshAssign()`, `logMsg`, `UI.toast`, `UI.focusOn(tx, ty)`, `UI.select({b})`, `UI.setTool(key)`, `UI.openSheet(kind)`

## 8. 시험하기

헤드리스 Chromium + Playwright(`require('playwright')`, 설치돼 있음)로 `file://<저장소>/index.html`을 연다.
`#btn-new` → 천하도 고르기(`WorldMap.open('pick')`, 자리 채움은 곧바로 낙수 들녘을 고른다) → 총관의 첫 인사로 게임에 들어간다(이야기 모듈이 바뀌면 그 흐름을 따른다). 고을을 정해 바로 들어가려면 `enterGame(true, siteKey, seed)`.
빨리 감기: `page.evaluate(() => { for (let i = 0; i < N; i++) { PF.budget = 40; simStep(0.02); } })`.
사건 자동 처리: `S.eventQueue`의 첫 항목을 `Events.build(entry)`로 만들고 `choices[i].run()` 후 `S.eventQueue.shift()`.
콘솔 오류(`pageerror`, `console.error`)가 하나도 없어야 한다. 화면은 스크린숏으로 직접 확인한다.
