'use strict';
// ───────────────────────────────────────────────
// 화면 그리기: 지형 캐시, 깊이 정렬, 낮밤 조명, 날씨, 미니맵
// ───────────────────────────────────────────────
const Cam = { x: 0, y: 0, zoom: 1.25, vw: 800, vh: 600, dpr: 1 };
const R = {
  canvas: null, ctx: null, light: null, lctx: null, terrain: null, tctx: null,
  mini: null, mctx: null, miniBase: null, miniT: 0,
  weather: [], lastT: 0, season: -1, now: 0,
};
// 일시적인 효과 (저장하지 않음)
const G = { fx: [], particles: [], projectiles: [] };

function initRender() {
  R.canvas = document.getElementById('game');
  R.ctx = R.canvas.getContext('2d');
  R.light = document.createElement('canvas');
  R.lctx = R.light.getContext('2d');
  R.terrain = document.createElement('canvas');
  R.terrain.width = MW * TILE; R.terrain.height = MH * TILE;
  R.tctx = R.terrain.getContext('2d');
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
  R.light.width = Math.round(Cam.vw / 2); R.light.height = Math.round(Cam.vh / 2);
}
function screenToWorld(sx, sy) {
  return { x: (sx - Cam.vw / 2) / Cam.zoom + Cam.x, y: (sy - Cam.vh / 2) / Cam.zoom + Cam.y };
}
function worldToScreen(wx, wy) {
  return { x: (wx - Cam.x) * Cam.zoom + Cam.vw / 2, y: (wy - Cam.y) * Cam.zoom + Cam.vh / 2 };
}
function clampCamera() {
  const mx = MW * TILE, my = MH * TILE;
  Cam.zoom = clamp(Cam.zoom, Math.max(0.45, Math.min(Cam.vw / mx, Cam.vh / my)), 2.6);
  const hw = Cam.vw / 2 / Cam.zoom, hh = Cam.vh / 2 / Cam.zoom;
  Cam.x = mx < hw * 2 ? mx / 2 : clamp(Cam.x, hw - 40, mx - hw + 40);
  Cam.y = my < hh * 2 ? my / 2 : clamp(Cam.y, hh - 80, my - hh + 120);
}

