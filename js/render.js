'use strict';
// ───────────────────────────────────────────────
// 화면 그리기: 등각(2.5D) 투영, 지형 캐시, 깊이 정렬, 낮밤 조명, 효과, 오버레이, 미니맵
// 규격은 docs/architecture.md 2.1 — 마름모 타일 64×32, worldOf(x, y) = ((x - y) * 32, (x + y) * 16)
// ───────────────────────────────────────────────
// 그림 모듈과 함께 쓰는 상수. 그쪽에서 먼저 선언했으면 그대로 둔다.
if (typeof TW === 'undefined') window.TW = 64;
if (typeof TH === 'undefined') window.TH = 32;
// 이 파일 안에서만 쓰는 값 (다른 모듈과 이름이 겹치지 않게 REN_ / ren 접두)
const REN_FIG = 1.18;              // 사람 그림 배율: 64px 마름모 위에서도 사람이 잘 보이게
const REN_ZMIN = 0.35, REN_ZMAX = 2.2;
const REN_WATER = 6;               // 물은 땅보다 이만큼 낮다
const REN_EDGE = 30;               // 지도 앞 가장자리 흙벽 높이
const REN_DECK = 56;               // 망루 발판 높이 (타일 중심 위)
const REN_LIFT = 36;               // 지형이 땅 위로 솟는 최대치 (바위 + 바윗돌)
const REN_DROP = 130;              // 지형이 땅 아래로 처지는 최대치 (가장자리 벽, 폭포, 운해)
const REN_PAD_X = 170, REN_PAD_T = 80, REN_PAD_B = 170;
const REN_SQ2 = Math.SQRT2;

const Cam = { x: 0, y: 0, zoom: 0.85, vw: 800, vh: 600, dpr: 1 };
const R = {
  canvas: null, ctx: null, light: null, lctx: null, terrain: null, tctx: null,
  mini: null, mctx: null, miniBase: null, miniT: 0,
  weather: [], lastT: 0, season: -1, now: 0,
  tox: 0, toy: 0,                         // 지형 캐시 왼쪽 위 모서리의 월드 좌표
  rockH: null, noise: null, tSnap: null, rSnap: null, snapS: null, snapSeed: -1,
  view: { x0: 0, y0: 0, x1: 0, y1: 0 },   // 지금 보이는 월드 사각형
  stamp: null, frame: 1,                  // 바위 덮개 중복 방지
  grounds: [], lights: [], lightN: 0, hole: null, glow: new Map(),
  crests: [],                             // 길목 표지 (그 프레임에 보이는 것만 on)
};
// 일시적인 효과 (저장하지 않음)
const G = { fx: [], particles: [], projectiles: [] };

function initRender() {
  R.canvas = document.getElementById('game');
  R.ctx = R.canvas.getContext('2d');
  R.light = document.createElement('canvas');
  R.lctx = R.light.getContext('2d');
  R.tox = -MH * 32 - REN_PAD_X; R.toy = -REN_PAD_T;
  R.terrain = document.createElement('canvas');
  R.terrain.width = (MW + MH) * 32 + REN_PAD_X * 2;
  R.terrain.height = (MW + MH) * 16 + REN_PAD_T + REN_PAD_B;
  R.tctx = R.terrain.getContext('2d');
  R.rockH = new Uint8Array(MW * MH);
  R.tSnap = new Uint8Array(MW * MH); R.rSnap = new Uint8Array(MW * MH);
  R.stamp = new Int32Array(MW * MH);
  R.mini = document.getElementById('minimap');
  R.mctx = R.mini.getContext('2d');
  R.miniBase = document.createElement('canvas');
  R.miniBase.width = MW * 2; R.miniBase.height = MH * 2;
  resizeCanvas();
}
function resizeCanvas() {
  Cam.dpr = Math.min(window.devicePixelRatio || 1, 2);
  Cam.vw = window.innerWidth; Cam.vh = window.innerHeight;
  R.canvas.width = Math.round(Cam.vw * Cam.dpr);
  R.canvas.height = Math.round(Cam.vh * Cam.dpr);
  R.light.width = Math.max(1, Math.round(Cam.vw / 2)); R.light.height = Math.max(1, Math.round(Cam.vh / 2));
}
function screenToWorld(sx, sy) {
  return { x: (sx - Cam.vw / 2) / Cam.zoom + Cam.x, y: (sy - Cam.vh / 2) / Cam.zoom + Cam.y };
}
function worldToScreen(wx, wy) {
  return { x: (wx - Cam.x) * Cam.zoom + Cam.vw / 2, y: (wy - Cam.y) * Cam.zoom + Cam.vh / 2 };
}

// ── 투영 계층 ─────────────────────────────
// 게임 논리(sim·units·story·admin…)는 타일 좌표만 쓴다. 타일 ↔ 월드 픽셀 ↔ 화면 픽셀 변환은 여기서만 한다.
// 타일 x + 1 은 화면 오른쪽 아래, y + 1 은 왼쪽 아래. 월드 원점 = 타일 (0, 0)의 북쪽 꼭짓점.
function worldOf(tx, ty) { return { x: (tx - ty) * 32, y: (tx + ty) * 16 }; }
function tileOfWorld(wx, wy) { return { x: wy / 32 + wx / 64, y: wy / 32 - wx / 64 }; }
function screenToTile(sx, sy) { const w = screenToWorld(sx, sy); return tileOfWorld(w.x, w.y); }
function tileToScreen(tx, ty) { const w = worldOf(tx, ty); return worldToScreen(w.x, w.y); }
function centerOnTile(tx, ty) { const w = worldOf(tx, ty); Cam.x = w.x; Cam.y = w.y; clampCamera(); }

// 카메라: 화면 가운데가 늘 마름모 지도 위에 있게. 지도가 화면보다 작으면 가운데에 둔다.
function clampCamera() {
  Cam.zoom = clamp(Cam.zoom, REN_ZMIN, REN_ZMAX);
  const t = tileOfWorld(Cam.x, Cam.y);
  const tx = clamp(t.x, 0, MW), ty = clamp(t.y, 0, MH);
  if (tx !== t.x || ty !== t.y) { Cam.x = (tx - ty) * 32; Cam.y = (tx + ty) * 16; }
  const mx0 = -MH * 32, mx1 = MW * 32, my1 = (MW + MH) * 16;
  if ((mx1 - mx0) * Cam.zoom <= Cam.vw) Cam.x = (mx0 + mx1) / 2;
  if ((my1 + REN_EDGE) * Cam.zoom <= Cam.vh - 120) Cam.y = my1 / 2;
}

// 화면 좌표에서 사람(우선) 또는 건물을 고른다: {u} | {b} | null
// 건물은 보이는 모습 그대로(그림의 불투명한 픽셀) 앞에 있는 것부터 고른다.
function pickAt(sx, sy) {
  if (!S) return null;
  // 사람은 몸통 모양(세로로 긴 타원)으로 고른다. 일꾼이 선 논밭도 눌러지도록 너무 넓게 잡지 않는다.
  const fz = REN_FIG * Cam.zoom, rx = Math.max(6, 8 * fz), ry = Math.max(9, 14 * fz);
  let best = null, bd = 1;
  for (const arr of [S.enemies, S.allies, S.villagers]) for (const u of arr) {
    if (renGone(u)) continue;
    const p = worldToScreen((u.x - u.y) * 32 + renJx(u), (u.x + u.y) * 16 + renJy(u));
    const d = Math.hypot((p.x - sx) / rx, (p.y - 11 * fz - sy) / ry);
    if (d < bd) { bd = d; best = u; }
  }
  if (best) return { u: best };
  const w = screenToWorld(sx, sy), t = tileOfWorld(w.x, w.y);
  const season = renSeason();
  let pick = null, pk = -Infinity;
  for (const b of S.buildings) {
    const s = renSpriteOf(b, season);
    const nx = (b.x - b.y) * 32, ny = (b.x + b.y) * 16;
    const lx = w.x - (nx + s.ox), ly = w.y - (ny + s.oy);
    const inBox = lx >= 0 && ly >= 0 && lx < s.w && ly < s.h;
    const onFoot = t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h;
    // 영주관 깃발은 그림 밖에 따로 그리니 깃폭·깃대도 영주관으로 친다
    const onFlag = b.type === 'manor' && b.done && !b.ruined && renFlagHit(b, w.x, w.y);
    if (!inBox && !onFoot && !onFlag) continue;
    let hit = onFoot || onFlag;
    if (!hit) {
      const a = renSpriteAlpha(s, lx, ly);
      hit = a < 0 ? renPrismHit(b, w.x, w.y, Math.max(10, -s.oy - 6)) : a > 30;
    }
    if (!hit) continue;
    // 땅에 붙은 건물(논밭)은 가장 뒤
    const k = (BDEF[b.type].ground && b.done && !b.ruined) ? -1000 + renKeyOf(b) : renKeyOf(b);
    if (k > pk) { pk = k; pick = b; }
  }
  return pick ? { b: pick } : null;
}
// 그림의 알파 마스크 (한 번 읽어 캐시). 읽을 수 없으면 -1
const REN_MASK = new WeakMap();
function renSpriteAlpha(s, px, py) {
  let m = REN_MASK.get(s.c);
  if (m === undefined) {
    m = null;
    try {
      const cw = s.c.width, ch = s.c.height;
      const k = Math.max(1, Math.round(cw / Math.max(1, s.w)));
      const d = s.c.getContext('2d').getImageData(0, 0, cw, ch).data;
      const mw = Math.ceil(cw / k), mh = Math.ceil(ch / k);
      const a = new Uint8Array(mw * mh);
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) a[y * mw + x] = d[((y * k) * cw + x * k) * 4 + 3];
      m = { a, mw, mh, fx: mw / s.w, fy: mh / s.h };
    } catch (e) { m = null; }
    REN_MASK.set(s.c, m);
  }
  if (!m) return -1;
  const cx = Math.floor(px * m.fx), cy = Math.floor(py * m.fy);
  let best = 0;
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
    if (x < 0 || y < 0 || x >= m.mw || y >= m.mh) continue;
    const v = m.a[y * m.mw + x];
    if (v > best) best = v;
  }
  return best;
}
// 발판 마름모를 높이 H만큼 위로 늘린 육각형 안에 있는가 (알파를 못 읽을 때)
function renPrismHit(b, wx, wy, H) {
  const N = worldOf(b.x, b.y), E = worldOf(b.x + b.w, b.y), Sx = worldOf(b.x + b.w, b.y + b.h), W = worldOf(b.x, b.y + b.h);
  const pts = [W.x, W.y - H, N.x, N.y - H, E.x, E.y - H, E.x, E.y, Sx.x, Sx.y, W.x, W.y];
  for (let i = 0; i < 6; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[(i * 2 + 2) % 12], by = pts[(i * 2 + 3) % 12];
    if ((bx - ax) * (wy - ay) - (by - ay) * (wx - ax) < 0) return false;
  }
  return true;
}

