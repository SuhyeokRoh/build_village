'use strict';
// ───────────────────────────────────────────────
// 육방(六房): 관아의 여섯 부서와 예산, 저절로 돌아가는 살림
// 영주가 부서마다 하루 예산을 내려 주면 부서는 그 은자를 기금으로 모아
// 스스로 필요한 것을 살피고 짓는다. 저장 상태는 S.admin (순수 JSON).
// ───────────────────────────────────────────────
// 한자 풀이: 다른 모듈이 먼저 단 풀이는 덮어쓰지 않는다
const ADM_GLOSS = {
  '六房': ['육방', '관아의 여섯 부서. 이방·호방·예방·병방·형방·공방을 함께 이르는 말.'],
  '吏房': ['이방', '인사와 행정을 맡는 부서. 장부를 맞춰 세금을 빈틈없이 거두고 일손을 고루 나눈다.'],
  '戶房': ['호방', '호구·세금·곡식을 맡는 부서. 겨울을 내다보고 논밭과 어장, 창고를 늘린다.'],
  '禮房': ['예방', '제사·잔치·민심을 맡는 부서. 우물과 사당, 의원과 정자를 세우고 잔치를 연다.'],
  '兵房': ['병방', '군사와 방어를 맡는 부서. 무관과 망루, 대장간을 세우고 습격에 대비한다.'],
  '刑房': ['형방', '치안과 재판을 맡는 부서. 순라를 돌리고 송사와 도둑을 다스린다.'],
  '工房': ['공방', '건설과 길을 맡는 부서. 집을 짓고 길을 닦으며 폐허를 다시 세운다.'],
  '衙前': ['아전', '관아에서 실무를 보는 구실아치. 부서마다 우두머리 아전이 일을 맡는다.'],
};
for (const [k, v] of Object.entries(ADM_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

// 부서 정보 (배열이면서 id로도 꺼낼 수 있다: Admin.DEPTS.gong)
const ADM_DEPTS = [
  { id: 'ri', name: '이방', hanja: '吏房', seal: '吏', hun: '벼슬아치 리', role: '인사·행정',
    duty: '장부를 맞춰 세금을 빈틈없이 거두고(세금 최대 +15%), 곡식이 달리면 다른 일터의 일손을 논밭으로 돌린다.' },
  { id: 'ho', name: '호방', hanja: '戶房', seal: '戶', hun: '지게 호', role: '호구·세금·곡식',
    duty: '겨울까지 내다보고 논밭과 어장을 늘린다. 곳간이 차면 창고를, 장이 설 만하면 시장을 짓고, 굶주릴 지경이면 곡식을 사들인다.' },
  { id: 'ye', name: '예방', hanja: '禮房', seal: '禮', hun: '예도 례', role: '제사·잔치·민심',
    duty: '사람 수에 맞춰 우물·사당·의원·정자를 세우고, 민심이 가라앉으면 잔치를 연다. 예산이 넉넉하면 민심이 조금 오른다.' },
  { id: 'byeong', name: '병방', hanja: '兵房', seal: '兵', hun: '군사 병', role: '군사·방어',
    duty: '무관을 세워 무사를 기르고, 적이 넘어오는 길목에 망루를 올리며, 대장간을 짓는다. 습격 경보가 오면 방비를 서두른다.' },
  { id: 'hyeong', name: '형방', hanja: '刑房', seal: '刑', hun: '형벌 형', role: '치안·재판',
    duty: '순라꾼을 부려 마을을 편안하게 한다(민심 최대 +6). 송사와 도둑 상소를 맡기면 기금으로 처리한다.' },
  { id: 'gong', name: '공방', hanja: '工房', seal: '工', hun: '장인 공', role: '건설·길',
    duty: '빈집이 모자라면 집을 짓고, 폐허를 다시 세우고, 목재·석재가 달리면 벌목장·채석장을 짓는다. 건물마다 길을 이어 준다.' },
];
for (const d of ADM_DEPTS) ADM_DEPTS[d.id] = d;
const ADM_IDS = ADM_DEPTS.map(d => d.id);

// 아전의 성품
const ADM_TRAITS = {
  honest: { name: '청렴', tip: '장부가 깨끗하다. 내려 준 예산을 한 푼도 축내지 않는다.', eff: 1, cd: 1, skim: 0, fee: 1, w: 3 },
  capable: { name: '유능', tip: '일솜씨가 뛰어나다. 효과가 한층 크고 품삯을 아끼며, 일을 자주 살핀다.', eff: 1.25, cd: 0.75, skim: 0, fee: 0.75, w: 2.4 },
  greedy: { name: '탐욕', tip: '받은 예산의 다섯에 하나를 제 주머니에 넣는다. 백성의 원성도 조금 산다.', eff: 1, cd: 1, skim: 0.2, fee: 1, w: 2.4 },
  lazy: { name: '게으름', tip: '일을 자꾸 미룬다. 일을 살피는 틈이 길고 효과도 덜하다.', eff: 0.8, cd: 1.8, skim: 0, fee: 1, w: 2 },
};
// 예산이 모자랄 때 먼저 채우는 순서: 먹을 것, 지을 것(삯이 싸다), 지킬 것, 그다음
const ADM_FUND_ORDER = ['ho', 'gong', 'byeong', 'hyeong', 'ye', 'ri'];
const ADM_COOLDOWN = { ri: 4, ho: 3, ye: 4, byeong: 3, hyeong: 6, gong: 2 };
// 기금 상한의 바닥: 큰 건물 하나는 모을 수 있게
const ADM_MINCAP = { ri: 30, ho: 70, ye: 80, byeong: 130, hyeong: 30, gong: 70 };
// 지나는 상인에게 웃돈을 주고 살 때의 값 (한 단위에 은자)
const ADM_PRICE = { wood: 1.2, stone: 1.7, food: 0.9, weapons: 3 };
const ADM_NO_ROAD = new Set(['tower', 'wall', 'stonewall', 'gate', 'well', 'manor']);
// 길을 이어 줄 순서
const ADM_CONNECT = ['house', 'house2', 'market', 'inn', 'warehouse', 'clinic', 'smithy', 'dojo', 'escort', 'shrine', 'pavilion',
  'lumber', 'quarry', 'fishery', 'farm'];
// 형방이 맡을 만한 상소: 송사·도둑, 억울한 옥살이, 관아 송사·수배자, 장터 자릿세
const ADM_HYEONG_PET = new Set(['dispute', 'thief', 'wrongful', 'gwan_suit', 'gwan_fugitive', 'heuk_levy']);
// 일꾼 한 사람이 하루에 실제로 일하는 시간의 첫 어림 (오가는 걸음, 습격 때 숨는 틈을 뺐다).
// 논밭은 밭 안을 옮겨 다니고, 어장은 물가를 찾아 오가느라 짧고, 장사 일터는 안에 머물러 길다. 호방이 둘러보며 고친다
const ADM_WORK_H = { farm: 8, fishery: 6.5, shop: 9 };
// 세력이 넘어오는 출입구는 JH.exitFor(id) (sim.js pickExit 과 같다: 좋은 순서 둘 가운데 하나로 온다)

// 터 고르기 성향
// wd: 마을 가운데에서 멀수록 깎는 정도, road: 길까지 새로 깔 칸마다 깎는 정도, front: 길가에 문을 내면 덤
// cluster: 가까이 모이면 좋은 건물, apart: 같은 건물끼리 떨어질 거리, res: 가까이 있어야 할 지형
const ADM_PROFILE = {
  _: { wd: 1.1, road: 2.0 },
  house: { wd: 1.2, road: 2.4, cluster: ['house', 'house2'], cr: 6, cw: 0.7, cmax: 5 },
  house2: { wd: 1.2, road: 2.4, cluster: ['house', 'house2'], cr: 6, cw: 0.7, cmax: 5 },
  farm: { wd: 0.55, road: 0.9, cluster: ['farm'], cr: 7, cw: 1.6, cmax: 4, minD: 6.5 },
  fishery: { wd: 0.6, road: 0.9, far: 9 },
  lumber: { wd: 0.45, road: 0.8, res: T.FOREST, rw: 0.7, rmin: 7, far: 9 },
  quarry: { wd: 0.45, road: 0.8, res: T.ROCK, rw: 0.7, rmin: 6, far: 9 },
  warehouse: { wd: 1.4, road: 2.6 },
  smithy: { wd: 1.0, road: 2.0, nearType: ['dojo', 'quarry'], nw: 0.3 },
  market: { wd: 1.5, road: 4.0, front: 6 },
  inn: { wd: 1.3, road: 4.0, front: 6 },
  escort: { wd: 1.0, road: 4.0, front: 6 },
  clinic: { wd: 1.5, road: 2.4, cluster: ['house', 'house2'], cr: 6, cw: 0.4, cmax: 5 },
  shrine: { wd: 0.9, road: 1.6, cluster: ['house', 'house2'], cr: 8, cw: 0.4, cmax: 6, apart: 10, north: 2 },
  well: { wd: 1.0, road: 0, cluster: ['house', 'house2'], cr: 5, cw: 1.2, cmax: 5, apart: 6 },
  pavilion: { wd: 0.9, road: 1.0, cluster: ['house', 'house2'], cr: 7, cw: 0.5, cmax: 5, apart: 8, water: 0.8 },
  dojo: { wd: 1.0, road: 2.4 },
  tower: { wd: 0.2, road: 0, far: 6 },
};
const ADM_D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// 작은 이진 힙 (길 내기용)
function AdmHeap() { this.k = []; this.v = []; }
AdmHeap.prototype.push = function (key, val) {
  const k = this.k, v = this.v;
  let i = k.length; k.push(key); v.push(val);
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (v[p] <= v[i]) break;
    [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p;
  }
};
AdmHeap.prototype.pop = function () {
  const k = this.k, v = this.v;
  const top = [k[0], v[0]];
  const lk = k.pop(), lv = v.pop();
  if (k.length) {
    k[0] = lk; v[0] = lv;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < k.length && v[l] < v[m]) m = l;
      if (r < k.length && v[r] < v[m]) m = r;
      if (m === i) break;
      [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m;
    }
  }
  return top;
};

// ── 터 고르기와 길 내기 (저장하지 않는 계산) ──
const AdmSite = {
  inRect(x, y, r) { return r && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h; },
  roadOk(x, y) {
    if (!World.inb(x, y)) return false;
    const i = y * MW + x;
    if (World.occ[i]) return false;
    const t = World.tiles[i];
    if (t === T.ROCK) return false;
    if (t === T.WATER && !World.road[i]) return false;
    return true;
  },
  // 영주관 앞 길과 이어진 길 칸
  network() {
    const net = new Uint8Array(MW * MH);
    const q = [];
    const seed = (x, y) => {
      if (!World.inb(x, y) || !World.road[y * MW + x] || net[y * MW + x]) return;
      net[y * MW + x] = 1; q.push(y * MW + x);
    };
    const m = getB(S.manorId);
    if (m) for (let x = m.x - 1; x <= m.x + m.w; x++) for (let y = m.y - 1; y <= m.y + m.h; y++) seed(x, y);
    if (!q.length) {
      for (let x = 0; x < MW; x++) { seed(x, 0); seed(x, MH - 1); }
      for (let y = 0; y < MH; y++) { seed(0, y); seed(MW - 1, y); }
    }
    while (q.length) {
      const i = q.pop();
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of ADM_D4) seed(x + dx, y + dy);
    }
    return net;
  },
  // 길 연결망까지 새로 깔아야 할 칸 수
  roadDist(net) {
    const d = new Int16Array(MW * MH).fill(999);
    const q = new Int32Array(MW * MH);
    let qh = 0, qt = 0;
    for (let i = 0; i < net.length; i++) if (net[i]) { d[i] = 0; q[qt++] = i; }
    while (qh < qt) {
      const i = q[qh++];
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of ADM_D4) {
        const nx = x + dx, ny = y + dy;
        if (!World.inb(nx, ny)) continue;
        const ni = ny * MW + nx;
        if (d[ni] !== 999 || !this.roadOk(nx, ny)) continue;
        d[ni] = d[i] + 1; q[qt++] = ni;
      }
    }
    return d;
  },
  // 마을 사람이 걸어서 닿는 칸 (block: 막아 볼 발판)
  flood(start, block, mode = 0) {
    const seen = new Uint8Array(MW * MH);
    if (!start) return seen;
    const q = new Int32Array(MW * MH);
    let qh = 0, qt = 0;
    seen[start.y * MW + start.x] = 1; q[qt++] = start.y * MW + start.x;
    while (qh < qt) {
      const i = q[qh++];
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of ADM_D4) {
        const nx = x + dx, ny = y + dy;
        if (!World.inb(nx, ny)) continue;
        const ni = ny * MW + nx;
        if (seen[ni] || this.inRect(nx, ny, block) || !walkable(nx, ny, mode)) continue;
        seen[ni] = 1; q[qt++] = ni;
      }
    }
    return seen;
  },
  // 걸음 수 지도 (적의 길목 찾기용)
  distField(start, mode) {
    const d = new Int16Array(MW * MH).fill(-1);
    if (!start) return d;
    const q = new Int32Array(MW * MH);
    let qh = 0, qt = 0;
    d[start.y * MW + start.x] = 0; q[qt++] = start.y * MW + start.x;
    while (qh < qt) {
      const i = q[qh++];
      const x = i % MW, y = (i / MW) | 0;
      for (const [dx, dy] of ADM_D4) {
        const nx = x + dx, ny = y + dy;
        if (!World.inb(nx, ny)) continue;
        const ni = ny * MW + nx;
        if (d[ni] >= 0 || !walkable(nx, ny, mode)) continue;
        d[ni] = d[i] + 1; q[qt++] = ni;
      }
    }
    return d;
  },
  doorTile(def, x, y) { return { x: x + Math.floor(def.w / 2), y: y + def.h }; },
  context() {
    const m = getB(S.manorId);
    const ax = m ? m.x + m.w / 2 : World.center.x + 0.5, ay = m ? m.y + m.h / 2 : World.center.y + 0.5;
    const pop = popCount();
    const net = this.network();
    const reserved = new Uint8Array(MW * MH);
    // 영주관 앞마당은 비워 둔다
    if (m) for (let y = m.y + m.h; y <= m.y + m.h + 1; y++) for (let x = m.x - 1; x <= m.x + m.w; x++) if (World.inb(x, y)) reserved[y * MW + x] = 1;
    const p = plazaTile();
    const start = nearestWalkable(p.x, p.y, 0, 6);
    const blds = S.buildings.filter(b => !BDEF[b.type].line && b.type !== 'gate');
    let radius = 6;
    for (const b of blds) if (b.type !== 'tower') radius = Math.max(radius, Math.hypot(b.x + b.w / 2 - ax, b.y + b.h / 2 - ay));
    return { ax, ay, pop, net, rd: this.roadDist(net), reserved, start, blds, radius: Math.min(radius, 18), maxD: clamp(9 + pop * 0.13, 9, 22), _doors: null };
  },
  // 지금 걸어서 닿는 문과 출입구 (새 건물이 이것을 막으면 안 된다)
  doors(ctx) {
    if (ctx._doors) return ctx._doors;
    const reach = this.flood(ctx.start, null);
    const out = [];
    for (const b of S.buildings) {
      if (BDEF[b.type].line) continue;
      const d = doorOf(b);
      if (World.inb(d.x, d.y) && reach[d.y * MW + d.x]) out.push(d.y * MW + d.x);
    }
    for (const e of World.exits) {
      const p = nearestWalkable(e.x, e.y, 0, 3);
      if (p && reach[p.y * MW + p.x]) out.push(p.y * MW + p.x);
    }
    ctx._doors = out;
    return out;
  },
  // 꼭 지켜야 할 것: 빈 땅, 둘레 한 칸 비움, 문 앞이 땅, 출입구와 거리
  fits(def, x, y, ctx) {
    const { tiles, road, occ } = World;
    for (let yy = y; yy < y + def.h; yy++) for (let xx = x; xx < x + def.w; xx++) {
      const i = yy * MW + xx;
      if (occ[i] || road[i] || ctx.reserved[i]) return false;
      const t = tiles[i];
      if (t === T.WATER || t === T.ROCK) return false;
    }
    for (let yy = y - 1; yy <= y + def.h; yy++) for (let xx = x - 1; xx <= x + def.w; xx++) {
      if (xx >= x && xx < x + def.w && yy >= y && yy < y + def.h) continue;
      if (!World.inb(xx, yy) || occ[yy * MW + xx]) return false;
    }
    const d = this.doorTile(def, x, y);
    const di = d.y * MW + d.x;
    if (tiles[di] === T.ROCK || (tiles[di] === T.WATER && !road[di])) return false;
    const cx = x + def.w / 2, cy = y + def.h / 2;
    for (const e of World.exits) if (Math.abs(e.x + 0.5 - cx) + Math.abs(e.y + 0.5 - cy) < 8) return false;
    return true;
  },
  // 비용은 빼고 canPlace 를 그대로 묻는다 (재료를 잠깐 넉넉히 두었다가 그대로 되돌린다)
  placeOk(type, x, y) {
    const saved = S.res;
    S.res = { silver: 1e9, food: 1e9, wood: 1e9, stone: 1e9, weapons: 1e9 };
    try { return canPlace(type, x, y).ok; } catch (e) { return false; } finally { S.res = saved; }
  },
  keepsPaths(def, x, y, ctx) {
    const reach = this.flood(ctx.start, { x, y, w: def.w, h: def.h });
    const d = this.doorTile(def, x, y);
    if (!reach[d.y * MW + d.x]) return false;
    for (const i of this.doors(ctx)) if (!reach[i]) return false;
    return true;
  },
  score(type, def, P, x, y, dC, ctx, tw, opts) {
    const w = def.w, h = def.h;
    const cx = x + w / 2, cy = y + h / 2;
    const d = this.doorTile(def, x, y);
    const rd = ctx.rd[d.y * MW + d.x];
    let s = -dC * P.wd;
    if (P.road) s -= Math.min(rd, 25) * P.road;
    if (P.front && rd <= 1) s += P.front;
    if (rd >= 999 && P.road) s -= 30;
    // 발판의 숲, 둘레의 벼랑과 물
    let forest = 0, rough = 0;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (World.tiles[yy * MW + xx] === T.FOREST) forest++;
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
      const t = World.tiles[yy * MW + xx];
      if (t === T.ROCK || (t === T.WATER && !World.road[yy * MW + xx])) rough++;
    }
    s -= forest * (P.res === T.FOREST ? 0.25 : 0.7);
    if (P.res === undefined && type !== 'fishery' && type !== 'pavilion') s -= rough * 0.5;
    // 이웃과 줄 맞추기, 모이기, 떨어지기
    let near = 0;
    for (const b of ctx.blds) {
      const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
      const gx = Math.max(b.x - (x + w), x - (b.x + b.w));
      const gy = Math.max(b.y - (y + h), y - (b.y + b.h));
      if (gx <= 2 && gy <= 2) {
        if (b.y + b.h === y + h && gx >= 1) s += 1.6;
        else if (b.y === y && gx >= 1) s += 0.6;
        if ((b.x === x || b.x + b.w === x + w) && gy >= 1) s += 0.8;
      }
      const bd = Math.hypot(bcx - cx, bcy - cy);
      if (P.cluster && P.cluster.includes(b.type) && bd <= P.cr) near++;
      if (P.apart && b.type === type && bd < P.apart) s -= 14;
    }
    if (P.cluster) s += Math.min(near, P.cmax) * P.cw;
    if (P.minD && dC < P.minD) s -= (P.minD - dC) * 2.5;
    if (P.res !== undefined) {
      const n = countTilesNear({ x, y, w, h }, P.res, 4.5);
      if (n < P.rmin) return null;
      s += Math.min(n, 30) * P.rw;
    }
    if (type === 'fishery' || P.water) {
      let n = 0;
      const r = type === 'fishery' ? 1 : 3;
      for (let yy = y - r; yy < y + h + r; yy++) for (let xx = x - r; xx < x + w + r; xx++) if (World.tile(xx, yy) === T.WATER && !World.isRoad(xx, yy)) n++;
      s += Math.min(n, 8) * (P.water || 0.5);
    }
    if (P.north && cy < ctx.ay) s += P.north;
    if (P.nearType) {
      let best = 99;
      for (const b of ctx.blds) if (P.nearType.includes(b.type)) best = Math.min(best, Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
      if (best < 99) s -= best * P.nw;
    }
    if (type === 'farm' && ctx.farmC) s -= Math.hypot(cx - ctx.farmC.x, cy - ctx.farmC.y) * 0.35;
    if (tw) {
      let dt = 99;
      for (const p of tw) dt = Math.min(dt, Math.hypot(cx - p.x, cy - p.y));
      s += -dt * 3;
      for (const b of ctx.blds) if (b.type === 'tower' && Math.hypot(b.x + 0.5 - cx, b.y + 0.5 - cy) < 4) return null;
      if (rd <= 2) s += 1;
    }
    if (opts.near) s -= Math.hypot(cx - opts.near.x, cy - opts.near.y) * 1.5;
    const edge = Math.min(x, y, MW - (x + w), MH - (y + h));
    if (edge < 4) s -= (4 - edge) * 2;
    return s;
  },
  // 망루를 세울 곳: 적이 넘어올 길목 (출입구에서 영주관으로 오는 길이 마을 둘레에 닿는 곳)
  towerTargets(ctx, opts) {
    const R = ctx.radius + 2;
    const df = this.distField(ctx.start, 1);
    const pts = World.exits.map((e, i) => {
      let cur = nearestWalkable(e.x, e.y, 1, 4);
      if (!cur || df[cur.y * MW + cur.x] < 0) return null;
      for (let k = 0; k < 300; k++) {
        if (Math.hypot(cur.x + 0.5 - ctx.ax, cur.y + 0.5 - ctx.ay) <= R) return { x: cur.x + 0.5, y: cur.y + 0.5, i };
        const v = df[cur.y * MW + cur.x];
        let nxt = null;
        for (const [dx, dy] of ADM_D4) {
          const nx = cur.x + dx, ny = cur.y + dy;
          if (!World.inb(nx, ny)) continue;
          const nv = df[ny * MW + nx];
          if (nv >= 0 && nv < v) { nxt = { x: nx, y: ny }; break; }
        }
        if (!nxt) return null;
        cur = nxt;
      }
      return null;
    });
    const towers = ctx.blds.filter(b => b.type === 'tower');
    const cover = p => towers.filter(t => Math.hypot(t.x + 0.5 - p.x, t.y + 0.5 - p.y) < 6.5).length;
    if (opts.exitIdx !== undefined && opts.exitIdx >= 0 && pts[opts.exitIdx]) return [pts[opts.exitIdx]];
    // 위협이 큰 이웃이 넘어오는 길목일수록 무겁다 (쳐들어올 무리가 클수록 더). 습격은 좋은 길목 둘 가운데 하나로 온다
    const wt = World.exits.map(() => 1);
    for (const t of Admin.threats()) {
      const f = S.factions[t.k];
      const w = t.k === 'heukpung' ? 1.5 + f.threat / 50
        : f.rel < -20 || f.threat >= 30 ? (1 + f.threat / 50) * clamp(t.n / 10, 0.6, 1.6) : 0.1;
      for (const i of JH.exitFor(t.k).slice(0, 2)) if (wt[i] !== undefined) wt[i] += w;
    }
    let best = null, bv = -1;
    pts.forEach((p, i) => {
      if (!p) return;
      const v = wt[i] / (1 + cover(p) * 2.5);
      if (v > bv) { bv = v; best = p; }
    });
    // 길목마다 하나씩 섰으면 마을 둘레를 고르게
    if (best && cover(best) > 0) {
      let ring = null, rv = Infinity;
      for (let a = 0; a < 8; a++) {
        const ang = a * Math.PI / 4;
        const p = { x: ctx.ax + Math.cos(ang) * R, y: ctx.ay + Math.sin(ang) * R };
        if (!World.inb(Math.floor(p.x), Math.floor(p.y))) continue;
        const c = cover(p) + (ring && a % 2 ? 0.1 : 0);
        if (c < rv) { rv = c; ring = p; }
      }
      if (ring && rv < cover(best)) return [ring];
    }
    return best ? [best] : [];
  },
  // 문에서 연결망까지: 꺾임을 싫어하는 4방향 다익스트라
  roadPath(b, net, maxLen) {
    const def = BDEF[b.type];
    const door = def.walkRows ? { x: b.x + Math.floor(b.w / 2), y: b.y + b.h } : doorOf(b);
    const starts = [];
    const add = (x, y, c) => { if (this.roadOk(x, y)) starts.push([y * MW + x, c]); };
    add(door.x, door.y, 0);
    if (!starts.length) {
      for (let x = b.x; x < b.x + b.w; x++) { add(x, b.y + b.h, 1.5); add(x, b.y - 1, 3); }
      for (let y = b.y; y < b.y + b.h; y++) { add(b.x - 1, y, 3); add(b.x + b.w, y, 3); }
    }
    if (!starts.length) return null;
    const N = MW * MH * 5;
    const g = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const heap = new AdmHeap();
    for (const [i, c] of starts) {
      if (net[i]) return [];
      const s = i * 5 + 4;
      if (c < g[s]) { g[s] = c; heap.push(s, c); }
    }
    const limit = maxLen * 1.8 + 4;
    while (heap.k.length) {
      const [s, f] = heap.pop();
      if (f > g[s]) continue;
      const i = (s / 5) | 0, dir = s % 5;
      if (net[i]) {
        const path = [];
        let cur = prev[s];
        while (cur >= 0) { const ti = (cur / 5) | 0; path.push({ x: ti % MW, y: (ti / MW) | 0 }); cur = prev[cur]; }
        path.reverse();
        if (path.filter(p => !World.isRoad(p.x, p.y)).length > maxLen) return null;
        return path;
      }
      if (f > limit) break;
      const x = i % MW, y = (i / MW) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + ADM_D4[d][0], ny = y + ADM_D4[d][1];
        if (!this.roadOk(nx, ny)) continue;
        const ni = ny * MW + nx;
        const t = World.tiles[ni];
        let c = World.road[ni] ? 0.3 : t === T.FOREST ? 1.5 : t === T.SAND ? 1.15 : 1;
        if (dir !== 4 && dir !== d) c += 0.45;
        const ns = ni * 5 + d, ng = f + c;
        if (ng < g[ns]) { g[ns] = ng; prev[ns] = s; heap.push(ns, ng); }
      }
    }
    return null;
  },
};