// ── 지형 캐시 ─────────────────────────────
const GROUND_PAL = [
  { grass: ['#8dbb5c', '#83b153', '#97c464'], floor: '#6c9a47', dirt: '#b39468', sand: '#dcc994', rock: ['#86827a', '#9d998f', '#6a675f'], water: '#3d7ea8', shore: '#9fd0e6' },
  { grass: ['#6fa648', '#669c40', '#79b04f'], floor: '#4e7e37', dirt: '#ad8c5f', sand: '#d8c48c', rock: ['#827e76', '#9a968c', '#66635c'], water: '#367599', shore: '#94c8e0' },
  { grass: ['#aaa758', '#a09c4d', '#b6b162'], floor: '#8a7a42', dirt: '#ad8a5c', sand: '#d6c08a', rock: ['#858077', '#9c978c', '#69655d'], water: '#3a7294', shore: '#9cc4d6' },
  { grass: ['#e4e9ed', '#d9e0e6', '#eef1f4'], floor: '#c8d1d6', dirt: '#cfc6b8', sand: '#e6e0d2', rock: ['#9a9aa0', '#b4b4ba', '#7c7c84'], water: '#4b7894', shore: '#e8f2f8' },
];
function redrawTerrain() {
  const c = R.tctx, season = seasonIdx();
  const P = GROUND_PAL[season];
  R.season = season;
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) drawGroundTile(c, x, y, P, season);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (World.road[y * MW + x]) drawRoadTile(c, x, y, season);
  World.terrainDirty = false;
  // 미니맵 바탕
  const m = R.miniBase.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const t = World.tiles[y * MW + x];
    m.fillStyle = World.road[y * MW + x] ? '#c8a878'
      : t === T.WATER ? P.water : t === T.ROCK ? P.rock[0] : t === T.FOREST ? '#3f6a3a' : t === T.SAND ? P.sand : t === T.DIRT ? P.dirt : P.grass[0];
    m.fillRect(x * 2, y * 2, 2, 2);
  }
}
function drawGroundTile(c, x, y, P, season) {
  const i = y * MW + x, t = World.tiles[i], v = World.tvar[i];
  const px = x * TILE, py = y * TILE;
  const nb = (dx, dy) => World.tile(x + dx, y + dy);
  if (t === T.WATER) {
    c.fillStyle = P.water; c.fillRect(px, py, TILE, TILE);
    c.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = 0; k < 3; k++) c.fillRect(px + ((v * (k + 3)) % 24), py + 6 + k * 9, 8, 1.2);
    c.fillStyle = P.shore;
    if (nb(0, -1) !== T.WATER) c.fillRect(px, py, TILE, 2.5);
    if (nb(0, 1) !== T.WATER) c.fillRect(px, py + TILE - 2, TILE, 2);
    if (nb(-1, 0) !== T.WATER) c.fillRect(px, py, 2.5, TILE);
    if (nb(1, 0) !== T.WATER) c.fillRect(px + TILE - 2.5, py, 2.5, TILE);
    if (season === 3 && v % 4 === 0) { c.fillStyle = 'rgba(230,240,248,0.45)'; c.fillRect(px + 4, py + 8, 18, 10); }
    return;
  }
  let base;
  if (t === T.FOREST) base = P.floor;
  else if (t === T.SAND) base = P.sand;
  else if (t === T.DIRT) base = P.dirt;
  else if (t === T.ROCK) base = P.rock[2];
  else base = P.grass[v % 3];
  c.fillStyle = base; c.fillRect(px, py, TILE, TILE);
  if (t === T.GRASS || t === T.FOREST) {
    c.fillStyle = season === 3 ? 'rgba(160,175,185,0.35)' : 'rgba(30,60,20,0.22)';
    for (let k = 0; k < 4; k++) {
      const gx = px + ((v * (k + 1) * 7) % 28) + 2, gy = py + ((v * (k + 2) * 5) % 26) + 3;
      c.fillRect(gx, gy, 1, 3); c.fillRect(gx + 2, gy + 1, 1, 2);
    }
    if (season === 0 && t === T.GRASS && v % 5 === 0) {
      const fc = ['#fff6e0', '#f4c4d0', '#ffe27a'][v % 3];
      c.fillStyle = fc; c.fillRect(px + (v % 22) + 4, py + (v % 18) + 6, 2, 2); c.fillRect(px + (v % 13) + 12, py + (v % 9) + 16, 2, 2);
    }
    if (season === 2 && v % 4 === 0) { c.fillStyle = '#c9702a'; c.fillRect(px + (v % 20) + 5, py + (v % 17) + 7, 2, 1.5); }
  } else if (t === T.SAND || t === T.DIRT) {
    c.fillStyle = 'rgba(80,60,30,0.18)';
    for (let k = 0; k < 5; k++) c.fillRect(px + ((v * (k + 2) * 3) % 30), py + ((v * (k + 1) * 7) % 30), 1.5, 1.5);
  } else if (t === T.ROCK) {
    const [mid, light, dark] = P.rock;
    const boulders = 2 + (v % 2);
    for (let k = 0; k < boulders; k++) {
      const bx = px + 4 + ((v * (k + 1) * 11) % 20), by = py + 6 + ((v * (k + 3) * 7) % 18);
      const r = 6 + ((v >> k) % 5);
      c.fillStyle = dark; c.beginPath(); c.ellipse(bx + 1, by + 2, r, r * 0.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = mid; c.beginPath(); c.ellipse(bx, by, r, r * 0.78, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = light; c.beginPath(); c.ellipse(bx - r * 0.3, by - r * 0.3, r * 0.5, r * 0.35, -0.4, 0, Math.PI * 2); c.fill();
      if (season === 3) { c.fillStyle = 'rgba(244,247,250,0.9)'; c.beginPath(); c.ellipse(bx - 1, by - r * 0.5, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); c.fill(); }
    }
    if (nb(0, 1) !== T.ROCK) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(px, py + TILE - 4, TILE, 4); }
  }
  // 물가 그림자
  if (nb(0, -1) === T.ROCK && t !== T.ROCK) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(px, py, TILE, 5); }
}
function drawRoadTile(c, x, y, season) {
  const px = x * TILE, py = y * TILE;
  const water = World.tiles[y * MW + x] === T.WATER;
  const n = World.isRoad(x, y - 1), s = World.isRoad(x, y + 1), w = World.isRoad(x - 1, y), e = World.isRoad(x + 1, y);
  const m = 6;
  if (water) {
    const horiz = (w || e) && !(n || s) ? true : (n || s) ? false : true;
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px + 2, py + 4, TILE - 4, TILE - 2);
    c.fillStyle = '#8a5f36';
    if (horiz) {
      c.fillRect(px, py + 5, TILE, TILE - 10);
      c.fillStyle = '#6b4428'; for (let k = 0; k < TILE; k += 4) c.fillRect(px + k, py + 5, 1, TILE - 10);
      c.fillStyle = '#4a2f1c'; c.fillRect(px, py + 4, TILE, 2); c.fillRect(px, py + TILE - 6, TILE, 2);
    } else {
      c.fillRect(px + 5, py, TILE - 10, TILE);
      c.fillStyle = '#6b4428'; for (let k = 0; k < TILE; k += 4) c.fillRect(px + 5, py + k, TILE - 10, 1);
      c.fillStyle = '#4a2f1c'; c.fillRect(px + 4, py, 2, TILE); c.fillRect(px + TILE - 6, py, 2, TILE);
    }
    if (season === 3) { c.fillStyle = 'rgba(244,247,250,0.6)'; c.fillRect(px + 8, py + 8, 10, 6); }
    return;
  }
  const col = season === 3 ? '#cbbfa8' : '#c4a676';
  const edge = season === 3 ? '#b0a48c' : '#9d8156';
  c.fillStyle = edge;
  c.fillRect(px + m - 1, py + m - 1, TILE - 2 * m + 2, TILE - 2 * m + 2);
  if (n) c.fillRect(px + m - 1, py, TILE - 2 * m + 2, m);
  if (s) c.fillRect(px + m - 1, py + TILE - m, TILE - 2 * m + 2, m);
  if (w) c.fillRect(px, py + m - 1, m, TILE - 2 * m + 2);
  if (e) c.fillRect(px + TILE - m, py + m - 1, m, TILE - 2 * m + 2);
  c.fillStyle = col;
  c.fillRect(px + m, py + m, TILE - 2 * m, TILE - 2 * m);
  if (n) c.fillRect(px + m, py, TILE - 2 * m, m);
  if (s) c.fillRect(px + m, py + TILE - m, TILE - 2 * m, m);
  if (w) c.fillRect(px, py + m, m, TILE - 2 * m);
  if (e) c.fillRect(px + TILE - m, py + m, m, TILE - 2 * m);
  const v = World.tvar[y * MW + x];
  c.fillStyle = 'rgba(90,70,40,0.35)';
  for (let k = 0; k < 4; k++) c.fillRect(px + m + ((v * (k + 1) * 5) % (TILE - 2 * m - 2)), py + m + ((v * (k + 2) * 3) % (TILE - 2 * m - 2)), 2, 1.5);
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