// ── 색과 난수 도구 ───────────────────────────
const REN_RGB = new Map();
function renRgb(hex) {
  let v = REN_RGB.get(hex);
  if (!v) { const n = parseInt(hex.slice(1), 16); v = [n >> 16, (n >> 8) & 255, n & 255]; REN_RGB.set(hex, v); }
  return v;
}
function renMix(a, b, t) {
  const A = renRgb(a), B = renRgb(b);
  t = clamp(t, 0, 1);
  return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`;
}
function renShade(a, f) {
  const A = renRgb(a);
  return `rgb(${clamp(A[0] * f, 0, 255) | 0},${clamp(A[1] * f, 0, 255) | 0},${clamp(A[2] * f, 0, 255) | 0})`;
}
function renHex(a, f) { // 밝기를 바꾼 #rrggbb (renMix의 입력용)
  const A = renRgb(a);
  const h = n => clamp(Math.round(n * f), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(A[0]) + h(A[1]) + h(A[2]);
}
function renEll(c, col, x, y, rx, ry) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function renBox(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
const REN_GOLD = '#d8a944';
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
// 칸마다 늘 같은 값이 나오는 난수 (지형 캐시를 부분만 다시 그려도 똑같이)
function renHash(i, k) {
  let h = (Math.imul(i + 0x9e37, 374761393) + Math.imul(k + 0x85eb, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
// 타일 안의 점 (u, v ∈ 0..1) → 월드
function renPt(tx, ty, u, v) { return [(tx + u - ty - v) * 32, (tx + u + ty + v) * 16]; }
// 타일 마름모 경로 (nx, ny = 북쪽 꼭짓점). e = 바깥으로 넓힐 픽셀 (틈 메우기)
function renDia(c, nx, ny, e) {
  c.beginPath();
  c.moveTo(nx, ny - e * 0.5); c.lineTo(nx + 32 + e, ny + 16); c.lineTo(nx, ny + 32 + e * 0.5); c.lineTo(nx - 32 - e, ny + 16);
  c.closePath();
}
// 건물 발판 마름모 (타일 좌표, inset = 안쪽으로 줄일 칸 수)
function renFootPath(c, x, y, w, h, inset) {
  const ax = x + inset, ay = y + inset, bx = x + w - inset, by = y + h - inset;
  c.beginPath();
  c.moveTo((ax - ay) * 32, (ax + ay) * 16);
  c.lineTo((bx - ay) * 32, (bx + ay) * 16);
  c.lineTo((bx - by) * 32, (bx + by) * 16);
  c.lineTo((ax - by) * 32, (ax + by) * 16);
  c.closePath();
}
function renRoundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
// 그릴 철: 겨울이 없는 고을(isWinter 가 거짓)의 넷째 철은 눈 대신 가을로 그린다 (땅·나무·건물·날씨 모두)
function renSeason() {
  const s = seasonIdx();
  return s === 3 && typeof isWinter === 'function' && !isWinter(s) ? 2 : s;
}
// 그리지 않는 사람: 죽었거나 건물 안, 또는 의뢰로 길목 밖에 나가 있는 이(v.away.gone)
function renGone(u) { return u.dead || u.inside || !!(u.away && u.away.gone); }
// 화면 픽셀 → 월드 픽셀 (확대와 상관없이 비슷한 굵기·크기로)
function renPx(n) { return n / Cam.zoom; }
function renJx(u) { return (u.ox || 0) * 0.9; }
function renJy(u) { return (u.oy || 0) * 0.6; }

// ── 지형 캐시 ─────────────────────────────
// 계절 바탕색: grass = [보통, 짙음, 옅음], rock = [보통, 밝음, 어두움]
const GROUND_PAL = [
  { grass: ['#8dbb5c', '#83b153', '#97c464'], floor: '#6c9a47', dirt: '#b39468', sand: '#dcc994', rock: ['#86827a', '#9d998f', '#6a675f'], water: '#3d7ea8', deep: '#2c6890', shore: '#9fd0e6', soil: '#6a5038' },
  { grass: ['#6fa648', '#669c40', '#79b04f'], floor: '#4e7e37', dirt: '#ad8c5f', sand: '#d8c48c', rock: ['#827e76', '#9a968c', '#66635c'], water: '#367599', deep: '#265f82', shore: '#94c8e0', soil: '#644a33' },
  { grass: ['#aaa758', '#a09c4d', '#b6b162'], floor: '#8a7a42', dirt: '#ad8a5c', sand: '#d6c08a', rock: ['#858077', '#9c978c', '#69655d'], water: '#3a7294', deep: '#2a5c7c', shore: '#9cc4d6', soil: '#674b33' },
  { grass: ['#e4e9ed', '#d9e0e6', '#eef1f4'], floor: '#c8d1d6', dirt: '#cfc6b8', sand: '#e6e0d2', rock: ['#9a9aa0', '#b4b4ba', '#7c7c84'], water: '#4b7894', deep: '#3d6680', shore: '#e8f2f8', soil: '#5c4d40' },
];
function renIsWater(x, y) { return !World.inb(x, y) || World.tiles[y * MW + x] === T.WATER; }
function renIsGrass(x, y) { return World.inb(x, y) && World.tiles[y * MW + x] === T.GRASS && !World.road[y * MW + x]; }
// 바위 높이: 바위산 안쪽일수록 높다 (10~18px)
function renRockHeights() {
  const H = R.rockH, tiles = World.tiles;
  const rockAt = (x, y) => !World.inb(x, y) || tiles[y * MW + x] === T.ROCK;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (tiles[i] !== T.ROCK) { H[i] = 0; continue; }
    let ring = 2;
    for (let dy = -2; dy <= 2 && ring > 0; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!rockAt(x + dx, y + dy)) { ring = Math.min(ring, Math.max(Math.abs(dx), Math.abs(dy)) - 1); if (!ring) break; }
    }
    H[i] = 10 + ring * 3 + (World.tvar[i] % 3);
  }
}
// 지형 캐시 갱신: 바뀐 칸이 적으면 그 둘레만, 계절·판이 바뀌면 전부 다시 그린다
function updateTerrain() {
  const season = renSeason();
  const full = R.season !== season || R.snapS !== S || R.snapSeed !== S.seed;
  World.terrainDirty = false;
  if (full) { redrawTerrain(); return; }
  const changed = [];
  for (let i = 0; i < MW * MH; i++) {
    if (World.tiles[i] !== R.tSnap[i] || World.road[i] !== R.rSnap[i]) { changed.push(i); if (changed.length > 90) break; }
  }
  if (!changed.length) return;
  if (changed.length > 90) { redrawTerrain(); return; }
  renRockHeights();
  // 둘레 3칸까지 (길 잇기·물가는 1칸, 바위 높이는 2칸, 바위 테두리는 그 이웃까지 따른다)
  const rects = [];
  for (const i of changed) {
    const tx = i % MW, ty = (i / MW) | 0;
    let r = { x0: (tx - ty - 7) * 32 - 4, x1: (tx - ty + 7) * 32 + 4, y0: (tx + ty - 6) * 16 - REN_LIFT, y1: (tx + ty + 8) * 16 + REN_DROP };
    for (let k = rects.length - 1; k >= 0; k--) {
      const q = rects[k];
      if (q.x0 <= r.x1 && r.x0 <= q.x1 && q.y0 <= r.y1 && r.y0 <= q.y1) {
        r = { x0: Math.min(q.x0, r.x0), x1: Math.max(q.x1, r.x1), y0: Math.min(q.y0, r.y0), y1: Math.max(q.y1, r.y1) };
        rects.splice(k, 1);
      }
    }
    rects.push(r);
  }
  if (rects.length > 10) { redrawTerrain(); return; }
  for (const r of rects) renTerrainRect(R.tctx, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, season);
  renSnapshot();
  renMiniBase();
}
function redrawTerrain() {
  const season = renSeason();
  R.season = season;
  if (R.snapSeed !== S.seed || !R.noise) R.noise = makeNoise((S.seed | 0) + 101);
  renRockHeights();
  const c = R.tctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, R.terrain.width, R.terrain.height);
  renTerrainRect(c, R.tox, R.toy, R.terrain.width, R.terrain.height, season);
  renSnapshot();
  World.terrainDirty = false;
  renMiniBase();
}
function renSnapshot() {
  R.tSnap.set(World.tiles); R.rSnap.set(World.road);
  R.snapS = S; R.snapSeed = S.seed;
}
function renMiniBase() {
  const P = GROUND_PAL[R.season < 0 ? 0 : R.season];
  const m = R.miniBase.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = World.tiles[y * MW + x];
    m.fillStyle = World.road[y * MW + x] ? '#c8a878'
      : t === T.WATER ? P.water : t === T.ROCK ? P.rock[0] : t === T.FOREST ? '#3f6a3a' : t === T.SAND ? P.sand : t === T.DIRT ? P.dirt : P.grass[0];
    m.fillRect(x * 2, y * 2, 2, 2);
  }
}
// 월드 사각형 하나를 지운 뒤 그 안에 걸치는 칸들을 뒤에서 앞으로 다시 그린다
function renTerrainRect(c, x, y, w, h, season) {
  const P = GROUND_PAL[season];
  c.save();
  c.setTransform(1, 0, 0, 1, -R.tox, -R.toy);
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.clearRect(x, y, w, h);
  const cs = [tileOfWorld(x, y - REN_DROP), tileOfWorld(x + w, y - REN_DROP), tileOfWorld(x, y + h + REN_LIFT), tileOfWorld(x + w, y + h + REN_LIFT)];
  let ax = Infinity, bx = -Infinity, ay = Infinity, by = -Infinity;
  for (const p of cs) { ax = Math.min(ax, p.x); bx = Math.max(bx, p.x); ay = Math.min(ay, p.y); by = Math.max(by, p.y); }
  const tx0 = clamp(Math.floor(ax) - 1, 0, MW - 1), tx1 = clamp(Math.ceil(bx) + 1, 0, MW - 1);
  const ty0 = clamp(Math.floor(ay) - 1, 0, MH - 1), ty1 = clamp(Math.ceil(by) + 1, 0, MH - 1);
  for (let s = tx0 + ty0; s <= tx1 + ty1; s++) {
    const a = Math.max(tx0, s - ty1), b = Math.min(tx1, s - ty0);
    for (let tx = a; tx <= b; tx++) {
      const ty = s - tx;
      const nx = (tx - ty) * 32, ny = (tx + ty) * 16;
      if (nx + 36 < x || nx - 36 > x + w || ny - REN_LIFT > y + h || ny + 32 + REN_DROP < y) continue;
      renTile(c, tx, ty, P, season);
    }
  }
  renMist(c, x, y, w, h, season);
  c.restore();
}
function renTile(c, tx, ty, P, season) {
  const i = ty * MW + tx, t = World.tiles[i], v = World.tvar[i];
  const nx = (tx - ty) * 32, ny = (tx + ty) * 16;
  const nz = fbm(R.noise, tx / 6.5, ty / 6.5, 2);
  if (ty === MH - 1 || tx === MW - 1) renEdge(c, tx, ty, t, i, nx, ny, P, season);
  if (t === T.WATER) {
    renWater(c, tx, ty, i, v, nx, ny, P, season, nz);
    if (World.road[i]) renBridge(c, tx, ty, i, season);
    return;
  }
  if (t === T.ROCK) { renRock(c, tx, ty, i, v, nx, ny, P, season, nz); return; }
  renGround(c, tx, ty, t, i, v, nx, ny, P, season, nz);
  if (World.road[i]) renRoad(c, tx, ty, i, season);
}
function renGround(c, tx, ty, t, i, v, nx, ny, P, season, nz) {
  const winter = season === 3;
  const jit = (renHash(i, 1) - 0.5) * 0.12;
  let base;
  if (t === T.FOREST) base = renMix(renHex(P.floor, 0.9), renHex(P.floor, 1.06), nz + jit);
  else if (t === T.SAND) base = renMix(renHex(P.sand, 0.95), renHex(P.sand, 1.03), nz + jit);
  else if (t === T.DIRT) base = renMix(renHex(P.dirt, 0.93), renHex(P.dirt, 1.05), nz + jit);
  else {
    const [mid, dark, light] = P.grass;
    const q = nz + jit;
    base = q < 0.5 ? renMix(dark, mid, q * 2) : renMix(mid, light, (q - 0.5) * 2);
  }
  c.fillStyle = base;
  renDia(c, nx, ny, 0.8); c.fill();
  if (t === T.GRASS || t === T.FOREST) {
    // 풀포기
    c.lineWidth = 0.8; c.lineCap = 'round';
    c.strokeStyle = winter ? 'rgba(120,140,160,0.30)' : t === T.FOREST ? 'rgba(20,40,14,0.32)' : 'rgba(34,66,22,0.26)';
    c.beginPath();
    const n = t === T.FOREST ? 5 : 7;
    for (let k = 0; k < n; k++) {
      const [x, y] = renPt(tx, ty, 0.08 + renHash(i, k * 2 + 3) * 0.84, 0.08 + renHash(i, k * 2 + 4) * 0.84);
      c.moveTo(x - 1.3, y - 2.6); c.lineTo(x, y); c.lineTo(x + 1.4, y - 2.2);
    }
    c.stroke();
    if (!winter) {
      c.strokeStyle = 'rgba(235,245,190,0.13)';
      c.beginPath();
      for (let k = 0; k < 3; k++) {
        const [x, y] = renPt(tx, ty, 0.1 + renHash(i, k + 31) * 0.8, 0.1 + renHash(i, k + 37) * 0.8);
        c.moveTo(x, y); c.lineTo(x + 0.6, y - 2.4);
      }
      c.stroke();
    } else if (v % 3 === 0) {
      // 눈 위로 삐죽 나온 마른 풀
      c.strokeStyle = 'rgba(140,130,90,0.55)';
      c.beginPath();
      const [x, y] = renPt(tx, ty, 0.3 + renHash(i, 41) * 0.4, 0.3 + renHash(i, 43) * 0.4);
      c.moveTo(x - 1, y - 2.5); c.lineTo(x, y); c.lineTo(x + 1.2, y - 3);
      c.stroke();
    }
    if (t === T.FOREST) {
      // 덤불과 낙엽
      const bush = winter ? '#8a9a8c' : renShade(P.floor, 0.72);
      const top = winter ? '#e8eef2' : renShade(P.floor, 1.12);
      for (let k = 0; k < 2; k++) {
        const [x, y] = renPt(tx, ty, 0.15 + renHash(i, k + 51) * 0.7, 0.15 + renHash(i, k + 53) * 0.7);
        renEll(c, bush, x, y, 4.2, 2.2);
        renEll(c, top, x - 0.8, y - 1, 2.4, 1.2);
      }
    } else if (season === 0 && v % 5 === 0) {
      const cols = ['#fff6e0', '#f4c4d0', '#ffe27a'];
      for (let k = 0; k < 3; k++) {
        const [x, y] = renPt(tx, ty, 0.15 + renHash(i, k + 61) * 0.7, 0.15 + renHash(i, k + 67) * 0.7);
        renBox(c, cols[(v + k) % 3], x - 1, y - 1, 2, 1.6);
      }
    } else if (season === 1 && v % 7 === 0) {
      const [x, y] = renPt(tx, ty, 0.3 + renHash(i, 71) * 0.4, 0.3 + renHash(i, 73) * 0.4);
      renEll(c, 'rgba(40,80,30,0.25)', x, y, 5, 2.4);
    } else if (season === 2 && v % 3 === 0) {
      const cols = ['#c9702a', '#b8462a', '#d9a03a'];
      for (let k = 0; k < 3; k++) {
        const [x, y] = renPt(tx, ty, 0.1 + renHash(i, k + 81) * 0.8, 0.1 + renHash(i, k + 87) * 0.8);
        c.fillStyle = cols[(v + k) % 3];
        c.beginPath(); c.ellipse(x, y, 1.6, 0.9, renHash(i, k + 91) * 3, 0, Math.PI * 2); c.fill();
      }
    }
  } else if (t === T.SAND) {
    c.fillStyle = 'rgba(110,84,40,0.18)';
    for (let k = 0; k < 6; k++) {
      const [x, y] = renPt(tx, ty, renHash(i, k + 3) * 0.9 + 0.05, renHash(i, k + 13) * 0.9 + 0.05);
      c.fillRect(x, y, 1.4, 1);
    }
    c.strokeStyle = 'rgba(255,250,230,0.22)'; c.lineWidth = 0.8;
    c.beginPath();
    const [x, y] = renPt(tx, ty, 0.3 + renHash(i, 23) * 0.4, 0.3 + renHash(i, 29) * 0.4);
    c.moveTo(x - 7, y + 1); c.quadraticCurveTo(x, y - 2, x + 7, y + 1);
    c.stroke();
  } else if (t === T.DIRT) {
    for (let k = 0; k < 4; k++) {
      const [x, y] = renPt(tx, ty, renHash(i, k + 3) * 0.8 + 0.1, renHash(i, k + 13) * 0.8 + 0.1);
      renEll(c, 'rgba(70,52,30,0.30)', x + 0.4, y + 0.5, 1.6, 0.9);
      renEll(c, winter ? 'rgba(250,250,252,0.7)' : 'rgba(225,205,170,0.55)', x, y, 1.3, 0.7);
    }
    c.strokeStyle = 'rgba(80,60,36,0.22)'; c.lineWidth = 0.7;
    c.beginPath();
    const [x, y] = renPt(tx, ty, 0.25 + renHash(i, 33) * 0.5, 0.25 + renHash(i, 37) * 0.5);
    c.moveTo(x - 5, y); c.lineTo(x - 1, y + 1.2); c.lineTo(x + 4, y - 0.5);
    c.stroke();
  }
  // 풀밭과 맞닿은 맨땅·모래·숲 바닥 가장자리를 풀로 부드럽게
  if (t !== T.GRASS) {
    const gcol = winter ? P.grass[0] : P.grass[1];
    const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    c.fillStyle = gcol;
    for (let sd = 0; sd < 4; sd++) {
      const [dx, dy] = sides[sd];
      if (!renIsGrass(tx + dx, ty + dy)) continue;
      for (let k = 0; k < 6; k++) {
        const along = 0.06 + renHash(i, sd * 10 + k + 101) * 0.88, depth = renHash(i, sd * 10 + k + 107) * 0.13;
        const u = dx < 0 ? depth : dx > 0 ? 1 - depth : along;
        const w = dy < 0 ? depth : dy > 0 ? 1 - depth : along;
        const [x, y] = renPt(tx, ty, u, w);
        c.beginPath(); c.ellipse(x, y, 2.6 + renHash(i, k + 113) * 2, 1.3, 0, 0, Math.PI * 2); c.fill();
      }
    }
  }
}
function renWater(c, tx, ty, i, v, nx, ny, P, season, nz) {
  const D = REN_WATER, winter = season === 3;
  const wN = renIsWater(tx, ty - 1), wW = renIsWater(tx - 1, ty), wE = renIsWater(tx + 1, ty), wS = renIsWater(tx, ty + 1);
  // 뒤쪽 물가의 흙벽 (땅이 물보다 높다)
  const bank = winter ? '#a8a49c' : renShade(P.soil, 1.0);
  if (!wN) {
    c.fillStyle = bank;
    c.beginPath(); c.moveTo(nx, ny - 0.4); c.lineTo(nx + 32.6, ny + 16); c.lineTo(nx + 32.6, ny + 16 + D); c.lineTo(nx, ny + D); c.closePath(); c.fill();
  }
  if (!wW) {
    c.fillStyle = winter ? '#97938b' : renShade(P.soil, 0.82);
    c.beginPath(); c.moveTo(nx - 32.6, ny + 16); c.lineTo(nx, ny - 0.4); c.lineTo(nx, ny + D); c.lineTo(nx - 32.6, ny + 16 + D); c.closePath(); c.fill();
  }
  // 수면
  const deep = wN && wW && wE && wS;
  c.fillStyle = renMix(P.water, P.deep, (deep ? 0.22 : 0) + nz * 0.3);
  renDia(c, nx, ny + D, 0.8); c.fill();
  // 잔물결 자국
  c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 0.9;
  c.beginPath();
  for (let k = 0; k < 2; k++) {
    const [x, y] = renPt(tx, ty, 0.25 + renHash(i, k + 3) * 0.5, 0.25 + renHash(i, k + 7) * 0.5);
    c.moveTo(x - 5, y + D); c.quadraticCurveTo(x, y + D - 1.6, x + 5, y + D);
  }
  c.stroke();
  // 물거품: 땅과 맞닿은 변
  c.lineCap = 'round';
  const foam = winter ? 'rgba(240,248,252,0.75)' : 'rgba(228,242,248,0.55)';
  c.strokeStyle = foam; c.lineWidth = 1.4;
  c.beginPath();
  if (!wN) { c.moveTo(nx + 3, ny + D + 2.6); c.lineTo(nx + 29, ny + 16 + D - 0.4); }
  if (!wW) { c.moveTo(nx - 29, ny + 16 + D - 0.4); c.lineTo(nx - 3, ny + D + 2.6); }
  if (!wE) { c.moveTo(nx + 29, ny + 16 + 0.6); c.lineTo(nx + 3, ny + 32 - 2.2); }
  if (!wS) { c.moveTo(nx - 3, ny + 32 - 2.2); c.lineTo(nx - 29, ny + 16 + 0.6); }
  c.stroke();
  c.strokeStyle = 'rgba(228,242,248,0.22)'; c.lineWidth = 1;
  c.beginPath();
  if (!wN) { c.moveTo(nx + 6, ny + D + 6); c.lineTo(nx + 24, ny + 15 + D); }
  if (!wW) { c.moveTo(nx - 24, ny + 15 + D); c.lineTo(nx - 6, ny + D + 6); }
  c.stroke();
  if (winter) {
    // 얼음: 물가부터 언다
    const a = deep ? 0.18 + nz * 0.5 : 0.62;
    c.fillStyle = `rgba(226,238,246,${a.toFixed(2)})`;
    renDia(c, nx, ny + D, 0.6); c.fill();
    c.strokeStyle = 'rgba(160,190,210,0.5)'; c.lineWidth = 0.6;
    c.beginPath();
    const [x, y] = renPt(tx, ty, 0.3 + renHash(i, 11) * 0.4, 0.3 + renHash(i, 13) * 0.4);
    c.moveTo(x - 8, y + D - 1); c.lineTo(x - 2, y + D + 1); c.lineTo(x + 3, y + D - 2); c.lineTo(x + 9, y + D);
    c.stroke();
  }
}
function renRock(c, tx, ty, i, v, nx, ny, P, season, nz) {
  const h = R.rockH[i], top = ny - h;
  const [mid, light, dark] = P.rock;
  const winter = season === 3;
  // 왼쪽 앞면(남서)과 오른쪽 앞면(남동)
  c.fillStyle = renMix(mid, dark, 0.45);
  c.beginPath(); c.moveTo(nx - 32.5, top + 16); c.lineTo(nx, top + 32); c.lineTo(nx, ny + 32.5); c.lineTo(nx - 32.5, ny + 16); c.closePath(); c.fill();
  c.fillStyle = renShade(dark, 0.86);
  c.beginPath(); c.moveTo(nx, top + 32); c.lineTo(nx + 32.5, top + 16); c.lineTo(nx + 32.5, ny + 16); c.lineTo(nx, ny + 32.5); c.closePath(); c.fill();
  // 결과 금
  c.strokeStyle = 'rgba(20,18,16,0.26)'; c.lineWidth = 0.8;
  c.beginPath();
  for (let k = 0; k < 2; k++) {
    const f = 0.15 + renHash(i, k + 3) * 0.7, len = h * (0.35 + renHash(i, k + 5) * 0.5);
    c.moveTo(nx - 32 + f * 32, top + 16 + f * 16 + 1); c.lineTo(nx - 32 + f * 32 + 1, top + 16 + f * 16 + len);
    c.moveTo(nx + 32 - f * 32, top + 16 + f * 16 + 1); c.lineTo(nx + 32 - f * 32 - 1, top + 16 + f * 16 + len);
  }
  const sd = h * 0.55;
  c.moveTo(nx - 30, top + 16 + sd); c.lineTo(nx - 2, top + 30 + sd);
  c.stroke();
  c.strokeStyle = 'rgba(255,255,255,0.10)';
  c.beginPath(); c.moveTo(nx - 31, top + 17.5); c.lineTo(nx - 1, top + 32.5); c.stroke();
  // 아래 그늘
  c.fillStyle = 'rgba(0,0,0,0.18)';
  c.beginPath(); c.moveTo(nx - 32, ny + 16); c.lineTo(nx, ny + 32); c.lineTo(nx + 32, ny + 16); c.lineTo(nx + 32, ny + 13); c.lineTo(nx, ny + 29); c.lineTo(nx - 32, ny + 13); c.closePath(); c.fill();
  // 윗면: 높을수록 밝게. 가운데가 솟은 네 쪽 면으로 나눠 울퉁불퉁한 바위 머리처럼
  const tone = 0.05 + (h - 10) / 8 * 0.35 + nz * 0.35;
  c.fillStyle = renMix(mid, light, tone);
  renDia(c, nx, top, 0.6); c.fill();
  {
    const [px, py0] = renPt(tx, ty, 0.36 + renHash(i, 61) * 0.28, 0.36 + renHash(i, 63) * 0.28);
    const py = py0 - h - 3 - renHash(i, 65) * 4;
    const Nn = [nx, top], Ee = [nx + 32, top + 16], Ss = [nx, top + 32], Ww = [nx - 32, top + 16];
    const facet = (a, b, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(px, py); c.closePath(); c.fill(); };
    facet(Ww, Nn, renMix(mid, light, tone + 0.28));
    facet(Nn, Ee, renMix(mid, light, tone + 0.1));
    facet(Ee, Ss, renMix(mid, dark, 0.35 - tone * 0.3));
    facet(Ss, Ww, renMix(mid, light, tone - 0.08));
  }
  c.fillStyle = 'rgba(0,0,0,0.12)';
  for (let k = 0; k < 5; k++) {
    const [x, y] = renPt(tx, ty, 0.1 + renHash(i, k + 21) * 0.8, 0.1 + renHash(i, k + 27) * 0.8);
    c.fillRect(x, y - h, 2.2, 1);
  }
  c.strokeStyle = 'rgba(30,26,22,0.22)'; c.lineWidth = 0.7;
  c.beginPath();
  {
    const [x, y] = renPt(tx, ty, 0.2 + renHash(i, 33) * 0.6, 0.2 + renHash(i, 35) * 0.6);
    c.moveTo(x - 6, y - h + 1); c.lineTo(x - 1, y - h - 1); c.lineTo(x + 2, y - h + 1.5); c.lineTo(x + 7, y - h);
  }
  c.stroke();
  // 뒤쪽 이웃보다 높은 변에만 밝은 테두리 (평평한 바위산이 바둑판처럼 보이지 않게)
  const hW = tx > 0 ? R.rockH[i - 1] : h, hN = ty > 0 ? R.rockH[i - MW] : h;
  c.strokeStyle = 'rgba(255,255,255,0.24)'; c.lineWidth = 1;
  c.beginPath();
  if (hW < h - 1) { c.moveTo(nx - 31, top + 16); c.lineTo(nx, top + 0.5); }
  if (hN < h - 1) { c.moveTo(nx, top + 0.5); c.lineTo(nx + 31, top + 16); }
  c.stroke();
  if (winter) {
    c.fillStyle = 'rgba(246,249,252,0.92)';
    c.beginPath();
    c.moveTo(nx, top + 2); c.lineTo(nx + 27, top + 15); c.quadraticCurveTo(nx + 12, top + 21, nx, top + 27);
    c.quadraticCurveTo(nx - 14, top + 20, nx - 27, top + 15); c.closePath(); c.fill();
  } else if (season < 2 && v % 3 === 0) {
    const [x, y] = renPt(tx, ty, 0.35 + renHash(i, 45) * 0.3, 0.35 + renHash(i, 47) * 0.3);
    renEll(c, 'rgba(90,130,60,0.45)', x, y - h, 5, 2.2);
  }
  // 바윗돌
  const n = renBoulderN(v);
  for (let k = 0; k < n; k++) {
    const [bx, by, r] = renBoulder(tx, ty, i, h, k);
    renEll(c, 'rgba(0,0,0,0.25)', bx + 1.2, by + r * 0.45, r * 1.05, r * 0.5);
    c.fillStyle = renMix(dark, mid, 0.55);
    c.beginPath();
    for (let a = 0; a < 7; a++) {
      const ang = a / 7 * Math.PI * 2, rr2 = r * (0.82 + renHash(i, k * 9 + a + 201) * 0.3);
      const px = bx + Math.cos(ang) * rr2, py = by + Math.sin(ang) * rr2 * 0.72;
      if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath(); c.fill();
    renEll(c, renMix(mid, light, 0.6), bx - r * 0.25, by - r * 0.28, r * 0.55, r * 0.34);
    if (winter) renEll(c, 'rgba(246,249,252,0.95)', bx - r * 0.1, by - r * 0.42, r * 0.75, r * 0.3);
  }
}
function renBoulderN(v) { return 1 + (v % 3) + (v % 7 === 0 ? 1 : 0); }
function renBoulder(tx, ty, i, h, k) {
  const [x, y] = renPt(tx, ty, 0.28 + renHash(i, k + 301) * 0.44, 0.28 + renHash(i, k + 307) * 0.44);
  const r = 4 + renHash(i, k + 311) * 4.5;
  return [x, y - h - r * 0.35, r];
}
// 지도 앞 가장자리: 흙벽(땅), 폭포(물)
function renEdge(c, tx, ty, t, i, nx, ny, P, season) {
  const water = t === T.WATER, top = water ? REN_WATER : 0;
  const faces = [];
  if (ty === MH - 1) faces.push([nx - 32, ny + 16, nx, ny + 32]);
  if (tx === MW - 1) faces.push([nx, ny + 32, nx + 32, ny + 16]);
  for (const [x1, y1, x2, y2] of faces) {
    const H = water ? REN_EDGE + 50 : REN_EDGE;
    const ya = Math.min(y1, y2) + top, yb = Math.max(y1, y2) + top + H;
    const g = c.createLinearGradient(0, ya, 0, yb);
    if (water) {
      g.addColorStop(0, P.water); g.addColorStop(0.35, renMix(P.water, '#d8ecf4', 0.45));
      g.addColorStop(1, 'rgba(220,236,244,0)');
    } else {
      const soil = P.soil;
      g.addColorStop(0, renShade(soil, x1 < x2 && y1 < y2 ? 1.05 : 0.8));
      g.addColorStop(0.45, renShade(soil, 0.6));
      g.addColorStop(1, 'rgba(21,17,14,0)');
    }
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x1 - 0.5, y1 + top); c.lineTo(x2 + 0.5, y2 + top); c.lineTo(x2 + 0.5, y2 + top + H); c.lineTo(x1 - 0.5, y1 + top + H); c.closePath(); c.fill();
    if (water) {
      c.strokeStyle = 'rgba(240,248,252,0.45)'; c.lineWidth = 1.1;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const f = (k + 0.5 + renHash(i, k + 401) * 0.5) / 6.5;
        const x = lerp(x1, x2, f), y = lerp(y1, y2, f) + top;
        c.moveTo(x, y + 1); c.lineTo(x, y + 12 + renHash(i, k + 411) * (H * 0.6));
      }
      c.stroke();
    } else {
      // 지층과 돌, 풀뿌리
      c.strokeStyle = 'rgba(255,230,190,0.10)'; c.lineWidth = 1;
      c.beginPath();
      for (const d of [7, 15]) { c.moveTo(x1, y1 + d + renHash(i, d) * 2); c.lineTo(x2, y2 + d + renHash(i, d + 1) * 2); }
      c.stroke();
      for (let k = 0; k < 3; k++) {
        const f = renHash(i, k + 421), d = 4 + renHash(i, k + 425) * 16;
        renEll(c, 'rgba(150,140,125,0.45)', lerp(x1, x2, f), lerp(y1, y2, f) + d, 2, 1.2);
      }
      c.strokeStyle = season === 3 ? 'rgba(240,244,248,0.8)' : 'rgba(60,90,40,0.7)'; c.lineWidth = 0.8;
      c.beginPath();
      for (let k = 0; k < 7; k++) {
        const f = (k + renHash(i, k + 431)) / 7, x = lerp(x1, x2, f), y = lerp(y1, y2, f);
        c.moveTo(x, y); c.lineTo(x + 0.6, y + 2 + renHash(i, k + 441) * 3);
      }
      c.stroke();
    }
  }
}
// 지도 둘레의 운해(雲海): 땅이 구름 위에 떠 있는 듯
function renMist(c, x, y, w, h, season) {
  const col = season === 3 ? '228,234,240' : '216,208,194';
  const Wc = [-MH * 32, MH * 16], Nc = [0, 0], Ec = [MW * 32, MW * 16], Sc = [(MW - MH) * 32, (MW + MH) * 16];
  const edges = [[Wc, Sc, 1, 30], [Sc, Ec, 1, 26], [Wc, Nc, 0, 18], [Nc, Ec, 0, 20]];
  for (let e = 0; e < 4; e++) {
    const [A, B, front, n] = edges[e];
    for (let k = 0; k < n; k++) {
      const f = (k + renHash(e * 97, k)) / n;
      const px = lerp(A[0], B[0], f), py = lerp(A[1], B[1], f) + (front ? REN_EDGE + 14 + renHash(e * 97, k + 50) * 40 : -14 - renHash(e * 97, k + 50) * 16);
      const rx = (front ? 90 : 70) + renHash(e * 97, k + 100) * 80, ry = rx * (front ? 0.3 : 0.22);
      if (px + rx < x || px - rx > x + w || py + ry < y || py - ry > y + h) continue;
      const a = (front ? 0.13 : 0.07) + renHash(e * 97, k + 150) * (front ? 0.09 : 0.05);
      c.save();
      c.translate(px, py); c.scale(1, ry / rx);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, `rgba(${col},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      c.fillRect(-rx, -rx, rx * 2, rx * 2);
      c.restore();
    }
  }
}
// 길: 타일 공간에서 그려 등각으로 비튼다. 이웃 길 쪽으로 팔을 뻗어 마름모 변을 건너 이어진다.
function renRoadAt(x, y, fx, fy) {
  if (World.inb(x, y)) return World.road[y * MW + x] === 1;
  // 지도 밖으로 나가는 관도 출입구
  for (const e of World.exits) if (e.x === fx && e.y === fy) return true;
  return false;
}
function renRoad(c, tx, ty, i, season) {
  const n = renRoadAt(tx, ty - 1, tx, ty), s = renRoadAt(tx, ty + 1, tx, ty), w = renRoadAt(tx - 1, ty, tx, ty), e = renRoadAt(tx + 1, ty, tx, ty);
  const winter = season === 3;
  c.save();
  c.setTransform(32, 16, -32, 16, -R.tox, -R.toy);
  c.beginPath(); c.rect(tx, ty, 1, 1); c.clip();
  const cx = tx + 0.5, cy = ty + 0.5;
  // 네 칸이 모두 길이면 그 모서리도 메운다 (넓은 길·마당에 구멍이 나지 않게)
  let corners = 0;
  if (n && e && renRoadAt(tx + 1, ty - 1, tx, ty)) corners |= 1;
  if (s && e && renRoadAt(tx + 1, ty + 1, tx, ty)) corners |= 2;
  if (s && w && renRoadAt(tx - 1, ty + 1, tx, ty)) corners |= 4;
  if (n && w && renRoadAt(tx - 1, ty - 1, tx, ty)) corners |= 8;
  renRoadShape(c, cx, cy, n, s, w, e, 0.78, winter ? '#aea28c' : '#94774e', corners);
  renRoadShape(c, cx, cy, n, s, w, e, 0.62, winter ? '#d4cab8' : '#c4a676', corners);
  renRoadShape(c, cx, cy, n, s, w, e, 0.24, winter ? 'rgba(240,240,242,0.55)' : 'rgba(214,190,140,0.55)', 0);
  c.restore();
  // 자갈
  for (let k = 0; k < 5; k++) {
    const a = renHash(i, k + 501), b = (renHash(i, k + 507) - 0.5) * 0.5;
    const arm = Math.floor(renHash(i, k + 513) * 5);
    let u = 0.5 + (renHash(i, k + 519) - 0.5) * 0.5, v = 0.5 + b;
    if (arm === 1 && e) { u = 0.5 + a * 0.5; v = 0.5 + b; }
    else if (arm === 2 && w) { u = 0.5 - a * 0.5; v = 0.5 + b; }
    else if (arm === 3 && s) { u = 0.5 + b; v = 0.5 + a * 0.5; }
    else if (arm === 4 && n) { u = 0.5 + b; v = 0.5 - a * 0.5; }
    const [x, y] = renPt(tx, ty, u, v);
    if (k % 2) renEll(c, 'rgba(84,62,36,0.42)', x, y, 1.5, 0.8);
    else { renEll(c, 'rgba(70,52,30,0.35)', x + 0.5, y + 0.5, 1.3, 0.8); renEll(c, winter ? '#f0f2f4' : '#e2d2b0', x, y, 1.1, 0.65); }
  }
}
function renRoadShape(c, cx, cy, n, s, w, e, wd, col, corners) {
  c.strokeStyle = col; c.fillStyle = col; c.lineWidth = wd; c.lineCap = 'butt';
  c.beginPath();
  if (n) { c.moveTo(cx, cy); c.lineTo(cx, cy - 0.55); }
  if (s) { c.moveTo(cx, cy); c.lineTo(cx, cy + 0.55); }
  if (w) { c.moveTo(cx, cy); c.lineTo(cx - 0.55, cy); }
  if (e) { c.moveTo(cx, cy); c.lineTo(cx + 0.55, cy); }
  c.stroke();
  const r = wd / 2;
  renRoundRect(c, cx - r, cy - r, wd, wd, r * 0.6); c.fill();
  if (corners & 1) c.fillRect(cx, cy - 0.55, 0.55, 0.55);
  if (corners & 2) c.fillRect(cx, cy, 0.55, 0.55);
  if (corners & 4) c.fillRect(cx - 0.55, cy, 0.55, 0.55);
  if (corners & 8) c.fillRect(cx - 0.55, cy - 0.55, 0.55, 0.55);
}
// 물 위의 길 = 나무다리. 길이 이어진 방향으로 놓는다.
function renBridge(c, tx, ty, i, season) {
  const rx = renRoadAt(tx - 1, ty, tx, ty) || renRoadAt(tx + 1, ty, tx, ty);
  const ry = renRoadAt(tx, ty - 1, tx, ty) || renRoadAt(tx, ty + 1, tx, ty);
  const alongX = rx !== ry ? rx : (World.tile(tx, ty - 1) === T.WATER || World.tile(tx, ty + 1) === T.WATER);
  // (a: 다리 방향, b: 폭 방향, lift) → 월드
  const P = (a, b, lift) => alongX ? [(tx + a - ty - b) * 32, (tx + a + ty + b) * 16 - lift] : [(tx + b - ty - a) * 32, (tx + b + ty + a) * 16 - lift];
  const quad = (pts, col) => {
    c.fillStyle = col; c.beginPath();
    pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.closePath(); c.fill();
  };
  const seg = (p, q, col, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
  const winter = season === 3;
  c.lineCap = 'butt';
  // 물속 기둥
  for (const b of [0.22, 0.78]) for (const a of [0.12, 0.88]) seg(P(a, b, 0), P(a, b, -REN_WATER - 4), '#3b2414', 2.2);
  // 뒤 난간
  for (const a of [0.1, 0.5, 0.9]) seg(P(a, 0.2, 1), P(a, 0.2, 9), '#4a2f1c', 1.4);
  seg(P(0, 0.2, 8), P(1, 0.2, 8), '#4a2f1c', 1.6);
  // 바닥
  quad([P(0, 0.17, 1), P(1, 0.17, 1), P(1, 0.83, 1), P(0, 0.83, 1)], '#8a5f36');
  for (let k = 0; k < 6; k++) {
    if (k % 2) quad([P(k / 6, 0.17, 1), P((k + 1) / 6, 0.17, 1), P((k + 1) / 6, 0.83, 1), P(k / 6, 0.83, 1)], '#946840');
    seg(P(k / 6, 0.17, 1), P(k / 6, 0.83, 1), '#5e3c22', 0.7);
  }
  if (winter) {
    for (let k = 0; k < 3; k++) {
      const a = 0.15 + renHash(i, k + 601) * 0.6, b = 0.25 + renHash(i, k + 607) * 0.45;
      quad([P(a, b, 1), P(a + 0.18, b, 1), P(a + 0.18, b + 0.14, 1), P(a, b + 0.14, 1)], 'rgba(244,247,250,0.85)');
    }
  }
  // 앞 옆면
  quad([P(0, 0.83, 1), P(1, 0.83, 1), P(1, 0.83, -3), P(0, 0.83, -3)], '#5a3a22');
  // 앞 난간
  for (const a of [0.1, 0.5, 0.9]) seg(P(a, 0.8, 1), P(a, 0.8, 9), '#4a2f1c', 1.5);
  seg(P(0, 0.8, 8), P(1, 0.8, 8), '#4a2f1c', 1.8);
  seg(P(0, 0.8, 8.8), P(1, 0.8, 8.8), winter ? '#f2f5f8' : '#a77a4a', 0.7);
}

// ── 낮밤 ─────────────────────────────────
const AMBIENT = [
  [0, 0.76, 8, 12, 40], [4, 0.74, 8, 12, 40], [5.3, 0.42, 60, 36, 72], [6.3, 0.14, 255, 150, 90], [7.3, 0, 0, 0, 0],
  [16.6, 0, 0, 0, 0], [17.8, 0.13, 255, 128, 56], [19.0, 0.38, 70, 32, 70], [20.3, 0.72, 8, 12, 40], [24, 0.76, 8, 12, 40],
];
function ambientAt(h) {
  for (let i = 0; i < AMBIENT.length - 1; i++) {
    const a = AMBIENT[i], b = AMBIENT[i + 1];
    if (h >= a[0] && h <= b[0]) {
      const t = (h - a[0]) / (b[0] - a[0]);
      return { a: lerp(a[1], b[1], t), r: lerp(a[2], b[2], t), g: lerp(a[3], b[3], t), b: lerp(a[4], b[4], t) };
    }
  }
  return { a: 0, r: 0, g: 0, b: 0 };
}
function isNight() { const h = hourOf(); return h >= 19.5 || h < 5.3; }

// ── 깊이 정렬 ─────────────────────────────
// 건물·나무·바위는 발판 가운데의 x + y로 정렬한다 (가로세로 차이가 1칸 이하인 직사각 발판이면 이웃과 늘 맞다).
// 사람은 u.x + u.y 이되, 바로 곁 건물과의 앞뒤(마당 안 포함)를 따져 값을 고친다.
// 같은 값이면 땅 → 건물 → 나무 → 사람.
function renKeyOf(b) { return b.x + b.y + (b.w + b.h) / 2; }
function renSpriteOf(b, season) {
  const def = BDEF[b.type], d = b.dir || 0;
  if (b.ruined) return buildingSprite(b.type, b.w, b.h, season, 'ruin', '', d);
  if (!b.done) return buildingSprite(b.type, b.w, b.h, season, 'build', (Math.floor(clamp(b.progress / Math.max(0.01, def.time), 0, 1) * 4) / 4).toFixed(2), d);
  return buildingSprite(b.type, b.w, b.h, season, 'done', def.line || b.type === 'gate' ? String(wallMask(b)) : '', d);
}
// 점 (px, py)가 건물 b의 앞(1)인가 뒤(-1)인가. 마당(walkRows)은 앞으로 친다 (마당은 늘 화면 앞쪽: 무관·표국은 dir 0·1 만).
function renRelation(px, py, b) {
  const def = BDEF[b.type];
  const yd = def.walkRows && b.done && !b.ruined ? def.walkRows : 0, d1 = (b.dir || 0) === 1;
  const x0 = b.x, y0 = b.y, x1 = b.x + b.w - (d1 ? yd : 0);
  const y1 = b.y + b.h - (d1 ? 0 : yd);
  const fr = px >= x1 || py >= y1, bh = px <= x0 || py <= y0;
  if (fr && !bh) return 1;
  if (bh && !fr) return -1;
  if (fr && bh) {
    if (px >= x1 && py <= y0) return px + py >= x1 + y0 ? 1 : -1;
    return px + py >= x0 + y1 ? 1 : -1;
  }
  return 1;
}
function renUnitKey(u) {
  let k = u.x + u.y, lo = -Infinity, hi = Infinity;
  const fx = Math.floor(u.x), fy = Math.floor(u.y);
  const occ = World.occ;
  for (let yy = fy - 3; yy <= fy + 3; yy++) {
    if (yy < 0 || yy >= MH) continue;
    for (let xx = fx - 3; xx <= fx + 3; xx++) {
      if (xx < 0 || xx >= MW) continue;
      const id = occ[yy * MW + xx];
      if (!id) continue;
      const b = S.bmap.get(id);
      if (!b || (BDEF[b.type].ground && b.done && !b.ruined)) continue;
      const kb = renKeyOf(b);
      if (renRelation(u.x, u.y, b) > 0) { if (kb > lo) lo = kb; } else if (kb < hi) hi = kb;
    }
  }
  if (k <= lo) k = lo + 0.001;
  if (k >= hi && hi > lo) k = hi - 0.001;
  return k;
}
const REN_POOL = [], REN_LIST = [];
let renPoolN = 0;
// o: 1 건물, 1.5 바위 덮개, 2 나무, 2.2 길목 표지, 3 사람
function renPush(k, o, b, u, s, tx, ty) {
  let it = REN_POOL[renPoolN];
  if (!it) { it = { k: 0, o: 0, b: null, u: null, s: null, tx: 0, ty: 0 }; REN_POOL.push(it); }
  renPoolN++;
  it.k = k; it.o = o; it.b = b; it.u = u; it.s = s; it.tx = tx; it.ty = ty;
  REN_LIST.push(it);
}
function renCmp(a, b) { return (a.k - b.k) || (a.o - b.o); }
// 나무를 칸 가운데서 조금 흩뜨려 숲이 바둑판처럼 보이지 않게 (타일 단위)
function renTreeDu(v) { return (((v * 37) & 255) / 255 - 0.5) * 0.34; }
function renTreeDv(v) { return (((v * 73 + 11) & 255) / 255 - 0.5) * 0.34; }
// 나무 그림을 계절·모양값마다 붙잡아 둔다 (그림 함수가 바뀌면 새로)
function renTree(v, season) {
  if (R.treeFn !== treeSprite) { R.treeFn = treeSprite; R.trees = new Array(1024).fill(null); }
  const k = season * 256 + v;
  return R.trees[k] || (R.trees[k] = treeSprite(v, season));
}
// 사람·나무·건물 바로 앞의 솟은 바위는 지형 캐시에서 그 모양만 다시 떠서 앞에 그린다
function renMarkRock(x, y) {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return;
  const i = y * MW + x;
  if (World.tiles[i] !== T.ROCK || R.stamp[i] === R.frame) return;
  R.stamp[i] = R.frame;
  renPush(x + y + 1, 1.5, null, null, null, x, y);
}
function renRockOverlay(c, tx, ty) {
  const i = ty * MW + tx, h = R.rockH[i], v = World.tvar[i];
  if (!h) return;
  const nx = (tx - ty) * 32, ny = (tx + ty) * 16, top = ny - h;
  c.save();
  c.beginPath();
  c.moveTo(nx - 32, top + 16); c.lineTo(nx, top); c.lineTo(nx + 32, top + 16); c.lineTo(nx + 32, ny + 16); c.lineTo(nx, ny + 32); c.lineTo(nx - 32, ny + 16); c.closePath();
  const n = renBoulderN(v);
  for (let k = 0; k < n; k++) {
    const [bx, by, r] = renBoulder(tx, ty, i, h, k);
    c.moveTo(bx + r * 1.15, by); c.ellipse(bx, by, r * 1.15, r * 0.9, 0, 0, Math.PI * 2);
  }
  c.clip();
  const x0 = nx - 34, y0 = top - 14, w = 68, hh = ny + 34 - y0;
  c.drawImage(R.terrain, x0 - R.tox, y0 - R.toy, w, hh, x0, y0, w, hh);
  c.restore();
}

// ── 메인 그리기 ───────────────────────────
function render(nowMs) {
  const now = nowMs / 1000;
  const rdt = clamp(now - (R.lastT || now), 0, 0.1);
  R.lastT = now; R.now = now;
  const c = R.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // 지도 밖: 먹빛 허공 (위는 조금 밝게)
  if (!R.bg || R.bgH !== R.canvas.height) {
    R.bgH = R.canvas.height;
    R.bg = c.createLinearGradient(0, 0, 0, R.bgH);
    R.bg.addColorStop(0, '#1d1814'); R.bg.addColorStop(1, '#0f0c0a');
  }
  c.fillStyle = R.bg;
  c.fillRect(0, 0, R.canvas.width, R.canvas.height);
  if (!S) return;
  if (World.terrainDirty || R.season !== renSeason() || R.snapS !== S) updateTerrain();
  const z = Cam.zoom * Cam.dpr;
  const ox = (Cam.vw / 2 - Cam.x * Cam.zoom) * Cam.dpr, oy = (Cam.vh / 2 - Cam.y * Cam.zoom) * Cam.dpr;
  c.setTransform(z, 0, 0, z, ox, oy);
  c.imageSmoothingEnabled = true;
  const tl = screenToWorld(0, 0), br = screenToWorld(Cam.vw, Cam.vh);
  const V = R.view;
  V.x0 = tl.x; V.y0 = tl.y; V.x1 = br.x; V.y1 = br.y;
  // 지형 (보이는 부분만)
  const sx0 = Math.max(0, Math.floor(V.x0 - R.tox) - 1), sy0 = Math.max(0, Math.floor(V.y0 - R.toy) - 1);
  const sx1 = Math.min(R.terrain.width, Math.ceil(V.x1 - R.tox) + 1), sy1 = Math.min(R.terrain.height, Math.ceil(V.y1 - R.toy) + 1);
  if (sx1 > sx0 && sy1 > sy0) c.drawImage(R.terrain, sx0, sy0, sx1 - sx0, sy1 - sy0, sx0 + R.tox, sy0 + R.toy, sx1 - sx0, sy1 - sy0);
  const season = renSeason();
  R.frame++;
  renPoolN = 0; REN_LIST.length = 0;

  // 보이는 칸: 물결 반짝임과 나무
  {
    const ex0 = V.x0 - 40, ex1 = V.x1 + 40, ey0 = V.y0 - 24, ey1 = V.y1 + 72;
    const tyA = Math.max(0, Math.floor(ey0 / 32 - ex1 / 64) - 1), tyB = Math.min(MH - 1, Math.ceil(ey1 / 32 - ex0 / 64) + 1);
    const winter = season === 3;
    c.fillStyle = 'rgba(255,255,255,0.24)';
    for (let ty = tyA; ty <= tyB; ty++) {
      const a = Math.max(0, Math.ceil(ex0 / 32 + ty), Math.ceil(ey0 / 16 - ty - 1));
      const b = Math.min(MW - 1, Math.floor(ex1 / 32 + ty), Math.floor(ey1 / 16 - ty - 1));
      for (let tx = a; tx <= b; tx++) {
        const i = ty * MW + tx, t = World.tiles[i];
        if (t === T.FOREST) {
          if (World.occ[i] || World.road[i]) continue;
          const v = World.tvar[i];
          const s = renTree(v, season);
          renPush(tx + ty + 1 + renTreeDu(v) + renTreeDv(v), 2, null, null, s, tx, ty);
          renMarkRock(tx + 1, ty); renMarkRock(tx, ty + 1); renMarkRock(tx + 1, ty + 1);
        } else if (t === T.WATER && !World.road[i]) {
          const v = World.tvar[i];
          if (winter && v % 3) continue;
          const ph = Math.sin(now * 1.6 + v * 0.7 + tx * 0.5 + ty * 0.3);
          if (ph > 0.55) c.fillRect((tx - ty) * 32 - 12 + (v % 18) + ph * 3, (tx + ty) * 16 + REN_WATER + 12 + ((v >> 3) % 9), 7, 1.3);
        }
      }
    }
  }
  // 땅에 붙은 건물(논밭)은 먼저, 나머지는 정렬
  const grounds = R.grounds;
  grounds.length = 0;
  for (const b of S.buildings) {
    const s = renSpriteOf(b, season);
    const nx = (b.x - b.y) * 32 + s.ox, ny = (b.x + b.y) * 16 + s.oy;
    // 영주관 깃폭은 그림 상자 오른쪽 밖으로 나간다
    const xr = b.type === 'manor' ? Math.max(nx + s.w, renFlagPos(b).px + 28) : nx + s.w;
    if (nx > V.x1 || xr < V.x0 || ny > V.y1 || ny + s.h < V.y0) continue;
    if (BDEF[b.type].ground && b.done && !b.ruined) { grounds.push(b); continue; }
    renPush(renKeyOf(b), 1, b, null, s, 0, 0);
    // 앞쪽 바위
    for (let yy = b.y; yy <= b.y + b.h; yy++) renMarkRock(b.x + b.w, yy);
    for (let xx = b.x; xx < b.x + b.w; xx++) renMarkRock(xx, b.y + b.h);
  }
  for (const b of grounds) drawBuilding(c, b, renSpriteOf(b, season), season, now);
  // 등을 보인 건물(dir 2·3)의 문 앞 디딤돌: 화면 안쪽으로 난 입구가 어디인지 땅에 남긴다
  for (const b of S.buildings) {
    if ((b.dir || 0) < 2 || b.ruined || BDEF[b.type].ground) continue;
    const f = doorFront(b), px = (f.x - f.y) * 32, py = (f.x + f.y) * 16;
    if (px < V.x0 - 40 || px > V.x1 + 40 || py < V.y0 - 40 || py > V.y1 + 40) continue;
    renDoorstep(c, b, f, season);
  }
  renExitCrests(V);
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (renGone(u)) continue;
    const px = (u.x - u.y) * 32, py = (u.x + u.y) * 16;
    if (px < V.x0 - 24 || px > V.x1 + 24 || py < V.y0 - 8 || py > V.y1 + 44) continue;
    renPush(renUnitKey(u), 3, null, u, null, 0, 0);
    const fx = Math.floor(u.x), fy = Math.floor(u.y);
    renMarkRock(fx + 1, fy); renMarkRock(fx, fy + 1); renMarkRock(fx + 1, fy + 1);
  }
  REN_LIST.sort(renCmp);
  for (let n = 0; n < REN_LIST.length; n++) {
    const it = REN_LIST[n];
    if (it.o === 3) drawUnit(c, it.u, now);
    else if (it.o === 2.2) drawExitPost(c, R.crests[it.tx], season);
    else if (it.o === 2) {
      const i = it.ty * MW + it.tx, v = World.tvar[i], s = it.s;
      const u = it.tx + 0.5 + renTreeDu(v), w = it.ty + 0.5 + renTreeDv(v);
      c.drawImage(s.c, (u - w) * 32 - s.ax, (u + w) * 16 - s.ay, s.w, s.h);
    } else if (it.b) drawBuilding(c, it.b, it.s, season, now);
    else renRockOverlay(c, it.tx, it.ty);
  }

  drawParticles(c, rdt);
  drawFx(c, now);
  drawProjectiles(c);

  // 조명
  const amb = ambientAt(hourOf());
  if (amb.a > 0.01) drawLighting(c, amb, now);

  // 조명 위에 그리는 표시들
  c.setTransform(z, 0, 0, z, ox, oy);
  drawExitSeals(c);
  drawOverlays(c, now);
  drawFloaters(c, now);
  c.setTransform(Cam.dpr, 0, 0, Cam.dpr, 0, 0);
  drawWeather(c, rdt, season);
  if (now - R.miniT > 0.4) { R.miniT = now; drawMinimap(); }
}

