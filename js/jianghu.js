'use strict';
// ───────────────────────────────────────────────
// 강호(江湖): 천하의 세력과 힘, 이웃, 전쟁, 의뢰와 파견, 외교, 산하·동맹의 혜택
// 설계는 docs/jianghu.md §4~§7. 저장 상태는 S.jh (순수 JSON).
// makeWorld·siteInfo 는 S 없이 씨앗만으로 돈다(새 게임 고르기 화면에서 미리 본 천하가 실제와 같게).
// 시간: v.away.until·Quest.back 은 S.time, 나머지 끝날(expires·spies·trade·grudge·cd·dead·day)은 dayOf()
// ───────────────────────────────────────────────
const JH = (() => {
  const OLD_NEAR = ['cheongun', 'cheolhyeol', 'heukpung', 'hyeolwol', 'gwanbu', 'geumryong'];   // 옛 저장의 이웃
  const LOCAL = ['heukpung', 'gwanbu'];
  const HALF = { forest: 0.5, water: 0.5, hills: 0.5, fertile: 0.5, cold: 0.5 };
  // 혜택 접기: 더하는 값. 그 밖(heroEvery 빼고)은 곱하는 값이다 (train atk hp tax trade bandit fish escort)
  const ADD = new Set(['happy', 'fame', 'dailySilver', 'gwanRel', 'petitionDays', 'tournament']);
  // 갈래 건물의 혜택 (§8.4). 쓸 수 있고, 지금 갈래의 것이고, 일꾼이 하나 이상일 때만 접힌다
  const BLD_PERK = {
    hall_jeong: { train: 1.25, fame: 0.5 },
    altar_ma: { atk: 1.15, dailySilver: 0.2, happy: -3 },
    ancestral: { heroEvery: 10, fame: 0.4 },
    blackmarket: { gwanRel: -0.5 },
    gambling: { happy: -1 },
    horsemarket: { hp: 1.1 },
    yamen: { tax: 1.1, happy: 3, petitionDays: 1 },
    stage: { fame: 0.6, tournament: 1 },
  };
  const BLD_HAPPY = { altar_ma: '혈제단의 피비린내', gambling: '도박장의 소란', yamen: '관아의 다스림' };
  const CAMP_HAPPY = { jeong: '정파의 비호', ma: '마교의 그늘' };
  // 의뢰 종류와 계열에 어울리는 종류 (§6)
  const QUEST_KIND = {
    escort: { name: '호위', risk: 0.15 }, suppress: { name: '토벌', risk: 0.3 }, scout: { name: '정탐', risk: 0.12 },
    retrieve: { name: '탈환', risk: 0.22 }, war: { name: '원군', risk: 0.4 }, assassin: { name: '암살', risk: 0.42 },
    smuggle: { name: '밀수', risk: 0.25 }, herb: { name: '약재', risk: 0.1 },
  };
  const CAMP_QUESTS = {
    jeong: ['suppress', 'scout', 'war'], gwan: ['suppress', 'scout', 'war'], sega: ['retrieve', 'escort', 'war'],
    heuk: ['smuggle', 'assassin', 'scout'], sa: ['smuggle', 'assassin', 'scout'], ma: ['assassin', 'war'],
    saeoe: ['herb', 'escort'], sang: ['escort', 'herb'],
  };
  const TRADE_CAMPS = ['sang', 'saeoe', 'sega'];
  const BOUNTY_CAMPS = ['heuk', 'sa', 'ma'];

  const fac = id => FACTIONS[id];
  const campOf = id => (FACTIONS[id] ? FACTIONS[id].camp : null);
  const site = () => (S && S.jh && SITES[S.jh.site]) || SITES.henan_field;
  const gap = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : Infinity);
  const alive = id => !!(S && S.jh && FACTIONS[id] && S.jh.dead[id] === undefined);
  const isRival = (a, b) => RIVALRIES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const names = ids => ids.map(id => fac(id).name).join('·');
  const strSeed = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const allowFn = () => M.allowJianghu();

  // 갈래 건물이 지금 혜택을 내는가
  function bldOn(b) {
    const def = BDEF[b.type];
    if (!BLD_PERK[b.type] || !usable(b) || !b.active || def.route !== S.jh.route) return false;
    return (b._workers || []).some(v => !v.away && !v.dead);
  }
  // 힘의 바닥: 흑풍채·주군 25, 관부 10 (이야기가 부를 때는 없다)
  function floorOf(id) { return id === 'gwanbu' ? 10 : (id === 'heukpung' || id === S.vassal) ? 25 : 0; }
  function setPower(id, p) {
    const jh = S.jh;
    if (jh.dead[id] !== undefined) return;
    p = clamp(Number.isFinite(p) ? p : 0, 0, 200);
    jh.power[id] = Math.max(p, floorOf(id));
    if (jh.power[id] <= 0) M.dissolve(id);
  }
  // 하루에 하나까지, 그 사건을 events.js 가 만들어 두었을 때만 띄운다 (없는 id 는 조용히 건너뛴다)
  function scroll(id, data) {
    const jh = S.jh;
    if (!allowFn() || jh.lastScroll === dayOf() || typeof EV === 'undefined' || !EV[id]) return false;
    jh.lastScroll = dayOf();
    S.eventQueue.push({ id, data });
    return true;
  }
  function blank(site, seed) {
    return {
      v: 1, site, seed, seats: {}, power: {}, dead: {}, near: [], wars: [], news: [], hist: [], quests: [], qlog: [], pacts: [],
      route: null, routeSwitches: 0, spies: {}, trade: {}, grudge: {}, cd: {}, lastScroll: -1, nextWarCheck: 3, victory: null,
      seq: 0, mark: {}, vacant: [], heroAcc: 0,
    };
  }
  function fresh(key, seed, w, info, near) {
    const jh = blank(key, seed);
    jh.seats = Object.assign({}, w.seats, info.localSeats);
    jh.power = Object.assign({}, w.power);
    for (const id of LOCAL) jh.power[id] = FACTIONS[id].power;
    jh.near = near.slice();
    return jh;
  }
  function recordHist() {
    const jh = S.jh, d = dayOf(), camp = {};
    for (const c of CAMP_ORDER) camp[c] = 0;
    for (const id of FACTION_ORDER) if (alive(id)) camp[campOf(id)] += jh.power[id];
    for (const c in camp) camp[c] = Math.round(camp[c]);
    if (jh.hist.length && jh.hist[jh.hist.length - 1].day === d) jh.hist.pop();
    jh.hist.push({ day: d, camp });
    while (jh.hist.length > 12) jh.hist.shift();
  }
  function warName(a, b) {
    const ca = campOf(a), cb = campOf(b);
    const pair = (x, ys) => (ca === x && ys.includes(cb)) ? 1 : (cb === x && ys.includes(ca)) ? -1 : 0;
    let s;
    if ((s = pair('jeong', ['ma']))) return { name: '정마대전', swap: s < 0 };
    if ((s = pair('jeong', ['sa', 'heuk']))) return { name: '정사대전', swap: s < 0 };
    if ((s = pair('gwan', ['heuk', 'sa']))) return { name: '토벌전', swap: s < 0 };
    if ((s = pair('saeoe', ['gwan', 'jeong']))) return { name: '새외 침공', swap: s < 0 };
    if (ca === 'sega' && cb === 'sega') return { name: '세가 분쟁', swap: false };
    if (ca === 'heuk' && cb === 'heuk') return { name: '흑도 쟁패', swap: false };
    const A = fac(a).name, B = fac(b).name;
    return { name: `${A}${pp(A, '과/와')} ${B}의 싸움`, swap: false };
  }

  // 혜택 기억: 주군·동맹·갈래·건물·날이 바뀌면 다시 셈한다
  let ver = 0;
  const memo = { S: null, ver: -1, day: -1, lord: null, route: null, np: -1, site: null, vals: {} };
  function perks() {
    if (!S || !S.jh) return {};
    const jh = S.jh, d = dayOf();
    if (memo.S === S && memo.ver === ver && memo.day === d && memo.lord === S.vassal && memo.route === jh.route && memo.np === jh.pacts.length && memo.site === jh.site) return memo.vals;
    const vals = {};
    let rate = 0;
    const fold = (p, half) => {
      for (const k in p) {
        const x = p[k];
        if (typeof x !== 'number') continue;   // aid 는 접지 않는다 (원군은 aidFor)
        if (k === 'heroEvery') { if (x > 0) rate += 1 / (half ? x * 2 : x); }
        else if (ADD.has(k)) vals[k] = (vals[k] || 0) + (half ? x / 2 : x);
        else vals[k] = (vals[k] === undefined ? 1 : vals[k]) * (half ? 1 + (x - 1) / 2 : x);
      }
    };
    const seen = new Set();
    if (S.vassal && fac(S.vassal)) { const c = campOf(S.vassal); seen.add(c); fold(CAMPS[c].perk, false); }
    // 동맹은 절반. 주군(또는 앞의 동맹)과 같은 계열이면 겹치지 않는다
    for (const id of jh.pacts) { const c = campOf(id); if (!c || seen.has(c)) continue; seen.add(c); fold(CAMPS[c].perk, true); }
    fold((site().trait && site().trait.perk) || {}, false);
    for (const b of S.buildings) if (bldOn(b)) fold(BLD_PERK[b.type], false);
    vals.heroEvery = rate > 0 ? 1 / rate : 0;
    Object.assign(memo, { S, ver, day: d, lord: S.vassal, route: jh.route, np: jh.pacts.length, site: jh.site, vals });
    return vals;
  }
  for (const ev of ['vassal', 'pactChanged', 'routeChosen', 'built', 'destroyed', 'demolished', 'repairStarted', 'siteChosen', 'day']) Bus.on(ev, () => { ver++; });

  const M = {
    // ━━ 순수 함수 (S 없이) ━━
    // 스물네 세력(local 빼고)의 본산 자리와 처음 힘
    makeWorld(seed) {
      const r = mulberry32((seed | 0) + 0x2c1b3d);
      const seats = {}, power = {}, placed = [];
      for (const id of FACTION_ORDER) {
        const F = FACTIONS[id];
        if (F.home === 'local') continue;
        const R = REGIONS[F.home];
        let p = null;
        for (let k = 0; k < 8; k++) {   // 같은 지역의 본산끼리 겹치지 않게
          p = { x: Math.round(clamp(R.x + (r() * 2 - 1) * 40, 16, 984)), y: Math.round(clamp(R.y + (r() * 2 - 1) * 40, 16, 684)) };
          if (placed.every(q => gap(p, q) >= 26)) break;
        }
        placed.push(p);
        seats[id] = p;
        power[id] = Math.round(F.power * (0.8 + r() * 0.4));
      }
      return { seed, seats, power };
    },
    // 그 고을에서 시작하면: 이웃, 고을 곁 본산 둘(흑풍채 북쪽, 관부 서쪽 관도), 별, 열리는 갈래(이웃 넷의 계열 + 관), 첫 관계
    siteInfo(world, key) {
      const st = SITES[key] || SITES.henan_field;
      const r = mulberry32((world.seed | 0) ^ strSeed(key));
      const at = (deg, spread) => {
        const a = (deg + (r() * 2 - 1) * spread) * Math.PI / 180, d = 40 + r() * 20;
        return { x: Math.round(st.x + Math.cos(a) * d), y: Math.round(st.y + Math.sin(a) * d) };
      };
      const localSeats = { heukpung: at(-90, 20), gwanbu: at(180, 20) };
      const near = ['heukpung', 'gwanbu', ...st.near, st.sang];
      const routes = CAMP_ORDER.filter(c => c === 'gwan' || st.near.some(id => campOf(id) === c));
      const rel = {};
      for (const id of FACTION_ORDER) rel[id] = near.includes(id) ? FACTIONS[id].startRel + (FACTIONS[id].home === st.region ? 10 : 0) : 0;
      return { near, localSeats, stars: st.stars, routes, rel };
    },

    // ━━ 새 게임·불러오기 ━━
    newWorld(key, seed) {
      if (!SITES[key]) key = 'henan_field';
      const w = this.makeWorld(seed), info = this.siteInfo(w, key);
      S.jh = fresh(key, seed, w, info, info.near);
      S.factions = {};
      for (const id of FACTION_ORDER) S.factions[id] = { rel: info.rel[id], threat: id === 'heukpung' ? 35 : 0 };
      recordHist();
      this.attachExits();
      ver++;
    },
    // 옛 저장(S.jh 없음): 낙수 들녘, 천하는 S.seed 로, 이웃은 옛 여섯 그대로. 옛 관계·위협·산하·점령은 손대지 않는다
    migrate() {
      const seed = S.seed | 0, w = this.makeWorld(seed), info = this.siteInfo(w, 'henan_field');
      S.jh = fresh('henan_field', seed, w, info, OLD_NEAR);
      S.jh.nextWarCheck = dayOf() + 3;
      if (!S.factions) S.factions = {};
      for (const id of FACTION_ORDER) if (!S.factions[id]) S.factions[id] = { rel: 0, threat: 0 };
      recordHist();
    },
    onLoad() {
      if (!S.jh || typeof S.jh !== 'object') this.migrate();
      const jh = S.jh, b = blank(jh.site, jh.seed);
      for (const k in b) if (jh[k] === undefined || (jh[k] === null && k !== 'route' && k !== 'victory')) jh[k] = b[k];
      if (!SITES[jh.site]) jh.site = 'henan_field';
      // 뒤에 더해진 세력, 망가진 수
      const w = this.makeWorld(jh.seed), info = this.siteInfo(w, jh.site);
      for (const id of FACTION_ORDER) {
        if (!jh.seats[id]) jh.seats[id] = w.seats[id] || info.localSeats[id];
        if (!Number.isFinite(jh.power[id])) jh.power[id] = jh.dead[id] !== undefined ? 0 : (w.power[id] || FACTIONS[id].power);
        if (!S.factions[id]) S.factions[id] = { rel: 0, threat: 0 };
        const f = S.factions[id];
        if (!Number.isFinite(f.rel)) f.rel = 0;
        if (!Number.isFinite(f.threat)) f.threat = 0;
      }
      jh.near = jh.near.filter((id, i) => FACTIONS[id] && jh.near.indexOf(id) === i);
      jh.pacts = jh.pacts.filter(id => FACTIONS[id] && id !== S.vassal);
      // 파견자: 이어 줄 의뢰가 없으면 돌려보낸다
      for (const v of S.villagers) if (v.away && !jh.quests.some(q => q.id === v.away.q && q.state === 'away')) unitsReturn(v);
      this.attachExits();
      ver++;
    },
    // 길목마다 그 방향 이웃 (World.exits 는 genWorld 가 새로 만들므로 불러올 때마다 다시 붙인다)
    attachExits() {
      if (!S || !S.jh) return;
      for (const ex of World.exits) ex.toward = [];
      for (const id of S.jh.near) { const ex = World.exits[this.exitFor(id)[0]]; if (ex) ex.toward.push(id); }
    },

    // ━━ 조회 ━━
    allowJianghu() {
      if (typeof Story === 'undefined') return true;
      const h = hook(Story, 'allowJianghu');
      if (h !== undefined) return !!h;
      // 이야기 모듈에 훅이 아직 없을 때: 제3장(index 2) 이상, 또는 안내를 건너뛰고 8일째부터 (§0.1)
      const st = S && S.story;
      if (!st) return true;
      return st.chapter >= 2 || (!!st.skipped && dayOf() >= 8);
    },
    near() { return S && S.jh ? S.jh.near.slice() : OLD_NEAR.slice(); },
    isNear(id) { return !!(S && S.jh && S.jh.near.includes(id)); },
    campOf,
    isAlive: alive,
    // 그 계열 이웃 하나 (camp: 키·배열·null=아무 계열). 없으면 null
    pickNear(camp, filter) {
      if (!S || !S.jh) return null;
      const cs = camp == null ? null : [].concat(camp);
      const ids = S.jh.near.filter(id => alive(id) && (!cs || cs.includes(campOf(id))) && (!filter || filter(id)));
      return ids.length ? pick(ids) : null;
    },
    biome() { return (S && S.jh && SITES[S.jh.site] && SITES[S.jh.site].biome) || HALF; },
    trait() { return (S && S.jh && SITES[S.jh.site] && SITES[S.jh.site].trait) || {}; },
    power(id) { return S && S.jh ? Math.round(S.jh.power[id] || 0) : 0; },

    // 혜택 (§5): 곱하는 값은 기본 1, 더하는 값·heroEvery 는 기본 0
    perk(name) {
      const v = perks()[name];
      if (v !== undefined) return v;
      return (name === 'heroEvery' || ADD.has(name)) ? 0 : 1;
    },
    happinessFactors() {
      if (!S || !S.jh) return [];
      const out = [], seen = new Set();
      const line = (id, half) => {
        const c = campOf(id);
        if (!c || seen.has(c)) return;
        seen.add(c);
        const v = (CAMPS[c].perk.happy || 0) * (half ? 0.5 : 1);
        if (v) out.push([`${CAMP_HAPPY[c] || CAMPS[c].name + (v > 0 ? '의 비호' : '의 그늘')}(${fac(id).name})`, v]);
      };
      if (S.vassal && fac(S.vassal)) line(S.vassal, false);
      for (const id of S.jh.pacts) line(id, true);
      for (const b of S.buildings) if (bldOn(b) && BLD_PERK[b.type].happy) out.push([BLD_HAPPY[b.type] || BDEF[b.type].name, BLD_PERK[b.type].happy]);
      return out;
    },

    // 습격이 들어오는 길목 번호 (좋은 순서). World.exits 는 늘 [서 0, 동 1, 북 2, 남 3]
    exitFor(id) {
      if (id === 'heukpung') return [2, 0];   // 튜토리얼이 북쪽 길목을 쓴다
      const jh = S && S.jh, seat = jh && jh.seats[id];
      if (!seat) return [0, 1, 2, 3];
      const st = SITES[jh.site] || SITES.henan_field;
      const dx = seat.x - st.x, dy = seat.y - st.y;
      const h = dx < 0 ? 0 : 1, v = dy < 0 ? 2 : 3;
      return Math.abs(dx) > Math.abs(dy) ? [h, v] : [v, h];
    },
    // 습격 때 오는 원군 한 무리: 주군이 먼저, 없으면 전쟁 중이 아닌 동맹 하나가 절반 규모로
    aidFor(k) {
      const n = Math.min(3 + Math.floor(dayOf() / 6), 10);
      const can = id => id && id !== k && fac(id) && fac(id).military && CAMPS[campOf(id)].perk.aid && (!S.jh || alive(id));
      if (can(S.vassal)) return { id: S.vassal, n };
      if (!S.jh) return null;
      for (const id of S.jh.pacts) if (can(id) && !this.warOf(id)) return { id, n: Math.max(2, Math.round(n / 2)) };
      return null;
    },
    // 고을 성질로 따로 오는 원군 (요하 변성의 진북군)
    siteAid(k) {
      const id = this.trait().aid;
      if (!id || id === k || id === S.vassal || !fac(id) || !fac(id).military || !alive(id) || rel(id) < -20) return null;
      return { id, n: Math.max(2, Math.round(Math.min(3 + Math.floor(dayOf() / 6), 10) / 2)) };
    },
    // 관계 번짐: Y 의 관계가 d × CAMP_ATT / 100 × 0.5 만큼 (독립 갈래면 절반). k 자신과 noLord 는 뺀다
    relSpread(k, d) {
      const c = campOf(k);
      if (!c || !d) return;
      const m = d * 0.5 / 100 * (S.jh && S.jh.route === 'free' ? 0.5 : 1);
      for (const y in S.factions) {
        if (y === k || !fac(y) || fac(y).noLord) continue;
        const x = m * CAMP_ATT[c][campOf(y)];
        if (x) changeRel(y, x);
      }
    },

    // ━━ 하루·시각 ━━
    daily() {
      const jh = S && S.jh;
      if (!jh) return;
      const d = dayOf(), allow = this.allowJianghu();
      // 힘의 자연 성장 (로지스틱)
      for (const id of FACTION_ORDER) {
        if (jh.dead[id] !== undefined) continue;
        const p = jh.power[id];
        setPower(id, p + fac(id).growth * 3 * (1 - p / 200) * rnd(0.5, 1.5));
      }
      // 열흘에 +30 넘게 오른 세력
      for (const id of FACTION_ORDER) {
        if (!alive(id)) { delete jh.mark[id]; continue; }
        const p = jh.power[id], mk = jh.mark[id];
        if (!mk || d - mk[0] >= 10) jh.mark[id] = [d, Math.round(p)];
        else if (p - mk[1] > 30) {
          jh.mark[id] = [d, Math.round(p)];
          if (allow) {
            this.news(`${fac(id).name}의 기세가 무섭게 오른다. 열흘 사이 힘이 크게 불었다.`, 'surge', [id]);
            if (this.isNear(id)) scroll('jh_surge', { f: id });
          }
        }
      }
      if (allow) {
        // 멸문 30일 뒤 재기
        for (const id in jh.dead) {
          if (d - jh.dead[id] < 30 || !chance(0.3)) continue;
          delete jh.dead[id];
          jh.power[id] = 30;
          this.news(`${fac(id).name}${pp(fac(id).name, '이/가')} 잿더미 속에서 다시 일어섰다.`, 'rise', [id]);
        }
        // 멸문한 이웃의 빈자리 (열흘 뒤)
        jh.vacant = jh.vacant.filter(due => { if (due > d) return true; this.fillSeat(); return false; });
      }
      // 전쟁: 날마다 점수, 사흘마다 새 전쟁
      for (const w of jh.wars.slice()) {
        if (!jh.wars.includes(w)) continue;
        w.score += (this.sidePower(w, 'a') - this.sidePower(w, 'b')) / 80 + rnd(-0.8, 0.8);
        if (Math.abs(w.score) >= 10) this.endWar(w, w.score > 0 ? 'a' : 'b', 'rout');
        else if (d - w.since >= 20) this.endWar(w, w.score > 0 ? 'a' : w.score < 0 ? 'b' : null, 'timeout');
      }
      if (allow && d >= jh.nextWarCheck) {
        jh.nextWarCheck = d + 3;
        if (jh.wars.length < 3 && chance(0.6)) { const c = this.warCandidate(); if (c) this.startWar([c[0]], [c[1]]); }
      }
      // 의뢰: 기한 지난 것 거두기, 새로 붙이기
      jh.quests = jh.quests.filter(q => q.state !== 'open' || (q.expires > d && alive(q.fid)));
      if (allow) this.genQuests();
      // 첩자·교역·원한·대기의 끝날
      for (const m of [jh.spies, jh.grudge, jh.cd]) for (const k in m) if (m[k] <= d) delete m[k];
      for (const id in jh.trade) {
        if (jh.trade[id] <= d || !alive(id)) { delete jh.trade[id]; continue; }
        addRes('silver', 2 + countType('market') * 2);
      }
      // 관계 30 아래로 떨어진 동맹은 깨진다
      for (const id of jh.pacts.slice()) {
        if (alive(id) && rel(id) >= 30) continue;
        jh.pacts = jh.pacts.filter(x => x !== id);
        logMsg(`${fac(id).name}${pp(fac(id).name, '과/와')}의 동맹이 깨졌다.`, 'bad');
        Bus.emit('pactChanged', id, false);
      }
      // 고을 성질과 혜택의 날마다 몫
      const ds = this.perk('dailySilver');
      if (ds) addRes('silver', ds * popCount());
      const fm = this.perk('fame');
      if (fm) addFame(fm);
      const gr = this.perk('gwanRel');
      if (gr && S.factions.gwanbu) changeRel('gwanbu', gr);
      const he = this.perk('heroEvery');
      if (he > 0) {
        jh.heroAcc = (jh.heroAcc || 0) + 1 / he;
        if (jh.heroAcc >= 1) { jh.heroAcc -= 1; this.sendHero(); }
      }
      if (d % 5 === 0) recordHist();
    },
    hourly() {
      const jh = S && S.jh;
      if (!jh) return;
      for (const k in S.factions) { const f = S.factions[k]; if (f.threat > 100) f.threat = 100; else if (!(f.threat >= 0)) f.threat = 0; }
      // 기한이 지난 열린 의뢰는 그날 자정에 거둔다 (묘시의 daily 를 기다리지 않는다)
      if (jh.quests.some(q => q.state === 'open' && q.expires <= dayOf())) jh.quests = jh.quests.filter(q => q.state !== 'open' || q.expires > dayOf());
      for (const q of jh.quests.slice()) if (q.state === 'away' && S.time >= q.back) this.questReturn(q);
    },

    // ━━ 소식 ━━
    news(text, kind = '', f = []) {
      const jh = S && S.jh;
      if (!jh) return null;
      const item = { day: dayOf(), text, kind, f: f.slice() };
      jh.news.unshift(item);
      if (jh.news.length > 40) jh.news.length = 40;
      Bus.emit('jhNews', item);
      // 이웃이 얽힌 큰 소식은 마을 기록과 알림으로도
      if (f.some(id => jh.near.includes(id)) && this.allowJianghu()) { logMsg(text, 'war'); UI.toast(text, ''); }
      return item;
    },

    // ━━ 멸문·빈자리·세가 객경 ━━
    dissolve(id, opts = {}) {
      const jh = S && S.jh;
      if (!jh || !fac(id) || jh.dead[id] !== undefined) return false;
      if (!opts.story && floorOf(id) > 0) { jh.power[id] = Math.max(jh.power[id], floorOf(id)); return false; }
      const d = dayOf(), F = fac(id), wasNear = jh.near.includes(id);
      jh.power[id] = 0;
      jh.dead[id] = d;
      if (wasNear) {
        jh.near = jh.near.filter(x => x !== id);
        if (!LOCAL.includes(id)) jh.vacant.push(d + 10);
        this.attachExits();
      }
      for (const w of jh.wars.slice()) {
        const s = this.sideOf(w, id);
        if (!s) continue;
        w[s] = w[s].filter(x => x !== id);
        if (!w[s].length) this.endWar(w, s === 'a' ? 'b' : 'a', 'fall');
      }
      // 걸린 습격과 원군을 거둔다
      S.scheduled = S.scheduled.filter(s => !((s.kind === 'raid' || s.kind === 'allies') && s.faction === id));
      S.eventQueue = S.eventQueue.filter(e => !(e.id === '_raid' && e.data && e.data.k === id && e !== UI.modalEntry));
      if (S.factions[id]) S.factions[id].threat = 0;
      if (S.vassal === id) {
        S.vassal = null;
        logMsg(`주군 ${F.name}${pp(F.name, '이/가')} 무너졌다. 마을은 다시 누구의 산하도 아니다.`, 'war');
        Bus.emit('vassal', null);
      }
      if (jh.pacts.includes(id)) { jh.pacts = jh.pacts.filter(x => x !== id); Bus.emit('pactChanged', id, false); }
      if (S.occupation && S.occupation.faction === id) {
        S.occupation = null;
        for (const e of S.enemies) { e.garrison = false; e.flee = true; e.path = null; }
        logMsg(`${F.name}${pp(F.name, '이/가')} 무너지자 점령군이 달아났다. 마을을 되찾았다.`, 'good');
        Bus.emit('liberated', 'dissolve');
        markDirty();
      }
      // 그 세력의 의뢰: 열린 것은 거두고, 다녀오는 중인 것은 헛걸음이 된다
      jh.quests = jh.quests.filter(q => q.state !== 'open' || (q.fid !== id && q.target !== id));
      for (const q of jh.quests) if (q.fid === id) q.void = true;
      delete jh.spies[id]; delete jh.trade[id]; delete jh.grudge[id];
      this.news(`${F.name}${pp(F.name, '이/가')} 멸문했다.`, 'fall', [id]);
      if (wasNear) scroll('jh_survivors', { f: id });
      ver++;
      return true;
    },
    // 그 고을에서 영향(power / (1 + (d/120)^2))이 가장 크고 같은 계열이 아직 이웃에 없는 세력이 들어온다
    fillSeat() {
      const jh = S.jh, st = site();
      const camps = new Set(jh.near.map(campOf));
      let best = null, bi = -1;
      for (const id of FACTION_ORDER) {
        if (fac(id).home === 'local' || jh.near.includes(id) || !alive(id) || camps.has(campOf(id))) continue;
        const inf = jh.power[id] / (1 + (gap(jh.seats[id], st) / 120) ** 2);
        if (inf > bi) { bi = inf; best = id; }
      }
      if (!best) return null;
      jh.near.push(best);
      this.attachExits();
      this.news(`새 세력이 빈자리를 차지했다. ${fac(best).name}${pp(fac(best).name, '이/가')} 이제 ${S.name}의 이웃이다.`, 'seat', [best]);
      ver++;
      return best;
    },
    sendHero() {
      const jh = S.jh;
      if (typeof makeHero !== 'function' || S.occupation || S.villagers.filter(v => v.hero && !v.dead).length >= 6) return null;
      const src = [S.vassal, ...jh.pacts].find(id => id && campOf(id) === 'sega' && alive(id))
        || jh.near.find(id => campOf(id) === 'sega' && alive(id)) || FACTION_ORDER.find(id => campOf(id) === 'sega' && alive(id));
      if (!src) return null;
      const h = makeHero({ upkeepMul: 0.6 });
      const ex = World.exits[this.exitFor(src)[0]] || World.exits[0];
      const v = spawnHero(h, ex);
      const F = fac(src);
      logMsg(`${F.name}에서 보낸 ${h.hero.title} ${h.hero.epithet} ${h.name}${pp(h.name, '이/가')} 객경으로 왔다.`, 'good');
      UI.toast(`${F.name}의 무인이 객경으로 왔다`, 'good');
      return v;
    },

    // ━━ 전쟁 ━━
    warOf(id) { return S && S.jh ? S.jh.wars.find(w => w.a.includes(id) || w.b.includes(id)) || null : null; },
    warById(wid) { return S && S.jh ? S.jh.wars.find(w => w.id === wid) || null : null; },
    sideOf(w, id) { return w.a.includes(id) ? 'a' : w.b.includes(id) ? 'b' : null; },
    sidePower(w, s) { return w[s].reduce((t, id) => t + (S.jh.power[id] || 0), 0); },
    // 사흘마다 따지는 새 전쟁 후보: 거리 400 안, 계열 감정 −40 이하 또는 숙적 (가중치 0.4)
    warCandidate() {
      const jh = S.jh;
      const busy = new Set(jh.wars.flatMap(w => w.a.concat(w.b)));
      const mine = new Set([S.vassal, ...jh.pacts].filter(Boolean));
      const ids = FACTION_ORDER.filter(id => fac(id).military && alive(id) && !busy.has(id) && (jh.route || !LOCAL.includes(id)));
      const cands = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        if (gap(jh.seats[a], jh.seats[b]) > 400) continue;
        const rival = isRival(a, b), att = CAMP_ATT[campOf(a)][campOf(b)];
        if (att > -40 && !rival) continue;
        let w = rival ? 0.4 : -att / 100;
        w *= 0.5 + (fac(a).temper.aggro + fac(b).temper.aggro) / 2;
        if (mine.has(a) || mine.has(b)) w *= 0.5;
        if (jh.near.includes(a) || jh.near.includes(b)) w *= 1.5;   // 곁의 싸움이 조금 더 잦다
        cands.push([a, b, w]);
      }
      return weighted(cands, c => c[2]);
    },
    startWar(aIds, bIds, name, opts = {}) {
      const jh = S && S.jh;
      if (!jh) return null;
      let a = [].concat(aIds).filter(id => alive(id)), b = [].concat(bIds).filter(id => alive(id) && !a.includes(id));
      a = a.filter((id, i) => a.indexOf(id) === i); b = b.filter((id, i) => b.indexOf(id) === i);
      if (!a.length || !b.length) return null;
      if (!name) { const wn = warName(a[0], b[0]); name = wn.name; if (wn.swap) [a, b] = [b, a]; }
      const sa = jh.seats[a[0]], sb = jh.seats[b[0]];
      const front = opts.front ? { x: Math.round(opts.front.x), y: Math.round(opts.front.y) }
        : { x: Math.round((sa.x + sb.x) / 2), y: Math.round((sa.y + sb.y) / 2) };
      const war = { id: 'w' + (++jh.seq), a, b, name, since: dayOf(), score: 0, mine: { a: 0, b: 0 }, front, scripted: !!opts.scripted };
      jh.wars.push(war);
      this.news(`${name}: ${names(a)}${pp(names(a), '과/와')} ${names(b)}${pp(names(b), '이/가')} 칼을 맞댔다.`, 'war', a.concat(b));
      Bus.emit('warStart', war);
      const pact = jh.pacts.find(id => a.includes(id) || b.includes(id));
      if (pact) scroll('jh_pact_call', { war: war.id, f: pact });
      else if (a.concat(b).some(id => jh.near.includes(id))) scroll('jh_war_sides', { war: war.id });
      return war;
    },
    // 영주의 몫은 낸 그때 점수에 바로 더해지고 줄지 않는다. mine 은 보여 주기용
    addScore(w, side, amt, mine = true) {
      if (typeof w === 'string') w = this.warById(w);
      if (!w || (side !== 'a' && side !== 'b') || !Number.isFinite(amt)) return;
      w.score += side === 'a' ? amt : -amt;
      if (mine) w.mine[side] = Math.round((w.mine[side] + amt) * 100) / 100;
      if (Math.abs(w.score) >= 10) this.endWar(w, w.score > 0 ? 'a' : 'b', 'rout');
    },
    // winner: 'a' | 'b' | null(무승부). how: 'rout'(|점수| 10) · 'timeout'(20일) · 'fall'(한쪽 멸문) · 'mediate'
    endWar(w, winner, how = 'rout') {
      const jh = S.jh;
      if (typeof w === 'string') w = this.warById(w);
      const i = w ? jh.wars.indexOf(w) : -1;
      if (i < 0) return;
      jh.wars.splice(i, 1);
      w.ended = dayOf();
      if (winner) {
        const lose = winner === 'a' ? 'b' : 'a';
        for (const id of w[winner]) setPower(id, jh.power[id] * 1.15);
        for (const id of w[lose]) setPower(id, jh.power[id] * (how === 'timeout' ? 0.85 : 0.7));
        const W = names(w[winner]) || '한쪽';
        this.news(`${w.name}${pp(w.name, '이/가')} 끝났다. ${W}${pp(W, '이/가')} 이겼다.`, 'warEnd', w.a.concat(w.b));
      } else this.news(`${w.name}${pp(w.name, '이/가')} 승부 없이 끝났다.`, 'warEnd', w.a.concat(w.b));
      Bus.emit('warEnd', w, winner);
    },

    // ━━ 의뢰 (§6) ━━
    questCap() { return 3 + (countType('inn') ? 1 : 0) + (countType('escort') ? 1 : 0); },
    partyCap() { return S.rank >= 3 ? 3 : S.rank >= 2 ? 2 : 1; },
    badge() { return S && S.jh ? S.jh.quests.filter(q => q.state === 'open').length : 0; },
    quest(qid) { return S && S.jh ? S.jh.quests.find(q => q.id === qid) || null : null; },
    genQuests() {
      const jh = S.jh;
      const open = () => jh.quests.filter(q => q.state === 'open');
      const rc = jh.route && jh.route !== 'free' && CAMPS[jh.route] ? jh.route : null;
      // 갈래 계열 의뢰는 늘 하나 이상 열려 있다
      if (rc && !open().some(q => campOf(q.fid) === rc)) this.makeQuest(this.questIssuer(rc));
      let n = chance(0.5) ? 1 : chance(0.5) ? 2 : 0;   // 평균 하루 하나
      while (n-- > 0 && open().length < this.questCap()) {
        if (!this.makeQuest(this.questIssuer(rc && chance(0.4) ? rc : null))) break;
      }
    },
    questIssuer(camp) {
      const jh = S.jh;
      const ok = id => alive(id) && !fac(id).noLord && rel(id) > -40 && (!camp || campOf(id) === camp);
      let pool = jh.near.filter(ok);
      if (camp && !pool.length) pool = FACTION_ORDER.filter(ok);   // 갈래 계열은 멀어도 낸다
      else if (!camp && countType('inn') + countType('escort') > 0 && chance(0.25)) {
        const far = FACTION_ORDER.filter(id => ok(id) && !jh.near.includes(id));
        if (far.length) pool = far;
      }
      return pool.length ? pick(pool) : null;
    },
    // 그 세력이 치고 싶어 하는 상대 (이웃이 먼저). 주군·동맹은 빼다
    foeFor(fid) {
      const jh = S.jh, c = campOf(fid);
      const ok = id => id !== fid && alive(id) && fac(id).military && id !== S.vassal && !jh.pacts.includes(id)
        && (CAMP_ATT[c][campOf(id)] <= -40 || isRival(fid, id));
      const nearFoes = jh.near.filter(ok);
      if (nearFoes.length) return pick(nearFoes);
      const far = FACTION_ORDER.filter(id => ok(id) && gap(jh.seats[id], jh.seats[fid]) <= 400);
      return far.length ? pick(far) : null;
    },
    makeQuest(fid, kind) {
      if (!fid || !fac(fid)) return null;
      const jh = S.jh, F = fac(fid), war = this.warOf(fid);
      const foe = this.foeFor(fid);
      const kinds = (CAMP_QUESTS[F.camp] || []).filter(k => (k !== 'war' || war) && ((k !== 'suppress' && k !== 'assassin') || foe));
      if (kind && !kinds.includes(kind)) return null;
      if (!kinds.length) return null;
      const tq = this.trait().quest || {};
      kind = kind || weighted(kinds, k => tq[k] || 1);
      const target = kind === 'war' ? war.id : (kind === 'suppress' || kind === 'assassin' || kind === 'scout') ? foe : null;
      const T = target && fac(target) ? fac(target) : null;
      const n = kind === 'war' ? rndi(2, 4) : rndi(1, 3);
      const days = kind === 'war' ? 4 : rndi(1, 3);
      // 한 사람에 권하는 무공: 처음엔 삼류~이류, 두 달쯤이면 이류~일류 (원군은 조금 더)
      const per = clamp(0.5 + dayOf() / 50 + rnd(0, 0.5) + (kind === 'war' ? 0.3 : 0), 0.5, 3.2);
      const risk = Math.round(clamp(QUEST_KIND[kind].risk + rnd(-0.05, 0.08), 0, 0.5) * 100) / 100;
      const regs = Object.keys(REGIONS).filter(k => !REGIONS[k].outer && k !== site().region);
      const R = REGIONS[pick(regs)].name;
      const fn = F.name, what = T ? T.name + '의 움직임' : R + '의 정세';
      const tx = {
        escort: [`${fn}의 짐 호위`, `${fn}에서 ${R}까지 가는 짐수레를 지켜 달라고 한다. 길목마다 산적이 들끓는다.`],
        suppress: [`${T ? T.name : ''} 토벌`, `${fn}${pp(fn, '이/가')} ${T ? T.name : ''}의 무리를 쳐 달라고 청한다. 이기면 그들의 힘이 꺾이지만 원한을 산다.`],
        scout: [`${T ? T.name + '의 동정' : R + ' 정세'} 살피기`, `${fn}에서 ${what}${pp(what, '을/를')} 몰래 살펴 와 달라고 한다.`],
        retrieve: ['빼앗긴 가보 되찾기', `${fn}의 가보를 도적이 훔쳐 ${R} 쪽으로 달아났다. 되찾아 오면 크게 사례하겠다고 한다.`],
        war: [`${war ? war.name : ''}에 원군`, `${war ? war.name : '싸움'}에 나선 ${fn}${pp(fn, '이/가')} 함께 싸울 무사를 청한다. 이기면 전황이 기운다.`],
        assassin: [`${T ? T.name : ''} 간부 암살`, `${fn}에서 ${T ? T.name : '적'}의 간부 하나를 조용히 처치해 달라고 한다. 관의 귀에 들어가면 곤란하다.`],
        smuggle: ['몰래 실어 나를 짐', `${fn}에서 관의 눈을 피해 짐 한 바리를 ${R}까지 옮겨 달라고 한다. 들키면 관과 사이가 나빠진다.`],
        herb: ['깊은 산의 약재', `${fn}에서 깊은 산에만 나는 약초를 캐 와 달라고 한다. 짐승과 독충을 조심해야 한다.`],
      }[kind];
      const q = {
        id: 'q' + (++jh.seq), fid, kind, title: tx[0], text: tx[1], target: target || null,
        need: { n, martial: Math.round(n * per * 10) / 10 }, days,
        reward: { silver: Math.round(20 * n * days * (1 + risk)), fame: rndi(2, 8), rel: rndi(6, 10) },
        risk, expires: dayOf() + rndi(3, 5), state: 'open', party: [], back: 0, ok: null,
      };
      jh.quests.push(q);
      Bus.emit('questNew', q);
      return q;
    },
    canSend(v) { return !!v && !v.dead && !v.leaving && !v.down && !v.arriving && !v.away && (v.role === 'guard' || !!v.hero); },
    // p = clamp(0.65 + (무공합 − need.martial) × 0.12 + 0.08 × (n − need.n), 0.15, 0.95)
    chanceOf(q, vs) {
      const sum = vs.reduce((t, v) => t + (v.martial || 0), 0);
      return clamp(0.65 + (sum - q.need.martial) * 0.12 + 0.08 * (vs.length - q.need.n), 0.15, 0.95);
    },
    chance(qid, ids) {
      const q = this.quest(qid);
      if (!q) return 0;
      return this.chanceOf(q, ids.map(id => S.villagers.find(v => v.id === id)).filter(Boolean));
    },
    // 파견 창에 보일 것: 성공 확률, 남는 무력, 가장 센 이웃 위협(첩자가 없으면 낱말)과 쳐들어오면 몇 명인지
    dispatchInfo(qid, ids = []) {
      const top = S.jh.near.filter(id => fac(id).military && id !== S.vassal && alive(id))
        .sort((a, b) => S.factions[b].threat - S.factions[a].threat)[0] || null;
      return {
        p: this.chance(qid, ids), spare: defensePower(new Set(ids)),
        threat: top ? { id: top, word: this.threatWord(top), pct: this.spied(top) ? Math.round(S.factions[top].threat) : null, n: this.raidEstimate(top) } : null,
      };
    },
    // 무사(role guard)나 객경 1~4명을 보낸다 → { ok, text, why }
    dispatch(qid, ids) {
      const q = this.quest(qid);
      if (!q || q.state !== 'open') return { ok: false, why: '맡을 수 있는 의뢰가 아니다' };
      if (!this.allowJianghu()) return { ok: false, why: '아직 강호의 일에 나설 때가 아니다' };
      if (q.expires <= dayOf() || !alive(q.fid)) return { ok: false, why: '의뢰의 기한이 지났다' };
      ids = [...new Set(ids || [])];
      if (ids.length < 1 || ids.length > 4) return { ok: false, why: '보낼 사람은 하나에서 넷까지다' };
      const vs = ids.map(id => S.villagers.find(v => v.id === id));
      if (vs.some(v => !this.canSend(v))) return { ok: false, why: '보낼 수 없는 사람이 섞여 있다 (무사나 객경만, 다치지 않은 이만)' };
      if (Events.raidPending() || S.occupation) return { ok: false, why: '습격이 다가오는 동안에는 사람을 내보낼 수 없다' };
      const out = S.jh.quests.filter(x => x.state === 'away').length;
      if (out >= this.partyCap()) return { ok: false, why: `지금은 한 번에 ${['한', '두', '세'][this.partyCap() - 1]} 무리까지만 내보낼 수 있다` };
      q.p = this.chanceOf(q, vs);
      q.state = 'away'; q.party = ids; q.back = S.time + q.days * 24;
      const exitIdx = this.exitFor(q.fid)[0];
      for (const v of vs) { v.away = { q: q.id, until: q.back, exitIdx, gone: false }; v.target = 0; }
      const who = vs.map(v => v.name).join(', ');
      logMsg(`${who}${pp(who, '이/가')} ${fac(q.fid).name}의 의뢰로 길을 떠났다.`, '');
      markDirty();
      return { ok: true, text: `${who}${pp(who, '이/가')} 길을 떠났다. ${q.days}일 뒤에 돌아온다.` };
    },
    // 불러들이기: 반나절(6시진) 뒤 돌아오고 의뢰는 실패, 관계 −3
    recall(qid) {
      const q = this.quest(qid);
      if (!q || q.state !== 'away' || q.recalled) return { ok: false, why: '불러들일 무리가 없다' };
      q.recalled = true;
      q.back = Math.min(q.back, S.time + 12);
      for (const id of q.party) { const v = S.villagers.find(x => x.id === id); if (v && v.away) v.away.until = q.back; }
      return { ok: true, text: '전갈을 보냈다. 반나절 뒤 돌아온다.' };
    },
    questReturn(q) {
      const jh = S.jh, F = fac(q.fid);
      const party = q.party.map(id => S.villagers.find(v => v.id === id && !v.dead)).filter(Boolean);
      const tried = !q.recalled && !q.void && party.length > 0;
      const ok = tried && Math.random() < (q.p !== undefined ? q.p : this.chanceOf(q, party));
      const war = q.kind === 'war' ? this.warById(q.target) : null;
      const side = war ? this.sideOf(war, q.fid) : null;
      const lines = [];
      if (ok) {
        addRes('silver', q.reward.silver); addFame(q.reward.fame);
        changeRel(q.fid, q.reward.rel); this.relSpread(q.fid, q.reward.rel);
        if ((q.kind === 'suppress' || q.kind === 'assassin') && q.target && alive(q.target)) {
          setPower(q.target, S.jh.power[q.target] - rndi(8, 15));
          changeRel(q.target, -15);
        }
        if (side) this.addScore(war, side, 3, true);
        lines.push(`은자 +${q.reward.silver} · 명성 +${q.reward.fame} · ${F.name} 관계 +${q.reward.rel}`);
      } else if (!q.void) {
        changeRel(q.fid, -3);
        if (tried) {
          if (side) this.addScore(war, side, 0.5, true);
          for (const v of party) {
            if (!v.hero && Math.random() < q.risk * 0.2) {
              v.dead = true; S.stats.died++;
              logMsg(`${v.name}${pp(v.name, '이/가')} 의뢰 길에서 돌아오지 못했다.`, 'bad');
            } else if (Math.random() < q.risk) v.hp = Math.max(1, v.maxHp / 3);
          }
        }
      }
      if (tried && (q.kind === 'smuggle' || q.kind === 'assassin')) for (const id of jh.near) if (campOf(id) === 'gwan') changeRel(id, -4);
      for (const v of party) if (!v.dead) unitsReturn(v);
      q.state = ok ? 'done' : 'failed'; q.ok = ok; q.done = dayOf();
      jh.quests = jh.quests.filter(x => x !== q);
      jh.qlog.unshift(q);
      if (jh.qlog.length > 10) jh.qlog.length = 10;
      const msg = q.void ? `${F.name}${pp(F.name, '이/가')} 무너져 「${q.title}」 의뢰는 헛걸음이 되었다.`
        : q.recalled ? `「${q.title}」 의뢰에서 무리를 불러들였다.`
        : ok ? `「${q.title}」 의뢰를 해내고 돌아왔다. ${lines[0]}.` : `「${q.title}」 의뢰에 실패하고 돌아왔다.`;
      logMsg(msg, ok ? 'good' : 'bad');
      UI.toast(msg, ok ? 'good' : 'bad');
      Bus.emit('questDone', q, ok);
      markDirty();
    },

    // ━━ 외교 (§7) ━━
    // → { ok, why, cost }. support 는 opts { war, silver, food, weapons }, mediate 는 id 로 전쟁 id 나 세력 id
    canAct(kind, id, opts = {}) {
      const r = (ok, why = '', cost = null) => ({ ok, why, cost });
      if (!S || !S.jh) return r(false, '강호의 일을 볼 수 없다');
      const jh = S.jh, d = dayOf();
      // 예물과 산하는 지금처럼 언제나, 나머지는 강호가 열린 뒤에만 (§0.1)
      if (!['gift', 'vassal', 'unvassal'].includes(kind) && !this.allowJianghu()) return r(false, '아직 강호의 일에 나설 때가 아니다');
      if (kind === 'mediate') {
        const w = this.warById(id) || this.warOf(id);
        const cost = { silver: 150 };
        if (!w) return r(false, '싸움이 벌어지고 있지 않다', cost);
        if (w.scripted) return r(false, '이 싸움은 말로 멈출 수 없다', cost);
        const nearOf = s => w[s].filter(x => jh.near.includes(x));
        if (!nearOf('a').length || !nearOf('b').length) return r(false, '서로 싸우는 이웃 둘 사이에서만 중재한다', cost);
        if (nearOf('a').concat(nearOf('b')).some(x => rel(x) < 0)) return r(false, '양쪽 모두와 사이가 나쁘지 않아야 한다 (관계 0 이상)', cost);
        if (!canAfford(cost)) return r(false, '은자가 모자라다', cost);
        return r(true, '', cost);
      }
      const F = fac(id);
      if (!F) return r(false, '알 수 없는 세력이다');
      if (!alive(id)) return r(false, '멸문한 세력이다');
      const near = jh.near.includes(id);
      const cdLeft = k => Math.max(0, (jh.cd[k + ':' + id] || 0) - d);
      const money = cost => canAfford(cost) ? r(true, '', cost) : r(false, '은자가 모자라다', cost);
      switch (kind) {
        case 'gift': {
          const cost = { silver: 50 };
          if (S.flags['gift_' + id] === d) return r(false, '오늘은 이미 예물을 보냈다', cost);
          return money(cost);
        }
        case 'envoy': {
          const cost = { silver: 60 + popCount() };
          if (rel(id) < -60) return r(false, '사이가 너무 나빠 사신을 받지 않는다 (관계 −60 이상)', cost);
          if (cdLeft('envoy')) return r(false, `사신이 다녀온 지 얼마 안 됐다 (${cdLeft('envoy')}일 뒤)`, cost);
          return money(cost);
        }
        case 'trade': {
          const cost = { silver: 60 };
          if (!near) return r(false, '이웃하고만 교역 협정을 맺는다', cost);
          if (!TRADE_CAMPS.includes(F.camp)) return r(false, '상단·새외·세가와만 교역 협정을 맺는다', cost);
          if (jh.trade[id] > d) return r(false, `이미 교역 중이다 (${jh.trade[id] - d}일 남음)`, cost);
          if (Object.keys(jh.trade).filter(k => jh.trade[k] > d).length >= 2) return r(false, '교역 협정은 동시에 둘까지다', cost);
          if (rel(id) < 20) return r(false, '관계가 20 이상이어야 한다', cost);
          return money(cost);
        }
        case 'pact': {
          if (!near) return r(false, '이웃하고만 동맹을 맺는다');
          if (F.noLord) return r(false, '동맹을 맺을 수 없는 무리다');
          if (S.vassal === id) return r(false, '이미 주군이다');
          if (jh.pacts.includes(id)) return r(false, '이미 동맹이다');
          const max = S.rank >= 4 ? 2 : 1;
          if (jh.pacts.length >= max) return r(false, max === 1 ? '현성이 되기 전에는 동맹을 하나만 맺는다' : '동맹은 둘까지다');
          if (S.vassal && CAMP_ATT[campOf(S.vassal)][F.camp] <= -40) return r(false, '주군의 원수와는 손잡을 수 없다');
          if (rel(id) < 60) return r(false, '관계가 60 이상이어야 한다');
          if (S.fame < 60 && !S.flags['pact_nofame_' + id]) return r(false, '명성이 60 이상이어야 한다');
          return r(true);
        }
        case 'unpact': return jh.pacts.includes(id) ? r(true) : r(false, '동맹이 아니다');
        case 'vassal': {
          if (!near) return r(false, '이웃의 산하에만 든다');
          if (F.noLord) return r(false, '산하에 들 수 없는 무리다');
          if (S.vassal === id) return r(false, '이미 주군이다');
          if (S.occupation && S.occupation.faction === id) return r(false, '점령군의 산하에는 들 수 없다');
          if (rel(id) < 40) return r(false, '관계가 40 이상이어야 한다');
          return r(true);
        }
        case 'unvassal': return S.vassal === id ? r(true) : r(false, '주군이 아니다');
        case 'bounty': {
          const cost = { silver: 120 };
          if (!near || !BOUNTY_CAMPS.includes(F.camp)) return r(false, '흑도·사파·마교 이웃에게만 현상금을 건다', cost);
          if (Math.max(rel('gwanbu'), rel('geumui')) < 20) return r(false, '관부나 금의위와 관계가 20 이상이어야 한다', cost);
          if (cdLeft('bounty')) return r(false, `현상금을 건 지 얼마 안 됐다 (${cdLeft('bounty')}일 뒤)`, cost);
          const gp = FACTION_ORDER.filter(x => campOf(x) === 'gwan' && alive(x)).reduce((t, x) => t + jh.power[x], 0);
          if (gp < jh.power[id] * 0.8) return r(false, '관의 힘이 모자라 나서 주지 않는다', cost);
          return money(cost);
        }
        case 'spy': {
          const cost = { silver: 30 };
          if (!near) return r(false, '이웃에게만 첩자를 보낸다', cost);
          if (this.spied(id)) return r(false, `첩자가 이미 있다 (${jh.spies[id] - d}일 남음)`, cost);
          if (cdLeft('spy')) return r(false, `새 첩자를 구하려면 기다려야 한다 (${cdLeft('spy')}일 뒤)`, cost);
          return money(cost);
        }
        case 'support': {
          const w = opts.war ? this.warById(opts.war) : this.warOf(id);
          if (!w || !this.sideOf(w, id)) return r(false, '싸우고 있지 않다');
          if (!w[this.sideOf(w, id)].some(x => jh.near.includes(x))) return r(false, '그 편에 이웃이 있어야 돕는다');
          const cost = {};
          for (const k of ['silver', 'food', 'weapons']) if (opts[k] > 0) cost[k] = Math.floor(opts[k]);
          if (opts.silver !== undefined || opts.food !== undefined || opts.weapons !== undefined) {
            if (!Object.keys(cost).length) return r(false, '보낼 것을 골라야 한다', cost);
            if (!canAfford(cost)) return r(false, '가진 것이 모자라다', cost);
          }
          return r(true, '', Object.keys(cost).length ? cost : null);
        }
        default: return r(false, '알 수 없는 일이다');
      }
    },
    // → { ok, text, why }
    act(kind, id, opts = {}) {
      const c = this.canAct(kind, id, opts);
      if (!c.ok) return { ok: false, why: c.why };
      if (kind === 'support' && !c.cost) return { ok: false, why: '보낼 것을 골라야 한다' };
      const jh = S.jh, d = dayOf(), F = fac(id), f = S.factions[id];
      if (c.cost) pay(c.cost);
      switch (kind) {
        case 'gift':
          S.flags['gift_' + id] = d;
          changeRel(id, 6); this.relSpread(id, 6);
          return { ok: true, text: `${F.name}에 예물을 보냈다.` };
        case 'envoy': {
          jh.cd['envoy:' + id] = d + 5;
          const g = rndi(10, 14);
          changeRel(id, g); f.threat = Math.max(0, f.threat - 15); this.relSpread(id, g);
          return { ok: true, text: `사신이 ${F.name}에 다녀왔다. 관계 +${g}.` };
        }
        case 'trade':
          jh.trade[id] = d + 20;
          changeRel(id, 3);
          return { ok: true, text: `${F.name}${pp(F.name, '과/와')} 교역 협정을 맺었다. 스무 날 동안 매일 은자가 들어온다.` };
        case 'pact':
          jh.pacts.push(id);
          f.threat = 0;
          this.relSpread(id, 25);
          ver++;
          logMsg(`${F.name}${pp(F.name, '과/와')} 동맹을 맺었다.`, 'good');
          Bus.emit('pactChanged', id, true);
          return { ok: true, text: `${F.name}${pp(F.name, '과/와')} 동맹을 맺었다.` };
        case 'unpact':
          jh.pacts = jh.pacts.filter(x => x !== id);
          changeRel(id, -25); this.relSpread(id, -40);
          ver++;
          logMsg(`${F.name}${pp(F.name, '과/와')}의 동맹을 끊었다.`, 'bad');
          Bus.emit('pactChanged', id, false);
          return { ok: true, text: `${F.name}${pp(F.name, '과/와')}의 동맹을 끊었다.` };
        case 'vassal':
          becomeVassal(id);
          return { ok: true, text: `${F.name}의 산하에 들었다.` };
        case 'unvassal':
          breakVassal(false);
          return { ok: true, text: `${F.name}${pp(F.name, '과/와')}의 주종 관계를 끊었다.` };
        case 'bounty':
          jh.cd['bounty:' + id] = d + 15;
          setPower(id, jh.power[id] - 20);
          f.threat = 0;
          changeRel(id, -20); changeRel('gwanbu', -5);
          jh.grudge[id] = d + 10;
          this.news(`${S.name}${pp(S.name, '이/가')} ${F.name}에 현상금을 걸었다. 관병과 낭인들이 그들을 쫓는다.`, 'bounty', [id]);
          return { ok: true, text: `${F.name}에 현상금을 걸었다. 그들의 원한을 산다.` };
        case 'spy':
          jh.cd['spy:' + id] = d + 10;
          if (chance(0.2)) { changeRel(id, -15); return { ok: true, text: `첩자가 ${F.name}에 붙잡혔다. 관계 −15.` }; }
          jh.spies[id] = d + 10;
          return { ok: true, text: `${F.name}에 첩자를 심었다. 열흘 동안 그들의 속을 들여다본다.` };
        case 'support': {
          const w = opts.war ? this.warById(opts.war) : this.warOf(id);
          const side = this.sideOf(w, id), other = side === 'a' ? 'b' : 'a';
          const cost = c.cost || {};
          const amt = (cost.silver || 0) / 50 + (cost.food || 0) / 80 + (cost.weapons || 0) / 5;
          for (const x of w[side]) changeRel(x, 5);
          for (const x of w[other]) changeRel(x, -8);
          this.addScore(w, side, amt, true);
          return { ok: true, text: `${names(w[side])}에 힘을 보탰다.` };
        }
        case 'mediate': {
          const w = this.warById(id) || this.warOf(id);
          this.endWar(w, null, 'mediate');
          addFame(15);
          for (const x of w.a.concat(w.b)) changeRel(x, 5);
          return { ok: true, text: `${w.name}${pp(w.name, '을/를')} 중재해 멈추었다. 명성 +15.` };
        }
      }
      return { ok: false, why: '알 수 없는 일이다' };
    },
    // 첩자가 없으면 위협은 낱말로만: 잠잠(30 미만) · 술렁(70 미만) · 칼을 간다
    threatWord(id) {
      const t = S.factions[id] ? S.factions[id].threat : 0;
      return t < 30 ? '잠잠' : t < 70 ? '술렁' : '칼을 간다';
    },
    spied(id) { return !!(S && S.jh && S.jh.spies[id] > dayOf()); },
    raidEstimate(id) { return fac(id) && fac(id).military ? raidSize(id) : 0; },
    // 첩자가 알아 온 것: 정확한 위협, 다음 습격 예상(며칠 뒤·길목·규모), 전쟁
    intel(id) {
      if (!this.spied(id)) return null;
      const f = S.factions[id], g = threatGain(id);
      const eta = f.threat >= 100 ? 0 : g > 0 ? Math.ceil((100 - f.threat) / g) : null;
      const w = this.warOf(id);
      return { threat: Math.round(f.threat), eta, exitIdx: this.exitFor(id)[0], size: this.raidEstimate(id), war: w ? w.id : null, pacts: [] };
    },
  };
  return M;
})();
