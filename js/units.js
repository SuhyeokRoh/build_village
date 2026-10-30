'use strict';
// ───────────────────────────────────────────────
// 사람들: 마을 사람의 하루, 이동, 싸움
// 좌표는 타일 단위 실수 (타일 중심 = 정수 + 0.5)
// ───────────────────────────────────────────────
const CHATS = {
  day: ['날이 좋구먼', '풍년이 들어야지', '영주님 덕이지', '아이고 허리야', '오늘도 힘내세', '객잔에 고수가 왔대', '흑풍채 소문 들었나', '세금이 또 오른대', '장에 가봐야겠네'],
  evening: ['한잔 하세!', '오늘 수고했네', '저녁은 뭘 먹나', '달이 밝구먼', '노래나 한 가락'],
  train: ['하앗!', '자세를 낮춰라!', '한 번 더!', '이얍!'],
  hungry: ['배가 고프다…', '먹을 게 없어', '살기 힘들구먼'],
  happy: ['살기 좋은 마을이야', '여기 오길 잘했어', '참 평화롭구먼'],
};

function unitById(id) { return G.umap ? G.umap.get(id) || null : null; }
function getB(id) { return id ? S.bmap.get(id) || null : null; }
function usable(b) { return b && b.done && !b.ruined; }
function plazaTile() { const m = S.bmap.get(S.manorId); return m ? doorOf(m) : { x: World.center.x, y: World.center.y + 2 }; }

function newVillager(opts = {}) {
  const sex = opts.sex || (Math.random() < 0.5 ? 'm' : 'f');
  const age = opts.age || rndi(16, 58);
  const v = {
    id: S.nextId++, kind: 'v', sex, age,
    name: opts.name || makeName(sex, Math.random() < 0.22),
    x: opts.x !== undefined ? opts.x : World.center.x + 0.5, y: opts.y !== undefined ? opts.y : World.center.y + 2.5,
    home: 0, job: 0, jobType: null, role: 'civ',
    hp: 24, maxHp: 24, atk: 1.5, martial: opts.martial || 0, talent: opts.talent || rnd(0.6, 1.4),
    hero: opts.hero || null,
    look: opts.look || makeLook(opts.hero ? 'hero' : 'civ', sex, { old: age > 52 }),
    sched: rnd(-0.7, 0.7), act: null, phase: 'plan', stayT: 0, inside: false, insideB: 0,
    path: null, pi: 0, dir: 1, walk: 0, moving: false, cd: 0, atkT: 0, target: 0, strikes: 0,
    down: false, downT: 0, dead: false, ox: rnd(-5, 5), oy: rnd(-3, 3), repath: 0,
    speed: (opts.hero ? 9 : 7) + rnd(-0.5, 0.5), arriving: !!opts.arriving, leaving: false,
    joined: dayOf(),
  };
  updateStats(v);
  v.hp = v.maxHp;
  S.villagers.push(v);
  return v;
}
// 무사·객경의 체력에는 주군·동맹·갈래 건물의 혜택(JH.perk('hp'))이 붙는다
function updateStats(v) {
  if (v.hero) { v.maxHp = (70 + v.martial * 38) * JH.perk('hp'); v.atk = 6 + v.martial * 4.8; }
  else if (v.role === 'guard') { v.maxHp = (34 + v.martial * 18) * JH.perk('hp'); v.atk = 3 + v.martial * 3; }
  else { v.maxHp = 24 + v.martial * 6; v.atk = 1.5 + v.martial; }
  v.hp = Math.min(v.hp, v.maxHp);
}
function newEnemy(faction, x, y, opts = {}) {
  const F = FACTIONS[faction];
  const scale = 1 + dayOf() * 0.018;
  const leader = !!opts.leader;
  const sex = leader ? 'm' : (Math.random() < 0.15 ? 'f' : 'm');
  const e = {
    id: S.nextId++, kind: 'e', faction, sex, leader,
    name: makeName(sex), title: leader ? F.leader.title + ' ' + makeName('m') : F.unit.name,
    x, y, hp: 0, maxHp: Math.round((leader ? F.leader.hp : F.unit.hp) * scale * (opts.mul || 1)),
    atk: (leader ? F.leader.atk : F.unit.atk) * Math.sqrt(scale) * (opts.mul || 1),
    look: makeLook('faction', sex, { faction, leader }), speed: rnd(6.8, 7.8) + (leader ? 0.6 : 0),
    path: null, pi: 0, dir: 1, walk: 0, moving: false, cd: rnd(0, 0.1), atkT: 0, target: 0, tb: 0,
    ox: rnd(-6, 6), oy: rnd(-3, 3), repath: 0, carry: 0, carryRes: {}, flee: false, dead: false,
    garrison: !!opts.garrison, torch: Math.random() < 0.4, strikes: 0,
  };
  e.hp = e.maxHp;
  S.enemies.push(e);
  return e;
}
function newAlly(faction, x, y, opts = {}) {
  const F = FACTIONS[faction];
  const scale = 1 + dayOf() * 0.015;
  const e = {
    id: S.nextId++, kind: 'a', faction, sex: 'm', leader: !!opts.leader,
    name: makeName('m'), title: opts.leader ? F.leader.title : F.unit.name,
    x, y, hp: 0, maxHp: Math.round((opts.leader ? F.leader.hp * 0.7 : F.unit.hp) * scale),
    atk: (opts.leader ? F.leader.atk * 0.8 : F.unit.atk) * Math.sqrt(scale),
    look: makeLook('faction', 'm', { faction, leader: opts.leader }), speed: 7.6,
    path: null, pi: 0, dir: 1, walk: 0, moving: false, cd: 0, atkT: 0, target: 0,
    ox: rnd(-6, 6), oy: rnd(-3, 3), repath: 0, dead: false, stayUntil: opts.stayUntil || 0, torch: true, strikes: 0,
  };
  e.hp = e.maxHp;
  S.allies.push(e);
  return e;
}

