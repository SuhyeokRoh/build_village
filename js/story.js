'use strict';
// ───────────────────────────────────────────────
// 이야기와 튜토리얼 — 총관 윤서하(尹書霞)가 영주 곁에서 돕는다
//  · 새 게임: 흑풍채에 털린 쓰러져 가는 마을에 새 영주가 부임한다
//  · 장(章)마다 할 일과 까닭을 「할 일 두루마리」에 적고, 단추와 지도 위를 짚어 준다
//  · 안내가 끝난 뒤에는 마을 형편을 살피다가 때맞춰 아뢴다
// 저장되는 것은 S.story(순수 JSON)뿐. 화면 요소·대화 대기열은 Story 안에만 둔다.
// ───────────────────────────────────────────────

// 이 모듈이 새로 쓰는 한자 풀이
Object.assign(HANJA_GLOSS, {
  '總管': ['총관', '영주를 곁에서 보좌하며 마을 살림과 장부를 도맡는 벼슬. 지금은 윤서하가 맡고 있다.'],
  '尹書霞': ['윤서하', '총관의 이름. 尹(성 윤) · 書(글 서) · 霞(노을 하).'],
  '黑風寨': ['흑풍채', '뒷산 험한 산채에 터를 잡은 산적 떼. 「검은 바람의 산채」라는 뜻. 열흘 전 이 마을을 털었다.'],
  '縣廳': ['현청', '고을을 다스리는 관청. 영주를 이 마을에 보낸 곳.'],
  '縣城': ['현성', '성벽을 두른 큰 고을. 인구 120명 이상. 최종 목표의 하나.'],
  '天下第一村': ['천하제일촌', '하늘 아래 첫째가는 마을. 현성(인구 120)과 명성 400을 이루면 얻는 이름. 이 게임의 최종 목표.'],
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
  '風': ['바람 풍', '바람. 제4장 「강호의 바람」.'],
  '天': ['하늘 천', '하늘. 제6장 「천하제일촌」.'],
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
  '章': ['글 장', '이야기의 한 마디. 이 이야기는 여섯 장으로 되어 있다.'],
});

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
  const dojoWorkers = () => { const d = S.buildings.find(b => b.type === 'dojo' && usable(b)); return d && d._workers ? d._workers.length : 0; };
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

  // ── 대사 ───────────────────────────────────
  // 한 줄 = { m: 표정(calm·smile·worry·stern), t: HTML }
  function introLines() {
    return [
      { m: 'smile', t: `영주님, 먼 길 오시느라 고생 많으셨습니다. ${vn()}의 살림을 맡아 온 ${hjp('총관', '總管')} 윤서하라 합니다.` },
      { m: 'worry', t: `보시다시피 환영 잔치를 열 형편은 못 됩니다. 열흘 전, 뒷산의 ${hjp('흑풍채', '黑風寨')} 산적들이 들이닥쳐 곳간을 털고 집과 논밭에 불을 놓았습니다.` },
      { m: 'stern', t: '전임 영주는 그날 밤 말 한 필에 금붙이만 싣고 달아났지요. 남은 사람은 고작 다섯. 다들 영주관 행랑채에 모여 겨우 비를 긋고 있습니다.' },
      { m: 'calm', t: `${hjp('현청', '縣廳')}이 영주님을 이리 보낸 것은… 솔직히 말씀드리면 마을을 지도에서 지우기 전에 마지막으로 한 번 걸어 본 것일 겁니다. 그 판을 뒤집는 것이 이제 영주님의 일입니다.` },
      { m: 'smile', t: `목표는 하나입니다. 이 쓰러져 가는 ${hjp('촌', '村')}을 강호 누구도 넘보지 못할 ${hjp('현성', '縣城')}으로 키우는 것. <em>인구 120명, 명성 400</em>. 그런 마을을 사람들은 ${hjp('천하제일촌', '天下第一村')}이라 부르지요.` },
      { m: 'calm', t: '먼 길이지만 한 걸음씩 가면 됩니다. 처음 얼마간은 소인이 곁에서 차근차근 일러 드릴까요?' },
    ];
  }
  function goalLines() {
    const pop = popCount();
    const lack = [pop < 120 ? `사람 ${120 - pop}명` : '', S.fame < 400 ? `명성 ${fmt(Math.ceil(400 - S.fame))}` : ''].filter(Boolean).join('과 ');
    return [
      { m: 'smile', t: `이 마을의 목표는 ${hjp('천하제일촌', '天下第一村')}입니다. 인구 120명의 ${hjp('현성', '縣城')}을 이루고, 강호에 명성 400을 떨치는 것.` },
      { m: 'calm', t: `지금 인구 ${pop}명, 명성 ${fmt(S.fame)}. ${lack ? `아직 ${lack}${ppn(lack, '이/가')} 모자랍니다.` : '이미 이루셨습니다.'} 할 일 두루마리 맨 아래에 늘 적어 두었습니다.` },
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
      title: '강호의 바람', seal: '風',
      steps: [{
        id: 'jianghu', title: '강호의 세력과 마주하기', why: '이름이 나면 손을 내미는 이도, 칼을 겨누는 이도 생깁니다.',
        lines: () => [
          { m: 'calm', t: `제4장, 강호의 바람입니다. 마을 이름이 오르내리자 ${hjp('강호', '江湖')}의 세력들이 기웃거리기 시작했습니다.` },
          { m: 'calm', t: '[세력]을 열어 보십시오. 관계가 -20 아래로 떨어진 세력은 위협을 쌓다가 쳐들어오고, 관계가 40을 넘은 세력의 산하로 들면 공물을 바치는 대신 습격 때 원군을 보내 줍니다.' },
          { m: 'stern', t: '한쪽과 가까워지면 그 원수와는 멀어집니다. 정파와 마교는 한 지붕 아래 들 수 없지요. 지금부터는 강호의 크고 작은 일들이 가리지 않고 찾아올 겁니다.' },
        ],
        goals: () => [
          check('세력 살펴보기', flag('sheet_factions'), { tip: '[세력]을 열면 각 세력과의 관계와 위협이 보입니다.', guide: () => ({ sel: '#btn-factions', tag: '세력' }) }),
          goal(`인구 35 · ${rankName(2)}`, S.rank >= 2 ? Math.max(35, popCount()) : popCount(), 35, { tip: '집을 늘리고 민심을 지키십시오. 기와집은 여덟 식구가 삽니다.' }),
          goal('무사·궁수', fighters().length, 6, { tip: '무관의 일꾼은 무사, 망루의 일꾼은 궁수가 됩니다. 무관을 늘리거나 망루를 더 세우십시오.', guide: () => guideBuild('tower') }),
        ],
        guide: () => {
          if (!flag('sheet_factions')) return { sel: '#btn-factions', tag: '세력', sub: '[세력]을 열어 강호의 세력들을 살펴보십시오.' };
          if (fighters().length < 6) return { sub: '무관의 일꾼은 무사, 망루의 일꾼은 궁수가 됩니다. 무관을 하나 더 짓거나 망루를 세우십시오.' };
          return { sub: '집을 늘리고 민심을 지키며 사람을 모으십시오. 인구 35면 읍이 됩니다.' };
        },
      }],
      reward: () => ({ silver: 250, stone: 80, fame: 15 }),
      rewardWhy: '읍 승격 축하',
      end: () => [{ m: 'smile', t: `${hjp('읍', '邑')}이 되었습니다! 이제 표국과 석벽을 세울 수 있습니다. 현청이 은자 250냥과 석재 80을 보내왔습니다.` }],
    },
    {
      title: '이름을 떨치다', seal: '名',
      steps: [{
        id: 'renown', title: '진으로 키우고 이름을 떨치기', why: '사람이 모이고 이름이 높아야 강호가 마을을 두려워합니다.',
        lines: () => [
          { m: 'smile', t: '제5장, 이름을 떨칠 때입니다. 습격을 막아낼 때마다, 객잔에 고수가 머물 때마다, 사당에 향이 오를 때마다 명성이 쌓입니다.' },
          { m: 'calm', t: `인구 70의 ${hjp('진', '鎭')}, 그리고 명성 200. 거기까지 가면 현성도 멀지 않습니다.` },
        ],
        goals: () => [
          goal(`인구 70 · ${rankName(3)}`, S.rank >= 3 ? Math.max(70, popCount()) : popCount(), 70, { tip: '기와집으로 집 칸을 늘리고, 시장·정자·사당으로 민심을 북돋우십시오.' }),
          goal('명성', S.fame, 200, { tip: '습격 격퇴, 객잔, 사당, 무술 대회가 명성을 올립니다.' }),
        ],
        guide: () => ({ sub: '기와집으로 집 칸을 늘리고, 객잔·사당으로 명성을 쌓으십시오.' }),
      }],
      reward: () => ({ silver: 400 }),
      rewardWhy: '강호의 예물',
      end: () => [{ m: 'smile', t: `${hjp('진', '鎭')}이 되었습니다. 강호의 이야기꾼들이 이 마을 이름을 입에 올리기 시작했고, 상단들이 예물로 은자 400냥을 보내왔습니다.` }],
    },
    {
      title: '천하제일촌', seal: '天',
      steps: [{
        id: 'final', title: '현성을 이루고 명성 400 떨치기', why: '천하제일촌까지 마지막 고개입니다.',
        lines: () => [
          { m: 'calm', t: `마지막 고개입니다. 인구 120의 ${hjp('현성', '縣城')}, 그리고 명성 400.` },
          { m: 'smile', t: '부임하시던 날 잿더미뿐이던 마을이 여기까지 왔습니다. 끝까지 곁에 있겠습니다, 영주님.' },
        ],
        goals: () => [
          goal(`인구 120 · ${rankName(4)}`, S.rank >= 4 ? Math.max(120, popCount()) : popCount(), 120),
          goal('명성', S.fame, 400),
        ],
        done: () => !!S.victory || (S.rank >= 4 && S.fame >= 400),
        guide: () => ({ sub: '집과 일자리를 늘리고, 습격을 막아 이름을 높이십시오.' }),
      }],
      reward: () => ({}),
      end: () => [
        { m: 'smile', t: `영주님… 해내셨습니다. 부임하시던 날 잿더미뿐이던 ${vn()}${pp(S.name, '이/가')} 이제 현성이 되었습니다.` },
        { m: 'calm', t: '소인은 장부를 덮지 않겠습니다. 천하제일촌은 이루는 것보다 지키는 것이 더 어려운 법이니까요.' },
      ],
    },
  ];

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
      id: 'budget', cd: 5, when: () => adminReal() && S.res.silver >= 350 && budgetTotal() <= 0,
      lines: () => [
        { m: 'calm', t: `곳간에 은자 ${fmt(S.res.silver)}냥이 놀고 있습니다. 그런데 육방에는 예산이 한 푼도 없군요.` },
        { m: 'smile', t: '[육방]에서 부서마다 예산을 나눠 주시면 필요한 것을 알아서 짓고 처리합니다. 은자는 굴려야 불어나지요.' },
      ],
      guide: () => ({ sel: '#btn-admin', tag: '육방' }),
    },
  ];

  // ── 무작위 사건 거르기 ──────────────────────────
  const LIGHT_EVENTS = new Set(['merchant', 'wedding', 'festival', 'refugees', 'harvest', 'injured']);
  const HOSTILE_EVENTS = new Set(['bandit_toll', 'gang_protection', 'spy', 'cave', 'inn_brawl', 'tournament', 'tiger', 'fire']);
  const HEAVY_EVENTS = new Set(['plague', 'sect_war', 'conscription', 'hyeolwol_offer']);
  const GLOOMY_EVENTS = new Set(['drought', 'gwanbu_tax']);

  function freshState() {
    return {
      v: 1, chapter: 0, step: 0, skipped: false, intro: 'pending', finished: false,
      flags: {}, acks: {}, rewards: {}, granted: {}, advice: {}, budgets: {},
      raid: 'none', raidDone: false, raidPaid: 0, ruins: [], newLord: false, arrivedAt: 0, stepAt: 0,
      adviceAt: -999, collapsed: false, petitionStub: false, adminStub: false,
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
    if (S.victory) { st.chapter = CH.length - 1; st.finished = true; }
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
    _acc: 0, _sites: {}, _flash: 0, _scrolled: '', _trk: '', _open: false, _checking: false, _face: '', _adviseRaid: false,

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
      if (!S.story || typeof S.story !== 'object') { S.story = legacyState(); return; }
      const st = S.story, f = freshState();
      for (const k in f) if (st[k] === undefined || st[k] === null) st[k] = f[k];
      st.chapter = clamp(Math.floor(+st.chapter || 0), 0, CH.length - 1);
      st.step = Math.max(0, Math.floor(+st.step || 0));
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
      const ch = st.chapter;
      if (st.intro !== 'done') return false;
      if (st.skipped) {
        const day = dayOf();
        if (HEAVY_EVENTS.has(id)) return ch >= 3 || day >= 10;
        if (HOSTILE_EVENTS.has(id)) return ch >= 2 || day >= 5;
        return true;
      }
      if (ch === 0) return LIGHT_EVENTS.has(id) && dayOf() >= 1;
      if (ch === 1) return !HOSTILE_EVENTS.has(id) && !HEAVY_EVENTS.has(id) && !GLOOMY_EVENTS.has(id);
      if (ch === 2) return !HEAVY_EVENTS.has(id);
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
      this.say(lines, { tag: 'hint', now: true, guide: st.skipped && g ? () => this.currentGuide(true) : null, ack, onAck: ack ? () => this.ackStep(step.id) : null });
    },

    info() {
      const st = ST();
      if (!st) return { title: '', why: '', goals: [] };
      if (st.finished) return { title: '천하제일촌을 지키기', why: '이룬 것을 지키는 일만 남았습니다. 마음껏 다스리십시오.', goals: [] };
      if (st.intro !== 'done') return { title: '총관의 말 듣기', why: '새로 부임한 마을의 형편부터 들어 보십시오.', goals: [] };
      const ch = CH[st.chapter];
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
      const ch = CH[st.chapter];
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
        const ch = CH[st.chapter];
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
      const ch = CH[st.chapter];
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
      const i = st.chapter, ch = CH[i];
      if (!st.rewards[i]) {
        st.rewards[i] = 1;
        const r = ch.reward ? ch.reward() : {};
        grant(r, ch.rewardWhy || '보상');
      }
      logMsg(`제${i + 1}장 「${ch.title}」${pp(ch.title, '을/를')} 마쳤다.`, 'good');
      const end = ch.end ? ch.end() : [];
      if (end.length) this.say(end, { tag: 'chapter', pause: !st.skipped && i <= 1 });
      if (i + 1 >= CH.length) {
        st.finished = true;
        Bus.emit('storyStep', st.chapter, st.step);
        return;
      }
      st.chapter = i + 1;
      st.step = 0;
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
        if (this.say(a.lines(), { topic: a.id, cd: a.cd, guide: a.guide, expire: 12 })) { st.adviceAt = S.time; return; }
      }
    },
    report() {
      const pop = popCount(), house = housingTotal(), days = foodDays();
      const worst = happinessFactors().filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1])[0];
      const pend = pendingPetitions();
      const threats = FACTION_ORDER.filter(k => FACTIONS[k].military && S.vassal !== k && (k === 'heukpung' || rel(k) < -20))
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
      return step && step.guide ? step.guide() : null;
    },
    chapterLabel() { const st = ST(); return `제${(st ? st.chapter : 0) + 1}장`; },

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
      this._card = false; this._focusKey = ''; this._adviseRaid = false;
      if (typeof G !== 'undefined') G.markers = [];
      if (this.el) { this.el.card.hidden = true; this.el.scrim.hidden = true; this.el.ring.hidden = true; this.el.tag.hidden = true; }
    },
    chapterCard() {
      const st = ST();
      if (!this.el || !st) return;
      const ch = CH[st.chapter];
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
      const ch = CH[st.chapter];
      const compact = el.trk.classList.contains('compact');
      const collapsed = compact ? !this._open : !!st.collapsed;
      const sub = !st.skipped && this.guideNow && this.guideNow.sub && !st.finished ? this.guideNow.sub : '';
      const goals = info.goals.map(x => `<li class="${x.done ? 'done' : ''}"><i></i><span>${x.label}</span>${x.one ? '' : `<b>${fmt(x.cur)}/${fmt(x.max)}</b>`}</li>`).join('');
      const pop = popCount();
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
            <div class="trk-final-h">최종 목표 <b>${hj('天下第一村')} 천하제일촌</b></div>
            ${bar(pop, STORY_POP, `인구 ${pop} / ${STORY_POP} · 현성(${hj('縣城')})`)}
            ${bar(S.fame, STORY_FAME, `명성 ${fmt(S.fame)} / ${STORY_FAME}`)}
          </div>
        </div>`;
      el.trk.classList.toggle('collapsed', collapsed);
      if (html !== this._trk || force) { el.trk.innerHTML = html; this._trk = html; }
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
  Bus.on('eventResolved', id => {
    const st = ST();
    if (!st || id !== '_raid') return;
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
  Bus.on('occupied', () => { setTimeout(() => { const st = ST(); if (st && st.intro === 'done') { st.adviceAt = -999; M.advise(true); } }, 60); });

  return M;
})();
