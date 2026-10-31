'use strict';
// ───────────────────────────────────────────────
// 그림: 건물·나무·사람을 코드로 그린다 (외부 이미지 없음)
// 등각(2.5D) 그림 — 타일 x+1 은 화면 오른쪽 아래, y+1 은 왼쪽 아래 (docs/architecture.md 2.1)
// 건물과 나무는 2배 해상도 캔버스에 미리 그려 캐시한다.
// ───────────────────────────────────────────────
const SS = 2;
const PAL = {
  plaster: '#ebe0c8', plasterShade: '#c9b996',
  wood: '#6b4428', woodDark: '#3b2414', woodLight: '#90633a',
  roof: '#3c4655', roofLight: '#5b6880', roofDark: '#232a35', roofTile: '#8d9ab0',
  thatch: '#c9a35a', thatchDark: '#8f6e36', thatchLight: '#e0c47f',
  stone: '#9b968b', stoneDark: '#6b6860', stoneLight: '#c0bbaf',
  red: '#a3342a', redDark: '#651d16', gold: '#d8a944', lantern: '#e0482f',
  snow: '#f3f6f9', soil: '#866443', soilDark: '#6a4d33', paper: '#efe3c2',
  green: '#3f8a66', blue: '#3b6ea5',
  mud: '#d9c49a', jade: '#2f6f58', bamboo: '#a8a052',
};

