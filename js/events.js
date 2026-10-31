'use strict';
// ───────────────────────────────────────────────
// 사건: 강호의 일들이 마을을 찾아온다
// 각 사건은 tier(이야기가 장마다 거르는 무게: light·hostile·heavy·gloomy), cond(조건), weight(빈도. 수나 함수),
// cd(재발 대기 일수), init(자료 준비. false 면 사건을 버린다. 불러온 뒤 다시 불리므로 같은 data 로 두 번 불러도 같아야 한다),
// text(본문), choices(선택지: label, sub, ok(가능 여부), run(결과 문장 반환))
// 강호 사건(jh)은 JH.allowJianghu() 뒤에만 나온다. camp(계열)·who(대상 세력 → { k, far })로 가중치를 고친다 (docs/jianghu.md §9)
// 이어지는 사건(2·3단)은 S.scheduled 의 'event' 항목으로 며칠 뒤에 띄운다
// ───────────────────────────────────────────────
const VN = () => escapeHtml(S.name);
const fName = k => FACTIONS[k].name;
// 의뢰로 떠난 사람(v.away)은 마을에 없으니 세지 않는다
function fighters() { return S.villagers.filter(v => !v.dead && !v.down && !v.leaving && !v.away && (v.role === 'guard' || v.hero)); }
function civilians() { return S.villagers.filter(v => !v.dead && !v.leaving && !v.away && v.role === 'civ' && !v.hero); }
function bestFighter() { return fighters().sort((a, b) => b.martial - a.martial)[0] || null; }
function hasUsable(t) { return S.buildings.some(b => b.type === t && usable(b)); }
function injure(v, frac) { v.hp = Math.max(1, v.maxHp * frac); }
function makeHero(opts = {}) {
  const sex = opts.sex || (Math.random() < 0.22 ? 'f' : 'm');
  const martial = opts.martial !== undefined ? opts.martial : clamp(1.6 + rnd(0, 1.8) + dayOf() / 30, 1.5, 5.2);
  const title = sex === 'f' ? '여협' : pick(HERO_TITLES.filter(t => t !== '여협'));
  return {
    sex, martial, name: makeName(sex),
    hero: { title, epithet: pick(EPITHETS), upkeep: Math.round((opts.upkeepMul || 1) * (2 + martial * 1.3)) },
  };
}
function spawnHero(h, at) {
  const p = at || plazaTile();
  const v = newVillager({ sex: h.sex, name: h.name, hero: h.hero, martial: h.martial, x: p.x + 0.5, y: p.y + 0.5, age: rndi(22, 46), talent: 1.2 });
  v.look.weapon = v.look.weapon || 'sword';
  markDirty();
  return v;
}