// ── 메인 그리기 ───────────────────────────
function render(nowMs) {
  const now = nowMs / 1000;
  const rdt = Math.min(0.1, now - (R.lastT || now));
  R.lastT = now; R.now = now;
  const c = R.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#16120f';
  c.fillRect(0, 0, R.canvas.width, R.canvas.height);
  if (!S) return;
  if (World.terrainDirty || R.season !== seasonIdx()) redrawTerrain();
  const z = Cam.zoom * Cam.dpr;
  c.setTransform(z, 0, 0, z, (Cam.vw / 2 - Cam.x * Cam.zoom) * Cam.dpr, (Cam.vh / 2 - Cam.y * Cam.zoom) * Cam.dpr);
  c.imageSmoothingEnabled = true;
  c.drawImage(R.terrain, 0, 0);

  const tl = screenToWorld(0, 0), br = screenToWorld(Cam.vw, Cam.vh);
  const x0 = Math.max(0, Math.floor(tl.x / TILE) - 2), y0 = Math.max(0, Math.floor(tl.y / TILE) - 2);
  const x1 = Math.min(MW - 1, Math.ceil(br.x / TILE) + 2), y1 = Math.min(MH - 1, Math.ceil(br.y / TILE) + 3);
  const season = seasonIdx();

  // 물결 반짝임
  c.fillStyle = 'rgba(255,255,255,0.22)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * MW + x;
    if (World.tiles[i] !== T.WATER || World.road[i]) continue;
    const v = World.tvar[i];
    const ph = Math.sin(now * 1.6 + v * 0.7 + x * 0.5);
    if (ph > 0.55) c.fillRect(x * TILE + (v % 20) + 4 + ph * 3, y * TILE + ((v >> 3) % 20) + 6, 6, 1.3);
  }

  // 바닥에 붙은 건물(논밭)
  for (const b of S.buildings) if (BDEF[b.type].ground && b.done && !b.ruined) drawBuilding(c, b, season, now);

  // 깊이 정렬 대상 모으기
  const items = [];
  for (const b of S.buildings) {
    if (b.x > x1 + 2 || b.x + b.w < x0 - 2 || b.y > y1 + 3 || b.y + b.h < y0) continue;
    if (BDEF[b.type].ground && b.done && !b.ruined) continue;
    items.push({ k: (b.y + b.h) * TILE - 0.5, b });
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * MW + x;
    if (World.tiles[i] === T.FOREST && !World.occ[i] && !World.road[i]) items.push({ k: (y + 0.82) * TILE, tx: x, ty: y });
  }
  const units = [S.villagers, S.enemies, S.allies];
  for (const arr of units) for (const u of arr) {
    if (u.inside || u.dead) continue;
    if (u.x < x0 - 1 || u.x > x1 + 1 || u.y < y0 - 1 || u.y > y1 + 2) continue;
    items.push({ k: u.y * TILE + 0.1, u });
  }
  items.sort((a, b) => a.k - b.k);
  for (const it of items) {
    if (it.b) drawBuilding(c, it.b, season, now);
    else if (it.u) drawUnit(c, it.u, now);
    else {
      const v = World.tvar[it.ty * MW + it.tx];
      const s = treeSprite(v, season);
      const ox = ((v >> 2) % 7) - 3, oy = ((v >> 4) % 5) - 2;
      c.drawImage(s.c, it.tx * TILE + 16 - s.ax + ox, it.ty * TILE + 26 - s.ay + oy, s.w, s.h);
    }
  }

  drawParticles(c, rdt);
  drawFx(c, now);
  drawProjectiles(c);

  // 조명
  const amb = ambientAt(hourOf());
  if (amb.a > 0.01) drawLighting(c, amb, now, x0, y0, x1, y1);

  // 조명 위에 그리는 표시들
  c.setTransform(z, 0, 0, z, (Cam.vw / 2 - Cam.x * Cam.zoom) * Cam.dpr, (Cam.vh / 2 - Cam.y * Cam.zoom) * Cam.dpr);
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
function drawBuilding(c, b, season, now) {
  const def = BDEF[b.type];
  let s;
  if (b.ruined) s = buildingSprite(b.type, b.w, b.h, season, 'ruin');
  else if (!b.done) s = buildingSprite(b.type, b.w, b.h, season, 'build', (Math.floor(clamp(b.progress / Math.max(0.01, def.time), 0, 1) * 4) / 4).toFixed(2));
  else s = buildingSprite(b.type, b.w, b.h, season, 'done', def.line ? String(wallMask(b)) : '');
  const px = b.x * TILE, py = b.y * TILE;
  c.drawImage(s.c, px + s.ox, py + s.oy, s.w, s.h);
  if (b.flash && now - b.flash < 0.15) {
    c.fillStyle = 'rgba(255,80,60,0.35)'; c.fillRect(px, py - (def.top || 0) * TILE * 0.6, b.w * TILE, b.h * TILE + (def.top || 0) * TILE * 0.6);
  }
  if (b.type === 'manor' && !b.ruined) drawManorFlag(c, b, now);
  if (b.type === 'tower' && b.done && !b.ruined && b._manned) {
    const u = b._manned;
    drawFigure(c, px + 16, py - 40, u.look, { dir: u.dir || 1, action: 'bow', armed: true, phase: 0 });
  }
  // 굴뚝 연기, 폐허 연기
  if (Math.random() < 0.06) {
    if (b.type === 'smithy' && b.done && !b.ruined && b._working) emitSmoke(px + b.w * TILE - 11, py - 28, 'rgba(90,90,96,', 1);
    if (b.type === 'shrine' && b.done && !b.ruined) emitSmoke(px + 32, py + 52, 'rgba(220,220,230,', 0.4);
  }
  if (b.ruined && Math.random() < 0.08) emitSmoke(px + rnd(4, b.w * TILE - 4), py + rnd(4, b.h * TILE - 8), 'rgba(60,56,54,', 1.2);
  if (b.burning && Math.random() < 0.4) emitFire(px + rnd(4, b.w * TILE - 4), py + rnd(0, b.h * TILE - 8));
}
function drawManorFlag(c, b, now) {
  const px = b.x * TILE + b.w * TILE - 2, py = b.y * TILE - 44;
  let col = '#2f6f58', ch = RANKS[S.rank].short;
  if (S.occupation) { col = FACTIONS[S.occupation.faction].color; ch = FACTIONS[S.occupation.faction].hanja; }
  else if (S.vassal) { col = FACTIONS[S.vassal].color; ch = FACTIONS[S.vassal].hanja; }
  line(c, '#3b2414', 1.6, px, py, px, py + 46);
  circ(c, PAL.gold, px, py - 1, 1.6);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(px + 1, py + 2);
  for (let i = 0; i <= 6; i++) {
    const xx = px + 1 + i * 3, yy = py + 2 + Math.sin(now * 3 + i * 0.9) * 1.4;
    c.lineTo(xx, yy);
  }
  for (let i = 6; i >= 0; i--) {
    const xx = px + 1 + i * 3, yy = py + 16 + Math.sin(now * 3 + i * 0.9) * 1.4;
    c.lineTo(xx, yy);
  }
  c.closePath(); c.fill();
  c.fillStyle = '#fff3dc'; c.font = '9px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(ch, px + 10, py + 9 + Math.sin(now * 3 + 3) * 1.4);
}
function drawUnit(c, u, now) {
  const px = u.x * TILE + (u.ox || 0), py = u.y * TILE + (u.oy || 0);
  const P = { dir: u.dir || 1, moving: !!u.moving, walk: u.walk || 0, action: null, phase: 0, armed: false, torch: false, tool: null, down: u.down };
  if (u.atkT > 0) { P.action = 'attack'; P.phase = 1 - u.atkT / 0.12; }
  else if (u.workAnim) { P.action = 'work'; P.phase = (now * 1.6 + u.id * 0.37) % 1; P.tool = u.workAnim; }
  if (u.kind !== 'v' || u.role !== 'civ' || u.hero) P.armed = (S.raid && !u.workAnim) || u.kind === 'e';
  if (u.torch && isNight()) P.torch = true;
  drawFigure(c, px, py, u.look, P);
  if (u.hitT && now - u.hitT < 0.12) { c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(px - 5, py - 20, 10, 20); }
  if (u.chat && now < u.chat.until) {
    c.font = '7px "Gowun Batang", serif';
    const w = c.measureText(u.chat.text).width + 6;
    c.fillStyle = 'rgba(250,244,230,0.92)';
    c.fillRect(px - w / 2, py - 33, w, 10);
    c.beginPath(); c.moveTo(px - 2, py - 23); c.lineTo(px + 2, py - 23); c.lineTo(px, py - 20); c.fill();
    c.fillStyle = '#2a2018'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(u.chat.text, px, py - 28);
  }
}

