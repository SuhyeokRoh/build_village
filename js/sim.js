'use strict';
// ───────────────────────────────────────────────
// 시뮬레이션: 시간, 경제, 건설, 배치, 습격, 점령, 저장
// ───────────────────────────────────────────────
let S = null;

function hourOf() { return ((S.time % 24) + 24) % 24; }
function dayOf() { return Math.floor(S.time / 24); }
function seasonIdx() { return Math.floor(dayOf() / DAYS_PER_SEASON) % 4; }
function yearOf() { return Math.floor(dayOf() / (DAYS_PER_SEASON * 4)) + 1; }
function dateText() { return `${yearOf()}년 ${SEASONS[seasonIdx()]} ${dayOf() % DAYS_PER_SEASON + 1}일`; }
function timeText() { const [k, h] = shichenOf(hourOf()); return `${k}(${h})`; }

function livingVillagers() { return S.villagers.filter(v => !v.dead && !v.leaving); }
function popCount() { let n = 0; for (const v of S.villagers) if (!v.dead && !v.leaving) n++; return n; }
function housingTotal() { let n = 0; for (const b of S.buildings) if (usable(b)) n += BDEF[b.type].housing || 0; return n; }
function storageCap() { let n = 300; for (const b of S.buildings) if (usable(b)) n += BDEF[b.type].storage || 0; return n; }
function countType(t, onlyUsable = true) { return S.buildings.filter(b => b.type === t && (!onlyUsable || usable(b))).length; }
function hasMod(id) { return S.mods.some(m => m.id === id); }
function addMod(id, days, data = {}) {
  S.mods = S.mods.filter(m => m.id !== id);
  S.mods.push(Object.assign({ id, until: dayOf() + days }, data));
}
function rel(k) { return S.factions[k].rel; }
function changeRel(k, d) { S.factions[k].rel = clamp(S.factions[k].rel + d, -100, 100); }
function addFame(n) { S.fame = Math.max(0, S.fame + n); }
function addRes(k, n) {
  if (k === 'fame') { addFame(n); return; }
  S.res[k] = Math.max(0, S.res[k] + n);
  if (k !== 'silver') S.res[k] = Math.min(S.res[k], storageCap());
  if (n > 0 && S.dayAcc) S.dayAcc[k] = (S.dayAcc[k] || 0) + n;
}
function canAfford(cost) { for (const k in cost) if ((S.res[k] || 0) < cost[k]) return false; return true; }
function pay(cost) { for (const k in cost) S.res[k] -= cost[k]; }
function costText(cost) {
  const parts = [];
  for (const k of ['silver', 'wood', 'stone', 'food', 'weapons']) if (cost[k]) parts.push(`${RESOURCES[k].name} ${cost[k]}`);
  return parts.join(' · ') || '무료';
}
function costShort(cost) {
  const parts = [];
  for (const k of ['silver', 'wood', 'stone']) if (cost[k]) parts.push(RESOURCES[k].hanja + cost[k]);
  return parts.join(' ') || '무료';
}
function logMsg(text, kind = '') {
  S.log.push({ t: S.time, text, kind });
  if (S.log.length > 160) S.log.shift();
  if (typeof UI !== 'undefined' && UI.onLog) UI.onLog();
}
function markDirty() { if (S) S._dirty = true; }

// ── 새 게임 ──────────────────────────────
function newGame(name) {
  const seed = Math.floor(Math.random() * 1e9);
  S = {
    v: 1, name, seed, time: 7, speed: 1,
    res: { silver: 260, food: 140, wood: 180, stone: 50, weapons: 6 },
    fame: 0, happy: 62, tax: 1, rank: 0,
    buildings: [], bmap: new Map(), villagers: [], enemies: [], allies: [],
    nextId: 1, manorId: 0,
    factions: {}, vassal: null, occupation: null, raid: null,
    scheduled: [], mods: [], flags: {}, cooldowns: {},
    stats: { raidsWon: 0, raidsLost: 0, died: 0, born: 0, maxPop: 0, events: 0 },
    log: [], nextEventAt: 30, martialCap: 3, rain: false, starving: 0,
    eventQueue: [], dayAcc: {}, lastFlow: {}, victory: false, ended: false,
  };
  for (const k of FACTION_ORDER) S.factions[k] = { rel: FACTIONS[k].startRel, threat: k === 'heukpung' ? 35 : 0 };
  genWorld(seed);
  const cx = World.center.x, cy = World.center.y;
  const manor = placeBuilding('manor', cx - 1, cy - 1, true);
  S.manorId = manor.id;
  setRoad(cx, cy + 2, true);
  placeBuilding('house', cx - 5, cy - 1, true);
  placeBuilding('house', cx + 3, cy - 1, true);
  placeBuilding('farm', cx - 5, cy + 5, true);
  placeBuilding('well', cx + 3, cy + 5, true);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const p = randomTileNear(cx, cy + 3, 4) || { x: cx, y: cy + 3 };
    newVillager({ x: p.x + 0.5, y: p.y + 0.5, age: rndi(18, 50) });
  }
  // 모듈 상태 준비 → 이야기 모듈이 시작 마을을 꾸민다(쓰러져 가는 마을 등)
  hook(Admin, 'init');
  hook(Petitions, 'init');
  hook(Story, 'init');
  hook(Story, 'setupNewGame');
  refreshAssign();
  S.stats.maxPop = popCount();
  logMsg(`${S.name}${pp(S.name, '이/가')} 강호의 지도 위에 처음 이름을 올렸다. 영주의 시대가 시작된다.`, 'good');
  World.terrainDirty = true;
}

