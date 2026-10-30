'use strict';
// ───────────────────────────────────────────────
// 지형, 점유, 길찾기
// ───────────────────────────────────────────────
const T = { GRASS: 0, WATER: 1, FOREST: 2, ROCK: 3, SAND: 4, DIRT: 5 };

const World = {
  tiles: new Uint8Array(MW * MH),
  road: new Uint8Array(MW * MH),
  occ: new Int32Array(MW * MH),   // 건물 id (0 = 비어있음)
  tvar: new Uint8Array(MW * MH),  // 나무·풀 모양 변화용
  exits: [],
  center: { x: 31, y: 22 },
  terrainDirty: true,

  idx(x, y) { return y * MW + x; },
  inb(x, y) { return x >= 0 && y >= 0 && x < MW && y < MH; },
  tile(x, y) { return this.inb(x, y) ? this.tiles[y * MW + x] : T.ROCK; },
  isRoad(x, y) { return this.inb(x, y) && this.road[y * MW + x] === 1; },
  bAt(x, y) {
    if (!this.inb(x, y)) return null;
    const id = this.occ[y * MW + x];
    return id ? S.bmap.get(id) || null : null;
  },
  rebuildOcc() {
    this.occ.fill(0);
    for (const b of S.buildings) this.stamp(b, b.id);
  },
  stamp(b, id) {
    for (let y = b.y; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++) this.occ[y * MW + x] = id;
  },
};

function genWorld(seed) {
  const r = mulberry32(seed);
  const nRock = makeNoise(seed + 11), nWood = makeNoise(seed + 23), nDirt = makeNoise(seed + 37);
  const { tiles, road, tvar } = World;
  tiles.fill(T.GRASS); road.fill(0); World.occ.fill(0);
  for (let i = 0; i < tvar.length; i++) tvar[i] = Math.floor(r() * 256);

  const cx = World.center.x, cy = World.center.y;
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) {
      const edge = Math.min(x, y, MW - 1 - x, MH - 1 - y);
      const dc = Math.hypot((x - cx) / 1.3, y - cy);
      let m = fbm(nRock, x / 8, y / 8, 3) + (edge < 7 ? (7 - edge) * 0.045 : 0);
      if (x < 22 && y < 16) m += 0.12;            // 북서쪽 바위산
      const w = fbm(nWood, x / 6, y / 6, 3);
      const d = fbm(nDirt, x / 5, y / 5, 2);
      const i = y * MW + x;
      if (m > 0.66 && dc > 11) tiles[i] = T.ROCK;
      else if (w > 0.55 && dc > 9) tiles[i] = T.FOREST;
      else if (d > 0.68) tiles[i] = T.DIRT;
    }
  }

  // 강: 위에서 아래로 굽이쳐 흐른다
  let rx = MW * 0.74 + (r() - 0.5) * 4;
  for (let y = 0; y < MH; y++) {
    rx += (r() - 0.5) * 1.4 + Math.sin(y * 0.22 + seed) * 0.45;
    rx = clamp(rx, 42, 56);
    const width = 2 + (r() < 0.35 ? 1 : 0);
    const x0 = Math.floor(rx);
    for (let x = x0 - 1; x <= x0 + width; x++) {
      if (!World.inb(x, y)) continue;
      tiles[y * MW + x] = (x === x0 - 1 || x === x0 + width) ? (r() < 0.6 ? T.SAND : T.GRASS) : T.WATER;
    }
  }
  // 강가의 모래톱 정리 (물과 붙은 곳)
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = y * MW + x;
    if (tiles[i] === T.FOREST || tiles[i] === T.ROCK) {
      if (tiles[i - 1] === T.WATER || tiles[i + 1] === T.WATER) tiles[i] = T.SAND;
    }
  }

  // 마을 터 정리
  for (let y = cy - 8; y <= cy + 9; y++) for (let x = cx - 12; x <= cx + 12; x++) {
    if (!World.inb(x, y)) continue;
    const i = y * MW + x;
    const dc = Math.hypot((x - cx) / 1.4, y - cy);
    if (dc < 8.5 + r() * 1.5 && (tiles[i] === T.ROCK || tiles[i] === T.FOREST)) tiles[i] = T.GRASS;
  }

  // 관도(官道): 동서로 가로지르는 큰길 + 북쪽·남쪽 샛길
  const roadY = cy + 3;
  const carve = (x, y) => {
    if (!World.inb(x, y)) return;
    const i = y * MW + x;
    if (tiles[i] === T.ROCK || tiles[i] === T.FOREST) tiles[i] = T.DIRT;
    road[i] = 1;
  };
  let yy = roadY;
  for (let x = 0; x < MW; x++) {
    carve(x, yy);
    if (Math.abs(x - cx) <= 13) {
      // 마을 앞에서는 반드시 영주관 문 앞 줄로 돌아온다
      while (yy !== roadY) { yy += Math.sign(roadY - yy); carve(x, yy); }
    } else if (r() < 0.12) {
      const ny = clamp(yy + (r() < 0.5 ? -1 : 1), roadY - 3, roadY + 3);
      if (ny !== yy) { carve(x, ny); yy = ny; }
    }
  }
  const northX0 = cx - 7;
  let xx = northX0;
  for (let y = roadY; y >= 0; y--) {
    carve(xx, y);
    if (y < cy - 6 && r() < 0.18) {
      const nx = clamp(xx + (r() < 0.5 ? -1 : 1), 8, 36);
      carve(nx, y); xx = nx;
    }
  }
  const northExit = { x: xx, y: 0 };
  const southX0 = cx + 6;
  xx = southX0;
  for (let y = roadY; y < MH; y++) {
    carve(xx, y);
    if (y > cy + 8 && r() < 0.18) {
      const nx = clamp(xx + (r() < 0.5 ? -1 : 1), 26, 40);
      carve(nx, y); xx = nx;
    }
  }
  const southExit = { x: xx, y: MH - 1 };
  // 서쪽 끝 / 동쪽 끝 출입구의 실제 y
  let westY = roadY, eastY = roadY;
  for (let y = 0; y < MH; y++) { if (road[y * MW]) westY = y; if (road[y * MW + MW - 1]) eastY = y; }
  World.exits = [
    { x: 0, y: westY, name: '서쪽 관도' },
    { x: MW - 1, y: eastY, name: '동쪽 관도' },
    { x: northExit.x, y: 0, name: '북쪽 산길' },
    { x: southExit.x, y: MH - 1, name: '남쪽 길' },
  ];
  World.terrainDirty = true;
}