function drawLighting(c, amb, now, x0, y0, x1, y1) {
  const L = R.lctx, lw = R.light.width, lh = R.light.height;
  const sc = lw / Cam.vw;
  L.globalCompositeOperation = 'source-over';
  L.clearRect(0, 0, lw, lh);
  L.fillStyle = `rgba(${amb.r | 0},${amb.g | 0},${amb.b | 0},${amb.a})`;
  L.fillRect(0, 0, lw, lh);
  const lights = collectLights(now, x0, y0, x1, y1);
  if (amb.a > 0.12) {
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const p = worldToScreen(l.x, l.y);
      const r = l.r * TILE * Cam.zoom * sc * (1 + Math.sin(now * 7 + l.x) * 0.03 * (l.flicker || 0));
      const sx = p.x * sc, sy = p.y * sc;
      if (sx < -r || sy < -r || sx > lw + r || sy > lh + r) continue;
      const g = L.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(0,0,0,${l.s || 0.95})`);
      g.addColorStop(0.5, `rgba(0,0,0,${(l.s || 0.95) * 0.55})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g;
      L.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = true;
  c.drawImage(R.light, 0, 0, R.canvas.width, R.canvas.height);
  // 따뜻한 불빛
  if (amb.a > 0.2) {
    c.globalCompositeOperation = 'lighter';
    const k = Math.min(1, (amb.a - 0.2) * 2);
    for (const l of lights) {
      const p = worldToScreen(l.x, l.y);
      const r = l.r * TILE * Cam.zoom * Cam.dpr * 0.55;
      const sx = p.x * Cam.dpr, sy = p.y * Cam.dpr;
      if (sx < -r || sy < -r || sx > R.canvas.width + r || sy > R.canvas.height + r) continue;
      const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, hexA(l.c, 0.32 * k * (l.s || 1)));
      g.addColorStop(1, hexA(l.c, 0));
      c.fillStyle = g;
      c.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function collectLights(now, x0, y0, x1, y1) {
  const out = [];
  const night = isNight();
  for (const b of S.buildings) {
    if (b.x > x1 + 4 || b.x + b.w < x0 - 4 || b.y > y1 + 4 || b.y + b.h < y0 - 4) continue;
    if (b.burning) out.push({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h / 2) * TILE, r: 3 + b.w, c: '#ff6a2a', flicker: 3 });
    if (!b.done || b.ruined) continue;
    const def = BDEF[b.type];
    if (def.light) for (const [lx, ly, r, col] of def.light) out.push({ x: (b.x + lx) * TILE, y: (b.y + ly) * TILE, r, c: col, flicker: 1 });
    if ((b.type === 'house' || b.type === 'house2') && b._home > 0 && night && hourOf() < 23.5 && hourOf() > 12) {
      out.push({ x: (b.x + b.w / 2) * TILE, y: (b.y + b.h - 0.6) * TILE, r: 1.7, c: '#ffc070', s: 0.75 });
    }
  }
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (u.dead || u.inside || !u.torch) continue;
    if (u.x < x0 - 3 || u.x > x1 + 3 || u.y < y0 - 3 || u.y > y1 + 3) continue;
    out.push({ x: u.x * TILE + (u.ox || 0), y: u.y * TILE - 10, r: 2.4, c: '#ffa040', flicker: 4 });
  }
  return out;
}

// ── 효과 ─────────────────────────────────
function emitSmoke(x, y, col, size) {
  if (G.particles.length > 260) return;
  G.particles.push({ x, y, vx: rnd(-3, 3), vy: rnd(-14, -8), life: 0, max: rnd(2, 3.5), size: rnd(2, 4) * size, col, kind: 'smoke' });
}
function emitFire(x, y) {
  if (G.particles.length > 300) return;
  G.particles.push({ x, y, vx: rnd(-4, 4), vy: rnd(-22, -12), life: 0, max: rnd(0.4, 0.9), size: rnd(2, 4), kind: 'fire' });
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
function addFx(fx) { fx.t0 = R.now; G.fx.push(fx); if (G.fx.length > 200) G.fx.shift(); }
function floatText(x, y, text, color, big) { addFx({ kind: 'text', x, y, text, color, big, dur: 1.1 }); }
function drawFx(c, now) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    const t = (now - f.t0) / f.dur;
    if (t >= 1) { G.fx.splice(i, 1); continue; }
    if (f.kind === 'slash') {
      c.save(); c.translate(f.x, f.y); c.scale(f.dir, 1);
      c.strokeStyle = f.color || `rgba(255,255,255,${1 - t})`;
      c.globalAlpha = 1 - t;
      c.lineWidth = (f.big ? 3 : 1.6) * (1 - t * 0.5);
      const r = f.big ? 22 : 9;
      c.beginPath(); c.arc(0, -10, r, -1.2 + t * 0.6, 0.9 + t * 0.6); c.stroke();
      c.restore();
    } else if (f.kind === 'ring') {
      c.strokeStyle = f.color; c.globalAlpha = 1 - t; c.lineWidth = 2;
      c.beginPath(); c.ellipse(f.x, f.y, f.r * t + 4, (f.r * t + 4) * 0.5, 0, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    } else if (f.kind === 'spark') {
      c.fillStyle = `rgba(255,230,160,${1 - t})`;
      for (let k = 0; k < 5; k++) { const a = k * 1.3 + f.x; c.fillRect(f.x + Math.cos(a) * t * 10, f.y - 10 + Math.sin(a) * t * 8, 1.6, 1.6); }
    }
  }
}
function drawFloaters(c, now) {
  for (const f of G.fx) {
    if (f.kind !== 'text') continue;
    const t = (now - f.t0) / f.dur;
    c.globalAlpha = clamp(1.4 - t * 1.4, 0, 1);
    c.font = `${f.big ? 'bold 12px' : '9px'} "IBM Plex Sans KR", sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(f.text, f.x + 0.7, f.y - 24 - t * 14 + 0.7);
    c.fillStyle = f.color; c.fillText(f.text, f.x, f.y - 24 - t * 14);
  }
  c.globalAlpha = 1;
}
function drawProjectiles(c) {
  for (const p of G.projectiles) {
    const t = clamp(p.t / p.dur, 0, 1);
    const x = lerp(p.x0, p.x1, t), y = lerp(p.y0, p.y1, t) - Math.sin(t * Math.PI) * 18;
    const a = Math.atan2(p.y1 - p.y0 - Math.cos(t * Math.PI) * 18 * Math.PI / 1, p.x1 - p.x0);
    c.save(); c.translate(x, y); c.rotate(a);
    line(c, '#3a2a1a', 1, -6, 0, 3, 0); rr(c, '#d6dce0', 3, -0.8, 2, 1.6); rr(c, '#e8e0d0', -7, -1, 2, 2);
    c.restore();
  }
}

// 선택 표시, 건설 미리보기, 체력바, 이름
function drawOverlays(c, now) {
  const sel = UI.sel;
  if (sel && sel.b && S.bmap.get(sel.b.id)) {
    const b = sel.b;
    c.strokeStyle = PAL.gold; c.lineWidth = 1.5; c.setLineDash([4, 3]);
    c.strokeRect(b.x * TILE + 1, b.y * TILE + 1, b.w * TILE - 2, b.h * TILE - 2);
    c.setLineDash([]);
    if (b.type === 'tower') rangeCircle(c, b.x + 0.5, b.y + 0.5, BDEF.tower.range);
  }
  if (sel && sel.u && !sel.u.dead && !sel.u.inside) {
    const u = sel.u;
    c.strokeStyle = PAL.gold; c.lineWidth = 1.2;
    c.beginPath(); c.ellipse(u.x * TILE + (u.ox || 0), u.y * TILE + (u.oy || 0), 8, 3.5, 0, 0, Math.PI * 2); c.stroke();
  }
  // 체력바·이름
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (u.dead || u.inside) continue;
    const px = u.x * TILE + (u.ox || 0), py = u.y * TILE + (u.oy || 0);
    const show = u.hp < u.maxHp && !u.down && (S.raid || u.kind === 'e');
    if (show) {
      rr(c, 'rgba(0,0,0,0.6)', px - 8, py - 26, 16, 2.6);
      rr(c, u.kind === 'e' ? '#e0563f' : '#8fd06a', px - 8, py - 26, 16 * clamp(u.hp / u.maxHp, 0, 1), 2.6);
    }
    let label = null, col = null;
    if (u.hero) { label = u.hero.epithet + ' ' + u.name; col = '#ffd57a'; }
    else if (u.leader) { label = u.title; col = '#ff8a7a'; }
    if (label && Cam.zoom > 0.7) {
      c.font = '8px "Gowun Batang", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = 'rgba(0,0,0,0.65)'; c.fillText(label, px + 0.6, py - 31 + 0.6);
      c.fillStyle = col; c.fillText(label, px, py - 31);
    }
  }
  for (const b of S.buildings) {
    if (b.hp < b.maxHp && b.done && !b.ruined && (S.raid || b.hp < b.maxHp * 0.7)) {
      const px = b.x * TILE, py = b.y * TILE - (BDEF[b.type].top || 0) * TILE * 0.5 - 6;
      rr(c, 'rgba(0,0,0,0.6)', px + 2, py, b.w * TILE - 4, 3);
      rr(c, '#e0a03f', px + 2, py, (b.w * TILE - 4) * clamp(b.hp / b.maxHp, 0, 1), 3);
    }
    if (!b.done && !b.ruined) {
      const def = BDEF[b.type];
      const px = b.x * TILE, py = b.y * TILE + b.h * TILE - 6;
      rr(c, 'rgba(0,0,0,0.55)', px + 3, py, b.w * TILE - 6, 3);
      rr(c, PAL.gold, px + 3, py, (b.w * TILE - 6) * clamp(b.progress / def.time, 0, 1), 3);
    }
    if (!b.active && b.done && !b.ruined && BDEF[b.type].workers) {
      c.font = '10px "IBM Plex Sans KR", sans-serif'; c.textAlign = 'center';
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(b.x * TILE + b.w * TILE / 2 - 14, b.y * TILE + 4, 28, 13);
      c.fillStyle = '#ffcf7a'; c.fillText('중지', b.x * TILE + b.w * TILE / 2, b.y * TILE + 11);
    }
  }
  drawToolGhost(c, now);
}
function rangeCircle(c, tx, ty, r) {
  c.strokeStyle = 'rgba(255,220,140,0.6)'; c.lineWidth = 1; c.setLineDash([3, 4]);
  c.beginPath(); c.arc(tx * TILE, ty * TILE, r * TILE, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
}
function drawToolGhost(c, now) {
  const tool = UI.tool, h = UI.hover;
  if (!tool || !h) return;
  if (tool.kind === 'line' || tool.kind === 'road') {
    const tiles = UI.dragTiles && UI.dragTiles.length ? UI.dragTiles : [h];
    for (const p of tiles) {
      const ok = tool.kind === 'road' ? canPlaceRoad(p.x, p.y) : canPlace(tool.key, p.x, p.y).ok;
      c.fillStyle = ok ? 'rgba(140,220,120,0.38)' : 'rgba(230,80,60,0.38)';
      c.fillRect(p.x * TILE + 1, p.y * TILE + 1, TILE - 2, TILE - 2);
    }
    return;
  }
  if (tool.kind === 'clear' || tool.kind === 'demolish') {
    const b = World.bAt(h.x, h.y);
    c.strokeStyle = tool.kind === 'clear' ? 'rgba(140,220,120,0.9)' : 'rgba(240,90,70,0.9)';
    c.lineWidth = 2;
    if (b && tool.kind === 'demolish') c.strokeRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    else c.strokeRect(h.x * TILE, h.y * TILE, TILE, TILE);
    return;
  }
  if (tool.kind === 'build') {
    const def = BDEF[tool.key];
    const bx = h.x - Math.floor((def.w - 1) / 2), by = h.y - Math.floor((def.h - 1) / 2);
    const res = canPlace(tool.key, bx, by);
    const s = buildingSprite(tool.key, def.w, def.h, seasonIdx(), 'done', def.line ? '10' : '');
    c.globalAlpha = 0.7;
    c.drawImage(s.c, bx * TILE + s.ox, by * TILE + s.oy, s.w, s.h);
    c.globalAlpha = 1;
    c.fillStyle = res.ok ? 'rgba(140,220,120,0.30)' : 'rgba(230,80,60,0.38)';
    c.fillRect(bx * TILE, by * TILE, def.w * TILE, def.h * TILE);
    if (tool.key === 'tower') rangeCircle(c, bx + 0.5, by + 0.5, def.range);
  }
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

// ── 미니맵 ───────────────────────────────
function drawMinimap() {
  if (!R.mini || R.mini.offsetParent === null) return;
  const m = R.mctx;
  m.drawImage(R.miniBase, 0, 0);
  for (const b of S.buildings) {
    m.fillStyle = b.ruined ? '#2a2420' : b.type === 'manor' ? '#d6aa52' : b.type === 'farm' ? '#b89a50' : '#e9dcc0';
    m.fillRect(b.x * 2, b.y * 2, b.w * 2, b.h * 2);
  }
  m.fillStyle = '#ffffff';
  for (const v of S.villagers) if (!v.inside && !v.dead) m.fillRect(v.x * 2 - 0.5, v.y * 2 - 0.5, 1.5, 1.5);
  m.fillStyle = '#7ab8ff';
  for (const a of S.allies) if (!a.dead) m.fillRect(a.x * 2 - 1, a.y * 2 - 1, 2.5, 2.5);
  m.fillStyle = '#ff3a2a';
  for (const e of S.enemies) if (!e.dead) m.fillRect(e.x * 2 - 1, e.y * 2 - 1, 3, 3);
  const tl = screenToWorld(0, 0), br = screenToWorld(Cam.vw, Cam.vh);
  m.strokeStyle = 'rgba(255,240,200,0.9)'; m.lineWidth = 1;
  m.strokeRect(tl.x / TILE * 2, tl.y / TILE * 2, (br.x - tl.x) / TILE * 2, (br.y - tl.y) / TILE * 2);
}