// ── 건물 배치 ────────────────────────────
function placeBuilding(type, x, y, done = false) {
  const def = BDEF[type];
  const b = {
    id: S.nextId++, type, x, y, w: def.w, h: def.h,
    hp: def.hp, maxHp: def.hp, done, progress: done ? def.time : 0,
    active: true, ruined: false, want: def.workers || 0,
  };
  if (!done) b.hp = def.hp * 0.3;
  let terrain = false;
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    const i = yy * MW + xx;
    if (World.tiles[i] === T.FOREST || World.tiles[i] === T.ROCK) { World.tiles[i] = T.GRASS; terrain = true; }
    if (done && type !== 'gate') World.road[i] = 0;
  }
  if (terrain) World.terrainDirty = true;
  S.buildings.push(b);
  S.bmap.set(b.id, b);
  World.stamp(b, b.id);
  // 발판 위에 서 있던 사람 비키기
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) {
    if (u.inside) continue;
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    if (tx >= x && tx < x + def.w && ty >= y && ty < y + def.h && !walkable(tx, ty, u.kind === 'e' ? 1 : 0)) {
      const p = nearestWalkable(tx, ty, 0, 6);
      if (p) { u.x = p.x + 0.5; u.y = p.y + 0.5; }
      u.path = null;
    }
  }
  updateSiteFactors(b);
  markDirty();
  return b;
}
function updateSiteFactors(b) {
  if (b.type === 'lumber') b._forest = clamp(countTilesNear(b, T.FOREST, 4.5) / 10, 0.15, 1.25);
  if (b.type === 'quarry') b._rock = clamp(countTilesNear(b, T.ROCK, 4.5) / 8, 0.15, 1.25);
  if (b.type === 'escort') b._connected = roadConnected(b);
}
function roadConnected(b) {
  const seen = new Uint8Array(MW * MH);
  const q = [];
  for (let x = b.x - 1; x <= b.x + b.w; x++) for (let y = b.y - 1; y <= b.y + b.h; y++) {
    if (World.isRoad(x, y)) { q.push(y * MW + x); seen[y * MW + x] = 1; }
  }
  while (q.length) {
    const i = q.pop();
    const x = i % MW, y = (i / MW) | 0;
    if (x === 0 || y === 0 || x === MW - 1 || y === MH - 1) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, ni = ny * MW + nx;
      if (World.inb(nx, ny) && !seen[ni] && World.road[ni]) { seen[ni] = 1; q.push(ni); }
    }
  }
  return false;
}
function canPlace(type, x, y) {
  const def = BDEF[type];
  if (def.rank && S.rank < def.rank) return { ok: false, why: `마을이 ${RANKS[def.rank].name} 이상이어야 한다` };
  for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
    if (xx < 1 || yy < 1 || xx >= MW - 1 || yy >= MH - 1) return { ok: false, why: '지도 가장자리에는 지을 수 없다' };
    const i = yy * MW + xx;
    const t = World.tiles[i];
    if (World.occ[i]) return { ok: false, why: '이미 다른 건물이 있다' };
    if (World.road[i] && type !== 'gate') return { ok: false, why: '길 위에는 지을 수 없다 (성문만 가능)' };
    if (t === T.WATER && !World.road[i]) return { ok: false, why: '물 위에는 지을 수 없다' };
    if (t === T.ROCK) return { ok: false, why: '바위산에는 지을 수 없다' };
  }
  const probe = { x, y, w: def.w, h: def.h };
  if (def.needs === 'water') {
    let n = 0;
    for (let xx = x - 1; xx <= x + def.w; xx++) for (let yy = y - 1; yy <= y + def.h; yy++) if (World.tile(xx, yy) === T.WATER && !World.isRoad(xx, yy)) n++;
    if (n < 2) return { ok: false, why: '강물과 맞닿아야 한다' };
  }
  if (def.needs === 'forest' && countTilesNear(probe, T.FOREST, 4.5) < 3) return { ok: false, why: '가까이에 숲이 있어야 한다' };
  if (def.needs === 'rock' && countTilesNear(probe, T.ROCK, 4.5) < 3) return { ok: false, why: '가까이에 바위산이 있어야 한다' };
  if (!canAfford(def.cost)) return { ok: false, why: '재료가 모자라다', poor: true };
  return { ok: true };
}
function tryBuild(type, x, y) {
  const r = canPlace(type, x, y);
  if (!r.ok) return r;
  pay(BDEF[type].cost);
  let forest = 0;
  for (let yy = y; yy < y + BDEF[type].h; yy++) for (let xx = x; xx < x + BDEF[type].w; xx++) if (World.tile(xx, yy) === T.FOREST) forest++;
  const b = placeBuilding(type, x, y, false);
  if (forest) addRes('wood', forest * 3);
  Bus.emit('placed', b);
  return { ok: true, b };
}
function roadCost(x, y) { return World.tile(x, y) === T.WATER ? { wood: 6 } : { silver: 1 }; }
function canPlaceRoad(x, y) {
  if (!World.inb(x, y) || World.isRoad(x, y)) return false;
  if (World.occ[y * MW + x]) return false;
  if (World.tile(x, y) === T.ROCK) return false;
  return canAfford(roadCost(x, y));
}
function setRoad(x, y, free = false) {
  if (!free) { if (!canPlaceRoad(x, y)) return false; pay(roadCost(x, y)); Bus.emit('road', x, y); }
  const i = y * MW + x;
  if (World.tiles[i] === T.FOREST) { World.tiles[i] = T.DIRT; addRes('wood', 2); }
  World.road[i] = 1;
  World.terrainDirty = true;
  for (const b of S.buildings) if (b.type === 'escort') b._connected = roadConnected(b);
  return true;
}
function clearTile(x, y) {
  if (!World.inb(x, y) || World.tile(x, y) !== T.FOREST || World.occ[y * MW + x]) return false;
  if (!canAfford(TOOLS.clear.cost)) return false;
  pay(TOOLS.clear.cost);
  World.tiles[y * MW + x] = T.GRASS;
  addRes('wood', 4);
  World.terrainDirty = true;
  for (const b of S.buildings) if (b.type === 'lumber') updateSiteFactors(b);
  return true;
}
function demolish(b) {
  if (b.type === 'manor') return false;
  const def = BDEF[b.type];
  if (!b.ruined) for (const k in def.cost) addRes(k, Math.floor(def.cost[k] * (b.done ? 0.5 : 0.8)));
  removeBuilding(b);
  Bus.emit('demolished', b);
  return true;
}
function removeBuilding(b) {
  for (const v of S.villagers) {
    if (v.insideB === b.id) leaveInside(v);
    if (v.home === b.id) v.home = 0;
    if (v.job === b.id) { v.job = 0; v.jobType = null; }
    if (v.site === b.id) v.site = 0;
  }
  World.stamp(b, 0);
  S.buildings = S.buildings.filter(o => o !== b);
  S.bmap.delete(b.id);
  if (UI.sel && UI.sel.b === b) UI.select(null);
  markDirty();
}
function removeRoad(x, y) {
  if (!World.isRoad(x, y)) return false;
  World.road[y * MW + x] = 0;
  World.terrainDirty = true;
  for (const b of S.buildings) if (b.type === 'escort') b._connected = roadConnected(b);
  // 다리를 걷어내면 물 위에 있던 사람을 옮긴다
  for (const u of S.villagers) if (Math.floor(u.x) === x && Math.floor(u.y) === y && !walkable(x, y)) {
    const p = nearestWalkable(x, y); if (p) { u.x = p.x + 0.5; u.y = p.y + 0.5; } u.path = null;
  }
  return true;
}
function repairCost(b) {
  if (b.type === 'manor') return { wood: 80, stone: 60, silver: 100 };
  const c = {};
  for (const k in BDEF[b.type].cost) c[k] = Math.ceil(BDEF[b.type].cost[k] * 0.5);
  return c;
}
function repair(b) {
  if (!b.ruined) return false;
  const c = repairCost(b);
  if (!canAfford(c)) return false;
  pay(c);
  b.ruined = false; b.done = false; b.progress = BDEF[b.type].time * 0.5; b.hp = b.maxHp * 0.3; b.burning = false;
  markDirty();
  Bus.emit('repairStarted', b);
  return true;
}
function buildingDestroyed(b, by) {
  b.burning = false;
  Bus.emit('destroyed', b);
  const def = BDEF[b.type];
  if (b.type === 'manor' && S.raid && S.raid.goal === 'occupy') { beginOccupation(S.raid.faction); return; }
  if (S.raid) S.raid.destroyed = (S.raid.destroyed || 0) + 1;
  if (def.line || b.type === 'tower' || b.type === 'gate') {
    logMsg(`${def.name}${pp(def.name, '이/가')} 부서졌다.`, 'bad');
    removeBuilding(b);
    return;
  }
  b.ruined = true; b.hp = 0;
  for (const v of S.villagers) if (v.insideB === b.id) { leaveInside(v); damage(v, 6, null); }
  logMsg(`${def.name}${pp(def.name, '이/가')} 무너져 폐허가 되었다.`, 'bad');
  if (b.type === 'manor' && S.raid) { // 약탈 목적이어도 영주관이 무너지면 크게 털린다
    const k = Math.floor(S.res.silver * 0.3);
    S.res.silver -= k; S.raid.loot.silver = (S.raid.loot.silver || 0) + k;
    S.raid.phase = 'retreat';
  }
  markDirty();
}

