'use strict';
// ───────────────────────────────────────────────
// 그림: 건물·나무·사람을 코드로 그린다 (외부 이미지 없음)
// 건물과 나무는 2배 해상도 캔버스에 미리 그려 캐시한다.
// ───────────────────────────────────────────────
const SS = 2;
const PAL = {
  plaster: '#ebe0c8', plasterShade: '#c9b996',
  wood: '#6b4428', woodDark: '#3b2414', woodLight: '#90633a',
  roof: '#3c4655', roofLight: '#5b6880', roofDark: '#232a35', roofTile: '#8d9ab0',
  thatch: '#c9a35a', thatchDark: '#8f6e36', thatchLight: '#e0c47f',
  stone: '#9b968b', stoneDark: '#6b6860', stoneLight: '#c0bbaf',
  red: '#a3342a', redDark: '#651d16', gold: '#d8a944', lantern: '#e0482f',
  snow: '#f3f6f9', soil: '#866443', soilDark: '#6a4d33', paper: '#efe3c2',
  green: '#3f8a66', blue: '#3b6ea5',
};

function rr(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function ell(c, col, x, y, rx, ry) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
function circ(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function line(c, col, w, x1, y1, x2, y2) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

function groundShadow(c, x, y, w, h) {
  const g = c.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, w / 1.6);
  g.addColorStop(0, 'rgba(0,0,0,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - 6, y - 4, w + 12, h + 8);
}
function stoneBase(c, x, y, w, h) {
  rr(c, PAL.stone, x, y, w, h);
  rr(c, PAL.stoneLight, x, y, w, 1.5);
  rr(c, 'rgba(0,0,0,0.25)', x, y + h - 1.5, w, 1.5);
  c.strokeStyle = 'rgba(60,55,48,0.45)'; c.lineWidth = 0.6;
  for (let i = 0, yy = y + 3; yy < y + h - 1; yy += 3.5, i++) {
    for (let xx = x + (i % 2 ? 4 : 0); xx < x + w; xx += 8) { c.beginPath(); c.moveTo(xx, yy - 3); c.lineTo(xx, yy); c.stroke(); }
    c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke();
  }
}
function wallFront(c, x, y, w, h, o = {}) {
  rr(c, o.color || PAL.plaster, x, y, w, h);
  rr(c, 'rgba(0,0,0,0.22)', x, y, w, 3);
  const pillars = o.pillars || 2;
  const pc = o.pillar || PAL.wood;
  for (let i = 0; i < pillars; i++) {
    const px = x + (w - 3) * (i / (pillars - 1));
    rr(c, pc, px, y, 3, h);
    rr(c, 'rgba(255,255,255,0.12)', px, y, 1, h);
  }
  rr(c, o.beam || PAL.woodDark, x, y + 2, w, 2);
  rr(c, PAL.woodDark, x, y + h - 2, w, 2);
}
function lattice(c, x, y, w, h) {
  rr(c, PAL.woodDark, x - 1, y - 1, w + 2, h + 2);
  rr(c, PAL.paper, x, y, w, h);
  c.strokeStyle = 'rgba(80,50,30,0.7)'; c.lineWidth = 0.6;
  for (let xx = x + 2.5; xx < x + w; xx += 2.5) { c.beginPath(); c.moveTo(xx, y); c.lineTo(xx, y + h); c.stroke(); }
  for (let yy = y + 2.5; yy < y + h; yy += 2.5) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
}
function doorway(c, x, y, w, h, col) {
  rr(c, PAL.woodDark, x - 1, y - 1, w + 2, h + 1);
  rr(c, col || '#2a1a10', x, y, w, h);
  rr(c, 'rgba(255,255,255,0.08)', x + w / 2 - 0.3, y, 0.6, h);
}
function dancheong(c, x, y, w, h) {
  rr(c, '#2f6f58', x, y, w, h);
  const cols = ['#b53a2c', '#e6d7b0', '#3d6ea8', '#e6d7b0'];
  for (let i = 0, xx = x + 1; xx < x + w - 2; xx += 4, i++) rr(c, cols[i % 4], xx, y + 1, 2, h - 2);
}
function tileRoof(c, x, y, w, h, o = {}) {
  const col = o.color || PAL.roof, light = o.light || PAL.roofLight, dark = o.dark || PAL.roofDark;
  const e = o.eave || Math.min(10, w * 0.14);
  const midY = y + h * (o.mid || 0.42);
  const ridgeY = y + 2;
  rr(c, 'rgba(0,0,0,0.28)', x + e, y + h, w - 2 * e, 3.5);
  // 앞쪽 지붕면
  c.beginPath();
  c.moveTo(x - 2, y + h - e * 0.6);
  c.quadraticCurveTo(x + e * 0.4, y + h + 1, x + e * 1.8, y + h);
  c.lineTo(x + w - e * 1.8, y + h);
  c.quadraticCurveTo(x + w - e * 0.4, y + h + 1, x + w + 2, y + h - e * 0.6);
  c.lineTo(x + w - e * 0.9, midY);
  c.lineTo(x + e * 0.9, midY);
  c.closePath();
  let g = c.createLinearGradient(0, midY, 0, y + h);
  g.addColorStop(0, light); g.addColorStop(1, col);
  c.fillStyle = g; c.fill();
  // 기와 골
  c.strokeStyle = 'rgba(15,18,24,0.45)'; c.lineWidth = 0.8;
  const cx = x + w / 2;
  for (let gx = x + e * 1.2; gx < x + w - e * 1.2; gx += 3.2) {
    c.beginPath(); c.moveTo(gx, midY + 1); c.lineTo(gx + (gx - cx) * 0.06, y + h - 0.5); c.stroke();
  }
  // 윗면(용마루 쪽)
  c.beginPath();
  c.moveTo(x + e * 0.9, midY);
  c.lineTo(x + e * 2.3, ridgeY + 2.5);
  c.lineTo(x + w - e * 2.3, ridgeY + 2.5);
  c.lineTo(x + w - e * 0.9, midY);
  c.closePath();
  g = c.createLinearGradient(0, ridgeY, 0, midY);
  g.addColorStop(0, dark); g.addColorStop(1, col);
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(15,18,24,0.35)'; c.lineWidth = 0.6;
  for (let gx = x + e * 2.3; gx < x + w - e * 2.3; gx += 3.2) {
    c.beginPath(); c.moveTo(gx, ridgeY + 3); c.lineTo(gx + (gx - cx) * 0.25, midY); c.stroke();
  }
  // 처마선과 막새
  line(c, o.edge || PAL.roofTile, 1, x + e * 1.6, y + h - 0.6, x + w - e * 1.6, y + h - 0.6);
  c.fillStyle = o.edge || PAL.roofTile;
  for (let gx = x + e * 1.8; gx < x + w - e * 1.8; gx += 3.2) { c.beginPath(); c.arc(gx, y + h - 0.2, 0.9, 0, Math.PI * 2); c.fill(); }
  line(c, 'rgba(255,255,255,0.18)', 1, x + e * 0.9, midY, x + w - e * 0.9, midY);
  // 용마루
  const rx1 = x + e * 2.3 - 2, rx2 = x + w - e * 2.3 + 2;
  rr(c, dark, rx1, ridgeY, rx2 - rx1, 3.5);
  rr(c, 'rgba(255,255,255,0.15)', rx1, ridgeY, rx2 - rx1, 0.8);
  c.fillStyle = dark;
  c.beginPath(); c.moveTo(rx1, ridgeY + 3.5); c.quadraticCurveTo(rx1 - 3, ridgeY + 1, rx1 - 4, ridgeY - 3.5); c.lineTo(rx1 + 2, ridgeY); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(rx2, ridgeY + 3.5); c.quadraticCurveTo(rx2 + 3, ridgeY + 1, rx2 + 4, ridgeY - 3.5); c.lineTo(rx2 - 2, ridgeY); c.closePath(); c.fill();
  if (o.redTrim) line(c, PAL.red, 1.2, x + e * 1.7, y + h + 1.2, x + w - e * 1.7, y + h + 1.2);
  if (o.snow) {
    c.fillStyle = 'rgba(244,247,250,0.94)';
    c.beginPath();
    c.moveTo(x + e * 2.3, ridgeY + 2.5); c.lineTo(x + w - e * 2.3, ridgeY + 2.5);
    c.lineTo(x + w - e * 0.9, midY);
    for (let gx = x + w - e * 0.9; gx > x + e * 0.9; gx -= 6) c.quadraticCurveTo(gx - 3, midY + 4 + ((gx * 7) % 3), gx - 6, midY + 1);
    c.closePath(); c.fill();
    rr(c, PAL.snow, rx1, ridgeY - 1, rx2 - rx1, 2.5);
  }
}
function thatchRoof(c, x, y, w, h, snow) {
  rr(c, 'rgba(0,0,0,0.25)', x + 4, y + h - 1, w - 8, 4);
  c.beginPath();
  c.moveTo(x, y + h);
  c.quadraticCurveTo(x - 3, y + h * 0.35, x + w * 0.22, y + 2);
  c.quadraticCurveTo(x + w * 0.5, y - 3, x + w * 0.78, y + 2);
  c.quadraticCurveTo(x + w + 3, y + h * 0.35, x + w, y + h);
  c.quadraticCurveTo(x + w / 2, y + h + 4, x, y + h);
  c.closePath();
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PAL.thatchLight); g.addColorStop(0.6, PAL.thatch); g.addColorStop(1, PAL.thatchDark);
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(110,80,35,0.45)'; c.lineWidth = 0.7;
  for (let i = 0; i < w * 1.4; i++) {
    const sx = x + ((i * 37) % w), sy = y + ((i * 53) % h);
    c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + 1.2, sy + 4); c.stroke();
  }
  c.strokeStyle = 'rgba(90,60,25,0.6)'; c.lineWidth = 1;
  for (let k = 1; k <= 3; k++) {
    const yy = y + h * k / 4;
    c.beginPath(); c.moveTo(x - 2, yy + 3); c.quadraticCurveTo(x + w / 2, yy - 3, x + w + 2, yy + 3); c.stroke();
  }
  if (snow) {
    c.fillStyle = 'rgba(244,247,250,0.93)';
    c.beginPath(); c.moveTo(x - 4, y + h * 0.55);
    c.quadraticCurveTo(x + w / 2, y - 8, x + w + 4, y + h * 0.55);
    for (let gx = x + w; gx > x; gx -= 7) c.quadraticCurveTo(gx - 3.5, y + h * 0.62 + 3, gx - 7, y + h * 0.55);
    c.closePath(); c.fill();
  }
  c.restore();
  // 처마 끝의 들쭉날쭉한 짚
  c.fillStyle = PAL.thatchDark;
  for (let xx = x + 2; xx < x + w - 2; xx += 2.5) c.fillRect(xx, y + h - 1 + ((xx * 13) % 3) * 0.5, 1.2, 2.5);
}
function lantern(c, x, y) {
  line(c, '#2a1a10', 0.6, x, y - 3, x, y);
  ell(c, PAL.lantern, x, y + 2.6, 2.2, 2.8);
  rr(c, '#f7c25a', x - 1.6, y + 2, 3.2, 0.7);
  rr(c, '#2a1a10', x - 1, y - 0.3, 2, 0.8);
  rr(c, '#2a1a10', x - 1, y + 5.2, 2, 0.8);
}
function signboard(c, x, y, w, h, text, bg = '#1e1712', fg = PAL.gold, vertical = false) {
  rr(c, PAL.woodDark, x - 1, y - 1, w + 2, h + 2);
  rr(c, bg, x, y, w, h);
  c.fillStyle = fg;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (vertical) {
    const fs = Math.min(w * 0.82, h / text.length * 0.9);
    c.font = `${fs}px "Song Myung", serif`;
    [...text].forEach((ch, i) => c.fillText(ch, x + w / 2, y + (i + 0.5) * h / text.length + 0.5));
  } else {
    const fs = Math.min(h * 0.82, w / text.length * 0.95);
    c.font = `${fs}px "Song Myung", serif`;
    c.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }
}
function flagTri(c, x, y, h, col, text) {
  line(c, PAL.woodDark, 1.2, x, y, x, y + h);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(x + 0.5, y + 1); c.lineTo(x + 12, y + 5); c.lineTo(x + 0.5, y + 11); c.closePath(); c.fill();
  if (text) { c.fillStyle = '#fff2d0'; c.font = '6px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x + 4.5, y + 6); }
}
function crate(c, x, y, s) {
  rr(c, '#8a5f36', x, y, s, s); rr(c, '#6a4526', x, y, s, 1); rr(c, '#6a4526', x, y + s - 1, s, 1);
  line(c, '#5a3a20', 0.7, x, y, x + s, y + s);
}
function sack(c, x, y) { ell(c, '#cdb68a', x, y, 3.2, 2.6); rr(c, '#a88f60', x - 1, y - 3.2, 2, 1.2); }
function jar(c, x, y, s = 1) { ell(c, '#5a3622', x, y, 2.6 * s, 3 * s); ell(c, '#7a4d32', x - 0.8 * s, y - 1 * s, 1 * s, 1.4 * s); rr(c, '#3a2214', x - 1.5 * s, y - 3.4 * s, 3 * s, 1 * s); }

// ── 건물별 그림 ────────────────────────────
// 원점(0,0)은 발판 좌상단. 위쪽으로 top 만큼 더 그릴 수 있다.
const DRAW = {
  manor(c, W, H, o) {
    groundShadow(c, 0, H - 30, W, 30);
    stoneBase(c, 2, H - 24, W - 4, 16);
    rr(c, PAL.stoneLight, W / 2 - 12, H - 10, 24, 3); rr(c, PAL.stone, W / 2 - 14, H - 7, 28, 4);
    rr(c, PAL.stoneDark, W / 2 - 14, H - 3.5, 28, 1);
    wallFront(c, 6, 44, W - 12, 30, { pillars: 6, pillar: PAL.red, beam: PAL.redDark });
    for (let i = 0; i < 5; i++) {
      const pw = (W - 12 - 3) / 5;
      const px = 6 + 3 + i * pw;
      if (i === 2) doorway(c, px + 2, 54, pw - 7, 20, '#3a1d12');
      else lattice(c, px + 2, 52, pw - 7, 16);
    }
    signboard(c, W / 2 - 15, 45, 30, 8, '領主館');
    tileRoof(c, -6, 8, W + 12, 38, { snow: o.snow, redTrim: true });
    dancheong(c, 18, 0, W - 36, 7);
    tileRoof(c, 12, -42, W - 24, 42, { snow: o.snow, eave: 9 });
    lantern(c, 13, 66); lantern(c, W - 13, 66);
  },
  house(c, W, H, o) {
    groundShadow(c, 0, H - 22, W, 22);
    stoneBase(c, 4, H - 9, W - 8, 7);
    wallFront(c, 6, 34, W - 12, 22, { pillars: 3 });
    doorway(c, W / 2 - 6, 40, 12, 16);
    lattice(c, 12, 40, 9, 8); lattice(c, W - 21, 40, 9, 8);
    thatchRoof(c, 0, -16, W, 52, o.snow);
    jar(c, W - 4, H - 4, 0.9); jar(c, W - 9, H - 3, 0.7);
  },
  house2(c, W, H, o) {
    groundShadow(c, 0, H - 22, W, 22);
    stoneBase(c, 3, H - 10, W - 6, 8);
    wallFront(c, 5, 32, W - 10, 24, { pillars: 4 });
    doorway(c, W / 2 - 5, 38, 10, 18, '#4a2a18');
    lattice(c, 9, 39, 9, 10); lattice(c, W - 18, 39, 9, 10);
    tileRoof(c, -4, -22, W + 8, 56, { snow: o.snow });
    rr(c, PAL.woodLight, 6, H - 12, W - 12, 2);
  },
  farm(c, W, H, o) {
    const season = o.season;
    rr(c, '#8a7048', 0, 0, W, H);
    rr(c, season === 3 ? '#9a8a74' : PAL.soil, 3, 3, W - 6, H - 6);
    for (let r = 0; r < 7; r++) {
      const y = 7 + r * 12.5;
      rr(c, PAL.soilDark, 4, y + 3, W - 8, 2.5);
      for (let x = 7; x < W - 6; x += 5) {
        const k = (x * 7 + r * 13) % 5;
        if (season === 0) { rr(c, '#7fbf55', x, y - 1 + k * 0.2, 2, 3); rr(c, '#a6dc72', x + 0.5, y - 2, 1, 1.5); }
        else if (season === 1) { rr(c, '#3f8a34', x - 0.5, y - 5, 3.5, 8); rr(c, '#66b04a', x, y - 6, 1.5, 3); }
        else if (season === 2) { rr(c, '#c99a2e', x - 0.5, y - 5, 3.5, 8); circ(c, '#e9c25a', x + 1, y - 5.5, 1.6); }
        else { rr(c, '#6e5a3c', x, y, 1, 2); if (k < 3) rr(c, PAL.snow, x - 1, y - 1, 4, 2); }
      }
    }
    // 허수아비
    line(c, PAL.woodDark, 1.5, W - 12, 20, W - 12, 6);
    line(c, PAL.woodDark, 1.2, W - 18, 11, W - 6, 11);
    rr(c, '#b0473a', W - 15, 10, 6, 6);
    ell(c, '#d4b778', W - 12, 5, 6, 2);
    circ(c, '#e8d2a8', W - 12, 6.5, 1.8);
  },
  fishery(c, W, H, o) {
    rr(c, '#9b7a52', 0, H - 18, W, 18);
    for (let x = 1; x < W; x += 5) rr(c, '#7c5c38', x, H - 18, 0.8, 18);
    thatchRoof(c, 2, -10, 34, 32, o.snow);
    wallFront(c, 5, 20, 28, 14, { pillars: 2 });
    doorway(c, 15, 24, 8, 10);
    // 그물과 건조대
    line(c, PAL.woodDark, 1.2, 40, 10, 40, 34); line(c, PAL.woodDark, 1.2, 60, 10, 60, 34);
    line(c, PAL.woodDark, 1, 40, 12, 60, 12);
    c.strokeStyle = 'rgba(60,50,40,0.6)'; c.lineWidth = 0.5;
    for (let x = 41; x < 60; x += 2) { c.beginPath(); c.moveTo(x, 12); c.lineTo(x + 1, 30); c.stroke(); }
    for (let i = 0; i < 4; i++) { ell(c, '#9fb0b8', 44 + i * 4.5, 16, 1.2, 3); }
    // 광주리
    ell(c, '#a8854a', 14, H - 8, 6, 3.5); ell(c, '#8fa3ad', 14, H - 9, 4, 2);
    ell(c, '#a8854a', 30, H - 6, 5, 3);
    // 작은 배
    c.fillStyle = '#6a4528'; c.beginPath(); c.moveTo(40, H - 10); c.lineTo(W - 2, H - 10); c.lineTo(W - 6, H - 3); c.lineTo(44, H - 3); c.closePath(); c.fill();
    rr(c, '#8a5f36', 41, H - 10, W - 43, 1.5);
  },
  lumber(c, W, H, o) {
    rr(c, '#a0855c', 2, H - 30, W - 4, 28);
    for (let i = 0; i < 18; i++) rr(c, '#c9a878', (i * 23) % (W - 6) + 3, H - 28 + (i * 17) % 24, 1.5, 1);
    // 헛간 지붕과 기둥
    line(c, PAL.woodDark, 2, 6, 12, 6, 40); line(c, PAL.woodDark, 2, 34, 12, 34, 40);
    thatchRoof(c, 0, -14, 40, 30, o.snow);
    // 통나무 더미
    const logs = [[44, 40], [52, 40], [60, 40], [48, 33], [56, 33], [52, 26]];
    for (const [x, y] of logs) { rr(c, '#7a4f2c', x - 4, y - 3, 8, 6); circ(c, '#d6b07a', x + 4, y, 3); circ(c, '#a67c46', x + 4, y, 1.4); }
    // 그루터기와 도끼
    ell(c, '#6b4428', 20, 52, 6, 3); ell(c, '#c9a070', 20, 50, 5.5, 2.5);
    line(c, '#6b4428', 1.4, 18, 49, 24, 42); rr(c, '#9aa2a8', 22, 40, 4, 3);
    // 톱질 받침
    line(c, PAL.woodDark, 1.2, 8, 46, 12, 56); line(c, PAL.woodDark, 1.2, 12, 46, 8, 56);
  },
  quarry(c, W, H, o) {
    rr(c, '#8f877a', 2, 6, W - 4, H - 8);
    for (let i = 0; i < 40; i++) circ(c, i % 2 ? '#a69e90' : '#736c62', (i * 29) % (W - 6) + 3, 8 + (i * 31) % (H - 12), 0.8 + (i % 3) * 0.4);
    const blocks = [[8, 44], [20, 44], [32, 44], [14, 34], [26, 34], [20, 24]];
    for (const [x, y] of blocks) {
      rr(c, PAL.stoneDark, x, y, 12, 10); rr(c, PAL.stoneLight, x, y, 12, 3); rr(c, PAL.stone, x + 1, y + 3, 10, 6);
    }
    // 도르래 틀
    line(c, PAL.woodDark, 2, 46, 52, 52, 4); line(c, PAL.woodDark, 2, 60, 52, 54, 4);
    line(c, PAL.woodDark, 1.5, 48, 30, 58, 30);
    line(c, '#c9b48a', 0.7, 53, 5, 53, 30); rr(c, PAL.stone, 49, 30, 8, 6);
    line(c, '#6b4428', 1.3, 36, 58, 44, 52); rr(c, '#9aa2a8', 42, 50, 5, 2);
    if (o.snow) for (const [x, y] of blocks) rr(c, PAL.snow, x, y, 12, 2);
  },
  warehouse(c, W, H, o) {
    groundShadow(c, 0, H - 22, W, 22);
    stoneBase(c, 2, H - 8, W - 4, 6);
    rr(c, '#7a5232', 4, 24, W - 8, 32);
    for (let x = 6; x < W - 4; x += 4) rr(c, '#5e3c22', x, 24, 0.8, 32);
    rr(c, PAL.woodDark, 4, 24, W - 8, 3);
    doorway(c, W / 2 - 10, 34, 20, 22, '#3a2414');
    line(c, '#2a1a10', 1, W / 2 - 10, 34, W / 2 + 10, 56); line(c, '#2a1a10', 1, W / 2 + 10, 34, W / 2 - 10, 56);
    tileRoof(c, -4, -24, W + 8, 50, { snow: o.snow });
    sack(c, 8, H - 10); sack(c, 13, H - 8); crate(c, W - 14, H - 16, 8);
  },
  smithy(c, W, H, o) {
    groundShadow(c, 0, H - 22, W, 22);
    rr(c, '#7a6a58', 2, 22, W - 4, H - 24);
    rr(c, '#2a1d16', 6, 26, W - 22, 24);
    // 화덕
    rr(c, PAL.stoneDark, 8, 36, 16, 12);
    const fg = c.createRadialGradient(16, 38, 1, 16, 38, 9);
    fg.addColorStop(0, '#fff2a8'); fg.addColorStop(0.4, '#ff8a2a'); fg.addColorStop(1, 'rgba(255,80,20,0)');
    c.fillStyle = fg; c.fillRect(6, 28, 20, 18);
    // 굴뚝
    rr(c, PAL.stoneDark, W - 16, -26, 10, 40); rr(c, PAL.stone, W - 15, -26, 8, 38); rr(c, PAL.stoneDark, W - 17, -28, 12, 4);
    tileRoof(c, -3, -16, W - 8, 40, { snow: o.snow, mid: 0.5 });
    // 모루와 병기 걸이
    rr(c, '#3a3f45', 30, H - 14, 12, 4); rr(c, '#2a2e33', 33, H - 10, 6, 6); rr(c, '#5a626a', 30, H - 14, 12, 1);
    line(c, PAL.woodDark, 1.4, W - 12, H - 22, W - 12, H - 4); line(c, PAL.woodDark, 1.4, W - 4, H - 22, W - 4, H - 4);
    line(c, PAL.woodDark, 1, W - 13, H - 20, W - 3, H - 20);
    for (let i = 0; i < 3; i++) line(c, '#c9d0d6', 1, W - 11 + i * 3, H - 20, W - 11 + i * 3, H - 6);
    rr(c, '#6b4428', W - 30, H - 8, 8, 6); rr(c, '#3b6ea5', W - 29, H - 7, 6, 2);
  },
  market(c, W, H, o) {
    rr(c, '#b8a07a', 0, H - 26, W, 24);
    const aw = [['#b53a2c', '#efe3c2'], ['#3b6ea5', '#efe3c2'], ['#d6a63a', '#7a4a22']];
    for (let i = 0; i < 3; i++) {
      const x = 2 + i * 31;
      line(c, PAL.woodDark, 1.5, x + 2, 6, x + 2, H - 10); line(c, PAL.woodDark, 1.5, x + 27, 6, x + 27, H - 10);
      // 진열대
      rr(c, '#7a5232', x, H - 22, 30, 8); rr(c, '#94683e', x, H - 22, 30, 2);
      const goods = i === 0 ? ['#5aa04a', '#7fbf55', '#c94a3a'] : i === 1 ? ['#8a6a4a', '#a07a52', '#6a4a32'] : ['#d9c27a', '#b05a7a', '#5a8aba'];
      for (let k = 0; k < 6; k++) circ(c, goods[k % 3], x + 4 + k * 4.4, H - 23, 2.1);
      // 차양
      for (let s = 0; s < 6; s++) {
        c.fillStyle = aw[i][s % 2];
        c.beginPath();
        c.moveTo(x + s * 5, -6); c.lineTo(x + s * 5 + 5, -6);
        c.lineTo(x + s * 5 + 5.5, 22); c.lineTo(x + s * 5 - 0.5, 22); c.closePath(); c.fill();
      }
      for (let s = 0; s < 6; s++) { c.fillStyle = aw[i][s % 2]; c.beginPath(); c.arc(x + s * 5 + 2.5, 22, 2.6, 0, Math.PI); c.fill(); }
      rr(c, 'rgba(0,0,0,0.18)', x, 14, 30, 8);
      if (o.snow) rr(c, 'rgba(244,247,250,0.9)', x - 0.5, -7, 31, 10);
    }
    jar(c, 8, H - 4); jar(c, 14, H - 3, 0.8); sack(c, W - 8, H - 4); crate(c, W - 22, H - 9, 7);
    signboard(c, W / 2 - 4, -22, 8, 14, '市', '#b53a2c', '#fff0d8');
    line(c, PAL.woodDark, 1, W / 2, -8, W / 2, -6);
  },
  inn(c, W, H, o) {
    groundShadow(c, 0, H - 24, W, 24);
    stoneBase(c, 2, H - 8, W - 4, 6);
    // 아래층: 열린 앞면
    wallFront(c, 4, 34, W - 8, 22, { pillars: 5, pillar: '#7a2e22' });
    rr(c, '#2e1e14', 8, 38, W - 16, 18);
    for (let i = 0; i < 3; i++) { rr(c, '#8a5a32', 14 + i * 24, 47, 12, 3); rr(c, '#5a3a20', 18 + i * 24, 50, 3, 6); circ(c, '#e9dcc0', 17 + i * 24, 46, 1); }
    // 위층
    rr(c, PAL.plaster, 8, 2, W - 16, 22);
    rr(c, 'rgba(0,0,0,0.2)', 8, 2, W - 16, 3);
    for (let i = 0; i < 4; i++) lattice(c, 13 + i * 19, 7, 13, 11);
    // 난간
    rr(c, '#7a2e22', 4, 22, W - 8, 2);
    for (let x = 6; x < W - 4; x += 4) rr(c, '#7a2e22', x, 22, 1.2, 7);
    rr(c, '#7a2e22', 4, 28, W - 8, 1.5);
    tileRoof(c, -4, 24, W + 8, 12, { snow: o.snow, mid: 0.2, eave: 6 });
    tileRoof(c, 0, -40, W, 44, { snow: o.snow, redTrim: true });
    // 간판과 주기(酒旗)
    signboard(c, W / 2 - 13, -2, 26, 8, '客棧');
    line(c, PAL.woodDark, 1.4, W - 2, -30, W - 2, 34);
    c.fillStyle = '#efe3c2'; c.fillRect(W - 1.5, -28, 9, 20);
    rr(c, '#b53a2c', W - 1.5, -28, 9, 2); rr(c, '#b53a2c', W - 1.5, -10, 9, 2);
    c.fillStyle = '#1e1712'; c.font = '8px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('酒', W + 3, -18);
    for (let i = 0; i < 4; i++) lantern(c, 12 + i * 24, 35);
  },
  escort(c, W, H, o) {
    rr(c, '#b49a72', 0, H - 32, W, 32);
    for (let i = 0; i < 20; i++) rr(c, '#9a805a', (i * 37) % W, H - 30 + (i * 13) % 28, 2, 1);
    groundShadow(c, 0, 40, W, 24);
    stoneBase(c, 2, 56, W - 4, 8);
    wallFront(c, 4, 26, W - 8, 30, { pillars: 5, pillar: '#7a2e22' });
    doorway(c, W / 2 - 8, 34, 16, 22, '#3a1d12');
    lattice(c, 12, 36, 14, 12); lattice(c, W - 26, 36, 14, 12);
    signboard(c, W / 2 - 16, 27, 32, 7, '鏢局');
    tileRoof(c, -4, -30, W + 8, 58, { snow: o.snow });
    // 마당: 수레와 짐
    rr(c, '#7a5232', 16, H - 22, 26, 10); rr(c, '#94683e', 16, H - 22, 26, 2);
    circ(c, '#3b2414', 20, H - 10, 4); circ(c, '#8a6a4a', 20, H - 10, 1.5);
    circ(c, '#3b2414', 38, H - 10, 4); circ(c, '#8a6a4a', 38, H - 10, 1.5);
    crate(c, 19, H - 30, 8); crate(c, 28, H - 30, 8);
    flagTri(c, 4, H - 36, 32, '#b53a2c', '鏢'); flagTri(c, W - 16, H - 36, 32, '#b53a2c', '鏢');
    flagTri(c, W / 2 + 14, H - 30, 26, '#d6a63a', '鏢');
  },
  clinic(c, W, H, o) {
    groundShadow(c, 0, H - 22, W, 22);
    stoneBase(c, 3, H - 9, W - 6, 7);
    wallFront(c, 5, 32, W - 10, 24, { pillars: 3 });
    doorway(c, W / 2 - 5, 38, 10, 18);
    lattice(c, 9, 39, 10, 9);
    tileRoof(c, -3, -20, W + 6, 54, { snow: o.snow });
    signboard(c, W - 18, 36, 8, 14, '藥', '#efe3c2', '#1e1712', true);
    // 약초 바구니
    ell(c, '#a8854a', 10, H - 3, 6, 2.6); ell(c, '#5a7a3a', 10, H - 4, 4.4, 1.6);
    ell(c, '#a8854a', W - 10, H - 3, 6, 2.6); ell(c, '#8a5a3a', W - 10, H - 4, 4.4, 1.6);
    // 호리병
    circ(c, '#c9a35a', W - 8, 26, 2.4); circ(c, '#c9a35a', W - 8, 22.5, 1.6); line(c, '#b53a2c', 0.8, W - 9.5, 24.5, W - 6.5, 24.5);
  },
  shrine(c, W, H, o) {
    groundShadow(c, 0, H - 20, W, 20);
    stoneBase(c, 4, H - 14, W - 8, 10);
    rr(c, PAL.stoneLight, W / 2 - 8, H - 5, 16, 3); rr(c, PAL.stone, W / 2 - 10, H - 2, 20, 2);
    wallFront(c, 8, 30, W - 16, 22, { pillars: 4, pillar: PAL.red, beam: PAL.redDark });
    doorway(c, W / 2 - 6, 34, 12, 18, '#4a1a12');
    dancheong(c, 8, 24, W - 16, 5);
    tileRoof(c, -4, -26, W + 8, 52, { snow: o.snow, redTrim: true, eave: 11 });
    // 향로
    rr(c, '#6a5a3a', W / 2 - 3, H - 9, 6, 3); ell(c, '#8a7a4a', W / 2, H - 9, 4, 1.6);
  },
  well(c, W, H, o) {
    ell(c, 'rgba(0,0,0,0.25)', W / 2, H - 6, 14, 5);
    ell(c, PAL.stoneDark, W / 2, H - 10, 12, 7);
    ell(c, PAL.stone, W / 2, H - 12, 12, 6);
    ell(c, '#1e3a4a', W / 2, H - 12, 8, 3.6);
    ell(c, PAL.stoneLight, W / 2, H - 15, 12, 3.2);
    ell(c, '#24465a', W / 2, H - 15, 8.5, 2.2);
    line(c, PAL.woodDark, 1.6, 6, H - 12, 6, -6); line(c, PAL.woodDark, 1.6, W - 6, H - 12, W - 6, -6);
    line(c, PAL.woodDark, 1.2, 4, -4, W - 4, -4);
    thatchRoof(c, 0, -12, W, 10, o.snow);
    line(c, '#c9b48a', 0.6, W / 2, -4, W / 2, 6); rr(c, '#7a5232', W / 2 - 2.5, 6, 5, 4);
  },
  pavilion(c, W, H, o) {
    ell(c, '#3f7898', 18, H - 14, 17, 11);
    ell(c, '#5a94b4', 15, H - 16, 10, 5);
    for (const [x, y] of [[10, H - 12], [24, H - 10], [16, H - 20]]) { ell(c, '#4f8f4a', x, y, 3.2, 2); circ(c, '#f0a0b8', x + 1, y - 1, 1.2); }
    stoneBase(c, 30, 30, 30, 10);
    for (const x of [33, 54]) line(c, PAL.red, 2, x, 10, x, 31);
    for (const x of [38, 49]) line(c, PAL.redDark, 1.6, x, 12, x, 30);
    rr(c, PAL.woodLight, 34, 24, 22, 2);
    tileRoof(c, 22, -22, 46, 36, { snow: o.snow, eave: 12, redTrim: true });
  },
  dojo(c, W, H, o) {
    // 마당
    rr(c, '#d4c095', 0, 30, W, H - 30);
    for (let i = 0; i < 30; i++) rr(c, '#c2ab7c', (i * 31) % W, 34 + (i * 19) % (H - 38), 2, 1);
    rr(c, PAL.stone, 0, H - 3, W, 3);
    for (const x of [0, W - 3]) rr(c, PAL.stone, x, 30, 3, H - 30);
    // 본당
    groundShadow(c, 0, 18, W, 16);
    stoneBase(c, 2, 24, W - 4, 8);
    wallFront(c, 6, 2, W - 12, 22, { pillars: 6, pillar: PAL.red, beam: PAL.redDark });
    doorway(c, W / 2 - 8, 8, 16, 16, '#3a1d12');
    lattice(c, 12, 9, 12, 10); lattice(c, W - 24, 9, 12, 10);
    tileRoof(c, -6, -34, W + 12, 38, { snow: o.snow, redTrim: true });
    signboard(c, W / 2 - 12, -2, 24, 8, '武館');
    // 수련용 목인과 병기대
    for (const x of [W - 24, W - 12]) {
      line(c, '#6b4428', 3, x, 46, x, 66); circ(c, '#7a5232', x, 44, 3.5);
      line(c, '#6b4428', 2, x - 6, 52, x + 6, 52); line(c, '#6b4428', 2, x - 5, 58, x + 5, 58);
    }
    line(c, PAL.woodDark, 1.4, 8, 40, 8, 64); line(c, PAL.woodDark, 1.4, 22, 40, 22, 64);
    line(c, PAL.woodDark, 1, 7, 44, 23, 44);
    for (let i = 0; i < 4; i++) { line(c, '#7a5232', 0.8, 10 + i * 3.5, 36, 10 + i * 3.5, 63); rr(c, '#c9d0d6', 9.3 + i * 3.5, 34, 1.4, 3); }
    // 횃불대
    for (const x of [8, W - 8]) { line(c, PAL.woodDark, 1.6, x, 26, x, 36); ell(c, '#ffb04a', x, 25, 2, 3); }
  },
  tower(c, W, H, o) {
    ell(c, 'rgba(0,0,0,0.3)', W / 2, H - 6, 16, 5);
    line(c, PAL.woodDark, 3, 5, H - 4, 8, -40); line(c, PAL.woodDark, 3, W - 5, H - 4, W - 8, -40);
    line(c, PAL.wood, 1.4, 6, H - 8, W - 7, -18); line(c, PAL.wood, 1.4, W - 6, H - 8, 7, -18);
    line(c, PAL.wood, 1.4, 7, -18, W - 7, -38); line(c, PAL.wood, 1.4, W - 7, -18, 7, -38);
    // 사다리
    line(c, PAL.woodLight, 1, W / 2 - 3, H - 4, W / 2 - 3, -40); line(c, PAL.woodLight, 1, W / 2 + 3, H - 4, W / 2 + 3, -40);
    for (let y = H - 8; y > -40; y -= 5) line(c, PAL.woodLight, 0.8, W / 2 - 3, y, W / 2 + 3, y);
    // 망대
    rr(c, PAL.wood, -3, -44, W + 6, 5); rr(c, PAL.woodLight, -3, -44, W + 6, 1.5);
    for (let x = -3; x <= W + 3; x += 4) rr(c, PAL.woodDark, x, -52, 1.4, 8);
    rr(c, PAL.woodDark, -3, -53, W + 6, 1.5);
    line(c, PAL.woodDark, 1.4, -1, -52, -1, -64); line(c, PAL.woodDark, 1.4, W + 1, -52, W + 1, -64);
    thatchRoof(c, -6, -72, W + 12, 12, o.snow);
  },
  wall(c, W, H, o) {
    const m = o.mask || 0;
    const stake = (x, y, h) => {
      c.fillStyle = '#6b4428';
      c.beginPath(); c.moveTo(x - 2.2, y); c.lineTo(x - 2.2, y - h); c.lineTo(x, y - h - 4); c.lineTo(x + 2.2, y - h); c.lineTo(x + 2.2, y); c.closePath(); c.fill();
      rr(c, '#8e6239', x - 2.2, y - h, 1.2, h);
      if (o.snow) { c.fillStyle = PAL.snow; c.beginPath(); c.moveTo(x - 2.2, y - h); c.lineTo(x, y - h - 4); c.lineTo(x + 2.2, y - h); c.closePath(); c.fill(); }
    };
    ell(c, 'rgba(0,0,0,0.25)', W / 2, H - 8, 12, 4);
    const pts = [[W / 2, H - 8]];
    if (m & 1) pts.push([W / 2, H - 22], [W / 2 - 1, H - 15]);
    if (m & 8) pts.push([2, H - 8], [9, H - 8]);
    if (m & 2) pts.push([W - 9, H - 8], [W - 2, H - 8]);
    if (m & 4) pts.push([W / 2 + 1, H + 1], [W / 2, H + 7]);
    if (!(m & 10)) pts.push([W / 2 - 6, H - 7], [W / 2 + 6, H - 9]);
    pts.sort((a, b) => a[1] - b[1]);
    for (const [x, y] of pts) stake(x, y, 18);
    if (m & 10) {
      const x1 = (m & 8) ? -1 : W / 2, x2 = (m & 2) ? W + 1 : W / 2;
      rr(c, '#4a2f1c', x1, H - 20, x2 - x1, 2); rr(c, '#4a2f1c', x1, H - 13, x2 - x1, 2);
    }
  },
  stonewall(c, W, H, o) {
    const m = o.mask || 0;
    const seg = (x, y, w, h) => {
      rr(c, PAL.stoneDark, x, y, w, h);
      rr(c, PAL.stone, x, y + 4, w, h - 6);
      rr(c, PAL.stoneLight, x, y, w, 4);
      c.strokeStyle = 'rgba(50,46,40,0.5)'; c.lineWidth = 0.6;
      for (let yy = y + 8; yy < y + h - 1; yy += 5) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy); c.stroke(); }
      for (let xx = x + 3; xx < x + w; xx += 6) { c.beginPath(); c.moveTo(xx, y + 4); c.lineTo(xx, y + h - 2); c.stroke(); }
      if (o.snow) rr(c, PAL.snow, x, y - 1, w, 3);
    };
    ell(c, 'rgba(0,0,0,0.25)', W / 2, H - 4, 14, 4);
    if (m & 1) seg(W / 2 - 8, -8, 16, 20);
    const x1 = (m & 8) ? 0 : 6, x2 = (m & 2) ? W : W - 6;
    seg(x1, H - 26, x2 - x1, 24);
    for (let x = x1 + 1; x < x2 - 3; x += 7) { rr(c, PAL.stoneDark, x, H - 30, 4, 4); rr(c, PAL.stoneLight, x, H - 30, 4, 1.2); if (o.snow) rr(c, PAL.snow, x, H - 31, 4, 1.5); }
    if (m & 4) seg(W / 2 - 8, H - 4, 16, 6);
  },
  gate(c, W, H, o) {
    ell(c, 'rgba(0,0,0,0.25)', W / 2, H - 4, 16, 4);
    rr(c, PAL.red, 1, -4, 4, H - 4); rr(c, PAL.red, W - 5, -4, 4, H - 4);
    rr(c, '#5a3420', 5, 4, W - 10, H - 8);
    for (let x = 7; x < W - 6; x += 4) rr(c, '#4a2a18', x, 4, 0.8, H - 8);
    rr(c, PAL.woodDark, W / 2 - 0.5, 4, 1, H - 8);
    for (const y of [8, H - 10]) for (let x = 8; x < W - 6; x += 5) circ(c, '#c9a35a', x, y, 0.8);
    tileRoof(c, -6, -26, W + 12, 24, { snow: o.snow, eave: 7 });
  },
};