// ── 이동 ─────────────────────────────────
function goTo(u, tx, ty, mode = 0, goalFn = null) {
  const p = findPath(u.x, u.y, tx, ty, mode, goalFn);
  if (p === undefined) return 'wait';
  if (p === null) return 'fail';
  u.path = p; u.pi = 0;
  return 'ok';
}
function tileSpeed(x, y) {
  const i = Math.floor(y) * MW + Math.floor(x);
  if (World.road[i]) return 1.45;
  if (World.tiles[i] === T.FOREST) return 0.7;
  return 1;
}
function moveUnit(u, dtH) {
  if (!u.path) { u.moving = false; return; }
  let budget = u.speed * dtH * tileSpeed(u.x, u.y);
  const moved = budget;
  while (budget > 0 && u.pi < u.path.length) {
    const n = u.path[u.pi];
    if (u.kind === 'e') {
      const b = World.bAt(n.x, n.y);
      if (b && (b.type === 'wall' || b.type === 'stonewall' || b.type === 'gate') && !b.ruined) {
        u.blockB = b.id; u.moving = false; return;
      }
    } else if (!walkable(n.x, n.y, 0)) { u.path = null; u.moving = false; return; }
    const tx = n.x + 0.5, ty = n.y + 0.5;
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.02) u.dir = dx > 0 ? 1 : -1;
    if (d <= budget) { u.x = tx; u.y = ty; budget -= d; u.pi++; }
    else { u.x += dx / d * budget; u.y += dy / d * budget; budget = 0; }
  }
  u.moving = true;
  u.walk += (moved - budget) * 5.5;
  if (u.pi >= u.path.length) { u.path = null; u.moving = false; }
}
function stepToward(u, tx, ty, dtH, mode) {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  if (d < 0.01) return true;
  const s = Math.min(d, u.speed * dtH);
  const nx = u.x + dx / d * s, ny = u.y + dy / d * s;
  if (!walkable(Math.floor(nx), Math.floor(ny), mode) && !(Math.floor(nx) === Math.floor(u.x) && Math.floor(ny) === Math.floor(u.y))) return false;
  u.x = nx; u.y = ny;
  if (Math.abs(dx) > 0.02) u.dir = dx > 0 ? 1 : -1;
  u.moving = true; u.walk += s * 5.5;
  return true;
}
function enter(v, b) { v.inside = true; v.insideB = b.id; v.moving = false; v.path = null; }
function leaveInside(v) {
  if (!v.inside) return;
  const b = getB(v.insideB);
  v.inside = false; v.insideB = 0;
  if (b) { const d = doorOf(b); v.x = d.x + 0.5; v.y = d.y + 0.5; }
}
function say(u, list) { u.chat = { text: pick(list), until: R.now + 2.6 }; }

