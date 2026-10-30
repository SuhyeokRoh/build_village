'use strict';
// ───────────────────────────────────────────────
// 상소(上疏): 백성이 영주에게 올리는 청원
// 살림에 탈이 나면 백성이 상소를 올린다. 들어주면 민심이 오르고,
// 물리치거나 기한을 넘겨 묵혀 두면 민심이 가라앉는다.
// 상태는 S.petitions 에 순수 JSON 으로만 둔다 (docs/architecture.md 3절).
// ───────────────────────────────────────────────

Object.assign(HANJA_GLOSS, {
  '上疏函': ['상소함', '백성이 올린 상소를 모아 두는 함. 들어주면 민심이 오르고, 물리치거나 묵혀 두면 민심이 가라앉는다.'],
  '上疏': ['상소', '백성이 영주에게 올리는 글.'],
  '允': ['허락할 윤', '윤허(允許). 영주가 상소를 들어주었다.'],
  '却': ['물리칠 각', '각하(却下). 영주가 상소를 물리쳤다.'],
  '默': ['잠잠할 묵', '묵살(默殺). 기한 안에 답을 받지 못하고 묻혀 버린 상소.'],
  '成': ['이룰 성', '이루어짐. 영주가 처결하기 전에 바라던 일이 이미 이루어졌다.'],
  '訟': ['송사할 송', '송사(訟事). 이웃끼리의 다툼을 가려 달라는 일.'],
  '冤': ['원통할 원', '원통한 일. 억울함을 풀어 달라는 하소연.'],
  '寡': ['적을 과', '과부(寡婦). 지아비를 잃고 홀로 된 이.'],
  '書': ['글 서', '글과 책. 선비와 글공부에 얽힌 일.'],
});

const PET_MAX = 6;          // 한꺼번에 쌓일 수 있는 상소
const PET_DECAY_H = 120;    // 처결의 여운이 사라지는 시간 (게임 시간 5일)
const PET_HIST = 12;        // 남겨 두는 지난 처결
const PET_DEPT = { ri: '이방', ho: '호방', ye: '예방', byeong: '병방', hyeong: '형방', gong: '공방' };
const PET_DAYWORD = ['', '하루', '이틀', '사흘', '나흘', '닷새', '엿새', '이레', '여드레', '아흐레', '열흘'];
const PET_SEAL = { granted: '允', denied: '却', expired: '默', moot: '成' };
const PET_OUT = { granted: '윤허', denied: '각하', expired: '묵살', moot: '이루어짐' };
const PET_SAY_NEW = ['영주님께 아뢸 말씀이…', '상소를 올려야겠어', '이번엔 꼭 들어주셔야…'];
const PET_SAY_YES = ['영주님 은혜 감사합니다!', '역시 우리 영주님이셔!', '이 은혜를 어찌 갚을꼬'];
const PET_SAY_NO = ['이럴 수가…', '서운하구먼…', '살기 참 팍팍하네'];
const PET_LOOT = [['곡식 두 섬', 12], ['씨암탉 세 마리', 8], ['시집올 때 가져온 은비녀', 20], ['엽전 꾸러미', 15],
  ['겨우내 말린 곶감', 6], ['새로 짠 무명 한 필', 14]];
const PET_ROAD_SKIP = new Set(['manor', 'wall', 'stonewall', 'gate', 'tower', 'well']);

// ── 작은 도구들 ──────────────────────────
function petLiving(id) {
  if (!id) return null;
  const v = S.villagers.find(o => o.id === id);
  return v && !v.dead && !v.leaving ? v : null;
}
// 이미 다른 상소에 얽힌 사람 (올린 이, 송사·혼례의 상대, 무공을 청한 젊은이)
// 같은 이름이 두 상소에 함께 나오면 헷갈리니 이름도 함께 모은다
function petBusy() {
  const ids = new Set(), names = new Set();
  const add = (id, name) => { if (id) ids.add(id); if (name) names.add(name); };
  if (S.petitions) for (const p of S.petitions.list) {
    if (p.petitioner) add(p.petitioner.id, p.petitioner.name);
    if (p.data) { add(p.data.bId, p.data.b); add(p.data.vid, null); }
  }
  return { ids, names };
}
// 상소를 올릴 만한 사람 (객경·막 도착한 이·이미 상소에 얽힌 이 제외)
function petFree(filter) {
  const busy = petBusy();
  return S.villagers.filter(v => !v.dead && !v.leaving && !v.arriving && !v.hero && !v.petition
    && !busy.ids.has(v.id) && !busy.names.has(v.name) && (!filter || filter(v)));
}
function petPick(filter) { const a = petFree(filter); return a.length ? pick(a) : null; }
function petJob(v) {
  if (v.jobType && typeof JOB_NAME !== 'undefined' && JOB_NAME[v.jobType]) return JOB_NAME[v.jobType];
  return '무직';
}
function petWho(v) { return { name: v.name, id: v.id, note: `${petJob(v)} · ${v.age}세` }; }
function petGroup(name, note) { return { name, id: 0, note: note || '' }; }
function petHomeless() { let n = 0; for (const v of S.villagers) if (!v.dead && !v.leaving && !v.arriving && !v.home) n++; return n; }
function petCount(type) { let n = 0; for (const b of S.buildings) if (b.type === type && !b.ruined) n++; return n; }
function petHomes() { let n = 0; for (const b of S.buildings) if (!b.ruined && BDEF[b.type].housing) n++; return n; }
function petInjured() { return S.villagers.filter(v => !v.dead && !v.leaving && (v.down || v.hp < v.maxHp * 0.7)).length; }
function petHasDojo() { return S.buildings.some(b => usable(b) && b.type === 'dojo' && b.active); }
// 짝이 살아 있어야 지아비·지어미가 있는 것
function petHasSpouse(v) { return !!v.spouse && !!petLiving(v.spouse); }
// 이미 더 길게 걸려 있는 효과는 줄이지 않는다
function petMod(id, days) {
  const m = S.mods.find(o => o.id === id);
  if (!m || m.until < dayOf() + days) addMod(id, days);
}
function petSay(v, list, secs) {
  if (!v || !list || !list.length) return;
  v.chat = { text: pick(list), until: (typeof R !== 'undefined' ? R.now : 0) + (secs || 4) };
}
function petSurname(name) {
  if (FOLK_M.includes(name) || FOLK_F.includes(name)) return '';
  for (const s of RARE_SURNAMES) if (s.length > 1 && name.startsWith(s) && name.length > s.length) return s;
  return name.length >= 2 && (SURNAMES.includes(name[0]) || RARE_SURNAMES.includes(name[0])) ? name[0] : '';
}
function petSonName(parent) {
  const s = petSurname(parent.name);
  let n = '';
  for (let i = 0; i < 8; i++) {
    n = s ? s + pick(GIVEN_M) + (chance(0.6) ? pick(GIVEN_M) : '') : pick(FOLK_M);
    if (!S.villagers.some(v => v.name === n)) break;
  }
  return n;
}
function petDate(t) {
  const d = Math.floor(t / 24);
  return `${SEASONS[Math.floor(d / DAYS_PER_SEASON) % 4]} ${d % DAYS_PER_SEASON + 1}일`;
}
function petDue(left) {
  if (left < 6) return { t: '곧 묵살된다', urgent: true };
  if (left < 24) return { t: '기한 오늘까지', urgent: true };
  const d = Math.floor(left / 24);
  return { t: `기한 ${PET_DAYWORD[d] || d + '일'} 남음`, urgent: false };
}
function petWhere(b) {
  const m = getB(S.manorId);
  if (!m || !b) return '마을에';
  const d = dist(b.x + b.w / 2, b.y + b.h / 2, m.x + m.w / 2, m.y + m.h / 2);
  return d < 7 ? '영주관 가까이에' : d < 13 ? '영주관에서 조금 떨어진 곳에' : '마을 변두리에';
}
// 상소를 올린 사람이 한가하면 영주관 앞으로 걸어간다
function petWalkToManor(v) {
  if (!v || v.inside || v.down || S.raid || !(v.act === 'idle' || v.act === 'leisure')) return;
  const m = getB(S.manorId);
  if (!usable(m)) return;
  const d = doorOf(m);
  if (goTo(v, d.x, d.y, 0, buildingApproachGoal(m)) === 'ok') { v.phase = 'go'; v.wt = null; }
}

// ── 육방(Admin)과의 연결: 실제 모듈이 없으면 조용히 물러선다 ──
function petAdminReal() { return typeof Admin !== 'undefined' && typeof Admin.fund === 'function' && typeof Admin.spendFund === 'function'; }
function petFund(id) { const f = Number(hook(Admin, 'fund', id)); return Number.isFinite(f) ? f : 0; }
function petSpend(id, n) {
  if (petFund(id) < n) return false;
  return hook(Admin, 'spendFund', id, n) !== false;
}
// 부서에 맡기기: 그 부서 예산에서 은자를 쓰고, 곳간은 건드리지 않는다
function petDept(id, n, sub, run, opt = {}) {
  if (!petAdminReal() || petFund(id) <= 0) return null;
  return {
    id: 'dept', kind: 'grant', dept: id, mood: opt.mood,
    label: opt.label || `${PET_DEPT[id]}에 맡긴다`,
    sub: `${PET_DEPT[id]} 예산 은자 ${n}${sub ? ' · ' + sub : ''}`,
    ok: () => petFund(id) >= n && (!opt.ok || opt.ok()),
    run: p => {
      if (!petSpend(id, n)) return { fail: `${PET_DEPT[id]} 예산이 모자라다` };
      return run(p);
    },
  };
}