function drawConstruction(c, W, H, top, progress) {
  rr(c, '#a88a62', 1, 1, W - 2, H - 2);
  rr(c, 'rgba(0,0,0,0.12)', 1, H - 6, W - 2, 5);
  const ph = Math.max(12, top * TILE * 0.5 + H * 0.6);
  // 비계(대나무)
  c.strokeStyle = '#8a7a3a'; c.lineWidth = 1.4;
  for (let x = 3; x <= W - 3; x += Math.max(10, (W - 6) / 3)) { c.beginPath(); c.moveTo(x, H - 2); c.lineTo(x, H - 2 - ph); c.stroke(); }
  for (let y = H - 8; y > H - ph; y -= 9) { c.beginPath(); c.moveTo(2, y); c.lineTo(W - 2, y); c.stroke(); }
  // 올라가는 벽
  const wh = (ph - 8) * clamp(progress, 0, 1);
  rr(c, 'rgba(235,224,200,0.85)', 5, H - 4 - wh, W - 10, wh);
  rr(c, PAL.woodDark, 5, H - 4 - wh, W - 10, 1.5);
  c.strokeStyle = 'rgba(80,60,30,0.5)'; c.lineWidth = 0.7;
  c.beginPath(); c.moveTo(4, H - 2 - ph); c.lineTo(W - 4, H - 6); c.stroke();
  // 목재 더미
  for (let i = 0; i < 3; i++) rr(c, '#8e6239', 3 + i * 2, H - 6 - i * 2, 12, 2);
}
function drawRuin(c, W, H) {
  rr(c, '#3b3430', 2, 2, W - 4, H - 4);
  for (let i = 0; i < W * H / 40; i++) {
    const x = (i * 37) % (W - 6) + 3, y = (i * 23) % (H - 6) + 3;
    circ(c, i % 3 ? '#2a2420' : '#5a524a', x, y, 1 + (i % 3));
  }
  const beams = Math.max(2, Math.floor(W / 14));
  for (let i = 0; i < beams; i++) {
    c.save(); c.translate(6 + i * (W - 12) / beams + 4, H * 0.4 + (i % 2) * 10); c.rotate(-0.5 + i * 0.45);
    rr(c, '#1e1712', -10, -2, 20, 4); rr(c, '#4a2f1c', -10, -2, 20, 1);
    c.restore();
  }
  for (let i = 0; i < 6; i++) rr(c, '#4a5260', (i * 41) % (W - 8) + 4, (i * 29) % (H - 8) + 4, 4, 2);
}

