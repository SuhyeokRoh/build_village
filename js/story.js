'use strict';
// ───────────────────────────────────────────────
// 이야기와 튜토리얼 (총관이 곁에서 돕는다) — 뼈대
// 구현 규약은 docs/architecture.md "Story" 절을 따른다.
// ───────────────────────────────────────────────
const Story = {
  init() { S.story = S.story || { chapter: 0, step: 0, done: {}, skipped: false }; },
  setupNewGame() {},
  onEnterGame(isNew) {
    if (isNew) Events.notice('영주로 임명되다', `오늘부터 그대가 <em>${escapeHtml(S.name)}</em>의 영주다.`, '任');
  },
  onLoad() { if (!S.story) this.init(); },
  tick(dtH) {},
  hourly() {},
  daily() {},
  uiTick() {},
  isPausing() { return false; },
  allowThreat() { return true; },
  allowEvent(id) { return true; },
  happinessFactors() { return []; },
  openAdvisor() {},
};
