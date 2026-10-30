'use strict';
// ───────────────────────────────────────────────
// 시작, 입력, 게임 루프
// ───────────────────────────────────────────────
const Input = { pointers: new Map(), down: false, btn: 0, sx: 0, sy: 0, lx: 0, ly: 0, moved: false, paint: false, paintStart: null, pinch: null, keys: new Set(), prevSpeed: 1 };

function tileAtScreen(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE), wx: w.x, wy: w.y };
}
function lPath(a, b) {
  const out = [];
  const sx = Math.sign(b.x - a.x), sy = Math.sign(b.y - a.y);
  let x = a.x, y = a.y;
  out.push({ x, y });
  while (x !== b.x && out.length < 80) { x += sx; out.push({ x, y }); }
  while (y !== b.y && out.length < 80) { y += sy; out.push({ x, y }); }
  return out;
}
function pickUnit(wx, wy) {
  let best = null, bd = 11;
  for (const arr of [S.enemies, S.allies, S.villagers]) for (const u of arr) {
    if (u.dead || u.inside) continue;
    const d = Math.hypot(u.x * TILE - wx, u.y * TILE - 9 - wy);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function onClick(btn, sx, sy) {
  const t = tileAtScreen(sx, sy);
  if (btn === 2) { if (UI.tool) UI.setTool(null); else UI.select(null); return; }
  const tool = UI.tool;
  if (!tool) {
    const u = pickUnit(t.wx, t.wy);
    if (u) { UI.select({ u }); return; }
    const b = World.bAt(t.x, t.y);
    UI.select(b ? { b } : null);
    return;
  }
  if (tool.kind === 'build') {
    const def = BDEF[tool.key];
    const bx = t.x - Math.floor((def.w - 1) / 2), by = t.y - Math.floor((def.h - 1) / 2);
    const r = tryBuild(tool.key, bx, by);
    if (!r.ok) UI.toast(r.why, 'bad');
    UI.buildMenuDirty = true;
  } else if (tool.kind === 'clear') {
    if (World.tile(t.x, t.y) !== T.FOREST || World.occ[t.y * MW + t.x]) UI.toast('숲이 아닌 곳이다', 'bad');
    else if (!clearTile(t.x, t.y)) UI.toast('은자가 모자라다', 'bad');
  } else if (tool.kind === 'demolish') {
    const b = World.bAt(t.x, t.y);
    if (b) {
      if (b.type === 'manor') UI.toast('영주관은 허물 수 없다', 'bad');
      else { demolish(b); UI.toast(`${BDEF[b.type].name}${pp(BDEF[b.type].name, '을/를')} 허물었다`); }
    } else if (World.isRoad(t.x, t.y)) removeRoad(t.x, t.y);
  }
}
function applyPaint() {
  const tool = UI.tool, tiles = UI.dragTiles || [];
  let placed = 0, why = null;
  for (const p of tiles) {
    if (tool.kind === 'road') { if (setRoad(p.x, p.y)) placed++; else if (!why && World.inb(p.x, p.y) && !World.isRoad(p.x, p.y) && !World.occ[p.y * MW + p.x] && World.tile(p.x, p.y) !== T.ROCK) why = '재료가 모자라다'; }
    else { const r = tryBuild(tool.key, p.x, p.y); if (r.ok) placed++; else if (r.poor) why = r.why; }
  }
  if (!placed && why) UI.toast(why, 'bad');
  UI.dragTiles = null;
  UI.buildMenuDirty = true;
}

function initInput() {
  const cv = R.canvas;
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    Input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    $('tooltip').hidden = true;
    if (Input.pointers.size === 2) {
      const [a, b] = [...Input.pointers.values()];
      Input.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: Cam.zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      Input.paint = false; UI.dragTiles = null; Input.moved = true;
      return;
    }
    Input.down = true; Input.btn = e.button; Input.moved = false;
    Input.sx = Input.lx = e.clientX; Input.sy = Input.ly = e.clientY;
    const t = tileAtScreen(e.clientX, e.clientY);
    if (e.button === 0 && UI.tool && (UI.tool.kind === 'road' || UI.tool.kind === 'line')) {
      Input.paint = true; Input.paintStart = t; UI.dragTiles = [{ x: t.x, y: t.y }];
    }
  });
  cv.addEventListener('pointermove', e => {
    if (Input.pointers.has(e.pointerId)) Input.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const t = tileAtScreen(e.clientX, e.clientY);
    UI.hover = { x: t.x, y: t.y };
    if (Input.pinch && Input.pointers.size >= 2) {
      const [a, b] = [...Input.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const before = screenToWorld(cx, cy);
      Cam.zoom = clamp(Input.pinch.zoom * d / Input.pinch.d, 0.45, 2.6);
      clampCamera();
      const after = screenToWorld(cx, cy);
      Cam.x += before.x - after.x; Cam.y += before.y - after.y;
      Cam.x -= (cx - Input.pinch.cx) / Cam.zoom; Cam.y -= (cy - Input.pinch.cy) / Cam.zoom;
      Input.pinch.cx = cx; Input.pinch.cy = cy;
      clampCamera();
      UI.camTarget = null;
      return;
    }
    if (!Input.down) return;
    const dx = e.clientX - Input.lx, dy = e.clientY - Input.ly;
    if (!Input.moved && Math.hypot(e.clientX - Input.sx, e.clientY - Input.sy) > 7) Input.moved = true;
    if (Input.paint) {
      UI.dragTiles = lPath(Input.paintStart, t);
    } else if (Input.moved) {
      Cam.x -= dx / Cam.zoom; Cam.y -= dy / Cam.zoom;
      clampCamera();
      UI.camTarget = null;
    }
    Input.lx = e.clientX; Input.ly = e.clientY;
  });
  const up = e => {
    Input.pointers.delete(e.pointerId);
    if (Input.pinch) { if (Input.pointers.size < 2) { Input.pinch = null; Input.down = false; } return; }
    if (!Input.down) return;
    Input.down = false;
    if (e.type === 'pointercancel') { Input.paint = false; UI.dragTiles = null; return; }
    if (Input.paint) { Input.paint = false; applyPaint(); return; }
    if (!Input.moved) onClick(Input.btn, e.clientX, e.clientY);
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!Input.down) UI.hover = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const before = screenToWorld(e.clientX, e.clientY);
    Cam.zoom = clamp(Cam.zoom * Math.exp(-e.deltaY * 0.0015), 0.45, 2.6);
    clampCamera();
    const after = screenToWorld(e.clientX, e.clientY);
    Cam.x += before.x - after.x; Cam.y += before.y - after.y;
    clampCamera();
    UI.camTarget = null;
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!S || !$('title-screen').hidden) return;
    const k = e.key;
    if (k === ' ') {
      e.preventDefault();
      if (S.speed > 0) { Input.prevSpeed = S.speed; UI.setSpeed(0); } else UI.setSpeed(Input.prevSpeed || 1);
    } else if (k === '1') UI.setSpeed(1);
    else if (k === '2') UI.setSpeed(2);
    else if (k === '3') UI.setSpeed(4);
    else if (k === 'Escape') {
      if (UI.tool) UI.setTool(null);
      else if (UI.sheet) UI.closeSheet();
      else if (!$('log').hidden) $('log').hidden = true;
      else UI.select(null);
    } else if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'W', 'A', 'S', 'D'].includes(k)) {
      if (k.startsWith('Arrow')) e.preventDefault();
      Input.keys.add(k.toLowerCase());
    }
  });
  window.addEventListener('keyup', e => Input.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => Input.keys.clear());
}