// ── 마을 사람의 하루 ───────────────────────
function desiredAct(v) {
  if (v.away) return 'away';   // 의뢰로 길을 떠남 (일자리·역할은 그대로 둔다)
  if (v.leaving) return 'leave';
  if (v.arriving) return 'arrive';
  const h = (hourOf() + v.sched + 24) % 24;
  const fighter = v.role === 'guard' || !!v.hero;
  if (S.raid && S.raid.active) {
    if (v.jobType === 'tower') return 'work';
    if (fighter) return (v.hp < v.maxHp * 0.22 && !v.hero) ? 'shelter' : 'fight';
    return 'shelter';
  }
  if (v.jobType === 'tower') return 'work';
  if (h >= 21.5 || h < 5.2) {
    if (v.role === 'guard' && v.jobType === 'dojo' && v.id % 2 === 0 && (h >= 21.5 || h < 0.8)) return 'patrol';
    return 'sleep';
  }
  if (h >= 6 && h < 17.5) {
    if (v.hero) return 'hero';
    if (v.job) return 'work';
    if (G.sites && G.sites.length) return 'build';
    return 'idle';
  }
  if (h >= 17.5) return 'leisure';
  return 'idle';
}

function updateVillager(v, dtH) {
  if (v.dead) return;
  v.cd -= dtH;
  if (v.atkT > 0) v.atkT -= dtH;
  if (v.down) {
    v.moving = false;
    if (!(S.raid && S.raid.active)) { v.downT -= dtH; if (v.downT <= 0) { v.down = false; v.hp = v.maxHp * 0.3; } }
    return;
  }
  const want = desiredAct(v);
  if (want !== v.act) {
    if (v.inside) leaveInside(v);
    v.act = want; v.phase = 'plan'; v.path = null; v.workAnim = null; v.stayT = 0; v.target = 0;
    v.torch = want === 'patrol';
  }
  switch (v.act) {
    case 'sleep': case 'shelter': actGoInside(v, homeOrShelter(v)); break;
    case 'work': actWork(v, dtH); break;
    case 'build': actBuild(v, dtH); break;
    case 'fight': fighterAI(v, dtH); break;
    case 'leave': actLeave(v); break;
    case 'arrive': actArrive(v); break;
    case 'away': actAway(v); break;
    default: actWander(v, dtH); break;
  }
  if (!v.inside) moveUnit(v, dtH);
}
function homeOrShelter(v) {
  const h = getB(v.home);
  if (usable(h)) return h;
  const m = getB(S.manorId);
  return usable(m) ? m : null;
}
function actGoInside(v, b) {
  if (v.phase === 'plan') {
    if (!b) { v.phase = 'stay'; return; }
    const d = doorOf(b);
    const r = goTo(v, d.x, d.y, 0, buildingApproachGoal(b));
    if (r === 'wait') return;
    if (r === 'fail') { v.phase = 'stay'; return; }
    v.phase = 'go'; v.destB = b.id;
  } else if (v.phase === 'go' && !v.path) {
    const b2 = getB(v.destB);
    if (usable(b2)) enter(v, b2);
    v.phase = 'stay';
  }
}
function workSpot(v, b) {
  const def = BDEF[b.type];
  if (def.walkRows) {
    const p = randomTileNear(b.x + b.w / 2, b.y + b.h - def.walkRows / 2, Math.max(b.w, def.walkRows) / 2,
      (x, y) => World.occ[y * MW + x] === b.id);
    if (p) return { p, goal: null };
  }
  if (b.type === 'lumber' || b.type === 'quarry' || b.type === 'fishery') {
    const want = b.type === 'lumber' ? T.FOREST : b.type === 'quarry' ? T.ROCK : T.WATER;
    const p = randomTileNear(b.x + b.w / 2, b.y + b.h / 2, 5, (x, y) => {
      if (b.type === 'lumber') return World.tiles[y * MW + x] === T.FOREST;
      for (const [dx, dy] of DIRS) if (World.tile(x + dx, y + dy) === want) return true;
      return false;
    });
    if (p) return { p, goal: null };
  }
  const d = doorOf(b);
  return { p: d, goal: buildingApproachGoal(b) };
}
const TOOL_OF = { farm: 'hoe', lumber: 'axe', quarry: 'pick', fishery: 'rod', smithy: 'hammer', dojo: null, escort: null, market: null,
  hall_jeong: null, altar_ma: null, ancestral: null, blackmarket: null, gambling: null, horsemarket: null, yamen: null, stage: null };
