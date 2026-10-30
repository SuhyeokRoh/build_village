'use strict';
// ───────────────────────────────────────────────
// 화면 위의 모든 것: 상단 띠, 건설 메뉴, 선택 정보, 세력·현황 창, 사건 두루마리
// ───────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ACT_TEXT = {
  sleep: '집에서 자는 중', shelter: '몸을 피하는 중', build: '공사를 돕는 중', idle: '한가로이 거니는 중',
  leisure: '저녁 마실 중', patrol: '횃불을 들고 야경을 도는 중', fight: '적과 싸우는 중', leave: '마을을 떠나는 중',
  arrive: '마을로 오는 중', hero: '소일하며 마을을 지켜보는 중',
};
const WORK_TEXT = {
  farm: '논밭을 가는 중', fishery: '고기를 잡는 중', lumber: '나무를 베는 중', quarry: '돌을 캐는 중', smithy: '쇠를 두드리는 중',
  market: '장사하는 중', inn: '객잔 일을 보는 중', escort: '표물을 지키는 중', clinic: '환자를 돌보는 중', dojo: '무공을 수련하는 중', tower: '망루에서 망을 보는 중',
};
const JOB_NAME = {
  farm: '농부', fishery: '어부', lumber: '나무꾼', quarry: '석공', smithy: '대장장이', market: '장사꾼', inn: '점소이',
  escort: '표사', clinic: '의원', dojo: '무사', tower: '궁수',
};