function rr(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function ell(c, col, x, y, rx, ry) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function circ(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function line(c, col, w, x1, y1, x2, y2) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

// ── 건물별 메타 (렌더러용, 모두 월드 픽셀) ─────────────
//  height: 땅에서 가장 높은 곳(용마루·지붕 꼭대기·깃대)까지의 높이. 고르기 상자·불길·연기 높이에 쓴다.
//  eave:   처마 끝 높이(지붕이 없으면 0). 창 불빛·불길을 붙일 높이
//  smoke:  [dx, dy] 굴뚝·향로에서 연기가 오르는 곳. 발판 북쪽 꼭짓점 worldOf(b.x, b.y) 기준
//  flag:   [dx, dy] 영주관 깃대 밑동 — 동쪽 꼭짓점의 기단 위. 같은 기준. 처마 모서리가 58 높이에 있으니
//          깃대가 그보다 길면(70 안팎) 지붕 모서리 옆으로 깃발이 솟는다
//  archer: [dx, dy] 망루 궁수의 발. 망대 바닥 = 타일 중심에서 56 위 = (0, 16 - 56)
//  gateMask: 성문은 extra 에 이웃 마스크 문자열(목책·석벽과 같은 뜻)을 주면 담장 방향에 맞춰 돈다.
//          N·S(1·4)에만 담이 있으면 문짝이 오른쪽 앞면(+x)을 보고, 아니면(빈 문자열 포함) 왼쪽 앞면(+y)을 본다
// 계산 도움: 발판 안 평면점 (u, v)(타일), 높이 z 의 오프셋은 dx = (u - v) * 32, dy = (u + v) * 16 - z
const SPRITE_META = {
  manor: { height: 92, eave: 50, flag: [94, 41] },
  house: { height: 56, eave: 32 },
  house2: { height: 74, eave: 38 },
  farm: { height: 32, eave: 0, ground: true },
  fishery: { height: 44, eave: 22 },
  lumber: { height: 48, eave: 29 },
  quarry: { height: 60, eave: 0 },
  warehouse: { height: 80, eave: 40 },
  smithy: { height: 80, eave: 39, smoke: [6, -61] },
  market: { height: 58, eave: 21 },
  inn: { height: 103, eave: 34 },
  escort: { height: 78, eave: 41 },
  clinic: { height: 72, eave: 36 },
  shrine: { height: 72, eave: 39, smoke: [-42, 26] },
  well: { height: 47, eave: 34 },
  pavilion: { height: 64, eave: 37 },
  dojo: { height: 62, eave: 36 },
  tower: { height: 120, eave: 90, archer: [0, -40] },
  wall: { height: 28, eave: 0 },
  stonewall: { height: 32, eave: 0 },
  gate: { height: 63, eave: 44, gateMask: true },
  // 갈래 건물 (docs/jianghu.md §8.4). sign: 그림에 쓴 현판 글자(풀이는 아래 SPRITE_GLOSS).
  //  light: BDEF.light 와 같은 꼴 [x, y, 반경, 색, 높이] — BDEF 에 불빛이 없으면 렌더러가 이것을 쓴다
  hall_jeong: { height: 110, eave: 37, sign: '義俠堂', light: [[0.62, 2.55, 2.2, '#ffcf6a', 14], [2.38, 2.55, 2.2, '#ffcf6a', 14]] },
  altar_ma: { height: 74, eave: 0, smoke: [0, 3], sign: '血祭壇', light: [[1.0, 1.0, 2.8, '#ff4a32', 30]] },
  ancestral: { height: 82, eave: 34, sign: '宗家', light: [[1.5, 2.95, 1.9, '#ffbe6a', 26]] },
  blackmarket: { height: 66, eave: 30, sign: '黑市', light: [[0.75, 1.92, 1.9, '#ff6a3a', 20], [2.2, 1.92, 1.9, '#ff6a3a', 20], [1.5, 0.95, 1.7, '#ffa24a', 24]] },
  gambling: { height: 100, eave: 37, sign: '賭坊', light: [[0.55, 1.85, 2.2, '#ff7a4a', 22], [2.45, 1.85, 2.2, '#ff7a4a', 22], [1.5, 1.7, 1.8, '#ffb25a', 14]] },
  horsemarket: { height: 58, eave: 15, sign: '互市', light: [[0.8, 1.45, 1.8, '#ffb25a', 10]] },
  yamen: { height: 92, eave: 38, sign: '衙門', light: [[0.55, 1.9, 2.2, '#ffbe6a', 22], [2.45, 1.9, 2.2, '#ffbe6a', 22]] },
  stage: { height: 76, eave: 0, sign: '演武臺', light: [[0.2, 2.5, 2.0, '#ffa04a', 24], [2.8, 2.5, 2.0, '#ffa04a', 24]] },
};
// 그림 속 현판 글자의 풀이: data.js 에 이미 있는 풀이는 덮어쓰지 않는다
const SPRITE_GLOSS = {
  '義俠堂': ['의협당', '의로운 협객들이 모이는 집. 정파의 길에서 세운다.'],
  '血祭壇': ['혈제단', '피로 제사를 올리는 돌단. 마교의 길에서 세운다.'],
  '宗家': ['종가', '한 가문의 맏집. 조상의 위패를 모신다. 세가의 길에서 세운다.'],
  '黑市': ['흑시', '밤에 몰래 서는 검은 장. 흑도의 길에서 세운다.'],
  '賭坊': ['도방', '노름판이 서는 집, 곧 도박장. 사파의 길에서 세운다.'],
  '互市': ['호시', '변경에서 서로 물건을 바꾸는 장. 새외의 길에서 세운다.'],
  '衙門': ['아문', '관청의 문, 곧 관아. 관의 길에서 세운다.'],
  '演武臺': ['연무대', '무예를 펼쳐 보이고 겨루는 대. 홀로 서는 길에서 세운다.'],
  '俠': ['호협할 협', '협객. 의를 위해 칼을 드는 사람.'],
  '堂': ['집 당', '큰 집, 대청.'],
  '壇': ['단 단', '제사를 지내려고 흙이나 돌로 쌓은 단.'],
  '坊': ['동네 방', '동네, 또는 무엇을 하는 집.'],
  '演': ['펼 연', '펼쳐 보임.'],
};
for (const [k, v] of Object.entries(SPRITE_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

// ── 등각 그림 도구 (모듈 안에 숨겨 다른 파일의 이름과 부딪히지 않게) ──
const IsoArt = (() => {
  const X = (u, v) => (u - v) * 32;
  const Y = (u, v, z = 0) => (u + v) * 16 - z;

  // 색 섞기 ('#rrggbb' 만)
  function rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((x, i) => Math.round(x + (B[i] - x) * t).toString(16).padStart(2, '0')).join('');
  }
  function shade(col, k) { return k >= 0 ? mix(col, '#ffffff', k) : mix(col, '#000000', -k); }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ── 기본 도형 ──
  function path3(c, pts) {
    c.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; const x = X(p[0], p[1]), y = Y(p[0], p[1], p[2]); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
    c.closePath();
  }
  function fill3(c, col, pts) { path3(c, pts); c.fillStyle = col; c.fill(); }
  function seg3(c, col, w, a, b) {
    c.strokeStyle = col; c.lineWidth = w; c.beginPath();
    c.moveTo(X(a[0], a[1]), Y(a[0], a[1], a[2])); c.lineTo(X(b[0], b[1]), Y(b[0], b[1], b[2])); c.stroke();
  }
  // 상자: 윗면 + 왼쪽 앞면(+v) + 오른쪽 앞면(+u)
  function box(c, u0, v0, u1, v1, z0, z1, col, o = {}) {
    const left = o.left || col, right = o.right || shade(col, -0.26), top = o.top || shade(col, 0.16);
    if (z1 > z0) {
      fill3(c, left, [[u0, v1, z0], [u1, v1, z0], [u1, v1, z1], [u0, v1, z1]]);
      fill3(c, right, [[u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u1, v1, z1]]);
    }
    if (!o.noTop) fill3(c, top, [[u0, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]]);
    if (o.edge) {
      c.strokeStyle = o.edge; c.lineWidth = o.ew || 0.5; c.lineJoin = 'round';
      path3(c, [[u0, v1, z0], [u1, v1, z0], [u1, v0, z0], [u1, v0, z1], [u0, v0, z1], [u0, v1, z1]]); c.stroke();
      c.beginPath();
      c.moveTo(X(u0, v1), Y(u0, v1, z1)); c.lineTo(X(u1, v1), Y(u1, v1, z1)); c.lineTo(X(u1, v0), Y(u1, v0, z1));
      c.moveTo(X(u1, v1), Y(u1, v1, z1)); c.lineTo(X(u1, v1), Y(u1, v1, z0));
      c.stroke();
    }
  }
  function post(c, u, v, z0, z1, r, col, o) { box(c, u - r, v - r, u + r, v + r, z0, z1, col, o); }
  // 면 좌표계: (fx 오른쪽, fy 아래) 단위는 1/32 타일과 월드 픽셀
  // 왼쪽 앞면(+v 면): 원점 (u0, v, z)
  function onL(c, u0, v, z, fn) { c.save(); c.transform(1, 0.5, 0, 1, X(u0, v), Y(u0, v, z)); fn(); c.restore(); }
  // 오른쪽 앞면(+u 면): 원점 (u, v1, z) — 화면에서 그 면의 왼쪽 끝
  function onR(c, u, v1, z, fn) { c.save(); c.transform(1, -0.5, 0, 1, X(u, v1), Y(u, v1, z)); fn(); c.restore(); }
  // 수평면: (a, b) = u, v 방향 1/32 타일
  function onTop(c, u0, v0, z, fn) { c.save(); c.transform(1, 0.5, -1, 0.5, X(u0, v0), Y(u0, v0, z)); fn(); c.restore(); }
  // 세운 원기둥 (r: 타일)
  function cylV(c, u, v, r, z0, z1, side, top, o = {}) {
    const x = X(u, v), rx = r * 45.25, ry = r * 22.63;
    const y0 = Y(u, v, z0), y1 = Y(u, v, z1);
    const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
    g.addColorStop(0, shade(side, 0.12)); g.addColorStop(0.45, side); g.addColorStop(1, shade(side, -0.35));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x - rx, y1); c.lineTo(x - rx, y0); c.ellipse(x, y0, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, y1); c.closePath(); c.fill();
    if (top) ell(c, top, x, y1, rx, ry);
    if (o.rim) { c.strokeStyle = o.rim; c.lineWidth = 0.5; c.beginPath(); c.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2); c.stroke(); }
  }
  // 바닥 그늘
  function ao(c, u0, v0, u1, v1, k = 1) {
    for (let i = 3; i >= 1; i--) {
      const m = 0.045 * i;
      fill3(c, `rgba(22,15,8,${0.075 * k})`, [[u0 - m * 0.5, v0 - m * 0.5, 0], [u1 + m * 1.3, v0 - m * 0.3, 0], [u1 + m * 1.3, v1 + m, 0], [u0 - m * 0.3, v1 + m, 0]]);
    }
  }

  // ── 돌 쌓기 (면 좌표) ──
  function stoneCourses(c, len, H, rnd, o = {}) {
    const rowH = o.rowH || 3.4;
    let row = 0;
    for (let y = 0; y > -H + 0.4; y -= rowH, row++) {
      const yt = Math.max(-H, y - rowH);
      let x = row % 2 ? -rnd() * 6 : -rnd() * 2;
      while (x < len) {
        const bw = (o.blk || 7) + rnd() * (o.blkVar || 6);
        const x0 = Math.max(0, x), x1 = Math.min(len, x + bw);
        if (x1 > x0) {
          const t = rnd();
          c.fillStyle = t < 0.3 ? 'rgba(255,255,255,0.10)' : t < 0.6 ? 'rgba(0,0,0,0.08)' : 'rgba(120,100,70,0.06)';
          c.fillRect(x0, yt, x1 - x0, y - yt);
          c.fillStyle = 'rgba(38,34,28,0.5)';
          c.fillRect(x1 - 0.3, yt, 0.5, y - yt);
        }
        x += bw;
      }
      c.fillStyle = 'rgba(38,34,28,0.45)';
      c.fillRect(0, yt - 0.25, len, 0.5);
    }
  }
  // 기단 (돌 판)
  function plinth(c, u0, v0, u1, v1, z0, z1, o = {}) {
    const col = o.col || PAL.stone;
    box(c, u0, v0, u1, v1, z0, z1, col, { top: o.top || shade(col, 0.2), right: shade(col, -0.24) });
    const h = z1 - z0;
    if (h > 2.5) {
      onL(c, u0, v1, z0, () => stoneCourses(c, (u1 - u0) * 32, h, o.rnd, o));
      onR(c, u1, v1, z0, () => { stoneCourses(c, (v1 - v0) * 32, h, o.rnd, o); rr(c, 'rgba(15,10,6,0.12)', 0, -h, (v1 - v0) * 32, h); });
    }
    seg3(c, 'rgba(255,255,255,0.35)', 0.6, [u0, v1, z1], [u1, v1, z1]);
    seg3(c, 'rgba(255,255,255,0.22)', 0.6, [u1, v1, z1], [u1, v0, z1]);
    if (o.snow) {
      fill3(c, 'rgba(240,244,249,0.9)', [[u0, v1 - 0.06, z1], [u1 - 0.06, v1 - 0.06, z1], [u1 - 0.06, v0, z1], [u1, v0, z1], [u1, v1, z1], [u0, v1, z1]]);
    }
  }
  function steps(c, u0, u1, vB, vF, z0, z1, n, col = PAL.stone) {
    const dv = (vF - vB) / n, dh = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      box(c, u0, vB, u1, vB + (n - i) * dv, z0, z0 + (i + 1) * dh, col, { top: shade(col, 0.22), right: shade(col, -0.25) });
      seg3(c, 'rgba(255,255,255,0.3)', 0.5, [u0, vB + (n - i) * dv, z0 + (i + 1) * dh], [u1, vB + (n - i) * dv, z0 + (i + 1) * dh]);
    }
  }

  // ── 창호와 벽면 (면 좌표: x 0..len, y -H..0) ──
  function panel(c, x, y, w, h, style, o = {}) {
    if (w <= 0.5 || h <= 0.5) return;
    rr(c, o.frame || '#4a2c18', x - 0.8, y - 0.8, w + 1.6, h + 1.6);
    rr(c, o.paper || PAL.paper, x, y, w, h);
    c.fillStyle = o.bar || 'rgba(98,62,34,0.85)';
    if (style === 'tti') {
      for (let xx = x + 1.15; xx < x + w - 0.3; xx += 1.15) c.fillRect(xx - 0.17, y, 0.34, h);
      for (const t of [0.1, 0.5, 0.9]) for (let k = -1; k <= 1; k++) c.fillRect(x, y + h * t + k * 0.7 - 0.17, w, 0.34);
    } else if (style === 'yong') {
      const n = Math.max(2, Math.round(w / 3.2));
      for (let i = 1; i < n; i++) c.fillRect(x + w * i / n - 0.2, y, 0.4, h);
      c.fillRect(x, y + h * 0.33 - 0.2, w, 0.4); c.fillRect(x, y + h * 0.66 - 0.2, w, 0.4);
    } else {
      const s = o.cell || 1.9;
      for (let xx = x + s; xx < x + w - 0.3; xx += s) c.fillRect(xx - 0.17, y, 0.34, h);
      for (let yy = y + s; yy < y + h - 0.3; yy += s) c.fillRect(x, yy - 0.17, w, 0.34);
    }
    rr(c, 'rgba(255,250,235,0.18)', x, y, w, 0.6);
  }
  function plankDoor(c, x, y, w, h, col, studs) {
    rr(c, '#26160d', x - 1, y - 1, w + 2, h + 1);
    rr(c, col, x, y, w, h);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let xx = x + 2; xx < x + w - 0.5; xx += 2) c.fillRect(xx - 0.2, y, 0.4, h);
    rr(c, 'rgba(0,0,0,0.5)', x + w / 2 - 0.35, y, 0.7, h);
    rr(c, 'rgba(255,255,255,0.1)', x, y, w, 0.7);
    if (studs) {
      for (const t of [0.16, 0.5, 0.84]) for (let xx = x + 1.6; xx < x + w - 1; xx += 2.6) circ(c, '#d8b45a', xx, y + h * t, 0.45);
      circ(c, '#e2c070', x + w / 2 - 1.3, y + h * 0.56, 0.7); circ(c, '#e2c070', x + w / 2 + 1.3, y + h * 0.56, 0.7);
    }
  }
  function bayItem(c, kind, x0, x1, top, vis, o) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    const beam = o.mid || o.pillar || PAL.wood;
    const midY = top + vis * 0.55;
    switch (kind) {
      case 'wall':
        rr(c, beam, x0, midY - 0.7, w, 1.4);
        rr(c, 'rgba(0,0,0,0.05)', x0, midY + 0.7, w, -midY - 2.9);
        break;
      case 'win': {
        rr(c, beam, x0, midY - 0.7, w, 1.4);
        const ww = Math.min(w - 2.6, o.winW || 11), wh = Math.min(vis * 0.36, o.winH || 8);
        panel(c, cx - ww / 2, midY - 1.3 - wh, ww, wh, o.winStyle || 'grid', o);
        break;
      }
      case 'door': panel(c, x0 + 0.9, top + 2.8, w / 2 - 1.1, vis - 5.2, o.doorStyle || 'tti', o); panel(c, cx + 0.2, top + 2.8, w / 2 - 1.1, vis - 5.2, o.doorStyle || 'tti', o); break;
      case 'door1': { const dw = Math.min(w - 2, 8); panel(c, cx - dw / 2, top + 2.8, dw, vis - 5.2, o.doorStyle || 'tti', o); rr(c, beam, x0, midY - 0.7, cx - dw / 2 - 0.8 - x0, 1.4); rr(c, beam, cx + dw / 2 + 0.8, midY - 0.7, x1 - cx - dw / 2 - 0.8, 1.4); break; }
      case 'lat': {
        const h = vis - 5.2, yy = top + 2.8, lw = w / 2 - 1.1;
        for (const lx of [x0 + 0.9, cx + 0.2]) {
          panel(c, lx, yy, lw, h * 0.7, 'grid', o);
          rr(c, o.frame || '#4a2c18', lx - 0.8, yy + h * 0.7, lw + 1.6, h * 0.3);
          rr(c, o.lowPanel || '#7a5232', lx + 0.4, yy + h * 0.7 + 0.8, lw - 0.8, h * 0.3 - 1.6);
        }
        break;
      }
      case 'red': plankDoor(c, x0 + 0.9, top + 2.8, w - 1.8, vis - 5.2, o.doorCol || '#8c2a1f', true); break;
      case 'plank': plankDoor(c, x0 + 0.9, top + 2.8, w - 1.8, vis - 5.2, '#6a4528', false); break;
      case 'bigdoor': {
        const dx = x0 + 1, dw = w - 2, dy = top + 2.5, dh = vis - 4.7;
        plankDoor(c, dx, dy, dw, dh, '#5e3c22', false);
        c.strokeStyle = '#2a1a10'; c.lineWidth = 0.9;
        for (const [a, b] of [[dx, dx + dw / 2], [dx + dw / 2, dx + dw]]) {
          c.beginPath(); c.moveTo(a + 0.5, dy + 1); c.lineTo(b - 0.5, dy + dh - 1); c.moveTo(b - 0.5, dy + 1); c.lineTo(a + 0.5, dy + dh - 1); c.stroke();
        }
        rr(c, '#3a3f45', dx, dy + dh * 0.25, dw, 0.9); rr(c, '#3a3f45', dx, dy + dh * 0.72, dw, 0.9);
        circ(c, '#9aa2a8', cx - 0.9, dy + dh * 0.5, 0.6); circ(c, '#9aa2a8', cx + 0.9, dy + dh * 0.5, 0.6);
        break;
      }
      case 'board': {
        rr(c, o.board || '#7a5232', x0, top, w, vis);
        c.fillStyle = 'rgba(30,18,10,0.45)';
        for (let xx = x0 + 2.4; xx < x1; xx += 2.4) c.fillRect(xx - 0.2, top, 0.4, vis);
        c.fillStyle = 'rgba(255,230,190,0.08)';
        for (let xx = x0 + 0.4; xx < x1; xx += 2.4) c.fillRect(xx, top, 0.6, vis);
        rr(c, 'rgba(30,18,10,0.6)', x0, midY - 0.6, w, 1.2);
        break;
      }
      case 'vent': {
        rr(c, beam, x0, midY - 0.7, w, 1.4);
        const ww = Math.min(w - 3, 9);
        rr(c, '#2a1a10', cx - ww / 2, top + 2.5, ww, 4.5);
        for (let xx = cx - ww / 2 + 1.2; xx < cx + ww / 2; xx += 1.6) rr(c, '#6a4528', xx - 0.4, top + 2.5, 0.8, 4.5);
        break;
      }
      case 'open': {
        const g = c.createLinearGradient(0, top, 0, 0);
        g.addColorStop(0, '#140c07'); g.addColorStop(1, '#3a2617');
        c.fillStyle = g; c.fillRect(x0, top, w, vis);
        if (o.openFn) o.openFn(c, x0, x1, top, vis);
        break;
      }
      default: break;
    }
  }
  function dancheong(c, x, y, w, h) {
    rr(c, '#2f6f58', x, y, w, h);
    const cols = ['#b53a2c', '#e6d7b0', '#3d6ea8', '#e6d7b0'];
    for (let i = 0, xx = x + 0.8; xx < x + w - 1; xx += 3.2, i++) rr(c, cols[i % 4], xx, y + 0.5, 1.4, h - 1);
  }
  function faceSign(c, cx, y, w, h, text, o = {}) {
    const x = cx - w / 2;
    rr(c, o.frame || '#5e2a1a', x - 1.2, y - 1.2, w + 2.4, h + 2.4);
    rr(c, o.bg || '#1b1410', x, y, w, h);
    rr(c, 'rgba(216,169,68,0.55)', x - 1.2, y - 1.2, w + 2.4, 0.5);
    c.fillStyle = o.fg || PAL.gold; c.textAlign = 'center'; c.textBaseline = 'middle';
    const chars = [...text];
    if (o.vertical) {
      const fs = Math.min(w * 0.86, h / chars.length * 0.92);
      c.font = `${fs}px "Song Myung", serif`;
      chars.forEach((ch, i) => c.fillText(ch, cx, y + (i + 0.5) * h / chars.length + 0.3));
    } else {
      const fs = Math.min(h * 0.86, w / chars.length * 0.94);
      c.font = `${fs}px "Song Myung", serif`;
      c.fillText(text, cx, y + h / 2 + 0.4);
    }
  }
  // 벽 한 면. o: bays, items, plaster, pillar, beam, hid(처마에 가리는 위 띠), shade, dan, sign
  function wallFace(c, len, H, o = {}) {
    const hid = Math.min(o.hid || 0, H - 8);
    const top = -H + hid, vis = H - hid;
    const n = o.bays || Math.max(1, Math.round(len / 24));
    const bw = len / n, pw = o.pw || 2.8;
    rr(c, o.plaster || PAL.plaster, 0, -H, len, H);
    if (o.lowStone) {
      rr(c, PAL.stone, 0, -o.lowStone - 2, len, o.lowStone);
      stoneCourses(c, len, o.lowStone + 2, o.rnd || Math.random, { rowH: 2.4, blk: 4, blkVar: 3 });
    }
    for (let i = 0; i < n; i++) {
      const kind = o.items ? (o.items[i] || 'wall') : 'wall';
      bayItem(c, kind, i * bw + pw / 2, (i + 1) * bw - pw / 2, top, vis, o);
    }
    rr(c, o.sill || PAL.woodDark, 0, -2.2, len, 2.2);
    rr(c, o.beam || PAL.woodDark, 0, -H, len, hid + 2.4);
    if (o.dan) dancheong(c, 0, top - 0.6, len, 2.8);
    for (let i = 0; i <= n; i++) {
      const x = clamp(i * bw - pw / 2, 0, len - pw);
      rr(c, o.pillar || PAL.wood, x, -H, pw, H);
      rr(c, 'rgba(255,255,255,0.16)', x, -H, 0.8, H);
      rr(c, 'rgba(0,0,0,0.22)', x + pw - 0.7, -H, 0.7, H);
    }
    const g = c.createLinearGradient(0, top - 2, 0, top + 9);
    g.addColorStop(0, 'rgba(12,8,5,0.5)'); g.addColorStop(1, 'rgba(12,8,5,0)');
    c.fillStyle = g; c.fillRect(0, -H, len, hid + 9);
    if (o.sign) faceSign(c, len / 2 + (o.signDx || 0), top + 2.8, o.signW || Math.min(len * 0.42, 34), o.signH || 8.5, o.sign, o.signOpt || {});
    if (o.shade) rr(c, `rgba(18,11,6,${o.shade})`, 0, -H, len, H);
  }
  // 몸채 두 앞면. Lo: 왼쪽 앞면 옵션, Ro: 오른쪽 앞면에서 바꿀 것
  function walls(c, u0, v0, u1, v1, z0, H, Lo, Ro = {}) {
    onL(c, u0, v1, z0, () => wallFace(c, (u1 - u0) * 32, H, Lo));
    onR(c, u1, v1, z0, () => wallFace(c, (v1 - v0) * 32, H, Object.assign({}, Lo, { shade: 0.2, sign: null }, Ro)));
  }

  // ── 기와지붕 (팔작·우진각·맞배) ──
  const ROOFC = {
    tile: { 'v+': '#5a667b', 'u-': '#4d586c', 'u+': '#3a4353', 'v-': '#2c333e', cap: '#232933', capHi: '#76839a', fascia: '#1b2028', tileEnd: '#9ba7bb', groove: 'rgba(12,15,22,0.55)', hi: 'rgba(205,218,238,0.17)', gable: '#d6c7a6' },
    board: { 'v+': '#7f5f3e', 'u-': '#715336', 'u+': '#583f28', 'v-': '#46311f', cap: '#3a2716', capHi: '#a07a52', fascia: '#2c1d11', tileEnd: null, groove: 'rgba(36,22,12,0.5)', hi: 'rgba(255,226,180,0.12)', gable: '#8a6440' },
  };
  const SNOWC = { 'v+': '#f2f5f9', 'u-': '#e5ebf2', 'u+': '#c8d2de', 'v-': '#b7c3d1' };
  // R: { u0,v0,u1,v1: 벽체, e: 처마 내밈, zE: 처마 끝, zR: 용마루, form, gable, lift, axis('u'|'v'), trim, snow, pal, zW }
  // 돌려줌: zAt(u, v) — 그 평면점의 지붕 높이
  function tileRoof(c, R) {
    const P = R.pal || ROOFC.tile;
    const ax = R.axis === 'v';
    const e = R.e;
    const wa0 = ax ? R.v0 : R.u0, wa1 = ax ? R.v1 : R.u1, wb0 = ax ? R.u0 : R.v0, wb1 = ax ? R.u1 : R.v1;
    const a0 = wa0 - e, a1 = wa1 + e, b0 = wb0 - e, b1 = wb1 + e;
    const Dd = (b1 - b0) / 2, bc = (b0 + b1) / 2;
    const form = R.form || 'paljak';
    let dG = form === 'hip' ? Dd : form === 'matbae' ? 0 : Dd * (1 - (R.gable == null ? 0.45 : R.gable));
    dG = Math.min(dG, (a1 - a0) / 2);
    const ag0 = a0 + dG, ag1 = a1 - dG;
    const prof = R.prof || (form === 'matbae' ? 1.25 : 1.5), liftR = R.liftR || 0.95, lift = R.lift == null ? 4 : R.lift;
    const zE = R.zE, dz = R.zR - R.zE;
    const uv = (a, b) => (ax ? [b, a] : [a, b]);
    // 맞배는 박공선이 휘지 않게 들림이 처마 근처에서만
    const liftPow = form === 'matbae' ? 4 : 1.6;
    // back: 북쪽(뒤) 모서리 근처 — 들림을 줄여 용마루 위로 삐죽 솟지 않게
    const zOf = (d, o, back) => {
      const t = clamp(d / Dd, 0, 1), k = Math.max(0, 1 - Math.max(0, o) / liftR);
      return zE + dz * Math.pow(t, prof) + lift * (back ? 0.3 : 1) * k * k * Math.pow(1 - t, liftPow);
    };
    const SF = {
      bn: (a, b) => zOf(b - b0, Math.min(a - a0, a1 - a), a - a0 < a1 - a),
      bp: (a, b) => zOf(b1 - b, Math.min(a - a0, a1 - a), false),
      an: (a, b) => zOf(a - a0, Math.min(b - b0, b1 - b), b - b0 < b1 - b),
      ap: (a, b) => zOf(a1 - a, Math.min(b - b0, b1 - b), false),
    };
    const sp = (f, a, b, off = 0) => { const q = uv(a, b); return [X(q[0], q[1]), Y(q[0], q[1], SF[f](a, b) + off)]; };
    const samp = (f, p, q, off = 0, out = []) => {
      const m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * 14));
      for (let k = 0; k <= m; k++) out.push(sp(f, lerp(p[0], q[0], k / m), lerp(p[1], q[1], k / m), off));
      return out;
    };
    const pathPts = (pts, close = true) => {
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      if (close) c.closePath();
    };
    const tracePoly = (f, poly) => { const pts = []; for (let i = 0; i < poly.length; i++) samp(f, poly[i], poly[(i + 1) % poly.length], 0, pts); pathPts(pts); };
    const strokeAlong = (f, p, q, col, w, off = 0) => { c.strokeStyle = col; c.lineWidth = w; pathPts(samp(f, p, q, off), false); c.stroke(); };
    const POLY = {
      bn: [[a0, b0], [a1, b0], [ag1, b0 + dG], [ag1, bc], [ag0, bc], [ag0, b0 + dG]],
      bp: [[a0, b1], [ag0, b1 - dG], [ag0, bc], [ag1, bc], [ag1, b1 - dG], [a1, b1]],
      an: [[a0, b0], [ag0, b0 + dG], [ag0, b1 - dG], [a0, b1]],
      ap: [[a1, b1], [ag1, b1 - dG], [ag1, b0 + dG], [a1, b0]],
    };
    const FACE = { bn: ax ? 'u-' : 'v-', bp: ax ? 'u+' : 'v+', an: ax ? 'v-' : 'u-', ap: ax ? 'v+' : 'u+' };
    const ends = dG > 0.02;
    const st = R.step || 0.1;
    const seed = R.seed || 0;

    function slope(f) {
      if ((f === 'an' || f === 'ap') && !ends) return;
      tracePoly(f, POLY[f]);
      c.fillStyle = P[FACE[f]]; c.fill();
      c.save(); c.clip();
      // 용마루 쪽은 조금 어둡게
      const main = f === 'bn' || f === 'bp';
      const pm = main ? [(a0 + a1) / 2, f === 'bp' ? b1 : b0] : [f === 'ap' ? a1 : a0, bc];
      const pr = main ? [(a0 + a1) / 2, bc] : [(a0 + a1) / 2, bc];
      const sE = sp(f, pm[0], pm[1]), sR = sp(f, pr[0], pr[1]);
      const g = c.createLinearGradient(sR[0], sR[1], sE[0], sE[1]);
      g.addColorStop(0, 'rgba(0,0,0,0.16)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(255,255,255,0.06)');
      c.fillStyle = g; c.fillRect(-400, -400, 800, 800);
      // 기와골
      if (main) {
        const eb = f === 'bp' ? b1 : b0;
        for (let a = a0 + st * 0.5; a < a1; a += st) {
          strokeAlong(f, [a, eb], [a, bc], P.groove, 0.75);
          strokeAlong(f, [a + st * 0.5, eb], [a + st * 0.5, bc], P.hi, 0.5);
        }
      } else {
        const ea = f === 'ap' ? a1 : a0, am = (a0 + a1) / 2;
        for (let b = b0 + st * 0.5; b < b1; b += st) {
          strokeAlong(f, [ea, b], [am, b], P.groove, 0.75);
          strokeAlong(f, [ea, b + st * 0.5], [am, b + st * 0.5], P.hi, 0.5);
        }
      }
      if (R.snow) {
        const sn = R.snowD || Math.min(0.2, Dd * 0.26);
        const pts = [];
        if (main) {
          const eb = f === 'bp' ? b1 : b0, dir = f === 'bp' ? -1 : 1;
          for (let a = a0 - 0.3; a <= a1 + 0.3; a += 0.035) {
            const wv = 0.035 * Math.sin(a * 21.7 + seed) + 0.022 * Math.sin(a * 57.1 + 1.3 + seed);
            pts.push(sp(f, a, eb + dir * (sn + wv)));
          }
          for (let a = a1 + 0.3; a >= a0 - 0.3; a -= 0.25) pts.push(sp(f, a, bc - dir * 0.3, 8));
        } else {
          const ea = f === 'ap' ? a1 : a0, dir = f === 'ap' ? -1 : 1, am = (a0 + a1) / 2;
          for (let b = b0 - 0.3; b <= b1 + 0.3; b += 0.035) {
            const wv = 0.035 * Math.sin(b * 23.3 + seed) + 0.02 * Math.sin(b * 51.7 + seed);
            pts.push(sp(f, ea + dir * (sn + wv), b));
          }
          for (let b = b1 + 0.3; b >= b0 - 0.3; b -= 0.25) pts.push(sp(f, am, b, 8));
        }
        pathPts(pts);
        c.fillStyle = SNOWC[FACE[f]]; c.fill();
        const n = main ? Math.round(((a1 - a0) + 0.6) / 0.035) + 1 : Math.round(((b1 - b0) + 0.6) / 0.035) + 1;
        pathPts(pts.slice(0, n), false);
        c.strokeStyle = 'rgba(120,140,170,0.6)'; c.lineWidth = 0.7; c.stroke();
      }
      c.restore();
    }
    function gable() {
      if (form === 'hip' || (form === 'paljak' && dG >= Dd - 0.02)) return;
      let pts;
      let ag;
      if (form === 'matbae') {
        ag = wa1;
        const zb = R.zW != null ? R.zW : zE;
        const q0 = uv(ag, wb0), q1 = uv(ag, wb1);
        pts = [[X(q0[0], q0[1]), Y(q0[0], q0[1], zb)], [X(q1[0], q1[1]), Y(q1[0], q1[1], zb)]];
        samp('bp', [ag, wb1], [ag, bc], -1.5, pts); samp('bn', [ag, bc], [ag, wb0], -1.5, pts);
      } else {
        ag = ag1;
        pts = samp('ap', [ag, b0 + dG], [ag, b1 - dG]);
        samp('bp', [ag, b1 - dG], [ag, bc], 0, pts); samp('bn', [ag, bc], [ag, b0 + dG], 0, pts);
      }
      pathPts(pts);
      const lit = ax;
      const base = R.gableCol || P.gable;
      c.fillStyle = lit ? base : shade(base, -0.24); c.fill();
      c.save(); c.clip();
      // 박공 널판·무늬
      c.strokeStyle = 'rgba(60,38,22,0.35)'; c.lineWidth = 0.5;
      for (let z = zE - 8; z < R.zR + 6; z += 3.4) {
        const p = uv(ag, b0), q = uv(ag, b1);
        c.beginPath(); c.moveTo(X(p[0], p[1]), Y(p[0], p[1], z)); c.lineTo(X(q[0], q[1]), Y(q[0], q[1], z)); c.stroke();
      }
      if (form === 'paljak') {
        const m = uv(ag, bc), zc = SF.ap(ag, bc) + (R.zR - SF.ap(ag, bc)) * 0.42;
        ell(c, R.trim ? '#a3342a' : 'rgba(80,50,30,0.6)', X(m[0], m[1]), Y(m[0], m[1], zc), 2.2, 2.4);
        ell(c, lit ? base : shade(base, -0.24), X(m[0], m[1]), Y(m[0], m[1], zc), 1.1, 1.3);
      }
      const gs = c.createLinearGradient(0, Y(uv(ag, bc)[0], uv(ag, bc)[1], R.zR), 0, Y(uv(ag, bc)[0], uv(ag, bc)[1], zE - 6));
      gs.addColorStop(0, 'rgba(0,0,0,0.25)'); gs.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gs; c.fillRect(-400, -400, 800, 800);
      c.restore();
    }
    // 처마 띠(연함)와 막새, 서까래
    function fascia() {
      const segs = [['bp', [a0, b1], [a1, b1], true]];
      if (ends) segs.push(['ap', [a1, b1], [a1, b0], false]);
      const th = 2.6;
      for (const [f, p, q, along] of segs) {
        const top = samp(f, p, q, 0), bot = samp(f, p, q, -th);
        const trimBot = samp(f, p, q, -th - (R.trim ? 2.6 : 1.4));
        pathPts(top.concat(bot.slice().reverse()));
        c.fillStyle = P.fascia; c.fill();
        // 서까래 끝
        pathPts(bot.concat(trimBot.slice().reverse()));
        c.fillStyle = R.trim ? '#2f6f58' : '#4a3220'; c.fill();
        for (let t = (along ? a0 : b0) + 0.05; t < (along ? a1 : b1) - 0.03; t += 0.085) {
          const s = along ? sp(f, t, b1, -th - (R.trim ? 1.3 : 0.7)) : sp(f, a1, t, -th - (R.trim ? 1.3 : 0.7));
          circ(c, R.trim ? '#e9dcc0' : '#8a6a48', s[0], s[1], R.trim ? 0.62 : 0.5);
          if (R.trim) circ(c, '#b53a2c', s[0], s[1], 0.28);
        }
        if (R.trim) {
          const red = samp(f, p, q, -th - 3.4);
          pathPts(trimBot.concat(red.slice().reverse()));
          c.fillStyle = '#a3342a'; c.fill();
        }
        // 막새
        if (P.tileEnd) {
          for (let t = (along ? a0 : b0) + st; t < (along ? a1 : b1) - st * 0.4; t += st) {
            const s = along ? sp(f, t, b1, -1.25) : sp(f, a1, t, -1.25);
            circ(c, P.tileEnd, s[0], s[1], 1.0);
            circ(c, 'rgba(20,24,30,0.35)', s[0] + 0.25, s[1] + 0.2, 0.45);
          }
        }
        c.strokeStyle = 'rgba(210,222,240,0.25)'; c.lineWidth = 0.5; pathPts(top, false); c.stroke();
      }
      if (!ends) {
        // 맞배: 오른쪽 끝 두 내림선을 따라 박공널
        const top = samp('bp', [a1, b1], [a1, bc], 0.6); samp('bn', [a1, bc], [a1, b0], 0.6, top);
        const bot = samp('bp', [a1, b1], [a1, bc], -3.2); samp('bn', [a1, bc], [a1, b0], -3.2, bot);
        pathPts(top.concat(bot.slice().reverse()));
        c.fillStyle = R.barge || (R.trim ? '#7a2a20' : '#5a3a22'); c.fill();
        c.strokeStyle = 'rgba(255,225,190,0.3)'; c.lineWidth = 0.5; pathPts(top, false); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.5; pathPts(bot, false); c.stroke();
        if (R.snow) { c.strokeStyle = '#eef2f7'; c.lineWidth = 1.1; pathPts(samp('bp', [a1, b1 - 0.15], [a1, bc], 1.1), false); c.stroke(); }
      }
    }
    // 마루(용마루·추녀마루·내림마루). back: 뒤쪽 면 사이의 마루는 흐리게
    function ridgeLine(f, p, q, w, back) {
      if (back) { strokeAlong(f, p, q, R.snow ? '#c9d3de' : P.cap, w * 0.8, w * 0.25); return; }
      strokeAlong(f, p, q, P.cap, w, w * 0.32);
      strokeAlong(f, p, q, R.snow ? '#eef2f7' : P.capHi, w * 0.36, w * 0.62);
    }
    function horn(pt, dir) {
      const [x, y] = pt;
      c.fillStyle = P.cap;
      c.beginPath();
      c.moveTo(x - dir * 2.4, y + 1);
      c.quadraticCurveTo(x + dir * 1.6, y + 0.4, x + dir * 2.6, y - 5.2);
      c.quadraticCurveTo(x + dir * 1.2, y - 3.4, x - dir * 1.6, y - 2.6);
      c.closePath(); c.fill();
    }

    // ── 그리는 순서: 뒤쪽 면 → 합각 → 앞쪽 면 → 처마 → 마루 ──
    slope('bn'); slope('an');
    if (ends) ridgeLine('bn', [a0, b0], [ag0, b0 + dG], 2.0, true);
    if (form === 'paljak') ridgeLine('bn', [ag0, b0 + dG], [ag0, bc], 1.8, true);
    // 뒤 처마선
    c.strokeStyle = 'rgba(15,18,24,0.6)'; c.lineWidth = 0.6;
    pathPts(samp('bn', [a0, b0], [a1, b0]), false); c.stroke();
    if (ends) { pathPts(samp('an', [a0, b0], [a0, b1]), false); c.stroke(); }
    gable();
    slope('bp'); slope('ap');
    fascia();
    if (!ends) {
      c.strokeStyle = P.cap; c.lineWidth = 1.2;
      pathPts(samp('bp', [a0, b1], [a0, bc]), false); c.stroke();
    }
    if (ends) {
      ridgeLine('bp', [a0, b1], [ag0, b1 - dG], 2.1);
      ridgeLine('bp', [a1, b1], [ag1, b1 - dG], 2.1);
      ridgeLine('bn', [a1, b0], [ag1, b0 + dG], 2.0, true);
    }
    if (form === 'paljak') {
      ridgeLine('bp', [ag0, b1 - dG], [ag0, bc], 1.8);
      ridgeLine('bp', [ag1, b1 - dG], [ag1, bc], 1.8);
      ridgeLine('bn', [ag1, bc], [ag1, b0 + dG], 1.8);
    }
    // 용마루
    const r0 = form === 'matbae' ? a0 : ag0, r1 = form === 'matbae' ? a1 : ag1;
    if (r1 - r0 > 0.01) {
      const top = samp('bp', [r0, bc], [r1, bc], 3.6), bot = samp('bp', [r0, bc], [r1, bc], -0.6);
      pathPts(top.concat(bot.slice().reverse()));
      c.fillStyle = P.cap; c.fill();
      c.strokeStyle = R.snow ? '#eef2f7' : P.capHi; c.lineWidth = R.snow ? 1.6 : 0.7; pathPts(top, false); c.stroke();
      if (R.trim && !R.snow) { c.strokeStyle = 'rgba(225,220,205,0.75)'; c.lineWidth = 0.6; pathPts(samp('bp', [r0, bc], [r1, bc], 1.4), false); c.stroke(); }
      if (R.orn !== false) {
        const sx = ax ? -1 : 1;
        horn(sp('bp', r0, bc, 3.2), -sx); horn(sp('bp', r1, bc, 3.2), sx);
      }
    }
    return (u, v) => {
      const a = ax ? v : u, b = ax ? u : v;
      const db = Math.min(b - b0, b1 - b), da = Math.min(a - a0, a1 - a);
      if (ends && da < dG && da < db) return zOf(da, db);
      return zOf(db, da);
    };
  }

  // ── 처마 덧지붕(차양) — 앞면과 오른쪽 면을 두른다 ──
  function skirtRoof(c, u0, v0, u1, v1, zIn, zOut, s, snow, trim) {
    const P = ROOFC.tile;
    const front = [[u0, v1, zIn], [u1, v1, zIn], [u1 + s, v1 + s, zOut], [u0, v1 + s, zOut]];
    const right = [[u1, v0, zIn], [u1 + s, v0, zOut], [u1 + s, v1 + s, zOut], [u1, v1, zIn]];
    for (const [poly, col, fr] of [[front, P['v+'], true], [right, P['u+'], false]]) {
      fill3(c, col, poly);
      c.save(); path3(c, poly); c.clip();
      for (let t = 0.05; t < (fr ? u1 - u0 + s : v1 - v0 + s); t += 0.1) {
        if (fr) { seg3(c, P.groove, 0.7, [u0 + t, v1, zIn], [u0 + t, v1 + s, zOut]); seg3(c, P.hi, 0.5, [u0 + t + 0.05, v1, zIn], [u0 + t + 0.05, v1 + s, zOut]); }
        else { seg3(c, P.groove, 0.7, [u1, v0 + t, zIn], [u1 + s, v0 + t, zOut]); seg3(c, P.hi, 0.5, [u1, v0 + t + 0.05, zIn], [u1 + s, v0 + t + 0.05, zOut]); }
      }
      if (snow) {
        const k = 0.72;
        fill3(c, fr ? SNOWC['v+'] : SNOWC['u+'], fr
          ? [[u0, v1, zIn + 1], [u1, v1, zIn + 1], [u1 + s * k, v1 + s * k, lerp(zIn, zOut, k)], [u0, v1 + s * k, lerp(zIn, zOut, k)]]
          : [[u1, v0, zIn + 1], [u1 + s * k, v0, lerp(zIn, zOut, k)], [u1 + s * k, v1 + s * k, lerp(zIn, zOut, k)], [u1, v1, zIn + 1]]);
      }
      c.restore();
    }
    // 처마 띠
    fill3(c, P.fascia, [[u0, v1 + s, zOut], [u1 + s, v1 + s, zOut], [u1 + s, v1 + s, zOut - 2.4], [u0, v1 + s, zOut - 2.4]]);
    fill3(c, shade(P.fascia, -0.2), [[u1 + s, v1 + s, zOut], [u1 + s, v0, zOut], [u1 + s, v0, zOut - 2.4], [u1 + s, v1 + s, zOut - 2.4]]);
    if (trim) {
      fill3(c, '#a3342a', [[u0, v1 + s, zOut - 2.4], [u1 + s, v1 + s, zOut - 2.4], [u1 + s, v1 + s, zOut - 3.6], [u0, v1 + s, zOut - 3.6]]);
      fill3(c, '#7a2a20', [[u1 + s, v1 + s, zOut - 2.4], [u1 + s, v0, zOut - 2.4], [u1 + s, v0, zOut - 3.6], [u1 + s, v1 + s, zOut - 3.6]]);
    }
    for (let t = u0 + 0.06; t < u1 + s; t += 0.1) circ(c, P.tileEnd, X(t, v1 + s), Y(t, v1 + s, zOut - 1.2), 0.9);
    for (let t = v0 + 0.06; t < v1 + s; t += 0.1) circ(c, P.tileEnd, X(u1 + s, t), Y(u1 + s, t, zOut - 1.2), 0.85);
    seg3(c, P.cap, 1.6, [u1, v1, zIn + 0.6], [u1 + s, v1 + s, zOut + 0.6]);
  }

  // ── 초가지붕: 둥근 짚더미를 켜켜이 쌓아 그린다 ──
  // 돌려줌: zAt(u, v)
  function thatchRoof(c, R) {
    const U0 = R.u0 - R.e, U1 = R.u1 + R.e, V0 = R.v0 - R.e, V1 = R.v1 + R.e;
    const hw = (U1 - U0) / 2, hd = (V1 - V0) / 2;
    const Smax = Math.min(hw, hd) * 0.9;
    const N = R.levels || 28, dz = R.zR - R.zE;
    const rad0 = R.round == null ? 0.32 : R.round;
    const rnd = R.rnd || Math.random;
    const prof = t => 1 - Math.pow(1 - t, 1.8);
    const ring = (s, z) => {
      const u0 = U0 + s, u1 = U1 - s, v0 = V0 + s, v1 = V1 - s;
      const r = Math.max(0.001, Math.min(rad0 + s * 0.55, (u1 - u0) / 2, (v1 - v0) / 2));
      const pts = [];
      const corner = (cu, cv, t0) => { for (let i = 0; i <= 5; i++) { const t = t0 + (i / 5) * Math.PI / 2; pts.push([cu + Math.cos(t) * r, cv + Math.sin(t) * r]); } };
      corner(u1 - r, v1 - r, 0);
      corner(u0 + r, v1 - r, Math.PI / 2);
      corner(u0 + r, v0 + r, Math.PI);
      corner(u1 - r, v0 + r, Math.PI * 1.5);
      return pts.map(([u, v]) => [X(u, v), Y(u, v, z), u, v]);
    };
    const fillRing = (pts, colL, colR) => {
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
      let mnx = 1e9, mxx = -1e9; for (const p of pts) { mnx = Math.min(mnx, p[0]); mxx = Math.max(mxx, p[0]); }
      const g = c.createLinearGradient(mnx, 0, mxx, 0);
      g.addColorStop(0, colL); g.addColorStop(0.55, mix(colL, colR, 0.45)); g.addColorStop(1, colR);
      c.fillStyle = g; c.fill();
    };
    const snowFrom = R.snow ? 0.16 : 2;
    // 처마 두께
    const base = ring(0, R.zE - 3.6);
    fillRing(base, '#8a6a36', '#5e4522');
    const rings = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N, s = Smax * t, z = R.zE + dz * prof(t);
      const pts = ring(s, z);
      rings.push(pts);
      const lv = 0.82 + 0.18 * t;
      if (t >= snowFrom) fillRing(pts, mix('#c4cfdc', '#f4f7fa', Math.min(1, (t - snowFrom) * 4)), mix('#a9b6c6', '#d6dee8', Math.min(1, (t - snowFrom) * 3)));
      else fillRing(pts, mix('#7d5d2e', PAL.thatchLight, lv * 0.9), mix('#5a4020', PAL.thatchDark, lv));
      // 짚 결
      if (t < snowFrom && k > 0) {
        const prev = rings[k - 1];
        c.lineWidth = 0.5;
        for (let i = 0; i < pts.length; i++) {
          if (pts[i][1] < (pts[7][1] + pts[19][1]) / 2 - 2) continue;
          if (rnd() < 0.45) continue;
          const p = pts[i], q = prev[i];
          const j = (rnd() - 0.5) * 2;
          c.strokeStyle = rnd() < 0.5 ? 'rgba(90,62,26,0.5)' : 'rgba(240,215,150,0.35)';
          c.beginPath(); c.moveTo(p[0] + j, p[1]); c.lineTo(q[0] + j * 1.4, q[1] + 1.2); c.stroke();
        }
        if (k % 6 === 3) {
          c.strokeStyle = 'rgba(95,66,30,0.55)'; c.lineWidth = 0.6;
          c.beginPath();
          let started = false;
          for (const p of pts) {
            // 앞쪽(+u 또는 +v 쪽) 테두리만 줄을 긋는다
            const front = (p[2] - (U0 + U1) / 2) + (p[3] - (V0 + V1) / 2);
            if ((p[2] > (U0 + U1) / 2 - 0.4 || p[3] > (V0 + V1) / 2 - 0.4) && front > -0.5) {
              if (!started) { c.moveTo(p[0], p[1]); started = true; } else c.lineTo(p[0], p[1]);
            } else started = false;
          }
          c.stroke();
        }
      }
    }
    // 새끼줄 (세로)
    if (!R.snow) {
      c.strokeStyle = 'rgba(100,70,32,0.42)'; c.lineWidth = 0.55;
      const idx = [0, 2, 4, 5, 7, 9, 11, 13, 15, 17, 19, 21, 22];
      for (const i of idx) {
        const p0 = rings[0][i];
        const fr = p0[2] > (U0 + U1) / 2 + 0.05 || p0[3] > (V0 + V1) / 2 + 0.05;
        if (!fr) continue;
        c.beginPath();
        for (let k = 0; k < rings.length - 2; k++) { const p = rings[k][i]; if (k) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }
        c.stroke();
      }
    }
    // 용마름
    const zt = R.zE + dz + 1.2;
    const ru0 = U0 + Smax + 0.04, ru1 = U1 - Smax - 0.04, rv = (V0 + V1) / 2;
    const ax = hw >= hd;
    const pA = ax ? [ru0, rv] : [(U0 + U1) / 2, V0 + Smax + 0.04], pB = ax ? [ru1, rv] : [(U0 + U1) / 2, V1 - Smax - 0.04];
    c.lineCap = 'round';
    seg3(c, R.snow ? '#c7d1dd' : '#6e5226', 4.2, [pA[0], pA[1], zt], [pB[0], pB[1], zt]);
    seg3(c, R.snow ? '#f4f7fa' : '#b08a48', 2.6, [pA[0], pA[1], zt + 0.8], [pB[0], pB[1], zt + 0.8]);
    if (!R.snow) {
      const n = Math.max(2, Math.round(Math.hypot(pB[0] - pA[0], pB[1] - pA[1]) / 0.07));
      for (let i = 0; i <= n; i++) {
        const u = lerp(pA[0], pB[0], i / n), v = lerp(pA[1], pB[1], i / n);
        const x = X(u, v), y = Y(u, v, zt + 0.6);
        line(c, 'rgba(80,56,24,0.7)', 0.5, x - 1.2, y - 1.4, x + 1.2, y + 1.4);
      }
    }
    c.lineCap = 'butt';
    // 처마 끝 짚
    c.lineWidth = 0.6;
    for (const p of base) {
      if (!(p[2] > (U0 + U1) / 2 - 0.1 || p[3] > (V0 + V1) / 2 - 0.1)) continue;
      for (let k = 0; k < 2; k++) {
        const j = (rnd() - 0.5) * 3;
        c.strokeStyle = 'rgba(70,48,20,0.6)';
        c.beginPath(); c.moveTo(p[0] + j, p[1] - 1); c.lineTo(p[0] + j + 0.3, p[1] + 1 + rnd() * 1.4); c.stroke();
      }
    }
    if (R.snow) {
      // 처마 끝에 녹다 만 눈
      c.fillStyle = 'rgba(240,244,249,0.85)';
      for (const p of rings[Math.round(N * 0.18)]) if (rnd() < 0.5) { c.beginPath(); c.arc(p[0], p[1] + 0.5, 0.9 + rnd(), 0, Math.PI * 2); c.fill(); }
    }
    return (u, v) => {
      const s = Math.min(u - U0, U1 - u, v - V0, V1 - v);
      return R.zE + dz * prof(clamp(s / Smax, 0, 1));
    };
  }

  // ── 작은 소품 ──
  function jar(c, u, v, s = 1, z = 0) {
    const x = X(u, v), y = Y(u, v, z);
    ell(c, 'rgba(0,0,0,0.25)', x + 0.8 * s, y + 0.2, 3.4 * s, 1.5 * s);
    ell(c, '#4a2c1a', x, y - 3.2 * s, 3.2 * s, 3.3 * s);
    ell(c, '#6e4429', x - 0.9 * s, y - 3.6 * s, 2 * s, 2.4 * s);
    ell(c, 'rgba(255,230,200,0.28)', x - 1.4 * s, y - 4.4 * s, 0.7 * s, 1.2 * s);
    ell(c, '#2c190e', x, y - 6.3 * s, 2.1 * s, 0.85 * s);
    ell(c, '#5a3622', x, y - 6.9 * s, 2.4 * s, 0.9 * s);
  }
  function sack(c, u, v, z = 0) {
    const x = X(u, v), y = Y(u, v, z);
    ell(c, 'rgba(0,0,0,0.22)', x + 0.6, y + 0.2, 3.6, 1.5);
    ell(c, '#bfa676', x, y - 2.7, 3.3, 3);
    ell(c, '#dcc89c', x - 1, y - 3.5, 1.5, 1.3);
    rr(c, '#a88f60', x - 1.1, y - 6.1, 2.2, 1.3);
  }
  function crate(c, u, v, s, z = 0) { box(c, u - s / 2, v - s / 2, u + s / 2, v + s / 2, z, z + s * 18, '#8a5f36', { edge: 'rgba(60,36,18,0.8)' }); }
  function logU(c, u0, u1, v, z, r) {
    onL(c, u0, v, z, () => {
      const L = (u1 - u0) * 32;
      rr(c, '#6a4526', 0, -r, L, 2 * r);
      rr(c, '#87603a', 0, -r, L, r * 0.55);
      rr(c, 'rgba(0,0,0,0.25)', 0, r * 0.55, L, r * 0.45);
      c.fillStyle = 'rgba(40,24,12,0.4)';
      for (let x = 2; x < L - 1; x += 3.3) c.fillRect(x, -r + ((x * 7) % 3) * 0.4, 1.4, 0.4);
    });
    onR(c, u1, v, z, () => {
      circ(c, '#d8b27a', 0, 0, r); circ(c, '#b88c56', 0, 0, r * 0.62); circ(c, '#d8b27a', 0, 0, r * 0.35);
      c.strokeStyle = '#7a5230'; c.lineWidth = 0.4; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    });
  }
  function logV(c, v0, v1, u, z, r) {
    onR(c, u, v1, z, () => {
      const L = (v1 - v0) * 32;
      rr(c, '#5e3c20', 0, -r, L, 2 * r);
      rr(c, '#7a5232', 0, -r, L, r * 0.55);
      c.fillStyle = 'rgba(40,24,12,0.4)';
      for (let x = 2; x < L - 1; x += 3.3) c.fillRect(x, -r + ((x * 5) % 3) * 0.4, 1.4, 0.4);
    });
    onL(c, u, v1, z, () => {
      circ(c, '#e0bc84', 0, 0, r); circ(c, '#c49660', 0, 0, r * 0.62); circ(c, '#e0bc84', 0, 0, r * 0.35);
      c.strokeStyle = '#7a5230'; c.lineWidth = 0.4; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    });
  }
  function lanternAt(c, u, v, z, s = 1) {
    const x = X(u, v), y = Y(u, v, z);
    line(c, '#2a1a10', 0.6, x, y, x, y + 2.6 * s);
    ell(c, '#c23a26', x, y + 6 * s, 2.7 * s, 3.3 * s);
    ell(c, '#ff8a4a', x - 0.5 * s, y + 5.6 * s, 1.5 * s, 2.3 * s);
    ell(c, 'rgba(255,236,170,0.8)', x - 0.7 * s, y + 5.2 * s, 0.6 * s, 1.2 * s);
    rr(c, '#2a1a10', x - 1.3 * s, y + 2.4 * s, 2.6 * s, 0.9 * s);
    rr(c, '#2a1a10', x - 1.3 * s, y + 8.9 * s, 2.6 * s, 0.9 * s);
    line(c, PAL.gold, 0.5, x, y + 9.8 * s, x, y + 12 * s);
  }
  function pyramid(c, u, v, r, z0, z1, col) {
    fill3(c, shade(col, -0.05), [[u - r, v + r, z0], [u + r, v + r, z0], [u, v, z1]]);
    fill3(c, shade(col, -0.3), [[u + r, v + r, z0], [u + r, v - r, z0], [u, v, z1]]);
  }
  function stoneLantern(c, u, v, z, snow) {
    const r = 0.055;
    box(c, u - r * 1.5, v - r * 1.5, u + r * 1.5, v + r * 1.5, z, z + 2.4, PAL.stone);
    box(c, u - r * 0.55, v - r * 0.55, u + r * 0.55, v + r * 0.55, z + 2.4, z + 9, PAL.stoneLight);
    box(c, u - r * 1.2, v - r * 1.2, u + r * 1.2, v + r * 1.2, z + 9, z + 10.2, PAL.stone);
    box(c, u - r, v - r, u + r, v + r, z + 10.2, z + 14.5, PAL.stoneLight);
    onL(c, u - r * 0.5, v + r, z + 10.2, () => rr(c, '#f4c35a', 0, -3.6, r * 32, 2.8));
    onR(c, u + r, v + r * 0.5, z + 10.2, () => rr(c, '#d9a040', 0, -3.6, r * 32, 2.8));
    pyramid(c, u, v, r * 1.8, z + 14.5, z + 18.5, PAL.stone);
    if (snow) pyramid(c, u, v, r * 1.4, z + 15.5, z + 18.8, '#f4f7fa');
    circ(c, PAL.stoneDark, X(u, v), Y(u, v, z + 19.4), 0.9);
  }
  function brazier(c, u, v, h, snow) {
    post(c, u, v, 0, h, 0.022, PAL.woodDark);
    cylV(c, u, v, 0.06, h, h + 3, '#3a3f45', '#1e1a16');
    const x = X(u, v), y = Y(u, v, h + 3);
    ell(c, 'rgba(255,150,60,0.55)', x, y - 3, 3.6, 4.6);
    ell(c, '#ff9a3a', x, y - 2.6, 2.3, 3.3);
    ell(c, '#ffe08a', x - 0.3, y - 1.8, 1.1, 1.8);
    if (snow) ell(c, '#eef2f7', x, y + 1.5, 2.2, 0.6);
  }
  // o.z0: 깃대가 서는 높이 (대 위에 세울 때)
  function triFlag(c, u, v, h, col, text, o = {}) {
    const z0 = o.z0 || 0;
    post(c, u, v, z0, z0 + h, 0.02, PAL.woodDark);
    circ(c, PAL.gold, X(u, v), Y(u, v, z0 + h + 1), 1.1);
    const fl = o.len || 17, fh = o.hgt || 12;
    onL(c, u, v, z0 + h - 1.5, () => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(0.8, 0); c.quadraticCurveTo(fl * 0.5, fh * 0.15, fl, fh * 0.5); c.quadraticCurveTo(fl * 0.5, fh * 0.85, 0.8, fh); c.closePath(); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.beginPath(); c.moveTo(0.8, fh * 0.55); c.quadraticCurveTo(fl * 0.5, fh * 0.75, fl, fh * 0.5); c.quadraticCurveTo(fl * 0.5, fh * 0.85, 0.8, fh); c.closePath(); c.fill();
      c.strokeStyle = o.edge || PAL.gold; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(0.8, 0); c.quadraticCurveTo(fl * 0.5, fh * 0.15, fl, fh * 0.5); c.quadraticCurveTo(fl * 0.5, fh * 0.85, 0.8, fh); c.stroke();
      if (text) { c.fillStyle = o.fg || '#fff2d0'; c.font = `${fh * 0.6}px "Song Myung", serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, fl * 0.36, fh * 0.5); }
    });
  }
  function banner(c, u, v, h, w, bh, col, text, plane = 'L', fg = PAL.gold) {
    post(c, u, v, 0, h, 0.02, PAL.woodDark);
    const draw = () => {
      rr(c, PAL.woodDark, -0.5, -0.6, w + 2, 1.2);
      rr(c, col, 0.8, 0.4, w, bh);
      rr(c, 'rgba(0,0,0,0.18)', 0.8 + w * 0.65, 0.4, w * 0.35, bh);
      for (let x = 0.8; x < w + 0.6; x += 2) { c.fillStyle = col; c.beginPath(); c.moveTo(x, bh + 0.4); c.lineTo(x + 1, bh + 2); c.lineTo(x + 2, bh + 0.4); c.fill(); }
      c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      const chars = [...text];
      const fs = Math.min(w * 0.82, bh / chars.length * 0.86);
      c.font = `${fs}px "Song Myung", serif`;
      chars.forEach((ch, i) => c.fillText(ch, 0.8 + w / 2, 0.4 + (i + 0.5) * bh / chars.length + 0.3));
    };
    if (plane === 'L') onL(c, u, v, h - 1, draw); else onR(c, u, v, h - 1, draw);
    circ(c, PAL.gold, X(u, v), Y(u, v, h + 0.8), 1);
  }

  // ── 건물 ──
  const B = {};

  B.manor = (c, o) => {
    const e = 0.3;
    ao(c, 0, 0, 3, 3, 1.2);
    plinth(c, 0.03, 0.03, 2.97, 2.97, 0, 6, o);
    plinth(c, 0.2, 0.18, 2.8, 2.66, 6, 13, Object.assign({}, o, { col: '#a6a194' }));
    steps(c, 1.12, 1.88, 2.66, 2.94, 6, 13, 3);
    const u0 = 0.38, v0 = 0.34, u1 = 2.62, v1 = 2.3, z0 = 13, H = 38;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 5, items: ['win', 'lat', 'lat', 'lat', 'win'], pillar: '#9c3226', beam: '#5a1c14', mid: '#7a2a20', dan: true,
      hid: 16 * e + 6.6, sign: '領主館', signW: 30, signH: 8.5, rnd: o.rnd, winW: 9,
    }, { bays: 4, items: ['win', 'lat', 'lat', 'win'] });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 84, form: 'paljak', gable: 0.4, lift: 8, liftR: 1.1, trim: true, snow: o.snow, seed: 3 });
    lanternAt(c, u0 + 0.22, v1 + 0.2, z0 + H - 8);
    lanternAt(c, u1 + 0.18, v1 + 0.04, z0 + H - 8);
    stoneLantern(c, 0.38, 2.82, 6, o.snow);
    stoneLantern(c, 2.62, 2.82, 6, o.snow);
  };

  B.house = (c, o) => {
    const e = 0.22;
    ao(c, 0, 0, 2, 2);
    plinth(c, 0.04, 0.04, 1.96, 1.96, 0, 5, Object.assign({}, o, { col: '#958b7b', blk: 5, blkVar: 4, rowH: 2.6 }));
    const u0 = 0.17, v0 = 0.17, u1 = 1.83, v1 = 1.83, z0 = 5, H = 29;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 3, items: ['win', 'door', 'door1'], plaster: PAL.mud, pillar: '#6e4a2c', beam: '#5a3a22', mid: '#6e4a2c',
      hid: 16 * e + 5.5, doorStyle: 'tti', winW: 9, rnd: o.rnd,
    }, { bays: 2, items: ['win', 'wall'] });
    // 장작더미
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4 - k; i++) logU(c, 1.84, 1.95, 0.62 + i * 0.1 + k * 0.05, 7.2 + k * 2.6 + 0.4, 1.3);
    // 장독 (기단 위)
    jar(c, 0.34, 1.91, 0.75, 5); jar(c, 0.52, 1.92, 0.62, 5);
    // 댓돌
    box(c, 0.98, 1.84, 1.3, 1.95, 5, 6.4, '#a8a397');
    const zAt = thatchRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 2, zR: 53, snow: o.snow, rnd: o.rnd });
    if (!o.snow && (o.season === 1 || o.season === 2)) {
      // 지붕 위 박
      for (const [u, v, r] of [[1.0, 1.42, 4.2], [1.42, 1.05, 3.4]]) {
        const x = X(u, v), y = Y(u, v, zAt(u, v) + 2);
        ell(c, 'rgba(60,40,10,0.35)', x + 1, y + 2, r, r * 0.45);
        ell(c, '#f2ecd6', x, y, r, r * 0.82); ell(c, '#fffaf0', x - r * 0.35, y - r * 0.3, r * 0.4, r * 0.32);
        line(c, '#4a6a2a', 0.6, x + r * 0.4, y - r * 0.6, x + r * 0.9, y - r);
        ell(c, '#5a8a3a', x + r * 1.2, y - r * 0.7, 2.2, 1.2);
      }
    }
    if (o.season === 2) {
      // 가을: 지붕에 고추 말리기
      const rr2 = o.rnd;
      for (let i = 0; i < 26; i++) {
        const u = 0.5 + rr2() * 0.55, v = 1.55 + rr2() * 0.2;
        const x = X(u, v), y = Y(u, v, zAt(u, v) + 0.5);
        line(c, rr2() < 0.5 ? '#c62a1a' : '#a51e14', 1.1, x - 1, y, x + 1, y + 0.4);
      }
    }
  };

  B.house2 = (c, o) => {
    const e = 0.26;
    ao(c, 0, 0, 2, 2);
    plinth(c, 0.03, 0.03, 1.97, 1.97, 0, 8, o);
    const u0 = 0.15, v0 = 0.15, u1 = 1.85, v1 = 1.85, z0 = 8, H = 31, vw = 1.6;
    walls(c, u0, v0, u1, vw, z0, H, {
      bays: 3, items: ['win', 'door', 'win'], hid: 16 * (e + v1 - vw) + 4.2, rnd: o.rnd, shade: 0.12, winW: 10,
    }, { bays: 2, items: ['win', 'wall'], hid: 16 * e + 4.2, shade: 0.22 });
    // 툇마루
    box(c, u0, vw, u1, v1, z0, z0 + 3.2, '#8a5e34', { top: '#b8854e', right: '#5e3e22' });
    onTop(c, u0, vw, z0 + 3.2, () => { c.fillStyle = 'rgba(90,56,28,0.45)'; for (let a = 4; a < (u1 - u0) * 32; a += 4.2) c.fillRect(a, 0, 0.4, (v1 - vw) * 32); });
    box(c, 0.82, v1, 1.18, 1.96, 8, 9.4, '#aaa59a');
    // 앞 기둥
    for (let i = 0; i <= 3; i++) post(c, lerp(u0 + 0.035, u1 - 0.035, i / 3), v1 - 0.035, z0, z0 + H, 0.035, PAL.wood, { top: PAL.woodLight });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 66, form: 'paljak', gable: 0.5, lift: 6, snow: o.snow, seed: 7 });
    jar(c, 1.88, 0.5, 0.7, 8);
  };

  B.farm = (c, o) => {
    const sn = o.season, rnd = o.rnd;
    const soil = sn === 3 ? '#8c7a64' : sn === 0 ? '#7a5a3a' : '#866443';
    // 둑과 밭
    fill3(c, 'rgba(30,20,10,0.18)', [[0.02, 0.02, 0], [2.98, 0.02, 0], [2.98, 2.98, 0], [0.02, 2.98, 0]]);
    box(c, 0.04, 0.04, 2.96, 2.96, 0, 1.2, sn === 3 ? '#a49884' : '#7d6a3e', { top: sn === 3 ? '#d8dde2' : sn === 2 ? '#8a7a40' : '#6c8a3e' });
    fill3(c, soil, [[0.14, 0.14, 1.2], [2.86, 0.14, 1.2], [2.86, 2.86, 1.2], [0.14, 2.86, 1.2]]);
    // 이랑
    const rows = [];
    for (let k = 0; k < 9; k++) rows.push(0.3 + k * 0.3);
    for (const v of rows) {
      box(c, 0.18, v - 0.075, 2.82, v + 0.075, 1.2, 2.6, shade(soil, 0.05), { top: shade(soil, 0.12), right: shade(soil, -0.2) });
      seg3(c, 'rgba(40,26,14,0.35)', 0.6, [0.18, v + 0.12, 1.2], [2.82, v + 0.12, 1.2]);
    }
    // 작물: 깊이 순서로
    const items = [];
    for (const v of rows) for (let u = 0.26; u < 2.8; u += 0.115) items.push([u + (rnd() - 0.5) * 0.03, v, rnd()]);
    items.push([2.5, 0.42, -1]);
    items.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    for (const [u, v, r] of items) {
      const x = X(u, v), y = Y(u, v, 2.6);
      if (r < 0) { scarecrow(c, u, v, 2.6, o); continue; }
      if (sn === 0) {
        line(c, '#6fae4a', 0.8, x, y, x - 1.1, y - 2.6 - r);
        line(c, '#8ccc5e', 0.8, x, y, x + 1.1, y - 2.4 - r);
        line(c, '#5c9a3e', 0.7, x, y, x, y - 3.2);
      } else if (sn === 1) {
        const h = 8 + r * 2.5;
        line(c, '#2f7030', 1.1, x, y, x - 2, y - h * 0.8);
        line(c, '#3f8a38', 1.1, x, y, x + 2.1, y - h * 0.75);
        line(c, '#4fa044', 1, x, y, x - 0.4, y - h);
        line(c, '#62b450', 0.7, x + 0.3, y - 1, x + 0.6, y - h * 0.9);
      } else if (sn === 2) {
        const h = 8 + r * 2;
        line(c, '#a8862a', 1, x, y, x - 1.2, y - h * 0.85);
        line(c, '#bf9a34', 1, x, y, x + 1, y - h * 0.9);
        c.strokeStyle = '#e2b84a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 0.6, y - h); c.quadraticCurveTo(x + 1.4, y - h - 1.2, x + 2.6, y - h + 2.2); c.stroke();
        c.strokeStyle = '#f0cf6a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x - 0.4, y - h - 0.3); c.quadraticCurveTo(x + 1.2, y - h - 1.3, x + 2.2, y - h + 1.4); c.stroke();
      } else {
        line(c, '#6e5a3c', 0.7, x, y, x - 0.4, y - 2);
        line(c, '#7d6848', 0.7, x + 0.6, y, x + 0.8, y - 1.6);
      }
    }
    if (sn === 3) {
      for (let i = 0; i < 26; i++) {
        const u = 0.25 + rnd() * 2.5, v = 0.25 + rnd() * 2.5, r = 0.08 + rnd() * 0.14;
        fill3(c, 'rgba(242,246,250,0.92)', [[u - r, v, 1.4], [u, v - r * 0.7, 1.4], [u + r, v, 1.4], [u, v + r * 0.7, 1.4]]);
      }
    }
    // 앞쪽 둑 (작물 앞을 살짝 가린다)
    box(c, 0.04, 2.86, 2.96, 2.96, 0, 2.2, sn === 3 ? '#a49884' : '#6e5a34', { top: sn === 3 ? '#e6ebf0' : sn === 2 ? '#8f8044' : '#6e9440' });
    box(c, 2.86, 0.04, 2.96, 2.86, 0, 2.2, sn === 3 ? '#a49884' : '#6e5a34', { top: sn === 3 ? '#e6ebf0' : sn === 2 ? '#8f8044' : '#6e9440' });
  };
  function scarecrow(c, u, v, z, o) {
    post(c, u, v, z, z + 22, 0.018, '#5a3a20');
    seg3(c, '#5a3a20', 1.3, [u - 0.16, v + 0.16, z + 16], [u + 0.16, v - 0.16, z + 16]);
    const x = X(u, v), y = Y(u, v, z + 16);
    c.fillStyle = '#9a4a3a';
    c.beginPath(); c.moveTo(x - 4, y - 1); c.lineTo(x + 4, y - 1); c.lineTo(x + 3.2, y + 7); c.lineTo(x - 3.2, y + 7); c.closePath(); c.fill();
    rr(c, 'rgba(0,0,0,0.2)', x, y - 1, 4, 8);
    line(c, '#d8c48a', 0.8, x - 5, y, x - 6.5, y + 1.5); line(c, '#d8c48a', 0.8, x + 5, y - 0.6, x + 6.5, y + 1);
    circ(c, '#e3cfa0', x, y - 3.4, 2.3);
    c.fillStyle = '#cfb072'; c.beginPath(); c.moveTo(x - 5.6, y - 3.8); c.lineTo(x, y - 8.6); c.lineTo(x + 5.6, y - 3.8); c.quadraticCurveTo(x, y - 3, x - 5.6, y - 3.8); c.fill();
    if (o.snow) { c.fillStyle = '#f4f7fa'; c.beginPath(); c.moveTo(x - 4, y - 4.6); c.lineTo(x, y - 8.4); c.lineTo(x + 4, y - 4.6); c.closePath(); c.fill(); }
  }

  B.fishery = (c, o) => {
    const rnd = o.rnd, ice = o.snow;
    // 앞 절반은 물 (어장은 물가에 짓는다): 수면은 땅보다 조금 낮다
    fill3(c, ice ? '#a9bccb' : '#3d6f8c', [[0.04, 1.0, -2], [1.96, 1.0, -2], [1.96, 1.96, -2], [0.04, 1.96, -2]]);
    onTop(c, 0.04, 1.0, -2, () => {
      if (ice) { c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(6, 8); c.lineTo(20, 18); c.lineTo(34, 14); c.moveTo(40, 6); c.lineTo(50, 24); c.stroke(); return; }
      const g = c.createLinearGradient(0, 0, 0, 30);
      g.addColorStop(0, 'rgba(20,40,55,0.45)'); g.addColorStop(1, 'rgba(90,150,180,0.15)');
      c.fillStyle = g; c.fillRect(0, 0, 62, 31);
      c.fillStyle = 'rgba(200,230,245,0.45)';
      for (let i = 0; i < 16; i++) c.fillRect(2 + rnd() * 56, 3 + rnd() * 26, 3 + rnd() * 4, 0.5);
    });
    // 물가 땅 (앞면이 둑이 된다)
    box(c, 0.04, 0.04, 1.96, 1.04, -2, 2, '#7a6a4e', { top: o.snow ? '#e4e9ee' : '#9a8460', right: '#5e5038' });
    onL(c, 0.04, 1.04, -2, () => { for (let x = 1; x < 61; x += 4.6) ell(c, x % 3 < 1.5 ? '#8a857a' : '#6e6a60', x, -0.6, 2.2, 1.2); });
    // 오두막
    const u0 = 0.14, v0 = 0.14, u1 = 1.02, v1 = 0.9, z0 = 2, H = 22;
    walls(c, u0, v0, u1, v1, z0, H, { bays: 2, items: ['door1', 'win'], plaster: PAL.mud, pillar: '#6e4a2c', beam: '#5a3a22', mid: '#6e4a2c', hid: 16 * 0.18 + 5.5, rnd: o.rnd, winW: 7 }, { bays: 1, items: ['win'] });
    thatchRoof(c, { u0, v0, u1, v1, e: 0.18, zE: z0 + H - 2, zR: 41, snow: o.snow, rnd: o.rnd, levels: 22 });
    // 그물 건조대
    post(c, 1.3, 0.2, 2, 30, 0.022, '#5a3a20'); post(c, 1.85, 0.2, 2, 30, 0.022, '#5a3a20');
    seg3(c, '#4a3020', 1.1, [1.28, 0.2, 29], [1.87, 0.2, 29]);
    onL(c, 1.3, 0.2, 2, () => {
      const L = 0.55 * 32;
      c.fillStyle = 'rgba(120,130,120,0.35)';
      c.beginPath(); c.moveTo(0, -27); c.lineTo(L, -27); c.quadraticCurveTo(L * 0.9, -12, L * 0.75, -6); c.lineTo(L * 0.2, -7); c.quadraticCurveTo(L * 0.1, -14, 0, -27); c.fill();
      c.strokeStyle = 'rgba(60,64,58,0.65)'; c.lineWidth = 0.35;
      for (let x = 1; x < L; x += 1.6) { c.beginPath(); c.moveTo(x, -27); c.lineTo(x * 0.9 + L * 0.06, -6.5); c.stroke(); }
      for (let y = -24; y < -6; y += 2.2) { c.beginPath(); c.moveTo(L * 0.05, y); c.lineTo(L * 0.95, y); c.stroke(); }
      for (let i = 0; i < 4; i++) ell(c, '#a8b8c0', 3 + i * 3.8, -23 + (i % 2) * 2, 0.9, 2.4);
    });
    // 작은 배 (물에 떠 있다)
    if (!ice) ell(c, 'rgba(20,40,55,0.35)', X(0.68, 1.52), Y(0.68, 1.52, -2), 15, 5);
    boat(c, 0.26, 1.5, ice ? -2.2 : -3.4, o.snow);
    // 널판 선창 (물 위 기둥)
    const pu0 = 1.24, pu1 = 1.74, pz = 4;
    for (const [u, v] of [[pu0 + 0.04, 1.4], [pu1 - 0.04, 1.4], [pu0 + 0.04, 1.9], [pu1 - 0.04, 1.9]]) post(c, u, v, -2.5, pz, 0.03, '#4a3020', { top: '#6b4428' });
    box(c, pu0, 0.98, pu1, 1.96, pz - 1.6, pz, '#7a5a38', { top: '#a8804f', right: '#5a3e24' });
    onTop(c, pu0, 0.98, pz, () => {
      c.fillStyle = 'rgba(70,44,22,0.55)';
      for (let b = 3; b < 0.98 * 32; b += 3.2) c.fillRect(0, b, 0.5 * 32, 0.45);
    });
    if (o.snow) fill3(c, 'rgba(240,244,249,0.85)', [[pu0, 0.98, pz + 0.1], [pu1 - 0.1, 0.98, pz + 0.1], [pu1 - 0.1, 1.8, pz + 0.1], [pu0, 1.8, pz + 0.1]]);
    // 배를 맨 줄
    seg3(c, '#c9b48a', 0.5, [pu0 + 0.04, 1.4, pz - 0.5], [0.98, 1.5, 1]);
    // 광주리
    for (const [u, v] of [[1.42, 1.25], [1.56, 1.52]]) {
      const x = X(u, v), y = Y(u, v, pz);
      ell(c, '#8a6a3a', x, y - 1.5, 4.4, 2.4); ell(c, '#a8854a', x, y - 2.4, 4.4, 2); ell(c, '#9fb4bc', x, y - 2.6, 3.2, 1.3);
      circ(c, '#c8d6dc', x - 1, y - 3, 0.7);
    }
    // 낚싯대
    seg3(c, '#8a6a3a', 0.6, [1.62, 1.85, pz + 0.5], [1.95, 1.35, 24]);
    line(c, 'rgba(230,230,220,0.5)', 0.3, X(1.95, 1.35), Y(1.95, 1.35, 24), X(1.95, 1.35), Y(1.95, 1.35, 24) + 20);
  };
  function boat(c, u, v, z, snow) {
    const L = 0.8, Wd = 0.17;
    // 배: u 방향으로 길쭉
    const top = [[u, v, z + 4], [u + L * 0.18, v - Wd, z + 4.4], [u + L * 0.82, v - Wd, z + 4.4], [u + L, v, z + 5.4], [u + L * 0.82, v + Wd, z + 4.4], [u + L * 0.18, v + Wd, z + 4.4]];
    fill3(c, '#5a3a22', [[u + L * 0.18, v + Wd, z + 4.4], [u + L * 0.82, v + Wd, z + 4.4], [u + L, v, z + 5.4], [u + L * 0.8, v + Wd * 0.4, z + 0.4], [u + L * 0.2, v + Wd * 0.4, z + 0.4], [u, v, z + 4]]);
    fill3(c, '#4a2e1a', [[u + L * 0.82, v + Wd, z + 4.4], [u + L, v, z + 5.4], [u + L * 0.8, v + Wd * 0.4, z + 0.4]]);
    fill3(c, '#7a5232', top);
    fill3(c, '#3a2414', [[u + L * 0.14, v, z + 3.4], [u + L * 0.22, v - Wd * 0.75, z + 3.4], [u + L * 0.78, v - Wd * 0.75, z + 3.4], [u + L * 0.88, v, z + 3.8], [u + L * 0.78, v + Wd * 0.75, z + 3.4], [u + L * 0.22, v + Wd * 0.75, z + 3.4]]);
    for (const t of [0.35, 0.6]) seg3(c, '#8a6040', 1, [u + L * t, v - Wd * 0.8, z + 3.8], [u + L * t, v + Wd * 0.8, z + 3.8]);
    seg3(c, '#a07a50', 0.7, [u + L * 0.18, v + Wd, z + 4.5], [u + L * 0.82, v + Wd, z + 4.5]);
    seg3(c, '#8a6a3a', 0.8, [u + L * 0.5, v, z + 3.8], [u + L * 1.15, v + 0.3, z + 1]);
    if (snow) fill3(c, 'rgba(240,244,249,0.8)', [[u + L * 0.3, v - Wd * 0.5, z + 3.6], [u + L * 0.7, v - Wd * 0.5, z + 3.6], [u + L * 0.7, v + Wd * 0.5, z + 3.6], [u + L * 0.3, v + Wd * 0.5, z + 3.6]]);
  }

  B.lumber = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 2, 2, 0.6);
    box(c, 0.04, 0.04, 1.96, 1.96, 0, 1.5, '#8a6e48', { top: o.snow ? '#e2e7ec' : '#a58a5e' });
    onTop(c, 0.04, 0.04, 1.5, () => {
      for (let i = 0; i < 90; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(220,190,140,0.55)' : 'rgba(90,64,36,0.35)'; c.fillRect(rnd() * 60, rnd() * 60, 1.2 + rnd(), 0.6 + rnd() * 0.6); }
    });
    // 헛간 (기둥 위 지붕)
    const u0 = 0.12, v0 = 0.12, u1 = 1.15, v1 = 0.95;
    for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1]]) post(c, u + (u === u0 ? 0.03 : -0.03), v + (v === v0 ? 0.03 : -0.03), 1.5, 30, 0.032, '#5e3e22');
    // 헛간 안 판재 더미
    for (let k = 0; k < 6; k++) box(c, 0.2, 0.22 + k * 0.012, 1.0, 0.62, 1.5 + k * 1.6, 3.1 + k * 1.6, k % 2 ? '#c49a62' : '#b48a52', { edge: 'rgba(90,60,30,0.5)' });
    post(c, u1 - 0.03, v1 - 0.03, 1.5, 30, 0.032, '#5e3e22');
    tileRoof(c, { u0, v0, u1, v1, e: 0.16, zE: 29, zR: 45, form: 'matbae', pal: ROOFC.board, lift: 2, snow: o.snow, orn: false, step: 0.16, zW: 29 });
    // 통나무 더미
    const piles = [[1.25, 1.85, 1.2, 4.6], [1.25, 1.85, 1.38, 4.6], [1.25, 1.85, 1.56, 4.6], [1.25, 1.85, 1.29, 12.4], [1.25, 1.85, 1.47, 12.4], [1.25, 1.85, 1.38, 20.2]];
    piles.sort((a, b) => a[2] - b[2] || a[3] - b[3]);
    for (const [v0l, v1l, u, z] of piles) logV(c, v0l - 0.62, v1l - 0.62 + 0.4, u + 0.32, z, 3.9);
    // 그루터기와 도끼
    cylV(c, 0.5, 1.5, 0.11, 1.5, 7, '#6b4428', '#c9a070', { rim: '#7a5230' });
    const sx = X(0.5, 1.5), sy = Y(0.5, 1.5, 7);
    c.strokeStyle = 'rgba(120,80,40,0.5)'; c.lineWidth = 0.4; c.beginPath(); c.ellipse(sx, sy, 2.4, 1.2, 0, 0, Math.PI * 2); c.stroke();
    line(c, '#6b4428', 1.4, sx - 1, sy + 0.5, sx - 6, sy - 9);
    c.fillStyle = '#a4acb2'; c.beginPath(); c.moveTo(sx - 1.8, sy - 0.6); c.lineTo(sx + 2.4, sy - 2.2); c.lineTo(sx + 2.6, sy + 0.6); c.lineTo(sx - 0.6, sy + 1.2); c.closePath(); c.fill();
    // 톱질 받침
    seg3(c, '#4a3020', 1.1, [0.9, 1.75, 1.5], [0.98, 1.68, 10]); seg3(c, '#4a3020', 1.1, [0.98, 1.6, 1.5], [0.9, 1.68, 10]);
    seg3(c, '#4a3020', 1.1, [0.55, 1.75, 1.5], [0.63, 1.68, 10]); seg3(c, '#4a3020', 1.1, [0.63, 1.6, 1.5], [0.55, 1.68, 10]);
    logU(c, 0.42, 1.12, 1.68, 10.6, 2.6);
    if (o.snow) for (const [u, v, z] of [[1.57, 1.0, 24], [1.39, 1.2, 16]]) ell(c, '#f2f5f9', X(u, v), Y(u, v, z), 6, 2);
  };

  B.quarry = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 2, 2, 0.5);
    box(c, 0.04, 0.04, 1.96, 1.96, 0, 1.4, '#7f786c', { top: o.snow ? '#dfe4ea' : '#9a9384' });
    onTop(c, 0.04, 0.04, 1.4, () => {
      for (let i = 0; i < 160; i++) { c.fillStyle = ['#b2ab9c', '#6e685e', '#8a8478', '#c4bdb0'][i % 4]; const r = 0.4 + rnd() * 0.9; c.beginPath(); c.arc(rnd() * 60, rnd() * 60, r, 0, Math.PI * 2); c.fill(); }
    });
    // 뒤쪽 바위: 층층이 깎아 낸 채석 단
    const rockBox = (u0, v0, u1, v1, z1) => {
      box(c, u0, v0, u1, v1, 1.4, z1, '#8a8478', { left: '#8f897c', right: '#6a655c', top: o.snow ? '#e8edf2' : '#7e8a5e' });
      const strata = (len, H) => {
        let y = 0;
        while (y > -H + 1) {
          const h = 2.6 + rnd() * 2.6;
          c.fillStyle = rnd() < 0.5 ? 'rgba(255,250,235,0.08)' : 'rgba(30,26,20,0.1)';
          c.fillRect(0, Math.max(-H, y - h), len, Math.min(h, H + y));
          c.fillStyle = 'rgba(40,36,30,0.45)'; c.fillRect(0, y - h - 0.2, len, 0.45);
          y -= h;
        }
        c.strokeStyle = 'rgba(30,26,20,0.5)'; c.lineWidth = 0.45;
        for (let i = 0; i < len / 7; i++) { const x = rnd() * len; c.beginPath(); c.moveTo(x, -H * rnd()); c.lineTo(x + (rnd() - 0.5) * 3, -H * rnd()); c.stroke(); }
        // 정 자국
        c.fillStyle = 'rgba(30,26,20,0.35)';
        for (let i = 0; i < len / 4; i++) c.fillRect(rnd() * len, -rnd() * H, 0.8, 0.4);
      };
      onL(c, u0, v1, 1.4, () => strata((u1 - u0) * 32, z1 - 1.4));
      onR(c, u1, v1, 1.4, () => { strata((v1 - v0) * 32, z1 - 1.4); rr(c, 'rgba(15,10,6,0.12)', 0, -(z1 - 1.4), (v1 - v0) * 32, z1 - 1.4); });
      if (!o.snow) onTop(c, u0, v0, z1, () => { for (let i = 0; i < 14; i++) { c.fillStyle = rnd() < 0.5 ? '#6a8a44' : '#8aa456'; c.beginPath(); c.arc(rnd() * (u1 - u0) * 32, rnd() * (v1 - v0) * 32, 0.8 + rnd() * 1.4, 0, Math.PI * 2); c.fill(); } });
      seg3(c, 'rgba(255,255,255,0.25)', 0.6, [u0, v1, z1], [u1, v1, z1]);
    };
    rockBox(0.06, 0.06, 1.3, 0.42, 34);
    rockBox(0.06, 0.42, 0.5, 1.1, 27);
    rockBox(0.5, 0.42, 1.0, 0.7, 16);
    rockBox(0.06, 1.1, 0.3, 1.32, 9);
    // 다듬은 돌 덩이
    const blocks = [[0.35, 1.25, 0], [0.65, 1.25, 0], [0.35, 1.55, 0], [0.65, 1.55, 0], [0.5, 1.4, 8.5], [0.95, 1.6, 0]];
    blocks.sort((a, b) => (a[0] + a[1] + a[2] * 0.01) - (b[0] + b[1] + b[2] * 0.01));
    for (const [u, v, z] of blocks) {
      box(c, u - 0.13, v - 0.12, u + 0.13, v + 0.12, z + 1.4, z + 9.9, '#aaa396', { top: '#c6bfb1', right: '#7d776c', edge: 'rgba(60,56,48,0.6)' });
      if (o.snow) fill3(c, '#f2f5f9', [[u - 0.13, v - 0.12, z + 9.9], [u + 0.13, v - 0.12, z + 9.9], [u + 0.13, v + 0.12, z + 9.9], [u - 0.13, v + 0.12, z + 9.9]]);
    }
    // 나무 기중기
    const cu = 1.5, cv = 1.15;
    seg3(c, '#4a3020', 2, [cu - 0.3, cv + 0.25, 1.4], [cu, cv, 58]);
    seg3(c, '#4a3020', 2, [cu + 0.3, cv + 0.25, 1.4], [cu, cv, 58]);
    seg3(c, '#5e3e22', 2, [cu, cv - 0.38, 1.4], [cu, cv, 58]);
    seg3(c, '#6b4428', 1.6, [cu, cv, 54], [cu - 0.55, cv + 0.7, 50]);
    seg3(c, '#4a3020', 0.9, [cu - 0.22, cv + 0.18, 22], [cu + 0.22, cv + 0.18, 22]);
    const hx = X(cu - 0.55, cv + 0.7), hy = Y(cu - 0.55, cv + 0.7, 50);
    line(c, '#d6c49a', 0.6, hx, hy, hx, hy + 30);
    circ(c, '#3a2414', X(cu, cv), Y(cu, cv, 54), 1.6);
    box(c, cu - 0.55 - 0.1, cv + 0.7 - 0.08, cu - 0.55 + 0.1, cv + 0.7 + 0.08, 22, 28.5, '#b4aea2', { top: '#d2cdc2', edge: 'rgba(60,56,48,0.6)' });
    line(c, '#d6c49a', 0.5, hx, hy + 30, hx - 3, hy + 32); line(c, '#d6c49a', 0.5, hx, hy + 30, hx + 3, hy + 32);
    // 곡괭이·쐐기
    const px = X(1.15, 1.85), py = Y(1.15, 1.85, 1.4);
    line(c, '#6b4428', 1.2, px - 5, py - 1, px + 4, py - 6);
    c.strokeStyle = '#7a8288'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(px + 1, py - 9); c.quadraticCurveTo(px + 4.5, py - 6.5, px + 7, py - 3); c.stroke();
  };

  B.warehouse = (c, o) => {
    const e = 0.22;
    ao(c, 0, 0, 2, 2);
    plinth(c, 0.03, 0.03, 1.97, 1.97, 0, 7, o);
    const u0 = 0.13, v0 = 0.13, u1 = 1.87, v1 = 1.87, z0 = 7, H = 34;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 3, items: ['board', 'bigdoor', 'board'], plaster: '#7a5232', pillar: '#4e3018', beam: '#3a2414', mid: '#4e3018', hid: 16 * e + 4.2, pw: 3.4,
    }, { bays: 2, items: ['board', 'vent'], board: '#6e4a2c' });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 73, form: 'matbae', lift: 3, snow: o.snow, zW: z0 + H, gableCol: '#7a5232', seed: 11 });
    sack(c, 0.36, 1.93, 7); sack(c, 0.55, 1.94, 7); sack(c, 0.45, 1.9, 11);
    crate(c, 1.93, 0.5, 0.12, 7); crate(c, 1.93, 0.66, 0.1, 7);
  };

  B.smithy = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 2, 2);
    box(c, 0.03, 0.03, 1.97, 1.97, 0, 3, '#5e5246', { top: '#4a4036' });
    onTop(c, 0.03, 0.03, 3, () => { for (let i = 0; i < 70; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(20,16,12,0.4)' : 'rgba(120,100,80,0.25)'; c.fillRect(rnd() * 60, rnd() * 60, 1 + rnd() * 2, 0.6); } });
    // 뒤 돌담 (ㄱ자)
    const zW = 37;
    box(c, 0.08, 0.08, 1.92, 0.26, 3, zW, PAL.stoneDark, { left: '#7d786c', right: '#5f5b52', top: '#8a857a' });
    onL(c, 0.08, 0.26, 3, () => { stoneCourses(c, 1.84 * 32, zW - 3, rnd, { rowH: 3.6, blk: 6 }); rr(c, 'rgba(10,6,4,0.35)', 0, -(zW - 3), 1.84 * 32, zW - 3); });
    box(c, 0.08, 0.26, 0.26, 1.92, 3, zW, PAL.stoneDark, { left: '#7d786c', right: '#6a665c', top: '#8a857a' });
    onR(c, 0.26, 1.92, 3, () => { stoneCourses(c, 1.66 * 32, zW - 3, rnd, { rowH: 3.6, blk: 6 }); rr(c, 'rgba(10,6,4,0.4)', 0, -(zW - 3), 1.66 * 32, zW - 3); });
    // 화덕
    const fu0 = 0.34, fv0 = 0.3, fu1 = 1.0, fv1 = 0.82;
    box(c, fu0, fv0, fu1, fv1, 3, 13, '#6e665a', { top: '#57504a' });
    onL(c, fu0, fv1, 3, () => { stoneCourses(c, (fu1 - fu0) * 32, 10, rnd, { rowH: 3.3 }); rr(c, '#1a0e08', 7, -8, 8, 6); rr(c, '#ff7a2a', 8, -5, 6, 3); rr(c, '#ffd27a', 9.5, -4, 3, 1.4); });
    onR(c, fu1, fv1, 3, () => { stoneCourses(c, (fv1 - fv0) * 32, 10, rnd, { rowH: 3.3 }); rr(c, 'rgba(10,6,4,0.25)', 0, -10, (fv1 - fv0) * 32, 10); });
    // 숯불
    const cx = X(0.68, 0.56), cy = Y(0.68, 0.56, 13);
    c.save(); c.globalCompositeOperation = 'lighter';
    let g = c.createRadialGradient(cx, cy, 1, cx, cy, 34);
    g.addColorStop(0, 'rgba(255,150,60,0.55)'); g.addColorStop(0.5, 'rgba(255,90,30,0.18)'); g.addColorStop(1, 'rgba(255,60,20,0)');
    c.fillStyle = g; c.fillRect(cx - 40, cy - 40, 80, 80);
    c.restore();
    ell(c, '#2a1810', cx, cy, 8, 4);
    g = c.createRadialGradient(cx, cy, 0.5, cx, cy, 7);
    g.addColorStop(0, '#fff2a8'); g.addColorStop(0.35, '#ffb040'); g.addColorStop(0.75, '#e0461a'); g.addColorStop(1, '#5a1a0a');
    c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, 6.6, 3.2, 0, 0, Math.PI * 2); c.fill();
    // 풀무
    box(c, 0.28, 0.9, 0.5, 1.12, 3, 7, '#6b4428', { top: '#8a5f36', edge: 'rgba(40,24,12,0.6)' });
    // 굴뚝 아래쪽 (화덕 위 갓)
    box(c, 0.46, 0.32, 0.86, 0.62, 13, 16, '#5a564e');
    pyramid(c, 0.66, 0.47, 0.2, 16, 24, '#6a655c');
    box(c, 0.56, 0.37, 0.76, 0.57, 24, 34, PAL.stoneDark, { left: '#7a756a', right: '#5a564e' });
    // 담금 물통
    cylV(c, 1.6, 0.62, 0.13, 3, 10, '#6b4428', '#3a5a6a', { rim: '#4a3020' });
    ell(c, 'rgba(200,230,240,0.35)', X(1.58, 0.6), Y(1.58, 0.6, 10), 2, 0.8);
    // 모루
    cylV(c, 1.25, 1.25, 0.1, 3, 9, '#5e3e22', '#7a5232');
    box(c, 1.14, 1.19, 1.38, 1.31, 9, 13, '#3a3f45', { top: '#5a626a', right: '#24282c' });
    const ax2 = X(1.38, 1.25), ay2 = Y(1.38, 1.25, 12);
    c.fillStyle = '#3a3f45'; c.beginPath(); c.moveTo(ax2 - 0.5, ay2 - 1); c.lineTo(ax2 + 4, ay2 + 1.6); c.lineTo(ax2 - 0.5, ay2 + 2); c.closePath(); c.fill();
    line(c, '#6b4428', 1, X(1.2, 1.3) - 2, Y(1.2, 1.3, 13.5), X(1.2, 1.3) + 3, Y(1.2, 1.3, 13.5) - 3);
    rr(c, '#5a626a', X(1.2, 1.3) + 2, Y(1.2, 1.3, 13.5) - 4.6, 2.6, 2);
    // 앞 기둥
    // 화덕 불빛이 바닥과 벽에 번진다
    c.save(); c.globalCompositeOperation = 'lighter';
    const fl = c.createRadialGradient(X(0.9, 1.0), Y(0.9, 1.0, 3), 2, X(0.9, 1.0), Y(0.9, 1.0, 3), 46);
    fl.addColorStop(0, 'rgba(255,120,40,0.32)'); fl.addColorStop(1, 'rgba(255,90,30,0)');
    c.fillStyle = fl; path3(c, [[0.26, 0.26, 3], [1.92, 0.26, 3], [1.92, 1.92, 3], [0.26, 1.92, 3]]); c.fill();
    c.restore();
    for (const [u, v] of [[1.89, 0.3], [1.89, 1.1], [1.89, 1.89], [1.05, 1.89], [0.3, 1.89]]) post(c, u, v, 3, 39, 0.035, '#5e3e22', { top: PAL.woodLight });
    // 병기 걸이 (오른쪽)
    onR(c, 1.8, 1.7, 3, () => {
      rr(c, '#4a3020', 1, -20, 1.4, 20); rr(c, '#4a3020', 14, -20, 1.4, 20);
      rr(c, '#5e3e22', 0, -17, 16.4, 1.2); rr(c, '#5e3e22', 0, -6, 16.4, 1.2);
      for (let i = 0; i < 4; i++) { rr(c, '#c9d0d6', 3 + i * 3, -21, 0.8, 18); rr(c, '#6b4428', 2.5 + i * 3, -6.5, 1.8, 3.5); }
    });
    const zAt = tileRoof(c, { u0: 0.12, v0: 0.12, u1: 1.88, v1: 1.88, e: 0.18, zE: 39, zR: 65, form: 'paljak', gable: 0.48, lift: 4, snow: o.snow, seed: 5 });
    // 지붕을 뚫고 오른 굴뚝
    const zb = zAt(0.66, 0.47) - 2;
    box(c, 0.54, 0.35, 0.78, 0.59, zb, 76, PAL.stoneDark, { left: '#8a857a', right: '#625e55', top: '#2a2420' });
    onL(c, 0.54, 0.59, zb, () => stoneCourses(c, 0.24 * 32, 76 - zb, rnd, { rowH: 3.2, blk: 3, blkVar: 3 }));
    box(c, 0.51, 0.32, 0.81, 0.62, 76, 79, '#5a564e', { top: '#1e1a16' });
    if (o.snow) fill3(c, '#eef2f7', [[0.51, 0.32, 79], [0.81, 0.32, 79], [0.81, 0.4, 79], [0.51, 0.4, 79]]);
  };

  B.market = (c, o) => {
    ao(c, 0, 0, 3, 2, 0.5);
    box(c, 0.03, 0.03, 2.97, 1.97, 0, 1.6, '#9a8c74', { top: o.snow ? '#e4e9ee' : '#b4a486' });
    onTop(c, 0.03, 0.03, 1.6, () => {
      c.strokeStyle = 'rgba(80,66,46,0.35)'; c.lineWidth = 0.5;
      for (let a = 0; a < 94; a += 7.5) { c.beginPath(); c.moveTo(a, 0); c.lineTo(a, 62); c.stroke(); }
      for (let b = 0; b < 62; b += 7.5) { c.beginPath(); c.moveTo(0, b); c.lineTo(94, b); c.stroke(); }
    });
    const AW = [['#b53a2c', '#efe3c2'], ['#3b6ea5', '#efe3c2'], ['#d6a63a', '#7a4a22']];
    const GOODS = [['#5aa04a', '#7fbf55', '#c94a3a', '#e0a040'], ['#8a6a4a', '#d8cba8', '#6a4a32', '#b05a5a'], ['#d9c27a', '#b05a7a', '#5a8aba', '#f0e6d0']];
    for (let i = 0; i < 3; i++) {
      const u0 = 0.1 + i, u1 = 0.9 + i, vB = 0.32, vF = 1.62, zB = 31, zF = 21;
      // 뒷기둥·뒷선반
      post(c, u0 + 0.03, vB, 1.6, zB, 0.022, PAL.woodDark); post(c, u1 - 0.03, vB, 1.6, zB, 0.022, PAL.woodDark);
      box(c, u0 + 0.06, vB + 0.02, u1 - 0.06, vB + 0.2, 1.6, 15, '#6a4526', { top: '#8a5f36' });
      for (let k = 0; k < 5; k++) jar(c, u0 + 0.15 + k * 0.14, vB + 0.12, 0.5 + (k % 2) * 0.12, 15);
      // 앞 진열대
      box(c, u0 + 0.04, vF - 0.36, u1 - 0.04, vF - 0.08, 1.6, 10, '#7a5232', { top: '#9a6c42', right: '#5a3a20', edge: 'rgba(40,24,12,0.5)' });
      const gs = GOODS[i];
      for (let k = 0; k < 14; k++) {
        const gu = u0 + 0.12 + (k % 7) * 0.1, gv = vF - 0.29 + Math.floor(k / 7) * 0.12;
        const x = X(gu, gv), y = Y(gu, gv, 10);
        if (i === 1) { box(c, gu - 0.04, gv - 0.04, gu + 0.04, gv + 0.04, 10, 12.6, gs[k % 4]); }
        else { circ(c, gs[k % 4], x, y - 1.6, 1.8); circ(c, 'rgba(255,255,255,0.35)', x - 0.6, y - 2.2, 0.6); }
      }
      // 앞기둥
      post(c, u0 + 0.03, vF, 1.6, zF, 0.022, PAL.woodDark); post(c, u1 - 0.03, vF, 1.6, zF, 0.022, PAL.woodDark);
      // 차양 (줄무늬 천)
      const nS = 8;
      for (let s = 0; s < nS; s++) {
        const ua = lerp(u0 - 0.02, u1 + 0.02, s / nS), ub = lerp(u0 - 0.02, u1 + 0.02, (s + 1) / nS);
        fill3(c, AW[i][s % 2], [[ua, vB - 0.05, zB], [ub, vB - 0.05, zB], [ub, vF + 0.1, zF], [ua, vF + 0.1, zF]]);
      }
      const sg = c.createLinearGradient(0, Y(u0, vB, zB), 0, Y(u0, vF, zF));
      sg.addColorStop(0, 'rgba(0,0,0,0.12)'); sg.addColorStop(1, 'rgba(255,255,255,0.06)');
      fill3(c, sg, [[u0 - 0.02, vB - 0.05, zB], [u1 + 0.02, vB - 0.05, zB], [u1 + 0.02, vF + 0.1, zF], [u0 - 0.02, vF + 0.1, zF]]);
      if (o.snow) fill3(c, 'rgba(242,245,249,0.95)', [[u0 - 0.02, vB - 0.05, zB + 0.3], [u1 + 0.02, vB - 0.05, zB + 0.3], [u1 + 0.02, vF - 0.15, zF + 2.2], [u0 - 0.02, vF - 0.15, zF + 2.2]]);
      // 앞 술
      onL(c, u0 - 0.02, vF + 0.1, zF, () => {
        const L = (u1 - u0 + 0.04) * 32, sw = L / nS;
        for (let s = 0; s < nS; s++) {
          c.fillStyle = AW[i][s % 2];
          c.beginPath(); c.moveTo(s * sw, 0); c.lineTo((s + 1) * sw, 0); c.lineTo((s + 1) * sw, 1.6); c.arc((s + 0.5) * sw, 1.6, sw / 2, 0, Math.PI); c.closePath(); c.fill();
        }
        rr(c, 'rgba(0,0,0,0.15)', 0, 1.6, L, 1.4);
      });
      // 옆면 두께
      fill3(c, shade(AW[i][1], -0.35), [[u1 + 0.02, vB - 0.05, zB], [u1 + 0.02, vF + 0.1, zF], [u1 + 0.02, vF + 0.1, zF - 1.6], [u1 + 0.02, vB - 0.05, zB - 1.6]]);
    }
    // 등롱 줄
    c.strokeStyle = 'rgba(40,24,12,0.7)'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(X(0.9, 1.75), Y(0.9, 1.75, 20)); c.quadraticCurveTo(X(1.5, 1.75), Y(1.5, 1.75, 16), X(2.1, 1.75), Y(2.1, 1.75, 20)); c.stroke();
    lanternAt(c, 1.3, 1.75, 18.5, 0.7); lanternAt(c, 1.7, 1.75, 18.5, 0.7);
    // 바닥 소품
    sack(c, 0.6, 1.88, 1.6); sack(c, 0.75, 1.9, 1.6); jar(c, 2.25, 1.88, 0.7, 1.6); crate(c, 2.6, 1.86, 0.13, 1.6);
    // 市 깃발
    banner(c, 0.1, 1.86, 56, 8.5, 18, '#b53a2c', '市', 'L', '#fff0d8');
  };

  B.inn = (c, o) => {
    const e = 0.28;
    ao(c, 0, 0, 3, 2);
    plinth(c, 0.03, 0.03, 2.97, 1.97, 0, 6, o);
    const u0 = 0.12, v0 = 0.12, u1 = 2.88, v1 = 1.88, z0 = 6, H = 30;
    const tables = (cc, x0, x1, top, vis) => {
      const g = cc.createRadialGradient((x0 + x1) / 2, top + vis * 0.6, 1, (x0 + x1) / 2, top + vis * 0.6, vis);
      g.addColorStop(0, 'rgba(255,170,80,0.35)'); g.addColorStop(1, 'rgba(255,170,80,0)');
      cc.fillStyle = g; cc.fillRect(x0, top, x1 - x0, vis);
      const cx = (x0 + x1) / 2;
      rr(cc, '#8a5a32', cx - 6, -9.5, 12, 1.6); rr(cc, '#5a3a20', cx - 5, -8, 1.2, 6); rr(cc, '#5a3a20', cx + 3.8, -8, 1.2, 6);
      rr(cc, '#e9dcc0', cx - 3, -11.4, 2, 1.9); rr(cc, '#c9a35a', cx + 1, -11, 1.6, 1.5);
      rr(cc, '#6a4526', cx - 9, -6, 2.4, 4); rr(cc, '#6a4526', cx + 6.6, -6, 2.4, 4);
    };
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 5, items: ['open', 'win', 'door', 'win', 'open'], pillar: '#7a2e22', beam: '#4a1a12', mid: '#7a2e22', hid: 9, rnd: o.rnd, openFn: tables, winW: 9,
    }, { bays: 2, items: ['open', 'win'] });
    // 위층
    const U0 = 0.22, V0 = 0.22, U1 = 2.76, V1 = 1.76, Z1 = 41, H2 = 28;
    walls(c, U0, V0, U1, V1, Z1, H2, {
      bays: 4, items: ['win', 'win', 'win', 'win'], pillar: '#7a2e22', beam: '#4a1a12', mid: '#7a2e22', hid: 16 * e + 6.6, winW: 14, winH: 8, rnd: o.rnd,
    }, { bays: 2, items: ['win', 'win'] });
    skirtRoof(c, u0 - 0.02, v0, u1, v1, Z1 + 0.5, z0 + H - 2, 0.2, o.snow, true);
    // 난간
    const rail = (len, H3) => {
      rr(c, '#7a2e22', 0, -H3, len, 1.3);
      rr(c, '#7a2e22', 0, -1.4, len, 1.1);
      for (let x = 1; x < len; x += 2.6) rr(c, '#8e3a2a', x, -H3, 0.9, H3);
      rr(c, 'rgba(255,220,180,0.2)', 0, -H3, len, 0.4);
    };
    onL(c, U0, V1 + 0.06, Z1, () => rail((U1 - U0 + 0.06) * 32, 7));
    onR(c, U1 + 0.06, V1 + 0.06, Z1, () => { rail((V1 + 0.06 - V0) * 32, 7); rr(c, 'rgba(18,11,6,0.2)', 0, -7, (V1 - V0) * 32, 7); });
    tileRoof(c, { u0: U0, v0: V0, u1: U1, v1: V1, e, zE: Z1 + H2 - 1, zR: 95, form: 'paljak', gable: 0.42, lift: 7, trim: true, snow: o.snow, seed: 13 });
    // 객잔 현판: 문 위 덧지붕 처마에 건다
    onL(c, 1.5 - 14 / 32, v1 + 0.2, z0 + H - 5.4, () => {
      rr(c, '#2a1a10', 5, -1.6, 0.6, 1.8); rr(c, '#2a1a10', 22.4, -1.6, 0.6, 1.8);
      faceSign(c, 14, 0.4, 26, 9, '客棧');
    });
    for (const u of [0.4, 0.92, 2.08, 2.6]) lanternAt(c, u, v1 + 0.2, z0 + H - 4.5, 0.85);
    // 酒 깃발
    banner(c, 2.95, 1.18, 92, 9, 22, '#efe3c2', '酒', 'R', '#1e1712');
  };

  B.escort = (c, o) => {
    const e = 0.28, rnd = o.rnd;
    ao(c, 0, 0, 3, 3);
    // 앞마당
    box(c, 0.03, 1.96, 2.97, 2.97, 0, 1.2, '#a08a64', { top: o.snow ? '#e2e7ec' : '#b8a07a' });
    onTop(c, 0.03, 1.96, 1.2, () => { for (let i = 0; i < 60; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(120,96,64,0.4)' : 'rgba(230,214,180,0.3)'; c.fillRect(rnd() * 94, rnd() * 32, 1.4, 0.6); } });
    plinth(c, 0.03, 0.03, 2.97, 1.97, 0, 7, o);
    const u0 = 0.16, v0 = 0.14, u1 = 2.84, v1 = 1.8, z0 = 7, H = 35;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 4, items: ['win', 'lat', 'lat', 'win'], pillar: '#8e2e22', beam: '#4a1a12', mid: '#7a2e22', dan: true, hid: 16 * e + 6.6,
      sign: '鏢局', signW: 24, signH: 8.5, rnd: o.rnd, winW: 11,
    }, { bays: 2, items: ['win', 'win'] });
    steps(c, 1.2, 1.8, 1.97, 2.2, 0, 7, 3);
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 70, form: 'paljak', gable: 0.42, lift: 7, trim: true, snow: o.snow, seed: 17 });
    // 수레와 짐
    cart(c, 2.0, 2.3, 2.7, 2.6, o);
    // 깃발
    triFlag(c, 0.18, 2.82, 46, '#b53a2c', '鏢');
    triFlag(c, 2.82, 2.82, 46, '#b53a2c', '鏢');
    // 창 걸이
    onL(c, 0.4, 2.2, 1.2, () => {
      rr(c, '#4a3020', 0, -16, 1.2, 16); rr(c, '#4a3020', 16, -16, 1.2, 16); rr(c, '#5e3e22', 0, -14, 17.2, 1.1); rr(c, '#5e3e22', 0, -5, 17.2, 1.1);
      for (let i = 0; i < 4; i++) { rr(c, '#6b4428', 2.5 + i * 3.6, -24, 0.8, 22); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(2.9 + i * 3.6, -27); c.lineTo(3.7 + i * 3.6, -24); c.lineTo(2.1 + i * 3.6, -24); c.fill(); rr(c, '#b53a2c', 2.3 + i * 3.6, -24.2, 1.2, 1); }
    });
  };
  function cart(c, u0, v0, u1, v1, o) {
    const wheel = (u, v) => onL(c, u, v, 6, () => {
      circ(c, '#3b2414', 0, 0, 5.4); circ(c, '#7a5232', 0, 0, 4.4); circ(c, '#3b2414', 0, 0, 3.6);
      c.strokeStyle = '#8a6a4a'; c.lineWidth = 0.7;
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 3.6, Math.sin(a) * 3.6); c.stroke(); }
      circ(c, '#c9a35a', 0, 0, 1);
    });
    const um = (u0 + u1) / 2;
    wheel(um, v0 - 0.02);
    box(c, u0, v0, u1, v1, 7, 10, '#7a5232', { top: '#9a6c42', right: '#5a3a20', edge: 'rgba(40,24,12,0.6)' });
    seg3(c, '#5a3a20', 1.2, [u0, v0 + 0.06, 8.5], [u0 - 0.4, v0 + 0.06, 4]);
    seg3(c, '#5a3a20', 1.2, [u0, v1 - 0.06, 8.5], [u0 - 0.4, v1 - 0.06, 4]);
    crate(c, u0 + 0.16, (v0 + v1) / 2, 0.2, 10);
    crate(c, u0 + 0.42, (v0 + v1) / 2, 0.18, 10);
    box(c, u0 + 0.22, v0 + 0.08, u0 + 0.5, v1 - 0.08, 13.6, 17, '#b53a2c', { top: '#c94a3a' });
    wheel(um, v1 + 0.02);
    triFlag(c, u1 - 0.06, v0 + 0.05, 30, '#d6a63a', '鏢', { len: 13, hgt: 9, fg: '#5a2a10', edge: '#7a4a1a' });
    if (o.snow) fill3(c, '#f2f5f9', [[u0 + 0.06, v0 + 0.06, 17.2], [u0 + 0.5, v0 + 0.06, 17.2], [u0 + 0.5, v1 - 0.06, 17.2], [u0 + 0.06, v1 - 0.06, 17.2]]);
  }

  B.clinic = (c, o) => {
    const e = 0.24, rnd = o.rnd;
    ao(c, 0, 0, 2, 2);
    plinth(c, 0.03, 0.03, 1.97, 1.97, 0, 7, o);
    const u0 = 0.15, v0 = 0.15, u1 = 1.85, v1 = 1.85, z0 = 7, H = 30, vw = 1.58;
    walls(c, u0, v0, u1, vw, z0, H, {
      bays: 3, items: ['door', 'win', 'win'], hid: 16 * (e + v1 - vw) + 4.2, rnd: o.rnd, shade: 0.12, winW: 10,
    }, { bays: 2, items: ['win', 'wall'], hid: 16 * e + 4.2, shade: 0.22 });
    // 툇마루와 약초 채반
    box(c, u0, vw, u1, v1, z0, z0 + 3, '#8a5e34', { top: '#b8854e', right: '#5e3e22' });
    onTop(c, u0, vw, z0 + 3, () => { c.fillStyle = 'rgba(90,56,28,0.45)'; for (let a = 4; a < (u1 - u0) * 32; a += 4.2) c.fillRect(a, 0, 0.4, (v1 - vw) * 32); });
    for (const [u, v, col] of [[0.95, 1.72, '#6a8a3a'], [1.25, 1.7, '#8a5a3a'], [1.55, 1.73, '#a08a4a']]) {
      const x = X(u, v), y = Y(u, v, z0 + 3);
      ell(c, '#7a5a2a', x, y - 0.6, 5.2, 2.5); ell(c, '#b08a4e', x, y - 1.2, 5, 2.3); ell(c, col, x, y - 1.4, 3.8, 1.6);
      for (let k = 0; k < 6; k++) circ(c, shade(col, 0.25), x - 2.6 + rnd() * 5.2, y - 1.4 + (rnd() - 0.5) * 1.6, 0.5);
    }
    box(c, 0.45, v1, 0.75, 1.96, 7, 8.4, '#aaa59a');
    for (let i = 0; i <= 3; i++) post(c, lerp(u0 + 0.035, u1 - 0.035, i / 3), v1 - 0.035, z0, z0 + H, 0.035, PAL.wood, { top: PAL.woodLight });
    // 藥 간판 (기둥에 건 세로 현판)
    onL(c, lerp(u0 + 0.035, u1 - 0.035, 1 / 3) + 0.06, v1 - 0.0, z0 + H - 9, () => faceSign(c, 0, 0, 6.5, 14, '藥', { vertical: true, bg: '#efe3c2', fg: '#1e1712', frame: '#5a3a22' }));
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 70, form: 'hip', lift: 5, snow: o.snow, seed: 19 });
    // 호리병
    const gx = X(u1 + 0.1, v1 + 0.1), gy = Y(u1 + 0.1, v1 + 0.1, z0 + H - 4);
    line(c, '#b53a2c', 0.6, gx, gy - 2, gx, gy + 2);
    circ(c, '#d0a24e', gx, gy + 7, 3); circ(c, '#d8ae58', gx, gy + 3.2, 2); circ(c, 'rgba(255,240,200,0.5)', gx - 1, gy + 6, 0.9);
    rr(c, '#b53a2c', gx - 1.6, gy + 4.6, 3.2, 0.7);
  };

  B.shrine = (c, o) => {
    const e = 0.24;
    ao(c, 0, 0, 2, 2);
    plinth(c, 0.03, 0.03, 1.97, 1.97, 0, 5, o);
    plinth(c, 0.14, 0.12, 1.86, 1.62, 5, 12, Object.assign({}, o, { col: '#a6a194' }));
    steps(c, 0.78, 1.22, 1.62, 1.92, 5, 12, 3);
    const u0 = 0.25, v0 = 0.2, u1 = 1.75, v1 = 1.48, z0 = 12, H = 28;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 3, items: ['red', 'red', 'red'], pillar: '#a8382a', beam: '#5a1c14', mid: '#8a2a20', dan: true, hid: 16 * e + 6.6, rnd: o.rnd,
    }, { bays: 2, items: ['wall', 'wall'], plaster: '#e8dcc2' });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 64, form: 'matbae', lift: 5, trim: true, snow: o.snow, zW: z0 + H, gableCol: '#c9b896', seed: 23 });
    // 향로와 석등
    cylV(c, 0.5, 1.82, 0.075, 5, 9.5, '#5a4a32', '#2a2016', { rim: '#8a7a4a' });
    for (const d of [-0.05, 0.05]) seg3(c, '#5a4a32', 0.9, [0.5 + d, 1.82 + 0.05, 5], [0.5 + d * 1.4, 1.82 + 0.07, 3]);
    ell(c, '#8a7a4a', X(0.5, 1.82), Y(0.5, 1.82, 9.6), 3.6, 1.6);
    for (const d of [-1, 0, 1]) line(c, '#c9a35a', 0.4, X(0.5, 1.82) + d, Y(0.5, 1.82, 9.6), X(0.5, 1.82) + d * 1.2, Y(0.5, 1.82, 14));
    stoneLantern(c, 1.58, 1.8, 5, o.snow);
  };

  B.well = (c, o) => {
    ao(c, 0.12, 0.12, 0.88, 0.88, 0.6);
    box(c, 0.08, 0.08, 0.92, 0.92, 0, 2, '#8e897e', { top: o.snow ? '#e4e9ee' : '#aaa598' });
    onTop(c, 0.08, 0.08, 2, () => { c.strokeStyle = 'rgba(70,64,56,0.4)'; c.lineWidth = 0.4; for (let a = 5; a < 27; a += 5.4) { c.beginPath(); c.moveTo(a, 0); c.lineTo(a, 27); c.stroke(); c.beginPath(); c.moveTo(0, a); c.lineTo(27, a); c.stroke(); } });
    // 뒤 기둥
    post(c, 0.14, 0.5, 2, 33, 0.03, '#5e3e22');
    // 우물 둘레돌
    const x = X(0.5, 0.5);
    cylV(c, 0.5, 0.5, 0.27, 2, 12, '#8e897e', '#b4afa4');
    const y0 = Y(0.5, 0.5, 2), y1 = Y(0.5, 0.5, 12);
    c.strokeStyle = 'rgba(50,46,40,0.5)'; c.lineWidth = 0.5;
    for (let row = 0; row < 3; row++) {
      const yy = lerp(y0, y1, (row + 1) / 3);
      c.beginPath(); c.ellipse(x, yy, 12.2, 6.1, 0, 0, Math.PI); c.stroke();
      for (let k = 0; k < 7; k++) { const a = (k + (row % 2) * 0.5 + 0.3) / 7 * Math.PI; const px = x + Math.cos(a) * 12.2, py = yy + Math.sin(a) * 6.1; line(c, 'rgba(50,46,40,0.5)', 0.5, px, py, px, py - (y0 - y1) / 3); }
    }
    ell(c, '#c4bfb4', x, y1, 12.2, 6.1);
    ell(c, '#6a665c', x, y1 + 0.4, 8.6, 4.2);
    ell(c, o.snow ? '#9ab4c4' : '#1e3a4a', x, y1 + 1.1, 8, 3.6);
    ell(c, 'rgba(160,200,220,0.35)', x - 2, y1 + 0.4, 3, 1);
    if (o.snow) { c.strokeStyle = '#f2f5f9'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(x, y1 - 0.4, 11.4, 5.5, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
    // 두레박
    cylV(c, 0.66, 0.74, 0.06, 12, 16, '#6b4428', '#3a2a1a', { rim: '#4a3020' });
    // 앞 기둥과 도르래
    post(c, 0.86, 0.5, 2, 33, 0.03, '#5e3e22');
    seg3(c, '#4a3020', 1.6, [0.12, 0.5, 30], [0.88, 0.5, 30]);
    const wx = X(0.5, 0.5), wy = Y(0.5, 0.5, 30);
    onL(c, 0.5, 0.5, 30, () => { circ(c, '#6b4428', 0, 1.6, 2.6); circ(c, '#3a2414', 0, 1.6, 0.9); });
    line(c, '#c9b48a', 0.6, wx + 2, wy + 2, wx + 2, wy + 22);
    tileRoof(c, { u0: 0.14, v0: 0.36, u1: 0.86, v1: 0.64, e: 0.12, zE: 34, zR: 45, form: 'matbae', lift: 2, snow: o.snow, orn: false, step: 0.09, zW: 33, gableCol: '#8a6440' });
  };

  B.pavilion = (c, o) => {
    const sn = o.season;
    ao(c, 0.82, 0.02, 1.98, 1.18, 0.9);
    // 연못
    fill3(c, '#7a7468', [[0.04, 0.9, 0], [0.86, 0.9, 0], [0.86, 1.96, 0], [0.04, 1.96, 0]]);
    onTop(c, 0.04, 0.9, 0.6, () => {
      const cx = 0.41 * 32, cy = 0.53 * 32;
      c.fillStyle = '#8a857a'; c.beginPath(); c.ellipse(cx, cy, 13.4, 16.6, 0.15, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; c.fillStyle = k % 2 ? '#a6a194' : '#7d786c'; c.beginPath(); c.ellipse(cx + Math.cos(a) * 12.6, cy + Math.sin(a) * 15.6, 2.4, 2, a, 0, Math.PI * 2); c.fill(); }
      const water = sn === 3 ? '#b6c8d4' : '#3f7898';
      c.fillStyle = water; c.beginPath(); c.ellipse(cx, cy, 11, 14, 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = sn === 3 ? 'rgba(255,255,255,0.4)' : 'rgba(150,200,225,0.35)'; c.beginPath(); c.ellipse(cx - 3, cy - 4, 4, 6, 0.15, 0, Math.PI * 2); c.fill();
      if (sn !== 3) {
        const pads = [[-4, 5, 3.2], [4, -2, 2.8], [2, 8, 2.4], [-5, -6, 2.6], [5, 6, 2]];
        for (const [dx, dy, r] of pads) {
          c.fillStyle = sn === 2 ? '#8a7a3a' : '#4f8f4a';
          c.beginPath(); c.arc(cx + dx, cy + dy, r, 0.3, Math.PI * 2 - 0.1); c.lineTo(cx + dx, cy + dy); c.fill();
          c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(cx + dx - r * 0.3, cy + dy - r * 0.3, r * 0.4, 0, Math.PI * 2); c.fill();
        }
      } else {
        c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 0.5;
        c.beginPath(); c.moveTo(cx - 6, cy - 4); c.lineTo(cx + 2, cy + 3); c.lineTo(cx + 5, cy + 1); c.stroke();
      }
    });
    if (sn === 1 || sn === 0) {
      for (const [u, v] of sn === 1 ? [[0.3, 1.62], [0.55, 1.32]] : [[0.4, 1.5]]) {
        const x = X(u, v), y = Y(u, v, 1);
        line(c, '#3f7a3a', 0.6, x, y, x, y - 5);
        if (sn === 1) { ell(c, '#f0a0b8', x, y - 6.2, 2.2, 1.8); ell(c, '#ffd0dc', x, y - 6.8, 1.2, 1); }
        else ell(c, '#6aa04a', x, y - 5.6, 1.4, 1.6);
      }
    }
    // 정자 기단
    const pu0 = 0.86, pv0 = 0.06, pu1 = 1.94, pv1 = 1.14, zb = 8;
    plinth(c, pu0, pv0, pu1, pv1, 0, zb, o);
    steps(c, 1.2, 1.6, pv1, 1.32, 0, zb, 2);
    const cu0 = pu0 + 0.08, cv0 = pv0 + 0.08, cu1 = pu1 - 0.08, cv1 = pv1 - 0.08, H = 30;
    // 마루
    box(c, cu0, cv0, cu1, cv1, zb, zb + 2, '#8a5e34', { top: '#a8784a' });
    onTop(c, cu0, cv0, zb + 2, () => { c.fillStyle = 'rgba(80,50,24,0.4)'; for (let a = 3.6; a < (cu1 - cu0) * 32; a += 3.6) c.fillRect(a, 0, 0.4, (cv1 - cv0) * 32); });
    const pr = 0.035;
    post(c, cu0 + pr, cv0 + pr, zb + 2, zb + H, pr, PAL.red, { top: PAL.redDark });
    post(c, cu1 - pr, cv0 + pr, zb + 2, zb + H, pr, PAL.red, { top: PAL.redDark });
    post(c, cu0 + pr, cv1 - pr, zb + 2, zb + H, pr, PAL.red, { top: PAL.redDark });
    // 난간
    const rail = (len) => { rr(c, '#7a2e22', 0, -6.2, len, 1.1); rr(c, '#7a2e22', 0, -1.2, len, 1); for (let x = 1.5; x < len; x += 2.4) rr(c, '#8e3a2a', x, -6, 0.7, 5); };
    onL(c, cu0, cv1, zb + 2, () => { const L = (cu1 - cu0) * 32; rail(L * 0.32); c.save(); c.translate(L * 0.68, 0); rail(L * 0.32); c.restore(); });
    onR(c, cu1, cv1, zb + 2, () => { rail((cv1 - cv0) * 32); rr(c, 'rgba(18,11,6,0.18)', 0, -6.2, (cv1 - cv0) * 32, 6.2); });
    post(c, cu1 - pr, cv1 - pr, zb + 2, zb + H, pr, PAL.red, { top: PAL.redDark });
    // 기둥 위 창방
    seg3(c, '#2f6f58', 2.2, [cu0, cv1, zb + H - 1], [cu1, cv1, zb + H - 1]);
    seg3(c, '#2f6f58', 2.2, [cu1, cv1, zb + H - 1], [cu1, cv0, zb + H - 1]);
    tileRoof(c, { u0: cu0, v0: cv0, u1: cu1, v1: cv1, e: 0.3, zE: zb + H - 1, zR: 56, form: 'paljak', gable: 0.5, lift: 9, liftR: 0.9, trim: true, snow: o.snow, seed: 29 });
  };

  B.dojo = (c, o) => {
    const e = 0.24, rnd = o.rnd;
    ao(c, 0, 0, 3, 1);
    // 수련 마당 (앞 두 줄)
    box(c, 0.03, 1.0, 2.97, 2.97, 0, 1.4, '#a49270', { top: o.snow ? '#e4e9ee' : '#d4c095' });
    onTop(c, 0.03, 1.0, 1.4, () => {
      for (let i = 0; i < 160; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(176,150,104,0.6)' : 'rgba(240,226,190,0.5)'; c.fillRect(rnd() * 94, rnd() * 63, 1.2, 0.6); }
      c.strokeStyle = 'rgba(140,116,80,0.35)'; c.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(52, 34, 10 + k * 4, 7 + k * 3, 0, 0, Math.PI * 2); c.stroke(); }
    });
    // 마당 테두리 돌
    box(c, 0.03, 2.88, 2.97, 2.97, 0, 2.6, PAL.stone, { top: o.snow ? '#eef2f7' : PAL.stoneLight });
    box(c, 2.88, 1.0, 2.97, 2.88, 0, 2.6, PAL.stone, { top: o.snow ? '#eef2f7' : PAL.stoneLight });
    // 본당 (뒷줄)
    plinth(c, 0.03, 0.03, 2.97, 0.97, 0, 6, o);
    steps(c, 1.25, 1.75, 0.97, 1.12, 0, 6, 2);
    const u0 = 0.14, v0 = 0.12, u1 = 2.86, v1 = 0.86, z0 = 6, H = 31;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 5, items: ['win', 'lat', 'lat', 'lat', 'win'], pillar: '#9c3226', beam: '#5a1c14', mid: '#7a2a20', dan: true, hid: 16 * e + 6.6,
      sign: '武館', signW: 22, signH: 8, rnd: o.rnd, winW: 10,
    }, { bays: 1, items: ['win'] });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 54, form: 'paljak', gable: 0.4, lift: 6, liftR: 0.7, trim: true, snow: o.snow, seed: 31 });
    // 횃불 (BDEF 조명 자리)
    brazier(c, 0.25, 1.12, 16, o.snow);
    brazier(c, 2.75, 1.12, 16, o.snow);
    // 병기대 (왼쪽)
    onR(c, 0.22, 2.3, 1.4, () => {
      rr(c, '#4a3020', 0, -18, 1.3, 18); rr(c, '#4a3020', 22, -18, 1.3, 18);
      rr(c, '#5e3e22', 0, -15.5, 23.3, 1.2); rr(c, '#5e3e22', 0, -5, 23.3, 1.2);
      const kinds = ['spear', 'sword', 'spear', 'blade', 'spear', 'staff'];
      kinds.forEach((k, i) => {
        const x = 3 + i * 3.4;
        if (k === 'spear') { rr(c, '#6b4428', x, -27, 0.8, 25); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(x + 0.4, -30.5); c.lineTo(x + 1.3, -27); c.lineTo(x - 0.5, -27); c.fill(); rr(c, '#b53a2c', x - 0.2, -27.2, 1.2, 1.1); }
        else if (k === 'staff') rr(c, '#8a6a3a', x, -26, 0.9, 24);
        else { rr(c, '#3a2a1a', x, -8, 0.9, 4); rr(c, '#c9a35a', x - 0.6, -8.4, 2.1, 0.7); rr(c, '#dfe5ea', x + 0.05, -21, 0.8, 12.6); }
      });
    });
    // 목인장
    for (const [u, v] of [[2.2, 1.55], [2.45, 2.25], [1.75, 2.45]]) dummy(c, u, v, o.snow);
    // 과녁 짚단
    cylV(c, 0.6, 2.55, 0.1, 1.4, 12, '#c9a35a', '#e0c47f', { rim: '#8f6e36' });
    onL(c, 0.6, 2.55 + 0.1, 1.4, () => { circ(c, '#efe3c2', 0, -8, 3.4); circ(c, '#b53a2c', 0, -8, 2.2); circ(c, '#efe3c2', 0, -8, 1); });
  };
  function dummy(c, u, v, snow) {
    const x = X(u, v);
    ell(c, 'rgba(0,0,0,0.25)', x + 1, Y(u, v, 1.4) + 0.5, 5, 2);
    cylV(c, u, v, 0.055, 1.4, 25, '#6b4428', '#8a5f36');
    const y = Y(u, v, 0);
    line(c, '#5a3a20', 1.6, x - 1, y - 18, x - 7, y - 17);
    line(c, '#5a3a20', 1.6, x + 1, y - 19, x + 7, y - 20.5);
    line(c, '#5a3a20', 1.6, x + 0.5, y - 13, x + 5, y - 10.5);
    line(c, '#5a3a20', 1.6, x - 0.5, y - 7, x - 4, y - 3.5);
    circ(c, '#7a5232', x, y - 26.5, 2.8);
    circ(c, 'rgba(255,230,190,0.2)', x - 1, y - 27.4, 1);
    if (snow) ell(c, '#f2f5f9', x, y - 29, 2.4, 1);
  }

  B.tower = (c, o) => {
    ao(c, 0.08, 0.08, 0.92, 0.92, 0.7);
    const lg = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]];
    const top = [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]];
    const zP = 51;
    for (const [u, v] of lg) box(c, u - 0.06, v - 0.06, u + 0.06, v + 0.06, 0, 2.5, PAL.stone);
    const leg = i => {
      const [u, v] = lg[i], [tu, tv] = top[i];
      seg3(c, '#3b2414', 2.8, [u, v, 2.5], [tu, tv, zP]);
      seg3(c, '#6b4428', 1.4, [u - 0.015, v, 2.5], [tu - 0.015, tv, zP]);
    };
    const brace = (i, j) => {
      const A = lg[i], Bq = lg[j], TA = top[i], TB = top[j];
      const at = (P0, P1, t) => [lerp(P0[0], P1[0], t), lerp(P0[1], P1[1], t)];
      for (const [t0, t1] of [[0.08, 0.5], [0.5, 0.92]]) {
        const a0 = at(A, TA, t0), b1 = at(Bq, TB, t1), b0 = at(Bq, TB, t0), a1 = at(A, TA, t1);
        seg3(c, '#5e3e22', 1.1, [a0[0], a0[1], lerp(2.5, zP, t0)], [b1[0], b1[1], lerp(2.5, zP, t1)]);
        seg3(c, '#5e3e22', 1.1, [b0[0], b0[1], lerp(2.5, zP, t0)], [a1[0], a1[1], lerp(2.5, zP, t1)]);
        const h0 = at(A, TA, t1), h1 = at(Bq, TB, t1);
        seg3(c, '#4a3020', 1.3, [h0[0], h0[1], lerp(2.5, zP, t1)], [h1[0], h1[1], lerp(2.5, zP, t1)]);
      }
    };
    leg(0); brace(0, 1); brace(0, 2);
    leg(1); leg(2);
    brace(1, 3); brace(2, 3);
    leg(3);
    // 사다리 (왼쪽 앞면)
    seg3(c, '#8a6a42', 1.2, [0.42, 0.98, 0], [0.42, 0.8, zP]);
    seg3(c, '#8a6a42', 1.2, [0.58, 0.98, 0], [0.58, 0.8, zP]);
    for (let z = 4; z < zP; z += 4.6) { const t = z / zP; seg3(c, '#a07a4e', 0.9, [0.42, lerp(0.98, 0.8, t), z], [0.58, lerp(0.98, 0.8, t), z]); }
    // 망대
    box(c, 0.03, 0.03, 0.97, 0.97, zP, zP + 5, '#7a5232', { top: '#a07a4e', right: '#4e3018', edge: 'rgba(40,24,12,0.6)' });
    onTop(c, 0.03, 0.03, zP + 5, () => { c.fillStyle = 'rgba(70,44,22,0.45)'; for (let a = 3.6; a < 30; a += 3.6) c.fillRect(a, 0, 0.45, 30); });
    if (o.snow) fill3(c, 'rgba(242,245,249,0.9)', [[0.03, 0.03, zP + 5.1], [0.97, 0.03, zP + 5.1], [0.97, 0.2, zP + 5.1], [0.2, 0.2, zP + 5.1], [0.2, 0.97, zP + 5.1], [0.03, 0.97, zP + 5.1]]);
    // 지붕 기둥 (뒤 셋)
    const zr = 90;
    const rp = [[0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92]];
    for (const i of [0, 1, 2]) post(c, rp[i][0], rp[i][1], zP + 5, zr, 0.025, '#5e3e22');
    // 난간 (뒤쪽 두 변)
    const railBack = () => {
      seg3(c, '#5e3e22', 1.3, [0.05, 0.05, zP + 15], [0.95, 0.05, zP + 15]);
      seg3(c, '#5e3e22', 1.3, [0.05, 0.05, zP + 15], [0.05, 0.95, zP + 15]);
      for (let t = 0.05; t <= 0.96; t += 0.15) { seg3(c, '#4a3020', 0.9, [t, 0.05, zP + 5], [t, 0.05, zP + 15]); seg3(c, '#4a3020', 0.9, [0.05, t, zP + 5], [0.05, t, zP + 15]); }
    };
    railBack();
    // 앞 난간 (궁수 다리 앞 낮은 널벽)
    onL(c, 0.05, 0.97, zP + 5, () => { rr(c, '#6b4428', 0, -9, 0.92 * 32, 9); for (let x = 3; x < 29; x += 3.6) rr(c, 'rgba(40,24,12,0.4)', x, -9, 0.45, 9); rr(c, '#8a5f36', 0, -9.6, 0.92 * 32, 1.4); });
    onR(c, 0.97, 0.97, zP + 5, () => { rr(c, '#553820', 0, -9, 0.92 * 32, 9); for (let x = 3; x < 29; x += 3.6) rr(c, 'rgba(30,18,8,0.4)', x, -9, 0.45, 9); rr(c, '#7a5232', 0, -9.6, 0.92 * 32, 1.4); });
    post(c, rp[3][0], rp[3][1], zP + 5, zr, 0.025, '#5e3e22');
    // 작은 지붕
    tileRoof(c, { u0: 0.08, v0: 0.08, u1: 0.92, v1: 0.92, e: 0.12, zE: zr, zR: 108, form: 'hip', lift: 4, liftR: 0.4, snow: o.snow, step: 0.09, seed: 37 });
    // 꼭대기 깃발
    const fx = X(0.5, 0.5), fy = Y(0.5, 0.5, 112);
    line(c, '#3b2414', 0.9, fx, fy + 1, fx, fy - 8);
    c.fillStyle = '#b53a2c'; c.beginPath(); c.moveTo(fx + 0.4, fy - 8); c.lineTo(fx + 7, fy - 6); c.lineTo(fx + 0.4, fy - 3.8); c.closePath(); c.fill();
  };

  // 목책·석벽: 이웃 마스크(N=1 오른쪽 위, E=2 오른쪽 아래, S=4 왼쪽 아래, W=8 왼쪽 위)
  function lineArms(m) {
    const arms = [];
    if (m & 1) arms.push([0.5, 0.0]);
    if (m & 8) arms.push([0.0, 0.5]);
    if (m & 2) arms.push([1.0, 0.5]);
    if (m & 4) arms.push([0.5, 1.0]);
    return arms;
  }
  B.wall = (c, o) => {
    const m = o.mask || 0;
    const pts = [];
    const add = (u, v) => pts.push([u, v]);
    let arms = lineArms(m);
    if (!arms.length) arms = [[0.12, 0.5], [0.88, 0.5]];
    else if (arms.length === 1) { const [u, v] = arms[0]; arms.push([1 - u + (u - 0.5) * 0.4, 1 - v + (v - 0.5) * 0.4]); }
    add(0.5, 0.5);
    for (const [u, v] of arms) {
      const n = 4;
      for (let k = 1; k <= n; k++) { const t = k / n; add(lerp(0.5, u, t * 0.94), lerp(0.5, v, t * 0.94)); }
    }
    ao(c, 0.3, 0.3, 0.7, 0.7, 0.5);
    for (const [u, v] of arms) fill3(c, 'rgba(25,16,8,0.18)', [[0.5 - 0.05, 0.5, 0], [0.5, 0.5 - 0.05, 0], [u + 0.05 * Math.sign(u - 0.5 || 1), v, 0], [u, v + 0.05, 0]]);
    pts.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
    const rail = (z) => {
      for (const [u, v] of arms) {
        seg3(c, '#3a2414', 1.6, [0.5, 0.5, z], [u, v, z]);
        seg3(c, '#6b4428', 0.6, [0.5, 0.5, z + 0.5], [u, v, z + 0.5]);
      }
    };
    rail(9);
    pts.forEach(([u, v], i) => {
      const h = 22 + ((i * 7) % 5) - 2;
      const x = X(u, v), y = Y(u, v, 0);
      ell(c, 'rgba(0,0,0,0.25)', x + 0.8, y, 3, 1.3);
      c.fillStyle = '#5e3e22';
      c.beginPath(); c.moveTo(x - 2.3, y); c.lineTo(x - 2.3, y - h); c.lineTo(x, y - h - 4.4); c.lineTo(x + 2.3, y - h); c.lineTo(x + 2.3, y); c.closePath(); c.fill();
      rr(c, '#8e6239', x - 2.3, y - h, 1.5, h);
      rr(c, 'rgba(0,0,0,0.25)', x + 1.1, y - h, 1.2, h);
      c.fillStyle = '#c9a070'; c.beginPath(); c.moveTo(x - 2.3, y - h); c.lineTo(x, y - h - 4.4); c.lineTo(x - 0.4, y - h); c.closePath(); c.fill();
      if (o.snow) { c.fillStyle = PAL.snow; c.beginPath(); c.moveTo(x - 2.3, y - h + 0.5); c.lineTo(x, y - h - 4.4); c.lineTo(x + 2.3, y - h + 0.5); c.closePath(); c.fill(); }
    });
    rail(17);
    // 묶은 새끼줄
    for (const [u, v] of pts) { const x = X(u, v), y = Y(u, v, 17); rr(c, '#c9b07a', x - 2.3, y - 1.2, 4.6, 0.9); }
  };
  B.stonewall = (c, o) => {
    const m = o.mask || 0, rnd = o.rnd;
    const hz = 23, th = 0.17;
    const seg = (u0, v0, u1, v1, z1) => {
      box(c, u0, v0, u1, v1, 0, z1, '#8e897e', { left: '#9b968b', right: '#75716a', top: o.snow ? '#eef2f7' : '#b4afa4' });
      onL(c, u0, v1, 0, () => stoneCourses(c, (u1 - u0) * 32, z1, rnd, { rowH: 4.2, blk: 5, blkVar: 5 }));
      onR(c, u1, v1, 0, () => { stoneCourses(c, (v1 - v0) * 32, z1, rnd, { rowH: 4.2, blk: 5, blkVar: 5 }); rr(c, 'rgba(15,10,6,0.12)', 0, -z1, (v1 - v0) * 32, z1); });
      seg3(c, 'rgba(255,255,255,0.3)', 0.6, [u0, v1, z1], [u1, v1, z1]);
    };
    const merlons = (u0, v0, u1, v1, z1) => {
      const alongU = (u1 - u0) >= (v1 - v0);
      const L = alongU ? u1 - u0 : v1 - v0;
      const n = Math.max(1, Math.round(L / 0.24));
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.18) / n, t1 = (i + 0.82) / n;
        if (alongU) box(c, lerp(u0, u1, t0), v0, lerp(u0, u1, t1), v1, z1, z1 + 5, '#8e897e', { left: '#a39e93', right: '#77736b', top: o.snow ? '#f2f5f9' : '#bdb8ad' });
        else box(c, u0, lerp(v0, v1, t0), u1, lerp(v0, v1, t1), z1, z1 + 5, '#8e897e', { left: '#a39e93', right: '#77736b', top: o.snow ? '#f2f5f9' : '#bdb8ad' });
      }
    };
    const a0 = 0.5 - th, a1 = 0.5 + th;
    const N = m & 1, E = m & 2, S = m & 4, W = m & 8;
    ao(c, 0.25, 0.25, 0.75, 0.75, 0.6);
    const straightU = (E || W) && !(N || S), straightV = (N || S) && !(E || W);
    const parts = [];
    if (!m) parts.push([0.1, a0, 0.9, a1]);
    else if (straightU) parts.push([W ? 0 : a0, a0, E ? 1 : a1, a1]);
    else if (straightV) parts.push([a0, N ? 0 : a0, a1, S ? 1 : a1]);
    else {
      if (N) parts.push([a0, 0, a1, a0]);
      if (W) parts.push([0, a0, a0, a1]);
      parts.push(['c']);
      if (E) parts.push([a1, a0, 1, a1]);
      if (S) parts.push([a0, a1, a1, 1]);
    }
    for (const p of parts) {
      if (p[0] === 'c') {
        seg(a0 - 0.04, a0 - 0.04, a1 + 0.04, a1 + 0.04, hz + 3);
        merlons(a0 - 0.04, a0 - 0.04, a1 + 0.04, a0 + 0.06, hz + 3);
        box(c, a0 - 0.04, a0 + 0.06, a0 + 0.06, a1 + 0.04, hz + 3, hz + 8, '#8e897e', { left: '#a39e93', right: '#77736b', top: o.snow ? '#f2f5f9' : '#bdb8ad' });
        box(c, a1 - 0.06, a0 + 0.06, a1 + 0.04, a1 + 0.04, hz + 3, hz + 8, '#8e897e', { left: '#a39e93', right: '#77736b', top: o.snow ? '#f2f5f9' : '#bdb8ad' });
        box(c, a0 + 0.06, a1 - 0.06, a1 - 0.06, a1 + 0.04, hz + 3, hz + 8, '#8e897e', { left: '#a39e93', right: '#77736b', top: o.snow ? '#f2f5f9' : '#bdb8ad' });
        continue;
      }
      const [u0, v0, u1, v1] = p;
      seg(u0, v0, u1, v1, hz);
      const alongU = (u1 - u0) >= (v1 - v0);
      if (alongU) { merlons(u0, v0, u1, v0 + 0.08, hz); merlons(u0, v1 - 0.08, u1, v1, hz); }
      else { merlons(u0, v0, u0 + 0.08, v1, hz); merlons(u1 - 0.08, v0, u1, v1, hz); }
    }
  };
  B.gate = (c, o) => {
    const m = o.mask || 0;
    const alongV = (m & 5) && !(m & 10);
    const H = 40;
    ao(c, 0.1, 0.3, 0.9, 0.7, 0.7);
    if (!alongV) {
      // 담장이 x 방향: 문짝은 왼쪽 앞면을 본다
      box(c, 0.08, 0.36, 0.92, 0.64, 0, 2, PAL.stone, { top: PAL.stoneLight });
      post(c, 0.13, 0.5, 2, H + 6, 0.055, PAL.red, { top: PAL.redDark });
      onL(c, 0.18, 0.5, 2, () => {
        const L = 0.64 * 32;
        plankDoor(c, 0, -H + 7, L, H - 7, '#6a3420', true);
        rr(c, PAL.woodDark, 0, -H + 3, L, 4);
        dancheong(c, 0, -H + 2.6, L, 2.6);
      });
      post(c, 0.87, 0.5, 2, H + 6, 0.055, PAL.red, { top: PAL.redDark });
      tileRoof(c, { u0: 0.08, v0: 0.36, u1: 0.92, v1: 0.64, e: 0.14, zE: H + 4, zR: 55, form: 'paljak', gable: 0.55, lift: 5, liftR: 0.5, trim: true, snow: o.snow, step: 0.09, seed: 41 });
    } else {
      box(c, 0.36, 0.08, 0.64, 0.92, 0, 2, PAL.stone, { top: PAL.stoneLight });
      post(c, 0.5, 0.13, 2, H + 6, 0.055, PAL.red, { top: PAL.redDark });
      onR(c, 0.5, 0.82, 2, () => {
        const L = 0.64 * 32;
        plankDoor(c, 0, -H + 7, L, H - 7, '#5a2c1a', true);
        rr(c, 'rgba(18,11,6,0.2)', 0, -H + 7, L, H - 7);
        rr(c, PAL.woodDark, 0, -H + 3, L, 4);
        dancheong(c, 0, -H + 2.6, L, 2.6);
      });
      post(c, 0.5, 0.87, 2, H + 6, 0.055, PAL.red, { top: PAL.redDark });
      tileRoof(c, { u0: 0.36, v0: 0.08, u1: 0.64, v1: 0.92, e: 0.14, zE: H + 4, zR: 55, form: 'paljak', gable: 0.55, lift: 5, liftR: 0.5, trim: true, snow: o.snow, axis: 'v', step: 0.09, seed: 41 });
    }
  };

  // ── 갈래 건물 (docs/jianghu.md §8.4) ──
  // 계열 빛깔을 바랜 단청으로 쓴다: 정파 쪽빛, 마교 검붉은 돌, 세가 초록 문, 흑도 먹빛, 사파 붉은 옻, 새외 황토, 관 금빛
  // 낮은 담장: 아래는 돌, 위는 회벽, 꼭대기에 기와 갓
  function capWall(c, u0, v0, u1, v1, H, o) {
    const alongU = (u1 - u0) >= (v1 - v0);
    box(c, u0, v0, u1, v1, 0, H, PAL.plaster, { right: PAL.plasterShade, top: '#d8ccb0' });
    const face = len => {
      const hs = H * 0.42;
      rr(c, PAL.stone, 0, -hs, len, hs);
      stoneCourses(c, len, hs, o.rnd, { rowH: 2.4, blk: 4, blkVar: 4 });
      rr(c, 'rgba(60,40,20,0.06)', 0, -H, len, H - hs);
    };
    onL(c, u0, v1, 0, () => face((u1 - u0) * 32));
    onR(c, u1, v1, 0, () => { face((v1 - v0) * 32); rr(c, 'rgba(15,10,6,0.16)', 0, -H, (v1 - v0) * 32, H); });
    tileRoof(c, { u0, v0, u1, v1, e: 0.07, zE: H + 0.5, zR: H + 5.5, form: 'matbae', axis: alongU ? 'u' : 'v', lift: 1, snow: o.snow, orn: false, step: 0.075, zW: H, seed: 43 });
  }
  // 초승달 (화면에 똑바로 선 원판). dir 1 이면 오른쪽이 이지러진다
  function crescent(c, x, y, r, col, dir) {
    const d = r * 0.62, t0 = Math.acos(d / 2 / r);
    c.save(); c.translate(x, y); c.scale(dir, 1);
    c.fillStyle = col;
    c.beginPath(); c.arc(0, 0, r, t0, Math.PI * 2 - t0); c.arc(d, 0, r, Math.PI + t0, Math.PI - t0, true); c.closePath(); c.fill();
    c.restore();
  }
  // 뾰족 천막 (네모뿔): 둘레 천 z0..zw, 지붕 zw..zt
  function tent(c, u, v, r, z0, zw, zt, col, o) {
    const q = r + 0.05, lt = shade(col, 0.1), dk = shade(col, -0.3);
    fill3(c, shade(col, -0.45), [[u - q, v - q, zw], [u + q, v - q, zw], [u, v, zt]]);
    fill3(c, shade(col, -0.2), [[u - q, v - q, zw], [u - q, v + q, zw], [u, v, zt]]);
    box(c, u - r, v - r, u + r, v + r, z0, zw, col, { right: dk, noTop: true });
    onL(c, u - r, v + r, z0, () => { const L = r * 64; rr(c, '#14100e', L * 0.36, -(zw - z0) + 1, L * 0.28, zw - z0 - 1); rr(c, 'rgba(255,220,160,0.25)', L * 0.36, -1.2, L * 0.28, 1.2); });
    fill3(c, lt, [[u - q, v + q, zw], [u + q, v + q, zw], [u, v, zt]]);
    fill3(c, dk, [[u + q, v + q, zw], [u + q, v - q, zw], [u, v, zt]]);
    if (o.snow) {
      fill3(c, '#eef2f7', [[lerp(u, u - q, 0.55), lerp(v, v + q, 0.55), lerp(zt, zw, 0.55)], [lerp(u, u + q, 0.55), lerp(v, v + q, 0.55), lerp(zt, zw, 0.55)], [u, v, zt]]);
      fill3(c, '#c8d2de', [[lerp(u, u + q, 0.55), lerp(v, v + q, 0.55), lerp(zt, zw, 0.55)], [lerp(u, u + q, 0.55), lerp(v, v - q, 0.55), lerp(zt, zw, 0.55)], [u, v, zt]]);
    }
    seg3(c, 'rgba(0,0,0,0.35)', 0.5, [u + q, v + q, zw], [u, v, zt]);
    seg3(c, shade(col, -0.5), 0.9, [u - q, v + q, zw], [u + q, v + q, zw]);
    seg3(c, shade(col, -0.6), 0.9, [u + q, v + q, zw], [u + q, v - q, zw]);
    post(c, u, v, zt - 1, zt + 4, 0.012, '#2a1a10');
  }
  // 둥근 펠트 천막(게르): 벽, 원뿔 지붕, 앞쪽 붉은 문
  function yurt(c, u, v, R, Hw, Ht, o) {
    const x = X(u, v), rx = R * 45.25, ry = R * 22.63;
    ell(c, 'rgba(22,15,8,0.22)', x + 3, Y(u, v, 0) + 2, rx * 1.12, ry * 1.12);
    cylV(c, u, v, R, 1.2, Hw, '#d9ccb0', null);
    const yb = Y(u, v, Hw * 0.55);
    c.strokeStyle = '#a8602e'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, yb, rx, ry, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = 'rgba(70,44,24,0.45)'; c.lineWidth = 0.5;
    c.beginPath(); c.ellipse(x, yb - 1.6, rx, ry, 0, 0, Math.PI); c.stroke();
    c.beginPath(); c.ellipse(x, yb + 1.6, rx, ry, 0, 0, Math.PI); c.stroke();
    // 문: 왼쪽 앞(+v)을 본다
    onL(c, u - 0.12, v + R, 1.2, () => {
      rr(c, '#3a2414', -0.9, -11.6, 9.4, 11.6); rr(c, '#b8432a', 0, -10.8, 7.6, 10.8);
      rr(c, '#d6a63a', 0, -10.8, 7.6, 0.8); rr(c, '#d6a63a', 3.4, -10, 0.8, 10);
      c.strokeStyle = '#e2b84a'; c.lineWidth = 0.5; c.strokeRect(1.2, -9.2, 5.2, 7.6);
    });
    const y0 = Y(u, v, Hw), yt = Y(u, v, Ht), Rx = rx * 1.1, Ry = ry * 1.1;
    const g = c.createLinearGradient(x - Rx, 0, x + Rx, 0);
    g.addColorStop(0, o.snow ? '#f4f7fa' : '#efe4cc'); g.addColorStop(0.45, o.snow ? '#e6ecf2' : '#ddd0b4'); g.addColorStop(1, o.snow ? '#b8c4d2' : '#a49474');
    c.fillStyle = g; c.beginPath(); c.moveTo(x - Rx, y0); c.ellipse(x, y0, Rx, Ry, 0, Math.PI, 0, true); c.lineTo(x, yt); c.closePath(); c.fill();
    c.strokeStyle = o.snow ? 'rgba(120,140,170,0.35)' : 'rgba(110,80,44,0.35)'; c.lineWidth = 0.5;
    for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12; c.beginPath(); c.moveTo(x, yt + 2); c.lineTo(x + Math.cos(a) * Rx, y0 + Math.sin(a) * Ry); c.stroke(); }
    if (!o.snow) { c.strokeStyle = '#a8602e'; c.lineWidth = 1.8; c.beginPath(); c.ellipse(x, y0 - 0.6, Rx * 0.97, Ry * 0.97, 0, 0.05, Math.PI - 0.05); c.stroke(); }
    c.strokeStyle = '#5a3a20'; c.lineWidth = 0.7; c.beginPath(); c.ellipse(x, y0 + 0.4, Rx, Ry, 0, 0, Math.PI); c.stroke();
    // 천창과 연기 구멍
    ell(c, '#6a4a2a', x, yt + 2.4, rx * 0.2, ry * 0.2);
    ell(c, '#2a1a10', x, yt + 2.1, rx * 0.13, ry * 0.12);
  }
  // 말 (옆모습). dir 1 이면 오른쪽을 본다
  function horse(c, u, v, z, col, dir, mane) {
    const x = X(u, v), y = Y(u, v, z);
    ell(c, 'rgba(0,0,0,0.25)', x, y + 0.5, 12, 3);
    c.save(); c.translate(x, y); c.scale(dir * 1.25, 1.25);
    const dk = shade(col, -0.3), lt = shade(col, 0.2), mn = mane || shade(col, -0.55);
    rr(c, dk, -6.4, -9.5, 1.5, 9.5); rr(c, dk, 3.6, -9.5, 1.5, 9.5);
    c.strokeStyle = mn; c.lineWidth = 1.7; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-7.6, -13.2); c.quadraticCurveTo(-10.4, -10.4, -9.6, -5.2); c.stroke();
    ell(c, col, -0.6, -12.6, 8.2, 4.3);
    ell(c, lt, -1.8, -14.4, 5.2, 1.6);
    c.fillStyle = col;
    c.beginPath(); c.moveTo(3.6, -15.8); c.lineTo(7.6, -22.6); c.lineTo(10.4, -21.6); c.lineTo(8.6, -12.8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7.4, -23.6); c.lineTo(12.8, -19.6); c.lineTo(11.8, -17.6); c.lineTo(8, -19.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(7.9, -23.2); c.lineTo(8.5, -25.6); c.lineTo(9.4, -23.2); c.closePath(); c.fill();
    c.strokeStyle = mn; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(7.4, -23.2); c.lineTo(3.6, -15.6); c.stroke();
    c.lineCap = 'butt';
    circ(c, '#120c08', 10, -20.8, 0.5);
    rr(c, col, -5, -9.5, 1.7, 9.5); rr(c, col, 5.2, -9.5, 1.7, 9.5);
    for (const lx of [-6.4, 3.6, -5, 5.2]) rr(c, '#1e1712', lx, -1.2, 1.7, 1.2);
    c.restore();
  }
  // 울타리 한 변: 말뚝과 가로대 둘
  function fence(c, a, b, z0 = 1.2) {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.3));
    for (const z of [6.5, 11.5]) {
      seg3(c, '#4a2e1a', 1.4, [a[0], a[1], z0 + z], [b[0], b[1], z0 + z]);
      seg3(c, '#9a7044', 0.5, [a[0], a[1], z0 + z + 0.5], [b[0], b[1], z0 + z + 0.5]);
    }
    for (let i = 0; i <= n; i++) post(c, lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), z0, z0 + 14, 0.022, '#5a3a20', { top: '#8a6a42' });
  }
  // 북: 받침에 올린 큰 북. 북면이 왼쪽 앞(+v)을 본다
  function drum(c, u, v, z, r, snow) {
    const dz = z + r + 6;
    seg3(c, '#3a2414', 1.4, [u - 0.16, v - 0.1, z], [u + 0.04, v - 0.1, dz]);
    seg3(c, '#3a2414', 1.4, [u + 0.18, v - 0.1, z], [u - 0.02, v - 0.1, dz]);
    for (let k = 0; k <= 7; k++) onL(c, u, v - 0.1 + k * 0.03, dz, () => circ(c, shade('#8a2a20', -0.25 + k * 0.035), 0, 0, r));
    onL(c, u, v + 0.12, dz, () => {
      circ(c, '#6a1c16', 0, 0, r); circ(c, '#e6d6b2', 0, 0, r - 1.1); circ(c, 'rgba(160,120,70,0.35)', 0, 0, r * 0.42);
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; circ(c, '#d8a944', Math.cos(a) * (r - 0.55), Math.sin(a) * (r - 0.55), 0.35); }
      if (snow) { c.fillStyle = 'rgba(244,247,250,0.9)'; c.beginPath(); c.arc(0, 0, r, Math.PI * 1.1, Math.PI * 1.9); c.fill(); }
    });
    seg3(c, '#4a2e1a', 1.5, [u - 0.16, v + 0.16, z], [u + 0.02, v + 0.14, dz - 2]);
    seg3(c, '#4a2e1a', 1.5, [u + 0.2, v + 0.16, z], [u + 0.02, v + 0.14, dz - 2]);
  }
  // 돌짐승 (관아 계단 옆)
  function stoneBeast(c, u, v, z, dir, snow) {
    box(c, u - 0.08, v - 0.08, u + 0.08, v + 0.08, z, z + 3.5, PAL.stone, { top: PAL.stoneLight });
    const x = X(u, v), y = Y(u, v, z + 3.5);
    c.save(); c.translate(x, y); c.scale(dir, 1);
    ell(c, '#8a857a', -0.5, -4.2, 3.6, 4.2);
    ell(c, '#a8a397', 1.4, -8.6, 2.9, 2.7);
    ell(c, '#7a756a', -0.2, -9.6, 2.2, 2.6);
    rr(c, '#6e6a62', 1.6, -3.4, 1.6, 3.4); rr(c, '#8a857a', -3.2, -2.2, 2.4, 2.2);
    circ(c, '#4a4640', 2.8, -8.8, 0.45);
    if (snow) ell(c, '#f2f5f9', 0.6, -11.2, 2.6, 0.9);
    c.restore();
  }

  // 의협당: 높은 돌 기단 위 중층 전각. 쪽빛 기둥, 아래층 우진각 지붕 위로 위층이 솟고, 앞마당에 義 깃발 둘
  B.hall_jeong = (c, o) => {
    const PL = '#3e5a7a', BM = '#1f3550', MD = '#2e4a6a';
    ao(c, 0, 0, 3, 3, 1.2);
    box(c, 0.03, 1.9, 2.97, 2.97, 0, 1.2, '#958f82', { top: o.snow ? '#e4e9ee' : '#b3ad9e' });
    if (!o.snow) onTop(c, 0.03, 1.9, 1.2, () => {
      c.strokeStyle = 'rgba(70,64,54,0.32)'; c.lineWidth = 0.45;
      for (let a = 5; a < 94; a += 7.3) { c.beginPath(); c.moveTo(a, 0); c.lineTo(a, 34); c.stroke(); }
      for (let b = 5; b < 34; b += 6.2) { c.beginPath(); c.moveTo(0, b); c.lineTo(94, b); c.stroke(); }
    });
    plinth(c, 0.06, 0.04, 2.94, 1.9, 0, 10, o);
    steps(c, 1.12, 1.88, 1.9, 2.3, 1.2, 10, 4);
    const u0 = 0.24, v0 = 0.2, u1 = 2.76, v1 = 1.72, z0 = 10, H = 26, e = 0.26;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 5, items: ['win', 'lat', 'door', 'lat', 'win'], pillar: PL, beam: BM, mid: MD, hid: 16 * e + 5, rnd: o.rnd, winW: 9,
    }, { bays: 3, items: ['win', 'lat', 'win'] });
    const zAt = tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 64, form: 'hip', lift: 6, liftR: 0.9, trim: true, snow: o.snow, orn: false, seed: 47 });
    const U0 = 0.56, V0 = 0.5, U1 = 2.44, V1 = 1.42, Z1 = Math.round(zAt(1.5, V1) - 1.5), H2 = 27;
    walls(c, U0, V0, U1, V1, Z1, H2, {
      bays: 4, items: ['win', 'wall', 'wall', 'win'], pillar: PL, beam: BM, mid: MD, dan: true, hid: 16 * 0.3 + 6, winW: 8, winH: 6, rnd: o.rnd,
      sign: '義俠堂', signW: 26, signH: 8.5, signOpt: { frame: BM },
    }, { bays: 2, items: ['win', 'win'] });
    tileRoof(c, { u0: U0, v0: V0, u1: U1, v1: V1, e: 0.3, zE: Z1 + H2 - 1, zR: Z1 + H2 + 34, form: 'paljak', gable: 0.42, lift: 8, liftR: 1.0, trim: true, snow: o.snow, seed: 53 });
    stoneLantern(c, 0.62, 2.55, 1.2, o.snow);
    stoneLantern(c, 2.38, 2.55, 1.2, o.snow);
    banner(c, 0.2, 2.8, 64, 8.5, 26, '#3e5f8a', '義', 'L', '#f2ead2');
    banner(c, 2.8, 2.8, 64, 8.5, 26, '#3e5f8a', '義', 'L', '#f2ead2');
  };

  // 혈제단: 검붉은 돌을 세 층으로 쌓은 단. 꼭대기에 불이 이는 세발솥, 양옆 돌기둥에 붉은 초승달
  B.altar_ma = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 2, 2, 1.1);
    const drip = (len, H) => {
      for (let i = 0; i < len / 6; i++) { const x = 1 + rnd() * (len - 2), l = 1.2 + rnd() * H * 0.7; rr(c, 'rgba(112,16,24,0.5)', x, -H + 0.5, 0.6 + rnd() * 0.7, l); }
    };
    const tier = (a, b, z0, z1, col) => {
      plinth(c, a, a, b, b, z0, z1, Object.assign({}, o, { col, rowH: 3, blk: 6 }));
      onL(c, a, b, z0, () => drip((b - a) * 32, z1 - z0));
      onR(c, b, b, z0, () => drip((b - a) * 32, z1 - z0));
    };
    tier(0.04, 1.96, 0, 6, '#6e6469');
    tier(0.3, 1.7, 6, 12, '#625a60');
    steps(c, 0.8, 1.2, 1.7, 1.96, 6, 12, 2, '#6e6469');
    tier(0.56, 1.44, 12, 18, '#564e54');
    steps(c, 0.84, 1.16, 1.44, 1.7, 12, 18, 2, '#625a60');
    if (!o.snow) onTop(c, 0.56, 0.56, 18, () => { c.fillStyle = 'rgba(100,14,20,0.45)'; c.beginPath(); c.ellipse(14, 14, 11, 9, 0.3, 0, Math.PI * 2); c.fill(); });
    // 돌기둥과 붉은 달
    const moon = (u, v, dir) => {
      box(c, u - 0.085, v - 0.085, u + 0.085, v + 0.085, 6, 9, '#4a4248', { top: o.snow ? '#eef2f7' : '#5e565c' });
      box(c, u - 0.055, v - 0.055, u + 0.055, v + 0.055, 9, 54, '#3a3238', { top: '#4e464c' });
      onL(c, u - 0.055, v + 0.055, 52, () => {
        c.fillStyle = '#8e1e26';
        c.beginPath(); c.moveTo(0.4, 0); c.lineTo(3.2, 0); c.lineTo(2.9, 21); c.lineTo(1.8, 18.5); c.lineTo(0.6, 22); c.closePath(); c.fill();
        rr(c, 'rgba(0,0,0,0.2)', 2.2, 0, 1, 20);
      });
      const x = X(u, v), y = Y(u, v, 61.5), r = 5.6;
      line(c, '#3a3238', 1.1, x, Y(u, v, 54), x, y + r - 1);
      c.save(); c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(x, y, 1, x, y, 14);
      g.addColorStop(0, 'rgba(255,70,60,0.42)'); g.addColorStop(1, 'rgba(255,40,40,0)');
      c.fillStyle = g; c.fillRect(x - 15, y - 15, 30, 30);
      c.restore();
      circ(c, 'rgba(80,16,20,0.6)', x, y, r);
      crescent(c, x, y, r, '#c8323a', dir);
      if (o.snow) ell(c, '#eef2f7', x, Y(u, v, 54) - 0.4, 2.2, 0.8);
    };
    moon(0.17, 1.83, -1);
    moon(1.83, 0.17, 1);
    // 세발솥
    const cu = 1, cv = 1, fx = X(cu, cv), fy = Y(cu, cv, 29);
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(fx, fy - 6, 1, fx, fy - 6, 24);
    g.addColorStop(0, 'rgba(255,80,50,0.4)'); g.addColorStop(1, 'rgba(255,40,30,0)');
    c.fillStyle = g; c.fillRect(fx - 26, fy - 30, 52, 52);
    c.restore();
    for (const [du, dv] of [[-0.13, 0.06], [0.06, -0.13], [0.1, 0.1]]) post(c, cu + du, cv + dv, 18, 22, 0.02, '#3a2c1a');
    cylV(c, cu, cv, 0.21, 21, 29, '#5e4c2a', '#2a1208', { rim: '#9a7e44' });
    onL(c, cu - 0.15, cv + 0.15, 21, () => { c.strokeStyle = 'rgba(30,20,10,0.5)'; c.lineWidth = 0.5; for (const y of [-2.4, -5.6]) { c.beginPath(); c.moveTo(0, y); c.lineTo(9.6, y); c.stroke(); } });
    c.strokeStyle = '#5e4c2a'; c.lineWidth = 1.3;
    for (const s of [-1, 1]) { c.beginPath(); c.arc(fx + s * 8.6, fy - 1.8, 1.8, Math.PI, Math.PI * 2); c.stroke(); }
    ell(c, '#6a120c', fx, fy, 7.6, 3.4);
    for (const [dx, h, w] of [[-4.2, 7, 2], [0, 11.5, 2.8], [4, 8, 2.1], [-1.9, 5, 1.5], [2.3, 6, 1.5]]) {
      c.fillStyle = h > 9 ? '#e8452a' : '#c8322a';
      c.beginPath(); c.moveTo(fx + dx - w, fy); c.quadraticCurveTo(fx + dx - w * 0.6, fy - h * 0.6, fx + dx, fy - h); c.quadraticCurveTo(fx + dx + w * 0.6, fy - h * 0.6, fx + dx + w, fy); c.closePath(); c.fill();
      c.fillStyle = '#ffb04a';
      c.beginPath(); c.moveTo(fx + dx - w * 0.45, fy); c.quadraticCurveTo(fx + dx, fy - h * 0.45, fx + dx, fy - h * 0.55); c.quadraticCurveTo(fx + dx, fy - h * 0.45, fx + dx + w * 0.45, fy); c.closePath(); c.fill();
    }
    // 앞 비석과 붉은 초
    box(c, 0.3, 1.76, 0.52, 1.86, 6, 25, '#2e282c', { top: o.snow ? '#eef2f7' : '#4a4448' });
    onL(c, 0.3, 1.86, 6, () => faceSign(c, 3.5, -17.6, 5.4, 15.2, '血祭壇', { vertical: true, bg: '#221c20', fg: '#d0343c', frame: '#3a3236' }));
    for (const [u, v, h] of [[1.5, 1.8, 5], [1.63, 1.84, 4], [1.43, 1.89, 3.4]]) {
      post(c, u, v, 6, 6 + h, 0.018, '#a82a2a', { top: '#e8d8c0' });
      const x = X(u, v), y = Y(u, v, 6 + h);
      ell(c, '#ffb040', x, y - 1.6, 0.8, 1.6); ell(c, '#fff0b0', x, y - 1.3, 0.35, 0.8);
    }
  };

  // 종가: 담장을 두른 집안. 솟을대문에 宗家 현판, 안쪽 사당채는 초록 문, 마당에 장독과 늙은 소나무
  B.ancestral = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 3, 3, 1);
    box(c, 0.03, 0.03, 2.97, 2.97, 0, 1, '#8a7a5e', { top: o.snow ? '#e4e9ee' : '#b4a585' });
    if (!o.snow) onTop(c, 0.03, 0.03, 1, () => { for (let i = 0; i < 120; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(120,100,70,0.35)' : 'rgba(235,222,190,0.3)'; c.fillRect(rnd() * 94, rnd() * 94, 1.3, 0.6); } });
    const WH = 15;
    capWall(c, 0.06, 0.06, 2.94, 0.17, WH, o);
    capWall(c, 0.06, 0.17, 0.17, 2.83, WH, o);
    plinth(c, 0.36, 0.3, 2.64, 1.62, 0, 7, o);
    steps(c, 1.2, 1.8, 1.62, 1.88, 0, 7, 3);
    const u0 = 0.48, v0 = 0.4, u1 = 2.52, v1 = 1.5, z0 = 7, H = 26;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 4, items: ['win', 'red', 'red', 'win'], pillar: '#6a3a24', beam: '#2e1c10', mid: '#5a3220', dan: true, hid: 16 * 0.26 + 6.6, rnd: o.rnd, winW: 9, doorCol: '#2f5a3a',
    }, { bays: 2, items: ['wall', 'win'] });
    tileRoof(c, { u0, v0, u1, v1, e: 0.26, zE: z0 + H - 1, zR: 72, form: 'paljak', gable: 0.5, lift: 7, trim: true, snow: o.snow, seed: 59 });
    // 장독대
    box(c, 0.32, 2.0, 0.92, 2.42, 1, 3, PAL.stone, { top: o.snow ? '#eef2f7' : PAL.stoneLight });
    for (const [u, v, s] of [[0.45, 2.12, 0.8], [0.68, 2.1, 0.9], [0.52, 2.32, 0.62], [0.78, 2.3, 0.7]]) jar(c, u, v, s, 3);
    if (o.snow) for (const [u, v] of [[0.45, 2.12], [0.68, 2.1]]) ell(c, '#f2f5f9', X(u, v), Y(u, v, 3) - 6.6, 2.2, 0.8);
    // 늙은 소나무
    c.save(); c.translate(X(2.42, 2.12), Y(2.42, 2.12, 1)); c.scale(0.95, 0.95);
    ell(c, 'rgba(0,0,0,0.24)', 2, 0, 12, 4.8);
    pine(c, rnd, 4, o.snow);
    c.restore();
    // 오른쪽·앞 담과 솟을대문
    capWall(c, 2.83, 0.17, 2.94, 2.83, WH, o);
    capWall(c, 0.06, 2.83, 1.1, 2.94, WH, o);
    const g0 = 1.1, g1 = 1.9, gv0 = 2.78, gv1 = 2.97, gz = 30;
    box(c, g0, gv0, g1, gv1, 0, 1.6, PAL.stone, { top: o.snow ? '#eef2f7' : PAL.stoneLight });
    post(c, g0 + 0.05, gv1 - 0.06, 1.6, gz, 0.045, '#6a3a24', { top: '#3a2414' });
    onL(c, g0 + 0.1, gv1 - 0.06, 1.6, () => {
      const L = (g1 - g0 - 0.2) * 32;
      plankDoor(c, 0, -gz + 10.6, L, gz - 10.6, '#4a2c18', true);
      rr(c, PAL.woodDark, 0, -gz + 1.6, L, 9);
      faceSign(c, L / 2, -gz + 2.4, 17, 7, '宗家', { frame: '#2e1c10' });
    });
    post(c, g1 - 0.05, gv1 - 0.06, 1.6, gz, 0.045, '#6a3a24', { top: '#3a2414' });
    tileRoof(c, { u0: g0, v0: gv0, u1: g1, v1: gv1, e: 0.13, zE: gz, zR: gz + 12, form: 'matbae', lift: 3, snow: o.snow, seed: 61, step: 0.08, zW: gz });
    capWall(c, 1.9, 2.83, 2.94, 2.94, WH, o);
  };

  // 흑시: 검은 휘장을 드리운 헛간과 뾰족 천막, 흐린 등롱 줄. 暗 깃발
  const ROOF_SOOT = { 'v+': '#4a4038', 'u-': '#3e352e', 'u+': '#2e2722', 'v-': '#262019', cap: '#1e1914', capHi: '#5e5246', fascia: '#16120e', tileEnd: null, groove: 'rgba(10,8,6,0.5)', hi: 'rgba(255,226,180,0.08)', gable: '#4a3e32' };
  B.blackmarket = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 3, 2, 0.7);
    box(c, 0.03, 0.03, 2.97, 1.97, 0, 1.2, '#5a4e42', { top: o.snow ? '#d6dce2' : '#6e6050' });
    if (!o.snow) onTop(c, 0.03, 0.03, 1.2, () => { for (let i = 0; i < 90; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(40,30,22,0.35)' : 'rgba(170,150,120,0.22)'; c.fillRect(rnd() * 94, rnd() * 62, 1.3, 0.6); } });
    const u0 = 0.1, v0 = 0.1, u1 = 2.9, v1 = 0.82, zE = 29;
    onL(c, u0, v0 + 0.03, 1.2, () => {
      const L = (u1 - u0) * 32;
      rr(c, '#3e3026', 0, -zE + 1, L, zE - 1);
      c.fillStyle = 'rgba(0,0,0,0.3)'; for (let x = 2.4; x < L; x += 2.4) c.fillRect(x, -zE + 1, 0.4, zE - 1);
      rr(c, 'rgba(0,0,0,0.3)', 0, -zE + 1, L, zE - 1);
    });
    onR(c, u0 + 0.03, v1, 1.2, () => { const L = (v1 - v0) * 32; rr(c, '#33281f', 0, -zE + 1, L, zE - 1); rr(c, 'rgba(0,0,0,0.3)', 0, -zE + 1, L, zE - 1); });
    for (const u of [u0 + 0.03, 1.5, u1 - 0.03]) post(c, u, v0 + 0.03, 1.2, zE, 0.03, '#2e241c');
    box(c, 0.2, 0.15, 2.8, 0.32, 1.2, 12, '#4a3626', { top: '#5e4632' });
    for (let k = 0; k < 9; k++) { const u = 0.34 + k * 0.28; if (k % 3 === 1) crate(c, u, 0.24, 0.12, 12); else jar(c, u, 0.24, 0.5 + (k % 2) * 0.12, 12); }
    for (const u of [0.5, 1.1, 2.0, 2.5]) sack(c, u, 0.5, 1.2);
    for (const u of [u0 + 0.03, 1.5, u1 - 0.03]) post(c, u, v1 - 0.03, 1.2, zE, 0.03, '#2e241c');
    // 휘장: 반쯤 걷어 묶은 검은 천
    onL(c, u0, v1, zE - 1, () => {
      const L = (u1 - u0) * 32;
      for (const [a, b] of [[0.01, 0.2], [0.3, 0.47], [0.53, 0.7], [0.8, 0.99]]) {
        const x0 = a * L, x1 = b * L, xm = (x0 + x1) / 2;
        c.fillStyle = '#26222e';
        c.beginPath(); c.moveTo(x0, 0); c.lineTo(x1, 0); c.quadraticCurveTo(x1 - 1, 9, xm + 1.4, 13); c.lineTo(xm + 1.6, 19); c.lineTo(xm - 1.6, 19); c.lineTo(xm - 1.4, 13); c.quadraticCurveTo(x0 + 1, 9, x0, 0); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(120,110,150,0.25)'; c.lineWidth = 0.5;
        for (const t of [0.3, 0.6]) { c.beginPath(); c.moveTo(lerp(x0, x1, t), 0); c.lineTo(xm + (t - 0.45) * 2, 12.5); c.stroke(); }
        rr(c, '#8a2a20', xm - 2, 12, 4, 1.2);
      }
    });
    tileRoof(c, { u0, v0, u1, v1, e: 0.16, zE, zR: 44, form: 'matbae', pal: ROOF_SOOT, lift: 2, snow: o.snow, orn: false, step: 0.16, zW: zE, seed: 73 });
    onL(c, 1.5 - 12 / 32, v1 + 0.16, zE - 3.5, () => {
      rr(c, '#1a120c', 3, -1.6, 0.6, 1.8); rr(c, '#1a120c', 20.4, -1.6, 0.6, 1.8);
      faceSign(c, 12, 0.4, 20, 7.5, '黑市', { bg: '#14100e', fg: '#c8a050', frame: '#3a2a20' });
    });
    tent(c, 0.62, 1.36, 0.3, 1.2, 9, 27, '#3a3442', o);
    // 돗자리 위 물건
    fill3(c, '#5e4a30', [[1.08, 1.18, 1.3], [1.86, 1.18, 1.3], [1.86, 1.76, 1.3], [1.08, 1.76, 1.3]]);
    onTop(c, 1.08, 1.18, 1.3, () => { c.strokeStyle = 'rgba(30,20,10,0.4)'; c.lineWidth = 0.4; for (let a = 2; a < 25; a += 2.2) { c.beginPath(); c.moveTo(a, 0); c.lineTo(a, 18.5); c.stroke(); } });
    jar(c, 1.25, 1.35, 0.5, 1.3); crate(c, 1.6, 1.32, 0.13, 1.3); sack(c, 1.3, 1.62, 1.3);
    for (const [u, v] of [[1.55, 1.58], [1.7, 1.55]]) seg3(c, '#c9d0d6', 0.9, [u - 0.12, v + 0.04, 1.6], [u + 0.12, v - 0.04, 1.6]);
    tent(c, 2.32, 1.38, 0.32, 1.2, 9, 29, '#4a3428', o);
    // 등롱 줄
    post(c, 2.9, 1.9, 1.2, 31, 0.022, '#2e241c', { top: '#1e1712' });
    const zr = t => lerp(33, 30, t) - 7 * 4 * t * (1 - t);
    for (let k = 0; k < 16; k++) seg3(c, 'rgba(30,20,12,0.85)', 0.5, [lerp(0.12, 2.9, k / 16), 1.9, zr(k / 16)], [lerp(0.12, 2.9, (k + 1) / 16), 1.9, zr((k + 1) / 16)]);
    for (const t of [0.24, 0.5, 0.76]) lanternAt(c, lerp(0.12, 2.9, t), 1.9, zr(t), 0.72);
    banner(c, 0.12, 1.9, 46, 7.5, 18, '#1c181c', '暗', 'L', '#c8323a');
  };

  // 도박장: 붉은 옻칠 기둥과 등롱이 늘어선 집. 용마루 위에 큰 엽전, 앞 장대에 賭 등롱
  B.gambling = (c, o) => {
    const e = 0.26;
    ao(c, 0, 0, 3, 2);
    plinth(c, 0.03, 0.03, 2.97, 1.97, 0, 5, Object.assign({}, o, { col: '#8a8276' }));
    const u0 = 0.14, v0 = 0.14, u1 = 2.86, v1 = 1.7, z0 = 5, H = 38, vw = 1.46;
    const den = (cc, x0, x1, top, vis) => {
      const cx = (x0 + x1) / 2;
      const g = cc.createRadialGradient(cx, top + vis * 0.55, 1, cx, top + vis * 0.55, vis);
      g.addColorStop(0, 'rgba(255,150,70,0.45)'); g.addColorStop(1, 'rgba(255,150,70,0)');
      cc.fillStyle = g; cc.fillRect(x0, top, x1 - x0, vis);
      for (const dx of [-4.6, 4.6]) { circ(cc, '#1a0f0a', cx + dx, -14.4, 1.9); rr(cc, '#1a0f0a', cx + dx - 2.6, -12.6, 5.2, 6.6); }
      rr(cc, '#7a2a1c', cx - 6, -8, 12, 1.8); rr(cc, '#3a1a10', cx - 5, -6.2, 1, 4); rr(cc, '#3a1a10', cx + 4, -6.2, 1, 4);
      rr(cc, '#f4ead6', cx - 1.8, -9.6, 1.6, 1.6); rr(cc, '#f4ead6', cx + 0.6, -9.4, 1.4, 1.4);
      circ(cc, '#1a0f0a', cx - 1, -8.8, 0.25); circ(cc, '#a01a14', cx + 1.3, -8.7, 0.25);
      circ(cc, '#d8a944', cx - 3.6, -8.6, 0.6); circ(cc, '#d8a944', cx + 3.4, -8.7, 0.6);
    };
    walls(c, u0, v0, u1, vw, z0, H, {
      bays: 5, items: ['win', 'open', 'red', 'open', 'win'], plaster: '#dccaa8', pillar: '#7a1e18', beam: '#3a0e0a', mid: '#6a1a14', dan: true,
      hid: 16 * (e + v1 - vw) + 4.2, rnd: o.rnd, openFn: den, winW: 9, doorCol: '#6a1a12', shade: 0.05,
    }, { bays: 2, items: ['win', 'wall'], hid: 16 * e + 4.2, shade: 0.22 });
    box(c, u0, vw, u1, v1, z0, z0 + 2.6, '#6a2e1e', { top: '#8a4a30', right: '#4a1e14' });
    onTop(c, u0, vw, z0 + 2.6, () => { c.fillStyle = 'rgba(60,20,10,0.45)'; for (let a = 4; a < (u1 - u0) * 32; a += 4.2) c.fillRect(a, 0, 0.4, (v1 - vw) * 32); });
    for (let i = 0; i <= 4; i++) post(c, lerp(u0 + 0.035, u1 - 0.035, i / 4), v1 - 0.035, z0, z0 + H, 0.035, '#8a2418', { top: '#5a120c' });
    const zR = 76;
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR, form: 'paljak', gable: 0.44, lift: 7, trim: true, snow: o.snow, seed: 67 });
    for (const u of [0.42, 0.92, 2.08, 2.58]) lanternAt(c, u, v1 + 0.16, z0 + H - 6, 0.8);
    // 賭坊 현판: 처마 끝에 건다
    onL(c, 1.5 - 14 / 32, v1 + e - 0.02, z0 + H - 5.6, () => {
      rr(c, '#2a0806', 5, -1.6, 0.6, 1.8); rr(c, '#2a0806', 22.4, -1.6, 0.6, 1.8);
      faceSign(c, 14, 0.4, 25, 9, '賭坊', { bg: '#5a120c', fg: '#f0c860', frame: '#2a0806' });
    });
    // 용마루 위 엽전 (용마루를 따라 선다)
    const vc = (v0 + v1) / 2, zc = zR + 12.5, r = 8.5;
    seg3(c, '#2a1a10', 1.4, [1.38, vc, zR + 2.4], [1.42, vc, zc - r + 1]); seg3(c, '#2a1a10', 1.4, [1.62, vc, zR + 2.4], [1.58, vc, zc - r + 1]);
    for (let k = 0; k <= 4; k++) onL(c, 1.5, vc - 0.03 + k * 0.015, zc, () => circ(c, shade('#a07a2a', -0.3 + k * 0.05), 0, 0, r));
    onL(c, 1.5, vc + 0.04, zc, () => {
      circ(c, '#8a6420', 0, 0, r); circ(c, '#d8ae4a', 0, 0, r - 1); circ(c, '#b88a30', 0, 0, r - 2.6); circ(c, '#d8ae4a', 0, 0, r - 3.2);
      rr(c, '#8a6420', -2.4, -2.4, 4.8, 4.8); rr(c, '#2a1a10', -1.7, -1.7, 3.4, 3.4);
      c.fillStyle = '#8a6420'; for (const [dx, dy] of [[0, -4.8], [0, 4.8], [-4.8, 0], [4.8, 0]]) c.fillRect(dx - 0.8, dy - 0.8, 1.6, 1.6);
      rr(c, 'rgba(255,240,190,0.5)', -r + 1.6, -1.2, 1, 2.4);
      if (o.snow) { c.fillStyle = 'rgba(244,247,250,0.9)'; c.beginPath(); c.arc(0, 0, r, Math.PI * 1.15, Math.PI * 1.85); c.fill(); }
    });
    // 賭 큰 등롱
    post(c, 0.1, 1.9, 5, 52, 0.022, PAL.woodDark);
    seg3(c, PAL.woodDark, 1.1, [0.1, 1.9, 50], [0.44, 1.9, 50]);
    const lx = X(0.38, 1.9), ly = Y(0.38, 1.9, 50);
    line(c, '#2a1a10', 0.6, lx, ly, lx, ly + 3);
    rr(c, '#2a1a10', lx - 3, ly + 2.6, 6, 1.4);
    ell(c, '#b8261c', lx, ly + 11.5, 6.8, 8.4);
    c.strokeStyle = 'rgba(70,10,8,0.5)'; c.lineWidth = 0.5;
    for (const k of [-0.6, 0, 0.6]) { c.beginPath(); c.ellipse(lx, ly + 11.5, Math.abs(k) * 6.8 + 0.01, 8.4, 0, 0, Math.PI * 2); c.stroke(); }
    ell(c, 'rgba(255,190,120,0.35)', lx - 2.2, ly + 9.5, 1.8, 4.2);
    rr(c, '#2a1a10', lx - 3, ly + 19.4, 6, 1.4);
    line(c, PAL.gold, 0.6, lx, ly + 20.8, lx, ly + 25);
    c.fillStyle = '#1a0806'; c.font = '8.5px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('賭', lx, ly + 11.8);
  };

  // 호시: 펠트 천막(게르)과 말 우리, 건초와 인삼 궤짝. 앞의 互市 현판 문과 互 깃발
  B.horsemarket = (c, o) => {
    const rnd = o.rnd;
    ao(c, 0, 0, 3, 3, 0.5);
    box(c, 0.03, 0.03, 2.97, 2.97, 0, 1.2, '#9a8462', { top: o.snow ? '#e2e7ec' : '#b49a72' });
    if (!o.snow) onTop(c, 0.03, 0.03, 1.2, () => {
      for (let i = 0; i < 160; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(110,86,52,0.35)' : 'rgba(236,220,180,0.3)'; c.fillRect(rnd() * 94, rnd() * 94, 1.3, 0.6); }
      c.fillStyle = 'rgba(96,120,52,0.5)';
      for (let i = 0; i < 26; i++) { const a = rnd() * 94, b = rnd() * 94; c.beginPath(); c.ellipse(a, b, 1.6, 1, 0, 0, Math.PI * 2); c.fill(); }
    });
    const f0 = 1.5, f1 = 2.9, g0 = 0.12, g1 = 2.25;
    fence(c, [f0, g0], [f1, g0]);
    fence(c, [f0, g0], [f0, g1]);
    yurt(c, 0.78, 0.8, 0.56, 14, 33, o);
    // 구유
    box(c, 2.5, 0.3, 2.78, 0.48, 1.2, 5, '#6b4428', { top: '#3a5a4a', edge: 'rgba(40,24,12,0.6)' });
    horse(c, 2.08, 0.72, 1.2, '#6e4428', -1);
    horse(c, 1.86, 1.62, 1.2, '#3a2a22', 1);
    horse(c, 2.5, 1.36, 1.2, '#d8d0c2', 1, '#8a8478');
    fence(c, [f0, g1], [f1, g1]);
    fence(c, [f1, g0], [f1, g1]);
    // 건초와 인삼 궤짝
    for (const [u, v] of [[0.36, 1.72], [0.62, 1.86], [0.4, 2.02]]) {
      cylV(c, u, v, 0.13, 1.2, 9.5, '#c9a85a', o.snow ? '#eef2f7' : '#e0c47f', { rim: '#8f6e36' });
      const x = X(u, v);
      c.strokeStyle = 'rgba(120,90,40,0.5)'; c.lineWidth = 0.4;
      for (const d of [-2.6, 0, 2.6]) { c.beginPath(); c.moveTo(x + d, Y(u, v, 2)); c.lineTo(x + d * 1.1, Y(u, v, 9)); c.stroke(); }
    }
    for (const [u, v, s, z] of [[1.0, 2.05, 0.15, 1.2], [1.22, 2.2, 0.13, 1.2], [1.0, 2.05, 0.12, 1.2 + 0.15 * 18]]) {
      crate(c, u, v, s, z);
      onL(c, u - s / 2, v + s / 2, z, () => rr(c, '#c0362a', s * 8, -s * 13, s * 16, s * 9));
    }
    // 互市 현판 문
    const pa = 1.02, pb = 1.78, pv = 2.8, ph = 32;
    post(c, pa, pv, 1.2, ph, 0.04, '#6b4428', { top: '#3b2414' });
    seg3(c, '#3b2414', 2.4, [pa - 0.12, pv, ph], [pb + 0.12, pv, ph]);
    seg3(c, '#8a6038', 0.7, [pa - 0.12, pv, ph + 1], [pb + 0.12, pv, ph + 1]);
    if (o.snow) seg3(c, '#eef2f7', 1.1, [pa - 0.1, pv, ph + 1.8], [pb + 0.1, pv, ph + 1.8]);
    onL(c, pa, pv, ph - 1.4, () => {
      const L = (pb - pa) * 32;
      line(c, '#2a1a10', 0.5, L / 2 - 7, 0, L / 2 - 7, 1.6); line(c, '#2a1a10', 0.5, L / 2 + 7, 0, L / 2 + 7, 1.6);
      faceSign(c, L / 2, 1.6, 19, 7.5, '互市', { bg: '#3a2414', fg: '#f0d890', frame: '#7a4a22' });
    });
    post(c, pb, pv, 1.2, ph, 0.04, '#6b4428', { top: '#3b2414' });
    triFlag(c, 0.18, 2.8, 50, '#b8743a', '互', { fg: '#2a1608' });
    triFlag(c, 2.82, 2.82, 40, '#8a5a2a', null, { len: 13, hgt: 9 });
  };

  // 관아: 홍살문 너머 박석 마당, 우진각 지붕의 동헌에 衙門 현판. 계단 옆 돌짐승, 오른쪽 앞에 등문고
  B.yamen = (c, o) => {
    const e = 0.3;
    ao(c, 0, 0, 3, 3, 1.1);
    box(c, 0.03, 0.03, 2.97, 2.97, 0, 1.2, '#958f82', { top: o.snow ? '#e4e9ee' : '#b8b2a3' });
    if (!o.snow) onTop(c, 0.03, 0.03, 1.2, () => {
      c.strokeStyle = 'rgba(70,64,54,0.3)'; c.lineWidth = 0.45;
      for (let a = 5; a < 94; a += 7.8) { c.beginPath(); c.moveTo(a, 52); c.lineTo(a, 94); c.stroke(); }
      for (let b = 54; b < 94; b += 6.6) { c.beginPath(); c.moveTo(0, b); c.lineTo(94, b); c.stroke(); }
      c.fillStyle = 'rgba(214,190,150,0.35)'; c.fillRect(37, 60, 20, 34);
    });
    plinth(c, 0.12, 0.1, 2.88, 1.74, 1.2, 9, o);
    steps(c, 1.15, 1.85, 1.74, 2.04, 1.2, 9, 3);
    const u0 = 0.28, v0 = 0.24, u1 = 2.72, v1 = 1.56, z0 = 9, H = 29;
    walls(c, u0, v0, u1, v1, z0, H, {
      bays: 5, items: ['win', 'lat', 'door', 'lat', 'win'], pillar: '#9c3226', beam: '#4a1a12', mid: '#7a2a20', dan: true, hid: 16 * e + 6.6, rnd: o.rnd, winW: 10,
      sign: '衙門', signW: 20, signH: 8.5, signOpt: { frame: '#9a7a22', bg: '#1e1810' },
    }, { bays: 3, items: ['win', 'lat', 'win'] });
    tileRoof(c, { u0, v0, u1, v1, e, zE: z0 + H - 1, zR: 80, form: 'hip', lift: 8, liftR: 1.0, trim: true, snow: o.snow, seed: 71 });
    stoneBeast(c, 0.98, 2.1, 1.2, 1, o.snow);
    stoneBeast(c, 2.02, 2.1, 1.2, -1, o.snow);
    drum(c, 2.5, 2.2, 1.2, 7, o.snow);
    // 홍살문: 붉은 두 기둥, 가로대 둘, 위로 솟은 붉은 살
    const ua = 0.52, ub = 2.48, gv = 2.78, gh = 46;
    post(c, ua, gv, 1.2, gh + 7, 0.042, '#a8302a', { top: '#5a1612' });
    seg3(c, '#5a1612', 2.4, [ua, gv, gh - 8], [ub, gv, gh - 8]);
    const n = 13;
    for (let k = 0; k < n; k++) {
      const u = lerp(ua + 0.08, ub - 0.08, (k + 0.5) / n);
      seg3(c, '#a8302a', 1, [u, gv, gh - 8], [u, gv, gh + 6]);
      const x = X(u, gv), y = Y(u, gv, gh + 6);
      c.fillStyle = '#a8302a'; c.beginPath(); c.moveTo(x - 1, y + 0.6); c.lineTo(x, y - 2.6); c.lineTo(x + 1, y + 0.6); c.closePath(); c.fill();
    }
    seg3(c, '#5a1612', 2.6, [ua - 0.04, gv, gh], [ub + 0.04, gv, gh]);
    seg3(c, '#c8463a', 0.8, [ua - 0.04, gv, gh + 1], [ub + 0.04, gv, gh + 1]);
    onL(c, (ua + ub) / 2, gv, gh + 3.5, () => { circ(c, '#5a1612', 0, 0, 4); circ(c, '#c79a2c', 0, 0, 3.2); circ(c, '#a8302a', 0, 0, 1.6); });
    if (o.snow) seg3(c, '#eef2f7', 1.2, [ua, gv, gh + 1.8], [ub, gv, gh + 1.8]);
    post(c, ub, gv, 1.2, gh + 7, 0.042, '#a8302a', { top: '#5a1612' });
  };

  // 연무대: 돌로 높이 쌓은 대 위의 널마루. 뒤에 演武臺 현판 틀, 북과 병기대, 네 귀에 빛깔 다른 깃발
  B.stage = (c, o) => {
    const zD = 13, rnd = o.rnd;
    ao(c, 0, 0, 3, 3, 1);
    plinth(c, 0.08, 0.08, 2.92, 2.62, 0, zD - 1.6, Object.assign({}, o, { col: '#a19b8e', snow: false }));
    box(c, 0.16, 0.16, 2.84, 2.54, zD - 1.6, zD, '#7a5232', { top: o.snow ? '#e8edf2' : '#a8784a', right: '#5a3a20' });
    onTop(c, 0.16, 0.16, zD, () => {
      const L = 2.68 * 32, M = 2.38 * 32;
      if (!o.snow) { c.fillStyle = 'rgba(80,50,24,0.4)'; for (let a = 3.6; a < L; a += 3.6) c.fillRect(a, 0, 0.4, M); for (let i = 0; i < 30; i++) c.fillRect(rnd() * L, rnd() * M, 0.4, 2 + rnd() * 4); }
      c.strokeStyle = o.snow ? 'rgba(160,176,196,0.6)' : 'rgba(240,228,200,0.75)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(L / 2, M / 2 + 4, 22, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 0.6; c.beginPath(); c.arc(L / 2, M / 2 + 4, 18.5, 0, Math.PI * 2); c.stroke();
    });
    steps(c, 1.15, 1.85, 2.62, 2.97, 0, zD - 1.6, 3, '#a19b8e');
    triFlag(c, 0.26, 0.26, 44, '#4f7fb8', null, { z0: zD });
    // 현판 틀
    const ba = 0.62, bb = 2.38, bv = 0.24, bh = zD + 42;
    post(c, ba, bv, zD, bh + 2, 0.04, '#7a2a20', { top: '#4a1a12' });
    seg3(c, '#4a1a12', 2.4, [ba - 0.14, bv, bh], [bb + 0.14, bv, bh]);
    seg3(c, '#4a1a12', 1.6, [ba, bv, bh - 15], [bb, bv, bh - 15]);
    onL(c, ba, bv, bh - 1.5, () => faceSign(c, (bb - ba) * 32 / 2, 0.6, 36, 10.5, '演武臺', { frame: '#5e2a1a' }));
    if (o.snow) seg3(c, '#eef2f7', 1.2, [ba - 0.12, bv, bh + 1.4], [bb + 0.12, bv, bh + 1.4]);
    post(c, bb, bv, zD, bh + 2, 0.04, '#7a2a20', { top: '#4a1a12' });
    drum(c, 2.42, 0.62, zD, 5.5, o.snow);
    // 병기대 (왼쪽 가장자리, 안쪽을 본다)
    onR(c, 0.3, 1.86, zD, () => {
      rr(c, '#4a3020', 0, -16, 1.3, 16); rr(c, '#4a3020', 24, -16, 1.3, 16);
      rr(c, '#5e3e22', 0, -13.5, 25.3, 1.2); rr(c, '#5e3e22', 0, -4.5, 25.3, 1.2);
      ['staff', 'spear', 'sword', 'spear', 'blade', 'staff'].forEach((k, i) => {
        const x = 3 + i * 3.6;
        if (k === 'spear') { rr(c, '#6b4428', x, -25, 0.8, 23); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(x + 0.4, -28.5); c.lineTo(x + 1.3, -25); c.lineTo(x - 0.5, -25); c.fill(); rr(c, '#b53a2c', x - 0.2, -25.2, 1.2, 1.1); }
        else if (k === 'staff') { rr(c, '#8a5a32', x, -24, 0.9, 22); rr(c, '#c9a35a', x - 0.1, -24, 1.1, 1); }
        else { rr(c, '#3a2a1a', x, -7.5, 0.9, 3.6); rr(c, '#c9a35a', x - 0.6, -7.9, 2.1, 0.7); rr(c, '#dfe5ea', x + 0.05, -19.5, 0.8, 11.6); }
      });
    });
    triFlag(c, 2.74, 0.26, 44, '#a83a2e', null, { z0: zD });
    triFlag(c, 0.26, 2.44, 44, '#3f8a5a', null, { z0: zD });
    // 앞·오른쪽 밧줄 난간
    const ropePosts = [[0.3, 2.48], [0.72, 2.48], [1.12, 2.48], [1.88, 2.48], [2.28, 2.48], [2.7, 2.48], [2.78, 2.0], [2.78, 1.5], [2.78, 1.0], [2.78, 0.55]];
    const rope = (a, b) => { for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, s = t => 1.8 * 4 * t * (1 - t); seg3(c, '#a8302a', 0.7, [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), zD + 7 - s(t0)], [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), zD + 7 - s(t1)]); } };
    for (let i = 9; i > 6; i--) rope(ropePosts[i], ropePosts[i - 1]);
    rope([2.78, 0.55], [2.78, 0.3]);
    for (const [a, b] of [[0, 1], [1, 2], [3, 4], [4, 5], [5, 6]]) rope(ropePosts[a], ropePosts[b]);
    for (const [u, v] of ropePosts) post(c, u, v, zD, zD + 8, 0.02, '#5a3a20', { top: '#c9a35a' });
    triFlag(c, 2.74, 2.44, 44, '#c79a2c', null, { z0: zD });
  };

  // ── 공사 중 ──
  // 망루: 다리가 오르고, 가새를 대고, 망대를 얹는다
  function towerBuild(c, p, o) {
    ao(c, 0.08, 0.08, 0.92, 0.92, 0.6);
    box(c, 0.05, 0.05, 0.95, 0.95, 0, 1.2, '#8a7454', { top: o.snow ? '#dfe4ea' : '#9e8660' });
    const zP = 51, lg = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]], tp = [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]];
    const zt = zP * clamp(p * 1.4, 0.12, 1);
    for (const [u, v] of lg) box(c, u - 0.06, v - 0.06, u + 0.06, v + 0.06, 0, 2.5, PAL.stone);
    const legAt = (i) => {
      const [u, v] = lg[i], [tu, tv] = tp[i], t = zt / zP;
      seg3(c, '#5e3e22', 2.6, [u, v, 2.5], [lerp(u, tu, t), lerp(v, tv, t), zt]);
      seg3(c, '#a07a4e', 1.1, [u - 0.015, v, 2.5], [lerp(u, tu, t) - 0.015, lerp(v, tv, t), zt]);
    };
    legAt(0); legAt(1); legAt(2);
    if (p >= 0.5) {
      for (const [i, j] of [[2, 3], [1, 3]]) {
        const A = lg[i], Bq = lg[j], TA = tp[i], TB = tp[j], t = 0.5;
        seg3(c, '#7a5232', 1, [A[0], A[1], 2.5], [lerp(Bq[0], TB[0], t), lerp(Bq[1], TB[1], t), zP * t]);
        seg3(c, '#7a5232', 1, [Bq[0], Bq[1], 2.5], [lerp(A[0], TA[0], t), lerp(A[1], TA[1], t), zP * t]);
      }
    }
    legAt(3);
    // 대나무 비계와 사다리
    seg3(c, '#b0a056', 1.1, [0.5, 1.0, 0], [0.5, 0.86, zt + 6]);
    for (let z = 5; z < zt; z += 5) seg3(c, '#c9b46a', 0.8, [0.42, lerp(1.0, 0.86, z / (zt + 6)), z], [0.58, lerp(1.0, 0.86, z / (zt + 6)), z]);
    seg3(c, '#b0a056', 1.1, [0.42, 1.0, 0], [0.42, 0.86, zt + 6]); seg3(c, '#b0a056', 1.1, [0.58, 1.0, 0], [0.58, 0.86, zt + 6]);
    if (p >= 1) {
      box(c, 0.03, 0.03, 0.97, 0.6, zP, zP + 5, '#7a5232', { top: '#a07a4e', right: '#4e3018', edge: 'rgba(40,24,12,0.6)' });
      for (let k = 0; k < 3; k++) box(c, 0.2 + k * 0.08, 0.66, 0.8, 0.74, zP + k * 1.2, zP + k * 1.2 + 1.2, '#b48a52');
    }
    for (let k = 0; k < 3; k++) logU(c, 0.12, 0.62, 0.96 - k * 0.0, 1.2 + k * 2.2, 1.1);
  }
  // 벽이 없는 갈래 건물의 공사: 돌단이 켜켜이 오르고(혈제단·연무대), 울타리 말뚝과 게르 살이 선다(호시)
  function siteGround(c, w, h, p, o) {
    const rnd = o.rnd;
    ao(c, 0.06, 0.06, w - 0.06, h - 0.06, 0.6);
    box(c, 0.05, 0.05, w - 0.05, h - 0.05, 0, 1.2, '#8a7454', { top: o.snow ? '#dfe4ea' : '#9e8660' });
    onTop(c, 0.05, 0.05, 1.2, () => { for (let i = 0; i < 40 * w * h; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(90,70,40,0.35)' : 'rgba(220,200,160,0.3)'; c.fillRect(rnd() * (w - 0.1) * 32, rnd() * (h - 0.1) * 32, 1.4, 0.6); } });
    if (p >= 0.25) return;
    const a = 0.16, bu = w - 0.16, bv = h - 0.16;
    for (const [u, v] of [[a, a], [bu, a], [a, bv], [bu, bv]]) post(c, u, v, 1.2, 9, 0.018, '#c9a070');
    c.setLineDash([1.6, 1.2]);
    for (const [q0, q1] of [[[a, a], [bu, a]], [[bu, a], [bu, bv]], [[a, bv], [bu, bv]], [[a, a], [a, bv]]]) seg3(c, 'rgba(240,230,200,0.85)', 0.45, [q0[0], q0[1], 7.5], [q1[0], q1[1], 7.5]);
    c.setLineDash([]);
  }
  // 다듬은 돌 더미
  function stonePile(c, u, v, n) {
    const bl = [];
    for (let k = 0; k < n; k++) bl.push([u + (k % 3) * 0.13 - 0.13, v + Math.floor(k / 3) % 2 * 0.12, Math.floor(k / 6) * 6]);
    bl.sort((a, b) => (a[0] + a[1] + a[2] * 0.01) - (b[0] + b[1] + b[2] * 0.01));
    for (const [bu, bv, z] of bl) box(c, bu - 0.06, bv - 0.055, bu + 0.06, bv + 0.055, 1.2 + z, 7 + z, '#8e867c', { top: '#aaa396', right: '#6e6a62', edge: 'rgba(60,56,48,0.5)' });
  }
  // 나무 세발 기중기
  function tripod(c, u, v, H) {
    seg3(c, '#4a3020', 1.6, [u - 0.22, v + 0.18, 1.2], [u, v, H]);
    seg3(c, '#4a3020', 1.6, [u + 0.22, v + 0.18, 1.2], [u, v, H]);
    seg3(c, '#5e3e22', 1.6, [u, v - 0.28, 1.2], [u, v, H]);
    const x = X(u, v), y = Y(u, v, H);
    line(c, '#d6c49a', 0.5, x, y, x, y + H * 0.6);
    box(c, u - 0.06, v - 0.05, u + 0.06, v + 0.05, H * 0.4 - 5, H * 0.4, '#a6a092', { top: '#c4beb2' });
  }
  const BUILD_ART = {
    altar_ma(c, w, h, p, o) {
      siteGround(c, w, h, p, o);
      const tiers = [[0.04, 1.96, 0, 6, '#6e6469'], [0.3, 1.7, 6, 12, '#625a60'], [0.56, 1.44, 12, 18, '#564e54']];
      tiers.forEach(([a, b, z0, z1, col], i) => {
        const f = clamp(p * 4 - i, 0, 1);
        if (f > 0.05) plinth(c, a, a, b, b, z0, z0 + (z1 - z0) * f, Object.assign({}, o, { col, rowH: 3, blk: 6, snow: false }));
      });
      if (p >= 0.5) for (const [u, v] of [[0.17, 1.83], [1.83, 0.17]]) {
        post(c, u, v, 6, 6 + 48 * (p - 0.25), 0.055, '#3a3238', { top: '#4e464c' });
        for (const d of [-0.1, 0.1]) seg3(c, '#b0a056', 0.9, [u + d, v + 0.1, 6], [u + d, v + 0.1, 6 + 48 * (p - 0.2)]);
      }
      if (p < 0.75) tripod(c, 1.0, 1.0, 34);
      stonePile(c, 1.62, 1.72, p < 0.5 ? 9 : 5);
    },
    stage(c, w, h, p, o) {
      siteGround(c, w, h, p, o);
      const zD = 13;
      if (p >= 0.25) plinth(c, 0.08, 0.08, 2.92, 2.62, 0, (zD - 1.6) * clamp((p - 0.1) * 2.2, 0.35, 1), Object.assign({}, o, { col: '#a19b8e', snow: false }));
      if (p >= 0.5) {
        // 장선을 깔고 널을 반쯤 덮는다
        for (let k = 0; k < 9; k++) { const v = 0.24 + k * 0.28; seg3(c, '#6e4a2a', 1.6, [0.18, v, zD - 1], [2.82, v, zD - 1]); }
        if (p >= 0.75) box(c, 0.16, 0.16, 1.6, 2.54, zD - 1.6, zD, '#7a5232', { top: '#b08452', right: '#5a3a20' });
        for (const [u, v] of [[0.62, 0.24], [2.38, 0.24]]) post(c, u, v, zD, zD + 44 * clamp(p * 1.4 - 0.3, 0, 1), 0.04, '#9a7a52');
      }
      if (p < 0.75) tripod(c, 2.3, 2.1, 38);
      stonePile(c, 0.5, 2.62, p < 0.5 ? 9 : 4);
      for (let k = 0; k < 3; k++) logU(c, 1.9, 2.8, 2.86, 1.2 + k * 2.4, 1.2);
    },
    horsemarket(c, w, h, p, o) {
      siteGround(c, w, h, p, o);
      // 게르 살: 벽 그물살 → 지붕 서까래 → 펠트 반
      const u = 0.78, v = 0.8, R = 0.56, x = X(u, v), rx = R * 45.25, ry = R * 22.63;
      if (p >= 0.25) {
        const y0 = Y(u, v, 1.2), y1 = Y(u, v, 14);
        c.strokeStyle = '#a07a4e'; c.lineWidth = 0.6;
        for (let k = 0; k <= 16; k++) {
          const a = Math.PI * k / 16, a2 = Math.PI * (k + 1.4) / 16;
          c.beginPath(); c.moveTo(x + Math.cos(a) * rx, y0 + Math.sin(a) * ry); c.lineTo(x + Math.cos(Math.min(Math.PI, a2)) * rx, y1 + Math.sin(Math.min(Math.PI, a2)) * ry); c.stroke();
          c.beginPath(); c.moveTo(x + Math.cos(a) * rx, y1 + Math.sin(a) * ry); c.lineTo(x + Math.cos(Math.min(Math.PI, a2)) * rx, y0 + Math.sin(Math.min(Math.PI, a2)) * ry); c.stroke();
        }
        c.strokeStyle = '#7a5232'; c.lineWidth = 1;
        c.beginPath(); c.ellipse(x, y1, rx, ry, 0, 0, Math.PI * 2); c.stroke();
      }
      if (p >= 0.5) {
        const y1 = Y(u, v, 14), yt = Y(u, v, 33);
        if (p >= 0.75) { c.fillStyle = '#d9ccb0'; c.beginPath(); c.moveTo(x - rx * 1.1, y1); c.ellipse(x, y1, rx * 1.1, ry * 1.1, 0, Math.PI, Math.PI * 1.5, true); c.lineTo(x, yt); c.closePath(); c.fill(); }
        c.strokeStyle = '#8a5a32'; c.lineWidth = 0.8;
        for (let k = 0; k <= 14; k++) { const a = Math.PI * 2 * k / 14; c.beginPath(); c.moveTo(x, yt + 2); c.lineTo(x + Math.cos(a) * rx * 1.1, y1 + Math.sin(a) * ry * 1.1); c.stroke(); }
        ell(c, '#6a4a2a', x, yt + 2.4, rx * 0.2, ry * 0.2);
      }
      // 울타리 말뚝: 진척만큼
      const pts = [];
      for (let k = 0; k <= 4; k++) pts.push([lerp(1.5, 2.9, k / 4), 0.12], [lerp(1.5, 2.9, k / 4), 2.25]);
      for (let k = 1; k < 7; k++) pts.push([1.5, lerp(0.12, 2.25, k / 7)], [2.9, lerp(0.12, 2.25, k / 7)]);
      pts.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
      const nPost = Math.round(pts.length * clamp(p * 1.6 + 0.15, 0, 1));
      pts.slice(0, nPost).forEach(([pu, pv]) => post(c, pu, pv, 1.2, 15.2, 0.022, '#7a5232', { top: '#a8804f' }));
      for (let k = 0; k < 3; k++) logU(c, 0.3, 1.2, 2.5, 1.2 + k * 2.4, 1.2);
      if (p < 0.75) for (const [hu, hv] of [[0.4, 2.0], [0.62, 2.15]]) cylV(c, hu, hv, 0.12, 1.2, 9, '#c9a85a', o.snow ? '#eef2f7' : '#e0c47f', { rim: '#8f6e36' });
    },
  };
  // 갈래 건물의 공사터에는 그 갈래 빛깔의 깃발을 먼저 꽂는다 (무엇을 짓는지 알아보게)
  const ROUTE_FLAG = { hall_jeong: '#3e5f8a', altar_ma: '#7a2030', ancestral: '#3f7a5a', blackmarket: '#2a262a', gambling: '#9a2a22', horsemarket: '#b8743a', yamen: '#b88a24', stage: '#6a5a3a' };
  function construction(c, type, w, h, p, o) {
    if (ROUTE_FLAG[type]) {
      constructionArt(c, type, w, h, p, o);
      triFlag(c, 0.14, h - 0.14, 40, ROUTE_FLAG[type], (BDEF[type] || {}).hanja, { fg: '#f2ead2' });
      return;
    }
    constructionArt(c, type, w, h, p, o);
  }
  function constructionArt(c, type, w, h, p, o) {
    const def = BDEF[type] || {};
    const meta = SPRITE_META[type] || { height: 40 };
    const rnd = o.rnd;
    if (BUILD_ART[type]) { BUILD_ART[type](c, w, h, p, o); return; }
    if (def.ground) {
      // 밭 일구기: 갈아엎은 흙이 진척만큼
      fill3(c, '#8a7454', [[0.04, 0.04, 0], [w - 0.04, 0.04, 0], [w - 0.04, h - 0.04, 0], [0.04, h - 0.04, 0]]);
      const rows = Math.floor(9 * p);
      for (let k = 0; k < 9; k++) {
        const v = 0.3 + k * 0.3;
        if (k < rows) box(c, 0.18, v - 0.07, w - 0.18, v + 0.07, 0, 1.4, '#7a5a3a', { top: '#8a6a44' });
        else for (let i = 0; i < 6; i++) { const u = 0.2 + rnd() * (w - 0.4); circ(c, '#6a8a3e', X(u, v), Y(u, v, 0), 0.8 + rnd()); }
      }
      for (const [u, v] of [[0.06, 0.06], [w - 0.06, 0.06], [0.06, h - 0.06], [w - 0.06, h - 0.06]]) post(c, u, v, 0, 8, 0.02, PAL.bamboo);
      seg3(c, 'rgba(240,230,200,0.8)', 0.4, [0.06, h - 0.06, 7], [w - 0.06, h - 0.06, 7]);
      seg3(c, 'rgba(240,230,200,0.8)', 0.4, [w - 0.06, 0.06, 7], [w - 0.06, h - 0.06, 7]);
      return;
    }
    if (def.line) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const u = lerp(0.18, 0.82, i / (n - 1));
        const hh = (type === 'stonewall' ? 22 : 20) * clamp(p * 1.4 - i * 0.12, 0.12, 1);
        if (type === 'stonewall') box(c, u - 0.08, 0.38, u + 0.08, 0.62, 0, hh, '#8e897e', { top: '#b4afa4' });
        else post(c, u, 0.5, 0, hh, 0.03, '#6b4428', { top: '#c9a070' });
      }
      for (let i = 0; i < 3; i++) box(c, 0.12, 0.72 + i * 0.03, 0.5, 0.78 + i * 0.03, i * 1.6, i * 1.6 + 1.6, type === 'stonewall' ? '#a6a194' : '#9a6a3a');
      return;
    }
    if (type === 'tower') { towerBuild(c, p, o); return; }
    const inset = w === 1 ? 0.16 : 0.18;
    const u0 = inset, v0 = inset, u1 = w - inset, v1 = h - inset;
    const wallH = clamp(meta.height * 0.42, 18, 40);
    ao(c, 0.06, 0.06, w - 0.06, h - 0.06, 0.7);
    // 다진 터와 기초 (돌 테두리 안에 다진 흙)
    box(c, 0.05, 0.05, w - 0.05, h - 0.05, 0, 1.2, '#8a7454', { top: o.snow ? '#dfe4ea' : '#9e8660' });
    onTop(c, 0.05, 0.05, 1.2, () => { for (let i = 0; i < 40 * w * h; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(90,70,40,0.35)' : 'rgba(220,200,160,0.3)'; c.fillRect(rnd() * (w - 0.1) * 32, rnd() * (h - 0.1) * 32, 1.4, 0.6); } });
    box(c, u0 - 0.06, v0 - 0.06, u1 + 0.06, v1 + 0.06, 1.2, 4.5, PAL.stone, { top: '#a8946e' });
    onL(c, u0 - 0.06, v1 + 0.06, 1.2, () => stoneCourses(c, (u1 - u0 + 0.12) * 32, 3.3, rnd, { rowH: 3.3 }));
    onTop(c, u0 - 0.06, v0 - 0.06, 4.5, () => {
      const L = (u1 - u0 + 0.12) * 32, M = (v1 - v0 + 0.12) * 32;
      c.strokeStyle = '#8e897e'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, L - 3, M - 3);
      c.strokeStyle = 'rgba(60,56,48,0.5)'; c.lineWidth = 0.4; c.strokeRect(3, 3, L - 6, M - 6);
    });
    // 줄과 말뚝
    if (p < 0.25) {
      for (const [u, v] of [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]) post(c, u, v, 4.5, 11, 0.018, '#c9a070');
      c.setLineDash([1.6, 1.2]);
      for (const [a, b] of [[[u0, v0], [u1, v0]], [[u1, v0], [u1, v1]], [[u0, v1], [u1, v1]], [[u0, v0], [u0, v1]]]) seg3(c, 'rgba(240,230,200,0.85)', 0.45, [a[0], a[1], 9], [b[0], b[1], 9]);
      c.setLineDash([]);
    }
    const postH = wallH * clamp(p * 4, 0, 1);
    const plH = wallH * clamp((p - 0.25) / 0.5, 0, 1);
    const nU = Math.max(2, Math.round((u1 - u0) / 0.55)), nV = Math.max(2, Math.round((v1 - v0) / 0.55));
    const postsAt = [];
    for (let i = 0; i <= nU; i++) postsAt.push([lerp(u0, u1, i / nU), v0], [lerp(u0, u1, i / nU), v1]);
    for (let i = 1; i < nV; i++) postsAt.push([u0, lerp(v0, v1, i / nV)], [u1, lerp(v0, v1, i / nV)]);
    postsAt.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
    // 뒤쪽 기둥
    if (postH > 1) for (const [u, v] of postsAt) if (v === v0 || u === u0) post(c, u, v, 4.5, 4.5 + postH, 0.03, '#a07a4e', { top: '#c9a070' });
    if (postH > 1 && p >= 0.25) {
      seg3(c, '#8a6a42', 1.6, [u0, v0, 4.5 + wallH], [u1, v0, 4.5 + wallH]);
      seg3(c, '#8a6a42', 1.6, [u0, v0, 4.5 + wallH], [u0, v1, 4.5 + wallH]);
    }
    // 올라가는 벽
    if (plH > 0.5) {
      onL(c, u0, v1, 4.5, () => {
        const L = (u1 - u0) * 32;
        rr(c, '#e2d6bc', 0, -plH, L, plH);
        for (let y = -2.5; y > -plH; y -= 2.6) rr(c, 'rgba(120,100,70,0.18)', 0, y, L, 0.4);
        rr(c, 'rgba(255,255,255,0.4)', 0, -plH, L, 0.8);
      });
      onR(c, u1, v1, 4.5, () => {
        const L = (v1 - v0) * 32;
        rr(c, '#c9bc9f', 0, -plH, L, plH);
        for (let y = -2.5; y > -plH; y -= 2.6) rr(c, 'rgba(90,70,40,0.2)', 0, y, L, 0.4);
      });
    }
    if (postH > 1) for (const [u, v] of postsAt) if (!(v === v0 || u === u0)) post(c, u, v, 4.5, 4.5 + postH, 0.03, '#a07a4e', { top: '#c9a070' });
    if (p >= 0.25) {
      seg3(c, '#8a6a42', 1.6, [u0, v1, 4.5 + wallH], [u1, v1, 4.5 + wallH]);
      seg3(c, '#8a6a42', 1.6, [u1, v0, 4.5 + wallH], [u1, v1, 4.5 + wallH]);
    }
    // 서까래 뼈대
    if (p >= 0.75) {
      const ov = 0.12, zE = 4.5 + wallH, hw = (v1 - v0) / 2 + ov;
      const zR = zE + Math.min(26, hw * 20 + 4);
      const vc = (v0 + v1) / 2;
      const ru0 = Math.min(u0 - ov + hw * 0.8, (u0 + u1) / 2), ru1 = Math.max(u1 + ov - hw * 0.8, (u0 + u1) / 2);
      const E0 = u0 - ov, E1 = u1 + ov, F0 = v0 - ov, F1 = v1 + ov;
      post(c, ru0, vc, zE, zR, 0.025, '#8a6a42'); post(c, ru1, vc, zE, zR, 0.025, '#8a6a42');
      // 뒤 서까래와 뒤 추녀
      for (let u = ru0; u <= ru1 + 1e-6; u += 0.17) seg3(c, '#6e4a2a', 0.9, [u, F0, zE - 1], [u, vc, zR]);
      seg3(c, '#5a3a20', 1.4, [E0, F0, zE], [ru0, vc, zR]); seg3(c, '#5a3a20', 1.4, [E1, F0, zE], [ru1, vc, zR]);
      seg3(c, '#5a3a20', 2.2, [ru0, vc, zR], [ru1, vc, zR]);
      // 처마도리
      seg3(c, '#6e4a2a', 1.4, [E0, F1, zE - 1], [E1, F1, zE - 1]); seg3(c, '#5a3a20', 1.4, [E1, F1, zE - 1], [E1, F0, zE - 1]);
      // 앞 서까래
      for (let u = ru0; u <= ru1 + 1e-6; u += 0.17) seg3(c, '#8a5f36', 0.9, [u, F1, zE - 1], [u, vc, zR]);
      for (let v = vc + 0.17; v < F1; v += 0.17) seg3(c, '#7a5232', 0.8, [E1, v, zE - 1], [ru1 + (v - vc) * 0, vc, zR]);
      seg3(c, '#5a3a20', 1.4, [E0, F1, zE], [ru0, vc, zR]); seg3(c, '#5a3a20', 1.4, [E1, F1, zE], [ru1, vc, zR]);
      if (p >= 1) {
        // 기와를 반쯤 얹었다
        const um = lerp(ru0, ru1, 0.6);
        const q = [[E0, F1, zE - 1], [um, F1, zE - 1], [um, vc, zR], [ru0, vc, zR]];
        fill3(c, '#4d586c', q);
        c.save(); path3(c, q); c.clip();
        for (let u = E0; u < um; u += 0.1) seg3(c, 'rgba(12,15,22,0.5)', 0.6, [u, F1, zE - 1], [u, vc, zR]);
        c.restore();
        seg3(c, '#1b2028', 1.2, [E0, F1, zE - 1.2], [um, F1, zE - 1.2]);
      }
    }
    // 대나무 비계
    const sh = Math.min(wallH + 10, 4.5 + postH + 8);
    if (sh > 8) {
      const so = 0.07;
      const front = [];
      for (let i = 0; i <= nU; i++) front.push([lerp(u0 - so, u1 + so, i / nU), v1 + so]);
      for (let i = nV - 1; i >= 0; i--) front.push([u1 + so, lerp(v0 - so, v1 + so, i / nV)]);
      for (const [u, v] of front) seg3(c, '#b0a056', 1.2, [u, v, 0], [u, v, sh]);
      for (let z = 7; z < sh; z += 8) {
        seg3(c, '#9a8a44', 1, [u0 - so, v1 + so, z], [u1 + so, v1 + so, z]);
        seg3(c, '#8a7a3a', 1, [u1 + so, v1 + so, z], [u1 + so, v0 - so, z]);
        for (const [u, v] of front) circ(c, '#d8c48a', X(u, v), Y(u, v, z), 0.7);
      }
      seg3(c, 'rgba(150,130,60,0.9)', 0.8, [u0 - so, v1 + so, 0], [lerp(u0, u1, 0.5), v1 + so, sh]);
      // 널판 발판
      if (sh > 18) box(c, u0 - so - 0.02, v1 + so - 0.05, u1 + so, v1 + so + 0.05, 14.5, 15.5, '#a07a4e');
    }
    // 재목과 기와 더미
    for (let k = 0; k < 3; k++) logU(c, 0.12 + k * 0.03, Math.min(w, 1.1) - 0.1, h - 0.1 - k * 0.0, 2 + k * 2.4, 1.2);
    if (w > 1) {
      for (let k = 0; k < 4; k++) box(c, w - 0.5, h - 0.4, w - 0.2, h - 0.12, k * 2, k * 2 + 1.8, '#4d586c', { top: '#6a768c' });
      jar(c, w - 0.68, h - 0.18, 0.6);
    }
  }

  // ── 폐허 ──
  function ruin(c, type, w, h, o) {
    const def = BDEF[type] || {};
    const rnd = o.rnd;
    const ash = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const side = Math.floor(t * 4), f = (t * 4) % 1;
      const j = 0.04 + rnd() * 0.1;
      const p = side === 0 ? [f * w, j] : side === 1 ? [w - j, f * h] : side === 2 ? [w - f * w, h - j] : [j, h - f * h];
      ash.push([p[0], p[1], 0]);
    }
    fill3(c, '#2e2824', ash);
    onTop(c, 0, 0, 0, () => {
      for (let i = 0; i < 70 * w * h / 4; i++) {
        const a = 3 + rnd() * (w * 32 - 6), b = 3 + rnd() * (h * 32 - 6);
        c.fillStyle = ['rgba(18,14,12,0.6)', 'rgba(90,84,78,0.5)', 'rgba(60,54,50,0.6)'][i % 3];
        c.beginPath(); c.ellipse(a, b, 1 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, Math.PI * 2); c.fill();
      }
    });
    if (def.ground) {
      for (let k = 0; k < 9; k++) { const v = 0.3 + k * 0.3; for (let u = 0.3; u < w - 0.2; u += 0.22) line(c, '#1a1410', 0.8, X(u, v), Y(u, v), X(u, v) + 1.5, Y(u, v) - 2.4); }
      if (o.snow) for (let i = 0; i < 3 * w * h; i++) { const u = 0.2 + rnd() * (w - 0.4), v = 0.2 + rnd() * (h - 0.4), r = 3 + rnd() * 5; ell(c, 'rgba(240,244,249,0.9)', X(u, v), Y(u, v, 0.3), r, r * 0.42); }
      return;
    }
    // 벽이 없던 갈래 건물: 돌단은 무너진 돌무더기(stone), 천막·울타리는 그을린 말뚝(camp)
    const kind = type === 'altar_ma' || type === 'stage' ? 'stone' : type === 'horsemarket' ? 'camp' : null;
    // 남은 기단
    if (kind === 'stone') {
      box(c, 0.08, 0.08, w - 0.08, h - 0.08, 0, 5, '#6a665e', { top: '#56524c', right: '#4a4640' });
      onL(c, 0.08, h - 0.08, 0, () => stoneCourses(c, (w - 0.16) * 32, 5, rnd, { rowH: 2.5, blk: 6 }));
      // 반쯤 남은 윗단
      const a = 0.35, b = w - 0.35;
      for (let k = 0; k < 7; k++) { const u = lerp(a, b, k / 6); box(c, u - 0.12, a - 0.1, u + 0.12, a + 0.14, 5, 5 + 3 + rnd() * 6, '#625e58', { top: '#7a766e', right: '#4a4640' }); }
      for (let k = 1; k < 5; k++) { const v = lerp(a, h - 0.4, k / 5); box(c, a - 0.1, v - 0.12, a + 0.14, v + 0.12, 5, 5 + 2 + rnd() * 5, '#625e58', { top: '#7a766e', right: '#4a4640' }); }
    } else if (!def.line && !kind) box(c, 0.08, 0.08, w - 0.08, h - 0.08, 0, 2.6, '#5a5650', { top: '#3a3632', right: '#3e3a36' });
    if (kind === 'camp') {
      // 타 버린 게르 테
      const x = X(0.78, 0.8), y = Y(0.78, 0.8, 0.5);
      c.strokeStyle = '#141010'; c.lineWidth = 2.4; c.beginPath(); c.ellipse(x, y, 25, 12.6, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(255,110,40,0.4)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(x, y, 25, 12.6, 0, 0.3, 1.2); c.stroke();
    }
    // 그을린 채 남은 벽 조각 (뒤쪽 ㄱ자)
    if (!def.line && !kind) {
      const hmax = w === 1 ? 9 : w === 2 ? 15 : 19;
      const jag = (len, dark = 0) => {
        const pts = [[0, 0]];
        const n2 = Math.max(3, Math.round(len / 3.2));
        for (let i = 0; i <= n2; i++) { const t = i / n2; const notch = rnd() < 0.25 ? 0.4 : 1; pts.push([len * t, -hmax * (1 - t * t * 0.8) * (0.75 + rnd() * 0.25) * notch]); }
        pts.push([len, 0]);
        c.beginPath(); pts.forEach((p2, i) => (i ? c.lineTo(p2[0], p2[1]) : c.moveTo(p2[0], p2[1]))); c.closePath();
        c.fillStyle = '#9a8c78'; c.fill();
        c.save(); c.clip();
        const g = c.createLinearGradient(0, -hmax, 0, 0); g.addColorStop(0, 'rgba(10,8,6,0.9)'); g.addColorStop(0.45, 'rgba(30,22,16,0.45)'); g.addColorStop(1, 'rgba(30,22,16,0.15)');
        c.fillStyle = g; c.fillRect(0, -hmax, len, hmax);
        for (let x = 0; x < len; x += len / 3) rr(c, '#1e1712', x, -hmax, 1.8, hmax);
        rr(c, '#2a2018', 0, -2.2, len, 2.2);
        if (dark) rr(c, `rgba(10,6,4,${dark})`, 0, -hmax, len, hmax);
        c.restore();
        c.strokeStyle = '#120e0c'; c.lineWidth = 0.8; c.beginPath(); pts.slice(1, -1).forEach((p2, i) => (i ? c.lineTo(p2[0], p2[1]) : c.moveTo(p2[0], p2[1]))); c.stroke();
      };
      const fl = Math.min(w, 2) * 0.62, fm = Math.min(h, 2) * 0.5;
      onR(c, 0.22, 0.22 + fm, 2.6, () => { c.save(); c.translate(fm * 32, 0); c.scale(-1, 1); jag(fm * 32, 0.25); c.restore(); });
      onL(c, 0.22, 0.22, 2.6, () => jag(fl * 32));
    }
    const items = [];
    // 그을린 기둥 그루터기
    const inset = w === 1 ? 0.2 : 0.2;
    for (const [u, v] of [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]]) if (rnd() < 0.85) items.push(['post', u, v, 5 + rnd() * (w > 1 ? 16 : 10)]);
    if (w > 1) for (let i = 0; i < w + h - 2; i++) items.push(['post', inset + rnd() * (w - 2 * inset), h - inset, 3 + rnd() * 8]);
    if (kind === 'camp') for (let i = 0; i < 9; i++) items.push(['post', 1.5 + (i % 3) * 0.7, 0.12 + Math.floor(i / 3) * 1.05, 3 + rnd() * 8]);
    // 무너진 지붕 조각, 대들보, 돌 (돌단은 돌이 더 많고 기와가 없다)
    const nb = Math.max(2, Math.round((w + h) * (kind === 'stone' ? 0.5 : 1.2)));
    for (let i = 0; i < nb; i++) items.push(['beam', 0.2 + rnd() * (w - 0.4), 0.2 + rnd() * (h - 0.4), rnd()]);
    const nt = kind ? 0 : Math.max(3, Math.round(w * h * 3));
    for (let i = 0; i < nt; i++) items.push(['tile', 0.15 + rnd() * (w - 0.3), 0.15 + rnd() * (h - 0.3), rnd()]);
    const ns = Math.max(3, Math.round(w * h * (kind === 'stone' ? 4.5 : 2.4)));
    for (let i = 0; i < ns; i++) items.push(['stone', 0.12 + rnd() * (w - 0.24), 0.12 + rnd() * (h - 0.24), rnd()]);
    if (w > 1 && !kind) items.push(['roof', w * 0.35, h * 0.45, rnd()]);
    items.sort((a, b) => (a[1] + a[2]) - (b[1] + b[2]));
    const z0 = def.line || kind === 'camp' ? 0 : kind === 'stone' ? 5 : 2.6;
    for (const it of items) {
      const [k, u, v, r] = it;
      if (k === 'post') {
        post(c, u, v, z0, z0 + r, 0.04, '#1e1814', { top: '#3a2a20', right: '#141010' });
        const x = X(u, v), y = Y(u, v, z0 + r);
        c.fillStyle = '#141010'; c.beginPath(); c.moveTo(x - 1.6, y + 0.6); c.lineTo(x - 0.4, y - 2.2); c.lineTo(x + 0.6, y - 0.4); c.lineTo(x + 1.6, y - 1.6); c.lineTo(x + 1.6, y + 1); c.closePath(); c.fill();
        circ(c, 'rgba(255,110,40,0.55)', x + 0.4, y + 1.2, 0.7);
      } else if (k === 'beam') {
        const a = r * Math.PI, L = 0.3 + r * 0.35;
        const p0 = [u - Math.cos(a) * L / 2, v - Math.sin(a) * L / 2, z0 + 0.8], p1 = [u + Math.cos(a) * L / 2, v + Math.sin(a) * L / 2, z0 + 0.8 + (r > 0.6 ? 7 : 1.5)];
        seg3(c, '#141010', 3, p0, p1); seg3(c, '#4a3424', 0.9, [p0[0], p0[1], p0[2] + 1], [p1[0], p1[1], p1[2] + 1]);
      } else if (k === 'tile') {
        const x = X(u, v), y = Y(u, v, z0 + 0.5);
        for (let q = 0; q < 4; q++) {
          const dx = (rnd() - 0.5) * 6, dy = (rnd() - 0.5) * 3;
          c.fillStyle = q % 2 ? '#3e4654' : '#2a303a';
          c.beginPath(); c.ellipse(x + dx, y + dy, 1.8, 0.9, rnd() * 3, 0, Math.PI * 2); c.fill();
        }
      } else if (k === 'stone') {
        const s = 0.035 + r * 0.045;
        box(c, u - s, v - s * 0.8, u + s, v + s * 0.8, z0, z0 + 1.2 + r * 2.6, '#6e6a62', { top: '#8a857a', right: '#4e4a44' });
      } else if (k === 'roof') {
        const L = Math.min(w, h) * 0.45;
        const q = [[u - L * 0.5, v - L * 0.3, z0 + 1], [u + L * 0.5, v - L * 0.3, z0 + 9], [u + L * 0.5, v + L * 0.3, z0 + 7], [u - L * 0.5, v + L * 0.3, z0]];
        fill3(c, '#2c323c', q);
        c.save(); path3(c, q); c.clip();
        for (let t = 0; t < 1; t += 0.08) seg3(c, 'rgba(110,122,140,0.45)', 0.6, [lerp(q[0][0], q[1][0], t), q[0][1], lerp(q[0][2], q[1][2], t)], [lerp(q[3][0], q[2][0], t), q[3][1], lerp(q[3][2], q[2][2], t)]);
        c.restore();
        seg3(c, '#141010', 2, [q[3][0], q[3][1], q[3][2]], [q[2][0], q[2][1], q[2][2]]);
      }
    }
    if (o.snow) for (let i = 0; i < 4 * w * h; i++) { const u = 0.2 + rnd() * (w - 0.4), v = 0.2 + rnd() * (h - 0.4), r = 3 + rnd() * 4; ell(c, 'rgba(200,210,224,0.7)', X(u, v) + 0.6, Y(u, v, z0 + 0.3) + 0.5, r, r * 0.45); ell(c, 'rgba(240,244,249,0.92)', X(u, v), Y(u, v, z0 + 0.6), r * 0.9, r * 0.38); }
  }

  // ── 나무 ──
  // 밑동 (0, 0) 기준으로 그린 뒤 sc 배 키운다. 빛은 왼쪽 위에서.
  function tree(kind, season, variant) {
    const sc = 1.36 + (((variant * 37) % 6) / 6) * 0.2;
    const cw = Math.ceil(54 * sc), ch = Math.ceil(78 * sc);
    const cv = document.createElement('canvas');
    cv.width = cw * SS; cv.height = ch * SS;
    const c = cv.getContext('2d');
    c.scale(SS, SS);
    const bx = cw / 2, by = ch - 5 * sc;
    c.translate(bx, by); c.scale(sc, sc);
    const rnd = mulberry32(hashStr(kind + season + ':' + variant));
    const winter = season === 3;
    ell(c, 'rgba(0,0,0,0.24)', 2, 0, 12, 4.8);
    if (kind === 'pine') pine(c, rnd, variant, winter);
    else if (kind === 'leaf') broadleaf(c, rnd, variant, season);
    else bamboo(c, rnd, variant, winter);
    return { c: cv, w: cw, h: ch, ax: bx, ay: by };
  }
  // 소나무: 붉은 줄기와 구름 같은 솔잎 덩이
  function pine(c, rnd, variant, winter) {
    const lean = ((variant % 3) - 1) * 2.2 + (rnd() - 0.5);
    const H = 34 + rnd() * 6;
    const tx = t => lean * t * t * 1.6 + Math.sin(t * 3 + variant) * 1.2 * t;
    // 줄기
    c.fillStyle = '#7a4128';
    c.beginPath(); c.moveTo(-2.8, 0);
    for (let i = 1; i <= 8; i++) { const t = i / 8; c.lineTo(tx(t) - 2.8 + t * 1.8, -H * t); }
    for (let i = 8; i >= 0; i--) { const t = i / 8; c.lineTo(tx(t) + 2.8 - t * 1.8, -H * t); }
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(40,16,8,0.45)';
    c.beginPath(); c.moveTo(0.6, 0);
    for (let i = 1; i <= 8; i++) { const t = i / 8; c.lineTo(tx(t) + 0.4, -H * t); }
    for (let i = 8; i >= 0; i--) { const t = i / 8; c.lineTo(tx(t) + 2.8 - t * 1.8, -H * t); }
    c.closePath(); c.fill();
    for (let y = -3; y > -H + 4; y -= 3 + rnd() * 2) { const t = -y / H; rr(c, 'rgba(210,120,80,0.55)', tx(t) - 1.8, y, 1.4 + rnd(), 0.6); }
    // 솔잎 덩이
    const n = 4 + (variant % 3);
    const pads = [];
    for (let k = 0; k < n; k++) {
      const t = 0.45 + (k / (n - 1)) * 0.55;
      const side = k === n - 1 ? 0 : (k % 2 ? 1 : -1) * (variant % 2 ? 1 : -1);
      const w = (12 - k * 1.6) * (0.85 + rnd() * 0.3);
      pads.push({ x: tx(t) + side * (5 + rnd() * 4) * (1 - t * 0.4), y: -H * t - 6 - k * 1.6, w, h: w * 0.42, t });
    }
    for (const p of pads) {
      const t = p.t;
      c.strokeStyle = '#5a2e1a'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(tx(t), -H * t + 2); c.quadraticCurveTo((tx(t) + p.x) / 2, p.y + 3, p.x * 0.8 + tx(t) * 0.2, p.y + 1.5); c.stroke();
    }
    for (const p of pads) {
      const blobs = [];
      const m = 4 + Math.floor(rnd() * 3);
      for (let i = 0; i < m; i++) blobs.push([p.x + (i / (m - 1) - 0.5) * p.w * 1.5 + (rnd() - 0.5) * 2, p.y + (rnd() - 0.5) * p.h * 0.6, p.w * (0.38 + rnd() * 0.18), p.h * (0.6 + rnd() * 0.3)]);
      for (const [x, y, rx, ry] of blobs) ell(c, '#1d3a25', x + 0.8, y + 1.6, rx, ry);
      for (const [x, y, rx, ry] of blobs) ell(c, '#2c5636', x, y, rx, ry);
      for (const [x, y, rx, ry] of blobs) ell(c, '#3d7046', x - rx * 0.2, y - ry * 0.35, rx * 0.72, ry * 0.58);
      for (const [x, y, rx, ry] of blobs) ell(c, '#548a55', x - rx * 0.35, y - ry * 0.55, rx * 0.35, ry * 0.3);
      // 솔잎 결
      c.strokeStyle = 'rgba(20,44,26,0.7)'; c.lineWidth = 0.45;
      for (let i = 0; i < 12; i++) {
        const b = blobs[Math.floor(rnd() * blobs.length)];
        const a = Math.PI * (0.15 + rnd() * 0.7);
        const x = b[0] + Math.cos(a) * b[2] * 0.95, y = b[1] + Math.sin(a) * b[3] * 0.95;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + (rnd() - 0.5) * 1.6, y + 1.3); c.stroke();
      }
      if (winter) {
        for (const [x, y, rx, ry] of blobs) ell(c, '#eef2f7', x - rx * 0.1, y - ry * 0.5, rx * 0.86, ry * 0.5);
        for (const [x, y, rx, ry] of blobs) ell(c, 'rgba(170,186,208,0.8)', x + rx * 0.35, y - ry * 0.35, rx * 0.35, ry * 0.22);
      }
    }
  }
  // 활엽수: 봄 꽃(벚·매화)·여름 초록·가을 단풍·겨울 맨가지
  function broadleaf(c, rnd, variant, season) {
    const H = 20 + rnd() * 3;
    c.fillStyle = '#5e3e26';
    c.beginPath(); c.moveTo(-2.8, 0); c.quadraticCurveTo(-1.2, -H * 0.5, -1.8, -H); c.lineTo(1.8, -H); c.quadraticCurveTo(1.2, -H * 0.5, 2.8, 0); c.closePath(); c.fill();
    rr(c, 'rgba(0,0,0,0.28)', 0.4, -H, 1.6, H);
    // 가지
    const twigs = [];
    const bare = season === 3;
    const limb = (x, y, a, len, wd, d) => {
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      const mx = (x + x2) / 2 + (rnd() - 0.5) * 1.6, my = (y + y2) / 2;
      c.strokeStyle = '#563822'; c.lineWidth = wd; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
      if (bare && d >= 1 && d <= 2) { c.strokeStyle = 'rgba(242,245,249,0.85)'; c.lineWidth = Math.max(0.5, wd * 0.5); c.beginPath(); c.moveTo(x, y - wd * 0.45); c.quadraticCurveTo(mx, my - wd * 0.45, x2, y2 - wd * 0.45); c.stroke(); }
      if (d >= 5 || len < 1.8) { twigs.push([x2, y2, a]); return; }
      const k = d === 0 ? 3 : 2;
      for (let i = 0; i < k; i++) {
        let na = a + (i - (k - 1) / 2) * (d === 0 ? 0.78 : 0.5 + rnd() * 0.2) + (rnd() - 0.5) * 0.25;
        na += (-Math.PI / 2 - na) * 0.07;
        limb(x2, y2, na, len * (0.76 + rnd() * 0.1), wd * 0.68, d + 1);
      }
    };
    limb(0, -H + 1, -Math.PI / 2 + (rnd() - 0.5) * 0.25, 6.5, 2.6, 0);
    c.lineCap = 'butt';
    let cols = null;
    const blossom = variant % 3 === 0;
    if (season === 0) cols = blossom ? ['#f0b4c4', '#f8d0da', '#d98aa2'] : ['#8cc464', '#a6d878', '#6aa04a'];
    else if (season === 1) cols = ['#3f8038', '#55984a', '#2c6229'];
    else if (season === 2) cols = variant % 2 ? ['#d6782a', '#eba03e', '#a8502a'] : ['#cfa02e', '#e6c24c', '#a07a24'];
    if (!cols) {
      // 겨울: 가지 위에 쌓인 눈
      return;
    }
    const blobs = [[0, -H - 11, 11], [-9, -H - 6, 8], [9, -H - 7, 8.5], [-4, -H - 19, 8.5], [6, -H - 17, 7.5], [-11, -H - 13, 6], [11, -H - 14, 6]];
    for (const b of blobs) { b[0] += (rnd() - 0.5) * 2.5; b[1] += (rnd() - 0.5) * 2; b[2] *= 0.92 + rnd() * 0.16; }
    for (const [x, y, r] of blobs) circ(c, shade(cols[2], -0.3), x + 1.2, y + 1.6, r);
    blobs.forEach(([x, y, r], i) => {
      const g = c.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.15, x, y, r);
      g.addColorStop(0, shade(cols[1], 0.15)); g.addColorStop(0.55, cols[i % 2 ? 0 : 1]); g.addColorStop(1, cols[2]);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    });
    // 잎 무더기 결
    for (let i = 0; i < 46; i++) {
      const b = blobs[Math.floor(rnd() * blobs.length)];
      const a = rnd() * Math.PI * 2, rr2 = Math.sqrt(rnd()) * b[2] * 0.9;
      const x = b[0] + Math.cos(a) * rr2, y = b[1] + Math.sin(a) * rr2;
      const lit = (Math.cos(a) < 0 && Math.sin(a) < 0.2);
      c.fillStyle = lit ? 'rgba(255,255,240,0.16)' : 'rgba(0,20,0,0.12)';
      c.beginPath(); c.arc(x, y, 1.2 + rnd() * 0.8, Math.PI, Math.PI * 2); c.fill();
    }
    if (season === 0 && blossom) for (let i = 0; i < 30; i++) circ(c, i % 3 ? '#fff4f6' : '#ffd9e2', -13 + rnd() * 26, -H - 26 + rnd() * 24, 0.8);
    else if (season === 0) for (let i = 0; i < 8; i++) circ(c, '#fff8e8', -11 + rnd() * 22, -H - 24 + rnd() * 20, 0.7);
    if (season === 2) for (let i = 0; i < 7; i++) ell(c, cols[i % 3], -11 + rnd() * 24, -1 + rnd() * 3, 1.3, 0.6);
    if (season === 0 && blossom) for (let i = 0; i < 6; i++) ell(c, '#f8d0da', -11 + rnd() * 24, -1 + rnd() * 3, 1, 0.5);
  }
  // 대숲
  function bamboo(c, rnd, variant, winter) {
    const n = 7;
    const culms = [];
    for (let i = 0; i < n; i++) culms.push([-11 + i * 3.6 + (rnd() - 0.5) * 1.6, 46 + rnd() * 18, (i - 3) * 0.5 + (rnd() - 0.5)]);
    culms.sort((a, b) => b[1] - a[1]);
    for (const [x, h, bend] of culms) {
      c.strokeStyle = winter ? '#5f8a52' : (rnd() < 0.5 ? '#5f9a48' : '#4f8a3c'); c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + bend * 1.5, -h * 0.5, x + bend * 4, -h); c.stroke();
      c.strokeStyle = 'rgba(255,255,220,0.25)'; c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(x - 0.5, 0); c.quadraticCurveTo(x + bend * 1.5 - 0.5, -h * 0.5, x + bend * 4 - 0.5, -h); c.stroke();
      for (let y = -5; y > -h + 4; y -= 5.5) { const t = -y / h; rr(c, '#2f5a26', x + bend * 4 * t * t - 1.1, y, 2.2, 0.8); }
      for (let k = 0; k < 6; k++) {
        const t = 0.45 + k * 0.1, lx = x + bend * 4 * t * t, ly = -h * t;
        const dir = k % 2 ? 1 : -1;
        c.fillStyle = winter ? (k % 3 ? '#4f7f52' : '#5f8f60') : (k % 3 ? '#5a9a40' : '#7cbc58');
        c.beginPath(); c.ellipse(lx + dir * 3.6, ly + 1.2, 4.2, 1.1, dir * 0.45, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(lx + dir * 2.6, ly + 2.6, 3.4, 0.9, dir * 0.7, 0, Math.PI * 2); c.fill();
        if (winter && k % 2 === 0) { c.fillStyle = '#eef2f7'; c.beginPath(); c.ellipse(lx + dir * 3.2, ly + 0.5, 2.6, 0.7, dir * 0.45, 0, Math.PI * 2); c.fill(); }
      }
    }
  }

  // 그리기 진입점: 북쪽 꼭짓점이 원점인 문맥에 그린다
  function draw(c, type, w, h, season, state, extra, rnd) {
    const snow = season === 3;
    const o = { snow, season, rnd, mask: 0 };
    if (state === 'build') construction(c, type, w, h, clamp(parseFloat(extra) || 0, 0, 1), o);
    else if (state === 'ruin') ruin(c, type, w, h, o);
    else {
      if (extra && /^\d+$/.test(extra)) o.mask = parseInt(extra, 10);
      (B[type] || B.house)(c, o);
    }
  }
  // 길목 이정표 기둥: 원점 = 기둥 밑동. 받침돌, 기둥, 오른쪽 팔에 등롱. 문장 판은 렌더러가 기둥 끝에 얹는다
  function exitPost(c, snow) {
    ell(c, 'rgba(0,0,0,0.26)', 2, 1, 8, 3);
    box(c, -0.1, -0.1, 0.1, 0.1, 0, 3, PAL.stone, { top: snow ? '#eef2f7' : PAL.stoneLight });
    post(c, 0, 0, 3, EXIT_POST_H, 0.04, '#5e3e22', { top: '#3b2414' });
    seg3(c, '#3b2414', 1, [0.03, 0, 22], [0.22, 0, 22]);
    lanternAt(c, 0.2, 0, 22, 0.62);
    if (snow) ell(c, '#f2f5f9', 0, Y(0, 0, EXIT_POST_H) - 0.6, 2, 0.8);
  }
  return { draw, tree, hashStr, X, Y, exitPost };
})();

// ── 캐시와 공개 함수 ─────────────────────────
const SpriteCache = new Map();
let _spriteScratch = null;
// 반환: {c, ox, oy, w, h} — 캔버스를 발판 북쪽 꼭짓점 worldOf(b.x, b.y) + (ox, oy) 에 (w, h) 크기로 그린다
function buildingSprite(type, w, h, season, state, extra = '') {
  // 공사·폐허는 눈만 계절을 탄다
  const sKey = state === 'done' ? season : (season === 3 ? 3 : 0);
  const key = `${type}|${w}x${h}|${sKey}|${state}|${extra}`;
  let s = SpriteCache.get(key);
  if (s) return s;
  const meta = SPRITE_META[type] || { height: 60 };
  const padX = 64, top = Math.ceil(meta.height + 48), padB = 28;
  const cw = Math.ceil((w + h) * 32 + padX * 2), ch = Math.ceil((w + h) * 16 + top + padB);
  if (!_spriteScratch) _spriteScratch = document.createElement('canvas');
  const sc = _spriteScratch;
  if (sc.width < cw * SS || sc.height < ch * SS) { sc.width = Math.max(sc.width, cw * SS); sc.height = Math.max(sc.height, ch * SS); }
  const c = sc.getContext('2d', { willReadFrequently: true });
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, sc.width, sc.height);
  c.setTransform(SS, 0, 0, SS, 0, 0);
  const ox0 = padX + h * 32, oy0 = top;
  c.translate(ox0, oy0);
  const rnd = mulberry32(IsoArt.hashStr(key));
  IsoArt.draw(c, type, w, h, season, state, extra, rnd);
  c.setTransform(1, 0, 0, 1, 0, 0);
  // 빈 곳을 잘라 낸다
  const W = cw * SS, Hh = ch * SS;
  const data = c.getImageData(0, 0, W, Hh).data;
  let x0 = W, y0 = Hh, x1 = -1, y1 = -1;
  for (let y = 0; y < Hh; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (data[row + x * 4 + 3] > 3) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = SS; y1 = SS; }
  x0 = Math.max(0, x0 - 2) & ~1; y0 = Math.max(0, y0 - 2) & ~1;
  x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(Hh - 1, y1 + 2);
  const bw = Math.ceil((x1 - x0 + 1) / SS) * SS, bh = Math.ceil((y1 - y0 + 1) / SS) * SS;
  const cv = document.createElement('canvas');
  cv.width = bw; cv.height = bh;
  cv.getContext('2d').drawImage(sc, x0, y0, bw, bh, 0, 0, bw, bh);
  s = { c: cv, ox: x0 / SS - ox0, oy: y0 / SS - oy0, w: bw / SS, h: bh / SS };
  SpriteCache.set(key, s);
  return s;
}

// ── 나무 ─────────────────────────────────
function treeKind(v) { return v < 120 ? 'pine' : v < 215 ? 'leaf' : 'bamboo'; }
const TreeCache = new Map();
// 반환: {c, w, h, ax, ay} — 타일 중심 worldOf(tx + 0.5, ty + 0.5) 에서 (-ax, -ay) 만큼 옮겨 그린다
function treeSprite(v, season) {
  const kind = treeKind(v);
  const variant = v % 6;
  const key = `${kind}|${season}|${variant}`;
  let s = TreeCache.get(key);
  if (!s) { s = IsoArt.tree(kind, season, variant); TreeCache.set(key, s); }
  return s;
}

// ── 사람 ─────────────────────────────────
// L: 생김새, P: 자세. (x, y) = 발 위치
function drawFigure(c, x, y, L, P) {
  c.save();
  c.translate(x, y);
  ell(c, 'rgba(0,0,0,0.28)', 0, 0, 5.5, 2);
  if (P.down) {
    c.rotate(-Math.PI / 2 * (P.dir || 1));
    c.translate(0, -1);
    rr(c, L.cloth, -4, -12, 8, 9);
    circ(c, L.skin, 0, -15, 3);
    rr(c, '#7a1a12', -3, -9, 3, 2);
    c.restore();
    return;
  }
  if (P.dir < 0) c.scale(-1, 1);
  const moving = P.moving;
  const sw = moving ? Math.sin(P.walk) : 0;
  const bob = moving ? Math.abs(Math.cos(P.walk)) * 0.8 : 0;
  c.translate(0, -bob);
  // 다리
  rr(c, L.pants, -3 + sw * 1.2, -5, 2.4, 5);
  rr(c, L.pants, 0.8 - sw * 1.2, -5, 2.4, 5);
  rr(c, '#2a1e16', -3.4 + sw * 1.2, -1.2, 3, 1.4);
  rr(c, '#2a1e16', 0.6 - sw * 1.2, -1.2, 3, 1.4);
  // 뒷팔
  const armSw = moving ? -sw * 2.2 : 0;
  rr(c, L.cloth, -4.6 + armSw * 0.3, -12, 2, 6);
  // 몸통(도포)
  c.fillStyle = L.cloth;
  c.beginPath(); c.moveTo(-3.6, -12.8); c.lineTo(3.6, -12.8); c.lineTo(4.6, -3.6); c.lineTo(-4.6, -3.6); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath(); c.moveTo(1, -12.8); c.lineTo(3.6, -12.8); c.lineTo(4.6, -3.6); c.lineTo(1.6, -3.6); c.closePath(); c.fill();
  // 깃
  c.strokeStyle = L.collar || '#efe6d4'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-1.6, -12.6); c.lineTo(0.8, -9.4); c.lineTo(2.6, -12.6); c.stroke();
  const bald = L.hat === 'bald';
  if (bald) {
    // 승복: 왼어깨에서 비스듬히 두른 가사
    c.fillStyle = L.cloth2;
    c.beginPath(); c.moveTo(-3.6, -12.8); c.lineTo(-1.2, -12.8); c.lineTo(4.3, -5.4); c.lineTo(4.5, -3.6); c.lineTo(2.2, -3.6); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,230,160,0.35)'; c.lineWidth = 0.4;
    c.beginPath(); c.moveTo(-2.4, -12.6); c.lineTo(3.4, -4.4); c.stroke();
  }
  rr(c, L.cloth2, -4, -8.6, 8.2, 1.6);
  // 머리
  circ(c, L.skin, 0.3, -15.6, 3.1);
  rr(c, '#1a120c', 1.6, -16.2, 0.9, 0.9);
  if (bald) {
    // 깎은 머리: 정수리의 빛과 계점
    c.fillStyle = L.skin; c.beginPath(); c.arc(0.1, -16.1, 3.25, Math.PI * 1.02, Math.PI * 2.05); c.fill();
    c.fillStyle = 'rgba(90,60,40,0.18)'; c.beginPath(); c.arc(0.1, -16.1, 3.25, Math.PI * 1.02, Math.PI * 1.45); c.lineTo(0.1, -16.1); c.fill();
    ell(c, 'rgba(255,246,230,0.55)', 0.6, -18.2, 1.3, 0.7);
    for (const dx of [-0.9, 0.3, 1.5]) circ(c, 'rgba(110,60,40,0.55)', dx, -18.9, 0.22);
  } else {
    c.fillStyle = L.hair;
    c.beginPath(); c.arc(0, -16.2, 3.25, Math.PI * 1.02, Math.PI * 2.05); c.fill();
    if (L.sex === 'f') { circ(c, L.hair, -2.8, -15.4, 1.9); rr(c, L.hair, -3.3, -15.6, 1.4, 3.4); }
    else if (!L.hat || L.hat === 'band') circ(c, L.hair, -0.4, -19.4, 1.4);
  }
  // 모자
  if (L.hat === 'straw') {
    c.fillStyle = '#cfb072';
    c.beginPath(); c.moveTo(-7.2, -16.4); c.lineTo(0, -22.6); c.lineTo(7.2, -16.4); c.quadraticCurveTo(0, -15.4, -7.2, -16.4); c.fill();
    line(c, '#8f7340', 0.6, -7, -16.4, 7, -16.4);
  } else if (L.hat === 'farmer') {
    ell(c, '#c9a862', 0, -18.6, 4.6, 1.4); rr(c, '#b8954e', -2.2, -21, 4.4, 2.6);
  } else if (L.hat === 'band') {
    rr(c, L.cloth2, -3.2, -18, 6.6, 1.3);
    line(c, L.cloth2, 0.8, -3, -17.4, -5.4, -15.2);
  } else if (L.hat === 'hood') {
    c.fillStyle = L.cloth2; c.beginPath(); c.arc(0, -16, 3.7, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    rr(c, L.cloth2, -3.8, -16, 2.2, 4);
  } else if (L.hat === 'mask') {
    c.fillStyle = L.hair; c.beginPath(); c.arc(0, -16.2, 3.4, Math.PI, Math.PI * 2); c.fill();
    rr(c, L.cloth2, -0.6, -15.3, 4, 2.6);
  } else if (L.hat === 'helmet') {
    c.fillStyle = '#6a5a3a'; c.beginPath(); c.arc(0, -16.6, 3.6, Math.PI, Math.PI * 2); c.fill();
    rr(c, '#c79a2c', -0.5, -22, 1, 2.6);
  } else if (L.hat === 'guard') {
    c.fillStyle = '#2a2a30'; c.beginPath(); c.arc(0, -16.8, 3.5, Math.PI, Math.PI * 2); c.fill();
    rr(c, '#2a2a30', -4.2, -17.2, 8.4, 1.1);
  } else if (L.hat === 'fur') {
    // 털모자: 천 정수리, 털 테두리, 뒤로 늘어진 귀덮개와 꼬리
    const fur = '#e6dcc6', furD = '#b8ab92';
    c.fillStyle = L.cloth2; c.beginPath(); c.arc(0, -17.4, 3.4, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(3.3, -17.6); c.lineTo(-3.3, -17.6); c.fill();
    rr(c, 'rgba(255,255,255,0.16)', -1.8, -20.4, 2, 0.8);
    ell(c, furD, -2.9, -14.8, 1.5, 2.3);
    ell(c, fur, -3.1, -15.2, 1.2, 2);
    ell(c, furD, 0, -17.1, 4.5, 1.5);
    ell(c, fur, 0, -17.5, 4.3, 1.25);
    for (const dx of [-3.4, -1.7, 0, 1.7, 3.4]) circ(c, fur, dx, -16.4, 0.65);
    circ(c, furD, -2.2, -21, 1); circ(c, fur, -2.4, -21.2, 0.8);
  }
  // 앞팔 + 들고 있는 것
  const act = P.action;
  let ang = 0.15 + armSw * 0.15;
  if (act === 'attack') ang = -1.9 + P.phase * 2.8;
  else if (act === 'work') ang = -1.4 + Math.abs(Math.sin(P.phase * Math.PI)) * 1.8;
  else if (act === 'bow') ang = -1.3;
  else if (P.torch) ang = -1.1;
  c.save();
  c.translate(1.5, -11.5);
  c.rotate(ang);
  rr(c, L.cloth, -1, 0, 2.2, 5.6);
  circ(c, L.skin, 0.1, 6, 1.2);
  const held = act === 'work' ? P.tool : (P.torch ? 'torch' : (act === 'attack' || P.armed ? L.weapon : null));
  if (held) drawHeld(c, held);
  c.restore();
  // 등/허리에 찬 무기
  if (!P.armed && act !== 'attack' && L.weapon && L.weapon !== 'bow') {
    if (L.weapon === 'spear') line(c, '#6b4428', 1, -3.5, -2, 2.5, -23);
    else if (L.weapon === 'staff') { line(c, '#7a4a28', 1.1, -4.6, -1.5, 3, -24); circ(c, '#c9a35a', 2.9, -23.8, 0.6); }
    else line(c, '#2a2420', 1.3, -2.5, -7.5, -6.5, -2);
  }
  c.restore();
}
function drawHeld(c, kind) {
  switch (kind) {
    case 'sword': line(c, '#3a2a1a', 1.4, 0, 5, 0, 7.5); rr(c, '#c9a35a', -1.6, 7, 3.2, 0.9); line(c, '#e3e8ec', 1.1, 0, 7.6, 0, 17); break;
    case 'blade': line(c, '#3a2a1a', 1.4, 0, 5, 0, 7.5); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(-0.8, 7.5); c.lineTo(1.6, 7.5); c.quadraticCurveTo(2.4, 13, 0, 16.5); c.lineTo(-0.8, 7.5); c.fill(); break;
    case 'spear': line(c, '#6b4428', 1, 0, -6, 0, 18); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(-1.2, 18); c.lineTo(1.2, 18); c.lineTo(0, 22); c.fill(); rr(c, '#b53a2c', -1, 17, 2, 1); break;
    case 'axe': line(c, '#6b4428', 1.2, 0, 4, 0, 13); rr(c, '#9aa2a8', -0.5, 10.5, 4, 3); break;
    case 'hoe': line(c, '#6b4428', 1.1, 0, 3, 0, 14); rr(c, '#7a8288', -3.5, 13, 4, 1.6); break;
    case 'pick': line(c, '#6b4428', 1.1, 0, 3, 0, 13); c.strokeStyle = '#7a8288'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-3.5, 11); c.quadraticCurveTo(0, 14, 3.5, 11); c.stroke(); break;
    case 'hammer': line(c, '#6b4428', 1.1, 0, 4, 0, 11); rr(c, '#5a626a', -2, 10, 4, 3); break;
    case 'rod': line(c, '#8a6a3a', 0.8, 0, 3, 0, 20); break;
    case 'bow': c.strokeStyle = '#6b4428'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 8, 6, -1.2, 1.2); c.stroke(); line(c, '#e0d8c8', 0.4, 2.2, 2.4, 2.2, 13.6); break;
    case 'fist': circ(c, '#e8c09a', 0, 6.6, 1.6); break;
    case 'staff': line(c, '#7a4a28', 1.2, 0, -9, 0, 21); rr(c, '#c9a35a', -0.8, 19.6, 1.6, 1.6); rr(c, '#c9a35a', -0.8, -9.6, 1.6, 1.6); line(c, 'rgba(255,220,170,0.35)', 0.4, -0.3, -8, -0.3, 19); break;
    case 'torch': line(c, '#5a3a20', 1.3, 0, 3, 0, 11); circ(c, '#ffb040', 0, 12.5, 2.2); circ(c, '#fff0a0', 0, 12.2, 1.1); break;
    default: break;
  }
}

// 생김새 만들기
const SKINS = ['#f0c9a0', '#e6b78e', '#dcab80', '#efc39a'];
const CLOTH_M = ['#cfc3a8', '#a89a7c', '#8c7b62', '#b9b3a0', '#7d8a6a', '#9a8f80', '#c8bca0'];
const CLOTH_F = ['#d99a9a', '#c7b3d6', '#a8c4d6', '#e2c99a', '#b5d0a8', '#e8c0c8', '#d6c4a0'];
const HERO_CLOTH = ['#e9e4d8', '#2d3b4f', '#5a2d2d', '#2f4a3a', '#4a3a5a', '#1e1e22', '#8a6a3a'];
function makeLook(kind, sex, extra = {}) {
  const L = {
    sex, skin: pick(SKINS), hair: extra.old ? '#a8a49a' : pick(['#1c1612', '#2a211b', '#16110d']),
    cloth: sex === 'f' ? pick(CLOTH_F) : pick(CLOTH_M), cloth2: pick(['#5a4a3a', '#3a3029', '#6a5a48', '#8a3a2a']),
    pants: '#4a3f36', hat: null, weapon: null, collar: '#efe6d4',
  };
  if (kind === 'civ') { if (sex === 'm' && Math.random() < 0.3) L.hat = 'farmer'; }
  else if (kind === 'hero') {
    L.cloth = pick(HERO_CLOTH); L.cloth2 = pick(['#b53a2c', '#d6a63a', '#3b6ea5', '#1e1e22']);
    L.hat = Math.random() < 0.5 ? 'straw' : 'band'; L.weapon = extra.weapon || pick(['sword', 'blade', 'sword', 'spear', 'fist']);
    L.pants = '#2a2420';
  } else if (kind === 'faction') {
    const u = FACTIONS[extra.faction].unit;
    L.cloth = u.cloth; L.cloth2 = u.cloth2; L.hat = u.hat; L.weapon = u.weapon; L.pants = '#2a2420';
    // 우두머리: 세력 빛깔의 짙은 옷, 모자는 leader.hat 이 있으면 그것 (흑풍채주는 band)
    if (extra.leader) { const F = FACTIONS[extra.faction]; L.hat = F.leader.hat || u.hat; L.cloth = F.dark; L.collar = u.cloth2; }
  }
  return L;
}
function applyRoleLook(v) {
  const L = v.look;
  if (v.hero) return;
  if (v.role === 'guard') {
    L.cloth = '#3d5a7a'; L.cloth2 = '#1e2a38'; L.hat = 'guard'; L.weapon = v.jobType === 'tower' ? 'bow' : (v.jobType === 'escort' ? 'blade' : 'spear'); L.pants = '#2a2a30';
    if (v.jobType === 'escort') { L.cloth = '#7a2e22'; L.cloth2 = '#d6a63a'; L.hat = 'band'; }
  } else {
    if (L.weapon) { L.weapon = null; }
    if (L.hat === 'guard' || L.hat === 'band') L.hat = null;
    if (L.cloth === '#3d5a7a' || L.cloth === '#7a2e22') L.cloth = v.sex === 'f' ? pick(CLOTH_F) : pick(CLOTH_M);
    L.cloth2 = L.cloth2 === '#1e2a38' ? '#5a4a3a' : L.cloth2;
    L.pants = '#4a3f36';
  }
}

// ── 세력 문장과 길목 표지 ─────────────────────
// 문장: 세력 빛깔의 둥근 인장에 문장 글자. 64px 캔버스 { c, w, h } (SpriteCache 에 두니 글꼴이 오면 다시 그린다)
function sealSprite(id) {
  const key = 'seal|' + id;
  let s = SpriteCache.get(key);
  if (s) return s;
  const F = FACTIONS[id] || { color: '#7a6a5a', dark: '#2a2018', hanja: '?' };
  const N = 64, m = N / 2, cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const c = cv.getContext('2d');
  const [r, g, b] = [1, 3, 5].map(i => parseInt(F.color.slice(i, i + 2), 16));
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
  circ(c, 'rgba(20,12,6,0.4)', m + 1.2, m + 2, 29.5);
  circ(c, F.dark, m, m, 30);
  circ(c, F.color, m, m, 26.5);
  c.strokeStyle = light ? 'rgba(40,28,16,0.55)' : 'rgba(244,232,200,0.8)'; c.lineWidth = 1.6;
  c.beginPath(); c.arc(m, m, 23, 0, Math.PI * 2); c.stroke();
  const hl = c.createLinearGradient(0, m - 26, 0, m + 26);
  hl.addColorStop(0, 'rgba(255,255,255,0.22)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.18)');
  c.fillStyle = hl; c.beginPath(); c.arc(m, m, 26.5, 0, Math.PI * 2); c.fill();
  c.font = '31px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; c.fillText(F.hanja, m + 1, m + 2.6);
  c.fillStyle = light ? F.dark : '#fbf3de'; c.fillText(F.hanja, m, m + 1.6);
  s = { c: cv, w: N, h: N };
  SpriteCache.set(key, s);
  return s;
}
// 길목 이정표 기둥: { c, w, h, ax, ay } — 밑동 (ax, ay) 을 땅 위 점에 맞춰 그린다. 기둥 끝은 밑동에서 EXIT_POST_H 위
const EXIT_POST_H = 30;
function exitPostSprite(snow) {
  const key = 'exitpost|' + (snow ? 1 : 0);
  let s = SpriteCache.get(key);
  if (s) return s;
  const w = 30, h = EXIT_POST_H + 12, ax = 12, ay = h - 6;
  const cv = document.createElement('canvas');
  cv.width = w * SS; cv.height = h * SS;
  const c = cv.getContext('2d');
  c.scale(SS, SS); c.translate(ax, ay);
  IsoArt.exitPost(c, snow);
  s = { c: cv, w, h, ax, ay };
  SpriteCache.set(key, s);
  return s;
}

// 건설 메뉴 아이콘: 건물 그림 전체가 상자 안에 들어오게 줄여 그린다
function iconCanvas(key, w = 48, h = 36) {
  const cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const c = cv.getContext('2d');
  c.scale(2, 2);
  if (BDEF[key]) {
    const def = BDEF[key];
    const s = buildingSprite(key, def.w, def.h, 1, 'done', def.line ? '10' : '');
    const sc = Math.min(w / s.w, h / s.h) * 0.96;
    c.imageSmoothingQuality = 'high';
    c.drawImage(s.c, (w - s.w * sc) / 2, (h - s.h * sc) / 2, s.w * sc, s.h * sc);
  } else {
    const t = TOOLS[key];
    c.fillStyle = key === 'demolish' ? '#6e2a20' : key === 'clear' ? '#2f5a3a' : '#8a6a44';
    c.beginPath(); c.arc(w / 2, h / 2, 15, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(216,169,68,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.arc(w / 2, h / 2, 13.5, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#f5e7c8'; c.font = '18px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t.hanja, w / 2, h / 2 + 1);
  }
  return cv;
}