// ── 배치(집·일자리) ───────────────────────
const JOB_PRIORITY = { farm: 6, fishery: 5.5, clinic: 5, tower: 5, lumber: 4.5, quarry: 4, dojo: 3.8, smithy: 3.2, market: 3, inn: 3, escort: 2.8 };
function refreshAssign() {
  for (const b of S.buildings) { b._workers = []; b._residents = []; }
  for (const v of S.villagers) {
    if (v.dead || v.leaving) { v.home = 0; v.job = 0; continue; }
    const h = getB(v.home);
    if (!h || h.ruined || !h.done || !BDEF[h.type].housing) v.home = 0; else h._residents.push(v);
    const j = getB(v.job);
    if (!usable(j) || !j.active || v.hero) { v.job = 0; } else j._workers.push(v);
  }
  for (const b of S.buildings) {
    const def = BDEF[b.type];
    while (b._residents.length > (def.housing || 0)) b._residents.pop().home = 0;
    const cap = Math.min(def.workers || 0, b.want === undefined ? 99 : b.want);
    while (b._workers.length > cap) { const v = b._workers.pop(); v.job = 0; }
  }
  // 집
  const homes = S.buildings.filter(b => usable(b) && BDEF[b.type].housing);
  for (const v of S.villagers) {
    if (v.dead || v.leaving || v.home) continue;
    let best = null, bd = Infinity;
    for (const b of homes) {
      if (b._residents.length >= BDEF[b.type].housing) continue;
      const d = dist(v.x, v.y, b.x, b.y) + (b.type === 'manor' ? 8 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { v.home = best.id; best._residents.push(v); }
  }
  // 일자리
  const foodLow = S.res.food < popCount() * 4;
  const slots = S.buildings.filter(b => usable(b) && b.active && BDEF[b.type].workers && b._workers.length < Math.min(BDEF[b.type].workers, b.want))
    .sort((a, b) => (JOB_PRIORITY[b.type] + (foodLow && (b.type === 'farm' || b.type === 'fishery') ? 5 : 0)) - (JOB_PRIORITY[a.type] + (foodLow && (a.type === 'farm' || a.type === 'fishery') ? 5 : 0)));
  const jobless = S.villagers.filter(v => !v.dead && !v.leaving && !v.arriving && !v.job && !v.hero && v.age >= 14 && !v.down);
  for (const b of slots) {
    while (b._workers.length < Math.min(BDEF[b.type].workers, b.want) && jobless.length) {
      let bi = 0, bd = Infinity;
      jobless.forEach((v, i) => {
        // 무관에는 무공을 익힌 사람이 먼저 간다
        const d = dist(v.x, v.y, b.x, b.y) - (BDEF[b.type].fighter ? v.martial * 20 : 0);
        if (d < bd) { bd = d; bi = i; }
      });
      const v = jobless.splice(bi, 1)[0];
      v.job = b.id; b._workers.push(v);
      if (v.act === 'work' || v.act === 'build' || v.act === 'idle') v.act = null;
    }
  }
  // 역할
  for (const v of S.villagers) {
    const j = getB(v.job);
    const jt = j ? j.type : null;
    const role = jt && BDEF[jt].fighter ? 'guard' : 'civ';
    if (v.jobType !== jt || v.role !== role) {
      v.jobType = jt; v.role = role;
      applyRoleLook(v); updateStats(v);
    }
  }
  G.sites = S.buildings.filter(b => !b.done && !b.ruined);
}
function refreshLive() {
  for (const b of S.buildings) { b._home = 0; b._manned = null; b._working = false; b._builders = 0; }
  for (const v of S.villagers) {
    if (v.dead) continue;
    if (v.inside) {
      const b = getB(v.insideB);
      if (b) {
        if (b.id === v.home) b._home++;
        if (b.type === 'tower' && v.job === b.id) b._manned = v;
      }
    }
    if (isWorking(v)) { const b = getB(v.job); if (b) b._working = true; }
    if (v.act === 'build' && v.site) { const s = getB(v.site); if (s) s._builders++; }
  }
}

// ── 경제 ─────────────────────────────────
const SEASON_FARM = [1.0, 1.25, 1.5, 0.35];
function tradeMul() { return S.vassal === 'geumryong' ? 1.3 : 1; }
function economyStep(dtH) {
  const season = seasonIdx();
  const pop = popCount();
  const drought = hasMod('drought') ? (hasMod('well_dug') ? 0.7 : 0.4) : 1;
  const harvest = hasMod('harvest') ? 1.4 : 1;
  const quarantine = hasMod('quarantine') ? 0.6 : 1;
  const occ = S.occupation ? 0.85 : 1;
  let trade = 0;   // 장사로 번 은자 (육방 장부가 상금·하사금과 가려 본다)
  for (const v of S.villagers) {
    if (!isWorking(v)) continue;
    const b = getB(v.job);
    if (!b || !b.active) continue;
    const m = quarantine * occ * dtH;
    switch (b.type) {
      case 'farm': addRes('food', 0.66 * SEASON_FARM[season] * drought * harvest * m); break;
      case 'fishery': addRes('food', 0.56 * (season === 3 ? 0.6 : 1) * m); break;
      case 'lumber': addRes('wood', 0.9 * (b._forest || 0.5) * m); break;
      case 'quarry': addRes('stone', 0.62 * (b._rock || 0.5) * m); break;
      case 'smithy':
        if (S.res.stone >= 0.3 * dtH && S.res.wood >= 0.15 * dtH && S.res.weapons < storageCap()) {
          S.res.stone -= 0.3 * dtH; S.res.wood -= 0.15 * dtH; addRes('weapons', 0.22 * m);
        }
        break;
      case 'market': trade += (0.36 + pop * 0.007) * tradeMul() * m; break;
      case 'inn': trade += (0.4 + S.fame * 0.0006) * tradeMul() * m; addFame(0.012 * dtH); break;
      case 'escort': trade += (b._connected ? 0.95 : 0.3) * tradeMul() * m; addFame(0.006 * dtH); break;
      case 'dojo': {
        const train = (S.vassal === 'cheongun' ? 1.5 : 1) * (hasMod('manual') ? 1.4 : 1);
        if (v.martial < S.martialCap) { v.martial = Math.min(S.martialCap, v.martial + 0.013 * v.talent * train * dtH); }
        break;
      }
      default: break;
    }
  }
  if (trade > 0) { addRes('silver', trade); if (S.dayAcc) S.dayAcc.trade = (S.dayAcc.trade || 0) + trade; }
  S.res.food -= pop * dtH / 12;
  if (S.res.food < 0) { S.res.food = 0; S.starving += dtH; }
  const cap = storageCap();
  for (const k of ['food', 'wood', 'stone', 'weapons']) S.res[k] = Math.min(S.res[k], cap);
}
function constructionStep(dtH) {
  if (!G.sites || !G.sites.length) return;
  let done = false;
  for (const b of G.sites) {
    if (b.done || b.ruined) continue;
    const def = BDEF[b.type];
    const rate = 0.5 + Math.min(4, b._builders || 0) * 1.1;
    b.progress += rate * dtH;
    b.hp = b.maxHp * clamp(0.3 + 0.7 * b.progress / def.time, 0.3, 1);
    if (b.progress >= def.time) {
      b.done = true; b.hp = b.maxHp; done = true;
      updateSiteFactors(b);
      if (!def.line) logMsg(`${def.name} 공사가 끝났다.`, 'good');
      Bus.emit('built', b);
    }
  }
  if (done) { refreshAssign(); }
}
function healStep(dtH) {
  const clinics = S.buildings.filter(b => usable(b) && b.type === 'clinic' && b._workers && b._workers.length).length;
  const bonus = 1 + clinics * 0.6;
  for (const v of S.villagers) {
    if (v.dead || v.down || v.hp >= v.maxHp) continue;
    if (S.raid && S.raid.active && v.act === 'fight') continue;
    v.hp = Math.min(v.maxHp, v.hp + v.maxHp * (v.inside ? 0.12 : 0.05) * bonus * dtH);
  }
  for (const b of S.buildings) {
    if (b.done && !b.ruined && b.hp < b.maxHp && !(S.raid && S.raid.active)) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.04 * dtH);
  }
}

// ── 민심 ─────────────────────────────────
function happinessFactors() {
  const f = [];
  const pop = Math.max(1, popCount());
  f.push(['기본', 50]);
  let amen = 0;
  for (const b of S.buildings) if (usable(b)) amen += BDEF[b.type].happy || 0;
  if (amen) f.push(['편의 시설', Math.min(28, amen * Math.sqrt(12 / Math.max(12, pop)))]);
  const tiled = S.villagers.filter(v => { const h = getB(v.home); return h && h.type === 'house2'; }).length;
  if (tiled) f.push(['기와집 살림', 8 * tiled / pop]);
  f.push(['세금', [8, 0, -12][S.tax]]);
  if (S.res.food <= 0) f.push(['굶주림', -25]);
  else if (S.res.food < pop * 2) f.push(['식량 부족', -6]);
  const homeless = S.villagers.filter(v => !v.dead && !v.home && !v.leaving).length;
  if (homeless) f.push(['집 없는 사람', -Math.min(20, homeless * 3)]);
  const def = defensePower();
  if (pop >= 12) {
    if (def < pop * 1.2) f.push(['치안 불안', -6]);
    else if (def > pop * 3) f.push(['든든한 무사들', 4]);
  }
  if (S.occupation) f.push(['점령의 굴욕', -20]);
  if (S.vassal === 'hyeolwol') f.push(['혈월교의 그늘', -10]);
  if (S.vassal === 'cheolhyeol') f.push(['철혈방의 횡포', -3]);
  if (S.vassal === 'cheongun') f.push(['정파의 비호', 3]);
  if (hasMod('festival')) f.push(['잔치의 여운', 12]);
  if (hasMod('wedding')) f.push(['혼례 경사', 5]);
  if (hasMod('grief')) f.push(['습격의 상처', -8]);
  if (hasMod('plague')) f.push(['역병', -10]);
  if (hasMod('tiger')) f.push(['호환의 공포', -8]);
  if (hasMod('victory')) f.push(['승전의 기쁨', 6]);
  // 모듈이 더하는 요인: [이름, 값] 배열
  for (const m of [Admin, Petitions, Story]) { const extra = hook(m, 'happinessFactors'); if (Array.isArray(extra)) f.push(...extra); }
  return f;
}
function happinessTarget() { return clamp(happinessFactors().reduce((a, [, v]) => a + v, 0), 0, 100); }
function defensePower() {
  let p = 0;
  for (const v of S.villagers) {
    if (v.dead || v.leaving) continue;
    if (v.hero) p += 6 + v.martial * 5;
    else if (v.role === 'guard') p += 2 + v.martial * 2.4;
  }
  for (const b of S.buildings) if (usable(b)) { if (b.type === 'tower') p += 3; if (b.type === 'wall' || b.type === 'stonewall' || b.type === 'gate') p += 0.25; }
  if (S.res.weapons > 0) p *= 1.15;
  return Math.round(p);
}

// ── 시간 흐름 ─────────────────────────────
function simStep(dtH) {
  const prev = S.time;
  S.time += dtH;
  if (Math.floor((prev - 6) / 24) !== Math.floor((S.time - 6) / 24)) dailyTick();
  if (Math.floor((prev - 14) / 24) !== Math.floor((S.time - 14) / 24)) growthCheck(false);
  if (Math.floor(prev) !== Math.floor(S.time)) hourlyTick();
  processScheduled();
  if (S._dirty) { refreshAssign(); S._dirty = false; }
  refreshLive();
  G.umap = new Map();
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) G.umap.set(u.id, u);
  for (const v of S.villagers) updateVillager(v, dtH);
  for (const e of S.enemies) updateEnemy(e, dtH);
  for (const a of S.allies) updateAlly(a, dtH);
  towersStep(dtH);
  projectilesStep(dtH);
  economyStep(dtH);
  constructionStep(dtH);
  healStep(dtH);
  if (S.raid) updateRaid(dtH);
  hook(Story, 'tick', dtH);
  for (const b of S.buildings) if (b.burning && b.burnUntil && S.time > b.burnUntil) { b.burning = false; b.burnUntil = 0; }
  cleanupDead();
}
function cleanupDead() {
  let changed = false;
  if (S.villagers.some(v => v.dead)) {
    for (const v of S.villagers) if (v.dead && UI.sel && UI.sel.u === v) UI.select(null);
    S.villagers = S.villagers.filter(v => !v.dead);
    changed = true;
  }
  if (S.enemies.some(e => e.dead)) S.enemies = S.enemies.filter(e => !e.dead);
  if (S.allies.some(a => a.dead)) S.allies = S.allies.filter(a => !a.dead);
  if (changed) markDirty();
  if (popCount() === 0 && !S.ended && !S.villagers.some(v => v.arriving)) {
    S.ended = true;
    Events.gameOver();
  }
}
function hourlyTick() {
  refreshAssign();
  const t = happinessTarget();
  S.happy += (t - S.happy) * 0.12;
  // 등급
  const pop = popCount();
  let rank = 0;
  for (let i = 0; i < RANKS.length; i++) if (pop >= RANKS[i].minPop) rank = i;
  if (rank > S.rank) {
    S.rank = rank;
    addFame(15 * rank);
    logMsg(`${S.name}${pp(S.name, '이/가')} ${RANKS[rank].name}${pp(RANKS[rank].name, '으로/로')} 커졌다! 새 건물을 지을 수 있다.`, 'good');
    UI.toast(`${RANKS[rank].name} 승격! 명성 +${15 * rank}`, 'good');
    UI.buildMenuDirty = true;
    Bus.emit('rankUp', rank);
  }
  hook(Admin, 'hourly');
  hook(Petitions, 'hourly');
  hook(Story, 'hourly');
  if (S.time >= S.nextEventAt) {
    S.nextEventAt = S.time + rnd(13, 26) * (S.occupation ? 1.6 : 1);
    if (!S.raid) Events.roll();
  }
  // 여름 비
  if (seasonIdx() === 1 && Math.random() < 0.06) S.rain = !S.rain;
  if (seasonIdx() !== 1) S.rain = false;
  // 승리
  if (!S.victory && S.rank >= 4 && S.fame >= 400) { S.victory = true; Events.victory(); }
}
function dailyTick() {
  const pop = popCount();
  const day = dayOf();
  S.lastFlow = S.dayAcc || {};
  S.dayAcc = {};
  // 세금
  let tax = pop * [0.8, 1.25, 1.8][S.tax] * (0.4 + S.happy / 100);
  if (S.vassal === 'gwanbu') tax *= 1.15;
  tax *= hook(Admin, 'taxMul') || 1;
  addRes('silver', tax);
  // 무사 품삯
  let wage = 0;
  for (const v of S.villagers) {
    if (v.dead) continue;
    if (v.hero) wage += v.hero.upkeep;
    else if (v.jobType && BDEF[v.jobType].upkeep) wage += BDEF[v.jobType].upkeep;
  }
  S.res.silver -= wage;
  if (S.res.silver < 0) {
    S.res.silver = 0;
    // 품삯을 못 주면 객경이 떠난다
    const hero = S.villagers.find(v => v.hero && !v.leaving);
    if (hero) { hero.leaving = true; logMsg(`품삯을 받지 못한 ${hero.hero.epithet} ${hero.name}${pp(hero.name, '이/가')} 마을을 떠났다.`, 'bad'); }
  }
  // 주군에게 공물
  if (S.vassal) {
    const trib = Math.round(4 + pop * 0.25);
    S.res.silver = Math.max(0, S.res.silver - trib);
    changeRel(S.vassal, 1);
    if (S.vassal === 'cheolhyeol') { addRes('silver', pop * 0.35); changeRel('gwanbu', -1); }
    if (S.vassal === 'hyeolwol') { changeRel('cheongun', -2); changeRel('gwanbu', -2); }
  }
  // 점령 수탈
  if (S.occupation) {
    const f = S.occupation.faction;
    const s = Math.min(Math.max(0, Math.floor(S.res.silver)), Math.max(8, Math.floor(S.res.silver * 0.25))), fo = Math.floor(S.res.food * 0.15);
    S.res.silver -= s; S.res.food -= fo;
    changeRel(f, -2); addFame(-1);
    logMsg(`${FACTIONS[f].name} 점령군이 은자 ${s}냥, 식량 ${fo}섬을 수탈해 갔다.`, 'bad');
  }
  // 수정자 만료
  const expired = S.mods.filter(m => m.until <= day);
  S.mods = S.mods.filter(m => m.until > day);
  for (const m of expired) if (m.id === 'disciples') { for (const a of S.allies) if (a.stayUntil) a.stayUntil = 0; logMsg('청운검문 제자들이 수련을 마치고 돌아갔다.'); }
  // 역병
  if (hasMod('plague')) {
    const clinic = S.buildings.some(b => usable(b) && b.type === 'clinic' && b._workers && b._workers.length);
    const p = hasMod('quarantine') ? 0.005 : clinic ? 0.02 : 0.05;
    for (const v of S.villagers) if (!v.dead && Math.random() < p) { v.dead = true; S.stats.died++; logMsg(`${v.name}${pp(v.name, '이/가')} 역병으로 세상을 떠났다.`, 'bad'); }
  }
  // 굶주림
  if (S.starving > 10 && pop > 0) {
    const v = pick(livingVillagers());
    if (v) { v.leaving = true; v.act = null; logMsg(`굶주림을 견디지 못한 ${v.name}${pp(v.name, '이/가')} 마을을 떠났다.`, 'bad'); }
  }
  S.starving = 0;
  // 무사들의 무공은 매일 조금씩 몸에 밴다
  for (const v of S.villagers) if (!v.dead) updateStats(v);
  // 위협
  threatTick();
  // 관계는 천천히 제자리로
  for (const k of FACTION_ORDER) {
    const f = S.factions[k];
    if (k === S.vassal) continue;
    if (f.rel > 30) f.rel -= 0.5; else if (f.rel < -40) f.rel += 0.5;
  }
  growthCheck(true);
  // 육방 예산 집행 → 상소 → 이야기 순서
  hook(Admin, 'daily');
  hook(Petitions, 'daily');
  hook(Story, 'daily');
  Bus.emit('day', day);
  S.stats.maxPop = Math.max(S.stats.maxPop, pop);
  for (const b of S.buildings) updateSiteFactors(b);
  if (S.time > 30) { saveGame(true); }
  if (day % DAYS_PER_SEASON === 0 && day > 0) {
    logMsg(`${SEASONS[seasonIdx()]}${pp(SEASONS[seasonIdx()], '이/가')} 왔다.`, '');
    UI.toast(`${yearOf()}년 ${SEASONS[seasonIdx()]}`, '');
  }
  if (seasonIdx() === 2 && day % DAYS_PER_SEASON === 6) {
    logMsg('나흘 뒤면 겨울이다. 겨울에는 논밭 수확이 크게 준다. 곳간을 채워 두자.', 'war');
    UI.toast('겨울이 다가온다. 식량을 비축하라.', 'bad');
  }
}
function growthCheck(morning) {
  if (S.occupation) return;
  const pop = popCount();
  const free = housingTotal() - pop - S.villagers.filter(v => v.arriving).length;
  if (free > 0 && S.res.food > pop * 1.2 && S.happy >= 42) {
    const maxN = 1 + Math.floor(S.fame / 120) + (S.happy > 70 ? 1 : 0) + (morning ? 1 : 0);
    const n = Math.min(free, rndi(1, maxN));
    if (n > 0 && Math.random() < 0.85) {
      const ex = pick(World.exits);
      for (let i = 0; i < n; i++) newVillager({ x: ex.x + 0.5, y: ex.y + 0.5, arriving: true });
      S.stats.born += n;
      logMsg(`${ex.name}${pp(ex.name, '으로/로')} 새 식구 ${n}명이 찾아왔다.`, 'good');
      Bus.emit('arrived', n);
      markDirty();
    }
  }
  if (S.happy < 25 && pop > 3 && morning) {
    const civs = livingVillagers().filter(v => !v.hero);
    const n = Math.min(civs.length, rndi(1, 2));
    for (let i = 0; i < n; i++) { const v = civs.splice(rndi(0, civs.length - 1), 1)[0]; v.leaving = true; v.act = null; }
    if (n) logMsg(`민심이 흉흉하여 ${n}명이 마을을 등졌다.`, 'bad');
    markDirty();
  }
}
function threatTick() {
  if (dayOf() < 3) return;
  if (hook(Story, 'allowThreat') === false) return;
  const calm = S.lastRaidEnd !== undefined && S.time - S.lastRaidEnd < 60;
  const pop = popCount();
  const wealth = S.res.silver / 60 + pop / 4 + S.fame / 40;
  for (const k of FACTION_ORDER) {
    const F = FACTIONS[k], f = S.factions[k];
    if (!F.military) continue;
    if (S.vassal === k || (S.occupation && S.occupation.faction === k)) { f.threat = 0; continue; }
    let gain = 0;
    if (k === 'heukpung') gain = 8 + wealth + Math.max(0, -f.rel) / 6;
    else if (f.rel < -20) gain = (-f.rel - 20) / 2.4 + wealth * 0.5;
    if (k === 'heukpung' && (S.vassal === 'gwanbu' || S.vassal === 'cheolhyeol')) gain *= 0.5;
    f.threat += gain * rnd(0.6, 1.4);
    if (f.threat >= 100 && !calm && !Events.raidPending() && !S.occupation) {
      f.threat = rnd(0, 20);
      Events.raidWarning(k);
      return;
    }
  }
}
function processScheduled() {
  if (!S.scheduled.length) return;
  const due = S.scheduled.filter(s => s.at <= S.time);
  if (!due.length) return;
  S.scheduled = S.scheduled.filter(s => s.at > S.time);
  for (const s of due) {
    if (s.kind === 'raid') { if (!S.raid && !S.occupation) startRaid(s.faction, s.goal, s.size, s); }
    else if (s.kind === 'allies') spawnAllies(s.faction, s.n, s.stayDays || 0);
    else if (s.kind === 'event') Events.queue(s.id, s.data);
  }
}

