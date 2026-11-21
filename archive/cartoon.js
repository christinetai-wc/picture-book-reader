// 《下雨了》《看一看、想一想》：扁平卡通風（照原書的水彩卡通感），人物用參數畫，會動。
// 座標同 scenes.js（1200×840）。登記到 window.Scenes.list。
(function () {
  const { W, H, list } = window.Scenes;
  const OL = '#5b4033';
  const TAU = Math.PI * 2;

  // ---------- 小工具 ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (t, a, b) => ease((t - a) / (b - a));
  function layer(S, draw) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * S); c.height = Math.round(H * S);
    const g = c.getContext('2d'); g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g);
    return c;
  }
  function fillStroke(ctx, fill, lw = 3, stroke = OL) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); }
  function blinkAt(t, period, phase = 0) { const u = (t + phase) % period; return u < 0.16 ? Math.abs(Math.cos(u / 0.16 * Math.PI)) : 1; }
  function heart(ctx, x, y, s, fill, stroke) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-30, -8, -18, -34, 0, -18); ctx.bezierCurveTo(18, -34, 30, -8, 0, 12); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2.5 / s; ctx.stroke(); }
    ctx.restore();
  }

  // ---------- 背景元件 ----------
  function bricks(g, x0, y0, x1, y1, o = {}) {
    const r = rng(o.seed || 3), bw = o.bw || 120, bh = o.bh || 50;
    g.fillStyle = o.mortar || '#e9e6ee'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    for (let row = 0, y = y0; y < y1; row++, y += bh) {
      for (let x = x0 - (row % 2 ? bw / 2 : 0); x < x1; x += bw) {
        const c = (o.colors || ['#c9c6d2', '#d4d1dc', '#bdbac7', '#cfcbd8'])[Math.floor(r() * 4)];
        rrect(g, x + 4, y + 4, bw - 8, bh - 8, 5); g.fillStyle = c; g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; rrect(g, x + 8, y + 6, bw - 30, 10, 4); g.fill();
      }
    }
    g.restore();
  }
  function bush(g, x, y, s, seed, berries = true) {
    const r = rng(seed);
    for (let i = 0; i < 14; i++) {
      const a = Math.PI + r() * Math.PI, d = r() * 70;
      ell(g, x + Math.cos(a) * d * 1.5 * s, y + Math.sin(a) * d * s * 0.8, (36 + r() * 20) * s, (30 + r() * 16) * s);
      g.fillStyle = ['#4f8a3c', '#62a047', '#3f7a33', '#77b356'][i % 4]; g.fill();
    }
    if (berries) for (let i = 0; i < 9; i++) {
      ell(g, x + (r() - 0.5) * 180 * s, y - r() * 70 * s, 6 * s, 6 * s); g.fillStyle = '#d8434a'; g.fill();
    }
  }
  function cloud(g, x, y, s, col = '#ffffff') {
    g.fillStyle = col;
    [[0, 0, 40], [38, -12, 34], [72, 2, 30], [-34, 6, 28]].forEach(([dx, dy, r]) => { ell(g, x + dx * s, y + dy * s, r * s, r * 0.8 * s); g.fill(); });
  }
  function skyGrad(g, top, bot, y1 = H) {
    const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(0, 0, W, y1);
  }
  function makeRain(n, seed, slant = 0.25) {
    const r = rng(seed); const drops = [];
    for (let i = 0; i < n; i++) drops.push({ x: r() * (W + 300), y: r() * H, v: 600 + r() * 300, l: 40 + r() * 40 });
    return function (ctx, t, alpha = 0.7) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of drops) {
        const y = (d.y + t * d.v) % (H + 100) - 50, x = ((d.x - (y + 50) * slant) % (W + 300) + W + 300) % (W + 300) - 150;
        ctx.moveTo(x, y); ctx.lineTo(x - d.l * slant, y + d.l);
      }
      ctx.stroke(); ctx.restore();
    };
  }
  function ripples(ctx, t, spots, col = 'rgba(255,255,255,.7)') {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2;
    spots.forEach(([x, y, ph], i) => {
      const u = ((t * 0.9 + ph) % 1);
      ctx.globalAlpha = 1 - u; ell(ctx, x, y, 8 + u * 40, (8 + u * 40) * 0.3); ctx.stroke();
    });
    ctx.restore();
  }
  function room(g, wall, floor, floorY) {
    const gr = g.createLinearGradient(0, 0, 0, floorY); gr.addColorStop(0, wall[0]); gr.addColorStop(1, wall[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, floorY);
    g.fillStyle = floor; g.fillRect(0, floorY, W, H - floorY);
    g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, floorY, W, 8);
  }
  function rainWindow(g, x, y, w, h, o = {}) {
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#b8c7d9'); gr.addColorStop(1, '#dde6ee');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const r = rng(o.seed || 9); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2;
    for (let i = 0; i < 40; i++) { const xx = x + r() * w, yy = y + r() * h; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx - 8, yy + 30); g.stroke(); }
    g.strokeStyle = o.frame || '#ffffff'; g.lineWidth = o.fw || 14; g.strokeRect(x, y, w, h);
  }
  function curtain(g, x, y, w, h, col = '#c9454c', swayX = 0) {
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y);
    g.bezierCurveTo(x + w * 0.7 + swayX, y + h * 0.4, x + w * 0.9 + swayX, y + h * 0.7, x + w * 0.6 + swayX, y + h);
    g.lineTo(x, y + h); g.closePath(); fillStroke(g, col, 2.5, '#8a2c33');
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 4;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + w * i / 5, y + 10); g.lineTo(x + w * i / 5 * 0.8, y + h - 10); g.stroke(); }
  }

  // ---------- 人物 ----------
  // 頭中心 (0,0)、頭半徑約 60。full=全身（腳底 child 320 / adult 440），否則半身。
  const SKIN = '#f8d6c2';
  function stripesClip(ctx, path, base, stripe, gap = 18) {
    ctx.save(); ctx.fillStyle = base; ctx.fill(path); ctx.clip(path);
    if (stripe) { ctx.fillStyle = stripe; for (let y = -100; y < 600; y += gap) ctx.fillRect(-200, y, 400, gap / 2); }
    ctx.restore();
  }
  function dots(ctx, path, base, dot, step = 26) {
    ctx.save(); ctx.fillStyle = base; ctx.fill(path); ctx.clip(path); ctx.fillStyle = dot;
    for (let y = -300; y < 700; y += step) for (let x = -300; x < 300; x += step) { ell(ctx, x + ((y / step) % 2) * step / 2, y, 4, 4); ctx.fill(); }
    ctx.restore();
  }
  function ik(S, T, L1, L2, side, inward) {
    let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
    d = Math.min(d, L1 + L2 - 0.5); d = Math.max(d, Math.abs(L1 - L2) + 0.5);
    const base = Math.atan2(dy, dx), a = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
    const e1 = [S[0] + Math.cos(base + a) * L1, S[1] + Math.sin(base + a) * L1];
    const e2 = [S[0] + Math.cos(base - a) * L1, S[1] + Math.sin(base - a) * L1];
    const out = (e) => side * e[0];
    let e = out(e1) > out(e2) ? e1 : e2; if (inward) e = e === e1 ? e2 : e1;
    const h = [e[0] + Math.cos(Math.atan2(T[1] - e[1], T[0] - e[0])) * L2, e[1] + Math.sin(Math.atan2(T[1] - e[1], T[0] - e[0])) * L2];
    return [e, h];
  }
  function drawArm(ctx, p, side, target, sleeve, skin) {
    const A = p.adult, S = [side * (A ? 62 : 56), A ? 96 : 90];
    const [e, h] = ik(S, target, A ? 95 : 70, A ? 85 : 64, side, p.inward && p.inward[side > 0 ? 1 : 0]);
    const w = A ? 24 : 26;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(e[0], e[1]); ctx.lineTo(h[0], h[1]);
    ctx.strokeStyle = OL; ctx.lineWidth = w + 5; ctx.stroke();
    ctx.strokeStyle = sleeve; ctx.lineWidth = w; ctx.stroke();
    if (p.cuff) { ctx.beginPath(); ctx.moveTo(e[0] + (h[0] - e[0]) * 0.75, e[1] + (h[1] - e[1]) * 0.75); ctx.lineTo(h[0], h[1]); ctx.strokeStyle = p.cuff; ctx.lineWidth = w; ctx.stroke(); }
    ell(ctx, h[0], h[1], 14, 14); fillStroke(ctx, p.glove || skin, 2.5);
    return h;
  }
  function hairPath(ctx, style, part) {
    ctx.beginPath();
    if (style === 'boy' || style === 'blond') {
      ctx.moveTo(-64, 6); ctx.bezierCurveTo(-72, -62, -22, -82, 0, -80); ctx.bezierCurveTo(30, -82, 74, -58, 64, 6);
      ctx.lineTo(56, -14); ctx.lineTo(44, -28); ctx.lineTo(30, -14); ctx.lineTo(16, -32); ctx.lineTo(2, -16);
      ctx.lineTo(-14, -32); ctx.lineTo(-28, -16); ctx.lineTo(-42, -30); ctx.lineTo(-56, -12); ctx.closePath();
    } else if (style === 'bob' || style === 'long' || style === 'pony' || style === 'wavy') {
      if (part === 'back') {
        const len = style === 'bob' ? 70 : style === 'pony' ? 10 : 150;
        ctx.moveTo(-64, -20); ctx.quadraticCurveTo(-84, len * 0.5, -74, len); ctx.lineTo(74, len); ctx.quadraticCurveTo(84, len * 0.5, 64, -20); ctx.closePath();
      } else if (style === 'long') {
        ctx.moveTo(-66, 10); ctx.bezierCurveTo(-72, -64, -20, -82, 0, -80); ctx.bezierCurveTo(22, -82, 72, -64, 66, 10);
        ctx.lineTo(58, -22); ctx.lineTo(-58, -22); ctx.closePath();
      } else {
        ctx.moveTo(-66, 12); ctx.bezierCurveTo(-72, -64, -14, -84, 8, -80); ctx.bezierCurveTo(44, -76, 74, -50, 66, 14);
        ctx.quadraticCurveTo(58, -34, 6, -36); ctx.quadraticCurveTo(-40, -30, -66, 12); ctx.closePath();
      }
    } else if (style === 'curly') {
      ctx.moveTo(-66, 0); ctx.bezierCurveTo(-74, -70, 74, -70, 66, 0); ctx.quadraticCurveTo(0, -40, -66, 0);
    }
  }
  function drawHairBack(ctx, p) {
    const h = p.hair; if (!h) return;
    if (['bob', 'long', 'wavy'].includes(h.style)) { hairPath(ctx, h.style, 'back'); fillStroke(ctx, h.color, 3); }
    if (h.style === 'pony') {
      ctx.save(); ctx.translate(74, -14); ctx.rotate(0.25 + Math.sin((p.t || 0) * 3) * 0.06);
      ell(ctx, 18, 50, 24, 66); fillStroke(ctx, h.color, 3); ctx.restore();
    }
    if (h.style === 'hood') {
      ell(ctx, 0, 4, 104, 110); fillStroke(ctx, '#2f4f9a', 3);
    }
  }
  function drawHairFront(ctx, p) {
    const h = p.hair; if (!h) return;
    if (h.style === 'curly') {
      const r = rng(4); ctx.fillStyle = h.color;
      for (let a = Math.PI * 1.02; a < Math.PI * 1.98; a += 0.16) for (const rad of [58, 72]) {
        ell(ctx, Math.cos(a) * rad, -6 + Math.sin(a) * rad * 0.95, 17, 17); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 26; i++) { const a = Math.PI * (1.05 + r() * 0.9), rad = 50 + r() * 28; ctx.beginPath(); ctx.arc(Math.cos(a) * rad, -6 + Math.sin(a) * rad, 7, 0, 5); ctx.stroke(); }
      return;
    }
    if (h.style === 'hood') {
      ctx.fillStyle = '#e9c36a'; ell(ctx, -50, 20, 16, 40); ctx.fill(); ell(ctx, 50, 20, 16, 40); ctx.fill();
      for (let a = 0; a < TAU; a += TAU / 22) { ell(ctx, Math.cos(a) * 82, 4 + Math.sin(a) * 88, 20, 20); fillStroke(ctx, '#ffffff', 2, '#c8cbd6'); }
      return;
    }
    hairPath(ctx, h.style === 'wavy' ? 'bob' : h.style, 'front'); fillStroke(ctx, h.color, 3);
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(-6, -24, 44, 3.6, 4.4); ctx.stroke();
    if (h.clip) { ctx.save(); ctx.translate(-40, -34); ctx.rotate(-0.7); rrect(ctx, -4, -14, 8, 28, 3); fillStroke(ctx, '#f2c84b', 2); ctx.restore(); }
    if (h.bow) {
      ctx.save(); ctx.translate(58, -54); ctx.rotate(0.3);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-24, -16); ctx.lineTo(-24, 16); ctx.closePath(); fillStroke(ctx, h.bow, 2.5);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -16); ctx.lineTo(24, 16); ctx.closePath(); fillStroke(ctx, h.bow, 2.5);
      ell(ctx, 0, 0, 7, 7); fillStroke(ctx, h.bow, 2.5); ctx.restore();
    }
  }
  function drawHat(ctx, hat) {
    if (!hat) return;
    if (hat.type === 'rain') {
      ctx.beginPath(); ctx.ellipse(0, -30, 98, 26, 0, 0, TAU); fillStroke(ctx, hat.color, 3);
      ctx.beginPath(); ctx.moveTo(-60, -30); ctx.bezierCurveTo(-60, -100, 60, -100, 60, -30); ctx.closePath(); fillStroke(ctx, hat.color, 3);
      ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-58, -40); ctx.quadraticCurveTo(0, -30, 58, -40); ctx.stroke();
    } else if (hat.type === 'cap') {
      ctx.beginPath(); ctx.moveTo(-64, -18); ctx.bezierCurveTo(-66, -96, 66, -96, 64, -18); ctx.closePath(); fillStroke(ctx, hat.color, 3);
      ctx.beginPath(); ctx.moveTo(20, -22); ctx.quadraticCurveTo(80, -40, 108, -14); ctx.quadraticCurveTo(70, -8, 20, -14); ctx.closePath(); fillStroke(ctx, hat.color, 3);
    } else if (hat.type === 'bucket') {
      ctx.beginPath(); ctx.moveTo(-86, -10); ctx.quadraticCurveTo(-70, -40, -56, -44); ctx.bezierCurveTo(-56, -104, 56, -104, 56, -44);
      ctx.quadraticCurveTo(70, -40, 86, -10); ctx.quadraticCurveTo(0, -30, -86, -10); fillStroke(ctx, hat.color, 3);
    }
  }
  function drawFace(ctx, p, t) {
    const f = p.face || {};
    const look = f.look || [0, 0];
    const open = f.blink == null ? blinkAt(t, 3.7, f.phase || 0) : f.blink;
    const eyes = f.eyes || 'open';
    ctx.lineCap = 'round';
    [-1, 1].forEach((s) => {
      const ex = s * 24, ey = -2;
      ctx.strokeStyle = OL; ctx.lineWidth = 3.5;
      if (eyes === 'happy') { ctx.beginPath(); ctx.arc(ex, ey + 6, 11, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); return; }
      if (eyes === 'closed') { ctx.beginPath(); ctx.arc(ex, ey - 4, 11, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); return; }
      if (eyes === 'squeeze') { ctx.beginPath(); ctx.moveTo(ex - s * 10, ey - 8); ctx.lineTo(ex + s * 6, ey); ctx.lineTo(ex - s * 10, ey + 8); ctx.stroke(); return; }
      const big = eyes === 'wide' ? 1.25 : 1;
      if (open < 0.2) { ctx.beginPath(); ctx.moveTo(ex - 11, ey); ctx.lineTo(ex + 11, ey); ctx.stroke(); return; }
      ell(ctx, ex, ey, 13 * big, 15 * big * open); fillStroke(ctx, '#ffffff', 2.5);
      ell(ctx, ex + look[0] * 5, ey + look[1] * 5, 5.5, 6 * open); ctx.fillStyle = '#2a211c'; ctx.fill();
    });
    // 眉毛
    if (f.brows) {
      ctx.strokeStyle = OL; ctx.lineWidth = 4;
      [-1, 1].forEach((s) => {
        const inner = f.brows === 'worried' ? -30 : f.brows === 'angry' ? -18 : -28, outer = f.brows === 'worried' ? -22 : f.brows === 'angry' ? -30 : -30;
        ctx.beginPath(); ctx.moveTo(s * 12, inner); ctx.lineTo(s * 36, outer); ctx.stroke();
      });
    }
    // 鼻子、腮紅
    ctx.strokeStyle = OL; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 14, 5, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.fillStyle = 'rgba(240,120,120,.35)'; ell(ctx, -38, 22, 13, 9); ctx.fill(); ell(ctx, 38, 22, 13, 9); ctx.fill();
    // 嘴
    const m = f.mouth || 'smile', talk = f.talk ? (0.5 + 0.5 * Math.sin(t * 14)) : 0;
    ctx.lineWidth = 3;
    if (m === 'smile') { ctx.beginPath(); ctx.arc(0, 22, 16, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
    else if (m === 'grin' || m === 'tongue') {
      ctx.beginPath(); ctx.moveTo(-26, 26); ctx.quadraticCurveTo(0, 32, 26, 26); ctx.quadraticCurveTo(22, 58, 0, 58); ctx.quadraticCurveTo(-22, 58, -26, 26); fillStroke(ctx, '#a83a3a', 3);
      ctx.save(); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(-30, 24, 60, 12);
      if (m === 'tongue') { ell(ctx, 10, 54, 12, 10); ctx.fillStyle = '#ef7b87'; ctx.fill(); }
      ctx.restore();
    } else if (m === 'o') { ell(ctx, 0, 36, 8 + talk * 3, 10 + talk * 4); fillStroke(ctx, '#7a2e2e', 2.5); }
    else if (m === 'cry') {
      ctx.beginPath(); for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; const x = -26 * Math.cos(a), y = 40 + (i % 2 ? 6 : 0) - Math.sin(a) * 12; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; ctx.lineTo(26 * Math.cos(a), 44 + Math.sin(a) * 12 + (i % 2 ? -5 : 0)); }
      fillStroke(ctx, '#ffffff', 3);
    } else if (m === 'chatter' || m === 'teeth') {
      const j = m === 'chatter' ? Math.sin(t * 30) * 2 : 0;
      rrect(ctx, -22, 30 + j, 44, 16, 6); fillStroke(ctx, '#ffffff', 3);
      ctx.beginPath(); ctx.moveTo(-22, 38 + j); for (let x = -22; x <= 22; x += 7) ctx.lineTo(x, 38 + j + ((x / 7) % 2 ? 3 : -3)); ctx.stroke();
    } else if (m === 'frown') { ctx.beginPath(); ctx.arc(0, 48, 14, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
    else if (m === 'talk') { ell(ctx, 0, 34, 14, 4 + talk * 9); fillStroke(ctx, '#7a2e2e', 2.5); }
    // 眼淚、汗
    if (f.tears) {
      ctx.fillStyle = '#8fd0f5'; ctx.strokeStyle = '#4b9ad1'; ctx.lineWidth = 2;
      [-1, 1].forEach((s, i) => {
        const u = ((t * 0.9 + i * 0.5) % 1);
        const x = s * 30, y = 10 + u * 70;
        ctx.globalAlpha = 1 - u * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 8, y + 2, x, y + 6); ctx.quadraticCurveTo(x - 8, y + 2, x, y - 12); ctx.fill(); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    if (f.sweat) {
      ctx.fillStyle = '#bfe6ff'; ctx.strokeStyle = '#5aa6d8'; ctx.lineWidth = 2;
      [[44, -30, 0], [-50, -20, 0.5], [30, -50, 0.25]].forEach(([x, y, ph]) => {
        const u = ((t * 0.7 + ph) % 1), yy = y + u * 50;
        ctx.globalAlpha = 1 - u;
        ctx.beginPath(); ctx.moveTo(x, yy - 14); ctx.quadraticCurveTo(x + 10, yy + 4, x, yy + 8); ctx.quadraticCurveTo(x - 10, yy + 4, x, yy - 14); ctx.fill(); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
  }
  // p: {adult, full, skin, hair, hat, face, shirt:{color,stripe}, sleeve, apron, coat:{color,dot}, bottom:{type,color}, shoes, legs:[aL,aR], hands:[[x,y],[x,y]], armsFront, tilt, shake, bob}
  function person(ctx, x, y, sc, p, t) {
    p.t = t;
    ctx.save(); ctx.translate(x, y + (p.bob || 0)); ctx.scale(sc, sc);
    if (p.shake) ctx.translate(Math.sin(t * 45) * p.shake, 0);
    if (p.tilt) ctx.rotate(p.tilt);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const A = p.adult, skin = p.skin || SKIN;
    const waist = A ? 250 : 190, footY = A ? 440 : 320, sw = A ? 70 : 64;
    const sleeve = p.coat ? p.coat.color : (p.sleeve || p.shirt.color); // 穿雨衣時袖子跟雨衣同色
    const hands = p.hands || [[-70, waist + 10], [70, waist + 10]];
    drawHairBack(ctx, p);
    // 腿
    if (p.full) {
      const legs = p.legs || [0, 0], b = p.bottom || { type: 'pants', color: '#33457a' };
      [-1, 1].forEach((s, i) => {
        const hx = s * (A ? 24 : 24), a = legs[i], L = footY - waist - 14;
        const fx = hx + Math.sin(a) * L, fy = waist + Math.cos(a) * L;
        const legCol = b.type === 'pants' ? b.color : skin;
        ctx.beginPath(); ctx.moveTo(hx, waist); ctx.lineTo(fx, fy);
        ctx.strokeStyle = OL; ctx.lineWidth = (A ? 34 : 38) + 5; ctx.stroke(); ctx.strokeStyle = legCol; ctx.lineWidth = A ? 34 : 38; ctx.stroke();
        if (b.type === 'shorts') { ctx.beginPath(); ctx.moveTo(hx, waist); ctx.lineTo(hx + Math.sin(a) * 50, waist + Math.cos(a) * 50); ctx.strokeStyle = b.color; ctx.lineWidth = 44; ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(fx + s * 8, fy + 6, 28, 15, 0, 0, TAU); fillStroke(ctx, p.shoes || '#e48a9a', 3);
      });
      if (b.type === 'skirt') {
        ctx.beginPath(); ctx.moveTo(-sw + 12, waist - 10); ctx.lineTo(sw - 12, waist - 10); ctx.lineTo(sw + 20, waist + (A ? 120 : 70)); ctx.lineTo(-sw - 20, waist + (A ? 120 : 70)); ctx.closePath();
        fillStroke(ctx, b.color, 3);
        if (b.pleat) { ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 16, waist - 4); ctx.lineTo(i * 22, waist + (A ? 116 : 66)); ctx.stroke(); } }
      }
    }
    // 身體
    const bottomY = p.full ? waist : 340;
    const torso = new Path2D();
    torso.moveTo(-26, 58); torso.lineTo(26, 58); torso.quadraticCurveTo(sw, 62, sw + 2, 104);
    torso.lineTo(sw - 8, bottomY); torso.lineTo(-sw + 8, bottomY); torso.lineTo(-sw - 2, 104); torso.quadraticCurveTo(-sw, 62, -26, 58); torso.closePath();
    stripesClip(ctx, torso, p.shirt.color, p.shirt.stripe);
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(torso);
    if (p.shirt.heart) heart(ctx, 0, 130, 1.4, '#f39ab4', OL);
    if (p.apron) {
      const ap = new Path2D(); ap.moveTo(-30, 80); ap.lineTo(30, 80); ap.lineTo(34, bottomY); ap.lineTo(-34, bottomY); ap.closePath();
      ctx.fillStyle = p.apron; ctx.fill(ap); ctx.stroke(ap);
      ctx.beginPath(); ctx.moveTo(-30, 80); ctx.lineTo(-22, 58); ctx.moveTo(30, 80); ctx.lineTo(22, 58); ctx.lineWidth = 6; ctx.strokeStyle = p.apron; ctx.stroke();
    }
    if (p.cardigan) {
      [-1, 1].forEach((s) => {
        const c = new Path2D(); c.moveTo(s * 18, 58); c.quadraticCurveTo(s * sw, 62, s * (sw + 2), 104); c.lineTo(s * (sw - 8), bottomY); c.lineTo(s * 26, bottomY); c.lineTo(s * 10, 110); c.closePath();
        ctx.fillStyle = p.cardigan; ctx.fill(c); ctx.lineWidth = 3; ctx.strokeStyle = OL; ctx.stroke(c);
      });
    }
    if (p.coat) {
      const c = new Path2D(); c.moveTo(-30, 56); c.lineTo(30, 56); c.quadraticCurveTo(sw + 4, 60, sw + 8, 104);
      c.lineTo(sw + 26, waist + 70); c.lineTo(-sw - 26, waist + 70); c.lineTo(-sw - 8, 104); c.quadraticCurveTo(-sw - 4, 60, -30, 56); c.closePath();
      if (p.coat.dot) dots(ctx, c, p.coat.color, p.coat.dot); else { ctx.fillStyle = p.coat.color; ctx.fill(c); }
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(c);
      ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(0, waist + 66); ctx.stroke();
    }
    // 脖子
    rrect(ctx, -14, 42, 28, 22, 6); fillStroke(ctx, skin, 0);
    if (!p.armsFront) hands.forEach((h, i) => { hands[i] = drawArm(ctx, p, i ? 1 : -1, h, sleeve, skin); });
    // 頭
    [-1, 1].forEach((s) => { ell(ctx, s * 60, 6, 13, 16); fillStroke(ctx, skin, 3); });
    ell(ctx, 0, 0, 62, 58); fillStroke(ctx, skin, 3);
    drawFace(ctx, p, t);
    drawHairFront(ctx, p);
    drawHat(ctx, p.hat);
    if (p.armsFront) hands.forEach((h, i) => { hands[i] = drawArm(ctx, p, i ? 1 : -1, h, sleeve, skin); });
    if (p.thumb) { const h = hands[p.thumb > 0 ? 1 : 0]; rrect(ctx, h[0] - 5, h[1] - 30, 10, 22, 5); fillStroke(ctx, skin, 2.5); }
    ctx.restore();
    // 回傳手在畫面上的位置（拿東西用）
    const tx = (pt) => [x + pt[0] * sc, y + (p.bob || 0) + pt[1] * sc];
    return { hands: hands.map(tx) };
  }

  // ---------- 動物 ----------
  function sparrow(ctx, x, y, s, t, ph) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + ph) * 10); ctx.scale(s, s);
    const flap = Math.sin(t * 16 + ph) * 0.8;
    ctx.save(); ctx.rotate(-0.4 - flap); ell(ctx, -30, -10, 38, 14); fillStroke(ctx, '#8a5a3c', 2.5); ctx.restore();
    ell(ctx, 0, 0, 34, 24); fillStroke(ctx, '#a8714c', 2.5);
    ell(ctx, 6, 8, 20, 12); ctx.fillStyle = '#f3e6d6'; ctx.fill();
    ell(ctx, 26, -14, 20, 18); fillStroke(ctx, '#7a4a30', 2.5);
    ell(ctx, 30, -8, 9, 7); ctx.fillStyle = '#fff'; ctx.fill();
    ell(ctx, 32, -18, 3, 3); ctx.fillStyle = '#222'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(44, -14); ctx.lineTo(58, -10); ctx.lineTo(44, -6); fillStroke(ctx, '#f2b33d', 2);
    ctx.beginPath(); ctx.ellipse(24, -32, 26, 7, -0.1, 0, TAU); fillStroke(ctx, '#f3d34a', 2);
    ctx.beginPath(); ctx.arc(24, -33, 13, Math.PI, 0); fillStroke(ctx, '#f3d34a', 2);
    ctx.save(); ctx.rotate(0.3 + flap); ell(ctx, -26, -6, 36, 13); fillStroke(ctx, '#6d4429', 2.5); ctx.restore();
    ctx.beginPath(); ctx.moveTo(-30, 4); ctx.lineTo(-60, 0); ctx.lineTo(-56, 14); ctx.closePath(); fillStroke(ctx, '#6d4429', 2.5);
    ctx.restore();
  }
  function frog(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const breathe = Math.sin(t * 2) * 3;
    // 身體＋黃雨衣
    ctx.beginPath(); ctx.moveTo(-70, 20); ctx.quadraticCurveTo(-90, 120, -60, 150); ctx.lineTo(60, 150); ctx.quadraticCurveTo(90, 120, 70, 20); ctx.closePath(); fillStroke(ctx, '#f2cf3b', 3);
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, 150); ctx.stroke();
    // 腳
    [-1, 1].forEach((sd) => { ell(ctx, sd * 80, 150, 46, 18); fillStroke(ctx, '#7fbf5a', 3); });
    // 頭
    ell(ctx, 0, -10 + breathe * 0.3, 92, 56 + breathe); fillStroke(ctx, '#7fbf5a', 3);
    const o = blinkAt(t, 3.3, 0.7);
    [-1, 1].forEach((sd) => {
      ell(ctx, sd * 42, -54, 30, 30); fillStroke(ctx, '#7fbf5a', 3);
      ell(ctx, sd * 42, -52, 22, 22); fillStroke(ctx, '#ffffff', 2);
      ctx.save(); ell(ctx, sd * 42, -52, 22, 22); ctx.clip();
      ctx.fillStyle = '#7fbf5a'; ctx.fillRect(sd * 42 - 24, -76, 48, 22 * (1.3 - o * 0.4)); ctx.restore();
      ell(ctx, sd * 42 + 4, -46, 5, 5); ctx.fillStyle = '#222'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(sd * 42 - 22, -64 + (1 - o) * 10); ctx.lineTo(sd * 42 + 22, -60 + (1 - o) * 10); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0, -4, 40, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    // 帽子
    ctx.beginPath(); ctx.ellipse(10, -96, 110, 24, -0.12, 0, TAU); fillStroke(ctx, '#f2cf3b', 3);
    ctx.beginPath(); ctx.moveTo(-40, -96); ctx.bezierCurveTo(-36, -150, 60, -156, 64, -104); ctx.closePath(); fillStroke(ctx, '#f2cf3b', 3);
    ctx.restore();
  }
  function dog(ctx, x, y, s, t, mood) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const angry = mood === 'angry', wag = Math.sin(t * (angry ? 4 : 14)) * (angry ? 0.2 : 0.6);
    const lunge = angry ? Math.max(0, Math.sin(t * 5)) * 10 : 0;
    ctx.translate(lunge, 0);
    // 尾巴
    ctx.save(); ctx.translate(-80, -60); ctx.rotate(-0.6 + wag); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -40, -6, -70);
    ctx.strokeStyle = OL; ctx.lineWidth = 17; ctx.stroke(); ctx.strokeStyle = '#a07a5c'; ctx.lineWidth = 12; ctx.stroke(); ctx.restore();
    // 腳
    [[-60, 0], [-30, 0], [40, 0], [64, 0]].forEach(([lx]) => { rrect(ctx, lx - 11, -50, 22, 56, 9); fillStroke(ctx, '#a07a5c', 3); });
    // 身體
    ell(ctx, 0, -66, 92, 46); fillStroke(ctx, '#a07a5c', 3);
    // 項圈
    ctx.save(); ctx.translate(70, -96); ctx.rotate(0.5); rrect(ctx, -6, -24, 12, 48, 5); fillStroke(ctx, '#d8434a', 2); ctx.restore();
    // 頭
    ctx.save(); ctx.translate(96, -126); ctx.rotate(angry ? -0.05 : 0.15);
    ell(ctx, 0, 0, 50, 42); fillStroke(ctx, '#a07a5c', 3);
    ell(ctx, 46, 12, 30, 22); fillStroke(ctx, '#b48c6c', 3);
    ell(ctx, 72, 4, 10, 8); ctx.fillStyle = '#3a2a22'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-30, -26); ctx.quadraticCurveTo(-56, -40, -48, 4); ctx.quadraticCurveTo(-30, -4, -20, -20); fillStroke(ctx, '#7a5a40', 3);
    if (angry) {
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(4, -22); ctx.lineTo(30, -14); ctx.stroke();
      ell(ctx, 18, -8, 9, 7); fillStroke(ctx, '#fff', 2); ell(ctx, 20, -7, 4, 4); ctx.fillStyle = '#222'; ctx.fill();
      const open = 0.5 + 0.5 * Math.sin(t * 10);
      ctx.beginPath(); ctx.moveTo(20, 24); ctx.lineTo(76, 22); ctx.lineTo(70, 30 + open * 16); ctx.lineTo(24, 32 + open * 12); ctx.closePath(); fillStroke(ctx, '#7a2e2e', 3);
      ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(24 + i * 9, 24); ctx.lineTo(28 + i * 9, 32); ctx.lineTo(32 + i * 9, 24); ctx.fill(); }
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.globalAlpha = open;
      [[100, -10], [108, 16], [100, 40]].forEach(([bx, by]) => { ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 24, by + (by - 15) * 0.4); ctx.stroke(); });
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = OL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(14, -6, 9, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 26); ctx.quadraticCurveTo(50, 36, 70, 24); ctx.stroke();
      const tg = Math.sin(t * 8) * 4; ell(ctx, 52, 40 + tg, 10, 16 + tg); fillStroke(ctx, '#ef7b87', 2.5);
    }
    ctx.restore(); ctx.restore();
  }
  function penguin(ctx, x, y, s, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 5) * 0.12); ctx.scale(s, s);
    ell(ctx, 0, 0, 30, 44); fillStroke(ctx, '#2a2f3a', 2.5);
    ell(ctx, 0, 8, 20, 32); ctx.fillStyle = '#fff'; ctx.fill();
    ell(ctx, -8, -24, 4, 4); ell(ctx, 8, -24, 4, 4); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-6, -16); ctx.lineTo(6, -16); ctx.lineTo(0, -8); fillStroke(ctx, '#f2b33d', 1.5);
    ell(ctx, -12, 44, 12, 5); ell(ctx, 12, 44, 12, 5); ctx.fillStyle = '#f2b33d'; ctx.fill();
    ctx.restore();
  }

  // ---------- 道具 ----------
  function raincoatItem(ctx, x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    const c = new Path2D(); c.moveTo(-40, 0); c.lineTo(40, 0); c.lineTo(70, 40); c.lineTo(52, 54); c.lineTo(46, 36); c.lineTo(56, 170); c.lineTo(-56, 170); c.lineTo(-46, 36); c.lineTo(-52, 54); c.lineTo(-70, 40); c.closePath();
    dots(ctx, c, '#e8505b', '#ffffff', 22); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(c);
    ctx.beginPath(); ctx.moveTo(-40, 0); ctx.quadraticCurveTo(0, -40, 40, 0); fillStroke(ctx, '#d8434a', 3);
    ctx.restore();
  }
  function music(ctx, t, notes) {
    notes.forEach(([x, y, ch, col, ph]) => {
      const u = ((t * 0.35 + ph) % 1);
      ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI); ctx.fillStyle = col; ctx.strokeStyle = OL; ctx.lineWidth = 2;
      ctx.font = 'bold 76px serif'; ctx.translate(x + Math.sin(u * 6) * 14, y - u * 120); ctx.rotate(Math.sin(u * 5) * 0.2);
      ctx.fillText(ch, 0, 0); ctx.strokeText(ch, 0, 0); ctx.restore();
    });
  }
  function openBook(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    [-1, 1].forEach((sd) => {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sd * 150, -20); ctx.lineTo(sd * 150, 150); ctx.lineTo(0, 170); ctx.closePath(); fillStroke(ctx, '#a9d4ef', 3);
    });
    ctx.fillStyle = '#7fb85a'; ctx.beginPath(); ctx.moveTo(10, 140); ctx.quadraticCurveTo(70, 80, 140, 120); ctx.lineTo(140, 146); ctx.lineTo(10, 162); ctx.fill();
    ell(ctx, 100, 20, 18, 18); ctx.fillStyle = '#f7d54a'; ctx.fill();
    ctx.restore();
  }
  function clock(ctx, x, y, r, t) {
    ell(ctx, x, y, r, r); fillStroke(ctx, '#fff', 6, '#c9454c');
    ctx.strokeStyle = OL; ctx.lineWidth = 4;
    const m = t * 0.8, h = m / 12;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(h + 1) * r * 0.5, y - Math.cos(h + 1) * r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(m) * r * 0.75, y - Math.cos(m) * r * 0.75); ctx.stroke();
  }

  // ---------- 人物設定 ----------
  const MOM = () => ({ adult: true, hair: { style: 'bob', color: '#8a5432', clip: true }, shirt: { color: '#f4a9b8', stripe: '#fde2e8' }, apron: '#86b874', bottom: { type: 'skirt', color: '#3e56a3' }, shoes: '#f2a4b0', face: {} });
  const BOY = () => ({ hair: { style: 'boy', color: '#8a5432' }, shirt: { color: '#8eaee0', stripe: '#d4e0f5' }, sleeve: '#4a5f9e', bottom: { type: 'pants', color: '#33457a' }, shoes: '#f2a4b0', face: {} });
  const TEACHER = () => ({ adult: true, hair: { style: 'long', color: '#4a3328' }, shirt: { color: '#f3e3e3' }, cardigan: '#b8383f', sleeve: '#b8383f', bottom: { type: 'skirt', color: '#4a3a34', pleat: true }, shoes: '#3a3a3a', face: {} });

  // 共用：房間（下雨了 r2/r6）
  function buildRainRoom(S) {
    return layer(S, (g) => {
      room(g, ['#f8e6a6', '#fbeec6'], '#f1ece2', 660);
      rainWindow(g, 330, 110, 520, 430, { frame: '#ffffff' });
      g.strokeStyle = '#7a5236'; g.lineWidth = 10; g.beginPath(); g.moveTo(290, 80); g.lineTo(900, 80); g.stroke();
      for (let x = 340; x < 860; x += 60) { g.beginPath(); g.arc(x, 82, 8, 0, TAU); g.lineWidth = 4; g.stroke(); }
      // 衣架
      g.strokeStyle = '#7a5236'; g.lineWidth = 12; g.beginPath(); g.moveTo(110, 760); g.lineTo(110, 160); g.moveTo(110, 220); g.lineTo(70, 170); g.moveTo(110, 240); g.lineTo(150, 190); g.stroke();
    });
  }

  // ======================================================================
  // 下雨了
  // ======================================================================
  const rainA = makeRain(70, 11), rainB = makeRain(45, 12, 0.15);

  list.r1 = {
    bg: '#d4d1dc',
    build(S) {
      this.back = layer(S, (g) => {
        bricks(g, 0, 0, W, H);
        g.fillStyle = '#7a5236'; g.fillRect(560, 120, 480, 440);
        const gr = g.createLinearGradient(0, 140, 0, 540); gr.addColorStop(0, '#f8e7b0'); gr.addColorStop(1, '#fdf3d6');
        g.fillStyle = gr; g.fillRect(582, 142, 436, 396);
        bush(g, 90, 840, 1.2, 5); bush(g, 1150, 860, 1.1, 6);
      });
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(582, 142, 436, 396); ctx.clip();
      const surprised = t < 2.2;
      person(ctx, 790, 330, 1.25, Object.assign(MOM(), {
        hands: [[-70, 330], [150, 30 + Math.sin(t * 2) * 6]],
        face: { mouth: surprised ? 'o' : 'smile', eyes: surprised ? 'wide' : 'open', look: [0.3, 0], talk: surprised },
      }), t);
      curtain(ctx, 930, 142, 90, 396, '#c9454c', Math.sin(t * 2) * 6);
      ctx.restore();
      rainA(ctx, t);
      sparrow(ctx, 230, 180, 1.1, t, 0); sparrow(ctx, 360, 260, 1.0, t, 1.7);
    },
  };

  list.r2 = {
    bg: '#f8e6a6',
    build(S) { this.back = buildRainRoom(S); },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(337, 117, 506, 416); ctx.clip(); rainB(ctx, t, 0.8); ctx.restore();
      raincoatItem(ctx, 112, 190, 0.9, Math.sin(t * 1.5) * 0.04);
      curtain(ctx, 300, 84, 130, 560, '#c9454c', Math.sin(t * 2) * 5);
      person(ctx, 520, 290, 1.05, Object.assign(MOM(), {
        full: true, hands: [[-150, 130], [70, 260]], face: { look: [0.8, 0.3] },
      }), t);
      const walk = seg(t, 0, 2.2), stride = walk < 1 ? Math.sin(t * 8) * 0.35 : 0;
      person(ctx, 1040 - walk * 160, 455 - Math.abs(stride) * 10, 0.95, Object.assign(BOY(), {
        full: true, legs: [stride, -stride], hands: [[-60, 200 - stride * 30], [60, 200 + stride * 30]],
        face: { mouth: walk >= 1 ? 'o' : 'smile', look: [-0.9, -0.6], talk: walk >= 1 && t < 4.5 },
      }), t);
    },
  };

  list.r3 = {
    bg: '#dcdde6',
    build(S) {
      this.back = layer(S, (g) => {
        skyGrad(g, '#cfd5e2', '#eceef3', 600);
        g.fillStyle = '#e6c9cc'; g.fillRect(620, 120, 600, 480);
        g.fillStyle = '#ffffff'; g.fillRect(900, 300, 90, 70); g.strokeStyle = '#c8b6b9'; g.lineWidth = 4; g.strokeRect(900, 300, 90, 70);
        bricks(g, 0, 240, 640, 600, { bw: 80, bh: 36 });
        // 屋頂
        g.beginPath(); g.moveTo(-20, 250); g.lineTo(130, 60); g.lineTo(560, 60); g.lineTo(680, 250); g.closePath(); g.fillStyle = '#d68f98'; g.fill();
        g.strokeStyle = '#b86d78'; g.lineWidth = 3;
        for (let y = 80; y < 250; y += 28) for (let x = 0; x < 700; x += 40) { g.beginPath(); g.arc(x + ((y / 28) % 2) * 20, y, 18, 0, Math.PI); g.stroke(); }
        g.fillStyle = '#7a5236'; g.fillRect(270, 330, 230, 170);
        g.fillStyle = '#fdf3d6'; g.fillRect(284, 344, 202, 142);
        // 草叢、路
        for (let x = 0; x < W; x += 140) bush(g, x + 60, 620, 0.6, x + 1);
        g.fillStyle = '#b9bcc4'; g.fillRect(0, 610, W, 150);
        g.fillStyle = '#d8dbe2'; for (let x = 0; x < W; x += 160) g.fillRect(x + 30, 680, 80, 8);
        g.fillStyle = '#94bf72'; g.fillRect(0, 760, W, 80);
      });
      this.puddles = [[180, 650, 110, 18], [520, 720, 150, 22], [820, 640, 90, 14]];
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(284, 344, 202, 142); ctx.clip();
      person(ctx, 420, 410, 0.42, Object.assign(MOM(), { hands: [[-60, 300], [60, 300]], face: { look: [0.6, 0.4] } }), t);
      person(ctx, 330, 450, 0.32, Object.assign(BOY(), { hands: [[-60, 200], [80, -60 + Math.sin(t * 6) * 20]], face: { mouth: 'grin' } }), t);
      ctx.restore();
      curtain(ctx, 440, 344, 46, 142, '#c9454c');
      this.puddles.forEach(([x, y, rx, ry], i) => {
        ell(ctx, x, y, rx, ry); ctx.fillStyle = 'rgba(226,240,250,.85)'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.3 * Math.sin(t * 2 + i)) + ')'; ell(ctx, x - rx * 0.3, y - 3, rx * 0.4, ry * 0.25); ctx.fill();
      });
      ripples(ctx, t, [[180, 650, 0], [540, 720, 0.4], [480, 724, 0.75], [820, 640, 0.2]]);
      frog(ctx, 1010, 640, 0.95, t);
      rainA(ctx, t);
    },
  };

  list.r4 = {
    bg: '#f6ecd6',
    build(S) {
      this.back = layer(S, (g) => {
        skyGrad(g, '#bcc6d6', '#e3e8ef', 420);
        cloud(g, 80, 110, 1, '#f4f6fa'); cloud(g, 330, 180, 0.8, '#f4f6fa');
        g.fillStyle = '#9aa3b2'; g.beginPath(); g.moveTo(0, 330); g.lineTo(520, 260); g.lineTo(520, 330); g.lineTo(0, 400); g.fill();
        g.fillStyle = '#7fae5a'; g.beginPath(); g.moveTo(0, 420); g.quadraticCurveTo(300, 300, 520, 330); g.lineTo(520, 840); g.lineTo(0, 840); g.fill();
        bush(g, 450, 420, 0.9, 7); bush(g, 120, 520, 0.7, 8, false);
        g.fillStyle = '#e5e1d4'; g.beginPath(); g.moveTo(0, 700); g.lineTo(520, 560); g.lineTo(520, 840); g.lineTo(0, 840); g.fill();
        const r = rng(5); g.strokeStyle = '#4f8a3c'; g.lineWidth = 6;
        for (let i = 0; i < 40; i++) { const x = r() * 500, y = 600 + r() * 200; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 40, x + 20 * (r() - 0.3), y - 80); g.stroke(); }
        g.fillStyle = '#f6ecd6'; g.fillRect(520, 0, 680, H);
        g.fillStyle = '#d9cbb0'; g.fillRect(680, 0, 40, H);
        g.fillStyle = '#ffffff'; g.fillRect(505, 0, 30, H);
        g.fillStyle = '#c9b89a'; g.fillRect(520, 600, 220, 40);
      });
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 505, H); ctx.clip(); rainA(ctx, t, 0.85); ctx.restore();
      person(ctx, 870, 300, 1.75, Object.assign(BOY(), {
        hands: [[-150 + Math.sin(t * 1.5) * 6, 250], [-70, 262]], inward: [false, true], armsFront: false,
        face: { eyes: 'wide', mouth: 'o', look: [-0.9, 0.1], talk: t < 3 },
        tilt: Math.sin(t * 1.2) * 0.03,
      }), t);
    },
  };

  list.r5 = {
    bg: '#c9d3df',
    build(S) {
      this.back = layer(S, (g) => {
        skyGrad(g, '#b8c3d4', '#e6eaf0', 440);
        cloud(g, 120, 120, 1.2, '#f2f4f8'); cloud(g, 900, 90, 1, '#f2f4f8'); cloud(g, 600, 200, 0.7, '#f2f4f8');
        g.fillStyle = '#93bb73'; g.fillRect(0, 420, W, H - 420);
        g.fillStyle = '#a7c98a'; g.beginPath(); g.moveTo(0, 440); g.quadraticCurveTo(600, 380, 1200, 450); g.lineTo(1200, 470); g.lineTo(0, 470); g.fill();
        const r = rng(9); g.strokeStyle = '#5f8f48'; g.lineWidth = 5;
        for (let i = 0; i < 70; i++) { const x = r() * W, y = 470 + r() * 360; if (Math.hypot((x - 600) / 380, (y - 650) / 110) < 1) continue; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 20, y - 30 - r() * 40); g.stroke(); }
        ell(g, 600, 650, 380, 110); g.fillStyle = '#bcd9ec'; g.fill();
        ell(g, 600, 660, 300, 70); g.fillStyle = '#a3c8e2'; g.fill();
      });
      this.rain = makeRain(60, 21, 0.05);
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      const cyc = (t * 1.25) % 1, kickL = cyc < 0.5;
      const lift = Math.sin((cyc % 0.5) / 0.5 * Math.PI);
      const legs = kickL ? [-0.7 * lift, 0.05] : [-0.05, 0.7 * lift];
      ripples(ctx, t, [[560, 680, 0], [660, 650, 0.3], [480, 640, 0.6], [740, 690, 0.8]]);
      person(ctx, 600, 320 - lift * 20, 1.0, Object.assign(BOY(), {
        full: true, legs, coat: { color: '#f2cf3b' }, hat: { type: 'rain', color: '#f2cf3b' }, shoes: '#f2cf3b',
        hands: [[-100, 110 - lift * 30], [100, 110 + lift * 10]], face: { eyes: 'happy', mouth: 'tongue' }, tilt: (kickL ? 1 : -1) * lift * 0.06,
      }), t);
      // 水花
      if (lift < 0.35) {
        const fx = kickL ? 560 : 640, u = 1 - lift / 0.35;
        ctx.fillStyle = 'rgba(220,240,255,.9)'; ctx.strokeStyle = '#7fb3d8'; ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) { const a = -Math.PI * (0.15 + i * 0.12); ell(ctx, fx + Math.cos(a) * 90 * u, 650 + Math.sin(a) * 70 * u, 8, 12, a); ctx.fill(); ctx.stroke(); }
      }
      this.rain(ctx, t, 0.75);
    },
  };

  list.r6 = {
    bg: '#f8e6a6',
    build(S) { this.back = buildRainRoom(S); },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(337, 117, 506, 416); ctx.clip(); rainB(ctx, t, 0.8); ctx.restore();
      curtain(ctx, 300, 84, 130, 560, '#c9454c');
      const sway = Math.sin(t * 2) * 8;
      const m = person(ctx, 520, 290, 1.05, Object.assign(MOM(), {
        full: true, hands: [[-60 + sway * 0.3, 160], [60 + sway * 0.3, 160]], inward: [true, true], armsFront: true, face: { look: [0.8, 0.3], mouth: 'smile' },
      }), t);
      raincoatItem(ctx, (m.hands[0][0] + m.hands[1][0]) / 2, m.hands[0][1] - 10, 1.0, sway * 0.004);
      person(ctx, 880, 455, 0.95, Object.assign(BOY(), {
        full: true, hands: [[-50, 190], [60, 200]], face: { mouth: 'o', look: [-0.8, -0.7], talk: t < 3.5 }, tilt: Math.sin(t * 1.4) * 0.03,
      }), t);
    },
  };

  list.r7 = {
    bg: '#f8e6a6',
    build(S) {
      this.back = layer(S, (g) => {
        room(g, ['#f8e6a6', '#fbeec6'], '#f1ece2', 640);
        rainWindow(g, 560, 60, 560, 480, { frame: '#ffffff' });
        curtain(g, 0, 0, 220, 840, '#b8383f');
      });
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(567, 67, 546, 466); ctx.clip(); rainB(ctx, t, 0.8); ctx.restore();
      person(ctx, 360, 380, 1.9, Object.assign(MOM(), { hands: [[-70, 340], [70, 340]], face: { look: [0.9, 0.4], mouth: t < 3.5 ? 'talk' : 'smile', talk: t < 3.5 } }), t);
      const tw = Math.sin(t * 2.4);
      person(ctx, 900, 420, 1.05, Object.assign(BOY(), {
        full: true, coat: { color: '#e8505b', dot: '#ffffff' }, hands: [[-30, 150], [30, 150]], inward: [true, true],
        face: { eyes: 'open', mouth: 'grin', look: [-0.5, -0.3] }, tilt: tw * 0.06, legs: [tw * 0.08, -tw * 0.08],
      }), t);
    },
  };

  function hugScene(eyesMom) {
    return {
      bg: '#f6c4c8',
      build(S) {
        this.back = layer(S, (g) => {
          const gr = g.createRadialGradient(600, 420, 40, 600, 420, 800); gr.addColorStop(0, '#fde4e4'); gr.addColorStop(1, '#f1a9b0');
          g.fillStyle = gr; g.fillRect(0, 0, W, H);
          g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 26;
          for (let r = 140; r < 900; r += 120) { g.beginPath(); g.arc(600, 420, r, 0, TAU); g.stroke(); }
        });
        const r = rng(31); this.hearts = Array.from({ length: 12 }, () => [r() * W, r(), 0.7 + r() * 1.2]);
      },
      draw(ctx, t) {
        ctx.drawImage(this.back, 0, 0, W, H);
        this.hearts.forEach(([x, ph, s], i) => {
          const u = (t * 0.12 + ph) % 1;
          ctx.globalAlpha = Math.sin(u * Math.PI); heart(ctx, x + Math.sin(u * 8 + i) * 20, H + 40 - u * (H + 120), s * 1.6, null, '#e0606e');
        });
        ctx.globalAlpha = 1;
        const rock = Math.sin(t * 1.6) * 0.04;
        person(ctx, 470, 330, 1.75, Object.assign(MOM(), {
          hands: [[150, 250], [230, 200]], armsFront: false, tilt: rock,
          face: { eyes: eyesMom, look: [0.6, 0.6], mouth: 'smile' },
        }), t);
        person(ctx, 720, 470, 1.6, Object.assign(BOY(), {
          coat: { color: '#e8505b', dot: '#ffffff' }, hands: [[-170, 10], [-120, 120]], armsFront: true, tilt: -rock - 0.12,
          face: { eyes: 'closed', mouth: 'smile' },
        }), t);
        // 媽媽的手抱住弟弟
        ctx.save(); ctx.translate(470, 330); ctx.rotate(rock); ctx.scale(1.75, 1.75);
        ell(ctx, 220, 210, 15, 15); fillStroke(ctx, SKIN, 2.5); ctx.restore();
      },
    };
  }
  list.r8 = hugScene('open');
  list.r9 = hugScene('closed');
  list.rcover = list.r5;

  // ======================================================================
  // 看一看、想一想
  // ======================================================================
  function bustBg(build) { return { build(S) { this.back = layer(S, build); } }; }

  list.k1 = Object.assign(bustBg((g) => {
    g.fillStyle = '#486a4c'; g.fillRect(0, 0, W, 640);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
    for (let k = 0; k < 2; k++) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(40, 60 + k * 150 + i * 18); g.lineTo(420, 60 + k * 150 + i * 18); g.stroke(); }
    g.fillStyle = '#b08a5a'; g.fillRect(0, 630, W, 30);
    g.fillStyle = '#f1ece2'; g.fillRect(0, 660, W, 180);
    g.fillStyle = '#ffffff'; g.fillRect(120, 600, 90, 22); g.fillStyle = '#e8a35a'; g.fillRect(120, 590, 90, 14);
  }), {
    bg: '#486a4c',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      music(ctx, t, [[200, 300, '♫', '#f6d34a', 0], [880, 260, '♪', '#f59ac0', 0.35], [1000, 520, '♪', '#ffd27a', 0.7], [150, 600, '♩', '#f59ac0', 0.55]]);
      const bob = Math.sin(t * 5) * 6;
      person(ctx, 600, 300 + bob, 2.0, Object.assign(BOY(), {
        hair: { style: 'boy', color: '#7a4a2c' }, shirt: { color: '#c9393f' }, sleeve: '#c9393f',
        hands: [[-150, 250], [150, 250]], face: { eyes: 'happy', mouth: 'grin' }, tilt: Math.sin(t * 2.5) * 0.04,
      }), t);
      openBook(ctx, 600, 690 + bob, 1.5);
    },
  });

  list.k2 = Object.assign(bustBg((g) => {
    skyGrad(g, '#a9d4ef', '#e8f4fb', 560);
    cloud(g, 120, 90, 1.1); cloud(g, 900, 120, 1);
    g.fillStyle = '#e7dfcf'; g.fillRect(0, 560, W, 280);
    g.strokeStyle = '#3e6fb5'; g.lineWidth = 14; g.beginPath(); g.moveTo(40, 600); g.lineTo(80, 260); g.lineTo(300, 260); g.lineTo(340, 600); g.stroke();
    g.lineWidth = 3; g.strokeStyle = '#666'; g.beginPath(); g.moveTo(150, 262); g.lineTo(150, 450); g.moveTo(220, 262); g.lineTo(220, 450); g.stroke();
    g.fillStyle = '#7a5236'; g.fillRect(138, 450, 94, 14);
    g.fillStyle = '#e8b04a'; g.beginPath(); g.moveTo(880, 600); g.lineTo(1080, 330); g.lineTo(1110, 350); g.lineTo(920, 610); g.fill();
    g.fillStyle = '#d0504e'; g.fillRect(1060, 300, 140, 300); g.strokeStyle = '#3e6fb5'; g.lineWidth = 10; g.strokeRect(1080, 200, 100, 100);
  }), {
    bg: '#a9d4ef',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      const sob = Math.abs(Math.sin(t * 4)) * 6;
      const p = person(ctx, 600, 300 - sob, 2.0, {
        hair: { style: 'pony', color: '#b88a5c', bow: '#6fa8dc' }, shirt: { color: '#fbefb8', heart: true }, sleeve: '#fbefb8', cuff: '#f39ab4',
        hands: [[-28, -4], [70, 300]], armsFront: true, face: { eyes: 'squeeze', mouth: 'cry', tears: true, brows: 'worried' },
      }, t);
      // 手帕
      const [hx, hy] = p.hands[0];
      ctx.beginPath(); ctx.moveTo(hx - 34, hy - 44); ctx.lineTo(hx + 22, hy - 36); ctx.lineTo(hx + 18, hy + 30); ctx.lineTo(hx - 28, hy + 24); ctx.closePath(); fillStroke(ctx, '#f4f4fa', 3);
    },
  });

  list.k3 = Object.assign(bustBg((g) => {
    skyGrad(g, '#7fc3ec', '#d9effa', 600);
    cloud(g, 700, 120, 0.9); cloud(g, 1000, 220, 0.7);
    g.fillStyle = '#f0d49a'; g.fillRect(0, 600, W, 240);
    g.beginPath(); g.moveTo(860, 640); g.lineTo(1040, 400); g.lineTo(1200, 640); g.closePath(); fillStroke(g, '#e9be6a', 3);
    g.strokeStyle = 'rgba(150,100,40,.5)'; g.lineWidth = 2;
    for (let y = 440; y < 640; y += 30) { g.beginPath(); g.moveTo(1040 - (y - 400) * 0.75, y); g.lineTo(1040 + (y - 400) * 0.67, y); g.stroke(); }
    g.strokeStyle = '#4a4a4a'; g.lineWidth = 3;
    [[420, 180], [460, 160], [900, 300]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x - 7, y - 8, x, y); g.quadraticCurveTo(x + 7, y - 8, x + 14, y); g.stroke(); });
  }), {
    bg: '#7fc3ec',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      // 太陽
      ctx.save(); ctx.translate(90, 90); ctx.rotate(t * 0.3);
      for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(110, -16); ctx.lineTo(190 + Math.sin(t * 3 + i) * 14, 0); ctx.lineTo(110, 16); ctx.fillStyle = '#f39a3a'; ctx.fill(); }
      ell(ctx, 0, 0, 110, 110); ctx.fillStyle = '#f7b84a'; ctx.fill(); ctx.restore();
      const p = person(ctx, 600, 300, 2.0, {
        skin: '#9a6644', hair: { style: 'curly', color: '#3a2a22' }, shirt: { color: '#fafafa' }, sleeve: '#9a6644',
        hands: [[-150, 230], [110, 240]], face: { brows: 'worried', mouth: 'teeth', sweat: true, look: [0, 0] },
      }, t);
      // 扇子
      const [fx, fy] = p.hands[0], fa = -0.8 + Math.sin(t * 9) * 0.35;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(fa);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 170, -Math.PI * 0.85, -Math.PI * 0.15); ctx.closePath(); fillStroke(ctx, '#a9d68a', 3);
      ctx.strokeStyle = '#6d9a52'; ctx.lineWidth = 2; for (let a = -0.85; a <= -0.15; a += 0.07) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a * Math.PI) * 168, Math.sin(a * Math.PI) * 168); ctx.stroke(); }
      ctx.restore();
      // 冰棒
      const [ix, iy] = p.hands[1];
      rrect(ctx, ix - 6, iy - 10, 12, 60, 4); fillStroke(ctx, '#e8c68a', 2);
      rrect(ctx, ix - 40, iy - 180, 80, 170, 34); fillStroke(ctx, '#f07a9a', 3);
      ctx.fillStyle = '#fbd0dc'; [[-14, -150], [12, -110], [-6, -70]].forEach(([dx, dy]) => { ell(ctx, ix + dx, iy + dy, 9, 14); ctx.fill(); });
      const d = (t * 0.8) % 1; ctx.globalAlpha = 1 - d; ell(ctx, ix + 30, iy - 10 + d * 80, 7, 10); ctx.fillStyle = '#f07a9a'; ctx.fill(); ctx.globalAlpha = 1;
    },
  });

  list.k4 = Object.assign(bustBg((g) => {
    skyGrad(g, '#1c2a5a', '#3a4f8a', 640);
    g.fillStyle = '#eef3fa'; g.fillRect(0, 620, W, 220);
    ell(g, 220, 640, 200, 150); g.save(); g.beginPath(); g.rect(0, 0, W, 640); g.clip(); fillStroke(g, '#f4f7fb', 3, '#b9c3d6');
    g.strokeStyle = '#c3cce0'; g.lineWidth = 3;
    for (let y = 520; y < 640; y += 40) { g.beginPath(); g.moveTo(40, y); g.lineTo(400, y); g.stroke(); }
    g.restore();
    ell(g, 360, 620, 50, 60); g.fillStyle = '#6a7892'; g.fill();
  }), {
    bg: '#1c2a5a',
    build(S) {
      this.back = list.k4._b(S);
      const r = rng(41); this.snow = Array.from({ length: 50 }, () => [r() * W, r() * H, 6 + r() * 10, 20 + r() * 40]);
    },
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      // 極光
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      [['rgba(90,220,160,.28)', 120, 0], ['rgba(120,200,240,.22)', 200, 1.5]].forEach(([c, y0, ph]) => {
        ctx.beginPath(); ctx.moveTo(0, y0);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.006 + t * 0.8 + ph) * 60);
        for (let x = W; x >= 0; x -= 40) ctx.lineTo(x, y0 + 120 + Math.sin(x * 0.005 + t * 0.6 + ph) * 70);
        ctx.fillStyle = c; ctx.fill();
      });
      ctx.restore();
      penguin(ctx, 1080, 640, 1.1, t);
      const p = person(ctx, 620, 320, 1.95, {
        skin: '#f8dcc8', hair: { style: 'hood' }, shirt: { color: '#2f4f9a' }, sleeve: '#2f4f9a', cuff: '#ffffff',
        hands: [[56, 170], [-56, 170]], inward: [true, true], armsFront: true, shake: 2.2,
        face: { brows: 'worried', mouth: 'chatter', look: [0, 0] },
      }, t);
      // 發抖線
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12);
      [[-1, 360], [1, 840]].forEach(([s, x]) => { for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + s * i * 26, 470, 60 + i * 20, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); ctx.stroke(); } });
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      this.snow.forEach(([x, y, r, v]) => { const yy = (y + t * v) % H; ell(ctx, x + Math.sin(t + y) * 20, yy, r, r); ctx.fill(); });
    },
  });
  list.k4._b = (S) => layer(S, (g) => {
    skyGrad(g, '#1c2a5a', '#3a4f8a', 640);
    g.fillStyle = '#eef3fa'; g.fillRect(0, 620, W, 220);
    g.save(); g.beginPath(); g.rect(0, 0, W, 640); g.clip(); ell(g, 220, 640, 200, 150); fillStroke(g, '#f4f7fb', 3, '#b9c3d6');
    g.strokeStyle = '#c3cce0'; g.lineWidth = 3; for (let y = 520; y < 640; y += 40) { g.beginPath(); g.moveTo(40, y); g.lineTo(400, y); g.stroke(); }
    g.restore();
    g.beginPath(); g.ellipse(360, 640, 50, 60, 0, Math.PI, TAU); g.fillStyle = '#6a7892'; g.fill();
  });

  function classroom(g, wall) {
    room(g, wall, '#e9e6df', 640);
  }
  list.k5 = Object.assign(bustBg((g) => {
    classroom(g, ['#e3ece4', '#f1f4ee']);
    g.fillStyle = '#3f5c45'; g.fillRect(0, 120, 420, 360); g.strokeStyle = '#b08a5a'; g.lineWidth = 12; g.strokeRect(0, 120, 420, 360);
    g.fillStyle = '#d9cfc2'; g.fillRect(500, 60, 150, 560);
    rrect(g, 940, 90, 240, 560, 6); fillStroke(g, '#e9a35a', 4);
    ell(g, 970, 380, 10, 10); fillStroke(g, '#cfcfcf', 2);
  }), {
    bg: '#e3ece4',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      const sweep = Math.sin(t * 4);
      const b = person(ctx, 370, 470, 1.0, {
        full: true, hair: { style: 'blond', color: '#ecc76a' }, shirt: { color: '#fafafa', stripe: '#6a86c4' }, coat: { color: '#f2cf3b' },
        bottom: { type: 'pants', color: '#2e3d6b' }, shoes: '#d8434a',
        hands: [[40 + sweep * 10, 100], [20 + sweep * 20, 190]], inward: [true, false], armsFront: true,
        face: { eyes: 'happy', mouth: 'grin' },
      }, t);
      // 掃把
      const [h1x, h1y] = b.hands[0];
      const bx = 220 + sweep * 50, by = 790;
      ctx.lineCap = 'round'; ctx.strokeStyle = OL; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(h1x + 30, h1y - 60); ctx.lineTo(bx, by - 40); ctx.stroke();
      ctx.strokeStyle = '#b8383f'; ctx.lineWidth = 9; ctx.stroke();
      ctx.save(); ctx.translate(bx, by - 30); ctx.rotate(-0.35 + sweep * 0.1); rrect(ctx, -60, -12, 120, 24, 4); fillStroke(ctx, '#3e6fb5', 3);
      ctx.strokeStyle = '#e8d08a'; ctx.lineWidth = 4; for (let x = -54; x <= 54; x += 9) { ctx.beginPath(); ctx.moveTo(x, 12); ctx.lineTo(x * 1.1, 40); ctx.stroke(); } ctx.restore();
      const thumbBob = Math.sin(t * 3) * 6;
      const tch = person(ctx, 830, 330, 1.0, Object.assign(TEACHER(), {
        full: true, hands: [[-190, 150 + thumbBob], [70, 270]], thumb: -1, face: { mouth: 'smile', look: [-0.9, 0.3] },
      }), t);
      const [gx, gy] = tch.hands[1]; rrect(ctx, gx - 10, gy - 40, 30, 90, 4); fillStroke(ctx, '#5a9a5a', 3);
    },
  });

  list.k6 = Object.assign(bustBg((g) => {
    classroom(g, ['#f8eeb8', '#fbf4d6']);
    g.fillStyle = '#e7e2d6'; g.fillRect(0, 60, 160, 580); g.strokeStyle = '#c9c0ae'; g.lineWidth = 4; g.strokeRect(0, 60, 160, 580);
    g.fillStyle = '#d9c9a8'; g.fillRect(560, 200, 300, 130); g.strokeStyle = '#a88f66'; g.strokeRect(560, 200, 300, 130);
    for (let x = 580; x < 850; x += 70) { g.fillStyle = '#8a6a4a'; g.fillRect(x, 220, 50, 90); }
  }), {
    bg: '#f8eeb8',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      clock(ctx, 1080, 120, 62, t);
      person(ctx, 430, 360, 1.25, Object.assign(TEACHER(), {
        hands: [[-150, 230], [210, 170 + Math.sin(t * 6) * 10]], face: { brows: 'angry', mouth: 'talk', talk: true, look: [0.9, 0] },
      }), t);
      // 桌子
      ctx.beginPath(); ctx.moveTo(0, 620); ctx.lineTo(620, 620); ctx.lineTo(560, 840); ctx.lineTo(0, 840); ctx.closePath(); fillStroke(ctx, '#d8a466', 3);
      ctx.fillStyle = '#b8824a'; ctx.fillRect(0, 620, 620, 22);
      rrect(ctx, 80, 560, 50, 64, 6); fillStroke(ctx, '#8fc4e8', 3);
      ['#e8505b', '#f2cf3b', '#5a9a5a'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(95 + i * 10, 560); ctx.lineTo(90 + i * 14, 520); ctx.stroke(); });
      rrect(ctx, 180, 680, 150, 120, 6); fillStroke(ctx, '#6fa8dc', 3);
      person(ctx, 880, 470, 0.95, {
        full: true, hair: { style: 'long', color: '#2a2a32' }, shirt: { color: '#f9c9d4' }, bottom: { type: 'skirt', color: '#5d7fc4' }, shoes: '#6a6ab8',
        hands: [[-50, 200], [50, 200]], inward: [true, true], face: { mouth: 'frown', brows: 'worried', look: [-0.4, 0.8] }, tilt: Math.sin(t * 1.3) * 0.02,
      }, t);
    },
  });

  list.k7 = Object.assign(bustBg((g) => {
    room(g, ['#cfe4f2', '#e8f2f8'], '#eae4da', 640);
    g.fillStyle = '#5a3a2a'; g.fillRect(0, 0, 200, 640);
    g.fillStyle = '#bfe0f5'; g.fillRect(760, 60, 400, 330); g.strokeStyle = '#ffffff'; g.lineWidth = 14; g.strokeRect(760, 60, 400, 330);
    g.fillStyle = '#8fc27a'; g.beginPath(); g.moveTo(760, 390); g.lineTo(880, 250); g.lineTo(980, 330); g.lineTo(1060, 230); g.lineTo(1160, 390); g.fill();
  }), {
    bg: '#cfe4f2',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      ell(ctx, 1100, 110, 30, 30); ctx.fillStyle = '#f7c84a'; ctx.fill();
      const pull = Math.sin(t * 3) * 14;
      person(ctx, 700, 330, 1.45, {
        hair: { style: 'boy', color: '#4a3328' }, hat: { type: 'bucket', color: '#8a8a5a' }, shirt: { color: '#ee7a3a' }, sleeve: '#ee7a3a',
        hands: [[-130 + pull, 230], [-30 + pull, 250]], face: { mouth: 'grin', look: [-0.6, 0.6] },
      }, t);
      // 登山杖
      ctx.lineCap = 'round';
      [[480, 300, 560, 720], [520, 280, 600, 720]].forEach(([x1, y1, x2, y2]) => { ctx.strokeStyle = OL; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 7; ctx.stroke(); });
      // 背包
      ctx.beginPath(); ctx.moveTo(380, 520); ctx.quadraticCurveTo(560, 470, 720, 520); ctx.lineTo(740, 800); ctx.lineTo(360, 800); ctx.closePath(); fillStroke(ctx, '#d6a26a', 3);
      ctx.beginPath(); ctx.moveTo(400, 530); ctx.quadraticCurveTo(560, 590, 700, 530); ctx.lineTo(690, 500); ctx.quadraticCurveTo(560, 450, 410, 500); ctx.closePath(); fillStroke(ctx, '#2a2a32', 3);
      ctx.fillStyle = '#5aa060'; ctx.fillRect(450, 480 - pull * 0.3, 60, 40); ctx.fillStyle = '#e8505b'; ctx.fillRect(560, 470 - pull * 0.3, 40, 50);
      rrect(ctx, 460, 640, 180, 110, 18); fillStroke(ctx, '#c28a52', 3);
      rrect(ctx, 535, 660, 30, 40, 4); fillStroke(ctx, '#e9c36a', 2);
      rrect(ctx, 330, 600, 44, 120, 14); fillStroke(ctx, '#bfe0f5', 3);
      // 手套
      ctx.save(); ctx.translate(960, 760); ctx.rotate(0.4); rrect(ctx, -40, -26, 80, 52, 18); fillStroke(ctx, '#ee7a3a', 3); ctx.restore();
    },
  });

  list.k8 = Object.assign(bustBg((g) => {
    room(g, ['#f6d6e8', '#fbe8f2'], '#f3cde0', 600);
    g.fillStyle = '#ffffff'; g.fillRect(0, 300, 260, 300); g.strokeStyle = '#e0d0d8'; g.lineWidth = 4;
    for (let y = 340; y < 600; y += 70) { g.strokeRect(10, y, 240, 60); g.beginPath(); g.moveTo(110, y + 30); g.lineTo(150, y + 30); g.stroke(); }
    g.fillStyle = '#bfe0f5'; g.fillRect(40, 40, 360, 220); g.fillStyle = '#9ac98a'; g.beginPath(); g.moveTo(40, 260); g.lineTo(160, 160); g.lineTo(260, 220); g.lineTo(400, 140); g.lineTo(400, 260); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(40, 40, 360, 220);
  }), {
    bg: '#f6d6e8',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      // 泳圈
      ctx.save(); ctx.translate(830, 470); ctx.rotate(Math.sin(t * 2) * 0.08);
      const ring = new Path2D(); ring.ellipse(0, 0, 150, 160, 0, 0, TAU); ring.ellipse(0, 0, 70, 80, 0, 0, TAU);
      ctx.fillStyle = '#ef6f8a'; ctx.fill(ring, 'evenodd'); ctx.save(); ctx.clip(ring, 'evenodd'); ctx.fillStyle = '#ffffff';
      for (let a = 0; a < TAU; a += 0.5) { ell(ctx, Math.cos(a) * 112, Math.sin(a) * 120, 10, 10); ctx.fill(); } ctx.restore();
      ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(ring); ctx.restore();
      // 包包
      rrect(ctx, 900, 620, 260, 150, 50); fillStroke(ctx, '#7a5aa8', 3);
      ctx.beginPath(); ctx.moveTo(960, 630); ctx.quadraticCurveTo(1030, 540, 1100, 630); ctx.strokeStyle = OL; ctx.lineWidth = 10; ctx.stroke();
      const wave = Math.sin(t * 3) * 8;
      const p = person(ctx, 460, 330, 1.45, {
        hair: { style: 'bob', color: '#2a2a32' }, shirt: { color: '#f8e29a' }, sleeve: '#6fa8dc',
        hands: [[200 + wave, 170], [-80, 300]], face: { mouth: 'grin', look: [0.8, 0.3] },
      }, t);
      // 泳衣
      const [sx, sy] = p.hands[0];
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(wave * 0.01);
      const suit = new Path2D(); suit.moveTo(-34, 0); suit.lineTo(34, 0); suit.lineTo(44, 120); suit.lineTo(10, 200); suit.lineTo(-10, 200); suit.lineTo(-44, 120); suit.closePath();
      dots(ctx, suit, '#c8b6e8', '#ffffff', 22); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(suit); ctx.restore();
      // 蛙鏡、毛巾
      ctx.strokeStyle = OL; ctx.lineWidth = 4; ell(ctx, 680, 760, 34, 22); fillStroke(ctx, '#bfe0f5', 4); ell(ctx, 760, 760, 34, 22); fillStroke(ctx, '#bfe0f5', 4);
      ctx.beginPath(); ctx.moveTo(714, 760); ctx.lineTo(726, 760); ctx.stroke();
      rrect(ctx, 120, 680, 240, 90, 20); fillStroke(ctx, '#fff6dc', 3);
    },
  });

  function dogYard(g) {
    skyGrad(g, '#cfe8f5', '#eef7fb', 300);
    bush(g, 1120, 200, 1.1, 9, false);
    g.fillStyle = '#c9584e'; g.fillRect(0, 70, 760, 40);
    bricks(g, 0, 110, 1200, 680, { colors: ['#f4f2ee', '#ecebe6', '#f8f7f4', '#e8e6e0'], mortar: '#cfcac0', bw: 140, bh: 70 });
    g.fillStyle = '#3a3a40'; g.fillRect(40, 190, 230, 490);
    g.fillStyle = '#e8e4dc'; g.fillRect(0, 680, W, 160);
  }
  function gate(ctx, x, y) {
    ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.fillStyle = '#fafafa';
    rrect(ctx, x, y, 200, 380, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d8d8dc'; for (let i = 1; i < 6; i++) ctx.fillRect(x + i * 33 - 4, y + 20, 8, 340);
  }
  list.k9 = Object.assign(bustBg(dogYard), {
    bg: '#f4f2ee',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      gate(ctx, 300, 300);
      dog(ctx, 280, 760, 1.15, t, 'angry');
      person(ctx, 860, 455, 1.0, {
        full: true, hair: { style: 'boy', color: '#4a3328' }, hat: { type: 'cap', color: '#4f86c6' }, shirt: { color: '#f4d34a' }, sleeve: '#f4d34a',
        bottom: { type: 'shorts', color: '#8a8a92' }, shoes: '#3e56a3', legs: [0.15, -0.1],
        hands: [[-120, 40], [-90, 140]], inward: [false, true], tilt: 0.14, shake: 1.5,
        face: { eyes: 'wide', mouth: 'teeth', brows: 'worried', look: [-1, 0.3] },
      }, t);
    },
  });
  list.k10 = Object.assign(bustBg(dogYard), {
    bg: '#f4f2ee',
    draw(ctx, t) {
      ctx.drawImage(this.back, 0, 0, W, H);
      gate(ctx, 640, 300);
      dog(ctx, 360, 770, 1.1, t, 'happy');
      const pat = Math.sin(t * 4) * 10;
      person(ctx, 720, 450, 1.0, {
        full: true, hair: { style: 'pony', color: '#2a2a32' }, shirt: { color: '#fafafa' }, sleeve: '#fafafa', bottom: { type: 'pants', color: '#b8383f' }, shoes: '#3a3a40',
        hands: [[-190, 190 + pat], [60, 220]], tilt: -0.12, face: { eyes: 'happy', mouth: 'smile', look: [-1, 0.5] },
      }, t);
      // 側背包
      ell(ctx, 790, 680, 40, 36); fillStroke(ctx, '#ee9a4a', 3);
    },
  });
  list.kcover = list.k1;
})();