// 걷기 비용. mode: 0 = 마을 사람·아군, 1 = 적
function walkCost(x, y, mode) {
  if (x < 0 || y < 0 || x >= MW || y >= MH) return Infinity;
  const i = y * MW + x;
  const t = World.tiles[i];
  const isRoad = World.road[i] === 1;
  if (t === T.ROCK) return Infinity;
  if (t === T.WATER && !isRoad) return Infinity;
  const id = World.occ[i];
  if (id) {
    const b = S.bmap.get(id);
    if (b) {
      const def = BDEF[b.type];
      if (b.type === 'gate') return mode === 1 ? 24 : 0.8;
      if (b.type === 'wall' || b.type === 'stonewall') return mode === 1 ? 24 : Infinity;
      if (def.walkRows && b.done && !b.ruined && y >= b.y + b.h - def.walkRows) return 1.1;
      return Infinity;
    }
  }
  if (isRoad) return 0.55;
  if (t === T.FOREST) return 1.9;
  if (t === T.SAND) return 1.15;
  return 1;
}
function walkable(x, y, mode = 0) { return walkCost(x, y, mode) < Infinity; }

// ── A* 길찾기 ─────────────────────────────
const PF = {
  g: new Float32Array(MW * MH),
  f: new Float32Array(MW * MH),
  parent: new Int32Array(MW * MH),
  seen: new Int32Array(MW * MH),
  closed: new Int32Array(MW * MH),
  stampN: 1,
  heap: new Int32Array(MW * MH * 8),
  heapN: 0,
  budget: 40,
};
function heapPush(n) {
  const h = PF.heap, f = PF.f;
  let i = PF.heapN++;
  h[i] = n;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (f[h[p]] <= f[h[i]]) break;
    const t = h[p]; h[p] = h[i]; h[i] = t; i = p;
  }
}
function heapPop() {
  const h = PF.heap, f = PF.f;
  const top = h[0];
  const last = h[--PF.heapN];
  if (PF.heapN > 0) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < PF.heapN && f[h[l]] < f[h[m]]) m = l;
      if (r < PF.heapN && f[h[r]] < f[h[m]]) m = r;
      if (m === i) break;
      const t = h[m]; h[m] = h[i]; h[i] = t; i = m;
    }
  }
  return top;
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