const SPAR = new Set(['dojo', 'hall_jeong', 'stage']);   // 일하며 무기를 휘두르는 곳
function actWork(v, dtH) {
  const b = getB(v.job);
  if (!usable(b)) { v.job = 0; v.jobType = null; v.act = null; return; }
  const def = BDEF[b.type];
  if (v.phase === 'plan') {
    const { p, goal } = workSpot(v, b);
    const r = goTo(v, p.x, p.y, 0, goal);
    if (r === 'wait') return;
    if (r === 'fail') { v.phase = 'stay'; v.stayT = 1; return; }
    v.phase = 'go';
  } else if (v.phase === 'go') {
    if (!v.path) {
      v.phase = 'stay';
      v.stayT = def.indoor ? rnd(3, 6) : rnd(0.8, 2.2);
      if (def.indoor) enter(v, b);
      v.workAnim = SPAR.has(b.type) ? (v.look.weapon || 'fist') : TOOL_OF[b.type] || null;
      if (b.type === 'market' || b.type === 'escort') v.workAnim = null;
    }
  } else if (v.phase === 'stay') {
    v.stayT -= dtH;
    if ((b.type === 'dojo' || b.type === 'hall_jeong') && Math.random() < dtH * 0.15) say(v, CHATS.train);
    if (v.stayT <= 0) {
      if (def.indoor) v.stayT = rnd(3, 6);
      else { v.phase = 'plan'; v.workAnim = null; }
    }
  }
}
function isWorking(v) { return v.act === 'work' && v.phase === 'stay' && !v.down; }

function actBuild(v, dtH) {
  let site = getB(v.site);
  if (!site || site.done || site.ruined) {
    site = null;
    let best = null, bd = Infinity;
    for (const s of G.sites) {
      if ((s._builders || 0) >= 4) continue;
      const d = dist(v.x, v.y, s.x + s.w / 2, s.y + s.h / 2);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) { v.act = 'idle'; v.phase = 'plan'; return; }
    site = best; v.site = best.id; best._builders = (best._builders || 0) + 1;
    v.phase = 'plan';
  }
  if (v.phase === 'plan') {
    const d = doorOf(site);
    const r = goTo(v, d.x, d.y, 0, buildingApproachGoal(site));
    if (r === 'wait') return;
    if (r === 'fail') { v.site = 0; v.act = 'idle'; v.phase = 'plan'; return; }
    v.phase = 'go';
  } else if (v.phase === 'go' && !v.path) {
    v.phase = 'stay'; v.stayT = rnd(1, 2.5); v.workAnim = 'hammer';
    v.dir = (site.x + site.w / 2) > v.x ? 1 : -1;
  } else if (v.phase === 'stay') {
    v.stayT -= dtH;
    if (v.stayT <= 0) { v.phase = 'plan'; v.workAnim = null; }
  }
}
function isBuilding(v) { return v.act === 'build' && v.phase === 'stay' && !v.down; }