const Admin = {
  DEPTS: ADM_DEPTS,
  ORDER: ADM_IDS,
  TRAITS: ADM_TRAITS,
  _dirty: true, _html: '', _confirm: null, _roadFail: {}, _noSite: {}, _claims: {}, _need: {}, _work: null,

  // ── 상태 ──
  init() {
    S.admin = { v: 1, depts: {}, taxPrev: 0, taxSeen: false, trade: 0, short: null, lastFest: -99, workH: {} };
    this.normalize();
    this._roadFail = {}; this._noSite = {}; this._claims = {}; this._need = {}; this._work = null; this._dirty = true;
    if (typeof UI !== 'undefined' && !(UI.sheets && UI.sheets.admin)) admRegisterSheet();
  },
  onLoad() {
    if (!S.admin || typeof S.admin !== 'object') this.init();
    this.normalize();
    this._roadFail = {}; this._noSite = {}; this._claims = {}; this._need = {}; this._work = null; this._dirty = true;
    if (typeof UI !== 'undefined' && !(UI.sheets && UI.sheets.admin)) admRegisterSheet();
  },
  newHead() {
    const sex = Math.random() < 0.15 ? 'f' : 'm';
    const trait = weighted(Object.keys(ADM_TRAITS), k => ADM_TRAITS[k].w) || 'honest';
    return { name: makeName(sex), sex, trait, since: S ? dayOf() : 0 };
  },
  normalize() {
    const A = S.admin;
    if (!A.depts || typeof A.depts !== 'object') A.depts = {};
    for (const id of ADM_IDS) {
      const d = A.depts[id] = Object.assign({ budget: 0, fund: 0, auto: true, lv: 0, status: '', log: [], next: 0, sites: [], got: 0, gotDay: -1, spent: 0, skim: 0, lowered: [] }, A.depts[id] || {});
      if (!d.head || !ADM_TRAITS[d.head.trait]) d.head = this.newHead();
      if (!Array.isArray(d.log)) d.log = [];
      if (!Array.isArray(d.sites)) d.sites = [];
      if (!Array.isArray(d.lowered)) d.lowered = [];
      d.budget = clamp(Math.round(+d.budget || 0), 0, 999);
      d.fund = Math.max(0, +d.fund || 0);
    }
    if (A.lastFest === undefined) A.lastFest = -99;
    if (A.trade === undefined) A.trade = 0;
    // 일하는 시간 어림 (옛 저장에는 없다)
    if (!A.workH || typeof A.workH !== 'object') A.workH = {};
    for (const k in A.workH) if (!(Number.isFinite(A.workH[k]) && A.workH[k] > 0)) delete A.workH[k];
  },
  dept(id) { return S && S.admin && S.admin.depts ? S.admin.depts[id] || null : null; },
  trait(id) { const d = this.dept(id); return ADM_TRAITS[d && d.head ? d.head.trait : 'honest'] || ADM_TRAITS.honest; },
  budget(id) { const d = this.dept(id); return d ? d.budget : 0; },
  fund(id) { const d = this.dept(id); return d ? Math.floor(d.fund) : 0; },
  totalBudget() { return S && S.admin ? ADM_IDS.reduce((a, id) => a + this.budget(id), 0) : 0; },
  cap(id) {
    const d = this.dept(id);
    if (!d || !d.budget) return d ? d.fund : 0;
    // 상한보다 큰 공사를 기다리는 동안에는 그 값까지 모은다
    return Math.max(d.budget * 10, ADM_MINCAP[id], this._need[id] || 0);
  },
  // 부서 기록에 남긴다. tell 이면 마을 기록에도 "공방이 …했다." 로 남긴다
  note(id, text, tell) {
    const d = this.dept(id);
    if (!d) return;
    d.log.push({ t: S.time, text });
    if (d.log.length > 8) d.log.splice(0, d.log.length - 8);
    if (tell) { const nm = ADM_DEPTS[id].name; logMsg(`${nm}${pp(nm, '이/가')} ${text}.`, ''); }
  },
  // 다른 모듈이 부서 기금을 쓸 때 (예: 형방에 송사를 맡김)
  spendFund(id, n, why) {
    const d = this.dept(id);
    n = +n;
    if (!d || !(n >= 0) || d.fund + 1e-6 < n) return false;
    d.fund = Math.max(0, d.fund - n);
    d.spent += n;
    if (why) this.note(id, why);
    return true;
  },
  setBudget(id, n) {
    const d = this.dept(id);
    if (!d) return;
    n = clamp(Math.round(+n || 0), 0, 999);
    if (n === d.budget) return;
    d.budget = n;
    if (n > 0 && /예산이 없어/.test(d.status)) { d.status = ''; d.next = Math.min(d.next, S.time); }
    // 오늘 몫을 아직 받지 못했으면 바로 내려보낸다 (줄일 때는 돌려받지 않는다)
    this.transfer(id);
    this._dirty = true;
    Bus.emit('budgetChanged', id, n);
  },
  setAuto(id, on) {
    const d = this.dept(id);
    if (!d) return;
    d.auto = !!on;
    d.status = on ? '다시 일을 살피기 시작한다.' : '영주의 명으로 손을 놓고 있다.';
    if (on) d.next = 0;
    else if (id === 'ri') this.restoreLowered();
    this._dirty = true;
  },
  // 이방이 내려 두었던 일손을 제자리로 (only 가 있으면 그 일터만). 이방이 손을 놓으면 아무도 되돌리지 않으므로
  restoreLowered(only) {
    const d = this.dept('ri');
    if (!d || !d.lowered.length) return 0;
    let n = 0;
    d.lowered = d.lowered.filter(bid => {
      const b = getB(bid);
      if (!b) return false;
      if (only && !only(b)) return true;
      if (b.want < BDEF[b.type].workers) { b.want = BDEF[b.type].workers; n++; }
      return false;
    });
    if (n) { markDirty(); this.note('ri', `내려 두었던 일터 ${n}곳의 일손을 되돌렸다`); }
    return n;
  },
  // 예산의 하루는 묘시(6시)에 바뀐다 (dailyTick 과 같은 날짜)
  budgetDay() { return Math.floor((S.time - 6) / 24); },
  // 하루 예산을 곳간에서 기금으로 (오늘 받은 만큼은 빼고)
  transfer(id, availRef) {
    const d = this.dept(id);
    const day = this.budgetDay();
    if (d.gotDay !== day) { d.gotDay = day; d.got = 0; }
    const want = Math.max(0, Math.min(d.budget - d.got, this.cap(id) - d.fund));
    let avail = availRef ? availRef.n : Math.max(0, S.res.silver - Math.min(S.res.silver, this.upkeepEstimate()));
    const give = Math.max(0, Math.min(want, avail));
    if (give > 0) {
      S.res.silver -= give;
      const t = this.trait(id);
      const skim = t.skim ? Math.round(give * t.skim * 10) / 10 : 0;
      d.fund += give - skim;
      d.skim += skim;
      d.got += give;
      if (skim >= 1 && Math.random() < 0.3) this.note(id, `장부를 맞춰 보니 은자 ${fmt(skim)}냥이 빈다`);
      if (availRef) availRef.n -= give;
    }
    return want - give;
  },
  // 무사·객경 품삯과 공물 (곳간에 남겨 둘 몫). sim.js dailyTick 과 같게 센다 (의뢰로 떠난 이도 품삯은 받는다)
  upkeepEstimate() {
    return this.wages() + this.tribute();
  },
  wages() {
    let w = 0;
    for (const v of S.villagers) {
      if (v.dead) continue;
      if (v.hero) w += v.hero.upkeep;
      else if (v.jobType && BDEF[v.jobType].upkeep) w += BDEF[v.jobType].upkeep;
    }
    return w;
  },
  // 주군에게 바치는 공물: (4 + 인구×0.25) × 계열의 공물 배수 (상단은 0.6)
  tribute() {
    if (!S.vassal) return 0;
    const C = FACTIONS[S.vassal] && CAMPS[FACTIONS[S.vassal].camp];
    return Math.round((4 + popCount() * 0.25) * (C ? C.tribute : 1));
  },
  // 이방·형방·예방이 날마다 쓰는 경비
  dailyNeed(id) {
    const pop = popCount();
    if (id === 'ri' || id === 'hyeong') return Math.round((1 + pop * 0.1) * 10) / 10;
    if (id === 'ye') return Math.round((0.5 + pop * 0.05) * 10) / 10;
    return 0;
  },
  fee(id, type) {
    const def = BDEF[type];
    return Math.max(2, Math.round((1 + (def.time || 2) * 0.5) * this.trait(id).fee));
  },

  // ── 시각 훅 ──
  taxMul() {
    const d = this.dept('ri');
    if (!d) return 1;
    return 1 + 0.12 * clamp(d.lv, 0, 1) * this.trait('ri').eff;
  },
  happinessFactors() {
    if (!S || !S.admin) return [];
    const f = [];
    const hy = this.dept('hyeong'), ye = this.dept('ye');
    if (hy && hy.lv > 0.02) f.push(['형방의 치안', 5 * hy.lv * this.trait('hyeong').eff]);
    if (ye && ye.lv > 0.02) f.push(['예방의 보살핌', 3 * ye.lv * this.trait('ye').eff]);
    const greedy = ADM_IDS.filter(id => { const d = this.dept(id); return d && d.head && d.head.trait === 'greedy' && d.budget > 0; }).length;
    if (greedy) f.push(['아전들의 탐학', -Math.min(3, greedy)]);
    return f;
  },
  daily() {
    if (!S.admin) this.init();
    this.normalize();
    const A = S.admin;
    const day = dayOf(), bday = this.budgetDay();
    // 어제 장사로 번 돈: 시장·객잔·표국이 번 은자만 (상금·하사금은 빼고). 옛 저장에는 없으면 0
    A.trade = Math.max(0, Math.round((S.lastFlow && S.lastFlow.trade) || 0));
    A.taxSeen = true;
    this.learnWork();
    this.prune();
    // 예산 내려보내기: 품삯만큼은 곳간에 남기고, 먹을 것·지킬 것부터
    const avail = { n: Math.max(0, S.res.silver - Math.min(S.res.silver, this.upkeepEstimate())) };
    let short = 0;
    const shortIds = [];
    for (const id of ADM_FUND_ORDER) {
      const d = this.dept(id);
      d.gotDay = bday; d.got = 0;
      if (!d.budget) continue;
      const lack = this.transfer(id, avail);
      if (lack > 0.5) { short += lack; shortIds.push(id); }
    }
    const prev = A.short;
    A.short = short > 0.5 ? { day, n: Math.ceil(short), ids: shortIds, since: prev && prev.day === day - 1 ? prev.since : day } : null;
    if (A.short) {
      const names = shortIds.map(id => ADM_DEPTS[id].name).join('·');
      logMsg(`곳간이 바닥나 육방 예산 ${A.short.n}냥을 다 내려보내지 못했다 (${names}).`, 'bad');
      // 모자람이 이어지면 사흘에 한 번만 알린다
      if ((day - A.short.since) % 3 === 0) UI.toast(`곳간이 모자라 ${names}에 예산을 다 주지 못했다.`, 'bad');
    }
    // 이방·형방·예방의 날마다 쓰는 경비: 낸 만큼 효과가 난다
    for (const id of ['ri', 'hyeong', 'ye']) {
      const d = this.dept(id);
      const need = this.dailyNeed(id);
      const paid = d.auto && need > 0 ? Math.min(d.fund, need) : 0;
      d.fund -= paid;
      d.spent += paid;
      d.lv = need > 0 ? paid / need : 0;
    }
  },
  hourly() {
    if (!S || !S.admin || S.ended) return;
    this.prune();
    this.sampleWork();
    const h = Math.floor(hourOf() + 1e-6);
    const raid = this.raidInfo();
    const fighting = S.raid && S.raid.active;
    const work = h >= 7 && h <= 17;
    let placed = 0;
    const order = raid ? ['byeong', 'ho', 'gong', 'ye', 'ri', 'hyeong'] : ['ho', 'gong', 'byeong', 'ye', 'ri', 'hyeong'];
    for (const id of order) {
      const d = this.dept(id);
      if (!d.auto) { d.status = '영주의 명으로 손을 놓고 있다.'; if (id === 'ri') this.restoreLowered(); continue; }
      if (d.fund < 1 && !d.budget) { d.status = '예산이 없어 아전이 붓을 놓고 있다.'; if (id === 'ri') this.restoreLowered(); continue; }
      if (fighting) { d.status = '습격이 벌어져 모두 몸을 피했다.'; continue; }
      const urgent = (id === 'byeong' && !!raid) || (id === 'ho' && this.foodEmergency());
      if (!work && !urgent) continue;
      if (S.time < d.next && !urgent) continue;
      if (placed >= 2 && !urgent) continue;
      let r = { did: false, status: '' };
      try { r = this.act[id].call(this, d, raid) || r; } catch (e) { console.error('Admin', id, e); }
      if (r.status) d.status = r.status;
      // 기금을 모으는 중이면 기금 상한이 그 값을 따라간다
      if (r.need) this._need[id] = r.need; else delete this._need[id];
      // 점령군의 눈을 피해 일하느라 더디다
      if (S.occupation && r.status) d.status = r.status + ' (점령군 눈치를 보며)';
      if (r.did) {
        d.next = S.time + ADM_COOLDOWN[id] * this.trait(id).cd * (S.occupation ? 1.5 : 1);
        if (r.site) placed++;
      } else d.next = S.time + (urgent ? 1 : 1.5 * this.trait(id).cd);
    }
  },

  // ── 살림 형편 ──
  prune() {
    for (const id of ADM_IDS) {
      const d = this.dept(id);
      if (!d) continue;
      d.sites = d.sites.filter(sid => { const b = getB(sid); return b && !b.done && !b.ruined; });
    }
  },
  liveSites(d) { return d.sites.map(getB).filter(b => b && !b.done && !b.ruined); },
  busyStatus(d) {
    const b = this.liveSites(d)[0];
    if (!b) return '';
    const def = BDEF[b.type];
    return `${def.name} 공사를 지켜보는 중 (${Math.floor(clamp(b.progress / def.time, 0, 1) * 100)}%)`;
  },
  countAll(type) { let n = 0; for (const b of S.buildings) if (b.type === type && !b.ruined) n++; return n; },
  // 아직 일자리를 얻지 못한 어른 수 (공사 중인 일터 자리도 미리 뺀다)
  // 의뢰로 떠난 무사는 일자리를 그대로 쥐고 있으니 어른 수에도 자리 수에도 함께 든다
  laborPool() {
    let adults = 0, slots = 0;
    for (const v of S.villagers) if (!v.dead && !v.leaving && !v.hero && v.age >= 14) adults++;
    for (const b of S.buildings) {
      const def = BDEF[b.type];
      if (!def.workers || b.ruined || !b.active) continue;
      slots += Math.min(def.workers, b.want === undefined ? def.workers : b.want);
    }
    return adults - slots;
  },
  freeHousing() {
    let h = housingTotal();
    for (const b of S.buildings) if (!b.done && !b.ruined) h += BDEF[b.type].housing || 0;
    return h - popCount();
  },
  homeless() { return S.villagers.filter(v => !v.dead && !v.leaving && !v.arriving && !v.home).length; },
  // 앞으로 열이틀 곳간을 굴려 본다 (빈집을 채우러 올 식구까지 셈한다)
  // 거두는 양과 먹는 양은 sim.js economyStep 과 같은 배수로 셈한다: 철·땅 생김(farmMul·fishMul), 추운 겨울의 식량(foodUseMul)
  foodForecast() {
    const pop = popCount(), day = dayOf(), si = seasonIdx();
    const incoming = clamp(this.freeHousing(), 0, 6);
    const cons = pop * 2 * foodUseMul(si);
    const consOf = s => (pop + incoming) * 2 * foodUseMul(s);
    const consF = consOf(si);
    // 지금 거두는 일손: 다 지은 논밭·어장에서 일하는 이 (의뢰로 떠난 이는 자리만 지킬 뿐 거두지 않는다)
    let farmW = 0, fishW = 0, farmOpen = 0, fishOpen = 0, farmSoon = 0, fishSoon = 0;
    for (const b of S.buildings) {
      if ((b.type !== 'farm' && b.type !== 'fishery') || b.ruined || !b.active) continue;
      const cap = Math.min(BDEF[b.type].workers, b.want);
      const isFarm = b.type === 'farm';
      if (!b.done) { if (isFarm) farmSoon += cap; else fishSoon += cap; continue; }
      const w = Math.min(cap, (b._workers || []).filter(v => !v.away).length);
      if (isFarm) { farmW += w; farmOpen += cap - w; } else { fishW += w; fishOpen += cap - w; }
    }
    // 빈 자리는 일 없는 사람이 곧 채운다 (논밭이 먼저: refreshAssign 의 일자리 순서). 짓는 중인 일터는 내일부터
    let idle = 0;
    for (const v of S.villagers) if (!v.dead && !v.leaving && !v.away && !v.arriving && !v.down && !v.hero && !v.job && v.age >= 14) idle++;
    const take = n => { const t = Math.min(n, idle); idle -= t; return t; };
    farmW += take(farmOpen); fishW += take(fishOpen);
    const farmW2 = farmW + take(farmSoon), fishW2 = fishW + take(fishSoon);
    // 사건이 건 효과는 그 끝날까지만 (dailyTick 이 until <= 날이면 지운다)
    const modOn = (id, d) => S.mods.some(o => o.id === id && o.until > d);
    const drought = d => modOn('drought', d) ? (modOn('well_dug', d) ? 0.7 : 0.4) : 1;
    const harvest = d => modOn('harvest', d) ? 1.4 : 1;
    const m = d => (modOn('quarantine', d) ? 0.6 : 1) * (S.occupation ? 0.85 : 1);
    const hF = this.workHours('farm'), hX = this.workHours('fishery');
    const prod = (s, d, fw, xw) => (fw * 0.66 * farmMul(s) * drought(d) * harvest(d) * hF + xw * 0.56 * fishMul(s) * hX) * m(d);
    const cap = storageCap();
    let food = S.res.food, low = food;
    // 가을에는 겨울이 끝날 때까지 내다본다 (겨울이 없는 고을은 열이틀)
    const dIn = day % DAYS_PER_SEASON;
    const winterAhead = si === 2 && isWinter(3);
    const horizon = winterAhead ? Math.max(12, DAYS_PER_SEASON * 2 - dIn) : 12;
    for (let k = 1; k <= horizon; k++) {
      const s = Math.floor((day + k) / DAYS_PER_SEASON) % 4;
      food = Math.min(cap, food + prod(s, day + k, farmW2, fishW2) - consOf(s));   // 바닥 아래로 내려가면 그만큼 모자란 것
      low = Math.min(low, food);
    }
    const winterSoon = isWinter(si) || (winterAhead && dIn >= 3);
    // 모자란 양을 메우려면 논밭이 몇 곳 더 있어야 하나
    const ws = winterSoon ? 3 : si;
    const farmYield = 3 * 0.66 * farmMul(ws) * drought(day) * harvest(day) * hF * m(day);
    const now = prod(si, day, farmW, fishW);
    const gap = Math.max(0, consF * 1.05 - now) + Math.max(0, consF * 3 - low) / 6;
    return { cons, consF, now, low, end: food, winterSoon, farmYield, farmsNeeded: Math.ceil(gap / Math.max(4, farmYield)) };
  },
  // 일꾼 한 사람이 하루에 실제로 일하는 시간. 처음에는 어림값이고, 호방이 시각마다 일터를 둘러본 것으로 고쳐 간다
  // (어장은 물가를 찾아 오가는 길이 고을마다 달라 더 그렇다)
  workHours(type) {
    const w = S.admin && S.admin.workH;
    const h = w && w[type];
    return Number.isFinite(h) && h > 0 ? h : ADM_WORK_H[type] || ADM_WORK_H.shop;
  },
  // 시각마다: 논밭·어장에 매인 사람 가운데 지금 손을 놀리는 이를 센다 (hourly)
  sampleWork() {
    const acc = this._work || (this._work = { hours: 0, farm: [0, 0], fishery: [0, 0] });
    acc.hours++;
    for (const v of S.villagers) {
      if (v.dead || v.leaving || v.away || !v.job || (v.jobType !== 'farm' && v.jobType !== 'fishery')) continue;
      const b = getB(v.job);
      if (!b || !b.done || !b.active) continue;
      const a = acc[v.jobType];
      a[1]++;
      if (isWorking(v)) a[0]++;
    }
  },
  // 하루 치 둘러본 것으로 일하는 시간을 고친다 (천천히 따라간다)
  learnWork() {
    const A = S.admin, acc = this._work;
    this._work = null;
    if (!acc || acc.hours < 20) return;   // 하루를 다 둘러보지 못했으면 (막 불러온 날) 고치지 않는다
    if (!A.workH || typeof A.workH !== 'object') A.workH = {};
    for (const t of ['farm', 'fishery']) {
      const [on, n] = acc[t];
      if (n < 12) continue;   // 한나절 넘게 둘러본 일손이 있어야 믿는다
      const h = clamp(on / n * 24, 2, 14);
      A.workH[t] = Math.round((this.workHours(t) * 0.7 + h * 0.3) * 100) / 100;
    }
  },
  foodEmergency() { return S.res.food < popCount() * 1.5; },
  // 곡식이 달리는가: 지금 거두는 양이 모자라거나, 앞으로 곳간이 바닥 근처까지 줄어들 때
  foodShort(ff) {
    if (ff.now < ff.consF) return true;
    // 겨울을 앞두고는 넉넉히 (닷새 치)
    if (ff.low < ff.consF * (ff.winterSoon ? 5 : 3) && ff.low < S.res.food - 1) return true;
    return S.res.food < ff.consF * 1.5 && ff.now < ff.consF * 1.3;
  },
  raidInfo() {
    if (!S) return null;
    const q = S.eventQueue.find(e => e.id === '_raid');
    if (q && q.data) return { k: q.data.k, exitIdx: q.data.exitIdx === undefined ? -1 : q.data.exitIdx };
    const s = S.scheduled.find(x => x.kind === 'raid');
    if (s) {
      let idx = Number.isInteger(s.exitIdx) && World.exits[s.exitIdx] ? s.exitIdx : -1;
      if (idx < 0 && s.exit) idx = World.exits.findIndex(e => e.x === s.exit.x && e.y === s.exit.y);
      if (idx < 0 && FACTIONS[s.faction]) idx = JH.exitFor(s.faction)[0];
      return { k: s.faction, exitIdx: idx };
    }
    return null;
  },
  // 병방이 살피는 이웃의 칼끝: 군사가 있고, 주군·동맹·점령군이 아닌 이웃. 위협이 큰 것부터
  // n: 쳐들어오면 몇 명인지(JH.raidEstimate), exitIdx: 그들이 넘어올 길목, word: 첩자가 없을 때 보이는 낱말
  threats() {
    if (!S || !S.factions) return [];
    const pacts = S.jh ? S.jh.pacts : [];
    const out = [];
    for (const k of JH.near()) {
      const F = FACTIONS[k], f = S.factions[k];
      if (!F || !f || !F.military || k === S.vassal || pacts.includes(k)) continue;
      if ((S.jh && !JH.isAlive(k)) || (S.occupation && S.occupation.faction === k)) continue;
      out.push({ k, threat: f.threat, n: JH.raidEstimate(k), exitIdx: JH.exitFor(k)[0], word: JH.threatWord(k), spied: JH.spied(k) });
    }
    return out.sort((a, b) => b.threat - a.threat || b.n - a.n);
  },
  // 마을에 남아 싸울 무사·객경 (의뢰로 떠난 이, 쓰러진 이는 빼고)
  defenders() {
    let n = 0;
    for (const v of S.villagers) if (!v.dead && !v.leaving && !v.away && !v.down && (v.role === 'guard' || v.hero)) n++;
    return n;
  },
  awayFighters() { return S.villagers.filter(v => !v.dead && v.away).length; },
  // 병방 카드의 둘째 줄: 가장 위협이 큰 이웃(술렁 이상)과 마을에 남은 무사·의뢰로 떠난 무사
  watchText() {
    if (!S || !S.factions) return null;
    const top = this.threats()[0];
    const away = this.awayFighters();
    if (!(top && top.threat >= 30) && !away) return null;
    const def = `남은 무사 ${this.defenders()}명${away ? ` · 의뢰로 떠난 무사 ${away}명` : ''}`;
    return { text: top && top.threat >= 30 ? `${this.threatText(top)} · ${def}` : def, hot: !!top && top.threat >= 70 };
  },
  // 이웃의 기색을 한 줄로: 첩자가 있으면 정확한 위협, 없으면 낱말
  threatText(t) {
    const nm = FACTIONS[t.k].name;
    const verb = { '잠잠': '잠잠하다', '술렁': '술렁인다' }[t.word] || t.word;
    return `${nm}${pp(nm, '이/가')} ${verb}${t.spied ? ` (위협 ${Math.round(t.threat)}%)` : ''} · 쳐들어오면 약 ${t.n}명`;
  },
  // 큰 공사를 앞둔 부서는 재료를 잠시 찜해 둔다 (다른 부서가 다 써 버리지 않게)
  claim(id, cost) {
    this._claims[id] = { wood: cost.wood || 0, stone: cost.stone || 0, until: S.time + 8 };
  },
  unclaim(id) { delete this._claims[id]; },
  claimed(k, except) {
    let n = 0;
    for (const id in this._claims) {
      const c = this._claims[id];
      if (id === except || !c || c.until < S.time) continue;
      n += c[k] || 0;
    }
    return n;
  },
  // 이 부서가 쓸 수 있는 재료 (급하면 찜해 둔 것도 쓴다)
  matAvail(k, id, urgent) {
    return urgent ? S.res[k] : Math.max(0, S.res[k] - this.claimed(k, id));
  },
  // 재료가 모자라면 상인에게 사도 되는가: 급하거나, 그 재료를 내는 일터가 없을 때
  mayBuy(cost, urgent, id) {
    if (urgent) return true;
    const makes = { wood: 'lumber', stone: 'quarry' };
    let buy = 0;
    for (const k of ['wood', 'stone']) {
      const have = this.matAvail(k, id, false);
      if (!cost[k] || have >= cost[k]) continue;
      // 그 재료를 내는 일터가 있거나 지어지는 중이면 기다린다
      if (S.buildings.some(b => b.type === makes[k] && !b.ruined && (!b.done || (b._workers || []).length))) return false;
      buy += (cost[k] - have) * ADM_PRICE[k];
    }
    // 웃돈이 너무 크면 사지 않는다
    return buy <= Math.max(24, (cost.silver || 0) * 0.5);
  },
  planCost(id, cost, fee, urgent) {
    let buy = 0;
    const short = {};
    for (const k of ['wood', 'stone']) {
      const lack = Math.max(0, Math.ceil((cost[k] || 0) - this.matAvail(k, id, urgent)));
      if (lack) { short[k] = lack; buy += Math.ceil(lack * ADM_PRICE[k]); }
    }
    const silver = (cost.silver || 0) + fee;
    return { silver, fee, buy, short, total: silver + buy };
  },
  shortText(cost, def, id) {
    const k = (cost.stone || 0) > this.matAvail('stone', id, false) ? 'stone' : 'wood';
    const nm = RESOURCES[k].name;
    const other = this.claimed(k, id) > 0 && S.res[k] >= (cost[k] || 0) ? ' · 다른 부서 몫이 먼저' : '';
    return `${nm}${pp(nm, '이/가')} 모자라 ${def.name}${pp(def.name, '을/를')} 미룬다 (${fmt(this.matAvail(k, id, false))}/${cost[k]}${other})`;
  },

  // ── 짓기 ──
  findSite(type, opts = {}) {
    const def = BDEF[type];
    if (!S || !def || def.line || type === 'gate' || type === 'manor') return null;
    if (def.rank && S.rank < def.rank) return null;
    const ctx = AdmSite.context();
    const P = ADM_PROFILE[type] || ADM_PROFILE._;
    if (type === 'farm') {
      const farms = ctx.blds.filter(b => b.type === 'farm');
      if (farms.length) ctx.farmC = { x: farms.reduce((a, b) => a + b.x + 1.5, 0) / farms.length, y: farms.reduce((a, b) => a + b.y + 1.5, 0) / farms.length };
    }
    const tw = type === 'tower' ? AdmSite.towerTargets(ctx, opts) : null;
    if (tw && !tw.length) return null;
    const maxD = (opts.maxDist || ctx.maxD) + (P.far || 0);
    const cands = [];
    for (let y = 2; y + def.h <= MH - 2; y++) for (let x = 2; x + def.w <= MW - 2; x++) {
      const dC = Math.hypot(x + def.w / 2 - ctx.ax, y + def.h / 2 - ctx.ay);
      if (dC > maxD) continue;
      if (!AdmSite.fits(def, x, y, ctx)) continue;
      const s = AdmSite.score(type, def, P, x, y, dC, ctx, tw, opts);
      if (s === null) continue;
      cands.push({ x, y, s });
    }
    cands.sort((a, b) => b.s - a.s);
    let tries = 0;
    for (const c of cands) {
      if (tries >= 40) break;
      if (!AdmSite.placeOk(type, c.x, c.y)) continue;
      tries++;
      if (!AdmSite.keepsPaths(def, c.x, c.y, ctx)) continue;
      return { x: c.x, y: c.y };
    }
    return null;
  },
  // 터를 골라 짓는다. opts.payFrom: 'treasury'(곳간, 기본) 또는 부서 id (그 부서 기금)
  orderBuild(type, opts = {}) {
    const def = BDEF[type];
    if (!S || !def) return { ok: false, why: '알 수 없는 건물이다' };
    if (def.rank && S.rank < def.rank) return { ok: false, why: `마을이 ${RANKS[def.rank].name} 이상이어야 한다` };
    const from = opts.payFrom || 'treasury';
    const d = from === 'treasury' ? null : this.dept(from);
    if (from !== 'treasury' && !d) return { ok: false, why: '그런 부서는 없다' };
    let plan = null;
    if (d) {
      plan = this.planCost(from, def.cost, opts.fee !== undefined ? opts.fee : this.fee(from, type), opts.urgent);
      if (plan.buy && opts.buy === false) return { ok: false, why: '재료가 모자라다', poor: true };
      if (d.fund + 1e-6 < plan.total) return { ok: false, why: '기금이 모자라다', poor: true, need: plan.total };
    } else if (!canAfford(def.cost)) return { ok: false, why: '재료가 모자라다', poor: true };
    // 터가 없던 건물은 한동안 다시 찾지 않는다 (지도 전체를 훑는 일이라 무겁다)
    const nsKey = type + (opts.exitIdx !== undefined ? '@' + opts.exitIdx : '') + (opts.near ? '@n' : '');
    if (this._noSite[nsKey] && this._noSite[nsKey] > S.time && opts.x === undefined) return { ok: false, why: '알맞은 터가 없다', nosite: true };
    const site = opts.x !== undefined && opts.y !== undefined ? { x: opts.x, y: opts.y } : this.findSite(type, opts);
    if (!site) { this._noSite[nsKey] = S.time + 8; return { ok: false, why: '알맞은 터가 없다', nosite: true }; }
    let r;
    if (!d) r = tryBuild(type, site.x, site.y);
    else {
      // 은자는 부서 기금에서, 목재·석재는 곳간에서. 모자란 재료는 지나는 상인에게 웃돈을 주고 산다
      const inj = { silver: def.cost.silver || 0, wood: plan.short.wood || 0, stone: plan.short.stone || 0 };
      d.fund -= plan.total;
      for (const k in inj) S.res[k] += inj[k];
      r = tryBuild(type, site.x, site.y);
      if (!r.ok) {
        d.fund += plan.total;
        for (const k in inj) S.res[k] = Math.max(0, S.res[k] - inj[k]);
        return r;
      }
      d.spent += plan.total;
      this.unclaim(from);
      if (plan.buy) this.note(from, `지나는 상인에게서 사들였다: ${Object.keys(plan.short).map(k => `${RESOURCES[k].name} ${plan.short[k]}`).join(' · ')} (${plan.buy}냥)`);
    }
    const b = r.b;
    let roadN = 0;
    if (opts.road !== false && !ADM_NO_ROAD.has(type)) {
      const rr = this.orderRoadTo(b, { payFrom: from, maxLen: 20 });
      if (rr.ok) roadN = rr.n;
    }
    if (d) {
      d.sites.push(b.id);
      const D = ADM_DEPTS[from];
      const why = opts.reason ? ` ${opts.reason}` : '';
      this.note(from, `${def.name} 공사를 시작했다${roadN ? ` (길 ${roadN}칸)` : ''}`);
      logMsg(`${D.name}${pp(D.name, '이/가')} ${def.name}${pp(def.name, '을/를')} 짓기 시작했다.${why}`, '');
      if (typeof floatText === 'function') floatText(b.x + b.w / 2, b.y + b.h / 2, `${D.name} · ${def.name}`, '#e8c46a', false, 10);
      Bus.emit('deptBuilt', from, b);
    }
    return { ok: true, b, road: roadN };
  },
  // 건물 문에서 가장 가까운 길까지 길을 깐다 (한 칸에 은자 1냥)
  orderRoadTo(b, opts = {}) {
    if (!S || !b || !S.bmap.get(b.id)) return { ok: false, n: 0, why: '건물이 없다' };
    const from = opts.payFrom || 'treasury';
    const d = from === 'treasury' ? null : this.dept(from);
    const net = AdmSite.network();
    const path = AdmSite.roadPath(b, net, opts.maxLen || 26);
    if (!path) return { ok: false, n: 0, why: '길을 낼 수 없다' };
    const tiles = path.filter(p => !World.isRoad(p.x, p.y));
    const n = tiles.length;
    if (!n) return { ok: true, n: 0 };
    if (d) {
      if (d.fund + 1e-6 < n) return { ok: false, n: 0, why: '기금이 모자라다', poor: true };
      d.fund -= n; d.spent += n;
      for (const p of tiles) { setRoad(p.x, p.y, true); Bus.emit('road', p.x, p.y); }
    } else {
      if (S.res.silver < n) return { ok: false, n: 0, why: '은자가 모자라다', poor: true };
      for (const p of tiles) setRoad(p.x, p.y);
    }
    return { ok: true, n };
  },
  // 부서가 짓기를 시도하고 상태 문장을 돌려준다
  attempt(id, type, opts = {}) {
    const d = this.dept(id), def = BDEF[type];
    if (def.rank && S.rank < def.rank) return { did: false, status: '' };
    const fee = this.fee(id, type);
    const plan = this.planCost(id, def.cost, fee, opts.urgent);
    const allowBuy = opts.buy !== undefined ? opts.buy : this.mayBuy(def.cost, opts.urgent, id);
    if (plan.buy && !allowBuy) {
      if (d.fund + 1e-6 >= plan.silver && !opts.noClaim) this.claim(id, def.cost);
      return { did: false, status: this.shortText(def.cost, def, id), wait: true };
    }
    if (d.fund + 1e-6 < plan.total) return this.waitFund(id, def.name, plan.total, false);
    const r = this.orderBuild(type, Object.assign({ payFrom: id, buy: allowBuy }, opts));
    if (!r.ok) return { did: false, status: r.nosite ? `${def.name}${pp(def.name, '을/를')} 지을 마땅한 터가 없다` : `${def.name}: ${r.why}`, nosite: !!r.nosite };
    return { did: true, site: true, status: `${def.name} 터를 닦기 시작했다.` };
  },
  // 기금이 모자랄 때의 상태. 예산이 끊겼으면 더 들어올 돈이 없다고, 상한을 넘는 일이면 예산을 늘리라고 알린다
  waitFund(id, name, total, redo) {
    const d = this.dept(id);
    if (!d.budget) return { did: false, status: `예산이 끊겨 남은 기금 ${fmt(d.fund)}냥으로는 ${name}${pp(name, '을/를')} ${redo ? '다시 세우지' : '짓지'} 못한다`, wait: true };
    const slow = total > Math.max(d.budget * 10, ADM_MINCAP[id]) ? ' · 예산을 늘려야 빨리 모인다' : '';
    return { did: false, status: `${name} ${redo ? '다시 세울' : '지을'} 기금을 모으는 중 (${fmt(d.fund)}/${total}냥${slow})`, wait: true, need: total };
  },
  // 여럿 가운데 기금으로 지금 지을 수 있는 것부터 (모두 모자라면 첫째 것을 기다린다)
  attemptAny(id, types, opts = {}) {
    const d = this.dept(id);
    let first = null, last = null;
    for (const t of types) {
      const def = BDEF[t];
      if (def.rank && S.rank < def.rank) continue;
      const plan = this.planCost(id, def.cost, this.fee(id, t), opts.urgent);
      const allowBuy = this.mayBuy(def.cost, opts.urgent, id);
      const can = d.fund + 1e-6 >= plan.total && (!plan.buy || allowBuy);
      if (!can) { if (!first) first = this.attempt(id, t, opts); continue; }
      const r = this.attempt(id, t, opts);
      if (r.did) return r;
      last = r;
    }
    return first || last;
  },
  // 폐허를 다시 세운다 (은자는 기금에서, 재료는 곳간에서)
  repairFor(id, b, urgent) {
    const d = this.dept(id), def = BDEF[b.type];
    const c = repairCost(b);
    const plan = this.planCost(id, c, this.fee(id, b.type), urgent);
    if (plan.buy && !this.mayBuy(c, urgent, id)) return { did: false, status: this.shortText(c, def, id), wait: true };
    if (d.fund + 1e-6 < plan.total) return this.waitFund(id, def.name, plan.total, true);
    const inj = { silver: c.silver || 0, wood: plan.short.wood || 0, stone: plan.short.stone || 0 };
    d.fund -= plan.total;
    for (const k in inj) S.res[k] += inj[k];
    if (!repair(b)) {
      d.fund += plan.total;
      for (const k in inj) S.res[k] = Math.max(0, S.res[k] - inj[k]);
      return { did: false, status: `${def.name}${pp(def.name, '을/를')} 다시 세우지 못했다` };
    }
    d.spent += plan.total;
    this.unclaim(id);
    d.sites.push(b.id);
    const D = ADM_DEPTS[id];
    this.note(id, `무너진 ${def.name}${pp(def.name, '을/를')} 다시 세운다`);
    logMsg(`${D.name}${pp(D.name, '이/가')} 무너진 ${def.name}${pp(def.name, '을/를')} 다시 세우기 시작했다.`, '');
    if (typeof floatText === 'function') floatText(b.x + b.w / 2, b.y + b.h / 2, `${D.name} · 복구`, '#e8c46a', false, 10);
    if (!ADM_NO_ROAD.has(b.type)) this.orderRoadTo(b, { payFrom: id, maxLen: 14 });
    return { did: true, site: true, status: `무너진 ${def.name}${pp(def.name, '을/를')} 다시 세우기 시작했다.` };
  },
  // 창고가 더 있어야 하나: 곳간이 거의 찼고, 쌓아 둘 만한 양(겨울 곡식, 재목)보다 곳간이 작을 때
  needStore(frac = 0.85) {
    const pop = popCount(), cap = storageCap();
    if (this.countAll('warehouse') >= 1 + Math.floor(pop / 25)) return false;
    const target = { food: Math.max(500, pop * 12), wood: Math.max(500, 300 + pop * 3), stone: Math.max(500, 300 + pop * 3) };
    return ['food', 'wood', 'stone'].some(k => S.res[k] >= cap * frac && cap < target[k]);
  },
  // 그 출입구에서 오는 길목을 이미 망루 둘이 지키고 있는가
  exitCovered(exitIdx) {
    if (exitIdx === undefined || exitIdx < 0) return false;
    const ctx = AdmSite.context();
    const p = AdmSite.towerTargets(ctx, { exitIdx })[0];
    if (!p) return true;
    return S.buildings.filter(b => b.type === 'tower' && !b.ruined && Math.hypot(b.x + 0.5 - p.x, b.y + 0.5 - p.y) < 6.5).length >= 2;
  },
  // 급한 곳에 사람을 보낼 때 덜 아쉬운 일터부터 (그 일터의 일꾼 하나를 뺀다)
  pickDonor(work, isT, k, raid, plenty, hungry) {
    const staffed = b => (b._workers || []).length;
    const towersManned = work.filter(b => b.type === 'tower' && staffed(b)).length;
    const groups = [
      b => b.type === 'inn' || b.type === 'market' || b.type === 'escort',
      b => b.type === 'smithy',
      b => b.type === 'quarry' && S.res.stone >= 40 && b.want > 1,
      b => b.type === 'lumber' && S.res.wood >= 60 && b.want > 1,
      b => (b.type === 'farm' || b.type === 'fishery') && !hungry && b.want > 1,
      b => b.type === 'clinic' && !hasMod('plague'),
      b => b.type === 'dojo' && !raid && b.want > 2,
      b => b.type === 'tower' && !raid && towersManned > 1,
    ];
    for (const g of groups) {
      const b = work.filter(x => !isT(x) && g(x) && staffed(x) > 0 && x.want > 0)
        .sort((a, c) => staffed(c) - staffed(a))[0];
      if (b) return b;
    }
    return null;
  },
  // 어느 폐허부터 다시 세울까
  ruinRank(b, free) {
    const t = b.type;
    if (BDEF[t].housing) return free < 3 ? 9 : 4;
    if (t === 'farm' || t === 'fishery') return 8;
    if (t === 'dojo' || t === 'tower') return 6;
    if (BDEF[t].workers) return 5;
    return 3;
  },
  // 길에 닿지 않은 건물 (가까운 것부터)
  unconnected() {
    const net = AdmSite.network();
    const m = getB(S.manorId);
    const ax = m ? m.x + 1.5 : World.center.x, ay = m ? m.y + 1.5 : World.center.y;
    const list = S.buildings.filter(b => {
      if (ADM_CONNECT.indexOf(b.type) < 0 || b.ruined) return false;
      if (this._roadFail[b.id] && this._roadFail[b.id] > S.time) return false;
      const def = BDEF[b.type];
      const dt = def.walkRows ? { x: b.x + Math.floor(b.w / 2), y: b.y + b.h } : doorOf(b);
      return World.inb(dt.x, dt.y) && !net[dt.y * MW + dt.x];
    });
    list.sort((a, b) => (ADM_CONNECT.indexOf(a.type) - ADM_CONNECT.indexOf(b.type)) * 4
      + Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay));
    return list[0] || null;
  },
  setWant(b, n, id, text) {
    n = clamp(n, 0, BDEF[b.type].workers);
    if (b.want === n) return false;
    b.want = n;
    markDirty();
    if (text) this.note(id, text, true);
    return true;
  },

  // ── 부서마다 하는 일 ──
  act: {
    ri(d) {
      const ff = this.foodForecast();
      const hungry = this.foodShort(ff);
      const cap = storageCap();
      const plenty = S.res.food >= cap * 0.9 || (ff.now > ff.consF * 1.5 && S.res.food > ff.cons * 12);
      const work = S.buildings.filter(b => usable(b) && b.active && BDEF[b.type].workers);
      const isFood = b => b.type === 'farm' || b.type === 'fishery';
      const staffed = b => (b._workers || []).length;
      const open = b => staffed(b) < Math.min(BDEF[b.type].workers, b.want);
      const pay = () => { const n = Math.min(1, d.fund); d.fund -= n; d.spent += n; };
      const lower = b => { if (d.lowered.indexOf(b.id) < 0) d.lowered.push(b.id); };
      const raid = !!this.raidInfo();
      d.lowered = d.lowered.filter(bid => getB(bid));
      // 급한 일손: 곡식 > 목재 > 석재
      const crises = [];
      if (hungry) crises.push(['food', isFood, '논밭']);
      if (S.res.wood < 25 && !work.some(b => b.type === 'lumber' && staffed(b) >= 2)) crises.push(['wood', b => b.type === 'lumber', '벌목장']);
      if (S.res.stone < 12 && !work.some(b => b.type === 'quarry' && staffed(b))) crises.push(['stone', b => b.type === 'quarry', '채석장']);
      // 마을에 남은 무사가 하나도 없으면 무관에 사람을 보낸다 (의뢰로 떠난 이는 셈하지 않는다)
      if (!hungry && popCount() >= 14 && !S.villagers.some(v => !v.dead && !v.away && v.role === 'guard' && v.jobType === 'dojo')) crises.push(['guard', b => b.type === 'dojo', '무관']);
      // 손쓸 일터가 있는 위기만 센다 (무관·벌목장이 아예 없으면 위기라도 할 일이 없다)
      const live = crises.filter(([, isT]) => work.some(b => isT(b) && (b.want < BDEF[b.type].workers || open(b))));
      for (const [k, isT, where] of live) {
        const targets = work.filter(isT);
        // 1) 내려 두었던 자리부터 되살린다
        const low = targets.find(b => b.want < BDEF[b.type].workers);
        if (low) {
          this.setWant(low, BDEF[low.type].workers, 'ri', `${BDEF[low.type].name} 일손을 가득 채우게 했다`);
          d.lowered = d.lowered.filter(x => x !== low.id);
          pay();
          return { did: true, status: `${where} 일손부터 채운다.` };
        }
        if (!targets.some(open)) continue;
        // 2) 사람들은 일자리 순서대로 가므로, 더 앞서는 빈자리는 잠시 닫는다
        const pr = Math.max(...targets.map(b => JOB_PRIORITY[b.type] || 0));
        let froze = 0;
        for (const b of work) {
          if (isT(b) || !open(b) || (JOB_PRIORITY[b.type] || 0) < pr) continue;
          if (isFood(b) && hungry) continue;
          // 습격이 다가오면 망루·무관은 닫지 않는다 (경보가 오면 닫아 둔 망루도 다시 연다)
          if ((b.type === 'tower' || b.type === 'dojo') && raid) continue;
          b.want = staffed(b); lower(b); froze++;
        }
        if (froze) markDirty();
        // 3) 놀고 있는 사람이 없으면 덜 급한 일터에서 한 사람을 뺀다
        let idle = 0;
        for (const v of S.villagers) if (!v.dead && !v.leaving && !v.away && !v.hero && !v.job && !v.arriving && v.age >= 14) idle++;
        if (idle > 0) { if (froze) { pay(); return { did: true, status: `일 없는 이를 ${where}${pp(where, '으로/로')} 보낸다.` }; } continue; }
        const donor = this.pickDonor(work, isT, k, raid, plenty, hungry);
        if (donor) {
          this.setWant(donor, donor.want - 1, 'ri', `${BDEF[donor.type].name} 일꾼 하나를 ${where}${pp(where, '으로/로')} 돌렸다`);
          lower(donor);
          pay();
          return { did: true, status: `${where}${pp(where, '이/가')} 급해 일손을 돌린다.` };
        }
      }
      if (!live.length) {
        // 급한 일이 지나면 내려 두었던 일터를 하나씩 되돌린다
        for (const bid of d.lowered.slice()) {
          const b = getB(bid);
          if (!b) { d.lowered = d.lowered.filter(x => x !== bid); continue; }
          // 무너졌거나 다시 짓는 중이면 다 지은 뒤에 되돌린다
          if (!usable(b)) continue;
          if (isFood(b) && plenty) continue;
          if (b.type === 'lumber' && S.res.wood >= cap * 0.9) continue;
          if (b.type === 'quarry' && S.res.stone >= cap * 0.9) continue;
          d.lowered = d.lowered.filter(x => x !== bid);
          if (b.want < BDEF[b.type].workers) {
            this.setWant(b, BDEF[b.type].workers, 'ri', `${BDEF[b.type].name} 일손을 되돌렸다`);
            pay();
            return { did: true, status: '내려 두었던 일손을 제자리로 돌렸다.' };
          }
        }
        // 곡식이 넘치면 농부 하나를 빈 일터로
        if (plenty && work.some(b => !isFood(b) && open(b))) {
          const f = work.filter(b => b.type === 'farm' && b.want > 1).sort((a, b) => b.want - a.want)[0];
          if (f) {
            this.setWant(f, f.want - 1, 'ri', '곡식이 넘쳐 농부 하나를 다른 일터로 돌렸다');
            lower(f);
            pay();
            return { did: true, status: '곳간이 넘쳐 농부를 다른 일터로 돌린다.' };
          }
        }
        // 목재·석재가 넘치면 일손을 줄인다
        for (const [t, k] of [['lumber', 'wood'], ['quarry', 'stone']]) {
          if (S.res[k] < cap * 0.92) continue;
          const b = work.find(x => x.type === t && x.want > 1);
          if (b) {
            const nm = RESOURCES[k].name;
            this.setWant(b, b.want - 1, 'ri', `${nm}${pp(nm, '이/가')} 넘쳐 ${BDEF[t].name} 일손을 줄였다`);
            lower(b);
            pay();
            return { did: true, status: `${nm}${pp(nm, '이/가')} 넘쳐 일손을 줄였다.` };
          }
        }
      }
      const labor = this.laborPool();
      const pct = Math.round((this.taxMul() - 1) * 100);
      return { did: false, status: `장부가 맞는다. 세금 +${pct}% · ${labor > 0 ? `일 없는 이 ${labor}명` : labor < 0 ? `빈 일자리 ${-labor}곳` : '일손이 꼭 맞다'}` };
    },

    ho(d) {
      const pop = popCount();
      const ff = this.foodForecast();
      const cap = storageCap();
      const short = this.foodShort(ff);
      const labor = this.laborPool();
      const busy = this.liveSites(d).length > 0;
      // 무너진 논밭·어장은 새로 짓기보다 싸다
      if (short && !busy) {
        const ruin = S.buildings.find(b => b.ruined && (b.type === 'farm' || b.type === 'fishery'));
        if (ruin) { const r = this.repairFor('ho', ruin, S.res.food < ff.cons * 3); if (r.did) return r; }
      }
      let wait = null;
      if (short && !busy && S.res.food < cap * 0.9) {
        // 새 일터에 갈 사람이 없으면 지어도 소용없다 (곧 올 식구 몇은 셈한다)
        const hands = labor + Math.min(1, Math.max(0, this.freeHousing()));
        if (hands < 1) wait = { did: false, status: '곡식이 달리는데 새 일터에 보낼 사람이 없다. 이방이 일손을 돌려야 한다.' };
        else {
          // 일손이 귀하면 논밭(일꾼 하나가 더 많이 거둔다), 은자가 귀하면 어장(삯이 싸다)
          const types = ff.winterSoon ? ['fishery', 'farm'] : hands >= 3 ? ['farm', 'fishery'] : ['farm'];
          const r = this.attemptAny('ho', types, { urgent: S.res.food < ff.cons * 3, reason: ff.winterSoon ? '겨울 곳간을 채우려 한다.' : '곡식이 달릴 것을 내다보았다.' });
          if (r && r.did) return r;
          wait = r;
        }
      }
      // 굶주릴 지경이면 상인에게서 곡식을 사들인다. 곧 논밭을 지을 수 있으면 그 돈은 아낀다
      const saving = wait && wait.wait && !busy && (10 + this.fee('ho', 'farm') - d.fund) <= Math.max(1, d.budget) * 2;
      if (this.foodEmergency() && pop > 0 && !(saving && S.res.food >= 1)) {
        const n = Math.floor(Math.min(ff.cons * 2 - S.res.food, Math.floor(d.fund) / ADM_PRICE.food, cap - S.res.food));
        if (n >= 4) {
          const cost = Math.ceil(n * ADM_PRICE.food);
          d.fund = Math.max(0, d.fund - cost); d.spent += cost;
          S.res.food = Math.min(cap, S.res.food + n);
          this.note('ho', `곡식 ${n}섬을 상인에게서 ${cost}냥에 사들였다`);
          logMsg(`호방이 굶주림을 막으려 곡식 ${n}섬을 사들였다.`, 'good');
          return { did: true, status: '곳간이 비어 곡식을 사들였다.' };
        }
      }
      if (busy) return { did: false, status: this.busyStatus(d) };
      if (wait) return wait;
      // 곳간이 차면 창고 (쌓아 둘 만한 만큼만)
      if (this.needStore() && !S.buildings.some(b => b.type === 'warehouse' && !b.done && !b.ruined)) {
        const r = this.attempt('ho', 'warehouse', { reason: '곳간이 가득 찼다.' });
        if (r.did || r.wait) return r;
      }
      // 장이 설 만하면 시장
      if (S.rank >= 1 && pop >= 20 && this.countAll('market') < 1 + Math.floor(pop / 60) && labor >= 2) {
        const r = this.attempt('ho', 'market', { reason: '장을 열어 은자를 돌게 하려 한다.' });
        if (r.did || r.wait) return r;
      }
      const days = ff.cons ? Math.floor(S.res.food / ff.cons) : 99;
      return { did: false, status: `곳간이 든든하다. 곡식 ${days}일 치${ff.winterSoon ? ' · 겨울 채비 끝' : ''}.` };
    },

    ye(d) {
      const pop = popCount();
      const A = S.admin;
      const day = dayOf();
      // 민심이 가라앉으면 잔치
      if ((S.happy < 48 || happinessTarget() < 45) && !hasMod('festival') && day - A.lastFest >= 5 && pop >= 4) {
        const cost = Math.round(10 + pop * 0.6);
        if (d.fund + 1e-6 >= cost) {
          d.fund -= cost; d.spent += cost;
          if (S.res.food > pop * 6) S.res.food -= Math.round(pop * 0.5);
          addMod('festival', 2);
          A.lastFest = day;
          this.note('ye', `마을 잔치를 열었다 (${cost}냥)`);
          logMsg('예방이 마을 잔치를 열었다. 풍물 소리에 시름이 잦아든다.', 'good');
          UI.toast('예방이 잔치를 열었다. 민심이 오른다.', 'good');
          return { did: true, status: '잔치를 열어 민심을 달랬다.' };
        }
        if (!d.budget) return { did: false, status: `예산이 끊겨 남은 기금 ${fmt(d.fund)}냥으로는 잔치를 열지 못한다`, wait: true };
        return { did: false, status: `민심이 가라앉아 잔치 비용을 모으는 중 (${fmt(d.fund)}/${cost}냥)`, wait: true, need: cost };
      }
      if (this.liveSites(d).length) return { did: false, status: this.busyStatus(d) };
      const labor = this.laborPool();
      const wish = [];
      if (hasMod('plague') && S.rank >= 1 && !this.countAll('clinic') && labor >= 1) wish.push(['clinic', '역병을 막으려 한다.']);
      if (pop >= 10 && this.countAll('well') < 1 + Math.floor(pop / 18)) wish.push(['well', '물 길을 곳이 모자라다.']);
      if (pop >= 16 && this.countAll('shrine') < 1 + Math.floor(pop / 45) + (S.happy < 50 ? 1 : 0)) wish.push(['shrine', '제를 올릴 곳이 있어야 한다.']);
      if (S.rank >= 1 && pop >= 22 && this.countAll('clinic') < 1 + Math.floor(pop / 60) && labor >= 1) wish.push(['clinic', '아픈 이를 돌볼 곳이 있어야 한다.']);
      if (S.rank >= 1 && pop >= 28 && this.countAll('pavilion') < Math.floor(pop / 30) && S.happy < 72) wish.push(['pavilion', '저녁에 쉴 곳을 두려 한다.']);
      for (const [t, why] of wish) {
        const r = this.attempt('ye', t, { reason: why });
        if (r.did || r.wait) return r;
      }
      const lv = Math.round(d.lv * 100);
      return { did: false, status: S.happy >= 60 ? `백성들의 얼굴이 밝다. 보살핌 ${lv}%.` : `민심을 살피는 중. 보살핌 ${lv}%.` };
    },

    byeong(d, raid) {
      const pop = popCount();
      const dojo = S.buildings.find(b => b.type === 'dojo' && !b.ruined);
      // 무관 일손은 늘 가득
      if (dojo && dojo.done && dojo.want < BDEF.dojo.workers && !this.foodShort(this.foodForecast())) {
        this.setWant(dojo, BDEF.dojo.workers, 'byeong', '무관 수련생을 가득 채웠다');
        return { did: true, status: '무관에 수련생을 채웠다.' };
      }
      const towers = this.countAll('tower');
      const target = 1 + Math.floor(pop / 12);
      const live = this.liveSites(d);
      if (raid) {
        const F = FACTIONS[raid.k];
        if (live.length < 2 && towers < target + 2 && !this.exitCovered(raid.exitIdx)) {
          const r = this.attempt('byeong', 'tower', { urgent: true, exitIdx: raid.exitIdx, reason: '습격에 대비해 서두른다.' });
          if (r.did) { UI.toast(`병방이 ${World.exits[raid.exitIdx] ? World.exits[raid.exitIdx].name + ' 길목에' : ''} 망루를 서둘러 올린다.`, ''); return r; }
        }
        if (S.res.weapons < 4 && d.fund >= 30) {
          const n = 8, cost = n * ADM_PRICE.weapons;
          d.fund -= cost; d.spent += cost;
          addRes('weapons', n);
          this.note('byeong', `습격에 대비해 병장기 ${n}자루를 ${cost}냥에 사들였다`, true);
          return { did: true, status: '습격에 대비해 병장기를 사들였다.' };
        }
        return { did: false, status: `${F ? F.name : '적'}의 습격에 대비하는 중${live.length ? ` · ${this.busyStatus(d)}` : ''}` };
      }
      // 이웃의 칼끝을 살핀다: 위협이 가장 큰 이웃과 마을에 남은 무사 (의뢰로 떠난 이는 빼고). 창에는 watchText 가 늘 새로 적는다
      const top = this.threats()[0] || null;
      const def = this.defenders();
      const tn = top ? FACTIONS[top.k].name : '';
      if (live.length) return { did: false, status: this.busyStatus(d) };
      const labor = this.laborPool();
      if (pop >= 8 && towers < 1 && labor >= 1) {
        const r = this.attempt('byeong', 'tower', { reason: '적이 넘어올 길목을 지킨다.' });
        if (r.did || r.wait) return r;
      }
      // 무관은 일손이 빠듯해도 세운다 (이방이 수련생을 보낸다)
      if (pop >= 10 && !dojo && labor >= -2) {
        const r = this.attempt('byeong', 'dojo', { reason: '장정들에게 무공을 가르치려 한다.' });
        if (r.did || r.wait) return r;
      }
      // 칼을 가는 이웃이 넘어올 길목에 망루를 먼저 올린다 (경보가 오기 전에)
      if (top && top.threat >= 50 && towers >= 1 && towers < target + 2 && labor >= 0 && !this.exitCovered(top.exitIdx)) {
        const exn = World.exits[top.exitIdx] ? World.exits[top.exitIdx].name : '길목';
        const r = this.attempt('byeong', 'tower', { exitIdx: top.exitIdx, reason: `${tn}${pp(tn, '이/가')} 넘어올 ${exn}${pp(exn, '을/를')} 지킨다.` });
        if (r.did || r.wait) return r;
      }
      // 칼을 가는 이웃이 있는데 병장기가 바닥이면 미리 사 둔다
      if (top && top.threat >= 70 && S.res.weapons < 4 && d.fund >= 30 + 8 * ADM_PRICE.weapons) {
        const n = 8, cost = n * ADM_PRICE.weapons;
        d.fund -= cost; d.spent += cost;
        addRes('weapons', n);
        this.note('byeong', `${tn}${pp(tn, '이/가')} 칼을 갈아 병장기 ${n}자루를 ${cost}냥에 사 두었다`, true);
        return { did: true, status: `${tn}에 대비해 병장기를 사들였다.` };
      }
      if (towers < target && labor >= 1) {
        const r = this.attempt('byeong', 'tower', { reason: '마을 둘레를 지킨다.' });
        if (r.did || r.wait) return r;
      }
      if (S.rank >= 1 && !this.countAll('smithy') && labor >= 2) {
        const r = this.attempt('byeong', 'smithy', { reason: '병장기를 벼리려 한다.' });
        if (r.did || r.wait) return r;
      }
      // 마을이 커지면 무관을 하나 더. 남은 무사가 쳐들어올 무리의 절반도 못 되면 조금 일찍
      const thin = top && top.threat >= 50 && def < top.n * 0.5;
      if (pop >= (thin ? 24 : 32) && this.countAll('dojo') < 1 + Math.floor(pop / (thin ? 24 : 32)) && labor >= (thin ? 2 : 3)) {
        const r = this.attempt('byeong', 'dojo', { reason: thin ? `${tn}에 맞설 무사가 모자라다.` : '무사가 모자라다.' });
        if (r.did || r.wait) return r;
      }
      if (top && top.threat >= 30) return { did: false, status: `${tn}의 기색을 살피는 중. 망루 ${towers}곳.` };
      return { did: false, status: `변경이 조용하다. 망루 ${towers}곳${dojo ? ' · 무관 수련 중' : ''}.` };
    },

    hyeong(d) {
      const lv = Math.round(d.lv * 100);
      let pend = 0;
      if (typeof Petitions !== 'undefined' && typeof Petitions.list === 'function') {
        try { pend = (Petitions.list() || []).filter(p => p && ADM_HYEONG_PET.has(p.type)).length; } catch (e) { pend = 0; }
      }
      return { did: false, status: `순라꾼이 마을을 돈다. 치안 ${lv}%${pend ? ` · 맡을 만한 송사 ${pend}건` : ''}.` };
    },

    gong(d) {
      const pop = popCount();
      const busy = this.liveSites(d).length > 0;
      const labor = this.laborPool();
      let wait = null;
      if (!busy) {
        const manor = getB(S.manorId);
        // 영주관 복구비를 모으는 동안에도 다른 일은 한다
        if (manor && manor.ruined) { const r = this.repairFor('gong', manor, true); if (r.did) return r; wait = r; }
        // 첫 벌목장·채석장은 일손이 빠듯해도 짓는다 (이방이 사람을 돌린다)
        const lumbers = this.countAll('lumber');
        if (!lumbers && (S.res.wood < 120 || pop >= 10)) {
          const r = this.attempt('gong', 'lumber', { reason: '목재가 바닥나고 있다.' });
          if (r.did || r.wait) return r;
        }
        if (!this.countAll('quarry') && S.res.stone < 15 && pop >= 10) {
          const r = this.attempt('gong', 'quarry', { reason: '석재가 바닥났다.' });
          if (r.did || r.wait) return r;
        }
        const free = this.freeHousing();
        const homeless = this.homeless();
        // 폐허는 새로 짓는 값의 절반이다: 집(모자랄 때)과 일터부터 다시 세운다
        const ruins = S.buildings.filter(b => b.ruined && b.type !== 'manor' && !BDEF[b.type].line && (!BDEF[b.type].housing || free < 6 || homeless))
          .sort((a, b) => this.ruinRank(b, free) - this.ruinRank(a, free));
        if (ruins.length) {
          const r = this.repairFor('gong', ruins[0], homeless > 0);
          if (r.did) return r;
          wait = wait || r;
        }
        if (free < 3 || homeless) {
          const fee2 = this.fee('gong', 'house2');
          const rich = S.rank >= 1 && S.res.stone >= 25 + 20 && S.res.wood >= 30 + 10 && d.fund >= 40 + fee2 + 6;
          const r = this.attempt('gong', rich ? 'house2' : 'house', { urgent: homeless > 0, reason: '빈집이 모자라다.' });
          if (r.did) return r;
          if (!r.nosite) wait = wait || r;
        }
        // 다른 부서가 재료를 기다리고 있으면 벌목장·채석장을 서둘러 늘린다
        const woodWait = this.claimed('wood', 'gong') > S.res.wood;
        const stoneWait = this.claimed('stone', 'gong') > S.res.stone;
        if ((S.res.wood < 100 || woodWait) && lumbers < 1 + Math.floor(pop / 20) + (woodWait ? 1 : 0) && labor >= 2) {
          const r = this.attempt('gong', 'lumber', { reason: '목재가 달린다.', urgent: woodWait, noClaim: true });
          if (r.did) return r;
          wait = wait || (r.nosite ? null : r);
        }
        if ((S.res.stone < 40 || stoneWait) && pop >= 10 && this.countAll('quarry') < 1 + Math.floor(pop / 35) + (stoneWait ? 1 : 0) && labor >= 2) {
          const r = this.attempt('gong', 'quarry', { reason: '석재가 달린다.', urgent: stoneWait, noClaim: true });
          if (r.did) return r;
          wait = wait || (r.nosite ? null : r);
        }
      }
      // 길 잇기: 공사를 지켜보는 사이에도 한다
      if (d.fund >= 2) {
        const b = this.unconnected();
        if (b) {
          const r = this.orderRoadTo(b, { payFrom: 'gong', maxLen: 20 });
          if (r.ok && r.n) {
            this.note('gong', `${BDEF[b.type].name} 앞까지 길 ${r.n}칸을 닦았다`, true);
            return { did: true, status: `${BDEF[b.type].name} 앞까지 길을 닦았다.` };
          }
          if (!r.poor) this._roadFail[b.id] = S.time + 24;
        }
      }
      if (busy) return { did: false, status: this.busyStatus(d) };
      if (wait) return wait;
      // 넉넉하면 초가에 기와를 올린다
      if (S.rank >= 1 && this.freeHousing() >= 3) {
        const c = typeof upgradeCost === 'function' ? upgradeCost() : { wood: 20, stone: 25, silver: 40 };
        const fee = this.fee('gong', 'house2');
        if (d.fund >= c.silver + fee + 30 && S.res.stone >= c.stone + 40 && S.res.wood >= c.wood + 40) {
          const m = getB(S.manorId);
          const h = S.buildings.filter(b => b.type === 'house' && usable(b))
            .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
          if (h) {
            d.fund -= c.silver + fee; d.spent += c.silver + fee;
            S.res.wood -= c.wood; S.res.stone -= c.stone;
            h.type = 'house2'; h.maxHp = BDEF.house2.hp;
            h.done = false; h.progress = BDEF.house2.time * 0.4; h.hp = h.maxHp * 0.5;
            markDirty();
            d.sites.push(h.id);
            this.note('gong', '초가에 기와를 올리기 시작했다');
            logMsg('공방이 초가 한 채에 기와를 올리기 시작했다.', '');
            return { did: true, site: true, status: '초가에 기와를 올리기 시작했다.' };
          }
        }
      }
      return { did: false, status: '고칠 곳도 지을 곳도 없다. 기금을 아껴 둔다.' };
    },
  },

  // ── 추천 배분: 순수입의 절반쯤 + 곳간에 쌓인 여윳돈의 일부 ──
  // 내일 묘시에 실제로 오갈 은자를 sim.js dailyTick·economyStep, JH.daily 와 같은 식으로 어림한다
  expectedIncome() {
    const pop = popCount();
    // 세금: 인구·세율·민심 × 혜택(주군·동맹·고을 성질·관아의 tax) × 이방
    const tax = pop * [0.8, 1.25, 1.8][S.tax] * (0.4 + S.happy / 100) * JH.perk('tax') * this.taxMul();
    // 강호의 날마다 몫: 계열·혈제단이 내리는 은자(인구당), 교역 협정 (다음 묘시에도 살아 있는 것만)
    let jh = JH.perk('dailySilver') * pop;
    if (S.jh) {
      const next = this.budgetDay() + 1;
      for (const id in S.jh.trade) if (S.jh.trade[id] > next && JH.isAlive(id)) jh += 2 + countType('market') * 2;
    }
    // 장사: 어제 시장·객잔·표국이 번 은자. 아직 하루를 넘기지 않았으면 장사 일터로 어림한다
    const A = S.admin || {};
    const trade = A.taxSeen ? A.trade || 0 : this.tradeEstimate(pop);
    const wages = this.wages(), tribute = this.tribute(), upkeep = wages + tribute;
    const gross = tax + trade + jh;
    return { tax: Math.round(tax), trade: Math.round(trade), jh: Math.round(jh), wages, tribute, upkeep, gross: Math.round(gross), net: Math.round(gross - upkeep) };
  },
  // 장사 일터가 하루에 벌 은자: economyStep 과 같은 값 (교역 혜택, 표국 혜택, 흑시 1.2배·도박장 1.5배·호시)
  tradeEstimate(pop = popCount()) {
    const tm = tradeMul(), shop = 0.36 + pop * 0.007;
    const m = (hasMod('quarantine') ? 0.6 : 1) * (S.occupation ? 0.85 : 1) * tm * ADM_WORK_H.shop;
    const rate = {
      market: () => shop, inn: () => 0.4 + S.fame * 0.0006, blackmarket: () => shop * 1.2, gambling: () => shop * 1.5, horsemarket: () => shop,
      escort: b => (b._connected ? 0.95 : 0.3) * JH.perk('escort'),
    };
    let t = 0;
    for (const b of S.buildings) {
      if (!rate[b.type] || !usable(b) || !b.active) continue;
      t += rate[b.type](b) * (b._workers || []).filter(v => !v.away).length * m;
    }
    return t;
  },
  // 부서마다 앞으로 며칠 동안 하루에 쓸 만한 은자 (어림)
  needs() {
    // 곧 빈집을 채울 식구까지 셈한다
    const pop = popCount() + clamp(this.freeHousing(), 0, 5);
    const ff = this.foodForecast();
    const n = { ri: 0, ho: 0, ye: 0, byeong: 0, hyeong: 0, gong: 0 };
    // 호방: 모자란 논밭, 넘치는 곳간, 시장
    n.ho = 1 + Math.min(4, ff.farmsNeeded) * (10 + this.fee('ho', 'farm')) / 3;
    if (this.needStore(0.75)) n.ho += 2;
    // 굶주릴 지경이면 하루 먹을 것의 절반은 사들일 수 있게
    if (this.foodEmergency()) n.ho += ff.cons * ADM_PRICE.food * 0.5;
    if (S.rank >= 1 && pop >= 20 && this.countAll('market') < 1 + Math.floor(pop / 60)) n.ho += (40 + this.fee('ho', 'market')) / 8;
    // 공방: 집 짓는 삯, 길, 벌목장·채석장, 폐허
    const free = this.freeHousing();
    n.gong = 2 + (free < 5 ? 3 : 1) + (S.rank >= 1 && free < 5 ? 3 : 0);
    // 벌목장은 살림의 밑돌이다: 없으면 이틀 안에 지을 만큼
    if (!this.countAll('lumber')) n.gong += (10 + this.fee('gong', 'lumber') + Math.max(0, 10 - S.res.wood) * ADM_PRICE.wood) / 2;
    else if (S.res.wood < 80) n.gong += 2;
    if (pop >= 10 && !this.countAll('quarry') && S.res.stone < 60) n.gong += 1.5;
    let ruinCost = 0;
    for (const b of S.buildings) if (b.ruined && !BDEF[b.type].line) ruinCost += (repairCost(b).silver || 0) + this.fee('gong', b.type);
    n.gong += Math.min(ruinCost / 6, 15);
    // 병방: 망루, 무관 모으기, 대장간, 습격
    if (pop >= 8) {
      n.byeong = 1.5;
      if (this.countAll('tower') < 1 + Math.floor(pop / 12)) n.byeong += 2;
      if (pop >= 10 && !this.countAll('dojo')) n.byeong += Math.max(0, 108 - this.dept('byeong').fund) / 6;
      if (S.rank >= 1 && !this.countAll('smithy')) n.byeong += 4;
      if (this.raidInfo()) n.byeong += 4;
      // 칼을 가는 이웃이 있으면 그 길목의 망루와 병장기 몫
      const top = this.threats()[0];
      if (top && top.threat >= 50) n.byeong += top.threat >= 70 ? 5 : 3;
    }
    // 예방: 보살핌 경비, 우물·사당·의원, 잔치
    if (pop >= 8) {
      n.ye = this.dailyNeed('ye') + 0.5;
      if (pop >= 10 && this.countAll('well') < 1 + Math.floor(pop / 18)) n.ye += 1;
      if (pop >= 16 && this.countAll('shrine') < 1 + Math.floor(pop / 45)) n.ye += 3.6;
      if (S.rank >= 1 && pop >= 22 && this.countAll('clinic') < 1 + Math.floor(pop / 60)) n.ye += 6.6;
      if (S.happy < 52) n.ye += (10 + pop * 0.6) / 4;
    }
    // 이방·형방: 날마다 드는 경비 (이방은 세금이 넉넉해질 무렵부터 남는 장사다)
    if (pop >= 18) n.ri = this.dailyNeed('ri');
    // 일손이 모자라면 이방이 사람을 돌려야 한다 (한 번에 1냥)
    if (pop >= 8 && (this.laborPool() <= 0 || S.res.wood < 30)) n.ri = Math.max(n.ri, 1.5);
    // 형방은 송사·도둑 상소를 맡을 기금도 조금씩 모은다
    if (pop >= 12) n.hyeong = this.dailyNeed('hyeong') + 1.5;
    // 탐욕스러운 아전은 떼먹는 만큼 더 줘야 한다
    for (const id of ADM_IDS) n[id] /= 1 - this.trait(id).skim;
    return n;
  },
  recommend(fromUI) {
    if (!S || !S.admin) return null;
    const pop = popCount();
    const inc = this.expectedIncome();
    // 순수입의 절반 + 곳간에 쌓인 여윳돈의 6분의 1
    const reserve = 40 + pop * 2;
    const need = this.needs();
    // 굶주릴 지경이면 여윳돈을 따지지 않고 호방이 곡식 살 몫부터 뗀다 (품삯을 남긴 곳간의 4분의 1까지)
    const famine = this.foodEmergency() ? Math.min(need.ho, Math.max(0, S.res.silver - this.upkeepEstimate()) / 4) : 0;
    const pool = Math.max(0, Math.round(Math.max(famine, Math.max(0, inc.net) * 0.5 + Math.max(0, S.res.silver - reserve) / 6)));
    const ff = this.foodForecast();
    const noDojo = !this.countAll('dojo') && pop >= 8;
    const woodLow = !this.countAll('lumber') || S.res.wood < 30;
    const top = this.threats()[0];
    const w = { ho: this.foodShort(ff) ? 1.7 : 1, gong: woodLow ? 1.8 : 1.1, byeong: this.raidInfo() ? 1.5 : top && top.threat >= 70 ? 1.4 : noDojo ? 1.3 : 1, ye: 0.8, ri: 0.6, hyeong: 0.7 };
    const acc = { ri: 0, ho: famine, ye: 0, byeong: 0, hyeong: 0, gong: 0 };
    // 모자라면 무게대로 나누고, 다 찬 곳에서 남은 몫은 다시 나눈다
    let left = pool - famine;
    for (let pass = 0; pass < 4 && left > 0.05; pass++) {
      const open = ADM_IDS.filter(id => need[id] - acc[id] > 0.01);
      const tw = open.reduce((a, id) => a + (need[id] - acc[id]) * w[id], 0);
      if (tw <= 0) break;
      let used = 0;
      for (const id of open) {
        const give = Math.min(need[id] - acc[id], left * (need[id] - acc[id]) * w[id] / tw);
        acc[id] += give; used += give;
      }
      left -= used;
    }
    const out = {};
    let sum = 0;
    for (const id of ADM_IDS) { out[id] = Math.floor(acc[id]); sum += out[id]; }
    let rem = pool - sum;
    for (const id of ADM_IDS.slice().sort((a, b) => (acc[b] - out[b]) - (acc[a] - out[a]))) {
      if (rem <= 0) break;
      if (acc[id] - out[id] >= 0.25) { out[id]++; rem--; }
    }
    for (const id of ADM_IDS) this.setBudget(id, out[id]);
    const total = ADM_IDS.reduce((a, id) => a + out[id], 0);
    logMsg(`육방 예산을 새로 나누었다. 하루 ${total}냥 (${ADM_IDS.map(id => `${ADM_DEPTS[id].name} ${out[id]}`).join(' · ')}).`, '');
    if (fromUI) UI.toast(`추천대로 나누었다. 하루 ${total}냥.`, 'good');
    this._dirty = true;
    return out;
  },
  replaceHead(id) {
    const d = this.dept(id);
    const cost = this.replaceCost();
    if (!d || S.res.silver < cost) return false;
    S.res.silver -= cost;
    const old = d.head;
    d.head = this.newHead();
    d.next = Math.min(d.next, S.time + 1);
    const D = ADM_DEPTS[id];
    this.note(id, `${old.name}${pp(old.name, '을/를')} 내보내고 ${d.head.name}${pp(d.head.name, '을/를')} 앉혔다`);
    logMsg(`${D.name} 아전 ${old.name}${pp(old.name, '을/를')} 갈아 치우고 ${d.head.name}${pp(d.head.name, '을/를')} 앉혔다. (${ADM_TRAITS[d.head.trait].name})`, '');
    this._dirty = true;
    return true;
  },
  replaceCost() { return 12 + S.rank * 6; },
  reclaim(id) {
    const d = this.dept(id);
    if (!d || d.fund < 1) return 0;
    const n = Math.floor(d.fund);
    d.fund -= n;
    S.res.silver += n;
    this.note(id, `기금 ${n}냥을 곳간으로 거둬들였다`);
    this._dirty = true;
    return n;
  },

  // ── 육방 창 ──
  sealTip(D) { return `${D.hanja}(${D.name}) — ${D.role}. ${D.duty}`; },
  fundHTML(id) {
    const d = this.dept(id);
    // 예산이 끊기면 더 들어올 돈이 없으니 상한도 없다
    if (!d.budget) return `<b>${fmt(d.fund)}</b><small>냥 · 예산 없음</small>`;
    return `<b>${fmt(d.fund)}</b><small> / ${fmt(this.cap(id))}냥</small>`;
  },
  barHTML(id) {
    const d = this.dept(id);
    const cap = Math.max(1, d.budget ? this.cap(id) : ADM_MINCAP[id]);
    return `<i style="width:${Math.round(clamp(d.fund / cap, 0, 1) * 100)}%"></i>`;
  },
  effHTML(id) {
    const d = this.dept(id), t = this.trait(id);
    if (id === 'ri') return `세금 +${Math.round((this.taxMul() - 1) * 100)}%`;
    if (id === 'hyeong') return `치안 ${Math.round(d.lv * 100)}% · 민심 +${Math.round(5 * d.lv * t.eff)}`;
    if (id === 'ye') return `보살핌 민심 +${Math.round(3 * d.lv * t.eff)}`;
    const n = this.liveSites(d).length;
    return n ? `공사 ${n}곳` : '';
  },
  statusHTML(id) {
    const d = this.dept(id);
    let st = d.status;
    let cls = 'idle';
    if (!d.auto) { st = '영주의 명으로 손을 놓고 있다.'; cls = 'off'; }
    else if (!d.budget && d.fund < 1) { st = '예산이 없어 아전이 붓을 놓고 있다.'; cls = 'off'; }
    else if (!st) st = '오늘 일을 살피는 중이다.';
    else if (/중|시작|돌렸다|채웠다|닦았다|열어|사들였다/.test(st)) cls = 'work';
    if (/모자라|미룬다|모으는|끊겨|보낼 사람이 없다|터가 없다|못했다/.test(st) && d.auto && (d.budget || d.fund >= 1)) cls = 'wait';
    // 병방: 이웃의 기색과 마을에 남은 무사를 늘 새로 적는다. 이웃이 칼을 갈거나 습격이 다가오면 붉게
    const w = id === 'byeong' ? this.watchText() : null;
    if (id === 'byeong' && cls !== 'off' && (this.raidInfo() || (w && w.hot))) cls = 'alert';
    return `<span class="adm-dot ${cls}"></span>${escapeHtml(st)}${w ? `<span class="adm-watch${w.hot ? ' hot' : ''}">${escapeHtml(w.text)}</span>` : ''}`;
  },
  logHTML(id) {
    const d = this.dept(id);
    const items = d.log.slice(-3).reverse().map(l => {
      const day = Math.floor(l.t / 24);
      return `<li><time>${SEASONS[Math.floor(day / DAYS_PER_SEASON) % 4]} ${day % DAYS_PER_SEASON + 1}일</time>${escapeHtml(l.text)}</li>`;
    });
    return items.join('') || '<li class="none">아직 한 일이 없다.</li>';
  },
  ledgerHTML() {
    const inc = this.expectedIncome();
    const tot = this.totalBudget();
    const pct = inc.net > 0 ? Math.round(tot / inc.net * 100) : 0;
    const cell = (label, val, sub, tip, cls = '') => `<div class="adm-cell ${cls}" data-tip-title="${label}" data-tip="${escapeHtml(tip)}"><small>${label}</small><b>${val}</b><span>${sub}</span></div>`;
    return cell('하루 수입', `${fmt(inc.gross)}냥`, `세금 ${fmt(inc.tax)} · 장사 ${fmt(inc.trade)}${inc.jh ? ` · 강호 ${fmt(inc.jh)}` : ''}`,
      '내일 아침 거둘 세금(인구·세율·민심, 주군·동맹·고을의 혜택으로 어림)과 어제 장사로 번 은자. 주군·동맹이 내리는 은자와 교역 협정의 몫은 강호로 따로 적는다.')
      + cell('품삯·공물', inc.upkeep >= 0.5 ? `−${fmt(Math.round(inc.upkeep))}냥` : '0냥', inc.tribute ? `품삯 ${fmt(inc.wages)} · 공물 ${fmt(inc.tribute)}` : '무사·객경·주군',
        '무관·망루의 무사와 객경 품삯(의뢰로 떠난 이도 받는다), 주군에게 바치는 공물. 곳간은 이만큼을 늘 남겨 둔다.')
      + cell('육방 예산', `${fmt(tot)}냥`, inc.net > 0 ? `순수입의 ${pct}%` : '순수입이 없다', '부서마다 하루에 내려보내는 은자의 합.', tot > inc.net ? 'over' : '')
      + cell('곳간', `${fmt(S.res.silver)}냥`, `여섯 기금 ${fmt(ADM_IDS.reduce((a, id) => a + this.dept(id).fund, 0))}냥`, '지금 곳간에 있는 은자와, 부서마다 쌓아 둔 기금의 합.');
  },
  warnHTML() {
    const inc = this.expectedIncome();
    const tot = this.totalBudget();
    const A = S.admin;
    const out = [];
    if (S.occupation) out.push('점령군이 마을을 틀어쥐었다. 아전들은 눈치를 보며 더디게 일한다. 병방이 무사를 길러야 봉기할 수 있다.');
    // 칼을 가는 이웃 (첩자가 없으면 낱말로만). 의뢰로 떠난 무사는 습격 때 마을에 없다
    const top = this.threats()[0];
    if (top && top.threat >= 70 && !this.raidInfo() && !S.occupation) {
      const away = this.awayFighters();
      out.push(`${this.threatText(top)}. 마을에 남은 무사는 ${this.defenders()}명${away ? `, 의뢰로 떠난 이가 ${away}명` : ''}이다. 병방 예산을 넉넉히 두라.`);
    }
    if (A.short && A.short.day === dayOf()) out.push(`오늘 아침 곳간이 모자라 ${A.short.n}냥을 다 내려보내지 못했다 (${A.short.ids.map(id => ADM_DEPTS[id].name).join('·')}).`);
    if (tot > 0 && tot > inc.net) out.push(`예산이 하루 순수입(${fmt(Math.max(0, inc.net))}냥)을 넘는다. 곳간이 날마다 줄어든다.`);
    if (!tot) out.push('아직 예산을 내리지 않았다. 예산이 없으면 부서는 아무것도 하지 않는다. [추천 배분]으로 시작해 보라.');
    return out.map(t => `<p>${escapeHtml(t)}</p>`).join('');
  },
  cardHTML(D) {
    const id = D.id, d = this.dept(id), t = this.trait(id);
    const conf = this._confirm && this._confirm.id === id && this._confirm.until > Date.now();
    const rc = this.replaceCost();
    return `<article class="adm-card${d.auto ? '' : ' paused'}" data-dept="${id}">
      <header class="adm-card-head">
        <span class="adm-seal" data-tip-title="${D.seal} · ${D.hun}" data-tip="${escapeHtml(this.sealTip(D))}">${D.seal}</span>
        <div class="adm-name"><h3>${D.name} <small data-tip-title="${D.hanja}">${D.hanja}</small></h3><span>${D.role}</span></div>
        <button type="button" class="adm-auto${d.auto ? ' on' : ''}" data-act="auto" data-d="${id}" aria-pressed="${d.auto}" data-tip-title="자동 집행" data-tip="켜 두면 부서가 기금으로 스스로 일을 찾아 한다. 끄면 예산은 쌓이기만 한다."><i></i>자동</button>
      </header>
      <div class="adm-headman">
        <span class="adm-who"><small data-tip-title="衙前">아전</small> ${escapeHtml(d.head.name)}</span>
        <span class="adm-trait t-${d.head.trait}" data-tip-title="${t.name}" data-tip="${escapeHtml(t.tip)}">${t.name}</span>
        <button type="button" class="adm-mini${conf ? ' danger' : ''}" data-act="replace" data-d="${id}" data-tip="아전을 갈아 치운다 (곳간에서 은자 ${rc}냥). 새 사람의 성품은 앉혀 봐야 안다.">${conf ? `정말 교체 (${rc}냥)` : '교체'}</button>
      </div>
      <div class="adm-budget">
        <span class="adm-lbl">하루 예산</span>
        <div class="adm-step" role="group" aria-label="${D.name} 하루 예산">
          <button type="button" data-act="bud" data-d="${id}" data-n="-5" ${d.budget <= 0 ? 'disabled' : ''} aria-label="5냥 줄이기">−5</button>
          <button type="button" data-act="bud" data-d="${id}" data-n="-1" ${d.budget <= 0 ? 'disabled' : ''} aria-label="1냥 줄이기">−1</button>
          <label class="adm-in"><input type="number" inputmode="numeric" min="0" max="999" step="1" value="${d.budget}" data-adm-budget="${id}" aria-label="${D.name} 하루 예산 (냥)"><small>냥</small></label>
          <button type="button" data-act="bud" data-d="${id}" data-n="1" aria-label="1냥 늘리기">+1</button>
          <button type="button" data-act="bud" data-d="${id}" data-n="5" aria-label="5냥 늘리기">+5</button>
        </div>
      </div>
      <div class="adm-fundrow">
        <span class="adm-lbl" data-tip-title="기금" data-tip="날마다 받은 예산이 쌓이는 곳. 부서는 여기서 은자와 품삯을 낸다. 목재·석재는 마을 곳간에서 쓴다. 상한을 넘으면 더 받지 않는다.">기금</span>
        <span class="adm-fund" data-adm="${id}.fund">${this.fundHTML(id)}</span>
        <span class="adm-eff" data-adm="${id}.eff">${this.effHTML(id)}</span>
        <button type="button" class="adm-mini" data-act="reclaim" data-d="${id}" data-tip="쌓인 기금을 모두 곳간으로 거둬들인다.">환수</button>
      </div>
      <div class="adm-bar" data-adm="${id}.bar">${this.barHTML(id)}</div>
      <p class="adm-status" data-adm="${id}.status">${this.statusHTML(id)}</p>
      <ol class="adm-log" data-adm="${id}.log">${this.logHTML(id)}</ol>
    </article>`;
  },
  buildHTML() {
    return `<div class="adm">
      <h2>육방 관아 <small class="adm-h" data-tip-title="六房">六房</small></h2>
      <p class="lead">부서마다 하루 예산을 내려 주면, 아전들이 기금을 모아 알아서 짓고 거두고 다스린다. 영주는 돈줄과 사람을 쥐면 된다.</p>
      <div class="adm-ledger" data-adm="ledger">${this.ledgerHTML()}</div>
      <div class="adm-actions">
        <button type="button" class="btn adm-rec" data-act="recommend" data-tip="지금 수입과 형편에 맞춰 순수입의 절반쯤을 부서마다 나눈다. 곳간에 여윳돈이 쌓여 있으면 조금 더 쓴다.">추천 배분</button>
        <div class="adm-warn" data-adm="warn">${this.warnHTML()}</div>
      </div>
      <div class="adm-grid">${ADM_DEPTS.map(D => this.cardHTML(D)).join('')}</div>
    </div>`;
  },
  dynMap() {
    const out = { ledger: this.ledgerHTML(), warn: this.warnHTML() };
    for (const id of ADM_IDS) {
      out[`${id}.fund`] = this.fundHTML(id);
      out[`${id}.eff`] = this.effHTML(id);
      out[`${id}.bar`] = this.barHTML(id);
      out[`${id}.status`] = this.statusHTML(id);
      out[`${id}.log`] = this.logHTML(id);
    }
    return out;
  },
  sheetHTML() {
    if (!S || !S.admin) return '';
    const body = document.getElementById('sheet-body');
    const fresh = !body || !body.dataset.h;
    if (this._dirty || fresh || !this._html) { this._html = this.buildHTML(); this._dirty = false; this.keepFocus(body); }
    return this._html;
  },
  // 창을 새로 그리면 초점이 사라지므로, 쥐고 있던 단추·칸으로 되돌린다 (키보드로 이어서 누를 수 있게)
  keepFocus(body) {
    const a = document.activeElement;
    if (!body || !a || a === body || !body.contains(a) || !a.dataset) return;
    const ds = a.dataset;
    const sel = ds.admBudget ? `input[data-adm-budget="${ds.admBudget}"]`
      : ds.act ? `[data-act="${ds.act}"]${ds.d ? `[data-d="${ds.d}"]` : ''}${ds.n ? `[data-n="${ds.n}"]` : ''}` : '';
    if (!sel) return;
    // UI.renderSheet 가 내용을 갈아 끼운 다음에 돌린다
    queueMicrotask(() => {
      if (UI.sheet !== 'admin' || (document.activeElement && document.activeElement !== document.body)) return;
      // −1 이 막히면(예산 0) 같은 부서의 다른 단추로
      const el = body.querySelector(`${sel}:not([disabled])`) || (ds.d && body.querySelector(`[data-act="${ds.act}"][data-d="${ds.d}"]:not([disabled])`));
      if (el) el.focus({ preventScroll: true });
    });
  },
  onSheetClick(e) {
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const id = t.dataset.d;
    const a = t.dataset.act;
    if (a === 'bud') this.setBudget(id, this.budget(id) + (+t.dataset.n || 0));
    else if (a === 'auto') this.setAuto(id, !this.dept(id).auto);
    else if (a === 'recommend') this.recommend(true);
    else if (a === 'reclaim') {
      const n = this.reclaim(id);
      UI.toast(n ? `${ADM_DEPTS[id].name} 기금 ${n}냥을 곳간으로 거둬들였다.` : '거둬들일 기금이 없다.', n ? '' : 'bad');
    } else if (a === 'replace') {
      if (S.res.silver < this.replaceCost()) { this._confirm = null; UI.toast(`아전을 갈려면 은자 ${this.replaceCost()}냥이 든다.`, 'bad'); }
      else if (this._confirm && this._confirm.id === id && this._confirm.until > Date.now()) {
        this._confirm = null;
        if (this.replaceHead(id)) UI.toast(`${ADM_DEPTS[id].name} 아전을 새로 앉혔다. 성품은 ${ADM_TRAITS[this.dept(id).head.trait].name}.`, 'good');
      } else this._confirm = { id, until: Date.now() + 3000 };
    }
    this._dirty = true;
  },
  // 열린 창의 숫자만 제자리에서 고친다 (입력 칸 초점을 지키려고)
  uiTick() {
    if (!S || !S.admin) return;
    const btn = document.getElementById('btn-admin');
    if (btn) btn.classList.toggle('adm-alert', !!(S.admin.short && S.admin.short.day === dayOf()));
    if (UI.sheet !== 'admin') return;
    const body = document.getElementById('sheet-body');
    if (!body) return;
    if (this._confirm && this._confirm.until <= Date.now()) { this._confirm = null; this._dirty = true; }
    const typing = document.activeElement && document.activeElement.matches && document.activeElement.matches('input[data-adm-budget]');
    if (this._dirty && !typing) { UI.renderSheet(); return; }
    const dyn = this.dynMap();
    for (const k in dyn) {
      const el = body.querySelector(`[data-adm="${k}"]`);
      if (el && el.dataset.v !== dyn[k]) { el.innerHTML = dyn[k]; el.dataset.v = dyn[k]; }
    }
  },
};