// 사건 본문에 나오는 한자 낱말 (풀이 말풍선)
const EV_HJ = {
  guest: '<span data-tip-title="客卿 · 객경" data-tip="손님으로 모셔 높이 대접하는 고수.\n客 (손 객) · 卿 (벼슬 경)">客卿</span>',
  manual: '<span data-tip-title="淸河劍訣 · 청하검결" data-tip="맑은 강물 같은 검법의 구결을 적은 비급.\n淸 (맑을 청) · 河 (물 하) · 劍 (칼 검) · 訣 (비결 결)">淸河劍訣</span>',
  crossroads: '<span data-tip-title="岐路">岐路</span>',
};
// 사건 인장·본문의 새 한자. data.js 의 풀이(두 뜻을 함께 적은 것)는 덮어쓰지 않는다
const EV_GLOSS = {
  '盟': ['맹세 맹', '맹약. 여러 문파가 뜻을 모아 맺은 모임.'],
  '俠': ['의기로울 협', '협객. 약한 이를 돕는 의로운 무인.'],
  '察': ['살필 찰', '감찰. 잘잘못을 살핀다.'],
  '比': ['견줄 비', '비무. 무예를 견주어 겨룬다.'],
  '貢': ['바칠 공', '공물이나 제물을 바친다.'],
  '隱': ['숨을 은', '숨는다, 숨겨 준다.'],
  '追': ['쫓을 추', '쫓는다. 추격대.'],
  '婚': ['혼인할 혼', '혼담과 혼인.'],
  '嗣': ['이을 사', '대를 잇는다. 가문의 후계.'],
  '譜': ['족보 보', '족보, 대대로 전하는 기록과 비급.'],
  '宴': ['잔치 연', '잔치.'],
  '密': ['빽빽할 밀', '몰래, 은밀히. 밀수.'],
  '贓': ['장물 장', '훔친 물건.'],
  '寇': ['도적 구', '물길과 바다의 도적. 수적과 해적.'],
  '刺': ['찌를 자', '찌른다. 자객과 살수.'],
  '債': ['빚 채', '빚.'],
  '烽': ['봉화 봉', '봉화. 변경의 위급을 알리는 불.'],
  '俘': ['사로잡을 부', '사로잡힌 이, 포로.'],
  '討': ['칠 토', '토벌. 무리를 쳐서 없앤다.'],
  '逃': ['도망할 도', '도망. 쫓기는 몸.'],
  '捕': ['잡을 포', '붙잡는다. 포교와 포졸.'],
  '職': ['직분 직', '벼슬자리, 관직.'],
  '鹽': ['소금 염', '소금. 관이 값을 쥐고 세금을 매긴다.'],
  '徵': ['부를 징', '거두어들인다. 징발.'],
  '拾': ['주울 습', '줍는다.'],
  '勢': ['형세 세', '형세와 기운.'],
  '岐': ['갈림길 기', '갈림길.'],
  '岐路': ['기로', '갈림길. 어느 쪽으로 갈지 정해야 하는 자리.'],
  '獨': ['홀로 독', '홀로 선다. 누구의 깃발도 들지 않는 독립의 길.'],
};
for (const [k, v] of Object.entries(EV_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

// ── 강호 사건 도구 ──────────────────────────
// 문장: 세력 색 바탕의 작은 인장 (본문 안)
function evCrest(k) {
  const F = FACTIONS[k], g = HANJA_GLOSS[F.hanja];
  return `<span data-tip-title="${F.hanja}${g ? ' · ' + g[0] : ''}" data-tip="${F.name}의 문장" style="display:inline-grid;place-items:center;width:22px;height:22px;margin-right:4px;border-radius:4px;background:${F.color};color:#fff4e0;font-family:var(--font-display);font-size:14px;line-height:1;vertical-align:-4px">${F.hanja}</span>`;
}
const evF = k => `${evCrest(k)}<em>${fName(k)}</em>`;   // 처음 부를 때: 문장과 이름
const evNames = ids => ids.map(fName).join('·');
const evOn = () => !!(S && S.jh) && JH.allowJianghu();
const evMil = id => !!FACTIONS[id].military && !FACTIONS[id].noLord;   // 산적 떼(흑풍채)는 빼고 군사가 있는 세력
const evHeroes = () => S.villagers.filter(v => v.hero && !v.dead).length;
function evThreat(k, x) { const f = S.factions[k]; if (f) f.threat = clamp(f.threat + x, 0, 100); }
// 관 계열 이웃 모두 (밀수·암살·장물이 관의 귀에 들어갈 때)
function evGwan(d) { for (const id of JH.near()) if (JH.campOf(id) === 'gwan' && JH.isAlive(id)) changeRel(id, d); }
function evCampNear(camp, d) { for (const id of JH.near()) if (JH.campOf(id) === camp && JH.isAlive(id)) changeRel(id, d); }
// 사건의 대상 세력: 이웃이 먼저(JH.pickNear). far 면 이웃에 없을 때 먼 세력도 — 객잔·표국이 있거나 그 세력이 전쟁 중일 때만 (가중치 ×0.3)
function evTarget(camp, filter, far) {
  const k = JH.pickNear(camp, filter);
  if (k) return { k };
  if (!far) return null;
  const road = hasUsable('inn') || hasUsable('escort');
  const cs = camp == null ? null : [].concat(camp);
  const ids = FACTION_ORDER.filter(id => (!cs || cs.includes(JH.campOf(id))) && JH.isAlive(id) && !JH.isNear(id) && !FACTIONS[id].noLord
    && (!filter || filter(id)) && (road || JH.warOf(id)));
  return ids.length ? { k: pick(ids), far: true } : null;
}
function evAim(d, t) { if (!t) return false; d.k = t.k; if (t.far) d.far = true; return true; }
const evFrom = d => { const R = d.far && REGIONS[FACTIONS[d.k].home]; return R ? `멀리 ${R.name}에서 ` : ''; };
// 이웃이 낀 전쟁
function evWars() { return S.jh ? S.jh.wars.filter(w => w.a.concat(w.b).some(id => JH.isNear(id))) : []; }
// 최근 끝난 이웃의 전쟁 (Bus 'warEnd' 가 S.flags.jhLastWar 에 적는다)
function evLastWar(days) { const w = S.flags.jhLastWar; return w && dayOf() - w.day <= days ? w : null; }
// 전장이 고을에서 얼마나 먼가
function evFrontText(w) {
  const st = SITES[S.jh.site] || SITES.henan_field, d = Math.hypot(w.front.x - st.x, w.front.y - st.y);
  return d < 90 ? '마을에서 멀지 않다' : d < 220 ? '며칠 길이다' : '먼 곳이다';
}
// 갈래의 숙적 계열 (이야기가 알려 준다. 없으면 갈래 계열과 감정 −40 이하인 계열)
function evFoeCamps() {
  const ri = hook(Story, 'routeInfo');
  if (ri && Array.isArray(ri.foes)) return ri.foes;
  const r = S.jh && S.jh.route;
  return r && CAMP_ATT[r] ? CAMP_ORDER.filter(c => CAMP_ATT[r][c] <= -40) : [];
}
// 사람 몇을 길목으로 맞아들인다 (앞의 m명은 무공을 조금 안다)
function evArrive(n, m, exitIdx, mart = [0.9, 1.7]) {
  const ex = World.exits[exitIdx] || pick(World.exits);
  const out = [];
  for (let i = 0; i < n; i++) out.push(newVillager({ x: ex.x + 0.5, y: ex.y + 0.5, arriving: true, martial: i < m ? rnd(mart[0], mart[1]) : 0 }));
  markDirty();
  return out;
}
const evExit = k => (S.jh ? JH.exitFor(k)[0] : 0);
const evHousing = n => housingTotal() - popCount() < n ? '\n\n<em>빈 집이 모자라다.</em> 받아들이면 한동안 집 없이 지내야 한다.' : '';
const evLater = (id, hours, data) => { S.scheduled.push({ at: S.time + hours, kind: 'event', id, data }); };
const evPending = id => S.scheduled.some(s => s.kind === 'event' && s.id === id) || S.eventQueue.some(e => e.id === id);

// [천하도에서 보기]: 두루마리를 S.scheduled 에 맡겨 두었다가 천하도를 닫으면 곧바로 다시 펼친다 (두루마리를 잃지 않는다)
function evMapChoice(focus) {
  if (typeof WorldMap === 'undefined' || typeof WorldMap.open !== 'function') return [];
  return [{ label: '천하도에서 보기', sub: '천하도를 닫으면 이 두루마리가 다시 펼쳐진다', run: () => {
    const e = UI.modalEntry;
    if (e) S.scheduled.push({ at: S.time + 0.5, kind: 'event', id: e.id, data: e.data, peek: true });
    WorldMap.open('view', focus ? { focus } : {});
    if (!WorldMap.isOpen()) evReopen();   // 천하도가 열리지 않으면 곧바로 돌려놓는다
    return null;
  } }];
}
function evReopen() {
  if (!S || !S.scheduled) return;
  const back = S.scheduled.filter(s => s.peek);
  if (!back.length) return;
  S.scheduled = S.scheduled.filter(s => !s.peek);
  // 지금 펼친 두루마리가 있으면 그 바로 뒤에 (resolve 가 맨 앞을 거둔다)
  S.eventQueue.splice(UI.modalOpen ? 1 : 0, 0, ...back.map(s => ({ id: s.id, data: s.data })));
}
Bus.on('sheetClose', kind => { if (kind === 'worldmap') evReopen(); });
// 이웃이 낀 전쟁이 끝나면 적어 둔다 (패잔병·천하의 기운)
Bus.on('warEnd', (w, win) => {
  if (!S || !S.flags || !S.jh || !w) return;
  const all = w.a.concat(w.b);
  if (!all.some(id => JH.isNear(id))) return;
  S.flags.jhLastWar = { day: dayOf(), name: w.name, win: win ? w[win].slice() : [], lose: win ? w[win === 'a' ? 'b' : 'a'].slice() : [], all };
});

const EV = {
  bandit_toll: {
    title: '흑풍채의 통행세', stamp: '賊', tier: 'hostile', weight: 1.2, cd: 5,
    cond: () => dayOf() >= 2 && rel('heukpung') < 30 && JH.isNear('heukpung'),
    init: d => { if (d.n) return; d.n = Math.round(20 + dayOf() * 3 + popCount()); },
    text: d => `흑풍채 산적 서넛이 마을 어귀를 막아섰다. 우두머리가 도끼를 어깨에 걸치고 히죽 웃는다.\n<q>이 길은 흑풍채의 길이다. 지나다니려면 은자 ${d.n}냥을 내놓아라!</q>`,
    choices: d => [
      { label: '은자를 내준다', sub: `은자 -${d.n} · 흑풍채 관계 +8`, ok: () => S.res.silver >= d.n,
        run: () => { S.res.silver -= d.n; changeRel('heukpung', 8); S.factions.heukpung.threat = Math.max(0, S.factions.heukpung.threat - 30);
          return '산적들은 은자 주머니를 흔들며 산으로 돌아갔다. 당분간은 조용하겠지만, 또 올 것이다.'; } },
      { label: '무사들을 보내 쫓아낸다', sub: '무사가 둘 이상 있어야 한다', ok: () => fighters().length >= 2,
        run: () => {
          const need = 8 + dayOf() * 0.7;
          if (defensePower() >= need) {
            addFame(8); changeRel('heukpung', -10);
            return '무사들이 창을 겨누고 나서자 산적들은 욕설을 퍼부으며 달아났다. 마을 사람들이 박수를 친다. 명성 +8.';
          }
          for (const f of fighters().slice(0, 2)) injure(f, 0.3);
          changeRel('heukpung', -6); evThreat('heukpung', 30);
          return '산적들의 솜씨가 만만치 않았다. 무사 둘이 다쳐서 돌아왔고, 흑풍채는 앙심을 품었다.';
        } },
      { label: '거절한다', sub: '흑풍채가 앙심을 품는다', run: () => {
        changeRel('heukpung', -12); evThreat('heukpung', 45);
        if (Math.random() < 0.5) { Events.raidWarning('heukpung', 0.75); return '<q>후회하게 될 거다!</q> 산적들이 침을 뱉고 돌아갔다. 머지않아 패거리를 끌고 올 것 같다.'; }
        return '산적들은 투덜대며 돌아갔다. 흑풍채가 이 일을 잊지는 않을 것이다.';
      } },
    ],
  },
  // 옛 사건 셋: 저장된 대기열에서만 나온다 (보호비는 protection, 포섭은 offer 가 이었다)
  gang_protection: {
    title: '철혈방의 보호비', stamp: '鐵', tier: 'hostile', weight: 0.8, cd: 14,
    cond: () => false,
    text: () => `검은 비단옷을 입은 철혈방 향주가 수하 열댓을 거느리고 영주관을 찾았다.\n<q>요즘 세상이 험하지 않소? 우리 철혈방의 비호를 받으시오. 매일 공물만 조금 내면, 산적 놈들은 얼씬도 못 할 거요.</q>${S.vassal ? `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군을 배신하게 된다.` : ''}`,
    choices: () => [
      { label: '철혈방의 비호를 받는다', sub: `산하 마을이 됨 · 매일 공물 · ${FACTIONS.cheolhyeol.perk}`, run: () => { becomeVassal('cheolhyeol'); return '향주가 껄껄 웃으며 마을 어귀에 철혈방의 깃발을 꽂았다. 이제 이 마을을 건드리는 자는 철혈방을 적으로 돌리는 셈이다.'; } },
      { label: '술과 음식으로 대접해 돌려보낸다', sub: '식량 -30 · 철혈방 관계 +5', ok: () => S.res.food >= 30,
        run: () => { S.res.food -= 30; changeRel('cheolhyeol', 5); return '배불리 먹고 마신 향주는 기분 좋게 돌아갔다. 대답은 다음으로 미뤄졌다.'; } },
      { label: '단호히 거절한다', sub: '철혈방 관계 -20', run: () => { changeRel('cheolhyeol', -20); evThreat('cheolhyeol', 40);
        return '<q>호의를 무시하다니. 기억해 두겠소.</q> 향주의 눈빛이 싸늘하게 식었다.'; } },
    ],
  },
  cheongun_offer: {
    title: '청운검문의 제안', stamp: '靑', tier: 'heavy', weight: 0.8, cd: 16,
    cond: () => false,
    text: () => `학처럼 마른 청운검문의 장로가 제자 둘을 데리고 찾아왔다.\n<q>강호가 어지럽소. 이 마을을 청운검문의 산하에 두면 사파 무리도 함부로 넘보지 못할 것이오. 대신 매일 약간의 공물을 바치면 되오.</q>${S.vassal ? `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군과 척을 지게 된다.` : ''}`,
    choices: () => [
      { label: '청운검문의 산하에 든다', sub: `매일 공물 · ${FACTIONS.cheongun.perk}`, run: () => { becomeVassal('cheongun'); return '장로가 고개를 끄덕이며 청운검문의 현판을 내렸다. 정파의 이름이 마을을 지켜줄 것이다.'; } },
      { label: '정중히 사양한다', sub: '청운검문 관계 -4', run: () => { changeRel('cheongun', -4); return '<q>뜻이 그러하다면 어쩔 수 없지요.</q> 장로는 담담히 돌아갔다.'; } },
    ],
  },
  hyeolwol_offer: {
    title: '붉은 달의 유혹', stamp: '血', tier: 'heavy', weight: 0.6, cd: 20,
    cond: () => false,
    text: () => `한밤중, 붉은 달 문양의 가면을 쓴 자가 영주관 처마 밑에 서 있었다. 경비는 아무도 그를 보지 못했다.\n<q>혈월교에 충성을 맹세하라. 은자와 힘을 주겠다. 거절한다면… 붉은 달이 뜨는 밤을 조심하는 게 좋을 것이다.</q>`,
    choices: () => [
      { label: '충성을 맹세한다', sub: `은자 +250 · ${FACTIONS.hyeolwol.perk}`, run: () => { becomeVassal('hyeolwol'); addRes('silver', 250);
        return '가면 쓴 자가 낮게 웃으며 피로 쓴 서약서를 품에 넣었다. 마을 위로 붉은 그림자가 드리운다.'; } },
      { label: '거절한다', sub: '혈월교 관계 -25', run: () => { changeRel('hyeolwol', -25); evThreat('hyeolwol', 40); return '가면 쓴 자는 대답 없이 어둠 속으로 사라졌다. 바람이 차다.'; } },
      { label: '관부에 고발한다', sub: '관부 +15 · 청운검문 +8 · 혈월교의 원한', run: () => {
        changeRel('gwanbu', 15); changeRel('cheongun', 8); changeRel('hyeolwol', -40); evThreat('hyeolwol', 70);
        return '현청에 고발장이 올라갔다. 관부와 정파는 마을을 다시 보게 되었지만, 혈월교는 결코 잊지 않을 것이다.'; } },
    ],
  },
  gwanbu_tax: {
    title: '현청의 세리', stamp: '稅', tier: 'gloomy', weight: 1, cd: 8,
    cond: () => dayOf() >= 6 && !S.occupation && JH.isAlive('gwanbu'),
    init: d => { if (d.n) return; d.n = Math.round(30 + popCount() * 2 + S.rank * 20); },
    text: d => `현청에서 세리가 나왔다. 장부를 펼친 손끝에 먹물이 묻어 있다.\n<q>${VN()}의 이번 분기 세금은 은자 ${d.n}냥이오. 지체 없이 납부하시오.</q>`,
    choices: d => [
      { label: '세금을 낸다', sub: `은자 -${d.n} · 관부 관계 +8`, ok: () => S.res.silver >= d.n,
        run: () => { S.res.silver -= d.n; changeRel('gwanbu', 8); return '세리가 영수증에 낙관을 찍어 주었다.'; } },
      { label: '뇌물을 찔러주고 깎는다', sub: `은자 -${Math.round(d.n / 2)} · 들킬 수도 있다`, ok: () => S.res.silver >= d.n / 2,
        run: () => { S.res.silver -= Math.round(d.n / 2);
          if (Math.random() < 0.7) { changeRel('gwanbu', -2); return '세리는 소매 속 은자를 만지작거리더니 장부의 숫자를 고쳐 적었다.'; }
          changeRel('gwanbu', -20); addFame(-5); return '하필 감찰어사가 지나가다 이를 보았다. 관부의 눈 밖에 났다. 명성 -5.'; } },
      { label: '낼 수 없다고 버틴다', sub: '관부 관계 -20', run: () => { changeRel('gwanbu', -20);
        return rel('gwanbu') < -20 ? '세리가 이를 갈며 돌아갔다. 관부가 관병을 보낼지도 모른다.' : '세리는 장부에 붉은 줄을 긋고 돌아갔다.'; } },
    ],
  },
  conscription: {
    title: '징병령', stamp: '兵', tier: 'heavy', weight: 0.6, cd: 15,
    cond: () => popCount() >= 22 && !S.occupation && JH.isAlive('gwanbu'),
    init: d => { if (d.n) return; d.n = 2 + Math.floor(popCount() / 20); },
    text: d => `변방이 소란하여 현청이 징병령을 내렸다. ${VN()}에서도 장정 ${d.n}명을 보내야 한다.`,
    choices: d => [
      { label: `장정 ${d.n}명을 보낸다`, sub: '관부 관계 +15 · 명성 +5', ok: () => civilians().length > d.n,
        run: () => { const cs = shuffle(civilians()).slice(0, d.n); for (const v of cs) { v.leaving = true; v.act = null; }
          changeRel('gwanbu', 15); addFame(5); markDirty(); return `${cs.map(v => v.name).join(', ')}${pp(cs.map(v => v.name).join(', '), '이/가')} 눈물로 가족과 작별하고 떠났다.`; } },
      { label: '은자로 대신한다', sub: `은자 -${d.n * 35} · 관부 관계 +3`, ok: () => S.res.silver >= d.n * 35,
        run: () => { S.res.silver -= d.n * 35; changeRel('gwanbu', 3); return '은자로 장정을 대신했다. 관리는 마뜩잖은 얼굴이다.'; } },
      { label: '거부한다', sub: '관부 관계 -18', run: () => { changeRel('gwanbu', -18); return '징병관이 혀를 차며 돌아갔다.'; } },
    ],
  },
  wanderer: {
    title: '객잔의 떠돌이 고수', stamp: '客', tier: 'light', weight: 1.5, cd: 5,
    cond: () => hasUsable('inn') && evHeroes() < 6,
    init: d => { if (d.h) return; d.h = makeHero(); d.cost = Math.round(70 + d.h.martial * 55); },
    text: d => `객잔에 삿갓을 깊이 눌러쓴 ${d.h.hero.title}${pp(d.h.hero.title, '이/가')} 묵고 있다. 사람들은 그를 '${d.h.hero.epithet}'${pp(d.h.hero.epithet, '이라/라')} 부른다. 기도로 보아 경지는 <em>${realmOf(d.h.martial)}</em>쯤.\n<q>머물 곳을 찾고 있소. 대접만 섭섭지 않다면 이 마을의 객경(${EV_HJ.guest})이 되어 드리리다.</q>`,
    choices: d => [
      { label: `${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '을/를')} 객경으로 모신다`, sub: `은자 -${d.cost} · 매일 은자 ${d.h.hero.upkeep}냥`, ok: () => S.res.silver >= d.cost,
        run: () => { S.res.silver -= d.cost; const inn = S.buildings.find(b => b.type === 'inn' && usable(b)); spawnHero(d.h, inn ? doorOf(inn) : null);
          addFame(5); logMsg(`${d.h.hero.title} ${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '이/가')} 마을의 객경이 되었다.`, 'good');
          return `${d.h.name}${pp(d.h.name, '이/가')} 삿갓을 벗고 포권했다. <q>오늘부터 이 마을은 내가 지키겠소.</q>`; } },
      { label: '술 한 잔 대접하고 보낸다', sub: '은자 -5 · 명성 +2', run: () => { S.res.silver = Math.max(0, S.res.silver - 5); addFame(2); return '고수는 잔을 비우고 말없이 떠났다. 객잔 주인이 그 이야기를 사방에 퍼뜨린다.'; } },
    ],
  },
  injured: {
    title: '숲속의 부상자', stamp: '傷', tier: 'light', weight: 0.9, cd: 10,
    cond: () => dayOf() >= 3,
    // 쫓던 쪽(정파 이웃, 없으면 관부)과 그 무인의 정체(마교)
    init: d => {
      if (d.j) return;
      d.j = JH.pickNear('jeong') || 'gwanbu';
      d.m = JH.pickNear('ma') || FACTION_ORDER.find(id => JH.campOf(id) === 'ma' && JH.isAlive(id)) || 'hyeolwol';
    },
    text: () => '나무를 하러 간 사람들이 숲속에서 피투성이가 된 무인을 발견했다. 품에는 부러진 검이 안겨 있고, 숨이 가늘다.',
    choices: d => [
      { label: '데려와 치료해 준다', sub: '식량 -15 · 은자 -15', ok: () => S.res.food >= 15 && S.res.silver >= 15,
        run: () => { S.res.food -= 15; S.res.silver -= 15;
          const r = Math.random();
          if (r < 0.5) { const h = makeHero({ martial: rnd(1.5, 2.6), upkeepMul: 0.5 }); h.hero.title = '은혜 갚는 ' + h.hero.title; spawnHero(h);
            return `깨어난 무인은 ${h.name}${pp(h.name, '이라/라')} 했다. <q>목숨을 구해 주셨으니 이 몸으로 갚겠소.</q> 그가 마을의 객경이 되었다.`; }
          if (r < 0.8) { S.martialCap = Math.min(6, S.martialCap + 0.5); addMod('manual', 6);
            return '무인은 몸을 추스르자 말없이 떠났다. 그가 누웠던 자리에 낡은 무공 구결 한 장이 남아 있었다. 무사들의 수련이 한층 깊어진다.'; }
          changeRel(d.j, -15); changeRel(d.m, 10);
          return `며칠 뒤 ${fName(d.j)} 사람들이 들이닥쳤다. 그 무인은 ${fName(d.m)}의 살수였다. 그는 이미 사라졌고, 그를 숨겨준 마을은 ${fName(d.j)}의 눈총을 받게 되었다.`; } },
      { label: '관부에 알린다', sub: '관부 관계 +5', run: () => { changeRel('gwanbu', 5); return '관병이 와서 무인을 데려갔다. 그 뒤의 일은 아무도 모른다.'; } },
      { label: '못 본 척한다', run: () => '사람들은 발길을 돌렸다. 마음 한구석이 무겁다.' },
    ],
  },
  manual: {
    title: '석함 속의 비급', stamp: '秘', tier: 'light', weight: 0.5, cd: 30,
    cond: () => (hasUsable('quarry') || hasUsable('lumber')) && dayOf() >= 4,
    // 바칠 곳(정파, 없으면 세가 이웃)과 사 갈 상단
    init: d => { if (d.s) return; d.j = JH.pickNear('jeong') || JH.pickNear('sega') || ''; d.s = JH.pickNear('sang') || 'geumryong'; },
    text: () => `일꾼이 땅을 파다가 이끼 낀 석함을 발견했다. 안에는 빛바랜 무공 비급이 들어 있었다. 표지에는 <em>「청하검결(${EV_HJ.manual})」</em>이라 적혀 있다.`,
    choices: d => [
      { label: '무사들에게 익히게 한다', sub: '무사가 오를 수 있는 경지 +1 · 무사 전원 무공 상승', run: () => {
        S.martialCap = Math.min(6, S.martialCap + 1); addMod('manual', 10);
        for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.4); updateStats(v); }
        return '무관에 비급이 걸렸다. 무사들의 눈빛이 달라졌다.'; } },
      ...(d.j ? [{ label: `${fName(d.j)}에 바친다`, sub: `${fName(d.j)} 관계 +20 · 명성 +15`, run: () => { changeRel(d.j, 20); addFame(15);
        return `${fName(d.j)}의 어른이 감사의 서신을 보냈다. 무림 명문들 사이에 마을의 이름이 오르내린다.`; } }] : []),
      { label: `${fName(d.s)}에 판다`, sub: '은자 +220', run: () => { addRes('silver', 220); changeRel(d.s, 5); return `${fName(d.s)}의 대행수가 눈을 반짝이며 은자 꾸러미를 내밀었다.`; } },
    ],
  },
  plague: {
    title: '역병이 돈다', stamp: '疫', tier: 'heavy', weight: 0.5, cd: 22,
    cond: () => popCount() >= 15 && dayOf() >= 8 && !hasMod('plague'),
    text: () => `열이 끓고 기침을 하는 사람이 하나둘 늘고 있다. 역병이다.${hasUsable('clinic') ? '\n마을 의원이 약을 달이고 있어 그나마 다행이다.' : '\n마을에는 의원이 없다.'}${S.flags.antidote ? '\n곳간에 사 둔 해독약 상자가 있다.' : ''}`,
    choices: () => [
      ...(S.flags.antidote ? [{ label: '사 둔 해독약을 푼다', sub: '해독약을 다 쓴다 · 곧바로 잡힌다', run: () => { S.flags.antidote = false; addFame(2);
        return '해독약을 우물마다 풀고 앓는 이마다 한 숟갈씩 먹였다. 사흘 만에 기침 소리가 그쳤다.'; } }] : []),
      { label: '마을을 격리한다', sub: '사흘간 생산 -40% · 피해가 거의 없다', run: () => { addMod('plague', 3); addMod('quarantine', 3); return '집집마다 문을 닫아걸었다. 일손은 멈췄지만 병은 더 퍼지지 않을 것이다.'; } },
      { label: '이름난 의원을 모셔온다', sub: '은자 -120 · 곧바로 잡힌다', ok: () => S.res.silver >= 120, run: () => { S.res.silver -= 120; addFame(3); return '성내의 명의가 사흘 밤낮을 매달려 역병을 잡았다.'; } },
      { label: '하늘에 맡긴다', sub: '나흘간 역병 · 사람이 죽을 수 있다', run: () => { addMod('plague', 4); return '사람들은 문설주에 부적을 붙이고 기도했다.'; } },
    ],
  },
  drought: {
    title: '가뭄', stamp: '旱', tier: 'gloomy', weight: 0.7, cd: 15,
    cond: () => (seasonIdx() === 1 || seasonIdx() === 0) && countType('farm') > 0 && !hasMod('drought'),
    text: () => '보름째 비 한 방울 내리지 않았다. 논바닥이 거북이 등처럼 갈라진다.',
    choices: () => [
      { label: '기우제를 지낸다', sub: `은자 -40${hasUsable('shrine') ? ' · 사당이 있어 영험할지도' : ''}`, ok: () => S.res.silver >= 40,
        run: () => { S.res.silver -= 40;
          if (Math.random() < (hasUsable('shrine') ? 0.7 : 0.35)) { S.rain = true; addFame(3); return '제를 올린 다음 날, 먹구름이 몰려와 단비가 쏟아졌다!'; }
          addMod('drought', 3); return '정성껏 제를 올렸지만 하늘은 묵묵부답이다.'; } },
      { label: '우물을 더 판다', sub: '석재 -30 · 가뭄 피해가 줄어든다', ok: () => S.res.stone >= 30,
        run: () => { S.res.stone -= 30; addMod('drought', 4); addMod('well_dug', 4); return '사람들이 힘을 합쳐 우물을 팠다. 논에 물을 댈 수 있을 것이다.'; } },
      { label: '견딘다', sub: '나흘간 농사 수확 크게 감소', run: () => { addMod('drought', 4); return '타들어가는 벼를 바라보며 한숨만 쉰다.'; } },
    ],
  },
  harvest: {
    title: '풍년', stamp: '豊', tier: 'light', weight: 0.9, cd: 30,
    cond: () => seasonIdx() === 2 && countType('farm') >= 2,
    text: () => '황금빛 들판에 이삭이 고개를 숙였다. 몇 해 만의 풍년이다!',
    choices: () => [
      { label: '곳간에 쌓아둔다', sub: '나흘간 수확 +40% · 식량 +40', run: () => { addMod('harvest', 4); addRes('food', 40); return '곳간이 가득 찼다.'; } },
      { label: '추수 잔치를 연다', sub: '식량 -30 · 민심 크게 상승', ok: () => S.res.food >= 30, run: () => { S.res.food -= 30; addMod('harvest', 4); addMod('festival', 3); addFame(5); return '풍물 소리가 밤늦도록 울려 퍼졌다.'; } },
    ],
  },
  // 이웃 상단(금룡상회·만리표국)의 수레
  merchant: {
    title: d => `${fName(d.s || 'geumryong')}의 상단`, stamp: '商', tier: 'light', weight: 1.3, cd: 4,
    cond: () => dayOf() >= 2 && !S.occupation,
    init: d => { if (d.s) return; d.s = JH.pickNear('sang') || 'geumryong'; d.wood = rndi(55, 85); d.stone = rndi(70, 105); d.food = rndi(45, 70); d.arms = rndi(95, 140); },
    text: d => `${fName(d.s)}의 깃발을 단 수레 행렬이 마을 광장에 멈췄다. 대행수가 주판을 튕기며 웃는다.\n<q>무엇이든 사고팝니다. 값은 장담하지요.</q>`,
    choices: d => [
      { label: '목재 100을 산다', sub: `은자 -${d.wood}`, ok: () => S.res.silver >= d.wood, run: () => { S.res.silver -= d.wood; addRes('wood', 100); changeRel(d.s, 2); return '목재가 수레째 내려졌다.'; } },
      { label: '석재 80을 산다', sub: `은자 -${d.stone}`, ok: () => S.res.silver >= d.stone, run: () => { S.res.silver -= d.stone; addRes('stone', 80); changeRel(d.s, 2); return '다듬은 돌이 광장에 쌓였다.'; } },
      { label: '병장기 20을 산다', sub: `은자 -${d.arms}`, ok: () => S.res.silver >= d.arms, run: () => { S.res.silver -= d.arms; addRes('weapons', 20); changeRel(d.s, 2); return '번쩍이는 창칼이 무관으로 옮겨졌다.'; } },
      { label: '식량 100을 판다', sub: `은자 +${d.food}`, ok: () => S.res.food >= 100, run: () => { S.res.food -= 100; addRes('silver', d.food); changeRel(d.s, 2); return '곡식 가마니가 수레에 실렸다.'; } },
      { label: '그냥 보낸다', run: () => '상단은 다음 마을로 떠났다.' },
    ],
  },
  refugees: {
    title: '유랑민', stamp: '民', tier: 'light', weight: 1, cd: 6,
    cond: () => dayOf() >= 3 && !S.occupation,
    init: d => { if (d.n) return; d.n = rndi(3, 6); },
    text: d => `전란을 피해 온 유랑민 ${d.n}명이 마을 어귀에 주저앉았다. 아이를 업은 아낙이 고개를 조아린다.\n<q>제발 이 마을에 머물게 해 주십시오. 무슨 일이든 하겠습니다.</q>${evHousing(d.n)}`,
    choices: d => [
      { label: '받아들인다', sub: `사람 +${d.n} · 식량 -${d.n * 4} · 명성 +3`, ok: () => S.res.food >= d.n * 4,
        run: () => { S.res.food -= d.n * 4; const ex = pick(World.exits); for (let i = 0; i < d.n; i++) newVillager({ x: ex.x + 0.5, y: ex.y + 0.5, arriving: true });
          addFame(3); markDirty(); return '유랑민들이 눈물을 흘리며 짐을 풀었다.'; } },
      { label: '식량만 나눠주고 보낸다', sub: '식량 -15 · 명성 +1', ok: () => S.res.food >= 15, run: () => { S.res.food -= 15; addFame(1); return '주먹밥을 받아 든 이들이 몇 번이고 절을 하고 떠났다.'; } },
      { label: '돌려보낸다', sub: '명성 -2', run: () => { addFame(-2); return '유랑민들은 터벅터벅 다음 마을로 향했다.'; } },
    ],
  },
  // 정파 이웃과 사파·흑도 이웃이 나루터를 두고 다툰다 (천하의 큰 전쟁은 jh_war_sides 가 맡는다)
  sect_war: {
    title: '나루터 다툼', stamp: '亂', tier: 'heavy', weight: 0.6, cd: 30,
    cond: () => dayOf() >= 14 && !!EV.sect_war.pair(),
    pair() {
      const a = JH.pickNear('jeong'), b = JH.pickNear(['sa', 'heuk'], evMil);
      return a && b && !(JH.warOf(a) && JH.warOf(a) === JH.warOf(b)) ? [a, b] : null;
    },
    init(d) { if (d.a) return; const p = this.pair(); if (!p) return false; [d.a, d.b] = p; },
    text: d => `${evF(d.a)}${pp(fName(d.a), '과/와')} ${evF(d.b)}${pp(fName(d.b), '이/가')} 강 건너 나루터를 두고 칼부림을 벌였다! 양쪽에서 사자가 동시에 찾아와 마을의 지원을 요구한다.`,
    choices: d => [
      { label: `${fName(d.a)}${pp(fName(d.a), '을/를')} 돕는다`, sub: `식량 -60 · 은자 -60 · ${fName(d.a)} +25 · ${fName(d.b)}의 적의`, ok: () => S.res.food >= 60 && S.res.silver >= 60,
        run: () => { S.res.food -= 60; S.res.silver -= 60; changeRel(d.a, 25); changeRel(d.b, -30); evThreat(d.b, 30); addFame(10);
          return `${fName(d.a)}${pp(fName(d.a), '이/가')} 승기를 잡았다. 정파 사이에서 마을의 이름이 높아졌다. 명성 +10.`; } },
      { label: `${fName(d.b)}${pp(fName(d.b), '을/를')} 돕는다`, sub: `식량 -60 · 은자 -60 · ${fName(d.b)} +25 · 은자 +90 · ${fName(d.a)}의 적의`, ok: () => S.res.food >= 60 && S.res.silver >= 60,
        run: () => { S.res.food -= 60; S.res.silver -= 60; changeRel(d.b, 25); changeRel(d.a, -30); evThreat(d.a, 30); addRes('silver', 90);
          return `${fName(d.b)}${pp(fName(d.b), '이/가')} 나루터를 차지했다. 우두머리가 고맙다며 은자 90냥을 보내왔다. 정파의 눈길은 차가워졌다.`; } },
      { label: '중립을 지킨다', sub: '양쪽 관계 -5', run: () => { changeRel(d.a, -5); changeRel(d.b, -5); return '어느 편도 들지 않았다. 양쪽 모두 마을을 기회주의자라 수군거린다.'; } },
    ],
  },
  // 인근 성의 무림대회 (연무대의 tournament 혜택이 자주 열리게 한다. 이야기의 세가 갈래도 이것을 연다)
  tournament: {
    title: '무림대회', stamp: '武', tier: 'hostile', weight: () => 0.7 * (1 + JH.perk('tournament')), cd: 20,
    cond: () => S.fame >= 25 && fighters().length > 0,
    init: d => { if (d.champ) return; const c = bestFighter(); if (!c) return false; d.champ = c.id; d.cname = c.name; d.p = clamp(0.12 + c.martial * 0.16, 0.1, 0.88);
      d.who = `${c.hero ? c.hero.epithet + ' ' : '무사 '}${c.name}(${realmOf(c.martial)})`; },
    text: d => `인근 성에서 무림대회가 열린다. 우승자에게는 은자 200냥과 강호의 명성이 주어진다.\n마을에서 가장 강한 이는 ${d.who}.`,
    choices: d => [
      { label: `${d.cname}${pp(d.cname, '을/를')} 출전시킨다`, sub: `우승 가능성 ${Math.round(d.p * 100)}%`, run: () => {
        const c = S.villagers.find(v => v.id === d.champ);
        if (!c || c.dead || c.away) return '출전할 사람이 없다.';
        if (Math.random() < d.p) { addFame(40); addRes('silver', 200); c.martial = Math.min(S.martialCap + (c.hero ? 2.5 : 0), c.martial + 0.5); updateStats(c); S.stats.titles = (S.stats.titles || 0) + 1;
          logMsg(`${c.name}${pp(c.name, '이/가')} 무림대회에서 우승했다!`, 'good');
          if (S.jh) JH.news(`${S.name}의 ${c.name}${pp(c.name, '이/가')} 무림대회에서 우승했다.`, 'tourney', []);
          return `${c.name}${pp(c.name, '이/가')} 결승에서 상대의 검을 부러뜨리고 우승했다! 은자 200냥, 명성 +40. 강호가 ${VN()}${pp(VN(), '을/를')} 주목한다.`; }
        injure(c, 0.25); addFame(5); return `${c.name}${pp(c.name, '은/는')} 분전했지만 4강에서 고배를 마셨다. 그래도 이름은 알렸다. 명성 +5.`; } },
      { label: '출전하지 않는다', run: () => '대회 소식은 바람결에만 들려왔다.' },
    ],
  },
  // 객잔에서 맞붙은 두 세력의 무인 (명문 쪽과 사도 쪽)
  inn_brawl: {
    title: '객잔의 칼부림', stamp: '鬪', tier: 'hostile', weight: 0.8, cd: 10,
    cond: () => hasUsable('inn'),
    init: d => {
      if (d.a) return;
      const any = cs => FACTION_ORDER.filter(id => cs.includes(JH.campOf(id)) && JH.isAlive(id) && evMil(id));
      d.a = JH.pickNear(['jeong', 'sega'], evMil) || pick(any(['jeong', 'sega']));
      d.b = JH.pickNear(['sa', 'heuk'], evMil) || pick(any(['sa', 'heuk']));
      if (!d.a || !d.b) return false;
    },
    text: d => `객잔에서 ${evF(d.a)} 사람과 ${evF(d.b)} 무사가 시비가 붙었다! 탁자가 부서지고 술독이 깨진다.`,
    choices: d => [
      { label: `${fName(d.a)} 쪽 편을 든다`, sub: `${fName(d.a)} +8 · ${fName(d.b)} -10`, run: () => { changeRel(d.a, 8); changeRel(d.b, -10); return `${fName(d.b)} 무사가 욕을 하며 쫓겨났다.`; } },
      { label: `${fName(d.b)} 쪽 편을 든다`, sub: `${fName(d.b)} +8 · ${fName(d.a)} -10`, run: () => { changeRel(d.b, 8); changeRel(d.a, -10); return `${fName(d.a)} 사람이 분을 삭이며 떠났다.`; } },
      { label: '둘 다 끌어낸다', sub: '마을 무력이 충분하면 명성이 오른다', run: () => {
        if (defensePower() >= 15) { addFame(8); return '무사들이 둘을 양쪽에서 붙잡아 마을 밖으로 내던졌다. <q>여기선 칼을 뽑지 마시오.</q> 명성 +8.'; }
        S.res.silver = Math.max(0, S.res.silver - 40); addFame(-2); return '말리다가 객잔만 더 부서졌다. 수리비로 은자 40냥이 들었다.'; } },
    ],
  },
  fire: {
    title: '한밤의 화재', stamp: '火', tier: 'hostile', weight: 0.6, cd: 8,
    cond: () => isNight() && S.buildings.some(b => usable(b) && ['house', 'house2', 'inn', 'market', 'warehouse'].includes(b.type)),
    init: d => {
      if (d.b) return;
      const cands = S.buildings.filter(b => usable(b) && ['house', 'house2', 'inn', 'market', 'warehouse'].includes(b.type));
      if (!cands.length) return false;
      d.b = pick(cands).id;
    },
    text: d => { const b = getB(d.b); return `${b ? BDEF[b.type].name : '건물'}에서 불길이 솟았다! 밤하늘이 붉게 물든다.`; },
    choices: d => [
      { label: '모두 깨워 불을 끈다!', run: () => {
        const b = getB(d.b);
        if (!b || !usable(b)) return '불은 저절로 꺼졌다.';
        const wells = S.buildings.filter(o => usable(o) && o.type === 'well' && dist(o.x, o.y, b.x, b.y) < 9).length;
        const frac = wells ? 0.25 : 0.6;
        b.hp -= b.maxHp * frac; b.burning = true; b.burnUntil = S.time + 2;
        if (b.hp <= 0) { buildingDestroyed(b); return '불길이 너무 거셌다. 건물이 잿더미가 되었다.'; }
        return wells ? '우물에서 물을 길어 날라 금세 불을 잡았다. 피해는 크지 않다.' : '물동이를 들고 밤새 뛰어다녔다. 가까이에 우물이 있었다면 좋았을 텐데.';
      } },
    ],
  },
  festival: {
    title: '명절', stamp: '節', tier: 'light', weight: 1.2, cd: 16,
    cond: () => (seasonIdx() === 0 && dayOf() % DAYS_PER_SEASON < 4) || (seasonIdx() === 2 && dayOf() % DAYS_PER_SEASON >= 4),
    text: () => (seasonIdx() === 0 ? '단오가' : '한가위가') + ' 다가왔다. 사람들이 영주의 눈치를 살핀다.',
    choices: () => [
      { label: '성대한 잔치를 연다', sub: '은자 -80 · 식량 -50 · 나흘간 민심 크게 상승 · 명성 +10', ok: () => S.res.silver >= 80 && S.res.food >= 50,
        run: () => { S.res.silver -= 80; S.res.food -= 50; addMod('festival', 4); addFame(10); return '그네가 하늘 높이 오르고 씨름판이 벌어졌다. 인근 마을 사람들까지 구경을 왔다.'; } },
      { label: '조촐하게 보낸다', sub: '은자 -25 · 이틀간 민심 상승', ok: () => S.res.silver >= 25, run: () => { S.res.silver -= 25; addMod('festival', 2); return '집집마다 떡을 나누었다.'; } },
      { label: '그냥 넘어간다', run: () => '여느 날과 다름없이 지나갔다. 아이들이 실망한 얼굴이다.' },
    ],
  },
  // 사이가 나쁜 이웃의 첩자
  spy: {
    title: '붙잡힌 첩자', stamp: '諜', tier: 'hostile', weight: 0.8, cd: 12,
    cond: () => !!JH.pickNear(null, id => FACTIONS[id].military && rel(id) < -20),
    init: d => { if (d.k) return; d.k = JH.pickNear(null, id => FACTIONS[id].military && rel(id) < -20); if (!d.k) return false; },
    text: d => `야경을 돌던 사람들이 담을 넘던 수상한 자를 붙잡았다. 품에서 ${evF(d.k)}의 영패가 나왔다.`,
    choices: d => [
      { label: '심문한다', sub: `${fName(d.k)}의 습격 계획을 늦춘다`, run: () => { evThreat(d.k, -45); changeRel(d.k, -5);
        return `첩자는 끝내 입을 열었다. ${fName(d.k)}${pp(fName(d.k), '이/가')} 마을을 노리고 있었다. 미리 알았으니 대비할 시간을 벌었다.`; } },
      { label: '풀어준다', sub: `${fName(d.k)} 관계 +12`, run: () => { changeRel(d.k, 12); return '첩자는 어리둥절한 얼굴로 몇 번이나 뒤를 돌아보며 떠났다.'; } },
      { label: '관부에 넘긴다', sub: `관부 +10 · ${fName(d.k)} -10 · 명성 +3`, run: () => { changeRel('gwanbu', 10); changeRel(d.k, -10); addFame(3); return '포졸들이 첩자를 끌고 갔다.'; } },
    ],
  },
  cave: {
    title: '뒷산의 동굴', stamp: '窟', tier: 'hostile', weight: 0.6, cd: 25,
    cond: () => fighters().length >= 2 && dayOf() >= 5,
    text: () => '산사태로 뒷산 절벽에 동굴 입구가 드러났다. 안쪽에서 서늘한 바람과 함께 짐승 냄새가 풍긴다. 옛 고수가 은거했던 곳이라는 소문이 있다.',
    choices: () => [
      { label: '무사들을 보내 탐색한다', sub: '보물일 수도, 위험일 수도', run: () => {
        const r = Math.random();
        if (r < 0.4) { const n = rndi(150, 300); addRes('silver', n); return `동굴 깊은 곳에서 녹슨 상자를 찾았다. 안에는 옛 은자 ${n}냥이 들어 있었다!`; }
        if (r < 0.65) { S.martialCap = Math.min(6, S.martialCap + 0.5); for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.3); updateStats(v); }
          return '동굴 벽에 검결이 새겨져 있었다. 무사들이 사흘 밤낮을 들여다본 끝에 깨달음을 얻었다.'; }
        const f = pick(fighters());
        if (f && Math.random() < 0.3) { f.dead = true; S.stats.died++; return `동굴에는 거대한 곰이 살고 있었다. ${f.name}${pp(f.name, '이/가')} 동료들을 지키다 목숨을 잃었다.`; }
        if (f) injure(f, 0.2);
        return '동굴 안의 곰에게 쫓겨 혼비백산 달아났다. 다친 사람이 생겼다.'; } },
      { label: '입구를 막는다', run: () => '돌로 입구를 막았다. 궁금하긴 하지만 무사한 게 제일이다.' },
    ],
  },
  wedding: {
    title: '혼례', stamp: '囍', tier: 'light', weight: 0.9, cd: 8,
    cond: () => S.villagers.filter(v => !v.dead && v.age < 35 && !v.hero).length >= 2,
    init: d => {
      if (d.a) return;
      const m = S.villagers.filter(v => !v.dead && v.sex === 'm' && v.age < 35 && !v.hero);
      const f = S.villagers.filter(v => !v.dead && v.sex === 'f' && v.age < 35 && !v.hero);
      d.a = m.length ? pick(m).name : makeName('m'); d.b = f.length ? pick(f).name : makeName('f');
    },
    text: d => `${d.a}${pp(d.a, '과/와')} ${d.b}${pp(d.b, '이/가')} 혼례를 올린다. 온 마을이 들썩인다.`,
    choices: () => [
      { label: '축의금을 보낸다', sub: '은자 -20 · 사흘간 민심 상승', ok: () => S.res.silver >= 20, run: () => { S.res.silver -= 20; addMod('wedding', 3); addFame(1); return '영주의 축의금에 신랑 신부가 큰절을 올렸다.'; } },
      { label: '축하만 한다', run: () => { addMod('wedding', 1); return '잔칫집에서 국수 한 그릇을 얻어먹었다.'; } },
    ],
  },
  // 사이 좋은 정파 이웃이 제자들을 보내 하산 수련을 시킨다 (머무는 동안 마을을 지킨다)
  disciples: {
    title: '하산 수련', stamp: '修', tier: 'light', weight: 0.6, cd: 20,
    cond: () => !hasMod('disciples') && !!JH.pickNear('jeong', id => rel(id) >= 30),
    init: d => { if (d.k) return; d.k = JH.pickNear('jeong', id => rel(id) >= 30); if (!d.k) return false; },
    text: d => `${evF(d.k)}에서 서신이 왔다. 제자 몇을 마을에 보내 닷새 동안 하산 수련을 시키고 싶다고 한다. 머무는 동안 마을을 지켜줄 것이다.`,
    choices: d => [
      { label: '받아들인다', sub: `식량 -40 · 닷새간 ${FACTIONS[d.k].unit.name} 4명이 마을을 지킨다`, ok: () => S.res.food >= 40,
        run: () => { S.res.food -= 40; addMod('disciples', 5, { faction: d.k }); spawnAllies(d.k, 4, 5); changeRel(d.k, 5); addFame(5); return '흰 도포의 젊은 무인들이 마을에 들어섰다. 아이들이 졸졸 따라다닌다.'; } },
      { label: '사양한다', run: () => '정중히 거절하는 답신을 보냈다.' },
    ],
  },
  prodigy: {
    title: '타고난 근골', stamp: '才', tier: 'light', weight: 0.5, cd: 25,
    cond: () => civilians().some(v => v.age < 26),
    init: d => { if (d.v) return; const vs = civilians().filter(v => v.age < 26); if (!vs.length) return false; d.v = pick(vs).id; d.j = JH.pickNear(['jeong', 'sega']) || ''; },
    text: d => { const v = unitById(d.v) || S.villagers.find(o => o.id === d.v); return `${v ? v.name : '어떤 아이'}${pp(v ? v.name : '어떤 아이', '이/가')} 놀라운 근골을 지녔다는 소문이 돈다. 나무 지게를 지고 산을 뛰어오른다고 한다.`; },
    choices: d => [
      { label: '무관에서 가르친다', sub: '무공 재능이 크게 오른다', ok: () => hasUsable('dojo'),
        run: () => { const v = S.villagers.find(o => o.id === d.v); if (!v || v.dead) return '그 아이는 이미 마을을 떠났다.'; v.talent = 2.4; v.martial += 1; updateStats(v); markDirty();
          return `${v.name}${pp(v.name, '이/가')} 무관 문을 두드렸다. 언젠가 마을을 지키는 큰 기둥이 될 것이다.`; } },
      ...(d.j ? [{ label: `${fName(d.j)}에 입문시킨다`, sub: `${fName(d.j)} +15 · 명성 +10 · 마을을 떠난다`, run: () => { const v = S.villagers.find(o => o.id === d.v); if (v) { v.leaving = true; v.act = null; } changeRel(d.j, 15); addFame(10);
        return `${fName(d.j)}에서 기꺼이 제자로 받아들였다. 언젠가 이름을 떨치면 고향을 잊지 않을 것이다.`; } }] : []),
      { label: '평범하게 살게 둔다', run: () => '그저 힘센 일꾼으로 자랄 것이다.' },
    ],
  },
  tiger: {
    title: '호환', stamp: '虎', tier: 'hostile', weight: 0.6, cd: 20,
    cond: () => dayOf() >= 4 && !hasMod('tiger'),
    text: () => '뒷산에 집채만 한 호랑이가 나타났다! 나무꾼 하나가 간신히 도망쳐 왔다. 해가 지면 아무도 문밖에 나가려 하지 않는다.',
    choices: () => [
      { label: '무사들이 사냥에 나선다', sub: '마을 무력이 충분해야 한다', ok: () => fighters().length > 0, run: () => {
        if (defensePower() >= 12 || fighters().some(v => v.hero)) { addFame(12); addRes('silver', 60); return '무사들이 호랑이를 몰아 잡았다! 호피는 은자 60냥에 팔렸고, 마을의 이름이 올랐다.'; }
        const f = pick(fighters()); if (f) injure(f, 0.15); addMod('tiger', 2); return '호랑이는 너무 강했다. 다친 무사를 업고 돌아왔다.'; } },
      { label: '사냥꾼을 고용한다', sub: '은자 -60', ok: () => S.res.silver >= 60, run: () => { S.res.silver -= 60; return '이름난 사냥꾼이 이틀 만에 호랑이를 잡아 왔다.'; } },
      { label: '문을 걸어 잠근다', sub: '사흘간 민심 하락 · 사람이 다칠 수 있다', run: () => { addMod('tiger', 3);
        if (Math.random() < 0.3) { const v = pick(civilians()); if (v) { v.dead = true; S.stats.died++; return `안타깝게도 ${v.name}${pp(v.name, '이/가')} 호환을 당했다.`; } }
        return '사람들은 해가 지기 전에 서둘러 집으로 들어간다.'; } },
    ],
  },
  // 이웃 상단의 투자 권유 → 열흘 뒤 invest_return
  invest: {
    title: d => `${fName(d.s || 'geumryong')}의 제안`, stamp: '金', tier: 'light', weight: 0.6, cd: 20,
    cond: () => S.res.silver >= 220 && dayOf() >= 6 && !evPending('invest_return'),
    init: d => { if (d.s) return; d.s = JH.pickNear('sang') || 'geumryong'; },
    text: d => `${fName(d.s)}의 대행수가 은밀히 찾아왔다.\n<q>서역으로 가는 비단 상단에 은자 200냥만 넣으시지요. 열흘 뒤 두 배로 돌려드리겠습니다. 물론… 사막 길이 순탄하다면요.</q>`,
    choices: d => [
      { label: '은자 200냥을 맡긴다', sub: '열흘 뒤 결과가 나온다', ok: () => S.res.silver >= 200,
        run: () => { S.res.silver -= 200; evLater('invest_return', 240, { s: d.s }); changeRel(d.s, 5); return '대행수가 어음을 써 주었다.'; } },
      { label: '거절한다', run: () => '<q>아쉽군요. 다음 기회에.</q>' },
    ],
  },
  invest_return: {
    title: '상단의 귀환', stamp: '金', tier: 'light', weight: 0, cd: 0, cond: () => false,
    init: d => { if (d.ok !== undefined) return; d.ok = Math.random() < 0.75; if (!d.s) d.s = 'geumryong'; },
    text: d => d.ok ? '서역에 갔던 상단이 돌아왔다! 대행수가 약속대로 은자 꾸러미를 내민다.' : '나쁜 소식이다. 상단이 사막에서 마적 떼를 만났다고 한다. 대행수가 고개를 숙인다.',
    choices: d => [{ label: '확인', run: () => { if (d.ok) { addRes('silver', 420); return '은자 420냥을 받았다.'; } changeRel(d.s, 5); return '맡긴 은자는 돌아오지 않았다. 대행수는 다음엔 꼭 갚겠다고 했다.'; } }],
  },
  inspection: {
    title: '현령의 시찰', stamp: '官', tier: 'light', weight: 0.6, cd: 25,
    cond: () => S.rank >= 2 && rel('gwanbu') >= 15 && !S.occupation && JH.isAlive('gwanbu'),
    text: () => `현령이 가마를 타고 ${VN()}${pp(VN(), '을/를')} 시찰하러 왔다. 마을이 커졌다는 소문을 들은 모양이다.`,
    choices: () => [
      { label: '성대히 대접한다', sub: '은자 -60 · 관부 +15 · 명성 +12', ok: () => S.res.silver >= 60, run: () => { S.res.silver -= 60; changeRel('gwanbu', 15); addFame(12); return '흡족해진 현령이 마을을 칭찬하는 상소를 올리겠다고 약속했다.'; } },
      { label: '간소하게 맞는다', sub: '관부 +4', run: () => { changeRel('gwanbu', 4); return '현령은 차 한 잔을 마시고 돌아갔다.'; } },
    ],
  },
  defector: {
    title: '산적의 투항', stamp: '降', tier: 'light', weight: 0.6, cd: 15,
    cond: () => S.stats.raidsWon >= 1 && rel('heukpung') < 0 && JH.isAlive('heukpung'),
    text: () => '흑풍채에서 도망쳐 온 산적 하나가 무릎을 꿇었다.\n<q>채주의 횡포를 더는 못 참겠소. 받아만 주시면 이 마을을 위해 칼을 들겠소.</q>',
    choices: () => [
      { label: '받아들인다', sub: '무공을 아는 장정 +1 · 흑풍채 -8', run: () => { const p = plazaTile(); const v = newVillager({ sex: 'm', x: p.x + 0.5, y: p.y + 0.5, martial: 1.3, talent: 1.1 }); changeRel('heukpung', -8); markDirty();
        return `${v.name}${pp(v.name, '이/가')} 마을 사람이 되었다. 산채 사정에 밝으니 쓸모가 있을 것이다.`; } },
      { label: '관부에 넘긴다', sub: '관부 +8 · 현상금 은자 +30', run: () => { changeRel('gwanbu', 8); addRes('silver', 30); return '현상금이 걸려 있던 자였다.'; } },
    ],
  },
};