function wanderTarget(v) {
  const plaza = plazaTile();
  const act = v.act;
  if (act === 'leisure') {
    const venues = S.buildings.filter(b => usable(b) && ['inn', 'market', 'shrine', 'pavilion', 'well'].includes(b.type));
    if (venues.length && Math.random() < 0.75) {
      const b = pick(venues);
      return { b, p: doorOf(b), indoor: b.type === 'inn' && Math.random() < 0.6 };
    }
    return { p: randomTileNear(plaza.x, plaza.y + 1, 5) || plaza };
  }
  if (act === 'hero') {
    const dojo = S.buildings.find(b => usable(b) && b.type === 'dojo');
    if (dojo && Math.random() < 0.6) {
      const p = randomTileNear(dojo.x + 1.5, dojo.y + 2, 1.5, (x, y) => World.occ[y * MW + x] === dojo.id);
      if (p) return { p, train: true };
    }
    const inn = S.buildings.find(b => usable(b) && b.type === 'inn');
    if (inn && Math.random() < 0.5) return { b: inn, p: doorOf(inn), indoor: true };
    return { p: randomTileNear(plaza.x, plaza.y + 1, 6) || plaza };
  }
  if (act === 'patrol') {
    const bs = S.buildings.filter(b => usable(b) && b.type !== 'wall' && b.type !== 'stonewall');
    const b = pick(bs);
    return { p: b ? (randomTileNear(b.x + b.w / 2, b.y + b.h + 1, 2) || doorOf(b)) : plaza };
  }
  const home = getB(v.home);
  if (home && Math.random() < 0.4) return { p: randomTileNear(home.x + home.w / 2, home.y + home.h + 1, 3) || plaza };
  return { p: randomTileNear(plaza.x, plaza.y + 1, 6) || plaza };
}
function actWander(v, dtH) {
  if (v.phase === 'plan') {
    const t = wanderTarget(v);
    const r = goTo(v, t.p.x, t.p.y, 0, t.b ? buildingApproachGoal(t.b) : null);
    if (r === 'wait') return;
    if (r === 'fail') { v.phase = 'stay'; v.stayT = 0.5; return; }
    v.phase = 'go'; v.wt = t;
  } else if (v.phase === 'go' && !v.path) {
    v.phase = 'stay';
    v.stayT = v.act === 'patrol' ? rnd(0.15, 0.4) : rnd(0.5, 1.6);
    if (v.wt && v.wt.indoor && v.wt.b && usable(v.wt.b)) { enter(v, v.wt.b); v.stayT = rnd(1, 2.5); }
    if (v.wt && v.wt.train) { v.workAnim = v.look.weapon || 'fist'; v.stayT = rnd(1.5, 3); }
    if (!v.inside && Math.random() < 0.25) {
      const h = hourOf();
      if (S.res.food <= 0) say(v, CHATS.hungry);
      else if (S.happy > 75 && Math.random() < 0.4) say(v, CHATS.happy);
      else say(v, h >= 17 ? CHATS.evening : CHATS.day);
    }
  } else if (v.phase === 'stay') {
    v.stayT -= dtH;
    if (v.stayT <= 0) { if (v.inside) leaveInside(v); v.phase = 'plan'; v.workAnim = null; }
  }
}
function nearestExit(u) {
  let best = World.exits[0], bd = Infinity;
  for (const ex of World.exits) { const d = dist(u.x, u.y, ex.x, ex.y); if (d < bd) { bd = d; best = ex; } }
  return best;
}
function actLeave(v) {
  if (v.phase === 'plan') {
    const ex = v.exit || nearestExit(v);
    v.exit = ex;
    const r = goTo(v, ex.x, ex.y, 0);
    if (r === 'wait') return;
    if (r === 'fail') { v.dead = true; v.gone = true; return; }
    v.phase = 'go';
  } else if (v.phase === 'go' && !v.path) { v.dead = true; v.gone = true; }
}
// 의뢰로 떠남: 그 세력 쪽 길목으로 걸어가 닿으면 숨긴다(inside, 건물 없음). 돌아오는 것은 JH.hourly 가 정한다
function actAway(v) {
  const a = v.away;
  if (a.gone) { v.inside = true; v.insideB = 0; v.moving = false; v.path = null; return; }
  const ex = World.exits[a.exitIdx] || World.exits[0];
  const gone = () => { a.gone = true; v.inside = true; v.insideB = 0; v.moving = false; v.path = null; };
  if (v.phase === 'plan') {
    if (dist(v.x, v.y, ex.x + 0.5, ex.y + 0.5) < 1.2) { gone(); return; }
    const r = goTo(v, ex.x, ex.y, 0);
    if (r === 'wait') return;
    if (r === 'fail') { gone(); return; }
    v.phase = 'go';
  } else if (v.phase === 'go' && !v.path) {
    if (dist(v.x, v.y, ex.x + 0.5, ex.y + 0.5) < 1.6) gone(); else v.phase = 'plan';
  }
}
// 의뢰에서 돌아옴: 길목 칸에 놓고 다시 마을 사람으로
function unitsReturn(v) {
  const a = v.away;
  if (a && a.gone) {
    const ex = World.exits[a.exitIdx] || World.exits[0];
    const p = nearestWalkable(ex.x, ex.y, 0, 4) || ex;
    v.x = p.x + 0.5; v.y = p.y + 0.5;
  }
  delete v.away;
  v.inside = false; v.insideB = 0; v.act = null; v.phase = 'plan'; v.path = null; v.moving = false;
}
function actArrive(v) {
  if (v.phase === 'plan') {
    const p = plazaTile();
    const t = randomTileNear(p.x, p.y + 1, 3) || p;
    const r = goTo(v, t.x, t.y, 0);
    if (r === 'wait') return;
    if (r === 'fail') { v.arriving = false; return; }
    v.phase = 'go';
  } else if (v.phase === 'go' && !v.path) { v.arriving = false; say(v, ['잘 부탁드립니다', '여기가 그 마을이군', '신세 좀 지겠습니다']); }
}

