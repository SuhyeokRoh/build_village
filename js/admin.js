'use strict';
// ───────────────────────────────────────────────
// 육방(六房): 관아의 여섯 부서와 예산 — 뼈대
// 구현 규약은 docs/architecture.md "Admin" 절을 따른다.
// ───────────────────────────────────────────────
const Admin = {
  init() { S.admin = S.admin || { depts: {} }; },
  onLoad() { if (!S.admin) this.init(); },
  hourly() {},
  daily() {},
  uiTick() {},
  taxMul() { return 1; },
  happinessFactors() { return []; },
};
