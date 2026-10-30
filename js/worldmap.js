'use strict';
// ───────────────────────────────────────────────
// 천하도(天下圖) 자리 채움. 천하도 담당이 이 파일을 통째로 갈아끼운다 (docs/jianghu.md §10)
// 고르기 모드는 곧바로 기본 고을(낙수 들녘)을 고르고, 보기 모드는 아직 아무것도 하지 않는다
// ───────────────────────────────────────────────
const WorldMap = {
  open(mode, opts = {}) { if (mode === 'pick' && opts.onPick) opts.onPick('henan_field'); },
  close() {},
  isOpen() { return false; },
  mode() { return null; },
};