const SpriteCache = new Map();
// 반환: {c, ox, oy, w, h} — ox/oy는 발판 좌상단 기준 월드 픽셀 오프셋
function buildingSprite(type, w, h, season, state, extra = '') {
  const key = `${type}|${season}|${state}|${extra}`;
  let s = SpriteCache.get(key);
  if (s) return s;
  const def = BDEF[type];
  const W = w * TILE, H = h * TILE;
  const top = Math.ceil((def.top || 0) * TILE + 12);
  const padX = 14;
  const cw = W + padX * 2, ch = H + top + 12;
  const cv = document.createElement('canvas');
  cv.width = cw * SS; cv.height = ch * SS;
  const c = cv.getContext('2d');
  c.scale(SS, SS);
  c.translate(padX, top);
  if (state === 'build') drawConstruction(c, W, H, def.top || 0, parseFloat(extra) || 0);
  else if (state === 'ruin') drawRuin(c, W, H);
  else DRAW[type](c, W, H, { snow: season === 3, season, mask: extra ? parseInt(extra, 10) : 0 });
  s = { c: cv, ox: -padX, oy: -top, w: cw, h: ch };
  SpriteCache.set(key, s);
  return s;
}

// ── 나무 ─────────────────────────────────
function treeKind(v) { return v < 120 ? 'pine' : v < 215 ? 'leaf' : 'bamboo'; }
function buildTree(kind, season, variant) {
  const cw = 44, ch = 62;
  const cv = document.createElement('canvas');
  cv.width = cw * SS; cv.height = ch * SS;
  const c = cv.getContext('2d');
  c.scale(SS, SS);
  const bx = cw / 2, by = ch - 6;
  ell(c, 'rgba(0,0,0,0.22)', bx, by, 11, 4);
  const winter = season === 3;
  if (kind === 'pine') {
    rr(c, '#5a3a24', bx - 2, by - 18, 4, 18);
    const tiers = [[by - 14, 15, '#2f5a3a'], [by - 24, 12, '#386a42'], [by - 33, 9, '#43784a'], [by - 40, 5, '#4c8250']];
    for (const [y, r, col] of tiers) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(bx - r - 2, y + 4); c.quadraticCurveTo(bx, y - r * 0.9, bx + r + 2, y + 4); c.quadraticCurveTo(bx, y + 7, bx - r - 2, y + 4); c.fill();
      if (winter) { c.fillStyle = 'rgba(244,247,250,0.92)'; c.beginPath(); c.moveTo(bx - r + 1, y + 1); c.quadraticCurveTo(bx, y - r * 0.85, bx + r - 1, y + 1); c.quadraticCurveTo(bx, y + 2, bx - r + 1, y + 1); c.fill(); }
    }
  } else if (kind === 'leaf') {
    rr(c, '#5e3e26', bx - 2.2, by - 20, 4.4, 20);
    line(c, '#5e3e26', 2, bx, by - 16, bx - 7, by - 26);
    line(c, '#5e3e26', 2, bx, by - 18, bx + 8, by - 28);
    const blossom = variant % 3 === 0;
    let cols;
    if (season === 0) cols = blossom ? ['#e9a8b8', '#f4c4d0', '#d98ca0'] : ['#7fb85a', '#94cc6a', '#6aa04a'];
    else if (season === 1) cols = ['#3f7f38', '#4f9444', '#356b30'];
    else if (season === 2) cols = variant % 2 ? ['#d9822b', '#e9a03a', '#b8602a'] : ['#c9a030', '#ddb848', '#a8822a'];
    if (!winter) {
      const blobs = [[0, -30, 11], [-8, -25, 8], [8, -26, 8.5], [-3, -38, 8], [5, -36, 7]];
      blobs.forEach(([dx, dy, r], i) => circ(c, cols[i % 3], bx + dx, by + dy, r));
      for (let i = 0; i < 9; i++) circ(c, 'rgba(255,255,255,0.12)', bx - 6 + (i * 7) % 12, by - 40 + (i * 5) % 14, 1.4);
    } else {
      c.strokeStyle = '#4e3826'; c.lineWidth = 1.1;
      for (const [x2, y2] of [[-10, -36], [10, -38], [-3, -44], [4, -32], [-7, -30]]) { c.beginPath(); c.moveTo(bx, by - 18); c.lineTo(bx + x2, by + y2); c.stroke(); }
      for (const [x2, y2] of [[-10, -36], [10, -38], [-3, -44]]) rr(c, PAL.snow, bx + x2 - 2, by + y2 - 0.5, 4, 1.5);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const x = bx - 9 + i * 4.5 + (variant % 3), h = 34 + ((variant + i * 7) % 12);
      line(c, i % 2 ? '#5f9a48' : '#4f8a3c', 2, x, by, x + (i - 2) * 0.8, by - h);
      for (let y = by - 6; y > by - h; y -= 6) rr(c, '#3a6a2c', x - 1.2, y, 2.4, 1);
      c.fillStyle = winter ? '#6a9a6a' : '#6aaa4a';
      for (let k = 0; k < 3; k++) {
        const ly = by - h + 4 + k * 7;
        c.beginPath(); c.ellipse(x + (k % 2 ? 4 : -4), ly, 4.5, 1.3, k % 2 ? 0.4 : -0.4, 0, Math.PI * 2); c.fill();
      }
      if (winter) rr(c, PAL.snow, x - 2, by - h, 4, 2);
    }
  }
  return { c: cv, w: cw, h: ch, ax: bx, ay: by };
}
const TreeCache = new Map();
function treeSprite(v, season) {
  const kind = treeKind(v);
  const variant = v % 6;
  const key = `${kind}|${season}|${variant}`;
  let s = TreeCache.get(key);
  if (!s) { s = buildTree(kind, season, variant); TreeCache.set(key, s); }
  return s;
}