// ── 싸움 ─────────────────────────────────
function isFoeOf(u, t) {
  if (!t || t.dead || t.down || t.inside) return false;
  if (u.kind === 'e') return t.kind !== 'e';
  if (t.kind !== 'e') return false;
  if (t.garrison && !(S.raid && S.raid.goal === 'uprising')) return false;
  return true;
}
function nearestEnemyOf(u, maxD) {
  let best = null, bd = maxD;
  for (const e of S.enemies) {
    if (!isFoeOf(u, e)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nearestDefender(e, maxD, civToo) {
  let best = null, bd = maxD;
  const scan = arr => {
    for (const t of arr) {
      if (t.dead || t.down || t.inside || t.leaving) continue;
      const civ = t.kind === 'v' && t.role === 'civ' && !t.hero;
      if (civ && !civToo) continue;
      const d = dist(e.x, e.y, t.x, t.y) + (civ ? 0.8 : 0);
      if (d < bd) { bd = d; best = t; }
    }
  };
  scan(S.villagers); scan(S.allies);
  return best;
}
function meleeReach(u) { return u.look.weapon === 'spear' ? 1.3 : 0.95; }
function engage(u, t, dtH, mode) {
  const d = dist(u.x, u.y, t.x, t.y);
  if (d <= meleeReach(u)) {
    u.path = null; u.moving = false;
    if (Math.abs(t.x - u.x) > 0.05) u.dir = t.x > u.x ? 1 : -1;
    if (u.cd <= 0) strike(u, t);
    return;
  }
  if (d < 2.4 && stepToward(u, t.x, t.y, dtH, mode)) { u.path = null; return; }
  u.repath -= dtH;
  if (!u.path || u.repath <= 0) {
    const r = goTo(u, Math.floor(t.x), Math.floor(t.y), mode);
    if (r !== 'wait') u.repath = 0.25 + Math.random() * 0.15;
    if (r === 'fail') u.target = 0;
  }
  moveUnit(u, dtH);
}
function strike(u, t) {
  let dmg = u.atk * rnd(0.8, 1.2);
  if (u.kind === 'v') {
    if (u.role === 'guard' && S.res.weapons >= 1) dmg *= 1.4;
    dmg *= JH.perk('atk');   // 주군·동맹·갈래 건물의 혜택
  }
  let big = false;
  u.strikes = (u.strikes || 0) + 1;
  if ((u.hero || u.leader) && u.strikes % 3 === 0) big = true;
  if (u.hero && Math.random() < 0.2) dmg *= 1.8;
  u.cd = u.hero ? 0.08 : u.leader ? 0.1 : 0.12;
  u.atkT = 0.05;
  addFx({ kind: 'slash', tx: t.x, ty: t.y, dir: u.dir || 1, dur: 0.25, big, color: u.kind === 'e' ? 'rgba(255,120,100,0.95)' : undefined });
  if (big) {
    addFx({ kind: 'ring', tx: u.x, ty: u.y, r: 30, color: u.kind === 'e' ? '#ff6a5a' : '#ffe08a', dur: 0.45 });
    const pool = u.kind === 'e' ? S.villagers.concat(S.allies) : S.enemies;
    for (const o of pool) if (o !== t && isFoeOf(u, o) && dist(u.x, u.y, o.x, o.y) < 1.7) damage(o, dmg * 0.6, u);
  }
  damage(t, dmg, u);
}
function damage(t, dmg, src) {
  if (t.dead) return;
  t.hp -= dmg;
  t.hitT = R.now;
  floatText(t.x, t.y, '-' + Math.round(dmg), t.kind === 'e' ? '#ffe08a' : '#ff7a6a');
  if (t.kind !== 'e' && !t.target && src) t.target = src.id;
  if (t.hp <= 0) killUnit(t, src);
}
function killUnit(t, src) {
  if (t.kind === 'e') {
    t.dead = true;
    if (S.raid) S.raid.killed++;
    let back = 0;
    for (const k in t.carryRes) { addRes(k, t.carryRes[k]); if (S.raid) S.raid.loot[k] = Math.max(0, (S.raid.loot[k] || 0) - t.carryRes[k]); back += t.carryRes[k]; }
    if (back > 0) floatText(t.x, t.y, '약탈품 회수', '#bfe3b0', false, 10);
    addFx({ kind: 'ring', tx: t.x, ty: t.y, r: 16, color: '#ff8a6a', dur: 0.5 });
    if (src && src.kind === 'v') {
      src.kills = (src.kills || 0) + 1;
      if (t.leader) logMsg(`${src.hero ? src.hero.epithet + ' ' : ''}${src.name}${pp(src.name, '이/가')} ${t.title}${pp(t.title, '을/를')} 쓰러뜨렸다!`, 'good');
      if (src.role === 'guard' || src.hero) src.martial = Math.min(S.martialCap + (src.hero ? 2.5 : 0), src.martial + (t.leader ? 0.25 : 0.04));
    }
    return;
  }
  if (t.kind === 'a') { t.dead = true; return; }
  // 마을 사람
  const deathP = t.hero ? 0.12 : t.role === 'guard' ? 0.3 : 0.45;
  if (Math.random() < deathP) {
    t.dead = true;
    S.stats.died++;
    logMsg(`${t.hero ? t.hero.title + ' ' : t.role === 'guard' ? '무사 ' : ''}${t.name}${pp(t.name, '이/가')} 목숨을 잃었다.`, 'bad');
    if (S.raid) S.raid.dead++;
  } else {
    t.down = true; t.downT = 6; t.hp = 0; t.path = null; t.moving = false;
    if (S.raid) S.raid.injured++;
  }
}

function fighterAI(u, dtH) {
  let t = unitById(u.target);
  if (!isFoeOf(u, t)) {
    t = nearestEnemyOf(u, 45);
    u.target = t ? t.id : 0;
    u.path = null;
  }
  if (!t) {
    const p = plazaTile();
    if (!u.path && dist(u.x, u.y, p.x + 0.5, p.y + 0.5) > 3) goTo(u, p.x, p.y + 1, 0);
    moveUnit(u, dtH);
    return;
  }
  engage(u, t, dtH, 0);
}

function updateEnemy(e, dtH) {
  if (e.dead) return;
  e.cd -= dtH;
  if (e.atkT > 0) e.atkT -= dtH;
  const raid = S.raid;
  const uprising = raid && raid.goal === 'uprising';
  if (e.garrison && !uprising) {
    // 점령군: 영주관 주변을 어슬렁거린다
    if (!e.path) {
      e.idleT = (e.idleT || 0) - dtH;
      if (e.idleT <= 0) {
        const m = getB(S.manorId);
        const c = m ? doorOf(m) : plazaTile();
        const p = randomTileNear(c.x, c.y + 1, 3.5);
        if (p && goTo(e, p.x, p.y, 0) !== 'wait') e.idleT = rnd(1, 3);
      }
    }
    moveUnit(e, dtH);
    return;
  }
  if (!raid || raid.phase === 'retreat' || e.flee) {
    if (!e.path) {
      const ex = e.exit || nearestExit(e);
      e.exit = ex;
      if (dist(e.x, e.y, ex.x + 0.5, ex.y + 0.5) < 1.2) { e.dead = true; e.escaped = true; return; }
      const r = goTo(e, ex.x, ex.y, 1);
      if (r === 'fail') { e.dead = true; e.escaped = true; return; }
    }
    moveUnit(e, dtH);
    return;
  }
  let t = unitById(e.target);
  if (!t || t.dead || t.down || t.inside) {
    t = uprising ? nearestDefender(e, 60, false) : (nearestDefender(e, 3.4, false) || nearestDefender(e, 2.4, true));
    e.target = t ? t.id : 0;
    if (t) e.path = null;
  }
  if (t) {
    if (dist(e.x, e.y, t.x, t.y) > 7 && !uprising) { e.target = 0; }
    else { engage(e, t, dtH, 1); return; }
  }
  if (uprising) { moveUnit(e, dtH); return; }
  if (e.blockB) {
    const b = getB(e.blockB);
    if (!b || b.ruined) { e.blockB = 0; e.path = null; }
    else { attackBuilding(e, b); return; }
  }
  let b = getB(e.tb);
  if (!b || b.ruined || !b.done) {
    b = chooseRaidTarget(e);
    e.tb = b ? b.id : 0;
    e.path = null;
    if (!b) { e.flee = true; return; }
  }
  if (adjacentTo(e, b)) { e.path = null; e.moving = false; attackBuilding(e, b); return; }
  if (!e.path) {
    const d = doorOf(b);
    const r = goTo(e, d.x, d.y, 1, buildingApproachGoal(b, 1));
    if (r === 'fail') { e.tb = 0; e.fails = (e.fails || 0) + 1; if (e.fails > 4) e.flee = true; }
  }
  moveUnit(e, dtH);
}
function adjacentTo(u, b) {
  const dx = Math.max(b.x - u.x, 0, u.x - (b.x + b.w));
  const dy = Math.max(b.y - u.y, 0, u.y - (b.y + b.h));
  return Math.max(dx, dy) <= 0.85;
}
function chooseRaidTarget(e) {
  const raid = S.raid;
  const manor = getB(S.manorId);
  if (raid.goal === 'occupy' && usable(manor)) return manor;
  const cands = S.buildings.filter(b => usable(b) && b.type !== 'wall' && b.type !== 'stonewall' && b.type !== 'gate');
  if (!cands.length) return null;
  const rich = { manor: 3, warehouse: 4, market: 3, inn: 3, farm: 2, house: 1.5, house2: 2, escort: 2.5, smithy: 2 };
  return weighted(cands, b => (rich[b.type] || 1) / (1 + dist(e.x, e.y, b.x + b.w / 2, b.y + b.h / 2) / 7));
}
function attackBuilding(e, b) {
  if (Math.abs(b.x + b.w / 2 - e.x) > 0.1) e.dir = (b.x + b.w / 2) > e.x ? 1 : -1;
  if (e.cd > 0) return;
  e.cd = 0.13; e.atkT = 0.05;
  const dmg = e.atk * rnd(0.8, 1.2) * (S.raid.goal === 'punish' ? 0.7 : 1);
  b.hp -= dmg; b.flash = R.now;
  addFx({ kind: 'spark', tx: e.x + e.dir * 0.25, ty: e.y, dur: 0.3 });
  if (b.hp < b.maxHp * 0.45 && b.type !== 'wall' && b.type !== 'stonewall' && S.raid.goal !== 'punish') b.burning = true;
  // 약탈
  if (S.raid.goal !== 'occupy' && !['wall', 'stonewall', 'gate', 'tower'].includes(b.type) && Math.random() < 0.55) {
    const prefs = b.type === 'farm' || b.type === 'fishery' ? ['food'] : b.type === 'lumber' ? ['wood'] : b.type === 'quarry' ? ['stone'] :
      b.type === 'smithy' ? ['weapons', 'silver'] : ['silver', 'food', 'silver', 'wood'];
    const k = pick(prefs);
    const amt = Math.min(Math.floor(S.res[k]), rndi(3, 8));
    if (amt > 0) {
      S.res[k] -= amt;
      e.carry += amt; e.carryRes[k] = (e.carryRes[k] || 0) + amt;
      S.raid.loot[k] = (S.raid.loot[k] || 0) + amt;
      floatText(b.x + b.w / 2, b.y + b.h / 2, `${RESOURCES[k].name} -${amt}`, '#ffb08a', false, 10);
      if (e.carry >= 24) { e.flee = true; e.path = null; }
    }
  }
  // 약탈만 하러 온 무리는 영주관을 끝까지 허물지 않는다. 곳간을 털고 물러간다.
  if (b.type === 'manor' && S.raid.goal !== 'occupy' && b.hp <= b.maxHp * 0.15) {
    b.hp = b.maxHp * 0.15;
    if (S.raid.phase === 'fight') {
      const k = Math.floor(S.res.silver * 0.25);
      S.res.silver -= k; S.raid.loot.silver = (S.raid.loot.silver || 0) + k;
      S.raid.phase = 'retreat';
      for (const o of S.enemies) if (!o.dead && !o.garrison) { o.flee = true; o.path = null; o.target = 0; }
      logMsg(`영주관 곳간이 털렸다. 은자 ${k}냥을 빼앗겼다.`, 'bad');
    }
    return;
  }
  if (b.hp <= 0) buildingDestroyed(b, e);
}
