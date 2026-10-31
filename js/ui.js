'use strict';
// ───────────────────────────────────────────────
// 화면 위의 모든 것: 상단 띠, 건설 메뉴, 선택 정보, 세력·현황 창, 사건 두루마리
// ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ACT_TEXT = {
  sleep: '집에서 자는 중', shelter: '몸을 피하는 중', build: '공사를 돕는 중', idle: '한가로이 거니는 중',
  leisure: '저녁 마실 중', patrol: '횃불을 들고 야경을 도는 중', fight: '적과 싸우는 중', leave: '마을을 떠나는 중',
  arrive: '마을로 오는 중', hero: '소일하며 마을을 지켜보는 중', away: '의뢰로 길을 떠남',
};
const WORK_TEXT = {
  farm: '논밭을 가는 중', fishery: '고기를 잡는 중', lumber: '나무를 베는 중', quarry: '돌을 캐는 중', smithy: '쇠를 두드리는 중',
  market: '장사하는 중', inn: '객잔 일을 보는 중', escort: '표물을 지키는 중', clinic: '환자를 돌보는 중', dojo: '무공을 수련하는 중', tower: '망루에서 망을 보는 중',
  // 갈래 건물
  hall_jeong: '협객들과 의를 논하며 검을 닦는 중', altar_ma: '붉은 달에 제를 올리는 중', ancestral: '위패를 돌보고 손님을 맞는 중',
  blackmarket: '흑시에서 뒷거래를 하는 중', gambling: '투전판을 돌리는 중', horsemarket: '새외 상인과 말값을 흥정하는 중',
  yamen: '관아에서 공무를 보는 중', stage: '연무대에서 비무를 가늠하는 중',
};
const JOB_NAME = {
  farm: '농부', fishery: '어부', lumber: '나무꾼', quarry: '석공', smithy: '대장장이', market: '장사꾼', inn: '점소이',
  escort: '표사', clinic: '의원', dojo: '무사', tower: '궁수',
  hall_jeong: '협객', altar_ma: '제관', ancestral: '집사', blackmarket: '거간꾼', gambling: '물주', horsemarket: '말장수',
  yamen: '아전', stage: '사범',
};
// 하는 일 한 줄 (tips.js 도 쓴다). 의뢰로 떠난 이는 어느 세력의 일인지 적는다
function actTextOf(u) {
  if (u.away) {
    const q = typeof JH !== 'undefined' ? JH.quest(u.away.q) : null, F = q && FACTIONS[q.fid];
    return F ? `${F.name}의 의뢰로 길을 떠남` : ACT_TEXT.away;
  }
  if (u.down) return '쓰러져 있다';
  if (u.act === 'work') return WORK_TEXT[u.jobType] || '일하는 중';
  if (u.act === 'sleep' && !u.inside) return '잠자리로 가는 중';
  return ACT_TEXT[u.act] || '';
}
// 「읍(邑)」「정파(正派)」처럼 괄호 안의 한자에 풀이를 단다
const tipParen = s => s.replace(/\(([^)]+)\)/, (m, h) => `(<span data-tip-title="${h}">${h}</span>)`);
// 손가락으로 다루는 화면인가 (story.js 의 coarse() 와 같은 기준)
const coarsePointer = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

