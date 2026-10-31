'use strict';
// ───────────────────────────────────────────────
// 천하도(天下圖): 새 게임의 고을 고르기(pick)와 천하의 판도 보기(view). 설계는 docs/jianghu.md §10
// - 고르기(z 52)는 제목 화면 위에서 S 없이 돈다: 넘겨받은 world, JH.makeWorld·siteInfo, SITES·REGIONS·CAMPS·FACTIONS 만 읽는다
// - 보기(z 29)는 S.jh 를 읽기만 한다. 열려 있는 동안 시간은 main.js 가 멈춘다
// - 캔버스 하나. 한지·바다·지역 경계·강·산·영역은 화면 밖 캔버스(정적 겹)에 담아 두고, 이웃 선·전쟁·고리만 매번 그린다
// - 문장·지역 이름·고을·강 이름은 DOM 으로 얹는다(캔버스 글자에는 풀이 말풍선이 뜨지 않는다)
// ───────────────────────────────────────────────
const WorldMap = (() => {
  const WW = 1000, WH = 700, PAD = 26;          // 천하도 좌표(§3)와 종이 둘레 여백
  const G = 4, GX = WW / G + 1, GY = WH / G + 1; // 영역 격자 (천하도 4 단위마다 한 점)
  const INF_R = 82, LOCAL_R = 24, INF_MIN = 14;  // 영향 = 힘 / (1 + (d/R)²). INF_MIN 아래는 임자 없는 땅
  const RMAX = 2.6;                               // 정적 겹의 해상도 상한 (천하도 한 단위에 화면 점 몇 개)
  const INK = '#3b2c20', PAPER = '#efe3c3';

  // 천하도에만 나오는 한자 (data.js 의 풀이는 덮어쓰지 않는다)
  const WM_GLOSS = {
    '黃河': ['황하', '누런 강. 서쪽 고원에서 북으로 크게 굽이쳐 산서와 섬서 사이를 내려오고, 하남을 지나 동쪽 바다로 든다.'],
    '長江': ['장강', '긴 강. 천하에서 가장 긴 강으로, 사천에서 호북을 지나 강남의 바다로 든다.'],
    '獨': ['홀로 독', '홀로 섬. 누구의 깃발도 들지 않은 독립의 표.'],
  };
  for (const [k, v] of Object.entries(WM_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

  // ── 지리 (씨앗과 상관없이 늘 같다) ──
  // 동쪽·동남쪽 바다. 발해만, 산동 반도, 장강 어귀, 남쪽 바닷가를 지나 지도 밖에서 닫는다
  const SEA = [[1040, 166], [965, 172], [920, 179], [884, 193], [860, 206], [848, 222], [842, 238], [852, 250], [880, 251], [905, 262],
    [897, 284], [868, 296], [852, 316], [850, 345], [860, 372], [852, 396], [855, 430], [850, 470], [846, 510], [850, 545], [838, 580],
    [815, 610], [785, 628], [745, 642], [705, 656], [662, 668], [622, 677], [588, 688], [566, 712], [566, 740], [1040, 740]];
  const RIVERS = [
    { name: '황하', hanja: '黃河', w: [0.7, 3.0], at: 0.15, off: -9,
      pts: [[150, 318], [215, 300], [282, 282], [330, 236], [372, 176], [420, 138], [468, 128], [505, 150], [518, 196], [512, 250], [530, 282],
        [572, 292], [612, 290], [652, 282], [700, 268], [748, 250], [800, 238], [846, 232]] },
    { name: '장강', hanja: '長江', w: [0.8, 3.6], at: 0.74, off: 11,
      pts: [[112, 502], [170, 478], [220, 470], [262, 452], [300, 440], [338, 446], [380, 438], [424, 420], [462, 404], [500, 392], [540, 392],
        [580, 382], [620, 386], [662, 394], [700, 384], [740, 374], [780, 366], [820, 362], [858, 372]] },
  ];
  // 산줄기 (먹 봉우리를 줄지어 찍는다)
  const RANGES = [
    [[40, 128], [140, 116], [250, 124]], [[360, 92], [450, 80], [545, 90]], [[40, 372], [140, 360], [246, 368]],
    [[330, 334], [420, 328], [520, 340]], [[598, 116], [606, 180], [612, 238]], [[262, 392], [274, 470], [288, 556]],
    [[470, 574], [580, 566], [700, 560]], [[716, 466], [740, 505], [758, 540]], [[905, 56], [945, 76], [985, 102]],
  ];
  const BIOME = [['forest', '숲', ['드묾', '보통', '울창']], ['water', '물', ['메마름', '보통', '넉넉']], ['hills', '산', ['평탄', '보통', '험준']],
    ['fertile', '들', ['척박', '보통', '기름짐']], ['cold', '추위', ['따뜻함', '보통', '혹독']]];
  const VIEWS = [['camp', '계열'], ['rel', '나와의 관계'], ['threat', '위협']];

  const byId = id => document.getElementById(id);
  const fac = id => FACTIONS[id];
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const isLocal = id => !!fac(id) && fac(id).home === 'local';
  const siteKeys = () => Object.keys(SITES);
  // 한자 풀이 속성: 제목은 '河北 · 하북', 본문은 풀이 + 덧붙임
  function gl(h, extra) {
    const g = HANJA_GLOSS[h];
    const body = [g ? g[1] : '', extra || ''].filter(Boolean).join('\n');
    return `data-tip-title="${escapeHtml(h + (g ? ' · ' + g[0] : ''))}"${body ? ` data-tip="${escapeHtml(body)}"` : ''}`;
  }
  // 천하도 인장 (데스크톱은 세로, 좁은 화면은 가로로 CSS 가 놓는다)
  const SEAL = `<span class="wm-seal" ${gl('天下圖')}>${[...'天下圖'].map(ch => `<i>${ch}</i>`).join('')}</span>`;
  // '정파(正派)'처럼 괄호 속 한자에 풀이를 단다
  const paren = s => escapeHtml(s).replace(/\(([^)]+)\)/, (m, h) => `(<span ${gl(h)}>${h}</span>)`);
  // 움직임을 줄이라는 설정이면 칼과 고리가 맥박 치지 않는다
  const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 결정적 잡음 (해안·경계의 떨림이 늘 같게)
  function hash(i, s) {
    let h = Math.imul((i | 0) ^ Math.imul(s | 0, 0x9e3779b1), 0x27d4eb2d);
    h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  // 선분마다 잘게 나누어 옆으로 조금씩 흔든다
  function rough(pts, amp, seed, closed, step = 9) {
    const out = [], n = pts.length - (closed ? 0 : 1);
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, steps = Math.max(1, Math.round(len / step));
      const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
      for (let s = 0; s < steps; s++) {
        const t = s / steps, o = s ? (hash(i * 37 + s, seed) - 0.5) * 2 * amp : 0;
        out.push([a[0] + (b[0] - a[0]) * t + nx * o, a[1] + (b[1] - a[1]) * t + ny * o]);
      }
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
  }
  // 점들을 이어 부드러운 길을 낸다 (가운데점 2차 곡선)
  function smooth(c, pts, closed) {
    const n = pts.length, mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (closed) {
      const s = mid(pts[n - 1], pts[0]);
      c.moveTo(s[0], s[1]);
      for (let i = 0; i < n; i++) { const q = mid(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
      c.closePath();
    } else {
      c.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) { const q = mid(pts[i], pts[i + 1]); c.quadraticCurveTo(pts[i][0], pts[i][1], q[0], q[1]); }
      c.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  // 캣멀롬 곡선으로 촘촘한 점 (강의 굵기를 점마다 바꾸려고)
  function spline(pts, per = 8) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < per; s++) {
        const t = s / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  const RIV = RIVERS.map(r => Object.assign({ dense: spline(r.pts) }, r));
  const SEA_R = rough(SEA, 3.2, 11, true, 8);

  // 지역 경계: 열여덟 중심의 보로노이 (반평면 자르기)
  function clipHalf(poly, f) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa <= 0) out.push(a);
      if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  const REG = Object.keys(REGIONS).map(k => {
    const A = REGIONS[k];
    let poly = [[0, 0], [WW, 0], [WW, WH], [0, WH]];
    for (const k2 in REGIONS) {
      if (k2 === k) continue;
      const B = REGIONS[k2], mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, dx = B.x - A.x, dy = B.y - A.y;
      poly = clipHalf(poly, p => (p[0] - mx) * dx + (p[1] - my) * dy);
    }
    return { k, poly, x: A.x, y: A.y, outer: !!A.outer };
  });
  // 경계선 하나씩 (두 지역이 함께 쓰는 변은 한 번만). 지도 테두리 위의 변은 뺀다
  const REG_EDGES = (() => {
    const seen = new Set(), out = [];
    const onRim = p => p[0] < 0.5 || p[0] > WW - 0.5 || p[1] < 0.5 || p[1] > WH - 0.5;
    for (const R of REG) for (let i = 0; i < R.poly.length; i++) {
      const a = R.poly[i], b = R.poly[(i + 1) % R.poly.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1 || (onRim(a) && onRim(b))) continue;
      const ka = a.map(Math.round).join(','), kb = b.map(Math.round).join(',');
      const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (seen.has(key)) continue;
      seen.add(key);
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const two = REG.slice().sort((p, q) => Math.hypot(p.x - m[0], p.y - m[1]) - Math.hypot(q.x - m[0], q.y - m[1])).slice(0, 2);
      out.push({ pts: rough([a, b], 2.2, out.length * 7 + 3, false, 10), frontier: two[0].outer !== two[1].outer });
    }
    return out;
  })();
  const inPoly = (poly, x, y) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const segDist = (x, y, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2, 0, 1);
    return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
  };

  // ── 상태 (저장하지 않는다) ──
  const st = {
    open: false, mode: null,
    world: null, onPick: null, onCancel: null, site: null, info: null, busy: false,   // 고르기
    sel: null, selWar: null, view: 'camp', hiCamp: null, fold: false,                  // 보기
    cam: { x: WW / 2, y: WH / 2, k: 1 }, minK: 1, vw: 0, vh: 0, dpr: 1,
    dirty: true, domDirty: true, anim: false, raf: 0, panelAt: 0, settleAt: 0, lastPanel: '', lastSig: '',
    stat: null, statSig: '', res: 0, own: null, ownSig: '', land: null, landKey: '', spots: null, spotKey: '',
    ptr: new Map(), drag: null, pinch: null, disp: {}, m: null, cover: false,
  };
  let D = null;   // DOM 참조

  // ── 지금 보는 천하 (고르기는 넘겨받은 world, 보기는 S.jh) ──
  const pickMode = () => st.mode === 'pick';
  function seatOf(id) {
    if (pickMode()) return st.world.seats[id] || (st.info && st.info.localSeats[id]) || null;
    return S.jh.seats[id] || null;
  }
  function powerOf(id) { return pickMode() ? (st.world.power[id] || (fac(id) ? fac(id).power : 0)) : (S.jh.power[id] || 0); }
  function aliveF(id) { return pickMode() ? !isLocal(id) || !!(st.info && st.info.localSeats[id]) : S.jh.dead[id] === undefined; }
  function nearList() { return pickMode() ? (st.info ? st.info.near : []) : S.jh.near; }
  function homeSite() { return pickMode() ? SITES[st.site] : SITES[S.jh.site] || SITES.henan_field; }

  // ── 땅과 바다 ──
  function seaPath(c) { smooth(c, SEA_R, true); }
  function islands() {
    const hs = (pickMode() ? st.world.seats : S.jh.seats).haerang || { x: 950, y: 420 };
    const blob = (x, y, rx, ry, seed) => {
      const pts = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 0.78 + hash(i, seed) * 0.4; pts.push([x + Math.cos(a) * rx * r, y + Math.sin(a) * ry * r]); }
      return pts;
    };
    return [blob(hs.x + 2, hs.y + 3, 30, 18, 5), blob(hs.x - 40, hs.y - 30, 8, 6, 6), blob(hs.x + 34, hs.y + 34, 10, 7, 7),
      blob(hs.x - 26, hs.y + 38, 6, 5, 8), blob(890, 590, 9, 20, 9)];
  }
  // 격자 한 점이 땅인가 (작은 캔버스에 땅을 칠해 읽는다)
  function landMask() {
    const hs = (pickMode() ? st.world.seats : S.jh.seats).haerang || {};
    const key = `${hs.x},${hs.y}`;
    if (st.land && st.landKey === key) return st.land;
    const cv = document.createElement('canvas');
    cv.width = GX; cv.height = GY;
    const c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, GX, GY);
    c.setTransform(1 / G, 0, 0, 1 / G, 0.5, 0.5);
    c.fillStyle = '#000'; c.beginPath(); seaPath(c); c.fill();
    c.fillStyle = '#fff'; for (const p of islands()) { c.beginPath(); smooth(c, p, true); c.fill(); }
    const d = c.getImageData(0, 0, GX, GY).data, m = new Uint8Array(GX * GY);
    for (let i = 0; i < m.length; i++) m[i] = d[i * 4] > 127 ? 1 : 0;
    st.land = m; st.landKey = key;
    return m;
  }

  // ── 영역: 격자 점마다 영향이 가장 큰 세력 ──
  function owners() {
    const ids = FACTION_ORDER.filter(id => aliveF(id) && seatOf(id) && (!pickMode() || !isLocal(id)));
    const sig = (pickMode() ? 'p' + st.world.seed : 'v') + ids.map(id => `${id}:${Math.round(powerOf(id))}:${seatOf(id).x},${seatOf(id).y}`).join(';');
    if (st.own && st.ownSig === sig) return st.own;
    const land = landMask();
    const src = ids.map(id => { const s = seatOf(id), R = isLocal(id) ? LOCAL_R : INF_R; return { x: s.x, y: s.y, P: Math.max(1, powerOf(id)), q: 1 / (R * R) }; });
    const lab = new Int16Array(GX * GY), str = new Float32Array(GX * GY);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const n = j * GX + i;
      if (!land[n]) { lab[n] = -2; continue; }
      const x = i * G, y = j * G;
      let best = -1, bv = INF_MIN;
      for (let f = 0; f < src.length; f++) {
        const s = src[f], dx = x - s.x, dy = y - s.y, v = s.P / (1 + (dx * dx + dy * dy) * s.q);
        if (v > bv) { bv = v; best = f; }
      }
      lab[n] = best;
      if (best >= 0) str[n] = Math.min(1, bv / src[best].P);
    }
    st.own = { ids, lab, str, src }; st.ownSig = sig;
    return st.own;
  }
  function ownerAt(wx, wy) {
    const o = st.own;
    if (!o) return null;
    const i = Math.round(wx / G), j = Math.round(wy / G);
    if (i < 0 || j < 0 || i >= GX || j >= GY) return null;
    const l = o.lab[j * GX + i];
    return l >= 0 ? o.ids[l] : null;
  }
  // 보기에 따른 영역 빛깔 [r, g, b, 진하기 배수]
  function tint(id) {
    const camp = fac(id).camp;
    let col = hex(CAMPS[camp].color), a = 1;
    if (!pickMode() && st.view === 'rel') {
      if (S.vassal === id) col = [199, 154, 44];
      else {
        const t = clamp(rel(id) / 100, -1, 1), e = t < 0 ? [158, 42, 30] : [44, 122, 78], n = [150, 138, 112];
        col = n.map((v, i) => Math.round(v + (e[i] - v) * Math.abs(t)));
      }
    } else if (!pickMode() && st.view === 'threat') {
      const lv = threatLevel(id);
      if (lv === null) { col = [140, 128, 108]; a = 0.35; }
      else col = lv.spied ? [0, 1, 2].map(i => Math.round([168, 150, 112][i] + ([170, 36, 26][i] - [168, 150, 112][i]) * lv.t)) : [[168, 150, 112], [214, 146, 44], [170, 36, 26]][lv.n];
    }
    if (st.hiCamp && camp !== st.hiCamp) a *= 0.3;
    return [col[0], col[1], col[2], a];
  }
  // 위협 수준: 이웃이고 군사가 있는 세력만. 첩자가 없으면 낱말 셋으로만 (§7)
  function threatLevel(id) {
    if (!fac(id).military || !S.jh.near.includes(id) || S.vassal === id) return null;
    const th = S.factions[id] ? S.factions[id].threat : 0;
    if (JH.spied(id)) return { spied: true, t: clamp(th / 100, 0, 1), pct: Math.round(th) };
    const w = JH.threatWord(id);
    return { spied: false, n: w === '잠잠' ? 0 : w === '술렁' ? 1 : 2, word: w };
  }

  // ── 정적 겹 ──
  let paperPat = null;
  function paperTexture() {
    if (paperPat) return paperPat;
    const c = document.createElement('canvas'), n = 200;
    c.width = c.height = n;
    const g = c.getContext('2d'), R = mulberry32(77);
    for (let i = 0; i < 700; i++) { g.fillStyle = R() < 0.55 ? `rgba(110,82,46,${0.02 + R() * 0.05})` : `rgba(255,252,240,${0.05 + R() * 0.08})`; g.fillRect(R() * n, R() * n, 1 + R() * 1.6, 1 + R() * 1.6); }
    g.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
      const x = R() * n, y = R() * n, a = R() * Math.PI * 2, l = 5 + R() * 14;
      g.strokeStyle = `rgba(125,96,58,${0.05 + R() * 0.07})`; g.lineWidth = 0.5 + R() * 0.4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.7) * l * 0.5, y + Math.sin(a + 0.7) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    paperPat = c;
    return c;
  }
  function staticSig() {
    let s = `${st.mode}|${st.view}|${st.hiCamp}|${st.ownSig}`;
    if (!pickMode() && st.view === 'rel') s += '|' + S.vassal + FACTION_ORDER.map(id => Math.round(rel(id))).join(',');
    if (!pickMode() && st.view === 'threat') s += '|' + S.jh.near.map(id => { const l = threatLevel(id); return l ? (l.spied ? l.pct : l.n) : '-'; }).join(',');
    return s;
  }
  function ensureStatic(exact) {
    owners();
    const want = clamp(st.cam.k * st.dpr, 0.35, RMAX);
    let res = st.res;
    if (!st.stat || (exact ? Math.abs(want - res) / want > 0.08 : (want > res * 1.3 || want < res * 0.55))) res = want;
    const sig = staticSig();
    if (st.stat && res === st.res && sig === st.statSig) return;
    st.res = res; st.statSig = sig;
    buildStatic();
    st.dirty = true;
  }
  function buildStatic() {
    const r = st.res, u = st.dpr / r;   // u: 화면 1px 의 천하도 길이 (정적 겹을 만든 배율에서)
    const W = Math.ceil((WW + 2 * PAD) * r), H = Math.ceil((WH + 2 * PAD) * r);
    const cv = st.stat || (st.stat = document.createElement('canvas'));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    c.setTransform(r, 0, 0, r, PAD * r, PAD * r);
    c.lineJoin = c.lineCap = 'round';
    // 땅만 남기는 자르기 (바다는 둘레 사각형과 겹쳐 빠지고, 섬은 그 안에서 다시 든다)
    const landClip = isle => {
      c.beginPath(); c.rect(0, 0, WW, WH); c.clip();
      c.beginPath(); c.rect(-PAD, -PAD, WW + 2 * PAD, WH + 2 * PAD); seaPath(c);
      if (isle) for (const p of isl) smooth(c, p, true);
      c.clip('evenodd');
    };
    const isl = islands();

    // 종이 (그림자, 바탕, 결, 가장자리 그을림)
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 18 * st.dpr; c.shadowOffsetY = 5 * st.dpr;
    c.fillStyle = PAPER; c.fillRect(0, 0, WW, WH);
    c.restore();
    const pat = c.createPattern(paperTexture(), 'repeat');
    if (pat && pat.setTransform && typeof DOMMatrix === 'function') pat.setTransform(new DOMMatrix().scale(1 / r * st.dpr));
    c.fillStyle = pat; c.fillRect(0, 0, WW, WH);
    // 새외는 조금 누렇게
    c.save(); c.beginPath(); c.rect(0, 0, WW, WH); c.clip();
    c.fillStyle = 'rgba(150,112,60,0.09)';
    for (const R of REG) if (R.outer) { c.beginPath(); R.poly.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); }
    c.restore();

    // 바다: 엷은 쪽빛, 물결 무늬, 물가 띠
    c.save(); c.beginPath(); c.rect(0, 0, WW, WH); c.clip();
    c.beginPath(); seaPath(c); c.fillStyle = 'rgba(92,128,140,0.30)'; c.fill();
    c.save(); c.beginPath(); seaPath(c); c.clip();
    c.strokeStyle = 'rgba(48,82,96,0.28)'; c.lineWidth = 0.9 * u;
    const land = landMask();
    for (let y = 150, row = 0; y < WH + 20; y += 17, row++) for (let x = 560 + (row % 2) * 13; x < WW + 20; x += 26) {
      const i = Math.round(x / G), j = Math.round(y / G);
      if (i < GX && j < GY && land[j * GX + i]) continue;
      if (isl.some(p => p.some(q => Math.hypot(q[0] - x, q[1] - y) < 14))) continue;
      c.beginPath(); c.arc(x - 3.5, y, 3.5, Math.PI * 1.1, Math.PI * 1.9); c.arc(x + 3.5, y, 3.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    }
    c.lineWidth = 7 * u; c.strokeStyle = 'rgba(70,108,120,0.20)';
    c.beginPath(); seaPath(c); c.stroke();
    c.restore();
    for (const p of isl) { c.beginPath(); smooth(c, p, true); c.fillStyle = PAPER; c.fill(); c.fillStyle = pat; c.fill(); }
    c.restore();

    // 영역 (계열 빛깔, 먹물처럼 번지게). 땅 안에만
    const o = owners();
    const img = document.createElement('canvas');
    img.width = GX; img.height = GY;
    const ic = img.getContext('2d'), id = ic.createImageData(GX, GY), px = id.data;
    const tints = o.ids.map(tint);
    for (let n = 0; n < o.lab.length; n++) {
      const l = o.lab[n];
      if (l < 0) continue;
      const t = tints[l], a = (0.17 + 0.27 * o.str[n]) * t[3];
      px[n * 4] = t[0]; px[n * 4 + 1] = t[1]; px[n * 4 + 2] = t[2]; px[n * 4 + 3] = Math.round(a * 255);
    }
    ic.putImageData(id, 0, 0);
    c.save(); landClip(true);
    c.globalCompositeOperation = 'multiply';
    c.imageSmoothingEnabled = true;
    c.drawImage(img, 0, 0, GX, GY, -G / 2, -G / 2, GX * G, GY * G);
    c.globalCompositeOperation = 'source-over';
    c.restore();

    // 사막 (서역의 모래 점)
    c.save(); landClip();
    c.fillStyle = 'rgba(112,84,46,0.32)';
    const R = mulberry32(31);
    for (let i = 0; i < 420; i++) {
      const x = 20 + R() * 280, y = 150 + R() * 190;
      if (RIV[0].dense.some(p => Math.hypot(p[0] - x, p[1] - y) < 9)) continue;
      c.beginPath(); c.arc(x, y, (0.5 + R() * 0.5) * u * 1.2, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    // 강: 먹빛 쪽물, 하구로 갈수록 굵게
    c.save(); landClip();
    for (const rv of RIV) {
      const P = rv.dense, n = P.length, L = [], Rr = [];
      for (let i = 0; i < n; i++) {
        const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const w = (rv.w[0] + (rv.w[1] - rv.w[0]) * Math.pow(i / (n - 1), 0.8)) / 2 + 0.25 * u;
        const nx = -(b[1] - a[1]) / len * w, ny = (b[0] - a[0]) / len * w;
        L.push([P[i][0] + nx, P[i][1] + ny]); Rr.push([P[i][0] - nx, P[i][1] - ny]);
      }
      c.beginPath(); smooth(c, P, false); c.strokeStyle = 'rgba(246,240,224,0.7)'; c.lineWidth = rv.w[1] + 3 * u; c.stroke();
      c.beginPath(); c.moveTo(L[0][0], L[0][1]);
      for (const p of L) c.lineTo(p[0], p[1]);
      for (let i = n - 1; i >= 0; i--) c.lineTo(Rr[i][0], Rr[i][1]);
      c.closePath(); c.fillStyle = 'rgba(52,96,112,0.82)'; c.fill();
    }
    c.restore();

    // 산: 먹 봉우리. 본산·고을·강 위에는 찍지 않는다
    const seats = FACTION_ORDER.map(seatOf).filter(Boolean);
    const sites = siteKeys().map(k => ({ x: SITES[k].x, y: SITES[k].y }));
    const clearOf = (x, y) => seats.every(s => Math.hypot(s.x - x, s.y - y) > 17) && sites.every(s => Math.hypot(s.x - x, s.y - y) > 15)
      && RIV.every(rv => rv.dense.every(p => Math.hypot(p[0] - x, p[1] - y) > 7));
    const peaks = [];
    RANGES.forEach((rg, ri) => {
      const dense = rough(rg, 4, 50 + ri, false, 14);
      dense.forEach((p, i) => { for (const off of [-1, 1]) if (off < 0 || hash(i, ri + 90) < 0.5) peaks.push([p[0] + (hash(i, ri) - 0.5) * 6, p[1] + off * 5 + (hash(i, ri + 9) - 0.5) * 4, 6.5 + hash(i, ri + 3) * 5]); });
    });
    const R2 = mulberry32(19);
    for (let i = 0; i < 26; i++) peaks.push([70 + R2() * 180, 410 + R2() * 150, 5 + R2() * 4]);
    peaks.sort((a, b) => a[1] - b[1]);
    c.save(); landClip();
    for (const [x, y, s] of peaks) {
      if (!clearOf(x, y)) continue;
      c.beginPath(); c.moveTo(x, y - s * 1.05); c.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s * 1.05, y); c.lineTo(x + s * 0.1, y); c.closePath();
      c.fillStyle = 'rgba(70,52,34,0.22)'; c.fill();
      c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s * 0.35, y - s * 0.55, x, y - s * 1.05); c.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s * 1.05, y);
      c.strokeStyle = 'rgba(52,38,26,0.78)'; c.lineWidth = 1.05 * u; c.stroke();
      c.beginPath(); c.moveTo(x - s * 0.12, y - s * 0.62); c.lineTo(x + s * 0.18, y - s * 0.2); c.lineWidth = 0.7 * u; c.stroke();
    }
    c.restore();

    // 지역 경계 (일점쇄선), 중원과 새외 사이는 겹선
    c.save(); landClip();
    for (const e of REG_EDGES) {
      if (e.frontier) { c.beginPath(); smooth(c, e.pts, false); c.setLineDash([]); c.strokeStyle = 'rgba(90,66,44,0.22)'; c.lineWidth = 3.6 * u; c.stroke(); }
      c.beginPath(); smooth(c, e.pts, false);
      c.setLineDash([7 * u, 2.6 * u, 1.3 * u, 2.6 * u]);
      c.strokeStyle = e.frontier ? 'rgba(70,48,30,0.62)' : 'rgba(80,58,38,0.48)'; c.lineWidth = (e.frontier ? 1.2 : 0.95) * u; c.stroke();
    }
    c.setLineDash([]);
    c.restore();

    // 세력 경계: 격자의 두 이웃 점 임자가 다르면, 두 세력의 영향이 같아지는 자리를 찾아 잇는다 (계열이 다르면 진하게)
    const weak = new Path2D(), strong = new Path2D();
    const lab = o.lab, campOf = l => (l >= 0 ? fac(o.ids[l]).camp : null);
    const infAt = (l, x, y) => { if (l < 0) return INF_MIN; const s = o.src[l], dx = x - s.x, dy = y - s.y; return s.P / (1 + (dx * dx + dy * dy) * s.q); };
    for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
      const a = lab[j * GX + i], b = lab[j * GX + i + 1], cc = lab[(j + 1) * GX + i], d = lab[(j + 1) * GX + i + 1];
      if (a === b && a === cc && a === d) continue;
      const pts = [];
      let hard = false;
      const edge = (p, q, x0, y0, x1, y1) => {
        if (p === q || p === -2 || q === -2) return;
        const f0 = infAt(p, x0, y0) - infAt(q, x0, y0), f1 = infAt(p, x1, y1) - infAt(q, x1, y1);
        const t = f0 - f1 > 1e-6 ? clamp(f0 / (f0 - f1), 0.05, 0.95) : 0.5;
        pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
        if (campOf(p) !== campOf(q)) hard = true;
      };
      const x0 = i * G, y0 = j * G, x1 = x0 + G, y1 = y0 + G;
      edge(a, b, x0, y0, x1, y0); edge(cc, d, x0, y1, x1, y1); edge(a, cc, x0, y0, x0, y1); edge(b, d, x1, y0, x1, y1);
      if (pts.length < 2) continue;
      const P = hard ? strong : weak;
      if (pts.length === 2) { P.moveTo(pts[0][0], pts[0][1]); P.lineTo(pts[1][0], pts[1][1]); }
      else {
        const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length;
        for (const m of pts) { P.moveTo(cx, cy); P.lineTo(m[0], m[1]); }
      }
    }
    c.save(); landClip(true);
    c.strokeStyle = 'rgba(46,32,22,0.26)'; c.lineWidth = 0.7 * u; c.stroke(weak);
    c.strokeStyle = 'rgba(46,32,22,0.5)'; c.lineWidth = 1.05 * u; c.stroke(strong);
    c.restore();

    // 물가 먹선
    c.save(); c.beginPath(); c.rect(0, 0, WW, WH); c.clip();
    c.strokeStyle = 'rgba(58,42,28,0.8)'; c.lineWidth = 1.1 * u;
    c.beginPath(); seaPath(c); c.stroke();
    for (const p of isl) { c.beginPath(); smooth(c, p, true); c.stroke(); }
    c.restore();

    // 테두리 (겹선)
    c.strokeStyle = INK; c.lineWidth = 2.4 * u; c.strokeRect(5, 5, WW - 10, WH - 10);
    c.lineWidth = 0.8 * u; c.strokeRect(10, 10, WW - 20, WH - 20);
    // 가장자리 그을림
    const vg = c.createRadialGradient(WW / 2, WH / 2, WH * 0.45, WW / 2, WH / 2, WW * 0.66);
    vg.addColorStop(0, 'rgba(120,86,40,0)'); vg.addColorStop(1, 'rgba(120,86,40,0.2)');
    c.fillStyle = vg; c.fillRect(0, 0, WW, WH);
  }

  // ── 화면 ↔ 천하도 ──
  const X = wx => (wx - st.cam.x) * st.cam.k + st.vw / 2;
  const Y = wy => (wy - st.cam.y) * st.cam.k + st.vh / 2;
  const toWorld = (sx, sy) => ({ x: (sx - st.vw / 2) / st.cam.k + st.cam.x, y: (sy - st.vh / 2) / st.cam.k + st.cam.y });
  function clampCam() {
    const c = st.cam;
    c.k = clamp(c.k, st.minK, st.minK * 4.2);
    const hw = st.vw / 2 / c.k, hh = st.vh / 2 / c.k;
    const x0 = -PAD + hw, x1 = WW + PAD - hw, y0 = -PAD + hh, y1 = WH + PAD - hh;
    c.x = x0 > x1 ? WW / 2 : clamp(c.x, x0, x1);
    c.y = y0 > y1 ? WH / 2 : clamp(c.y, y0, y1);
  }
  function moved() { st.dirty = st.domDirty = true; st.settleAt = performance.now() + 160; }
  function zoomAt(k, sx, sy) {
    const before = toWorld(sx, sy);
    st.cam.k = k; clampCam();
    const after = toWorld(sx, sy);
    st.cam.x += before.x - after.x; st.cam.y += before.y - after.y;
    clampCam(); moved();
  }
  function centerOn(wx, wy, k) {
    if (k) st.cam.k = k;
    st.cam.x = wx; st.cam.y = wy;
    clampCam(); moved();
  }
  // 지도 칸의 크기·화면 밀도가 바뀌었는가 (창 크기, 폰 돌리기, 판 접기)
  function measure(noStatic) {
    const w = D.map.clientWidth, h = D.map.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === st.vw && h === st.vh && dpr === st.dpr) return false;
    const first = !st.vw;
    const rel = st.vw ? st.cam.k / st.minK : 1;
    st.vw = w; st.vh = h; st.dpr = dpr;
    D.cv.width = Math.max(1, Math.round(w * dpr)); D.cv.height = Math.max(1, Math.round(h * dpr));
    st.minK = Math.max(0.05, Math.min(w / (WW + 2 * PAD), h / (WH + 2 * PAD)));
    if (!first) st.cam.k = st.minK * rel;
    // 폰에서 판을 접으면 지도 칸이 길쭉해진다: 높이를 채우게 확대한다
    if (!first && st.cover) st.cam.k = Math.max(st.cam.k, h / (WH + 2 * PAD) * 0.95);
    st.cover = false;
    clampCam();
    if (!noStatic) ensureStatic(true);
    moved();
    return true;
  }

  // ── DOM 겹: 지역 이름, 강 이름, 문장, 고을, 전쟁, 내 고을 ──
  function regionSpots() {
    const seats = FACTION_ORDER.map(seatOf).filter(Boolean);
    const key = seats.map(s => s.x + ',' + s.y).join(';');
    if (st.spots && st.spotKey === key) return st.spots;
    const land = landMask();
    const obs = seats.concat(siteKeys().map(k => SITES[k]));
    const riv = RIV.flatMap(rv => rv.dense.filter((p, i) => i % 3 === 0));
    const out = {};
    for (const R of REG) {
      let best = null, bs = -1e9;
      const xs = R.poly.map(p => p[0]), ys = R.poly.map(p => p[1]);
      for (let y = Math.min(...ys) + 8; y < Math.max(...ys) - 4; y += 7) for (let x = Math.min(...xs) + 10; x < Math.max(...xs) - 6; x += 7) {
        if (!inPoly(R.poly, x, y)) continue;
        const onLand = land[Math.round(y / G) * GX + Math.round(x / G)];
        if (R.k === 'donghai' ? onLand : !onLand) continue;
        let dO = 60;
        for (const o of obs) { const d = Math.hypot(o.x - x, (o.y - y) * 1.9); if (d < dO) dO = d; }
        for (const p of riv) { const d = Math.hypot(p[0] - x, (p[1] - y) * 1.9) * 1.3; if (d < dO) dO = d; }
        let dE = 40;
        for (let i = 0; i < R.poly.length; i++) dE = Math.min(dE, segDist(x, y, R.poly[i], R.poly[(i + 1) % R.poly.length]));
        const s = dO + dE * 0.6 - Math.hypot(x - R.x, y - R.y) * 0.28;
        if (s > bs) { bs = s; best = [x, y]; }
      }
      out[R.k] = best || [R.x, R.y];
    }
    st.spots = out; st.spotKey = key;
    return out;
  }
  function buildMarkers() {
    const spots = regionSpots(), pick = pickMode();
    const h = [];
    for (const R of REG) {
      const A = REGIONS[R.k];
      h.push(`<div class="wm-reg${R.outer ? ' out' : ''}" data-r="${R.k}"><div><b>${A.name}</b><span ${gl(A.hanja, `${R.outer ? '새외' : '중원'} · ${A.desc}`)}>${A.hanja}</span></div></div>`);
    }
    RIV.forEach((rv, i) => h.push(`<div class="wm-riv" data-v="${i}"><div><span ${gl(rv.hanja)}>${rv.hanja}</span>${rv.name}</div></div>`));
    h.push(`<div class="wm-north"><div><span data-tip-title="北 · 북녘 북" data-tip="북쪽. 천하도는 위가 북쪽이고 오른쪽이 동쪽이다.">北</span></div></div>`);
    for (const id of FACTION_ORDER) {
      const F = fac(id), C = CAMPS[F.camp], g = HANJA_GLOSS[F.hanja];
      const where = F.home === 'local' ? '고을 곁' : `${REGIONS[F.home].name} 본산`;
      h.push(`<button type="button" class="wm-seat${isLocal(id) ? ' local' : ''}" data-f="${id}" style="--c:${F.color}" aria-label="${F.name}">`
        + `<span class="cr" data-tip-title="${escapeHtml(F.hanja + (g ? ' · ' + g[0] : ''))}" data-tip="${escapeHtml(`${F.name}의 문장 · ${C.name} · ${where}`)}">${F.hanja}</span>`
        + `<span class="nm">${F.name}</span><span class="tg"></span><span class="qb"></span></button>`);
    }
    if (pick) {
      for (const k of siteKeys()) h.push(`<button type="button" class="wm-site" data-site="${k}" aria-label="${SITES[k].name}"><i></i><span class="nm">${SITES[k].name}</span></button>`);
    } else {
      h.push(`<div class="wm-home"><svg viewBox="-12 -12 24 24" aria-hidden="true"><path d="${starPath(11, 4.6)}"/></svg><span class="nm">${escapeHtml(S.name)}</span><span class="wm-stamp" hidden></span></div>`);
    }
    D.layer.innerHTML = h.join('') + '<div class="wm-wars"></div>';
    const m = { reg: [], riv: [], seat: {}, site: {}, war: {}, warSig: '' };
    D.layer.querySelectorAll('.wm-reg').forEach(el => { const s = spots[el.dataset.r]; m.reg.push({ el, x: s[0], y: s[1] }); });
    D.layer.querySelectorAll('.wm-riv').forEach(el => {
      const rv = RIV[+el.dataset.v], P = rv.dense, i = Math.round(rv.at * (P.length - 1));
      const a = P[i - 2], b = P[i + 2], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      m.riv.push({ el, x: P[i][0] - (b[1] - a[1]) / len * rv.off, y: P[i][1] + (b[0] - a[0]) / len * rv.off, ang });
    });
    m.north = D.layer.querySelector('.wm-north');
    D.layer.querySelectorAll('.wm-seat').forEach(el => { m.seat[el.dataset.f] = el; });
    D.layer.querySelectorAll('.wm-site').forEach(el => { m.site[el.dataset.site] = el; });
    m.home = D.layer.querySelector('.wm-home');
    m.stamp = D.layer.querySelector('.wm-stamp');
    m.wars = D.layer.querySelector('.wm-wars');
    st.m = m;
    if (!pick) syncDynamic();
    st.domDirty = true;
  }
  function starPath(R, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; d += `${i ? 'L' : 'M'}${(Math.cos(a) * q).toFixed(2)} ${(Math.sin(a) * q).toFixed(2)}`; }
    return d + 'Z';
  }
  // 전쟁 표시와 문장 꾸밈(의뢰 수, 관계·위협 글)은 S.jh 가 바뀔 때마다 맞춘다
  function syncDynamic() {
    const m = st.m, jh = S.jh;
    const wsig = jh.wars.map(w => w.id).join(',');
    if (wsig !== m.warSig) {
      m.warSig = wsig;
      m.wars.innerHTML = jh.wars.map(w => `<button type="button" class="wm-war" data-w="${w.id}" aria-label="${escapeHtml(w.name)}"></button>`).join('');
      m.war = {};
      m.wars.querySelectorAll('.wm-war').forEach(el => { m.war[el.dataset.w] = el; });
    }
    for (const w of jh.wars) {
      const el = m.war[w.id], A = w.a.map(id => fac(id).name).join('·'), B = w.b.map(id => fac(id).name).join('·');
      el.dataset.tipTitle = w.name;
      el.dataset.tip = `${A} 대 ${B}\n${warDay(w)} · ${lead(w)}`;
    }
    const qn = {};
    for (const q of jh.quests) if (q.state === 'open') qn[q.fid] = (qn[q.fid] || 0) + 1;
    for (const id of FACTION_ORDER) {
      const el = m.seat[id];
      if (!el) continue;
      const qb = el.querySelector('.qb'), tg = el.querySelector('.tg');
      const n = qn[id] || 0, qt = n ? String(n) : '';
      if (qb.textContent !== qt) qb.textContent = qt;
      let t = '', cls = '';
      if (st.view === 'rel') { const r = Math.round(rel(id)); t = S.vassal === id ? '주군' : (r > 0 ? '+' : '') + r; cls = S.vassal === id ? 'lord' : r <= -20 ? 'bad' : r >= 25 ? 'good' : ''; }
      else if (st.view === 'threat') { const l = threatLevel(id); if (l) { t = l.spied ? `${l.pct}%` : l.word; cls = l.spied ? (l.pct >= 70 ? 'bad' : l.pct >= 30 ? 'warn' : '') : ['', 'warn', 'bad'][l.n]; } }
      if (tg.textContent !== t) tg.textContent = t;
      tg.className = 'tg' + (cls ? ' ' + cls : '');
      el.classList.toggle('near', jh.near.includes(id));
      el.classList.toggle('lord', S.vassal === id);
      el.classList.toggle('pact', jh.pacts.includes(id));
    }
    // 이긴 갈래의 문장 (§8.2)
    const v = jh.victory;
    if (m.stamp) {
      const ri = v ? hook(typeof Story === 'undefined' ? null : Story, 'routeInfo') : null;
      const seal = v ? (ri && ri.key === v && ri.seal) || (CAMPS[v] ? CAMPS[v].seal : '獨') : '';
      const title = (ri && ri.key === v && ri.title) || S.victoryTitle || '';
      if (m.stamp.textContent !== seal) {
        m.stamp.textContent = seal;
        m.stamp.hidden = !seal;
        if (seal) { const g = HANJA_GLOSS[seal]; m.stamp.dataset.tipTitle = seal + (g ? ' · ' + g[0] : ''); m.stamp.dataset.tip = [title ? `「${title}」의 문장` : '이긴 갈래의 문장', g ? g[1] : ''].filter(Boolean).join('\n'); }
      }
    }
  }
  function seatShown(id, zoomed) {
    if (!aliveF(id) || !seatOf(id)) return false;
    if (pickMode()) return zoomed || nearList().includes(id);
    const jh = S.jh;
    return zoomed || jh.near.includes(id) || st.sel === id || S.vassal === id || jh.pacts.includes(id) || st.hiCamp === fac(id).camp
      || jh.quests.some(q => q.fid === id) || (st.selWar && (st.selWar.a.includes(id) || st.selWar.b.includes(id)));
  }
  function put(el, x, y, extra = '') {
    if (x < -120 || y < -80 || x > st.vw + 120 || y > st.vh + 80) { off(el); return; }
    const t = `translate(${Math.round(x)}px,${Math.round(y)}px)${extra}`;
    if (el._t !== t) { el.style.transform = t; el._t = t; }
    if (el._off !== false) { el._off = false; el.style.display = ''; }
  }
  function off(el) { if (el._off !== true) { el._off = true; el.style.display = 'none'; } }
  // 겹치는 문장을 조금씩 밀어낸다 (고정된 것은 그대로)
  // 각 표시는 문장과 그 아래 이름표를 함께 덮는 원(가운데 x, y+oy, 반지름 r)으로 본다
  function relax(list, fixed) {
    const pushOff = a => {
      let any = false;
      for (const f of fixed) {
        const need = a.r + f.r + 2;
        let dx = a.x - f.x, dy = a.y + a.oy - f.y - f.oy, d = Math.hypot(dx, dy);
        if (d >= need) continue;
        if (d < 0.01) { dx = 0.3; dy = -1; d = Math.hypot(dx, dy); }
        a.x += dx / d * (need - d); a.y += dy / d * (need - d); any = true;
      }
      return any;
    };
    for (let it = 0; it < 40; it++) {
      let any = false;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j], need = a.r + b.r + 2;
          let dx = b.x - a.x, dy = b.y + b.oy - a.y - a.oy, d = Math.hypot(dx, dy);
          if (d >= need) continue;
          if (d < 0.01) { dx = 1; dy = (j % 3) - 1; d = Math.hypot(dx, dy); }
          const p = (need - d) / 2 / d;
          a.x -= dx * p; a.y -= dy * p; b.x += dx * p; b.y += dy * p; any = true;
        }
      }
      // 고정된 것(내 고을·고을·싸움터)은 늘 비켜 간다
      for (const a of list) if (pushOff(a)) any = true;
      if (!any) break;
    }
  }
  // 이름표 너비 어림 (한글 한 자 ≈ 글자 크기)
  const labelR = (name, px) => (name.length * px + 10) / 2 * 0.86;
  function placeDom() {
    const m = st.m;
    if (!m) return;
    const k = st.cam.k, zoomed = k >= st.minK * 1.75, pick = pickMode(), wide = st.vw >= 640;
    const small = !wide && k < st.minK * 1.3;
    D.layer.classList.toggle('small', small);
    D.layer.classList.toggle('zoomed', zoomed);
    for (const r of m.reg) put(r.el, X(r.x), Y(r.y));
    for (const r of m.riv) put(r.el, X(r.x), Y(r.y), ` rotate(${r.ang.toFixed(3)}rad)`);
    put(m.north, X(52), Y(640));
    // 고정된 것: 내 고을(보기) 또는 고을 표시(고르기). 이름표까지 덮는 원으로 친다
    const fixed = [], fpx = small ? 10.5 : 11.5;
    if (pick) {
      for (const key in m.site) {
        const s = SITES[key], el = m.site[key], on = key === st.site, named = on || wide || k >= st.minK * 1.6;
        el.classList.toggle('on', on);
        el.classList.toggle('named', named);
        put(el, X(s.x), Y(s.y));
        fixed.push({ x: X(s.x), y: Y(s.y), oy: named ? 11 : 0, r: named ? Math.max(on ? 14 : 8, labelR(s.name, on ? 13 : fpx)) : 8 });
      }
    } else {
      const s = homeSite();
      put(m.home, X(s.x), Y(s.y));
      fixed.push({ x: X(s.x), y: Y(s.y), oy: 11, r: Math.max(18, labelR(S.name, 15.5)) });
      if (m.stamp && !m.stamp.hidden) fixed.push({ x: X(s.x) + 38, y: Y(s.y) - 14, oy: 0, r: 19 });
      for (const w of S.jh.wars) {
        const el = m.war[w.id];
        if (!el) continue;
        put(el, X(w.front.x), Y(w.front.y));
        el.classList.toggle('on', st.selWar === w);
        fixed.push({ x: X(w.front.x), y: Y(w.front.y), oy: 0, r: 13 });
      }
    }
    const list = [], near = nearList();
    const base = small ? 10 : 12.5;
    for (const id of FACTION_ORDER) {
      const el = m.seat[id];
      if (!el) continue;
      if (!seatShown(id, zoomed)) { off(el); continue; }
      const F = fac(id), s = seatOf(id), cr = (isLocal(id) ? base * 0.82 : base) * (st.sel === id ? 1.2 : 1);
      // 이름표: 고르기는 확대했을 때만(데스크톱은 커서를 올리면), 보기의 데스크톱은 이웃·고른 계열도
      const named = st.sel === id || (pick ? k >= st.minK * 1.4 : wide ? (near.includes(id) || zoomed || st.hiCamp === F.camp) : k >= st.minK * 1.3);
      const tag = !pick && st.view !== 'camp' && !!el.querySelector('.tg').textContent;
      const oy = (named ? 8 : 0) + (tag ? 7 : 0);
      list.push({ id, el, named, cr, ax: X(s.x), ay: Y(s.y), x: X(s.x), y: Y(s.y), oy, r: named ? Math.max(labelR(F.name, fpx), cr + 9) + (tag ? 4 : 0) : cr + (tag ? 8 : 0) });
    }
    relax(list, fixed);
    st.disp = {};
    for (const v of list) {
      put(v.el, v.x, v.y);
      v.el.classList.toggle('sel', st.sel === v.id);
      v.el.classList.toggle('near', near.includes(v.id));
      v.el.classList.toggle('named', v.named);
      st.disp[v.id] = v;
    }
  }

  // ── 움직이는 겹 ──
  function bladeIcon(c, x, y, s, pulse) {
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, s * 1.7);
    g.addColorStop(0, `rgba(190,46,34,${0.3 + 0.25 * pulse})`); g.addColorStop(1, 'rgba(190,46,34,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, s * 1.7, 0, Math.PI * 2); c.fill();
    c.scale(1 + 0.12 * pulse, 1 + 0.12 * pulse);
    for (const dir of [-1, 1]) {
      c.save(); c.rotate(dir * Math.PI / 4); c.scale(dir, 1);
      c.beginPath(); c.moveTo(-s * 0.1, s * 0.5); c.lineTo(-s * 0.1, -s * 0.72); c.quadraticCurveTo(-s * 0.02, -s * 1.02, s * 0.14, -s * 0.84); c.lineTo(s * 0.1, s * 0.5); c.closePath();
      c.fillStyle = '#f2e9d4'; c.fill(); c.strokeStyle = '#21160f'; c.lineWidth = 1.3; c.stroke();
      c.beginPath(); c.moveTo(-s * 0.32, s * 0.52); c.lineTo(s * 0.32, s * 0.52); c.lineWidth = 2.6; c.stroke();
      c.beginPath(); c.moveTo(0, s * 0.58); c.lineTo(0, s * 0.96); c.strokeStyle = '#7a2418'; c.lineWidth = 3; c.stroke();
      c.restore();
    }
    c.restore();
  }
  function draw(t) {
    if (calm) t = 0;
    const c = D.ctx, k = st.cam.k;
    c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    c.clearRect(0, 0, st.vw, st.vh);
    if (st.stat) {
      const r = st.res;
      c.imageSmoothingEnabled = true;
      c.drawImage(st.stat, 0, 0, st.stat.width, st.stat.height, X(-PAD), Y(-PAD), st.stat.width / r * k, st.stat.height / r * k);
    }
    const pick = pickMode(), home = homeSite(), hx = X(home.x), hy = Y(home.y);
    // 고리·실·전쟁의 점선은 종이 안에만
    c.save(); c.beginPath(); c.rect(X(0), Y(0), WW * k, WH * k); c.clip();
    const pos = id => st.disp[id] ? [st.disp[id].x, st.disp[id].y] : (seatOf(id) ? [X(seatOf(id).x), Y(seatOf(id).y)] : null);
    let anim = false;
    // 이웃 고리와 이웃에게 닿는 금빛 실
    const near = nearList(), far = near.filter(id => !isLocal(id) && seatOf(id)).map(id => Math.hypot(seatOf(id).x - home.x, seatOf(id).y - home.y)).sort((a, b) => a - b);
    if (far.length) {
      const R = clamp(far[Math.floor(far.length / 2)] + 12, 70, 230) * k;
      c.setLineDash([6, 4]); c.strokeStyle = 'rgba(150,100,20,0.85)'; c.lineWidth = 1.7;
      c.beginPath(); c.arc(hx, hy, R, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]);
    }
    c.lineWidth = 1.2;
    for (const id of near) {
      const p = pos(id);
      if (!p || !aliveF(id)) continue;
      const g = c.createLinearGradient(hx, hy, p[0], p[1]);
      g.addColorStop(0, 'rgba(176,128,32,0.85)'); g.addColorStop(1, 'rgba(176,128,32,0.25)');
      c.strokeStyle = g; c.beginPath(); c.moveTo(hx, hy); c.lineTo(p[0], p[1]); c.stroke();
    }
    // 끌려 나온 문장의 제자리 (작은 점과 실)
    c.strokeStyle = 'rgba(40,28,20,0.55)'; c.fillStyle = 'rgba(40,28,20,0.75)'; c.lineWidth = 1;
    for (const id in st.disp) {
      const v = st.disp[id];
      if (Math.hypot(v.x - v.ax, v.y - v.ay) < 4) continue;
      c.beginPath(); c.moveTo(v.ax, v.ay); c.lineTo(v.x, v.y); c.stroke();
      c.beginPath(); c.arc(v.ax, v.ay, 2, 0, Math.PI * 2); c.fill();
    }
    if (!pick) {
      const jh = S.jh;
      // 다녀오는 의뢰: 내 고을에서 의뢰한 세력 쪽으로 오가는 무리
      for (const q of jh.quests) {
        if (q.state !== 'away') continue;
        const p = pos(q.fid);
        if (!p) continue;
        c.setLineDash([2, 4]); c.strokeStyle = 'rgba(150,104,24,0.9)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(p[0], p[1]); c.stroke(); c.setLineDash([]);
        const span = Math.max(1, q.days * 24), f = clamp(1 - (q.back - S.time) / span, 0, 1), u = f < 0.5 ? f * 2 : 2 - f * 2;
        const bob = Math.sin(t / 300) * 0.02;
        const qx = hx + (p[0] - hx) * clamp(u + bob, 0, 1), qy = hy + (p[1] - hy) * clamp(u + bob, 0, 1);
        c.fillStyle = '#d6aa52'; c.strokeStyle = '#2a1d16'; c.lineWidth = 1.2;
        c.beginPath(); c.arc(qx, qy, 4, 0, Math.PI * 2); c.fill(); c.stroke();
        anim = true;
      }
      // 전쟁: 맞선 본산에서 싸움터까지 점선, 싸움터에 맥박 치는 칼
      const pulse = (Math.sin(t / 260) + 1) / 2;
      for (const w of jh.wars) {
        const fx = X(w.front.x), fy = Y(w.front.y), on = st.selWar === w || (st.sel && (w.a.includes(st.sel) || w.b.includes(st.sel)));
        for (const side of ['a', 'b']) for (const id of w[side]) {
          const p = pos(id);
          if (!p) continue;
          c.setLineDash([2, 4]); c.lineWidth = on ? 2.2 : 1.6;
          c.strokeStyle = side === 'a' ? 'rgba(150,34,24,0.85)' : 'rgba(60,36,30,0.85)';
          c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(fx, fy); c.stroke();
          if (!st.disp[id]) {
            c.setLineDash([]); c.fillStyle = fac(id).color; c.strokeStyle = '#f4ead2'; c.lineWidth = 1.5;
            c.beginPath(); c.arc(p[0], p[1], 4, 0, Math.PI * 2); c.fill(); c.stroke();
          }
        }
        c.setLineDash([]);
        bladeIcon(c, fx, fy, on ? 13 : 11, pulse);
        anim = true;
      }
    }
    c.restore();
    // 고른 세력의 고리
    const sid = st.sel && st.disp[st.sel];
    if (sid) {
      const pr = (Math.sin(t / 240) + 1) / 2;
      c.strokeStyle = `rgba(214,170,82,${0.55 + 0.35 * pr})`; c.lineWidth = 2;
      c.beginPath(); c.arc(sid.x, sid.y, sid.cr + 6 + pr * 3, 0, Math.PI * 2); c.stroke();
      anim = true;
    }
    if (pick) {
      const pr = (Math.sin(t / 300) + 1) / 2;
      c.strokeStyle = `rgba(181,51,42,${0.4 + 0.4 * pr})`; c.lineWidth = 2;
      c.beginPath(); c.arc(hx, hy, 18 + pr * 4, 0, Math.PI * 2); c.stroke();
      anim = true;
    }
    st.anim = anim && !calm;   // 움직임을 줄이라는 설정이면 맥박 없이 한 번만 그린다
    st.dirty = false;
  }

  // ── 판 (보기) ──
  const warDay = w => { const d = dayOf() - w.since; return d > 0 ? `${d}일째` : '오늘 일어남'; };
  const names = ids => ids.map(id => fac(id).name).join('·');
  function lead(w) {
    if (Math.abs(w.score) < 1.5) return '팽팽하다';
    const n = names(w.score > 0 ? w.a : w.b);
    return `${n}${pp(n, '이/가')} 밀어붙인다`;
  }
  const crest = (id, cls = '') => { const F = fac(id), g = HANJA_GLOSS[F.hanja]; return `<span class="wm-cr ${cls}" style="--c:${F.color}" data-tip-title="${escapeHtml(F.hanja + (g ? ' · ' + g[0] : ''))}" data-tip="${escapeHtml(F.name + '의 문장')}">${F.hanja}</span>`; };
  const bladeSvg = '<svg class="wm-bl" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2l9 10M13 2L4 12M2 11l3 3M14 11l-3 3"/></svg>';
  function campRows() {
    const jh = S.jh, sums = {}, cnt = {}, tot = {}, wars = {};
    for (const c of CAMP_ORDER) { sums[c] = 0; cnt[c] = 0; tot[c] = 0; wars[c] = []; }
    for (const id of FACTION_ORDER) {
      const c = fac(id).camp;
      tot[c]++;
      if (jh.dead[id] === undefined) { cnt[c]++; sums[c] += jh.power[id] || 0; }
    }
    for (const w of jh.wars) for (const c of new Set(w.a.concat(w.b).map(id => fac(id).camp))) wars[c].push(w.name);
    const max = Math.max(1, ...CAMP_ORDER.map(c => sums[c]));
    const d = dayOf(), ref = jh.hist.slice().reverse().find(h => h.day <= d - 5) || jh.hist[0];
    return CAMP_ORDER.map(c => {
      const C = CAMPS[c], s = Math.round(sums[c]), was = ref ? ref.camp[c] : null;
      let tr = '<span class="ct">―</span>';
      if (was) {
        const ch = (s - was) / Math.max(1, was), dd = d - ref.day;
        const tip = escapeHtml(`${dd}일 전 ${was} → 지금 ${s}`);
        tr = ch > 0.03 ? `<span class="ct up" data-tip-title="오름세" data-tip="${tip}">▲</span>` : ch < -0.03 ? `<span class="ct down" data-tip-title="내림세" data-tip="${tip}">▼</span>` : `<span class="ct" data-tip-title="제자리" data-tip="${tip}">―</span>`;
      }
      const wm = wars[c].length ? `<span class="cw" data-tip-title="싸우는 중" data-tip="${escapeHtml(wars[c].join('\n'))}">${bladeSvg}${wars[c].length}</span>` : '';
      const dead = tot[c] - cnt[c];
      return `<button type="button" class="wm-camp${st.hiCamp === c ? ' on' : ''}" data-act="camp" data-c="${c}" style="--c:${C.color}">`
        + `<span class="cs" ${gl(C.seal, C.name + ' 계열의 표')}>${C.seal}</span><span class="cn">${C.name}<small>${cnt[c]}곳${dead ? ` · 멸문 ${dead}` : ''}</small></span>`
        + `<span class="cb"><i style="width:${(s / max * 100).toFixed(1)}%"></i></span><span class="cp">${s}</span>${tr}${wm}</button>`;
    }).join('');
  }
  function warCard(w, standalone) {
    const share = clamp((w.score + 10) / 20, 0, 1), ma = clamp(w.mine.a / 20, 0, share), mb = clamp(w.mine.b / 20, 0, 1 - share);
    const ca = fac(w.a[0]) ? fac(w.a[0]).color : '#8a2a20', cb = fac(w.b[0]) ? fac(w.b[0]).color : '#3a3a40';
    const side = ids => ids.map(id => `<button type="button" class="wm-wf" data-act="f" data-f="${id}">${crest(id)}<span>${fac(id).name}</span></button>`).join('');
    const mine = (w.mine.a || w.mine.b) ? `<span class="mine">영주의 몫 ${[w.mine.a ? `${names(w.a)} 쪽 +${w.mine.a}` : '', w.mine.b ? `${names(w.b)} 쪽 +${w.mine.b}` : ''].filter(Boolean).join(', ')}</span>` : '';
    return `<div class="wm-wc${standalone ? ' solo' : ''}">
      <div class="wh">${bladeSvg}<b>${escapeHtml(w.name)}</b><small>${warDay(w)}${w.scripted ? ' · 이야기가 연 싸움' : ''}</small></div>
      <div class="ws"><div>${side(w.a)}</div><em>대</em><div>${side(w.b)}</div></div>
      <div class="wbar" data-tip-title="전황" data-tip="${escapeHtml(`점수 ${w.score.toFixed(1)} (10에 닿으면 끝난다). 금빛은 영주가 보탠 몫이다.`)}"><i class="fa" style="width:${(share * 100).toFixed(1)}%;background:${ca}"></i><i class="fb" style="left:${(share * 100).toFixed(1)}%;background:${cb}"></i>`
      + `${ma > 0 ? `<i class="mn" style="left:${((share - ma) * 100).toFixed(1)}%;width:${(ma * 100).toFixed(1)}%"></i>` : ''}${mb > 0 ? `<i class="mn" style="left:${(share * 100).toFixed(1)}%;width:${(mb * 100).toFixed(1)}%"></i>` : ''}<span class="mid"></span><span class="nd" style="left:${(share * 100).toFixed(1)}%"></span></div>
      <div class="wl"><span>${escapeHtml(lead(w))}</span>${mine}</div></div>`;
  }
  function factionCard(id) {
    const jh = S.jh, F = fac(id), C = CAMPS[F.camp], dead = jh.dead[id] !== undefined, near = jh.near.includes(id);
    const r = Math.round(rel(id)), p = Math.round(jh.power[id] || 0);
    const chip = dead ? '<span class="st dead">멸문</span>' : S.vassal === id ? '<span class="st lord">주군</span>' : jh.pacts.includes(id) ? '<span class="st pact">동맹</span>' : near ? '<span class="st near">이웃</span>' : '<span class="st far">먼 세력</span>';
    const where = F.home === 'local' ? '고을 곁' : `${REGIONS[F.home].name} 본산`;
    let threat = '―';
    if (!dead && F.military && S.vassal !== id) {
      if (JH.spied(id)) threat = `<b class="${S.factions[id].threat >= 70 ? 'bad' : ''}">${Math.round(S.factions[id].threat)}%</b> <small>첩자가 알려 왔다</small>`;
      else if (near) { const w = JH.threatWord(id); threat = `<b class="${w === '칼을 간다' ? 'bad' : w === '술렁' ? 'warn' : ''}">${w}</b>`; }
      else threat = '<small>이웃이 아니라 노리지 않는다</small>';
    }
    const est = !dead && F.military ? JH.raidEstimate(id) : 0;
    const w = dead ? null : JH.warOf(id);
    return `<div class="wm-fc" style="--c:${F.color}">
      <div class="fh">${crest(id, 'big')}<div><b>${F.name}</b><small>${paren(F.type)} · ${where}</small></div>${chip}</div>
      <p class="fd">${escapeHtml(F.desc)}</p>
      <dl class="wm-dl">
        <dt>힘</dt><dd>${dead ? '무너졌다' : `${p}${est ? ` · 쳐들어오면 약 ${est}명` : ''}`}</dd>
        <dt>관계</dt><dd><span class="wm-rel"><span style="left:${(r + 100) / 2}%"></span></span><b class="${r <= -20 ? 'bad' : r >= 25 ? 'good' : ''}">${r > 0 ? '+' : ''}${r}</b></dd>
        <dt>위협</dt><dd>${threat}</dd>
        <dt>${C.name}</dt><dd><small>${escapeHtml(F.perk ? '주군이면 ' + F.perk : '산하·동맹을 맺지 않는 무리')}</small></dd>
      </dl>
      ${w ? warCard(w, false) : ''}
      <button type="button" class="wm-btn ghost wm-tosheet" data-act="sheet" data-f="${id}">세력 창에서 보기</button></div>`;
  }
  function newsList() {
    const jh = S.jh, d = dayOf();
    if (!jh.news.length) return '<p class="wm-empty">아직 들려오는 소식이 없다.</p>';
    return `<ol class="wm-news">${jh.news.slice(0, 10).map(n => {
      const ago = d - n.day <= 0 ? '오늘' : `${d - n.day}일 전`, f = (n.f || []).find(id => fac(id));
      return `<li class="k-${escapeHtml(n.kind || '')}"${f ? ` data-act="f" data-f="${f}"` : ''}><time>${ago}</time><span>${escapeHtml(n.text)}</span></li>`;
    }).join('')}</ol>`;
  }
  function routeLine() {
    const jh = S.jh;
    if (!jh.route) return '';
    const ri = hook(typeof Story === 'undefined' ? null : Story, 'routeInfo');
    const name = (ri && ri.name) || (jh.route === 'free' ? '독립' : CAMPS[jh.route] ? CAMPS[jh.route].name : jh.route);
    const seal = (ri && ri.seal) || (CAMPS[jh.route] ? CAMPS[jh.route].seal : '獨');
    const full = jh.route === 'free' ? '홀로 서는 길' : `${escapeHtml(name)}의 길`;
    return `<span class="wm-route"><i ${gl(seal)}>${seal}</i>${full}${ri && ri.provisional ? ' (잠정)' : ''}</span>`;
  }
  function viewPanel() {
    const sel = st.sel && fac(st.sel) ? factionCard(st.sel) : st.selWar ? warCard(st.selWar, true) : '<p class="wm-empty">지도에서 문장이나 땅을 누르면 그 세력을 살핀다.</p>';
    return `<div class="wm-ph" data-act="fold">
        ${SEAL}
        <div class="wm-pt"><h2>천하도</h2><small>${dateText()} · 시간이 멈춰 있다</small></div>
        <span class="wm-fold" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="${st.fold ? 'M3 10l5-5 5 5' : 'M3 6l5 5 5-5'}"/></svg></span>
      </div>
      <div class="wm-scroll">
        ${routeLine()}
        <section class="wm-sec"><h3>세력 양상 <small>계열마다 힘의 합</small></h3><div class="wm-camps">${campRows()}</div></section>
        <section class="wm-sec wm-selsec"><h3>${st.selWar && !st.sel ? '전쟁' : '고른 세력'}</h3>${sel}</section>
        <section class="wm-sec"><h3>강호 소식</h3>${newsList()}</section>
      </div>`;
  }
  function renderPanel(force) {
    if (!st.open) return;
    const html = pickMode() ? pickPanel() : viewPanel();
    if (!force && html === st.lastPanel) return;
    st.lastPanel = html;
    D.sideIn.innerHTML = html;
  }

  // ── 판 (고르기) ──
  function pickPanel() {
    const k = st.site, s = SITES[k], A = REGIONS[s.region], info = st.info;
    const bars = BIOME.map(([key, label, words]) => {
      const v = s.biome[key], lv = v < 0.4 ? 0 : v <= 0.6 ? 1 : 2;
      let tip = '';
      if (key === 'fertile') tip = `논밭 수확 ×${(1 + 0.4 * (v - 0.5)).toFixed(2)}`;
      else if (key === 'cold') tip = s.trait.noWinter ? '겨울이 없다. 넷째 철에도 봄처럼 거둔다.' : `겨울 논밭 ×${(1 - 0.6 * (v - 0.5)).toFixed(2)}, 겨울 식량 소비 ×${(1 + 0.4 * (v - 0.5)).toFixed(2)}`;
      else tip = { forest: ['숲이 적어 목재가 귀하다', '숲이 알맞다', '숲이 깊어 목재가 흔하다'], water: ['물이 귀하다', '물이 알맞다', '강과 물길이 넓다'], hills: ['땅이 평평하다', '바위산이 알맞다', '바위산이 많아 돌이 흔하다'] }[key][lv];
      const word = key === 'cold' && s.trait.noWinter ? '겨울 없음' : words[lv];
      return `<div class="wm-bio" data-tip-title="${label} · ${word}" data-tip="${escapeHtml(tip)}"><span>${label}</span><i><b style="width:${((v - 0.2) / 0.6 * 100).toFixed(0)}%"></b></i><em>${word}</em></div>`;
    }).join('');
    const order = info.near.slice(2).concat(info.near.slice(0, 2));
    const nb = order.map(id => {
      const F = fac(id), r = info.rel[id];
      const note = isLocal(id) ? '고을 곁' : F.camp === 'sang' ? '상단' : CAMPS[F.camp].name;
      return `<div class="wm-nb">${crest(id)}<span><b>${F.name}</b><small>${note} · 첫 관계 ${r > 0 ? '+' : ''}${r}</small></span></div>`;
    }).join('');
    const routes = info.routes.map(c => { const C = CAMPS[c]; return `<span class="wm-chip" style="--c:${C.color}"><i ${gl(C.seal, `${C.name}의 길: ${C.perkText}`)}>${C.seal}</i>${C.name}</span>`; }).join('')
      + `<span class="wm-chip free" style="--c:#6b5a48"><i ${gl('獨', '어느 계열의 산하에도 들지 않고 홀로 서는 길')}>獨</i>독립</span>`;
    const stars = '★'.repeat(s.stars) + '☆'.repeat(Math.max(0, 3 - s.stars));
    return `<div class="wm-scroll">
      <div class="wm-sh">
        <div><h2>${s.name} <span ${gl(s.hanja)}>${s.hanja}</span></h2>
        <small>${A.name}(<span ${gl(A.hanja)}>${A.hanja}</span>) · ${A.outer ? '새외' : '중원'}</small></div>
        <div class="wm-stars" data-tip-title="어려움" data-tip="별이 많을수록 다스리기 거칠다.">${stars}</div>
      </div>
      ${s.first ? '<p class="wm-first">처음이라면 이곳을 권한다</p>' : ''}
      <p class="wm-desc">${escapeHtml(s.desc)}</p>
      <p class="wm-trait"><b>고을 성질</b>${escapeHtml(s.trait.text)}</p>
      <section class="wm-sec"><h3>땅 생김</h3><div class="wm-bios">${bars}</div></section>
      <section class="wm-sec"><h3>이웃 세력 <small>일곱</small></h3><div class="wm-nbs">${nb}</div></section>
      <section class="wm-sec"><h3>열린 갈래 <small>제4장 갈림길에서 고른다</small></h3><div class="wm-chips">${routes}</div></section>
    </div>`;
  }
  function stripHTML() {
    return siteKeys().map(k => {
      const s = SITES[k];
      return `<button type="button" class="wm-sc${k === st.site ? ' on' : ''}" data-pick="${k}"><b>${s.name}</b><small>${REGIONS[s.region].name} · ${'★'.repeat(s.stars)}</small>${s.first ? '<em>처음이라면</em>' : ''}</button>`;
    }).join('');
  }
  function selectSite(k, scroll = true) {
    if (!SITES[k]) return;
    st.site = k;
    st.info = JH.siteInfo(st.world, k);
    D.cards.querySelectorAll('.wm-sc').forEach(el => el.classList.toggle('on', el.dataset.pick === k));
    if (scroll) { const el = D.cards.querySelector(`[data-pick="${k}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    renderPanel(true);
    D.sideIn.scrollTop = 0;
    // 확대해 있으면 그 고을로 옮긴다
    const s = SITES[k];
    if (st.cam.k > st.minK * 1.05) { const p = { x: X(s.x), y: Y(s.y) }; if (p.x < 40 || p.y < 40 || p.x > st.vw - 40 || p.y > st.vh - 40) centerOn(s.x, s.y); }
    st.dirty = st.domDirty = true;
  }
  function stepSite(d) {
    const ks = siteKeys(), i = ks.indexOf(st.site);
    selectSite(ks[(i + d + ks.length) % ks.length]);
  }
  function go() {
    if (!st.open || !pickMode() || st.busy) return;
    const k = st.site, cb = st.onPick;
    st.busy = true;
    close();
    if (cb) cb(k);
  }
  function goRandom() {
    if (st.busy) return;
    const ks = siteKeys().filter(k => k !== st.site);
    selectSite(ks[Math.floor(Math.random() * ks.length)]);
    st.busy = true;
    setTimeout(() => { st.busy = false; go(); }, 420);
  }
  function back() {
    if (st.busy) return;
    const cb = st.onCancel;
    close();
    if (cb) cb();
  }

  // ── 세력·전쟁 고르기와 보기 바꾸기 (보기) ──
  function select(id) {
    st.sel = id && fac(id) ? id : null;
    st.selWar = null;
    if (st.sel && st.fold) st.fold = false;
    afterSelect();
  }
  function selectWar(wid) {
    const w = JH.warById(wid);
    st.selWar = w; st.sel = null;
    if (w && st.fold) st.fold = false;
    afterSelect();
  }
  function afterSelect() {
    D.root.classList.toggle('fold', st.fold);
    renderPanel(true);
    const sec = D.sideIn.querySelector('.wm-selsec'), sc = D.sideIn.querySelector('.wm-scroll');
    if (sec && sc && (st.sel || st.selWar)) sc.scrollTop = Math.max(0, sec.offsetTop - sc.offsetTop - 6);
    st.dirty = st.domDirty = true;
    // 고른 세력이 지도 밖이면 그쪽으로
    const s = st.sel ? seatOf(st.sel) : st.selWar ? st.selWar.front : null;
    if (s) { const x = X(s.x), y = Y(s.y); if (x < 30 || y < 30 || x > st.vw - 30 || y > st.vh - 30) centerOn(s.x, s.y); }
  }
  function setView(v) {
    if (st.view === v) return;
    st.view = v;
    D.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
    legend();
    syncDynamic();
    ensureStatic(false);
    st.dirty = st.domDirty = true;
  }
  function legend() {
    let h = '';
    if (st.view === 'rel') h = '<span class="lg-col"><span class="lg-grad"></span><span class="lg-ends"><span>적대</span><span>중립</span><span>우호</span></span></span><small>금빛은 주군</small>';
    else if (st.view === 'threat') h = '<span class="lg-dot" style="--c:#a89670"></span>잠잠 <span class="lg-dot" style="--c:#d6922c"></span>술렁 <span class="lg-dot" style="--c:#aa241a"></span>칼을 간다<small>이웃만. 첩자를 두면 수치로 보인다</small>';
    D.legend.innerHTML = h;
    D.legend.hidden = !h;
  }

  // ── 입력 ──
  function wire() {
    const map = D.map;
    map.addEventListener('pointerdown', e => {
      if (e.target.closest('.wm-ctl,.wm-zoom,.wm-close')) return;
      if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
      try { map.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hook(typeof Tips === 'undefined' ? null : Tips, 'hide');
      if (st.ptr.size === 2) {
        const [a, b] = [...st.ptr.values()];
        st.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: st.cam.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        if (st.drag) st.drag.moved = true;
        return;
      }
      st.drag = { sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, target: e.target };
    });
    map.addEventListener('pointermove', e => {
      if (!st.ptr.has(e.pointerId)) return;
      st.ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const r = map.getBoundingClientRect();
      if (st.pinch && st.ptr.size >= 2) {
        const [a, b] = [...st.ptr.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        zoomAt(st.pinch.k * d / st.pinch.d, cx - r.left, cy - r.top);
        st.cam.x -= (cx - st.pinch.cx) / st.cam.k; st.cam.y -= (cy - st.pinch.cy) / st.cam.k;
        st.pinch.cx = cx; st.pinch.cy = cy;
        clampCam(); moved();
        return;
      }
      const g = st.drag;
      if (!g) return;
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 6) g.moved = true;
      if (g.moved) {
        st.cam.x -= (e.clientX - g.lx) / st.cam.k; st.cam.y -= (e.clientY - g.ly) / st.cam.k;
        clampCam(); moved();
      }
      g.lx = e.clientX; g.ly = e.clientY;
    });
    const up = e => {
      if (!st.ptr.has(e.pointerId)) return;
      st.ptr.delete(e.pointerId);
      if (st.pinch) { if (st.ptr.size < 2) { st.pinch = null; st.drag = null; } return; }
      const g = st.drag;
      st.drag = null;
      if (!g || g.moved || e.type === 'pointercancel') return;
      const r = map.getBoundingClientRect();
      tap(g.target, e.clientX - r.left, e.clientY - r.top);
    };
    map.addEventListener('pointerup', up);
    map.addEventListener('pointercancel', up);
    map.addEventListener('lostpointercapture', e => { if (st.ptr.has(e.pointerId)) up({ pointerId: e.pointerId, type: 'pointercancel' }); });
    map.addEventListener('wheel', e => {
      e.preventDefault();
      const r = map.getBoundingClientRect();
      zoomAt(st.cam.k * Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    map.addEventListener('contextmenu', e => e.preventDefault());
    // 키보드로 누른 문장·고을 (마우스·손가락은 pointerup 의 tap 이 맡는다)
    D.layer.addEventListener('click', e => {
      if (e.detail !== 0) return;
      const t = e.target.closest('[data-f],[data-site],[data-w]');
      if (t) { const r = t.getBoundingClientRect(), m = map.getBoundingClientRect(); tap(t, r.left + r.width / 2 - m.left, r.top + r.height / 2 - m.top); }
    });
    D.zoom.addEventListener('click', e => {
      const b = e.target.closest('[data-z]');
      if (!b) return;
      if (b.dataset.z === 'fit') { st.cam.k = st.minK; centerOn(WW / 2, WH / 2); }
      else zoomAt(st.cam.k * (b.dataset.z === 'in' ? 1.45 : 1 / 1.45), st.vw / 2, st.vh / 2);
    });
    D.close.addEventListener('click', () => (pickMode() ? back() : close()));
    D.seg.addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
    D.cards.addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) selectSite(b.dataset.pick, false); });
    byId('wm-prev').addEventListener('click', () => stepSite(-1));
    byId('wm-next').addEventListener('click', () => stepSite(1));
    byId('wm-go').addEventListener('click', go);
    byId('wm-random').addEventListener('click', goRandom);
    byId('wm-back').addEventListener('click', back);
    D.sideIn.addEventListener('click', e => {
      if (pickMode()) return;
      const t = e.target.closest('[data-act]');
      if (!t) return;
      const a = t.dataset.act;
      if (a === 'fold') { if (window.innerWidth <= 760) { st.fold = !st.fold; st.cover = st.fold; D.root.classList.toggle('fold', st.fold); renderPanel(true); } }
      else if (a === 'camp') { st.hiCamp = st.hiCamp === t.dataset.c ? null : t.dataset.c; ensureStatic(false); renderPanel(true); st.dirty = st.domDirty = true; }
      else if (a === 'f') select(t.dataset.f);
      else if (a === 'sheet') { const id = t.dataset.f; close(); if (typeof UI !== 'undefined') { UI.factionFocus = id; UI.openSheet('factions'); } }
    });
  }
  function tap(target, sx, sy) {
    const hit = target && target.closest ? target.closest('[data-f],[data-site],[data-w]') : null;
    if (pickMode()) {
      if (hit && hit.dataset.site) { selectSite(hit.dataset.site); return; }
      if (hit) return;   // 이웃 문장은 풀이만 (누르는 김에 곁의 다른 고을이 골라지지 않게)
      let best = null, bd = 34;
      for (const k of siteKeys()) { const d = Math.hypot(X(SITES[k].x) - sx, Y(SITES[k].y) - sy); if (d < bd) { bd = d; best = k; } }
      if (best) selectSite(best);
      return;
    }
    if (hit && hit.dataset.f) { select(hit.dataset.f === st.sel ? null : hit.dataset.f); return; }
    if (hit && hit.dataset.w) { selectWar(hit.dataset.w); return; }
    const w = toWorld(sx, sy), id = ownerAt(w.x, w.y);
    select(id && id !== st.sel ? id : null);
  }
  // 키: Esc 는 시트가 먼저(main.js), 그다음 천하도. 써 버린 키는 preventDefault 해서 main.js 가 무시하게 한다
  window.addEventListener('keydown', e => {
    if (!st.open || e.defaultPrevented) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!pickMode() && typeof UI !== 'undefined' && (UI.sheet || UI.modalOpen)) return;
    const k = e.key, pan = 90 / st.cam.k;
    let used = true;
    if (k === 'Escape') { if (pickMode()) back(); else close(); }
    else if (k === '+' || k === '=') zoomAt(st.cam.k * 1.3, st.vw / 2, st.vh / 2);
    else if (k === '-' || k === '_') zoomAt(st.cam.k / 1.3, st.vw / 2, st.vh / 2);
    else if (pickMode() && (k === 'ArrowLeft' || k === 'ArrowRight')) stepSite(k === 'ArrowLeft' ? -1 : 1);
    else if (pickMode() && k === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) go();
    else if (/^(w|W|ArrowUp)$/.test(k)) centerOn(st.cam.x, st.cam.y - pan);
    else if (/^(s|S|ArrowDown)$/.test(k)) centerOn(st.cam.x, st.cam.y + pan);
    else if (/^(a|A|ArrowLeft)$/.test(k)) centerOn(st.cam.x - pan, st.cam.y);
    else if (/^(d|D|ArrowRight)$/.test(k)) centerOn(st.cam.x + pan, st.cam.y);
    else used = false;
    if (used) e.preventDefault();
  });
  // 보기를 여는 동안 강호가 움직이면(두루마리의 선택 등) 다시 그린다
  for (const ev of ['jhNews', 'warStart', 'warEnd', 'vassal', 'pactChanged', 'routeChosen', 'questNew', 'questDone']) {
    Bus.on(ev, () => { if (st.open && !pickMode()) st.panelAt = 0; });
  }
  window.addEventListener('resize', () => { if (st.open) st.dirty = true; });

  // ── DOM 뼈대 ──
  function ensureDom() {
    if (D) return;
    const root = byId('worldmap');
    root.innerHTML = `
      <div class="wm-head">
        ${SEAL}
        <div class="wm-ht"><h2>부임할 고을을 고르시오</h2><p>고을마다 이웃 세력과 땅 생김, 열리는 갈래가 다르다. 지도에서 고을을 누르거나 아래 띠를 넘겨 본다.</p></div>
      </div>
      <div class="wm-map">
        <canvas class="wm-cv"></canvas>
        <div class="wm-layer"></div>
        <div class="wm-ctl"><div class="wm-seg" role="group" aria-label="천하도 보기">${VIEWS.map(([k, n]) => `<button type="button" data-view="${k}"${k === 'camp' ? ' class="on"' : ''}>${n}</button>`).join('')}</div><div class="wm-legend" hidden></div></div>
        <div class="wm-zoom">
          <button type="button" data-z="in" aria-label="확대" title="확대 (+)">+</button>
          <button type="button" data-z="out" aria-label="축소" title="축소 (−)">−</button>
          <button type="button" data-z="fit" aria-label="온 천하 보기" title="온 천하 보기"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg></button>
        </div>
        <button type="button" class="wm-close" aria-label="닫기" title="닫기 (Esc)">✕</button>
      </div>
      <div class="wm-strip">
        <button type="button" id="wm-prev" class="wm-arrow" aria-label="앞 고을">◀</button>
        <div class="wm-cards"></div>
        <button type="button" id="wm-next" class="wm-arrow" aria-label="다음 고을">▶</button>
      </div>
      <aside class="wm-side">
        <div class="wm-side-in"></div>
        <div class="wm-acts">
          <button type="button" id="wm-back" class="wm-btn ghost">돌아가기</button>
          <button type="button" id="wm-random" class="wm-btn ghost">아무 곳이나</button>
          <button type="button" id="wm-go" class="wm-btn primary">이곳에 부임한다</button>
        </div>
      </aside>`;
    const q = s => root.querySelector(s);
    D = { root, map: q('.wm-map'), cv: q('.wm-cv'), layer: q('.wm-layer'), seg: q('.wm-seg'), legend: q('.wm-legend'), zoom: q('.wm-zoom'),
      close: q('.wm-close'), cards: q('.wm-cards'), sideIn: q('.wm-side-in') };
    D.ctx = D.cv.getContext('2d');
    wire();
  }

  // ── 그리기 고리 (열려 있을 때만) ──
  function frame(t) {
    st.raf = 0;
    if (!st.open) return;
    st.raf = requestAnimationFrame(frame);
    measure();
    if (!pickMode()) {
      // 게임이 끝나 제목 화면으로 돌아갔으면 보기는 닫는다
      if (!S || !S.jh || !byId('title-screen').hidden) { close(); return; }
      if (t - st.panelAt > 450) {
        st.panelAt = t;
        // 강호가 바뀌었으면(두루마리의 선택, 이야기) 영역과 표시를 다시 맞춘다
        const sig = JSON.stringify([S.jh.wars.map(w => [w.id, w.score, w.mine]), S.jh.quests.map(q => q.id + q.state), S.jh.near, S.vassal, S.jh.pacts, S.jh.victory, Object.keys(S.jh.dead)]);
        if (sig !== st.lastSig) {
          st.lastSig = sig;
          if (st.selWar && !S.jh.wars.includes(st.selWar)) st.selWar = null;
          syncDynamic();
          st.dirty = st.domDirty = true;
        }
        ensureStatic(false);
        renderPanel();
      }
    }
    if (st.settleAt && t >= st.settleAt) { st.settleAt = 0; ensureStatic(true); }
    if (st.domDirty) { placeDom(); st.domDirty = false; st.dirty = true; }
    if (st.dirty || st.anim) draw(t);
  }

  // ── 열고 닫기 ──
  function open(mode, opts = {}) {
    if (mode !== 'pick' && mode !== 'view') return;
    if (st.open && st.mode === 'pick') return;            // 고르는 중에는 보기를 열지 않는다
    if (mode === 'view' && (!S || !S.jh)) return;
    if (mode === 'pick' && st.open) close();               // 보던 천하도는 닫고 고르기를 새로 연다
    ensureDom();
    const was = st.open;
    if (mode === 'pick') {
      st.world = opts.world || JH.makeWorld(opts.seed | 0);
      st.onPick = opts.onPick || null; st.onCancel = opts.onCancel || null; st.busy = false;
      st.site = siteKeys().find(k => SITES[k].first) || siteKeys()[0];
      st.info = JH.siteInfo(st.world, st.site);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();   // 이름 칸의 Enter 가 다시 새 게임을 열지 않게
    } else if (!was) {
      if (typeof UI !== 'undefined' && UI.sheet) UI.closeSheet();
      st.sel = null; st.selWar = null; st.hiCamp = null;
      st.fold = false;
    }
    st.mode = mode;
    st.open = true;
    st.own = null; st.stat = null; st.res = 0; st.lastPanel = ''; st.lastSig = ''; st.panelAt = 0;
    const root = D.root;
    root.className = mode === 'pick' ? 'wm-pick' : 'wm-view';
    root.classList.toggle('fold', st.fold);
    root.hidden = false;
    if (mode === 'pick') { D.cards.innerHTML = stripHTML(); }
    else { D.seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === st.view)); legend(); }
    st.vw = st.vh = 0;
    measure(true);
    buildMarkers();
    renderPanel(true);
    // 처음 자리: 고르기는 온 천하, 보기는 데스크톱은 온 천하·폰은 높이에 맞춰 내 고을 가운데
    if (!was) {
      st.cam.k = st.minK;
      if (mode === 'view' && st.vw < 640) { const hs = homeSite(); centerOn(hs.x, hs.y, Math.max(st.minK, st.vh / (WH + 2 * PAD) * 0.95)); }
      else centerOn(WW / 2, WH / 2);
    }
    if (mode === 'view') {
      const f = opts.focus;
      if (f && fac(f)) { select(f); const s = seatOf(f); if (s) centerOn(s.x, s.y, Math.max(st.cam.k, st.minK * 2)); }
      else if (f && JH.warById(f)) { selectWar(f); const w = JH.warById(f); centerOn(w.front.x, w.front.y, Math.max(st.cam.k, st.minK * 1.8)); }
      if (!was) Bus.emit('sheetOpen', 'worldmap');
    }
    ensureStatic(true);
    st.dirty = st.domDirty = true;
    if (!st.raf) st.raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!st.open) return;
    const mode = st.mode;
    st.open = false; st.mode = null;
    if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
    st.ptr.clear(); st.drag = st.pinch = null;
    D.root.hidden = true;
    D.layer.innerHTML = ''; st.m = null;
    st.stat = null; D.cv.width = D.cv.height = 1;   // 큰 캔버스는 놓아 준다
    hook(typeof Tips === 'undefined' ? null : Tips, 'hide');
    if (mode === 'pick') st.world = null;
    if (mode === 'view') Bus.emit('sheetClose', 'worldmap');
  }

  return {
    open,
    close,
    isOpen() { return st.open; },
    mode() { return st.open ? st.mode : null; },
  };
})();