// ── 습격 ─────────────────────────────────
function raidSize(k, mul = 1) {
  const F = FACTIONS[k];
  return Math.round(clamp((F.baseSize + dayOf() * F.growth + popCount() / 9) * mul, 3, 34));
}
function scheduleRaid(k, delayH, goal, size, extra = {}) {
  S.scheduled.push(Object.assign({ at: S.time + delayH, kind: 'raid', faction: k, goal, size }, extra));
}
function pickExit(k) {
  const prefs = { heukpung: [2, 0], hyeolwol: [2, 1], cheolhyeol: [1, 3], gwanbu: [0, 3], cheongun: [0, 2] };
  const ids = prefs[k] || [0, 1, 2, 3];
  return World.exits[pick(ids)] || World.exits[0];
}
function startRaid(k, goal, size, opts = {}) {
  const ex = opts.exit || pickExit(k);
  S.raid = {
    faction: k, goal, active: true, phase: 'fight', start: S.time, total: size, toSpawn: goal === 'uprising' ? 0 : size,
    spawnT: 0, killed: 0, dead: 0, injured: 0, destroyed: 0, loot: {}, exit: ex,
    lootGoal: 40 + size * 12, leaderSpawned: goal === 'uprising',
  };
  if (goal === 'uprising') {
    for (const e of S.enemies) if (e.garrison) { e.target = 0; e.path = null; }
    S.raid.total = S.enemies.filter(e => e.garrison).length;
    logMsg(`봉기다! 마을 무사들이 ${FACTIONS[k].name} 점령군에 맞서 일어섰다!`, 'war');
  } else {
    logMsg(`${FACTIONS[k].name}의 무리 ${size}명이 ${ex.name}${pp(ex.name, '으로/로')} 쳐들어왔다!`, 'war');
    UI.toast(`⚔ ${FACTIONS[k].name} 습격!`, 'bad');
    if (S.vassal && S.vassal !== k && FACTIONS[S.vassal].military) {
      const n = 3 + Math.floor(dayOf() / 6);
      S.scheduled.push({ at: S.time + 0.8, kind: 'allies', faction: S.vassal, n: Math.min(n, 10) });
      logMsg(`주군인 ${FACTIONS[S.vassal].name}에서 원군을 보낸다는 전갈이 왔다.`, 'good');
    }
  }
  if (S.speed > 1) S.speed = 1;
  UI.focusOn(ex.x, ex.y);
  markDirty();
  Bus.emit('raidStart', S.raid);
}
function spawnAllies(k, n, stayDays) {
  const ex = World.exits[rndi(0, World.exits.length - 1)];
  for (let i = 0; i < n; i++) {
    const a = newAlly(k, ex.x + 0.5 + rnd(-0.3, 0.3), ex.y + 0.5 + rnd(-0.3, 0.3), { leader: i === 0 && n >= 4, stayUntil: stayDays ? dayOf() + stayDays : 0 });
    a.spawnDelay = i * 0.05;
  }
  logMsg(`${FACTIONS[k].name}의 무인 ${n}명이 ${ex.name}${pp(ex.name, '으로/로')} 들어왔다.`, 'good');
}
function updateAlly(a, dtH) {
  if (a.dead) return;
  a.cd -= dtH;
  if (a.atkT > 0) a.atkT -= dtH;
  if (a.spawnDelay > 0) { a.spawnDelay -= dtH; return; }
  if (S.raid && S.raid.active) { fighterAI(a, dtH); return; }
  if (a.stayUntil && dayOf() < a.stayUntil) {
    // 머무는 제자들: 무관이나 광장 근처에서 수련
    if (!a.path) {
      a.idleT = (a.idleT || 0) - dtH;
      if (a.idleT <= 0) {
        const p = plazaTile();
        const t = randomTileNear(p.x, p.y + 2, 5);
        if (t && goTo(a, t.x, t.y, 0) !== 'wait') a.idleT = rnd(1, 3);
      }
    }
    moveUnit(a, dtH);
    return;
  }
  if (!a.path) {
    const ex = a.exit || nearestExit(a);
    a.exit = ex;
    if (dist(a.x, a.y, ex.x + 0.5, ex.y + 0.5) < 1.2) { a.dead = true; return; }
    if (goTo(a, ex.x, ex.y, 0) === 'fail') { a.dead = true; return; }
  }
  moveUnit(a, dtH);
}
function towersStep(dtH) {
  for (const b of S.buildings) {
    if (b.type !== 'tower' || !usable(b) || !b._manned) continue;
    b.cd = (b.cd || 0) - dtH;
    if (b.cd > 0) continue;
    const range = BDEF.tower.range;
    let best = null, bd = range;
    for (const e of S.enemies) {
      if (e.dead || (e.garrison && !(S.raid && S.raid.goal === 'uprising'))) continue;
      const d = dist(b.x + 0.5, b.y + 0.5, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) continue;
    const archer = b._manned;
    archer.dir = best.x > b.x + 0.5 ? 1 : -1;
    b.cd = 0.16;
    const dmg = (5 + archer.martial * 2.6) * (S.res.weapons > 0 ? 1.3 : 1);
    G.projectiles.push({ x0: b.x + 0.5, y0: b.y + 0.5, z0: 70, x1: best.x, y1: best.y, z1: 8, t: 0, dur: 0.02 + bd * 0.006, target: best.id, dmg, src: archer.id });
  }
}
function projectilesStep(dtH) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.t += dtH;
    if (p.t >= p.dur) {
      G.projectiles.splice(i, 1);
      const t = unitById(p.target);
      if (t && !t.dead) damage(t, p.dmg, unitById(p.src));
    }
  }
}
function updateRaid(dtH) {
  const r = S.raid;
  if (!r.active) return;
  if (r.toSpawn > 0) {
    r.spawnT -= dtH;
    if (r.spawnT <= 0) {
      r.spawnT = 0.05;
      const leader = !r.leaderSpawned && r.toSpawn <= Math.ceil(r.total / 2);
      if (leader) r.leaderSpawned = true;
      const ex = r.exit;
      const p = nearestWalkable(ex.x, ex.y, 1, 4) || ex;
      newEnemy(r.faction, p.x + 0.5 + rnd(-0.3, 0.3), p.y + 0.5 + rnd(-0.3, 0.3), { leader });
      r.toSpawn--;
    }
  }
  const alive = S.enemies.filter(e => !e.dead && (!e.garrison || r.goal === 'uprising'));
  const elapsed = S.time - r.start;
  if (r.goal === 'uprising') {
    if (!alive.length) { endRaid('liberated'); return; }
    const defenders = S.villagers.filter(v => !v.dead && !v.down && (v.role === 'guard' || v.hero) && v.jobType !== 'tower').length
      + S.allies.filter(a => !a.dead).length;
    if (!defenders) { endRaid('uprising_failed'); return; }
    return;
  }
  if (r.phase === 'fight') {
    let lootSum = 0;
    for (const k in r.loot) lootSum += r.loot[k];
    if (r.toSpawn === 0 && !alive.length) { endRaid('win'); return; }
    if ((r.killed >= r.total * 0.6 && r.toSpawn === 0) || elapsed > 9 || lootSum >= r.lootGoal) {
      r.phase = 'retreat';
      for (const e of alive) { e.flee = true; e.path = null; e.target = 0; }
      logMsg(`${FACTIONS[r.faction].name} 무리가 물러가기 시작했다.`, 'war');
    }
  } else if (!alive.length) {
    endRaid(r.killed >= r.total * 0.5 ? 'win' : 'lost');
  }
}
function endRaid(result) {
  const r = S.raid;
  if (!r) return;
  r.active = false;
  const F = FACTIONS[r.faction];
  for (const b of S.buildings) b.burning = false;
  for (const a of S.allies) a.target = 0;
  let lootTxt = Object.keys(r.loot).filter(k => r.loot[k] > 0).map(k => `${RESOURCES[k].name} ${Math.round(r.loot[k])}`).join(', ');
  let title, body, stamp = '戰';
  if (result === 'win') {
    S.stats.raidsWon++;
    const fame = Math.round(6 + r.total * 1.6);
    addFame(fame);
    changeRel(r.faction, -6);
    if (r.faction === 'heukpung') changeRel('gwanbu', 3);
    if (F.rivals) for (const k of FACTION_ORDER) if (FACTIONS[k].rivals && FACTIONS[k].rivals.includes(r.faction)) changeRel(k, 4);
    addMod('victory', 2);
    title = `${F.name} 격퇴`;
    body = `마을이 ${F.name}의 습격을 막아냈다! 적 ${r.killed}명을 쓰러뜨렸다.\n강호에 마을의 이름이 퍼진다. 명성 +${fame}.`;
    logMsg(`${F.name}의 습격을 물리쳤다! 명성 +${fame}`, 'good');
  } else if (result === 'lost') {
    S.stats.raidsLost++;
    addFame(-5);
    addMod('grief', 3);
    title = `${F.name}에게 약탈당하다`;
    body = `${F.name} 무리가 마을을 휩쓸고 달아났다. 쓰러뜨린 적은 ${r.killed}명뿐이었다.`;
    logMsg(`${F.name}${pp(F.name, '이/가')} 마을을 약탈하고 물러갔다.`, 'bad');
  } else if (result === 'liberated') {
    S.stats.raidsWon++;
    const occ = S.occupation;
    S.occupation = null;
    addFame(35);
    changeRel(r.faction, -20);
    addMod('victory', 3);
    title = '마을을 되찾다';
    stamp = '復';
    body = `봉기가 성공했다! ${F.name} 점령군을 몰아내고 마을을 되찾았다.\n명성 +35. 사람들이 거리로 나와 환호한다.`;
    logMsg(`${F.name} 점령군을 몰아냈다! 마을이 해방되었다.`, 'good');
    if (occ) for (const e of S.enemies) e.garrison = false;
  } else if (result === 'uprising_failed') {
    title = '봉기 실패';
    stamp = '敗';
    addMod('grief', 3);
    changeRel(r.faction, -10);
    body = `무사들이 모두 쓰러졌다. ${F.name} 점령군의 감시가 더 삼엄해졌다.`;
    logMsg('봉기가 실패했다.', 'bad');
    for (const e of S.enemies) if (!e.dead) { e.garrison = true; e.target = 0; e.path = null; }
  }
  const lines = [];
  if (r.dead) lines.push(`목숨을 잃은 사람 ${r.dead}명`);
  if (r.injured) lines.push(`다친 사람 ${r.injured}명`);
  if (r.destroyed) lines.push(`부서진 건물 ${r.destroyed}채`);
  if (lootTxt) lines.push(`빼앗긴 물자: ${lootTxt}`);
  if (lines.length) body += '\n\n' + lines.join('\n');
  S.raid = null;
  S.lastRaidEnd = S.time;
  for (const e of S.enemies) if (!e.garrison) { e.flee = true; e.path = null; }
  markDirty();
  Bus.emit('raidEnd', result, r);
  if (result === 'liberated') Bus.emit('liberated', 'uprising');
  Events.notice(title, body, stamp);
}
function beginOccupation(k) {
  const r = S.raid;
  const F = FACTIONS[k];
  S.occupation = { faction: k, since: dayOf() };
  const manor = getB(S.manorId);
  if (manor) { manor.ruined = false; manor.done = true; manor.hp = manor.maxHp * 0.4; manor.burning = false; }
  // 우두머리와 정예 몇만 남아 지키고 나머지는 돌아간다
  const alive = S.enemies.filter(e => !e.dead).sort((a, b) => (b.leader - a.leader) || (b.maxHp - a.maxHp));
  const keep = clamp(Math.ceil(alive.length * 0.4), 4, 8);
  alive.forEach((e, i) => {
    e.target = 0; e.tb = 0; e.blockB = 0; e.path = null;
    if (i < keep) { e.garrison = true; e.flee = false; } else { e.flee = true; }
  });
  const need = Math.max(0, 4 - Math.min(alive.length, keep));
  const d = manor ? doorOf(manor) : plazaTile();
  for (let i = 0; i < need; i++) newEnemy(k, d.x + 0.5 + rnd(-1, 1), d.y + 1.5, { garrison: true });
  S.raid = null;
  S.stats.raidsLost++;
  addFame(-15);
  for (const b of S.buildings) b.burning = false;
  logMsg(`영주관이 함락되었다. 마을은 이제 ${F.name}의 손아귀에 있다.`, 'bad');
  Bus.emit('occupied', k);
  markDirty();
  Events.notice(`${F.name}에게 점령당하다`,
    `영주관에 ${F.name}의 깃발이 올랐다. 점령군은 매일 은자와 식량을 수탈하고, 새로 찾아오는 사람도 없다.\n\n몸값을 치르거나, 무사를 길러 봉기하거나, 우호 세력에 구원을 청해 마을을 되찾아야 한다. 세력 창에서 할 수 있다.`, '陷');
}
function ransomCost() { return Math.round(150 + dayOf() * 5 + popCount() * 3); }
function payRansom() {
  if (!S.occupation) return false;
  const c = ransomCost();
  if (S.res.silver < c) return false;
  S.res.silver -= c;
  const k = S.occupation.faction;
  S.occupation = null;
  for (const e of S.enemies) { e.garrison = false; e.flee = true; e.path = null; }
  changeRel(k, 10);
  logMsg(`몸값 ${c}냥을 치르고 ${FACTIONS[k].name} 점령군을 돌려보냈다.`, 'good');
  Bus.emit('liberated', 'ransom');
  markDirty();
  return true;
}
function startUprising(withAllyFaction) {
  if (!S.occupation || S.raid) return false;
  if (!withAllyFaction && !fighters().some(v => v.jobType !== 'tower')) { UI.toast('봉기할 무사가 없다. 무관을 지어 무사를 길러라.', 'bad'); return false; }
  if (withAllyFaction) spawnAllies(withAllyFaction, 5 + Math.floor(dayOf() / 8), 0);
  startRaid(S.occupation.faction, 'uprising', 0);
  return true;
}
function becomeVassal(k) {
  const prev = S.vassal;
  if (prev && prev !== k) breakVassal(true);
  S.vassal = k;
  changeRel(k, 20);
  S.factions[k].threat = 0;
  for (const r of (FACTIONS[k].rivals || [])) changeRel(r, -25);
  for (const o of FACTION_ORDER) if ((FACTIONS[o].rivals || []).includes(k)) changeRel(o, -15);
  logMsg(`${josa(S.name, '이/가')} ${FACTIONS[k].name}의 산하 마을이 되었다.`, 'war');
  Bus.emit('vassal', k);
}
function breakVassal(silent) {
  const k = S.vassal;
  if (!k) return;
  S.vassal = null;
  changeRel(k, -40);
  S.factions[k].threat = 50;
  if (!silent) logMsg(`${FACTIONS[k].name}${pp(FACTIONS[k].name, '과/와')}의 주종 관계를 끊었다. 그들의 분노가 하늘을 찌른다.`, 'bad');
  Bus.emit('vassal', null);
}