// ── 건설: 육방에 시키고, 없거나 실패하면 스스로 터를 찾는다 ──
function petBuildCost(type) { const c = BDEF[type].cost; return (c.silver || 0) + (c.wood || 0) + (c.stone || 0); }
function petSiteOk(type, x, y) { const r = canPlace(type, x, y); return r.ok || !!r.poor; }
function petRingFree(x, y, w, h) {
  for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
    if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
    if (!World.inb(xx, yy) || World.occ[yy * MW + xx]) return false;
  }
  return true;
}
function petNear(type) {
  const m = getB(S.manorId);
  const c = m ? { x: m.x + m.w / 2, y: m.y + m.h / 2 } : { x: World.center.x, y: World.center.y };
  if (type === 'house' || type === 'well') {
    // 집과 우물은 사람 사는 곳 가까이
    const hs = S.buildings.filter(b => !b.ruined && b.type !== 'manor' && BDEF[b.type].housing);
    if (hs.length) {
      let sx = 0, sy = 0;
      for (const b of hs) { sx += b.x + b.w / 2; sy += b.y + b.h / 2; }
      return { x: (sx / hs.length + c.x) / 2, y: (sy / hs.length + c.y) / 2 };
    }
  }
  return c;
}
function petFindSite(type) {
  const def = BDEF[type];
  const c = petNear(type);
  const plaza = plazaTile();
  const m = getB(S.manorId);
  const mx = m ? m.x + m.w / 2 : c.x, my = m ? m.y + m.h / 2 : c.y;
  const rad = 18;
  let best = null, bs = Infinity;
  for (let y = Math.max(1, Math.floor(c.y - rad)); y <= Math.min(MH - 2, Math.ceil(c.y + rad)); y++) {
    for (let x = Math.max(1, Math.floor(c.x - rad)); x <= Math.min(MW - 2, Math.ceil(c.x + rad)); x++) {
      const cx = x + def.w / 2, cy = y + def.h / 2;
      const d = Math.hypot(cx - c.x, cy - c.y);
      if (d > rad || d >= bs) continue;
      if (!petSiteOk(type, x, y) || !petRingFree(x, y, def.w, def.h)) continue;
      if (!def.walkRows && !walkable(x + Math.floor(def.w / 2), y + def.h)) continue;
      let forest = 0;
      for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) if (World.tile(xx, yy) === T.FOREST) forest++;
      // 영주관 앞마당은 비워 두고, 등각 화면에서 영주관 뒤에 가려지는 자리는 피한다
      const back = (cx + cy) - (mx + my), side = (cx - cy) - (mx - my);
      const hidden = back < 0 && back > -9 && Math.abs(side) < 5 ? 8 : 0;
      const s = d + forest * 0.6 + Math.random() * 1.2 + hidden + (Math.hypot(cx - plaza.x - 0.5, cy - plaza.y - 0.5) < 3.2 ? 6 : 0);
      if (s < bs) { bs = s; best = { x, y }; }
    }
  }
  return best;
}
function petAdminSite(type) {
  const s = hook(Admin, 'findSite', type);
  return s && Number.isFinite(s.x) && Number.isFinite(s.y) && petSiteOk(type, s.x, s.y) ? { x: s.x, y: s.y } : null;
}
function petBuild(type, dept) {
  const def = BDEF[type];
  if (def.rank && S.rank < def.rank) return { ok: false, why: `마을이 ${RANKS[def.rank].name} 이상이어야 한다` };
  if (dept) {
    const n = petBuildCost(type);
    const site = petAdminSite(type) || petFindSite(type);
    if (!site) return { ok: false, why: '지을 만한 빈 터가 없다' };
    if (!petSpend(dept, n)) return { ok: false, why: `${PET_DEPT[dept]} 예산이 모자라다` };
    const b = placeBuilding(type, site.x, site.y, false);
    Bus.emit('placed', b);
    return { ok: true, b };
  }
  if (!canAfford(def.cost)) return { ok: false, why: '재료가 모자라다' };
  // 길 값은 단추에 적히지 않으니 깔지 않는다 (공방이 나중에 잇는다)
  const r = hook(Admin, 'orderBuild', type, { reason: '상소', road: false });
  if (r && r.ok && r.b) return { ok: true, b: r.b };
  const site = petFindSite(type);
  if (!site) return { ok: false, why: (r && r.why) || '지을 만한 빈 터가 없다' };
  const t = tryBuild(type, site.x, site.y);
  return t.ok ? { ok: true, b: t.b } : { ok: false, why: t.why || '지을 수 없다' };
}
function petBuildChoice(type, label, effect, textFn, mood) {
  const def = BDEF[type];
  const rankOk = !def.rank || S.rank >= def.rank;
  return {
    id: 'build', kind: 'grant', label, mood,
    sub: rankOk ? `${costText(def.cost)}${effect ? ' · ' + effect : ''}` : `마을이 ${RANKS[def.rank].name} 이상이어야 한다`,
    ok: () => rankOk && canAfford(def.cost),
    run: () => {
      const r = petBuild(type);
      if (!r.ok) return { fail: r.why };
      return { text: textFn(r.b), b: r.b };
    },
  };
}
function petDeptBuild(type, textFn, mood) {
  if (!petAdminReal() || petFund('gong') <= 0) return null;
  const def = BDEF[type];
  const n = petBuildCost(type);
  const rankOk = !def.rank || S.rank >= def.rank;
  return {
    id: 'dept', kind: 'grant', dept: 'gong', label: '공방에 맡긴다', mood,
    sub: rankOk ? `공방 예산 은자 ${n} · 곳간은 그대로` : `마을이 ${RANKS[def.rank].name} 이상이어야 한다`,
    ok: () => rankOk && petFund('gong') >= n,
    run: () => {
      const r = petBuild(type, 'gong');
      if (!r.ok) return { fail: r.why };
      return { text: textFn(r.b), b: r.b };
    },
  };
}

// ── 길: 길과 떨어진 건물에서 가장 가까운 길까지 ──
function petRing(b) {
  const out = [];
  for (let y = b.y - 1; y <= b.y + b.h; y++) for (let x = b.x - 1; x <= b.x + b.w; x++) {
    if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) continue;
    if (World.inb(x, y)) out.push([x, y]);
  }
  return out;
}
function petConnected(b) { return petRing(b).some(([x, y]) => World.isRoad(x, y)); }
function petRoadCands(strict) {
  return S.buildings.filter(b => {
    if (!usable(b) || PET_ROAD_SKIP.has(b.type)) return false;
    if (strict && !((b._workers && b._workers.length) || (b._residents && b._residents.length))) return false;
    return !petConnected(b);
  });
}
function petRoadPlan(b) {
  if (!b) return null;
  const N = MW * MH, MAXC = 40;
  let anyRoad = false;
  for (let i = 0; i < N; i++) if (World.road[i]) { anyRoad = true; break; }
  const m = getB(S.manorId);
  const tgt = !anyRoad && m && m !== b ? doorOf(m) : null;
  if (!anyRoad && !tgt) return null;
  const goal = (x, y) => (anyRoad ? World.isRoad(x, y) : x === tgt.x && y === tgt.y);
  const ok = (x, y) => World.inb(x, y) && !World.occ[y * MW + x] && World.tile(x, y) !== T.ROCK;
  const step = (x, y) => { const t = World.tile(x, y); return t === T.WATER ? 5 : t === T.FOREST ? 2 : 1; };
  const ring = petRing(b);
  if (ring.some(([x, y]) => goal(x, y))) return { tiles: [], silver: 0, wood: 0 };
  const cost = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const buckets = [];
  const push = (i, c) => { (buckets[c] || (buckets[c] = [])).push(i); };
  for (const [x, y] of ring) {
    if (!ok(x, y)) continue;
    const i = y * MW + x, c = step(x, y);
    if (c < cost[i]) { cost[i] = c; push(i, c); }
  }
  for (let c = 0; c <= MAXC; c++) {
    const bk = buckets[c];
    if (!bk) continue;
    for (let k = 0; k < bk.length; k++) {
      const i = bk[k];
      if (cost[i] < c) continue;
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!World.inb(nx, ny)) continue;
        if (goal(nx, ny)) {
          const tiles = [];
          if (!anyRoad) tiles.push({ x: nx, y: ny });
          for (let j = i; j >= 0; j = prev[j]) tiles.push({ x: j % MW, y: (j / MW) | 0 });
          let silver = 0, wood = 0;
          for (const t of tiles) { if (World.tile(t.x, t.y) === T.WATER) wood += 6; else silver += 1; }
          return { tiles, silver, wood };
        }
        if (!ok(nx, ny)) continue;
        const ni = ny * MW + nx, nc = c + step(nx, ny);
        if (nc < cost[ni] && nc <= MAXC) { cost[ni] = nc; prev[ni] = i; push(ni, nc); }
      }
    }
  }
  return null;
}
function petLayRoad(plan, free) {
  let n = 0;
  for (const t of plan.tiles) {
    if (World.isRoad(t.x, t.y)) continue;
    if (free) {
      if (World.occ[t.y * MW + t.x] || World.tile(t.x, t.y) === T.ROCK) continue;
      setRoad(t.x, t.y, true);
      Bus.emit('road', t.x, t.y);
      n++;
    } else if (setRoad(t.x, t.y)) n++;
  }
  return n;
}

// 무관에 들인다: 하던 일을 놓고 무관으로, 재능과 무공이 오른다
function petAdmitDojo(v, dTalent, dMartial) {
  v.talent = Math.min(1.9, (v.talent || 1) + dTalent);
  v.martial = Math.min(S.martialCap, (v.martial || 0) + dMartial);
  const cap = BDEF.dojo.workers;
  const dojos = S.buildings.filter(b => usable(b) && b.type === 'dojo' && b.active)
    .map(b => ({ b, ws: S.villagers.filter(o => !o.dead && o !== v && o.job === b.id) }))
    .sort((a, b) => a.ws.length - b.ws.length);
  const d = dojos[0];
  if (d) {
    if (d.ws.length >= cap) {
      // 자리가 차 있으면 가장 무공이 낮은 이가 다른 일로 옮긴다
      const weak = d.ws.sort((a, b) => a.martial - b.martial)[0];
      weak.job = 0; weak.act = null;
      d.ws.splice(d.ws.indexOf(weak), 1);
    }
    d.b.want = Math.min(cap, Math.max(d.b.want || 0, d.ws.length + 1));
    v.job = d.b.id; v.act = null;
  }
  updateStats(v);
  markDirty();
  return !!d;
}
function petNewcomer(name, opts) {
  const m = getB(S.manorId);
  const d = m ? doorOf(m) : plazaTile();
  const v = newVillager(Object.assign({ name, x: d.x + 0.5, y: d.y + 0.5 }, opts || {}));
  markDirty();
  return v;
}
function petFestName() {
  const s = seasonIdx(), d = dayOf() % DAYS_PER_SEASON;
  if (s === 0 && d <= 3) return '단오';
  if (s === 2 && d >= 4) return '한가위';
  if (s === 3 && d >= 6) return '설';
  return null;
}
const petYouth = v => v.age >= 14 && v.age <= 26 && v.role === 'civ' && v.jobType !== 'dojo' && (v.martial || 0) < 1.2;
const petSingle = sex => v => v.sex === sex && v.age >= 18 && v.age <= 34 && !petHasSpouse(v);