// ━━ 강호의 사건 (docs/jianghu.md §8.1·§9) ━━━━━━━━━━━━━━━━
// 포섭: 산하를 들일 수 있는 이웃 하나(군사가 있고, 산적 떼가 아니고, 관계 40 이상, 지금 주군이 아님),
// 또는 이야기가 갈림길에서 넘긴 세력 (data.special: 선납 은자 100, 관계 조건 없음). 갈래는 이야기가 Bus 'vassal' 로 듣고 정한다
const EV_WAR_QUEST = ['jeong', 'gwan', 'sega', 'ma'];   // 원군 의뢰를 내는 계열 (§6)
const evOfferOk = id =>evMil(id) && rel(id) >= 40 && id !== S.vassal && !(S.occupation && S.occupation.faction === id);
const evTrib = k => Math.round((4 + popCount() * 0.25) * (CAMPS[FACTIONS[k].camp] ? CAMPS[FACTIONS[k].camp].tribute : 1));
// 새외 세력의 모습: 빙설궁·금륜사는 변경의 말 탄 무인, 해랑도는 바다 건너 해적, 야수궁은 남쪽 밀림의 사냥꾼
const SAEOE_LOOK = {
  steppe: {
    envoy: '털가죽을 두른 {F}의 사자가 말에서 내리지도 않고 외쳤다', law: '변경', road: '국경 너머의 길', flag: '사자가 말 위에서 털가죽 깃발을 던져 주었다. 국경 너머의 무인들이',
    trader: '낙타와 말을 끌고 마을 광장에 들어섰다. 털모자 아래 볕에 그은 얼굴들이 웃는다', goods: '산삼과 말, 털가죽', pack: '낙타 등', ride: '말', bell: '방울 소리',
    walk: '말을 끌고', cloak: '털가죽 망토', arm: '큰 칼', came: '내려왔소', rumor: '변경 쪽에서 내려온 나그네들이 수군거린다. {F}의 기마대가 고개 너머에 모였다고 한다.',
  },
  haerang: {
    envoy: '늑대 가죽을 두른 {F}의 사자가 뱃전에서 뛰어내려 외쳤다', law: '바다', road: '바다 건너의 뱃길', flag: '사자가 늑대 가죽 깃발을 던져 주었다. 바다 건너의 무리가',
    trader: '작은 배를 나루에 대고 짐을 부렸다. 바닷바람에 그은 얼굴들이 웃는다', goods: '산삼과 진주, 늑대 가죽', pack: '배', ride: '배', bell: '뱃노래',
    walk: '바닷바람에 그은 얼굴로', cloak: '늑대 가죽 망토', arm: '휜 칼', came: '바다를 건너왔소', rumor: '바닷가에서 올라온 나그네들이 수군거린다. {F}의 배들이 포구 너머에 모였다고 한다.',
  },
  yasu: {
    envoy: '짐승 가죽을 두른 {F}의 사자가 길들인 표범을 곁에 앉히고 외쳤다', law: '밀림', road: '남쪽 밀림의 길', flag: '사자가 짐승 가죽 깃발을 던져 주었다. 밀림의 사냥꾼들이',
    trader: '짐을 진 물소를 몰고 마을 광장에 들어섰다. 문신 새긴 팔뚝이 볕에 그을었다', goods: '산삼과 약초, 짐승 가죽', pack: '물소 등', ride: '물소', bell: '물소 방울 소리',
    walk: '길들인 표범을 데리고', cloak: '짐승 가죽 망토', arm: '긴 창', came: '밀림에서 올라왔소', rumor: '남쪽에서 올라온 나그네들이 수군거린다. {F}의 사냥꾼 무리가 밀림 어귀에 모였다고 한다.',
  },
};
const evLook = k => SAEOE_LOOK[k] || SAEOE_LOOK.steppe;
const OFFER_SAY = {
  jeong: F => `${F.leader.title}${pp(F.leader.title, '이/가')} 제자 둘을 데리고 찾아왔다.\n<q>강호가 어지럽소. 이 마을을 ${F.name}의 산하에 두면 사도의 무리도 함부로 넘보지 못할 것이오. 대신 매일 약간의 공물을 바치면 되오.</q>`,
  ma: F => `한밤중, ${F.name}의 가면을 쓴 사자가 영주관 처마 밑에 서 있었다. 경비는 아무도 그를 보지 못했다.\n<q>${F.name}에 충성을 맹세하라. 은자와 힘을 주겠다. 거절한다면… 달 없는 밤을 조심하는 게 좋을 것이다.</q>`,
  sega: F => `${F.leader.title}의 서찰을 든 집사가 비단 보자기를 풀었다.\n<q>가문의 이름 아래 드시지요. ${F.name}의 혼맥과 재물이 이 마을을 지킬 것입니다. 날마다 바치는 예물만 잊지 마시고요.</q>`,
  heuk: F => `밤늦게 ${F.name}의 장부꾼이 뒷문으로 들었다.\n<q>밤길은 우리가 지켜 드리지. 대신 장부 한 귀퉁이를 우리에게 내주시오. 관의 눈은 우리가 알아서 피하겠소.</q>`,
  sa: F => `검은 비단옷을 입은 ${F.leader.title}${pp(F.leader.title, '이/가')} 수하 열댓을 거느리고 영주관을 찾았다.\n<q>요즘 세상이 험하지 않소? 우리 ${F.name}의 비호를 받으시오. 매일 공물만 조금 내면, 산적 놈들은 얼씬도 못 할 거요.</q>`,
  saeoe: (F, k) => { const L = evLook(k); return `${L.envoy.replace('{F}', () => F.name)}.\n<q>${L.law}의 법은 힘이다. 우리 깃발 아래 서면 ${L.road}${pp(L.road, '이/가')} 열린다. 중원의 관리들처럼 장부를 들이밀지도 않는다.</q>`; },
  gwan: F => `${F.name}에서 관리가 관인 찍힌 문서를 들고 왔다.\n<q>이 마을을 관의 보호 아래 두고자 하오. 공물을 바치고 법도를 따르면 관병이 마을을 지킬 것이오.</q>`,
  sang: F => `${F.name}의 대행수가 주판을 내려놓았다.\n<q>우리 깃발을 거시지요. 길과 장부가 함께 열립니다.</q>`,
};
const OFFER_YES = {
  jeong: F => `${F.leader.title}${pp(F.leader.title, '이/가')} 고개를 끄덕이며 ${F.name}의 현판을 내렸다. 정파의 이름이 마을을 지켜 줄 것이다.`,
  ma: () => '가면 쓴 자가 낮게 웃으며 피로 쓴 서약서를 품에 넣었다. 마을 위로 붉은 그림자가 드리운다.',
  sega: F => `집사가 가문의 족자를 영주관 대청에 걸었다. 이제 ${F.name}의 이름이 이 마을을 감싼다.`,
  heuk: () => '장부꾼이 웃으며 장부에 마을 이름을 적었다. 그날 밤부터 낯선 그림자들이 마을 길목을 지킨다.',
  sa: F => `${F.leader.title}${pp(F.leader.title, '이/가')} 껄껄 웃으며 마을 어귀에 ${F.name}의 깃발을 꽂았다. 이제 이 마을을 건드리는 자는 ${F.name}${pp(F.name, '을/를')} 적으로 돌리는 셈이다.`,
  saeoe: (F, k) => `${evLook(k).flag} 이 마을을 형제로 부를 것이다.`,
  gwan: F => `관리가 관인을 꾹 눌러 찍었다. 영주관 문간에 ${F.name}의 방이 나붙었다.`,
  sang: F => `대행수가 주판알을 튕기며 웃었다. ${F.name}의 깃발이 장터에 올랐다.`,
};
// 카드 틀 (본문은 white-space: pre-line 이라 줄바꿈 없이 이어 쓴다)
function evCardBox(color, seal, head, rows) {
  const row = ([k, v]) => `<div style="display:flex;gap:8px"><span style="flex:none;width:40px;color:var(--ink-soft);font-family:var(--font-ui);font-size:11.5px;padding-top:2px">${k}</span><span style="min-width:0">${v}</span></div>`;
  return `<div style="display:flex;gap:10px;align-items:flex-start;margin-top:10px;padding:9px 10px;border:1px solid var(--paper-edge);border-left:4px solid ${color};border-radius:6px;background:rgba(255,255,255,0.32);white-space:normal;line-height:1.5;font-size:13.5px">`
    + `<div style="width:38px;height:38px;flex:none;border-radius:6px;display:grid;place-items:center;background:${color};color:#fff4e0;font-family:var(--font-display);font-size:22px">${seal}</div>`
    + `<div style="min-width:0;flex:1"><div style="font-family:var(--font-display);font-size:17px;line-height:1.3;margin-bottom:2px">${head}</div>${rows.map(row).join('')}</div></div>`;
}
// 갈림길 카드 하나: 문장, 계열, 대표 세력, 결말, 혜택, 공물, 이 길의 적(이름과 힘), 제5·6장 제목
function evRouteCard(c) {
  const C = CAMPS[c.camp], F = FACTIONS[c.fid];
  if (!C || !F) return '';
  const trib = Math.round((4 + popCount() * 0.25) * (c.tribute !== undefined ? c.tribute : C.tribute));
  const foes = (c.foes || []).filter(id => FACTIONS[id]).map(id => `<span style="white-space:nowrap">${evCrest(id)}${fName(id)} <small style="color:var(--ink-soft)">힘 ${JH.power(id)}</small></span>`).join(' ') || '없음';
  return evCardBox(C.color, `<span data-tip-title="${C.seal}">${C.seal}</span>`,
    `${C.name}의 길 <small style="font-family:var(--font-body);font-size:12px;color:var(--ink-soft)">(<span data-tip-title="${C.hanja}">${C.hanja}</span>) · ${F.name}</small>`,
    [['결말', `「${escapeHtml(c.title || '')}」`], ['혜택', escapeHtml(c.perkText || C.perkText)], ['공물', `매일 은자 ${trib}냥쯤`],
      ['적', foes], ['제5장', `「${escapeHtml(c.ch5 || '')}」`], ['제6장', `「${escapeHtml(c.ch6 || '')}」`]]);
}

