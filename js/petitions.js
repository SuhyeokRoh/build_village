'use strict';
// ───────────────────────────────────────────────
// 상소: 백성이 영주에게 올리는 청원 — 뼈대
// 구현 규약은 docs/architecture.md "Petitions" 절을 따른다.
// ───────────────────────────────────────────────
const Petitions = {
  init() { S.petitions = S.petitions || { list: [], nextId: 1, history: [] }; },
  onLoad() { if (!S.petitions) this.init(); },
  hourly() {},
  daily() {},
  uiTick() {},
  happinessFactors() { return []; },
  pending() { return S.petitions ? S.petitions.list.length : 0; },
  add(def) { return null; },
};