// ── 사람 ─────────────────────────────────
// L: 생김새, P: 자세. (x, y) = 발 위치
function drawFigure(c, x, y, L, P) {
  c.save();
  c.translate(x, y);
  ell(c, 'rgba(0,0,0,0.28)', 0, 0, 5.5, 2);
  if (P.down) {
    c.rotate(-Math.PI / 2 * (P.dir || 1));
    c.translate(0, -1);
    rr(c, L.cloth, -4, -12, 8, 9);
    circ(c, L.skin, 0, -15, 3);
    rr(c, '#7a1a12', -3, -9, 3, 2);
    c.restore();
    return;
  }
  if (P.dir < 0) c.scale(-1, 1);
  const moving = P.moving;
  const sw = moving ? Math.sin(P.walk) : 0;
  const bob = moving ? Math.abs(Math.cos(P.walk)) * 0.8 : 0;
  c.translate(0, -bob);
  // 다리
  rr(c, L.pants, -3 + sw * 1.2, -5, 2.4, 5);
  rr(c, L.pants, 0.8 - sw * 1.2, -5, 2.4, 5);
  rr(c, '#2a1e16', -3.4 + sw * 1.2, -1.2, 3, 1.4);
  rr(c, '#2a1e16', 0.6 - sw * 1.2, -1.2, 3, 1.4);
  // 뒷팔
  const armSw = moving ? -sw * 2.2 : 0;
  rr(c, L.cloth, -4.6 + armSw * 0.3, -12, 2, 6);
  // 몸통(도포)
  c.fillStyle = L.cloth;
  c.beginPath(); c.moveTo(-3.6, -12.8); c.lineTo(3.6, -12.8); c.lineTo(4.6, -3.6); c.lineTo(-4.6, -3.6); c.closePath(); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.16)';
  c.beginPath(); c.moveTo(1, -12.8); c.lineTo(3.6, -12.8); c.lineTo(4.6, -3.6); c.lineTo(1.6, -3.6); c.closePath(); c.fill();
  // 깃
  c.strokeStyle = L.collar || '#efe6d4'; c.lineWidth = 0.9;
  c.beginPath(); c.moveTo(-1.6, -12.6); c.lineTo(0.8, -9.4); c.lineTo(2.6, -12.6); c.stroke();
  rr(c, L.cloth2, -4, -8.6, 8.2, 1.6);
  // 머리
  circ(c, L.skin, 0.3, -15.6, 3.1);
  rr(c, '#1a120c', 1.6, -16.2, 0.9, 0.9);
  c.fillStyle = L.hair;
  c.beginPath(); c.arc(0, -16.2, 3.25, Math.PI * 1.02, Math.PI * 2.05); c.fill();
  if (L.sex === 'f') { circ(c, L.hair, -2.8, -15.4, 1.9); rr(c, L.hair, -3.3, -15.6, 1.4, 3.4); }
  else if (!L.hat || L.hat === 'band') circ(c, L.hair, -0.4, -19.4, 1.4);
  // 모자
  if (L.hat === 'straw') {
    c.fillStyle = '#cfb072';
    c.beginPath(); c.moveTo(-7.2, -16.4); c.lineTo(0, -22.6); c.lineTo(7.2, -16.4); c.quadraticCurveTo(0, -15.4, -7.2, -16.4); c.fill();
    line(c, '#8f7340', 0.6, -7, -16.4, 7, -16.4);
  } else if (L.hat === 'farmer') {
    ell(c, '#c9a862', 0, -18.6, 4.6, 1.4); rr(c, '#b8954e', -2.2, -21, 4.4, 2.6);
  } else if (L.hat === 'band') {
    rr(c, L.cloth2, -3.2, -18, 6.6, 1.3);
    line(c, L.cloth2, 0.8, -3, -17.4, -5.4, -15.2);
  } else if (L.hat === 'hood') {
    c.fillStyle = L.cloth2; c.beginPath(); c.arc(0, -16, 3.7, Math.PI * 0.95, Math.PI * 2.05); c.fill();
    rr(c, L.cloth2, -3.8, -16, 2.2, 4);
  } else if (L.hat === 'mask') {
    c.fillStyle = L.hair; c.beginPath(); c.arc(0, -16.2, 3.4, Math.PI, Math.PI * 2); c.fill();
    rr(c, L.cloth2, -0.6, -15.3, 4, 2.6);
  } else if (L.hat === 'helmet') {
    c.fillStyle = '#6a5a3a'; c.beginPath(); c.arc(0, -16.6, 3.6, Math.PI, Math.PI * 2); c.fill();
    rr(c, '#c79a2c', -0.5, -22, 1, 2.6);
  } else if (L.hat === 'guard') {
    c.fillStyle = '#2a2a30'; c.beginPath(); c.arc(0, -16.8, 3.5, Math.PI, Math.PI * 2); c.fill();
    rr(c, '#2a2a30', -4.2, -17.2, 8.4, 1.1);
  }
  // 앞팔 + 들고 있는 것
  const act = P.action;
  let ang = 0.15 + armSw * 0.15;
  if (act === 'attack') ang = -1.9 + P.phase * 2.8;
  else if (act === 'work') ang = -1.4 + Math.abs(Math.sin(P.phase * Math.PI)) * 1.8;
  else if (act === 'bow') ang = -1.3;
  else if (P.torch) ang = -1.1;
  c.save();
  c.translate(1.5, -11.5);
  c.rotate(ang);
  rr(c, L.cloth, -1, 0, 2.2, 5.6);
  circ(c, L.skin, 0.1, 6, 1.2);
  const held = act === 'work' ? P.tool : (P.torch ? 'torch' : (act === 'attack' || P.armed ? L.weapon : null));
  if (held) drawHeld(c, held);
  c.restore();
  // 등/허리에 찬 무기
  if (!P.armed && act !== 'attack' && L.weapon && L.weapon !== 'bow') {
    if (L.weapon === 'spear') line(c, '#6b4428', 1, -3.5, -2, 2.5, -23);
    else line(c, '#2a2420', 1.3, -2.5, -7.5, -6.5, -2);
  }
  c.restore();
}
function drawHeld(c, kind) {
  switch (kind) {
    case 'sword': line(c, '#3a2a1a', 1.4, 0, 5, 0, 7.5); rr(c, '#c9a35a', -1.6, 7, 3.2, 0.9); line(c, '#e3e8ec', 1.1, 0, 7.6, 0, 17); break;
    case 'blade': line(c, '#3a2a1a', 1.4, 0, 5, 0, 7.5); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(-0.8, 7.5); c.lineTo(1.6, 7.5); c.quadraticCurveTo(2.4, 13, 0, 16.5); c.lineTo(-0.8, 7.5); c.fill(); break;
    case 'spear': line(c, '#6b4428', 1, 0, -6, 0, 18); c.fillStyle = '#d6dce0'; c.beginPath(); c.moveTo(-1.2, 18); c.lineTo(1.2, 18); c.lineTo(0, 22); c.fill(); rr(c, '#b53a2c', -1, 17, 2, 1); break;
    case 'axe': line(c, '#6b4428', 1.2, 0, 4, 0, 13); rr(c, '#9aa2a8', -0.5, 10.5, 4, 3); break;
    case 'hoe': line(c, '#6b4428', 1.1, 0, 3, 0, 14); rr(c, '#7a8288', -3.5, 13, 4, 1.6); break;
    case 'pick': line(c, '#6b4428', 1.1, 0, 3, 0, 13); c.strokeStyle = '#7a8288'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(-3.5, 11); c.quadraticCurveTo(0, 14, 3.5, 11); c.stroke(); break;
    case 'hammer': line(c, '#6b4428', 1.1, 0, 4, 0, 11); rr(c, '#5a626a', -2, 10, 4, 3); break;
    case 'rod': line(c, '#8a6a3a', 0.8, 0, 3, 0, 20); break;
    case 'bow': c.strokeStyle = '#6b4428'; c.lineWidth = 1.1; c.beginPath(); c.arc(0, 8, 6, -1.2, 1.2); c.stroke(); line(c, '#e0d8c8', 0.4, 2.2, 2.4, 2.2, 13.6); break;
    case 'fist': circ(c, '#e8c09a', 0, 6.6, 1.6); break;
    case 'torch': line(c, '#5a3a20', 1.3, 0, 3, 0, 11); circ(c, '#ffb040', 0, 12.5, 2.2); circ(c, '#fff0a0', 0, 12.2, 1.1); break;
    default: break;
  }
}