// ───────────────────────────────────────────────
// 상소의 종류
// cond(): 지금 이런 상소가 올 만한가 / weight(): 얼마나 급한가
// make(p, o): 올린 사람·제목·글·자료를 채운다 (false 면 만들지 못함)
// choices(p): [{ id, kind: 'grant'|'deny', label, sub, ok(), run(p) → 글 | { text, b, mood, fail, outcome } }]
//   outcome: kind 와 달리 끝났을 때 ('denied' 등)
// moot(p): 영주가 따로 처결하기 전에 바라던 일이 이루어졌는가 / withdraw(p): 얽힌 사람·건물이 사라졌는가
// ───────────────────────────────────────────────
const PET_TYPES = {
  housing: {
    name: '집', hanja: '家', tip: '집을 지어 달라는 상소. 집이 모자라면 새 식구도 오지 않는다.', cd: 2, days: [2, 3],
    say: ['잘 곳이 없어…', '집 한 칸만 있으면…'],
    cond: () => petHomeless() > 0 || (popCount() >= 6 && housingTotal() <= popCount()),
    weight: () => 0.8 + Math.min(3, petHomeless() * 0.5),
    make(p) {
      const v = petPick(x => !x.home && x.age >= 16) || petPick(x => x.age >= 18);
      p.petitioner = v ? petWho(v) : petGroup('마을 사람들', '이웃들');
      p.data.homes = petHomes();
      const n = p.petitioner.name;
      if (petHomeless() > 0 || (v && !v.home)) {
        p.title = '몸 누일 집 한 칸을';
        p.text = `영주님, 소인 ${n}${pp(n, '은/는')} 이 마을에 와서 여태 남의 처마 밑에서 잠을 청하고 있습니다. 밤이슬에 식구들이 콜록거려 차마 볼 수가 없습니다. 초가 한 채만 지어 주십시오.`;
      } else {
        p.title = '집이 비좁아 숨이 막힙니다';
        p.text = '한 지붕 아래 식구가 너무 많아 다리도 못 펴고 잡니다. 함께 살겠다고 찾아온 친척들도 묵을 데가 없어 발길을 돌렸습니다. 집을 더 지어 주시면 마을도 그만큼 커질 것입니다.';
      }
      return true;
    },
    moot: p => petHomes() > p.data.homes,
    choices(p) {
      const who = p.petitioner.name;
      return [
        petBuildChoice('house', '초가를 지어 준다', '다섯 식구가 살 집',
          b => `${petWhere(b)} 초가 터를 닦기 시작했다. ${who}${pp(who, '이/가')} 연신 머리를 조아린다.`),
        petDeptBuild('house', b => `공방 목수들이 ${petWhere(b)} 초가를 올리기 시작했다.`),
        { id: 'deny', kind: 'deny', label: '지금은 지어 줄 여력이 없다', sub: '민심 조금 하락',
          run: () => `${who}${pp(who, '은/는')} 힘없이 고개를 끄덕이고 물러갔다.` },
      ];
    },
  },

  hunger: {
    name: '굶주림', hanja: '食', tip: '먹을 것이 모자라다는 상소. 굶주림은 민심을 가장 크게 무너뜨린다.', cd: 2, days: [2, 3], expireMood: -4,
    say: ['배가 고파 못 살겠소', '곳간이 비었어…'],
    cond: () => { const pop = popCount(); return pop > 0 && (S.res.food < pop * 3 || S.starving > 0); },
    weight: () => (S.res.food <= 0 ? 5 : 1.5 + 2 * clamp(1 - S.res.food / Math.max(1, popCount() * 3), 0, 1)),
    make(p) {
      const v = petPick(x => x.age >= 20);
      p.petitioner = v && chance(0.6) ? petWho(v) : petGroup('농민들', '마을의 농사꾼들');
      const pop = Math.max(1, popCount());
      p.data.food = Math.floor(S.res.food);
      p.data.amt = clamp(Math.round(pop * 4 / 5) * 5, 20, 200);
      p.data.cost = Math.round(p.data.amt * 0.8);
      if (S.res.food <= pop) {
        p.title = '굶어 죽게 생겼습니다';
        p.text = '영주님, 사흘째 멀건 죽 한 그릇으로 버티고 있습니다. 아이들이 배고프다고 울다 지쳐 잠듭니다. 곳간을 풀든 곡식을 사 오든, 제발 살길을 열어 주십시오.';
      } else {
        p.title = '곳간이 비어 갑니다';
        p.text = '거둔 곡식으로는 이달을 넘기기도 빠듯합니다. 장에 가도 쌀값이 금값이라 엄두가 안 납니다. 곡식을 좀 풀어 주시거나 논밭을 더 일궈 주십시오.';
      }
      return true;
    },
    moot: p => S.res.food >= Math.max(popCount() * 7, p.data.food + popCount() * 3),
    choices(p) {
      const { amt, cost } = p.data;
      return [
        { id: 'buy', kind: 'grant', label: '은자로 곡식을 사들인다', sub: `은자 ${cost} · 식량 +${amt}`, ok: () => S.res.silver >= cost,
          run: () => { S.res.silver -= cost; addRes('food', amt); return '금룡상회 배에서 쌀섬이 내려졌다. 오랜만에 집집마다 밥 짓는 연기가 오른다.'; } },
        petBuildChoice('farm', '논밭을 새로 일군다', '일꾼 셋이 곡식을 기른다',
          b => `${petWhere(b)} 새 논밭을 일구기 시작했다. 당장 배는 고파도 사람들 눈에 희망이 돈다.`, 2),
        petDept('ho', cost, `식량 +${amt}`, () => { addRes('food', amt); return '호방 아전들이 이웃 고을에서 곡식을 사 와 집집마다 나누어 주었다.'; }),
        { id: 'deny', kind: 'deny', label: '허리띠를 졸라매라 한다', sub: '민심 하락', mood: -3,
          run: () => '「다들 허리띠를 졸라매라.」 사람들은 대꾸도 없이 돌아섰다. 마을에 원망이 번진다.' },
      ];
    },
  },

  tax_relief: {
    name: '세금', hanja: '稅', tip: '세금을 덜어 달라는 상소.', cd: 4, days: [2, 4],
    say: ['세금이 너무 무거워', '살림이 말이 아니야'],
    cond: () => (S.tax >= 1 && S.happy < 48) || (S.tax === 2 && S.happy < 62),
    weight: () => 0.8 + S.tax * 0.6 + (S.happy < 40 ? 1 : 0),
    make(p) {
      const v = petPick(x => x.age >= 40);
      p.petitioner = v && chance(0.5) ? petWho(v) : petGroup('마을 어른들', '나이 지긋한 이들');
      p.data.tax = S.tax;
      p.data.n = Math.max(10, Math.round(popCount() * 1.5));
      p.title = '세금을 덜어 주십시오';
      p.text = S.tax >= 2
        ? '영주님, 올해 세금이 지난해의 갑절입니다. 장리 빚을 얻어 세금을 내고 나니 씨앗 살 돈도 남지 않았습니다. 이대로 가면 고향을 등지는 집이 나올 것입니다.'
        : '흉흉한 세월에 세금까지 무거우니 살림이 말이 아닙니다. 올 한 해만이라도 짐을 덜어 주시면 그 은혜를 잊지 않겠습니다.';
      return true;
    },
    moot: p => S.tax < p.data.tax,
    choices(p) {
      const n = p.data.n;
      return [
        { id: 'lower', kind: 'grant', label: '세율을 한 단계 낮춘다', mood: 3,
          sub: S.tax > 0 ? `세율 ${['낮게', '보통'][S.tax - 1]} · 날마다 들어오는 세금이 준다` : '이미 가장 낮다', ok: () => S.tax > 0,
          run: () => { S.tax = Math.max(0, S.tax - 1); return '세율을 낮춘다는 방이 붙자 장터에 모처럼 웃음소리가 났다.'; } },
        { id: 'remit', kind: 'grant', label: '이번 세금을 돌려준다', sub: `은자 ${n} · 세율은 그대로`, ok: () => S.res.silver >= n,
          run: () => { S.res.silver -= n; return '거둔 세금의 일부를 집집마다 돌려주었다. 당장의 숨통은 트였다.'; } },
        petDept('ho', n, '어려운 집 세금을 대신 메운다', () => '호방이 장부를 뒤져 형편이 어려운 집의 세금을 예산으로 메워 주었다.'),
        { id: 'deny', kind: 'deny', label: '나라 살림이 먼저다', sub: '민심 하락', mood: -2.5,
          run: () => { const w = p.petitioner.name; return `${w}${pp(w, '은/는')} 말없이 물러갔다. 등 뒤로 한숨 소리가 길게 이어졌다.`; } },
      ];
    },
  },

  well: {
    name: '우물', hanja: '井', tip: '우물을 파 달라는 상소. 우물은 민심을 올리고 불을 끄는 물이 된다.', cd: 3, days: [2, 4],
    say: ['물 긷기가 너무 멀어', '우물이 하나뿐이니…'],
    cond: () => { const pop = popCount(); return pop >= 6 && petCount('well') * 12 < pop; },
    weight: () => 0.9 + Math.max(0, popCount() - petCount('well') * 12) / 12,
    make(p) {
      const v = petPick(x => x.age >= 18 && x.sex === 'f') || petPick(x => x.age >= 18);
      p.petitioner = v ? petWho(v) : petGroup('아낙들', '물동이를 이는 이들');
      const w = petCount('well');
      p.data.wells = w;
      p.title = w ? '우물을 하나 더 파 주십시오' : '마을에 우물을 파 주십시오';
      p.text = w === 0
        ? '마을에 우물이 없어 아낙들이 새벽마다 강까지 물을 길러 다닙니다. 물동이를 이고 오가다 보면 해가 중천입니다. 가까운 곳에 우물 하나만 파 주십시오.'
        : w === 1
          ? '우물 하나에 온 마을이 매달리니 새벽마다 물동이 줄이 동구 밖까지 늘어섭니다. 가뭄이라도 들면 큰일이고, 불이라도 나면 끌 물도 모자랍니다. 우물을 하나 더 파 주십시오.'
          : '식구는 느는데 우물은 그대로라 물 한 동이 길어 오는 데 반나절이 걸립니다. 집 가까이에 우물을 하나 더 파 주시면 아이들 씻길 물 걱정은 덜겠습니다.';
      return true;
    },
    moot: p => petCount('well') > p.data.wells,
    choices(p) {
      const who = p.petitioner.name;
      return [
        petBuildChoice('well', '우물을 판다', '민심 조금 상승 · 불을 빨리 끈다',
          b => `${petWhere(b)} 우물 자리를 잡고 땅을 파기 시작했다. ${who}${pp(who, '이/가')} 물동이를 끌어안고 웃는다.`),
        petDeptBuild('well', b => `공방 인부들이 ${petWhere(b)} 우물을 파기 시작했다.`),
        { id: 'deny', kind: 'deny', label: '물은 강에서 길어 오라 한다', sub: '민심 조금 하락',
          run: () => `${who}${pp(who, '은/는')} 빈 물동이를 들고 터덜터덜 강 쪽으로 걸어갔다.` },
      ];
    },
  },

  road: {
    name: '길', hanja: '道', tip: '길을 내 달라는 상소. 길 위에서는 사람들이 더 빨리 다닌다.', cd: 3, days: [3, 4], expireMood: -2,
    say: ['길이 없어 진창이야', '비만 오면 발이 빠져'],
    cond: () => petRoadCands(true).length > 0,
    weight: () => 0.7,
    make(p, o) {
      let cands = o.bid ? [getB(o.bid)].filter(b => usable(b)) : shuffle(petRoadCands(true));
      if (!cands.length && p.scripted) cands = shuffle(petRoadCands(false));
      for (const b of cands.slice(0, 6)) {
        const plan = petRoadPlan(b);
        if (!plan || !plan.tiles.length || plan.tiles.length > 16) continue;
        const ws = (b._workers || []).concat(b._residents || []).filter(v => !v.petition && !v.hero && !v.dead && !v.leaving && !v.arriving);
        const v = ws.length ? pick(ws) : petPick(x => x.age >= 18);
        p.petitioner = v ? petWho(v) : petGroup('마을 사람들', '');
        p.data.bid = b.id;
        const bn = BDEF[b.type].name;
        p.title = `${bn}까지 길을 내 주십시오`;
        p.text = BDEF[b.type].housing
          ? `저희 ${bn} 앞으로는 길이 없어 비만 오면 마당까지 진흙탕이 됩니다. 장에 가려 해도 풀숲을 헤치고 돌아가야 합니다. 큰길까지 길 한 줄만 깔아 주십시오.`
          : `${bn}에서 일하는 사람들은 짐을 지고 풀숲과 진창을 헤치며 오갑니다. 하루 일의 절반이 걸음입니다. 큰길까지 길 한 줄만 깔아 주시면 일이 훨씬 수월하겠습니다.`;
        return true;
      }
      return false;
    },
    // 건물이 무너지거나 헐리면 바람이 이루어진 것이 아니라 상소가 거두어진 것
    withdraw: p => !usable(getB(p.data.bid)),
    moot: p => { const b = getB(p.data.bid); return !!b && petConnected(b); },
    choices(p) {
      const b = getB(p.data.bid);
      const bn = b ? BDEF[b.type].name : '그곳';
      const plan = Petitions.planFor(p);
      const cost = plan ? { silver: plan.silver, wood: plan.wood } : null;
      const done = n => `${n ? `길 ${n}칸을 깔아 ` : '길을 깔아 '}${bn}${pp(bn, '과/와')} 큰길을 이었다. 사람들 발걸음이 한결 가벼워진다.`;
      const out = [
        { id: 'build', kind: 'grant', label: '길을 깔아 준다', sub: plan ? `${costText(cost)} · 길 ${plan.tiles.length}칸` : '길을 낼 수 없다',
          ok: () => !!plan && canAfford(cost),
          run: () => {
            const bb = getB(p.data.bid);
            if (!usable(bb)) return { fail: '그 건물은 이제 쓸 수 없다' };
            // 단추에 적힌 그 길을 깔고 그 값만 낸다 (영주관 쪽 큰길과는 공방이 나중에 잇는다)
            const pl = petRoadPlan(bb);
            if (!pl) return { fail: '길을 낼 수 있는 곳이 없다' };
            if (!canAfford({ silver: pl.silver, wood: pl.wood })) return { fail: '재료가 모자라다' };
            return { text: done(petLayRoad(pl, false)), b: bb };
          } },
      ];
      if (plan && petAdminReal() && petFund('gong') > 0) {
        const n = plan.silver + plan.wood;
        out.push({ id: 'dept', kind: 'grant', dept: 'gong', label: '공방에 맡긴다', sub: `공방 예산 은자 ${n} · 곳간은 그대로`,
          ok: () => petFund('gong') >= n,
          run: () => {
            const bb = getB(p.data.bid);
            const pl = usable(bb) ? petRoadPlan(bb) : null;
            if (!pl) return { fail: '길을 낼 수 있는 곳이 없다' };
            if (!petSpend('gong', pl.silver + pl.wood)) return { fail: '공방 예산이 모자라다' };
            return { text: `공방 인부들이 ${done(petLayRoad(pl, true))}`, b: bb };
          } });
      }
      out.push({ id: 'deny', kind: 'deny', label: '알아서 다니라 한다', sub: '민심 조금 하락', mood: -1.5,
        run: () => '사람들은 오늘도 바짓가랑이를 걷어 올리고 진창을 건넌다.' });
      return out;
    },
  },

  dispute: {
    name: '송사', hanja: '訟', tip: '이웃끼리의 다툼을 가려 달라는 상소. 소문을 잘 읽고 판결하라.', cd: 2, days: [2, 3], expireMood: -2,
    say: ['억울해서 못 살겠소', '영주님께 가려 달라 해야지'],
    cond: () => petFree(v => v.age >= 18).length >= 4,
    weight: () => 0.8,
    make(p) {
      const pool = shuffle(petFree(v => v.age >= 18));
      const A = pool[0] || null, B = pool[1] || null;
      p.petitioner = A ? petWho(A) : petGroup(makeName('m'), '마을 사람');
      p.data.bId = B ? B.id : 0;
      p.data.b = B ? B.name : makeName(chance(0.5) ? 'm' : 'f');
      p.data.kind = pick(['land', 'ox', 'heir']);
      p.data.right = chance(0.5) ? 'a' : 'b';
      const a = p.petitioner.name, b = p.data.b, ra = p.data.right === 'a';
      if (p.data.kind === 'land') {
        p.title = '논두렁 경계를 가려 주십시오';
        p.text = `${a}${pp(a, '이/가')} 아뢰옵니다. 이웃 ${b}${pp(b, '이/가')} 밤사이 논두렁을 제 쪽으로 한 자나 밀어 놓았습니다. ${b}${pp(b, '은/는')} 본디 그 자리라고 우기니, 영주님께서 옳고 그름을 가려 주십시오.`;
        p.data.hint = ra ? '마을 노인들은 지난 장마 뒤에 경계석이 옮겨진 것을 보았다고 수군거린다.' : `${b}의 손에는 관인이 찍힌 오래된 땅문서가 있다.`;
      } else if (p.data.kind === 'ox') {
        p.title = '빌려 간 소가 다리를 절며 왔습니다';
        p.text = `${a}${pp(a, '이/가')} 아뢰옵니다. ${b}에게 빌려준 소가 다리를 절며 돌아왔습니다. 그 소 한 마리가 저희 집 살림 밑천인데, ${b}${pp(b, '은/는')} 소가 늙어서 그런 것이라며 한 푼도 물어 줄 수 없다 합니다.`;
        p.data.hint = ra ? `${b}${pp(b, '이/가')} 그 소에게 이틀 밤낮 쟁기를 끌렸다는 말이 돈다.` : '그 소는 열다섯 해를 넘긴 늙은 소였다고 한다.';
      } else {
        const old = makeName('m');
        p.title = '돌아가신 노인의 밭을 두고';
        p.text = `${a}${pp(a, '이/가')} 아뢰옵니다. 지난겨울 돌아가신 ${old} 노인께서 생전에 병수발을 든 제게 밭 한 뙈기를 물려주마 하셨습니다. 그런데 먼 친척이라는 ${b}${pp(b, '이/가')} 나타나 그 밭이 제 몫이라 합니다.`;
        p.data.hint = ra ? '노인이 그리 말하는 것을 들었다는 이웃이 여럿 있다.' : `${b}의 품에는 노인이 손수 쓴 유언장이 있다.`;
      }
      p.data.hint = '마을의 소문: ' + p.data.hint;
      if (B) petSay(B, ['억울하오!', '내가 옳소!'], 4);
      return true;
    },
    withdraw: p => !!p.data.bId && !petLiving(p.data.bId),
    choices(p) {
      const a = p.petitioner.name, b = p.data.b;
      const judge = side => () => {
        const lose = side === 'a' ? b : a;
        if (p.data.right === side) {
          addFame(1);
          return { text: `${lose}${pp(lose, '은/는')} 군말 없이 물러났다. 영주의 판결이 공정하다는 칭송이 마을에 돈다. 명성 +1.`, mood: 3 };
        }
        return { text: `${lose}${pp(lose, '은/는')} 억울하다며 땅을 쳤다. 판결을 두고 마을 사람들 사이에 뒷말이 돈다.`, mood: 0.5 };
      };
      return [
        { id: 'judgeA', kind: 'grant', label: `${a}의 손을 들어준다`, sub: '옳게 가리면 칭송, 그르치면 뒷말', run: judge('a') },
        { id: 'judgeB', kind: 'grant', label: `${b}의 손을 들어준다`, sub: '옳게 가리면 칭송, 그르치면 뒷말', run: judge('b') },
        { id: 'reconcile', kind: 'grant', label: '은자를 보태 화해시킨다', sub: '은자 15 · 두 집안이 화해한다', mood: 2, ok: () => S.res.silver >= 15,
          run: () => { S.res.silver -= 15; return `영주가 은자를 보태 서로 한 걸음씩 물러서게 했다. ${a}${pp(a, '과/와')} ${b}${pp(b, '이/가')} 막걸리 한 사발로 앙금을 풀었다.`; } },
        petDept('hyeong', 10, '반드시 옳게 가린다', () => {
          const w = p.data.right === 'a' ? a : b;
          addFame(1);
          return `형방 아전이 증인을 불러 모아 꼼꼼히 따진 끝에 ${w}의 손을 들어주었다. 두 사람 모두 판결에 승복했다. 명성 +1.`;
        }, { mood: 3, label: '형방에 맡겨 따지게 한다' }),
        { id: 'deny', kind: 'deny', label: '집안일은 집안에서 풀라 한다', sub: '민심 조금 하락', mood: -1.5,
          run: () => '두 사람은 영주관을 나서자마자 또 멱살을 잡았다.' },
      ];
    },
  },

  thief: {
    name: '도둑', hanja: '賊', tip: '밤도둑을 잡아 달라는 상소.', cd: 3, days: [2, 3],
    say: ['도둑이 들었어!', '간밤에 다 털렸소'],
    cond: () => { const h = hourOf(); return popCount() >= 15 && h >= 5 && h <= 11 && !hasMod('pet_watch'); },
    weight: () => 1 + (fighters().length ? 0 : 0.5),
    make(p) {
      const v = petPick(x => x.age >= 18);
      p.petitioner = v ? petWho(v) : petGroup(makeName('m'), '마을 사람');
      const it = pick(PET_LOOT);
      p.data.item = it[0]; p.data.val = it[1];
      p.title = '밤도둑을 잡아 주십시오';
      p.text = `영주님, 간밤에 누가 담을 넘어 ${it[0]}${pp(it[0], '을/를')} 훔쳐 갔습니다. 개도 짖지 않은 걸 보면 솜씨 좋은 좀도둑입니다. 이대로 두면 다음은 이웃집 차례일 것입니다.`;
      return true;
    },
    choices(p) {
      const it = p.data.item, val = p.data.val, who = p.petitioner.name;
      const nf = fighters().length;
      return [
        { id: 'catch', kind: 'grant', label: '무사들을 풀어 도둑을 쫓는다', sub: nf ? `무사 ${nf}명 · 잡으면 물건을 되찾는다` : '무사가 없다',
          ok: () => fighters().length > 0,
          run: () => {
            if (chance(Math.min(0.85, 0.4 + fighters().length * 0.1))) {
              addFame(1);
              return { text: `무사들이 산기슭 움막에서 도둑을 붙잡았다. ${it}${pp(it, '은/는')} 주인에게 돌아갔다. 명성 +1.`, mood: 3 };
            }
            return { text: '밤새 산을 뒤졌지만 도둑은 이미 고개를 넘은 뒤였다. 애쓴 것만은 모두가 안다.', mood: 1.5 };
          } },
        { id: 'watch', kind: 'grant', label: '야경을 늘린다', sub: '은자 20 · 닷새간 민심 +2 · 도둑이 줄어든다', ok: () => S.res.silver >= 20,
          run: () => { S.res.silver -= 20; addMod('pet_watch', 5); return '횃불을 든 야경꾼이 밤마다 골목을 돈다. 사람들이 한결 마음 놓고 잠든다.'; } },
        { id: 'repay', kind: 'grant', label: '잃은 것을 물어 준다', sub: `은자 ${val}`, mood: 2, ok: () => S.res.silver >= val,
          run: () => { S.res.silver -= val; return `${who}${pp(who, '은/는')} 영주가 내린 은자를 받아 들고 몇 번이고 고개를 숙였다.`; } },
        petDept('hyeong', 15, '도둑을 반드시 잡는다', () => {
          addFame(1);
          return `형방 포졸들이 장물아비를 뒤쫓아 도둑을 잡아들였다. ${it}${pp(it, '은/는')} 주인에게 돌아갔다. 명성 +1.`;
        }, { mood: 3 }),
        { id: 'deny', kind: 'deny', label: '단속을 잘하라 이른다', sub: '민심 하락',
          run: () => `「제 물건은 제가 간수해야지.」 ${who}${pp(who, '은/는')} 텅 빈 광을 떠올리며 한숨을 쉬었다.` },
      ];
    },
  },

  festival: {
    name: '명절', hanja: '節', tip: '명절 잔치를 열어 달라는 상소. 잔치는 며칠 동안 민심을 크게 올린다.', cd: 8, days: [2, 3],
    say: ['명절인데 잔치는?', '그네 매고 놀아야지'],
    cond: () => !!petFestName() && !hasMod('festival') && popCount() >= 6,
    weight: () => 1.3,
    make(p) {
      const f = petFestName() || '명절';
      p.data.fest = f;
      p.data.had = hasMod('festival') ? 1 : 0;
      p.petitioner = chance(0.5) ? petGroup('마을 어른들', '나이 지긋한 이들') : petGroup('젊은이들', '마을의 장정과 처녀들');
      p.title = `${f} 잔치를 열어 주십시오`;
      p.text = S.rank === 0
        ? `영주님, ${f}${pp(f, '이/가')} 코앞입니다. 예전에는 이맘때면 그네를 매고 씨름판을 벌였는데, 마을이 기운 뒤로는 몇 해째 조용했습니다. 올해만큼은 잔치를 열어 사람들 시름을 덜어 주십시오.`
        : `영주님, ${f}${pp(f, '이/가')} 코앞입니다. 마을도 이만큼 커졌으니 이웃 고을이 부러워할 만한 잔치를 열어 주십시오. 그네 매고 씨름판 벌이면 장정들 기운도 솟을 것입니다.`;
      return true;
    },
    moot: p => !p.data.had && hasMod('festival'),
    choices(p) {
      return [
        { id: 'feast', kind: 'grant', label: '크게 잔치를 연다', sub: '은자 60 · 식량 30 · 사흘간 민심 크게 상승 · 명성 +4', mood: 3,
          ok: () => S.res.silver >= 60 && S.res.food >= 30,
          run: () => { S.res.silver -= 60; S.res.food -= 30; petMod('festival', 3); addFame(4); return '그네가 하늘 높이 오르고 씨름판에 함성이 터졌다. 이웃 마을 사람들까지 구경을 왔다. 명성 +4.'; } },
        { id: 'small', kind: 'grant', label: '떡과 술을 조금 내린다', sub: '식량 15 · 하루 민심 상승', mood: 2, ok: () => S.res.food >= 15,
          run: () => { S.res.food -= 15; petMod('festival', 1); return '집집마다 떡 한 접시와 막걸리 한 동이가 돌았다. 조촐하지만 웃음이 넘쳤다.'; } },
        petDept('ye', 40, '사흘간 민심 크게 상승', () => { petMod('festival', 3); return '예방이 앞장서 풍물패를 부르고 잔칫상을 차렸다. 사흘 내내 마을이 들썩였다.'; }, { mood: 3 }),
        { id: 'deny', kind: 'deny', label: '올해는 건너뛴다', sub: '민심 하락',
          run: () => '여느 날과 다름없이 지나갔다. 아이들이 실망한 얼굴로 빈 마당을 서성인다.' },
      ];
    },
  },

  clinic: {
    name: '의원', hanja: '藥', tip: '의원을 지어 달라는 상소. 의원이 있으면 다친 이가 빨리 낫고 역병을 막는다.', cd: 4, days: [2, 4],
    say: ['아파도 갈 데가 없어', '약 한 첩만…'],
    cond: () => S.rank >= 1 && petCount('clinic') === 0 && (petInjured() >= 2 || hasMod('plague') || popCount() >= 22),
    weight: () => 0.8 + Math.min(2, petInjured() * 0.3) + (hasMod('plague') ? 3 : 0),
    make(p) {
      const v = petPick(x => x.age >= 18);
      p.petitioner = v ? petWho(v) : petGroup('마을 사람들', '');
      p.data.n = petCount('clinic');
      p.title = '의원을 들여 주십시오';
      p.text = hasMod('plague')
        ? '역병이 돌아 집집마다 앓는 소리가 납니다. 약 한 첩 지어 줄 의원이 없어 손 놓고 지켜볼 뿐입니다. 의원을 지어 의술 아는 이를 모셔 주십시오.'
        : petInjured() >= 2
          ? '다친 사람은 늘어 가는데 상처를 꿰매 줄 의원 하나 없습니다. 고름이 차도 쑥뜸으로 버티는 형편입니다. 의원을 지어 주십시오.'
          : '마을이 커지니 아픈 사람도 늘어납니다. 고뿔 한 번에 아이를 잃는 집도 있으니 의원을 지어 주십시오.';
      return true;
    },
    moot: p => petCount('clinic') > p.data.n,
    choices(p) {
      return [
        petBuildChoice('clinic', '의원을 짓는다', '다친 이가 빨리 낫는다',
          b => `${petWhere(b)} 의원 자리를 잡았다. 약초 냄새가 마을에 퍼질 날이 머지않았다.`),
        { id: 'doctor', kind: 'grant', label: '떠돌이 의원을 불러온다', sub: '은자 25 · 다친 사람을 모두 돌본다', mood: 1.5, ok: () => S.res.silver >= 25,
          run: () => {
            S.res.silver -= 25;
            let n = 0;
            for (const v of S.villagers) {
              if (v.dead) continue;
              if (v.down) { v.downT = Math.min(v.downT || 0, 0.5); n++; } else if (v.hp < v.maxHp) { v.hp = v.maxHp; n++; }
            }
            return n ? `떠돌이 의원이 사흘을 머물며 ${n}명을 돌보고 떠났다.` : '떠돌이 의원이 집집마다 맥을 짚어 주고 떠났다.';
          } },
        petDeptBuild('clinic', b => `공방이 ${petWhere(b)} 의원을 짓기 시작했다.`),
        { id: 'deny', kind: 'deny', label: '참고 견디라 한다', sub: '민심 하락', run: () => '사람들은 오늘도 쑥을 뜯으러 들로 나간다.' },
      ];
    },
  },

  market: {
    name: '장터', hanja: '市', tip: '장이 서게 해 달라는 상소. 장터는 은자를 벌고 민심을 올린다.', cd: 5, days: [3, 4],
    say: ['장이 서면 좋겠네', '소금 사기도 힘들어'],
    cond: () => S.rank >= 1 && petCount('market') === 0,
    weight: () => 0.9,
    make(p) {
      const v = petPick(x => x.age >= 18);
      p.petitioner = v && chance(0.5) ? petWho(v) : petGroup('장사꾼들', '보부상과 좌판 장수');
      p.data.n = petCount('market');
      p.title = '장이 서게 해 주십시오';
      p.text = '영주님, 소금 한 됫박을 사려 해도 이틀 길 읍내 장까지 가야 합니다. 마을에 장터가 서면 남는 곡식을 내다 팔 수 있고, 오가는 장사치들도 은자를 풀고 갈 것입니다.';
      return true;
    },
    moot: p => petCount('market') > p.data.n,
    choices() {
      return [
        petBuildChoice('market', '장터를 연다', '은자 수입 · 민심 상승', b => `${petWhere(b)} 장터 자리를 잡았다. 벌써부터 좌판 자리를 두고 실랑이가 벌어진다.`),
        petDeptBuild('market', b => `공방이 ${petWhere(b)} 장터를 짓기 시작했다.`),
        { id: 'deny', kind: 'deny', label: '아직 이르다', sub: '민심 조금 하락', mood: -1.5, run: () => '장터가 서기를 기다리던 사람들이 아쉬운 입맛을 다셨다. 소금 한 됫박에 또 이틀 길을 걸어야 한다.' },
      ];
    },
  },

  martial: {
    name: '무공', hanja: '武', tip: '무공을 배우게 해 달라는 상소. 들어주면 그 젊은이가 무관에 들어가 무사가 된다.', cd: 3, days: [2, 4], expireMood: -2,
    say: ['나도 칼을 잡고 싶어', '무관에 들어가고 싶다'],
    cond: () => petHasDojo() && petFree(petYouth).length > 0,
    weight: () => 0.8,
    make(p) {
      const v = petPick(petYouth) || petPick(x => x.age <= 30) || petPick();
      p.petitioner = v ? petWho(v) : petGroup(makeName('m'), '젊은이');
      p.data.vid = v ? v.id : 0;
      const n = p.petitioner.name, age = v ? v.age : 17;
      const raided = S.stats.raidsWon + S.stats.raidsLost > 0;
      p.title = '무공을 배우고 싶습니다';
      p.text = `소인 ${n}, 올해 ${age}살입니다. ${raided ? '지난번 적들이 쳐들어왔을 때 아무것도 못 하고 숨어만 있던 것이 한스럽습니다.' : '산적 소문이 돌 때마다 주먹만 쥐었다 폈다 할 뿐입니다.'} 무관에 들어가 칼 쓰는 법을 배우게 해 주십시오. 마을을 지키는 데 목숨을 걸겠습니다.`;
      return true;
    },
    moot: p => { const v = petLiving(p.data.vid); return !!v && v.jobType === 'dojo'; },
    choices(p) {
      const n = p.petitioner.name;
      const deny = { id: 'deny', kind: 'deny', label: '농사일이 먼저다', sub: '민심 조금 하락', mood: -1.5,
        run: () => {
          const v = petLiving(p.data.vid);
          if (v && chance(0.15)) {
            v.leaving = true; v.act = null; markDirty();
            return { text: `${n}${pp(n, '은/는')} 이튿날 새벽 봇짐을 메고 스승을 찾아 마을을 떠났다.`, mood: -2.5 };
          }
          return `${n}${pp(n, '은/는')} 고개를 숙이고 물러갔지만, 주먹은 여전히 쥐고 있었다.`;
        } };
      if (!petHasDojo()) {
        return [
          { id: 'book', kind: 'grant', label: '검보 한 권을 내린다', sub: '은자 15 · 무관이 없어 혼자 익힌다', mood: 1.5, ok: () => S.res.silver >= 15,
            run: () => {
              S.res.silver -= 15;
              const v = petLiving(p.data.vid);
              if (v) { v.martial = Math.min(S.martialCap, (v.martial || 0) + 0.2); v.talent = Math.min(1.9, (v.talent || 1) + 0.1); updateStats(v); }
              return `${n}${pp(n, '은/는')} 낡은 검보를 품에 안고 밤마다 뒷마당에서 목검을 휘두른다. 무관이 서면 누구보다 먼저 달려갈 것이다.`;
            } },
          deny,
        ];
      }
      return [
        // 가동 중인 무관이 있어야 들인다 (병방 예산은 ok 를 거친 뒤에야 쓴다)
        { id: 'admit', kind: 'grant', label: '무관에 들인다', sub: '하던 일을 그만두고 무사가 된다 · 재능 상승', ok: petHasDojo,
          run: () => {
            const v = petLiving(p.data.vid);
            if (v) petAdmitDojo(v, 0.25, 0.35);
            return `${n}${pp(n, '은/는')} 그날로 무관에 들어가 목검을 잡았다. 사범이 눈빛이 좋다며 웃는다.`;
          } },
        petDept('byeong', 20, '사범을 붙여 재능 크게 상승', () => {
          const v = petLiving(p.data.vid);
          if (v) petAdmitDojo(v, 0.45, 0.6);
          return `병방이 이름난 사범을 모셔 와 ${n}${pp(n, '을/를')} 따로 가르치게 했다. 몇 달이면 제몫을 하는 무사가 될 것이다.`;
        }, { mood: 3, label: '병방에 맡겨 사범을 붙인다', ok: petHasDojo }),
        deny,
      ];
    },
  },

  marriage: {
    name: '혼례', hanja: '囍', tip: '혼례를 허락하고 도와 달라는 상소. 혼례는 며칠 동안 민심을 올린다.', cd: 4, days: [2, 4], expireMood: -2,
    say: ['혼례를 올리고 싶어요', '날만 받아 놓고…'],
    cond: () => !hasMod('wedding') && petFree(petSingle('m')).length > 0 && petFree(petSingle('f')).length > 0,
    weight: () => 0.7,
    make(p) {
      const A = petPick(petSingle('m')) || petPick(x => x.sex === 'm' && x.age >= 18);
      const B = petPick(v => v !== A && petSingle('f')(v)) || petPick(v => v !== A && v.sex === 'f' && v.age >= 18);
      p.petitioner = A ? petWho(A) : petGroup(makeName('m'), '총각');
      p.data.bId = B ? B.id : 0;
      p.data.b = B ? B.name : makeName('f');
      const a = p.petitioner.name, b = p.data.b;
      p.title = '혼례를 허락해 주십시오';
      p.text = `소인 ${a}${pp(a, '과/와')} ${b}${pp(b, '은/는')} 오래전부터 서로 마음에 두고 있습니다. 그런데 혼례 치를 형편이 못 되어 날만 받아 놓고 해를 넘기고 있습니다. 영주님께서 허락하시고 조금만 보태 주시면 평생 이 마을에 뼈를 묻겠습니다.`;
      if (B) petSay(B, ['어머, 부끄러워라', '영주님이 허락하실까…'], 4);
      return true;
    },
    withdraw: p => !!p.data.bId && !petLiving(p.data.bId),
    choices(p) {
      const a = p.petitioner.name, b = p.data.b;
      const wed = () => {
        const va = petLiving(p.petitioner.id), vb = petLiving(p.data.bId);
        if (va && vb) { va.spouse = vb.id; vb.spouse = va.id; }
      };
      return [
        { id: 'gift', kind: 'grant', label: '혼례 비용을 대 준다', sub: '은자 25 · 사흘간 민심 상승', ok: () => S.res.silver >= 25,
          run: () => { S.res.silver -= 25; petMod('wedding', 3); wed(); return `${a}${pp(a, '과/와')} ${b}${pp(b, '이/가')} 영주관 마당에서 맞절을 올렸다. 잔치 국수 냄새가 온 마을에 퍼진다.`; } },
        { id: 'bless', kind: 'grant', label: '허락하고 축하만 한다', sub: '하루 민심 상승', mood: 1,
          run: () => { petMod('wedding', 1); wed(); return '영주의 허락이 떨어지자 두 사람은 정화수 한 그릇을 떠 놓고 조촐하게 혼례를 올렸다.'; } },
        petDept('ye', 20, '사흘간 민심 상승', () => { petMod('wedding', 3); wed(); return `예방이 혼례를 도맡아 차려 주었다. ${a}${pp(a, '과/와')} ${b}${pp(b, '이/가')} 꽃가마 앞에서 연신 웃는다.`; }),
        { id: 'deny', kind: 'deny', label: '혼례를 미루라 한다', sub: '민심 조금 하락', mood: -1.5,
          run: () => `${a}${pp(a, '은/는')} 고개를 떨군 채 물러갔다. 멀리서 ${b}${pp(b, '이/가')} 눈물을 훔친다.` },
      ];
    },
  },

  wrongful: {
    name: '원통한 일', hanja: '冤', tip: '억울한 옥살이를 풀어 달라는 상소. 관부·철혈방과의 관계가 얽혀 있다.', cd: 8, days: [2, 3], expireMood: -3.5,
    say: ['억울하옵니다!', '내 아들을 살려 주시오'],
    cond: () => dayOf() >= 4 && popCount() >= 10 && !S.occupation && S.vassal !== 'cheolhyeol' && petFree(v => v.age >= 38).length > 0,
    weight: () => 0.45,
    make(p) {
      const v = petPick(x => x.age >= 38) || petPick(x => x.age >= 30);
      p.petitioner = v ? petWho(v) : petGroup(makeName('m'), '늙은 아비');
      p.data.son = v ? petSonName(v) : pick(FOLK_M);
      p.data.ma = v && v.sex === 'f' ? '어미' : '아비';
      p.data.bail = rel('gwanbu') >= 15 ? 20 : 35;
      const son = p.data.son;
      p.title = '옥에 갇힌 아들을 살려 주십시오';
      p.text = `영주님, 제 아들 ${son}${pp(son, '이/가')} 장터에서 철혈방 패거리와 시비가 붙었다가 도리어 관부에 끌려갔습니다. 먼저 손을 댄 것은 그놈들인데, 관부는 철혈방 눈치만 보고 제 아들만 옥에 가두었습니다. 부디 이 억울함을 풀어 주십시오.`;
      return true;
    },
    choices(p) {
      const { son, ma, bail } = p.data, who = p.petitioner.name;
      const back = () => petNewcomer(son, { sex: 'm', age: rndi(17, 23) });
      return [
        { id: 'plead', kind: 'grant', label: '관부에 탄원서를 올린다', sub: `은자 ${bail} 보석금 · 관부 관계 +1 · 아들이 돌아온다`, mood: 3, ok: () => S.res.silver >= bail,
          run: () => { S.res.silver -= bail; changeRel('gwanbu', 1); back(); return `현청에 탄원서와 보석금이 올라갔다. 이윽고 ${son}${pp(son, '이/가')} 절뚝이며 마을 어귀에 나타나자 ${ma}${pp(ma, '이/가')} 맨발로 뛰어나갔다.`; } },
        { id: 'confront', kind: 'grant', label: '철혈방에 따진다', sub: '철혈방 관계 -10 · 관부 관계 +4 · 명성 +3', mood: 3,
          run: () => {
            changeRel('cheolhyeol', -10); S.factions.cheolhyeol.threat += 15; changeRel('gwanbu', 4); addFame(3); back();
            return `영주가 증인들을 앞세워 철혈방 향주를 다그치자 향주는 마지못해 수하의 잘못을 인정했다. 관부도 더는 버티지 못하고 ${son}${pp(son, '을/를')} 풀어 주었다. 명성 +3. 다만 철혈방의 눈빛이 곱지 않다.`;
          } },
        petDept('hyeong', 25, '진상을 밝혀 아들을 빼낸다', () => {
          changeRel('gwanbu', 3); changeRel('cheolhyeol', -4); back();
          return `형방 아전이 장터 사람들의 증언을 모아 현청에 올렸다. 시비의 진상이 드러나 ${son}${pp(son, '이/가')} 풀려났다.`;
        }, { mood: 3 }),
        { id: 'deny', kind: 'deny', label: '관부의 일에는 끼지 않는다', sub: '관부 관계 +2 · 민심 하락', mood: -2.5,
          run: () => { changeRel('gwanbu', 2); return `${who}${pp(who, '은/는')} 영주관 문 앞에 주저앉아 한참을 울다 돌아갔다.`; } },
      ];
    },
  },

  widow: {
    name: '홀로 된 이', hanja: '寡', tip: '지아비를 잃고 홀로 된 이가 도움을 청하는 상소.', cd: 5, days: [2, 4],
    say: ['살길이 막막해요', '아이들 끼니가…'],
    cond: () => petFree(v => v.sex === 'f' && v.age >= 28 && !petHasSpouse(v)).length > 0
      && (S.stats.died > (S.petitions.died || 0) || popCount() >= 14),
    weight: () => (S.stats.died > (S.petitions.died || 0) ? 1.4 : 0.35),
    make(p) {
      const v = petPick(x => x.sex === 'f' && x.age >= 28 && !petHasSpouse(x)) || petPick(x => x.sex === 'f');
      p.petitioner = v ? petWho(v) : petGroup(makeName('f', true), '홀어미');
      const hus = makeName('m');
      const loss = S.stats.died > (S.petitions.died || 0);
      S.petitions.died = S.stats.died;
      const how = loss && S.lastRaidEnd !== undefined && S.time - S.lastRaidEnd < 96
        ? '지난 습격 때 칼을 맞고'
        : pick(['지난겨울 고뿔을 앓다가', '장마철 불어난 강물에 휩쓸려', '나무하러 산에 갔다가 범을 만나']);
      p.title = '홀로 남은 살림을 돌보아 주십시오';
      p.text = `지아비 ${hus}${pp(hus, '이/가')} ${how} 세상을 떠난 뒤로 어린것들만 데리고 홀로 남았습니다. 품을 팔아 보려 해도 받아 주는 데가 없어 끼니를 거르는 날이 많습니다. 염치없지만 살길을 열어 주십시오.`;
      return true;
    },
    choices(p) {
      const who = p.petitioner.name;
      return [
        { id: 'food', kind: 'grant', label: '곡식을 내린다', sub: '식량 20', ok: () => S.res.food >= 20,
          run: () => { S.res.food -= 20; return `${who}${pp(who, '은/는')} 곡식 자루를 받아 들고 몇 번이고 절을 했다.`; } },
        { id: 'silver', kind: 'grant', label: '은자를 내린다', sub: '은자 20', ok: () => S.res.silver >= 20,
          run: () => { S.res.silver -= 20; return `${who}${pp(who, '은/는')} 은자로 아이들 겨울옷부터 지었다. 이웃들이 영주의 인정을 칭찬한다.`; } },
        petDept('ho', 15, '구휼미를 내린다', () => `호방이 구휼미를 내어 ${who}의 집 쌀독을 채워 주었다.`),
        { id: 'deny', kind: 'deny', label: '모두가 어려운 때다', sub: '민심 하락',
          run: () => `${who}${pp(who, '은/는')} 아무 말 없이 물러갔다. 그 뒷모습을 본 이웃들이 혀를 찬다.` },
      ];
    },
  },

  scholar: {
    name: '글공부', hanja: '書', tip: '선비가 책과 글방을 청하는 상소. 들어주면 명성이 오른다.', cd: 7, days: [3, 4], expireMood: -1.5,
    say: [],
    cond: () => (S.rank >= 1 || S.fame >= 25) && dayOf() >= 3,
    weight: () => 0.5,
    make(p) {
      const name = makeName('m');
      p.petitioner = petGroup(name, '떠돌이 선비');
      p.title = '글 읽는 소리가 나는 마을을';
      p.text = `소생은 과거 길에 이 마을에 묵게 된 선비 ${name}${pp(name, '이라/라')} 하옵니다. 아이들이 제 이름 석 자도 쓸 줄 모르는 것이 안타깝습니다. 책 몇 권과 글방 한 칸만 마련해 주시면 제가 아이들을 가르치겠습니다. 글을 아는 마을은 강호에서도 함부로 업신여기지 못합니다.`;
      return true;
    },
    choices(p) {
      const name = p.petitioner.name;
      return [
        { id: 'books', kind: 'grant', label: '책을 사 준다', sub: '은자 30 · 명성 +4', mood: 1.5, ok: () => S.res.silver >= 30,
          run: () => { S.res.silver -= 30; addFame(4); return '선비가 책 보따리를 끌어안고 웃었다. 정자 그늘에서 아이들의 글 읽는 소리가 들려온다. 명성 +4.'; } },
        { id: 'hall', kind: 'grant', label: '글방을 열어 준다', sub: '은자 50 · 목재 20 · 명성 +6 · 여드레간 민심 +3 · 선비가 눌러산다', mood: 2.5,
          ok: () => S.res.silver >= 50 && S.res.wood >= 20,
          run: () => {
            S.res.silver -= 50; S.res.wood -= 20; addFame(6); addMod('pet_study', 8);
            petNewcomer(name, { sex: 'm', age: rndi(28, 44) });
            return `빈 헛간을 고쳐 글방을 열었다. ${name}${pp(name, '은/는')} 아예 이 마을에 눌러살기로 했다. 명성 +6.`;
          } },
        petDept('ye', 30, '명성 +4', () => { addFame(4); return '예방이 책을 사들이고 글방 자리를 내주었다. 선비가 아이들을 모아 천자문부터 가르친다. 명성 +4.'; }, { mood: 2 }),
        { id: 'deny', kind: 'deny', label: '글이 밥 먹여 주느냐', sub: '명성 -1', mood: -1,
          run: () => { addFame(-1); return '선비는 쓴웃음을 지으며 봇짐을 챙겨 떠났다. 명성 -1.'; } },
      ];
    },
  },

  shrine: {
    name: '사당', hanja: '祠', tip: '사당을 세우거나 제사를 올려 달라는 상소. 사당은 민심과 명성을 올린다.', cd: 6, days: [3, 4],
    say: ['조상님 뵐 낯이 없어', '제사는 지내야지'],
    cond: () => petCount('shrine') === 0 && popCount() >= 10 && dayOf() >= 2,
    weight: () => 0.7,
    make(p) {
      p.petitioner = petGroup('마을 어른들', '나이 지긋한 이들');
      p.data.n = petCount('shrine');
      p.title = '조상께 제를 올릴 사당을';
      p.text = '영주님, 이 마을 사당이 무너진 지 오래라 조상님들 위패를 모실 데가 없습니다. 제사를 거르니 궂은일이 끊이지 않는다고들 수군거립니다. 작게라도 사당을 세워 주십시오.';
      return true;
    },
    moot: p => petCount('shrine') > p.data.n,
    choices() {
      return [
        petBuildChoice('shrine', '사당을 세운다', '민심과 명성이 오른다', b => `${petWhere(b)} 사당 터를 닦았다. 어른들이 정성껏 고사를 지낸다.`, 3),
        { id: 'rite', kind: 'grant', label: '제사만 올려 준다', sub: '은자 15 · 식량 10 · 사흘간 민심 +3', mood: 1.5,
          ok: () => S.res.silver >= 15 && S.res.food >= 10,
          run: () => { S.res.silver -= 15; S.res.food -= 10; addMod('pet_rite', 3); return '마을 어귀 고목 아래 제상을 차리고 조상께 술을 올렸다. 어른들의 얼굴이 한결 펴졌다.'; } },
        petDeptBuild('shrine', b => `공방이 ${petWhere(b)} 사당을 짓기 시작했다.`, 3),
        { id: 'deny', kind: 'deny', label: '귀신 섬길 여유가 없다', sub: '민심 하락', run: () => '어른들은 혀를 차며 물러갔다. 「조상 무서운 줄을 모르는구먼.」' },
      ];
    },
  },

  merchant: {
    name: '장사 허가', hanja: '商', tip: '금룡상회 상인이 좌판 허가를 청하는 글. 은자와 상회의 호의를 얻는다.', cd: 5, days: [2, 3], expireMood: -0.5,
    say: [],
    cond: () => (S.rank >= 1 || popCount() >= 12) && rel('geumryong') > -40 && !hasMod('pet_stall'),
    weight: () => 0.6,
    make(p) {
      const name = makeName('m');
      p.petitioner = petGroup(name, '금룡상회 상인');
      p.data.n = Math.round(30 + popCount() * 1.2);
      p.title = '좌판을 벌이게 해 주십시오';
      p.text = `금룡상회의 ${name}${pp(name, '이라/라')} 하옵니다. 마을 어귀에 좌판 몇 개를 벌일 허가를 주시면 허가 값으로 은자 ${p.data.n}냥을 바로 올리겠습니다. 비단이며 소금이며 귀한 물건을 들여오면 마을 사람들도 반길 것입니다.`;
      return true;
    },
    onExpire: () => changeRel('geumryong', -2),
    choices(p) {
      const n = p.data.n, hi = Math.round(n * 1.8);
      return [
        { id: 'permit', kind: 'grant', label: '허가해 준다', sub: `은자 +${n} · 금룡상회 관계 +6 · 여드레간 좌판 세금`, mood: 1,
          run: () => { addRes('silver', n); changeRel('geumryong', 6); addMod('pet_stall', 8); return '마을 어귀에 비단과 소금을 늘어놓은 좌판이 섰다. 아낙들이 구경하느라 발길을 멈춘다.'; } },
        { id: 'haggle', kind: 'grant', label: '허가 값을 올려 부른다', sub: `은자 +${hi} · 거절당할 수도 있다`, mood: 0.5,
          run: () => {
            if (chance(0.6)) { addRes('silver', hi); changeRel('geumryong', 1); addMod('pet_stall', 8); return `상인은 한참 주판을 튕기더니 은자 ${hi}냥을 내놓았다.`; }
            changeRel('geumryong', -3);
            return { text: '「장사를 하자는 게 아니라 털어 가시겠다는 말씀이군요.」 상인은 혀를 차며 떠났다.', mood: 0, outcome: 'denied' };
          } },
        { id: 'deny', kind: 'deny', label: '마을 장사꾼들을 지킨다', sub: '금룡상회 관계 -4', mood: -0.5,
          run: () => { changeRel('geumryong', -4); return '상인은 정중히 인사하고 물러갔다. 마을 장사꾼들은 내심 반기는 눈치다.'; } },
      ];
    },
  },
};