// ── 세력 창 (docs/jianghu.md §7·§11) ──
const FX_TRADE = ['sang', 'saeoe', 'sega'];   // 교역 협정을 맺는 계열
const FX_BOUNTY = ['heuk', 'sa', 'ma'];       // 현상금을 거는 계열
// 외교 단추: 이름과, 하면 무엇이 되는가 (말풍선)
const FX_ACT = {
  gift: ['예물', '관계 +6, 그 계열과도 조금 가까워진다. 세력마다 하루 한 번.'],
  envoy: ['사신', '관계 +10~14, 위협 −15. 그 계열과도 가까워진다. 세력마다 닷새에 한 번.'],
  trade: ['교역', '스무 날 동안 매일 은자가 들어온다(시장이 많을수록 더). 관계 +3. 동시에 둘까지.'],
  vassal: ['산하에 든다', '매일 공물을 바치는 대신 계열의 혜택을 얻고, 습격 때 원군이 온다. 그 원수 계열과는 멀어진다.'],
  unvassal: ['주종을 끊는다', '배신이다. 관계 −40, 위협이 크게 오르고 그 계열 모두가 등을 돌린다.'],
  pact: ['동맹', '공물 없이 계열 혜택의 절반을 나누고, 싸움이 없으면 습격 때 원군을 보낸다. 관계가 30 아래로 떨어지면 깨진다.'],
  unpact: ['동맹을 끊는다', '관계 −25, 그 계열 모두와 멀어진다.'],
  bounty: ['현상금', '관의 힘을 빌려 친다. 그들의 힘 −20, 위협이 가라앉지만 관계 −20에 열흘 동안 원한을 산다. 관부 관계 −5.'],
  spy: ['첩자', '열흘 동안 정확한 위협과 다음 습격(날·길목·규모)을 알려 준다. 붙잡히면 관계 −15.'],
  support: ['지원 보내기', '전황을 이 편으로 기울인다. 은자 50 · 식량 80 · 병장기 5마다 전황 +1. 이 편 관계 +5, 맞선 편 −8.'],
  mediate: ['중재', '싸움을 승부 없이 멈춘다. 명성 +15, 양쪽 관계 +5.'],
};
const FX_SUP = { silver: [0, 50, 100, 200], food: [0, 80, 160], weapons: [0, 5, 10] };   // 전쟁 지원의 몫
const FX_QKIND = { escort: '호위', suppress: '토벌', scout: '정탐', retrieve: '탈환', war: '원군', assassin: '암살', smuggle: '밀수', herb: '약재' };
const FX_NUM = ['', '하나', '둘', '셋', '넷'];
const FX_DAYS = ['', '하루', '이틀', '사흘', '나흘', '닷새'];
const FX_NEWS = { war: '전쟁', warEnd: '종전', fall: '멸문', rise: '재기', surge: '기세', seat: '빈자리', bounty: '현상금' };
// 이 파일이 화면에 쓰는 한자 풀이 (이미 있는 풀이는 덮지 않는다)
const UI_GLOSS = {
  '岐路': ['기로', '갈림길. 어느 쪽으로 갈지 정해야 하는 길목. 제4장의 이름.'],
  '獨': ['홀로 독', '홀로 섬. 누구의 산하에도 들지 않는 독립의 길.'],
};
for (const [k, v] of Object.entries(UI_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;
// 하루 번호 → '봄 3일' (기록 창과 같은 꼴)
const dayText = d => `${SEASONS[Math.floor(d / DAYS_PER_SEASON) % 4]} ${d % DAYS_PER_SEASON + 1}일`;
const glossTitle = h => { const g = HANJA_GLOSS[h]; return g ? `${h} · ${g[0]}` : h; };
const hj = h => `<span data-tip-title="${h}">${h}</span>`;
function crestHTML(id, cls = '') {
  const F = FACTIONS[id];
  return `<span class="fac-crest${cls ? ' ' + cls : ''}" style="background:${F.color}" data-tip-title="${glossTitle(F.hanja)}" data-tip="${F.name}의 문장">${F.hanja}</span>`;
}
const relWord = r => r <= -40 ? ['hostile', '적대'] : r < -10 ? ['hostile', '냉랭'] : r < 25 ? ['neutral', '중립'] : r < 60 ? ['friendly', '우호'] : ['friendly', '두터움'];
const signed = n => `${n > 0 ? '+' : ''}${n}`;
const relBar = r => `<div class="rel"><div class="rel-track"><span style="left:${(r + 100) / 2}%"></span></div><span>${signed(r)}</span></div>`;
// 돌아오기까지 남은 시각 (시진 = 두 시간)
function remainText(h) {
  h = Math.max(0, h);
  const d = Math.floor(h / 24), s = Math.floor((h % 24) / 2);
  return d ? `${d}일${s ? ` ${s}시진` : ''}` : `${Math.max(1, Math.ceil(h / 2))}시진`;
}

const UI = {
  sel: null, tool: null, hover: null, dragTiles: null, cat: 'home',
  modalOpen: false, modalEntry: null, modalAt: 0, buildMenuDirty: true, lastPanel: '', lastTop: '', sheet: null,
  camTarget: null,
  // 세력 창의 화면 상태: 다시 그려도(0.22초마다) 남는다. 탭, 펼친 이웃 카드·계열, 의뢰마다 고른 사람, 전쟁 지원의 몫.
  // 저장하지 않는다. 새 게임·불러오기로 S 가 바뀌면 처음으로 돌린다
  fx: { S: null, tab: 'fac', open: {}, camp: {}, party: {}, sup: {}, confirm: '', flash: null },
  fxFresh() { if (this.fx.S !== S) this.fx = { S, tab: 'fac', open: {}, camp: {}, party: {}, sup: {}, confirm: '', flash: null }; return this.fx; },
  factionFocus: null,   // 천하도의 [세력 창에서 보기]: 세력 창을 열 때 이 세력 카드로 간다
  sheetHold: 0, sheetTop: false,

  init() {
    this.renderTabs();
    document.querySelectorAll('.speed button').forEach(b => b.addEventListener('click', () => this.setSpeed(+b.dataset.speed)));
    $('btn-factions').onclick = () => this.openSheet('factions');
    $('btn-village').onclick = () => this.openSheet('village');
    $('btn-help').onclick = () => this.openSheet('help');
    $('btn-admin').onclick = () => this.openSheet('admin');
    $('btn-petitions').onclick = () => this.openSheet('petitions');
    $('btn-story').onclick = () => hook(Story, 'openAdvisor');
    $('btn-log').onclick = () => { $('log').hidden = !$('log').hidden; this.renderLog(); };
    $('log-close').onclick = () => { $('log').hidden = true; };
    $('btn-save').onclick = () => saveGame(false);
    $('sheet-close').onclick = () => this.closeSheet();
    $('sheet').addEventListener('click', e => { if (e.target.id === 'sheet') this.closeSheet(); });
    $('sheet-body').addEventListener('click', e => this.onSheetClick(e));
    // 누르는 동안에는 창을 다시 그리지 않는다 (누른 단추가 바뀌어 눌림이 사라지지 않게)
    $('sheet-body').addEventListener('pointerdown', () => { this.sheetHold = performance.now(); });
    for (const ev of ['pointerup', 'pointercancel']) window.addEventListener(ev, () => { this.sheetHold = 0; });
    // 펼치는 머리(role=button)는 Enter·Space 로도 누른다
    $('sheet-body').addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.click(); }
    });
    // 갈래가 정해지면 건설 띠를 다시 그린다 (갈래 건물은 그 갈래에서만 보인다)
    Bus.on('routeChosen', () => {
      this.buildMenuDirty = true;
      if (this.tool && BDEF[this.tool.key] && BDEF[this.tool.key].route && !this.routeOK(this.tool.key)) this.setTool(null);
    });
    $('panel').addEventListener('click', e => this.onPanelClick(e));
    $('banner').addEventListener('click', e => this.onBannerClick(e));
    $('minimap').addEventListener('pointerdown', e => this.onMinimap(e));
    $('minimap').addEventListener('pointermove', e => { if (e.buttons) this.onMinimap(e); });
  },

  // ── 상단 띠 ──
  updateTop() {
    const pop = popCount(), house = housingTotal(), cap = storageCap();
    const flow = S.lastFlow || {};
    const fmtFlow = k => flow[k] ? ` · 어제 +${fmt(flow[k])}` : '';
    const chips = [
      ['silver', '銀', fmt(S.res.silver), `지금 ${fmt(S.res.silver)}냥${fmtFlow('silver')}`, false],
      ['food', '食', fmt(S.res.food), `지금 ${fmt(S.res.food)} / 최대 ${cap} · 하루 소비 ${Math.round(pop * 2)}${fmtFlow('food')}`, S.res.food < pop * 2],
      ['wood', '木', fmt(S.res.wood), `지금 ${fmt(S.res.wood)} / 최대 ${cap}${fmtFlow('wood')}`, false],
      ['stone', '石', fmt(S.res.stone), `지금 ${fmt(S.res.stone)} / 최대 ${cap}${fmtFlow('stone')}`, false],
      ['weapons', '兵', fmt(S.res.weapons), `지금 ${fmt(S.res.weapons)}`, false],
      ['pop', '人', `${pop}<small>/${house}</small>`, `인구 ${pop}명 · 집 ${house}칸`, pop > house],
      ['happy', '心', `${Math.round(S.happy)}`, `지금 ${Math.round(S.happy)} / 100 · 자세한 까닭은 [마을 현황]`, S.happy < 35],
      ['def', '武', `${defensePower()}`, `지금 ${defensePower()}`, false],
      ['fame', '名', `${fmt(S.fame)}`, `지금 ${fmt(S.fame)} · 목표 400`, false],
    ];
    const html = chips.map(([k, h, val, tip, low]) => {
      const g = HANJA_GLOSS[h];
      return `<span class="chip${low ? ' low' : ''}" data-tip-title="${h} · ${g[0]}" data-tip="${escapeHtml(g[1] + '\n' + tip)}"><i>${h}</i><b>${val}</b></span>`;
    }).join('');
    if (html !== this.lastTop) { $('res').innerHTML = html; this.lastTop = html; }
    $('village-name').textContent = S.name;
    $('village-rank').textContent = RANKS[S.rank].name + (S.vassal ? ` · ${FACTIONS[S.vassal].name} 산하` : '') + (S.occupation ? ' · 점령됨' : '');
    // 등급 이름의 한자(縣城 등)에 풀이를 단다. 이름에 한자가 없으면(마을) 인장 글자로
    $('village-rank').dataset.tipTitle = (RANKS[S.rank].name.match(/\(([^)]+)\)/) || [])[1] || RANKS[S.rank].short;
    $('rank-seal').textContent = RANKS[S.rank].short;
    const rg = HANJA_GLOSS[RANKS[S.rank].short];
    $('rank-seal').dataset.tipTitle = `${RANKS[S.rank].short} · ${rg[0]}`;
    $('rank-seal').dataset.tip = `${rg[1]}\n다음 등급: ${S.rank + 1 < RANKS.length ? `${RANKS[S.rank + 1].name} (인구 ${RANKS[S.rank + 1].minPop}명)` : '없음 — 가장 높은 등급'}`;
    $('clock-date').textContent = dateText();
    $('clock-time').textContent = timeText();
    const si = Math.floor(((hourOf() + 1) % 24) / 2);
    $('clock-time').dataset.tipTitle = `${SHICHEN[si][0]} (${SHICHEN[si][1]})`;
    $('clock-time').dataset.tip = `옛 시각 12시진 가운데 하나. 지금으로 치면 ${SHICHEN_HOURS[si]}.\n한 계절은 ${DAYS_PER_SEASON}일, 한 해는 ${DAYS_PER_SEASON * 4}일.`;
    for (const s of [0, 1, 2, 4]) $('spd-' + s).classList.toggle('on', S.speed === s);
    $('btn-factions').classList.toggle('alert', !!S.occupation);
    // [세력] 단추의 배지: 맡을 수 있는 의뢰 수
    const nb = hook(JH, 'badge') || 0, fb = $('faction-badge');
    if (fb) { fb.hidden = !nb; if (fb.textContent !== String(nb)) fb.textContent = nb; }
  },
  setSpeed(s) {
    if (!S) return;
    // ❚❚ 단추로 멈춰도 Space가 멈추기 전 속도로 되돌리게 (main.js 가 Input.prevSpeed 를 쓴다)
    if (!s && S.speed > 0 && typeof Input !== 'undefined') Input.prevSpeed = S.speed;
    S.speed = s; this.updateTop();
  },

  // ── 습격·점령 띠 ──
  updateBanner() {
    const el = $('banner');
    let html = '', cls = '';
    if (S.raid) {
      const r = S.raid, F = FACTIONS[r.faction];
      const alive = S.enemies.filter(e => !e.dead && (!e.garrison || r.goal === 'uprising')).length + r.toSpawn;
      const def = fighters().filter(v => !v.away).length + S.allies.filter(a => !a.dead).length;
      html = `<span>${r.goal === 'uprising' ? '봉기' : '⚔ ' + F.name + ' 습격'} · 적 ${alive}명 · 아군 ${def}명${r.phase === 'retreat' ? ' · 퇴각 중' : ''}</span><button type="button" data-act="goto-enemy">적 위치로</button>`;
    } else if (S.occupation) {
      const F = FACTIONS[S.occupation.faction];
      cls = 'occupied';
      html = `<span>${F.name} 점령 중 · 매일 수탈당한다</span><button type="button" data-act="open-factions">마을을 되찾기</button>`;
    } else {
      const pending = S.scheduled.find(s => s.kind === 'raid');
      if (pending) {
        const h = Math.max(0, pending.at - S.time);
        html = `<span>${FACTIONS[pending.faction].name}${pp(FACTIONS[pending.faction].name, '이/가')} 다가온다 · 약 ${Math.ceil(h)}시간 뒤</span>`;
      }
    }
    el.hidden = !html;
    el.className = cls;
    if (html && el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  },
  onBannerClick(e) {
    const a = e.target.dataset.act;
    if (a === 'goto-enemy') {
      const en = S.enemies.find(x => !x.dead && (!x.garrison || (S.raid && S.raid.goal === 'uprising')));
      if (en) this.focusOn(en.x, en.y);
      else if (S.raid && S.raid.exit) this.focusOn(S.raid.exit.x, S.raid.exit.y);
    } else if (a === 'open-factions') { this.fxFresh().tab = 'fac'; this.openSheet('factions'); }
  },

  // ── 알림 ──
  toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = text;
    $('toasts').appendChild(el);
    while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 2800);
    setTimeout(() => el.remove(), 3500);
  },
  onLog() { if (!$('log').hidden) this.renderLog(); },
  renderLog() {
    const items = S.log.slice().reverse().slice(0, 80).map(l => `<li class="${l.kind}"><time>${dayText(Math.floor(l.t / 24))}</time>${escapeHtml(l.text)}</li>`);
    $('log-list').innerHTML = items.join('');
  },

  // ── 건설 메뉴 ──
  renderTabs() {
    $('build-tabs').innerHTML = BUILD_CATS.map(c => `<button type="button" role="tab" data-cat="${c.id}" class="${c.id === this.cat ? 'on' : ''}">${c.name}</button>`).join('');
    $('build-tabs').onclick = e => { const c = e.target.dataset.cat; if (c) { this.cat = c; this.renderTabs(); this.buildMenuDirty = true; } };
  },
  // 갈래 건물은 그 갈래를 걸을 때만 보인다 (§8.4)
  routeOK(k) { const r = BDEF[k] && BDEF[k].route; return !r || !!(S.jh && S.jh.route === r); },
  renderBuildItems() {
    const keys = this.cat === 'tools' ? ['road', 'clear', 'demolish'] : BUILD_ORDER.filter(k => BDEF[k].cat === this.cat && this.routeOK(k));
    const box = $('build-items');
    box.innerHTML = '';
    for (const k of keys) {
      const def = BDEF[k] || TOOLS[k];
      const locked = def.rank && S.rank < def.rank;
      const poor = !canAfford(def.cost || {});
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bitem' + (locked ? ' locked' : '') + (poor ? ' poor' : '') + (this.tool && this.tool.key === k ? ' on' : '');
      btn.dataset.key = k;
      btn.appendChild(iconCanvas(k));
      const nm = document.createElement('span'); nm.className = 'bn'; nm.textContent = def.name; btn.appendChild(nm);
      const ct = document.createElement('span'); ct.className = 'bc';
      ct.textContent = k === 'road' ? '銀1' : k === 'demolish' ? '반값 환불' : costShort(def.cost || {});
      btn.appendChild(ct);
      if (locked) { const l = document.createElement('span'); l.className = 'lock'; l.textContent = RANKS[def.rank].short; btn.appendChild(l); }
      btn.addEventListener('click', () => {
        if (locked) { this.toast(`마을이 ${RANKS[def.rank].name} 이상이어야 한다 (인구 ${RANKS[def.rank].minPop}명)`, 'bad'); return; }
        if (this.tool && this.tool.key === k) this.setTool(null); else this.setTool(k);
      });
      btn.addEventListener('pointerenter', e => this.showTip(e, k));
      btn.addEventListener('pointerleave', () => { $('tooltip').hidden = true; });
      box.appendChild(btn);
    }
    this.buildMenuDirty = false;
    this.lastAfford = this.affordKey();
  },
  // 갈래도 넣는다: 이야기가 Bus 없이 갈래를 바꾸어도(불러오기 등) 띠가 따라온다
  affordKey() { return [S.rank, Math.floor(S.res.silver / 5), Math.floor(S.res.wood / 3), Math.floor(S.res.stone / 3), S.jh ? S.jh.route : ''].join(','); },
  showTip(e, k) {
    const def = BDEF[k] || TOOLS[k];
    const tip = $('tooltip');
    const lines = [`<h4>${def.name}</h4>`, `<p>${def.desc}</p>`];
    if (BDEF[k]) {
      const extra = [];
      if (def.workers) extra.push(`일꾼 ${def.workers}명`);
      if (def.housing) extra.push(`${def.housing}명 거주`);
      if (def.time) extra.push(`공사 ${def.time}시간`);
      if (extra.length) lines.push(`<p>${extra.join(' · ')}</p>`);
      if (def.route) lines.push(`<p>갈래 건물 · ${def.route === 'free' ? '홀로 서는' : CAMPS[def.route].name + '의'} 길에서만, 하나만 짓는다</p>`);
      lines.push(`<p class="tt-cost">${costText(def.cost)}</p>`);
      if (def.rank && S.rank < def.rank) lines.push(`<p class="tt-bad">마을이 ${RANKS[def.rank].name} 이상 (인구 ${RANKS[def.rank].minPop}) 이어야 한다</p>`);
    }
    tip.innerHTML = lines.join('');
    tip.hidden = false;
    const r = e.currentTarget.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px';
    tip.style.top = Math.max(8, r.top - th - 8) + 'px';
  },
  setTool(k) {
    if (!k) { this.tool = null; }
    else if (k === 'road') this.tool = { kind: 'road', key: k };
    else if (k === 'clear' || k === 'demolish') this.tool = { kind: k, key: k };
    else this.tool = { kind: BDEF[k].line ? 'line' : 'build', key: k };
    this.dragTiles = null;
    $('tooltip').hidden = true;
    this.buildMenuDirty = true;
    const hint = $('tool-hint');
    if (!this.tool) { hint.hidden = true; Bus.emit('tool', null); return; }
    const name = (BDEF[k] || TOOLS[k]).name;
    const how = this.tool.kind === 'road' || this.tool.kind === 'line' ? '끌어서 잇기' : this.tool.kind === 'build' ? '눌러서 놓기' : '눌러서 실행';
    // 터치 화면에는 우클릭도 Esc도 없다: 고른 단추를 다시 눌러 거둔다
    hint.textContent = `${name} · ${how} · ${coarsePointer() ? '같은 단추를 다시 누르면 취소' : '우클릭이나 Esc로 취소'}`;
    hint.hidden = false;
    Bus.emit('tool', k);
  },

  // ── 선택 정보 ──
  select(obj) {
    this.sel = obj;
    this.lastPanel = '';
    $('panel').hidden = !obj;
    if (obj) this.updatePanel();
    Bus.emit('select', obj);
  },
  updatePanel() {
    if (!this.sel) return;
    let html = '';
    if (this.sel.b) {
      const b = this.sel.b;
      if (!S.bmap.get(b.id)) { this.select(null); return; }
      html = this.buildingPanel(b);
    } else if (this.sel.u) {
      const u = this.sel.u;
      if (u.dead) { this.select(null); return; }
      html = this.unitPanel(u);
    }
    if (html !== this.lastPanel) {
      $('panel').innerHTML = html;
      this.lastPanel = html;
      const c = $('panel').querySelector('canvas[data-icon]');
      if (c) {
        const src = iconCanvas(c.dataset.icon, 56, 44);
        c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
      }
    }
  },
  buildingPanel(b) {
    const def = BDEF[b.type];
    const status = b.ruined ? '폐허' : !b.done ? `공사 중 ${Math.floor(b.progress / def.time * 100)}%` : !b.active ? '가동 중지' : '가동 중';
    const rows = [];
    rows.push(['내구도', `${Math.ceil(b.hp)} / ${b.maxHp}`]);
    const workers = b._workers || [];
    const residents = b._residents || [];
    if (def.workers && b.done && !b.ruined) rows.push(['일꾼', `${workers.length} / ${b.want} (최대 ${def.workers})`]);
    if (def.housing && b.done && !b.ruined) rows.push(['사는 사람', `${residents.length} / ${def.housing}`]);
    if (b.type === 'lumber') rows.push(['숲의 풍성함', `${Math.round((b._forest || 0) * 100)}%`]);
    if (b.type === 'quarry') rows.push(['바위의 풍성함', `${Math.round((b._rock || 0) * 100)}%`]);
    if (b.type === 'escort') rows.push(['관도 연결', b._connected ? '이어짐' : '<span style="color:var(--bad)">끊김 (수입 감소)</span>']);
    if (b.type === 'tower') rows.push(['사거리', `${def.range}칸`]);
    if (def.upkeep) rows.push(['품삯', `1인당 매일 은자 ${def.upkeep}`]);
    if (def.storage) rows.push(['저장', `+${def.storage}`]);
    if (!b.done && !b.ruined) rows.push(['일손', `${b._builders || 0}명`]);
    let list = '';
    const people = workers.length ? workers : residents;
    if (people.length) {
      list = '<ul class="p-list">' + people.map(v => `<li class="link" data-unit="${v.id}"><span>${escapeHtml(v.name)}</span><span>${v.role === 'guard' || v.hero ? realmOf(v.martial) : (v.jobType ? JOB_NAME[v.jobType] : '무직')}</span></li>`).join('') + '</ul>';
    }
    const acts = [];
    if (def.workers && b.done && !b.ruined) {
      acts.push(`<button type="button" class="btn" data-act="want-" ${b.want <= 0 ? 'disabled' : ''}>일꾼 −</button>`);
      acts.push(`<button type="button" class="btn" data-act="want+" ${b.want >= def.workers ? 'disabled' : ''}>일꾼 +</button>`);
      acts.push(`<button type="button" class="btn" data-act="toggle">${b.active ? '가동 중지' : '가동 재개'}</button>`);
    }
    if (b.ruined) { const rc = repairCost(b); acts.push(`<button type="button" class="btn" data-act="repair" ${canAfford(rc) ? '' : 'disabled'}>다시 짓기 (${costText(rc)})</button>`); }
    if (b.type === 'house' && b.done && !b.ruined) {
      const up = upgradeCost();
      acts.push(`<button type="button" class="btn" data-act="upgrade" ${S.rank >= 1 && canAfford(up) ? '' : 'disabled'} title="${S.rank < 1 ? '마을 등급이 필요하다' : ''}">기와집으로 (${costText(up)})</button>`);
    }
    if (b.type !== 'manor') acts.push(`<button type="button" class="btn danger" data-act="demolish">${UI.confirmDemolish === b.id ? '정말 허문다' : '허물기'}</button>`);
    const bar = !b.done && !b.ruined
      ? `<div class="bar prog"><span style="width:${clamp(b.progress / def.time, 0, 1) * 100}%"></span></div>`
      : `<div class="bar"><span style="width:${clamp(b.hp / b.maxHp, 0, 1) * 100}%"></span></div>`;
    return `<div class="p-head"><canvas data-icon="${b.type}" style="width:56px;height:44px"></canvas><div><h3>${def.name}</h3><div class="sub">${status}</div></div><button type="button" class="p-close" data-act="close" aria-label="닫기">✕</button></div>
      <p class="p-desc">${def.desc}</p>${bar}
      <dl class="p-rows">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>${list}
      <div class="p-actions">${acts.join('')}</div>`;
  },
  unitPanel(u) {
    let title = '', sub = '', rows = [], acts = [];
    if (u.kind === 'v') {
      const role = u.hero ? `${u.hero.title} · 객경` : u.jobType ? JOB_NAME[u.jobType] : '무직';
      title = u.hero ? `${u.hero.epithet} ${u.name}` : u.name;
      sub = `${u.sex === 'f' ? '여' : '남'} · ${u.age}세 · ${role}`;
      rows.push(['하는 일', actTextOf(u)]);
      if (u.away) rows.push(['돌아오는 때', `${remainText(u.away.until - S.time)} 뒤`]);
      const h = getB(u.home), j = getB(u.job);
      rows.push(['집', h ? `<a data-bld="${h.id}">${BDEF[h.type].name}</a>` : '<span style="color:var(--bad)">없음</span>']);
      if (j) rows.push(['일터', `<a data-bld="${j.id}">${BDEF[j.type].name}</a>`]);
      rows.push(['무공', `${realmOf(u.martial)} (${u.martial.toFixed(2)})`]);
      if (u.kills) rows.push(['쓰러뜨린 적', `${u.kills}명`]);
      if (u.hero) { rows.push(['품삯', `매일 은자 ${u.hero.upkeep}냥`]); acts.push(`<button type="button" class="btn danger" data-act="dismiss">${UI.confirmDismiss === u.id ? '정말 내보낸다' : '내보내기'}</button>`); }
    } else {
      const F = FACTIONS[u.faction];
      title = u.leader ? u.title : u.name;
      sub = `${F.name} · ${u.kind === 'e' ? (u.garrison ? '점령군' : '적') : '원군'}`;
      rows.push(['소속', F.name]);
      if (u.carry) rows.push(['약탈품', `${u.carry}`]);
    }
    rows.unshift(['기력', `${Math.ceil(Math.max(0, u.hp))} / ${u.maxHp}`]);
    return `<div class="p-head"><div><h3>${escapeHtml(title)}</h3><div class="sub">${sub}</div></div><button type="button" class="p-close" data-act="close" aria-label="닫기">✕</button></div>
      <div class="bar hp"><span style="width:${clamp(u.hp / u.maxHp, 0, 1) * 100}%"></span></div>
      <dl class="p-rows">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="p-actions">${acts.join('')}</div>`;
  },
  onPanelClick(e) {
    const t = e.target.closest('[data-act],[data-unit],[data-bld]');
    if (!t) return;
    if (t.dataset.unit) { const u = S.villagers.find(v => v.id === +t.dataset.unit); if (u) { this.select({ u }); if (!u.inside) this.focusOn(u.x, u.y); } return; }
    if (t.dataset.bld) { const b = getB(+t.dataset.bld); if (b) { this.select({ b }); this.focusOn(b.x + b.w / 2, b.y + b.h / 2); } return; }
    const a = t.dataset.act;
    const b = this.sel && this.sel.b, u = this.sel && this.sel.u;
    if (a === 'close') this.select(null);
    else if (a === 'want-' && b) { b.want = Math.max(0, b.want - 1); markDirty(); }
    else if (a === 'want+' && b) { b.want = Math.min(BDEF[b.type].workers, b.want + 1); markDirty(); }
    else if (a === 'toggle' && b) { b.active = !b.active; markDirty(); }
    else if (a === 'repair' && b) { if (repair(b)) this.toast(`${BDEF[b.type].name}${pp(BDEF[b.type].name, '을/를')} 다시 짓기 시작했다.`, 'good'); }
    else if (a === 'upgrade' && b) upgradeHouse(b);
    else if (a === 'demolish' && b) {
      if (UI.confirmDemolish === b.id) { UI.confirmDemolish = 0; demolish(b); this.select(null); }
      else { UI.confirmDemolish = b.id; setTimeout(() => { UI.confirmDemolish = 0; }, 3000); }
    } else if (a === 'dismiss' && u) {
      if (UI.confirmDismiss === u.id) { UI.confirmDismiss = 0; u.leaving = true; u.act = null; logMsg(`${u.hero.epithet} ${u.name}${pp(u.name, '이/가')} 마을을 떠났다.`); this.select(null); }
      else { UI.confirmDismiss = u.id; setTimeout(() => { UI.confirmDismiss = 0; }, 3000); }
    }
    this.lastPanel = '';
    this.updatePanel();
  },

  // ── 큰 창 ──
  // 다른 모듈(육방·상소 등)이 자기 창을 끼워 넣는 곳
  // UI.registerSheet('admin', { html: () => '...', onClick: e => {...}, live: true })
  sheets: {},
  registerSheet(kind, def) { this.sheets[kind] = def; },
  openSheet(kind) {
    this.sheet = kind;
    $('sheet').hidden = false;
    $('sheet').dataset.kind = kind;
    $('sheet-body').dataset.h = '';
    this.sheetTop = true;   // 새로 연 창은 맨 위부터
    this.fxFresh();
    // 천하도의 [세력 창에서 보기]: 세력 탭으로 가서 그 카드를 펼치고 그리로 스크롤한다
    if (kind === 'factions' && this.factionFocus) { const id = this.factionFocus; this.factionFocus = null; this.focusFaction(id); }
    else this.renderSheet();
    Bus.emit('sheetOpen', kind);
  },
  closeSheet() { const k = this.sheet; this.sheet = null; $('sheet').hidden = true; if (k) Bus.emit('sheetClose', k); },
  renderSheet() {
    if (!this.sheet) return;
    const body = $('sheet-body');
    let html = '';
    const ext = this.sheets[this.sheet];
    if (ext) html = ext.html();
    else if (this.sheet === 'factions') html = this.factionsHTML();
    else if (this.sheet === 'village') html = this.villageHTML();
    else html = this.helpHTML();
    if (body.dataset.h !== html) {
      // 다시 그려도 읽던 자리를 지킨다 (탭을 바꾸거나 새로 열 때만 맨 위로)
      const inner = body.parentElement, top = inner.scrollTop;
      body.innerHTML = html; body.dataset.h = html;
      inner.scrollTop = this.sheetTop ? 0 : top;
    } else if (this.sheetTop) body.parentElement.scrollTop = 0;
    this.sheetTop = false;
  },
  // 세력 창에서 그 세력의 카드로: 세력 탭, 이웃이면 카드를 펼치고 먼 세력이면 계열 묶음을 편다
  focusFaction(id) {
    const fx = this.fx, F = FACTIONS[id];
    if (!F) { this.renderSheet(); return; }
    fx.tab = 'fac';
    if (S.jh && (S.jh.near.includes(id) || id === S.vassal || S.jh.pacts.includes(id))) fx.open[id] = true; else fx.camp[F.camp] = true;
    fx.flash = { id, until: performance.now() + 2400 };
    this.renderSheet();
    const inner = $('sheet').querySelector('.sheet-inner'), el = $('sheet-body').querySelector(`[data-fcard="${id}"]`);
    if (inner && el) inner.scrollTop += el.getBoundingClientRect().top - inner.getBoundingClientRect().top - 14;
  },

  // ── 세력 창: [세력 · 의뢰 · 소식] ──
  factionsHTML() {
    if (!S.jh) return '<h2>강호의 세력</h2><p class="lead">아직 강호의 소식이 닿지 않았다.</p>';
    const fx = this.fxFresh(), jh = S.jh, allow = JH.allowJianghu();
    const nOpen = JH.badge(), nAway = jh.quests.filter(q => q.state === 'away').length;
    const tabs = [
      ['fac', '세력', ''],
      ['quest', '의뢰', nOpen ? `<span class="badge">${nOpen}</span>` : nAway ? `<span class="badge dim">${nAway}</span>` : ''],
      ['news', '소식', ''],
    ].map(([k, name, b]) => `<button type="button" role="tab" aria-selected="${fx.tab === k}" class="${fx.tab === k ? 'on' : ''}" data-act="fx-tab" data-tab="${k}">${name}${b}</button>`).join('');
    // 폰에는 메뉴의 [천하도]가 없으니 여기서 연다
    const map = typeof WorldMap !== 'undefined' ? '<button type="button" class="btn fx-mapbtn narrow-only" data-act="fx-map" data-tip-title="天下圖" data-tip="천하의 판도와 전쟁, 계열마다의 세력 흐름을 본다.">천하도 펼치기</button>' : '';
    const body = fx.tab === 'quest' ? this.questTabHTML(allow) : fx.tab === 'news' ? this.newsTabHTML(allow) : this.facTabHTML(allow);
    return `<div class="fx-head"><h2>강호의 세력</h2>${map}</div>${this.routeHTML()}
      <div class="fx-tabs" role="tablist">${tabs}</div>${body}`;
  },
  // 갈래 이름: routeInfo.name 은 계열 이름(독립이면 '독립')이다 → '정파의 길', '홀로 서는 길'
  routeName(ri) { return ri.key === 'free' ? '홀로 서는 길' : /길$/.test(ri.name) ? ri.name : `${ri.name}의 길`; },
  // 갈래 표: 이야기 모듈의 routeInfo, 없으면 S.jh.route 로 짐작한다
  routeHTML() {
    let ri = hook(Story, 'routeInfo');
    const key = S.jh && S.jh.route;
    if (!ri && key) ri = { key, name: key === 'free' ? '홀로 서는 길' : `${CAMPS[key].name}의 길`, seal: key === 'free' ? '獨' : CAMPS[key].seal, title: '', foes: [], provisional: false };
    if (!ri || !ri.key) return '';
    const C = CAMPS[ri.key], seal = ri.seal || (C && ri.key !== 'free' ? C.seal : '獨');
    const foes = (ri.foes || []).filter(c => CAMPS[c]).map(c => CAMPS[c].name).join(' · ');
    const sub = [ri.title ? `결말: ${escapeHtml(ri.title)}` : '', foes ? `숙적: ${foes}` : ''].filter(Boolean).join(' · ');
    return `<div class="fx-route${ri.provisional ? ' prov' : ''}" style="--fc:${C ? C.color : 'var(--gold-dim)'}">
      <span class="fx-route-seal" data-tip-title="${seal}">${seal}</span>
      <div class="fx-route-txt"><b>${escapeHtml(this.routeName(ri))}</b>${ri.provisional ? '<span class="fx-prov" data-tip-title="잠정 갈래" data-tip="제4장 갈림길에 이르면 이 길을 확정할지 묻는다.">잠정</span>' : ''}${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  },
  // 외교 단추 하나. 못 쓰면 aria-disabled 로 두고 까닭을 말풍선(data-tip)과 누를 때의 알림(data-why)으로 단다
  actBtn(kind, id, o = {}) {
    const c = JH.canAct(kind, id, o.opts || {});
    const [name, eff0] = FX_ACT[kind];
    // 주군을 갈아타는 것은 배신이다
    const eff = kind === 'vassal' && S.vassal && S.vassal !== id ? `${eff0}\n지금의 주군 ${FACTIONS[S.vassal].name}${pp(FACTIONS[S.vassal].name, '과/와')}의 주종은 끊어진다(배신).` : eff0;
    const cost = c.cost && Object.keys(c.cost).length ? costText(c.cost) : '';
    const sure = o.confirm && this.fx.confirm === `${kind}:${id}`;
    const tip = [c.ok ? '' : c.why, eff, cost ? `드는 것: ${cost}` : ''].filter(Boolean).join('\n');
    const attrs = `data-act="fx-do" data-kind="${kind}" data-f="${id}"${o.war ? ` data-w="${o.war}"` : ''}${c.ok ? '' : ` aria-disabled="true" data-why="${escapeHtml(c.why)}"`}`;
    return `<button type="button" class="btn fx-act${o.cls ? ' ' + o.cls : ''}${o.danger ? ' danger' : ''}" ${attrs} data-tip-title="${name}" data-tip="${escapeHtml(tip)}">${sure ? '정말 하는가?' : (o.label || name)}${cost && !o.noCost ? `<small>${cost}</small>` : ''}</button>`;
  },
  flashOn(id) { const f = this.fx.flash; return !!(f && f.id === id && performance.now() < f.until); },

  // 세력 탭: 이웃 카드(접힘·펼침), 그리고 계열마다 묶은 먼 세력
  facTabHTML(allow) {
    const jh = S.jh;
    let occ = '';
    if (S.occupation) {
      const k = S.occupation.faction, F = FACTIONS[k];
      const c = ransomCost();
      const here = fighters().filter(v => !v.away);
      // 도와줄 세력: 이웃·주군·동맹 가운데 관계 30 이상
      const helpers = FACTION_ORDER.filter(m => m !== k && FACTIONS[m].military && JH.isAlive(m) && rel(m) >= 30 && (jh.near.includes(m) || S.vassal === m || jh.pacts.includes(m)));
      occ = `<div class="fac fx-occ">
        <div class="fac-top">${crestHTML(k)}<div><div class="fac-name">${F.name}에게 점령당함</div><div class="fac-type">${dayOf() - S.occupation.since}일째 · 점령군 ${S.enemies.filter(e => e.garrison && !e.dead).length}명</div></div></div>
        <p class="fac-desc">무사 ${here.length}명이 마을에 남아 있다. 점령군보다 강해졌을 때 봉기하라.</p>
        <div class="fac-actions">
          <button type="button" class="btn" data-act="ransom" ${S.res.silver >= c ? '' : 'disabled'}>몸값을 치른다 (은자 ${c})</button>
          <button type="button" class="btn" data-act="uprise" ${here.some(v => v.jobType !== 'tower') && !S.raid ? '' : 'disabled'}>봉기한다</button>
          ${helpers.map(m => `<button type="button" class="btn" data-act="uprise-help" data-f="${m}" ${S.res.silver >= 100 && !S.raid ? '' : 'disabled'}>${FACTIONS[m].name}의 도움으로 봉기 (은자 100)</button>`).join('')}
        </div></div>`;
    }
    // 위 목록: 주군·동맹이 먼저, 그다음 이웃 (주군은 이웃이 아니어도 위에 둔다)
    const top = k => k === S.vassal ? 0 : jh.pacts.includes(k) ? 1 : 2;
    const near = FACTION_ORDER.filter(k => jh.near.includes(k) || k === S.vassal || jh.pacts.includes(k)).sort((a, b) => top(a) - top(b));
    const far = FACTION_ORDER.filter(k => !near.includes(k));
    const groups = CAMP_ORDER.map(c => {
      const ids = far.filter(k => FACTIONS[k].camp === c);
      return ids.length ? this.campGroupHTML(c, ids) : '';
    }).join('');
    const lead = allow ? '이웃만이 위협을 쌓다가 마을을 습격한다. 카드를 누르면 외교 단추가 펼쳐진다.'
      : '관계가 −20 아래로 떨어진 이웃은 위협을 쌓다가 마을을 습격한다. 강호의 큰일(사신·교역·동맹·첩자·전쟁)은 마을의 기틀이 잡힌 뒤에 열린다.';
    return `${occ}<p class="lead fx-lead">${lead}</p>
      <h3 class="fx-h3">이웃<small>${jh.near.length}곳</small></h3><div class="fx-list">${near.map(k => this.nearCardHTML(k, allow)).join('')}</div>
      <h3 class="fx-h3">먼 세력<small>계열마다 · 예물·사신·교역만 오간다</small></h3><div class="fx-camps">${groups}</div>`;
  },
  nearCardHTML(k, allow) {
    const F = FACTIONS[k], f = S.factions[k], jh = S.jh, r = Math.round(f.rel);
    const open = !!this.fx.open[k];
    const lord = S.vassal === k, pact = jh.pacts.includes(k), occ = !!(S.occupation && S.occupation.faction === k);
    const war = JH.warOf(k), spied = JH.spied(k), C = CAMPS[F.camp];
    const [rc, rw] = relWord(r);
    const chips = [];
    if (lord) chips.push('<span class="st lord">주군</span>');
    if (pact) chips.push('<span class="st lord">동맹</span>');
    if (occ) chips.push('<span class="st danger">점령</span>');
    chips.push(`<span class="st ${rc}">${rw}</span>`);
    // 위협: 첩자가 없으면 낱말로만 (§7)
    if (F.military && !lord) {
      const t = Math.round(f.threat), lv = t >= 70 ? 'danger' : t >= 30 ? 'warn' : 'neutral';
      chips.push(spied ? `<span class="st ${lv}" data-tip-title="위협 (첩자 보고)" data-tip="첩자가 알아 온 정확한 위협. 100이 되면 쳐들어온다.">위협 ${t}%</span>`
        : `<span class="st ${lv}" data-tip-title="위협" data-tip="첩자가 없어 속내를 낱말로만 짐작한다.\n잠잠 · 술렁 · 칼을 간다">${JH.threatWord(k)}</span>`);
    }
    if (war) chips.push(`<span class="st war" data-tip-title="${escapeHtml(war.name)}" data-tip="${escapeHtml(war.a.map(x => FACTIONS[x].name).join('·') + ' 대 ' + war.b.map(x => FACTIONS[x].name).join('·'))}">${escapeHtml(war.name)}</span>`);
    // 접힌 꼴의 주된 행동 하나: 사이가 나쁜 무력 세력에는 사신, 그 밖에는 예물
    const main = occ ? '' : this.actBtn(F.military && !lord && r < -20 && allow ? 'envoy' : 'gift', k, { cls: 'fx-main' });
    let more = '';
    if (open) {
      const facts = [`힘 ${JH.power(k)}`];
      if (F.military) facts.push(`쳐들어오면 약&nbsp;${JH.raidEstimate(k)}명`);
      const R = REGIONS[F.home];
      facts.push(R ? `본산 ${R.name}(${hj(R.hanja)})` : '본산 마을 곁');
      const notes = [];
      if (F.perk) {
        const trib = Math.round((4 + popCount() * 0.25) * C.tribute);
        notes.push(`${lord ? '주군의 혜택' : pact ? '동맹의 혜택(절반)' : '산하가 되면'}: ${F.perk}${pact ? '' : ` · 공물 매일 은자 ${trib}냥`}`);
      }
      if (jh.trade[k] > dayOf()) notes.push(`교역 협정: ${jh.trade[k] - dayOf()}일 남음`);
      if (jh.grudge[k] > dayOf()) notes.push(`현상금의 원한: ${jh.grudge[k] - dayOf()}일 남음`);
      const it = JH.intel(k);
      if (it) {
        const ex = World.exits[it.exitIdx];
        const eta = it.threat >= 100 ? '곧 쳐들어온다' : it.eta != null && it.eta <= 30 ? `이대로면 약 ${it.eta}일 뒤 습격` : '습격할 기미는 없다';
        notes.push(`<b>첩자 보고</b> (${jh.spies[k] - dayOf()}일 남음): 위협 ${it.threat}% · ${eta}${F.military && ex ? ` · ${ex.name}${pp(ex.name, '으로/로')} · 약 ${it.size}명` : ''}`);
      }
      const acts = [this.actBtn('gift', k), this.actBtn('envoy', k)];
      if (FX_TRADE.includes(F.camp)) acts.push(this.actBtn('trade', k));
      if (!F.noLord) {
        acts.push(lord ? this.actBtn('unvassal', k, { danger: true, confirm: true }) : this.actBtn('vassal', k));
        if (!lord) acts.push(pact ? this.actBtn('unpact', k, { danger: true, confirm: true }) : this.actBtn('pact', k));
      }
      if (FX_BOUNTY.includes(F.camp)) acts.push(this.actBtn('bounty', k));
      acts.push(this.actBtn('spy', k));
      const link = typeof WorldMap !== 'undefined' ? `<button type="button" class="fx-link" data-act="fx-map" data-f="${k}">천하도에서 보기</button>` : '';
      more = `<div class="fx-more">
        <p class="fac-desc">${F.desc}</p>
        <div class="fx-facts"><span>${facts.join(' · ')}</span>${link}</div>
        ${notes.map(n => `<p class="fx-note">${n}</p>`).join('')}
        <div class="fx-acts">${acts.join('')}</div>
        ${war ? this.warBoxHTML(war, k) : ''}</div>`;
    }
    return `<div class="fx-card${open ? ' open' : ''}${this.flashOn(k) ? ' flash' : ''}" data-fcard="${k}" style="--fc:${F.color}">
      <div class="fx-top" data-act="fx-open" data-f="${k}" role="button" tabindex="0" aria-expanded="${open}">
        ${crestHTML(k)}
        <div class="fx-id"><div class="fac-name">${F.name}</div><div class="fac-type">${tipParen(F.type)}</div></div>
        <div class="fx-relcol">${relBar(r)}<div class="fx-chips">${chips.join('')}</div></div>
        <div class="fx-maincol">${main}</div>
        <span class="fx-caret" aria-hidden="true"></span>
      </div>${more}</div>`;
  },
  // 이웃이 낀 전쟁: 전황 막대, 영주가 보탠 몫, 지원(은자·식량·병장기 몫 고르기)과 중재
  warBoxHTML(w, k) {
    const side = JH.sideOf(w, k), other = side === 'a' ? 'b' : 'a';
    const me = side === 'a' ? w.score : -w.score;   // 이 편에서 본 전황 −10..10
    const word = me >= 3 ? '이 편이 밀어붙인다' : me <= -3 ? '이 편이 밀린다' : '팽팽하다';
    const key = `${w.id}:${k}`, amt = this.supAmt(key);
    const gain = amt.silver / 50 + amt.food / 80 + amt.weapons / 5;
    const seg = (res, label) => `<div class="fx-amt" role="group" aria-label="${label}"><span>${label}</span>${FX_SUP[res].map(n =>
      `<button type="button" class="${amt[res] === n ? 'on' : ''}${n > (S.res[res] || 0) ? ' poor' : ''}" data-act="fx-amt" data-key="${key}" data-res="${res}" data-n="${n}" aria-pressed="${amt[res] === n}">${n}</button>`).join('')}</div>`;
    const crests = ids => ids.map(x => crestHTML(x, 'xs')).join('');
    const mine = w.mine[side] ? ` · 영주가 보탠 몫 ${signed(w.mine[side])}` : '';
    return `<div class="fx-war">
      <div class="fx-war-top"><b>${escapeHtml(w.name)}</b><small>${dayOf() - w.since + 1}일째</small></div>
      <div class="fx-vs">${crests(w[side])}<div class="fx-score" style="--a:${FACTIONS[k].color};--b:${FACTIONS[w[other][0]].color}" data-tip-title="전황" data-tip="왼쪽이 이 편이다. 한쪽이 끝까지 밀리거나 스무 날이 지나면 싸움이 끝나고, 진 쪽은 힘을 잃는다."><span style="width:${clamp((me + 10) * 5, 0, 100)}%"></span></div>${crests(w[other])}</div>
      <p class="fx-note">전황: ${word}${mine}</p>
      <div class="fx-sup">${seg('silver', '은자')}${seg('food', '식량')}${seg('weapons', '병장기')}</div>
      <div class="fx-acts">${this.actBtn('support', k, { opts: Object.assign({ war: w.id }, amt), war: w.id, label: gain ? `지원 보내기 · 전황 +${gain.toFixed(1)}` : '지원 보내기', noCost: true })}${this.actBtn('mediate', w.id)}</div></div>`;
  },
  supAmt(key) { return this.fx.sup[key] || (this.fx.sup[key] = { silver: 50, food: 0, weapons: 0 }); },
  // 먼 세력: 계열마다 접힌 묶음. 펼치면 관계·힘·전쟁과 예물·사신·교역만
  campGroupHTML(c, ids) {
    const C = CAMPS[c], open = !!this.fx.camp[c];
    const alive = ids.filter(k => JH.isAlive(k));
    const wars = alive.filter(k => JH.warOf(k)).length;
    const sum = alive.reduce((t, k) => t + JH.power(k), 0);
    const rows = open ? ids.map(k => {
      const F = FACTIONS[k], r = Math.round(rel(k)), war = JH.warOf(k), dead = !JH.isAlive(k), [rc] = relWord(r);
      const acts = dead ? '' : [this.actBtn('gift', k, { cls: 'sm' }), this.actBtn('envoy', k, { cls: 'sm' }), FX_TRADE.includes(c) ? this.actBtn('trade', k, { cls: 'sm' }) : ''].join('');
      const stat = dead ? '<span class="st danger">멸문</span>' : `<span class="fx-r ${rc}">관계 ${signed(r)}</span> · 힘 ${JH.power(k)}${S.jh.trade[k] > dayOf() ? ' · 교역 중' : ''}`;
      return `<div class="fx-row${dead ? ' dead' : ''}${this.flashOn(k) ? ' flash' : ''}" data-fcard="${k}">
        ${crestHTML(k, 'sm')}
        <div class="fx-id"><b>${F.name}</b><small>${stat}${war ? ` · <span class="fx-warn">${escapeHtml(war.name)}</span>` : ''}</small></div>
        <div class="fx-row-acts">${acts}</div></div>`;
    }).join('') : '';
    return `<div class="fx-camp${open ? ' open' : ''}" style="--fc:${C.color}">
      <div class="fx-camp-top" data-act="fx-camp" data-c="${c}" role="button" tabindex="0" aria-expanded="${open}">
        <span class="fx-seal" style="background:${C.color}" data-tip-title="${C.seal}">${C.seal}</span>
        <div class="fx-id"><b>${C.name}</b><small>(${hj(C.hanja)}) · ${ids.length}곳 · 힘 ${sum}</small></div>
        ${wars ? `<span class="st war">전쟁 ${wars}</span>` : ''}
        <span class="fx-caret" aria-hidden="true"></span>
      </div>${open ? `<div class="fx-rows">${rows}</div>` : ''}</div>`;
  },

  // 의뢰 탭: 열린 의뢰(사람 고르기·성공 확률·남는 무력), 다녀오는 중인 의뢰, 지난 결과
  questTabHTML(allow) {
    const jh = S.jh, fx = this.fx;
    const open = jh.quests.filter(q => q.state === 'open'), away = jh.quests.filter(q => q.state === 'away');
    const cap = JH.partyCap();
    const pool = S.villagers.filter(v => JH.canSend(v)).sort((a, b) => b.martial - a.martial);
    // 고른 사람 가운데 지금 보낼 수 없는 이는 뺀다 (다쳤거나 다른 의뢰로 떠났다)
    for (const qid in fx.party) fx.party[qid] = fx.party[qid].filter(id => pool.some(v => v.id === id));
    const busy = Events.raidPending() || !!S.occupation;
    const why = ids => !allow ? '아직 강호의 일에 나설 때가 아니다'
      : busy ? '습격이 다가오는 동안에는 사람을 내보낼 수 없다'
      : away.length >= cap ? `지금은 한 번에 ${['한', '두', '세'][cap - 1]} 무리까지만 내보낼 수 있다`
      : !ids.length ? '보낼 사람을 고르시오 (하나에서 넷까지)' : '';
    const lead = allow ? `세력들이 맡긴 일이다. 무사나 객경을 하나에서 넷까지 골라 보낸다. 한 번에 내보낼 수 있는 무리는 ${['하나', '둘', '셋'][cap - 1]}, 지금 나간 무리는 ${away.length ? FX_NUM[away.length] : '없다'}.`
      : '아직 강호의 일에 나설 때가 아니다. 마을의 기틀이 잡히면 이웃 세력들이 일을 맡기러 온다.';
    const openCards = open.map(q => {
      const F = FACTIONS[q.fid], ids = fx.party[q.id] || [];
      const info = JH.dispatchInfo(q.id, ids);
      const per = q.need.martial / Math.max(1, q.need.n);
      const left = q.expires - dayOf();
      const risk = q.risk < 0.2 ? ['neutral', '위험 낮음'] : q.risk < 0.35 ? ['warn', '위험 보통'] : ['danger', '위험 높음'];
      const picks = pool.length ? pool.map(v => {
        const on = ids.includes(v.id);
        return `<button type="button" class="fx-pick${on ? ' on' : ''}" data-act="fx-pick" data-q="${q.id}" data-v="${v.id}" aria-pressed="${on}">${escapeHtml(v.name)}<small>${v.hero ? '객경 · ' : ''}${realmOf(v.martial)} ${v.martial.toFixed(1)}</small></button>`;
      }).join('') : '<p class="fx-note">보낼 사람이 없다. 무관에서 무사를 기르거나 객경을 모시라.</p>';
      const p = Math.round(info.p * 100), pc = p >= 70 ? 'good' : p >= 45 ? 'warn' : 'bad';
      const t = info.threat;
      const threat = t ? ` · 가장 센 위협: ${FACTIONS[t.id].name} ${t.pct != null ? t.pct + '%' : t.word}, 쳐들어오면 약&nbsp;${t.n}명` : '';
      const live = ids.length ? `<b class="fx-p ${pc}">성공 ${p}%</b> · 남는 무력 ${info.spare}${threat}`
        : `남는 무력 ${info.spare}${threat}`;
      const w = why(ids);
      return `<div class="fx-q" style="--fc:${F.color}">
        <div class="fx-q-top">${crestHTML(q.fid, 'sm')}<div class="fx-id"><b>${escapeHtml(q.title)}</b><small>${F.name} · ${FX_QKIND[q.kind] || '의뢰'} · ${FX_DAYS[q.days] || q.days + '일'} 길 · 기한 ${left}일</small></div><span class="st ${risk[0]}" data-tip-title="위험" data-tip="실패하면 다칠 수 있고, 드물게 돌아오지 못한다. 객경은 죽지 않는다.">${risk[1]}</span></div>
        <p class="fac-desc">${escapeHtml(q.text)}</p>
        <p class="fx-note">권하는 사람: ${realmOf(per)} ${FX_NUM[q.need.n] || q.need.n + '명'} · 보상: 은자 ${q.reward.silver} · 명성 ${q.reward.fame} · 관계 +${q.reward.rel}</p>
        <div class="fx-picks">${picks}</div>
        <div class="fx-q-foot"><div class="fx-live">${live}</div>
          <button type="button" class="btn fx-send" data-act="fx-send" data-q="${q.id}"${w ? ` aria-disabled="true" data-why="${escapeHtml(w)}" data-tip-title="보낸다" data-tip="${escapeHtml(w)}"` : ''}>보낸다${ids.length ? `<small>${FX_NUM[ids.length]}</small>` : ''}</button></div></div>`;
    }).join('');
    const awayCards = away.map(q => {
      const F = FACTIONS[q.fid];
      const who = q.party.map(id => S.villagers.find(v => v.id === id)).filter(v => v && !v.dead).map(v => escapeHtml(v.name)).join(', ');
      const sure = fx.confirm === `recall:${q.id}`;
      const btn = q.recalled ? '<span class="st neutral">불러들이는 중</span>'
        : `<button type="button" class="btn danger fx-send" data-act="fx-recall" data-q="${q.id}" data-tip-title="불러들이기" data-tip="반나절 뒤 돌아온다. 의뢰는 실패로 끝나고 관계 −3.">${sure ? '정말 부른다' : '불러들이기'}</button>`;
      return `<div class="fx-q away" style="--fc:${F.color}">
        <div class="fx-q-top">${crestHTML(q.fid, 'sm')}<div class="fx-id"><b>${escapeHtml(q.title)}</b><small>${F.name} · ${FX_QKIND[q.kind] || '의뢰'} · 돌아오기까지 ${remainText(q.back - S.time)}</small></div></div>
        <div class="fx-q-foot"><div class="fx-live">떠난 이: ${who || '없음'}${q.p !== undefined ? ` · 떠날 때 성공 ${Math.round(q.p * 100)}%` : ''}</div>${btn}</div></div>`;
    }).join('');
    const log = jh.qlog.map(q => {
      const [c, w] = q.void ? ['neutral', '헛걸음'] : q.recalled ? ['neutral', '불러들임'] : q.ok ? ['friendly', '해냄'] : ['hostile', '실패'];
      return `<li><time>${dayText(q.done !== undefined ? q.done : dayOf())}</time>${crestHTML(q.fid, 'xs')}<span class="fx-lt">${escapeHtml(q.title)}${q.ok ? `<small>은자 +${q.reward.silver} · 명성 +${q.reward.fame} · 관계 +${q.reward.rel}</small>` : ''}</span><span class="st ${c}">${w}</span></li>`;
    }).join('');
    return `<p class="lead fx-lead">${lead}</p>
      ${away.length ? `<h3 class="fx-h3">다녀오는 중<small>${away.length}</small></h3><div class="fx-list">${awayCards}</div>` : ''}
      <h3 class="fx-h3">맡을 수 있는 의뢰<small>${open.length} / ${JH.questCap()}</small></h3>
      ${open.length ? `<div class="fx-list">${openCards}</div>` : `<p class="fx-empty">${allow ? '지금은 맡길 일이 없다. 하루에 하나쯤 새 의뢰가 붙는다. 객잔과 표국이 있으면 더 많이, 먼 세력의 일도 들어온다.' : '강호가 열리면 이웃 세력들이 일을 맡긴다.'}</p>`}
      ${log ? `<h3 class="fx-h3">지난 의뢰</h3><ul class="fx-log">${log}</ul>` : ''}`;
  },

  // 소식 탭: 지금의 전쟁과 S.jh.news
  newsTabHTML(allow) {
    const jh = S.jh;
    const goto = id => FACTIONS[id] ? `<button type="button" class="fx-cbtn" data-act="fx-goto" data-f="${id}" aria-label="${FACTIONS[id].name} 카드로">${crestHTML(id, 'xs')}</button>` : '';
    const wars = jh.wars.map(w => {
      const nm = s => w[s].map(x => FACTIONS[x].name).join('·');
      const mine = w.mine.a || w.mine.b ? ` · 영주가 보탠 몫: ${w.mine.a ? nm('a') + ' ' + signed(w.mine.a) : ''}${w.mine.a && w.mine.b ? ', ' : ''}${w.mine.b ? nm('b') + ' ' + signed(w.mine.b) : ''}` : '';
      const nearMark = w.a.concat(w.b).some(x => jh.near.includes(x)) ? '<span class="st warn">이웃</span>' : '';
      return `<div class="fx-war">
        <div class="fx-war-top"><b>${escapeHtml(w.name)}</b>${nearMark}<small>${dayOf() - w.since + 1}일째</small></div>
        <div class="fx-vs">${w.a.map(goto).join('')}<div class="fx-score" style="--a:${FACTIONS[w.a[0]].color};--b:${FACTIONS[w.b[0]].color}"><span style="width:${clamp((w.score + 10) * 5, 0, 100)}%"></span></div>${w.b.map(goto).join('')}</div>
        <p class="fx-note">${nm('a')} 대 ${nm('b')}${mine}</p></div>`;
    }).join('');
    const news = jh.news.map(n => `<li class="k-${n.kind || 'etc'}"><time>${dayText(n.day)}</time><span class="st ${n.kind === 'war' || n.kind === 'fall' ? 'war' : 'neutral'}">${FX_NEWS[n.kind] || '소식'}</span><span class="fx-lt">${escapeHtml(n.text)}</span><span class="fx-nf">${(n.f || []).slice(0, 4).map(goto).join('')}</span></li>`).join('');
    return `<p class="lead fx-lead">${allow ? '천하에서 들려오는 소식이다. 문장을 누르면 그 세력의 카드로 간다.' : '아직 강호의 소식이 닿지 않는다. 마을의 기틀이 잡히면 천하의 일이 들려온다.'}</p>
      ${wars ? `<h3 class="fx-h3">지금의 전쟁<small>${jh.wars.length}</small></h3><div class="fx-list">${wars}</div>` : ''}
      <h3 class="fx-h3">소식</h3>${news ? `<ul class="fx-log fx-news">${news}</ul>` : '<p class="fx-empty">들려온 소식이 없다.</p>'}`;
  },
  villageHTML() {
    const pop = popCount();
    const vs = livingVillagers();
    const roles = {};
    for (const v of vs) { const k = v.hero ? '객경' : v.jobType ? JOB_NAME[v.jobType] : '무직'; roles[k] = (roles[k] || 0) + 1; }
    const factors = happinessFactors();
    const flow = S.lastFlow || {};
    const stat = (label, val) => `<div class="stat"><small>${label}</small><b>${val}</b></div>`;
    return `<h2>${escapeHtml(S.name)} 현황</h2><p class="lead">${tipParen(RANKS[S.rank].name)} · ${dateText()} · ${this.goalText()}</p>
      <div class="stat-grid">
        ${stat('인구', `${pop} / ${housingTotal()}`)}${stat('민심', Math.round(S.happy))}${stat('무력', defensePower())}${stat('명성', fmt(S.fame))}
        ${stat('습격 격퇴', S.stats.raidsWon)}${stat('약탈·함락', S.stats.raidsLost)}${stat('잃은 사람', S.stats.died)}${stat('최대 인구', S.stats.maxPop)}
      </div>
      <h3>세율</h3>
      <div class="seg" role="group" aria-label="세율">
        ${['낮게 (민심 +8)', '보통', '높게 (민심 -12)'].map((t, i) => `<button type="button" data-act="tax" data-tax="${i}" class="${S.tax === i ? 'on' : ''}">${t}</button>`).join('')}
      </div>
      <p style="color:var(--muted);font-size:13px">매일 아침 인구와 민심에 따라 세금이 들어온다.</p>
      <h3>민심을 움직이는 것</h3>
      <ul class="factor-list">${factors.map(([k, v]) => `<li>${k}</li><li class="${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : ''}${Math.round(v)}</li>`).join('')}</ul>
      <h3>어제 거둔 것</h3>
      <ul class="factor-list">${['silver', 'food', 'wood', 'stone', 'weapons'].map(k => `<li>${RESOURCES[k].name}</li><li class="pos">+${fmt(flow[k] || 0)}</li>`).join('')}
        <li>식량 소비</li><li class="neg">-${Math.round(pop * 2)}</li></ul>
      <h3>사람들</h3>
      <ul class="factor-list">${Object.entries(roles).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<li>${k}</li><li class="pos" style="color:var(--text)">${n}명</li>`).join('')}</ul>`;
  },
  helpHTML() {
    return `<h2>영주의 길잡이</h2><p class="lead">마을 사람들은 스스로 일하고, 먹고, 잠든다. 영주는 무엇을 지을지, 누구와 손잡을지를 정한다.</p>
      <h3>목표</h3>
      <ul>
        <li>흑풍채에 짓밟힌 마을을 다시 일으켜 <b>현성(인구 120)</b>으로 키우고, 제4장 갈림길에서 고른 길의 마지막 장을 마치면 강호에 이름을 떨친다. 길마다 결말이 다르다.</li>
        <li>왼쪽 위 <b>할 일 두루마리</b>에 지금 장(<span data-tip-title="章">章</span>)의 목표가 있다. 막히면 [힌트]나 [총관 부르기]를 누르자.</li>
        <li><b>총관</b> 윤서하가 곁에서 할 일과 까닭을 일러 준다. 화살표와 금빛 테두리가 누를 곳을 가리킨다.</li>
      </ul>
      <h3>다스리기</h3>
      <ul>
        <li><b>상소함</b>: 백성이 올린 상소를 들어주면 민심이 오르고, 물리치면 조금 내려간다. 기한을 넘겨 묵히면 크게 내려간다.</li>
        <li><b>육방</b>: 이방·호방·예방·병방·형방·공방에 하루 예산을 주면, 부서가 그 돈으로 집·논밭·망루·길을 알아서 짓고 일손과 잔치를 챙긴다. 모르겠으면 [추천 배분]을 누르자.</li>
        <li><b>마을 현황</b>에서 민심을 움직이는 까닭과 세율을 볼 수 있다.</li>
        <li>한자에 커서를 올리면(휴대폰은 길게 누르면) 뜻풀이가 뜬다. 지도 위 건물·사람에 커서를 잠시 멈춰도 이름과 풀이가 뜬다.</li>
      </ul>
      <h3>마을 키우기</h3>
      <ul>
        <li><b>집</b>이 비어 있고 <b>식량</b>이 넉넉하고 <b>민심</b>이 42 이상이면 사람들이 찾아온다.</li>
        <li>일자리가 있는 건물을 지으면 놀고 있는 사람이 알아서 일하러 간다. 건물을 눌러 일꾼 수를 조절할 수 있다.</li>
        <li>논밭은 계절을 탄다. 가을에 가장 많이 나고 겨울에는 거의 나지 않으니 미리 쌓아두자. 어장은 계절을 덜 탄다.</li>
        <li>인구가 15·35·70·120명이 되면 마을 등급이 오르고 새 건물이 열린다.</li>
      </ul>
      <h3>마을 지키기</h3>
      <ul>
        <li><b>무관</b>에서 일하는 사람은 무사가 되어 낮에는 수련하고, 습격 때 싸운다. 오래 수련할수록 강해진다.</li>
        <li><b>망루</b>의 궁수는 다가오는 적을 쏜다. <b>목책</b>과 <b>석벽</b>은 적의 발을 묶고, <b>성문</b>으로는 마을 사람만 지나간다.</li>
        <li><b>대장간</b>에서 만든 병장기가 있으면 무사와 궁수가 더 세게 친다.</li>
        <li><b>객잔</b>을 지으면 떠돌이 고수가 찾아온다. 객경으로 모시면 혼자서 여럿을 상대한다.</li>
        <li>점령을 노리는 적에게 영주관이 무너지면 마을이 점령된다. 매일 수탈당하고 새 식구도 오지 않는다. 몸값을 치르거나, 무사를 길러 봉기하거나, 우호 세력의 도움을 받아 되찾자.</li>
      </ul>
      <h3>강호의 계열</h3>
      <ul>
        <li>천하의 세력 스물여섯은 여덟 계열로 나뉜다: 정파(${hj('正派')}) · 무림세가(${hj('武林世家')}) · 관(${hj('官')}) · 상단(${hj('商團')}) · 새외무림(${hj('塞外武林')}) · 사파(${hj('邪派')}) · 흑도(${hj('黑道')}) · 마교(${hj('魔敎')}).</li>
        <li>같은 계열끼리는 가깝고, 정파와 마교처럼 원수인 계열도 있다. 한 세력과 가까워지면 그 계열 모두와 조금 가까워지고, 원수 계열과는 멀어진다.</li>
        <li>마을 곁의 흑풍채·관부, 고을 둘레의 세력 넷, 상단 하나가 <b>이웃</b>이다. 위협을 쌓다가 쳐들어오는 것은 이웃뿐이다. 이웃이 멸문하면 열흘 뒤 다른 세력이 그 자리를 차지한다.</li>
      </ul>
      <h3>천하도</h3>
      <ul>
        <li>메뉴의 <b>[천하도]</b>(휴대폰은 [세력] 창 맨 위의 [천하도 펼치기])를 열면 천하의 판도와 전쟁, 계열마다의 힘과 그 흐름이 보인다. 보는 동안 시간은 멈춘다.</li>
        <li>문장을 누르면 그 세력의 카드가 뜨고, [세력 창에서 보기]로 그 세력의 외교 단추로 바로 간다.</li>
      </ul>
      <h3>의뢰</h3>
      <ul>
        <li>강호가 열리면 세력들이 일을 맡긴다. [세력] 단추의 붉은 수가 맡을 수 있는 의뢰다.</li>
        <li>[세력] 창의 [의뢰]에서 무사나 객경을 하나에서 넷까지 골라 <b>보낸다</b>. 성공 확률과 마을에 남는 무력이 바로 보이니, 이웃이 칼을 갈 때 마을을 비우지 말자.</li>
        <li>보낸 이들은 며칠 동안 마을을 떠나 있다. 해내면 은자·명성·관계를 얻고, 실패하면 다치거나 드물게 돌아오지 못한다. [불러들이기]로 반나절 만에 부를 수 있지만 의뢰는 실패한다.</li>
      </ul>
      <h3>외교</h3>
      <ul>
        <li>[세력] 창에서 이웃 카드를 누르면 펼쳐진다. <b>예물</b>, <b>사신</b>(관계를 높이고 위협을 누른다), <b>교역</b>(상단·새외·세가), <b>산하</b>와 <b>동맹</b>, <b>현상금</b>(흑도·사파·마교), <b>첩자</b>, 그리고 이웃이 싸우고 있으면 <b>전쟁 지원</b>과 <b>중재</b>를 할 수 있다. 쓸 수 없는 단추는 누르거나 커서를 올리면 까닭이 뜬다.</li>
        <li>산하는 매일 공물을 바치는 대신 계열의 혜택과 원군을 얻는다. 동맹은 공물 없이 혜택의 절반을 나누고, 관계 60·명성 60이 있어야 맺는다.</li>
        <li>첩자가 없으면 이웃의 위협은 <b>잠잠 · 술렁 · 칼을 간다</b>의 낱말로만 보인다. 첩자를 심으면 열흘 동안 정확한 위협과 다음 습격이 보인다.</li>
        <li>먼 세력과는 예물·사신·교역만 오간다.</li>
      </ul>
      <h3>갈림길</h3>
      <ul>
        <li>제4장 갈림길(${hj('岐路')})에서 어느 계열의 깃발 아래 설지, 홀로 설지 정한다. 이웃 계열과 관, 그리고 홀로 서는 길까지 갈래는 여덟이다.</li>
        <li>갈래마다 제5·6장의 목표와 숙적, 결말이 다르고, 그 길에서만 짓는 갈래 건물(의협당·혈제단·종가·흑시·도박장·호시·관아·연무대)이 건설 띠에 나타난다.</li>
        <li>주군을 바꾸면 갈래도 바뀐다. 바꾸는 것은 한 번까지이고, 그 뒤로는 홀로 서는 길이 된다.</li>
      </ul>
      <h3>조작</h3>
      <div class="help-keys">
        <kbd>좌클릭</kbd><span>선택 · 건설</span>
        <kbd>끌기 / 우클릭 끌기</kbd><span>지도 이동 (건설 중에는 우클릭으로)</span>
        <kbd>휠 / 두 손가락 / + −</kbd><span>확대·축소</span>
        <kbd>W A S D · 방향키</kbd><span>지도 이동</span>
        <kbd>Space</kbd><span>일시정지</span>
        <kbd>1 2 3</kbd><span>속도</span>
        <kbd>Esc · 우클릭</kbd><span>건설 취소 · 선택 해제</span>
        <kbd>건설 단추 다시 누르기</kbd><span>건설 취소 (휴대폰은 이렇게)</span>
      </div>`;
  },
  onSheetClick(e) {
    const ext = this.sheets[this.sheet];
    if (ext) { if (ext.onClick) ext.onClick(e); this.renderSheet(); return; }
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    // 못 쓰는 외교 단추: 누르면 까닭을 알린다 (폰에는 말풍선이 길게 눌러야 뜬다)
    if (t.getAttribute('aria-disabled') === 'true') { if (t.dataset.why) this.toast(t.dataset.why, 'bad'); return; }
    const a = t.dataset.act, k = t.dataset.f;
    if (a === 'tax') { S.tax = +t.dataset.tax; }
    else if (a.startsWith('fx-')) { if (this.onFxClick(t, a, k) === false) return; }
    else if (a === 'ransom') { if (payRansom()) { this.toast('점령군이 물러간다.', 'good'); } }
    else if (a === 'uprise') { if (startUprising(null)) this.closeSheet(); }
    else if (a === 'uprise-help' && S.res.silver >= 100) { S.res.silver -= 100; changeRel(k, -3); if (startUprising(k)) this.closeSheet(); }
    this.renderSheet();
  },
  // 세력 창의 단추. false 를 돌려주면 창을 다시 그리지 않는다 (창을 닫았거나 스스로 그렸다)
  onFxClick(t, a, k) {
    const fx = this.fx;
    // 되돌리기 힘든 일(주종·동맹 끊기, 불러들이기)은 두 번 눌러야 한다
    const sure = key => {
      if (fx.confirm === key) { fx.confirm = ''; return true; }
      fx.confirm = key;
      clearTimeout(this.confirmT);
      this.confirmT = setTimeout(() => { if (fx.confirm === key) fx.confirm = ''; }, 3000);
      return false;
    };
    if (a === 'fx-tab') { if (fx.tab !== t.dataset.tab) { fx.tab = t.dataset.tab; this.sheetTop = true; } }
    else if (a === 'fx-open') fx.open[k] = !fx.open[k];
    else if (a === 'fx-camp') fx.camp[t.dataset.c] = !fx.camp[t.dataset.c];
    else if (a === 'fx-goto') { this.focusFaction(k); return false; }
    else if (a === 'fx-map') {
      if (typeof WorldMap === 'undefined') return;
      this.closeSheet();
      WorldMap.open('view', k ? { focus: k } : {});
      return false;
    } else if (a === 'fx-do') {
      const kind = t.dataset.kind;
      if ((kind === 'unvassal' || kind === 'unpact') && !sure(`${kind}:${k}`)) return;
      const opts = kind === 'support' ? Object.assign({ war: t.dataset.w }, this.supAmt(`${t.dataset.w}:${k}`)) : {};
      const r = JH.act(kind, k, opts);
      // 첩자가 붙잡혀도 ok 다: 첩자가 자리 잡았는지로 가린다
      const good = r.ok && kind !== 'unvassal' && kind !== 'unpact' && (kind !== 'spy' || JH.spied(k));
      this.toast(r.ok ? r.text : r.why, good ? 'good' : r.ok ? '' : 'bad');
    } else if (a === 'fx-amt') { this.supAmt(t.dataset.key)[t.dataset.res] = +t.dataset.n; }
    else if (a === 'fx-pick') {
      const ids = fx.party[t.dataset.q] || (fx.party[t.dataset.q] = []), v = +t.dataset.v, i = ids.indexOf(v);
      if (i >= 0) ids.splice(i, 1);
      else if (ids.length >= 4) this.toast('한 무리는 넷까지다.', 'bad');
      else ids.push(v);
    } else if (a === 'fx-send') {
      const r = JH.dispatch(t.dataset.q, fx.party[t.dataset.q] || []);
      this.toast(r.ok ? r.text : r.why, r.ok ? 'good' : 'bad');
      if (r.ok) delete fx.party[t.dataset.q];
    } else if (a === 'fx-recall') {
      if (!sure(`recall:${t.dataset.q}`)) return;
      const r = JH.recall(t.dataset.q);
      this.toast(r.ok ? r.text : r.why, r.ok ? '' : 'bad');
    }
  },
  // 마을 현황의 목표 한 줄: 갈래가 정해졌으면 그 결말
  goalText() {
    const ri = hook(Story, 'routeInfo');
    if (ri && ri.title) return `${escapeHtml(this.routeName(ri))}${ri.provisional ? '(잠정)' : ''} · 마지막 장을 마치면 「${escapeHtml(ri.title)}」${pp(ri.title, '이/가')} 된다.`;
    return '현성(인구 120)으로 키우고, 갈림길에서 고른 길의 마지막 장을 마치면 강호에 이름을 떨친다.';
  },

  // ── 사건 두루마리 ──
  pumpEvents() {
    if (this.modalOpen || !S || !S.eventQueue.length || !$('title-screen').hidden) return;
    const entry = S.eventQueue[0];
    // 사건을 만들다 예외가 나면 그 사건만 버린다 (남겨 두면 매 프레임 같은 예외로 화면이 멈춘다)
    let ev = null;
    try { ev = Events.build(entry); } catch (err) { console.error(err); }
    if (!ev) { S.eventQueue.shift(); return; }
    this.modalOpen = true;
    this.modalEntry = entry;
    this.modalAt = performance.now();
    $('modal-title').textContent = ev.title;
    $('modal-stamp').textContent = ev.stamp || '事';
    const sg = glossOf(ev.stamp || '事');
    if (sg) { $('modal-stamp').dataset.tipTitle = sg.title; $('modal-stamp').dataset.tip = sg.body; }
    $('modal-text').innerHTML = ev.text;
    const box = $('modal-choices');
    box.innerHTML = '';
    ev.choices.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice';
      btn.id = 'choice-' + i;
      btn.innerHTML = `<span>${escapeHtml(c.label)}</span>${c.sub ? `<small>${escapeHtml(c.sub)}</small>` : ''}`;
      const ok = c.ok ? c.ok() : true;
      btn.disabled = !ok;
      btn.addEventListener('click', e => {
        // 두루마리가 펼쳐지는 동안(0.35초) 지도를 노린 누르기나 Enter가 선택지를 고르지 않게 받지 않는다
        if (e.isTrusted && performance.now() - this.modalAt < 400) return;
        this.resolve(c);
      });
      box.appendChild(btn);
    });
    $('modal').hidden = false;
    const first = box.querySelector('button:not(:disabled)');
    if (first) first.focus({ preventScroll: true });
  },
  resolve(choice) {
    let result = null;
    try { result = choice.run(); } catch (err) { console.error(err); }
    if (this.modalEntry && S.eventQueue[0] === this.modalEntry) S.eventQueue.shift();
    if (this.modalEntry) Bus.emit('eventResolved', this.modalEntry.id, choice.label);
    if (!result) { this.closeModal(); return; }
    $('modal-text').innerHTML = result;
    const box = $('modal-choices');
    box.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'choice primary'; btn.id = 'choice-ok';
    btn.textContent = '확인';
    btn.addEventListener('click', () => this.closeModal());
    box.appendChild(btn);
    btn.focus({ preventScroll: true });
  },
  closeModal() {
    $('modal').hidden = true;
    this.modalOpen = false;
    this.modalEntry = null;
    this.buildMenuDirty = true;
  },

  // ── 카메라 ──
  // 카메라 목표는 타일 좌표로 둔다 (main.js 루프가 투영해서 따라간다)
  focusOn(tx, ty) { this.camTarget = { tx, ty }; },
  onMinimap(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    this.camTarget = null;
    centerOnTile(fx * MW, fy * MH);
    Bus.emit('camMoved');
  },

  restart() {
    $('title-screen').hidden = false;
    $('btn-continue').hidden = !Store.get(SAVE_KEY);
    startTitleArt();
  },

  // 매 프레임 가볍게, 몇 번에 한 번 무겁게
  tick(now) {
    if (!S) return;
    this.pumpEvents();
    if (!this._t || now - this._t > 220) {
      this._t = now;
      this.updateTop();
      this.updateBanner();
      this.updatePanel();
      const held = this.sheetHold && now - this.sheetHold < 1200;   // 누르는 중이면 한 박자 쉰다
      if (this.sheet && this.sheet !== 'help' && !held && !(this.sheets[this.sheet] && this.sheets[this.sheet].live === false)) this.renderSheet();
      if (this.buildMenuDirty || this.affordKey() !== this.lastAfford) this.renderBuildItems();
      hook(Admin, 'uiTick');
      hook(Petitions, 'uiTick');
      hook(Story, 'uiTick');
    }
  },
};