// 강호 사건마다 붙는 것: jh(강호가 열린 뒤에만), camp(계열 가중치), who(대상 → { k, far })
Object.assign(EV, {
  offer: {
    title: d => `${fName(d.k)}의 포섭`, stamp: d => FACTIONS[d.k].hanja, tier: 'heavy', weight: 1, cd: 16,
    cond: () => (popCount() >= 18 || S.fame >= 40) && !S.occupation,
    who: () => evTarget(null, evOfferOk),
    init(d) {
      if (d.k) return FACTIONS[d.k] && JH.isAlive(d.k) && d.k !== S.vassal ? undefined : false;
      if (!evAim(d, this.who())) return false;
    },
    text: d => {
      const F = FACTIONS[d.k];
      let t = `${evCrest(d.k)}${(OFFER_SAY[F.camp] || OFFER_SAY.sang)(F, d.k)}\n\n산하가 되면 <em>${F.perk || '별다른 혜택이 없다'}</em>. 매일 공물로 은자 ${evTrib(d.k)}냥쯤을 바친다.`;
      if (d.special) t += '\n갈림길에서 고른 길이다. 선납 은자 100냥을 바치면 관계와 상관없이 산하에 든다.';
      if (S.vassal && S.vassal !== d.k) t += `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군을 배신하게 된다.`;
      return t;
    },
    choices: d => {
      const F = FACTIONS[d.k], ma = F.camp === 'ma' && !d.special;
      const out = [{ label: `${F.name}의 산하에 든다`, sub: `${d.special ? '선납 은자 -100 · ' : ''}${ma ? '은자 +150 · ' : ''}매일 공물 은자 ${evTrib(d.k)} · ${F.perk}`,
        ok: () => !d.special || S.res.silver >= 100,
        run: () => { if (d.special) S.res.silver -= 100; becomeVassal(d.k); if (ma) addRes('silver', 150); return (OFFER_YES[F.camp] || OFFER_YES.sang)(F, d.k); } }];
      if (ma) {
        out.push({ label: '거절한다', sub: `${F.name} 관계 -15 · 위협이 쌓인다`, run: () => { changeRel(d.k, -15); evThreat(d.k, 30); return '가면 쓴 자는 대답 없이 어둠 속으로 사라졌다. 바람이 차다.'; } });
        if (JH.isAlive('gwanbu')) out.push({ label: '관부에 고발한다', sub: `관부 +15 · 정파 이웃 +8 · ${F.name}의 원한`, run: () => {
          changeRel('gwanbu', 15); evCampNear('jeong', 8); changeRel(d.k, -40); evThreat(d.k, 70);
          return `현청에 고발장이 올라갔다. 관부와 정파는 마을을 다시 보게 되었지만, ${F.name}${pp(F.name, '은/는')} 결코 잊지 않을 것이다.`; } });
      } else out.push({ label: '정중히 사양한다', sub: `${F.name} 관계 -${d.special ? 2 : 4}`, run: () => { changeRel(d.k, d.special ? -2 : -4); return '<q>뜻이 그러하다면 어쩔 수 없지요.</q> 사자는 담담히 돌아갔다.'; } });
      return out.concat(evMapChoice(d.k));
    },
  },
  // 갈림길 (제4장): 이야기가 Events.queue('crossroads') 로 넣는다. 카드는 Story.routeCards(), 고르면 Story.chooseRoute
  crossroads: {
    title: '갈림길', stamp: '岐', tier: 'heavy', weight: 0, cd: 0, cond: () => false,
    init: () => (Array.isArray(hook(Story, 'routeCards')) ? undefined : false),
    text: () => {
      const cards = hook(Story, 'routeCards') || [];
      return `총관이 천하도를 펼쳐 놓고 이웃 계열의 깃발을 하나씩 짚는다. 이제 ${VN()}${pp(VN(), '이/가')} 걸을 길을 정할 때다. 갈림길(${EV_HJ.crossroads})이다.\n어느 깃발 아래 서면 그 계열의 혜택과 원군을 얻지만, 그 원수들과는 척을 진다. 계열을 고르면 그 세력이 포섭하러 사자를 보낸다.`
        + cards.map(evRouteCard).join('')
        + evCardBox('#6a5a48', '<span data-tip-title="獨">獨</span>', '홀로 서는 길',
          [['결말', '「천하제일촌」'], ['혜택', '공물도 원군도 없다. 누구의 원수도 아니다'], ['적', '가장 센 이웃 둘']]);
    },
    choices: () => {
      const cards = (hook(Story, 'routeCards') || []).filter(c => CAMPS[c.camp] && FACTIONS[c.fid]);
      const out = cards.map(c => {
        const C = CAMPS[c.camp], F = FACTIONS[c.fid], mine = S.vassal === c.fid;
        return { label: `${C.name}의 길 · ${F.name}`, sub: `결말 「${c.title || ''}」 · ${mine ? '이미 주군이다' : '포섭을 받으면 선납 은자 100'}`,
          run: () => { hook(Story, 'chooseRoute', c.camp);
            return mine ? `${F.name}의 깃발 아래 서기로 굳혔다. 이제 ${C.name}의 길을 걷는다.` : `${F.name}에 뜻을 전하는 사자를 보냈다. 곧 그들의 답이 올 것이다.`; } };
      });
      out.push({ label: '홀로 서겠소', sub: '독립 · 결말 「천하제일촌」', run: () => { hook(Story, 'chooseRoute', 'free'); return '누구의 깃발도 들지 않기로 했다. 이 마을의 이름은 이 마을이 지킨다.'; } });
      out.push({ label: '더 지켜보겠소', sub: '총관에게 다시 물으면 이 두루마리를 펼친다', run: () => null });
      return out.concat(evMapChoice(null));
    },
  },
  // ── JH 가 바로 넣는 두루마리 (하루 하나) ──
  // 이웃이 전쟁에 들었다: 양쪽 사신이 편을 들라 한다 { war }
  jh_war_sides: {
    title: d => { const w = JH.warById(d.war); return w ? w.name : '강호의 싸움'; }, stamp: '戰', tier: 'heavy', weight: 0, cd: 0, cond: () => false, jh: true,
    init: d => (JH.warById(d.war) ? undefined : false),
    text: d => {
      const w = JH.warById(d.war);
      if (!w) return '싸움은 이미 끝났다.';
      const A = w.a.map(evF).join('·'), B = w.b.map(evF).join('·');
      return `${A}${pp(evNames(w.a), '과/와')} ${B}${pp(evNames(w.b), '이/가')} 칼을 맞댔다. 전장은 ${evFrontText(w)}.\n양쪽에서 사신이 앞다투어 찾아와 마을의 지원을 청한다. 작은 몫이라도 보태면 전황이 기울고, 그 편은 고마워하며 반대편은 앙심을 품는다.\n\n힘: ${evNames(w.a)} ${Math.round(JH.sidePower(w, 'a'))} 대 ${evNames(w.b)} ${Math.round(JH.sidePower(w, 'b'))}`;
    },
    choices: d => {
      const w = JH.warById(d.war);
      if (!w) return [{ label: '확인', run: () => null }];
      const out = [];
      for (const s of ['a', 'b']) {
        const rep = w[s].find(id => JH.isNear(id)), o = s === 'a' ? 'b' : 'a';
        if (!rep) continue;
        const opts = { war: w.id, silver: 40, food: 40 };
        out.push({ label: `${evNames(w[s])} 편을 든다`, sub: `은자 -40 · 식량 -40 · ${evNames(w[s])} 관계 +5 · ${evNames(w[o])} 관계 -8 · 전황이 기운다`,
          ok: () => JH.canAct('support', rep, opts).ok,
          run: () => { const r = JH.act('support', rep, opts); if (!r.ok) return r.why;
            return `군량 수레가 ${fName(rep)} 진영으로 떠났다. ${evNames(w[s])}${pp(evNames(w[s]), '은/는')} 마을의 의리를 기억할 것이다.`; } });
      }
      out.push({ label: '어느 편도 들지 않는다', sub: '싸우는 이웃 관계 -2', run: () => {
        for (const id of w.a.concat(w.b)) if (JH.isNear(id)) changeRel(id, -2);
        return '사신들을 정중히 돌려보냈다. 양쪽 모두 마을을 기회주의자라 수군거린다.'; } });
      if (w.a.some(id => JH.isNear(id)) && w.b.some(id => JH.isNear(id)) && !w.scripted) {
        const c = JH.canAct('mediate', w.id);
        out.push({ label: '중재에 나선다', sub: c.ok ? '은자 -150 · 싸움이 멎는다 · 명성 +15 · 양쪽 관계 +5' : `은자 -150 · ${c.why}`,
          ok: () => JH.canAct('mediate', w.id).ok,
          run: () => { const r = JH.act('mediate', w.id); return r.ok ? `양쪽 장수를 한자리에 불러 술잔을 나누게 했다. ${r.text}` : r.why; } });
      }
      return out.concat(evMapChoice(w.id));
    },
  },
  // 동맹이 전쟁에 들었다 { war, f }
  jh_pact_call: {
    title: d => `${fName(d.f)}의 원군 요청`, stamp: '盟', tier: 'heavy', weight: 0, cd: 0, cond: () => false, jh: true,
    init: d => { const w = JH.warById(d.war); return w && JH.sideOf(w, d.f) && JH.isAlive(d.f) ? undefined : false; },
    text: d => {
      const w = JH.warById(d.war);
      if (!w) return '싸움은 이미 끝났다.';
      const foe = w[JH.sideOf(w, d.f) === 'a' ? 'b' : 'a'];
      return `동맹인 ${evF(d.f)}에서 피 묻은 전령이 달려왔다. ${w.name}에서 ${foe.map(evF).join('·')}${pp(evNames(foe), '과/와')} 맞붙었다고 한다.\n<q>맹약을 맺은 날의 술잔을 기억하시오. 지금 군량 한 수레, 칼 한 자루가 아쉽소.</q>\n돕지 않으면 관계가 식고, 관계가 30 아래로 떨어지면 동맹이 깨진다.`;
    },
    choices: d => {
      const w = JH.warById(d.war);
      if (!w) return [{ label: '확인', run: () => null }];
      const F = fName(d.f), foe = w[JH.sideOf(w, d.f) === 'a' ? 'b' : 'a'], opts = { war: w.id, silver: 80, food: 60 };
      return [
        { label: '군량과 은자를 보낸다', sub: `은자 -80 · 식량 -60 · ${F} 관계 +8 · ${evNames(foe)} 관계 -8 · 전황이 크게 기운다`,
          ok: () => JH.canAct('support', d.f, opts).ok,
          run: () => { const r = JH.act('support', d.f, opts); if (!r.ok) return r.why; changeRel(d.f, 3);
            return `수레 행렬이 ${F} 진영으로 떠났다. 전령이 땅에 이마를 대고 절했다.`; } },
        ...(EV_WAR_QUEST.includes(JH.campOf(d.f)) ? [{ label: '무사를 보내기로 약속한다', sub: `원군 의뢰가 붙는다(세력 창의 의뢰) · ${F} 관계 +3`,
          ok: () => !S.jh.quests.some(q => q.fid === d.f && q.kind === 'war'),
          run: () => { const q = JH.makeQuest(d.f, 'war'); changeRel(d.f, 3);
            return q ? `전령이 안도의 숨을 쉬었다. 세력 창의 의뢰에서 「${q.title}」에 보낼 무사를 고르면 된다.` : '전령은 고개를 끄덕였지만, 이미 싸움의 고비가 지난 듯하다.'; } }] : []),
        { label: '이번에는 돕지 못한다', sub: `${F} 관계 -8`, run: () => { changeRel(d.f, -8);
          return `전령이 굳은 얼굴로 돌아갔다. ${F}${pp(F, '은/는')} 이 일을 오래 기억할 것이다.`; } },
        ...evMapChoice(w.id),
      ];
    },
  },
  // 이웃이 멸문했다: 살아남은 이들이 마을로 온다 { f }
  jh_survivors: {
    title: d => `${fName(d.f)}의 생존자들`, stamp: d => FACTIONS[d.f].hanja, tier: 'gloomy', weight: 0, cd: 0, cond: () => false, jh: true,
    init: d => { if (!FACTIONS[d.f]) return false; if (d.n) return; d.n = rndi(3, 6); d.m = rndi(1, 2); },
    text: d => `${evF(d.f)}${pp(fName(d.f), '이/가')} 무너졌다. 본산이 불타던 밤, 살아남은 문도와 식솔 ${d.n}명이 마을 어귀까지 흘러왔다. 옷자락에는 아직 그을음이 묻어 있다.\n<q>갈 곳이 없습니다. 거두어 주신다면 칼이든 호미든 들겠습니다.</q>${evHousing(d.n)}`,
    choices: d => {
      const F = fName(d.f), bad = ['heuk', 'sa', 'ma'].includes(JH.campOf(d.f));
      return [
        { label: '받아들인다', sub: `사람 +${d.n}(무공을 아는 이 ${d.m === 1 ? '하나' : '둘'}) · 식량 -${d.n * 4} · 명성 +4 · ${F}의 벗은 반기고 원수는 눈살을 찌푸린다`,
          ok: () => S.res.food >= d.n * 4,
          run: () => { S.res.food -= d.n * 4; evArrive(d.n, d.m, evExit(d.f)); JH.relSpread(d.f, 10); addFame(4);
            return '생존자들이 무릎을 꿇고 울었다. 그들이 가져온 것은 낡은 깃발 하나와 본산의 이야기뿐이다.'; } },
        { label: '식량만 나눠 주고 보낸다', sub: '식량 -20 · 명성 +2', ok: () => S.res.food >= 20,
          run: () => { S.res.food -= 20; addFame(2); return '주먹밥을 받아 든 이들이 몇 번이고 절을 하고 떠났다.'; } },
        bad && JH.isAlive('gwanbu')
          ? { label: '관부에 넘긴다', sub: `관부 관계 +8 · 은자 +30 · ${F}의 벗들이 등을 돌린다`, run: () => { changeRel('gwanbu', 8); addRes('silver', 30); JH.relSpread(d.f, -6);
            return '포졸들이 생존자들을 줄줄이 묶어 갔다. 현청에서 상금이 내려왔다.'; } }
          : { label: '문을 닫아건다', sub: '아무 일도 없다', run: () => '생존자들은 한참을 문밖에 서 있다가 다른 길로 떠났다.' },
      ];
    },
  },
  // 이웃의 힘이 열흘 사이 +30 넘게 불었다 { f }
  jh_surge: {
    title: d => `${fName(d.f)}의 기세`, stamp: '勢', tier: 'hostile', weight: 0, cd: 0, cond: () => false, jh: true,
    init: d => { if (!JH.isAlive(d.f)) return false; if (d.g) return; d.g = Math.round(40 + JH.power(d.f) * 0.3); },
    text: d => {
      const F = FACTIONS[d.f], est = JH.raidEstimate(d.f);
      const head = F.noLord ? `${evF(d.f)}의 패거리가 부쩍 불었다. 산채 아래 마을마다 그 소문이 돈다.`
        : rel(d.f) >= 20 ? `${evF(d.f)}의 기세가 무섭게 오른다. 열흘 사이 문도가 크게 불었다. 사자가 찾아와 은근히 마을의 축하를 기다린다.`
          : `${evF(d.f)}의 기세가 무섭게 오른다. 찾아온 사자의 말투가 예전 같지 않다.\n<q>요즘 우리 ${F.name}${pp(F.name, '을/를')} 우습게 보는 자는 없소.</q>`;
      return `${head}\n\n힘 ${JH.power(d.f)}${est ? `, 쳐들어오면 약 ${est}명` : ''}. 지금 마을의 무력은 ${defensePower()}이다.`;
    },
    choices: d => {
      const F = fName(d.f), est = JH.raidEstimate(d.f);
      return [
        { label: '축하 예물을 보낸다', sub: `은자 -${d.g} · ${F} 관계 +10 · 위협이 가라앉는다`, ok: () => S.res.silver >= d.g,
          run: () => { S.res.silver -= d.g; changeRel(d.f, 10); evThreat(d.f, -25); return `예물 상자가 ${F}의 문턱을 넘었다. 사자의 입꼬리가 조금 풀렸다.`; } },
        { label: '무사들을 모아 위세를 보인다', sub: '무력이 충분하면 함부로 넘보지 못한다', ok: () => fighters().length > 0,
          run: () => {
            if (defensePower() >= Math.max(10, est * 2)) { addFame(6); evThreat(d.f, -15); return `무사들이 길목에 늘어서 창을 세웠다. ${F}의 정탐꾼이 슬그머니 물러갔다. 명성 +6.`; }
            evThreat(d.f, 15); changeRel(d.f, -3); return `어설픈 위세가 오히려 웃음거리가 되었다. ${F}${pp(F, '이/가')} 마을을 만만히 보기 시작한다.`; } },
        { label: '모른 척한다', sub: `${F} 관계 -4 · 위협이 쌓인다`, run: () => { changeRel(d.f, -4); evThreat(d.f, 10); return '못 들은 척 넘어갔다. 그 침묵이 어떻게 읽힐지는 모를 일이다.'; } },
        ...evMapChoice(d.f),
      ];
    },
  },
});

// ── 계열의 사건: 정파 ──
Object.assign(EV, {
  jeong_summons: {
    title: '무림맹 소집령', stamp: '盟', tier: 'light', jh: true, camp: 'jeong', weight: 0.55, cd: 18,
    cond: () => popCount() >= 15,
    who: () => evTarget('jeong', id => rel(id) > -30, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.n = 50 + popCount() * 2; d.m = JH.pickNear('ma') || ''; },
    text: d => `${evFrom(d)}${evF(d.k)}의 장로가 무림맹 소집령을 가져왔다. 붉은 인주가 찍힌 격문이다.\n<q>${d.m ? fName(d.m) : '마교'}의 무리가 날로 발호하니, 정파의 이름을 아는 마을이라면 힘을 보태 주시오. 은자든 병장기든 뜻만 있으면 되오.</q>`,
    choices: d => {
      const F = fName(d.k), back = () => { const w = JH.warOf(d.k); if (w) JH.addScore(w, JH.sideOf(w, d.k), 1); };
      return [
        { label: `은자 ${d.n}냥을 보탠다`, sub: `은자 -${d.n} · ${F} 관계 +10 · 명성 +6 · 정파의 벗은 반기고 마교·사파는 눈살을 찌푸린다`, ok: () => S.res.silver >= d.n,
          run: () => { S.res.silver -= d.n; changeRel(d.k, 10); JH.relSpread(d.k, 8); addFame(6); back();
            return `장로가 격문 끝에 ${VN()}의 이름을 적어 넣었다. 맹의 깃발 아래 마을의 이름이 오른다.`; } },
        { label: '병장기를 보낸다', sub: `병장기 -8 · ${F} 관계 +8 · 명성 +4`, ok: () => S.res.weapons >= 8,
          run: () => { S.res.weapons -= 8; changeRel(d.k, 8); JH.relSpread(d.k, 5); addFame(4); back(); return '창칼 꾸러미가 맹의 수레에 실렸다.'; } },
        { label: '정중히 거절한다', sub: `${F} 관계 -6`, run: () => { changeRel(d.k, -6); return '<q>정파의 일을 남의 일처럼 여기시는군.</q> 장로가 소매를 떨치고 일어섰다.'; } },
      ];
    },
  },
  jeong_knight: {
    title: '협객의 방문', stamp: '俠', tier: 'light', jh: true, camp: 'jeong', weight: 0.55, cd: 16,
    cond: () => true,
    who: () => evTarget('jeong', null, true),
    init(d) {
      if (d.k) return;
      if (!evAim(d, this.who())) return false;
      d.h = makeHero({ martial: clamp(2 + dayOf() / 40 + rnd(0, 1), 2, 5) }); d.h.hero.title = d.h.sex === 'f' ? '여협' : '협객';
      d.cost = Math.round(60 + d.h.martial * 50);
    },
    text: d => `${evFrom(d)}${evF(d.k)} 문하의 ${d.h.hero.title} ${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '이/가')} 마을에 들렀다. 경지는 <em>${realmOf(d.h.martial)}</em>쯤. 무관 마당에서 목검을 휘두르는 장정들을 한참 바라보더니 웃는다.\n<q>며칠 묵어 가도 되겠소? 밥값으로 저 친구들 자세나 좀 잡아 주리다.</q>`,
    choices: d => [
      { label: '극진히 대접하고 가르침을 청한다', sub: `식량 -20 · 은자 -20 · 나흘간 무사 수련이 빨라진다 · ${fName(d.k)} 관계 +5`, ok: () => S.res.food >= 20 && S.res.silver >= 20,
        run: () => { S.res.food -= 20; S.res.silver -= 20; addMod('manual', 4); changeRel(d.k, 5);
          return `${d.h.name}${pp(d.h.name, '이/가')} 나흘 동안 무관 마당에서 장정들의 발 디딤을 하나하나 고쳐 주었다.`; } },
      { label: '객경으로 모신다', sub: `은자 -${d.cost} · 매일 은자 ${d.h.hero.upkeep}냥 · ${fName(d.k)} 관계 +3`, ok: () => S.res.silver >= d.cost && evHeroes() < 6,
        run: () => { S.res.silver -= d.cost; spawnHero(d.h, World.exits[evExit(d.k)]); changeRel(d.k, 3); addFame(4);
          logMsg(`${d.h.hero.title} ${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '이/가')} 마을의 객경이 되었다.`, 'good');
          return `${d.h.name}${pp(d.h.name, '이/가')} 포권했다. <q>의를 아는 마을이라 들었소. 한동안 신세를 지겠소.</q>`; } },
      { label: '술 한 잔 대접하고 보낸다', sub: '은자 -5 · 명성 +1', run: () => { S.res.silver = Math.max(0, S.res.silver - 5); addFame(1); return '협객은 잔을 비우고 길을 떠났다.'; } },
    ],
  },
  // 정파의 감찰: 마교·사파·흑도와 가까우면 문책한다
  jeong_audit: {
    title: '정파의 감찰', stamp: '察', tier: 'hostile', jh: true, camp: 'jeong', weight: 0.5, cd: 20,
    cond: () => true,
    who: () => evTarget('jeong', id => rel(id) > -40),
    init(d) {
      if (d.k) return;
      if (!evAim(d, this.who())) return false;
      d.taint = FACTION_ORDER.filter(id => ['ma', 'sa', 'heuk'].includes(JH.campOf(id)) && JH.isAlive(id) && !FACTIONS[id].noLord
        && (rel(id) >= 25 || id === S.vassal || S.jh.pacts.includes(id))).slice(0, 3);
      d.fine = 60 + popCount();
    },
    text: d => `${evF(d.k)}에서 감찰 나온 장로가 영주관 대청에 앉았다. 제자 둘이 장부를 펼친다.\n`
      + (d.taint.length ? `<q>${evNames(d.taint)}${pp(evNames(d.taint), '과/와')} 가까이 지낸다는 말이 돌던데, 사실이오? 정파의 이웃으로서 해명을 들어야겠소.</q>`
        : '<q>요즘 사도의 무리와 손잡는 마을이 늘어 살피러 왔소. 숨길 것이 없다면 장부를 보여 주시오.</q>'),
    choices: d => {
      const F = fName(d.k);
      if (!d.taint.length) return [
        { label: '장부를 보여 준다', sub: `${F} 관계 +8 · 명성 +4`, run: () => { changeRel(d.k, 8); addFame(4); return '장로가 장부를 덮으며 고개를 끄덕였다. <q>깨끗한 마을이오. 그리 전하겠소.</q>'; } },
        { label: '대접만 하고 장부는 덮어 둔다', sub: `식량 -15 · ${F} 관계 -2`, ok: () => S.res.food >= 15, run: () => { S.res.food -= 15; changeRel(d.k, -2); return '장로는 상을 물리고 말없이 돌아갔다. 찜찜한 기색이다.'; } },
      ];
      return [
        { label: '사죄하고 벌금을 낸다', sub: `은자 -${d.fine} · ${F} 관계 +6`, ok: () => S.res.silver >= d.fine,
          run: () => { S.res.silver -= d.fine; changeRel(d.k, 6); return '벌금 상자를 받은 장로가 <q>다시는 이런 말이 들리지 않게 하시오</q> 하고 일어섰다.'; } },
        { label: '거래였을 뿐이라고 해명한다', sub: '명성이 높으면 통할지도 모른다', run: () => {
          if (Math.random() < clamp(0.25 + S.fame / 400, 0.25, 0.8)) { changeRel(d.k, 3); addFame(2); return '장로가 수염을 쓸며 고개를 끄덕였다. <q>세상 사는 일이 다 그렇지요.</q>'; }
          changeRel(d.k, -10); JH.relSpread(d.k, -6); return '장로의 얼굴이 굳었다. <q>말이 길수록 의심만 깊어지는 법이오.</q> 정파 사이에 좋지 않은 소문이 돈다.'; } },
        { label: '감찰을 내쫓는다', sub: `${F} 관계 -15 · 정파와 가까운 계열이 등을 돌린다`, run: () => { changeRel(d.k, -15); JH.relSpread(d.k, -10); evThreat(d.k, 20);
          return '무사들이 감찰을 문밖으로 떠밀었다. 정파의 장로가 이를 갈며 돌아갔다.'; } },
      ];
    },
  },
  // 비무 초청 → 사흘 뒤 jeong_duel_day
  jeong_duel: {
    title: '비무 초청', stamp: '比', tier: 'light', jh: true, camp: 'jeong', weight: 0.5, cd: 24,
    cond: () => fighters().length > 0 && !evPending('jeong_duel_day'),
    who: () => evTarget('jeong', id => rel(id) >= 0, true),
    init(d) {
      if (d.k) return;
      if (!evAim(d, this.who())) return false;
      const c = bestFighter();
      if (!c) return false;
      d.v = c.id; d.vn = c.name; d.who = `${c.hero ? c.hero.epithet + ' ' : '무사 '}${c.name}(${realmOf(c.martial)})`;
    },
    text: d => `${evFrom(d)}${evF(d.k)}에서 비무 초청장이 왔다. 사흘 뒤 산문 앞 연무장에서 젊은 고수들이 솜씨를 겨룬다고 한다.\n<q>귀 마을의 ${d.who}의 이름을 들었소. 한 수 가르침을 청하오.</q>`,
    choices: d => [
      { label: `${d.vn}${pp(d.vn, '을/를')} 보내겠다고 답한다`, sub: `사흘 뒤 비무 · 이기면 명성과 ${fName(d.k)} 관계가 오른다`,
        run: () => { evLater('jeong_duel_day', 72, { k: d.k, v: d.v, vn: d.vn }); changeRel(d.k, 2);
          return `답장을 보냈다. ${d.vn}${pp(d.vn, '이/가')} 말없이 칼을 갈기 시작한다.`; } },
      { label: '사양한다', sub: `${fName(d.k)} 관계 -2`, run: () => { changeRel(d.k, -2); return '정중한 사양의 답장을 보냈다.'; } },
    ],
  },
  jeong_duel_day: {
    title: '비무의 날', stamp: '比', tier: 'light', jh: true, camp: 'jeong', weight: 0, cd: 0, cond: () => false,
    init: d => {
      if (d.p !== undefined) return;
      if (!JH.isAlive(d.k)) return false;
      const v = S.villagers.find(x => x.id === d.v && !x.dead && !x.leaving && !x.away);
      if (!v) { d.p = 0; d.gone = true; return; }
      d.p = clamp(0.5 + (v.martial - (1.6 + dayOf() / 40)) * 0.25, 0.1, 0.9);
    },
    text: d => d.gone ? `${fName(d.k)}의 비무 날이 되었지만 ${d.vn}${pp(d.vn, '은/는')} 갈 수 없는 몸이다. 연무장에서 기다리던 이들이 혀를 찼다.`
      : `${evF(d.k)}의 산문 앞 연무장에 깃발이 올랐다. ${d.vn}${pp(d.vn, '이/가')} 단에 오르자 맞은편에서 젊은 고수가 포권한다. 구경꾼들이 숨을 죽인다.`,
    choices: d => {
      const F = fName(d.k);
      if (d.gone) return [{ label: '사과의 서신을 보낸다', sub: `${F} 관계 -6`, run: () => { changeRel(d.k, -6); return '약속을 어긴 셈이 되었다.'; } }];
      const v = () => S.villagers.find(x => x.id === d.v && !x.dead);
      return [
        { label: '전력으로 겨룬다', sub: `이길 가능성 ${Math.round(d.p * 100)}% · 이기면 명성 +15, 무공이 깊어진다`, run: () => {
          const c = v();
          if (!c) return `${d.vn}${pp(d.vn, '은/는')} 이미 마을에 없다.`;
          if (Math.random() < d.p) { addFame(15); changeRel(d.k, 6); c.martial = Math.min(S.martialCap + (c.hero ? 2.5 : 0), c.martial + 0.3); updateStats(c);
            logMsg(`${c.name}${pp(c.name, '이/가')} ${F}의 비무에서 이겼다.`, 'good');
            return `${c.name}${pp(c.name, '이/가')} 마지막 일 초로 상대의 목검을 쳐 냈다. 산문 앞에 박수가 터졌다. 명성 +15.`; }
          injure(c, 0.35); addFame(3); changeRel(d.k, 3);
          return `${c.name}${pp(c.name, '은/는')} 끝까지 버텼지만 한 끗이 모자랐다. 상대가 먼저 손을 내밀었다. 명성 +3.`; } },
        { label: '한 수 접어 주어 체면을 세워 준다', sub: `${F} 관계 +10 · 명성 +2`, run: () => { changeRel(d.k, 10); addFame(2);
          return `${d.vn}${pp(d.vn, '이/가')} 일부러 반 박자 늦게 칼을 거두었다. ${F}의 장로가 그 뜻을 알아보고 빙그레 웃었다.`; } },
      ];
    },
  },
});