function wallMask(b) {
  const fam = t => t === 'wall' || t === 'stonewall' || t === 'gate';
  let m = 0;
  const at = (x, y) => { const o = World.bAt(x, y); return o && fam(o.type) && !o.ruined; };
  if (at(b.x, b.y - 1)) m |= 1;
  if (at(b.x + 1, b.y)) m |= 2;
  if (at(b.x, b.y + 1)) m |= 4;
  if (at(b.x - 1, b.y)) m |= 8;
  return m;
}
// ── 길목 표지: 그 방향 이웃의 문장 ───────────────
// World.exits[i].toward(JH.attachExits 가 붙이고 불러올 때 다시 붙인다)의 살아 있는 이웃만.
// 길목 칸의 길섶에 이정표 기둥(그림 캐시)을 세우고 깊이 정렬에 넣는다. 기둥 끝 널판의 문장은 조명 위에
// 그려(drawExitSeals) 숲에 가리거나 밤에 묻히지 않게 하고, 확대해도 줄여도 읽히게 크기를 고른다. 한 줄에 셋까지
const REN_SEAL_ROW = 3;
function renExitSpot(ex) {
  const out = ex.x === 0 ? [-1, 0] : ex.x === MW - 1 ? [1, 0] : ex.y === 0 ? [0, -1] : [0, 1];
  const alongU = out[0] !== 0;
  const road = (x, y) => World.inb(x, y) && World.road[y * MW + x] === 1;
  // 뒤쪽(화면 위쪽) 길섶이 먼저. 그쪽으로 길이 갈라지면 앞쪽
  const side = (alongU ? road(ex.x, ex.y - 1) : road(ex.x - 1, ex.y)) ? 1 : -1;
  return { u: ex.x + 0.5 + out[0] * 0.26 + (alongU ? 0 : side * 0.36), v: ex.y + 0.5 + out[1] * 0.26 + (alongU ? side * 0.36 : 0) };
}
function renExitCrests(V) {
  const r = clamp(renPx(9), 8, 18);
  for (let i = 0; i < World.exits.length; i++) {
    const ex = World.exits[i];
    const cr = R.crests[i] || (R.crests[i] = { i, on: false, x: 0, y: 0, r: 0, w: 0, h: 0, ids: [] });
    cr.on = false;
    if (!S.jh || !ex.toward || !ex.toward.length) continue;
    cr.ids = ex.toward.filter(id => FACTIONS[id] && JH.isAlive(id));
    if (!cr.ids.length) continue;
    const p = renExitSpot(ex), n = Math.min(REN_SEAL_ROW, cr.ids.length), rows = Math.ceil(cr.ids.length / REN_SEAL_ROW);
    cr.x = (p.u - p.v) * 32; cr.y = (p.u + p.v) * 16; cr.r = r;
    cr.w = n * 2 * r + (n - 1) * r * 0.3; cr.h = rows * r * 2.06 + 3;
    if (cr.x + cr.w / 2 < V.x0 - 8 || cr.x - cr.w / 2 > V.x1 + 8 || cr.y < V.y0 - 8 || cr.y - EXIT_POST_H - cr.h > V.y1 + 8) continue;
    cr.on = true;
    renPush(p.u + p.v, 2.2, null, null, null, i, 0);
    const fx = Math.floor(p.u), fy = Math.floor(p.v);
    renMarkRock(fx + 1, fy); renMarkRock(fx, fy + 1); renMarkRock(fx + 1, fy + 1);
  }
  for (let i = World.exits.length; i < R.crests.length; i++) R.crests[i].on = false;
}
function drawExitPost(c, cr, season) {
  const s = exitPostSprite(season === 3);
  c.drawImage(s.c, cr.x - s.ax, cr.y - s.ay, s.w, s.h);
}
// 기둥 끝 널판과 문장 (조명 위)
function drawExitSeals(c) {
  for (const cr of R.crests) {
    if (!cr.on) continue;
    const r = cr.r, top = cr.y - EXIT_POST_H, d = r * 64 / 30;
    renBox(c, 'rgba(0,0,0,0.35)', cr.x - cr.w / 2 - 1.5, top - 1.4, cr.w + 4, 2.6);
    renBox(c, '#4a2e1a', cr.x - cr.w / 2 - 2, top - 2, cr.w + 4, 2.6);
    renBox(c, 'rgba(255,220,170,0.3)', cr.x - cr.w / 2 - 2, top - 2, cr.w + 4, 0.7);
    for (let k = 0; k < cr.ids.length; k++) {
      const row = Math.floor(k / REN_SEAL_ROW), inRow = Math.min(REN_SEAL_ROW, cr.ids.length - row * REN_SEAL_ROW), col = k % REN_SEAL_ROW;
      const cx = cr.x - (inRow - 1) * r * 1.15 + col * r * 2.3, cy = top - 2 - r * 0.96 - row * r * 2.06;
      c.drawImage(sealSprite(cr.ids[k]).c, cx - d / 2, cy - d / 2, d, d);
    }
  }
}
// 화면 점이 길목 표지 위인가: { i, name, ids } | null (풀이 말풍선이 '북쪽 산길 — 흑풍채·칠살문 쪽'을 띄울 때)
function exitCrestAt(sx, sy) {
  if (!S) return null;
  const w = screenToWorld(sx, sy);
  for (const cr of R.crests) {
    if (!cr.on) continue;
    const top = cr.y - EXIT_POST_H;
    const onBoard = w.x >= cr.x - cr.w / 2 - 3 && w.x <= cr.x + cr.w / 2 + 3 && w.y >= top - 2 - cr.h && w.y <= top + 1;
    const onPost = Math.abs(w.x - cr.x) <= 4 && w.y >= top && w.y <= cr.y + 2;
    if (onBoard || onPost) return { i: cr.i, name: World.exits[cr.i].name, ids: cr.ids.slice() };
  }
  return null;
}
// 맞은 건물을 붉게 비추는 그림 (그림마다 한 번 만들어 둔다)
const REN_TINT = new WeakMap();
function renTintOf(cv) {
  let t = REN_TINT.get(cv);
  if (!t) {
    t = document.createElement('canvas');
    t.width = cv.width; t.height = cv.height;
    const x = t.getContext('2d');
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = 'rgba(255,72,48,0.75)';
    x.fillRect(0, 0, t.width, t.height);
    REN_TINT.set(cv, t);
  }
  return t;
}
function drawBuilding(c, b, s, season, now) {
  const nx = (b.x - b.y) * 32, ny = (b.x + b.y) * 16;
  c.drawImage(s.c, nx + s.ox, ny + s.oy, s.w, s.h);
  if (b.flash && now - b.flash < 0.15) {
    c.globalAlpha = 0.55; c.drawImage(renTintOf(s.c), nx + s.ox, ny + s.oy, s.w, s.h); c.globalAlpha = 1;
  }
  if (b.type === 'manor' && b.done && !b.ruined) drawManorFlag(c, b, s, now);
  if (b.type === 'tower' && b.done && !b.ruined && b._manned) {
    const u = b._manned;
    c.save();
    c.translate(nx, ny + 16 - REN_DECK);
    c.scale(REN_FIG, REN_FIG);
    drawFigure(c, 0, 0, u.look, { dir: u.dir || 1, action: 'bow', armed: true, phase: 0 });
    c.restore();
  }
  // 연기와 불: 발판 안의 땅 위 한 점에서 높이(lift)만큼 띄운다
  const topY = ny + s.oy;
  const cy = (b.x + b.y + (b.w + b.h) / 2) * 16;
  const H = Math.max(12, cy - topY);
  // 굴뚝·향로 연기는 그림이 알려 준 자리(SPRITE_META smoke, 북쪽 꼭짓점 기준)에서
  const sm = (SPRITE_META[b.type] || {}).smoke;
  if (sm && b.done && !b.ruined && Math.random() < 0.06) {
    // 좌우로 뒤집힌 그림(dir 1·3)은 연기 자리도 뒤집는다
    const sx = nx + (b.dir & 1 ? -sm[0] : sm[0]);
    if (b.type === 'smithy' && b._working) emitSmoke(sx, ny + sm[1], 'rgba(90,90,96,', 1);
    if (b.type === 'shrine' && (b.dir || 0) < 2) emitSmoke(sx, ny + sm[1] - 4, 'rgba(220,220,230,', 0.4);   // 향로는 문 앞에만
    if (b.type === 'altar_ma') emitSmoke(sx + rnd(-4, 4), ny + sm[1] - 8, 'rgba(110,36,44,', 0.75);
  }
  if (b.ruined && Math.random() < 0.08) {
    const tx = b.x + rnd(0.2, b.w - 0.2), ty = b.y + rnd(0.2, b.h - 0.2);
    emitSmoke((tx - ty) * 32, (tx + ty) * 16 - rnd(0, 10), 'rgba(60,56,54,', 1.2);
  }
  if (b.burning && Math.random() < 0.45) {
    const tx = b.x + rnd(0.15, b.w - 0.15), ty = b.y + rnd(0.15, b.h - 0.15);
    emitFire((tx - ty) * 32, (tx + ty) * 16 - rnd(4, H * 0.7));
  }
}
// 영주관 깃발: 기단 동쪽 모서리(SPRITE_META.manor.flag)에 세운 깃대. 처마 모서리(58)보다 높이 솟는다
const REN_FLAG_H = 70;
function renFlagPos(b) {
  const f = (SPRITE_META.manor || {}).flag || [94, 41];
  const px = (b.x - b.y) * 32 + f[0], base = (b.x + b.y) * 16 + f[1];
  return { px, base, py: base - REN_FLAG_H };
}
// 깃폭(깃대 오른쪽 26×20)이나 깃대 위인가 (월드 픽셀)
function renFlagHit(b, wx, wy) {
  const f = renFlagPos(b);
  if (wx >= f.px - 2 && wx <= f.px + 27 && wy >= f.py - 3 && wy <= f.py + 22) return true;
  return Math.abs(wx - f.px) <= 2 && wy >= f.py && wy <= f.base;
}
// 깃발의 글자와 빛깔: 점령군 > 주군 > 마을 등급 (지도 풀이도 이것을 쓴다)
function manorFlagOf() {
  if (S.occupation) { const k = S.occupation.faction; return { ch: FACTIONS[k].hanja, col: FACTIONS[k].color, k, occupied: true }; }
  if (S.vassal) return { ch: FACTIONS[S.vassal].hanja, col: FACTIONS[S.vassal].color, k: S.vassal, occupied: false };
  return { ch: RANKS[S.rank].short, col: '#2f6f58', k: null, occupied: false };
}
function drawManorFlag(c, b, s, now) {
  const { px, base, py } = renFlagPos(b);
  const { ch, col } = manorFlagOf();
  c.strokeStyle = '#3b2414'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(px, py); c.lineTo(px, base); c.stroke();
  renEll(c, REN_GOLD, px, py - 1.2, 1.9, 1.9);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(px + 1, py + 2);
  for (let i = 0; i <= 8; i++) c.lineTo(px + 1 + i * 3, py + 2 + Math.sin(now * 3 + i * 0.8) * 1.6 * (i / 8));
  for (let i = 8; i >= 0; i--) c.lineTo(px + 1 + i * 3, py + 19 + Math.sin(now * 3 + i * 0.8) * 1.6 * (i / 8));
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.6; c.stroke();
  c.fillStyle = '#fff3dc'; c.font = '11px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, px + 13, py + 10.5 + Math.sin(now * 3 + 4) * 0.9);
}
const REN_POSE = { dir: 1, moving: false, walk: 0, action: null, phase: 0, armed: false, torch: false, tool: null, down: false };
function drawUnit(c, u, now) {
  const px = (u.x - u.y) * 32 + renJx(u), py = (u.x + u.y) * 16 + renJy(u);
  const P = REN_POSE;
  P.dir = u.dir || 1; P.moving = !!u.moving; P.walk = u.walk || 0; P.action = null; P.phase = 0;
  P.armed = false; P.torch = false; P.tool = null; P.down = u.down;
  if (u.atkT > 0) { P.action = 'attack'; P.phase = 1 - u.atkT / 0.12; }
  else if (u.workAnim) { P.action = 'work'; P.phase = (now * 1.6 + u.id * 0.37) % 1; P.tool = u.workAnim; }
  if (u.kind !== 'v' || u.role !== 'civ' || u.hero) P.armed = (S.raid && !u.workAnim) || u.kind === 'e';
  if (u.torch && isNight()) P.torch = true;
  c.save();
  c.translate(px, py); c.scale(REN_FIG, REN_FIG);
  drawFigure(c, 0, 0, u.look, P);
  if (u.hitT && now - u.hitT < 0.12) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.75;
    drawFigure(c, 0, 0, u.look, P);
  }
  c.restore();
}
// 말풍선: 조명 위에 그려 밤에도 읽히게
function renChat(c, u, px, py, head) {
  const fs = Math.max(7.5, renPx(9.5));
  c.font = `${fs.toFixed(1)}px "Gowun Batang", serif`;
  const w = c.measureText(u.chat.text).width + fs * 0.9, bh = fs * 1.45;
  const by = head - bh - 3;
  c.fillStyle = 'rgba(250,244,230,0.94)';
  c.fillRect(px - w / 2, by, w, bh);
  c.beginPath(); c.moveTo(px - 2.5, by + bh); c.lineTo(px + 2.5, by + bh); c.lineTo(px, by + bh + 3); c.fill();
  c.fillStyle = '#2a2018'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(u.chat.text, px, by + bh / 2 + 0.5);
}