// ── 저장·불러오기 ──────────────────────────
const SKIP_KEYS = new Set(['path', 'chat', 'wt', 'bmap', 'hitT', 'flash', 'exit']);
function serialize() {
  const tiles = String.fromCharCode(...World.tiles.map(t => 48 + t));
  let roads = '';
  for (let i = 0; i < World.road.length; i++) roads += World.road[i] ? '1' : '0';
  const json = JSON.stringify(S, (k, v) => (k.startsWith('_') || SKIP_KEYS.has(k)) ? undefined : v);
  return JSON.stringify({ v: 1, tiles, roads, state: json, saved: Date.now() });
}
function deserialize(str) {
  const data = JSON.parse(str);
  if (!data || data.v !== 1) throw new Error('알 수 없는 저장 형식');
  const st = JSON.parse(data.state);
  // 지형: 시드로 변화값을 되살리고 저장된 타일을 덮는다
  genWorld(st.seed);
  for (let i = 0; i < World.tiles.length; i++) { World.tiles[i] = data.tiles.charCodeAt(i) - 48; World.road[i] = data.roads[i] === '1' ? 1 : 0; }
  S = st;
  S.bmap = new Map();
  for (const b of S.buildings) S.bmap.set(b.id, b);
  for (const arr of [S.villagers, S.enemies, S.allies]) for (const u of arr) { u.path = null; u.moving = false; }
  for (const v of S.villagers) { if (v.inside) v.act = null; }
  World.rebuildOcc();
  World.terrainDirty = true;
  for (const b of S.buildings) updateSiteFactors(b);
  refreshAssign();
  hook(Admin, 'onLoad');
  hook(Petitions, 'onLoad');
  hook(Story, 'onLoad');
}
function saveGame(auto) {
  if (!S || S.ended) return false;
  const ok = Store.set(SAVE_KEY, serialize());
  if (!auto) UI.toast(ok ? '저장했다.' : '이 브라우저에서는 저장할 수 없다.', ok ? 'good' : 'bad');
  return ok;
}
function loadGame() {
  const s = Store.get(SAVE_KEY);
  if (!s) return false;
  try { deserialize(s); return true; } catch (e) { console.warn('불러오기 실패', e); return false; }
}