// ── 계열의 사건: 마교 ──
Object.assign(EV, {
  ma_tribute: {
    title: '제물 요구', stamp: '貢', tier: 'hostile', jh: true, camp: 'ma', weight: 0.55, cd: 16,
    cond: () => true,
    who: () => evTarget('ma', id => rel(id) < 40),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.food = 40 + popCount(); d.silver = 50 + popCount() * 2; d.j = JH.pickNear('jeong') || ''; },
    text: d => `${evF(d.k)}의 사자가 붉은 천을 덮은 빈 수레를 끌고 왔다.\n<q>보름달 제사가 머지않았다. 이 마을도 제물을 바쳐라. 곡식 ${d.food}섬이든 은자 ${d.silver}냥이든. 신께서는 바친 자를 기억하시고, 바치지 않은 자는 더 오래 기억하신다.</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '곡식을 바친다', sub: `식량 -${d.food} · ${F} 관계 +8 · 위협이 가라앉는다`, ok: () => S.res.food >= d.food,
          run: () => { S.res.food -= d.food; changeRel(d.k, 8); evThreat(d.k, -35); return '곡식 가마니가 붉은 천 아래로 사라졌다. 사자가 만족스럽게 웃는다.'; } },
        { label: '은자를 바친다', sub: `은자 -${d.silver} · ${F} 관계 +8 · 위협이 가라앉는다`, ok: () => S.res.silver >= d.silver,
          run: () => { S.res.silver -= d.silver; changeRel(d.k, 8); evThreat(d.k, -35); return '은자 상자가 수레에 실렸다. 마을 사람들이 고개를 돌렸다.'; } },
        { label: '빈 수레로 돌려보낸다', sub: `${F} 관계 -12 · 위협이 크게 쌓인다`, run: () => {
          changeRel(d.k, -12); evThreat(d.k, 35);
          if (Math.random() < 0.35 && Events.raidWarning(d.k, 0.8)) return '<q>신께서 노하실 것이다.</q> 사자가 빈 수레를 끌고 돌아갔다. 그날 밤 붉은 횃불이 고개 너머에 모였다.';
          return '<q>신께서 노하실 것이다.</q> 사자가 빈 수레를 끌고 돌아갔다.'; } },
        ...(d.j && JH.isAlive(d.j) ? [{ label: `${fName(d.j)}에 알린다`, sub: `${fName(d.j)} 관계 +8 · ${F} 관계 -20 · 위협이 쌓인다`, run: () => {
          changeRel(d.j, 8); changeRel(d.k, -20); evThreat(d.k, 40); return `${fName(d.j)}에 기별을 넣었다. ${fName(d.j)}에서는 고맙다는 답이 왔지만, ${F}의 눈빛은 한층 사나워졌다.`; } }] : []),
      ];
    },
  },
  ma_manual: {
    title: '마공 비급의 유혹', stamp: '魔', tier: 'light', jh: true, camp: 'ma', weight: 0.45, cd: 30,
    cond: () => fighters().length >= 2,
    who: () => evTarget('ma', null, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.j = JH.pickNear(['jeong', 'sega']) || ''; },
    text: d => `한밤중 객방 창틈으로 검은 보자기 하나가 들어왔다. 펼쳐 보니 핏빛 먹으로 쓴 마공 구결이다. 끝에는 ${evF(d.k)}의 문장이 찍혀 있다.\n<q>익히면 열흘 만에 십 년 공력을 얻으리라. 값은 나중에 받겠다.</q>\n무사들이 침을 삼킨다. 정파가 알면 좋아할 리 없다.`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '무사들에게 익히게 한다', sub: `무사가 오를 수 있는 경지 +0.5 · 무사 전원 무공 상승 · ${F} 관계 +10 · 정파·관의 눈총`, run: () => {
          S.martialCap = Math.min(6, S.martialCap + 0.5); addMod('manual', 5);
          for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.35); updateStats(v); }
          changeRel(d.k, 10); JH.relSpread(d.k, 10);
          return '무사들의 눈에 붉은 기운이 돌기 시작했다. 힘은 늘었지만, 마을을 보는 강호의 눈길이 달라졌다.'; } },
        { label: '불태운다', sub: `${F} 관계 -8 · 정파 이웃 관계 +4 · 명성 +2`, run: () => { changeRel(d.k, -8); evCampNear('jeong', 4); addFame(2);
          return '비급이 화로 속에서 검은 연기를 뿜으며 타올랐다.'; } },
        ...(d.j && JH.isAlive(d.j) ? [{ label: `${fName(d.j)}에 바친다`, sub: `${fName(d.j)} 관계 +12 · 명성 +5 · ${F} 관계 -15`, run: () => {
          changeRel(d.j, 12); addFame(5); changeRel(d.k, -15); evThreat(d.k, 15); return `${fName(d.j)}에서 마공의 출처를 캐겠다며 비급을 받아 갔다.`; } }] : []),
      ];
    },
  },
  ma_spy_hunt: {
    title: '마교 첩자 색출', stamp: '諜', tier: 'hostile', jh: true, camp: 'ma', weight: 0.5, cd: 18,
    cond: () => popCount() >= 20,
    who: () => evTarget('ma', id => rel(id) < 30),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => `요즘 밤마다 우물가에 붉은 칠이 남는다. 포졸 출신 늙은이 하나가 귀띔한다.\n<q>${evF(d.k)}의 끄나풀이 마을 안에 숨어 있습니다. 사람들 사이에 섞여 날마다 무엇인가를 바깥에 전하고 있어요.</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '무사들을 풀어 색출한다', sub: '무사가 있어야 한다 · 잘못 짚으면 애꿎은 이가 떠난다', ok: () => fighters().length > 0, run: () => {
          if (Math.random() < clamp(0.4 + fighters().length * 0.05, 0.4, 0.8)) { evThreat(d.k, -40); changeRel(d.k, -6); addFame(4); evGwan(3);
            return `사흘 만에 끄나풀을 잡았다. 품에서 ${F}의 문장이 새겨진 쇳조각이 나왔다. 명성 +4.`; }
          const v = pick(civilians());
          if (v) { v.leaving = true; v.act = null; markDirty(); return `엉뚱한 사람을 의심했다. ${v.name}${pp(v.name, '이/가')} 억울함을 품고 마을을 떠났다.`; }
          return '끝내 아무도 잡지 못했다.'; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 맡긴다', sub: '은자 -30 · 관부 관계 +4 · 위협이 가라앉는다', ok: () => S.res.silver >= 30, run: () => {
          S.res.silver -= 30; changeRel('gwanbu', 4); evThreat(d.k, -20); return '포졸들이 며칠 마을을 들쑤시고 다녔다. 붉은 칠은 더 보이지 않는다.'; } }] : []),
        { label: '덮어 둔다', sub: `${F}의 위협이 쌓인다`, run: () => { evThreat(d.k, 20); return '소문은 소문일 뿐이라 여겼다.'; } },
      ];
    },
  },
  // 마교도의 은신 요청 → 며칠 뒤 ma_refuge_found (추격대)
  ma_refuge: {
    title: '마교도의 은신 요청', stamp: '隱', tier: 'light', jh: true, camp: 'ma', weight: 0.45, cd: 28,
    cond: () => !evPending('ma_refuge_found'),
    who: () => evTarget('ma', id => rel(id) > -50),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.n = rndi(2, 3); },
    text: d => `새벽 안개 속에서 ${evF(d.k)}의 교도 ${d.n === 2 ? '둘' : '셋'}이 피 묻은 몸으로 마을 어귀에 쓰러졌다. 쫓기는 몸이라 했다.\n<q>며칠만 숨겨 주시오. 이 은혜는 ${fName(d.k)}에서 반드시 갚소.</q>\n숨겨 주면 쫓는 자들이 언젠가 찾아올 것이다.`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '곳간 뒤에 숨겨 준다', sub: `식량 -20 · ${F} 관계 +12 · 며칠 뒤 쫓는 자들이 올 수 있다`, ok: () => S.res.food >= 20, run: () => {
          S.res.food -= 20; changeRel(d.k, 12); JH.relSpread(d.k, 6); evLater('ma_refuge_found', rndi(4, 6) * 24, { k: d.k });
          return '교도들이 곳간 뒤 짚더미 속으로 숨어들었다. 마을 사람들은 입을 다물기로 했다.'; } },
        { label: '내쫓는다', sub: `${F} 관계 -5`, run: () => { changeRel(d.k, -5); return '교도들은 서로를 부축하며 안개 속으로 사라졌다.'; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 넘긴다', sub: `관부 관계 +8 · 은자 +40 · ${F} 관계 -20`, run: () => {
          changeRel('gwanbu', 8); addRes('silver', 40); changeRel(d.k, -20); evThreat(d.k, 25); return '포졸들이 교도들을 끌고 갔다. 현청에서 상금이 내려왔다.'; } }] : []),
      ];
    },
  },
  ma_refuge_found: {
    title: '추격대', stamp: '追', tier: 'hostile', jh: true, camp: 'ma', weight: 0, cd: 0, cond: () => false,
    init: d => {
      if (d.j) return;
      d.j = JH.pickNear(['jeong', 'gwan'], id => FACTIONS[id].military) || '';
      if (!d.j) return false;
      d.cost = 60 + dayOf();
    },
    text: d => `${evF(d.j)}의 추격대가 마을 문을 두드렸다. 앞장선 이가 칼끝으로 곳간 쪽을 가리킨다.\n<q>${fName(d.k)}의 마두들이 이 마을로 숨어들었다는 걸 알고 왔소. 순순히 내놓으시오.</q>`,
    choices: d => {
      const J = fName(d.j), F = fName(d.k);
      return [
        { label: '내준다', sub: `${J} 관계 +8 · ${F} 관계 -20 · ${F}의 위협이 쌓인다`, run: () => { changeRel(d.j, 8); changeRel(d.k, -20); evThreat(d.k, 30);
          return '추격대가 교도들을 묶어 끌고 갔다. 곳간 뒤에 핏자국만 남았다.'; } },
        { label: '모르는 일이라 버틴다', sub: '무력이 충분하면 물러간다', run: () => {
          if (defensePower() >= 15 + dayOf() * 0.6) { changeRel(d.j, -8); changeRel(d.k, 10); addFame(3);
            return `추격대가 마을의 무사들을 훑어보더니 침을 뱉고 돌아섰다. 숨어 있던 교도들이 그날 밤 조용히 떠나며 ${F}의 영패 하나를 남겼다.`; }
          changeRel(d.j, -15);
          if (Events.raidWarning(d.j, 0.6, { goal: 'punish' })) return '추격대가 이를 갈며 물러갔다. 본진을 이끌고 다시 올 기세다.';
          return '추격대가 이를 갈며 물러갔다.'; } },
        { label: '은자로 입을 막는다', sub: `은자 -${d.cost} · ${J} 관계 -3`, ok: () => S.res.silver >= d.cost, run: () => {
          S.res.silver -= d.cost; changeRel(d.j, -3); changeRel(d.k, 5); return '추격대장이 은자 주머니를 받아 들고 못 본 척 말머리를 돌렸다.'; } },
      ];
    },
  },
});