const UI = {
  sel: null, tool: null, hover: null, dragTiles: null, cat: 'home',
  modalOpen: false, modalEntry: null, buildMenuDirty: true, lastPanel: '', lastTop: '', sheet: null,
  camTarget: null,

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
  },
  setSpeed(s) { if (!S) return; S.speed = s; this.updateTop(); },

  // ── 습격·점령 띠 ──
  updateBanner() {
    const el = $('banner');
    let html = '', cls = '';
    if (S.raid) {
      const r = S.raid, F = FACTIONS[r.faction];
      const alive = S.enemies.filter(e => !e.dead && (!e.garrison || r.goal === 'uprising')).length + r.toSpawn;
      const def = fighters().length + S.allies.filter(a => !a.dead).length;
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
      else if (S.raid) this.focusOn(S.raid.exit.x, S.raid.exit.y);
    } else if (a === 'open-factions') this.openSheet('factions');
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
    const items = S.log.slice().reverse().slice(0, 80).map(l => {
      const d = Math.floor(l.t / 24);
      const when = `${SEASONS[Math.floor(d / DAYS_PER_SEASON) % 4]} ${d % DAYS_PER_SEASON + 1}일`;
      return `<li class="${l.kind}"><time>${when}</time>${escapeHtml(l.text)}</li>`;
    });
    $('log-list').innerHTML = items.join('');
  },

  // ── 건설 메뉴 ──
  renderTabs() {
    $('build-tabs').innerHTML = BUILD_CATS.map(c => `<button type="button" role="tab" data-cat="${c.id}" class="${c.id === this.cat ? 'on' : ''}">${c.name}</button>`).join('');
    $('build-tabs').onclick = e => { const c = e.target.dataset.cat; if (c) { this.cat = c; this.renderTabs(); this.buildMenuDirty = true; } };
  },
  renderBuildItems() {
    const keys = this.cat === 'tools' ? ['road', 'clear', 'demolish'] : BUILD_ORDER.filter(k => BDEF[k].cat === this.cat);
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
  affordKey() { return [S.rank, Math.floor(S.res.silver / 5), Math.floor(S.res.wood / 3), Math.floor(S.res.stone / 3)].join(','); },
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
    if (!this.tool) { hint.hidden = true; return; }
    const name = (BDEF[k] || TOOLS[k]).name;
    const how = this.tool.kind === 'road' || this.tool.kind === 'line' ? '끌어서 잇기' : this.tool.kind === 'build' ? '눌러서 놓기' : '눌러서 실행';
    hint.textContent = `${name} · ${how} · 우클릭이나 Esc로 취소`;
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
      let doing = u.down ? '쓰러져 있다' : u.act === 'work' ? (WORK_TEXT[u.jobType] || '일하는 중') : (ACT_TEXT[u.act] || '');
      if (u.act === 'sleep' && !u.inside) doing = '잠자리로 가는 중';
      rows.push(['하는 일', doing]);
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
    this.renderSheet();
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
    if (body.dataset.h !== html) { body.innerHTML = html; body.dataset.h = html; }
  },
  factionsHTML() {
    let occ = '';
    if (S.occupation) {
      const k = S.occupation.faction, F = FACTIONS[k];
      const c = ransomCost();
      const helpers = FACTION_ORDER.filter(m => m !== k && FACTIONS[m].military && rel(m) >= 30);
      occ = `<div class="fac" style="border-color:#a678c0;margin-bottom:14px">
        <div class="fac-top"><div class="fac-crest" style="background:${F.color}">${F.hanja}</div><div><div class="fac-name">${F.name}에게 점령당함</div><div class="fac-type">${dayOf() - S.occupation.since}일째 · 점령군 ${S.enemies.filter(e => e.garrison && !e.dead).length}명</div></div></div>
        <p class="fac-desc">무사 ${fighters().length}명이 마을에 남아 있다. 점령군보다 강해졌을 때 봉기하라.</p>
        <div class="fac-actions">
          <button type="button" class="btn" data-act="ransom" ${S.res.silver >= c ? '' : 'disabled'}>몸값을 치른다 (은자 ${c})</button>
          <button type="button" class="btn" data-act="uprise" ${fighters().some(v => v.jobType !== 'tower') && !S.raid ? '' : 'disabled'}>봉기한다</button>
          ${helpers.map(m => `<button type="button" class="btn" data-act="uprise-help" data-f="${m}" ${S.res.silver >= 100 && !S.raid ? '' : 'disabled'}>${FACTIONS[m].name}의 도움으로 봉기 (은자 100)</button>`).join('')}
        </div></div>`;
    }
    const cards = FACTION_ORDER.map(k => {
      const F = FACTIONS[k], f = S.factions[k];
      const r = Math.round(f.rel);
      const chips = [];
      if (S.vassal === k) chips.push('<span class="st lord">주군</span>');
      if (S.occupation && S.occupation.faction === k) chips.push('<span class="st danger">점령</span>');
      chips.push(r <= -40 ? '<span class="st hostile">적대</span>' : r < -10 ? '<span class="st hostile">냉랭</span>' : r < 25 ? '<span class="st neutral">중립</span>' : '<span class="st friendly">우호</span>');
      if (F.military && S.vassal !== k) {
        const th = Math.round(f.threat);
        if (k === 'heukpung' || r < -20) chips.push(`<span class="st ${th > 60 ? 'danger' : 'neutral'}">위협 ${th}%</span>`);
      }
      const acts = [];
      const giftDone = S.flags['gift_' + k] === dayOf();
      acts.push(`<button type="button" class="btn" data-act="gift" data-f="${k}" ${S.res.silver >= 50 && !giftDone ? '' : 'disabled'}>${giftDone ? '오늘은 보냈다' : '예물 보내기 (은자 50)'}</button>`);
      if (!F.noLord && S.vassal !== k) {
        const can = r >= 40 && !(S.occupation && S.occupation.faction === k);
        acts.push(`<button type="button" class="btn" data-act="vassal" data-f="${k}" ${can ? '' : 'disabled'} title="관계 40 이상이면 산하로 들어갈 수 있다">산하에 든다${can ? '' : ' (관계 40↑)'}</button>`);
      }
      if (S.vassal === k) acts.push(`<button type="button" class="btn danger" data-act="break" data-f="${k}">${UI.confirmBreak ? '정말 끊는다' : '주종 관계를 끊는다'}</button>`);
      const perk = F.perk ? `<p class="fac-desc" style="color:var(--muted)">산하가 되면: ${F.perk}${S.vassal === k ? ` · 매일 공물 은자 ${Math.round(4 + popCount() * 0.25)}냥` : ''}</p>` : '';
      return `<div class="fac">
        <div class="fac-top"><div class="fac-crest" style="background:${F.color}" data-tip-title="${F.hanja} · ${HANJA_GLOSS[F.hanja] ? HANJA_GLOSS[F.hanja][0] : ''}" data-tip="${F.name}의 문장">${F.hanja}</div><div style="min-width:0"><div class="fac-name">${F.name}</div><div class="fac-type">${F.type}</div></div><div style="margin-left:auto;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${chips.join('')}</div></div>
        <p class="fac-desc">${F.desc}</p>
        <div class="rel"><div class="rel-track"><span style="left:${(r + 100) / 2}%"></span></div><span>${r > 0 ? '+' : ''}${r}</span></div>
        ${perk}
        <div class="fac-actions">${acts.join('')}</div></div>`;
    }).join('');
    return `<h2>강호의 세력</h2><p class="lead">관계가 -20 아래로 떨어진 세력은 위협을 쌓다가 마을을 습격한다. 흑풍채는 언제나 마을의 재물을 노린다.</p>${occ}<div class="fac-grid">${cards}</div>`;
  },
  villageHTML() {
    const pop = popCount();
    const vs = livingVillagers();
    const roles = {};
    for (const v of vs) { const k = v.hero ? '객경' : v.jobType ? JOB_NAME[v.jobType] : '무직'; roles[k] = (roles[k] || 0) + 1; }
    const factors = happinessFactors();
    const flow = S.lastFlow || {};
    const stat = (label, val) => `<div class="stat"><small>${label}</small><b>${val}</b></div>`;
    return `<h2>${escapeHtml(S.name)} 현황</h2><p class="lead">${RANKS[S.rank].name} · ${dateText()} · 현성(인구 120)과 명성 400을 이루면 강호에 이름을 떨친다.</p>
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
        <li>흑풍채에 짓밟힌 마을을 다시 일으켜 <b>현성(인구 120)</b>으로 키우고 <b>명성 400</b>을 떨치면 <b>천하제일촌</b>이 된다.</li>
        <li>왼쪽 위 <b>할 일 두루마리</b>에 지금 장(章)의 목표가 있다. 막히면 [힌트]나 [총관 부르기]를 누르자.</li>
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
        <li>인구가 15, 35, 70, 120을 넘으면 마을 등급이 오르고 새 건물이 열린다.</li>
      </ul>
      <h3>마을 지키기</h3>
      <ul>
        <li><b>무관</b>에서 일하는 사람은 무사가 되어 낮에는 수련하고, 습격 때 싸운다. 오래 수련할수록 강해진다.</li>
        <li><b>망루</b>의 궁수는 다가오는 적을 쏜다. <b>목책</b>과 <b>석벽</b>은 적의 발을 묶고, <b>성문</b>으로는 마을 사람만 지나간다.</li>
        <li><b>대장간</b>에서 만든 병장기가 있으면 무사와 궁수가 더 세게 친다.</li>
        <li><b>객잔</b>을 지으면 떠돌이 고수가 찾아온다. 객경으로 모시면 혼자서 여럿을 상대한다.</li>
        <li>점령을 노리는 적에게 영주관이 무너지면 마을이 점령된다. 매일 수탈당하고 새 식구도 오지 않는다. 몸값을 치르거나, 무사를 길러 봉기하거나, 우호 세력의 도움을 받아 되찾자.</li>
      </ul>
      <h3>세력</h3>
      <ul>
        <li>관계가 40 이상인 세력의 산하로 들어갈 수 있다. 매일 공물을 바치는 대신 습격 때 원군을 보내준다.</li>
        <li>한 세력과 가까워지면 그 원수와는 멀어진다. 정파와 마교는 함께할 수 없다.</li>
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
      </div>`;
  },
  onSheetClick(e) {
    const ext = this.sheets[this.sheet];
    if (ext) { if (ext.onClick) ext.onClick(e); this.renderSheet(); return; }
    const t = e.target.closest('[data-act]');
    if (!t || t.disabled) return;
    const a = t.dataset.act, k = t.dataset.f;
    if (a === 'tax') { S.tax = +t.dataset.tax; }
    else if (a === 'gift' && S.res.silver >= 50) { S.res.silver -= 50; changeRel(k, 6); S.flags['gift_' + k] = dayOf(); this.toast(`${FACTIONS[k].name}에 예물을 보냈다.`, 'good'); }
    else if (a === 'vassal') { becomeVassal(k); this.toast(`${FACTIONS[k].name}의 산하에 들었다.`, 'good'); }
    else if (a === 'break') {
      if (UI.confirmBreak) { UI.confirmBreak = false; breakVassal(false); }
      else { UI.confirmBreak = true; setTimeout(() => { UI.confirmBreak = false; }, 3000); }
    } else if (a === 'ransom') { if (payRansom()) { this.toast('점령군이 물러간다.', 'good'); } }
    else if (a === 'uprise') { if (startUprising(null)) this.closeSheet(); }
    else if (a === 'uprise-help' && S.res.silver >= 100) { S.res.silver -= 100; changeRel(k, -3); if (startUprising(k)) this.closeSheet(); }
    this.renderSheet();
  },

  // ── 사건 두루마리 ──
  pumpEvents() {
    if (this.modalOpen || !S || !S.eventQueue.length || !$('title-screen').hidden) return;
    const entry = S.eventQueue[0];
    const ev = Events.build(entry);
    if (!ev) { S.eventQueue.shift(); return; }
    this.modalOpen = true;
    this.modalEntry = entry;
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
      btn.addEventListener('click', () => this.resolve(c));
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
      if (this.sheet && this.sheet !== 'help' && !(this.sheets[this.sheet] && this.sheets[this.sheet].live === false)) this.renderSheet();
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
