'use strict';
// ───────────────────────────────────────────────
// 공용 상수와 도구 함수
// ───────────────────────────────────────────────
const TILE = 32;            // 타일 한 칸의 월드 픽셀 크기
const MW = 64, MH = 48;     // 지도 크기(타일)
const SEC_PER_HOUR = 5;     // 1배속에서 게임 속 1시간 = 실제 5초
const SAVE_KEY = 'gangho_village_save_v1';

function rnd(a, b) { return a + Math.random() * (b - a); }
function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function fmt(n) { return Math.floor(n).toLocaleString('ko-KR'); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function weighted(items, wf) {
  let total = 0;
  for (const it of items) total += Math.max(0, wf(it));
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, wf(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

// 시드 고정 난수 (지도 생성용)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 값 노이즈 + fbm
function makeNoise(seed) {
  const r = mulberry32(seed);
  const N = 256;
  const vals = new Float32Array(N * N);
  for (let i = 0; i < vals.length; i++) vals[i] = r();
  const at = (x, y) => vals[((y & (N - 1)) * N) + (x & (N - 1))];
  const sm = t => t * t * (3 - 2 * t);
  return function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, xf), lerp(c, d, xf), yf);
  };
}
function fbm(noise, x, y, oct = 3) {
  let v = 0, amp = 1, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += noise(x * f, y * f) * amp;
    tot += amp; amp *= 0.5; f *= 2;
  }
  return v / tot;
}

// 안전한 저장소 접근 (사생활 보호 모드 등에서 예외가 날 수 있음)
const Store = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(key, val); return true; } catch (e) { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* 무시 */ } },
};

// 한국어 조사 처리: 받침 유무에 따라 이/가, 을/를, 은/는, 과/와, 으로/로
function hasBatchim(word) {
  if (!word) return false;
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xAC00 || ch > 0xD7A3) return false;
  return (ch - 0xAC00) % 28 !== 0;
}
function josa(word, pair) {
  const [a, b] = pair.split('/');
  if (pair === '으로/로') {
    const ch = word.charCodeAt(word.length - 1);
    const jong = (ch - 0xAC00) % 28;
    return word + ((hasBatchim(word) && jong !== 8) ? '으로' : '로');
  }
  return word + (hasBatchim(word) ? a : b);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 조사만 돌려준다: `${name}${pp(name, '이/가')}` (괄호 속 한자는 무시)
function pp(word, pair) {
  const w = String(word).replace(/\([^)]*\)/g, '').replace(/<[^>]*>/g, '');
  return josa(w, pair).slice(w.length);
}

// ── 이벤트 버스: 모듈끼리 서로를 몰라도 소식을 주고받는다 ──
// 이름과 인자는 docs/architecture.md 의 "Bus 이벤트" 표를 따른다.
const Bus = {
  map: new Map(),
  on(name, fn) { if (!this.map.has(name)) this.map.set(name, []); this.map.get(name).push(fn); return () => this.off(name, fn); },
  off(name, fn) { const a = this.map.get(name); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
  emit(name, ...args) {
    const a = this.map.get(name);
    if (!a) return;
    for (const fn of a.slice()) { try { fn(...args); } catch (e) { console.error('Bus', name, e); } }
  },
};
// 선택적 모듈 훅을 안전하게 부른다: hook(Story, 'daily') — 모듈이나 함수가 없으면 아무 일도 없다
function hook(mod, name, ...args) {
  if (!mod || typeof mod[name] !== 'function') return undefined;
  try { return mod[name](...args); } catch (e) { console.error('hook', name, e); return undefined; }
}