// ── 계열의 사건: 무림세가 ──
const evArt = k => ({ spear: '창법', blade: '도법', sword: '검법', staff: '곤법', fist: '권법', axe: '부법', bow: '궁술' }[(FACTIONS[k].unit || {}).weapon] || '검법');
Object.assign(EV, {
  // 혼담: 받아들이면 관계 +20, 동맹의 명성 조건이 빠지고(S.flags['pact_nofame_' + k]), 가문 무인이 객경으로 온다 (세가 갈래 제5장)
  // 이야기가 Events.queue('sega_marriage', { k }) 로 직접 넣을 수도 있다
  sega_marriage: {
    title: '혼담', stamp: '婚', tier: 'light', jh: true, camp: 'sega', weight: 0.45, cd: 30,
    cond: () => popCount() >= 25 || S.fame >= 50,
    who: () => evTarget('sega', id => rel(id) >= 10 && !S.flags['pact_nofame_' + id], true),
    init(d) {
      if (d.h) return;
      if (d.k) { if (!FACTIONS[d.k] || !JH.isAlive(d.k)) return false; } else if (!evAim(d, this.who())) return false;
      d.h = makeHero({ upkeepMul: 0.6 });
      if (d.h.sex === 'm') d.h.hero.title = { spear: '창객', blade: '도객', fist: '권사' }[(FACTIONS[d.k].unit || {}).weapon] || '검객';
    },
    text: d => `${evFrom(d)}${evF(d.k)}에서 매파가 비단 보자기에 싼 사주단자를 들고 왔다.\n<q>가주의 조카 되는 분이 혼기가 찼습니다. 영주 댁 사람과 맺어 두 집안이 한집안처럼 지내면 어떻겠습니까? 혼례를 올리면 가문의 무인 하나를 객경으로 보내 드리지요.</q>\n혼맥으로 맺어지면 동맹을 맺을 때 명성을 따지지 않는다.`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '혼담을 받아들인다', sub: `은자 -60(예단) · ${F} 관계 +20 · 동맹의 명성 조건이 빠진다 · 가문 무인이 객경으로 온다`, ok: () => S.res.silver >= 60,
          run: () => {
            S.res.silver -= 60; changeRel(d.k, 20); S.flags['pact_nofame_' + d.k] = true; S.flags.marriage = d.k; addMod('wedding', 3); addFame(5);
            let t = `사주단자가 오가고 혼례 날이 잡혔다. 청사초롱 아래 두 집안이 맞절을 했다. 이제 ${F}${pp(F, '은/는')} 남이 아니다.`;
            if (evHeroes() < 6) {
              const v = spawnHero(d.h, World.exits[evExit(d.k)]);
              logMsg(`${F}에서 보낸 ${v.hero.title} ${v.hero.epithet} ${v.name}${pp(v.name, '이/가')} 객경으로 왔다.`, 'good');
              t += `\n가문의 ${v.hero.title} ${v.hero.epithet} ${v.name}${pp(v.name, '이/가')} 혼행을 따라와 객경으로 남았다.`;
            }
            return t; } },
        { label: '정중히 물린다', sub: `${F} 관계 -5`, run: () => { changeRel(d.k, -5); return '매파가 보자기를 다시 싸며 아쉬운 한숨을 쉬었다.'; } },
      ];
    },
  },
  // 후계 다툼 → 열흘 뒤 sega_heir_result
  sega_heir: {
    title: '후계 다툼', stamp: '嗣', tier: 'light', jh: true, camp: 'sega', weight: 0.45, cd: 30,
    cond: () => !evPending('sega_heir_result'),
    who: () => evTarget('sega', null, true),
    init(d) {
      if (d.k) return;
      if (!evAim(d, this.who())) return false;
      const sur = fName(d.k).replace(/세가$/, '');
      d.a = sur + pick(GIVEN_M) + pick(GIVEN_M); d.b = sur + pick(GIVEN_M);
    },
    text: d => `${evFrom(d)}${evF(d.k)}의 늙은 가주가 자리에 누웠다. 맏아들 ${d.a}${pp(d.a, '과/와')} 둘째 ${d.b}${pp(d.b, '이/가')} 서로 후계를 다툰다. 두 사람이 따로 사람을 보내 ${VN()}의 지지를 청한다.\n<q>가문의 주인이 바뀌는 날, 누가 곁에 있었는지 잊지 않을 것입니다.</q>\n열흘 뒤면 승부가 난다.`,
    choices: d => {
      const F = fName(d.k), back = side => () => { S.res.silver -= 60; evLater('sega_heir_result', 240, { k: d.k, side, a: d.a, b: d.b });
        return `${side === 'a' ? d.a : d.b}의 사람에게 은자 상자를 들려 보냈다. 이제 열흘을 기다릴 일이다.`; };
      return [
        { label: `맏아들 ${d.a}${pp(d.a, '을/를')} 민다`, sub: `은자 -60 · 열흘 뒤 결과 · 이기면 ${F} 관계 크게 오름`, ok: () => S.res.silver >= 60, run: back('a') },
        { label: `둘째 ${d.b}${pp(d.b, '을/를')} 민다`, sub: `은자 -60 · 열흘 뒤 결과 · 이기면 ${F} 관계 크게 오름`, ok: () => S.res.silver >= 60, run: back('b') },
        { label: '남의 집안일이다', sub: '아무 일도 없다', run: () => '두 사자를 똑같이 대접해 돌려보냈다.' },
      ];
    },
  },
  sega_heir_result: {
    title: '새 가주', stamp: '嗣', tier: 'light', jh: true, camp: 'sega', weight: 0, cd: 0, cond: () => false,
    init: d => { if (d.won !== undefined) return; if (!JH.isAlive(d.k)) return false; d.won = Math.random() < (d.side === 'a' ? 0.55 : 0.45); },
    text: d => {
      const mine = d.side === 'a' ? d.a : d.b, other = d.side === 'a' ? d.b : d.a, F = fName(d.k);
      return d.won ? `${evF(d.k)}의 후계 다툼이 끝났다. ${mine}${pp(mine, '이/가')} 가주의 인장을 물려받았다. 새 가주가 ${VN()}에 감사의 서찰과 은자 상자를 보냈다.`
        : `${evF(d.k)}의 후계 다툼이 끝났다. ${other}${pp(other, '이/가')} 가주가 되었고, 마을이 밀었던 ${mine}${pp(mine, '은/는')} 먼 별채로 물러났다. 새 가주는 ${VN()}의 이름을 차갑게 기억한다.\n${F}의 집사가 조용히 덧붙인다. <q>지금이라도 예를 갖추시면 마음이 풀리실지도 모릅니다.</q>`;
    },
    choices: d => {
      const F = fName(d.k);
      if (d.won) return [{ label: '감사히 받는다', sub: `은자 +120 · ${F} 관계 +20`, run: () => { addRes('silver', 120); changeRel(d.k, 20); JH.relSpread(d.k, 6); return '새 가주의 서찰이 영주관 대청에 걸렸다.'; } }];
      return [
        { label: '축하 예물을 보내 달랜다', sub: `은자 -40 · ${F} 관계 -8`, ok: () => S.res.silver >= 40, run: () => { S.res.silver -= 40; changeRel(d.k, -8); return '새 가주가 예물을 받기는 했다. 웃음은 없었다.'; } },
        { label: '그냥 둔다', sub: `${F} 관계 -18`, run: () => { changeRel(d.k, -18); return '편을 잘못 든 값을 치르게 되었다.'; } },
      ];
    },
  },
  sega_manual: {
    title: '비급 거래', stamp: '譜', tier: 'light', jh: true, camp: 'sega', weight: 0.45, cd: 26,
    cond: () => fighters().length > 0 && S.res.silver >= 100,
    who: () => evTarget('sega', id => rel(id) >= 0, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.cost = 140 + dayOf() * 2; d.art = evArt(d.k); },
    text: d => `${evFrom(d)}${evF(d.k)}의 집사가 기름종이에 싼 책 한 권을 내밀었다. 가문 방계에 전하던 ${d.art} 초식을 적은 것이라 한다.\n<q>본가의 비전은 아니지만 장정들 익히기에는 넘칩니다. 값만 맞으면 넘기지요.</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: `은자 ${d.cost}냥에 산다`, sub: `은자 -${d.cost} · 무사가 오를 수 있는 경지 +0.5 · 무사 전원 무공 상승 · ${F} 관계 +4`, ok: () => S.res.silver >= d.cost, run: () => {
          S.res.silver -= d.cost; S.martialCap = Math.min(6, S.martialCap + 0.5); addMod('manual', 6); changeRel(d.k, 4);
          for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.3); updateStats(v); }
          return `무관 벽에 ${d.art} 초식도가 걸렸다. 무사들이 새벽부터 발을 맞춘다.`; } },
        { label: '우리 무관의 수련법과 바꾸자고 한다', sub: `무관이 있어야 한다 · ${F}${pp(F, '과/와')} 사이가 좋으면 받아들인다`, ok: () => hasUsable('dojo'), run: () => {
          if (rel(d.k) >= 30) { S.martialCap = Math.min(6, S.martialCap + 0.3); changeRel(d.k, 6); for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.2); updateStats(v); }
            return '집사가 무관의 수련 장부를 넘겨보더니 흔쾌히 맞바꾸었다.'; }
          changeRel(d.k, -3); return '집사가 코웃음을 쳤다. <q>시골 무관의 몸풀기와 바꾸자고요?</q>'; } },
        { label: '사양한다', run: () => '집사는 책을 다시 품에 넣었다.' },
      ];
    },
  },
  sega_banquet: {
    title: '가문의 잔치', stamp: '宴', tier: 'light', jh: true, camp: 'sega', weight: 0.5, cd: 18,
    cond: () => true,
    who: () => evTarget('sega', id => rel(id) >= 5, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.g = 40 + popCount(); },
    text: d => `${evFrom(d)}${evF(d.k)}에서 청첩이 왔다. 가주의 회갑 잔치에 강호의 이름 있는 이들이 모인다고 한다.\n<q>귀한 걸음 해 주시면 가문의 영광이겠습니다.</q>`,
    choices: d => {
      const F = fName(d.k), half = Math.round(d.g / 2);
      return [
        { label: '예물을 갖춰 참석한다', sub: `은자 -${d.g} · ${F} 관계 +8 · 명성 +6 · 세가의 벗들이 조금 반긴다`, ok: () => S.res.silver >= d.g,
          run: () => { S.res.silver -= d.g; changeRel(d.k, 8); JH.relSpread(d.k, 4); addFame(6); return '잔칫상 끝자리에서 강호의 이름난 이들과 술잔을 나누었다. 명성 +6.'; } },
        { label: '예물만 보낸다', sub: `은자 -${half} · ${F} 관계 +4`, ok: () => S.res.silver >= half, run: () => { S.res.silver -= half; changeRel(d.k, 4); return '예물 상자에 축하 글을 곁들여 보냈다.'; } },
        { label: '바쁘다고 사양한다', sub: `${F} 관계 -3`, run: () => { changeRel(d.k, -3); return '빈자리가 하나 생겼다는 말이 돌았다.'; } },
      ];
    },
  },
});

// ── 계열의 사건: 흑도 ──
Object.assign(EV, {
  // 밀수 제안 → 닷새 뒤 heuk_smuggle_due (짐을 찾으러 오거나, 관에 들킨다)
  heuk_smuggle: {
    title: '밀수 제안', stamp: '密', tier: 'light', jh: true, camp: 'heuk', weight: 0.5, cd: 22,
    cond: () => !evPending('heuk_smuggle_due'),
    who: () => evTarget('heuk', evMil),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.pay = 60 + popCount() * 2; },
    text: d => `${evF(d.k)}의 장부꾼이 웃는 얼굴로 찾아왔다.\n<q>짐 몇 바리를 닷새만 맡아 주시오. 무엇이 들었는지는 묻지 않는 게 서로 좋소. 맡아 주면 은자 ${d.pay}냥, 찾아갈 때 또 그만큼 드리리다.</q>\n관의 눈에 띄면 곤란하다.`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '곳간 구석을 내준다', sub: `은자 +${d.pay} · ${F} 관계 +6 · 닷새 뒤 짐을 찾으러 온다 · 관에 들킬 수 있다`, run: () => {
          addRes('silver', d.pay); changeRel(d.k, 6); evLater('heuk_smuggle_due', 120, { k: d.k, pay: d.pay });
          return '거적을 덮은 짐이 곳간 구석에 쌓였다. 무엇이 들었는지는 아무도 묻지 않았다.'; } },
        { label: '거절한다', sub: `${F} 관계 -4`, run: () => { changeRel(d.k, -4); return '<q>아쉽구려. 다른 마을은 말이 잘 통하던데.</q>'; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 알린다', sub: `관부 관계 +8 · ${F} 관계 -15 · ${F}의 위협이 쌓인다`, run: () => {
          changeRel('gwanbu', 8); changeRel(d.k, -15); evThreat(d.k, 25); return '장부꾼이 포졸들에게 끌려가며 마을을 노려보았다.'; } }] : []),
      ];
    },
  },
  heuk_smuggle_due: {
    title: '맡은 짐', stamp: '密', tier: 'hostile', jh: true, camp: 'heuk', weight: 0, cd: 0, cond: () => false,
    init: d => {
      if (d.how) return;
      d.how = !JH.isAlive(d.k) ? 'orphan' : Math.random() < 0.35 && JH.isAlive('gwanbu') ? 'caught' : 'ok';
      d.bribe = 50 + dayOf();
    },
    text: d => d.how === 'caught' ? '짐을 찾으러 올 날, 먼저 들이닥친 것은 관부의 포교들이었다. 곳간 구석의 짐을 풀자 소금 가마와 활촉 상자가 쏟아졌다.\n<q>밀수품을 숨겨 준 죄가 가볍지 않소.</q>'
      : d.how === 'orphan' ? `짐을 맡긴 ${evF(d.k)}${pp(fName(d.k), '은/는')} 이미 무너졌다. 곳간 구석에 주인 잃은 짐만 남았다.`
        : `${evF(d.k)}의 짐꾼들이 밤중에 와서 짐을 실어 갔다. 장부꾼이 약속한 은자 꾸러미를 내려놓는다.\n<q>역시 말이 통하는 분이오. 또 부탁하리다.</q>`,
    choices: d => {
      const F = fName(d.k);
      if (d.how === 'ok') return [{ label: '은자를 받는다', sub: `은자 +${d.pay} · ${F} 관계 +6`, run: () => { addRes('silver', d.pay); changeRel(d.k, 6); return '아무 일도 없었던 듯 밤이 지나갔다.'; } }];
      if (d.how === 'orphan') return [
        { label: '짐을 풀어 쓴다', sub: '병장기 +12 · 은자 +40', run: () => { addRes('weapons', 12); addRes('silver', 40); return '거적 아래에서 활촉과 은자 몇 꾸러미가 나왔다.'; } },
        { label: '관부에 바친다', sub: '관부 관계 +6 · 명성 +2', run: () => { if (JH.isAlive('gwanbu')) changeRel('gwanbu', 6); addFame(2); return '포졸들이 짐을 실어 갔다.'; } },
      ];
      return [
        { label: '뇌물로 입을 막는다', sub: `은자 -${d.bribe} · 관부 관계 -3`, ok: () => S.res.silver >= d.bribe, run: () => { S.res.silver -= d.bribe; changeRel('gwanbu', -3); return '포두가 은자를 소매에 넣고 짐 몇 개만 압수해 갔다.'; } },
        { label: '밀수꾼의 짓이라 밝힌다', sub: `관부 관계 +4 · ${F} 관계 -20 · ${F}의 위협이 쌓인다`, run: () => { changeRel('gwanbu', 4); changeRel(d.k, -20); evThreat(d.k, 30);
          return `포교들이 ${F}의 은신처를 덮치러 떠났다. 장부꾼이 이 일을 잊지 않을 것이다.`; } },
        { label: '모른다고 버틴다', sub: '관부 관계 -15 · 명성 -5', run: () => { changeRel('gwanbu', -15); addFame(-5); return '포교들이 짐을 몽땅 압수하고 마을 이름을 장부에 적어 갔다.'; } },
      ];
    },
  },
  heuk_fence: {
    title: '장물 거래', stamp: '贓', tier: 'light', jh: true, camp: 'heuk', weight: 0.5, cd: 14,
    cond: () => true,
    who: () => evTarget('heuk'),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.n = rndi(12, 20); d.cost = Math.round(d.n * 2.6); d.src = JH.pickNear(['sang', 'sega', 'jeong']) || ''; },
    text: d => `${evF(d.k)}의 사내가 거적 덮은 수레를 끌고 왔다. 들춰 보니 번쩍이는 창칼이 그득하다.\n<q>반값이오, 반값. 어디서 났는지는 묻지 마시고.</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '병장기를 산다', sub: `은자 -${d.cost} · 병장기 +${d.n} · ${F} 관계 +4 · 장물이라 뒤탈이 날 수 있다`, ok: () => S.res.silver >= d.cost, run: () => {
          S.res.silver -= d.cost; addRes('weapons', d.n); changeRel(d.k, 4); evGwan(-2);
          if (d.src && JH.isAlive(d.src) && Math.random() < 0.3) { changeRel(d.src, -8); return `칼자루마다 ${fName(d.src)}의 표식이 찍혀 있었다. ${fName(d.src)}${pp(fName(d.src), '이/가')} 이 일을 알게 되었다.`; }
          return '창칼이 무관 창고로 옮겨졌다. 출처는 묻지 않기로 했다.'; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 고발한다', sub: `관부 관계 +6 · ${F} 관계 -10 · ${F}의 위협이 쌓인다`, run: () => {
          changeRel('gwanbu', 6); changeRel(d.k, -10); evThreat(d.k, 20); return '포졸들이 수레째 끌고 갔다.'; } }] : []),
        { label: '돌려보낸다', run: () => '사내는 어깨를 으쓱하고 다음 마을로 수레를 끌었다.' },
      ];
    },
  },
  // 수적·해적 (봉래 해안·민강 포구는 고을 성질로 두 배)
  pirates: {
    title: '수적 출몰', stamp: '寇', tier: 'hostile', jh: true, camp: ['heuk', 'saeoe'], weight: 0.6, cd: 12,
    cond: () => countType('fishery') > 0 || JH.biome().water >= 0.6,
    who: () => evTarget(['heuk', 'saeoe'], id => id === 'heuksu' || id === 'haerang'),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.toll = 30 + dayOf() * 2; d.loss = 30 + popCount(); },
    text: d => `${d.k === 'haerang' ? '바다' : '강'} 쪽에서 북소리가 울렸다. ${evF(d.k)}의 배 몇 척이 물가에 닻을 내렸다. 두목이 뱃전에서 소리친다.\n<q>이 물길은 우리 것이다. 고기를 잡고 싶으면 은자 ${d.toll}냥을 내놓아라!</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '통행세를 낸다', sub: `은자 -${d.toll} · ${F} 관계 +4 · 위협이 가라앉는다`, ok: () => S.res.silver >= d.toll,
          run: () => { S.res.silver -= d.toll; changeRel(d.k, 4); evThreat(d.k, -25); return '은자 주머니를 받은 배들이 물살을 가르며 떠났다.'; } },
        { label: '무사들로 물가를 지킨다', sub: '무사가 둘 이상 있어야 한다', ok: () => fighters().length >= 2, run: () => {
          if (defensePower() >= 10 + dayOf() * 0.7) { addFame(8); changeRel(d.k, -8); return '무사들이 물가에 늘어서자 배들이 뱃머리를 돌렸다. 명성 +8.'; }
          S.res.food = Math.max(0, S.res.food - d.loss); for (const f of fighters().slice(0, 2)) injure(f, 0.35); evThreat(d.k, 20);
          return `${F}의 무리가 거칠었다. 어장의 고기와 그물을 털어 갔고 무사 둘이 다쳤다.`; } },
        { label: '배를 묶고 숨는다', sub: `식량 -${d.loss}`, run: () => { S.res.food = Math.max(0, S.res.food - d.loss); return '물가의 덕장과 그물을 털어 간 뒤에야 배들이 떠났다.'; } },
      ];
    },
  },
  heuk_assassin: {
    title: '살수의 제안', stamp: '刺', tier: 'heavy', jh: true, camp: 'heuk', weight: 0.4, cd: 26,
    cond: () => !!EV.heuk_assassin.mark(),
    who: () => evTarget('heuk', id => id === 'hyeolyeong' || id === 'gwiyeong', true),
    // 노릴 상대: 사이가 나쁜 이웃
    mark: () => JH.pickNear(null, id => FACTIONS[id].military && rel(id) < -25 && id !== S.vassal && !S.jh.pacts.includes(id) && id !== 'hyeolyeong' && id !== 'gwiyeong'),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.t = this.mark(); if (!d.t) return false; d.cost = 120 + dayOf() * 2; },
    text: d => `객잔 구석 자리에 갓을 깊이 눌러쓴 사내가 앉아 있었다. 탁자 위에 ${evF(d.k)}의 문장이 새겨진 동전 하나를 올려놓는다.\n<q>${fName(d.t)}${pp(fName(d.t), '이/가')} 요즘 영주를 괴롭힌다지요. 은자 ${d.cost}냥이면 그쪽 간부 하나가 조용히 사라집니다. 흔적은 남지 않소.</q>`,
    choices: d => {
      const F = fName(d.k), T = fName(d.t);
      return [
        { label: '의뢰한다', sub: `은자 -${d.cost} · 성공하면 ${T}의 위협이 사라진다 · 들키면 원한을 산다 · 관 계열 관계 -4`, ok: () => S.res.silver >= d.cost, run: () => {
          S.res.silver -= d.cost; evGwan(-4); changeRel(d.k, 6);
          if (!JH.isAlive(d.t)) return '살수가 돌아와 은자를 내려놓았다. 노릴 상대가 이미 사라졌다고 한다.';
          if (Math.random() < 0.65) { S.factions[d.t].threat = 0; JH.news(`${T}의 간부 하나가 한밤중에 목숨을 잃었다. 범인은 아무도 모른다.`, 'event', [d.t]);
            return `보름 뒤, ${T}의 간부가 침상에서 숨진 채 발견되었다는 소문이 돌았다. ${T}의 무리가 한동안 잠잠해졌다.`; }
          changeRel(d.t, -20); evThreat(d.t, 40); return `살수가 붙잡혔다. 입을 열었는지는 모르지만 ${T}의 눈빛이 이쪽을 향한다.`; } },
        { label: '거절한다', run: () => '사내는 동전을 거두어 어둠 속으로 사라졌다.' },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 알린다', sub: `관부 관계 +6 · ${F} 관계 -12`, run: () => { changeRel('gwanbu', 6); changeRel(d.k, -12); evThreat(d.k, 15);
          return '포졸들이 객잔을 덮쳤지만 사내는 이미 사라진 뒤였다.'; } }] : []),
      ];
    },
  },
});

// ── 계열의 사건: 사파 ──
Object.assign(EV, {
  // 이웃 사파·흑도의 보호비 (옛 gang_protection 을 계열로 넓혔다)
  protection: {
    title: d => `${fName(d.k)}의 보호비`, stamp: d => FACTIONS[d.k].hanja, tier: 'hostile', camp: ['sa', 'heuk'], weight: 0.8, cd: 14,
    cond: () => dayOf() >= 5 && popCount() >= 12,
    who: () => evTarget(['sa', 'heuk'], id => evMil(id) && id !== S.vassal && rel(id) > -50),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => { const F = FACTIONS[d.k]; return `검은 비단옷을 입은 ${evF(d.k)}의 ${F.leader.title}${pp(F.leader.title, '이/가')} 수하 열댓을 거느리고 영주관을 찾았다.\n<q>요즘 세상이 험하지 않소? 우리 ${F.name}의 비호를 받으시오. 매일 공물만 조금 내면, 산적 놈들은 얼씬도 못 할 거요.</q>${S.vassal ? `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군을 배신하게 된다.` : ''}`; },
    choices: d => {
      const F = FACTIONS[d.k];
      return [
        { label: `${F.name}의 비호를 받는다`, sub: `산하 마을이 됨 · 매일 공물 은자 ${evTrib(d.k)} · ${F.perk}`, run: () => { becomeVassal(d.k);
          return `${F.leader.title}${pp(F.leader.title, '이/가')} 껄껄 웃으며 마을 어귀에 ${F.name}의 깃발을 꽂았다. 이제 이 마을을 건드리는 자는 ${F.name}${pp(F.name, '을/를')} 적으로 돌리는 셈이다.`; } },
        { label: '술과 음식으로 대접해 돌려보낸다', sub: `식량 -30 · ${F.name} 관계 +5`, ok: () => S.res.food >= 30,
          run: () => { S.res.food -= 30; changeRel(d.k, 5); return '배불리 먹고 마신 우두머리는 기분 좋게 돌아갔다. 대답은 다음으로 미뤄졌다.'; } },
        { label: '단호히 거절한다', sub: `${F.name} 관계 -20 · 위협이 쌓인다`, run: () => { changeRel(d.k, -20); evThreat(d.k, 40);
          return '<q>호의를 무시하다니. 기억해 두겠소.</q> 우두머리의 눈빛이 싸늘하게 식었다.'; } },
      ];
    },
  },
  sa_gambling: {
    title: '투전판 제안', stamp: '賭', tier: 'light', jh: true, camp: 'sa', weight: 0.5, cd: 20,
    cond: () => popCount() >= 20 && countType('gambling', false) === 0,
    who: () => evTarget('sa', id => rel(id) > -20),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.cut = 70 + popCount() * 2; },
    text: d => `${evF(d.k)}의 향주가 주사위 두 알을 손바닥에서 굴리며 말했다.\n<q>객잔 뒷방 하나만 내주시오. 투전판을 열면 사람이 모이고 은자가 돌지. 판돈의 몫은 영주께도 넉넉히 드리리다.</q>`,
    choices: d => {
      const F = fName(d.k), small = Math.round(d.cut / 3);
      return [
        { label: '뒷방을 내준다', sub: `은자 +${d.cut} · ${F} 관계 +10 · 사파의 벗은 반기고 정파·관은 눈살을 찌푸린다`, run: () => {
          addRes('silver', d.cut); changeRel(d.k, 10); JH.relSpread(d.k, 8); return '밤마다 뒷방에서 주사위 구르는 소리가 났다. 은자 상자가 묵직해졌다.'; } },
        { label: '한 번만 열게 한다', sub: `은자 +${small} · ${F} 관계 +3 · 관부 관계 -2`, run: () => {
          addRes('silver', small); changeRel(d.k, 3); if (JH.isAlive('gwanbu')) changeRel('gwanbu', -2); return '하룻밤 판이 크게 돌고 끝났다.'; } },
        { label: '거절한다', sub: `${F} 관계 -6`, run: () => { changeRel(d.k, -6); return '향주가 주사위를 소매에 넣고 일어섰다.'; } },
      ];
    },
  },
  sa_poison: {
    title: '독 거래', stamp: '毒', tier: 'light', jh: true, camp: 'sa', weight: 0.45, cd: 22,
    cond: () => true,
    who: () => evTarget('sa', id => rel(id) > -10, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => `${evFrom(d)}${evF(d.k)}에서 온 약장수가 보따리를 풀었다. 왼쪽 병은 해독약, 오른쪽 병은 독이라 한다.\n<q>역병이 돌 때 이 해독약 한 상자면 마을 하나를 살리지요. 오른쪽 것은… 칼날에 바르면 스치기만 해도 끝이고.</q>`,
    choices: d => {
      const F = fName(d.k);
      return [
        { label: '해독약을 산다', sub: `은자 -60 · 다음 역병을 곧바로 잡는다${S.flags.antidote ? ' · 이미 한 상자 있다' : ''}`, ok: () => S.res.silver >= 60 && !S.flags.antidote,
          run: () => { S.res.silver -= 60; S.flags.antidote = true; changeRel(d.k, 3); return '해독약 상자가 곳간 깊숙이 들어갔다.'; } },
        { label: '독을 산다', sub: `은자 -50 · 병장기 +8 · ${F} 관계 +5 · 정파 이웃 관계 -5`, ok: () => S.res.silver >= 50,
          run: () => { S.res.silver -= 50; addRes('weapons', 8); changeRel(d.k, 5); evCampNear('jeong', -5); return '무사들이 칼끝에 검푸른 기름을 먹였다. 정파 사람들이 들으면 펄쩍 뛸 일이다.'; } },
        { label: '둘 다 사양한다', run: () => '약장수는 아쉬운 듯 보따리를 다시 쌌다.' },
      ];
    },
  },
  sa_conclave: {
    title: '사파 회맹', stamp: '盟', tier: 'heavy', jh: true, camp: 'sa', weight: 0.4, cd: 30,
    cond: () => S.fame >= 50,
    who: () => evTarget('sa', id => rel(id) >= 10, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.g = 50 + popCount(); },
    text: d => `${evFrom(d)}${evF(d.k)}에서 검은 봉투가 왔다. 강 나루 배 위에서 사파의 회맹이 열린다는 초대장이다.\n<q>정파 놈들이 저희끼리 맹을 맺는데 우리라고 못 할 게 무엇이오? 자리 하나를 비워 두었소.</q>`,
    choices: d => {
      const F = fName(d.k), half = Math.round(d.g / 2);
      return [
        { label: '회맹에 나간다', sub: `은자 -${d.g} · ${F} 관계 +12 · 명성 +5 · 사파의 벗은 반기고 정파·관은 등을 돌린다`, ok: () => S.res.silver >= d.g, run: () => {
          S.res.silver -= d.g; changeRel(d.k, 12); JH.relSpread(d.k, 12); addFame(5); return '횃불 아래 사파의 두령들과 피를 섞은 술잔을 돌렸다. 명성 +5.'; } },
        { label: '사람만 보내 인사한다', sub: `은자 -${half} · ${F} 관계 +4`, ok: () => S.res.silver >= half, run: () => { S.res.silver -= half; changeRel(d.k, 4); return '예물만 들려 보낸 사람이 무사히 돌아왔다.'; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 알린다', sub: `관부 관계 +10 · ${F} 관계 -15 · ${F}의 위협이 쌓인다`, run: () => {
          changeRel('gwanbu', 10); changeRel(d.k, -15); JH.relSpread(d.k, -6); evThreat(d.k, 30); return '관선이 나루를 덮쳤다. 회맹은 흩어졌고, 누가 밀고했는지 소문이 돈다.'; } }] : []),
      ];
    },
  },
  // 빚 → 닷새 뒤 sa_debt_due (절반만 갚으면 닷새 뒤 한 번 더)
  sa_debt: {
    title: '돈놀이꾼', stamp: '債', tier: 'light', jh: true, camp: 'sa', weight: 0.45, cd: 24,
    cond: () => S.res.silver < 150 && !evPending('sa_debt_due'),
    who: () => evTarget('sa', id => rel(id) > -30),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => `${evF(d.k)}의 돈놀이꾼이 은자 상자를 열어 보였다.\n<q>곳간이 비었다는 소문을 들었소. 은자 150냥을 빌려 드리지. 닷새 뒤 210냥만 갚으면 되오. 못 갚으면… 그때 가서 이야기합시다.</q>`,
    choices: d => [
      { label: '빌린다', sub: '은자 +150 · 닷새 뒤 은자 210냥을 갚아야 한다', run: () => { addRes('silver', 150); evLater('sa_debt_due', 120, { k: d.k, due: 210, round: 1 });
        return '차용증에 영주의 수결이 들어갔다.'; } },
      { label: '사양한다', run: () => '<q>필요하면 언제든 부르시오.</q> 돈놀이꾼이 상자를 닫았다.' },
    ],
  },
  sa_debt_due: {
    title: '빚 독촉', stamp: '債', tier: 'hostile', jh: true, camp: 'sa', weight: 0, cd: 0, cond: () => false,
    init: d => (JH.isAlive(d.k) ? undefined : false),
    text: d => `${evF(d.k)}의 돈놀이꾼이 장정 넷을 데리고 왔다. ${d.round > 1 ? '남은 빚을 받으러 왔다.' : '약속한 날이다.'}\n<q>은자 ${d.due}냥. 오늘이오.</q>`,
    choices: d => {
      const F = fName(d.k), half = Math.ceil(d.due / 2);
      const out = [{ label: '다 갚는다', sub: `은자 -${d.due} · ${F} 관계 +6`, ok: () => S.res.silver >= d.due, run: () => { S.res.silver -= d.due; changeRel(d.k, 6);
        return '돈놀이꾼이 차용증을 찢어 화로에 던졌다. <q>거래가 깔끔하니 좋소.</q>'; } }];
      if (d.round === 1) out.push({ label: '절반만 갚고 기한을 늘린다', sub: `은자 -${half} · 닷새 뒤 나머지에 이자가 붙는다 · ${F} 관계 -4`, ok: () => S.res.silver >= half,
        run: () => { S.res.silver -= half; changeRel(d.k, -4); evLater('sa_debt_due', 120, { k: d.k, due: Math.round((d.due - half) * 1.3), round: 2 });
          return '돈놀이꾼이 차용증 끝에 새 날짜를 적었다. 이자도 함께.'; } });
      out.push({ label: '못 갚는다고 버틴다', sub: `${F} 관계 -25 · 위협이 크게 쌓인다`, run: () => {
        changeRel(d.k, -25); evThreat(d.k, 50);
        if (FACTIONS[d.k].military && Math.random() < 0.5 && Events.raidWarning(d.k, 0.8, { goal: 'loot' })) return '<q>그럼 몸으로 받아 가겠소.</q> 돈놀이꾼이 돌아간 날 밤, 고개 너머에 횃불이 모였다.';
        return '<q>두고 봅시다.</q> 돈놀이꾼이 침을 뱉고 돌아갔다.'; } });
      return out;
    },
  },
});

// ── 계열의 사건: 새외무림 ──
Object.assign(EV, {
  // 새외 상인 (월천 오아시스는 고을 성질로 두 배)
  saeoe_merchant: {
    title: '새외 상인', stamp: '互', tier: 'light', jh: true, camp: 'saeoe', weight: 0.6, cd: 8,
    cond: () => !S.occupation,
    who: () => evTarget('saeoe', null, true),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.gin = 50 + rndi(0, 20); d.buy = rndi(70, 100); },
    text: d => { const L = evLook(d.k); return `${evFrom(d)}${evF(d.k)} 쪽 상인들이 ${L.trader}.\n<q>${L.goods}${pp(L.goods, '이/가')} 있소. 곡식과 비단은 비싸게 사 가지.</q>`; },
    choices: d => {
      const F = fName(d.k), tr = JH.canAct('trade', d.k), L = evLook(d.k);
      return [
        { label: '산삼을 산다', sub: `은자 -${d.gin} · 다친 사람이 모두 낫는다`, ok: () => S.res.silver >= d.gin, run: () => {
          S.res.silver -= d.gin; changeRel(d.k, 2); for (const v of S.villagers) if (!v.dead && !v.down) v.hp = v.maxHp;
          return '산삼 달인 물을 한 사발씩 돌렸다. 앓던 이들이 자리를 털고 일어났다.'; } },
        { label: '곡식을 판다', sub: `식량 -60 · 은자 +${d.buy}`, ok: () => S.res.food >= 60, run: () => { S.res.food -= 60; addRes('silver', d.buy); changeRel(d.k, 2); return `곡식 자루가 ${L.pack}에 실렸다.`; } },
        { label: '교역 협정을 맺는다', sub: tr.ok ? `은자 -60 · 스무 날 동안 매일 은자 · ${F} 관계 +3` : `은자 -60 · ${tr.why}`, ok: () => JH.canAct('trade', d.k).ok,
          run: () => { const r = JH.act('trade', d.k); return r.ok ? r.text : r.why; } },
        { label: '그냥 보낸다', run: () => `상인들은 ${L.bell}${pp(L.bell, '을/를')} 남기고 떠났다.` },
      ];
    },
  },
  saeoe_visitor: {
    title: '새외 무인의 방문', stamp: '外', tier: 'light', jh: true, camp: 'saeoe', weight: 0.5, cd: 16,
    cond: () => true,
    who: () => evTarget('saeoe', null, true),
    init(d) {
      if (d.k) return;
      if (!evAim(d, this.who())) return false;
      d.h = makeHero({ martial: clamp(1.8 + dayOf() / 40 + rnd(0, 1), 1.8, 5) }); if (d.h.sex === 'm') d.h.hero.title = pick(['도객', '창객', '권사']);
      d.cost = Math.round(60 + d.h.martial * 50);
    },
    text: d => { const L = evLook(d.k); return `${evFrom(d)}${evF(d.k)}의 무인 하나가 ${L.walk} 마을에 들어섰다. ${L.cloak} 아래 등에 ${L.arm}${pp(L.arm, '을/를')} 멨다. 경지는 <em>${realmOf(d.h.martial)}</em>쯤.\n<q>중원의 칼맛이 궁금해 ${L.came}. 이 마을에서 제일 센 이와 한 판 겨루고 싶소.</q>`; },
    choices: d => {
      const F = fName(d.k), c = bestFighter(), L = evLook(d.k);
      return [
        { label: c ? `${c.name}${pp(c.name, '을/를')} 내보낸다` : '겨룰 사람이 없다', sub: `이기면 명성 +10 · ${F} 관계 +6`, ok: () => !!bestFighter(), run: () => {
          const b = bestFighter();
          if (!b) return '겨룰 사람이 없다.';
          if (Math.random() < clamp(0.5 + (b.martial - d.h.martial) * 0.3, 0.1, 0.9)) { addFame(10); changeRel(d.k, 6); return `${b.name}${pp(b.name, '이/가')} 새외 무인의 ${L.arm}${pp(L.arm, '을/를')} 흘려 내고 목에 칼끝을 멈췄다. <q>중원에도 사람이 있구려.</q> 명성 +10.`; }
          injure(b, 0.3); changeRel(d.k, 3); addFame(2); return `${b.name}${pp(b.name, '이/가')} 세 합 만에 나동그라졌다. 새외 무인이 손을 내밀어 일으켜 주었다.`; } },
        { label: '객경으로 청한다', sub: `은자 -${d.cost} · 매일 은자 ${d.h.hero.upkeep}냥`, ok: () => S.res.silver >= d.cost && evHeroes() < 6, run: () => {
          S.res.silver -= d.cost; const v = spawnHero(d.h, World.exits[evExit(d.k)]); v.look.hat = 'fur'; changeRel(d.k, 4);
          logMsg(`새외의 ${v.hero.title} ${v.hero.epithet} ${v.name}${pp(v.name, '이/가')} 마을의 객경이 되었다.`, 'good');
          return `${v.name}${pp(v.name, '이/가')} 털모자를 벗어 들고 크게 웃었다. <q>밥이 맛있으면 오래 머물겠소.</q>`; } },
        { label: '술과 고기로 대접한다', sub: `식량 -15 · ${F} 관계 +6`, ok: () => S.res.food >= 15, run: () => { S.res.food -= 15; changeRel(d.k, 6); return '새외 무인이 고기를 뜯으며 고향 노래를 불렀다.'; } },
      ];
    },
  },
  saeoe_border: {
    title: '국경의 봉화', stamp: '烽', tier: 'hostile', jh: true, camp: 'saeoe', weight: 0.5, cd: 16,
    cond: () => true,
    who: () => evTarget('saeoe', id => evMil(id) && rel(id) < 20),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => `${evLook(d.k).rumor.replace('{F}', () => evF(d.k))} 봉화가 오를지도 모른다.`,
    choices: d => {
      const F = fName(d.k), sp = JH.canAct('spy', d.k);
      return [
        { label: '첩자를 보내 살핀다', sub: sp.ok ? `은자 -30 · 열흘 동안 ${F}의 속을 들여다본다` : `은자 -30 · ${sp.why}`, ok: () => JH.canAct('spy', d.k).ok,
          run: () => { const r = JH.act('spy', d.k); return r.ok ? r.text : r.why; } },
        { label: '봉화대를 세우고 관에 알린다', sub: `은자 -30 · 관부 관계 +4 · ${F}의 위협이 조금 가라앉는다`, ok: () => S.res.silver >= 30, run: () => {
          S.res.silver -= 30; if (JH.isAlive('gwanbu')) changeRel('gwanbu', 4); evThreat(d.k, -15); return '마을 뒷산에 봉화대가 섰다. 기습은 어려워졌다.'; } },
        { label: '소문일 뿐이다', sub: `${F}의 위협이 쌓인다`, run: () => { evThreat(d.k, 15); return '나그네들의 말은 술자리 이야기로 흘러갔다.'; } },
      ];
    },
  },
  // 포로 → 풀어 주면 며칠 뒤 saeoe_captive_return (은혜 갚기)
  saeoe_captive: {
    title: '사로잡은 새외 무인', stamp: '俘', tier: 'light', jh: true, camp: 'saeoe', weight: 0.45, cd: 26,
    cond: () => (S.stats.raidsWon >= 1 || fighters().length >= 2) && !evPending('saeoe_captive_return'),
    who: () => evTarget('saeoe', evMil),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.ransom = 60 + dayOf() * 2; },
    text: d => `야경을 돌던 무사들이 길 잃은 ${evF(d.k)}의 무인 하나를 사로잡아 왔다. 다리에 화살을 맞아 더는 걷지 못한다.\n<q>죽이든 살리든 마음대로 하라. 다만 우리 쪽에서 사람을 보내 몸값을 낼 것이다.</q>`,
    choices: d => {
      const F = fName(d.k), L = evLook(d.k);
      return [
        { label: '몸값을 받고 돌려보낸다', sub: `은자 +${d.ransom} · ${F} 관계 +6`, run: () => { addRes('silver', d.ransom); changeRel(d.k, 6); return `몸값 꾸러미와 맞바꾸어 포로를 ${L.ride}에 태워 보냈다.`; } },
        ...(JH.isAlive('gwanbu') ? [{ label: '관부에 넘긴다', sub: `관부 관계 +8 · 은자 +30 · ${F} 관계 -15`, run: () => {
          changeRel('gwanbu', 8); addRes('silver', 30); changeRel(d.k, -15); evThreat(d.k, 20); return '포로는 관부의 옥으로 끌려갔다.'; } }] : []),
        { label: '상처를 치료해 풀어 준다', sub: `식량 -10 · ${F} 관계 +12 · 명성 +3 · 언젠가 은혜를 갚으러 올지도 모른다`, ok: () => S.res.food >= 10, run: () => {
          S.res.food -= 10; changeRel(d.k, 12); addFame(3); evLater('saeoe_captive_return', rndi(5, 7) * 24, { k: d.k });
          return `상처가 아문 무인이 ${L.ride} 위에서 오래 뒤를 돌아보며 떠났다.`; } },
      ];
    },
  },
  saeoe_captive_return: {
    title: '은혜 갚는 무인', stamp: '外', tier: 'light', jh: true, camp: 'saeoe', weight: 0, cd: 0, cond: () => false,
    init: d => {
      if (d.gift) return;
      if (!JH.isAlive(d.k)) return false;
      d.gift = Math.random() < 0.35 && evHeroes() < 6 ? 'hero' : 'goods';
      if (d.gift === 'hero') d.h = makeHero({ upkeepMul: 0.6 });
    },
    text: d => `지난번 풀어 준 ${evF(d.k)}의 무인이 동료들과 함께 다시 찾아왔다. ${evLook(d.k).pack}에 짐이 가득하다.\n<q>목숨을 빚졌으니 갚으러 왔소.</q>${d.gift === 'hero' ? '\n그는 아예 이 마을에 남겠다고 한다.' : ''}`,
    choices: d => {
      const F = fName(d.k);
      if (d.gift === 'hero') return [
        { label: '객경으로 맞는다', sub: `매일 은자 ${d.h.hero.upkeep}냥 · ${F} 관계 +5`, ok: () => evHeroes() < 6, run: () => {
          const v = spawnHero(d.h, World.exits[evExit(d.k)]); v.look.hat = 'fur'; changeRel(d.k, 5);
          logMsg(`새외의 ${v.hero.title} ${v.hero.epithet} ${v.name}${pp(v.name, '이/가')} 마을의 객경이 되었다.`, 'good');
          return `${v.name}${pp(v.name, '이/가')} 짐을 풀었다. 이제 이 마을이 그의 집이다.`; } },
        { label: '선물만 받는다', sub: `은자 +100 · ${F} 관계 +5`, run: () => { addRes('silver', 100); changeRel(d.k, 5); return '털가죽과 은자를 내려놓고 그들은 떠났다.'; } },
      ];
      return [{ label: '감사히 받는다', sub: `은자 +100 · 병장기 +6 · ${F} 관계 +5`, run: () => { addRes('silver', 100); addRes('weapons', 6); changeRel(d.k, 5); return '털가죽과 은자, 새외의 굽은 칼이 광장에 내려졌다.'; } }];
    },
  },
});

// ── 계열의 사건: 관 ──
Object.assign(EV, {
  gwan_campaign: {
    title: '토벌령', stamp: '討', tier: 'heavy', jh: true, camp: 'gwan', weight: 0.5, cd: 20,
    cond: () => !!EV.gwan_campaign.mark(),
    who: () => evTarget('gwan', id => rel(id) >= 0),
    mark: () => JH.pickNear(['heuk', 'sa'], id => FACTIONS[id].military && id !== S.vassal && !S.jh.pacts.includes(id)),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.t = this.mark(); if (!d.t) return false; d.food = 40 + popCount(); },
    text: d => `${evF(d.k)}에서 토벌령이 내려왔다. 관병이 ${evF(d.t)}${pp(fName(d.t), '을/를')} 치러 간다며 고을마다 장정과 군량을 보태라 한다.\n<q>관의 편에 서는 고을은 잊지 않을 것이오.</q>`,
    choices: d => {
      const G = fName(d.k), T = fName(d.t);
      return [
        { label: '군량과 장정을 보탠다', sub: `식량 -${d.food} · ${G} 관계 +12 · 관의 벗들이 반긴다 · ${T} 관계 -15`, ok: () => S.res.food >= d.food, run: () => {
          S.res.food -= d.food; changeRel(d.k, 12); JH.relSpread(d.k, 6); changeRel(d.t, -15);
          const w = JH.warOf(d.t), s = w && w[JH.sideOf(w, d.t) === 'a' ? 'b' : 'a'].some(id => JH.campOf(id) === 'gwan') ? (JH.sideOf(w, d.t) === 'a' ? 'b' : 'a') : null;
          if (s) JH.addScore(w, s, 1);
          if (Math.random() < 0.5) { evThreat(d.t, -40); return `관병에 쫓겨 ${T}의 무리가 흩어졌다. 한동안 길목이 조용할 것이다.`; }
          evThreat(d.t, 15); return `관병은 헛걸음만 하고 돌아갔다. ${T}${pp(T, '이/가')} 누가 군량을 댔는지 알아냈다.`; } },
        { label: '길만 내준다', sub: `${G} 관계 +4`, run: () => { changeRel(d.k, 4); return '관병이 마을 앞길을 지나갔다.'; } },
        { label: `몰래 ${T}에 알린다`, sub: `${T} 관계 +12 · ${G} 관계 -12`, run: () => { changeRel(d.t, 12); changeRel(d.k, -12); evThreat(d.t, -10);
          return `${T}${pp(T, '이/가')} 관병이 오기 전에 자리를 옮겼다. 관은 누가 귀띔했는지 의심한다.`; } },
      ];
    },
  },
  // 쫓기는 협객 → 사흘 뒤 gwan_search (포교들의 수색)
  gwan_fugitive: {
    title: '쫓기는 협객', stamp: '逃', tier: 'light', jh: true, camp: 'gwan', weight: 0.45, cd: 26,
    cond: () => !evPending('gwan_search'),
    who: () => evTarget('gwan', evMil),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.h = makeHero({ martial: rnd(1.8, 3) }); d.h.hero.title = d.h.sex === 'f' ? '여협' : '협객'; d.bounty = 40 + dayOf(); },
    text: d => `밤중에 피 묻은 도포를 걸친 ${d.h.hero.title}${pp(d.h.hero.title, '이/가')} 영주관 담을 넘었다. ${d.h.name}${pp(d.h.name, '이라/라')} 했다.\n<q>고을 탐관오리의 목을 벤 죄로 쫓기고 있소. 사흘만 숨겨 주시오. 은혜는 칼로 갚겠소.</q>\n${evF(d.k)}에서 그의 목에 은자 ${d.bounty}냥을 걸었다.`,
    choices: d => {
      const G = fName(d.k);
      return [
        { label: '숨겨 준다', sub: '사흘 뒤 포교들이 수색하러 올 수 있다 · 정파 이웃 관계 +4', run: () => {
          evCampNear('jeong', 4); evLater('gwan_search', 72, { k: d.k, h: d.h, bounty: d.bounty });
          return `${d.h.name}${pp(d.h.name, '이/가')} 영주관 다락에 몸을 숨겼다.`; } },
        { label: '관에 넘긴다', sub: `은자 +${d.bounty} · ${G} 관계 +8 · 명성 -2`, run: () => { addRes('silver', d.bounty); changeRel(d.k, 8); addFame(-2);
          return '포졸들이 협객을 끌고 갔다. 마을 사람들이 고개를 숙였다.'; } },
        { label: '노자를 주어 보낸다', sub: '은자 -20 · 명성 +3', ok: () => S.res.silver >= 20, run: () => { S.res.silver -= 20; addFame(3); return '협객은 노잣돈을 품에 넣고 새벽 안개 속으로 사라졌다.'; } },
      ];
    },
  },
  gwan_search: {
    title: '포교의 수색', stamp: '捕', tier: 'hostile', jh: true, camp: 'gwan', weight: 0, cd: 0, cond: () => false,
    init: d => { if (d.cost) return; if (!JH.isAlive(d.k)) return false; d.cost = 50 + dayOf(); },
    text: d => `${evF(d.k)}의 포교들이 마을 문을 막아섰다. 앞장선 포두가 방을 펼쳐 보인다. ${d.h.name}의 얼굴이 그려져 있다.\n<q>이 자가 이 마을로 숨어들었다는 제보가 있소. 집집마다 뒤져야겠소.</q>`,
    choices: d => {
      const G = fName(d.k), n = d.h.name;
      return [
        { label: '뇌물로 입을 막는다', sub: `은자 -${d.cost} · ${G} 관계 -3 · 협객은 고마워하며 떠난다`, ok: () => S.res.silver >= d.cost, run: () => {
          S.res.silver -= d.cost; changeRel(d.k, -3); addFame(3); return `포두가 은자를 받고 대충 둘러보는 시늉만 했다. 그날 밤 ${n}${pp(n, '이/가')} 큰절을 하고 떠났다.`; } },
        { label: '협객을 내준다', sub: `${G} 관계 +5 · 명성 -5 · 정파 이웃 관계 -6`, run: () => { changeRel(d.k, 5); addFame(-5); evCampNear('jeong', -6);
          return `${n}${pp(n, '이/가')} 오랏줄에 묶여 끌려갔다. 돌아보는 눈빛이 오래 남았다.`; } },
        { label: '수색을 막아선다', sub: '무력이 충분하면 포교들이 물러가고 협객이 객경으로 남는다', run: () => {
          if (defensePower() >= 18 + dayOf() * 0.5) {
            changeRel(d.k, -12); addFame(8);
            if (evHeroes() < 6) { const v = spawnHero(d.h); logMsg(`${v.hero.title} ${v.name}${pp(v.name, '이/가')} 마을의 객경이 되었다.`, 'good');
              return `무사들이 문을 막아서자 포교들이 물러갔다. ${n}${pp(n, '이/가')} 다락에서 내려와 칼을 바쳤다. <q>이 목숨은 이제 이 마을의 것이오.</q>`; }
            return '무사들이 문을 막아서자 포교들이 물러갔다. 협객은 그날 밤 고맙다는 말을 남기고 떠났다.'; }
          changeRel(d.k, -18); addFame(-3); return `포교들이 무사들을 밀치고 들어와 ${n}${pp(n, '을/를')} 끌고 갔다.`; } },
      ];
    },
  },
  gwan_post: {
    title: '관직 제의', stamp: '職', tier: 'light', jh: true, camp: 'gwan', weight: 0.35, cd: 40,
    cond: () => S.rank >= 2 && !S.flags.gwanPost,
    who: () => evTarget('gwan', id => rel(id) >= 30),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; },
    text: d => `${evF(d.k)}에서 관복 차림의 사자가 왔다. 붉은 함에 든 임명장을 꺼낸다.\n<q>영주의 다스림이 조정에까지 들렸소. 이 고을의 부관 자리를 맡아 주시오. 녹봉은 적지만 체면은 크오.</q>\n관직을 받으면 관의 사람으로 보인다. 흑도와 사파는 좋아하지 않을 것이다.`,
    choices: d => [
      { label: '관직을 받는다', sub: `${fName(d.k)} 관계 +15 · 명성 +10 · 관의 벗은 반기고 흑도·사파·마교는 등을 돌린다`, run: () => {
        changeRel(d.k, 15); JH.relSpread(d.k, 10); addFame(10); S.flags.gwanPost = d.k; return '영주관 대청에 관인을 모신 상이 놓였다. 명성 +10.'; } },
      { label: '사양한다', sub: `${fName(d.k)} 관계 -3`, run: () => { changeRel(d.k, -3); return '<q>아까운 자리를.</q> 사자가 혀를 찼다.'; } },
    ],
  },
  gwan_salt: {
    title: '염세 단속', stamp: '鹽', tier: 'gloomy', jh: true, camp: 'gwan', weight: 0.45, cd: 18,
    cond: () => popCount() >= 20 && !S.occupation,
    who: () => evTarget('gwan', evMil),
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; d.n = 30 + popCount(); d.h = JH.pickNear(['heuk', 'sa'], evMil) || ''; },
    text: d => `${evF(d.k)}에서 염세 감찰이 나왔다. 사사로이 소금을 사고판 집을 가린다며 집집마다 장독을 뒤진다.\n<q>관염이 아닌 소금이 나오면 은자 ${d.n}냥을 벌금으로 물리겠소.</q>`,
    choices: d => {
      const G = fName(d.k), half = Math.round(d.n / 2);
      return [
        { label: '벌금을 내고 끝낸다', sub: `은자 -${d.n} · ${G} 관계 +4`, ok: () => S.res.silver >= d.n, run: () => { S.res.silver -= d.n; changeRel(d.k, 4); return '감찰이 장부에 낙관을 찍고 돌아갔다.'; } },
        { label: '뇌물로 넘어간다', sub: `은자 -${half} · 들킬 수도 있다`, ok: () => S.res.silver >= half, run: () => {
          S.res.silver -= half;
          if (Math.random() < 0.7) { changeRel(d.k, -2); return '감찰이 장독 몇 개만 열어 보는 시늉을 했다.'; }
          changeRel(d.k, -15); addFame(-4); return '뇌물을 건네는 장면을 다른 감찰이 보았다. 명성 -4.'; } },
        ...(d.h && JH.isAlive(d.h) ? [{ label: '밀염상을 넘긴다', sub: `${fName(d.h)} 관계 -12 · ${G} 관계 +8 · 은자 +20`, run: () => {
          changeRel(d.h, -12); evThreat(d.h, 25); changeRel(d.k, 8); addRes('silver', 20); return `소금을 대던 ${fName(d.h)}의 거래처를 일러 주었다. 감찰이 흡족해했다.`; } }] : []),
      ];
    },
  },
});

// ── 전쟁의 번짐 ──
Object.assign(EV, {
  war_refugees: {
    title: '전쟁 난민', stamp: '民', tier: 'gloomy', jh: true, weight: 0.6, cd: 10,
    cond: () => evWars().length > 0 && !S.occupation,
    init: d => { if (d.n) return; const ws = evWars(); if (!ws.length) return false; d.war = pick(ws).name; d.n = rndi(4, 7); d.m = rndi(1, 2); },
    text: d => `${d.war}의 불길을 피해 온 피란민 ${d.n}명이 마을 어귀에 모여 앉았다. 불탄 마을 이야기가 끊이지 않는다.\n<q>제발 받아 주십시오. 집도 밭도 다 타 버렸습니다.</q>${evHousing(d.n)}`,
    choices: d => [
      { label: '받아들인다', sub: `사람 +${d.n} · 식량 -${d.n * 5} · 명성 +4`, ok: () => S.res.food >= d.n * 5, run: () => {
        S.res.food -= d.n * 5; evArrive(d.n, d.m, rndi(0, World.exits.length - 1), [0.8, 1.5]); addFame(4); return '피란민들이 짐을 풀었다. 개중에는 칼을 쥐어 본 이도 있다.'; } },
      { label: '죽을 쑤어 먹여 보낸다', sub: '식량 -20 · 명성 +2', ok: () => S.res.food >= 20, run: () => { S.res.food -= 20; addFame(2); return '가마솥 가득 쑨 죽이 바닥났다.'; } },
      { label: '돌려보낸다', sub: '명성 -3', run: () => { addFame(-3); return '피란민들은 등을 돌려 다른 길로 흩어졌다.'; } },
    ],
  },
  war_requisition: {
    title: '군량 징발', stamp: '徵', tier: 'hostile', jh: true, weight: 0.55, cd: 12,
    cond: () => true,
    who: () => { const ids = evWars().flatMap(w => w.a.concat(w.b)).filter(id => JH.isNear(id) && evMil(id)); return ids.length ? { k: pick(ids) } : null; },
    init(d) { if (d.k) return; if (!evAim(d, this.who())) return false; const w = JH.warOf(d.k); if (!w) return false; d.war = w.id; d.food = 50 + popCount(); },
    text: d => { const w = JH.warById(d.war); return `${evF(d.k)}의 군관이 병사 열둘을 이끌고 마을에 들어섰다. ${w ? w.name : '싸움'}에 쓸 군량을 거두러 왔다고 한다.\n<q>싸움터의 형제들이 굶고 있소. 곡식 ${d.food}섬을 내놓으시오. 순순히 내면 장부에 적어 두겠소.</q>`; },
    choices: d => {
      const F = fName(d.k), half = Math.round(d.food / 2), w = JH.warById(d.war);
      const foe = w ? evNames(w[JH.sideOf(w, d.k) === 'a' ? 'b' : 'a']) : '적';
      const give = n => ({ ok: () => !!w && JH.canAct('support', d.k, { war: d.war, food: n }).ok,
        run: () => { const r = JH.act('support', d.k, { war: d.war, food: n }); return r.ok ? `곡식 수레가 ${F} 진영으로 떠났다.` : r.why; } });
      return [
        Object.assign({ label: '곡식을 내준다', sub: `식량 -${d.food} · ${F} 관계 +5 · ${foe} 관계 -8 · 전황이 기운다` }, give(d.food)),
        Object.assign({ label: '절반만 내준다', sub: `식량 -${half} · ${F} 관계 +5 · ${foe} 관계 -8` }, give(half)),
        { label: '거절한다', sub: `${F} 관계 -10 · 위협이 쌓인다`, run: () => { changeRel(d.k, -10); evThreat(d.k, 25); return '군관이 칼자루를 만지작거리다 돌아섰다. <q>이 일은 장부에 따로 적어 두겠소.</q>'; } },
      ];
    },
  },
  war_deserters: {
    title: '패잔병', stamp: '敗', tier: 'gloomy', jh: true, weight: 0.55, cd: 10,
    cond: () => { const lw = evLastWar(6); return !!lw && lw.lose.some(id => JH.isAlive(id) && FACTIONS[id].military); },
    init: d => {
      if (d.k) return;
      const lw = evLastWar(6);
      const ls = lw ? lw.lose.filter(id => JH.isAlive(id) && FACTIONS[id].military) : [];
      if (!ls.length) return false;
      d.k = pick(ls); d.war = lw.name; d.win = lw.win.filter(id => JH.isAlive(id)); d.n = rndi(2, 4);
    },
    text: d => `${d.war}에서 진 ${evF(d.k)}의 패잔병 ${d.n}명이 숲길로 흘러들었다. 갑옷은 찢기고 칼날은 이가 빠졌다.\n<q>돌아갈 곳이 없소. 받아 주면 이 마을을 위해 칼을 들겠소.</q>`,
    choices: d => {
      const F = fName(d.k), W = evNames(d.win);
      return [
        { label: '받아들인다', sub: `무공을 아는 장정 +${d.n} · 식량 -${d.n * 4} · ${F} 관계 +6${W ? ` · ${W} 관계 -6` : ''}`, ok: () => S.res.food >= d.n * 4, run: () => {
          S.res.food -= d.n * 4; evArrive(d.n, d.n, evExit(d.k), [1, 1.8]); changeRel(d.k, 6); for (const id of d.win) changeRel(id, -6);
          return '패잔병들이 무기를 내려놓고 마을 사람이 되었다. 싸움을 아는 손들이다.'; } },
        { label: '무장을 거두고 돌려보낸다', sub: '병장기 +6 · 명성 +2', run: () => { addRes('weapons', 6); addFame(2); return '빈손이 된 패잔병들이 고향 쪽으로 터덜터덜 걸어갔다.'; } },
        ...(d.win.length ? [{ label: '이긴 쪽에 넘긴다', sub: `${W} 관계 +8 · 은자 +30 · ${F} 관계 -12`, run: () => {
          for (const id of d.win) changeRel(id, 8); addRes('silver', 30); changeRel(d.k, -12); return '이긴 쪽 병사들이 와서 패잔병들을 끌고 갔다.'; } }] : []),
      ];
    },
  },
  war_salvage: {
    title: '전장 줍기', stamp: '拾', tier: 'light', jh: true, weight: 0.5, cd: 12,
    cond: () => evWars().some(w => evFrontText(w) !== '먼 곳이다') || !!evLastWar(4),
    init: d => { if (d.n) return; const w = evWars().find(x => evFrontText(x) !== '먼 곳이다'); const lw = evLastWar(4); d.war = w ? w.name : lw ? lw.name : '싸움'; d.ids = (w ? w.a.concat(w.b) : lw ? lw.all : []).filter(id => JH.isNear(id)); d.n = rndi(8, 16); },
    text: d => `${d.war}${pp(d.war, '이/가')} 마을 근처 들판을 휩쓸고 지나갔다. 부러진 창과 주인 잃은 칼이 풀숲에 널려 있다. 까마귀가 낮게 맴돈다.`,
    choices: d => [
      { label: '무사들을 보내 거둔다', sub: `병장기 +${d.n} · 숨은 잔병과 마주칠 수 있다`, ok: () => fighters().length > 0, run: () => {
        addRes('weapons', d.n);
        const f = pick(fighters());
        if (f && Math.random() < 0.25) { injure(f, 0.4); return `병장기를 거두다 숨어 있던 잔병의 칼에 ${f.name}${pp(f.name, '이/가')} 다쳤다.`; }
        return '수레 가득 창칼을 거두어 왔다. 대장간에서 손보면 쓸 만하다.'; } },
      { label: '죽은 이들을 묻어 준다', sub: `명성 +6${d.ids.length ? ' · 싸운 이웃 관계 +3' : ''}`, run: () => { addFame(6); for (const id of d.ids) if (JH.isAlive(id)) changeRel(id, 3);
        return '편을 가리지 않고 무덤을 지어 주었다. 양쪽 모두 그 일을 전해 들었다.'; } },
      { label: '손대지 않는다', run: () => '들판은 까마귀들의 차지가 되었다.' },
    ],
  },
});

// ── 천하의 소식 ──
Object.assign(EV, {
  // 천하 무림대회: 가장 센 정파·세가가 연다 (연무대의 tournament 혜택이 자주 열리게 한다)
  grand_tourney: {
    title: '천하 무림대회', stamp: '武', tier: 'hostile', jh: true, weight: () => 0.35 * (1 + JH.perk('tournament')), cd: 30,
    cond: () => S.fame >= 80 && fighters().length > 0,
    init: d => {
      if (d.host) return;
      const hosts = FACTION_ORDER.filter(id => ['jeong', 'sega'].includes(JH.campOf(id)) && JH.isAlive(id)).sort((a, b) => JH.power(b) - JH.power(a));
      const c = bestFighter();
      if (!hosts.length || !c) return false;
      d.host = hosts[0]; d.champ = c.id; d.cname = c.name; d.p = clamp(0.04 + c.martial * 0.12, 0.05, 0.7);
      d.who = `${c.hero ? c.hero.epithet + ' ' : '무사 '}${c.name}(${realmOf(c.martial)})`;
      const R = REGIONS[FACTIONS[d.host].home];
      const rn = R ? R.name : '중원';
      JH.news(`${fName(d.host)}에서 천하 무림대회를 연다. 강호의 고수들이 ${rn}${pp(rn, '으로/로')} 모여든다.`, 'tourney', [d.host]);
    },
    text: d => `${evF(d.host)}에서 천하 무림대회를 연다는 방이 붙었다. 중원 팔방에서 이름난 고수들이 모여든다. 우승자에게는 은자 300냥과 천하의 이름이 걸렸다.\n마을에서 가장 강한 이는 ${d.who}.`,
    choices: d => [
      { label: `${d.cname}${pp(d.cname, '을/를')} 출전시킨다`, sub: `우승 가능성 ${Math.round(d.p * 100)}% · 여비 은자 -30`, ok: () => S.res.silver >= 30, run: () => {
        S.res.silver -= 30;
        const c = S.villagers.find(v => v.id === d.champ);
        if (!c || c.dead || c.away) return '출전할 사람이 없다. 여비만 날렸다.';
        if (Math.random() < d.p) {
          addFame(60); addRes('silver', 300); changeRel(d.host, 8); S.stats.titles = (S.stats.titles || 0) + 1;
          c.martial = Math.min(S.martialCap + (c.hero ? 2.5 : 0), c.martial + 0.5); updateStats(c);
          logMsg(`${c.name}${pp(c.name, '이/가')} 천하 무림대회에서 우승했다!`, 'good');
          JH.news(`${S.name}의 ${c.name}${pp(c.name, '이/가')} 천하 무림대회에서 우승했다.`, 'tourney', [d.host]);
          return `${c.name}${pp(c.name, '이/가')} 천하의 고수들을 차례로 꺾고 우승했다! 은자 300냥, 명성 +60. 이제 강호에서 ${VN()}${pp(VN(), '을/를')} 모르는 이가 없다.`; }
        injure(c, 0.3);
        if (Math.random() < 0.4) { addFame(12); return `${c.name}${pp(c.name, '이/가')} 8강까지 올랐다. 이름 없는 마을에서 온 무인치고는 대단하다는 평이다. 명성 +12.`; }
        addFame(4); return `${c.name}${pp(c.name, '은/는')} 일찌감치 떨어졌지만 천하의 칼을 눈에 담고 돌아왔다. 명성 +4.`; } },
      { label: '구경꾼만 보낸다', sub: '명성 +2', run: () => { addFame(2); return '돌아온 이들이 객잔에서 대회 이야기를 끝없이 늘어놓았다.'; } },
      { label: '출전하지 않는다', run: () => '대회 소식은 바람결에만 들려왔다.' },
    ],
  },
  // 천하의 기운: 이웃이 낀 전쟁이 끝나고 장사길이 바뀌었다
  world_tides: {
    title: '천하의 기운', stamp: '勢', tier: 'light', jh: true, weight: 0.6, cd: 12,
    cond: () => { const lw = evLastWar(8); return !!lw && lw.all.some(id => JH.isNear(id) && JH.isAlive(id)) && lw.win.length > 0; },
    init: d => {
      if (d.war) return;
      const lw = evLastWar(8);
      if (!lw) return false;
      d.war = lw.name;
      d.wk = lw.win.find(id => JH.isNear(id) && JH.isAlive(id)) || '';
      d.lk = lw.lose.find(id => JH.isNear(id) && JH.isAlive(id)) || '';
      if (!d.wk && !d.lk) return false;
      d.n = 40 + countType('market') * 25;
    },
    text: d => `${d.war}${pp(d.war, '이/가')} 끝나자 장사길이 바뀌었다.`
      + (d.wk ? ` 이긴 ${evF(d.wk)}의 땅으로 상단들이 몰리고, 그 길목의 ${VN()}에도 수레가 늘었다.` : '')
      + (d.lk ? ` 진 ${evF(d.lk)}의 영지에서는 길이 끊겨 곡식값이 뛰었다.` : ''),
    choices: d => [
      ...(d.wk ? [
        { label: '장을 크게 연다', sub: `은자 +${d.n} · ${fName(d.wk)} 관계 +3`, run: () => { addRes('silver', d.n); changeRel(d.wk, 3); return '장터에 낯선 수레가 줄을 섰다.'; } },
        { label: '이긴 쪽에 축하 사절을 보낸다', sub: `은자 -30 · ${fName(d.wk)} 관계 +8`, ok: () => S.res.silver >= 30, run: () => { S.res.silver -= 30; changeRel(d.wk, 8); return '축하 사절이 돌아와 좋은 말을 전했다.'; } },
      ] : []),
      ...(d.lk ? [
        { label: '곡식을 비싸게 판다', sub: `식량 -50 · 은자 +${Math.round(d.n * 1.5)} · ${fName(d.lk)} 관계 -4`, ok: () => S.res.food >= 50, run: () => {
          S.res.food -= 50; addRes('silver', Math.round(d.n * 1.5)); changeRel(d.lk, -4); return '곡식 수레가 비싼 값에 팔려 나갔다. 원망 섞인 말도 함께 돌아왔다.'; } },
        { label: '구휼미를 보낸다', sub: `식량 -40 · ${fName(d.lk)} 관계 +10 · 명성 +5`, ok: () => S.res.food >= 40, run: () => { S.res.food -= 40; changeRel(d.lk, 10); addFame(5);
          return '구휼미 수레에 마을 이름을 쓴 깃발을 달아 보냈다.'; } },
      ] : []),
      { label: '형세를 지켜본다', run: () => '서두를 것은 없다. 바람은 또 바뀐다.' },
    ],
  },
});

// 습격 경고 (위협이 쌓이면 발생)
const GOAL_TEXT = {
  loot: '곡식과 은자를 노리는 모양이다.',
  occupy: '<em>마을을 통째로 집어삼키려 한다!</em> 영주관이 무너지면 마을은 그들의 손에 넘어간다.',
  punish: '마을을 혼내 주겠다고 벼르고 있다.',
};
// 습격의 목적은 세력의 goals 에서 고른다. 점령은 인구가 문턱을 넘어야 (마교 20, 관은 언제나, 그 밖 28)
const OCCUPY_POP = { ma: 20, gwan: 0 };
function chooseGoal(k) {
  const F = FACTIONS[k], pop = popCount();
  const goals = F && F.goals && F.goals.length ? F.goals : ['punish'];
  const rest = goals.filter(g => g !== 'occupy');
  const occ = goals.includes('occupy') && pop >= (OCCUPY_POP[F.camp] !== undefined ? OCCUPY_POP[F.camp] : 28);
  if (occ && (!rest.length || Math.random() < (F.camp === 'ma' ? 0.6 : 0.45))) return 'occupy';
  return rest.length ? pick(rest) : 'punish';
}

const OCC_EVENTS = new Set(['merchant', 'wedding', 'refugees', 'plague', 'fire']);   // 점령 중에도 나오는 사건
const CAMP_GAP = 3;   // 같은 계열의 강호 사건은 사흘 띄운다
const Events = {
  queue(id, data = {}) { S.eventQueue.push({ id, data }); },
  notice(title, body, stamp = '告') { S.eventQueue.push({ id: '_notice', data: { title, body, stamp } }); },
  // opts: { goal, size, delay(시진), exitIdx } — 이야기 모듈이 짜인 습격을 낼 때 쓴다
  raidWarning(k, mul = 1, opts = {}) {
    if (this.raidPending() || S.occupation) return false;
    const goal = opts.goal || chooseGoal(k);
    const size = opts.size || raidSize(k, mul * (goal === 'occupy' ? 1.1 : 1));
    const ex = opts.exitIdx !== undefined ? World.exits[opts.exitIdx] : pickExit(k);
    const delay = opts.delay || rndi(3, 5);
    S.eventQueue.push({ id: '_raid', data: { k, goal, size, exitIdx: World.exits.indexOf(ex), delay } });
    Bus.emit('raidWarning', k, goal, size);
    return true;
  },
  raidPending() { return !!S.raid || S.scheduled.some(s => s.kind === 'raid') || S.eventQueue.some(e => e.id === '_raid'); },
  // 갈래 계열 ×2, 숙적 계열의 적대 사건 ×1.5, 고을 성질(trait.ev), 먼 세력 ×0.3 (§9). 0 이면 나오지 않는다
  weightOf(id, e) {
    let w = typeof e.weight === 'function' ? e.weight() : e.weight;
    w *= (JH.trait().ev || {})[id] || 1;
    if (e.who) {
      const t = e.who();
      if (!t) return 0;
      if (t.far) w *= 0.3;
    }
    if (e.camp && S.jh) {
      const cs = [].concat(e.camp), route = S.jh.route;
      if (route && cs.includes(route)) w *= 2;
      if (e.tier === 'hostile' && evFoeCamps().some(c => cs.includes(c))) w *= 1.5;
    }
    return w;
  },
  roll() {
    const day = dayOf(), allow = evOn();
    const scrolled = !!S.jh && S.jh.lastScroll === day;   // 오늘 이미 강호 두루마리가 떴다
    const cands = [];
    for (const id in EV) {
      const e = EV[id];
      if (!e.weight) continue;
      if (S.occupation && !OCC_EVENTS.has(id)) continue;
      if (e.jh && (!allow || scrolled)) continue;
      if (e.jh && e.camp && [].concat(e.camp).some(c => S.cooldowns['camp:' + c] !== undefined && day - S.cooldowns['camp:' + c] < CAMP_GAP)) continue;
      if (hook(Story, 'allowEvent', id) === false) continue;
      const last = S.cooldowns[id];
      if (last !== undefined && day - last < e.cd) continue;
      let w = 0;
      try { if (e.cond()) w = this.weightOf(id, e); } catch (err) { w = 0; }
      if (w > 0) cands.push([id, e, w]);
    }
    if (!cands.length) return;
    const [id, e] = weighted(cands, c => c[2]);
    S.cooldowns[id] = day;
    if (e.jh && e.camp) for (const c of [].concat(e.camp)) S.cooldowns['camp:' + c] = day;
    this.queue(id);
  },
  // UI가 다음 사건을 꺼낼 때 호출
  build(entry) {
    const { id, data } = entry;
    if (id === '_notice') {
      return { title: data.title, stamp: data.stamp, text: data.body, choices: [{ label: '확인', run: () => null }] };
    }
    if (id === '_raid') return this.buildRaid(data);
    if (id === '_gameover') return {
      title: '마을이 사라지다', stamp: '終',
      text: `${VN()}에는 이제 아무도 남지 않았다. 빈 집에 바람만 드나든다.\n\n${yearOf()}년 ${SEASONS[seasonIdx()]}, ${dayOf() + 1}일 만의 일이었다. 가장 많았을 때 ${S.stats.maxPop}명이 살았고, 습격을 ${S.stats.raidsWon}번 막아냈다.`,
      choices: [{ label: '새로 시작한다', run: () => { UI.restart(); return null; } }],
    };
    // 승리: 이야기가 갈래의 칭호·글·문장을 넘긴다 (없으면 예전 글)
    if (id === '_victory') return {
      title: data.title || '강호에 이름을 떨치다', stamp: data.stamp || '名',
      text: data.text || `작은 촌락이었던 ${VN()}${pp(VN(), '이/가')} 이제 현성이 되었다. 정파도 사파도, 관부도 상단도 이 마을의 영주를 함부로 대하지 못한다.\n\n강호의 이야기꾼들은 오늘도 객잔에서 ${VN()}의 영주 이야기를 한다.\n\n<em>천하제일촌을 이루었다.</em> 원한다면 계속 마을을 다스릴 수 있다.`,
      choices: [{ label: '계속 다스린다', run: () => null }],
    };
    const e = EV[id];
    if (!e) return null;
    // 사건을 고른 뒤 사정이 바뀌어 준비할 수 없으면(대상이 없어짐) 버린다
    if (e.init && !data._init) { if (e.init(data) === false) return null; data._init = true; }
    S.stats.events++;
    const val = x => (typeof x === 'function' ? x(data) : x);
    return { title: val(e.title), stamp: val(e.stamp), text: e.text(data), choices: e.choices(data) };
  },
  buildRaid(d) {
    const F = FACTIONS[d.k];
    const ex = World.exits[d.exitIdx] || World.exits[0];
    // 저장하면 exit 는 버려지므로 길목 번호도 함께 넘긴다 (불러올 때 되살린다)
    const exitOpt = { exit: ex, exitIdx: World.exits.indexOf(ex) };
    const tribute = Math.round(d.size * 14 + dayOf() * 2);
    // 원군: 주군(없으면 동맹 하나)이 한 무리, 고을 성질로 한 무리 (startRaid 가 부른다). 그 밖의 이웃에는 은자로 구원을 청한다
    const aid = JH.aidFor(d.k), sa = JH.siteAid(d.k);
    const helpers = JH.near().filter(m => m !== d.k && JH.isAlive(m) && FACTIONS[m].military && rel(m) >= 35 && m !== S.vassal
      && (!aid || m !== aid.id) && (!sa || m !== sa.id));
    let note = '';
    if (aid) note += `\n\n${aid.id === S.vassal ? '주군' : '동맹'}인 <em>${fName(aid.id)}</em>에서 원군 ${aid.n}명을 보낼 것이다.`;
    if (sa) note += `${aid ? '\n' : '\n\n'}국경을 지키는 <em>${fName(sa.id)}</em>도 원군 ${sa.n}명을 보낸다.`;
    const away = S.villagers.filter(v => v.away && !v.dead && (v.role === 'guard' || v.hero)).length;
    const choices = [
      { label: '맞서 싸운다!', sub: `${d.delay}시진(${d.delay * 2}시간) 뒤 들이닥친다`, run: () => {
        scheduleRaid(d.k, d.delay * 2, d.goal, d.size, exitOpt);
        logMsg(`${F.name}의 습격이 다가온다. 무사들이 창을 고쳐 잡는다.`, 'war');
        return '종이 울렸다. 아낙들은 아이들을 집 안으로 들이고, 장정들은 무기를 챙긴다.'; } },
      { label: '은자를 바쳐 화친한다', sub: `은자 -${tribute} · ${F.name} 관계 +6`, ok: () => S.res.silver >= tribute, run: () => {
        S.res.silver -= tribute; changeRel(d.k, 6);
        logMsg(`${F.name}에 은자 ${tribute}냥을 바쳐 습격을 피했다.`, '');
        return `${F.leader.title}${pp(F.leader.title, '이/가')} 은자 상자를 받아 들고 무리를 돌렸다. 굴욕적이지만 피는 흐르지 않았다.`; } },
    ];
    for (const m of helpers.slice(0, 2)) {
      choices.push({ label: `${fName(m)}에 구원을 청한다`, sub: `은자 -60 · ${fName(m)}의 무인들이 함께 싸운다`, ok: () => S.res.silver >= 60, run: () => {
        S.res.silver -= 60; changeRel(m, -3);
        scheduleRaid(d.k, d.delay * 2, d.goal, d.size, exitOpt);
        S.scheduled.push({ at: S.time + d.delay * 2 + 0.6, kind: 'allies', faction: m, n: 4 + Math.floor(dayOf() / 8) });
        return `${fName(m)}${pp(fName(m), '이/가')} 무인들을 보내겠다고 답했다.`; } });
    }
    return {
      title: `${F.name} 습격 경보`, stamp: F.hanja,
      text: `척후가 숨을 헐떡이며 달려왔다!\n<em>${F.name}</em>의 ${F.leader.title}${pp(F.leader.title, '이/가')} 무리 <em>${d.size}명</em>을 이끌고 ${ex.name}${pp(ex.name, '으로/로')} 다가오고 있다. ${GOAL_TEXT[d.goal] || ''}\n\n약 ${d.delay}시진 뒤 들이닥칠 것이다. 무사 ${fighters().length}명, 망루 ${countType('tower')}개가 마을을 지킨다.${away ? ` 의뢰로 떠난 무사 ${away}명은 제때 돌아오지 못한다.` : ''}${note}`,
      choices,
    };
  },
  gameOver() { S.eventQueue.length = 0; S.eventQueue.push({ id: '_gameover', data: {} }); Store.del(SAVE_KEY); },
  // data: { title, text, stamp } — 이야기가 갈래의 결말을 넘긴다. 없으면 예전 글
  victory(data) { S.eventQueue.push({ id: '_victory', data: data || {} }); },
};
