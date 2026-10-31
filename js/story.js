'use strict';
// ───────────────────────────────────────────────
// 이야기와 튜토리얼 — 총관 윤서하(尹書霞)가 영주 곁에서 돕는다
//  · 새 게임: 흑풍채에 털린 쓰러져 가는 마을에 새 영주가 부임한다
//  · 장(章)마다 할 일과 까닭을 「할 일 두루마리」에 적고, 단추와 지도 위를 짚어 준다
//  · 안내가 끝난 뒤에는 마을 형편을 살피다가 때맞춰 아뢴다
//  · 제4장 갈림길에서 여덟 갈래 가운데 하나를 고르고, 제5·6장·절정·결말이 갈래마다 갈린다 (docs/jianghu.md §8). S.jh.route 는 이 모듈만 바꾼다
// 저장되는 것은 S.story(순수 JSON)뿐. 화면 요소·대화 대기열은 Story 안에만 둔다.
// ───────────────────────────────────────────────

// 이 모듈이 새로 쓰는 한자 풀이. data.js·다른 모듈이 먼저 단 풀이(上·樓처럼 두 뜻을 함께 적은 것)는 덮어쓰지 않는다
const STORY_GLOSS = {
  '總管': ['총관', '영주를 곁에서 보좌하며 마을 살림과 장부를 도맡는 벼슬. 지금은 윤서하가 맡고 있다.'],
  '尹書霞': ['윤서하', '총관의 이름. 尹(성 윤) · 書(글 서) · 霞(노을 하).'],
  '黑風寨': ['흑풍채', '뒷산 험한 산채에 터를 잡은 산적 떼. 「검은 바람의 산채」라는 뜻. 열흘 전 이 마을을 털었다.'],
  '縣廳': ['현청', '고을을 다스리는 관청. 영주를 이 마을에 보낸 곳.'],
  '縣城': ['현성', '성벽을 두른 큰 고을. 인구 120명 이상. 어느 길을 가든 마지막 장에서 이루어야 한다.'],
  '天下第一村': ['천하제일촌', '하늘 아래 첫째가는 마을. 누구의 깃발도 들지 않고 홀로 선 마을이 현성과 명성 400을 이루고 두 세력의 최후통첩을 이겨 내면 얻는 이름.'],
  '上疏': ['상소', '백성이 영주에게 글을 올려 청하는 일. 들어주면 민심이 오르고, 물리치면 내려간다.'],
  '六房': ['육방', '관아의 여섯 부서: 이방·호방·예방·병방·형방·공방. 예산을 나눠 주면 스스로 일한다.'],
  '吏房': ['이방', '인사와 행정을 맡는 부서.'],
  '戶房': ['호방', '호구·세금·곡식을 맡는 부서.'],
  '禮房': ['예방', '제사·잔치·교육·민심을 맡는 부서.'],
  '兵房': ['병방', '군사와 방비를 맡는 부서.'],
  '刑房': ['형방', '치안과 재판을 맡는 부서.'],
  '工房': ['공방', '건설과 길을 맡는 부서.'],
  '民心': ['민심', '백성의 마음. 높으면 사람이 모이고 세금이 잘 걷히며, 25 아래면 사람들이 떠난다.'],
  '望樓': ['망루', '궁수가 올라 멀리서 다가오는 적을 쏘는 높은 대.'],
  '木柵': ['목책', '말뚝을 박아 세운 울타리. 적은 이것을 부숴야 지나간다.'],
  '城門': ['성문', '마을 사람만 지나다니는 문. 적은 부숴야 들어온다.'],
  '江湖': ['강호', '무림의 세상. 정파·사파·마교·녹림·관부·상단이 얽혀 산다.'],
  '廢': ['폐할 폐', '무너지고 버려짐. 제1장 「쓰러져 가는 마을」.'],
  '基': ['터 기', '터전과 기틀. 제3장 「마을의 기틀」.'],
  '風': ['바람 풍', '바람. 흑풍채(黑風寨)의 「풍」.'],
  '天': ['하늘 천', '하늘. 홀로 서는 길의 제6장 「천하제일촌」.'],
  // 갈림길과 여덟 갈래의 장 (제4~6장)
  '岐': ['갈림길 기', '갈림길. 제4장 「갈림길」.'],
  '岐路': ['기로', '갈림길. 어느 깃발 아래 설지, 홀로 설지를 정하는 자리.'],
  '旗': ['깃발 기', '깃발. 정파의 길 제5장 「무림맹의 깃발」.'],
  '月': ['달 월', '달. 마교의 길 제5장 「붉은 달 아래」.'],
  '婚': ['혼인할 혼', '혼인. 무림세가의 길 제5장 「혼맹」.'],
  '婚盟': ['혼맹', '혼인으로 맺은 맹약. 두 집안이 한집안처럼 지낸다.'],
  '夜': ['밤 야', '밤. 흑도의 길 제5장 「밤의 장부」.'],
  '王': ['임금 왕', '왕. 흑도의 길 제6장 「하룻밤의 왕」.'],
  '渡': ['건널 도', '나루. 사파의 길 제5장 「강 나루의 주인」.'],
  '盟': ['맹세 맹', '맹약. 사파의 길 제6장 「사파 회맹」.'],
  '關': ['빗장 관', '관문. 새외의 길 제6장 「관문을 열다」.'],
  '印': ['도장 인', '관인. 관의 길 제5장 「현령의 인장」.'],
  '討': ['칠 토', '토벌. 관의 길 제6장 「토벌령」.'],
  '獨': ['홀로 독', '홀로 선다. 누구의 깃발도 들지 않는 독립의 길.'],
  '武林盟': ['무림맹', '정파 문파들이 뜻을 모아 맺은 맹. 마교와 사파에 맞선다.'],
  '總': ['거느릴 총', '모두 거느림.'],
  '管': ['맡을 관', '맡아 다스림.'],
  '尹': ['성 윤', '성씨.'],
  '書': ['글 서', '글, 장부.'],
  '霞': ['노을 하', '노을.'],
  '寨': ['울타리 채', '산채. 산적의 소굴.'],
  '縣': ['고을 현', '고을.'],
  '廳': ['관청 청', '관청.'],
  '樓': ['다락 루', '높은 다락.'],
  '上': ['윗 상', '위, 윗사람.'],
  '章': ['글 장', '이야기의 한 마디. 이 이야기는 여섯 장으로 되어 있고, 제5·6장은 갈림길에서 고른 길에 따라 다르다.'],
};
for (const [k, v] of Object.entries(STORY_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

const Story = (() => {
  // ── 작은 도구 ─────────────────────────────
  const byId = id => document.getElementById(id);
  const ST = () => (typeof S !== 'undefined' && S ? S.story : null);
  const hj = h => `<span class="hj" data-tip-title="${h}">${h}</span>`;  // 한자 + 풀이
  const hjp = (word, h) => `${word}(${hj(h)})`;                             // 총관(總管)
  const vn = () => escapeHtml(S.name);
  const flag = k => !!(ST() && ST().flags[k]);
  const setFlag = k => { const st = ST(); if (st) st.flags[k] = 1; };
  const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const phone = () => window.innerWidth <= 860;
  const RES_NAME = k => (k === 'fame' ? '명성' : RESOURCES[k].name);
  // 숫자로 끝나는 말 뒤의 조사: 끝자리 0·1·3·6·7·8(영·일·삼·육·칠·팔, 십·백·천)은 받침이 있다
  const ppn = (w, pair) => (/\d$/.test(String(w)) ? pair.split('/')[/[013678]$/.test(String(w)) ? 0 : 1] : pp(w, pair));
  // 「읍(邑)」의 한자에 풀이를 단다
  const rankName = i => RANKS[i].name.replace(/\(([^)]+)\)/, (m, h) => `(${hj(h)})`);

  function goal(label, cur, max, extra) {
    const c = Math.max(0, Math.floor(cur));
    return Object.assign({ label, cur: Math.min(c, max), max, done: c >= max }, extra || {});
  }
  function check(label, ok, extra) { return Object.assign({ label, cur: ok ? 1 : 0, max: 1, done: !!ok, one: true }, extra || {}); }

  const nonRuined = t => S.buildings.filter(b => b.type === t && !b.ruined);
  const usableOf = t => S.buildings.filter(b => b.type === t && usable(b));
  const houseCount = done => S.buildings.filter(b => (b.type === 'house' || b.type === 'house2') && !b.ruined && (!done || b.done)).length;
  const bCenter = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  function manorCenter() { const m = getB(S.manorId); return m ? bCenter(m) : { x: World.center.x + 0.5, y: World.center.y + 0.5 }; }
  function nearestOf(list) {
    const c = manorCenter();
    let best = null, bd = Infinity;
    for (const b of list) { const d = dist(b.x + b.w / 2, b.y + b.h / 2, c.x, c.y); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  const ruinOf = t => nearestOf(S.buildings.filter(b => b.type === t && b.ruined));
  const homeless = () => S.villagers.filter(v => !v.dead && !v.leaving && !v.arriving && !v.home).length;
  const foodDays = () => { const p = popCount(); return p ? S.res.food / (p * 2) : 99; };
  // 무관에서 익히는 사람 (의뢰로 떠난 이는 빼다)
  const dojoWorkers = () => { const d = S.buildings.find(b => b.type === 'dojo' && usable(b)); return d && d._workers ? d._workers.filter(v => !v.away).length : 0; };
  const adminReal = () => typeof Admin !== 'undefined' && (typeof Admin.fund === 'function' || typeof Admin.orderBuild === 'function');
  function budgetTotal() {
    let n = 0, seen = false;
    const depts = S.admin && S.admin.depts;
    if (depts && typeof depts === 'object') {
      for (const k in depts) { const d = depts[k]; if (d && typeof d.budget === 'number') { n += d.budget; seen = true; } }
    }
    if (!seen) { const b = ST() ? ST().budgets : {}; for (const k in b) n += +b[k] || 0; }
    return n;
  }
  function pendingPetitions() { const n = hook(Petitions, 'pending'); return typeof n === 'number' ? n : 0; }
  // 무관보다 먼저 사람을 데려갈 빈 일자리 (refreshAssign의 순서를 따른다)
  function slotAhead() {
    const foodLow = S.res.food < popCount() * 4;
    const pri = t => (JOB_PRIORITY[t] || 0) + (foodLow && (t === 'farm' || t === 'fishery') ? 5 : 0);
    return S.buildings.find(b => usable(b) && b.active && BDEF[b.type].workers && pri(b.type) > pri('dojo')
      && (b._workers || []).length < Math.min(BDEF[b.type].workers, b.want));
  }
  // 영주관에서 가장 가까운 숲 칸 (벌채할 곳)
  function forestNear() {
    const c = manorCenter();
    let best = null, bd = Infinity;
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      if (World.tile(x, y) !== T.FOREST || World.occ[y * MW + x]) continue;
      const d = dist(x + 0.5, y + 0.5, c.x, c.y);
      if (d < bd) { bd = d; best = { x: x + 0.5, y: y + 0.5 }; }
    }
    return best;
  }

  // 자원을 준다 → 「은자 +100 · 석재 +30」
  function grant(res, why) {
    const parts = [];
    for (const k of ['silver', 'food', 'wood', 'stone', 'weapons', 'fame']) {
      const n = res && res[k];
      if (!n) continue;
      addRes(k, n);
      parts.push(`${RES_NAME(k)} +${n}`);
    }
    if (!parts.length) return '';
    const txt = parts.join(' · ');
    if (why) { logMsg(`${why}: ${txt}`, 'good'); UI.toast(`${why} · ${txt}`, 'good'); }
    return txt;
  }
  // 모자라는 만큼 채운다 (열쇠마다 한 번만)
  function topUp(cost, key, why) {
    const st = ST();
    if (st.granted[key] !== undefined) return st.granted[key];
    const need = {};
    for (const k in cost) {
      const lack = Math.ceil(cost[k] - (S.res[k] || 0));
      if (lack > 0) need[k] = lack + (k === 'silver' ? 10 : 5);
    }
    const txt = grant(need, why);
    st.granted[key] = txt;
    return txt;
  }

  // ── 지을 자리 찾기 ──────────────────────────
  // 다른 건물과 한 칸 떨어지고(문을 막지 않게), 앞쪽이 걸을 수 있는 자리
  function ringClear(def, x, y) {
    for (let yy = y - 1; yy <= y + def.h; yy++) for (let xx = x - 1; xx <= x + def.w; xx++) {
      if (xx >= x && xx < x + def.w && yy >= y && yy < y + def.h) continue;
      if (!World.inb(xx, yy)) return false;
      if (World.occ[yy * MW + xx]) return false;
    }
    for (let xx = x; xx < x + def.w; xx++) if (walkable(xx, y + def.h)) return true;
    return false;
  }
  function siteValid(type, x, y) {
    const r = canPlace(type, x, y);
    return (r.ok || !!r.poor) && ringClear(BDEF[type], x, y);
  }
  function nearRoad(x, y, w, h, r) {
    for (let yy = y - r; yy < y + h + r; yy++) for (let xx = x - r; xx < x + w + r; xx++) if (World.isRoad(xx, yy)) return true;
    return false;
  }
  function findSite(type, near) {
    const def = BDEF[type];
    const c = near || manorCenter();
    let best = null, bs = Infinity;
    const R = 15;
    for (let y = Math.floor(c.y - R); y <= c.y + R; y++) for (let x = Math.floor(c.x - R); x <= c.x + R; x++) {
      if (!siteValid(type, x, y)) continue;
      let s = Math.hypot(x + def.w / 2 - c.x, y + def.h / 2 - c.y);
      if (def.needs === 'forest') s -= Math.min(14, countTilesNear({ x, y, w: def.w, h: def.h }, T.FOREST, 4.5)) * 0.5;
      let trees = 0;
      for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) if (World.tile(xx, yy) === T.FOREST) trees++;
      s += trees * 1.2;
      if (nearRoad(x, y, def.w, def.h, 2)) s -= 1.5;
      if (s < bs) { bs = s; best = { x, y }; }
    }
    if (!best) return null;
    // 건설 도구는 누른 칸을 가운데(짝수면 왼쪽 위)로 놓는다 → 그 칸의 가운데를 가리킨다
    return { x: best.x, y: best.y, cx: best.x + Math.floor((def.w - 1) / 2) + 0.5, cy: best.y + Math.floor((def.h - 1) / 2) + 0.5 };
  }
  // 북쪽 산길 위, 마을에서 k칸 올라간 곳 (흑풍채가 내려오는 길)
  function northPath(k) {
    const m = getB(S.manorId);
    const y = clamp(Math.round((m ? m.y : World.center.y - 1) - k), 1, MH - 2);
    const x0 = World.center.x - 7;
    let best = null, bd = Infinity;
    for (let x = 1; x < MW - 1; x++) if (World.isRoad(x, y)) { const d = Math.abs(x - x0); if (d < bd) { bd = d; best = x; } }
    return { x: (best !== null ? best : x0) + 0.5, y: y + 0.5 };
  }

  // ── 짚어 주기 (단추 둘레의 금빛 고리 + 지도 위 화살표) ──
  function panelShows(b) { return UI.sel && UI.sel.b === b && !byId('panel').hidden; }
  // 건설 도구를 든 채로는 건물을 눌러도 고를 수 없다 → 든 도구를 한 번 더 눌러 거두게 한다
  // (도구를 여기서 거두지는 않는다. 안내는 0.22초마다 다시 불리니 영주가 일부러 든 도구까지 빼앗게 된다)
  function toolDown(what, markers, focus) {
    const k = UI.tool.key, def = BDEF[k] || TOOLS[k];
    const cat = BDEF[k] ? def.cat : 'tools';
    const catName = (BUILD_CATS.find(c => c.id === cat) || {}).name || '';
    const g = UI.cat !== cat ? { sel: `#build-tabs button[data-cat="${cat}"]`, tag: catName } : { sel: `.bitem[data-key="${k}"]`, tag: '한 번 더 누르기' };
    const how = coarse() ? '한 번 더 눌러' : '한 번 더 누르거나 Esc를 눌러';
    return Object.assign(g, { markers, focus, sub: `먼저 ${UI.cat !== cat ? `[${catName}]에서 ` : ''}[${def.name}]${pp(def.name, '을/를')} ${how} 도구를 거두고, ${what}${pp(what, '을/를')} 누르십시오.` });
  }
  // 재료가 모자라는데 그 재료를 낼 곳도 없으면, 기다리라 하지 않고 얻을 길을 짚는다
  function lackGuide(cost, markers, focus) {
    const short = k => (S.res[k] || 0) < (cost[k] || 0);
    if (short('wood') && !nonRuined('lumber').length) {
      if (UI.tool && UI.tool.key === 'clear') {
        const f = forestNear();
        // 눈길은 4칸 단위로 맞춘다 (한 칸씩 벨 때마다 화면이 따라 움직이지 않게)
        const fc = f && { x: Math.round(f.x / 4) * 4, y: Math.round(f.y / 4) * 4 };
        return { markers: f ? [{ ...f, text: '숲' }] : markers, focus: fc || focus, sub: '나무가 선 숲 칸을 누르면 은자 2냥에 목재 4를 얻습니다. 모자란 만큼 베고 [벌채]를 한 번 더 눌러 거두십시오.' };
      }
      const sub = '목재가 모자라는데 벌목장이 없습니다. [길·정리]의 [벌채]로 숲을 베면 한 칸에 은자 2냥으로 목재 4를 얻습니다.';
      if (UI.cat !== 'tools') return { sel: '#build-tabs button[data-cat="tools"]', tag: '길·정리', markers, focus, sub };
      return { sel: '.bitem[data-key="clear"]', tag: '벌채', markers, focus, sub };
    }
    // 석재는 안내 중에 낼 곳이 없다 → 단계마다 한 번은 소인이 더 마련한다
    if (short('stone') && !nonRuined('quarry').length && M.tutorialActive()) {
      const st = ST(), key = `lack${st.chapter}.${st.step}`;
      if (st.granted[key] === undefined) { topUp(cost, key, '총관이 현청을 졸라 마련했다'); return null; }
      return { markers, focus, sub: '석재가 모자랍니다. 바위산 가까이에 [생산]의 [채석장]을 지으면 석재가 납니다.' };
    }
    return null;
  }
  function guideRepair(b, text) {
    const name = BDEF[b.type].name;
    const c = bCenter(b);
    const markers = [{ x: c.x, y: c.y, text: text || `${name} 터` }];
    const rc = repairCost(b);
    if (!canAfford(rc)) { const g = lackGuide(rc, markers, c); if (g) return g; }
    if (panelShows(b)) {
      if (!canAfford(rc)) return { markers, sub: `다시 짓는 데 ${costText(rc)}${ppn(costText(rc), '이/가')} 듭니다. 재료가 모이기를 기다리십시오.`, focus: c };
      return { sel: '#panel [data-act="repair"]', tag: '다시 짓기', sub: '창의 [다시 짓기]를 누르십시오.', markers, focus: c };
    }
    if (UI.tool) return toolDown(`화살표가 가리키는 ${text || name}`, markers, c);
    return { markers, sub: `화살표가 가리키는 ${text || name}${pp(text || name, '을/를')} 눌러 고르십시오.`, focus: c };
  }
  // 같은 종류의 폐허라면 영주가 고른 것을 따른다
  function guideRuin(type, text) {
    const s = UI.sel && UI.sel.b;
    if (s && s.type === type && s.ruined && panelShows(s)) return guideRepair(s, text);
    const r = ruinOf(type);
    return r ? guideRepair(r, text) : null;
  }
  function guideBuild(type, near) {
    const def = BDEF[type];
    const site = M.site(type, near);
    const cat = def.cat;
    const catName = (BUILD_CATS.find(c => c.id === cat) || {}).name || '';
    const mk = site ? [{ x: site.cx, y: site.cy, text: `${def.name} 자리` }] : [];
    const focus = site ? { x: site.cx, y: site.cy } : null;
    if (def.rank && S.rank < def.rank) return { sub: `${def.name}${pp(def.name, '은/는')} 마을이 ${rankName(def.rank)} 이상이 되어야 지을 수 있습니다.` };
    if (!canAfford(def.cost)) { const g = lackGuide(def.cost, mk, focus); if (g) return g; }
    if (UI.tool && UI.tool.key === type) {
      // 손가락으로는 미리 보기 없이 누르는 즉시 짓는다
      const how = coarse()
        ? `화살표 끝의 땅을 누르면 곧바로 ${def.name}${pp(def.name, '이/가')} 들어섭니다. 지을 수 없는 자리면 재료는 쓰이지 않습니다.`
        : `화살표 끝의 땅을 누르면 ${def.name}${pp(def.name, '이/가')} 들어섭니다. 초록빛이면 지을 수 있는 자리입니다.`;
      return { markers: mk, focus, sub: site ? how : '지을 만한 빈터를 골라 누르십시오.' };
    }
    if (UI.cat !== cat) return { sel: `#build-tabs button[data-cat="${cat}"]`, tag: catName, markers: mk, focus, sub: `아래 건설 띠에서 [${catName}]${pp(catName, '을/를')} 누르십시오.` };
    return { sel: `.bitem[data-key="${type}"]`, tag: def.name, markers: mk, focus, sub: `[${def.name}]${pp(def.name, '을/를')} 고르고, 표시한 자리를 누르십시오.` };
  }
  // 공사 중인 곳들 + 빨리 감기
  function guideWait(types) {
    for (const t of types) {
      const live = nonRuined(t);
      if (!live.length) return guideRuin(t) || guideBuild(t);
    }
    const sites = S.buildings.filter(b => types.includes(b.type) && !b.done && !b.ruined);
    const markers = sites.slice(0, 4).map(b => ({ ...bCenter(b), text: `공사 ${Math.floor(b.progress / BDEF[b.type].time * 100)}%` }));
    const g = { markers, sub: '일꾼들이 공사를 마치기를 기다리십시오. 오른쪽 위 ▶▶ 단추로 시간을 빨리 감을 수 있습니다.' };
    if (sites.length && S.speed < 2) { g.sel = '#spd-2'; g.tag = '빨리 감기'; }
    return g;
  }
  function ruinsMarkers() {
    const st = ST();
    return (st.ruins || []).map(getB).filter(b => b && b.ruined).slice(0, 5).map(b => ({ ...bCenter(b), text: `${BDEF[b.type].name} 터` }));
  }

  // ── 갈래 도구 (docs/jianghu.md §8) ───────────────
  const jhOn = () => typeof S !== 'undefined' && !!S && !!S.jh;
  const route = () => (jhOn() ? S.jh.route : null);
  const routeOk = () => !!(route() && ROUTES[route()] && ST() && ST().routeOk);   // 잠정이 아니라 굳힌 갈래
  const campRoute = c => (CAMPS[c] ? CAMPS[c].route : 'free');
  const fN = id => FACTIONS[id].name;
  const homeSite = () => (jhOn() && SITES[S.jh.site]) || SITES.henan_field;
  const seatGap = id => { const s = S.jh.seats[id], h = homeSite(); return s ? Math.hypot(s.x - h.x, s.y - h.y) : Infinity; };
  const armed = id => JH.isAlive(id) && !!FACTIONS[id].military;
  const byPower = (a, b) => (S.jh.power[b] || 0) - (S.jh.power[a] || 0);
  const heroCount = () => S.villagers.filter(v => v.hero && !v.dead && !v.leaving).length;
  const evHas = id => typeof EV !== 'undefined' && !!EV[id];
  const queued = id => S.eventQueue.some(e => e.id === id) || S.scheduled.some(s => s.kind === 'event' && s.id === id);
  const crossPending = () => queued('crossroads');
  const offerPending = () => S.eventQueue.some(e => e.id === 'offer' && e.data && e.data.special);
  const marriageDone = () => !!S.flags.marriage || Object.keys(S.flags).some(k => k.startsWith('pact_nofame_') && S.flags[k]);
  // 그 계열을 대표하는 세력: 주군 → 이웃(관계 좋은 순) → (nearOnly 가 아니면) 본산이 가장 가까운 세력. 산채(noLord)는 빼다
  function campRep(c, nearOnly) {
    if (!jhOn()) return null;
    if (S.vassal && JH.campOf(S.vassal) === c && JH.isAlive(S.vassal)) return S.vassal;
    const ok = id => JH.isAlive(id) && JH.campOf(id) === c && !FACTIONS[id].noLord;
    const ns = S.jh.near.filter(ok).sort((a, b) => rel(b) - rel(a));
    if (ns.length || nearOnly) return ns[0] || null;
    return FACTION_ORDER.filter(id => ok(id) && FACTIONS[id].military).sort((a, b) => seatGap(a) - seatGap(b))[0] || null;
  }
  // 맞설 세력: 숙적 계열의 이웃(산채·관부가 아닌 쪽부터, 힘센 순) → 곁의 산채·관부 → 본산이 가장 가까운 숙적. 주군·동맹은 빼다
  function foeRep(camps, skip = []) {
    if (!jhOn()) return null;
    const ok = id => armed(id) && id !== S.vassal && !S.jh.pacts.includes(id) && !skip.includes(id);
    for (const local of [false, true]) for (const c of camps) {
      const ns = S.jh.near.filter(id => ok(id) && JH.campOf(id) === c && (FACTIONS[id].home === 'local') === local).sort(byPower);
      if (ns.length) return ns[0];
    }
    for (const c of camps) {
      const far = FACTION_ORDER.filter(id => ok(id) && JH.campOf(id) === c && !S.jh.near.includes(id)).sort((a, b) => seatGap(a) - seatGap(b));
      if (far.length) return far[0];
    }
    return null;
  }
  // 가장 센 이웃 n (독립 갈래의 숙적). 산채는 모자랄 때만 채운다
  function topNear(n, skip = []) {
    const ok = id => armed(id) && id !== S.vassal && !S.jh.pacts.includes(id) && !skip.includes(id);
    const a = S.jh.near.filter(id => ok(id) && !FACTIONS[id].noLord).sort(byPower);
    const b = S.jh.near.filter(id => ok(id) && FACTIONS[id].noLord).sort(byPower);
    return a.concat(b).slice(0, n);
  }
  // 갈래의 숙적 계열 (독립이면 가장 센 이웃 둘 — 최후통첩을 보낸 쪽이 정해졌으면 그 둘)
  function foeCamps(k) {
    if (k !== 'free') return ROUTES[k] ? ROUTES[k].foes.slice() : [];
    const st = ST(), cx = st && st.cx;
    const ids = cx && cx.r === 'free' && cx.rk && cx.rk.length ? cx.rk : jhOn() ? topNear(2) : [];
    return [...new Set(ids.map(id => JH.campOf(id)))];
  }
  // 힘을 바꾼다 (JH 에 공개 setter 가 생기면 그것을 쓴다. 바닥: 흑풍채·주군 25, 관부 10)
  function setPow(id, p) {
    if (typeof JH.setPower === 'function') { JH.setPower(id, p); return; }
    const floor = id === 'gwanbu' ? 10 : (id === 'heukpung' || id === S.vassal) ? 25 : 1;
    S.jh.power[id] = clamp(Math.max(p, floor), 0, 200);
  }

  // ── 대사 ───────────────────────────────────
  // 한 줄 = { m: 표정(calm·smile·worry·stern), t: HTML }
  // 부임한 고을: 「하남(河南) 낙수 들녘(洛水原)」
  function siteName() {
    const s = homeSite(), R = REGIONS[s.region];
    return `${R ? `${R.name}(${hj(R.hanja)}) ` : ''}${s.name}(${hj(s.hanja)})`;
  }
  function introLines() {
    const s = homeSite();
    const near = jhOn() ? S.jh.near.filter(id => id !== 'heukpung' && id !== 'gwanbu' && FACTIONS[id].camp !== 'sang').map(fN) : [];
    return [
      { m: 'smile', t: `영주님, 먼 길 오시느라 고생 많으셨습니다. 여기가 ${siteName()}의 ${vn()}입니다. 이 마을의 살림을 맡아 온 ${hjp('총관', '總管')} 윤서하라 합니다.` },
      { m: 'worry', t: `보시다시피 환영 잔치를 열 형편은 못 됩니다. 열흘 전, 뒷산의 ${hjp('흑풍채', '黑風寨')} 산적들이 들이닥쳐 곳간을 털고 집과 논밭에 불을 놓았습니다.` },
      { m: 'stern', t: '전임 영주는 그날 밤 말 한 필에 금붙이만 싣고 달아났지요. 남은 사람은 고작 다섯. 다들 영주관 행랑채에 모여 겨우 비를 긋고 있습니다.' },
      { m: 'calm', t: `${hjp('현청', '縣廳')}이 영주님을 이리 보낸 것은… 솔직히 말씀드리면 마을을 지도에서 지우기 전에 마지막으로 한 번 걸어 본 것일 겁니다. 그 판을 뒤집는 것이 이제 영주님의 일입니다.` },
      { m: 'calm', t: `현청 문서에는 ${s.name} 땅을 두고 「${escapeHtml(((s.trait || {}).text) || s.desc)}」, 이렇게 적혀 있습니다.${near.length ? ` 둘레에는 ${near.join('·')} 같은 강호의 세력들이 자리를 잡고 있지요. 당장 급한 것은 뒷산의 흑풍채지만요.` : ''}` },
      { m: 'smile', t: `목표는 하나입니다. 이 쓰러져 가는 ${hjp('촌', '村')}을 강호 누구도 넘보지 못할 ${hjp('현성', '縣城')}으로 키우는 것. <em>인구 120명</em>. 그때 어느 깃발 아래 서 있을지, 홀로 서 있을지는 마을이 커지면 정하시게 될 겁니다.` },
      { m: 'calm', t: '먼 길이지만 한 걸음씩 가면 됩니다. 처음 얼마간은 소인이 곁에서 차근차근 일러 드릴까요?' },
    ];
  }
  function goalLines() {
    const pop = popCount(), k = route(), R = k && ROUTES[k];
    const lines = [];
    if (!R) {
      lines.push({ m: 'smile', t: `이 마을의 목표는 인구 120명의 ${hjp('현성', '縣城')}입니다. 그 길에 어느 깃발 아래 설지는 제4장 ${hjp('갈림길', '岐路')}에서 정하시게 됩니다.` });
      lines.push({ m: 'calm', t: `지금 인구 ${pop}명. ${pop < 120 ? `아직 ${120 - pop}명이 모자랍니다.` : '이미 이루셨습니다.'} 정파·마교·세가·흑도·사파·새외·관, 그리고 홀로 서는 길까지 여덟 갈래가 있습니다.` });
      return lines;
    }
    lines.push({ m: 'smile', t: `${routeOk() ? '' : '아직 잠정입니다만, '}지금은 ${R.name}의 길입니다. 이 길의 끝에서 마을은 「${R.title}」${pp(R.title, '이라/라')} 불리게 됩니다.` });
    lines.push({ m: 'calm', t: `제5장 「${R.ch5.title}」, 제6장 「${R.ch6.title}」. 어느 길이든 마지막에는 인구 120명의 ${hjp('현성', '縣城')}을 이루셔야 합니다. 지금 인구 ${pop}명입니다.` });
    const fc = foeCamps(k).filter(c => CAMPS[c]).map(c => CAMPS[c].name);
    if (fc.length) lines.push({ m: 'stern', t: `이 길의 숙적은 ${fc.join('·')}입니다. 그쪽 이웃들과는 사이가 벌어지기 쉬우니 방비를 게을리하지 마십시오.` });
    return lines;
  }

  // 갈림길이 열릴 때 총관의 말
  function crossLines() {
    const names = M.routeCards().map(c => CAMPS[c.camp].name);
    const lord = S.vassal && FACTIONS[S.vassal] ? S.vassal : null;
    return [
      { m: 'calm', t: `제4장, ${hjp('갈림길', '岐路')}입니다. 마을이 커지자 이웃한 강호의 세력들이 저마다 손을 내밀고 있습니다.` },
      { m: 'calm', t: `어느 깃발 아래 서느냐에 따라 제5·6장과 마을의 결말이 갈립니다. ${names.length ? `${names.join('·')} 가운데 하나를 고르시거나, ` : ''}누구의 깃발도 들지 않고 홀로 서실 수도 있습니다.` },
      lord && JH.campOf(lord) === 'sang'
        ? { m: 'stern', t: `${fN(lord)}의 산하는 어느 계열의 길도 아닙니다. 그대로 두시면 홀로 서는 길과 같고, 다른 깃발을 고르시면 상단과의 연은 끊어집니다.` }
        : lord ? { m: 'stern', t: `이미 ${fN(lord)}의 산하에 드셨으니 그 길을 굳히시면 됩니다. 다른 깃발로 옮기시면 옛 주군은 원수가 됩니다.` }
          : { m: 'stern', t: '깃발을 고르면 그 세력이 사자를 보냅니다. 받아들이면 선납 은자 100냥에 산하가 되고, 그 원수들과는 척을 지게 됩니다.' },
      { m: 'smile', t: '[천하도]를 펼치면 이웃의 자리와 힘이 한눈에 보입니다. 당장 정하기 어려우시면 [더 지켜보겠소]를 고르셨다가 소인을 다시 부르십시오.' },
    ];
  }

  // ── 장(章)과 단계 ────────────────────────────
  // 단계: { id, title, why, lines(), goals(), guide(), enter(), ack, pause, done() }
  // 건너뛴 경우(skip)에는 장마다 목표만 보여 준다.
  const CH = [
    {
      title: '쓰러져 가는 마을', seal: '廢',
      skip: {
        title: '마을을 다시 일으키기', why: '먹을 것과 잘 곳, 일거리가 있어야 사람이 붙습니다.',
        goals: () => [
          check('논밭 되살리기', usableOf('farm').length > 0, { tip: '무너진 논밭을 눌러 [다시 짓기]를 누르십시오.', guide: () => guideRuin('farm') || guideBuild('farm') }),
          check('벌목장 짓기', usableOf('lumber').length > 0, { tip: '[생산]에서 벌목장을 골라 숲 가까이에 지으십시오.', guide: () => guideBuild('lumber') }),
          goal('초가 마련하기', houseCount(true), 2, { tip: '타 버린 초가를 다시 짓거나 [주거]에서 새로 지으십시오.', guide: () => guideRuin('house') || guideBuild('house') }),
        ],
      },
      steps: [
        {
          id: 'look', title: '마을 둘러보기', why: '영주라면 제 땅부터 알아야 합니다.', ack: '둘러보았소',
          enter: () => { delete ST().flags.cam; },
          lines: () => [
            { m: 'calm', t: `먼저 마을을 한번 둘러보시지요. ${coarse() ? '땅을 손가락으로 끌면 지도가 움직이고, 두 손가락을 벌리면 가까이 보입니다.' : '땅을 누른 채 끌면 지도가 움직이고, 휠을 굴리면 가까이 보입니다. W·A·S·D로도 움직입니다.'}` },
            { m: 'worry', t: '화살표가 가리키는 잿더미들이 지난 습격의 흔적입니다. 하나씩 다시 세워야지요.' },
          ],
          goals: () => [check('지도를 끌거나 확대해 보기', flag('cam'))],
          guide: () => ({ markers: ruinsMarkers(), sub: '지도를 끌어 움직이거나 확대해 보십시오. 다 보셨으면 [둘러보았소]를 누르십시오.' }),
        },
        {
          id: 'topbar', title: '위쪽 장부 읽기', why: '살림을 맡으시려면 장부부터 보셔야지요.', ack: '알겠소',
          enter: () => { delete ST().flags.tip; },
          lines: () => [
            { m: 'calm', t: `위쪽 띠가 이 마을의 장부입니다. ${hj('銀')} 은자, ${hj('食')} 식량, ${hj('木')} 목재, ${hj('石')} 석재, ${hj('兵')} 병장기. 그리고 ${hj('人')} 인구, ${hj('心')} 민심, ${hj('武')} 무력, ${hj('名')} 명성입니다.` },
            { m: 'smile', t: `한자가 낯서시면 그 위에 ${coarse() ? '손가락을 길게 대 보십시오' : '커서를 올려 보십시오'}. 이 마을의 한자에는 모두 풀이가 달려 있습니다.` },
          ],
          goals: () => [check('한자 풀이 하나 읽어 보기', flag('tip'))],
          guide: () => ({ sel: '#res', tag: coarse() ? '한자를 길게 눌러 보십시오' : '한자에 커서를 올려 보십시오', sub: `위쪽 띠의 한자 위에 ${coarse() ? '손가락을 길게 대십시오' : '커서를 올리십시오'}. 다 읽으셨으면 [알겠소]를 누르십시오.` }),
        },
        {
          id: 'farm', title: '무너진 논밭 다시 짓기', why: '곳간의 식량이 며칠 치뿐입니다. 먹을 것부터 마련해야 합니다.',
          enter: () => { const r = ruinOf('farm'); topUp(r ? repairCost(r) : BDEF.farm.cost, 'farm', '총관이 곳간을 뒤져 마련했다'); },
          lines: () => [
            { m: 'worry', t: `급한 불부터 끄지요. 곳간의 식량은 지금 사람들이 ${Math.max(1, Math.floor(foodDays()))}일쯤 먹을 양뿐입니다. 한 사람이 하루에 두 섬씩 먹으니까요.` },
            { m: 'calm', t: '화살표가 가리키는 무너진 논밭을 눌러 고르시고, 창에 뜨는 [다시 짓기]를 누르십시오. 새로 짓는 값의 절반이면 됩니다.' },
          ],
          goals: () => [check('무너진 논밭 다시 짓기', nonRuined('farm').length > 0)],
          guide: () => guideRuin('farm', '무너진 논밭') || guideBuild('farm'),
        },
        {
          id: 'lumber', title: '숲 가까이 벌목장 짓기', why: '집 한 채를 고치려 해도 목재가 듭니다.',
          enter: () => { topUp(BDEF.lumber.cost, 'lumber', '총관이 곳간을 뒤져 마련했다'); },
          lines: () => [
            { m: 'smile', t: '논밭에 다시 볍씨가 들어갑니다. 다음은 목재입니다. 집 한 채를 고치려 해도 나무가 드는데, 곳간의 목재로는 어림도 없지요.' },
            { m: 'calm', t: '아래 건설 띠에서 [생산]을 누르고 [벌목장]을 고르신 뒤, 숲 가까이 표시해 둔 자리를 누르십시오. 숲이 울창할수록 나무가 많이 납니다.' },
          ],
          goals: () => [check('숲 가까이 벌목장 짓기', nonRuined('lumber').length > 0)],
          guide: () => guideBuild('lumber'),
        },
        {
          id: 'houses', title: '초가 두 채 마련하기', why: '빈 집이 있어야 떠돌던 사람들이 찾아옵니다.',
          enter: () => { topUp({ wood: 2 * Math.ceil(BDEF.house.cost.wood * 0.5) + 4 }, 'houses', '총관이 곳간 구석구석을 털어 마련했다'); },
          lines: () => [
            { m: 'calm', t: '사람이 늘어야 마을이 삽니다. 지금은 남은 이들이 영주관 행랑채에 끼어 자고 있지요.' },
            { m: 'calm', t: `위쪽 ${hj('人')} 옆의 숫자는 「사는 사람 / 집 칸」입니다. 빈 집이 있고, 곳간에 먹을 것이 있고, 민심(${hj('心')})이 42를 넘으면 떠돌던 사람들이 알아서 찾아옵니다.` },
            { m: 'smile', t: `타 버린 초가 두 채를 다시 지어 주십시오.${ST().granted.houses ? ' 목재는 소인이 곳간 구석구석을 털어 조금 마련해 두었습니다.' : ''}` },
          ],
          goals: () => [goal('초가 다시 짓기 또는 새로 짓기', houseCount(false), 2)],
          guide: () => { if (houseCount(false) >= 2) return null; return guideRuin('house', '타 버린 초가') || guideBuild('house'); },
        },
        {
          id: 'time', title: '공사가 끝나기를 기다리기', why: '이제 일꾼들의 몫입니다. 시간을 빨리 감아도 됩니다.',
          lines: () => [
            { m: 'calm', t: '이제 일꾼들의 몫입니다. 공사는 일 없는 사람들이 거들수록 빨라지지요.' },
            { m: 'smile', t: `시간이 더디게 가면 오른쪽 위의 ▶▶ 단추로 빨리 감으십시오. ${coarse() ? '❚❚ 단추를 누르면 멈춥니다.' : 'Space를 누르면 멈춥니다.'} 해가 지면 다들 집에 들어가 쉬니, 밤에는 들일이 멈춥니다.` },
          ],
          goals: () => [
            check('논밭 완공', usableOf('farm').length > 0),
            check('벌목장 완공', usableOf('lumber').length > 0),
            goal('초가 완공', houseCount(true), 2),
          ],
          guide: () => guideWait(['farm', 'lumber', 'house']),
        },
        {
          id: 'petition', title: '첫 상소 처리하기', why: '백성의 청을 듣는 것이 다스림의 시작입니다.',
          enter: () => {
            const st = ST();
            delete st.flags.petition;
            if (st.granted.petition === undefined) {
              st.granted.petition = '';
              const p = hook(Petitions, 'add', { type: 'well' });
              st.petitionStub = !p && pendingPetitions() === 0;
            }
          },
          lines: () => [
            { m: 'calm', t: `공사가 끝나기 무섭게 백성 하나가 영주관 문을 두드립니다. ${hjp('상소', '上疏')}입니다.` },
            { m: 'calm', t: '청을 들어주면 민심이 오르고, 물리치면 내려갑니다. 들어주는 데는 대개 은자나 재료가 들지요. 다 들어줄 수는 없으니 가려 듣는 것이 영주의 일입니다.' },
            { m: 'smile', t: '[상소함]을 열어 처리해 보십시오.' },
          ],
          goals: () => [ST().petitionStub ? check('상소함 열어 보기', flag('sheet_petitions')) : check('상소 하나 처리하기', flag('petition'))],
          guide: () => ({ sel: '#btn-petitions', tag: '상소함', sub: '[상소함]을 열어 상소를 읽고, 들어줄지 물리칠지 정하십시오.' }),
        },
        {
          id: 'admin', title: '육방에 예산 나눠 주기', why: '부서가 스스로 일하게 해야 영주가 큰일을 봅니다.',
          enter: () => { const st = ST(); delete st.flags.budget; st.adminStub = !adminReal(); },
          lines: () => [
            { m: 'calm', t: `마지막으로 ${hjp('육방', '六房')}입니다. 영주님 혼자 모든 못질을 하실 수는 없지요.` },
            { m: 'calm', t: `${hjp('이방', '吏房')}·${hjp('호방', '戶房')}·${hjp('예방', '禮房')}·${hjp('병방', '兵房')}·${hjp('형방', '刑房')}·${hjp('공방', '工房')}. 부서마다 예산을 나눠 주시면, 그 돈으로 필요한 것을 스스로 짓고 처리합니다. 공방은 집과 길을, 병방은 방비를 챙기는 식이지요.` },
            { m: 'smile', t: '[육방]을 열어 한 부서에라도 예산을 넣어 보십시오. 손을 놓고 계셔도 마을이 돌아가게 만드는 것, 그것이 좋은 영주입니다.' },
          ],
          // 이 단계 전에 이미 넣어 둔 예산도 친다
          goals: () => [ST().adminStub ? check('육방 열어 보기', flag('sheet_admin')) : check('한 부서에 예산 넣기', flag('budget') || budgetTotal() > 0)],
          guide: () => ({ sel: '#btn-admin', tag: '육방', sub: '[육방]을 열어 한 부서의 예산을 올려 보십시오.' }),
        },
      ],
      reward: () => ({ silver: 100, stone: 30 }),
      rewardWhy: '현청의 구휼금',
      end: () => (ST().skipped
        ? [{ m: 'smile', t: '마을이 다시 숨을 쉽니다. 현청에서 구휼금으로 은자 100냥과 석재 30을 보내왔습니다.' }]
        : [
          { m: 'smile', t: '해내셨습니다, 영주님. 불 꺼졌던 아궁이마다 다시 연기가 오릅니다.' },
          { m: 'calm', t: '현청에서도 소식을 들었는지 구휼금을 보내왔습니다. 은자 100냥과 석재 30. 아껴 쓰시라는 잔소리는… 하지 않겠습니다.' },
        ]),
    },
    {
      title: '흑풍채의 그림자', seal: '黑',
      skip: {
        title: '흑풍채에 맞설 채비', why: '흑풍채는 반드시 다시 옵니다. 무사와 망루가 있어야 버팁니다.',
        goals: () => [
          check('무관 짓기', usableOf('dojo').length > 0, { tip: '[무림·방어]에서 무관을 지으면 그곳 일꾼들이 무사가 됩니다.', guide: () => guideBuild('dojo') }),
          check('망루 세우기', usableOf('tower').length > 0, { tip: '북쪽 산길 어귀의 무너진 망루를 다시 짓거나 새로 세우십시오.', guide: () => guideRuin('tower') || guideBuild('tower', northPath(4)) }),
          check('첫 습격 넘기기', flag('raidSurvived') || S.stats.raidsWon + S.stats.raidsLost > 0, { tip: '습격이 오면 무사들이 알아서 싸웁니다. 망루와 목책으로 길목을 지키십시오.' }),
        ],
      },
      steps: [
        {
          id: 'scout', title: '척후의 소식', why: '흑풍채가 다시 산을 내려올 채비를 한답니다.', ack: '채비하겠소', pause: true,
          enter: () => defenseGrant(),
          lines: () => [
            { m: 'worry', t: '영주님, 좋지 않은 소식입니다. 뒷산에 약초를 캐러 갔던 이가, 흑풍채 놈들이 산을 내려올 채비를 하는 걸 보았답니다.' },
            { m: 'stern', t: '한 번 맛을 본 놈들입니다. 이번에는 남은 것까지 다 털어 갈 셈이겠지요. 그 전에 방비를 갖춰야 합니다.' },
            { m: 'calm', t: `${hjp('무관', '武館')}을 지으면 그곳 일꾼들이 무공을 익혀 무사가 됩니다. ${hjp('망루', '望樓')}에는 궁수가 올라 다가오는 적을 쏘지요. ${towerNote()}` },
            ST().granted.scout ? { m: 'smile', t: `무관과 망루에는 재료가 꽤 듭니다. 모자라는 만큼은 소인이 현청을 졸라 받아 두었습니다. (${ST().granted.scout})` } : null,
          ],
        },
        {
          id: 'defense', title: '무관과 망루로 방비하기', why: '무사가 있어야 마을을 지킵니다. 망루의 궁수는 멀리서 적을 쏩니다.',
          enter: () => defenseGrant(),
          lines: () => [
            { m: 'calm', t: `[무림·방어]에서 [무관]을 골라 표시한 자리에 앉히십시오. ${towerNote()}` },
          ],
          goals: () => {
            const dojo = usableOf('dojo').length > 0;
            return [check('무관 짓기', dojo), check('망루 세우기', usableOf('tower').length > 0), check('무관에서 무공을 익힐 사람', dojo && dojoWorkers() > 0)];
          },
          guide: () => {
            if (!nonRuined('dojo').length) return guideBuild('dojo');
            if (!nonRuined('tower').length) return guideRuin('tower', '무너진 망루') || guideBuild('tower', northPath(4));
            const wait = S.buildings.filter(b => (b.type === 'dojo' || b.type === 'tower') && !b.done && !b.ruined);
            if (wait.length) return guideWait(['dojo', 'tower']);
            if (!dojoWorkers()) {
              // 일손이 없으면 벌목장(없으면 채석장·논밭)에서 사람을 빼 무관으로 보낸다
              const src = ['lumber', 'quarry', 'farm'].map(t => usableOf(t).find(b => (b._workers || []).length)).find(Boolean);
              if (!src) return { sub: '무관에서 일할 사람이 없습니다. 새 식구가 오기를 기다리십시오.' };
              // 빈자리가 남아 있으면 [일꾼 −]를 눌러도 아무도 빠지지 않는다 → 지금 일하는 수에 맞춰 둔다
              if (src.want > src._workers.length) src.want = src._workers.length;
              ST().flags.donor = src.id;
              const nm = BDEF[src.type].name, at = bCenter(src);
              // 비어 있는 망루 같은 더 급한 자리가 먼저 사람을 데려간다
              const ahead = slotAhead();
              const then = ahead ? `처음 빠진 사람은 비어 있는 ${BDEF[ahead.type].name}에 먼저 가니, 한 번 더 빼면 무관으로 갑니다.` : '놀게 된 사람이 무관으로 갑니다.';
              if (panelShows(src)) return { sel: '#panel [data-act="want-"]', tag: '일꾼 −', sub: `[일꾼 −]를 눌러 ${nm}의 일손을 하나 빼십시오. ${then}`, focus: at };
              const markers = [{ ...at, text: `${nm}: 일꾼 빼기` }];
              if (UI.tool) return toolDown(`화살표가 가리키는 ${nm}`, markers, at);
              return { markers, focus: at, sub: `일손이 모자랍니다. ${nm}${pp(nm, '을/를')} 눌러 [일꾼 −]로 사람을 빼십시오. ${then}` };
            }
            return null;
          },
        },
        {
          id: 'walls', title: '목책과 성문 알아 두기', why: '길목을 막으면 망루가 쏠 틈을 법니다.', ack: '알겠소',
          lines: () => {
            // 무관으로 사람을 보내느라 줄여 둔 일손은 다시 채우라고 일러 둔다
            const d = getB(ST().flags.donor), dn = d && BDEF[d.type].name;
            return [
              { m: 'smile', t: '방비가 섰습니다. 하나만 더 일러 두지요.' },
              d && usable(d) && d.want < BDEF[d.type].workers ? { m: 'calm', t: `무관으로 보내느라 ${dn}의 일손을 줄여 두었습니다. 새 식구가 오면 ${dn}${pp(dn, '을/를')} 눌러 [일꾼 +]로 다시 채워 주십시오.` } : null,
              { m: 'calm', t: `${hjp('목책', '木柵')}은 적의 발을 묶고, ${hjp('성문', '城門')}으로는 우리 사람만 지나다닙니다. 놈들이 오는 길목 양옆에 목책을 두르고 길 위에는 성문을 세우면 망루가 쏠 틈을 법니다. 목책은 길 위에는 못 세우지만 끌어서 길게 세울 수 있지요.` },
              { m: 'stern', t: '자, 이제 놈들이 오는지 지켜봅시다.' },
            ];
          },
          guide: () => {
            const p = northPath(7);
            const g = UI.cat !== 'martial'
              ? { sel: '#build-tabs button[data-cat="martial"]', tag: '무림·방어' }
              : { sel: '.bitem[data-key="wall"]', tag: '목책' };
            return Object.assign(g, { markers: [{ x: p.x, y: p.y, text: '흑풍채가 올 길' }], sub: '목책과 성문은 [무림·방어]에 있습니다. 길 위에는 성문만 세울 수 있습니다. 다 들으셨으면 [알겠소]를 누르십시오.' });
          },
        },
        {
          id: 'raid', title: '흑풍채의 습격 막아내기', why: '이 싸움에 마을의 앞날이 걸렸습니다.',
          enter: () => M.triggerRaid(),
          lines: () => {
            const st = ST();
            if (st.raid === 'coming' || st.raid === 'active') return raidComingLines();
            return null;
          },
          goals: () => {
            const r = ST().raid;
            return [
              check('습격 경보에 답하기', r !== 'none' && r !== 'warned'),
              check('습격을 넘기기', r === 'won' || r === 'lost' || r === 'tribute'),
            ];
          },
          done: () => { const r = ST().raid; return r === 'won' || r === 'lost' || r === 'tribute'; },
          guide: () => {
            const p = northPath(7);
            if (S.raid) return { sel: '#banner [data-act="goto-enemy"]', sub: '무사들이 알아서 싸웁니다. [적 위치로]를 눌러 싸움을 지켜보십시오.' };
            return { markers: [{ x: p.x, y: p.y, text: '흑풍채가 올 길' }], focus: p, sub: '놈들이 오기 전에 길목 양옆에 목책을, 길 위에 성문을 세우거나, 무관의 일꾼을 가득 채워 두십시오.' };
          },
        },
      ],
      // 짜인 습격이 제 몫(전리품·위로)을 치렀으면 따로 주지 않는다 (건너뛰었거나 습격을 겪은 뒤 안내를 받은 경우에는 준다)
      reward: () => (ST().raidPaid ? {} : { silver: 80, weapons: 5 }),
      rewardWhy: '현청의 포상',
      end: () => (ST().raidPaid
        ? []
        : [{ m: 'smile', t: '첫 고비를 넘겼습니다. 현청이 포상으로 은자 80냥과 병장기를 보내왔습니다.' }]),
    },
    {
      title: '마을의 기틀', seal: '基',
      steps: [{
        id: 'base', title: '촌을 마을로 키우기', why: '사람이 열다섯이 되면 촌이 마을이 되고, 시장과 객잔을 세울 수 있습니다.',
        lines: () => [
          { m: 'smile', t: `제3장, 마을의 기틀입니다. 사람이 열다섯이 되면 ${hjp('촌', '村')}이 ${hjp('마을', '里')}이 되고, ${hjp('시장', '市')}과 ${hjp('객잔', '客棧')}을 세울 수 있습니다. 장이 서면 은자가 돌고 민심도 오르지요.` },
          { m: 'calm', t: '[마을 현황]을 한번 열어 보십시오. 민심을 움직이는 까닭이 낱낱이 적혀 있고, 세율도 거기서 정합니다.' },
          { m: 'calm', t: '이제부터는 영주님 뜻대로 다스리시면 됩니다. 소인은 곁에서 형편을 살피다가 때맞춰 아뢰겠습니다.' },
        ],
        goals: () => [
          check('마을 현황 살펴보기', flag('sheet_village'), { tip: '[마을 현황]을 열면 민심을 움직이는 까닭과 세율이 있습니다.', guide: () => ({ sel: '#btn-village', tag: '마을 현황' }) }),
          goal(`인구 15 · ${rankName(1)}`, S.rank >= 1 ? Math.max(15, popCount()) : popCount(), 15, { tip: '빈 집, 넉넉한 식량, 민심 42 이상. 셋이 갖춰지면 사람이 찾아옵니다. 초가를 더 지으십시오.', guide: () => guideBuild('house') }),
          check('시장이나 객잔 열기', usableOf('market').length + usableOf('inn').length > 0, { tip: '마을이 되면 [상업]에서 시장과 객잔을 지을 수 있습니다.', guide: () => guideBuild('market') }),
        ],
        guide: () => {
          if (!flag('sheet_village')) return { sel: '#btn-village', tag: '마을 현황', sub: '[마을 현황]을 열어 민심을 움직이는 까닭을 살펴보십시오.' };
          if (S.rank < 1) {
            const free = housingTotal() - popCount();
            const g = free <= 1 ? guideBuild('house') : {};
            g.sub = `사람이 오려면 빈 집, 넉넉한 식량, 민심 42 이상이 필요합니다. 지금 빈 자리 ${Math.max(0, free)}칸, 민심 ${Math.round(S.happy)}.${free <= 1 ? ' 초가를 더 지으십시오.' : ''}`;
            return g;
          }
          if (!nonRuined('market').length && !nonRuined('inn').length) return guideBuild('market');
          const wait = S.buildings.filter(b => (b.type === 'market' || b.type === 'inn') && !b.done && !b.ruined);
          return wait.length ? guideWait(['market']) : null;
        },
      }],
      reward: () => ({ silver: 150, fame: 10 }),
      rewardWhy: '현청의 축하금',
      end: () => [{ m: 'smile', t: '촌이 어엿한 마을이 되었습니다. 현청이 축하금으로 은자 150냥을 보내왔고, 강호에도 이름이 조금씩 오르내립니다.' }],
    },
    {
      // 제4장: 갈림길. 장이 열리면 총관이 말하고 갈림길 두루마리(events.js crossroads)를 펼친다 (§8.1)
      title: '갈림길', seal: '岐', open: () => M.openCross(),
      steps: [{
        id: 'crossroads', title: '걸어갈 길 정하기', why: '어느 깃발 아래 서느냐에 따라 마을의 앞날과 결말이 갈립니다.',
        goals: () => [
          check('천하도 펼쳐 보기', flag('sheet_worldmap'), { tip: '[천하도]를 열면 이웃 세력의 자리와 힘, 강호의 전쟁이 한눈에 보입니다.', guide: () => wmGuide() }),
          check('세력 살펴보기', flag('sheet_factions'), { tip: '[세력]을 열면 이웃마다 관계와 위협, 할 수 있는 외교가 보입니다.', guide: () => ({ sel: '#btn-factions', tag: '세력', sub: '[세력]을 열어 이웃 세력들을 살펴보십시오.' }) }),
          goal(`인구 35 · ${rankName(2)}`, S.rank >= 2 ? Math.max(35, popCount()) : popCount(), 35, { tip: '집을 늘리고 민심을 지키십시오. 기와집은 여덟 식구가 삽니다.' }),
          check(routeOk() ? `길 정하기 · ${ROUTES[route()].name}의 길` : '길 정하기', routeOk(), { tip: '갈림길 두루마리에서 깃발 하나를 고르거나 홀로 서십시오. 다시 보시려면 [총관]을 부르십시오.', guide: () => crossGuide() }),
        ],
        guide: () => {
          const g = M.info().goals.find(x => !x.done && x.guide);
          if (g) return g.guide();
          return { sub: '집을 늘리고 민심을 지키며 사람을 모으십시오. 인구 35면 읍이 됩니다.' };
        },
      }],
      reward: () => ({ silver: 250, stone: 80, fame: 15 }),
      rewardWhy: '읍 승격 축하',
      end: () => {
        const R = ROUTES[route()] || ROUTES.free;
        return [{ m: 'smile', t: `${hjp('읍', '邑')}이 되었고, 걸어갈 길도 정해졌습니다. 이제 표국과 석벽을 세울 수 있습니다. 현청이 은자 250냥과 석재 80을 보내왔습니다.` },
          { m: 'calm', t: `여기서부터는 ${R.name}의 길입니다. 이 길에 맞는 건물도 이제 지을 수 있지요.` }];
      },
    },
  ];
  const CH_N = 6;   // 장은 여섯. 제5·6장(i ≥ 4)은 ROUTES 에서 온다

  // 갈림길 목표의 짚어 주기
  function wmGuide() {
    const b = byId('btn-worldmap');
    if (b && b.getClientRects().length) return { sel: '#btn-worldmap', tag: '천하도', sub: '[천하도]를 열어 천하의 판도와 이웃 세력의 자리를 살펴보십시오.' };
    // 폰: [세력] 창이 열려 있으면 그 맨 위의 [천하도 펼치기]를 짚는다
    const m = UI.sheet === 'factions' && document.querySelector('#sheet .fx-mapbtn');
    if (m && m.getClientRects().length) return { sel: '#sheet .fx-mapbtn', tag: '천하도', sub: '[천하도 펼치기]를 눌러 천하의 판도를 살펴보십시오.' };
    return { sel: '#btn-factions', tag: '세력', sub: '[세력] 창 맨 위의 [천하도 펼치기]를 눌러 천하의 판도를 살펴보십시오.' };
  }
  function crossGuide() {
    if (crossPending()) return { sub: '갈림길 두루마리가 곧 펼쳐집니다.' };
    if (offerPending()) return { sub: '고른 세력의 사자가 찾아오면 받아들이십시오. 선납 은자 100냥이 듭니다.' };
    return { sel: '#btn-story', tag: '총관', sub: '[총관]을 불러 갈림길 두루마리를 다시 펼치십시오.' };
  }

  // ── 여덟 갈래의 제5·6장 (§8.2) ──────────────────
  // 모든 갈래의 제5장에는 진(인구 70), 제6장에는 현성(인구 120)이 들어가고, 그 위에 갈래의 목표가 얹힌다.
  // 장의 기록(st.cg: 장이 열린 날·해낸 의뢰·현상금·교역)과 절정(st.cx: 전쟁·대습격·무림대회·흑풍채)은 S.story 에 둔다
  const gRank = r => goal(`인구 ${RANKS[r].minPop} · ${rankName(r)}`, S.rank >= r ? Math.max(RANKS[r].minPop, popCount()) : popCount(), RANKS[r].minPop,
    { tip: r >= 4 ? '기와집으로 집 칸을 늘리고 일자리와 민심을 지키십시오. 인구 120이면 현성입니다.' : '기와집으로 집 칸을 늘리고, 시장·정자·사당으로 민심을 북돋우십시오.' });
  const gBuild = type => check(`${BDEF[type].name} 짓기`, usableOf(type).length > 0, { tip: BDEF[type].desc, guide: () => guideBuild(type) });
  const factionsGuide = sub => ({ sel: '#btn-factions', tag: '세력', sub });
  // 이 장이 열린 뒤 해낸 의뢰 (st.cg.q 와 S.jh.qlog 를 함께 본다)
  function questsDone(pred) {
    const cg = (ST() && ST().cg) || {}, seen = new Set();
    let n = 0;
    for (const q of cg.q || []) if (!seen.has(q.id) && pred(q.c, q.k)) { seen.add(q.id); n++; }
    for (const q of (jhOn() ? S.jh.qlog : [])) {
      if (!q.ok || !(q.done >= (cg.day || 0)) || seen.has(q.id) || !FACTIONS[q.fid] || !pred(JH.campOf(q.fid), q.kind)) continue;
      seen.add(q.id); n++;
    }
    return n;
  }
  const gQuests = (label, n, pred, what) => goal(label, questsDone(pred), n,
    { tip: `[세력] 창의 [의뢰]에 붙은 ${what}에 무사나 객경을 보내 해내십시오. 의뢰는 거의 날마다 새로 붙습니다.`, guide: () => factionsGuide(`[세력] 창의 [의뢰]에서 ${what}${pp(what, '을/를')} 골라 무사를 보내십시오.`) });
  const gFame = n => goal('명성', S.fame, n, { tip: '습격 격퇴, 의뢰, 객잔, 사당, 무림대회가 명성을 올립니다.' });
  // 현상금: 이 장에서 건 수 (JH 소식 'bounty' 를 센다)
  const gBounty = n => goal('현상금 걸기', (ST().cg || {}).b || 0, n,
    { tip: '흑도·사파·마교 이웃의 카드에서 [현상금]을 거십시오. 은자 120냥, 관부나 금의위와 관계 20 이상이어야 합니다.', guide: () => factionsGuide('흑풍채 같은 흑도·사파·마교 이웃의 카드에서 [현상금]을 거십시오.') });
  const gHappy = n => goal('민심', S.happy, n, { tip: '세금을 낮추고, 상소를 들어주고, 사당·정자·잔치로 민심을 북돋우십시오.', guide: () => ({ sel: '#btn-village', tag: '마을 현황', sub: '[마을 현황]에서 민심을 깎는 까닭을 살피십시오.' }) });
  const gMarriage = () => check('세가와 혼담 맺기', marriageDone(), { tip: '세가에서 혼담이 오면 받아들이십시오(예단 은자 60). 소인이 여드레마다 다리를 놓겠습니다.' });
  const gHeroes = n => goal('객경', heroCount(), n, { tip: '객잔에 머무는 떠돌이 고수를 모시거나, 세가가 보내는 무인과 혼행을 따라온 무인을 객경으로 두십시오.' });
  function gRelAll(min) {
    const ns = jhOn() ? S.jh.near.filter(id => JH.isAlive(id) && !FACTIONS[id].noLord) : [];
    const low = ns.filter(id => rel(id) < min);
    const m = String(min).replace('-', '−');
    return goal(`관계 ${m} 이상인 이웃`, ns.length - low.length, ns.length, {
      tip: '사이가 나쁜 이웃에게 예물이나 사신을 보내십시오. 산채(흑풍채)는 치지 않습니다.',
      guide: () => factionsGuide(low.length ? `${low.map(fN).join('·')}에 예물이나 사신을 보내 관계를 ${m} 위로 올리십시오.` : '이웃과의 관계를 지키십시오.'),
    });
  }
  // 이 장에서 교역 협정을 맺은 새외 세력 (지금 맺고 있는 것도 친다)
  function saeoeTrades() {
    const cg = ST().cg;
    if (!cg || !jhOn()) return 0;
    cg.t = cg.t || [];
    for (const id in S.jh.trade) if (S.jh.trade[id] > dayOf() && JH.campOf(id) === 'saeoe' && !cg.t.includes(id)) cg.t.push(id);
    return cg.t.length;
  }
  const gTrades = n => goal('새외 세력과 교역 협정', saeoeTrades(), n,
    { tip: '빙설궁·금륜사·야수궁·해랑도 같은 새외 세력과 [교역]을 맺으십시오. 이웃이 아니어도 되지만 관계가 20 이상이어야 합니다.', guide: () => factionsGuide('[세력] 창의 먼 세력 목록에서 새외무림 세력과 [교역]을 맺으십시오. 관계가 모자라면 예물·사신부터.') });
  // 절정 (제6장)
  const cxOf = () => (ST() && ST().cx) || {};
  function gWar() {
    const cx = cxOf();
    const A = cx.wa && FACTIONS[cx.wa] ? fN(cx.wa) : '우리 편';
    return check(`${cx.wn || '짜인 전쟁'} 이기기`, cx.ws === 'won', {
      tip: `[세력] 창에서 ${A}에 전쟁 지원(은자·식량·병장기)을 보내거나 원군 의뢰에 무사를 보내 전황을 기울이십시오. 지더라도 열흘 뒤 다시 붙습니다.`,
      guide: () => factionsGuide(cx.ws === 'lost' ? `싸움에 졌습니다. ${Math.max(0, (cx.wAt || 0) - dayOf())}일 뒤 다시 붙으니 그때까지 은자와 식량을 모아 두십시오.` : `${A}의 카드에서 [전쟁 지원]으로 은자·식량·병장기를 보내십시오. 원군 의뢰도 전황을 기울입니다.`),
    });
  }
  function raidGuide() {
    const cx = cxOf(), k = cx.rf;
    if (!k || !FACTIONS[k] || cx.rs === 'wait') return { sub: `대습격이 ${cx.rAt > dayOf() ? `${cx.rAt - dayOf()}일쯤 뒤에` : '곧'} 옵니다. 무관과 망루를 늘리고, 놈들이 올 길목에 목책과 성문을 세우십시오.` };
    const ex = World.exits[JH.exitFor(k)[0]];
    return { markers: ex ? [{ x: ex.x + 0.5, y: ex.y + 0.5, text: `${fN(k)}${pp(fN(k), '이/가')} 올 길` }] : [], focus: ex ? { x: ex.x + 0.5, y: ex.y + 0.5 } : null, sub: `${fN(k)}${pp(fN(k), '이/가')} 쳐들어옵니다. 길목 양옆에 목책을, 길 위에 성문을 세우고 무사를 채워 두십시오.` };
  }
  const gRaid = label => check(label, cxOf().rs === 'won', { tip: '짜인 대습격을 막아 내십시오. 지거나 은자로 물리면 며칠 뒤 다시 옵니다.', guide: raidGuide });
  const gRaids2 = () => goal('최후통첩 격퇴', cxOf().rw || 0, 2, { tip: '가장 센 이웃 둘이 차례로 최후통첩을 보내고 쳐들어옵니다. 둘 다 막아 내십시오.', guide: raidGuide });
  const gTourney = () => check('무림대회 우승', !!cxOf().tw, { tip: '여드레마다 열리는 무림대회에 무공이 가장 높은 이를 내보내십시오. 객경과 연무대가 힘이 됩니다.',
    guide: () => ({ sub: `다음 무림대회는 ${Math.max(0, (cxOf().tAt || 0) - dayOf())}일 뒤입니다. 무관에서 무사를 단련하고 고수를 객경으로 모셔 두십시오.` }) });
  const gHeuk = label => check(label, cxOf().hs === 2, { tip: '흑풍채의 일은 총관이 때맞춰 아뢰겠습니다.',
    guide: () => (route() === 'gwan' ? factionsGuide('[세력] 창의 [의뢰]에서 「흑풍채 토벌령」에 무사를 보내십시오.') : { sel: '#btn-story', tag: '총관', sub: '[총관]을 불러 흑풍채의 일을 물으십시오.' }) });

  // 갈래 하나의 장 (지금 CH 의 장과 같은 모양). 단계 id 는 갈래마다 다르다 (st.acks 가 id 로 기억한다)
  function rch(key, n, o) {
    return {
      title: o.title, seal: o.seal, route: key,
      open: () => (n === 5 ? M.openRoute5() : M.openRoute6()),
      steps: [{
        id: `${key}${n}`, title: o.step, why: o.why,
        goals: () => [gRank(n === 5 ? 3 : 4), ...o.goals()],
        // 안내 중에는 할 일 두루마리에 글만 두고, [힌트]를 누르면 짚을 곳까지 비춘다
        guide: force => {
          const g = M.info().goals.find(x => !x.done && x.guide);
          if (!g) { const t = M.info().goals.find(x => !x.done); return t && t.tip ? { sub: t.tip } : null; }
          const r = g.guide() || {};
          return force ? r : { sub: r.sub, markers: r.markers };
        },
      }],
      lines: o.lines, reward: () => o.reward || {}, rewardWhy: o.rewardWhy || '강호의 예물', end: o.end || (() => []),
    };
  }
  // 대표 세력 이름 (주군 → 이웃 → 가까운 세력). 없으면 계열 이름
  const repName = c => { const id = campRep(c); return id ? fN(id) : CAMPS[c].name; };
  // 짜인 전쟁의 두 편: 「A와 B가」
  const warPair = () => { const cx = cxOf(); return cx.wa && cx.wb && FACTIONS[cx.wa] && FACTIONS[cx.wb] ? [fN(cx.wa), fN(cx.wb)] : null; };
  function warLine(lead) {
    const p = warPair();
    if (!p) return null;
    return { m: 'stern', t: `${lead || ''}${p[0]}${pp(p[0], '과/와')} ${p[1]}${pp(p[1], '이/가')} 마침내 칼을 맞댔습니다. 이 싸움의 이름은 「${cxOf().wn}」. 전장은 마을 코앞입니다.` };
  }
  // 절정에서 실제로 붙은 전쟁의 이름 (맞수에 따라 정마대전이 정사대전이 되기도 한다)
  const warNm = def => cxOf().wn || def;
  const ROUTES = {
    jeong: {
      name: '정파', seal: '正', foes: ['ma', 'sa', 'heuk'], title: '협의의 보루',
      war: { name: '정마대전', goal: true, only: 'ma' }, raid: ['ma'],
      ch5: rch('jeong', 5, {
        title: '무림맹의 깃발', seal: '旗', step: '무림맹의 깃발 세우기', why: '정파의 맹우가 되려면 마을이 크고, 협객이 모일 집이 있고, 맹의 일을 거들어야 합니다.',
        goals: () => [gBuild('hall_jeong'), gQuests('정파의 의뢰 해내기', 3, c => c === 'jeong', '정파 세력의 의뢰')],
        lines: () => [
          { m: 'smile', t: `제5장, 무림맹의 깃발입니다. ${repName('jeong')}에서 ${hjp('무림맹', '武林盟')}의 소집 격문을 보내왔습니다. 정파의 이름 아래 마을을 세우라는 것이지요.` },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 협객들이 모일 의협당을 세우시고, 정파 세력의 의뢰 셋을 해내십시오. 의뢰는 [세력] 창의 [의뢰]에 붙습니다.` },
        ],
        reward: { silver: 400, fame: 20 }, rewardWhy: '무림맹의 하사금',
        end: () => [{ m: 'smile', t: '무림맹의 깃발이 마을 어귀에 올랐습니다. 맹에서 하사금으로 은자 400냥을 보내왔습니다.' }],
      }),
      ch6: rch('jeong', 6, {
        title: '정마대전', seal: '戰', step: '마교와 결판 내기', why: '전장에서 이기고, 마을로 쳐들어오는 마교를 막아 내야 정파의 보루가 됩니다.',
        goals: () => [gWar(), gRaid('마교의 대습격 격퇴')],
        lines: () => [
          { m: 'stern', t: '제6장, 정마대전입니다. 정파와 그 숙적들이 끝내 정면으로 부딪쳤습니다.' }, warLine(),
          { m: 'calm', t: '[세력] 창에서 우리 편에 은자·식량·병장기를 보태시거나 원군 의뢰에 무사를 보내 전황을 기울이십시오. 지더라도 끝은 아닙니다. 열흘 뒤 다시 싸움이 붙습니다.' },
          { m: 'worry', t: '마교는 전장에서만 싸우지 않을 겁니다. 며칠 안에 이 마을로도 대습격이 옵니다. 현성(인구 120)을 이루며 방비를 단단히 하십시오.' },
        ],
      }),
      heuk: { lines: ['흑풍채주가 무기를 내려놓고 영주관 문 앞에 꿇어앉았습니다. 정파 협객들의 설득에 마음을 돌렸답니다. 흑풍채는 오늘로 흩어집니다.'], news: '흑풍채가 정파 협객들의 설득에 무기를 내려놓고 흩어졌다.' },
      ending: () => [
        { m: 'smile', t: `${warNm('정마대전')}의 먼지가 가라앉았습니다. 강호는 이제 ${vn()}${pp(S.name, '을/를')} 정파의 보루라 부릅니다.` },
        { m: 'calm', t: '협의를 지키는 일은 칼을 뽑는 일보다 오래 걸립니다. 소인은 장부를 덮지 않겠습니다.' },
      ],
      vtext: () => `${vn()}의 문루에 무림맹의 깃발이 높이 올랐다. ${warNm('정마대전')}에서 이기고 마교의 대습격을 물리친 이 마을을 강호는 <em>협의의 보루</em>라 부른다.\n\n의를 구하는 협객들이 천하 곳곳에서 이 마을을 찾아온다.`,
    },
    ma: {
      name: '마교', seal: '魔', foes: ['jeong', 'gwan', 'sega'], title: '붉은 달의 성',
      war: { name: '천마강림', goal: true, only: 'jeong' }, raid: ['jeong', 'gwan'],
      ch5: rch('ma', 5, {
        title: '붉은 달 아래', seal: '月', step: '붉은 달 아래 서기', why: '교의 그늘에 들었으니, 교가 바라는 것을 바쳐야 합니다.',
        goals: () => [gBuild('altar_ma'), gQuests('마교의 의뢰 해내기', 3, c => c === 'ma', '마교 세력의 의뢰')],
        lines: () => [
          { m: 'worry', t: `제5장, 붉은 달 아래입니다. ${repName('ma')}의 사자가 붉은 비단에 싼 교령을 두고 갔습니다.` },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 혈제단을 세우시고, 교의 의뢰 셋을 해내십시오. 피 냄새 나는 일이 섞여 있을 겁니다.` },
        ],
        reward: { silver: 400 }, rewardWhy: '교의 하사금',
        end: () => [{ m: 'calm', t: '붉은 달이 마을 위에 떴습니다. 교에서 은자 400냥을 보내왔습니다. 받는 손이 무겁군요.' }],
      }),
      ch6: rch('ma', 6, {
        title: '천마강림', seal: '魔', step: '천마의 강림 맞이하기', why: '정파와 관의 토벌을 이겨 내고 전장에서 이겨야 교가 마을을 성으로 인정합니다.',
        goals: () => [gRaid('정파·관 연합 토벌대 격퇴'), gWar()],
        lines: () => [
          { m: 'stern', t: '제6장, 천마강림입니다. 교가 이 싸움에 마을의 이름을 걸었습니다.' }, warLine(),
          { m: 'worry', t: '정파와 관이 손을 잡고 토벌대를 꾸린다는 소문입니다. 며칠 안에 이 마을로 옵니다. 막아 내시고, 전장에서도 이기셔야 합니다.' },
        ],
      }),
      heuk: { lines: ['흑풍채 산채에서 밤새 북소리가 났습니다. 교의 사자들이 흑풍채를 제물로 바쳤다 합니다. 뒷산은 이제 조용합니다.'], news: '흑풍채가 마교의 제물이 되어 사라졌다.' },
      ending: () => [
        { m: 'calm', t: `붉은 달이 ${vn()} 위에 걸렸습니다. 정파도 관도 이제 이 성문 앞에서 말을 돌립니다.` },
        { m: 'worry', t: '두려움으로 지키는 성은 두려움이 걷히면 무너집니다. 소인은 그날이 오지 않게 장부를 지키겠습니다.' },
      ],
      vtext: () => `토벌대의 깃발이 진흙에 처박혔다. ${vn()}의 성루 위로 붉은 달이 떠오른다. 강호는 이 마을을 <em>붉은 달의 성</em>이라 부르며 이름만 들어도 길을 돌아간다.`,
    },
    sega: {
      name: '무림세가', seal: '家', foes: ['ma', 'heuk'], title: '천하명가',
      war: { name: '세가 수호전', goal: false }, raid: ['ma', 'heuk'],
      ch5: rch('sega', 5, {
        title: '혼맹', seal: '婚', step: '혼맥으로 맺어지기', why: '세가는 피와 혼맥으로 묶인 집안만 믿습니다.',
        goals: () => [gBuild('ancestral'), gMarriage(), gHeroes(2)],
        lines: () => [
          { m: 'smile', t: `제5장, ${hjp('혼맹', '婚盟')}입니다. 세가의 사람들은 칼보다 족보를 먼저 봅니다. ${repName('sega')}에서 혼담을 넣겠다는 귀띔이 왔습니다.` },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 위패를 모실 종가를 세우시고, 혼담이 오면 받아들이십시오. 가문의 무인 둘쯤은 객경으로 모셔 두셔야 세가의 체면이 섭니다.` },
        ],
        reward: { silver: 400, fame: 20 }, rewardWhy: '세가의 예물',
        end: () => [{ m: 'smile', t: '혼맥이 맺어지고 종가에 향이 오릅니다. 세가에서 예물로 은자 400냥을 보내왔습니다.' }],
      }),
      ch6: rch('sega', 6, {
        title: '가문의 이름', seal: '名', step: '가문의 이름 떨치기', why: '세가의 이름은 무림대회의 단상과 지켜 낸 성문에서 납니다.',
        goals: () => [gTourney(), gRaid('마교·흑도의 세가 습격 격퇴')],
        lines: () => [
          { m: 'smile', t: '제6장, 가문의 이름입니다. 세가의 이름은 무림대회의 단상에서 납니다. 여드레마다 대회가 열리니 무공이 가장 높은 이를 내보내십시오.' }, warLine('그사이 '),
          { m: 'stern', t: '세가를 미워하는 마교와 흑도가 이 마을을 노린다는 소문입니다. 습격을 막아 내셔야 합니다.' },
        ],
      }),
      heuk: { lines: ['세가의 무사들이 뒷산을 훑었습니다. 흑풍채는 하룻밤 새 흩어졌고, 산채에는 깃발 하나 남지 않았습니다.'], news: '세가의 무사들이 흑풍채를 소탕했다.' },
      ending: () => [
        { m: 'smile', t: `무림대회의 단상에 ${vn()}의 이름이 걸렸습니다. 이제 세가의 족보마다 이 마을이 적힙니다.` },
        { m: 'calm', t: '이름은 대를 물려 지키는 것이지요. 소인은 다음 대의 장부까지 챙기겠습니다.' },
      ],
      vtext: () => `무림대회의 우승기가 종가 대청에 걸렸다. 혼맥으로 이어진 세가들이 다투어 사람을 보낸다. 강호는 ${vn()}${pp(S.name, '을/를')} <em>천하명가</em>의 터라 부른다.`,
    },
    heuk: {
      name: '흑도', seal: '黑', foes: ['gwan', 'jeong'], title: '밤의 왕',
      war: { name: '밤의 전쟁', goal: false }, raid: ['gwan'],
      ch5: rch('heuk', 5, {
        title: '밤의 장부', seal: '夜', step: '밤의 장부 채우기', why: '흑도에서는 장부가 곧 힘입니다.',
        goals: () => [gBuild('blackmarket'), gQuests('밀수 의뢰 해내기', 3, (c, k) => k === 'smuggle', '밀수 의뢰')],
        lines: () => [
          { m: 'calm', t: `제5장, 밤의 장부입니다. ${repName('heuk')}의 장부꾼이 마을 이름을 장부 맨 앞장에 올렸답니다.` },
          { m: 'stern', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 밤에만 서는 흑시를 여시고, 밀수 의뢰 셋을 해내십시오. 관의 눈은… 소인이 못 본 척하겠습니다.` },
        ],
        reward: { silver: 500 }, rewardWhy: '밤의 몫',
        end: () => [{ m: 'calm', t: '장부의 숫자가 두꺼워졌습니다. 밤의 몫으로 은자 500냥이 들어왔습니다. 어디서 왔는지는 묻지 않는 게 좋겠지요.' }],
      }),
      ch6: rch('heuk', 6, {
        title: '하룻밤의 왕', seal: '王', step: '밤의 왕좌에 오르기', why: '관의 토벌을 이겨 내고 뒷산의 산채까지 거두어야 밤의 왕입니다.',
        goals: () => [gRaid('관의 토벌 격퇴'), gHeuk('흑풍채 거두기')],
        lines: () => [
          { m: 'stern', t: '제6장, 하룻밤의 왕입니다. 관이 이 마을을 도적 소굴로 지목했습니다. 며칠 안에 관병이 토벌을 옵니다.' }, warLine('강호에서도 '),
          { m: 'calm', t: '토벌을 막아 내시고, 뒷산의 흑풍채를 거두어 수하로 삼으십시오. 밤의 왕에게 산채 하나쯤은 있어야지요.' },
        ],
      }),
      heuk: { absorb: true },
      ending: () => [
        { m: 'calm', t: `관병의 깃발이 물러갔습니다. 밤이 되면 강호의 장부는 모두 ${vn()}에서 맞춰집니다.` },
        { m: 'stern', t: '밤의 왕좌는 낮에 무너지는 법입니다. 소인은 장부 두 권을 다 지키겠습니다.' },
      ],
      vtext: () => `관의 토벌대가 빈손으로 돌아갔다. 흑풍채마저 무릎을 꿇은 뒤, 해가 지면 강호의 모든 검은 돈이 ${vn()}${pp(S.name, '으로/로')} 흐른다. 사람들은 이 마을의 영주를 <em>밤의 왕</em>이라 부른다.`,
    },
    sa: {
      name: '사파', seal: '邪', foes: ['jeong', 'gwan'], title: '사파의 맹주',
      war: { name: '정사대전', goal: true, only: 'jeong' }, raid: ['jeong', 'gwan'],
      ch5: rch('sa', 5, {
        title: '강 나루의 주인', seal: '渡', step: '나루의 주인 되기', why: '사파는 길목과 돈줄을 쥔 자를 따릅니다.',
        goals: () => [gBuild('gambling'), gQuests('사파의 의뢰 해내기', 3, c => c === 'sa', '사파 세력의 의뢰')],
        lines: () => [
          { m: 'calm', t: `제5장, 강 나루의 주인입니다. ${repName('sa')}에서 이 마을 나루의 몫을 나누자는 전갈이 왔습니다.` },
          { m: 'stern', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 투전판이 도는 도박장을 여시고, 사파의 의뢰 셋을 해내십시오. 은자가 돌면 사람도 따라옵니다.` },
        ],
        reward: { silver: 500 }, rewardWhy: '방회의 몫',
        end: () => [{ m: 'calm', t: '나루의 뱃사공들이 이제 영주님께 먼저 고개를 숙입니다. 방회의 몫으로 은자 500냥이 들어왔습니다.' }],
      }),
      ch6: rch('sa', 6, {
        title: '사파 회맹', seal: '盟', step: '사파 회맹의 맹주 되기', why: '정파의 토벌을 이겨 내고 정사대전에서 이겨야 회맹이 마을 앞에 머리를 숙입니다.',
        goals: () => [gRaid('정파 토벌대 격퇴'), gWar()],
        lines: () => [
          { m: 'stern', t: '제6장, 사파 회맹입니다. 사파의 방회들이 이 마을에서 회맹을 열자고 합니다. 맹주 자리는 이기는 자의 것입니다.' }, warLine(),
          { m: 'worry', t: '정파가 토벌대를 꾸려 이 마을로 온다는 소문입니다. 막아 내시고, 정사대전에서도 이기셔야 합니다.' },
        ],
      }),
      heuk: { lines: ['흑풍채주가 사파 회맹에 불려 가 무릎을 꿇었습니다. 흑풍채는 회맹의 말단으로 흩어졌습니다.'], news: '흑풍채가 사파 회맹에 머리를 숙이고 흩어졌다.' },
      ending: () => [
        { m: 'calm', t: `회맹의 술잔이 돌았습니다. 사파의 방회들이 ${vn()}의 영주를 맹주로 받들었습니다.` },
        { m: 'stern', t: '이익으로 모인 맹은 이익으로 흩어집니다. 소인은 장부의 이익부터 지키겠습니다.' },
      ],
      vtext: () => `${warNm('정사대전')}${pp(warNm('정사대전'), '이/가')} 끝나고 사파의 방회들이 ${vn()}에서 회맹을 열었다. 맹주의 자리에 앉은 것은 이 마을의 영주였다. 강호는 그를 <em>사파의 맹주</em>라 부른다.`,
    },
    saeoe: {
      name: '새외무림', seal: '外', foes: ['gwan', 'jeong'], title: '새외의 관문',
      war: { name: '관문 전쟁', goal: false }, raid: ['gwan'],
      ch5: rch('saeoe', 5, {
        title: '변경의 시장', seal: '市', step: '변경의 시장 열기', why: '새외의 무인들은 말과 인삼을 사고팔 곳을 찾습니다.',
        goals: () => [gBuild('horsemarket'), gQuests('새외의 의뢰 해내기', 3, c => c === 'saeoe', '새외무림 세력의 의뢰')],
        lines: () => [
          { m: 'calm', t: `제5장, 변경의 시장입니다. ${repName('saeoe')}의 무인들이 말 떼를 몰고 마을 어귀까지 왔습니다.` },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 말과 인삼을 바꾸는 호시를 여시고, 새외 세력의 의뢰 셋을 해내십시오.` },
        ],
        reward: { silver: 400 }, rewardWhy: '새외 상인들의 예물',
        end: () => [{ m: 'smile', t: '호시에 말 울음이 그치지 않습니다. 새외 상인들이 예물로 은자 400냥을 두고 갔습니다.' }],
      }),
      ch6: rch('saeoe', 6, {
        title: '관문을 열다', seal: '關', step: '관문 열기', why: '관의 토벌을 이겨 내고 새외와 길을 터야 마을이 관문이 됩니다.',
        goals: () => [gRaid('관의 토벌 격퇴'), gTrades(2)],
        lines: () => [
          { m: 'stern', t: '제6장, 관문을 열다입니다. 관이 이 마을을 오랑캐와 내통한 곳으로 지목했습니다. 토벌이 옵니다.' }, warLine('변경에서도 '),
          { m: 'calm', t: '토벌을 막아 내시고, 새외 세력 둘과 교역 협정을 맺어 길을 트십시오. 그러면 이 마을이 중원과 새외를 잇는 관문이 됩니다.' },
        ],
      }),
      heuk: { lines: ['새외의 무인들이 말을 몰아 뒷산을 휩쓸었습니다. 흑풍채는 산채를 버리고 달아났습니다.'], news: '새외 무인들이 흑풍채를 뒷산에서 쫓아냈다.' },
      ending: () => [
        { m: 'smile', t: `관문이 열렸습니다. 중원의 비단과 새외의 말이 모두 ${vn()}${pp(S.name, '을/를')} 지나갑니다.` },
        { m: 'calm', t: '문은 열어 두기보다 지키기가 어렵습니다. 소인이 문지기 노릇까지 하겠습니다.' },
      ],
      vtext: () => `관의 토벌을 이겨 낸 ${vn()}에 새외의 대상들이 줄을 잇는다. 중원과 새외를 잇는 길은 이제 이 마을을 지난다. 사람들은 이곳을 <em>새외의 관문</em>이라 부른다.`,
    },
    gwan: {
      name: '관', seal: '官', foes: ['heuk', 'sa', 'ma'], title: '황명의 현성',
      war: { name: '토벌전', goal: true }, raid: null,
      ch5: rch('gwan', 5, {
        title: '현령의 인장', seal: '印', step: '현령의 인장 받기', why: '관의 인장은 법과 민심 위에 찍힙니다.',
        goals: () => [gBuild('yamen'), gBounty(2), gHappy(60)],
        lines: () => [
          { m: 'calm', t: `제5장, 현령의 인장입니다. ${repName('gwan')}에서 이 마을을 고을의 본보기로 삼겠다는 공문이 왔습니다.` },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 관아를 세우시고, 흑도·사파·마교 이웃에 현상금을 두 번 거시고, 민심을 60 위로 지키십시오.` },
        ],
        reward: { silver: 400 }, rewardWhy: '현청의 포상',
        end: () => [{ m: 'smile', t: '현령의 인장이 내려왔습니다. 현청에서 포상으로 은자 400냥을 보내왔습니다.' }],
      }),
      ch6: rch('gwan', 6, {
        title: '토벌령', seal: '討', step: '토벌령 받들기', why: '황명을 받든 토벌전에서 이기고 뒷산의 화근을 뿌리 뽑아야 합니다.',
        goals: () => [gWar(), gHeuk('흑풍채 멸문')],
        lines: () => [
          { m: 'stern', t: '제6장, 토벌령입니다. 황명이 내려왔습니다. 이 마을이 관의 전진 기지가 됩니다.' }, warLine(),
          { m: 'calm', t: '토벌전에서 이기시고, 며칠 뒤 내려올 흑풍채 토벌령을 받들어 뒷산의 화근을 뿌리 뽑으십시오.' },
        ],
      }),
      heuk: { hunt: true },
      ending: () => [
        { m: 'smile', t: `황명의 깃발이 ${vn()}의 성문에 걸렸습니다. 이 고을에서는 이제 산적도 사파도 발을 붙이지 못합니다.` },
        { m: 'calm', t: '법은 세우기보다 지키기가 어렵습니다. 소인이 장부와 법전을 함께 지키겠습니다.' },
      ],
      vtext: () => `${warNm('토벌전')}${pp(warNm('토벌전'), '이/가')} 끝나고 뒷산의 흑풍채마저 뿌리 뽑혔다. 황제의 이름으로 세운 법이 ${vn()}의 성문에 걸린다. 사람들은 이곳을 <em>황명의 현성</em>이라 부른다.`,
    },
    free: {
      name: '독립', seal: '獨', foes: [], title: '천하제일촌',
      war: null, raid: 'top2',
      ch5: rch('free', 5, {
        title: '누구의 깃발도 아니다', seal: '獨', step: '홀로 서는 이름 얻기', why: '누구의 산하도 아닌 마을은 이름과 칼로 스스로를 지켜야 합니다.',
        goals: () => [gFame(200), gBuild('stage'), gRelAll(-30)],
        lines: () => [
          { m: 'smile', t: '제5장, 누구의 깃발도 아니다. 이 마을은 어느 문파의 산하도 아닙니다. 그만큼 이름으로 버텨야 하지요.' },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}으로 키우시고, 명성 200을 떨치시고, 누구나 올라 겨루는 연무대를 세우시고, 이웃 누구와도 원수가 되지 마십시오. 관계 −30 아래인 이웃이 없어야 합니다.` },
        ],
        reward: { silver: 400 }, rewardWhy: '강호의 예물',
        end: () => [{ m: 'smile', t: `${hjp('진', '鎭')}이 되었습니다. 어느 문파에도 기대지 않은 마을에 강호의 상단들이 예물로 은자 400냥을 보내왔습니다.` }],
      }),
      ch6: rch('free', 6, {
        title: '천하제일촌', seal: '天', step: '천하제일촌 이루기', why: '홀로 선 마을을 가장 센 이웃 둘이 시험합니다. 그 시험을 넘으면 천하제일촌입니다.',
        goals: () => [gFame(400), gRaids2()],
        lines: () => {
          const ids = (cxOf().rk || []).filter(id => FACTIONS[id]).map(fN);
          return [
            { m: 'calm', t: `제6장, ${hjp('천하제일촌', '天下第一村')}입니다. 마지막 고개지요. 인구 120의 ${hjp('현성', '縣城')}, 그리고 명성 400.` },
            { m: 'stern', t: `${ids.length >= 2 ? `${ids[0]}${pp(ids[0], '과/와')} ${ids[1]}에서` : ids.length ? `${ids[0]}에서` : '가장 센 이웃들이'} 최후통첩을 보내왔습니다. 산하에 들든지 칼을 받든지 하라는 겁니다. 둘 다 막아 내시면 강호가 이 마을을 천하제일촌이라 부를 겁니다.` },
          ];
        },
      }),
      heuk: { lines: ['흑풍채주가 연무대에 올라 마을 무사와 겨루었다가 무릎을 꿇었습니다. 약속대로 산채를 허물고 떠났습니다.'], news: '흑풍채주가 연무대 비무에서 지고 산채를 허물었다.' },
      ending: () => [
        { m: 'smile', t: `영주님… 해내셨습니다. 부임하시던 날 잿더미뿐이던 ${vn()}${pp(S.name, '이/가')} 누구의 깃발도 없이 천하제일촌이 되었습니다.` },
        { m: 'calm', t: '소인은 장부를 덮지 않겠습니다. 천하제일촌은 이루는 것보다 지키는 것이 더 어려운 법이니까요.' },
      ],
      vtext: () => `작은 촌락이었던 ${vn()}${pp(S.name, '이/가')} 이제 현성이 되었다. 어느 문파의 깃발도 들지 않은 채 두 세력의 최후통첩을 이겨 냈다. 정파도 사파도, 관부도 상단도 이 마을의 영주를 함부로 대하지 못한다.\n\n강호의 이야기꾼들은 오늘도 객잔에서 <em>천하제일촌</em>의 이야기를 한다.`,
    },
  };
  // 장 하나: 제1~4장은 CH, 제5·6장(i ≥ 4)은 갈래의 것 (갈래가 없으면 독립)
  function chDef(i) {
    if (i < CH.length) return CH[i];
    const R = ROUTES[route()] || ROUTES.free;
    return i === 4 ? R.ch5 : R.ch6;
  }

  // 무관과 망루를 세울 만큼은 있게 (한 번만)
  function defenseGrant() {
    const need = { silver: 0, wood: 0, stone: 0 };
    if (!nonRuined('dojo').length) for (const k in BDEF.dojo.cost) need[k] += BDEF.dojo.cost[k];
    if (!nonRuined('tower').length) { const r = ruinOf('tower'); const c = r ? repairCost(r) : BDEF.tower.cost; for (const k in c) need[k] = (need[k] || 0) + c[k]; }
    return topUp(need, 'scout', '현청이 방비에 보태라며 보냈다');
  }
  // 망루 형편 (공방이 안내보다 먼저 다시 세우기도 한다)
  function towerNote() {
    const t = nonRuined('tower');
    if (!t.length) return '북쪽 산길 어귀의 무너진 망루는 다시 세우면 됩니다.';
    return t.some(b => b.done) ? '망루는 벌써 하나 다시 섰으니, 궁수만 오르면 됩니다.' : '망루는 벌써 다시 세우는 중이니, 공사가 끝나기만 기다리시면 됩니다.';
  }
  function raidComingLines() {
    return [
      { m: 'stern', t: '종을 쳤습니다! 무사들은 알아서 싸우고, 다른 이들은 집으로 몸을 피할 겁니다.' },
      { m: 'calm', t: '현청에 급히 기별을 넣었으니 포졸 몇이 달려올 겁니다. 놈들이 오기 전에 길목 양옆에 목책을, 길 위에 성문을 세우셔도 좋고, 싸움이 붙으면 위쪽의 [적 위치로]를 눌러 지켜보십시오.' },
    ];
  }

  // ── 때맞춘 조언 (안내가 끝난 뒤) ─────────────────
  // 앞에 있을수록 급한 일. cd = 같은 이야기를 다시 꺼내기까지의 날 수
  const ADVICE = [
    {
      id: 'occupied', cd: 2, when: () => !!S.occupation,
      lines: () => [
        { m: 'worry', t: '영주님… 영주관이 넘어갔습니다. 점령군은 매일 은자와 식량을 거둬 가고, 새 식구도 오지 않을 겁니다.' },
        { m: 'stern', t: '길은 셋입니다. 몸값을 치르거나, 남은 무사를 모아 봉기하거나, 가까운 세력에 구원을 청하는 것. 모두 [세력] 창에서 하실 수 있습니다.' },
      ],
      guide: () => ({ sel: '#btn-factions', tag: '세력' }),
    },
    {
      id: 'raid', cd: 1, when: () => !S.raid && S.scheduled.some(s => s.kind === 'raid'),
      lines: () => {
        const s = S.scheduled.find(x => x.kind === 'raid');
        const F = FACTIONS[s.faction];
        return [
          { m: 'stern', t: `${F.name}${pp(F.name, '이/가')} 다가옵니다. 남은 시간은 ${Math.max(1, Math.ceil(s.at - S.time))}시간 남짓. 지금 무사 ${fighters().length}명, 망루 ${countType('tower')}채가 마을을 지킵니다.` },
          { m: 'calm', t: '망루를 더 세우시고, 놈들이 오는 길목 양옆에 목책을, 길 위에는 성문을 세우십시오. 객잔에 머무는 고수가 있다면 객경으로 모셔 두는 것도 방법입니다.' },
        ];
      },
      guide: () => ({ sel: '#build-tabs button[data-cat="martial"]', tag: '무림·방어' }),
    },
    {
      id: 'food', cd: 3, when: () => popCount() > 0 && S.res.food < popCount() * 4,
      lines: () => [
        { m: 'worry', t: `곳간의 식량이 ${foodDays() < 1 ? '하루 치도' : `${Math.floor(foodDays())}일 치밖에`} 남지 않았습니다. 사람은 ${popCount()}명, 하루에 ${popCount() * 2}섬이 듭니다.` },
        { m: 'calm', t: '논밭이나 어장을 늘리시고, 놀고 있는 손을 논밭으로 보내십시오. 겨울에는 논밭이 거의 쉽니다.' },
      ],
      guide: () => guideBuild('farm'),
    },
    {
      id: 'winter', cd: 6, when: () => seasonIdx() === 2 && dayOf() % DAYS_PER_SEASON >= 4 && S.res.food < popCount() * 2 * 8,
      lines: () => [
        { m: 'calm', t: '가을이 저물어 갑니다. 겨울 열흘 동안은 논밭에서 거의 나지 않으니, 지금 곳간을 채워 두셔야 합니다.' },
        { m: 'calm', t: `지금 식량은 ${fmt(S.res.food)}섬, 겨울을 나려면 ${fmt(popCount() * 2 * 8)}섬쯤은 있어야 합니다. 어장은 겨울에도 제법 납니다. 곳간이 모자라면 창고를 지으십시오.` },
      ],
      guide: () => guideBuild('fishery'),
    },
    {
      id: 'homeless', cd: 2, when: () => homeless() >= 2,
      lines: () => [
        { m: 'worry', t: `집 없이 한데서 자는 사람이 ${homeless()}명입니다. 민심이 깎이고 있습니다.` },
        { m: 'calm', t: '초가를 몇 채 더 지으십시오. 마을이 커지면 초가를 기와집으로 올릴 수도 있습니다.' },
      ],
      guide: () => guideBuild('house'),
    },
    {
      id: 'unrest', cd: 3, when: () => S.happy < 35,
      lines: () => {
        const worst = happinessFactors().filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
        return [
          { m: 'worry', t: `민심이 ${Math.round(S.happy)}까지 떨어졌습니다. 25 아래로 내려가면 사람들이 마을을 등집니다.` },
          { m: 'calm', t: `${worst ? `가장 큰 까닭은 「${worst[0]}」입니다. ` : ''}[마을 현황]에서 하나하나 살펴보시고, 세금을 낮추거나 상소를 들어주시는 것도 방법입니다.` },
        ];
      },
      guide: () => ({ sel: '#btn-village', tag: '마을 현황' }),
    },
    {
      id: 'petitions', cd: 2, when: () => pendingPetitions() >= 3,
      lines: () => [
        { m: 'calm', t: `상소가 ${pendingPetitions()}건이나 쌓였습니다. 오래 묵히면 백성의 원망도 함께 쌓입니다.` },
        { m: 'smile', t: '[상소함]을 열어 처리해 주십시오. 다 들어줄 수는 없어도, 듣는 시늉은 하셔야지요.' },
      ],
      guide: () => ({ sel: '#btn-petitions', tag: '상소함' }),
    },
    {
      id: 'nodojo', cd: 4, when: () => dayOf() >= 6 && !nonRuined('dojo').length,
      lines: () => [
        { m: 'stern', t: '아직 무관이 없습니다. 지금 이 마을을 지킬 칼은 부엌칼뿐입니다.' },
        { m: 'calm', t: '[무림·방어]에서 무관을 지으시면 그곳 일꾼들이 무공을 익혀 무사가 됩니다.' },
      ],
      guide: () => guideBuild('dojo'),
    },
    {
      id: 'nowood', cd: 3, when: () => S.res.wood < 1 && popCount() > 0,
      lines: () => [
        { m: 'worry', t: '목재가 바닥났습니다. 짓던 것도 고치던 것도 곧 멈춥니다.' },
        { m: 'calm', t: '숲 가까이 벌목장을 하나 더 지으시거나, 벌목장의 일꾼을 채워 주십시오.' },
      ],
      guide: () => guideBuild('lumber'),
    },
    {
      // 갈림길에서 아직 길을 정하지 않았다 ([더 지켜보겠소] 뒤, 포섭을 사양한 뒤)
      id: 'crossroads', cd: 3, when: () => ST().chapter === 3 && !ST().finished && jhOn() && !routeOk() && !crossPending() && !offerPending() && S.time - ST().stepAt > 24,
      lines: () => [{ m: 'calm', t: `${hjp('갈림길', '岐路')}에서 아직 길을 정하지 않으셨습니다. 마을이 커질수록 강호는 우리가 누구 편인지 묻습니다. 갈림길 두루마리를 다시 펼쳐 드릴까요?` }],
      choices: () => [
        { label: '갈림길을 펼치겠소', sub: '깃발 하나를 고르거나 홀로 선다', run: () => M.queueCross() },
        { label: '조금 더 지켜보겠소', run: () => {} },
      ],
      guide: () => ({ sel: '#btn-story', tag: '총관' }),
    },
    {
      // 갈래의 의뢰가 목표인데 열린 의뢰가 있다
      id: 'rquest', cd: 3, when: () => ST().chapter === 4 && jhOn() && JH.badge() > 0 && !Events.raidPending()
        && M.info().goals.some(g => !g.done && /의뢰/.test(g.label)) && S.villagers.some(v => JH.canSend(v)),
      lines: () => [{ m: 'calm', t: '[세력] 창의 [의뢰]에 새 의뢰가 붙어 있습니다. 이 장의 목표가 걸린 의뢰라면 무사나 객경을 보내 해내십시오. 성공할 가능성은 보낼 사람을 고르면 바로 보입니다.' }],
      guide: () => ({ sel: '#btn-factions', tag: '세력' }),
    },
    {
      id: 'budget', cd: 5, when: () => adminReal() && S.res.silver >= 350 && budgetTotal() <= 0,
      lines: () => [
        { m: 'calm', t: `곳간에 은자 ${fmt(S.res.silver)}냥이 놀고 있습니다. 그런데 육방에는 예산이 한 푼도 없군요.` },
        { m: 'smile', t: '[육방]에서 부서마다 예산을 나눠 주시면 필요한 것을 알아서 짓고 처리합니다. 은자는 굴려야 불어나지요.' },
      ],
      guide: () => ({ sel: '#btn-admin', tag: '육방' }),
    },
  ];

  // ── 무작위 사건 거르기 ──────────────────────────
  // 안내가 아는 사건은 id 로, 모르는 사건은 EV 의 tier 로 거른다 (tier 가 없으면 heavy, docs/jianghu.md §0.1)
  const LIGHT_EVENTS = new Set(['merchant', 'wedding', 'festival', 'refugees', 'harvest', 'injured']);
  const HOSTILE_EVENTS = new Set(['bandit_toll', 'gang_protection', 'protection', 'spy', 'cave', 'inn_brawl', 'tournament', 'tiger', 'fire']);
  const HEAVY_EVENTS = new Set(['plague', 'sect_war', 'conscription', 'hyeolwol_offer', 'cheongun_offer', 'offer']);
  const GLOOMY_EVENTS = new Set(['drought', 'gwanbu_tax']);
  function tierOf(id) {
    if (LIGHT_EVENTS.has(id)) return 'light';
    if (HOSTILE_EVENTS.has(id)) return 'hostile';
    if (HEAVY_EVENTS.has(id)) return 'heavy';
    if (GLOOMY_EVENTS.has(id)) return 'gloomy';
    return (evHas(id) && EV[id].tier) || 'heavy';
  }

  function freshState() {
    return {
      v: 2, chapter: 0, step: 0, skipped: false, intro: 'pending', finished: false,
      flags: {}, acks: {}, rewards: {}, granted: {}, advice: {}, budgets: {},
      raid: 'none', raidDone: false, raidPaid: 0, ruins: [], newLord: false, arrivedAt: 0, stepAt: 0,
      adviceAt: -999, collapsed: false, petitionStub: false, adminStub: false,
      // 갈래: routeOk 굳힌 갈래인가(잠정이 아님) · lord 마지막으로 본 주군 · cross 갈림길을 펼쳤는가 · pend 사자를 보낸 계열
      // cg 이 장의 기록(장이 열린 날·해낸 의뢰·현상금·교역) · cx 절정(제6장) · heukGold 흑풍채를 거두어 날마다 받는 은자
      routeOk: false, lord: null, cross: 0, pend: null, cg: null, cx: null, heukGold: 0,
    };
  }
  // 이야기 상태가 없는 옛 저장: 안내를 건너뛴 것으로 보고 장을 짐작한다
  function legacyState() {
    const st = freshState();
    st.skipped = true; st.intro = 'done'; st.raidDone = true;
    const has = t => S.buildings.some(b => b.type === t && usable(b));
    let ch = 0;
    if (has('farm') && has('lumber') && houseCount(true) >= 2) ch = 1;
    if (ch === 1 && has('dojo') && has('tower') && S.stats.raidsWon + S.stats.raidsLost > 0) ch = 2;
    if (ch === 2 && S.rank >= 1 && (has('market') || has('inn'))) ch = 3;
    if (ch === 3 && S.rank >= 2) ch = 4;
    if (ch === 4 && S.rank >= 3 && S.fame >= 200) ch = 5;
    for (let i = 0; i < ch; i++) st.rewards[i] = 1;
    st.chapter = ch;
    if (S.victory) { st.chapter = CH_N - 1; st.finished = true; }
    return st;
  }

  // ── 총관 얼굴 (먹선에 엷은 채색) ─────────────────
  const FACE_W = 96, FACE_H = 112, FACE_SS = 2;
  function drawFace(c, mood) {
    c.save();
    c.scale(FACE_SS, FACE_SS);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const ink = '#1e1915';
    // 한지 바탕과 노을빛 번짐(霞)
    let g = c.createLinearGradient(0, 0, 0, FACE_H);
    g.addColorStop(0, '#f4ead4'); g.addColorStop(1, '#e2d1ac');
    c.fillStyle = g; c.fillRect(0, 0, FACE_W, FACE_H);
    g = c.createRadialGradient(60, 38, 3, 60, 38, 46);
    g.addColorStop(0, 'rgba(226,120,74,0.45)'); g.addColorStop(0.55, 'rgba(226,142,96,0.16)'); g.addColorStop(1, 'rgba(226,142,96,0)');
    c.fillStyle = g; c.fillRect(0, 0, FACE_W, FACE_H);
    // 먼 산 먹 번짐
    c.fillStyle = 'rgba(64,58,52,0.16)';
    c.beginPath(); c.moveTo(0, 80); c.quadraticCurveTo(9, 62, 18, 72); c.quadraticCurveTo(26, 58, 36, 76); c.lineTo(36, FACE_H); c.lineTo(0, FACE_H); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(62, 76); c.quadraticCurveTo(72, 58, 82, 68); c.quadraticCurveTo(89, 60, 96, 66); c.lineTo(96, FACE_H); c.lineTo(62, FACE_H); c.closePath(); c.fill();
    c.fillStyle = 'rgba(64,58,52,0.1)';
    c.beginPath(); c.moveTo(0, 90); c.quadraticCurveTo(14, 78, 30, 88); c.lineTo(30, FACE_H); c.lineTo(0, FACE_H); c.closePath(); c.fill();

    // 뒷머리 (어깨로 늘어진 머리채)
    c.fillStyle = '#181310';
    c.beginPath(); c.moveTo(35, 44); c.bezierCurveTo(31, 58, 31, 70, 36, 80); c.lineTo(43, 78); c.lineTo(41, 52); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(61, 44); c.bezierCurveTo(65, 58, 65, 70, 60, 80); c.lineTo(53, 78); c.lineTo(55, 52); c.closePath(); c.fill();

    // 관복: 짙은 비취빛 단령
    c.fillStyle = '#2d5a54';
    c.beginPath();
    c.moveTo(2, FACE_H); c.bezierCurveTo(4, 98, 12, 88, 28, 84); c.lineTo(40, 79); c.lineTo(56, 79); c.lineTo(68, 84);
    c.bezierCurveTo(84, 88, 92, 98, 94, FACE_H); c.closePath(); c.fill();
    c.strokeStyle = ink; c.lineWidth = 1.1; c.stroke();
    // 옷주름 먹선
    c.strokeStyle = 'rgba(12,30,28,0.55)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(16, 96); c.quadraticCurveTo(20, 104, 18, FACE_H); c.moveTo(80, 96); c.quadraticCurveTo(76, 104, 78, FACE_H);
    c.moveTo(27, 88); c.quadraticCurveTo(30, 98, 28, FACE_H); c.moveTo(69, 88); c.quadraticCurveTo(66, 98, 68, FACE_H); c.stroke();
    // 어깨 빛
    c.fillStyle = 'rgba(160,210,190,0.18)';
    c.beginPath(); c.moveTo(10, 96); c.quadraticCurveTo(18, 87, 30, 85); c.lineTo(28, 88); c.quadraticCurveTo(18, 91, 12, 99); c.closePath(); c.fill();
    // 흉배(가슴의 수놓은 판)
    c.fillStyle = '#23304a'; c.fillRect(34, 93, 28, 19);
    c.strokeStyle = '#d6aa52'; c.lineWidth = 0.9; c.strokeRect(35.2, 94.2, 25.6, 18);
    c.strokeStyle = '#e8c87a'; c.lineWidth = 0.9;
    c.beginPath(); // 날아오르는 학
    c.moveTo(39, 106); c.quadraticCurveTo(44, 99, 49, 103); c.quadraticCurveTo(53, 98, 58, 99);
    c.moveTo(49, 103); c.quadraticCurveTo(51, 107, 56, 108);
    c.moveTo(41, 110); c.quadraticCurveTo(44, 108, 47, 110); c.quadraticCurveTo(50, 108, 53, 110); c.stroke();
    c.fillStyle = '#c4352b'; c.beginPath(); c.arc(58.4, 98.8, 0.9, 0, Math.PI * 2); c.fill();
    // 둥근 깃과 흰 동정
    c.fillStyle = '#1f423d';
    c.beginPath(); c.moveTo(36, 79.5); c.quadraticCurveTo(48, 96, 60, 79.5); c.lineTo(56.5, 79); c.quadraticCurveTo(48, 90, 39.5, 79); c.closePath(); c.fill();
    c.strokeStyle = '#f6f0e3'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(41.5, 79); c.lineTo(48, 88); c.lineTo(54.5, 79); c.stroke();
    c.strokeStyle = ink; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(36, 79.5); c.quadraticCurveTo(48, 96, 60, 79.5); c.stroke();

    // 목
    c.fillStyle = '#efd4b8';
    c.beginPath(); c.moveTo(43, 64); c.lineTo(43, 79); c.quadraticCurveTo(48, 84, 53, 79); c.lineTo(53, 64); c.closePath(); c.fill();
    c.fillStyle = 'rgba(150,96,66,0.28)'; c.fillRect(43, 64, 10, 5);

    // 얼굴
    c.fillStyle = '#f5dfc8';
    c.beginPath();
    c.moveTo(35.5, 44); c.bezierCurveTo(35, 57, 39.5, 67, 48, 70); c.bezierCurveTo(56.5, 67, 61, 57, 60.5, 44);
    c.bezierCurveTo(60, 33, 36, 33, 35.5, 44); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(70,44,30,0.75)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(35.6, 47); c.bezierCurveTo(35.6, 58, 39.8, 67, 48, 70); c.bezierCurveTo(56.2, 67, 60.4, 58, 60.4, 47); c.stroke();
    // 볼 홍조
    for (const x of [40.5, 55.5]) {
      g = c.createRadialGradient(x, 58.5, 0.5, x, 58.5, 4.6);
      g.addColorStop(0, 'rgba(226,120,110,0.38)'); g.addColorStop(1, 'rgba(226,120,110,0)');
      c.fillStyle = g; c.fillRect(x - 5, 53.5, 10, 10);
    }
    // 귀 (머리카락에 반쯤 가림)
    c.fillStyle = '#efd2b6';
    c.beginPath(); c.ellipse(35.2, 52, 1.8, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(60.8, 52, 1.8, 3.2, 0, 0, Math.PI * 2); c.fill();

    // 앞머리: 가운데 가르마를 탄 검은 머리
    c.fillStyle = '#181310';
    c.beginPath();
    c.moveTo(34.2, 52); c.bezierCurveTo(32.5, 39, 38, 32, 48, 32); c.bezierCurveTo(58, 32, 63.5, 39, 61.8, 52);
    c.bezierCurveTo(60.8, 45, 58, 40.5, 49, 39.6); c.lineTo(48, 41.2); c.lineTo(47, 39.6);
    c.bezierCurveTo(38, 40.5, 35.2, 45, 34.2, 52); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(39, 37); c.quadraticCurveTo(43, 34.5, 46.5, 35); c.moveTo(57, 37); c.quadraticCurveTo(53, 34.5, 49.5, 35); c.stroke();

    // 사모(紗帽): 높은 뒤통수, 낮은 앞턱, 양 날개
    c.fillStyle = '#16120f';
    for (const s of [-1, 1]) { // 날개
      c.save(); c.translate(48 + s * 23, 27.5); c.rotate(s * -0.1);
      c.beginPath(); c.ellipse(0, 0, 10.5, 3.7, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.16)'; c.lineWidth = 0.6;
      c.beginPath(); c.ellipse(0, -0.4, 8.6, 2.4, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      c.restore();
    }
    c.fillRect(30, 26.6, 36, 1.8);
    c.beginPath(); c.ellipse(48, 21.5, 10.5, 9.5, 0, Math.PI, 0); c.lineTo(58.5, 29); c.lineTo(37.5, 29); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(33.5, 38); c.bezierCurveTo(33.5, 28, 38.5, 25.5, 48, 25.5); c.bezierCurveTo(57.5, 25.5, 62.5, 28, 62.5, 38);
    c.quadraticCurveTo(48, 33.6, 33.5, 38); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(40, 15.5); c.quadraticCurveTo(44, 12.4, 49, 12.4); c.moveTo(36.5, 31); c.quadraticCurveTo(41, 27.6, 47, 27.4); c.stroke();
    c.strokeStyle = 'rgba(214,170,82,0.5)'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(34, 36.6); c.quadraticCurveTo(48, 32.4, 62, 36.6); c.stroke();

    // 눈썹·눈·코·입
    const brow = { calm: [0.4, 0], smile: [0.9, -0.5], worry: [-0.2, -1.9], stern: [0.2, 1.6] }[mood] || [0.4, 0];
    c.strokeStyle = '#2a201a'; c.lineWidth = 1.05;
    for (const s of [-1, 1]) {
      const ox = 48 + s * 6.2, inner = 48 + s * 2.2, outer = 48 + s * 10.2;
      c.beginPath();
      c.moveTo(outer, 46.6 - brow[0] * 0.3); c.quadraticCurveTo(ox, 44.4 - brow[0], inner, 45.8 + brow[1]); c.stroke();
    }
    c.lineWidth = 1.15;
    for (const s of [-1, 1]) {
      const cx = 48 + s * 6;
      if (mood === 'smile') {
        c.beginPath(); c.moveTo(cx - 3.4, 51.6); c.quadraticCurveTo(cx, 49, cx + 3.4, 51.6); c.stroke();
        c.strokeStyle = 'rgba(42,32,26,0.35)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(cx - 2.6, 53); c.quadraticCurveTo(cx, 53.8, cx + 2.6, 53); c.stroke();
        c.strokeStyle = '#2a201a'; c.lineWidth = 1.15;
      } else {
        const lid = mood === 'stern' ? 0.6 : mood === 'worry' ? -0.3 : 0;
        c.beginPath(); c.moveTo(cx - 3.8, 51.4 + lid * 0.5); c.quadraticCurveTo(cx, 48.6 + lid, cx + 3.8, 51.6 + lid * 0.5); c.stroke();
        c.fillStyle = '#1b1411';
        c.beginPath(); c.arc(cx + s * -0.3, 51.5, 1.55, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.beginPath(); c.arc(cx + s * -0.3 + 0.5, 50.9, 0.45, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(42,32,26,0.35)'; c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(cx - 2.8, 53.2); c.quadraticCurveTo(cx, 54, cx + 2.8, 53.2); c.stroke();
        c.strokeStyle = '#2a201a'; c.lineWidth = 1.15;
      }
    }
    c.strokeStyle = 'rgba(120,76,52,0.7)'; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(48.4, 54); c.quadraticCurveTo(49.6, 57.4, 47.4, 57.6); c.stroke();
    c.strokeStyle = '#a8382f'; c.fillStyle = '#c1564b'; c.lineWidth = 0.95;
    c.beginPath();
    if (mood === 'smile') { c.moveTo(44.6, 61); c.quadraticCurveTo(48, 64.2, 51.4, 61); c.quadraticCurveTo(48, 62.4, 44.6, 61); c.fill(); c.stroke(); }
    else if (mood === 'worry') { c.moveTo(45.4, 62.4); c.quadraticCurveTo(48, 60.9, 50.6, 62.4); c.stroke(); }
    else if (mood === 'stern') { c.moveTo(45.2, 61.7); c.lineTo(50.8, 61.7); c.stroke(); }
    else { c.moveTo(45.2, 61.4); c.quadraticCurveTo(48, 62.8, 50.8, 61.4); c.stroke(); }
    // 낙관(붉은 도장)
    c.fillStyle = 'rgba(181,51,42,0.85)'; c.fillRect(84, 6, 7, 9);
    c.fillStyle = 'rgba(250,236,220,0.9)'; c.font = '5px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('霞', 87.5, 10.6);
    c.restore();
  }

  // ── 모듈 객체 ─────────────────────────────────
  const M = {
    el: null, cur: null, queue: [], faces: {}, guideNow: null,
    _acc: 0, _sites: {}, _flash: 0, _scrolled: '', _trk: '', _open: false, _checking: false, _face: '', _adviseRaid: false, _broke: null, _reopen: null,

    // ━━ 훅 ━━
    init() { S.story = freshState(); this.reset(); },

    // 기본 마을(영주관·초가 둘·논밭·우물·여덟 사람)을 쓰러져 가는 마을로 꾸민다
    setupNewGame() {
      const st = S.story || (S.story = freshState());
      st.newLord = true; st.arrivedAt = S.time;
      const m = getB(S.manorId);
      if (m) m.hp = Math.round(m.maxHp * 0.45);
      const ruin = b => { if (!b) return; b.ruined = true; b.done = true; b.hp = 0; b.burning = false; st.ruins.push(b.id); };
      for (const b of S.buildings.slice()) if (b.type === 'house' || b.type === 'farm') ruin(b);
      // 북쪽 산길 어귀의 무너진 망루, 영주관 뒤 타 버린 집 한 채
      const np = northPath(3);
      const tw = findSite('tower', { x: np.x + 2, y: np.y });
      if (tw) ruin(placeBuilding('tower', tw.x, tw.y, true));
      if (m) { const hs = findSite('house', { x: m.x - 2, y: m.y - 3 }); if (hs) ruin(placeBuilding('house', hs.x, hs.y, true)); }
      // 남은 사람은 지친 다섯
      if (S.villagers.length > 5) S.villagers.splice(5);
      for (const v of S.villagers) { v.home = 0; v.job = 0; v.hp = Math.max(1, Math.round(v.maxHp * 0.75)); }
      S.res = { silver: 120, food: 64, wood: 40, stone: 20, weapons: 0 };
      S.happy = 38;
      S.factions.heukpung.rel = Math.min(S.factions.heukpung.rel, -40);
      S.factions.heukpung.threat = 10;
      logMsg('흑풍채가 휩쓸고 간 지 열흘. 현청이 보낸 새 영주가 부임했다.', 'war');
      World.terrainDirty = true;
      markDirty();
    },

    onLoad() {
      this.reset();
      if (!S.story || typeof S.story !== 'object') S.story = legacyState();
      else {
        const st = S.story, f = freshState();
        for (const k in f) if (st[k] === undefined || st[k] === null) st[k] = f[k];
        st.chapter = clamp(Math.floor(+st.chapter || 0), 0, CH_N - 1);
        st.step = Math.max(0, Math.floor(+st.step || 0));
        // 제4장부터는 단계가 하나뿐이다 (옛 CH 의 단계 번호가 남아 있어도 장을 건너뛰지 않게)
        if (st.chapter >= 3) st.step = 0;
      }
      this.fixRoute();
    },
    // 불러온 뒤: 주군을 기억하고, 옛 저장이면 갈래를 정하고(§8.3) 지금 장의 차림(갈림길·장 기록·절정)을 갖춘다
    fixRoute() {
      const st = ST();
      if (!st || !jhOn()) return;
      const jh = S.jh;
      st.lord = S.vassal || null;
      if (jh.route && !ROUTES[jh.route]) jh.route = null;
      // 제5장 이후인데 갈래가 없으면 주군 계열로, 주군이 없으면 독립. 갈림길(제4장)에서 주군이 있으면 그 계열로 굳힌다
      if (!jh.route && (st.chapter >= 4 || st.finished || (st.chapter === 3 && S.vassal))) {
        jh.route = S.vassal ? campRoute(JH.campOf(S.vassal)) : 'free';
        st.routeOk = true;
      }
      if (jh.route && (st.chapter >= 4 || st.finished)) st.routeOk = true;
      // 옛 규칙(현성·명성 400)으로 이미 이긴 저장은 끝난 이야기로 둔다
      if (S.victory && !st.finished) { st.finished = true; st.chapter = CH_N - 1; if (!jh.route) { jh.route = 'free'; st.routeOk = true; } }
      if (st.finished || S.victory) {
        if (S.victory && !jh.victory) jh.victory = jh.route || 'free';
        if (S.victory && !S.victoryTitle) S.victoryTitle = (ROUTES[jh.victory] || ROUTES.free).title;
        return;
      }
      if (st.intro !== 'done') return;
      // 옛 저장이라 장의 차림이 없으면 지금 장을 다시 연다 (말은 게임에 들어올 때 꺼낸다)
      let op = null;
      if (st.chapter === 3 && !st.cross && !routeOk()) op = this.openChapter(3);
      else if (st.chapter === 4 && !st.cg) op = this.openChapter(4);
      else if (st.chapter === 5 && (!st.cx || st.cx.r !== jh.route)) op = this.openChapter(5);
      if (op) this._reopen = op;
    },

    onEnterGame(isNew) {
      this.build();
      this.reset();
      if (!S.story) S.story = legacyState();
      const st = S.story;
      this.showAll(true);
      const welcome = { m: 'smile', t: `다시 오셨군요, 영주님. 지금 할 일은 <b>${this.info().title}</b>입니다.` };
      if (st.intro !== 'done') this.intro();
      else if (this.tutorialActive()) {
        // 이어하기(안내 중): 지금 단계의 말을 다시 꺼낸다(부작용 없이)
        const step = this.stepObj();
        const lines = step && step.lines ? (step.lines() || []).filter(Boolean) : [];
        this.say([welcome, ...lines],
          { tag: 'step', pause: !!(step && step.pause), ack: step && step.ack, onAck: step && step.ack ? () => this.ackStep(step.id) : null });
      } else if (!isNew && !st.finished) {
        this.say([welcome], { tag: 'aside', expire: 6 });
      }
      // 옛 저장에서 다시 연 장의 말 (갈림길이면 멈춰서 묻는다)
      const op = this._reopen;
      this._reopen = null;
      if (op && op.lines && op.lines.length && st.intro === 'done') this.say(op.lines, { tag: 'chapter', pause: !!op.pause, ack: op.ack, onAck: op.onAck });
      this._trk = '';
      this.uiTick();
    },

    tick(dtH) {
      const st = ST();
      if (!st) return;
      if (st.raid === 'active' && S.raid) this.tameRaid();
      this._acc += dtH;
      if (this._acc >= 0.1) { this._acc = 0; this.check(); }
    },

    hourly() {
      const st = ST();
      if (!st || st.intro !== 'done') return;
      this.check();
      const step = this.stepObj();
      if (!st.skipped && step && step.id === 'raid') {
        if (st.raid === 'none') this.triggerRaid();
        // 경보 두루마리 없이 습격이 사라졌다면(은자로 달램 등) 넘어간 것으로 본다
        if (st.raid === 'warned' && !Events.raidPending()) this.raidAverted();
      }
      // 안내 중 첫 밤
      if (this.tutorialActive() && isNight() && !st.flags.night) {
        st.flags.night = 1;
        this.say([{ m: 'calm', t: '해가 졌습니다. 밤에는 다들 집에 들어가 쉬니 들일도 공사도 더딥니다. 오른쪽 위 ▶▶ 단추로 밤을 건너뛰셔도 됩니다.' }], { soft: true, tag: 'aside', expire: (30 - hourOf()) % 24 });
      }
      this.advise();
    },

    daily() {
      const st = ST();
      if (!st) return;
      st.day = dayOf();
      // 거둔 흑풍채가 바치는 은자 (흑도의 길)
      if (st.heukGold) addRes('silver', 3);
      if (st.intro === 'done' && !st.finished && jhOn() && st.chapter >= 4) this.routeDaily();
    },

    uiTick() {
      if (!S || !S.story || !this.el) return;
      const st = S.story;
      if (st.intro === 'done') this.check();
      // 때가 지난 곁말·조언은 거둔다
      if (this.cur && this.cur.expireAt && !this.cur.pause && S.time > this.cur.expireAt) this.close(false);
      // 습격 경보 두루마리가 닫히면 바로 방비를 아뢴다
      if (this._adviseRaid && !UI.modalOpen && !this.cur && !this.queue.length) { this._adviseRaid = false; this.advise(true); }
      // 한자 풀이를 읽었는지 (위쪽 장부 단계)
      if (typeof Tips !== 'undefined' && Tips.cur && byId('res').contains(Tips.cur)) setFlag('tip');
      this.guideNow = this.cur && this.cur.guide ? this.cur.guide() : this.currentGuide(false);
      G.markers = (this.guideNow && this.guideNow.markers) || [];
      // 안내 중에 가리킬 곳이 바뀌면 그쪽으로 눈을 돌린다
      const f = this.guideNow && this.guideNow.focus;
      const fk = f ? `${Math.round(f.x)},${Math.round(f.y)}` : '';
      if (fk && fk !== this._focusKey && this.tutorialActive() && !S.raid && !UI.modalOpen) UI.focusOn(f.x, f.y);
      if (fk) this._focusKey = fk;
      // 장 제목: 사건 두루마리나 멈춤 대화가 없을 때
      const blocked = UI.modalOpen || (this.cur && this.cur.pause) || S.eventQueue.length;
      if (this._card && !blocked) { this._card = false; this.chapterCard(); }
      this.renderTracker();
      this.layout();
    },

    isPausing() { return !!(this.cur && this.cur.pause); },

    allowThreat() {
      const st = ST();
      if (!st) return true;
      if (st.skipped || st.intro !== 'done') return st.intro === 'done' && (dayOf() >= 4 || st.chapter >= 2);
      return !!st.raidDone || st.chapter >= 2;
    },

    allowEvent(id) {
      const st = ST();
      if (!st) return true;
      const ch = st.chapter, tier = tierOf(id);
      if (st.intro !== 'done') return false;
      if (st.skipped) {
        const day = dayOf();
        if (tier === 'heavy') return ch >= 3 || day >= 10;
        if (tier === 'hostile') return ch >= 2 || day >= 5;
        return true;
      }
      if (ch === 0) return LIGHT_EVENTS.has(id) && dayOf() >= 1;
      if (ch === 1) return tier === 'light';
      if (ch === 2) return tier !== 'heavy';
      return true;
    },

    happinessFactors() {
      const st = ST();
      if (!st) return [];
      const f = [];
      if (st.newLord) {
        const v = Math.round(10 - (S.time - st.arrivedAt) / 24 * 1.5);
        if (v > 0) f.push(['새 영주에 대한 기대', v]);
      }
      const ruins = (st.ruins || []).filter(id => { const b = getB(id); return b && b.ruined; }).length;
      if (ruins) f.push(['타다 남은 집터', -Math.min(6, ruins * 2)]);
      return f;
    },

    // 메뉴의 [총관]
    openAdvisor() {
      this.build();
      const st = ST();
      if (!st) return;
      if (st.intro !== 'done') { if (!this.cur) this.intro(); return; }
      const info = this.info();
      const choices = [
        { label: '지금 무엇을 하면 되오?', run: () => this.hint() },
        { label: '마을 형편은 어떠하오?', run: () => this.say(this.report(), { tag: 'report', now: true }) },
        { label: '이 마을의 목표가 무엇이었소?', run: () => this.say(goalLines(), { tag: 'report', now: true }) },
      ];
      if (st.skipped && !st.finished && st.chapter <= 1) choices.push({ label: '안내를 받겠소', sub: '지금 장의 처음부터 하나씩 일러 준다', run: () => this.resumeTutorial() });
      // 갈림길: [더 지켜보겠소] 뒤에 다시 펼친다
      if (st.chapter === 3 && !st.finished && !routeOk() && !crossPending() && !offerPending() && jhOn()) {
        choices.unshift({ label: '갈림길을 다시 펼쳐 보겠소', sub: '깃발 하나를 고르거나 홀로 선다', run: () => this.queueCross() });
      }
      // 흑도의 길: 흑풍채를 거둔다
      const cx = st.cx;
      if (st.chapter === 5 && !st.finished && route() === 'heuk' && cx && cx.r === 'heuk' && cx.hs === 0 && dayOf() >= cx.hAt - 3 && JH.isAlive('heukpung')) {
        choices.unshift({ label: '흑풍채를 거두겠소', sub: '은자 100냥 · 날마다 은자 3냥을 바친다', run: () => this.offerAbsorb() });
      }
      choices.push({ label: '물러가 있으시오', run: () => {} });
      this.say([{ m: 'smile', t: `부르셨습니까, 영주님. 지금 할 일은 <b>${info.title}</b>입니다. ${info.why || ''}` }], { tag: 'advisor', now: true, choices });
    },

    // ━━ 공개 함수 ━━
    chapter() { const st = ST(); return st ? st.chapter : 0; },
    stepId() { const s = this.stepObj(); return s ? s.id : null; },

    // 총관이 말한다. lines: 문자열 또는 {m, t} 배열
    // opts: { pause, choices:[{label, sub, run}], ack, onAck, topic, cd(일), soft, now, tag, guide, expire(시간) }
    //  · topic: 같은 주제는 cd일 안에 다시 말하지 않고, 다른 말이 떠 있으면 건너뛴다 (조언용)
    //  · soft: 다른 말이 떠 있으면 건너뛴다 · now: 떠 있는 가벼운 말을 밀어낸다 · pause: 시간을 멈춘다
    say(lines, opts = {}) {
      if (!S) return false;
      this.build();
      if (!Array.isArray(lines)) lines = [lines];
      lines = lines.filter(Boolean).map(l => (typeof l === 'string' ? { t: l } : l)).filter(l => l.t);
      if (!lines.length) return false;
      const st = ST();
      if (opts.topic) {
        if (this.cur || this.queue.length) return false;
        if (st) {
          const last = st.advice[opts.topic];
          const cdH = (opts.cd !== undefined ? opts.cd : 2) * 24;
          if (last !== undefined && S.time - last < cdH) return false;
          st.advice[opts.topic] = S.time;
        }
      }
      if (opts.soft && (this.cur || this.queue.length)) return false;
      const d = {
        lines, i: 0, pause: !!opts.pause, choices: opts.choices || null, ack: opts.ack || null,
        onAck: opts.onAck || null, onClose: opts.onClose || null, guide: opts.guide || null,
        tag: opts.tag || (opts.topic ? 'advice' : 'say'),
        expireAt: opts.expire ? S.time + opts.expire : 0,   // 게임 시간이 지나면 저절로 거둔다
      };
      if (d.tag === 'step') {
        this.queue = this.queue.filter(q => q.tag !== 'step');
        if (this.cur && !this.cur.pause && (this.cur.tag === 'step' || this.cur.tag === 'hint' || this.cur.tag === 'aside')) this.cur = null;
      }
      if (this.cur && !this.cur.pause && (opts.now || d.pause)) {
        if (this.cur.tag === 'step' && d.tag !== 'step') this.queue.unshift(this.cur);
        this.cur = null;
      }
      if (this.cur) { this.queue.push(d); return true; }
      this.open(d);
      return true;
    },

    // 할 일 두루마리의 [힌트]: 지금 할 일을 다시 짚고 그곳을 비춘다
    hint() {
      const st = ST();
      if (!st) return;
      if (st.intro !== 'done') { if (!this.cur) this.intro(); return; }
      const info = this.info();
      const g = this.currentGuide(true);
      const f = g && (g.focus || (g.markers && g.markers[0]));
      if (f) UI.focusOn(f.x, f.y);
      this._flash = performance.now() + 4000;
      const lines = [{ m: 'calm', t: `지금 할 일은 <b>${info.title}</b>입니다. ${info.why || ''}` }];
      const left = info.goals.filter(x => !x.done);
      if (g && g.sub) lines.push({ m: 'calm', t: g.sub });
      else if (left.length && left[0].tip) lines.push({ m: 'calm', t: left[0].tip });
      const step = this.stepObj();
      const ack = !st.skipped && step && step.ack && !st.acks[step.id] ? step.ack : null;
      this.say(lines, { tag: 'hint', now: true, guide: (st.skipped || st.chapter >= 4) && g ? () => this.currentGuide(true) : null, ack, onAck: ack ? () => this.ackStep(step.id) : null });
    },

    info() {
      const st = ST();
      if (!st) return { title: '', why: '', goals: [] };
      if (st.finished) { const T = (ROUTES[route()] || ROUTES.free).title; return { title: `「${T}」${pp(T, '을/를')} 지키기`, why: '이룬 것을 지키는 일만 남았습니다. 마음껏 다스리십시오.', goals: [] }; }
      if (st.intro !== 'done') return { title: '총관의 말 듣기', why: '새로 부임한 마을의 형편부터 들어 보십시오.', goals: [] };
      const ch = chDef(st.chapter);
      if (st.skipped && ch.skip) return { title: ch.skip.title, why: ch.skip.why, goals: ch.skip.goals() };
      const step = this.stepObj();
      if (!step) return { title: ch.title, why: '', goals: [] };
      return {
        title: step.title, why: step.why, goals: step.goals ? step.goals() : [],
        ack: !st.skipped && step.ack && !st.acks[step.id] ? step.ack : null, step,
      };
    },

    // ━━ 진행 ━━
    tutorialActive() { const st = ST(); return !!st && !st.skipped && st.intro === 'done' && st.chapter <= 1 && !st.finished; },
    stepObj() {
      const st = ST();
      if (!st) return null;
      const ch = chDef(st.chapter);
      return ch ? ch.steps[Math.min(st.step, ch.steps.length - 1)] : null;
    },
    stepDone(step) {
      const st = ST();
      if (st.acks[step.id]) return true;
      if (step.done) return step.done();
      const gs = step.goals ? step.goals() : [];
      return gs.length > 0 && gs.every(x => x.done);
    },
    check() {
      const st = ST();
      if (!st || st.intro !== 'done' || st.finished || this._checking) return;
      this._checking = true;
      for (let guard = 0; guard < 8; guard++) {
        if (st.finished) break;
        const ch = chDef(st.chapter);
        if (!ch) break;
        if (st.skipped && ch.skip) {
          if (ch.skip.goals().every(x => x.done)) { this.finishChapter(); continue; }
          break;
        }
        const step = ch.steps[st.step];
        if (!step) { this.finishChapter(); continue; }
        if (this.stepDone(step)) { this.nextStep(); continue; }
        break;
      }
      this._checking = false;
    },
    ackStep(id) {
      const st = ST();
      if (!st) return;
      st.acks[id] = 1;
      this.check();
    },
    nextStep() {
      const st = ST();
      st.step++;
      const ch = chDef(st.chapter);
      if (st.step >= ch.steps.length) { this.finishChapter(); return; }
      this.enterStep();
    },
    enterStep(prefix) {
      const st = ST();
      const step = this.stepObj();
      st.stepAt = S.time;
      this._sites = {};
      this._scrolled = '';
      this.fold();
      // 지난 단계의 말은 거둔다
      this.queue = this.queue.filter(q => q.tag !== 'step');
      if (this.cur && this.cur.tag === 'step' && !this.cur.pause) this.showNext();
      if (!step) return;
      if (!st.skipped && step.enter) step.enter();
      Bus.emit('storyStep', st.chapter, st.step);
      if (st.skipped) return;
      // 폰에서는 선택 창이 지도를 덮으니 단계가 바뀌면 닫는다
      if (phone() && UI.sel) UI.select(null);
      // 지도 위를 가리키는 단계면 그곳으로 눈을 돌린다
      const g = step.guide ? step.guide() : null;
      if (g && g.focus && !S.raid) { UI.focusOn(g.focus.x, g.focus.y); this._focusKey = `${Math.round(g.focus.x)},${Math.round(g.focus.y)}`; }
      const lines = [...(prefix || []), ...((step.lines && step.lines()) || [])].filter(Boolean);
      if (lines.length) this.say(lines, { tag: 'step', pause: !!step.pause, ack: step.ack, onAck: step.ack ? () => this.ackStep(step.id) : null });
    },
    finishChapter() {
      const st = ST();
      const i = st.chapter, ch = chDef(i);
      if (!st.rewards[i]) {
        st.rewards[i] = 1;
        const r = ch.reward ? ch.reward() : {};
        grant(r, ch.rewardWhy || '보상');
      }
      logMsg(`제${i + 1}장 「${ch.title}」${pp(ch.title, '을/를')} 마쳤다.`, 'good');
      const end = ch.end ? ch.end() : [];
      if (i + 1 >= CH_N) {
        // 마지막 장: 갈래의 칭호와 결말 (§8.2)
        st.finished = true;
        const R = ROUTES[route()] || ROUTES.free;
        this.victory();
        this.say(end.concat(R.ending()), { tag: 'chapter' });
        Bus.emit('storyStep', st.chapter, st.step);
        return;
      }
      st.chapter = i + 1;
      st.step = 0;
      // 다음 장의 차림 (갈림길 두루마리, 갈래의 기록과 절정). 그 말은 지난 장의 끝말에 잇는다
      const op = this.openChapter(st.chapter);
      const lines = end.concat((op && op.lines) || []);
      if (lines.length) this.say(lines, { tag: 'chapter', pause: (!st.skipped && i <= 1) || !!(op && op.pause), ack: op && op.ack, onAck: op && op.onAck });
      this._card = true;   // 장 제목은 두루마리·멈춤 대화가 닫힌 뒤에 띄운다
      this.enterStep();
    },
    begin(skip) {
      const st = ST();
      st.intro = 'done';
      st.skipped = !!skip;
      st.chapter = 0; st.step = 0;
      if (skip) {
        hook(Admin, 'recommend');
        S.factions.heukpung.threat = Math.max(S.factions.heukpung.threat, 35);
        this.say([{ m: 'smile', t: `영주님 솜씨를 믿겠습니다. 장(${hj('章')})마다 이룰 일만 할 일 두루마리에 적어 두고, 육방에는 소인이 알아서 예산을 나눠 두겠습니다. 막히시면 언제든 [총관]을 불러 주십시오.` }], { tag: 'say' });
        Bus.emit('storyStep', 0, 0);
      } else {
        this.enterStep([{ m: 'smile', t: '현명하십니다. 할 일은 화면 위쪽의 할 일 두루마리에 늘 적어 두겠습니다. 막히시면 두루마리의 [힌트]를 누르십시오.' }]);
      }
      this._card = true;
      this._trk = '';
      this.check();
    },
    resumeTutorial() {
      const st = ST();
      st.skipped = false; st.step = 0; st.acks = {};
      // 이미 습격을 겪었다면 짜인 습격은 건너뛴다
      if (S.stats.raidsWon + S.stats.raidsLost > 0 && st.raid === 'none') { st.raid = S.stats.raidsWon ? 'won' : 'lost'; st.raidDone = true; }
      this.enterStep([{ m: 'smile', t: '그럼 차근차근 짚어 드리지요.' }]);
      this._trk = '';
      this.check();
    },
    intro() {
      this.say(introLines(), {
        pause: true, tag: 'intro',
        choices: [
          { label: '안내를 받겠소', sub: '총관이 할 일을 하나씩 짚어 준다', run: () => this.begin(false) },
          { label: '혼자 다스리겠소', sub: '안내를 건너뛴다. 장마다 목표만 알려 준다', run: () => this.begin(true) },
        ],
      });
    },

    // ━━ 짜인 습격 (제2장) ━━
    triggerRaid() {
      const st = ST();
      if (st.raid !== 'none' || S.occupation || S.raid) return;
      if (Events.raidWarning('heukpung', 1, { size: 5, goal: 'loot', delay: 4, exitIdx: 2 })) {
        st.raid = 'warned';
        logMsg('흑풍채가 산을 내려온다는 척후의 보고가 들어왔다.', 'war');
      }
    },
    raidAverted() {
      const st = ST();
      st.raid = 'tribute'; st.raidDone = true;
      st.raidPaid = 1;   // 짜인 습격을 은자로 매듭지었으니 제2장 포상은 없다
      this.say([
        { m: 'calm', t: '은자로 피를 막으셨군요. 나쁜 선택은 아닙니다. 사람이 상하지 않았으니까요.' },
        { m: 'stern', t: '다만 한번 맛을 들인 놈들은 다시 옵니다. 그때까지 무관의 무사들을 단단히 길러 두십시오.' },
      ], { tag: 'result', pause: true });
      this.check();
    },
    // 첫 습격은 흑풍채주 대신 부두목이 이끈다 (조금 수월하게)
    tameRaid() {
      for (const e of S.enemies) {
        if (e.stx || e.faction !== 'heukpung' || e.dead) continue;
        e.stx = 1;
        if (e.leader) {
          e.maxHp = Math.round(e.maxHp * 0.45); e.hp = Math.min(e.hp, e.maxHp); e.atk *= 0.65;
          e.title = `흑풍채 부두목 ${String(e.title || '').split(' ').pop() || e.name}`;
        } else { e.maxHp = Math.round(e.maxHp * 0.75); e.hp = Math.min(e.hp, e.maxHp); e.atk *= 0.8; }
      }
    },

    // ━━ 조언 ━━
    advise(force) {
      const st = ST();
      if (!st || st.intro !== 'done' || this.cur || this.queue.length) return;
      if (UI.modalOpen) return;
      const tut = this.tutorialActive();
      if (!force && S.time - st.adviceAt < 6) return;
      for (const a of ADVICE) {
        if (tut && a.id !== 'occupied') continue;
        if (!a.when()) continue;
        if (this.say(a.lines(), { topic: a.id, cd: a.cd, guide: a.guide, expire: 12, choices: a.choices ? a.choices() : null })) { st.adviceAt = S.time; return; }
      }
    },
    report() {
      const pop = popCount(), house = housingTotal(), days = foodDays();
      const worst = happinessFactors().filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
      const pend = pendingPetitions();
      const threats = FACTION_ORDER.filter(k => FACTIONS[k].military && S.vassal !== k && (!jhOn() || JH.isNear(k)) && (k === 'heukpung' || rel(k) < -20))
        .map(k => [k, Math.round(S.factions[k].threat)]).sort((a, b) => b[1] - a[1]);
      const lines = [];
      lines.push({ m: 'calm', t: `사람 ${pop}명에 집 ${house}칸, ${house > pop ? `빈 자리가 ${house - pop}칸 있습니다` : '빈 집이 없습니다'}. 곳간의 식량은 ${days >= 30 ? '넉넉하고' : `${Math.max(0, Math.floor(days))}일 치이고`}, 은자는 ${fmt(S.res.silver)}냥입니다.` });
      lines.push({ m: S.happy < 40 ? 'worry' : 'calm', t: `민심은 ${Math.round(S.happy)}입니다.${worst ? ` 가장 큰 걱정거리는 「${worst[0]}」(${Math.round(worst[1])})이고요.` : ' 이렇다 할 걱정거리는 없습니다.'}${pend ? ` 상소가 ${pend}건 기다리고 있습니다.` : ''}` });
      if (S.occupation) lines.push({ m: 'worry', t: `마을이 ${FACTIONS[S.occupation.faction].name}에 점령되어 있습니다. [세력] 창에서 되찾을 길을 찾으십시오.` });
      else if (threats.length && threats[0][1] >= 40) {
        const F = FACTIONS[threats[0][0]];
        lines.push({ m: 'stern', t: `${F.name}의 위협이 ${threats[0][1]}%까지 차올랐습니다. 무사 ${fighters().length}명, 망루 ${countType('tower')}채, 무력 ${defensePower()}. 방비를 서두르십시오.` });
      } else lines.push({ m: 'smile', t: `강호는 아직 잠잠합니다. 무력은 ${defensePower()}, 무사 ${fighters().length}명이 마을을 지킵니다.` });
      const next = S.rank + 1 < RANKS.length ? RANKS[S.rank + 1] : null;
      if (next) lines.push({ m: 'calm', t: `인구가 ${next.minPop}명이 되면 ${rankName(S.rank + 1)}${pp(next.name, '으로/로')} 오릅니다. 지금 ${pop}명입니다.` });
      const R = ROUTES[route()];
      if (R) lines.push({ m: 'calm', t: `우리는 ${R.name}의 길${routeOk() ? '' : '(잠정)'}을 걷고 있습니다. ${this.chapterLabel()} 「${chDef(ST().chapter).title}」, 결말은 「${R.title}」입니다.` });
      return lines;
    },

    // ━━ 지을 자리 (단계마다 기억) ━━
    site(type, near) {
      const key = type + (near ? `@${Math.round(near.x)},${Math.round(near.y)}` : '');
      const c = this._sites[key];
      const now = performance.now();
      if (c && c.s && siteValid(type, c.s.x, c.s.y)) return c.s;
      if (c && !c.s && now - c.t < 2000) return null;
      const s = findSite(type, near || (type === 'lumber' ? null : manorCenter()));
      this._sites[key] = { s, t: now };
      return s;
    },
    currentGuide(force) {
      const st = ST();
      if (!st || st.intro !== 'done' || st.finished) return null;
      if (st.skipped) {
        if (!force) return null;
        const g = this.info().goals.find(x => !x.done && x.guide);
        return g ? g.guide() : null;
      }
      const step = this.stepObj();
      return step && step.guide ? step.guide(force) : null;
    },
    chapterLabel() { const st = ST(); return `제${(st ? st.chapter : 0) + 1}장`; },

    // ━━ 갈래 (docs/jianghu.md §8) ━━
    // 강호가 열렸는가 (§0.1): 제4장(index 3) 이상, 또는 안내를 건너뛰고 8일째부터
    allowJianghu() {
      const st = ST();
      if (!st) return true;
      if (st.finished || st.chapter >= 3) return true;
      return st.intro === 'done' && !!st.skipped && dayOf() >= 8;
    },
    // 승리는 이야기가 정한다 (sim.js 의 '현성·명성 400 승리'는 쓰지 않는다)
    ownsVictory() { return true; },
    // 갈림길 카드: 이웃 계열마다 하나 (관 포함, 흑풍채·상단 빼고)
    routeCards() {
      if (!jhOn()) return [];
      const out = [];
      for (const c of CAMP_ORDER) {
        if (c === 'sang' || !ROUTES[c]) continue;
        const fid = campRep(c, true);
        if (!fid) continue;
        const R = ROUTES[c];
        // 이 길의 적: 산하에 들면(번짐 +40 → 관계 0.2 × 계열 감정) 관계가 −20 아래로 떨어질 이웃
        const foes = S.jh.near.filter(id => id !== fid && armed(id) && !FACTIONS[id].noLord && CAMP_ATT[c][JH.campOf(id)] < 0
          && rel(id) + 0.2 * CAMP_ATT[c][JH.campOf(id)] < -20).sort(byPower);
        out.push({ camp: c, fid, perkText: CAMPS[c].perkText, tribute: CAMPS[c].tribute, foes, ch5: R.ch5.title, ch6: R.ch6.title, title: R.title });
      }
      return out;
    },
    // 갈림길에서 고른다: 계열이면 그 세력이 포섭 사자(offer, special)를 보내고, 받아들이면 Bus 'vassal' 로 갈래가 정해진다
    chooseRoute(c) {
      const st = ST();
      if (!st || !jhOn()) return false;
      if (c === 'free') { st.pend = null; this.setRoute('free'); return true; }
      if (!ROUTES[c]) return false;
      if (S.vassal && JH.campOf(S.vassal) === c) { st.pend = null; this.setRoute(campRoute(c)); return true; }
      const fid = campRep(c, true) || campRep(c);
      if (!fid) return false;
      st.pend = c;
      if (evHas('offer')) Events.queue('offer', { k: fid, special: true });
      else this.offerFallback(fid);
      return true;
    },
    routeInfo() {
      const k = route();
      if (!k || !ROUTES[k]) return null;
      const R = ROUTES[k];
      return { key: k, name: R.name, seal: R.seal, title: R.title, foes: foeCamps(k), provisional: !routeOk() };
    },
    // 갈래를 정한다. 제4장(갈림길)부터는 굳힌 갈래, 그 전에는 잠정. 제5장 이후에 바뀌면 갈래 바꾸기 (§8.3)
    setRoute(key, prev) {
      const st = ST(), jh = S.jh, was = jh.route, wasOk = routeOk();
      if (!ROUTES[key]) return;
      if (st.chapter >= 4 && was && was !== key) { this.switchRoute(key, prev); return; }
      jh.route = key;
      st.routeOk = st.chapter >= 3;
      const fresh = was !== key || (st.routeOk && !wasOk);
      if (fresh) { Bus.emit('routeChosen', key); UI.buildMenuDirty = true; }
      if (fresh && st.intro === 'done') this.say(this.routeLines(key), { tag: 'route' });
      this._trk = '';
      this.check();
    },
    routeLines(k) {
      const st = ST(), R = ROUTES[k];
      if (!st.routeOk) return [{ m: 'calm', t: `${R.name}의 깃발 아래 드셨으니 잠정으로는 ${R.name}의 길입니다. 제4장 갈림길에 이르면 이 길을 굳힐지 다시 여쭙겠습니다.` }];
      const lord = S.vassal && JH.campOf(S.vassal) === k ? S.vassal : null;
      const kept = k === 'free' && S.vassal && FACTIONS[S.vassal] && JH.campOf(S.vassal) !== 'sang' ? S.vassal : null;
      return [
        { m: 'smile', t: k === 'free' ? `누구의 깃발도 들지 않고 홀로 서기로 하셨군요. 어려운 길이지만 이름은 오롯이 마을의 것이 됩니다.${kept ? ` ${fN(kept)}의 산하로는 그대로 남아 있으니, 주종을 끊으실지는 [세력] 창에서 정하십시오.` : ''}`
          : `${R.name}의 길로 정하셨군요.${lord ? ` ${fN(lord)}의 깃발이 마을 어귀에 오릅니다.` : ''}` },
        { m: 'calm', t: `제5장은 「${R.ch5.title}」, 제6장은 「${R.ch6.title}」입니다. 끝까지 가시면 이 마을은 「${R.title}」${pp(R.title, '이라/라')} 불릴 겁니다.${S.rank < 2 ? ' 먼저 인구 35의 읍을 이루셔야 다음 장이 열립니다.' : ''}` },
      ];
    },
    // 갈래 바꾸기 (§8.3): 한 번까지. 두 번째부터는 독립이 된다. 그 장의 목표는 새 갈래 것으로 처음부터
    switchRoute(key, prev) {
      const st = ST(), jh = S.jh, old = jh.route;
      const forced = jh.routeSwitches >= 1;
      if (forced) key = 'free';
      if (key === old) return;
      jh.routeSwitches++;
      // 옛 계열에 번짐 Δ −40 (주종을 끊으며 sim.js 가 이미 번졌으면 거른다), 옛 주군의 위협은 60
      const broke = !!(this._broke && this._broke.t === S.time);
      if (CAMPS[old] && !broke) { const rep = campRep(old); if (rep) JH.relSpread(rep, -40); }
      if (prev && JH.isAlive(prev) && S.factions[prev]) S.factions[prev].threat = Math.max(S.factions[prev].threat, 60);
      jh.route = key; st.routeOk = true; st.step = 0;
      Bus.emit('routeChosen', key); UI.buildMenuDirty = true;
      const op = this.openChapter(st.chapter);
      const R = ROUTES[key], ch = chDef(st.chapter);
      const head = forced
        ? { m: 'worry', t: `깃발을 두 번이나 바꾸시니 강호가 더는 이 마을의 맹세를 믿지 않습니다. 이제부터는 누구의 깃발도 아닌, 홀로 서는 길입니다.` }
        : { m: 'stern', t: `${ROUTES[old].name}의 길을 버리고 ${R.name}의 길로 들어서셨습니다. 옛 동지들의 눈빛이 싸늘합니다. 깃발을 또 바꾸시면 아무도 우리를 믿지 않을 겁니다.` };
      this.say([head, { m: 'calm', t: `${this.chapterLabel()} 「${ch.title}」의 할 일도 처음부터입니다.` }, ...((op && op.lines) || [])], { tag: 'route' });
      logMsg(`갈래가 바뀌었다: ${ROUTES[old].name}의 길에서 ${R.name}의 길로.`, 'war');
      this._card = true; this._trk = '';
      Bus.emit('storyStep', st.chapter, st.step);
      this.check();
    },
    // 주군이 바뀌면 갈래도 따라간다 (Bus 'vassal'). becomeVassal 은 옛 주군을 끊을 때 null 을 먼저 보낸다
    onVassal(k) {
      const st = ST();
      if (!st || !jhOn()) return;
      const prev = st.lord || (this._broke && this._broke.t === S.time ? this._broke.id : null);
      st.lord = k || null;
      if (!k) {
        if (prev && !JH.isAlive(prev)) { this._broke = null; this.lordFell(prev); return; }
        this._broke = prev ? { id: prev, t: S.time } : null;
        // 잠정 갈래는 주군을 따라 거둔다 (굳힌 갈래는 주종을 끊어도 남는다)
        if (prev && !st.routeOk && route() === campRoute(JH.campOf(prev))) { S.jh.route = null; UI.buildMenuDirty = true; this._trk = ''; }
        return;
      }
      st.pend = null;
      this.setRoute(campRoute(JH.campOf(k)), prev);
      this._broke = null;
    },
    // 주군이 멸문했다 (§8.3): 거리 400 안의 같은 계열 가운데 가장 센 세력이 갈래를 잇는다. 없으면 독립
    lordFell(prev) {
      const st = ST(), c = JH.campOf(prev), k = route();
      if (!st.routeOk) { if (k === campRoute(c)) { S.jh.route = null; UI.buildMenuDirty = true; } return; }
      if (k !== campRoute(c)) return;
      const heir = FACTION_ORDER.filter(id => id !== prev && JH.isAlive(id) && JH.campOf(id) === c && !FACTIONS[id].noLord && seatGap(id) <= 400).sort(byPower)[0];
      if (heir) {
        this.say([{ m: 'worry', t: `주군 ${fN(prev)}${pp(fN(prev), '이/가')} 무너졌습니다. ${fN(heir)}에서 사람을 보내 ${ROUTES[k].name}의 길을 함께 잇자고 합니다. 그 깃발 아래 서겠습니다.` }], { tag: 'route' });
        becomeVassal(heir);
        return;
      }
      S.jh.route = 'free'; st.step = 0;
      Bus.emit('routeChosen', 'free'); UI.buildMenuDirty = true;
      const op = st.chapter >= 4 ? this.openChapter(st.chapter) : null;
      this.say([{ m: 'worry', t: `주군 ${fN(prev)}${pp(fN(prev), '이/가')} 무너졌는데, 가까이에 그 길을 이을 세력이 없습니다. 이제부터는 홀로 서는 길입니다.` }, ...((op && op.lines) || [])], { tag: 'route' });
      this._card = st.chapter >= 4; this._trk = '';
      this.check();
    },
    // 장이 열릴 때 (안내를 건너뛰었어도): 갈림길 두루마리, 갈래의 장 기록, 절정 → { lines, pause, ack, onAck } | null
    openChapter(i) {
      const ch = chDef(i);
      return ch && ch.open ? ch.open() : null;
    },
    // 갈림길이 열린다: 총관이 멈춰 세우고 말한 뒤 [갈림길을 펼치겠소]로 두루마리를 편다.
    // 대화가 사라져도(불러오기) 두루마리를 잃지 않게 잠시 뒤의 몫도 S.scheduled 에 걸어 둔다 (멈춤 동안에는 시간이 가지 않는다)
    openCross() {
      const st = ST();
      st.cross = 1;
      if (!routeOk() && !crossPending() && evHas('crossroads')) S.scheduled.push({ at: S.time + 0.4, kind: 'event', id: 'crossroads', data: {} });
      return { lines: crossLines(), pause: true, ack: '갈림길을 펼치겠소', onAck: () => this.openCrossNow() };
    },
    openCrossNow() {
      if (routeOk() || !jhOn()) return;
      S.scheduled = S.scheduled.filter(s => !(s.kind === 'event' && s.id === 'crossroads'));
      this.queueCross();
    },
    // 총관 메뉴에서 갈림길을 다시 펼친다 ([더 지켜보겠소] 뒤)
    queueCross() {
      if (!evHas('crossroads')) { this.crossFallback(); return; }
      if (!crossPending()) Events.queue('crossroads');
    },
    // 갈림길 두루마리를 그릴 사건이 없을 때: 총관의 선택지로 묻는다
    crossFallback() {
      const cards = this.routeCards();
      const choices = cards.map(c => ({ label: `${CAMPS[c.camp].name}의 길 · ${fN(c.fid)}`, sub: `결말 「${c.title}」`, run: () => this.chooseRoute(c.camp) }));
      choices.push({ label: '홀로 서겠소', sub: '독립 · 결말 「천하제일촌」', run: () => this.chooseRoute('free') });
      choices.push({ label: '더 지켜보겠소', sub: '총관을 다시 부르면 묻는다', run: () => {} });
      this.say([{ m: 'calm', t: '어느 깃발 아래 서시겠습니까?' }], { tag: 'cross', choices });
    },
    // 포섭 사건이 없을 때: 총관이 사자의 말을 전한다 (선납 은자 100)
    offerFallback(fid) {
      const F = FACTIONS[fid];
      this.say([{ m: 'calm', t: `${F.name}의 사자가 왔습니다. 선납 은자 100냥을 바치면 관계와 상관없이 산하로 받아 주겠답니다. ${F.perk ? `산하가 되면 ${escapeHtml(F.perk)}.` : ''}` }], {
        tag: 'cross', choices: [
          { label: `${F.name}의 산하에 들겠소`, sub: '선납 은자 -100', run: () => { if (S.res.silver < 100) { this.say([{ m: 'worry', t: '은자가 100냥에 못 미칩니다. 곳간이 차면 갈림길을 다시 펼치십시오.' }], { tag: 'cross' }); return; } S.res.silver -= 100; becomeVassal(fid); } },
          { label: '정중히 사양하겠소', run: () => { ST().pend = null; } },
        ],
      });
    },
    openRoute5() {
      const st = ST(), k = route() || 'free', d = dayOf();
      st.cg = { day: d, q: [], b: 0, t: [], mAt: d + 2 };
      return { lines: ROUTES[k].ch5.lines() || [] };
    },
    // 제6장: 장의 기록과 절정(짜인 전쟁은 곧바로, 대습격은 사흘 뒤, 무림대회는 이틀 뒤부터 여드레마다, 흑풍채의 끝은 며칠 뒤)
    openRoute6() {
      const st = ST(), k = route() || 'free', R = ROUTES[k], d = dayOf();
      // 갈래를 바꿔 절정을 다시 열면 옛 갈래의 짜인 전쟁은 승부 없이 거둔다
      const old = st.cx;
      if (old && old.ws === 'on' && JH.warById(old.war)) { old.ws = 'skip'; JH.endWar(old.war, null, 'story'); }
      st.cg = { day: d, q: [], b: 0, t: [] };
      st.cx = {
        r: k, d, war: null, ws: R.war ? 'none' : 'skip', wn: R.war ? R.war.name : '', wa: null, wb: null, wAt: d,
        rs: R.raid ? 'wait' : 'skip', rAt: d + 3, rf: null, rk: k === 'free' ? topNear(2) : [], rb: [], rw: 0,
        tAt: d + 2, tw: false, hs: JH.isAlive('heukpung') ? 0 : 2, hAt: d + (R.heuk.hunt ? 3 : R.heuk.absorb ? 4 : 2), hq: null, side: 'a',
      };
      if (R.war) this.openWar(false);
      return { lines: R.ch6.lines() || [] };
    },
    // 짜인 전쟁: 갈래 계열(주군 → 이웃 → 가까운 세력)과 숙적 계열(이웃 → 가까운 세력)이 맞선다. 전장은 고을 곁
    // 이름은 갈래의 것(정마대전 따위). 맞수가 그 이름의 계열(only)이 아니면 JH 가 짓는다(정사대전·토벌전…)
    openWar(again) {
      const cx = cxOf(), k = route(), R = ROUTES[k];
      if (!R || !R.war || cx.r !== k) return;
      const a = campRep(k), b = a ? foeRep(R.foes, [a]) : null, h = homeSite();
      const name = b && (!R.war.only || JH.campOf(b) === R.war.only) ? R.war.name : undefined;
      const w = a && b ? JH.startWar([a], [b], name, { scripted: true, front: { x: h.x + 34, y: h.y + 22 } }) : null;
      if (!w) {
        // 맞설 세력이 천하에 없다: 전쟁 목표는 이룬 것으로 친다 (갈래가 막히지 않게)
        cx.ws = R.war.goal ? 'won' : 'skip';
        if (again && R.war.goal) this.say([{ m: 'calm', t: `「${R.war.name}」에 맞설 세력이 더는 남아 있지 않습니다. 싸움은 이것으로 끝났습니다.` }], { tag: 'route' });
        return;
      }
      // JH 가 이름을 지으면 편이 뒤바뀔 수 있다: 우리 편(side)을 따로 적어 둔다
      Object.assign(cx, { war: w.id, ws: 'on', wa: a, wb: b, wn: w.name, side: JH.sideOf(w, a) || 'a' });
      if (again) this.say([{ m: 'stern', t: `열흘이 지났습니다. ${fN(a)}${pp(fN(a), '이/가')} 다시 ${fN(b)}${pp(fN(b), '과/와')} 칼을 맞댑니다. 「${w.name}」의 두 번째 판입니다. 이번에는 이겨야 합니다.` }], { tag: 'route' });
    },
    // 짜인 대습격 (독립은 최후통첩 둘을 차례로). 다른 습격이 걸려 있으면 하루 미룬다
    sendRaid() {
      const cx = cxOf(), k = route(), R = ROUTES[k], d = dayOf();
      let foe = null;
      if (k === 'free') {
        cx.rk = cx.rk || []; cx.rb = cx.rb || [];
        foe = cx.rk.find(id => !cx.rb.includes(id) && armed(id)) || null;
        if (!foe) { foe = topNear(1, cx.rk.concat(cx.rb))[0] || null; if (foe) cx.rk.push(foe); }
      } else foe = foeRep(R.raid);
      if (!foe) {
        cx.rs = 'won'; if (k === 'free') cx.rw = 2;
        this.say([{ m: 'calm', t: '마을을 칠 만한 세력이 더는 남아 있지 않습니다. 이 고비는 저절로 넘었습니다.' }], { tag: 'route' });
        this.check();
        return;
      }
      if (Events.raidPending() || S.occupation || S.raid) { cx.rAt = d + 1; return; }
      if (!Events.raidWarning(foe, 1.3, { goal: 'punish', delay: 5 })) { cx.rAt = d + 1; return; }
      cx.rf = foe; cx.rs = 'warned';
      const F = fN(foe);
      this.say([k === 'free'
        ? { m: 'stern', t: `${F}에서 최후통첩이 왔습니다. 「산하에 들든지, 칼을 받든지」. 영주님의 답은 정해져 있겠지요. 척후가 놈들이 몰려온다고 알려 왔습니다.${cx.rw ? ' 두 번째이자 마지막 고비입니다.' : ''}` }
        : { m: 'stern', t: `척후의 전갈입니다! ${F}${pp(F, '이/가')} 대군을 이끌고 이 마을로 옵니다. 이 싸움을 막아 내야 합니다. 지거나 은자로 물리면 며칠 뒤 다시 옵니다.` }], { tag: 'route' });
    },
    // 대습격의 결과 (Bus 'raidEnd')
    climaxRaidEnd(result) {
      const cx = cxOf(), d = dayOf(), F = cx.rf && FACTIONS[cx.rf] ? fN(cx.rf) : '적';
      if (result === 'win') {
        if (route() === 'free') {
          cx.rb = cx.rb || [];
          if (!cx.rb.includes(cx.rf)) cx.rb.push(cx.rf);
          cx.rw = Math.min(2, cx.rb.length);
          cx.rs = cx.rw >= 2 ? 'won' : 'wait'; cx.rAt = d + 4;
          this.say([{ m: 'smile', t: cx.rw >= 2 ? `${F}마저 물러갔습니다! 두 최후통첩을 모두 이겨 냈습니다. 이제 강호의 누구도 이 마을에 깃발을 강요하지 못합니다.` : `${F}${pp(F, '이/가')} 물러갔습니다! 최후통첩 하나를 이겨 냈습니다. 하지만 다른 하나가 남았습니다. 며칠 안에 올 겁니다.` }], { tag: 'route' });
        } else {
          cx.rs = 'won';
          this.say([{ m: 'smile', t: `${F}의 대습격을 막아 냈습니다! 강호가 이 싸움을 오래 이야기할 겁니다.` }], { tag: 'route' });
        }
      } else {
        cx.rs = 'wait'; cx.rAt = d + 10;
        this.say([{ m: 'worry', t: `${F}에 밀렸습니다. 그래도 길이 끊긴 것은 아닙니다. 놈들은 열흘쯤 뒤 다시 올 겁니다. 그때까지 무사를 기르고 길목을 막아 두십시오.` }], { tag: 'route' });
      }
      this.check();
    },
    // 날마다: 제5장 세가의 혼담, 제6장의 절정 (전쟁·대습격·무림대회·흑풍채의 끝)
    routeDaily() {
      const st = ST(), k = route(), d = dayOf();
      if (st.chapter === 4 && k === 'sega' && st.cg && !marriageDone() && d >= (st.cg.mAt || 0)) {
        st.cg.mAt = d + 8;
        const ok = id => JH.isAlive(id) && JH.campOf(id) === 'sega' && !S.flags['pact_nofame_' + id];
        const who = [S.vassal, ...S.jh.near].find(id => id && ok(id)) || FACTION_ORDER.find(ok);
        if (who && evHas('sega_marriage') && !queued('sega_marriage')) Events.queue('sega_marriage', { k: who });
      }
      if (st.chapter !== 5) return;
      const cx = st.cx, R = ROUTES[k];
      if (!cx || !R || cx.r !== k) return;
      // 전쟁: 지면 열흘 뒤 총관이 말하고 다시 연다
      if (cx.ws === 'on' && !JH.warById(cx.war)) { cx.ws = R.war && R.war.goal ? 'lost' : 'skip'; cx.wAt = d + 10; }
      if (R.war && cx.ws === 'none') this.openWar(false);
      else if (R.war && R.war.goal && cx.ws === 'lost' && d >= cx.wAt) this.openWar(true);
      // 대습격: 경보가 사라졌으면(점령·멸문·은자로 달램) 며칠 뒤 다시
      if (['warned', 'coming', 'active'].includes(cx.rs) && !Events.raidPending() && !S.raid) { cx.rs = 'wait'; cx.rAt = d + 2; }
      if (cx.rs === 'wait' && d >= cx.rAt) this.sendRaid();
      // 무림대회 (세가)
      if (k === 'sega' && !cx.tw && d >= cx.tAt) this.tourney();
      // 흑풍채의 끝
      if (cx.hs !== 2 && !JH.isAlive('heukpung')) cx.hs = 2;
      if (cx.hs === 1 && ((k === 'gwan' && !S.jh.quests.some(q => q.id === cx.hq)) || (k === 'heuk' && !this.asking('heuk')))) { cx.hs = 0; cx.hAt = d + 1; }
      if (cx.hs === 0 && d >= cx.hAt && !S.raid) this.heukEnd();   // 습격이 벌어지는 중이면 하루 미룬다
      this.check();
    },
    asking(tag) { return [this.cur, ...this.queue].some(q => q && q.tag === tag); },
    // 세가의 무림대회: 여드레마다. 무공이 가장 높은 이가 나가고, 결과는 무공과 연무대(tournament)로 굴린다
    tourney() {
      const cx = cxOf();
      cx.tAt = dayOf() + 8;
      if (this.asking('tourney')) return;
      const host = campRep('sega');
      const best = fighters().slice().sort((a, b) => b.martial - a.martial)[0];
      this.say([
        { m: 'smile', t: `${host ? fN(host) : '세가'}에서 무림대회를 엽니다. 천하의 고수들이 단상에 오르지요. 우리 마을에서도 하나를 내보낼까요?` },
        { m: 'calm', t: best ? `내보낸다면 ${realmOf(best.martial)}의 ${best.hero ? `${best.hero.title} ` : ''}${best.name}${pp(best.name, '이/가')} 나갑니다. 참가비는 은자 50냥입니다.` : '지금 마을에는 단상에 오를 만한 무사가 없습니다. 무관에서 무사를 기르시거나 고수를 객경으로 모셔 두십시오.' },
      ], { tag: 'tourney', choices: [
        { label: '내보내겠소', sub: '참가비 은자 50 · 무공이 가장 높은 이가 나간다', run: () => this.tourneyRun() },
        { label: '이번에는 거르겠소', sub: '여드레 뒤에 다시 열린다', run: () => {} },
      ] });
    },
    tourneyRun() {
      const cx = cxOf();
      const fs = fighters().slice().sort((a, b) => b.martial - a.martial);
      if (!fs.length || S.res.silver < 50) {
        this.say([{ m: 'worry', t: !fs.length ? '나갈 무사가 없습니다. 여드레 뒤 대회가 다시 열립니다.' : '참가비 은자 50냥이 모자랍니다. 여드레 뒤 대회가 다시 열립니다.' }], { tag: 'tourney' });
        return;
      }
      S.res.silver -= 50;
      const v = fs[0];
      const p = clamp(0.2 + (v.martial - 2) * 0.2 + (fs[1] ? fs[1].martial * 0.04 : 0) + JH.perk('tournament') * 0.1, 0.12, 0.9);
      if (Math.random() < p) {
        cx.tw = true;
        addFame(30);
        S.stats.titles = (S.stats.titles || 0) + 1;
        logMsg(`${v.name}${pp(v.name, '이/가')} 무림대회에서 우승했다! 명성 +30`, 'good');
        UI.toast('무림대회 우승! 명성 +30', 'good');
        this.say([{ m: 'smile', t: `우승입니다! ${v.name}${pp(v.name, '이/가')} 단상 꼭대기에서 마지막 상대를 내려보냈습니다. 세가의 족보마다 ${vn()}의 이름이 오르겠지요.` }], { tag: 'tourney' });
        this.check();
      } else {
        addFame(5);
        logMsg(`${v.name}${pp(v.name, '이/가')} 무림대회에서 아깝게 졌다.`, '');
        this.say([{ m: 'calm', t: `${v.name}${pp(v.name, '이/가')} 결승 문턱에서 아깝게 졌습니다. 그래도 이름은 남았습니다. 여드레 뒤 대회가 다시 열립니다.` }], { tag: 'tourney' });
      }
    },
    // 흑풍채의 끝 (§8.2): 관은 토벌령 의뢰, 흑도는 흡수, 그 밖은 한 장면
    heukEnd() {
      const cx = cxOf(), R = ROUTES[route()];
      if (!JH.isAlive('heukpung')) { cx.hs = 2; return; }
      if (R.heuk.hunt) { this.postHunt(); return; }
      if (R.heuk.absorb) { this.offerAbsorb(); return; }
      JH.dissolve('heukpung', { story: true, quiet: true });
      JH.news(R.heuk.news, 'fall', ['heukpung']);
      logMsg(R.heuk.news, 'good');
      cx.hs = 2;
      this.say(R.heuk.lines.map(t => ({ m: 'smile', t })), { tag: 'route' });
    },
    // 관의 토벌령: 흑풍채를 치는 의뢰를 붙인다(JH 의뢰와 같은 모양). 해내면 흑풍채가 멸문한다
    postHunt() {
      const cx = cxOf(), jh = S.jh, d = dayOf();
      const fid = campRep('gwan');
      if (!fid) { JH.dissolve('heukpung', { story: true }); cx.hs = 2; return; }
      const n = 3, per = clamp(0.8 + d / 50, 1, 3);
      const q = {
        id: 'q' + (++jh.seq), fid, kind: 'suppress', title: '흑풍채 토벌령',
        text: `${fN(fid)}에서 황명을 받든 토벌령을 내렸다. 뒷산 흑풍채의 산채를 쳐서 뿌리를 뽑으라 한다. 해내면 흑풍채는 멸문한다.`,
        target: 'heukpung', need: { n, martial: Math.round(n * per * 10) / 10 }, days: 2,
        reward: { silver: 200, fame: 20, rel: 10 }, risk: 0.3, expires: d + 6, state: 'open', party: [], back: 0, ok: null, story: 1,
      };
      jh.quests.push(q);
      Bus.emit('questNew', q);
      cx.hq = q.id; cx.hs = 1;
      this.say([
        { m: 'stern', t: `${fN(fid)}에서 흑풍채 토벌령이 내려왔습니다. 뒷산 산채를 쳐서 뿌리를 뽑으라는 황명입니다.` },
        { m: 'calm', t: '[세력] 창의 [의뢰]에서 「흑풍채 토벌령」에 무사 셋쯤을 보내십시오. 엿새 안에 떠나야 합니다. 해내면 흑풍채는 멸문합니다.' },
      ], { tag: 'route' });
    },
    // 흑도의 흡수: 흑풍채주가 찾아와 수하가 되겠다고 한다
    offerAbsorb() {
      const cx = cxOf();
      if (cx.hs === 2 || this.asking('heuk')) return;
      cx.hs = 1;
      this.say([
        { m: 'calm', t: '흑풍채주가 부하 둘만 데리고 영주관을 찾아왔습니다. 관의 토벌이 무섭다며, 밤의 왕 밑에서 일하겠답니다.' },
        { m: 'stern', t: '산채를 거두시면 흑풍채는 우리 수하가 됩니다. 두목에게 쥐여 줄 몫으로 은자 100냥이 들고, 그 뒤로는 날마다 은자 3냥을 바칠 겁니다.' },
      ], { tag: 'heuk', choices: [
        { label: '흑풍채를 거두겠소', sub: '은자 -100 · 흑풍채가 수하가 된다 · 날마다 은자 +3', run: () => this.absorb() },
        { label: '아직은 두고 보겠소', sub: '사흘 뒤 다시 찾아온다', run: () => { const c = cxOf(); c.hs = 0; c.hAt = dayOf() + 3; } },
      ], onClose: () => { const c = cxOf(); if (c.hs === 1) { c.hs = 0; c.hAt = dayOf() + 1; } } });
    },
    absorb() {
      const st = ST(), cx = cxOf();
      if (!JH.isAlive('heukpung')) { cx.hs = 2; return; }
      if (S.res.silver < 100) {
        cx.hs = 0; cx.hAt = dayOf() + 1;
        this.say([{ m: 'worry', t: '은자가 100냥에 못 미칩니다. 곳간이 차면 소인을 불러 흑풍채를 거두겠다고 하십시오.' }], { tag: 'route' });
        return;
      }
      S.res.silver -= 100;
      JH.dissolve('heukpung', { story: true, quiet: true });
      st.heukGold = 1; cx.hs = 2;
      logMsg('흑풍채가 마을의 수하로 들어왔다. 산채는 이제 날마다 은자를 바친다.', 'good');
      UI.toast('흑풍채를 거두었다', 'good');
      this.say([{ m: 'smile', t: '흑풍채주가 무릎을 꿇고 술잔을 올렸습니다. 뒷산의 산채는 이제 우리 것입니다. 날마다 은자 3냥이 올라올 겁니다.' }], { tag: 'route' });
      this.check();
    },
    // 승리 (§8.2): 마지막 장을 마치면 갈래의 칭호와 결말을 띄우고, 숙적 계열 이웃의 힘을 절반으로 꺾는다
    victory() {
      const k = ROUTES[route()] ? route() : 'free', R = ROUTES[k];
      const foes = foeCamps(k);
      // 흑풍채의 끝이 한 장면인 갈래인데 아직 보지 못했으면 승리 앞에 보인다
      if (R.heuk.lines && JH.isAlive('heukpung') && ST().cx && ST().cx.hs !== 2 && !S.raid) this.heukEnd();
      S.victory = true;
      S.victoryTitle = R.title;
      if (jhOn()) {
        S.jh.victory = k;
        for (const id of S.jh.near) if (JH.isAlive(id) && foes.includes(JH.campOf(id)) && id !== S.vassal && !S.jh.pacts.includes(id)) setPow(id, (S.jh.power[id] || 0) * 0.5);
        JH.news(`${S.name}${pp(S.name, '이/가')} 「${R.title}」의 이름을 얻었다. 숙적들의 기세가 꺾였다.`, 'victory', []);
      }
      logMsg(`「${R.title}」${pp(R.title, '을/를')} 이루었다!`, 'good');
      Events.victory({ title: R.title, stamp: R.seal, text: `${R.vtext()}\n\n<em>${R.title}</em>${pp(R.title, '을/를')} 이루었다. 원한다면 계속 마을을 다스릴 수 있다.` });
    },

    // ━━ 화면 ━━
    build() {
      if (this.el) return;
      const app = byId('app');
      if (!app) return;
      const mk = (tag, id, cls, html) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; app.appendChild(e); return e; };
      const scrim = mk('div', 'story-scrim'); scrim.hidden = true;
      const trk = mk('div', 'story-tracker', 'st-trk'); trk.hidden = true;
      trk.setAttribute('role', 'region'); trk.setAttribute('aria-label', '할 일 두루마리');
      const card = mk('div', 'steward', 'stw', `
        <div class="stw-face"><canvas width="${FACE_W * FACE_SS}" height="${FACE_H * FACE_SS}" aria-hidden="true" data-tip-title="총관 윤서하" data-tip="영주를 곁에서 돕는 총관. 오른쪽 위의 붉은 도장은 이름 끝 자 霞(노을 하)."></canvas>
          <div class="stw-plate"><span class="hj" data-tip-title="總管">總管</span></div></div>
        <div class="stw-body">
          <div class="stw-who"><b>총관 윤서하</b><span class="hj" data-tip-title="尹書霞">尹書霞</span><button type="button" class="stw-x" data-act="x" aria-label="닫기">✕</button></div>
          <div class="stw-text" aria-live="polite"></div>
          <div class="stw-foot"><span class="stw-page"></span><div class="stw-btns"></div></div>
        </div>`);
      card.hidden = true;
      card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', '총관 윤서하');
      const ring = mk('div', 'story-ring'); ring.hidden = true;
      const tag = mk('div', 'story-tag'); tag.hidden = true;
      const chap = mk('div', 'story-chapter'); chap.hidden = true;
      this.el = { scrim, trk, card, ring, tag, chap, face: card.querySelector('canvas'), text: card.querySelector('.stw-text'), page: card.querySelector('.stw-page'), btns: card.querySelector('.stw-btns'), x: card.querySelector('.stw-x') };
      card.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b || b.disabled) return;
        const a = b.dataset.act;
        if (a === 'next') this.next();
        else if (a === 'ok') this.close(true);
        else if (a === 'x') this.close(false);
        else if (a === 'choice') this.choose(+b.dataset.i);
      });
      trk.addEventListener('click', e => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        const a = b.dataset.act, st = ST();
        if (a === 'toggle') {
          if (trk.classList.contains('compact')) this._open = !this._open;
          else if (st) st.collapsed = !st.collapsed;
          this._trk = ''; this.renderTracker(); this.layout();
        } else if (a === 'hint') { this._open = false; this.hint(); }
        else if (a === 'ack') {
          const s = this.stepObj();
          if (!s) return;
          this.fold();
          if (this.cur && this.cur.tag === 'step' && !this.cur.pause) this.showNext();
          this.ackStep(s.id);
        }
        else if (a === 'advisor') { this._open = false; this.openAdvisor(); }
      });
      window.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !this.cur || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || !byId('title-screen').hidden || UI.modalOpen) return;
        const b = this.el.btns.querySelector('[data-act="next"],[data-act="ok"]');
        if (b) { e.preventDefault(); b.click(); }
      });
      window.addEventListener('resize', () => { if (S) this.layout(); });
      this.ringLoop();
    },
    showAll(on) {
      if (!this.el) return;
      this.el.trk.hidden = !on;
      if (!on) { this.el.card.hidden = true; this.el.scrim.hidden = true; this.el.ring.hidden = true; this.el.tag.hidden = true; }
    },
    reset() {
      this.cur = null; this.queue = []; this._sites = {}; this._open = false; this._scrolled = ''; this._trk = '';
      this._card = false; this._focusKey = ''; this._adviseRaid = false; this._broke = null;
      if (typeof G !== 'undefined') G.markers = [];
      if (this.el) { this.el.card.hidden = true; this.el.scrim.hidden = true; this.el.ring.hidden = true; this.el.tag.hidden = true; }
    },
    chapterCard() {
      const st = ST();
      if (!this.el || !st) return;
      const ch = chDef(st.chapter);
      const el = this.el.chap;
      el.innerHTML = `<span class="stc-seal" data-tip-title="${ch.seal}">${ch.seal}</span><small>${this.chapterLabel()}</small><b>${ch.title}</b>`;
      el.hidden = false;
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      clearTimeout(this._chapT);
      this._chapT = setTimeout(() => { el.hidden = true; }, 3200);
    },

    // 폰의 펼친 두루마리를 접는다 (멈춤 대화·단계가 바뀔 때 지도와 카드를 가리지 않게)
    fold() {
      if (!this._open) return;
      this._open = false; this._trk = '';
      this.renderTracker(); this.layout();
    },

    // ━━ 대화창 ━━
    open(d) {
      this.cur = d;
      if (d.pause) this.fold();
      this.renderCard();
    },
    showNext() {
      this.cur = null;
      if (this.queue.length) this.open(this.queue.shift());
      else this.renderCard();
    },
    next() {
      const d = this.cur;
      if (!d) return;
      if (d.i < d.lines.length - 1) { d.i++; this.renderCard(); }
    },
    close(ok) {
      const d = this.cur;
      if (!d) return;
      this.showNext();
      if (ok && d.onAck) d.onAck();
      if (!ok && d.onClose) d.onClose();
      this._trk = '';
    },
    choose(i) {
      const d = this.cur;
      if (!d || !d.choices || !d.choices[i]) return;
      const c = d.choices[i];
      this.showNext();
      if (c.run) c.run();
      this._trk = '';
    },
    renderCard() {
      const el = this.el;
      if (!el) return;
      const d = this.cur;
      if (!d) { el.card.hidden = true; el.scrim.hidden = true; return; }
      const L = d.lines[d.i];
      const mood = L.m || 'calm';
      if (this._face !== mood) {
        if (!this.faces[mood]) {
          const c = document.createElement('canvas');
          c.width = FACE_W * FACE_SS; c.height = FACE_H * FACE_SS;
          drawFace(c.getContext('2d'), mood);
          this.faces[mood] = c;
        }
        const fc = el.face.getContext('2d');
        fc.clearRect(0, 0, el.face.width, el.face.height);
        fc.drawImage(this.faces[mood], 0, 0);
        this._face = mood;
      }
      el.text.innerHTML = L.t;
      el.text.classList.remove('in'); void el.text.offsetWidth; el.text.classList.add('in');
      const last = d.i >= d.lines.length - 1;
      el.page.textContent = d.lines.length > 1 && !(last && d.choices) ? `${d.i + 1} / ${d.lines.length}` : '';
      let html = '';
      if (!last) html = '<button type="button" class="stw-btn" data-act="next">다음</button>';
      else if (d.choices) {
        html = d.choices.map((c, i) => `<button type="button" class="stw-choice" data-act="choice" data-i="${i}"><span>${escapeHtml(c.label)}</span>${c.sub ? `<small>${escapeHtml(c.sub)}</small>` : ''}</button>`).join('');
      } else html = `<button type="button" class="stw-btn" data-act="ok">${escapeHtml(d.ack || '확인')}</button>`;
      el.btns.innerHTML = html;
      el.btns.classList.toggle('choices', !!(last && d.choices));
      el.x.hidden = d.pause;
      el.card.classList.toggle('pausing', d.pause);
      el.scrim.hidden = !d.pause;
      el.card.hidden = false;
      this.layout();
    },

    // ━━ 할 일 두루마리 ━━
    renderTracker(force) {
      const el = this.el;
      const st = ST();
      if (!el || !st) return;
      const info = this.info();
      const ch = chDef(st.chapter);
      const compact = el.trk.classList.contains('compact');
      const collapsed = compact ? !this._open : !!st.collapsed;
      const sub = !st.skipped && this.guideNow && this.guideNow.sub && !st.finished ? this.guideNow.sub : '';
      const goals = info.goals.map(x => `<li class="${x.done ? 'done' : ''}"><i></i><span>${x.label}</span>${x.one ? '' : `<b>${fmt(x.cur)}/${fmt(x.max)}</b>`}</li>`).join('');
      const pop = popCount(), R = ROUTES[route()];
      const bar = (cur, max, label) => `<div class="trk-bar"><span style="width:${clamp(cur / max, 0, 1) * 100}%"></span><em>${label}</em></div>`;
      const headTxt = compact
        ? `${st.chapter + 1}장 · ${info.title}`
        : `${this.chapterLabel()} · ${ch.title}`;
      const html = `
        <button type="button" class="trk-head" data-act="toggle" aria-expanded="${!collapsed}">
          <span class="trk-seal" data-tip-title="${ch.seal}">${ch.seal}</span>
          <span class="trk-ch">${headTxt}</span>
          ${compact ? '' : `<span class="trk-mini">${collapsed ? escapeHtml(info.title) : ''}</span>`}
          <span class="trk-caret${collapsed ? '' : ' up'}" aria-hidden="true"></span>
        </button>
        <div class="trk-body">
          ${compact ? `<div class="trk-chline"><span class="trk-seal sm" data-tip-title="${ch.seal}">${ch.seal}</span>${this.chapterLabel()} · ${ch.title}</div>` : ''}
          <div class="trk-step"><h4>${info.title}</h4>${info.why ? `<p>${info.why}</p>` : ''}</div>
          ${goals ? `<ul class="trk-goals">${goals}</ul>` : ''}
          ${sub ? `<p class="trk-sub">${sub}</p>` : ''}
          <div class="trk-acts">
            ${st.intro === 'done' && !st.finished ? '<button type="button" data-act="hint">힌트</button>' : ''}
            ${info.ack ? `<button type="button" class="pri" data-act="ack">${escapeHtml(info.ack)}</button>` : ''}
            <button type="button" data-act="advisor">총관 부르기</button>
          </div>
          <div class="trk-final">
            ${this.finalHead()}
            ${bar(pop, STORY_POP, `인구 ${pop} / ${STORY_POP} · 현성(${hj('縣城')})`)}
            ${R === ROUTES.free ? bar(S.fame, STORY_FAME, `명성 ${fmt(S.fame)} / ${STORY_FAME}`) : ''}
          </div>
        </div>`;
      el.trk.classList.toggle('collapsed', collapsed);
      if (html !== this._trk || force) { el.trk.innerHTML = html; this._trk = html; }
    },

    // 할 일 두루마리 맨 아래: 갈래가 정해지면 그 결말 칭호와 문장, 그 전에는 현성
    finalHead() {
      const k = route(), R = ROUTES[k];
      if (!R) return `<div class="trk-final-h">최종 목표 <b>${hj('縣城')} 현성</b><small>결말은 갈림길에서</small></div>`;
      const c = CAMPS[k], col = c ? c.color : '#6a5a48';
      const tip = `${R.name}의 길${routeOk() ? '' : ' (잠정)'} · 결말 「${R.title}」`;
      return `<div class="trk-final-h">최종 목표 <span class="trk-rseal" style="background:${col}" data-tip-title="${R.seal}" data-tip="${escapeHtml(tip)}">${R.seal}</span><b>${escapeHtml(R.title)}</b>${routeOk() ? '' : '<small>잠정</small>'}</div>`;
    },

    // ━━ 자리 잡기: 메뉴·띠·패널·알림을 피한다 ━━
    layout() {
      const el = this.el;
      if (!el || !S) return;
      const W = window.innerWidth, H = window.innerHeight;
      const ph = phone();
      const mbEl = byId('menubar');
      const mb = mbEl.getBoundingClientRect();
      const barTop = byId('buildbar').getBoundingClientRect().top || H;
      const ban = byId('banner');
      const banR = ban.hidden ? null : ban.getBoundingClientRect();
      const trk = el.trk;
      // 할 일 두루마리
      let compact = ph, left, top, width = 0;
      if (!ph) {
        left = mb.right + 10; top = mb.top;
        let limit = W / 2 - 220;                      // 가운데 알림을 비킨다
        if (banR && banR.top < top + 320) limit = Math.min(limit, banR.left - 12);
        width = Math.min(300, limit - left);
        if (width < 236) compact = true;
      }
      if (compact) {
        const btns = [...mbEl.children].filter(b => b.getClientRects().length);
        const lr = btns.length ? btns[btns.length - 1].getBoundingClientRect() : mb;
        const free = W - 10 - (lr.right + 8);
        const clash = banR && banR.bottom > lr.top - 2 && banR.top < lr.bottom + 2;
        if (!ph) { left = mb.right + 10; top = mb.top; }
        else if (free >= 150 && !clash) { left = lr.right + 8; top = lr.top; }
        else { left = Math.max(8, mb.left); top = Math.max(mb.bottom, banR ? banR.bottom : 0) + 6; }
        const maxW = Math.max(150, W - left - 10);
        if (this._open) {
          const w = Math.min(340, W - 16);
          if (left + w > W - 8) left = Math.max(8, W - 8 - w);
          trk.style.width = w + 'px'; trk.style.maxWidth = '';
        } else { trk.style.width = ''; trk.style.maxWidth = Math.min(ph ? 260 : 300, maxW) + 'px'; }
      } else { trk.style.width = width + 'px'; trk.style.maxWidth = ''; }
      if (trk.classList.contains('compact') !== compact) { trk.classList.toggle('compact', compact); this._trk = ''; this.renderTracker(); }
      trk.style.left = Math.round(left) + 'px';
      trk.style.top = Math.round(top) + 'px';
      // 총관 카드
      const card = el.card;
      if (!card.hidden) {
        let cl = ph ? 8 : 10, bottom = H - barTop + (ph ? 8 : 10);
        let mini = false;
        const log = byId('log');
        if (!log.hidden) {
          const lr = log.getBoundingClientRect();
          if (!ph && lr.right + 10 + 380 < W - 180) cl = lr.right + 10;
          else bottom = H - lr.top + 8;
        }
        const panel = byId('panel');
        if (ph && !panel.hidden) { bottom = Math.max(bottom, H - panel.getBoundingClientRect().top + 8); mini = !(this.cur && this.cur.pause); }
        card.classList.toggle('mini', mini);
        const wide = ph && W > 620;   // 태블릿: 화면 끝까지 늘이지 않는다
        card.style.left = cl + 'px';
        card.style.right = ph && !wide ? '8px' : '';
        card.style.bottom = Math.round(bottom) + 'px';
        if (!ph) card.style.width = Math.max(300, Math.min(470, W - cl - 200)) + 'px';
        else card.style.width = wide ? Math.min(560, W - 16) + 'px' : '';
        // 키가 낮은 화면: 세로 메뉴를 가리면 메뉴 오른쪽으로 비킨다
        let cr = card.getBoundingClientRect();
        if (!ph && cr.top < mb.bottom + 6 && cr.left < mb.right + 4) {
          cl = mb.right + 10;
          card.style.left = cl + 'px';
          card.style.width = Math.max(300, Math.min(470, W - cl - 190)) + 'px';
          cr = card.getBoundingClientRect();
        }
        // 너무 높이 올라가 메뉴를 가리면 글만 남긴다
        const ceil = Math.max(mb.bottom, ph ? trk.getBoundingClientRect().bottom : 0) + 6;
        if (ph && cr.top < ceil && !mini) card.classList.add('mini');
      }
      // 두루마리가 카드와 겹치면 두루마리 몸통을 줄인다
      const body = trk.querySelector('.trk-body');
      if (body) {
        let lim = (card.hidden ? barTop : Math.min(barTop, card.getBoundingClientRect().top)) - 10 - (trk.getBoundingClientRect().top + 44);
        if (compact && this._open) lim = barTop - 10 - (trk.getBoundingClientRect().top + 44);
        body.style.maxHeight = Math.max(120, lim) + 'px';
      }
    },

    // 금빛 고리: 매 프레임 대상의 자리를 따라간다
    ringLoop() {
      const frame = () => {
        requestAnimationFrame(frame);
        const el = this.el;
        if (!el) return;
        const g = this.guideNow;
        let target = null;
        if (g && g.sel && S && byId('title-screen').hidden && !(this.cur && this.cur.pause)) {
          const t = document.querySelector(g.sel);
          if (t && t.getClientRects().length) {
            const inModal = !!t.closest('#modal'), inSheet = !!t.closest('#sheet');
            const modalOpen = !byId('modal').hidden, sheetOpen = !byId('sheet').hidden;
            if (!(modalOpen && !inModal) && !(sheetOpen && !inSheet && !inModal)) target = { t, z: inModal ? 36 : inSheet ? 31 : 25 };
          }
        }
        if (!target) { if (!el.ring.hidden) { el.ring.hidden = true; el.tag.hidden = true; } return; }
        // 건설 띠 안에서 가려져 있으면 한 번 굴려 보여 준다
        const box = target.t.closest('.build-items');
        if (box && this._scrolled !== g.sel) {
          this._scrolled = g.sel;
          const br = box.getBoundingClientRect(), r0 = target.t.getBoundingClientRect();
          if (r0.left < br.left || r0.right > br.right) box.scrollLeft += r0.left - br.left - 12;
        }
        const r = target.t.getBoundingClientRect();
        const pad = 4;
        const css = `left:${Math.round(r.left - pad)}px;top:${Math.round(r.top - pad)}px;width:${Math.round(r.width + pad * 2)}px;height:${Math.round(r.height + pad * 2)}px;z-index:${target.z}`;
        if (el.ring.dataset.css !== css) { el.ring.style.cssText = css; el.ring.dataset.css = css; }
        el.ring.classList.toggle('flash', performance.now() < this._flash);
        el.ring.hidden = false;
        const tagTxt = g.tag || '';
        if (!tagTxt) { el.tag.hidden = true; return; }
        if (el.tag.textContent !== tagTxt) el.tag.textContent = tagTxt;
        el.tag.hidden = false;
        const tw = el.tag.offsetWidth, th = el.tag.offsetHeight;
        // 세로로 선 메뉴 단추는 옆에, 나머지는 위(자리가 없으면 아래)에 단다
        const side = target.t.closest('#menubar') && !phone() ? 'right' : (r.top - th - 14 < 6 ? 'below' : 'above');
        let tx, ty, ax;
        if (side === 'right') { tx = r.right + 12; ty = r.top + r.height / 2 - th / 2; ax = 0; }
        else {
          tx = clamp(r.left + r.width / 2 - tw / 2, 6, window.innerWidth - tw - 6);
          ty = side === 'below' ? r.bottom + 12 : r.top - th - 12;
          ax = clamp(r.left + r.width / 2 - tx, 10, tw - 10);
        }
        const tcss = `left:${Math.round(tx)}px;top:${Math.round(ty)}px;z-index:${target.z};--ax:${Math.round(ax)}px`;
        if (el.tag.dataset.css !== tcss) { el.tag.style.cssText = tcss; el.tag.dataset.css = tcss; }
        el.tag.classList.toggle('below', side === 'below');
        el.tag.classList.toggle('right', side === 'right');
      };
      requestAnimationFrame(frame);
    },
  };

  const STORY_POP = RANKS[RANKS.length - 1].minPop;  // 120
  const STORY_FAME = 400;

  // ── 소식 듣기 ─────────────────────────────────
  Bus.on('camMoved', () => setFlag('cam'));
  Bus.on('sheetOpen', kind => setFlag('sheet_' + kind));
  Bus.on('sheetClose', kind => {
    const st = ST();
    if (!st || st.skipped || st.intro !== 'done') return;
    if (kind === 'village' && st.chapter === 2 && !st.flags.taxTalk) {
      st.flags.taxTalk = 1;
      M.say([
        { m: 'calm', t: '보신 대로 민심은 여러 갈래에서 옵니다. 세금을 낮추면 민심이 8 오르고, 높이면 12 깎입니다.' },
        { m: 'stern', t: '세금은 은자의 젖줄이니 형편을 보아 정하십시오. 민심이 25 아래로 떨어지면 사람들이 짐을 쌉니다.' },
      ], { tag: 'aside' });
    }
    if (kind === 'factions' && st.chapter === 3 && !st.flags.vassalTalk) {
      st.flags.vassalTalk = 1;
      M.say([{ m: 'calm', t: '산하에 드는 것은 칼을 빌리는 대신 고삐를 내주는 일입니다. 매일 공물이 나가고, 주군의 원수는 우리의 원수가 됩니다. 신중히 고르십시오.' }], { tag: 'aside' });
    }
  });
  // 안내 중 폰에서 건설 도구를 고르면, 지을 자리를 가리는 선택 창을 닫는다
  Bus.on('tool', key => { if (key && phone() && M.tutorialActive() && UI.sel) UI.select(null); });
  // 폰에서 [다시 짓기]를 누르면 창을 닫아, 다음에 가리킬 곳을 카드와 창이 가리지 않게
  Bus.on('repairStarted', b => { if (phone() && M.tutorialActive() && UI.sel && UI.sel.b === b) UI.select(null); });
  Bus.on('petitionResolved', (p, cid) => {
    const st = ST();
    if (!st) return;
    // 영주가 직접 처결했거나 바라던 일이 이루어진 것만 친다 (기한을 넘기거나 거둔 것은 아니다)
    if (!cid || cid[0] !== '_' || cid === '_moot') { setFlag('petition'); return; }
    // 첫 상소 단계에서 상소가 사라지면 하나를 다시 올린다 (안내 중에는 무작위 상소가 오지 않는다)
    if (!M.tutorialActive() || M.stepId() !== 'petition' || st.flags.petition || pendingPetitions()) return;
    const np = hook(Petitions, 'add', { type: 'well' });
    if (!np && !pendingPetitions()) st.petitionStub = true;
  });
  Bus.on('budgetChanged', (dept, amount) => {
    const st = ST();
    if (!st) return;
    st.budgets[dept] = +amount || 0;
    if (+amount > 0) setFlag('budget');
  });
  Bus.on('arrived', n => {
    const st = ST();
    if (!st || !M.tutorialActive() || st.flags.arrived) return;
    st.flags.arrived = 1;
    M.say([{ m: 'smile', t: `새 식구 ${n}명이 찾아왔습니다! 빈 집과 먹을 것이 사람을 부르는 법이지요.` }], { soft: true, tag: 'aside', expire: 6 });
  });
  Bus.on('rankUp', rank => {
    const st = ST();
    if (!st || st.skipped || st.intro !== 'done' || rank !== 1) return;
    M.say([{ m: 'smile', t: '촌이 마을이 되었습니다! 이제 [상업]에서 시장과 객잔을, [주거]에서 기와집을 지을 수 있습니다.' }], { soft: true, tag: 'aside', expire: 10 });
  });
  Bus.on('eventResolved', (id, label) => {
    const st = ST();
    if (!st) return;
    // 갈림길에서 [더 지켜보겠소]: 총관 메뉴에서 다시 펼친다 / 포섭 사자에게 답했다
    if (id === 'crossroads' && label === '더 지켜보겠소' && !routeOk()) M.say([{ m: 'calm', t: '천천히 정하셔도 됩니다. 마음이 서시면 [총관]을 불러 갈림길을 다시 펼치라 하십시오.' }], { tag: 'route', expire: 8 });
    if (id === 'offer') st.pend = null;
    if (id !== '_raid') return;
    // 절정의 대습격 경보에 답했다: 싸우러 나서면 다가오고, 은자로 물렸으면 며칠 뒤 다시 온다
    const cx = st.cx;
    if (cx && cx.rs === 'warned' && st.chapter === 5 && !st.finished) {
      if (S.scheduled.some(s => s.kind === 'raid' && s.faction === cx.rf) || (S.raid && S.raid.faction === cx.rf)) cx.rs = 'coming';
      else {
        cx.rs = 'wait'; cx.rAt = dayOf() + 5;
        M.say([{ m: 'stern', t: '은자로 물리셨군요. 하지만 놈들은 닷새쯤 뒤 다시 올 겁니다. 이 고비는 칼로 넘어야 합니다.' }], { tag: 'route' });
      }
    }
    if (st.raid === 'warned') {
      if (S.scheduled.some(s => s.kind === 'raid' && s.faction === 'heukpung') || (S.raid && S.raid.faction === 'heukpung')) {
        st.raid = 'coming';
        M.say(raidComingLines(), { tag: 'step' });
      } else M.raidAverted();
    } else if (!M.tutorialActive()) {
      // 다른 습격: 경보 두루마리를 닫은 뒤(uiTick) 바로 방비를 아뢴다
      M._adviseRaid = true;
    }
  });
  Bus.on('raidStart', raid => {
    const st = ST();
    if (st && st.cx && st.cx.rs === 'coming' && raid.faction === st.cx.rf) st.cx.rs = 'active';
    if (!st || st.raid !== 'coming' || raid.faction !== 'heukpung') return;
    st.raid = 'active';
    // 기별을 받은 현청 포졸 셋이 영주관 앞에 닿는다
    const m = getB(S.manorId);
    const d = m ? doorOf(m) : plazaTile();
    for (let i = 0; i < 3; i++) {
      const a = newAlly('gwanbu', d.x + 0.5 + rnd(-0.7, 0.7), d.y + 0.5 + rnd(0, 0.8), {});
      a.spawnDelay = 0.25 + i * 0.05;
    }
    logMsg('기별을 받은 현청 포졸 셋이 영주관 앞에 닿았다.', 'good');
  });
  Bus.on('raidEnd', (result, raid) => {
    const st = ST();
    if (!st) return;
    setFlag('raidSurvived');
    if (st.cx && (st.cx.rs === 'coming' || st.cx.rs === 'active') && raid && raid.faction === st.cx.rf && st.chapter === 5 && !st.finished) M.climaxRaidEnd(result);
    if (st.raid !== 'active' && st.raid !== 'coming') return;
    st.raidDone = true;
    st.raidPaid = 1;   // 제2장 포상은 이것으로 갈음한다
    if (result === 'win') {
      st.raid = 'won';
      const txt = grant({ silver: 60, weapons: 6 }, '흑풍채가 버리고 간 것');
      M.say([
        { m: 'smile', t: '이겼습니다! 흑풍채 놈들이 꼬리를 말고 산으로 달아났습니다. 마을 사람들이 영주님 이름을 부르고 있습니다.' },
        { m: 'calm', t: `놈들이 버리고 간 은자와 병장기를 거두었습니다. (${txt}) 병장기가 있으면 무사와 궁수가 더 세게 칩니다.` },
        { m: 'stern', t: '허나 흑풍채는 이것으로 끝내지 않을 겁니다. 강호의 다른 세력들도 이제 이 마을을 눈여겨보겠지요.' },
      ], { tag: 'result', pause: true });
    } else {
      st.raid = 'lost';
      const txt = grant({ food: 60, silver: 60 }, '현청의 위로');
      M.say([
        { m: 'worry', t: '…털렸습니다. 그래도 영주님, 마을은 아직 서 있습니다. 사람도 남았고요.' },
        { m: 'stern', t: '다음엔 다르게 하지요. 무관의 일꾼을 가득 채워 수련을 쌓게 하시고, 망루를 하나 더 세우시고, 놈들이 오는 북쪽 길목 양옆에 목책을, 길 위에는 성문을 세우십시오. 마을이 커지면 대장간에서 병장기도 만들 수 있습니다.' },
        { m: 'calm', t: `현청에서 위로 삼아 식량과 은자를 보내왔습니다. (${txt}) 무너진 건물은 눌러서 다시 지으시면 됩니다.` },
      ], { tag: 'result', pause: true });
    }
    M.check();
  });
  // ── 갈래의 소식 ──
  Bus.on('vassal', k => M.onVassal(k));
  // 해낸 의뢰를 장의 기록에 적는다 (S.jh.qlog 는 열 개만 남으므로). 관의 토벌령이면 흑풍채가 멸문한다
  Bus.on('questDone', (q, ok) => {
    const st = ST();
    if (!st || !q) return;
    if (ok && st.cg) {
      st.cg.q = (st.cg.q || []).filter(x => x.id !== q.id).concat([{ id: q.id, c: JH.campOf(q.fid), k: q.kind }]);
      if (st.cg.q.length > 40) st.cg.q.shift();
    }
    const cx = st.cx;
    if (cx && cx.hq === q.id && cx.hs === 1) {
      if (ok && JH.isAlive('heukpung')) {
        JH.dissolve('heukpung', { story: true });
        cx.hs = 2;
        M.say([{ m: 'smile', t: '토벌대가 흑풍채의 산채에 불을 놓았습니다. 열흘 전 이 마을을 털던 그 산적들이 오늘로 끝났습니다. 마을 사람들이 거리에 나와 영주님 이름을 부릅니다.' }], { tag: 'route' });
      } else if (JH.isAlive('heukpung')) {
        cx.hs = 0; cx.hAt = dayOf() + 2;
        M.say([{ m: 'worry', t: '토벌이 실패했습니다. 관에서 이틀 뒤 토벌령을 다시 내리겠답니다. 그때는 무공이 높은 이들로 꾸리십시오.' }], { tag: 'route' });
      } else cx.hs = 2;
    }
    M.check();
  });
  // 현상금은 JH 소식('bounty')으로 센다 (관의 길 제5장)
  Bus.on('jhNews', item => { const st = ST(); if (st && st.cg && item && item.kind === 'bounty') st.cg.b = (st.cg.b || 0) + 1; });
  // 짜인 전쟁이 끝났다: 이기면 목표, 지면 열흘 뒤 다시 (§8.2)
  Bus.on('warEnd', (w, winner) => {
    const st = ST(), cx = st && st.cx;
    if (!cx || !w || w.id !== cx.war || cx.ws !== 'on') return;
    const R = ROUTES[cx.r], goalWar = !!(R && R.war && R.war.goal);
    if (winner && winner === (cx.side || 'a')) {
      cx.ws = goalWar ? 'won' : 'skip';
      if (goalWar) M.say([{ m: 'smile', t: `「${w.name}」에서 이겼습니다! ${cx.wb && FACTIONS[cx.wb] ? `${fN(cx.wb)}의 기세가 꺾였습니다.` : ''} 마을이 보탠 몫도 강호가 기억할 겁니다.` }], { tag: 'route' });
    } else {
      cx.ws = goalWar ? 'lost' : 'skip'; cx.wAt = dayOf() + 10;
      if (goalWar) M.say([{ m: 'worry', t: `「${w.name}」에서 밀렸습니다. 그래도 길이 끊긴 것은 아닙니다. 열흘 뒤 다시 싸움이 붙을 테니 은자와 식량을 모아 두십시오.` }], { tag: 'route' });
    }
    M.check();
  });
  Bus.on('occupied', () => { setTimeout(() => { const st = ST(); if (st && st.intro === 'done') { st.adviceAt = -999; M.advise(true); } }, 60); });

  return M;
})();
