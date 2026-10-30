'use strict';
// ───────────────────────────────────────────────
// 풀이 말풍선
// 1) data-tip / data-tip-title 이 붙은 요소에 커서를 올리면(터치는 길게 누르면) 풀이가 뜬다.
// 2) 지도 위 건물·사람에 커서를 잠시 멈추면 이름과 한자 풀이가 뜬다.
// ───────────────────────────────────────────────
const SIGN_OF = { manor: '領主館', inn: '客棧', escort: '鏢局', dojo: '武館', market: '市', clinic: '藥' };

const Tips = {
  el: null, cur: null, mapTimer: 0, mapAt: null, pressTimer: 0, touchShown: false,

  init() {
    this.el = document.getElementById('tooltip');
    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const t = e.target.closest && e.target.closest('[data-tip],[data-tip-title]');
      if (t && t !== this.cur) this.showFor(t);
    });
    document.addEventListener('pointerout', e => {
      if (!this.cur) return;
      const to = e.relatedTarget;
      if (!to || !this.cur.contains(to)) this.hide();
    });
    // 터치: 길게 누르면 풀이
    document.addEventListener('pointerdown', e => {
      if (this.touchShown) { this.hide(); this.touchShown = false; }
      if (e.pointerType !== 'touch') return;
      const t = e.target.closest && e.target.closest('[data-tip],[data-tip-title]');
      if (!t) return;
      clearTimeout(this.pressTimer);
      this.pressTimer = setTimeout(() => { this.showFor(t); this.touchShown = true; }, 450);
    }, true);
    const cancel = () => clearTimeout(this.pressTimer);
    document.addEventListener('pointerup', cancel, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('[data-tip],[data-tip-title]') && e.pointerType !== 'mouse') e.preventDefault(); });

    // 지도 위 풀이
    const cv = document.getElementById('game');
    cv.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' || e.buttons) { this.hideMap(); return; }
      if (this.mapAt && Math.hypot(e.clientX - this.mapAt.x, e.clientY - this.mapAt.y) < 4) return;
      this.hideMap();
      this.mapAt = { x: e.clientX, y: e.clientY };
      clearTimeout(this.mapTimer);
      this.mapTimer = setTimeout(() => this.showMap(e.clientX, e.clientY), 380);
    });
    cv.addEventListener('pointerleave', () => { clearTimeout(this.mapTimer); this.hideMap(); });
    cv.addEventListener('pointerdown', () => { clearTimeout(this.mapTimer); this.hideMap(); });
  },

  render(title, body) {
    const lines = String(body || '').split('\n').filter(Boolean).map(l => `<p>${escapeHtml(l)}</p>`).join('');
    this.el.innerHTML = (title ? `<h4>${escapeHtml(title)}</h4>` : '') + lines;
    this.el.hidden = false;
  },
  place(x, y, below) {
    const tw = this.el.offsetWidth, th = this.el.offsetHeight;
    let left = clamp(x - tw / 2, 8, window.innerWidth - tw - 8);
    let top = below ? y + 12 : y - th - 10;
    if (top < 8) top = y + 14;
    if (top + th > window.innerHeight - 8) top = Math.max(8, y - th - 10);
    this.el.style.left = left + 'px';
    this.el.style.top = top + 'px';
  },
  showFor(t) {
    let title = t.dataset.tipTitle || '';
    let body = t.dataset.tip || '';
    if (!body && title) { const g = glossOf(title); if (g) { title = g.title; body = g.body; } }
    if (!title && !body) return;
    this.cur = t;
    this.render(title, body);
    const r = t.getBoundingClientRect();
    const below = r.top < 140;
    this.place(r.left + r.width / 2, below ? r.bottom : r.top, below);
  },
  hide() { this.cur = null; if (!this.mapShown) this.el.hidden = true; },

  showMap(sx, sy) {
    if (!S || !document.getElementById('title-screen').hidden || UI.modalOpen || UI.tool || this.cur) return;
    const hit = pickAt(sx, sy);
    if (!hit) return;
    const info = hit.u ? this.unitInfo(hit.u) : this.buildingInfo(hit.b);
    if (!info) return;
    this.mapShown = true;
    this.render(info.title, info.body);
    this.place(sx, sy, false);
  },
  hideMap() { if (this.mapShown) { this.mapShown = false; if (!this.cur) this.el.hidden = true; } },

  buildingInfo(b) {
    const def = BDEF[b.type];
    const lines = [];
    const g = HANJA_GLOSS[def.hanja];
    if (g) lines.push(`${def.hanja} (${g[0]})`);
    const sign = SIGN_OF[b.type];
    if (sign) { const sg = glossOf(sign); if (sg) lines.push(`현판 ${sign}: ${HANJA_GLOSS[sign] ? HANJA_GLOSS[sign][1] : sg.body}`); }
    // 지붕 위 깃발의 글자: 객잔의 술 깃발, 영주관 깃발(마을 등급·주군·점령군)
    const up = b.done && !b.ruined;
    if (b.type === 'inn' && up && HANJA_GLOSS['酒']) lines.push(`酒 (${HANJA_GLOSS['酒'][0]}): ${HANJA_GLOSS['酒'][1]}`);
    if (b.type === 'manor' && up) {
      const f = manorFlagOf(), fg = HANJA_GLOSS[f.ch];
      const why = f.k ? `${FACTIONS[f.k].name} ${f.occupied ? '점령군의 깃발' : '산하 마을의 깃발'}` : (fg ? fg[1] : RANKS[S.rank].name);
      lines.push(`깃발 ${f.ch}${fg ? ` (${fg[0]})` : ''}: ${why}`);
    }
    if (b.ruined) lines.push('폐허 — 눌러서 다시 지을 수 있다');
    else if (!b.done) lines.push(`공사 중 ${Math.floor(b.progress / def.time * 100)}%`);
    else {
      if (def.workers) lines.push(`일꾼 ${(b._workers || []).length} / ${b.want}`);
      if (def.housing) lines.push(`사는 사람 ${(b._residents || []).length} / ${def.housing}`);
      if (!b.active) lines.push('가동 중지');
    }
    if (b.hp < b.maxHp && b.done) lines.push(`내구도 ${Math.ceil(b.hp)} / ${b.maxHp}`);
    return { title: def.name, body: lines.join('\n') };
  },
  unitInfo(u) {
    if (u.kind === 'v') {
      const role = u.hero ? `${u.hero.title} · 객경` : u.jobType ? JOB_NAME[u.jobType] : '무직';
      let doing = u.down ? '쓰러져 있다' : u.act === 'work' ? (WORK_TEXT[u.jobType] || '일하는 중') : (ACT_TEXT[u.act] || '');
      const lines = [`${role} · ${u.age}세`, doing];
      if (u.role === 'guard' || u.hero) lines.push(`무공 ${realmOf(u.martial)}`);
      if (u.petition) lines.push('상소를 올리고 처결을 기다리는 중');
      return { title: u.hero ? `${u.hero.epithet} ${u.name}` : u.name, body: lines.filter(Boolean).join('\n') };
    }
    const F = FACTIONS[u.faction];
    return { title: u.leader ? u.title : u.name, body: `${F.name} ${u.kind === 'e' ? (u.garrison ? '점령군' : '침입자') : '원군'}\n기력 ${Math.ceil(Math.max(0, u.hp))} / ${u.maxHp}` };
  },
};