// 창 등록 (ui.js 가 나중에 읽히므로 그때 붙인다)
function admRegisterSheet() {
  if (typeof UI === 'undefined' || !UI.registerSheet) return false;
  UI.registerSheet('admin', { html: () => Admin.sheetHTML(), onClick: e => Admin.onSheetClick(e), live: false });
  return true;
}
document.addEventListener('DOMContentLoaded', admRegisterSheet);
// 입력 칸에 직접 쓴 예산. 여기서 창을 다시 그리면 옮겨 가던 초점(Tab, 다른 칸 누르기)을 잃으므로
// 다시 그리기는 uiTick 이 입력 칸에서 초점이 빠진 뒤에 한다
document.addEventListener('change', e => {
  const t = e.target;
  if (!t || !t.matches || !t.matches('input[data-adm-budget]') || !S) return;
  Admin.setBudget(t.dataset.admBudget, t.value);
  t.value = Admin.budget(t.dataset.admBudget);
  Admin._dirty = true;
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && t.matches && t.matches('input[data-adm-budget]') && e.key === 'Enter') { e.preventDefault(); t.blur(); }
});
Bus.on('raidWarning', () => {
  const d = Admin.dept('byeong'); if (d) d.next = 0;
  // 이방이 내려 두었던 망루 일손은 경보가 오면 바로 되돌린다
  Admin.restoreLowered(b => b.type === 'tower');
});
// 경보 없이 쳐들어와도(봉기 등) 닫아 둔 망루·무관을 연다
Bus.on('raidStart', () => { if (S.admin) Admin.restoreLowered(b => b.type === 'tower' || b.type === 'dojo'); });
Bus.on('built', b => {
  if (!S || !S.admin) return;
  for (const id of ADM_IDS) {
    const d = Admin.dept(id);
    if (d && d.sites.indexOf(b.id) >= 0) {
      d.sites = d.sites.filter(x => x !== b.id);
      Admin.note(id, `${BDEF[b.type].name} 공사를 마쳤다`);
    }
  }
});