// ── 게임 시작 ─────────────────────────────
function enterGame(isNew) {
  if (isNew) {
    const name = ($('input-name').value || '').trim().slice(0, 8) || pick(VILLAGE_NAMES);
    newGame(name);
  } else if (!loadGame()) {
    UI.toast('저장된 마을을 불러오지 못했다. 새 마을을 세운다.', 'bad');
    newGame(pick(VILLAGE_NAMES));
    isNew = true;
  }
  $('title-screen').hidden = true;
  G.fx = []; G.particles = []; G.projectiles = [];
  Cam.zoom = window.innerWidth < 700 ? 1.05 : 1.4;
  const m = getB(S.manorId);
  Cam.x = ((m ? m.x + 1.5 : World.center.x)) * TILE;
  Cam.y = ((m ? m.y + 3 : World.center.y)) * TILE;
  clampCamera();
  UI.camTarget = null;
  UI.select(null); UI.setTool(null);
  UI.closeSheet();
  $('log').hidden = true;
  UI.buildMenuDirty = true;
  UI.lastTop = '';
  if (isNew) {
    Events.notice('영주로 임명되다',
      `현청에서 임명장이 내려왔다. 오늘부터 그대가 <em>${escapeHtml(S.name)}</em>의 영주다.\n\n여덟 식구, 초가 두 채, 논밭 한 뙈기. 뒷산에는 흑풍채 산적이 들끓고, 강 건너에서는 정파와 사파가 피를 흘린다.\n\n집과 논밭을 늘려 사람을 모으고, 벌목장과 채석장으로 재료를 쌓자. 산적이 오기 전에 무관과 망루를 세워 두는 것이 좋다.`, '任');
  }
}