function upgradeCost() {
  const a = BDEF.house2.cost, b = BDEF.house.cost;
  const c = {};
  for (const k in a) c[k] = Math.max(0, a[k] - Math.floor((b[k] || 0) * 0.5));
  return c;
}
function upgradeHouse(b) {
  const c = upgradeCost();
  if (S.rank < 1 || !canAfford(c)) return;
  pay(c);
  b.type = 'house2';
  b.maxHp = BDEF.house2.hp;
  b.done = false; b.progress = BDEF.house2.time * 0.4; b.hp = b.maxHp * 0.5;
  markDirty();
  UI.toast('기와를 올리기 시작했다.', 'good');
}

// ── 첫 화면: 먹으로 그린 산수화 ─────────────
let titleAnim = 0;
function startTitleArt() {
  const cv = $('title-bg');
  const c = cv.getContext('2d');
  const draw = t => {
    if ($('title-screen').hidden) { titleAnim = 0; return; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#efe6d2'); g.addColorStop(1, '#ddd0b4');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // 붉은 해
    c.fillStyle = 'rgba(181,51,42,0.85)';
    c.beginPath(); c.arc(w * 0.78, h * 0.26, Math.min(w, h) * 0.075, 0, Math.PI * 2); c.fill();
    const layers = [
      { y: 0.46, amp: 0.2, col: 'rgba(60,52,46,0.18)', seed: 1.3, f: 2.2 },
      { y: 0.56, amp: 0.22, col: 'rgba(48,42,38,0.32)', seed: 4.1, f: 1.7 },
      { y: 0.7, amp: 0.18, col: 'rgba(36,31,28,0.55)', seed: 7.7, f: 2.6 },
      { y: 0.84, amp: 0.12, col: 'rgba(28,24,22,0.85)', seed: 2.9, f: 3.4 },
    ];
    layers.forEach((L, li) => {
      c.fillStyle = L.col;
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) {
        const u = x / w;
        const n = Math.sin(u * L.f * 3 + L.seed) * 0.5 + Math.sin(u * L.f * 7.3 + L.seed * 2) * 0.25 + Math.sin(u * L.f * 13 + L.seed * 3) * 0.12;
        const peak = Math.pow(Math.max(0, n + 0.4), 1.6);
        c.lineTo(x, h * (L.y - peak * L.amp));
      }
      c.lineTo(w, h); c.closePath(); c.fill();
      // 안개
      const mg = c.createLinearGradient(0, h * (L.y - 0.02), 0, h * (L.y + 0.08));
      mg.addColorStop(0, 'rgba(239,230,210,0)'); mg.addColorStop(0.5, `rgba(239,230,210,${0.35 + li * 0.05})`); mg.addColorStop(1, 'rgba(239,230,210,0)');
      c.fillStyle = mg;
      const drift = Math.sin(t / 4000 + li) * 30;
      c.fillRect(drift - 40, h * (L.y - 0.02), w + 80, h * 0.1);
    });
    // 기러기
    c.strokeStyle = 'rgba(30,26,22,0.7)'; c.lineWidth = 1.3;
    for (let i = 0; i < 5; i++) {
      const bx = ((t / 60 + i * 26) % (w + 200)) - 100 + w * 0.2, by = h * 0.18 + i * 9 + Math.sin(t / 500 + i) * 3;
      c.beginPath(); c.moveTo(bx - 6, by - 3); c.quadraticCurveTo(bx - 2, by - 4, bx, by); c.quadraticCurveTo(bx + 2, by - 4, bx + 6, by - 3); c.stroke();
    }
    titleAnim = requestAnimationFrame(draw);
  };
  if (!titleAnim) titleAnim = requestAnimationFrame(draw);
}
