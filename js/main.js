'use strict';
// ───────────────────────────────────────────────
// 시작, 입력, 게임 루프
// ───────────────────────────────────────────────
const Input = { pointers: new Map(), down: false, btn: 0, ptype: 'mouse', sx: 0, sy: 0, lx: 0, ly: 0, moved: false, paint: false, paintStart: null, paintKey: null, pinch: null, keys: new Set(), prevSpeed: 1 };

// 화면 좌표 → 타일 (정수 x, y와 실수 fx, fy). 투영은 render.js 의 screenToTile 이 맡는다.
function tileAtScreen(sx, sy) {
  const t = screenToTile(sx, sy);
  return { x: Math.floor(t.x), y: Math.floor(t.y), fx: t.x, fy: t.y };
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

function onClick(btn, sx, sy) {
  const t = tileAtScreen(sx, sy);
  if (btn === 2) { if (UI.tool) UI.setTool(null); else UI.select(null); return; }
  const tool = UI.tool;
  if (!tool) {
    const hit = pickAt(sx, sy);
    UI.select(hit);
    // 길목 문장판을 누르면 그 길의 이웃 풀이를 띄운다 (터치에는 커서 풀이가 없다).
    // 터치는 mapShown 을 끄고 touchShown 으로 두어야 손을 뗀 뒤의 pointerleave 에 지워지지 않고, 다음에 누를 때 닫힌다.
    // 마우스는 커서 풀이처럼 두어 커서가 떠나면 닫힌다
    if (!hit && typeof exitCrestAt === 'function' && exitCrestAt(sx, sy)) {
      const info = Tips.exitInfo(sx, sy), touch = Input.ptype !== 'mouse';
      if (info) { Tips.render(info.title, info.body); Tips.place(sx, sy, false); Tips.mapShown = !touch; Tips.touchShown = touch; }
    }
    return;
  }
  if (tool.kind === 'build') {
    // 미리 보기와 같은 자리·방향 (들고 있는 방향, 손대지 않았으면 맞닿은 길 쪽)
    const P = UI.buildPlan(t.x, t.y);
    const r = tryBuild(tool.key, P.x, P.y, P.dir);
    if (!r.ok) UI.toast(r.why, 'bad');
    else {
      UI.dirMem[tool.key] = P.dir;
      // 손가락 화면: 놓은 자리에 미리 보기를 남기지 않는다 (다음에 누르는 곳에 짓는다)
      if (Input.ptype !== 'mouse') UI.hover = null;
    }
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
// 끌기를 시작한 그 길·담 도구가 아직 들려 있는가 (도중에 내려놓거나 바꾸면 그만둔다)
function paintToolOk() {
  const tool = UI.tool;
  return !!tool && (tool.kind === 'road' || tool.kind === 'line') && tool.key === Input.paintKey;
}
function applyPaint() {
  if (!paintToolOk()) { UI.dragTiles = null; UI.buildMenuDirty = true; return; }
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

// 화면 한 점(sx, sy)을 붙잡은 채로 배율을 바꾼다
function zoomAt(zoom, sx, sy) {
  const before = screenToWorld(sx, sy);
  Cam.zoom = clamp(zoom, REN_ZMIN, REN_ZMAX);
  clampCamera();
  const after = screenToWorld(sx, sy);
  Cam.x += before.x - after.x; Cam.y += before.y - after.y;
  clampCamera();
  UI.camTarget = null;
  Bus.emit('camMoved');
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
    Input.down = true; Input.btn = e.button; Input.ptype = e.pointerType; Input.moved = false;
    Input.sx = Input.lx = e.clientX; Input.sy = Input.ly = e.clientY;
    const t = tileAtScreen(e.clientX, e.clientY);
    if (e.button === 0 && UI.tool && (UI.tool.kind === 'road' || UI.tool.kind === 'line')) {
      Input.paint = true; Input.paintStart = t; Input.paintKey = UI.tool.key; UI.dragTiles = [{ x: t.x, y: t.y }];
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
      Cam.zoom = clamp(Input.pinch.zoom * d / Input.pinch.d, REN_ZMIN, REN_ZMAX);
      clampCamera();
      const after = screenToWorld(cx, cy);
      Cam.x += before.x - after.x; Cam.y += before.y - after.y;
      Cam.x -= (cx - Input.pinch.cx) / Cam.zoom; Cam.y -= (cy - Input.pinch.cy) / Cam.zoom;
      Input.pinch.cx = cx; Input.pinch.cy = cy;
      clampCamera();
      UI.camTarget = null;
      Bus.emit('camMoved');
      return;
    }
    if (!Input.down) return;
    const dx = e.clientX - Input.lx, dy = e.clientY - Input.ly;
    if (!Input.moved && Math.hypot(e.clientX - Input.sx, e.clientY - Input.sy) > 7) Input.moved = true;
    if (Input.paint) {
      // 도구가 바뀌었으면 이번 끌기는 버린다 (손을 뗄 때까지 지도도 움직이지 않는다)
      if (!paintToolOk()) { Input.paint = false; Input.down = false; UI.dragTiles = null; return; }
      UI.dragTiles = lPath(Input.paintStart, t);
    } else if (Input.moved) {
      Cam.x -= dx / Cam.zoom; Cam.y -= dy / Cam.zoom;
      clampCamera();
      UI.camTarget = null;
      Bus.emit('camMoved');
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
  // 건물을 든 동안의 미리 보기는 커서·손가락이 지도를 떠나도 마지막 칸에 남겨 둔다 (안내 띠의 [돌리기]를 누르러 갈 때 그 자리에서 돈다)
  cv.addEventListener('pointerleave', () => { if (!Input.down && (!UI.tool || UI.tool.kind !== 'build')) UI.hover = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(Cam.zoom * Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
  }, { passive: false });

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!S || !$('title-screen').hidden || e.defaultPrevented) return;   // 천하도가 먼저 써 버린 키는 넘긴다
    const k = e.key;
    // 천하도가 열려 있으면 지도 이동·확대 키는 마을에 보내지 않는다. Esc 는 시트를 먼저 닫고, 천하도는 worldmap.js 가 닫는다
    if (worldMapOpen()) {
      if (k === 'Escape' && UI.sheet) { UI.closeSheet(); e.preventDefault(); }   // 써 버렸음을 천하도에 알린다
      if (k === 'Escape' || k === '+' || k === '=' || k === '-' || k === '_' || /^(w|a|s|d|W|A|S|D|Arrow.+)$/.test(k)) return;
    }
    if (k === ' ') {
      e.preventDefault();
      if (S.speed > 0) { Input.prevSpeed = S.speed; UI.setSpeed(0); } else UI.setSpeed(Input.prevSpeed || 1);
    } else if (k === '+' || k === '=' || k === '-' || k === '_') {
      // 화면 가운데를 기준으로 확대·축소
      zoomAt(Cam.zoom * (k === '-' || k === '_' ? 1 / 1.2 : 1.2), Cam.vw / 2, Cam.vh / 2);
    } else if ((e.code === 'KeyR' || k === 'r' || k === 'R') && !e.ctrlKey && !e.metaKey && !e.altKey && UI.tool && UI.tool.kind === 'build') {
      // 든 건물 돌리기 (Shift+R 은 거꾸로). 한글 자판(ㄱ)에서도 같은 자리의 키로
      if (UI.rotateTool(e.shiftKey ? -1 : 1)) e.preventDefault();
    } else if (k === '1') UI.setSpeed(1);
    else if (k === '2') UI.setSpeed(2);
    else if (k === '3') UI.setSpeed(4);
    else if (k === 'Escape') {
      if (UI.tool) { if (Input.paint) { Input.paint = false; Input.down = false; } UI.setTool(null); }
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
const worldMapOpen = () => typeof WorldMap !== 'undefined' && WorldMap.isOpen();
// [새로 시작]: 씨앗을 정하고 천하도에서 부임할 고을을 고른다 (미리 본 천하가 실제 게임과 같다)
function startNew() {
  const seed = Math.floor(Math.random() * 1e9);
  if (typeof WorldMap === 'undefined') { enterGame(true, 'henan_field', seed); return; }
  WorldMap.open('pick', { seed, world: JH.makeWorld(seed), onPick: k => enterGame(true, k, seed), onCancel: () => {} });
}
function enterGame(isNew, siteKey, seed) {
  if (isNew) {
    const name = ($('input-name').value || '').trim().slice(0, 8) || pick(VILLAGE_NAMES);
    newGame(name, siteKey, seed);
  } else if (!loadGame()) {
    UI.toast('저장된 마을을 불러오지 못했다. 새 마을을 세운다.', 'bad');
    newGame(pick(VILLAGE_NAMES));
    isNew = true;
  }
  $('title-screen').hidden = true;
  G.fx = []; G.particles = []; G.projectiles = [];
  // 등각 마름모(64×32)에 맞춘 처음 배율. 영주관이 화면 가운데 조금 위에 오게 한다
  Cam.zoom = window.innerWidth < 700 ? 0.7 : 0.85;
  const m = getB(S.manorId);
  centerOnTile(m ? m.x + 2.6 : World.center.x, m ? m.y + 2.6 : World.center.y);
  UI.camTarget = null;
  UI.select(null); UI.setTool(null);
  UI.closeSheet();
  $('log').hidden = true;
  UI.buildMenuDirty = true;
  UI.lastTop = '';
  // 첫 인사와 튜토리얼은 이야기 모듈이 맡는다
  hook(Story, 'onEnterGame', isNew);
}

let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (t - (lastFrame || t)) / 1000);
  lastFrame = t;
  if (!S || !$('title-screen').hidden) return;
  PF.budget = 40;
  // 키보드 이동 (화면 방향 그대로: W = 화면 위)
  if (Input.keys.size && worldMapOpen()) Input.keys.clear();
  if (Input.keys.size) {
    const sp = 700 * dt / Cam.zoom;
    if (Input.keys.has('w') || Input.keys.has('arrowup')) Cam.y -= sp;
    if (Input.keys.has('s') || Input.keys.has('arrowdown')) Cam.y += sp;
    if (Input.keys.has('a') || Input.keys.has('arrowleft')) Cam.x -= sp;
    if (Input.keys.has('d') || Input.keys.has('arrowright')) Cam.x += sp;
    UI.camTarget = null;
    clampCamera();
    Bus.emit('camMoved');
  }
  if (UI.camTarget) {
    const w = worldOf(UI.camTarget.tx, UI.camTarget.ty);
    Cam.x = lerp(Cam.x, w.x, Math.min(1, dt * 5));
    Cam.y = lerp(Cam.y, w.y, Math.min(1, dt * 5));
    if (Math.hypot(Cam.x - w.x, Cam.y - w.y) < 2) UI.camTarget = null;
    clampCamera();
  }
  // 사건 두루마리가 열렸거나, 천하도를 보고 있거나, 이야기 모듈이 멈춰 달라고 하면 시간이 멈춘다
  const paused = UI.modalOpen || worldMapOpen() || hook(Story, 'isPausing') === true;
  if (!paused && S.speed > 0) {
    const dtH = dt * S.speed / SEC_PER_HOUR;
    const steps = Math.max(1, Math.ceil(dtH / 0.02));
    for (let i = 0; i < steps; i++) simStep(dtH / steps);
  }
  // 천하도 보기가 화면을 덮고 있으면 마을은 그리지 않는다 (천하도가 제 루프로 그린다)
  if (!(worldMapOpen() && WorldMap.mode() === 'view')) render(t);
  UI.tick(t);
}

function boot(hotData) {
  initRender();
  UI.init();
  Tips.init();
  initInput();
  window.addEventListener('resize', () => { resizeCanvas(); if (S) clampCamera(); });
  $('input-name').value = pick(VILLAGE_NAMES);
  $('btn-new').onclick = startNew;
  $('btn-continue').onclick = () => enterGame(false);
  $('input-name').addEventListener('keydown', e => { if (e.key === 'Enter') startNew(); });
  // 데스크톱 메뉴의 [천하도] (폰에서는 세력 창 맨 위 단추로 연다)
  if ($('btn-worldmap')) $('btn-worldmap').onclick = () => { if (S && typeof WorldMap !== 'undefined') WorldMap.open('view', {}); };
  $('btn-continue').hidden = !Store.get(SAVE_KEY);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { SpriteCache.clear(); UI.buildMenuDirty = true; });
  // 열린 화면이 새 판으로 갈아끼워질 때 진행 상황을 이어받는다
  if (hotData && hotData.save) {
    try { deserialize(hotData.save); $('title-screen').hidden = true; centerOnTile(World.center.x, World.center.y); hook(Story, 'onEnterGame', false); } catch (e) { S = null; }
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
