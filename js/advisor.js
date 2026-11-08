'use strict';
// ───────────────────────────────────────────────
// 총관의 발전 진단 (Advisor) — 마을이 왜 크지 않는지, 지금 무엇을 하면 가장 보탬이 되는지
//  · 순수 함수: S 를 읽기만 하고 바꾸지 않는다. 같은 게임 시각(15분 단위)·같은 마을 모양이면 기억해 둔 값을 쓴다
//  · growth(): sim.js growthCheck 와 같은 식으로 새 식구가 오는 문 넷(점령·식량·빈 집·민심)과 한 번에 오는 수(명성·민심 70)
//  · list(): 권할 일 (급한 것부터). 하나는 { id, pri, cd, label, diag(), todo(), lines(), act, done() }
//      label: 할 일 두루마리의 한 줄 · diag/todo: 총관의 말(진단, 할 일) · cd: 스스로 아뢴 뒤 같은 말을 다시 꺼내기까지의 날
//      act: 짚어 줄 곳 { k: 'build' type | 'repair' id | 'panel' id act tag | 'tax' to | 'wait' types | 'sel' sel tag } — story.js 가 금빛 고리·화살표로 바꾼다
//  말은 총관 윤서하의 합니다체. 숫자는 지금 장부 그대로다
// ───────────────────────────────────────────────
const ADVISOR_GLOSS = {
  '勸': ['권할 권', '권함. 할 일 두루마리의 「권고」는 총관이 지금 마을을 키우는 데 가장 보탬이 된다고 보는 일이다. 누르면 까닭과 할 일을 짚어 준다.'],
};
for (const [k, v] of Object.entries(ADVISOR_GLOSS)) if (!HANJA_GLOSS[k]) HANJA_GLOSS[k] = v;