// 반환: 경로 배열 [{x,y}...] / null(길 없음) / undefined(이번 프레임 예산 소진)
function findPath(sx, sy, tx, ty, mode = 0, goalFn = null) {
  if (PF.budget <= 0) return undefined;
  PF.budget--;
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (!World.inb(sx, sy)) return null;
  const isGoal = goalFn || ((x, y) => x === tx && y === ty);
  if (isGoal(sx, sy)) return [];
  if (!goalFn && !walkable(tx, ty, mode)) return null;
  const stamp = ++PF.stampN;
  const { g, f, parent, seen, closed } = PF;
  PF.heapN = 0;
  const s = sy * MW + sx;
  g[s] = 0; f[s] = Math.hypot(tx - sx, ty - sy) * 0.55; parent[s] = -1; seen[s] = stamp;
  heapPush(s);
  let iter = 0;
  while (PF.heapN > 0 && iter++ < 5000) {
    const cur = heapPop();
    if (closed[cur] === stamp) continue;
    closed[cur] = stamp;
    const cx = cur % MW, cy = (cur / MW) | 0;
    if (isGoal(cx, cy)) {
      const path = [];
      let n = cur;
      while (n !== s && n !== -1) { path.push({ x: n % MW, y: (n / MW) | 0 }); n = parent[n]; }
      path.reverse();
      return path;
    }
    for (const [dx, dy, dc] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const ni = ny * MW + nx;
      if (closed[ni] === stamp) continue;
      const c = walkCost(nx, ny, mode);
      if (c === Infinity) continue;
      if (dx && dy) {
        if (walkCost(cx + dx, cy, mode) > 3 || walkCost(cx, cy + dy, mode) > 3) continue;
      }
      const ng = g[cur] + c * dc;
      if (seen[ni] !== stamp || ng < g[ni]) {
        seen[ni] = stamp;
        g[ni] = ng;
        f[ni] = ng + Math.hypot(tx - nx, ty - ny) * 0.55;
        parent[ni] = cur;
        heapPush(ni);
      }
    }
  }
  return null;
}

// 건물 주변(문 앞)의 걸을 수 있는 칸들
function buildingApproachGoal(b, mode = 0) {
  return (x, y) => {
    if (x < b.x - 1 || x > b.x + b.w || y < b.y - 1 || y > b.y + b.h) return false;
    const inside = x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h;
    if (inside) return walkable(x, y, mode) && World.occ[y * MW + x] === b.id;
    return walkable(x, y, mode);
  };
}
function doorOf(b) {
  const def = BDEF[b.type];
  if (def.walkRows) return { x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 };
  const x = b.x + Math.floor(b.w / 2), y = b.y + b.h;
  if (walkable(x, y)) return { x, y };
  const ring = [];
  for (let xx = b.x - 1; xx <= b.x + b.w; xx++) { ring.push({ x: xx, y: b.y + b.h }); ring.push({ x: xx, y: b.y - 1 }); }
  for (let yy = b.y; yy < b.y + b.h; yy++) { ring.push({ x: b.x - 1, y: yy }); ring.push({ x: b.x + b.w, y: yy }); }
  for (const p of ring) if (walkable(p.x, p.y)) return p;
  return { x, y };
}
function nearestWalkable(x, y, mode = 0, maxR = 8) {
  x = Math.floor(x); y = Math.floor(y);
  if (walkable(x, y, mode)) return { x, y };
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (walkable(x + dx, y + dy, mode)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}
function countTilesNear(b, type, r) {
  let n = 0;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!World.inb(x, y)) continue;
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
    if (World.tiles[y * MW + x] === type && !World.road[y * MW + x]) n++;
  }
  return n;
}
function randomTileNear(cx, cy, r, filter) {
  for (let k = 0; k < 30; k++) {
    const x = Math.floor(cx + rnd(-r, r)), y = Math.floor(cy + rnd(-r, r));
    if (walkable(x, y) && (!filter || filter(x, y))) return { x, y };
  }
  return null;
}