let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
  lastFrame = t;
  if (!S || !$('title-screen').hidden) return;
  PF.budget = 40;
  // 키보드 이동
  if (Input.keys.size) {
    const sp = 700 * dt / Cam.zoom;
    if (Input.keys.has('w') || Input.keys.has('arrowup')) Cam.y -= sp;
    if (Input.keys.has('s') || Input.keys.has('arrowdown')) Cam.y += sp;
    if (Input.keys.has('a') || Input.keys.has('arrowleft')) Cam.x -= sp;
    if (Input.keys.has('d') || Input.keys.has('arrowright')) Cam.x += sp;
    UI.camTarget = null;
    clampCamera();
  }
  if (UI.camTarget) {
    Cam.x = lerp(Cam.x, UI.camTarget.x, Math.min(1, dt * 5));
    Cam.y = lerp(Cam.y, UI.camTarget.y, Math.min(1, dt * 5));
    if (Math.hypot(Cam.x - UI.camTarget.x, Cam.y - UI.camTarget.y) < 2) UI.camTarget = null;
    clampCamera();
  }
  if (!UI.modalOpen && S.speed > 0) {
    const dtH = dt * S.speed / SEC_PER_HOUR;
    const steps = Math.max(1, Math.ceil(dtH / 0.02));
    for (let i = 0; i < steps; i++) simStep(dtH / steps);
  }
  render(t);
  UI.tick(t);
}

function boot(hotData) {
  initRender();
  UI.init();
  initInput();
  window.addEventListener('resize', () => { resizeCanvas(); if (S) clampCamera(); });
  $('input-name').value = pick(VILLAGE_NAMES);
  $('btn-new').onclick = () => enterGame(true);
  $('btn-continue').onclick = () => enterGame(false);
  $('input-name').addEventListener('keydown', e => { if (e.key === 'Enter') enterGame(true); });
  $('btn-continue').hidden = !Store.get(SAVE_KEY);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { SpriteCache.clear(); UI.buildMenuDirty = true; });
  // 열린 화면이 새 판으로 갈아끼워질 때 진행 상황을 이어받는다
  if (hotData && hotData.save) {
    try { deserialize(hotData.save); $('title-screen').hidden = true; Cam.x = (World.center.x) * TILE; Cam.y = World.center.y * TILE; clampCamera(); } catch (e) { S = null; }
  }
  if ($('title-screen').hidden === false) startTitleArt();
  requestAnimationFrame(loop);
}

(function start() {
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(() => (S && !S.ended ? { save: serialize() } : {})); } catch (e) { /* 무시 */ } }
  const go = data => boot(data || {});
  if (hot && hot.ready) hot.ready(go); else go(hot && hot.data);
})();