// ───────────────────────────────────────────────
// 모듈
// ───────────────────────────────────────────────
const Petitions = {
  TYPES: PET_TYPES,
  _shown: [],          // 방금 처결해 창에 잠시 남겨 둔 카드 (저장 안 함)
  _seenAtOpen: Infinity,
  _plans: {},
  _ui: false,

  init() {
    S.petitions = {
      list: [], nextId: 1, history: [], recent: [], cd: {}, seen: 0, died: 0,
      stats: { granted: 0, denied: 0, expired: 0, moot: 0 }, flags: {},
    };
    this.reset();
  },
  onLoad() {
    const st = S.petitions = S.petitions || {};
    if (!Array.isArray(st.list)) st.list = [];
    if (!Array.isArray(st.history)) st.history = [];
    if (!Array.isArray(st.recent)) st.recent = [];
    if (!st.cd || typeof st.cd !== 'object') st.cd = {};
    if (!st.stats || typeof st.stats !== 'object') st.stats = {};
    for (const k of ['granted', 'denied', 'expired', 'moot']) st.stats[k] = st.stats[k] || 0;
    if (!st.flags || typeof st.flags !== 'object') st.flags = {};
    st.list = st.list.filter(p => p && PET_TYPES[p.type]);
    for (const p of st.list) {
      p.data = p.data || {};
      p.petitioner = p.petitioner || petGroup('마을 사람들', '');
      if (!Number.isFinite(p.deadline)) p.deadline = S.time + 48;
    }
    const maxId = st.list.reduce((m, p) => Math.max(m, p.id || 0), 0);
    st.nextId = Math.max(st.nextId || 1, maxId + 1);
    st.seen = st.seen || 0;
    st.died = st.died || 0;
    // 사라진 상소를 가리키는 사람 정리
    const ids = new Set(st.list.map(p => p.id));
    for (const v of S.villagers) if (v.petition && !ids.has(v.petition)) delete v.petition;
    this.reset();
  },
  reset() {
    this._shown = [];
    this._plans = {};
    this._seenAtOpen = Infinity;
    this.ensureUI();
  },
  ensureUI() {
    if (this._ui || typeof UI === 'undefined' || typeof UI.registerSheet !== 'function') return;
    UI.registerSheet('petitions', { html: () => this.sheetHTML(), onClick: e => this.onSheetClick(e), live: true });
    this._ui = true;
  },

  // ── 공개 API ──
  pending() { return S && S.petitions ? S.petitions.list.length : 0; },
  list() { return S && S.petitions ? S.petitions.list.slice() : []; },
  get(id) { return S && S.petitions ? S.petitions.list.find(p => p.id === id) || null : null; },
  // 이야기가 내는 짜인 상소: 조건이 맞지 않아도 만든다. { type, title?, text?, petitioner?, days?, deadline?, data?, bid? }
  add(def) {
    if (!S || !def || !PET_TYPES[def.type]) return null;
    if (!S.petitions) this.init();
    return this.create(def.type, def, true);
  },
  // 무작위 상소를 지금 하나 들인다 (조건이 맞는 것 가운데서)
  spawn() {
    const st = S.petitions, day = dayOf();
    const cands = Object.keys(PET_TYPES).filter(k => {
      const T = PET_TYPES[k];
      if (st.list.some(p => p.type === k)) return false;
      const last = st.cd[k];
      if (last !== undefined && day - last < T.cd) return false;
      return T.cond();
    });
    while (cands.length) {
      const k = weighted(cands, x => PET_TYPES[x].weight());
      if (!k) return null;
      const p = this.create(k, {}, false);
      if (p) return p;
      cands.splice(cands.indexOf(k), 1);
    }
    return null;
  },
  // 그 상소의 선택지 (다른 모듈·시험용): [{ id, label, sub, kind, ok }]
  choices(pOrId) {
    const p = typeof pOrId === 'object' ? pOrId : this.get(pOrId);
    if (!p) return [];
    return this.choicesOf(p).map(c => ({ id: c.id, label: c.label, sub: c.sub || '', kind: c.kind, dept: c.dept || null, ok: !c.ok || !!c.ok() }));
  },
  // 처결한다 → { ok, text, b, why }
  resolve(id, cid) {
    const st = S.petitions;
    const p = st && st.list.find(x => x.id === id);
    if (!p) return { ok: false, why: '이미 처결한 상소다' };
    const c = this.choicesOf(p).find(x => x.id === cid);
    if (!c) return { ok: false, why: '그런 처결은 없다' };
    if (c.ok && !c.ok()) { UI.toast('형편이 닿지 않는다', 'bad'); return { ok: false, why: '형편이 닿지 않는다' }; }
    let r = c.run(p);
    if (typeof r === 'string' || !r) r = { text: r || '' };
    if (r.fail) { UI.toast(r.fail, 'bad'); return { ok: false, why: r.fail }; }
    const outcome = r.outcome || (c.kind === 'deny' ? 'denied' : 'granted');
    const mood = r.mood !== undefined ? r.mood : c.mood !== undefined ? c.mood : outcome === 'granted' ? 2.5 : -2;
    this.finish(p, outcome, mood, c.label, r.text, c.id, r.b || null);
    if (r.b) UI.focusOn(r.b.x + r.b.w / 2, r.b.y + r.b.h / 2);
    return { ok: true, text: r.text, b: r.b || null };
  },

  // ── 안쪽 ──
  choicesOf(p) {
    const T = PET_TYPES[p.type];
    return T ? T.choices(p).filter(Boolean) : [];
  },
  planFor(p) {
    const h = Math.floor(S.time);
    const c = this._plans[p.id];
    if (c && c.h === h) return c.plan;
    const plan = petRoadPlan(getB(p.data.bid));
    this._plans[p.id] = { h, plan };
    return plan;
  },
  create(type, o, scripted) {
    const st = S.petitions, T = PET_TYPES[type];
    o = o || {};
    const p = { id: st.nextId, type, title: '', text: '', petitioner: null, t: S.time, deadline: 0, data: {}, scripted: !!scripted };
    if (T.make(p, o) === false) return null;
    st.nextId++;
    if (o.title) p.title = String(o.title);
    if (o.text) p.text = String(o.text);
    if (o.petitioner) {
      p.petitioner = typeof o.petitioner === 'string' ? petGroup(o.petitioner, '')
        : Object.assign({ name: '마을 사람', id: 0, note: '' }, o.petitioner);
    }
    if (o.data && typeof o.data === 'object') Object.assign(p.data, o.data);
    if (!p.petitioner) p.petitioner = petGroup('마을 사람들', '');
    const days = o.days !== undefined ? Number(o.days) : rndi(T.days[0], T.days[1]);
    p.deadline = o.deadline !== undefined ? Number(o.deadline) : S.time + days * 24;
    st.list.push(p);
    st.cd[type] = dayOf();
    const v = petLiving(p.petitioner.id);
    if (v) {
      v.petition = p.id;
      petSay(v, T.say && T.say.length ? T.say : PET_SAY_NEW, 4);
      petWalkToManor(v);
    }
    const who = p.petitioner.name;
    logMsg(`${who}${pp(who, '이/가')} 상소를 올렸다: 「${p.title}」`, '');
    if (typeof UI !== 'undefined') UI.toast(`새 상소: ${p.title}`, '');
    Bus.emit('petitionNew', p);
    return p;
  },
  finish(p, outcome, mood, label, text, cid, b) {
    const st = S.petitions;
    st.list = st.list.filter(x => x !== p);
    delete this._plans[p.id];
    for (const v of S.villagers) if (v.petition === p.id) delete v.petition;
    p.outcome = outcome;
    if (mood) st.recent.push({ t: S.time, v: mood });
    if (st.stats[outcome] !== undefined) st.stats[outcome]++;
    const who = p.petitioner.name;
    if (outcome !== 'withdrawn') {
      st.history.unshift({ id: p.id, type: p.type, title: p.title, who, outcome, label, text: text || '', t: S.time });
      if (st.history.length > PET_HIST) st.history.length = PET_HIST;
    }
    const v = petLiving(p.petitioner.id);
    if (outcome === 'granted' || outcome === 'moot') petSay(v, PET_SAY_YES, 3.5);
    else if (outcome === 'denied') petSay(v, PET_SAY_NO, 3.5);
    else if (outcome === 'expired') petSay(v, ['아무 답이 없으시네…'], 3.5);
    const open = typeof UI !== 'undefined' && UI.sheet === 'petitions';
    if (outcome === 'granted') logMsg(`${who}의 상소를 들어주었다 — ${label}.`, 'good');
    else if (outcome === 'denied') logMsg(`${who}의 상소를 물리쳤다 — ${label}.`, '');
    else if (outcome === 'expired') logMsg(`${who}의 상소가 묵살되었다.`, 'bad');
    else if (outcome === 'moot') logMsg(`${who}의 바람이 이루어져 상소를 거두었다.`, 'good');
    if (open && outcome !== 'withdrawn') {
      const now = performance.now();
      this._shown.push({ key: p.deadline, id: p.id, type: p.type, title: p.title, who: p.petitioner, outcome, label, text: text || '',
        bid: b ? b.id : 0, until: now + 9000, fresh: now + 1300 });
    } else if (outcome === 'granted' || outcome === 'denied') {
      UI.toast(`${p.title} — ${PET_OUT[outcome]}`, outcome === 'granted' ? 'good' : '');
    }
    Bus.emit('petitionResolved', p, cid);
  },
  // 기한·성취·철회를 살핀다
  sweep() {
    const st = S.petitions;
    for (const p of st.list.slice()) {
      const T = PET_TYPES[p.type];
      if (!T) { st.list = st.list.filter(x => x !== p); continue; }
      if ((p.petitioner.id && !petLiving(p.petitioner.id)) || (T.withdraw && T.withdraw(p))) {
        this.finish(p, 'withdrawn', 0, '', '', '_withdrawn', null);
        continue;
      }
      if (T.moot && T.moot(p)) {
        this.finish(p, 'moot', 1, '바라던 일이 이루어졌다', '영주가 처결하기 전에 바라던 일이 이루어졌다.', '_moot', null);
        continue;
      }
      if (S.time >= p.deadline) {
        if (T.onExpire) T.onExpire(p);
        const who = p.petitioner.name;
        this.finish(p, 'expired', T.expireMood !== undefined ? T.expireMood : -3, '기한을 넘김', `${who}의 상소가 묵살되었다.`, '_expired', null);
        UI.toast(`묵살된 상소: ${p.title}`, 'bad');
        if (!st.flags.toldExpire) {
          st.flags.toldExpire = 1;
          hook(Story, 'say', ['영주님, 상소 하나가 답을 받지 못하고 묵살되었습니다.', '백성은 들어주지 않은 것보다 아무 답도 없는 것을 더 서운해합니다. 물리치더라도 상소함을 열어 직접 처결해 주십시오.'], { key: 'petition_expired' });
        }
      }
    }
  },
  roll() {
    const st = S.petitions;
    if (S.raid || S.ended || st.list.length >= PET_MAX) return;
    if (hook(Story, 'allowEvent', 'petition') === false) return;
    const pop = popCount();
    if (pop < 3) return;
    const h = hourOf();
    const dayTime = h >= 7 && h < 20;
    let perDay = 0.6 + pop / 40;
    const d = dayOf();
    if (d === 0) perDay *= 0.3; else if (d === 1) perDay *= 0.7;
    if (S.occupation) perDay *= 0.5;
    if (st.list.length >= 4) perDay *= 0.6;
    // 낮에 대부분 (13시간에 85%)
    const pH = dayTime ? perDay * 0.85 / 13 : perDay * 0.15 / 11;
    if (Math.random() < pH) this.spawn();
  },

  // ── 훅 ──
  hourly() {
    if (!S.petitions) this.init();
    this.sweep();
    this.roll();
  },
  daily() {
    const st = S.petitions;
    if (!st) return;
    st.recent = st.recent.filter(r => S.time - r.t < PET_DECAY_H);
    // 금룡상회 좌판 세금
    if (hasMod('pet_stall')) {
      const n = Math.round(2 + popCount() * 0.1);
      addRes('silver', n);
      if (S.dayAcc) S.dayAcc.trade = (S.dayAcc.trade || 0) + n;   // 육방 장부에는 장사로 잡힌다
    }
  },
  happinessFactors() {
    const st = S && S.petitions;
    if (!st) return [];
    let pos = 0, neg = 0;
    for (const r of st.recent) {
      const k = 1 - (S.time - r.t) / PET_DECAY_H;
      if (k <= 0) continue;
      if (r.v > 0) pos += r.v * k; else neg += r.v * k;
    }
    const f = [];
    if (pos >= 0.5) f.push(['들어준 상소', Math.min(10, pos)]);
    if (neg <= -0.5) f.push(['외면당한 상소', Math.max(-15, neg)]);
    const n = st.list.length;
    if (n > 2) f.push(['쌓인 상소', -Math.min(8, (n - 2) * 2)]);
    if (hasMod('pet_watch')) f.push(['야경 강화', 2]);
    if (hasMod('pet_study')) f.push(['글 읽는 소리', 3]);
    if (hasMod('pet_rite')) f.push(['조상께 올린 제사', 3]);
    return f;
  },
  uiTick() {
    this.ensureUI();
    const st = S && S.petitions;
    if (!st) return;
    const n = st.list.length;
    const badge = document.getElementById('petition-badge');
    if (badge) {
      badge.hidden = n === 0;
      if (badge.textContent !== String(n)) badge.textContent = n;
    }
    const open = typeof UI !== 'undefined' && UI.sheet === 'petitions';
    if (open && n) st.seen = Math.max(st.seen, ...st.list.map(p => p.id));
    const unseen = st.list.some(p => p.id > st.seen);
    const urgent = st.list.some(p => p.deadline - S.time < 12);
    const btn = document.getElementById('btn-petitions');
    if (btn) {
      btn.classList.toggle('alert', n > 0 && (unseen || urgent));
      btn.classList.toggle('pet-urgent', urgent);
    }
    if (this._shown.length) { const now = performance.now(); this._shown = this._shown.filter(s => s.until > now); }
  },

  // ── 상소함 창 ──
  effect() { return this.happinessFactors().reduce((a, [, v]) => a + v, 0); },
  sheetHTML() {
    const st = S && S.petitions;
    if (!st) return '';
    const now = performance.now();
    const items = st.list.map(p => ({ key: p.deadline, id: p.id, html: this.cardHTML(p) }));
    for (const s of this._shown) items.push({ key: s.key, id: s.id, html: this.doneHTML(s, now) });
    items.sort((a, b) => a.key - b.key || b.id - a.id);
    const s = st.stats;
    const eff = Math.round(this.effect());
    const effCls = eff > 0 ? 'pos' : eff < 0 ? 'neg' : '';
    return `<div class="pet-sheet">
      <header class="pet-top">
        <span class="pet-box" data-tip-title="疏 · 트일 소" data-tip="상소함(上疏函). 백성이 영주께 올린 글을 모아 두는 함이다.">疏</span>
        <div class="pet-top-text"><h2>상소함</h2>
          <p class="lead">백성들이 영주께 올린 글이다. 들어주면 민심이 오르고, 물리치면 조금 내려가며, 기한을 넘겨 묵히면 크게 내려간다.</p></div>
      </header>
      <div class="pet-stats">
        <span><b>${st.list.length}</b> 기다리는 상소</span>
        <span>들어줌 <b>${s.granted}</b></span><span>물리침 <b>${s.denied}</b></span><span>묵살 <b>${s.expired}</b></span>
        <span class="pet-eff ${effCls}" data-tip="상소 처결이 지금 민심에 더하거나 빼는 값. 처결의 여운은 닷새에 걸쳐 옅어지고, 상소가 셋 넘게 쌓이면 그것만으로도 민심이 내려간다.">민심 <b>${eff > 0 ? '+' : ''}${eff}</b></span>
      </div>
      ${items.length ? `<div class="pet-list">${items.map(i => i.html).join('')}</div>` : this.emptyHTML()}
      ${this.historyHTML()}
    </div>`;
  },
  emptyHTML() {
    const dept = petAdminReal() ? '<p class="pet-empty-tip">육방에 예산을 나눠 두면 상소를 맡은 부서에 넘겨 그 예산으로 처리하게 할 수도 있다.</p>' : '';
    return `<div class="pet-empty">
      <span class="pet-empty-seal" data-tip-title="疏 · 트일 소" data-tip="상소(上疏). 백성이 영주에게 올리는 글.">疏</span>
      <p class="pet-empty-head">상소함이 비어 있다.</p>
      <p>살림에 탈이 나면 백성들은 영주께 상소를 올린다. 집이 모자라거나, 먹을 것이 떨어지거나, 이웃끼리 다툼이 나면 이 함에 글이 쌓인다.</p>
      <p>상소마다 들어줄 길과 물리칠 길이 있다. 모든 청을 다 들어줄 수는 없으니, 곳간과 민심 사이에서 저울질하는 것이 영주의 일이다.</p>
      ${dept}
    </div>`;
  },
  kindHTML(type) {
    const T = PET_TYPES[type];
    if (!T) return '';
    const g = HANJA_GLOSS[T.hanja];
    return `<span class="pet-kind" data-tip-title="${T.hanja}${g ? ' · ' + g[0] : ''}" data-tip="${escapeHtml(T.tip)}">${T.hanja}</span>`;
  },
  whoHTML(who) {
    return `<p class="pet-who">${escapeHtml(who.name)}${who.note ? ` <small>${escapeHtml(who.note)}</small>` : ''}</p>`;
  },
  cardHTML(p) {
    const due = petDue(p.deadline - S.time);
    const isNew = p.id > this._seenAtOpen;
    const btns = this.choicesOf(p).map(c => {
      const ok = !c.ok || c.ok();
      return `<button type="button" class="pet-choice ${c.kind}${c.dept ? ' dept' : ''}" data-pact="choose" data-pid="${p.id}" data-cid="${c.id}"${ok ? '' : ' disabled'}>`
        + `<b>${escapeHtml(c.label)}</b>${c.sub ? `<small>${escapeHtml(c.sub)}</small>` : ''}</button>`;
    }).join('');
    const b = p.data.bid ? getB(p.data.bid) : null;
    const v = petLiving(p.petitioner.id);
    const loc = b || v ? `<button type="button" class="pet-loc" data-pact="locate" data-pid="${p.id}">${b ? '그곳 보기' : '올린 이 찾기'}</button>` : '';
    return `<article class="pet-card${due.urgent ? ' urgent' : ''}${isNew ? ' new' : ''}">
      <span class="pet-seal" data-tip-title="疏 · 트일 소" data-tip="상소(上疏). 백성이 영주에게 올리는 글이다. 기한 안에 처결하지 않으면 묵살된 것으로 여겨 민심이 크게 떨어진다.">疏</span>
      <header class="pet-card-head">${this.kindHTML(p.type)}<div class="pet-titles"><h4>${escapeHtml(p.title)}</h4>${this.whoHTML(p.petitioner)}</div></header>
      <p class="pet-text">${escapeHtml(p.text)}</p>
      ${p.data.hint ? `<p class="pet-hint">${escapeHtml(p.data.hint)}</p>` : ''}
      <div class="pet-meta"><span class="pet-due${due.urgent ? ' urgent' : ''}">${due.t}</span>${isNew ? '<span class="pet-newtag">새 상소</span>' : ''}${loc}</div>
      <div class="pet-choices">${btns}</div>
    </article>`;
  },
  doneHTML(s, now) {
    const seal = PET_SEAL[s.outcome] || '疏';
    const g = HANJA_GLOSS[seal];
    const go = s.bid && getB(s.bid) ? `<button type="button" class="pet-loc" data-pact="goto" data-bid="${s.bid}">지은 곳 보기</button>` : '';
    return `<article class="pet-card done ${s.outcome}${s.fresh > now ? ' fresh' : ''}">
      <span class="pet-seal" data-tip-title="${seal}${g ? ' · ' + g[0] : ''}" data-tip="${g ? escapeHtml(g[1]) : ''}">${seal}</span>
      <header class="pet-card-head">${this.kindHTML(s.type)}<div class="pet-titles"><h4>${escapeHtml(s.title)}</h4>${this.whoHTML(s.who)}</div></header>
      <p class="pet-decision">${PET_OUT[s.outcome] || ''} — ${escapeHtml(s.label)}</p>
      ${s.text ? `<p class="pet-result">${escapeHtml(s.text)}</p>` : ''}
      ${go ? `<div class="pet-meta">${go}</div>` : ''}
    </article>`;
  },
  historyHTML() {
    const h = S.petitions.history.slice(0, 8);
    if (!h.length) return '';
    return `<h3 class="pet-h3">지난 처결</h3><ol class="pet-history">${h.map(e => {
      const seal = PET_SEAL[e.outcome] || '疏';
      const g = HANJA_GLOSS[seal];
      return `<li class="${e.outcome}"${e.text ? ` data-tip="${escapeHtml(e.text)}"` : ''}>`
        + `<span class="pet-hseal" data-tip-title="${seal}${g ? ' · ' + g[0] : ''}" data-tip="${g ? escapeHtml(g[1]) : ''}">${seal}</span>`
        + `<time>${petDate(e.t)}</time><span class="pet-hmain"><b>${escapeHtml(e.who)}</b> ${escapeHtml(e.title)}</span>`
        + `<span class="pet-hlabel">${escapeHtml(e.label)}</span></li>`;
    }).join('')}</ol>`;
  },
  onSheetClick(e) {
    const t = e.target.closest('[data-pact]');
    if (!t || t.disabled) return;
    const a = t.dataset.pact;
    if (a === 'choose') {
      this.resolve(+t.dataset.pid, t.dataset.cid);
    } else if (a === 'locate') {
      const p = this.get(+t.dataset.pid);
      if (!p) return;
      const b = p.data.bid ? getB(p.data.bid) : null;
      const v = petLiving(p.petitioner.id);
      if (b) { UI.closeSheet(); UI.select({ b }); UI.focusOn(b.x + b.w / 2, b.y + b.h / 2); }
      else if (v) { UI.closeSheet(); UI.select({ u: v }); if (!v.inside) UI.focusOn(v.x, v.y); else { const h = getB(v.insideB); if (h) UI.focusOn(h.x + h.w / 2, h.y + h.h / 2); } }
    } else if (a === 'goto') {
      const b = getB(+t.dataset.bid);
      if (b) { UI.closeSheet(); UI.select({ b }); UI.focusOn(b.x + b.w / 2, b.y + b.h / 2); }
    }
  },
};

// 창을 열 때 무엇이 새로 왔는지 기억해 둔다
Bus.on('sheetOpen', kind => {
  if (kind !== 'petitions' || !S || !S.petitions) return;
  Petitions._seenAtOpen = S.petitions.seen;
  if (S.petitions.list.length) S.petitions.seen = Math.max(S.petitions.seen, ...S.petitions.list.map(p => p.id));
});
Bus.on('sheetClose', kind => { if (kind === 'petitions') Petitions._shown = []; });
// ui.js 가 읽힌 뒤 창을 등록한다
document.addEventListener('DOMContentLoaded', () => Petitions.ensureUI());