// ── 조명 ─────────────────────────────────
// 화면 공간의 어둠 위에 불빛 자리를 도려내고(destination-out), 따뜻한 빛을 더한다(lighter)
function renHoleSprite() {
  if (R.hole) return R.hole;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  R.hole = cv;
  return cv;
}
function renGlowSprite(col) {
  let cv = R.glow.get(col);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, hexA(col, 1)); g.addColorStop(0.45, hexA(col, 0.42)); g.addColorStop(1, hexA(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  R.glow.set(col, cv);
  return cv;
}
function drawLighting(c, amb, now) {
  const L = R.lctx, lw = R.light.width, lh = R.light.height;
  const sc = lw / Cam.vw;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1;
  L.clearRect(0, 0, lw, lh);
  L.fillStyle = `rgba(${amb.r | 0},${amb.g | 0},${amb.b | 0},${amb.a})`;
  L.fillRect(0, 0, lw, lh);
  const n = collectLights();
  const lights = R.lights;
  if (amb.a > 0.12) {
    const hole = renHoleSprite();
    L.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < n; k++) {
      const l = lights[k];
      const p = worldToScreen(l.x, l.y);
      const rx = l.r * 40 * Cam.zoom * sc * (1 + Math.sin(now * 7 + l.x) * 0.03 * l.flicker), ry = rx * 0.66;
      const sx = p.x * sc, sy = p.y * sc + ry * 0.2;
      if (sx < -rx || sy < -ry || sx > lw + rx || sy > lh + ry) continue;
      L.globalAlpha = l.s;
      L.drawImage(hole, sx - rx, sy - ry, rx * 2, ry * 2);
    }
    L.globalAlpha = 1;
    L.globalCompositeOperation = 'source-over';
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(R.light, 0, 0, R.canvas.width, R.canvas.height);
  // 따뜻한 불빛
  if (amb.a > 0.2) {
    c.globalCompositeOperation = 'lighter';
    const k = Math.min(1, (amb.a - 0.2) * 2);
    for (let i = 0; i < n; i++) {
      const l = lights[i];
      const p = worldToScreen(l.x, l.y);
      const rx = l.r * 40 * Cam.zoom * Cam.dpr * 0.6, ry = rx * 0.72;
      const sx = p.x * Cam.dpr, sy = p.y * Cam.dpr;
      if (sx < -rx || sy < -ry || sx > R.canvas.width + rx || sy > R.canvas.height + ry) continue;
      c.globalAlpha = Math.min(1, 0.34 * k * l.s);
      c.drawImage(renGlowSprite(l.c), sx - rx, sy - ry, rx * 2, ry * 2);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
function renLight(x, y, r, col, flicker, s) {
  let l = R.lights[R.lightN];
  if (!l) { l = { x: 0, y: 0, r: 0, c: '', flicker: 0, s: 1 }; R.lights.push(l); }
  R.lightN++;
  l.x = x; l.y = y; l.r = r; l.c = col; l.flicker = flicker; l.s = s;
}
// 처음 방향의 발판 기준 점 (u, v) 을 놓인 방향의 발판 기준으로. 등을 보인 그림(2·3)은 문 앞 등롱이 문을 따라 반 바퀴 돌고,
// 뒤집힌 그림(1·3)은 (u, v) → (v, u). SPRITE_META[type].backLight === 'keep' 이면 등을 보여도 불 자리가 그대로인 그림
function renLightUV(b, d, u, v) {
  if (!d) return [u, v];
  const def = BDEF[b.type], W = def.w, H = def.h;
  if (d >= 2 && (SPRITE_META[b.type] || {}).backLight !== 'keep') { u = W - u; v = H - v; }
  return d & 1 ? [v, u] : [u, v];
}
// 불빛 위치 = 발판 기준 타일 점의 worldOf 에서 높이(lift)만큼 위. BDEF.light 항목: [x, y, 반경, 색, 높이?]
function collectLights() {
  R.lightN = 0;
  const V = R.view, m = 260;
  const night = isNight(), h = hourOf();
  for (const b of S.buildings) {
    const cx = (b.x - b.y + (b.w - b.h) / 2) * 32, cy = (b.x + b.y + (b.w + b.h) / 2) * 16;
    if (cx < V.x0 - m || cx > V.x1 + m || cy < V.y0 - m || cy > V.y1 + m) continue;
    if (b.burning) renLight(cx, cy - 22, 3 + b.w, '#ff6a2a', 3, 0.95);
    if (!b.done || b.ruined) continue;
    const def = BDEF[b.type];
    // 불빛 자리는 BDEF 가 먼저, 없으면 그림이 알려 준 자리 (갈래 건물)
    const lights = def.light || (SPRITE_META[b.type] || {}).light;
    const d = b.dir || 0;
    if (lights) {
      for (const L of lights) {
        const p = renLightUV(b, d, L[0], L[1]);
        const lx = b.x + p[0], ly = b.y + p[1];
        const lift = L.length > 4 ? L[4] : (def.lightLift || 16);
        renLight((lx - ly) * 32, (lx + ly) * 16 - lift, L[2], L[3], 1, 0.95);
      }
    }
    if ((b.type === 'house' || b.type === 'house2') && b._home > 0 && night && h < 23.5 && h > 12) {
      // 창 불빛은 보이는 앞면(뒤집힌 그림이면 오른쪽 앞면)에
      const lx = d & 1 ? b.x + b.w - 0.12 : b.x + b.w / 2, ly = d & 1 ? b.y + b.h / 2 : b.y + b.h - 0.12;
      renLight((lx - ly) * 32, (lx + ly) * 16 - 11, 1.7, '#ffc070', 0, 0.75);
    }
  }
  // 길목 이정표의 등롱
  for (const cr of R.crests) if (cr.on) renLight(cr.x + 6.4, cr.y - 16, 1.3, '#ffb060', 1, 0.8);
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (renGone(u) || !u.torch) continue;
    const px = (u.x - u.y) * 32 + renJx(u), py = (u.x + u.y) * 16 + renJy(u);
    if (px < V.x0 - m || px > V.x1 + m || py < V.y0 - m || py > V.y1 + m) continue;
    renLight(px + 3 * REN_FIG, py - 15 * REN_FIG, 2.4, '#ffa040', 4, 0.95);
  }
  return R.lightN;
}

// ── 효과 ─────────────────────────────────
function emitSmoke(x, y, col, size) {
  if (G.particles.length > 260) return;
  G.particles.push({ x, y, vx: rnd(-3, 3), vy: rnd(-14, -8), life: 0, max: rnd(2, 3.5), size: rnd(2, 4) * size, col, kind: 'smoke' });
}
function emitFire(x, y) {
  if (G.particles.length > 300) return;
  G.particles.push({ x, y, vx: rnd(-4, 4), vy: rnd(-22, -12), life: 0, max: rnd(0.4, 0.9), size: rnd(2, 4.5), kind: 'fire' });
}
function drawParticles(c, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life >= p.max) { G.particles.splice(i, 1); continue; }
    const t = p.life / p.max;
    if (p.kind === 'fire') {
      c.fillStyle = t < 0.4 ? `rgba(255,${200 - t * 200 | 0},80,${1 - t})` : `rgba(220,80,30,${(1 - t) * 0.8})`;
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 - t * 0.6), 0, Math.PI * 2); c.fill();
    } else {
      c.fillStyle = p.col + (0.45 * (1 - t)) + ')';
      c.beginPath(); c.arc(p.x, p.y, p.size * (1 + t * 1.6), 0, Math.PI * 2); c.fill();
    }
  }
}
// 효과는 타일 좌표(tx, ty)와 땅에서 띄울 높이(lift, 월드 픽셀)로 받는다
function addFx(fx) { fx.t0 = R.now; G.fx.push(fx); if (G.fx.length > 200) G.fx.shift(); }
function floatText(tx, ty, text, color, big, lift = 0) { addFx({ kind: 'text', tx, ty, lift, text, color, big, dur: 1.1 }); }
function fxPos(f) { return { x: (f.tx - f.ty) * 32, y: (f.tx + f.ty) * 16 - (f.lift || 0) }; }
function drawFx(c, now) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    const t = Math.max(0, (now - f.t0) / f.dur);   // 시각이 거꾸로 와도(바깥에서 그린 프레임) 반지름이 음수가 되지 않게
    if (t >= 1) { G.fx.splice(i, 1); continue; }
    const { x: fx, y: fy } = fxPos(f);
    if (f.kind === 'slash') {
      c.save(); c.translate(fx, fy - 11 * REN_FIG); c.scale((f.dir || 1) * REN_FIG, REN_FIG);
      c.strokeStyle = f.color || `rgba(255,255,255,${1 - t})`;
      c.globalAlpha = 1 - t;
      c.lineWidth = (f.big ? 3 : 1.6) * (1 - t * 0.5);
      const r = f.big ? 22 : 9;
      c.beginPath(); c.arc(0, 0, r, -1.2 + t * 0.6, 0.9 + t * 0.6); c.stroke();
      c.restore();
    } else if (f.kind === 'ring') {
      c.strokeStyle = f.color; c.globalAlpha = 1 - t; c.lineWidth = 2;
      c.beginPath(); c.ellipse(fx, fy, f.r * t + 4, (f.r * t + 4) * 0.5, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    } else if (f.kind === 'spark') {
      c.fillStyle = `rgba(255,230,160,${1 - t})`;
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + f.tx * 7; c.fillRect(fx + Math.cos(a) * t * 10, fy - 11 * REN_FIG + Math.sin(a) * t * 8, 1.8, 1.8); }
    }
  }
}
function drawFloaters(c, now) {
  const small = Math.max(9, renPx(11)), big = Math.max(12, renPx(14));
  for (const f of G.fx) {
    if (f.kind !== 'text') continue;
    const t = (now - f.t0) / f.dur;
    c.globalAlpha = clamp(1.4 - t * 1.4, 0, 1);
    c.font = `${f.big ? 'bold ' + big.toFixed(1) : small.toFixed(1)}px "IBM Plex Sans KR", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const { x: fx, y: fy } = fxPos(f);
    const y = fy - 30 * REN_FIG - t * 16;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(f.text, fx + 0.8, y + 0.8);
    c.fillStyle = f.color; c.fillText(f.text, fx, y);
  }
  c.globalAlpha = 1;
}
// 화살: 타일 좌표 (x0,y0)→(x1,y1), 높이 z0→z1 (월드 픽셀)
function drawProjectiles(c) {
  for (const p of G.projectiles) {
    const t = clamp(p.t / p.dur, 0, 1);
    let z0 = p.z0 || 0;
    // 망루에서 쏜 화살은 발판 위 궁수의 손에서 나간다
    const tb = World.bAt(Math.floor(p.x0), Math.floor(p.y0));
    if (tb && tb.type === 'tower') z0 = Math.max(z0, REN_DECK + 12 * REN_FIG);
    const ax = (p.x0 - p.y0) * 32, ay = (p.x0 + p.y0) * 16 - z0;
    const bx = (p.x1 - p.y1) * 32, by = (p.x1 + p.y1) * 16 - (p.z1 || 0);
    const arc = 18;
    const x = lerp(ax, bx, t), y = lerp(ay, by, t) - Math.sin(t * Math.PI) * arc;
    const a = Math.atan2(by - ay - Math.cos(t * Math.PI) * arc * Math.PI, bx - ax);
    c.save(); c.translate(x, y); c.rotate(a);
    c.strokeStyle = '#3a2a1a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-7, 0); c.lineTo(3, 0); c.stroke();
    renBox(c, '#d6dce0', 3, -0.8, 2.2, 1.6); renBox(c, '#e8e0d0', -8, -1, 2.2, 2);
    c.restore();
  }
}

// ── 선택 표시, 건설 미리보기, 체력바, 이름, 표지 ──
function drawOverlays(c, now) {
  const season = renSeason();
  const V = R.view;
  const sel = UI.sel;
  if (sel && sel.b && S.bmap.get(sel.b.id)) {
    const b = sel.b;
    c.fillStyle = 'rgba(216,169,68,0.12)';
    renFootPath(c, b.x, b.y, b.w, b.h, 0); c.fill();
    c.strokeStyle = REN_GOLD; c.lineWidth = Math.max(1.5, renPx(1.6)); c.setLineDash([renPx(5), renPx(3.5)]);
    c.lineDashOffset = -now * renPx(8);
    renFootPath(c, b.x, b.y, b.w, b.h, -0.04); c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
    if (b.type === 'tower') rangeCircle(c, b.x + 0.5, b.y + 0.5, BDEF.tower.range);
    // 돌릴 수 있는 건물은 고르면 입구가 보인다
    if (canRotate(b.type) && !b.ruined && !UI.tool) { const f = doorFront(b); renDoorMark(c, b.dir || 0, f, walkable(f.x, f.y), now, false); }
  }
  if (sel && sel.u && !renGone(sel.u)) {
    const u = sel.u;
    const px = (u.x - u.y) * 32 + renJx(u), py = (u.x + u.y) * 16 + renJy(u);
    c.strokeStyle = REN_GOLD; c.lineWidth = Math.max(1.2, renPx(1.4));
    c.beginPath(); c.ellipse(px, py, 9 * REN_FIG, 4.5 * REN_FIG, 0, 0, Math.PI * 2); c.stroke();
  }
  // 사람 체력바·이름
  const lfs = Math.max(8, renPx(10.5));
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (renGone(u)) continue;
    const px = (u.x - u.y) * 32 + renJx(u), py = (u.x + u.y) * 16 + renJy(u);
    if (px < V.x0 - 60 || px > V.x1 + 60 || py < V.y0 - 10 || py > V.y1 + 50) continue;
    const show = u.hp < u.maxHp && !u.down && (S.raid || u.kind === 'e');
    const head = py - 25 * REN_FIG;
    if (show) {
      renBox(c, 'rgba(0,0,0,0.6)', px - 9, head - 5, 18, 2.8);
      renBox(c, u.kind === 'e' ? '#e0563f' : '#8fd06a', px - 9, head - 5, 18 * clamp(u.hp / u.maxHp, 0, 1), 2.8);
    }
    let label = null, col = null;
    if (u.hero) { label = u.hero.epithet + ' ' + u.name; col = '#ffd57a'; }
    else if (u.leader) { label = u.title; col = '#ff8a7a'; }
    let top = head - 3;
    if (label && Cam.zoom > 0.5) {
      c.font = `${lfs.toFixed(1)}px "Gowun Batang", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const ly = head - 8 - lfs * 0.5;
      c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillText(label, px + 0.7, ly + 0.7);
      c.fillStyle = col; c.fillText(label, px, ly);
      top = ly - lfs * 0.6;
    }
    if (u.chat && now < u.chat.until) renChat(c, u, px, py, show && top > head - 6 ? top - 4 : top);
  }
  // 건물 체력바, 공사 진척, 중지 표시: 그림 위쪽
  for (const b of S.buildings) {
    const def = BDEF[b.type];
    const hurt = b.hp < b.maxHp && b.done && !b.ruined && (S.raid || b.hp < b.maxHp * 0.7);
    const building = !b.done && !b.ruined;
    const idle = !b.active && b.done && !b.ruined && def.workers;
    if (!hurt && !building && !idle) continue;
    const s = renSpriteOf(b, season);
    const cx = (b.x - b.y + (b.w - b.h) / 2) * 32;
    const top = (b.x + b.y) * 16 + s.oy;
    if (cx < V.x0 - 80 || cx > V.x1 + 80 || top < V.y0 - 40 || top > V.y1 + 40) continue;
    const bw = Math.min(64, (b.w + b.h) * 13), bh = Math.max(3, renPx(3.2));
    let y = top - 2;
    if (hurt) {
      y -= bh + 2;
      renBox(c, 'rgba(0,0,0,0.6)', cx - bw / 2 - 1, y - 1, bw + 2, bh + 2);
      renBox(c, '#e0a03f', cx - bw / 2, y, bw * clamp(b.hp / b.maxHp, 0, 1), bh);
    }
    if (building) {
      y -= bh + 3;
      renBox(c, 'rgba(0,0,0,0.55)', cx - bw / 2 - 1, y - 1, bw + 2, bh + 2);
      renBox(c, REN_GOLD, cx - bw / 2, y, bw * clamp(b.progress / def.time, 0, 1), bh);
    }
    if (idle) {
      const fs = Math.max(10, renPx(11));
      c.font = `${fs.toFixed(1)}px "IBM Plex Sans KR", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText('중지').width + fs * 0.8, th = fs * 1.35;
      const ty = Math.min(y - th / 2 - 3, top + 18);
      c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillRect(cx - tw / 2, ty - th / 2, tw, th);
      c.fillStyle = '#ffcf7a'; c.fillText('중지', cx, ty + 0.5);
    }
  }
  drawToolGhost(c, now, season);
  drawMarkers(c, now, season);
}
// 이야기(튜토리얼)가 가리키는 곳: G.markers = [{x, y, text}] (타일 좌표, 보통 건물 가운데)
function drawMarkers(c, now, season) {
  if (!G.markers || !G.markers.length) return;
  if (season === undefined) season = renSeason();
  const k = Math.max(1, 0.9 / Cam.zoom);
  for (const m of G.markers) {
    const px = (m.x - m.y) * 32;
    let top = (m.x + m.y) * 16 - 30;
    const b = World.bAt(Math.floor(m.x), Math.floor(m.y));
    if (b) { const s = renSpriteOf(b, season); top = Math.min(top, (b.x + b.y) * 16 + s.oy + 10); }
    const y = top - 4 * k + Math.sin(now * 4) * 4 * k;
    c.save();
    c.translate(px, y); c.scale(k, k);
    c.fillStyle = '#ffd36a'; c.strokeStyle = '#3a2410'; c.lineWidth = 1.5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-9, -12); c.lineTo(-3.5, -12); c.lineTo(-3.5, -24);
    c.lineTo(3.5, -24); c.lineTo(3.5, -12); c.lineTo(9, -12); c.closePath(); c.fill(); c.stroke();
    if (m.text) {
      c.font = '12px "Gowun Batang", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const w = c.measureText(m.text).width + 14;
      c.fillStyle = 'rgba(28,20,17,0.92)'; c.fillRect(-w / 2, -45, w, 18);
      c.strokeStyle = 'rgba(216,169,68,0.7)'; c.lineWidth = 1; c.strokeRect(-w / 2 + 0.5, -44.5, w - 1, 17);
      c.fillStyle = '#ffe3a0'; c.fillText(m.text, 0, -35.5);
    }
    c.restore();
  }
}
// 망루 사거리: 타일 공간의 원 = 등각 타원
function rangeCircle(c, tx, ty, r) {
  c.strokeStyle = 'rgba(255,220,140,0.75)'; c.lineWidth = Math.max(1, renPx(1.2)); c.setLineDash([renPx(4), renPx(4)]);
  c.fillStyle = 'rgba(255,220,140,0.07)';
  c.beginPath(); c.ellipse((tx - ty) * 32, (tx + ty) * 16, r * 32 * REN_SQ2, r * 16 * REN_SQ2, 0, 0, Math.PI * 2);
  c.fill(); c.stroke(); c.setLineDash([]);
}
function drawToolGhost(c, now, season) {
  const tool = UI.tool, h = UI.hover;
  if (!tool || !h) return;
  const lw = Math.max(1.2, renPx(1.6));
  // 놓을 자리를 가늠하도록 커서 둘레에 옅은 격자
  if (tool.kind !== 'clear' && tool.kind !== 'demolish') {
    c.lineWidth = Math.max(0.8, renPx(1));
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = h.x + dx, y = h.y + dy;
      if (!World.inb(x, y)) continue;
      const d = Math.hypot(dx, dy);
      if (d > 4.5) continue;
      c.strokeStyle = `rgba(255,248,225,${(0.2 * (1 - d / 4.6)).toFixed(3)})`;
      renDia(c, (x - y) * 32, (x + y) * 16, -0.5); c.stroke();
    }
  }
  if (tool.kind === 'line' || tool.kind === 'road') {
    const tiles = UI.dragTiles && UI.dragTiles.length ? UI.dragTiles : [h];
    const set = new Set(tiles.map(p => p.y * MW + p.x));
    const fam = t => t === 'wall' || t === 'stonewall' || t === 'gate';
    for (const p of tiles) {
      const ok = tool.kind === 'road' ? canPlaceRoad(p.x, p.y) : canPlace(tool.key, p.x, p.y).ok;
      const nx = (p.x - p.y) * 32, ny = (p.x + p.y) * 16;
      c.fillStyle = ok ? 'rgba(140,220,120,0.36)' : 'rgba(230,80,60,0.40)';
      renDia(c, nx, ny, -1); c.fill();
      c.strokeStyle = ok ? 'rgba(170,240,150,0.85)' : 'rgba(250,110,90,0.9)'; c.lineWidth = lw * 0.8;
      c.stroke();
      if (tool.kind === 'line' && ok && BDEF[tool.key]) {
        let m = 0;
        const has = (x, y) => set.has(y * MW + x) || (() => { const o = World.bAt(x, y); return !!(o && fam(o.type) && !o.ruined); })();
        if (has(p.x, p.y - 1)) m |= 1;
        if (has(p.x + 1, p.y)) m |= 2;
        if (has(p.x, p.y + 1)) m |= 4;
        if (has(p.x - 1, p.y)) m |= 8;
        const def = BDEF[tool.key];
        const s = buildingSprite(tool.key, def.w, def.h, season, 'done', String(m));
        c.globalAlpha = 0.6; c.drawImage(s.c, nx + s.ox, ny + s.oy, s.w, s.h); c.globalAlpha = 1;
      }
    }
    return;
  }
  if (tool.kind === 'clear' || tool.kind === 'demolish') {
    const b = World.bAt(h.x, h.y);
    c.strokeStyle = tool.kind === 'clear' ? 'rgba(150,230,130,0.95)' : 'rgba(245,95,75,0.95)';
    c.fillStyle = tool.kind === 'clear' ? 'rgba(150,230,130,0.16)' : 'rgba(245,95,75,0.18)';
    c.lineWidth = lw * 1.2;
    if (b && tool.kind === 'demolish') renFootPath(c, b.x, b.y, b.w, b.h, 0);
    else renFootPath(c, h.x, h.y, 1, 1, 0);
    c.fill(); c.stroke();
    return;
  }
  if (tool.kind === 'build') {
    const def = BDEF[tool.key];
    // 놓일 자리·방향은 UI 가 정한다 (들고 있는 방향, 손대지 않았으면 맞닿은 길 쪽)
    const P = UI.buildPlan(h.x, h.y);
    const bx = P.x, by = P.y;
    const res = canPlace(tool.key, bx, by, P.dir);
    c.fillStyle = res.ok ? 'rgba(140,220,120,0.34)' : 'rgba(230,80,60,0.40)';
    renFootPath(c, bx, by, P.w, P.h, 0); c.fill();
    // 성문은 놓일 자리의 담장 방향대로 돌려 보여 준다 (놓은 뒤와 같게)
    const s = buildingSprite(tool.key, P.w, P.h, season, 'done', tool.key === 'gate' ? String(wallMask({ x: bx, y: by })) : '', P.dir);
    c.globalAlpha = 0.7;
    c.drawImage(s.c, (bx - by) * 32 + s.ox, (bx + by) * 16 + s.oy, s.w, s.h);
    c.globalAlpha = 1;
    c.strokeStyle = res.ok ? 'rgba(170,240,150,0.9)' : 'rgba(250,110,90,0.95)'; c.lineWidth = lw;
    renFootPath(c, bx, by, P.w, P.h, 0); c.stroke();
    // 커서가 가리키는 칸
    c.strokeStyle = 'rgba(255,245,220,0.75)'; c.lineWidth = lw * 0.7;
    renFootPath(c, h.x, h.y, 1, 1, 0.08); c.stroke();
    if (tool.key === 'tower') rangeCircle(c, bx + 0.5, by + 0.5, def.range);
    // 입구: 문 앞 칸에 바깥을 가리키는 금빛 화살. 그 칸이 길이거나 걸을 수 있으면 초록, 막혔으면 붉게
    if (P.rot) renDoorMark(c, P.dir, P.door, P.doorOk, now, true);
  }
}
// 디딤돌: 문 앞 칸(f)의 건물 쪽 가장자리에 납작한 돌 하나와 밟아 다진 흙
function renDoorstep(c, b, f, season) {
  const d = b.dir || 0, v = DIR_VEC[d], cu = f.x + 0.5, cv = f.y + 0.5;
  const P = (t, side, z = 0) => { const u = cu + v[0] * t - v[1] * side, w = cv + v[1] * t + v[0] * side; return [(u - w) * 32, (u + w) * 16 - z]; };
  const quad = (t0, t1, s, z) => { const q = [P(t0, -s, z), P(t1, -s, z), P(t1, s, z), P(t0, s, z)]; c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
  if (!World.isRoad(f.x, f.y)) { quad(-0.5, 0.3, 0.42, 0); c.fillStyle = season === 3 ? 'rgba(150,140,128,0.35)' : 'rgba(120,92,58,0.32)'; c.fill(); }
  // 돌의 옆면(두께) → 윗면
  quad(-0.48, -0.16, 0.3, 0); c.fillStyle = '#6e6a62'; c.fill();
  quad(-0.48, -0.16, 0.3, 2.2); c.fillStyle = season === 3 ? '#e6ebf0' : '#b4afa4'; c.fill();
  c.strokeStyle = 'rgba(40,36,30,0.55)'; c.lineWidth = 0.6; c.stroke();
}
// 문 앞 칸(door)과 그 칸을 지나 바깥으로 나가는 화살. ok: 드나들 수 있는 칸인가. label: '입구' 이름표
function renDoorMark(c, dir, door, ok, now, label) {
  const v = DIR_VEC[dir], cu = door.x + 0.5, cv = door.y + 0.5;
  const P = (u, w) => [(u - w) * 32, (u + w) * 16];
  const pulse = 0.5 + 0.5 * Math.sin(now * 5);
  // 문 앞 칸
  c.fillStyle = ok ? `rgba(150,230,120,${(0.3 + 0.12 * pulse).toFixed(3)})` : `rgba(235,85,60,${(0.36 + 0.12 * pulse).toFixed(3)})`;
  renDia(c, (door.x - door.y) * 32, (door.x + door.y) * 16, -1); c.fill();
  c.strokeStyle = ok ? 'rgba(255,214,110,0.95)' : 'rgba(255,120,95,0.95)'; c.lineWidth = Math.max(1.2, renPx(1.6));
  c.stroke();
  // 화살: 발판 가장자리(문 칸의 안쪽 변)에서 문 칸 바깥 변 너머까지. 화면에서 늘 보이게 위에 겹쳐 그린다
  const s = (t, side) => P(cu + v[0] * t - v[1] * side, cv + v[1] * t + v[0] * side);
  const pts = [s(-0.62, 0.12), s(0.12, 0.12), s(0.12, 0.3), s(0.62, 0), s(0.12, -0.3), s(0.12, -0.12), s(-0.62, -0.12)];
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath();
  c.fillStyle = ok ? '#ffd36a' : '#ff8a6a'; c.fill();
  c.strokeStyle = '#3a2410'; c.lineWidth = Math.max(1, renPx(1.4)); c.lineJoin = 'round'; c.stroke();
  if (!label) return;
  const fs = Math.max(10, renPx(12));
  const [lx, ly0] = P(cu + v[0] * 0.95, cv + v[1] * 0.95);
  const ly = ly0 + (v[1] < 0 || v[0] < 0 ? -fs * 0.9 : fs * 0.9);
  const text = ok ? '입구' : '입구 막힘';
  c.font = `${fs.toFixed(1)}px "Gowun Batang", serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  const tw = c.measureText(text).width + fs * 0.9, th = fs * 1.5;
  c.fillStyle = 'rgba(28,20,17,0.9)'; c.fillRect(lx - tw / 2, ly - th / 2, tw, th);
  c.strokeStyle = ok ? 'rgba(216,169,68,0.85)' : 'rgba(240,110,90,0.9)'; c.lineWidth = Math.max(0.8, renPx(1)); c.strokeRect(lx - tw / 2, ly - th / 2, tw, th);
  c.fillStyle = ok ? '#ffe3a0' : '#ffb4a0'; c.fillText(text, lx, ly + fs * 0.05);
}

// ── 날씨 (화면 공간) ───────────────────────
function drawWeather(c, dt, season) {
  const want = season === 1 ? (S.rain ? 140 : 0) : season === 3 ? 90 : 26;
  while (R.weather.length < want) R.weather.push({ x: Math.random() * Cam.vw, y: Math.random() * Cam.vh, s: Math.random(), ph: Math.random() * 6 });
  if (R.weather.length > want) R.weather.length = want;
  for (const p of R.weather) {
    if (season === 1) {
      p.x += -60 * dt; p.y += 520 * dt;
      c.strokeStyle = 'rgba(190,210,230,0.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 2, p.y + 9); c.stroke();
    } else if (season === 3) {
      p.ph += dt; p.x += Math.sin(p.ph) * 12 * dt; p.y += (22 + p.s * 26) * dt;
      c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(p.x, p.y, 1 + p.s * 1.6, 0, Math.PI * 2); c.fill();
    } else {
      p.ph += dt * 2; p.x += (18 + Math.sin(p.ph) * 22) * dt; p.y += (24 + p.s * 14) * dt;
      c.fillStyle = season === 0 ? 'rgba(244,180,200,0.85)' : (p.s > 0.5 ? 'rgba(214,120,42,0.9)' : 'rgba(200,150,50,0.9)');
      c.save(); c.translate(p.x, p.y); c.rotate(p.ph); c.fillRect(-2.2, -1.2, 4.4, 2.4); c.restore();
    }
    if (p.y > Cam.vh + 10) { p.y = -10; p.x = Math.random() * (Cam.vw + 60); }
    if (p.x < -20) p.x = Cam.vw + 10;
    if (p.x > Cam.vw + 20) p.x = -10;
  }
}

// ── 미니맵 (위에서 내려다본 지도) ─────────────
function drawMinimap() {
  if (!R.mini || R.mini.offsetParent === null) return;
  const m = R.mctx;
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.drawImage(R.miniBase, 0, 0);
  for (const b of S.buildings) {
    m.fillStyle = b.ruined ? '#2a2420' : b.type === 'manor' ? '#d6aa52' : b.type === 'farm' ? '#b89a50' : '#e9dcc0';
    m.fillRect(b.x * 2, b.y * 2, b.w * 2, b.h * 2);
  }
  m.fillStyle = '#ffffff';
  for (const v of S.villagers) if (!renGone(v)) m.fillRect(v.x * 2 - 0.5, v.y * 2 - 0.5, 1.5, 1.5);
  m.fillStyle = '#7ab8ff';
  for (const a of S.allies) if (!a.dead) m.fillRect(a.x * 2 - 1, a.y * 2 - 1, 2.5, 2.5);
  m.fillStyle = '#ff3a2a';
  for (const e of S.enemies) if (!e.dead) m.fillRect(e.x * 2 - 1, e.y * 2 - 1, 3, 3);
  // 화면 네 모서리를 타일로 되돌린 사각형(지도 위에서는 기울어진 마름모꼴)
  m.strokeStyle = 'rgba(255,240,200,0.95)'; m.lineWidth = 1; m.lineJoin = 'round';
  m.beginPath();
  const cs = [[0, 0], [Cam.vw, 0], [Cam.vw, Cam.vh], [0, Cam.vh]];
  for (let k = 0; k < 4; k++) {
    const t = screenToTile(cs[k][0], cs[k][1]);
    if (k) m.lineTo(t.x * 2, t.y * 2); else m.moveTo(t.x * 2, t.y * 2);
  }
  m.closePath(); m.stroke();
}
