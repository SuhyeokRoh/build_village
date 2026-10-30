'use strict';
// ───────────────────────────────────────────────
// 사건: 강호의 일들이 마을을 찾아온다
// 각 사건은 cond(조건), weight(빈도), cd(재발 대기 일수), init(자료 준비),
// text(본문), choices(선택지: label, sub, ok(가능 여부), run(결과 문장 반환))
// ───────────────────────────────────────────────
const VN = () => escapeHtml(S.name);
const fName = k => FACTIONS[k].name;
function fighters() { return S.villagers.filter(v => !v.dead && !v.down && !v.leaving && (v.role === 'guard' || v.hero)); }
function civilians() { return S.villagers.filter(v => !v.dead && !v.leaving && v.role === 'civ' && !v.hero); }
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

const EV = {
  bandit_toll: {
    title: '흑풍채의 통행세', stamp: '賊', weight: 1.2, cd: 5,
    cond: () => dayOf() >= 2 && rel('heukpung') < 30,
    init: d => { d.n = Math.round(20 + dayOf() * 3 + popCount()); },
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
          changeRel('heukpung', -6); S.factions.heukpung.threat += 30;
          return '산적들의 솜씨가 만만치 않았다. 무사 둘이 다쳐서 돌아왔고, 흑풍채는 앙심을 품었다.';
        } },
      { label: '거절한다', sub: '흑풍채가 앙심을 품는다', run: () => {
        changeRel('heukpung', -12); S.factions.heukpung.threat += 45;
        if (Math.random() < 0.5) { Events.raidWarning('heukpung', 0.75); return '<q>후회하게 될 거다!</q> 산적들이 침을 뱉고 돌아갔다. 머지않아 패거리를 끌고 올 것 같다.'; }
        return '산적들은 투덜대며 돌아갔다. 흑풍채가 이 일을 잊지는 않을 것이다.';
      } },
    ],
  },
  gang_protection: {
    title: '철혈방의 보호비', stamp: '鐵', weight: 0.8, cd: 14,
    cond: () => dayOf() >= 5 && popCount() >= 12 && S.vassal !== 'cheolhyeol' && rel('cheolhyeol') > -50,
    text: () => `검은 비단옷을 입은 철혈방 향주가 수하 열댓을 거느리고 영주관을 찾았다.\n<q>요즘 세상이 험하지 않소? 우리 철혈방의 비호를 받으시오. 매일 공물만 조금 내면, 산적 놈들은 얼씬도 못 할 거요.</q>${S.vassal ? `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군을 배신하게 된다.` : ''}`,
    choices: () => [
      { label: '철혈방의 비호를 받는다', sub: `산하 마을이 됨 · 매일 공물 · ${FACTIONS.cheolhyeol.perk}`, run: () => { becomeVassal('cheolhyeol'); return '향주가 껄껄 웃으며 마을 어귀에 철혈방의 깃발을 꽂았다. 이제 이 마을을 건드리는 자는 철혈방을 적으로 돌리는 셈이다.'; } },
      { label: '술과 음식으로 대접해 돌려보낸다', sub: '식량 -30 · 철혈방 관계 +5', ok: () => S.res.food >= 30,
        run: () => { S.res.food -= 30; changeRel('cheolhyeol', 5); return '배불리 먹고 마신 향주는 기분 좋게 돌아갔다. 대답은 다음으로 미뤄졌다.'; } },
      { label: '단호히 거절한다', sub: '철혈방 관계 -20', run: () => { changeRel('cheolhyeol', -20); S.factions.cheolhyeol.threat += 40;
        return '<q>호의를 무시하다니. 기억해 두겠소.</q> 향주의 눈빛이 싸늘하게 식었다.'; } },
    ],
  },
  cheongun_offer: {
    title: '청운검문의 제안', stamp: '靑', weight: 0.8, cd: 16,
    cond: () => (popCount() >= 18 || S.fame >= 40) && S.vassal !== 'cheongun' && rel('cheongun') > -20,
    text: () => `학처럼 마른 청운검문의 장로가 제자 둘을 데리고 찾아왔다.\n<q>강호가 어지럽소. 이 마을을 청운검문의 산하에 두면 사파 무리도 함부로 넘보지 못할 것이오. 대신 매일 약간의 공물을 바치면 되오.</q>${S.vassal ? `\n\n지금은 <em>${fName(S.vassal)}</em>의 산하다. 받아들이면 옛 주군과 척을 지게 된다.` : ''}`,
    choices: () => [
      { label: '청운검문의 산하에 든다', sub: `매일 공물 · ${FACTIONS.cheongun.perk}`, run: () => { becomeVassal('cheongun'); return '장로가 고개를 끄덕이며 청운검문의 현판을 내렸다. 정파의 이름이 마을을 지켜줄 것이다.'; } },
      { label: '정중히 사양한다', sub: '청운검문 관계 -4', run: () => { changeRel('cheongun', -4); return '<q>뜻이 그러하다면 어쩔 수 없지요.</q> 장로는 담담히 돌아갔다.'; } },
    ],
  },
  hyeolwol_offer: {
    title: '붉은 달의 유혹', stamp: '血', weight: 0.6, cd: 20,
    cond: () => dayOf() >= 10 && S.fame >= 30 && S.vassal !== 'hyeolwol',
    text: () => `한밤중, 붉은 달 문양의 가면을 쓴 자가 영주관 처마 밑에 서 있었다. 경비는 아무도 그를 보지 못했다.\n<q>혈월교에 충성을 맹세하라. 은자와 힘을 주겠다. 거절한다면… 붉은 달이 뜨는 밤을 조심하는 게 좋을 것이다.</q>`,
    choices: () => [
      { label: '충성을 맹세한다', sub: `은자 +250 · ${FACTIONS.hyeolwol.perk}`, run: () => { becomeVassal('hyeolwol'); addRes('silver', 250);
        return '가면 쓴 자가 낮게 웃으며 피로 쓴 서약서를 품에 넣었다. 마을 위로 붉은 그림자가 드리운다.'; } },
      { label: '거절한다', sub: '혈월교 관계 -25', run: () => { changeRel('hyeolwol', -25); S.factions.hyeolwol.threat += 40; return '가면 쓴 자는 대답 없이 어둠 속으로 사라졌다. 바람이 차다.'; } },
      { label: '관부에 고발한다', sub: '관부 +15 · 청운검문 +8 · 혈월교의 원한', run: () => {
        changeRel('gwanbu', 15); changeRel('cheongun', 8); changeRel('hyeolwol', -40); S.factions.hyeolwol.threat += 70;
        return '현청에 고발장이 올라갔다. 관부와 정파는 마을을 다시 보게 되었지만, 혈월교는 결코 잊지 않을 것이다.'; } },
    ],
  },
  gwanbu_tax: {
    title: '현청의 세리', stamp: '稅', weight: 1, cd: 8,
    cond: () => dayOf() >= 6 && !S.occupation,
    init: d => { d.n = Math.round(30 + popCount() * 2 + S.rank * 20); },
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
    title: '징병령', stamp: '兵', weight: 0.6, cd: 15,
    cond: () => popCount() >= 22 && !S.occupation,
    init: d => { d.n = 2 + Math.floor(popCount() / 20); },
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
    title: '객잔의 떠돌이 고수', stamp: '客', weight: 1.5, cd: 5,
    cond: () => hasUsable('inn') && S.villagers.filter(v => v.hero && !v.dead).length < 6,
    init: d => { d.h = makeHero(); d.cost = Math.round(70 + d.h.martial * 55); },
    text: d => `객잔에 삿갓을 깊이 눌러쓴 ${d.h.hero.title}가 묵고 있다. 사람들은 그를 '${d.h.hero.epithet}'라 부른다. 기도로 보아 경지는 <em>${realmOf(d.h.martial)}</em>쯤.\n<q>머물 곳을 찾고 있소. 대접만 섭섭지 않다면 이 마을의 객경(客卿)이 되어 드리리다.</q>`,
    choices: d => [
      { label: `${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '을/를')} 객경으로 모신다`, sub: `은자 -${d.cost} · 매일 은자 ${d.h.hero.upkeep}냥`, ok: () => S.res.silver >= d.cost,
        run: () => { S.res.silver -= d.cost; const inn = S.buildings.find(b => b.type === 'inn' && usable(b)); spawnHero(d.h, inn ? doorOf(inn) : null);
          addFame(5); logMsg(`${d.h.hero.title} ${d.h.hero.epithet} ${d.h.name}${pp(d.h.name, '이/가')} 마을의 객경이 되었다.`, 'good');
          return `${d.h.name}${pp(d.h.name, '이/가')} 삿갓을 벗고 포권했다. <q>오늘부터 이 마을은 내가 지키겠소.</q>`; } },
      { label: '술 한 잔 대접하고 보낸다', sub: '은자 -5 · 명성 +2', run: () => { S.res.silver = Math.max(0, S.res.silver - 5); addFame(2); return '고수는 잔을 비우고 말없이 떠났다. 객잔 주인이 그 이야기를 사방에 퍼뜨린다.'; } },
    ],
  },
  injured: {
    title: '숲속의 부상자', stamp: '傷', weight: 0.9, cd: 10,
    cond: () => dayOf() >= 3,
    text: () => '나무를 하러 간 사람들이 숲속에서 피투성이가 된 무인을 발견했다. 품에는 부러진 검이 안겨 있고, 숨이 가늘다.',
    choices: () => [
      { label: '데려와 치료해 준다', sub: '식량 -15 · 은자 -15', ok: () => S.res.food >= 15 && S.res.silver >= 15,
        run: () => { S.res.food -= 15; S.res.silver -= 15;
          const r = Math.random();
          if (r < 0.5) { const h = makeHero({ martial: rnd(1.5, 2.6), upkeepMul: 0.5 }); h.hero.title = '은혜 갚는 ' + h.hero.title; spawnHero(h);
            return `깨어난 무인은 ${h.name}이라 했다. <q>목숨을 구해 주셨으니 이 몸으로 갚겠소.</q> 그가 마을의 객경이 되었다.`; }
          if (r < 0.8) { S.martialCap = Math.min(6, S.martialCap + 0.5); addMod('manual', 6);
            return '무인은 몸을 추스르자 말없이 떠났다. 그가 누웠던 자리에 낡은 무공 구결 한 장이 남아 있었다. 무사들의 수련이 한층 깊어진다.'; }
          changeRel('cheongun', -15); changeRel('hyeolwol', 10);
          return '며칠 뒤 청운검문 사람들이 들이닥쳤다. 그 무인은 혈월교의 살수였다. 그는 이미 사라졌고, 그를 숨겨준 마을은 정파의 눈총을 받게 되었다.'; } },
      { label: '관부에 알린다', sub: '관부 관계 +5', run: () => { changeRel('gwanbu', 5); return '관병이 와서 무인을 데려갔다. 그 뒤의 일은 아무도 모른다.'; } },
      { label: '못 본 척한다', run: () => '사람들은 발길을 돌렸다. 마음 한구석이 무겁다.' },
    ],
  },
  manual: {
    title: '석함 속의 비급', stamp: '秘', weight: 0.5, cd: 30,
    cond: () => (hasUsable('quarry') || hasUsable('lumber')) && dayOf() >= 4,
    text: () => '일꾼이 땅을 파다가 이끼 낀 석함을 발견했다. 안에는 빛바랜 무공 비급이 들어 있었다. 표지에는 <em>「청하검결(淸河劍訣)」</em>이라 적혀 있다.',
    choices: () => [
      { label: '무사들에게 익히게 한다', sub: '무사가 오를 수 있는 경지 +1 · 무사 전원 무공 상승', run: () => {
        S.martialCap = Math.min(6, S.martialCap + 1); addMod('manual', 10);
        for (const v of fighters()) { v.martial = Math.min(S.martialCap, v.martial + 0.4); updateStats(v); }
        return '무관에 비급이 걸렸다. 무사들의 눈빛이 달라졌다.'; } },
      { label: '청운검문에 바친다', sub: '청운검문 관계 +20 · 명성 +15', run: () => { changeRel('cheongun', 20); addFame(15); return '청운검문 장문인이 감사의 서신을 보냈다. 정파 사이에 마을의 이름이 오르내린다.'; } },
      { label: '금룡상회에 판다', sub: '은자 +220', run: () => { addRes('silver', 220); changeRel('geumryong', 5); return '상회의 대행수가 눈을 반짝이며 은자 꾸러미를 내밀었다.'; } },
    ],
  },
  plague: {
    title: '역병이 돈다', stamp: '疫', weight: 0.5, cd: 22,
    cond: () => popCount() >= 15 && dayOf() >= 8 && !hasMod('plague'),
    text: () => `열이 끓고 기침을 하는 사람이 하나둘 늘고 있다. 역병이다.${hasUsable('clinic') ? '\n마을 의원이 약을 달이고 있어 그나마 다행이다.' : '\n마을에는 의원이 없다.'}`,
    choices: () => [
      { label: '마을을 격리한다', sub: '사흘간 생산 -40% · 피해가 거의 없다', run: () => { addMod('plague', 3); addMod('quarantine', 3); return '집집마다 문을 닫아걸었다. 일손은 멈췄지만 병은 더 퍼지지 않을 것이다.'; } },
      { label: '이름난 의원을 모셔온다', sub: '은자 -120 · 곧바로 잡힌다', ok: () => S.res.silver >= 120, run: () => { S.res.silver -= 120; addFame(3); return '성내의 명의가 사흘 밤낮을 매달려 역병을 잡았다.'; } },
      { label: '하늘에 맡긴다', sub: '나흘간 역병 · 사람이 죽을 수 있다', run: () => { addMod('plague', 4); return '사람들은 문설주에 부적을 붙이고 기도했다.'; } },
    ],
  },
  drought: {
    title: '가뭄', stamp: '旱', weight: 0.7, cd: 15,
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
    title: '풍년', stamp: '豊', weight: 0.9, cd: 30,
    cond: () => seasonIdx() === 2 && countType('farm') >= 2,
    text: () => '황금빛 들판에 이삭이 고개를 숙였다. 몇 해 만의 풍년이다!',
    choices: () => [
      { label: '곳간에 쌓아둔다', sub: '나흘간 수확 +40% · 식량 +40', run: () => { addMod('harvest', 4); addRes('food', 40); return '곳간이 가득 찼다.'; } },
      { label: '추수 잔치를 연다', sub: '식량 -30 · 민심 크게 상승', ok: () => S.res.food >= 30, run: () => { S.res.food -= 30; addMod('harvest', 4); addMod('festival', 3); addFame(5); return '풍물 소리가 밤늦도록 울려 퍼졌다.'; } },
    ],
  },
  merchant: {
    title: '금룡상회의 상단', stamp: '商', weight: 1.3, cd: 4,
    cond: () => dayOf() >= 2 && !S.occupation,
    init: d => { d.wood = rndi(55, 85); d.stone = rndi(70, 105); d.food = rndi(45, 70); d.arms = rndi(95, 140); },
    text: () => '금룡상회의 깃발을 단 수레 행렬이 마을 광장에 멈췄다. 대행수가 주판을 튕기며 웃는다.\n<q>무엇이든 사고팝니다. 값은 장담하지요.</q>',
    choices: d => [
      { label: '목재 100을 산다', sub: `은자 -${d.wood}`, ok: () => S.res.silver >= d.wood, run: () => { S.res.silver -= d.wood; addRes('wood', 100); changeRel('geumryong', 2); return '목재가 수레째 내려졌다.'; } },
      { label: '석재 80을 산다', sub: `은자 -${d.stone}`, ok: () => S.res.silver >= d.stone, run: () => { S.res.silver -= d.stone; addRes('stone', 80); changeRel('geumryong', 2); return '다듬은 돌이 광장에 쌓였다.'; } },
      { label: '병장기 20을 산다', sub: `은자 -${d.arms}`, ok: () => S.res.silver >= d.arms, run: () => { S.res.silver -= d.arms; addRes('weapons', 20); changeRel('geumryong', 2); return '번쩍이는 창칼이 무관으로 옮겨졌다.'; } },
      { label: '식량 100을 판다', sub: `은자 +${d.food}`, ok: () => S.res.food >= 100, run: () => { S.res.food -= 100; addRes('silver', d.food); changeRel('geumryong', 2); return '곡식 가마니가 수레에 실렸다.'; } },
      { label: '그냥 보낸다', run: () => '상단은 다음 마을로 떠났다.' },
    ],
  },
  refugees: {
    title: '유랑민', stamp: '民', weight: 1, cd: 6,
    cond: () => dayOf() >= 3 && !S.occupation,
    init: d => { d.n = rndi(3, 6); },
    text: d => `전란을 피해 온 유랑민 ${d.n}명이 마을 어귀에 주저앉았다. 아이를 업은 아낙이 고개를 조아린다.\n<q>제발 이 마을에 머물게 해 주십시오. 무슨 일이든 하겠습니다.</q>${housingTotal() - popCount() < d.n ? '\n\n<em>빈 집이 모자라다.</em> 받아들이면 한동안 집 없이 지내야 한다.' : ''}`,
    choices: d => [
      { label: '받아들인다', sub: `사람 +${d.n} · 식량 -${d.n * 4} · 명성 +3`, ok: () => S.res.food >= d.n * 4,
        run: () => { S.res.food -= d.n * 4; const ex = pick(World.exits); for (let i = 0; i < d.n; i++) newVillager({ x: ex.x + 0.5, y: ex.y + 0.5, arriving: true });
          addFame(3); markDirty(); return '유랑민들이 눈물을 흘리며 짐을 풀었다.'; } },
      { label: '식량만 나눠주고 보낸다', sub: '식량 -15 · 명성 +1', ok: () => S.res.food >= 15, run: () => { S.res.food -= 15; addFame(1); return '주먹밥을 받아 든 이들이 몇 번이고 절을 하고 떠났다.'; } },
      { label: '돌려보낸다', sub: '명성 -2', run: () => { addFame(-2); return '유랑민들은 터벅터벅 다음 마을로 향했다.'; } },
    ],
  },
  sect_war: {
    title: '정사대전', stamp: '亂', weight: 0.6, cd: 30,
    cond: () => dayOf() >= 14,
    text: () => '청운검문과 철혈방이 강 건너 나루터를 두고 전쟁을 벌였다! 양쪽에서 사자가 동시에 찾아와 마을의 지원을 요구한다.',
    choices: () => [
      { label: '청운검문을 돕는다', sub: '식량 -60 · 은자 -60 · 청운 +25 · 철혈방의 적의', ok: () => S.res.food >= 60 && S.res.silver >= 60,
        run: () => { S.res.food -= 60; S.res.silver -= 60; changeRel('cheongun', 25); changeRel('cheolhyeol', -30); S.factions.cheolhyeol.threat += 30; addFame(10); return '청운검문이 승기를 잡았다. 정파 사이에서 마을의 이름이 높아졌다. 명성 +10.'; } },
      { label: '철혈방을 돕는다', sub: '식량 -60 · 은자 -60 · 철혈방 +25 · 청운의 적의', ok: () => S.res.food >= 60 && S.res.silver >= 60,
        run: () => { S.res.food -= 60; S.res.silver -= 60; changeRel('cheolhyeol', 25); changeRel('cheongun', -30); S.factions.cheongun.threat += 30; addRes('silver', 90);
          return '철혈방이 나루터를 차지했다. 향주가 고맙다며 은자 90냥을 보내왔다. 정파의 눈길은 차가워졌다.'; } },
      { label: '중립을 지킨다', sub: '양쪽 관계 -5', run: () => { changeRel('cheongun', -5); changeRel('cheolhyeol', -5); return '어느 편도 들지 않았다. 양쪽 모두 마을을 기회주의자라 수군거린다.'; } },
    ],
  },
  tournament: {
    title: '무림대회', stamp: '武', weight: 0.7, cd: 20,
    cond: () => S.fame >= 25 && fighters().length > 0,
    init: d => { const c = bestFighter(); d.champ = c.id; d.cname = c.name; d.p = clamp(0.12 + c.martial * 0.16, 0.1, 0.88);
      d.who = `${c.hero ? c.hero.epithet + ' ' : '무사 '}${c.name}(${realmOf(c.martial)})`; },
    text: d => `인근 성에서 무림대회가 열린다. 우승자에게는 은자 200냥과 강호의 명성이 주어진다.\n마을에서 가장 강한 이는 ${d.who}.`,
    choices: d => [
      { label: `${d.cname}${pp(d.cname, '을/를')} 출전시킨다`, sub: `우승 가능성 ${Math.round(d.p * 100)}%`, run: () => {
        const c = S.villagers.find(v => v.id === d.champ);
        if (!c || c.dead) return '출전할 사람이 없다.';
        if (Math.random() < d.p) { addFame(40); addRes('silver', 200); c.martial = Math.min(S.martialCap + (c.hero ? 2.5 : 0), c.martial + 0.5); updateStats(c); S.stats.titles = (S.stats.titles || 0) + 1;
          logMsg(`${c.name}${pp(c.name, '이/가')} 무림대회에서 우승했다!`, 'good');
          return `${c.name}${pp(c.name, '이/가')} 결승에서 상대의 검을 부러뜨리고 우승했다! 은자 200냥, 명성 +40. 강호가 ${VN()}${pp(VN(), '을/를')} 주목한다.`; }
        injure(c, 0.25); addFame(5); return `${c.name}${pp(c.name, '은/는')} 분전했지만 4강에서 고배를 마셨다. 그래도 이름은 알렸다. 명성 +5.`; } },
      { label: '출전하지 않는다', run: () => '대회 소식은 바람결에만 들려왔다.' },
    ],
  },
  inn_brawl: {
    title: '객잔의 칼부림', stamp: '鬪', weight: 0.8, cd: 10,
    cond: () => hasUsable('inn'),
    text: () => '객잔에서 청운검문 제자와 철혈방 무사가 시비가 붙었다! 탁자가 부서지고 술독이 깨진다.',
    choices: () => [
      { label: '청운검문 제자 편을 든다', sub: '청운 +8 · 철혈방 -10', run: () => { changeRel('cheongun', 8); changeRel('cheolhyeol', -10); return '철혈방 무사가 욕을 하며 쫓겨났다.'; } },
      { label: '철혈방 무사 편을 든다', sub: '철혈방 +8 · 청운 -10', run: () => { changeRel('cheolhyeol', 8); changeRel('cheongun', -10); return '청운검문 제자가 분을 삭이며 떠났다.'; } },
      { label: '둘 다 끌어낸다', sub: '마을 무력이 충분하면 명성이 오른다', run: () => {
        if (defensePower() >= 15) { addFame(8); return '무사들이 둘을 양쪽에서 붙잡아 마을 밖으로 내던졌다. <q>여기선 칼을 뽑지 마시오.</q> 명성 +8.'; }
        S.res.silver = Math.max(0, S.res.silver - 40); addFame(-2); return '말리다가 객잔만 더 부서졌다. 수리비로 은자 40냥이 들었다.'; } },
    ],
  },
  fire: {
    title: '한밤의 화재', stamp: '火', weight: 0.6, cd: 8,
    cond: () => isNight() && S.buildings.some(b => usable(b) && ['house', 'house2', 'inn', 'market', 'warehouse'].includes(b.type)),
    init: d => {
      const cands = S.buildings.filter(b => usable(b) && ['house', 'house2', 'inn', 'market', 'warehouse'].includes(b.type));
      d.b = pick(cands).id;
    },
    text: d => { const b = getB(d.b); return `${b ? BDEF[b.type].name : '건물'}에서 불길이 솟았다! 밤하늘이 붉게 물든다.`; },
    choices: d => [
      { label: '모두 깨워 불을 끈다!', run: () => {
        const b = getB(d.b);
        if (!b) return '불은 저절로 꺼졌다.';
        const wells = S.buildings.filter(o => usable(o) && o.type === 'well' && dist(o.x, o.y, b.x, b.y) < 9).length;
        const frac = wells ? 0.25 : 0.6;
        b.hp -= b.maxHp * frac; b.burning = true; b.burnUntil = S.time + 2;
        if (b.hp <= 0) { buildingDestroyed(b); return '불길이 너무 거셌다. 건물이 잿더미가 되었다.'; }
        return wells ? '우물에서 물을 길어 날라 금세 불을 잡았다. 피해는 크지 않다.' : '물동이를 들고 밤새 뛰어다녔다. 가까이에 우물이 있었다면 좋았을 텐데.';
      } },
    ],
  },
  festival: {
    title: '명절', stamp: '節', weight: 1.2, cd: 16,
    cond: () => (seasonIdx() === 0 && dayOf() % DAYS_PER_SEASON < 4) || (seasonIdx() === 2 && dayOf() % DAYS_PER_SEASON >= 4),
    text: () => (seasonIdx() === 0 ? '단오가' : '한가위가') + ' 다가왔다. 사람들이 영주의 눈치를 살핀다.',
    choices: () => [
      { label: '성대한 잔치를 연다', sub: '은자 -80 · 식량 -50 · 나흘간 민심 크게 상승 · 명성 +10', ok: () => S.res.silver >= 80 && S.res.food >= 50,
        run: () => { S.res.silver -= 80; S.res.food -= 50; addMod('festival', 4); addFame(10); return '그네가 하늘 높이 오르고 씨름판이 벌어졌다. 인근 마을 사람들까지 구경을 왔다.'; } },
      { label: '조촐하게 보낸다', sub: '은자 -25 · 이틀간 민심 상승', ok: () => S.res.silver >= 25, run: () => { S.res.silver -= 25; addMod('festival', 2); return '집집마다 떡을 나누었다.'; } },
      { label: '그냥 넘어간다', run: () => '여느 날과 다름없이 지나갔다. 아이들이 실망한 얼굴이다.' },
    ],
  },
  spy: {
    title: '붙잡힌 첩자', stamp: '諜', weight: 0.8, cd: 12,
    cond: () => FACTION_ORDER.some(k => FACTIONS[k].military && rel(k) < -20),
    init: d => { d.k = pick(FACTION_ORDER.filter(k => FACTIONS[k].military && rel(k) < -20)); },
    text: d => `야경을 돌던 사람들이 담을 넘던 수상한 자를 붙잡았다. 품에서 ${fName(d.k)}의 영패가 나왔다.`,
    choices: d => [
      { label: '심문한다', sub: `${fName(d.k)}의 습격 계획을 늦춘다`, run: () => { S.factions[d.k].threat = Math.max(0, S.factions[d.k].threat - 45); changeRel(d.k, -5);
        return `첩자는 끝내 입을 열었다. ${fName(d.k)}${pp(fName(d.k), '이/가')} 마을을 노리고 있었다. 미리 알았으니 대비할 시간을 벌었다.`; } },
      { label: '풀어준다', sub: `${fName(d.k)} 관계 +12`, run: () => { changeRel(d.k, 12); return '첩자는 어리둥절한 얼굴로 몇 번이나 뒤를 돌아보며 떠났다.'; } },
      { label: '관부에 넘긴다', sub: `관부 +10 · ${fName(d.k)} -10 · 명성 +3`, run: () => { changeRel('gwanbu', 10); changeRel(d.k, -10); addFame(3); return '포졸들이 첩자를 끌고 갔다.'; } },
    ],
  },
  cave: {
    title: '뒷산의 동굴', stamp: '窟', weight: 0.6, cd: 25,
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
    title: '혼례', stamp: '囍', weight: 0.9, cd: 8,
    cond: () => S.villagers.filter(v => !v.dead && v.age < 35 && !v.hero).length >= 2,
    init: d => {
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
  disciples: {
    title: '하산 수련', stamp: '修', weight: 0.6, cd: 20,
    cond: () => rel('cheongun') >= 30 && !hasMod('disciples'),
    text: () => '청운검문에서 서신이 왔다. 제자 몇을 마을에 보내 닷새 동안 하산 수련을 시키고 싶다고 한다. 머무는 동안 마을을 지켜줄 것이다.',
    choices: () => [
      { label: '받아들인다', sub: '식량 -40 · 닷새간 청운검수 4명이 마을을 지킨다', ok: () => S.res.food >= 40,
        run: () => { S.res.food -= 40; addMod('disciples', 5); spawnAllies('cheongun', 4, 5); changeRel('cheongun', 5); addFame(5); return '흰 도포의 젊은 검수들이 마을에 들어섰다. 아이들이 졸졸 따라다닌다.'; } },
      { label: '사양한다', run: () => '정중히 거절하는 답신을 보냈다.' },
    ],
  },
  prodigy: {
    title: '타고난 근골', stamp: '才', weight: 0.5, cd: 25,
    cond: () => civilians().some(v => v.age < 26),
    init: d => { d.v = pick(civilians().filter(v => v.age < 26)).id; },
    text: d => { const v = unitById(d.v) || S.villagers.find(o => o.id === d.v); return `${v ? v.name : '어떤 아이'}${pp(v ? v.name : '어떤 아이', '이/가')} 놀라운 근골을 지녔다는 소문이 돈다. 나무 지게를 지고 산을 뛰어오른다고 한다.`; },
    choices: d => [
      { label: '무관에서 가르친다', sub: '무공 재능이 크게 오른다', ok: () => hasUsable('dojo'),
        run: () => { const v = S.villagers.find(o => o.id === d.v); if (!v) return '그 아이는 이미 마을을 떠났다.'; v.talent = 2.4; v.martial += 1; updateStats(v); markDirty();
          return `${v.name}${pp(v.name, '이/가')} 무관 문을 두드렸다. 언젠가 마을을 지키는 큰 기둥이 될 것이다.`; } },
      { label: '청운검문에 입문시킨다', sub: '청운 +15 · 명성 +10 · 마을을 떠난다', run: () => { const v = S.villagers.find(o => o.id === d.v); if (v) { v.leaving = true; v.act = null; } changeRel('cheongun', 15); addFame(10);
        return '청운검문이 기꺼이 제자로 받아들였다. 언젠가 이름을 떨치면 고향을 잊지 않을 것이다.'; } },
      { label: '평범하게 살게 둔다', run: () => '그저 힘센 일꾼으로 자랄 것이다.' },
    ],
  },
  tiger: {
    title: '호환', stamp: '虎', weight: 0.6, cd: 20,
    cond: () => dayOf() >= 4 && !hasMod('tiger'),
    text: () => '뒷산에 집채만 한 호랑이가 나타났다! 나무꾼 하나가 간신히 도망쳐 왔다. 해가 지면 아무도 문밖에 나가려 하지 않는다.',
    choices: () => [
      { label: '무사들이 사냥에 나선다', sub: '마을 무력이 충분해야 한다', ok: () => fighters().length > 0, run: () => {
        if (defensePower() >= 12 || S.villagers.some(v => v.hero && !v.dead)) { addFame(12); addRes('silver', 60); return '무사들이 호랑이를 몰아 잡았다! 호피는 은자 60냥에 팔렸고, 마을의 이름이 올랐다.'; }
        const f = pick(fighters()); if (f) injure(f, 0.15); addMod('tiger', 2); return '호랑이는 너무 강했다. 다친 무사를 업고 돌아왔다.'; } },
      { label: '사냥꾼을 고용한다', sub: '은자 -60', ok: () => S.res.silver >= 60, run: () => { S.res.silver -= 60; return '이름난 사냥꾼이 이틀 만에 호랑이를 잡아 왔다.'; } },
      { label: '문을 걸어 잠근다', sub: '사흘간 민심 하락 · 사람이 다칠 수 있다', run: () => { addMod('tiger', 3);
        if (Math.random() < 0.3) { const v = pick(civilians()); if (v) { v.dead = true; S.stats.died++; return `안타깝게도 ${v.name}${pp(v.name, '이/가')} 호환을 당했다.`; } }
        return '사람들은 해가 지기 전에 서둘러 집으로 들어간다.'; } },
    ],
  },
  invest: {
    title: '금룡상회의 제안', stamp: '金', weight: 0.6, cd: 20,
    cond: () => S.res.silver >= 220 && dayOf() >= 6 && !S.scheduled.some(s => s.id === 'invest_return'),
    text: () => '금룡상회 대행수가 은밀히 찾아왔다.\n<q>서역으로 가는 비단 상단에 은자 200냥만 넣으시지요. 열흘 뒤 두 배로 돌려드리겠습니다. 물론… 사막 길이 순탄하다면요.</q>',
    choices: () => [
      { label: '은자 200냥을 맡긴다', sub: '열흘 뒤 결과가 나온다', run: () => { S.res.silver -= 200; S.scheduled.push({ at: S.time + 240, kind: 'event', id: 'invest_return', data: {} }); changeRel('geumryong', 5); return '대행수가 어음을 써 주었다.'; } },
      { label: '거절한다', run: () => '<q>아쉽군요. 다음 기회에.</q>' },
    ],
  },
  invest_return: {
    title: '상단의 귀환', stamp: '金', weight: 0, cd: 0, cond: () => false,
    init: d => { d.ok = Math.random() < 0.75; },
    text: d => d.ok ? '서역에 갔던 상단이 돌아왔다! 대행수가 약속대로 은자 꾸러미를 내민다.' : '나쁜 소식이다. 상단이 사막에서 마적 떼를 만났다고 한다. 대행수가 고개를 숙인다.',
    choices: d => [{ label: '확인', run: () => { if (d.ok) { addRes('silver', 420); return '은자 420냥을 받았다.'; } changeRel('geumryong', 5); return '맡긴 은자는 돌아오지 않았다. 대행수는 다음엔 꼭 갚겠다고 했다.'; } }],
  },
  inspection: {
    title: '현령의 시찰', stamp: '官', weight: 0.6, cd: 25,
    cond: () => S.rank >= 2 && rel('gwanbu') >= 15 && !S.occupation,
    text: () => `현령이 가마를 타고 ${VN()}${pp(VN(), '을/를')} 시찰하러 왔다. 마을이 커졌다는 소문을 들은 모양이다.`,
    choices: () => [
      { label: '성대히 대접한다', sub: '은자 -60 · 관부 +15 · 명성 +12', ok: () => S.res.silver >= 60, run: () => { S.res.silver -= 60; changeRel('gwanbu', 15); addFame(12); return '흡족해진 현령이 마을을 칭찬하는 상소를 올리겠다고 약속했다.'; } },
      { label: '간소하게 맞는다', sub: '관부 +4', run: () => { changeRel('gwanbu', 4); return '현령은 차 한 잔을 마시고 돌아갔다.'; } },
    ],
  },
  defector: {
    title: '산적의 투항', stamp: '降', weight: 0.6, cd: 15,
    cond: () => S.stats.raidsWon >= 1 && rel('heukpung') < 0,
    text: () => '흑풍채에서 도망쳐 온 산적 하나가 무릎을 꿇었다.\n<q>채주의 횡포를 더는 못 참겠소. 받아만 주시면 이 마을을 위해 칼을 들겠소.</q>',
    choices: () => [
      { label: '받아들인다', sub: '무공을 아는 장정 +1 · 흑풍채 -8', run: () => { const p = plazaTile(); const v = newVillager({ sex: 'm', x: p.x + 0.5, y: p.y + 0.5, martial: 1.3, talent: 1.1 }); changeRel('heukpung', -8); markDirty();
        return `${v.name}${pp(v.name, '이/가')} 마을 사람이 되었다. 산채 사정에 밝으니 쓸모가 있을 것이다.`; } },
      { label: '관부에 넘긴다', sub: '관부 +8 · 현상금 은자 +30', run: () => { changeRel('gwanbu', 8); addRes('silver', 30); return '현상금이 걸려 있던 자였다.'; } },
    ],
  },
};

// 습격 경고 (위협이 쌓이면 발생)
const GOAL_TEXT = {
  loot: '곡식과 은자를 노리는 모양이다.',
  occupy: '<em>마을을 통째로 집어삼키려 한다!</em> 영주관이 무너지면 마을은 그들의 손에 넘어간다.',
  punish: '마을을 혼내 주겠다고 벼르고 있다.',
};
function chooseGoal(k) {
  const pop = popCount();
  if (k === 'heukpung') return 'loot';
  if (k === 'cheolhyeol') return pop >= 28 && Math.random() < 0.45 ? 'occupy' : 'loot';
  if (k === 'hyeolwol') return pop >= 20 && Math.random() < 0.6 ? 'occupy' : 'loot';
  if (k === 'gwanbu') return 'occupy';
  return 'punish';
}

const Events = {
  queue(id, data = {}) { S.eventQueue.push({ id, data }); },
  notice(title, body, stamp = '告') { S.eventQueue.push({ id: '_notice', data: { title, body, stamp } }); },
  raidWarning(k, mul = 1) {
    if (this.raidPending() || S.occupation) return;
    const goal = chooseGoal(k);
    const size = raidSize(k, mul * (goal === 'occupy' ? 1.1 : 1));
    const ex = pickExit(k);
    const delay = rndi(3, 5);
    S.eventQueue.push({ id: '_raid', data: { k, goal, size, exitIdx: World.exits.indexOf(ex), delay } });
  },
  raidPending() { return !!S.raid || S.scheduled.some(s => s.kind === 'raid') || S.eventQueue.some(e => e.id === '_raid'); },
  roll() {
    const day = dayOf();
    const cands = Object.entries(EV).filter(([id, e]) => {
      if (!e.weight) return false;
      if (S.occupation && !['merchant', 'wedding', 'refugees', 'plague', 'fire'].includes(id)) return false;
      const last = S.cooldowns[id];
      if (last !== undefined && day - last < e.cd) return false;
      try { return e.cond(); } catch (err) { return false; }
    });
    if (!cands.length) return;
    const [id] = weighted(cands, ([, e]) => e.weight);
    S.cooldowns[id] = day;
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
    if (id === '_victory') return {
      title: '강호에 이름을 떨치다', stamp: '名',
      text: `작은 촌락이었던 ${VN()}${pp(VN(), '이/가')} 이제 현성이 되었다. 정파도 사파도, 관부도 상단도 이 마을의 영주를 함부로 대하지 못한다.\n\n강호의 이야기꾼들은 오늘도 객잔에서 ${VN()}의 영주 이야기를 한다.\n\n<em>천하제일촌을 이루었다.</em> 원한다면 계속 마을을 다스릴 수 있다.`,
      choices: [{ label: '계속 다스린다', run: () => null }],
    };
    const e = EV[id];
    if (!e) return null;
    if (e.init && !data._init) { e.init(data); data._init = true; }
    S.stats.events++;
    return { title: e.title, stamp: e.stamp, text: e.text(data), choices: e.choices(data) };
  },
  buildRaid(d) {
    const F = FACTIONS[d.k];
    const ex = World.exits[d.exitIdx] || World.exits[0];
    const tribute = Math.round(d.size * 14 + dayOf() * 2);
    const helpers = FACTION_ORDER.filter(m => m !== d.k && FACTIONS[m].military && rel(m) >= 35 && m !== S.vassal);
    const lordNote = S.vassal && S.vassal !== d.k && FACTIONS[S.vassal].military ? `\n\n주군인 <em>${fName(S.vassal)}</em>에서 원군을 보낼 것이다.` : '';
    const choices = [
      { label: '맞서 싸운다!', sub: `${d.delay}시진(${d.delay * 2}시간) 뒤 들이닥친다`, run: () => {
        scheduleRaid(d.k, d.delay * 2, d.goal, d.size, { exit: ex });
        logMsg(`${F.name}의 습격이 다가온다. 무사들이 창을 고쳐 잡는다.`, 'war');
        return '종이 울렸다. 아낙들은 아이들을 집 안으로 들이고, 장정들은 무기를 챙긴다.'; } },
      { label: '은자를 바쳐 화친한다', sub: `은자 -${tribute} · ${F.name} 관계 +6`, ok: () => S.res.silver >= tribute, run: () => {
        S.res.silver -= tribute; changeRel(d.k, 6);
        logMsg(`${F.name}에 은자 ${tribute}냥을 바쳐 습격을 피했다.`, '');
        return `${F.leader.title}가 은자 상자를 받아 들고 무리를 돌렸다. 굴욕적이지만 피는 흐르지 않았다.`; } },
    ];
    for (const m of helpers.slice(0, 2)) {
      choices.push({ label: `${fName(m)}에 구원을 청한다`, sub: `은자 -60 · ${fName(m)}의 무인들이 함께 싸운다`, ok: () => S.res.silver >= 60, run: () => {
        S.res.silver -= 60; changeRel(m, -3);
        scheduleRaid(d.k, d.delay * 2, d.goal, d.size, { exit: ex });
        S.scheduled.push({ at: S.time + d.delay * 2 + 0.6, kind: 'allies', faction: m, n: 4 + Math.floor(dayOf() / 8) });
        return `${fName(m)}${pp(fName(m), '이/가')} 무인들을 보내겠다고 답했다.`; } });
    }
    return {
      title: `${F.name} 습격 경보`, stamp: F.hanja,
      text: `척후가 숨을 헐떡이며 달려왔다!\n<em>${F.name}</em>의 ${F.leader.title}가 무리 <em>${d.size}명</em>을 이끌고 ${ex.name}${pp(ex.name, '으로/로')} 다가오고 있다. ${GOAL_TEXT[d.goal]}\n\n약 ${d.delay}시진 뒤 들이닥칠 것이다. 무사 ${fighters().length}명, 망루 ${countType('tower')}개가 마을을 지킨다.${lordNote}`,
      choices,
    };
  },
  gameOver() { S.eventQueue.length = 0; S.eventQueue.push({ id: '_gameover', data: {} }); Store.del(SAVE_KEY); },
  victory() { S.eventQueue.push({ id: '_victory', data: {} }); },
};