// 생김새 만들기
const SKINS = ['#f0c9a0', '#e6b78e', '#dcab80', '#efc39a'];
const CLOTH_M = ['#cfc3a8', '#a89a7c', '#8c7b62', '#b9b3a0', '#7d8a6a', '#9a8f80', '#c8bca0'];
const CLOTH_F = ['#d99a9a', '#c7b3d6', '#a8c4d6', '#e2c99a', '#b5d0a8', '#e8c0c8', '#d6c4a0'];
const HERO_CLOTH = ['#e9e4d8', '#2d3b4f', '#5a2d2d', '#2f4a3a', '#4a3a5a', '#1e1e22', '#8a6a3a'];
function makeLook(kind, sex, extra = {}) {
  const L = {
    sex, skin: pick(SKINS), hair: extra.old ? '#a8a49a' : pick(['#1c1612', '#2a211b', '#16110d']),
    cloth: sex === 'f' ? pick(CLOTH_F) : pick(CLOTH_M), cloth2: pick(['#5a4a3a', '#3a3029', '#6a5a48', '#8a3a2a']),
    pants: '#4a3f36', hat: null, weapon: null, collar: '#efe6d4',
  };
  if (kind === 'civ') { if (sex === 'm' && Math.random() < 0.3) L.hat = 'farmer'; }
  else if (kind === 'hero') {
    L.cloth = pick(HERO_CLOTH); L.cloth2 = pick(['#b53a2c', '#d6a63a', '#3b6ea5', '#1e1e22']);
    L.hat = Math.random() < 0.5 ? 'straw' : 'band'; L.weapon = extra.weapon || pick(['sword', 'blade', 'sword', 'spear', 'fist']);
    L.pants = '#2a2420';
  } else if (kind === 'faction') {
    const u = FACTIONS[extra.faction].unit;
    L.cloth = u.cloth; L.cloth2 = u.cloth2; L.hat = u.hat; L.weapon = u.weapon; L.pants = '#2a2420';
    if (extra.leader) { L.hat = extra.faction === 'heukpung' ? 'band' : u.hat; L.cloth = FACTIONS[extra.faction].dark; L.collar = u.cloth2; }
  }
  return L;
}
function applyRoleLook(v) {
  const L = v.look;
  if (v.hero) return;
  if (v.role === 'guard') {
    L.cloth = '#3d5a7a'; L.cloth2 = '#1e2a38'; L.hat = 'guard'; L.weapon = v.jobType === 'tower' ? 'bow' : (v.jobType === 'escort' ? 'blade' : 'spear'); L.pants = '#2a2a30';
    if (v.jobType === 'escort') { L.cloth = '#7a2e22'; L.cloth2 = '#d6a63a'; L.hat = 'band'; }
  } else {
    if (L.weapon) { L.weapon = null; }
    if (L.hat === 'guard' || L.hat === 'band') L.hat = null;
    if (L.cloth === '#3d5a7a' || L.cloth === '#7a2e22') L.cloth = v.sex === 'f' ? pick(CLOTH_F) : pick(CLOTH_M);
    L.cloth2 = L.cloth2 === '#1e2a38' ? '#5a4a3a' : L.cloth2;
    L.pants = '#4a3f36';
  }
}

// 건설 메뉴 아이콘
function iconCanvas(key, w = 48, h = 36) {
  const cv = document.createElement('canvas');
  cv.width = w * 2; cv.height = h * 2;
  const c = cv.getContext('2d');
  c.scale(2, 2);
  if (BDEF[key]) {
    const def = BDEF[key];
    const s = buildingSprite(key, def.w, def.h, 1, 'done', def.line ? '10' : '');
    const sc = Math.min(w / s.w, h / s.h) * 0.98;
    c.drawImage(s.c, (w - s.w * sc) / 2, (h - s.h * sc) / 2, s.w * sc, s.h * sc);
  } else {
    const t = TOOLS[key];
    c.fillStyle = key === 'demolish' ? '#6e2a20' : key === 'clear' ? '#2f5a3a' : '#8a6a44';
    c.beginPath(); c.arc(w / 2, h / 2, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#f5e7c8'; c.font = '18px "Song Myung", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t.hanja, w / 2, h / 2 + 1);
  }
  return cv;
}