const Advisor = (() => {
  // sim.js growthCheck 의 수 (바뀌면 같이 바꾼다)
  const HAPPY_GATE = 42, HAPPY_BONUS = 70, HAPPY_LEAVE = 25, FAME_STEP = 120, FOOD_MUL = 1.2;
  const TAX_RATE = [0.8, 1.25, 1.8], TAX_MOOD = [8, 0, -12];
  const SHOP_H = 9;   // 장사 일터의 하루 일하는 시간 (육방의 어림과 같다)

  // ── 작은 도구 ─────────────────────────────
  const nm = t => BDEF[t].name;
  const catOf = t => ((BUILD_CATS.find(c => c.id === BDEF[t].cat) || {}).name || '');
  const where = t => `아래 건설 띠의 [${catOf(t)}]에서 [${nm(t)}]`;
  const has = t => S.buildings.some(b => b.type === t && !b.ruined);
  const countLive = t => S.buildings.filter(b => b.type === t && !b.ruined).length;   // 다 지은 것과 짓는 것
  const ruinOf = t => S.buildings.find(b => b.type === t && b.ruined);
  const sitesOf = types => S.buildings.filter(b => types.includes(b.type) && !b.done && !b.ruined);
  const rankOk = t => !BDEF[t].rank || S.rank >= BDEF[t].rank;
  const n1 = x => { const r = Math.round(x * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  // 「다섯 식구」: 열까지는 우리말 수로 (그 위는 「12명」)
  const KN = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
  const kin = n => (KN[n] ? `${KN[n]} 식구` : `${n}명`);
  // 이름 여럿을 「사당과 우물」처럼
  const andList = a => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join('·')}${pp(a[a.length - 2], '과/와')} ${a[a.length - 1]}`);
  // 문턱 가까이에서는 소수 한 자리(내림)까지: 41.96 이 「42」로 읽혀 문이 열린 것처럼 보이지 않게
  const near = (x, thr) => (Math.abs(x - thr) < 1 ? (Math.floor(x * 10) / 10).toFixed(1) : String(Math.round(x)));
  // 숫자 뒤 조사: 받침 있는 끝자리 0·1·3·6·7·8 (영·일·삼·육·칠·팔, 십·백·천), ㄹ받침 1·7·8 은 「로」
  function jn(n, pair) {
    const s = String(n), d = s[s.length - 1];
    if (!/\d/.test(d)) return pp(s, pair);
    const [a, b] = pair.split('/');
    if (pair === '으로/로') return /[036]/.test(d) ? a : b;
    return /[013678]/.test(d) ? a : b;
  }
  // 「목재 20이면」·「목재 15면」
  const ifCost = cost => { const s = costText(cost); return s + (/\d$/.test(s) ? (/[013678]$/.test(s) ? '이면' : '면') : '이면'); };
  const petPending = () => { const n = hook(Petitions, 'pending'); return typeof n === 'number' ? n : 0; };
  const jhOpen = () => typeof JH !== 'undefined' && typeof JH.allowJianghu === 'function' && JH.allowJianghu();

  // ── 사람 ─────────────────────────────────
  // pop: popCount() 와 같다(길 위의 새 식구도 든다) · idle: 육방이 세는 「일 없는 이」와 같다
  // arriving: growthCheck 처럼 길 위의 새 식구를 모두 센다(오다가 발길을 돌린 이도 집 칸을 잡고 있다)
  function people() {
    let pop = 0, arriving = 0, idle = 0, homeless = 0;
    for (const v of S.villagers) {
      if (v.arriving) arriving++;
      if (v.dead || v.leaving) continue;
      pop++;
      if (!v.home) homeless++;   // 민심의 「집 없는 사람」과 같은 셈
      if (v.arriving) continue;
      if (!v.away && !v.down && !v.hero && !v.job && v.age >= 14) idle++;
    }
    return { pop, arriving, idle, homeless };
  }

  // ── 성장의 문 (sim.js growthCheck 그대로) ─────────
  // 새 식구는 빈 집(집 칸 − 사람 − 길 위의 새 식구) > 0, 식량 > 사람 × 1.2, 민심 ≥ 42, 점령되지 않음일 때만 온다.
  // 한 번(묘시·미시 하루 두 번)에 오는 수는 1~(1 + 명성/120 + 민심 70 넘으면 1 + 아침이면 1), 빈 집 수를 넘지 않는다
  function growth() {
    const p = people();
    const pop = p.pop, H = housingTotal();
    const free = H - pop - p.arriving;
    let soon = 0;
    for (const b of S.buildings) if (!b.done && !b.ruined && BDEF[b.type].housing) soon += BDEF[b.type].housing;
    const food = S.res.food, need = pop * FOOD_MUL;
    const happy = S.happy, target = happinessTarget();
    const occ = S.occupation || null;
    const ok = { occ: !occ, food: food > need, house: free > 0, happy: happy >= HAPPY_GATE };
    const open = ok.occ && ok.food && ok.house && ok.happy;
    const fameN = Math.floor(S.fame / FAME_STEP);
    const maxN = 1 + fameN + (happy > HAPPY_BONUS ? 1 : 0);
    // 민심은 시각마다 목표치로 12%씩 다가간다 (hourlyTick)
    let riseH = 0;
    if (!ok.happy && target >= HAPPY_GATE + 0.5) riseH = Math.max(1, Math.ceil(Math.log((target - HAPPY_GATE) / (target - happy)) / Math.log(0.88)));
    return Object.assign(p, { H, free, soon, food, need, happy, target, occ, ok, open, fame: S.fame, fameN, maxN, riseH, leaving: happy < HAPPY_LEAVE && pop > 3 });
  }
  // 닫힌 문을 한 문장으로 (인구가 멈췄을 때의 첫마디)
  function blockText(g) {
    const parts = [];
    if (!g.ok.occ) parts.push(`마을이 ${FACTIONS[g.occ.faction].name}에 점령되어 있습니다`);
    if (!g.ok.food) parts.push(`식량이 ${fmt(g.food)}섬으로 ${n1(g.need)}섬(사람의 1.2배)에 못 미칩니다`);
    if (!g.ok.house) parts.push(`빈 집이 없습니다(집 ${g.H}칸에 ${g.pop}명)`);
    if (!g.ok.happy) parts.push(`민심이 ${near(g.happy, HAPPY_GATE)}${jn(near(g.happy, HAPPY_GATE), '으로/로')} 42에 못 미칩니다`);
    if (!parts.length) return '지금은 사람이 오는 문이 다 열려 있습니다.';
    return parts.join('. ') + '.';
  }

  // ── 먹을 것 (sim.js economyStep 과 같은 배수) ───────
  function foodFlow(pop) {
    const si = seasonIdx();
    const hF = +hook(Admin, 'workHours', 'farm') || 8, hX = +hook(Admin, 'workHours', 'fishery') || 6.5;
    const drought = hasMod('drought') ? (hasMod('well_dug') ? 0.7 : 0.4) : 1;
    const m = (hasMod('quarantine') ? 0.6 : 1) * (S.occupation ? 0.85 : 1);
    const perFarmer = 0.66 * farmMul(si) * drought * (hasMod('harvest') ? 1.4 : 1) * hF * m;
    const perFisher = 0.56 * fishMul(si) * hX * m;
    let farmW = 0, fishW = 0;
    for (const b of S.buildings) {
      if (!usable(b) || !b.active || (b.type !== 'farm' && b.type !== 'fishery')) continue;
      const w = (b._workers || []).filter(v => !v.away).length;
      if (b.type === 'farm') farmW += w; else fishW += w;
    }
    return {
      prod: farmW * perFarmer + fishW * perFisher, cons: pop * 2 * foodUseMul(si), perFarmer, perFisher,
      winter: isWinter(si), winterNext: si === 2 && isWinter(3), autumn: si === 2,
    };
  }

  // ── 지을 자리가 있는가 (하루에 한 번만 살핀다) ─────
  const siteMemo = {};
  function siteOk(type) {
    const key = `${dayOf()}|${S.buildings.length}|${S.manorId}`;
    const c = siteMemo[type];
    if (c && c.k === key && c.S === S) return c.v;
    const m = getB(S.manorId);
    const cx = m ? m.x + 1 : World.center.x, cy = m ? m.y + 1 : World.center.y;
    // 돌릴 수 있는 건물은 어느 방향으로든 들어가면 자리가 있다 (world.js §2.2 dirsOf·footOf)
    const dirs = dirsOf(type);
    let v = false;
    for (let y = cy - 15; y <= cy + 15 && !v; y++) for (let x = cx - 15; x <= cx + 15 && !v; x++) {
      for (const d of dirs) { const r = canPlace(type, x, y, d); if (r.ok || r.poor) { v = true; break; } }
    }
    siteMemo[type] = { k: key, S, v };
    return v;
  }

  // ── 민심 ─────────────────────────────────
  // 편의 시설의 몫 (sim.js happinessFactors). sites 면 짓고 있는 것도 다 섰다고 셈한다
  function amenity(sites) { let a = 0; for (const b of S.buildings) if (usable(b) || (sites && !b.done && !b.ruined)) a += BDEF[b.type].happy || 0; return a; }
  const amenK = pop => Math.sqrt(12 / Math.max(12, pop));
  // 짓고 있는 편의 시설(사당·시장·기와집…)이 다 서면 오를 민심
  function amenPending(pop) { const k = amenK(pop); return Math.min(28, amenity(true) * k) - Math.min(28, amenity(false) * k); }
  const amenSites = () => sitesOf(Object.keys(BDEF).filter(t => BDEF[t].happy > 0));
  // 편의 시설 하나를 더하면 오르는 민심 (인구가 늘수록 묽어지고 28에서 막힌다). 짓고 있는 것은 이미 선 것으로 보고 그 위에 더한다
  function amenGain(type, pop) {
    const a = amenity(true), k = amenK(pop);
    return Math.min(28, (a + (BDEF[type].happy || 0)) * k) - Math.min(28, a * k);
  }
  const costSum = c => (c.silver || 0) + (c.wood || 0) * 1.2 + (c.stone || 0) * 1.7;
  // 모자란 재료: 「 지금은 은자 7이 모자랍니다.」 (다 있으면 '')
  function shortText(cost) {
    const parts = [];
    for (const k of ['silver', 'wood', 'stone']) if (cost[k] && (S.res[k] || 0) < cost[k]) parts.push(`${RESOURCES[k].name} ${Math.ceil(cost[k] - S.res[k])}`);
    if (!parts.length) return '';
    const last = parts[parts.length - 1];
    return ` 지금은 ${parts.join('·')}${jn(last, '이/가')} 모자랍니다.`;
  }
  // 넉넉한가: 재료가 있고, 쓰고 나서도 은자가 품삯·예산 몫(40 + 사람 × 1.5)만큼 남는가.
  // 급하지 않은 일(민심 70·객잔·일터·채석장)은 이때만 권한다 (살림이 빠듯할 때 사당부터 지으라 하지 않게)
  function rich(cost) {
    if (!canAfford(cost)) return false;
    return S.res.silver - (cost.silver || 0) >= 40 + popCount() * 1.5;
  }
  // 민심을 올릴 길: [{ id, gain, cost, text, act }] — 값이 큰 것부터. forGate 면 세금이 먼저(곧바로, 공짜)
  function remedies(g, forGate) {
    const out = [];
    const f = happinessFactors();
    const val = name => { const x = f.find(([k]) => k === name); return x ? x[1] : 0; };
    if (S.tax > 0) {
      const to = S.tax - 1, gain = TAX_MOOD[to] - TAX_MOOD[S.tax];
      const cut = Math.round((1 - TAX_RATE[to] / TAX_RATE[S.tax]) * 100);
      // 곳간이 빠듯하면 세금을 깎는 것도 값이 비싸다
      out.push({ id: 'tax', gain, cost: forGate ? (S.res.silver < 50 ? 40 : 0) : 60, act: { k: 'tax', to },
        text: `[마을 현황]에서 세율을 「${['낮게', '보통'][to]}」${pp(['낮게', '보통'][to], '으로/로')} 내리시면 민심이 ${gain} 오릅니다. 세금은 ${cut}%쯤 줄어듭니다.` });
    }
    if (g.homeless) {
      const gain = -val('집 없는 사람');
      out.push({ id: 'homeless', gain, cost: 20, act: houseAct(), text: `집 없이 한데서 자는 사람이 ${g.homeless}명입니다. 초가를 지어 들이시면 민심이 ${n1(gain)} 오릅니다.` });
    }
    const hunger = val('굶주림') || val('식량 부족');
    if (hunger) out.push({ id: 'hunger', gain: -hunger, cost: 25, act: { k: 'build', type: 'farm' }, text: `곳간이 달려 민심이 ${Math.round(-hunger)} 깎였습니다. 논밭을 늘려 곳간을 채우십시오.` });
    const pend = petPending();
    if (pend) {
      const gain = Math.max(0, -val('쌓인 상소')) + Math.min(6, pend * 2);
      out.push({ id: 'petition', gain, cost: 15, act: { k: 'sel', sel: '#btn-petitions', tag: '상소함' },
        text: `[상소함]에 상소가 ${pend}건 기다립니다. 들어주시면 민심이 오릅니다.${pend > 2 ? ' 쌓인 상소가 깎는 몫도 풀립니다.' : ''}` });
    }
    const ruin = val('타다 남은 집터');
    if (ruin) {
      const r = (S.story && S.story.ruins || []).map(id => getB(id)).find(b => b && b.ruined);
      if (r) out.push({ id: 'ruin', gain: 2, cost: costSum(repairCost(r)), res: repairCost(r), act: { k: 'repair', id: r.id }, text: `타다 남은 집터가 민심을 ${Math.round(-ruin)} 깎습니다. 무너진 ${nm(r.type)}${pp(nm(r.type), '을/를')} 눌러 다시 지으십시오(${costText(repairCost(r))}).` });
    }
    if (val('치안 불안') && has('dojo')) {
      const d = S.buildings.find(b => b.type === 'dojo' && usable(b));
      if (d && d.want < BDEF.dojo.workers) out.push({ id: 'guard', gain: 6, cost: 30, act: { k: 'panel', id: d.id, act: 'want+', tag: '일꾼 +' }, text: '무사가 모자라 치안이 불안합니다(−6). 무관을 눌러 [일꾼 +]로 수련생을 채우십시오.' });
    }
    if (val('아전들의 탐학')) {
      // 탐욕스러운 아전을 둔 부서 (예산을 받는 곳만 원성을 산다: admin.js happinessFactors)
      const ids = (Admin.ORDER || []).filter(id => { const d = Admin.dept(id); return d && d.head && d.head.trait === 'greedy' && d.budget > 0; });
      const dn = ids.map(id => Admin.DEPTS[id].name);
      const rc = +hook(Admin, 'replaceCost') || 12;
      if (dn.length) out.push({ id: 'greedy', gain: -val('아전들의 탐학'), cost: rc, res: { silver: rc }, act: { k: 'sel', sel: '#btn-admin', tag: '육방' },
        text: `${andList(dn)}의 아전이 탐욕스러워 백성을 쥐어짭니다. [육방]에서 ${dn[0]}${pp(dn[0], '을/를')} 열어 그 아전을 바꾸십시오(은자 ${rc}냥).${shortText({ silver: rc })}` });
    }
    for (const t of ['shrine', 'market', 'pavilion', 'inn', 'well']) {
      if (!rankOk(t)) continue;
      const gain = amenGain(t, g.pop);
      if (gain < 0.5) continue;
      const extra = t === 'market' ? ' 장이 서면 은자도 돕니다.' : t === 'inn' ? ' 은자와 명성도 법니다.' : '';
      out.push({ id: 'amen:' + t, gain, cost: costSum(BDEF[t].cost), res: BDEF[t].cost, act: { k: 'build', type: t },
        text: `${where(t)}${pp(nm(t), '을/를')} 지으십시오(${costText(BDEF[t].cost)}). 민심이 ${n1(gain)}쯤 오릅니다.${extra}${shortText(BDEF[t].cost)}` });
    }
    const ye = S.admin && S.admin.depts && S.admin.depts.ye;
    if (ye && !(ye.budget > 0) && g.pop >= 4) out.push({ id: 'fest', gain: 12, cost: 70, temp: true, act: { k: 'sel', sel: '#btn-admin', tag: '육방' },
      text: '[육방]의 예방에 예산을 주시면 민심이 가라앉을 때 잔치를 열어 줍니다(이틀 동안 +12).' });
    return out.sort((a, b) => (b.gain / (8 + b.cost / 15)) - (a.gain / (8 + a.cost / 15)));
  }
  // need 만큼 올릴 길: 하나로 메워지면 그중 가장 싼 것 하나, 모자라면 많이 올리는 것부터 셋까지 (잔치는 오래가지 않으니 맨 뒤)
  function pickRemedies(list, need) {
    const perm = list.filter(r => !r.temp);
    const enough = perm.filter(r => r.gain >= need).sort((a, b) => a.cost - b.cost);
    if (enough.length) return [enough[0]];
    const out = [];
    let sum = 0;
    for (const r of perm.slice().sort((a, b) => b.gain - a.gain)) { out.push(r); sum += r.gain; if (sum >= need || out.length >= 3) break; }
    const t = list.find(r => r.temp);
    if (sum < need && t && out.length < 3) out.push(t);
    return out;
  }
  function remedyLines(picks) {
    if (!picks.length) return [];
    const L = [{ m: 'calm', t: picks[0].text }];
    if (picks.length > 1) L.push({ m: 'calm', t: `하나로는 모자라니 이것도 함께 하십시오. ${picks.slice(1).map(r => r.text).join(' ')}` });
    return L;
  }

  // ── 집 ───────────────────────────────────
  // 가장 싸게 빈 집을 내는 길: 무너진 집 다시 짓기 → 초가(목재 20에 다섯) → (초가가 안 되면) 기와집
  function houseAct() {
    const r = ruinOf('house') || ruinOf('house2');
    if (r) return { k: 'repair', id: r.id };
    if (!canAfford(BDEF.house.cost) && rankOk('house2') && canAfford(BDEF.house2.cost)) return { k: 'build', type: 'house2' };
    return { k: 'build', type: 'house' };
  }
  function houseTodo(g) {
    const a = houseAct();
    if (a.k === 'repair') {
      const b = getB(a.id), rc = repairCost(b), n = nm(b.type);
      return [{ m: 'calm', t: `무너진 ${n}${pp(n, '은/는')} 새로 짓는 값의 절반인 ${ifCost(rc)} 다시 섭니다. 그 터를 눌러 [다시 짓기]를 누르십시오. ${kin(BDEF[b.type].housing)}${pp(kin(BDEF[b.type].housing), '이/가')} 살 수 있습니다.${shortText(rc)}` }];
    }
    const c = BDEF.house.cost;
    if (a.type === 'house2') return [{ m: 'calm', t: `목재가 초가 한 채 값(${c.wood})에도 못 미치지만, 기와집은 지을 수 있습니다. ${where('house2')}${pp('기와집', '을/를')} 지으십시오(${costText(BDEF.house2.cost)}). 여덟 식구가 살고 민심도 조금 오릅니다.` }];
    const wood = S.res.wood;
    if (wood < c.wood) {
      const lum = S.buildings.filter(b => b.type === 'lumber' && usable(b));
      if (!lum.length) return [{ m: 'calm', t: `초가 한 채에 목재 ${c.wood}${jn(c.wood, '이/가')} 드는데 지금 ${fmt(wood)}뿐이고 벌목장도 없습니다. [길·정리]의 [벌채]로 숲을 베면 은자 2냥에 목재 4를 얻고, ${where('lumber')}${pp('벌목장', '을/를')} 숲 가까이 지으면(${costText(BDEF.lumber.cost)}) 꾸준히 들어옵니다.` }];
      const rate = Math.max(0, Math.round((S.lastFlow && S.lastFlow.wood) || 0));
      const days = rate > 0 ? Math.max(1, Math.ceil((c.wood - wood) / rate)) : 0;
      return [{ m: 'calm', t: `초가 한 채에 목재 ${c.wood}${jn(c.wood, '이/가')} 드는데 지금 ${fmt(wood)}뿐입니다. ${days ? `어제 목재가 ${rate} 들어왔으니 ${days}일이면 모입니다.` : '벌목장 일꾼을 채우시면 목재가 들어옵니다.'} 모이면 ${where('house')}${pp('초가', '을/를')} 지으십시오.` }];
    }
    let t = `${where('house')}${pp('초가', '을/를')} 지으십시오. 목재 ${ifCost(c).replace(/^목재 /, '')} 다섯 식구가 더 삽니다.`;
    if (rankOk('house2')) {
      if (canAfford(BDEF.house2.cost)) t += ` 석재와 은자가 넉넉하니 기와집(${costText(BDEF.house2.cost)})도 좋습니다. 여덟 식구에 민심도 조금 오릅니다.`;
      else if (S.buildings.some(b => b.type === 'house' && usable(b))) t += ' 초가를 눌러 [기와집으로] 올리면 세 식구가 더 삽니다.';
    } else t += ` 인구 ${RANKS[BDEF.house2.rank].minPop}${jn(RANKS[BDEF.house2.rank].minPop, '이/가')} 되어 마을이 되면 여덟 식구가 사는 기와집도 지을 수 있습니다.`;
    return [{ m: 'calm', t }];
  }
  function houseDiag(g) {
    let t = `집 ${g.H}칸에 ${g.pop}명이 삽니다.`;
    if (g.arriving && g.H > g.pop) t += ` 남은 ${g.H - g.pop}칸은 길 위의 새 식구 ${g.arriving}명 몫입니다.`;
    if (g.homeless) t += ` ${g.homeless}명은 집이 없어 한데서 잡니다.`;
    return t + ' 빈 집이 없으니 떠돌던 사람들이 다른 마을로 발길을 돌립니다.';
  }

  // ── 일손 ─────────────────────────────────
  // 이방이 급한 일손을 대느라 일부러 줄여 둔 자리 (예산이 있으면 이방이 되돌린다)
  function riLowered(b) {
    const ri = S.admin && S.admin.depts && S.admin.depts.ri;
    return !!(ri && ri.budget > 0 && Array.isArray(ri.lowered) && ri.lowered.includes(b.id));
  }
  const staffed = b => (b._workers || []).length;
  // 일꾼 자리가 다 찼다: [일꾼 −]를 한 번 누르면 한 사람이 정말로 빠진다 (모자란 곳은 자리만 줄고 아무도 빠지지 않는다)
  const staffedFull = b => staffed(b) >= Math.min(BDEF[b.type].workers, b.want);
  function yieldText(type, ff) {
    if (type === 'farm') return `한 사람이 하루 ${n1(ff.perFarmer)}섬쯤 거둡니다.`;
    if (type === 'fishery') return `한 사람이 하루 ${n1(ff.perFisher)}섬쯤 잡습니다.`;
    if (type === 'lumber') return '목재가 더 들어옵니다.';
    if (type === 'quarry') return '석재가 더 들어옵니다.';
    if (type === 'market' || type === 'inn' || type === 'escort') return '은자가 더 들어옵니다.';
    return '';
  }

  // ── 은자 ─────────────────────────────────
  function silverInfo() {
    const inc = hook(Admin, 'expectedIncome');
    if (!inc || typeof inc.net !== 'number') return null;
    return Object.assign({ bud: +hook(Admin, 'totalBudget') || 0 }, inc);
  }
  const marketIncome = pop => Math.round(2 * (0.36 + pop * 0.007) * tradeMul() * SHOP_H);
  const taxDelta = to => Math.round(popCount() * (TAX_RATE[to] - TAX_RATE[S.tax]) * (0.4 + S.happy / 100) * JH.perk('tax') * (hook(Admin, 'taxMul') || 1));

  // ── 권한 일을 따랐는가 ─────────────────────────
  // 만들 때의 장부를 적어 두고: 그 건물 자리를 놓았거나, 다시 짓기 시작했거나, 창의 단추·세율을 바꿨거나, 상소를 처결했으면 따른 것이다.
  // 따랐으면 그 말은 거둔다 (사당을 놓았는데 「사당을 지으십시오」가 남아 또 짓게 하지 않게)
  function snapAct(a) {
    if (!a) return null;
    if (a.k === 'build') return countLive(a.type);
    if (a.k === 'panel') { const b = getB(a.id); return b ? { want: b.want, active: b.active } : null; }
    if (a.k === 'sel' && a.sel === '#btn-petitions') return petPending();
    return null;
  }
  function followed(a, s) {
    if (!a) return false;
    if (a.k === 'build') return countLive(a.type) > s;
    if (a.k === 'repair') { const b = getB(a.id); return !b || !b.ruined; }
    if (a.k === 'tax') return S.tax === a.to;
    if (a.k === 'panel' && s) {
      const b = getB(a.id);
      if (!b) return true;
      return a.act === 'want+' ? b.want > s.want : a.act === 'want-' ? b.want < s.want : a.act === 'toggle' ? b.active !== s.active : false;
    }
    if (a.k === 'sel' && a.sel === '#btn-petitions' && typeof s === 'number') return petPending() < s;
    return false;
  }

  // ── 권할 일 만들기 ───────────────────────────
  // r: { id, pri, cd, label, diag(g, ff) → 글, todo(g, ff) → [{m,t}], act, done() }
  //  done(): 그 일이 풀렸거나(o.done) 권한 대로 따랐다. 만든 그 순간에는 늘 거짓이다 (아니면 말을 꺼내자마자 거둔다)
  function mk(o) {
    const r = Object.assign({ cd: 3, act: null, topic: o.id.split(':')[0] }, o);
    const base = o.done || (() => false), snap = snapAct(r.act);
    r.done = () => base() || followed(r.act, snap);
    r.lines = () => {
      const g = growth(), ff = foodFlow(g.pop);
      return [{ m: o.mood || 'calm', t: r.diag(g, ff) }, ...(r.todo ? r.todo(g, ff) : [])].filter(l => l && l.t);
    };
    return r;
  }

  function build(g = growth()) {
    const ff = foodFlow(g.pop);
    const R = [];
    const pop = g.pop;

    // ━━ 1. 성장의 문 ━━
    if (!g.ok.occ) {
      const F = FACTIONS[g.occ.faction];
      R.push(mk({
        id: 'occ', pri: 100, cd: 2, mood: 'worry', label: `점령을 풀어야 사람이 옵니다 · ${occDaysLeft()}일 남음`,
        diag: () => `${F.name}에 점령된 동안에는 빈 집과 곳간이 아무리 넉넉해도 새 식구가 한 사람도 오지 않습니다.`,
        todo: () => {
          const cost = ransomCost();
          return [{ m: 'stern', t: `몸값은 은자 ${cost}냥${S.res.silver >= cost ? '이고, 지금 곳간으로 치를 수 있습니다' : `인데 곳간에는 ${fmt(S.res.silver)}냥뿐입니다`}. 무사를 모아 봉기하실 수도 있고, 그도 어려우면 ${occDaysLeft()}일만 버티십시오. 모두 [세력] 창에서 합니다.` }];
        },
        act: { k: 'sel', sel: '#btn-factions', tag: '세력' }, done: () => !S.occupation,
      }));
    }
    if (!g.ok.food) {
      R.push(mk({
        id: 'food', pri: 95, cd: 2, mood: 'worry', label: `식량을 늘리십시오 · ${fmt(g.food)} / ${n1(g.need)}섬`,
        diag: (g, ff) => `곳간의 식량이 ${fmt(g.food)}섬입니다. 새 식구가 오려면 사는 사람 ${g.pop}명의 1.2배인 ${n1(g.need)}섬보다 많아야 합니다. 지금은 하루에 ${fmt(ff.prod)}섬을 거두고 ${fmt(ff.cons)}섬을 먹습니다.`,
        todo: (g, ff) => [{ m: 'calm', t: foodPlan(g, ff).text }],
        act: foodPlan(g, ff).act, done: () => S.res.food > popCount() * FOOD_MUL,
      }));
    }
    // 문은 열려 있어도 거두는 것보다 먹는 것이 많아 며칠 안에 닫힌다
    if (g.ok.food && ff.prod < ff.cons - 0.5 && (g.food - g.need) / (ff.cons - ff.prod) < 4) {
      const days = Math.max(0, Math.floor((g.food - g.need) / (ff.cons - ff.prod)));
      R.push(mk({
        id: 'food_low', topic: 'food', pri: 78, cd: 2, label: `식량이 줄고 있습니다 · 하루 −${fmt(ff.cons - ff.prod)}섬`,
        diag: (g2, ff2) => `하루에 ${fmt(ff2.prod)}섬을 거두고 ${fmt(ff2.cons)}섬을 먹어 곳간이 날마다 ${fmt(ff2.cons - ff2.prod)}섬씩 줄어듭니다. ${days ? `${days}일쯤 뒤면` : '곧'} 식량이 사람의 1.2배 아래로 내려가 새 식구가 오지 않습니다.`,
        todo: (g2, ff2) => [{ m: 'calm', t: foodPlan(g2, ff2).text }],
        act: foodPlan(g, ff).act, done: () => { const f2 = foodFlow(popCount()); return f2.prod >= f2.cons - 0.5; },
      }));
    }
    if (!g.ok.house) {
      if (g.soon > 0 && g.free + g.soon > 0) {
        R.push(mk({
          id: 'house_wait', pri: 70, cd: 2, label: `짓는 집이 끝나면 빈 집 ${g.free + g.soon}칸`,
          diag: houseDiag,
          todo: g2 => [{ m: 'calm', t: `짓고 있는 집이 끝나면 ${g2.soon}칸이 생깁니다. 일 없는 사람이 공사를 거들수록 빨리 끝나니, 기다리시거나 오른쪽 위 ▶▶로 시간을 빨리 감으십시오.` }],
          act: { k: 'wait', types: ['house', 'house2'] }, done: () => growth().ok.house, topic: 'house',
        }));
      } else {
        const a = houseAct(), woodShort = a.k === 'build' && a.type === 'house' && S.res.wood < BDEF.house.cost.wood;
        const r = a.k === 'repair' ? getB(a.id) : null;
        R.push(mk({
          id: woodShort ? 'house_wood' : a.k === 'repair' ? 'house_repair' : 'house', pri: 92, cd: 2,
          label: woodShort ? `목재부터 · 초가에 ${BDEF.house.cost.wood}, 지금 ${fmt(S.res.wood)}`
            : r ? `무너진 ${nm(r.type)}${pp(nm(r.type), '을/를')} 다시 지으십시오 · 빈 집 0칸`
              : `${nm(a.type)}${pp(nm(a.type), '을/를')} 지으십시오 · 빈 집 0칸`,
          diag: houseDiag, todo: houseTodo,
          act: (woodShort && has('lumber') && lumberAct()) || a, topic: 'house',
          // 만든 조건(문이 닫혔고 짓는 집으로도 모자람)의 반대: 짓는 집이 다 서면 빈 집이 생기는 때는 house_wait 가 맡는다
          done: () => { const x = growth(); return x.ok.house || (x.soon > 0 && x.free + x.soon > 0); },
        }));
      }
    }
    // 민심: 짓고 있는 편의 시설(사당·시장…)은 다 섰다고 보고 셈한다 (따른 일을 또 권하지 않게)
    const pendH = amenPending(pop), tgtH = g.target + pendH;
    const worstText = () => {
      const worst = happinessFactors().filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]).slice(0, 2);
      return worst.length ? ` 가장 큰 까닭은 ${worst.map(([k, v]) => `「${k}」(${Math.round(v)})`).join(', ')}입니다.` : '';
    };
    const pendNames = () => andList([...new Set(amenSites().map(b => nm(b.type)))]);
    if (!g.ok.happy) {
      if (g.riseH) {
        R.push(mk({
          id: 'happy_rise', pri: 45, cd: 2, label: `민심이 오르는 중 · ${near(g.happy, HAPPY_GATE)} → ${near(g.target, HAPPY_GATE)}`,
          diag: g2 => `민심이 ${near(g2.happy, HAPPY_GATE)}입니다. 42는 넘어야 사람이 찾아오는데, 지금 흐름이면 ${near(g2.target, HAPPY_GATE)}까지 오르니 ${g2.riseH || 1}시간쯤 뒤면 넘습니다.`,
          todo: () => [{ m: 'calm', t: '그동안 빈 집과 곳간을 채워 두시면 문이 열리자마자 사람이 듭니다.' }],
          done: () => S.happy >= HAPPY_GATE,
        }));
      } else if (pendH > 0 && tgtH >= HAPPY_GATE + 0.5) {
        // 권한 대로 사당 등을 짓고 있다: 다 서면 문이 열린다
        const types = [...new Set(amenSites().map(b => b.type))];
        R.push(mk({
          id: 'happy_wait', topic: 'happy', pri: 68, cd: 2, label: `짓는 ${nm(types[0])}${pp(nm(types[0]), '이/가')} 서면 민심 ${near(tgtH, HAPPY_GATE)}`,
          diag: g2 => `민심이 ${near(g2.happy, HAPPY_GATE)}입니다. 42는 넘어야 사람이 찾아오는데, 지금 형편대로면 ${near(g2.target, HAPPY_GATE)}에 머뭅니다.${worstText()}`,
          todo: g2 => { const p = amenPending(g2.pop), n = pendNames(); return [{ m: 'calm', t: `짓고 있는 ${n}${pp(n, '이/가')} 서면 민심이 ${n1(p)} 올라 ${near(g2.target + p, HAPPY_GATE)}까지 갑니다. 그러면 문이 열립니다. 일 없는 사람이 공사를 거들수록 빨리 끝나니, 기다리시거나 오른쪽 위 ▶▶로 시간을 빨리 감으십시오.` }]; },
          act: { k: 'wait', types }, done: () => S.happy >= HAPPY_GATE,
        }));
      } else {
        const best = pickRemedies(remedies(g, true), HAPPY_GATE + 2 - tgtH)[0];
        R.push(mk({
          id: 'happy', pri: 90, cd: 2, mood: 'worry', label: `민심을 42 위로 · 지금 ${near(g.happy, HAPPY_GATE)}`,
          diag: g2 => {
            const p = amenPending(g2.pop), t = g2.target;
            // 흐름이 42 언저리면 소수 한 자리까지: 41.7 이 「42」로 읽혀 문이 열릴 것처럼 보이지 않게
            const flow = t >= HAPPY_GATE ? `지금 흐름이면 ${near(t, HAPPY_GATE)}까지 오르지만 문턱에 겨우 걸칩니다` : `지금 형편대로면 ${near(t, HAPPY_GATE)}에 머뭅니다`;
            const pend = p > 0 ? ` 짓고 있는 ${pendNames()}${pp(pendNames(), '이/가')} 서면 ${n1(p)} 더 오르지만 그것으로는 모자랍니다.` : '';
            return `민심이 ${near(g2.happy, HAPPY_GATE)}입니다. 42는 넘어야 사람이 찾아오는데, ${flow}.${pend}${worstText()}${g2.leaving ? ' 25 아래라 아침마다 사람이 마을을 등집니다.' : ''}`;
          },
          todo: g2 => remedyLines(pickRemedies(remedies(g2, true), HAPPY_GATE + 2 - g2.target - amenPending(g2.pop))),
          act: best ? best.act : { k: 'sel', sel: '#btn-village', tag: '마을 현황' }, done: () => S.happy >= HAPPY_GATE,
        }));
      }
    } else if (tgtH < HAPPY_GATE) {
      // 문은 열려 있어도 민심이 42 아래로 흘러간다 (식량의 food_low 와 같은 경고)
      const hours = Math.max(1, Math.ceil(Math.log((HAPPY_GATE - g.target) / Math.max(0.01, g.happy - g.target)) / Math.log(0.88)));
      const best = pickRemedies(remedies(g, true), HAPPY_GATE + 2 - tgtH)[0];
      R.push(mk({
        id: 'happy_fall', topic: 'happy', pri: 85, cd: 2, mood: 'worry', label: `민심이 내려갑니다 · ${near(g.happy, HAPPY_GATE)} → ${near(g.target, HAPPY_GATE)}`,
        diag: g2 => `민심이 ${near(g2.happy, HAPPY_GATE)}이지만 지금 형편대로면 ${near(g2.target, HAPPY_GATE)}까지 내려가, ${hours}시간쯤 뒤면 42 아래로 떨어집니다. 그러면 새 식구가 오지 않습니다.${worstText()}`,
        todo: g2 => remedyLines(pickRemedies(remedies(g2, true), HAPPY_GATE + 2 - g2.target - amenPending(g2.pop))),
        act: best ? best.act : { k: 'sel', sel: '#btn-village', tag: '마을 현황' },
        done: () => happinessTarget() + amenPending(popCount()) >= HAPPY_GATE,
      }));
    }
    // 문이 열렸어도 빈 집이 한두 칸뿐이면 곧 막힌다
    if (g.ok.occ && g.ok.house && g.free <= 2 && g.soon === 0) {
      const a = houseAct();
      R.push(mk({
        id: 'house_more', pri: 72, cd: 2, label: `빈 집이 ${g.free}칸뿐 · ${a.k === 'repair' ? '무너진 집을 다시' : `${nm(a.type)}${pp(nm(a.type), '을/를')} 더`}`,
        diag: g2 => `빈 집이 ${Math.max(0, g2.free)}칸 남았습니다. 한 번에 ${g2.maxN + 1}명까지 찾아오니 금세 차서 또 막힙니다.`,
        todo: houseTodo, act: (S.res.wood < BDEF.house.cost.wood && a.type === 'house' && has('lumber') && lumberAct()) || a,
        done: () => { const x = growth(); return x.free > 2 || x.soon > 0; },
      }));
    }

    // ━━ 2. 살림과 일손 ━━
    // 목재가 넉넉하면(집 일곱 채 값 넘게) 급하지 않다: 곳간이 목재로 가득한데 벌목장부터 지으라 하지 않는다
    if (!has('lumber') && pop >= 3 && S.res.wood < 150) {
      const r = ruinOf('lumber');
      R.push(mk({
        id: 'lumber', pri: S.res.wood < 60 ? 80 : 52, cd: 3, label: `벌목장을 ${r ? '다시 ' : ''}지으십시오 · 목재 ${fmt(S.res.wood)}`,
        diag: () => '벌목장이 없어 목재가 들어오지 않습니다. 집도 논밭도 일터도 모두 목재로 짓습니다.',
        todo: () => [{ m: 'calm', t: r ? `무너진 벌목장을 눌러 [다시 짓기]를 누르십시오(${costText(repairCost(r))}).` : `${where('lumber')}${pp('벌목장', '을/를')} 골라 숲 가까이 지으십시오(${costText(BDEF.lumber.cost)}). 숲이 울창할수록 많이 납니다.` }],
        act: r ? { k: 'repair', id: r.id } : { k: 'build', type: 'lumber' }, done: () => has('lumber'),
      }));
    }
    // 일 없는 사람이 있는데 일꾼 자리를 줄여 둔 일터 / 멈춰 둔 일터
    if (g.idle > 0) {
      const off = S.buildings.filter(b => usable(b) && !b.active && BDEF[b.type].workers && !BDEF[b.type].fighter)
        .sort((a, b) => (JOB_PRIORITY[b.type] || 0) - (JOB_PRIORITY[a.type] || 0))[0];
      if (off) {
        const n = nm(off.type);
        R.push(mk({
          id: 'resume:' + off.id, pri: off.type === 'farm' || off.type === 'fishery' ? 76 : 66, cd: 2, label: `${n} 가동을 다시 · 멈춰 둔 일터`,
          diag: g2 => `${n}${pp(n, '이/가')} 멈춰 있는데 일 없는 사람이 ${g2.idle}명입니다.`,
          todo: (g2, ff2) => [{ m: 'calm', t: `${n}${pp(n, '을/를')} 눌러 창의 [가동 재개]를 누르십시오. ${yieldText(off.type, ff2)}` }],
          act: { k: 'panel', id: off.id, act: 'toggle', tag: '가동 재개' }, done: () => !getB(off.id) || getB(off.id).active,
        }));
      }
      const low = S.buildings.filter(b => usable(b) && b.active && BDEF[b.type].workers && !BDEF[b.type].fighter && b.want < BDEF[b.type].workers && !riLowered(b))
        .sort((a, b) => (JOB_PRIORITY[b.type] || 0) - (JOB_PRIORITY[a.type] || 0))[0];
      if (low) {
        const n = nm(low.type), food = low.type === 'farm' || low.type === 'fishery';
        R.push(mk({
          id: 'staff:' + low.id, pri: food ? 74 : 64, cd: 2, label: `${n} 일꾼을 늘리십시오 · ${low.want}/${BDEF[low.type].workers}, 노는 이 ${g.idle}`,
          diag: g2 => `일 없는 사람이 ${g2.idle}명인데 ${n}의 일꾼 자리는 ${low.want}/${BDEF[low.type].workers}${jn(BDEF[low.type].workers, '으로/로')} 줄여 두었습니다.`,
          todo: (g2, ff2) => [{ m: 'calm', t: `${n}${pp(n, '을/를')} 눌러 창의 [일꾼 +]를 누르십시오. ${yieldText(low.type, ff2)}` }],
          act: { k: 'panel', id: low.id, act: 'want+', tag: '일꾼 +' },
          done: () => { const b = getB(low.id); return !b || b.want >= BDEF[b.type].workers || people().idle === 0; },
        }));
      }
    }
    // 은자
    const sv = silverInfo();
    // 은자가 날마다 줄어들거나, 곳간이 비었는데 남는 수입이 하루 두어 냥뿐이다
    if (sv && ((sv.net < 0 && S.res.silver < 200) || (sv.net < 2 && S.res.silver < 30))) {
      R.push(mk({
        id: 'silver', pri: 70, cd: 3, mood: 'worry', label: sv.net < 0 ? `은자가 날마다 ${-sv.net}냥 줄어듭니다` : `은자 수입이 하루 ${sv.net}냥뿐입니다 · 곳간 ${fmt(S.res.silver)}냥`,
        diag: () => {
          const s = silverInfo() || sv;
          const head = `하루 수입은 세금 ${s.tax}냥${s.trade ? `·장사 ${s.trade}냥` : ''}${s.jh ? `·강호 ${s.jh}냥` : ''}이고 품삯과 공물로 ${s.upkeep}냥이 나갑니다.`;
          return `${head} ${s.net < 0 ? `날마다 ${-s.net}냥씩 줄어` : `남는 것은 하루 ${s.net}냥뿐이라`} 곳간에는 ${fmt(S.res.silver)}냥 남았습니다. 은자가 없으면 집 한 채, 논밭 하나도 못 짓습니다.`;
        },
        todo: () => [{ m: 'calm', t: silverPlan(g).text }],
        act: silverPlan(g).act,
        done: () => { const s = silverInfo(); return !s || !((s.net < 0 && S.res.silver < 200) || (s.net < 2 && S.res.silver < 30)); },
      }));
    } else if (S.admin && S.admin.short && S.admin.short.day >= dayOf() - 1 && S.res.silver < 40 && sv) {
      R.push(mk({
        id: 'budget', pri: 62, cd: 4, label: `육방 예산이 수입보다 많습니다 · 하루 ${fmt(sv.bud)}냥`,
        diag: () => { const s = silverInfo() || sv; return `육방에 하루 ${fmt(s.bud)}냥을 내려보내는데, 품삯을 빼고 남는 수입은 ${fmt(Math.max(0, s.net))}냥뿐이라 곳간이 바닥났습니다.`; },
        todo: () => [{ m: 'calm', t: '[육방]에서 [추천 배분]을 누르시면 수입에 맞춰 다시 나눕니다. 예산이 모자라면 부서들이 하던 일을 멈춥니다.' }],
        act: { k: 'sel', sel: '#btn-admin', tag: '육방' }, done: () => !(S.admin && S.admin.short) || S.res.silver >= 40,
      }));
    }
    // 곳간이 가득 참
    const cap = storageCap();
    const full = ['food', 'wood', 'stone'].filter(k => S.res[k] >= cap * 0.97);
    if (full.length && !sitesOf(['warehouse']).length) {
      const k = full.includes('food') ? 'food' : full[0], rn = RESOURCES[k].name;
      R.push(mk({
        id: 'store', pri: k === 'food' && (ff.autumn || ff.winter) ? 66 : 62, cd: 3, label: `창고를 지으십시오 · ${rn} 가득 ${fmt(S.res[k])}/${cap}`,
        diag: () => `${full.map(x => RESOURCES[x].name).join('·')}${pp(RESOURCES[full[full.length - 1]].name, '이/가')} 곳간 끝(${storageCap()})까지 찼습니다. 더 거두는 것은 쌓을 데가 없어 버려집니다.`,
        todo: () => [{ m: 'calm', t: `${where('warehouse')}${pp('창고', '을/를')} 지으십시오(${costText(BDEF.warehouse.cost)}). 식량·목재·석재·병장기를 ${BDEF.warehouse.storage}씩 더 쌓아 둡니다.${k === 'food' && ff.autumn ? ' 겨울을 나려면 곳간이 넉넉해야 합니다.' : ''}` }],
        act: { k: 'build', type: 'warehouse' }, done: () => sitesOf(['warehouse']).length > 0 || S.res[k] < storageCap() * 0.97,
      }));
    }
    // 일 없는 사람이 많은데 일자리가 없다
    let open = 0;
    for (const b of S.buildings) if (usable(b) && b.active && BDEF[b.type].workers) open += Math.max(0, Math.min(BDEF[b.type].workers, b.want) - staffed(b));
    const sites = S.buildings.filter(b => !b.done && !b.ruined);
    const jt = g.idle >= 3 && open === 0 && !sites.length ? jobType(g, ff) : null;
    if (jt && canAfford(BDEF[jt].cost)) {
      const t = jt;
      R.push(mk({
        id: 'jobs', pri: 58, cd: 3, label: `일 없는 사람 ${g.idle}명 · ${nm(t)}${pp(nm(t), '을/를')} 지으십시오`,
        diag: g2 => `일 없는 사람이 ${g2.idle}명입니다. 공사가 나면 거들지만, 지금은 품을 팔 일터가 없습니다.`,
        todo: (g2, ff2) => [{ m: 'calm', t: `${where(t)}${pp(nm(t), '을/를')} 지으십시오(${costText(BDEF[t].cost)}). ${jobWhy(t, g2, ff2)}` }],
        act: { k: 'build', type: t }, done: () => people().idle < 3 || S.buildings.some(b => !b.done && !b.ruined),
      }));
    }
    // 거꾸로: 일 없는 사람은 없는데 일꾼이 하나도 없어 서 있는 일터 (논밭이 일손을 다 가져가 벌목장이 노는 때 등)
    // 논밭·어장은 식량 권고가 맡는다. 한 사람을 빼면 그 사람은 배치 순서(sim.js JOB_PRIORITY)가 가장 앞선 빈 자리로 간다
    if (g.idle === 0) {
      const wanted = t => (t === 'lumber' ? S.res.wood < 60 : t === 'quarry' ? S.rank >= 1 && S.res.stone < 40 : t === 'market' || t === 'inn' || t === 'escort');
      const prio = b => (JOB_PRIORITY[b.type] || 0) + (S.res.food < pop * 4 && (b.type === 'farm' || b.type === 'fishery') ? 5 : 0);
      const empty = S.buildings.filter(b => usable(b) && b.active && BDEF[b.type].workers && !BDEF[b.type].fighter && b.want > 0 && staffed(b) === 0 && wanted(b.type))
        .sort((a, b) => prio(b) - prio(a))[0];
      if (empty) {
        const firstOpen = S.buildings.filter(b => usable(b) && b.active && BDEF[b.type].workers && staffed(b) < Math.min(BDEF[b.type].workers, b.want))
          .sort((a, b) => prio(b) - prio(a))[0];
        const foodSpare = ff.prod > ff.cons * 1.3 && g.food > g.need * 2;
        const donor = firstOpen === empty ? S.buildings.filter(b => usable(b) && b.active && b !== empty && staffed(b) > 0 && staffedFull(b) && !BDEF[b.type].fighter
          && ((b.type !== 'farm' && b.type !== 'fishery') || (foodSpare && staffed(b) > 1)))
          .sort((a, b) => (b.type === 'farm') - (a.type === 'farm') || prio(a) - prio(b))[0] : null;
        const n = nm(empty.type), dn = donor && nm(donor.type);
        const ha = houseAct();
        const why = empty.type === 'lumber' ? '목재가 들어오지 않아 집도 일터도 지을 수 없습니다.' : empty.type === 'quarry' ? '석재가 들어오지 않습니다.' : '장사가 서지 않아 은자가 들어오지 않습니다.';
        R.push(mk({
          id: 'hands:' + empty.id, topic: 'hands', pri: empty.type === 'lumber' ? 75 : empty.type === 'quarry' ? 47 : 60, cd: 3,
          label: donor ? `${n}에 일꾼이 없습니다 · ${dn} 일꾼 −1` : `${n}에 일꾼이 없습니다 · 사람이 더 와야`,
          diag: g2 => `${n}${pp(n, '은/는')} 다 지었는데 일하는 사람이 하나도 없습니다. ${why} 사람 ${g2.pop}명이 모두 다른 일터에 매여 일 없는 이가 없습니다.`,
          todo: () => [{ m: 'calm', t: donor
            ? `${dn}${pp(dn, '을/를')} 눌러 창의 [일꾼 −]로 한 사람을 빼십시오. 그 사람이 ${n}${pp(n, '으로/로')} 갑니다.${donor.type === 'farm' ? ` 지금은 거두는 식량이 먹는 것보다 넉넉해 논밭 한 자리는 비워도 됩니다.` : ''}`
            : `일손을 늘리려면 사람이 더 와야 합니다. ${g.free > 0 ? `빈 집이 ${g.free}칸 있으니 문이 열려 있으면 곧 찾아옵니다.` : `빈 집이 없으니 ${ha.k === 'repair' ? '무너진 집을 다시 지으십시오' : `${nm(ha.type)}${pp(nm(ha.type), '을/를')} 지으십시오`}.`}` }],
          act: donor ? { k: 'panel', id: donor.id, act: 'want-', tag: '일꾼 −' } : (g.free > 0 ? null : ha),
          done: () => { const b = getB(empty.id); return !b || !usable(b) || staffed(b) > 0 || !b.active; },
        }));
      }
    }
    // 방비 (급한 습격·무관 없음은 위기 조언이 맡는다)
    const raidNear = S.raid || (typeof Events !== 'undefined' && Events.raidPending && Events.raidPending());
    if (pop >= 12 && has('dojo') && !raidNear && !S.occupation) {
      const def = defensePower(), needD = pop * 1.2;
      if (def < needD) {
        const d = S.buildings.find(b => b.type === 'dojo' && usable(b));
        const fill = d && d.want < BDEF.dojo.workers;
        R.push(mk({
          id: 'guard', pri: 55, cd: 4, label: `무사를 늘리십시오 · 무력 ${def} / ${Math.ceil(needD)}`,
          diag: () => `사람 ${popCount()}명에 무력이 ${defensePower()}입니다. ${Math.ceil(popCount() * 1.2)}${jn(Math.ceil(popCount() * 1.2), '은/는')} 넘어야 백성이 마음을 놓습니다(치안 불안 −6).`,
          todo: () => [{ m: 'calm', t: fill ? '무관을 눌러 [일꾼 +]로 수련생을 채우십시오. 무사 한 사람에 날마다 은자 1냥이 듭니다.' : `${where('tower')}${pp('망루', '을/를')} 적이 올 길목에 세우십시오(${costText(BDEF.tower.cost)}). 궁수 하나가 오르면 무력이 오릅니다.` }],
          act: fill ? { k: 'panel', id: d.id, act: 'want+', tag: '일꾼 +' } : { k: 'build', type: 'tower' },
          done: () => defensePower() >= popCount() * 1.2,
        }));
      }
    }
    // 석재 (마을이 되면 기와집·사당·대장간에 든다)
    if (S.rank >= 1 && !has('quarry') && S.res.stone < 30 && (ruinOf('quarry') || canAfford(BDEF.quarry.cost)) && siteOk('quarry')) {
      const r = ruinOf('quarry');
      R.push(mk({
        id: 'quarry', pri: 48, cd: 4, label: `채석장을 지으십시오 · 석재 ${fmt(S.res.stone)}`,
        diag: () => `석재가 ${fmt(S.res.stone)}뿐이고 채석장이 없습니다. 기와집·사당·대장간·무관에 석재가 듭니다.`,
        todo: () => [{ m: 'calm', t: r ? `무너진 채석장을 눌러 [다시 짓기]를 누르십시오(${costText(repairCost(r))}).` : `${where('quarry')}${pp('채석장', '을/를')} 바위산 가까이 지으십시오(${costText(BDEF.quarry.cost)}).` }],
        act: r ? { k: 'repair', id: r.id } : { k: 'build', type: 'quarry' }, done: () => has('quarry'),
      }));
    }

    // ━━ 3. 문이 열렸을 때: 한 번에 오는 수를 늘린다 ━━
    // 곳간과 은자가 넉넉할 때만 (모자라면 먹을 것과 집이 먼저다)
    const spare = r => (r.id !== 'tax' || S.tax === 2) && (!r.res || rich(r.res)) && !r.temp;
    // 흐름이 42 아래면(happy_fall) 문이 곧 닫히니 70 이야기는 꺼내지 않는다
    if (g.open && g.happy <= HAPPY_BONUS && tgtH >= HAPPY_GATE && tgtH <= HAPPY_BONUS && ff.prod >= ff.cons && g.food >= g.pop * 3) {
      const best = pickRemedies(remedies(g, false).filter(spare), HAPPY_BONUS + 1 - tgtH)[0];
      if (best) {
        R.push(mk({
          id: 'happy70', pri: 50, cd: 4, label: `민심 70을 넘기면 더 많이 옵니다 · 지금 ${Math.round(g.happy)}`,
          diag: g2 => `사람이 오는 문은 다 열렸습니다. 민심이 70을 넘으면 한 번에 한 사람씩 더 찾아옵니다. 지금 ${Math.round(g2.happy)}, 흐름대로면 ${Math.round(g2.target + amenPending(g2.pop))}입니다.`,
          todo: g2 => remedyLines(pickRemedies(remedies(g2, false).filter(spare), HAPPY_BONUS + 1 - g2.target - amenPending(g2.pop))),
          act: best.act, done: () => S.happy > HAPPY_BONUS,
        }));
      }
    }
    if (g.open) {
      const next = (g.fameN + 1) * FAME_STEP;
      const q = jhOpen() && S.jh && S.jh.quests && S.jh.quests.some(x => x.state === 'open');
      const inn = !q && rankOk('inn') && !has('inn') && rich(BDEF.inn.cost);
      R.push(mk({
        id: 'fame', pri: 40, cd: 6, label: `명성 ${fmt(S.fame)} · ${next}이면 한 번에 한 명 더`,
        diag: () => `명성이 ${fmt(S.fame)}입니다. 명성이 120 오를 때마다 한 번에 찾아오는 사람이 한 명씩 늡니다. 다음은 ${next}입니다.`,
        todo: () => {
          // 이 등급에서 지을 수 있는 이름난 일터만 (마을이 되기 전에는 객잔·표국을 권하지 않는다)
          const shops = ['inn', 'escort'].filter(rankOk).map(nm);
          return [{ m: 'calm', t: `습격을 막아 내면 명성이 크게 오릅니다.${jhOpen() ? ' [세력] 창의 의뢰를 해내도 오릅니다.' : ''}${shops.length ? ` ${andList(shops)}도 조금씩 이름을 냅니다.` : ''}${inn ? ` ${where('inn')}${pp('객잔', '을/를')} 지으시면(${costText(BDEF.inn.cost)}) 은자와 명성을 함께 법니다.` : ''}` }];
        },
        act: q ? { k: 'sel', sel: '#btn-factions', tag: '세력' } : inn ? { k: 'build', type: 'inn' } : null,
        done: () => S.fame >= next,
      }));
    }
    // 공사를 거들 사람이 없다
    if (sites.length && g.idle === 0 && sites.every(b => !b._builders)) {
      R.push(mk({
        id: 'slow', pri: 36, cd: 4, label: `공사 ${sites.length}곳이 더딥니다 · 거드는 이 없음`,
        diag: () => `짓고 있는 곳이 ${S.buildings.filter(b => !b.done && !b.ruined).length}곳인데 모두 일터에 매여 거들 사람이 없습니다. 거드는 이가 없으면 공사가 아주 더딥니다.`,
        todo: () => [{ m: 'calm', t: '급하지 않은 일터를 눌러 [일꾼 −]로 한 사람을 빼면 그 사람이 공사를 거듭니다. 기다리셔도 공사는 끝납니다.' }],
        act: { k: 'wait', types: sites.map(b => b.type) }, done: () => !S.buildings.some(b => !b.done && !b.ruined) || people().idle > 0,
      }));
    }

    // ━━ 4. 다음 등급 ━━
    if (S.rank < RANKS.length - 1) {
      const r = S.rank + 1, N = RANKS[r];
      const route = S.jh && S.jh.route;
      const unlock = BUILD_ORDER.filter(t => BDEF[t].rank === r && (!BDEF[t].route || BDEF[t].route === route)).map(nm);
      const rn = N.name.replace(/\(.*\)/, '');
      R.push(mk({
        id: 'rank', pri: 30, cd: 5, label: `인구 ${N.minPop}${jn(N.minPop, '이/')}면 ${rn} · 지금 ${pop}`,
        diag: () => `인구가 ${N.minPop}명이 되면 ${rn}${pp(rn, '이/가')} 됩니다${unlock.length ? `. 그러면 ${unlock.join('·')}${pp(unlock[unlock.length - 1], '을/를')} 지을 수 있습니다` : ''}. 지금 ${popCount()}명, ${Math.max(0, N.minPop - popCount())}명 남았습니다.`,
        todo: () => [{ m: 'calm', t: '빈 집과 넉넉한 곳간, 민심 42 이상을 지키시면 사람은 알아서 찾아옵니다.' }],
        done: () => S.rank >= r,
      }));
    }

    R.sort((a, b) => b.pri - a.pri);
    // 같은 곳을 짚는 일은 앞의 것만 (빈 집이 없어 초가 · 집 없는 사람 때문에 초가).
    // 만들자마자 done() 인 것은 버린다 (말을 꺼내자마자 저절로 거둬지지 않게: 만든 조건과 done 이 어긋났을 때의 안전망)
    const seen = new Set(), out = [];
    for (const r of R) {
      if (r.done()) continue;
      const key = r.act ? JSON.stringify(r.act) : r.id;
      if (seen.has(key)) continue;
      seen.add(key); out.push(r);
    }
    return { g, recs: out };
  }

  // 식량이 모자랄 때 할 일 (가장 빠른 것부터)
  function foodPlan(g, ff) {
    const farms = S.buildings.filter(b => b.type === 'farm' && usable(b));
    const lowF = farms.find(b => b.active && b.want < BDEF.farm.workers && !riLowered(b));
    if (lowF && g.idle > 0) return { act: { k: 'panel', id: lowF.id, act: 'want+', tag: '일꾼 +' }, text: `논밭 일꾼 자리를 ${lowF.want}${jn(lowF.want, '으로/로')} 줄여 두어 일 없는 사람이 ${g.idle}명입니다. 논밭을 눌러 [일꾼 +]를 누르십시오. ${yieldText('farm', ff)}` };
    const offF = S.buildings.find(b => (b.type === 'farm' || b.type === 'fishery') && usable(b) && !b.active);
    if (offF) return { act: { k: 'panel', id: offF.id, act: 'toggle', tag: '가동 재개' }, text: `멈춰 둔 ${nm(offF.type)}${pp(nm(offF.type), '이/가')} 있습니다. 눌러서 [가동 재개]를 누르십시오.` };
    if (ff.prod > ff.cons + 0.5) {
      const days = Math.max(1, Math.ceil((g.need + 1 - g.food) / (ff.prod - ff.cons)));
      return { act: null, text: `거두는 양이 먹는 양보다 하루 ${fmt(ff.prod - ff.cons)}섬 많으니 ${days}일쯤이면 ${n1(g.need)}섬을 넘습니다. 그사이 빈 집과 민심을 챙겨 두십시오.` };
    }
    // 짓고 있는(다시 짓는) 논밭·어장: 그것으로 모자람이 메워지면 기다리라 하고, 또 지으라 하지 않는다
    const fs = sitesOf(['farm', 'fishery']);
    let pre = '';
    if (fs.length) {
      const gain = fs.reduce((a, b) => a + (b.type === 'farm' ? BDEF.farm.workers * ff.perFarmer : BDEF.fishery.workers * ff.perFisher), 0);
      const sn = andList([...new Set(fs.map(b => nm(b.type)))]);
      if (ff.prod + gain > ff.cons + 0.5) {
        return { act: { k: 'wait', types: ['farm', 'fishery'] }, wait: true,
          text: `짓고 있는 ${sn}${pp(sn, '이/가')} 끝나면 하루 ${fmt(gain)}섬쯤 더 거두어 먹는 것보다 많아집니다. 일 없는 사람이 공사를 거들수록 빨리 끝나니, 기다리시거나 오른쪽 위 ▶▶로 시간을 빨리 감으십시오.` };
      }
      pre = `짓고 있는 ${sn}${pp(sn, '이/가')} 끝나도 하루 ${fmt(gain)}섬쯤 늘 뿐이라 모자랍니다. `;
    }
    // 무너진 논밭·어장은 새로 짓는 값의 절반에 다시 선다 (습격 뒤). 겨울에는 논밭이 쉬니 어장부터
    const repairPlan = rf => {
      const rc = repairCost(rf), n = nm(rf.type);
      const crew = rf.type === 'farm' ? `일꾼 셋이 하루 ${fmt(3 * ff.perFarmer)}섬쯤 거둡니다.` : `일꾼 둘이 하루 ${fmt(2 * ff.perFisher)}섬쯤 잡습니다.`;
      return { act: { k: 'repair', id: rf.id }, text: `${pre}무너진 ${n}${pp(n, '은/는')} 새로 짓는 값의 절반인 ${ifCost(rc)} 다시 섭니다. 그 터를 눌러 [다시 짓기]를 누르십시오. ${crew}${shortText(rc)}` };
    };
    const winterNow = ff.winter || ff.winterNext;
    if (winterNow && ruinOf('fishery')) return repairPlan(ruinOf('fishery'));
    if (winterNow && siteOk('fishery')) return { act: { k: 'build', type: 'fishery' }, text: `${pre}겨울에는 논밭이 거의 쉽니다. ${where('fishery')}${pp('어장', '을/를')} 물가에 지으십시오(${costText(BDEF.fishery.cost)}). 일꾼 둘이 하루 ${fmt(2 * ff.perFisher)}섬쯤 잡습니다.${shortText(BDEF.fishery.cost)}` };
    const openF = farms.find(b => b.active && staffed(b) < Math.min(BDEF.farm.workers, b.want));
    if (openF && g.idle === 0) {
      const donor = S.buildings.filter(b => usable(b) && b.active && staffed(b) > 0 && staffedFull(b) && b.type !== 'farm' && b.type !== 'fishery' && !BDEF[b.type].fighter)
        .sort((a, b) => (JOB_PRIORITY[a.type] || 0) - (JOB_PRIORITY[b.type] || 0))[0];
      if (donor) return { act: { k: 'panel', id: donor.id, act: 'want-', tag: '일꾼 −' }, text: `${pre}논밭에 빈 자리가 있는데 일할 사람이 없습니다. ${nm(donor.type)}${pp(nm(donor.type), '을/를')} 눌러 [일꾼 −]로 한 사람을 빼면 그 사람이 논밭으로 갑니다.` };
    }
    const rf = ruinOf('farm') || ruinOf('fishery');
    if (rf) return repairPlan(rf);
    const fc = BDEF.farm.cost;
    let lack = shortText(fc);
    if (lack && S.res.silver < (fc.silver || 0) && S.res.wood >= (fc.wood || 0) && S.res.silver + dailyTax() >= fc.silver) lack += ' 내일 아침 세금이 들어오면 지으실 수 있습니다.';
    const act = S.res.wood < (fc.wood || 0) && has('lumber') ? (lumberAct() || { k: 'build', type: 'farm' }) : { k: 'build', type: 'farm' };
    // 쓸 수 있는 논밭이 하나도 없으면 「하나 더」가 아니다
    return { act, text: `${pre}${where('farm')}${pp('논밭', '을/를')} ${farms.length || fs.length ? '하나 더 ' : ''}지으십시오(${costText(fc)}). 일꾼 셋이 하루 ${fmt(3 * ff.perFarmer)}섬쯤 거둡니다.${g.idle >= 1 ? '' : ' 일할 사람도 있어야 하니 빈 집도 함께 늘리십시오.'}${lack}` };
  }
  // 은자가 줄어들 때 할 일
  function silverPlan(g) {
    if (rankOk('market') && !has('market')) return { act: { k: 'build', type: 'market' }, text: `${where('market')}${pp('시장', '을/를')} 지으십시오(${costText(BDEF.market.cost)}). 장이 서면 하루 ${marketIncome(g.pop)}냥쯤 벌고 민심도 오릅니다.` };
    if (S.tax < 2 && happinessTarget() + TAX_MOOD[S.tax + 1] - TAX_MOOD[S.tax] >= 52) {
      const to = S.tax + 1;
      return { act: { k: 'tax', to }, text: `민심이 넉넉하니 [마을 현황]에서 세율을 「${['낮게', '보통', '높게'][to]}」 쪽으로 올리시면 하루 ${taxDelta(to)}냥쯤 더 들어옵니다(민심 ${TAX_MOOD[to] - TAX_MOOD[S.tax]}).` };
    }
    // 강호가 열렸으면 교역 협정: 날마다 은자 2 + 시장 하나에 2
    if (jhOpen()) return { act: { k: 'sel', sel: '#btn-factions', tag: '세력' }, text: `[세력] 창에서 상단·새외·세가와 [교역]을 맺으시면 날마다 은자 ${2 + countType('market') * 2}냥이 들어옵니다. 시장이 많을수록 교역도 커집니다.` };
    const d = S.buildings.find(b => b.type === 'dojo' && usable(b) && staffed(b) > 1);
    if (d) return { act: { k: 'panel', id: d.id, act: 'want-', tag: '일꾼 −' }, text: '무사 품삯이 큰 몫입니다. 급한 습격이 없으면 무관을 눌러 [일꾼 −]로 수련생을 줄이십시오. 한 사람에 하루 1냥이 줍니다.' };
    return { act: { k: 'sel', sel: '#btn-village', tag: '마을 현황' }, text: '[마을 현황]에서 어제 거둔 것과 나간 것을 살펴보시고, 사람을 늘려 세금을 키우십시오.' };
  }
  // 일 없는 사람에게 줄 일터
  function jobType(g, ff) {
    if (ff.prod < ff.cons * 1.4) return 'farm';
    if (countLive('lumber') < 1 + Math.floor(g.pop / 20) && S.res.wood < 100 && siteOk('lumber')) return 'lumber';
    if (rankOk('market') && !has('market')) return 'market';
    if (S.rank >= 1 && S.res.stone < 40 && countLive('quarry') < 1 + Math.floor(g.pop / 35) && siteOk('quarry')) return 'quarry';
    return 'farm';
  }
  function jobWhy(t, g, ff) {
    if (t === 'farm') return `일꾼 셋이 하루 ${fmt(3 * ff.perFarmer)}섬쯤 거두어 곳간이 든든해집니다.`;
    if (t === 'lumber') return '목재가 더 들어와 집과 일터를 빨리 짓습니다.';
    if (t === 'market') return `장이 서면 하루 ${marketIncome(g.pop)}냥쯤 벌고 민심도 오릅니다.`;
    if (t === 'quarry') return '석재가 들어와 기와집과 사당을 지을 수 있습니다.';
    return '';
  }
  // 목재가 모자랄 때: 벌목장 일꾼부터
  function lumberAct() {
    const l = S.buildings.filter(b => b.type === 'lumber' && usable(b)).find(b => b.active && b.want < BDEF.lumber.workers && !riLowered(b));
    return l ? { k: 'panel', id: l.id, act: 'want+', tag: '일꾼 +' } : null;
  }

  // ── 기억 ─────────────────────────────────
  // 기억: 문을 여닫는 값(빈 집·길 위의 새 식구·식량·민심과 그 목표·일 없는 이)과 재료가 그대로이고 같은 15분 안이면 다시 셈하지 않는다.
  // 문턱을 넘는 순간 바로 다시 셈하므로 권고가 지금 장부와 어긋나지 않는다
  let cache = null;
  function sig(g) {
    let w = 0, empty = 0;
    for (const b of S.buildings) {
      w += (b.want || 0) + (b.active ? 0 : 50) + (b.done ? 100 : 0) + (b.ruined ? 1000 : 0);
      if (BDEF[b.type].workers && !staffed(b)) empty++;   // 일꾼이 하나도 없는 일터 (「○○에 일꾼이 없습니다」)
    }
    const cap = storageCap(), r = S.res;
    const full = ['food', 'wood', 'stone'].map(k => (r[k] >= cap * 0.97 ? 1 : 0)).join('');
    return [Math.floor(S.time * 4), S.buildings.length, w, empty, S.tax, S.rank, g.pop, g.arriving, g.idle, g.homeless, g.free, g.soon,
      +g.ok.food, +g.ok.happy, +g.ok.occ, +(g.target >= HAPPY_GATE + 0.5), +(g.happy > HAPPY_BONUS), ...(n => [+(n < 0), +(n < 2)])((silverInfo() || {}).net),
      Math.round(g.happy), Math.round(g.target * 2), full,
      Math.floor(r.food / 5), Math.floor(r.wood / 5), Math.floor(r.silver / 5), Math.floor(r.stone / 5), S.villagers.length, S.mods.length, petPending()].join('|');
  }
  function list() {
    if (typeof S === 'undefined' || !S || !S.buildings) return [];
    const g = growth(), k = sig(g);
    if (!cache || cache.S !== S || cache.k !== k) cache = Object.assign({ S, k }, build(g));
    return cache.recs;
  }
  const invalidate = () => { cache = null; };
  for (const ev of ['placed', 'built', 'demolished', 'destroyed', 'repairStarted', 'arrived', 'rankUp', 'occupied', 'liberated', 'day',
    'petitionResolved', 'petitionNew', 'budgetChanged', 'sheetClose', 'vassal']) Bus.on(ev, invalidate);

  // 「인구가 왜 늘지 않소?」의 한 줄씩: [{ id, name, ok, text }] 문 넷, 그리고 한 번에 오는 수 둘(ok 없음)
  function gates(g = growth()) {
    const ff = foodFlow(g.pop);
    const F = g.occ && FACTIONS[g.occ.faction];
    return [
      { id: 'house', name: '빈 집', ok: g.ok.house, short: `${Math.max(0, g.free)}칸`, text: `집 ${g.H}칸 · 사람 ${g.pop}명${g.arriving ? ` (길 위 ${g.arriving}명)` : ''} → 빈 집 ${Math.max(0, g.free)}칸${!g.ok.house && g.soon ? ` · 짓는 중 +${g.soon}` : ''}` },
      { id: 'food', name: '식량 여유', ok: g.ok.food, short: `${fmt(g.food)}/${n1(g.need)}섬`, text: `${fmt(g.food)}섬 ${g.ok.food ? '>' : '≤'} ${n1(g.need)}섬(사람×1.2) · 하루 +${fmt(ff.prod)} −${fmt(ff.cons)}` },
      { id: 'happy', name: '민심', ok: g.ok.happy, short: `${near(g.happy, HAPPY_GATE)}/42`, text: `${near(g.happy, HAPPY_GATE)} ${g.ok.happy ? '≥' : '<'} 42 · 흐름대로면 ${near(g.target, HAPPY_GATE)}` },
      { id: 'occ', name: '점령', ok: g.ok.occ, short: g.ok.occ ? '없음' : `${occDaysLeft()}일 남음`, text: g.ok.occ ? '없음' : `${F.name} 점령 중 · ${occDaysLeft()}일 남음` },
      { id: 'fame', name: '명성', short: `${fmt(S.fame)} → +${g.fameN}명`, text: `${fmt(S.fame)} → 한 번에 +${g.fameN}명 · 다음 ${(g.fameN + 1) * FAME_STEP}` },
      { id: 'bonus', name: '민심 70', short: g.happy > HAPPY_BONUS ? '넘음 +1명' : `${Math.round(g.happy)}/70`, text: g.happy > HAPPY_BONUS ? '넘음 → 한 번에 +1명' : `아직 (${Math.round(g.happy)}) · 넘으면 한 번에 +1명` },
    ];
  }

  // 위기 조언(식량)이 짚을 곳: 권고와 같은 길 (무너진 논밭을 다시 짓기, 멈춘 논밭, 짓는 논밭 기다리기…)
  function foodAdvice() { const g = growth(); return foodPlan(g, foodFlow(g.pop)); }
  // 「인구가 멈췄습니다」가 짚을 문: 지금 닫힌 문의 권고만 (열린 문의 권고 food_low·happy_fall 은 빼고)
  const GATE_RECS = { occ: ['occ'], food: ['food'], house: ['house', 'house_wood', 'house_repair', 'house_wait'], happy: ['happy', 'happy_rise', 'happy_wait'] };
  function gateRec(g = growth()) {
    const closed = ['occ', 'food', 'house', 'happy'].filter(k => !g.ok[k]);
    return list().find(r => closed.some(k => GATE_RECS[k].includes(r.id))) || null;
  }
  return { growth, gates, list, top: () => list()[0] || null, find: id => list().find(r => r.id === id) || null, gateRec, blockText, foodFlow, foodAdvice, remedies, invalidate, HAPPY_GATE, HAPPY_BONUS, FAME_STEP, FOOD_MUL };
})();
