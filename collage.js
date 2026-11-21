// 拼貼風：原書人物剪下來（app/img/cut/，tools/make_cutouts.py 產生）＋電腦畫的剪紙背景。人物可以整個跳、晃、抖、衝。
// 下雨了、看一看想一想的所有場景都在這裡（舊的原畫版 photo.js 在 archive/）。
(function () {
  const { W, H, list } = window.Scenes;
  const TAU = Math.PI * 2;

  // ---------- 圖 ----------
  const cache = {};
  function img(src) {
    if (!cache[src]) {
      const i = new Image();
      cache[src] = { i, p: new Promise((r) => { i.onload = () => i.decode().then(r, r); i.onerror = r; }) };
      i.src = src;
    }
    return cache[src];
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function layer(S, draw) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * S); c.height = Math.round(H * S);
    const g = c.getContext('2d'); g.scale(S, S); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g);
    return c;
  }

  // ---------- 紙 ----------
  // 紙紋：小塊雜點＋纖維，做成 pattern 疊在每張色紙上
  let paperPat = null;
  function paperPattern(g) {
    if (paperPat) return g.createPattern(paperPat, 'repeat');
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const p = c.getContext('2d'), r = rng(77);
    for (let i = 0; i < 2600; i++) {
      const v = r() < 0.5 ? 255 : 0; p.fillStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.05})`;
      p.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
    }
    p.lineWidth = 0.7;
    for (let i = 0; i < 90; i++) {
      p.strokeStyle = `rgba(255,255,255,${0.08 + r() * 0.1})`;
      const x = r() * 256, y = r() * 256, a = r() * TAU, l = 6 + r() * 16;
      p.beginPath(); p.moveTo(x, y); p.quadraticCurveTo(x + Math.cos(a + 1) * l * 0.5, y + Math.sin(a + 1) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke();
    }
    paperPat = c;
    return g.createPattern(c, 'repeat');
  }
  // 一張剪下來的色紙：路徑＋陰影＋紙紋
  function paper(g, path, color, o = {}) {
    g.save();
    g.shadowColor = o.shadow || 'rgba(40,30,20,.28)'; g.shadowBlur = o.blur == null ? 10 : o.blur; g.shadowOffsetY = o.dy == null ? 4 : o.dy;
    g.fillStyle = color; g.fill(path); g.restore();
    g.save(); g.clip(path); g.fillStyle = paperPattern(g); g.fillRect(-50, -50, W + 100, H + 100);
    if (o.edge !== false) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.stroke(path); }
    g.restore();
  }
  // 剪刀剪的邊：多邊形點加一點抖動
  function wobbly(pts, seed, amt = 3) {
    const r = rng(seed), p = new Path2D();
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 40));
      for (let k = 0; k < n; k++) { const u = k / n; out.push([ax + (bx - ax) * u + (r() - 0.5) * amt * 2, ay + (by - ay) * u + (r() - 0.5) * amt * 2]); }
    }
    out.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath();
    return p;
  }
  function blob(cx, cy, rx, ry, seed, bumps = 14, amt = 0.12) {
    const r = rng(seed), p = new Path2D();
    for (let i = 0; i <= bumps; i++) {
      const a = (i / bumps) * TAU, k = 1 + (r() - 0.5) * amt * 2;
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    }
    p.closePath(); return p;
  }
  function cloudPath(x, y, s, seed) {
    const p = new Path2D(), r = rng(seed);
    [[0, 0, 46], [44, -18, 40], [86, 0, 36], [-40, 8, 32], [30, 14, 40]].forEach(([dx, dy, rr]) => {
      p.moveTo(x + (dx + rr) * s, y + dy * s); p.arc(x + dx * s, y + dy * s, rr * s * (0.92 + r() * 0.16), 0, TAU);
    });
    return p;
  }
  function wave(x0, x1, y, amp, len, bottom, seed) {
    const r = rng(seed), p = new Path2D(); p.moveTo(x0, bottom); p.lineTo(x0, y);
    for (let x = x0; x <= x1 + len; x += len) p.quadraticCurveTo(x + len / 2, y - amp * (0.6 + r() * 0.8), x + len, y + (r() - 0.5) * amp * 0.4);
    p.lineTo(x1, bottom); p.closePath(); return p;
  }
  function grassTuft(g, x, y, s, col, seed) {
    const r = rng(seed), p = new Path2D();
    p.moveTo(x - 30 * s, y);
    for (let i = 0; i < 6; i++) { const bx = x - 30 * s + i * 12 * s; p.lineTo(bx + 4 * s, y - (40 + r() * 50) * s); p.lineTo(bx + 10 * s, y); }
    p.closePath(); paper(g, p, col, { blur: 6, dy: 2 });
  }

  // ---------- 貼紙人物 ----------
  // 底部中心 (x,y)，高 h；rot 以腳底為支點；sx/sy 擠壓
  function sticker(ctx, key, x, y, h, o = {}) {
    const c = img('img/cut/' + key + '.webp'), i = c.i;
    if (!i.naturalWidth) return;
    const w = h * i.naturalWidth / i.naturalHeight;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale((o.flip ? -1 : 1) * (o.sx || 1), o.sy || 1);
    ctx.shadowColor = 'rgba(40,30,20,.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 8;
    ctx.drawImage(i, -w / 2, -h, w, h); ctx.restore();
  }
  // 貼紙上的相對位置 (u,v)（0~1，左上原點）→ 畫面座標（不含旋轉）
  function at(key, x, y, h, u, v) {
    const i = img('img/cut/' + key + '.webp').i; if (!i.naturalWidth) return [x, y - h / 2];
    const w = h * i.naturalWidth / i.naturalHeight; return [x - w / 2 + u * w, y - h + v * h];
  }

  // ---------- 效果 ----------
  function makeRain(n, seed, slant = 0.12) {
    const r = rng(seed), d = [];
    for (let i = 0; i < n; i++) d.push({ x: r() * (W + 300), y: r() * H, v: 520 + r() * 300, l: 36 + r() * 36 });
    return (ctx, t, alpha = 0.8) => {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      for (const q of d) {
        const y = (q.y + t * q.v) % (H + 100) - 50, x = ((q.x - (y + 50) * slant) % (W + 300) + W + 300) % (W + 300) - 150;
        ctx.moveTo(x, y); ctx.lineTo(x - q.l * slant, y + q.l);
      }
      ctx.stroke(); ctx.restore();
    };
  }
  const RAIN = makeRain(70, 17);
  function ell(ctx, x, y, rx, ry, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); }
  function noteShape(ctx, s, col, kind) {
    ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    ell(ctx, 0, 0, s * 0.42, s * 0.3, -0.4); ctx.fill();
    ctx.fillRect(s * 0.3, -s * 1.3, s * 0.12, s * 1.3);
    if (kind) { ell(ctx, s * 0.9, -s * 0.2, s * 0.42, s * 0.3, -0.4); ctx.fill(); ctx.fillRect(s * 1.2, -s * 1.5, s * 0.12, s * 1.3); ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 1.3); ctx.lineTo(s * 1.32, -s * 1.5); ctx.lineTo(s * 1.32, -s * 1.25); ctx.lineTo(s * 0.3, -s * 1.05); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(s * 0.42, -s * 1.3); ctx.quadraticCurveTo(s * 0.9, -s * 1.0, s * 0.75, -s * 0.5); ctx.quadraticCurveTo(s * 0.75, -s * 0.9, s * 0.42, -s * 0.95); ctx.fill(); }
    ctx.restore();
  }
  function burst(ctx, x, y, ang, k, col, w = 6) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.globalAlpha = k;
    for (let i = -1; i <= 1; i++) { const a = ang + i * 0.5; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20); ctx.lineTo(x + Math.cos(a) * (40 + 22 * k), y + Math.sin(a) * (40 + 22 * k)); ctx.stroke(); }
    ctx.restore();
  }

  function scene(sprites, o) {
    return {
      bg: o.bg || '#ddd',
      get ready() { return Promise.all(sprites.map((k) => img('img/cut/' + k + '.webp').p)); },
      build(S) { sprites.forEach((k) => img('img/cut/' + k + '.webp')); this.back = layer(S, o.back); this.front = o.front ? layer(S, o.front) : null; },
      draw(ctx, t, dt) { ctx.drawImage(this.back, 0, 0, W, H); o.draw.call(this, ctx, t, dt); if (this.front) ctx.drawImage(this.front, 0, 0, W, H); if (o.top) o.top(ctx, t); },
    };
  }

  // ======================================================================
  // 下雨了 5：穿雨衣踩水
  list.r5 = scene(['r5_boy'], {
    bg: '#c9d4e2',
    back(g) {
      g.fillStyle = '#c9d4e2'; g.fillRect(0, 0, W, H); g.fillStyle = paperPattern(g); g.fillRect(0, 0, W, H);
      paper(g, wave(-20, W + 20, 430, 30, 160, H, 3), '#b5cf9a');
      paper(g, wave(-20, W + 20, 500, 24, 220, H, 4), '#8fbf6e');
      paper(g, blob(600, 700, 360, 92, 5, 18, 0.06), '#8dbfe0');
      paper(g, blob(600, 708, 270, 60, 6, 16, 0.08), '#b3d8ef', { blur: 2, dy: 1 });
    },
    front(g) {
      grassTuft(g, 120, 840, 1.6, '#5f9a4a', 1); grassTuft(g, 1080, 845, 1.8, '#4f8a3c', 2); grassTuft(g, 300, 800, 1.0, '#6aa652', 3);
      grassTuft(g, 940, 770, 1.0, '#6aa652', 4); grassTuft(g, 220, 640, 0.8, '#5f9a4a', 5);
    },
    draw(ctx, t) {
      // 雲慢慢飄
      [[160, 120, 1.3, 1], [700, 90, 1.0, 2], [1050, 180, 0.9, 3]].forEach(([x, y, s, seed], i) => {
        const xx = ((x + t * (10 + i * 4)) % (W + 300)) - 150;
        ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.fillStyle = '#f5f7fa'; ctx.fill(cloudPath(xx, y, s, seed)); ctx.restore();
      });
      // 水波
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
      [[420, 700, 0], [760, 690, 0.4], [600, 730, 0.7], [520, 680, 0.2]].forEach(([x, y, ph]) => { const u = (t * 0.8 + ph) % 1; ctx.globalAlpha = 1 - u; ell(ctx, x, y, 10 + u * 70, (10 + u * 70) * 0.28); ctx.stroke(); });
      ctx.restore();
      // 跳：往上跳、落地壓扁
      const cyc = (t * 1.3) % 1, up = Math.sin(cyc * Math.PI), land = cyc < 0.12 ? 1 - cyc / 0.12 : 0;
      const by = 715 - up * 70;
      sticker(ctx, 'r5_boy', 600, by, 560, { rot: Math.sin(t * 1.3 * TAU) * 0.05, sy: 1 - land * 0.06, sx: 1 + land * 0.04 });
      // 落地濺水
      if (cyc < 0.35) {
        const u = cyc / 0.35;
        ctx.save(); ctx.fillStyle = 'rgba(225,242,255,.95)'; ctx.strokeStyle = '#6fa8d0'; ctx.lineWidth = 2.5; ctx.globalAlpha = 1 - u;
        for (let i = 0; i < 10; i++) { const a = -Math.PI * (0.06 + i * 0.098); ell(ctx, 600 + Math.cos(a) * 200 * u, 712 + Math.sin(a) * 120 * u + 160 * u * u, 9, 13, a); ctx.fill(); ctx.stroke(); }
        ctx.restore();
      }
    },
    top(ctx, t) { RAIN(ctx, t); },
  });
  list.rcover = list.r5;

  // ---------- 下雨了其他頁 ----------
  function bg(g, col) { g.fillStyle = col; g.fillRect(0, 0, W, H); g.fillStyle = paperPattern(g); g.fillRect(0, 0, W, H); }
  function rect(x0, y0, x1, y1, seed, amt = 2) { return wobbly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], seed, amt); }
  function brickWall(g, x0, y0, x1, y1, seed, cols = ['#c9c6d2', '#d4d1dc', '#bdbac7', '#cfcbd8'], bw = 120, bh = 50) {
    const r = rng(seed);
    g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
    for (let row = 0, y = y0; y < y1; row++, y += bh)
      for (let x = x0 - (row % 2 ? bw / 2 : 0); x < x1; x += bw)
        paper(g, rect(x + 5, y + 5, x + bw - 5, y + bh - 5, Math.floor(r() * 1e6), 1.5), cols[Math.floor(r() * cols.length)], { blur: 3, dy: 2, edge: false });
    g.restore();
  }
  function bushes(g, x, y, s, seed) {
    const r = rng(seed);
    for (let i = 0; i < 6; i++) paper(g, blob(x + (r() - 0.5) * 200 * s, y - r() * 60 * s, (60 + r() * 40) * s, (45 + r() * 25) * s, seed + i, 12, 0.15), ['#4f8a3c', '#62a047', '#3f7a33'][i % 3], { blur: 6 });
    for (let i = 0; i < 8; i++) paper(g, blob(x + (r() - 0.5) * 220 * s, y - r() * 90 * s, 9 * s, 9 * s, seed + 20 + i, 8, 0.1), '#d8434a', { blur: 3, dy: 1, edge: false });
  }
  function raincoatPaper(g, x, y, s, seed) {
    const p = wobbly([[x - 40 * s, y], [x + 40 * s, y], [x + 70 * s, y + 40 * s], [x + 52 * s, y + 54 * s], [x + 56 * s, y + 170 * s], [x - 56 * s, y + 170 * s], [x - 52 * s, y + 54 * s], [x - 70 * s, y + 40 * s]], seed, 2);
    paper(g, p, '#e8505b');
    g.save(); g.clip(p); g.fillStyle = 'rgba(255,255,255,.9)'; const r = rng(seed);
    for (let yy = y; yy < y + 175 * s; yy += 22 * s) for (let xx = x - 70 * s; xx < x + 70 * s; xx += 22 * s) { ell(g, xx + ((yy / 22) % 2) * 11 * s + (r() - 0.5) * 3, yy, 4 * s, 4 * s); g.fill(); }
    g.restore();
  }
  function room(g, rainWin) {
    bg(g, '#f6e3a4');
    paper(g, rect(-20, 640, 1220, 860, 31), '#efe7d6');
    paper(g, rect(rainWin[0] - 18, rainWin[1] - 18, rainWin[2] + 18, rainWin[3] + 18, 32), '#ffffff');
    paper(g, rect(...rainWin, 33), '#bfccdc', { blur: 3, dy: 1 });
    paper(g, rect(rainWin[0] - 60, rainWin[1] - 44, rainWin[2] + 60, rainWin[1] - 30, 34, 1), '#7a5236');
  }
  function coatRack(g, x) {
    paper(g, rect(x - 7, 170, x + 7, 790, 41, 1), '#7a5236');
    paper(g, wobbly([[x, 240], [x - 50, 180], [x - 42, 174], [x + 4, 228]], 42, 1), '#7a5236');
    paper(g, wobbly([[x, 260], [x + 50, 200], [x + 58, 206], [x + 4, 274]], 43, 1), '#7a5236');
    paper(g, rect(x - 50, 780, x + 50, 796, 44, 1), '#7a5236');
  }
  const RAIN_IN = makeRain(40, 23, 0.05);
  function rainClip(ctx, t, x0, y0, x1, y1, outside) {
    ctx.save(); ctx.beginPath(); if (outside) ctx.rect(0, 0, W, H); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(outside ? 'evenodd' : 'nonzero');
    (outside ? RAIN : RAIN_IN)(ctx, t, 0.85); ctx.restore();
  }
  function hearts(ctx, t, n, seed, big) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * W, ph = r(), s = (26 + r() * 30) * (big ? 1.3 : 1), u = (t * 0.1 + ph) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI); ctx.translate(x + Math.sin(u * 7 + i) * 30, H + 60 - u * (H + 140)); ctx.rotate(Math.sin(u * 4 + i) * 0.3);
      const k = 1 + 0.08 * Math.sin(t * 6 + i);
      ctx.scale(k, k); ctx.shadowColor = 'rgba(120,30,50,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.25, -s * 0.55, -s, 0, -s * 0.5); ctx.bezierCurveTo(s * 0.55, -s, s, -s * 0.25, 0, s * 0.35);
      ctx.fillStyle = ['#f06b7f', '#f7a1b0', '#e8505b'][i % 3]; ctx.fill(); ctx.restore();
    }
  }

  // 1 媽媽：啊！下雨了
  list.r1 = scene(['r1_mom', 'r1_bird1', 'r1_bird2'], {
    bg: '#d4d1dc',
    back(g) {
      bg(g, '#e6e3ec'); brickWall(g, 0, 0, W, H, 51);
      paper(g, rect(560, 100, 1070, 610, 52), '#7a5236');
      paper(g, rect(588, 128, 1042, 582, 53), '#f8e6b0', { blur: 4, dy: 1 });
      paper(g, wobbly([[960, 128], [1042, 128], [1042, 582], [990, 582], [1000, 400]], 54, 2), '#c9454c', { blur: 4 });
    },
    front(g) { bushes(g, 110, 860, 1.2, 55); bushes(g, 1120, 870, 1.1, 56); },
    draw(ctx, t) {
      ctx.save(); ctx.beginPath(); ctx.rect(588, 128, 454, 454); ctx.clip();
      const pop = t < 0.6 ? Math.sin(t / 0.6 * Math.PI) : 0;
      sticker(ctx, 'r1_mom', 800, 640 - pop * 25, 540, { rot: Math.sin(t * 1.4) * 0.025 });
      ctx.restore();
      [[230, 230, 190, 0], [420, 300, 175, 1.7]].forEach(([x, y, h, ph], i) => {
        const flap = Math.sin(t * 9 + ph);
        sticker(ctx, i ? 'r1_bird2' : 'r1_bird1', x + Math.sin(t * 0.8 + ph) * 40, y + Math.sin(t * 2 + ph) * 18, h, { rot: flap * 0.12, sy: 1 + flap * 0.06 });
      });
    },
    top(ctx, t) { rainClip(ctx, t, 588, 128, 1042, 582, true); },
  });

  // 2 弟弟：您怎麼知道下雨了？
  list.r2 = scene(['r2_mom', 'r2_boy'], {
    bg: '#f6e3a4',
    back(g) { room(g, [440, 110, 940, 540]); coatRack(g, 120); raincoatPaper(g, 120, 200, 0.9, 61); },
    draw(ctx, t) {
      rainClip(ctx, t, 440, 110, 940, 540);
      sticker(ctx, 'r2_mom', 560, 800, 700, { rot: Math.sin(t * 1.2) * 0.02 });
      const walk = Math.min(1, t / 2.4), step = walk < 1 ? Math.abs(Math.sin(t * 7)) : 0;
      sticker(ctx, 'r2_boy', 1160 - walk * 230, 805 - step * 14, 440, { rot: walk < 1 ? Math.sin(t * 7) * 0.05 : Math.sin(t * 2) * 0.03 });
    },
  });

  // 3 媽媽：因為我看到馬路溼了
  list.r3 = scene(['r3_frog', 'r3_window'], {
    bg: '#dfe2ea',
    back(g) {
      bg(g, '#d9dee8');
      [[130, 90, 1], [520, 60, 0.8]].forEach(([x, y, s], i) => paper(g, cloudPath(x, y, s, 71 + i), '#f4f6fa', { blur: 6 }));
      paper(g, rect(600, 140, 1230, 660, 72), '#e9c9cc');
      paper(g, rect(890, 290, 990, 370, 73), '#fafafa', { blur: 3 });
      paper(g, rect(-20, 250, 640, 660, 74), '#e3e1ea');
      brickWall(g, -20, 250, 640, 660, 75, ['#c9c6d2', '#d4d1dc', '#bdbac7'], 90, 40);
      // 屋頂：一排排粉紅瓦片
      paper(g, wobbly([[-30, 270], [120, 60], [560, 60], [690, 270]], 76, 2), '#d68f98');
      for (let row = 0; row < 7; row++) for (let x = -20 + (row % 2) * 22; x < 700; x += 44) {
        const y = 80 + row * 28; if (y > 262) continue;
        const left = 120 - (y - 60) * 0.71, right = 560 + (y - 60) * 0.62; if (x < left - 10 || x > right) continue;
        const p = new Path2D(); p.arc(x, y, 21, 0, Math.PI); p.closePath(); paper(g, p, row % 2 ? '#e3a2aa' : '#cf838d', { blur: 2, dy: 1, edge: false });
      }
      for (let x = 30; x < W; x += 150) bushes(g, x, 680, 0.55, 80 + x);
      paper(g, rect(-20, 660, 1220, 790, 77), '#b9bcc4');
      for (let x = 40; x < W; x += 170) paper(g, rect(x, 724, x + 80, 732, 78 + x, 1), '#e2e4ea', { blur: 2, edge: false });
      [[200, 700, 120, 20], [560, 760, 160, 22], [840, 690, 90, 14]].forEach(([x, y, rx, ry], i) => paper(g, blob(x, y, rx, ry, 90 + i, 14, 0.12), '#d6e8f5', { blur: 3, dy: 1 }));
      paper(g, wave(-20, W + 20, 790, 8, 200, H, 79), '#94bf72');
    },
    draw(ctx, t) {
      sticker(ctx, 'r3_window', 330, 520, 260);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
      [[200, 700, 0], [560, 760, 0.4], [520, 762, 0.75], [840, 690, 0.2], [240, 704, 0.6]].forEach(([x, y, ph]) => { const u = (t * 0.8 + ph) % 1; ctx.globalAlpha = 1 - u; ell(ctx, x, y, 8 + u * 50, (8 + u * 50) * 0.3); ctx.stroke(); });
      ctx.restore();
      const br = Math.sin(t * 2);
      sticker(ctx, 'r3_frog', 990, 860, 470, { sx: 1 + br * 0.015, sy: 1 - br * 0.015 });
    },
    top(ctx, t) { RAIN(ctx, t); },
  });

  // 4 弟弟：為什麼下雨就要穿雨衣？
  list.r4 = scene(['r4_boy'], {
    bg: '#f4ead2',
    back(g) {
      bg(g, '#c3ccda');
      [[90, 110, 1], [330, 190, 0.8]].forEach(([x, y, s], i) => paper(g, cloudPath(x, y, s, 101 + i), '#f4f6fa', { blur: 6 }));
      paper(g, wobbly([[-20, 330], [540, 250], [540, 330], [-20, 420]], 102, 2), '#9aa3b2');
      paper(g, wave(-20, 540, 380, 30, 180, H, 103), '#86b462');
      bushes(g, 430, 430, 0.8, 104);
      paper(g, wobbly([[-20, 720], [540, 560], [540, 860], [-20, 860]], 105, 2), '#e6e1d4');
      for (let i = 0; i < 6; i++) grassTuft(g, 30 + i * 80, 640 + (i % 2) * 40, 1.1, '#5f9a4a', 106 + i);
      paper(g, rect(500, -20, 1220, 860, 107), '#f4ead2');
      paper(g, rect(680, -20, 720, 860, 108, 1), '#e2d4b8', { blur: 4 });
      paper(g, rect(490, -20, 530, 860, 109, 1), '#ffffff');
      paper(g, rect(500, 590, 780, 626, 110, 1), '#d2bf9c');
    },
    draw(ctx, t) {
      rainClip(ctx, t, 0, 0, 490, 860);
      sticker(ctx, 'r4_boy', 880, 900, 780, { rot: Math.sin(t * 1.1) * 0.03 });
    },
  });

  // 6 弟弟：為什麼我有這件雨衣？
  list.r6 = scene(['r6_mom', 'r6_boy'], {
    bg: '#f6e3a4',
    back(g) { room(g, [440, 110, 940, 540]); coatRack(g, 120); paper(g, wobbly([[380, 96], [470, 96], [460, 640], [380, 640]], 121, 2), '#c9454c'); },
    draw(ctx, t) {
      rainClip(ctx, t, 470, 110, 940, 540);
      sticker(ctx, 'r6_mom', 560, 800, 690, { rot: Math.sin(t * 1.5) * 0.03 });
      sticker(ctx, 'r6_boy', 880, 805, 475, { rot: Math.sin(t * 1.8) * 0.04 });
    },
  });

  // 7 媽媽：因為我看到這件雨衣很漂亮
  list.r7 = scene(['r7_mom', 'r7_boy'], {
    bg: '#f6e3a4',
    back(g) {
      bg(g, '#f6e3a4');
      paper(g, rect(-20, 640, 1220, 860, 131), '#efe7d6');
      paper(g, rect(600, 60, 1150, 540, 132), '#ffffff');
      paper(g, rect(620, 80, 1130, 520, 133), '#bfccdc', { blur: 3, dy: 1 });
      paper(g, wobbly([[-20, -20], [230, -20], [200, 300], [250, 860], [-20, 860]], 134, 3), '#b8383f');
    },
    draw(ctx, t) {
      rainClip(ctx, t, 620, 80, 1130, 520);
      sticker(ctx, 'r7_mom', 360, 900, 820, { rot: Math.sin(t * 1.3) * 0.02 });
      // 弟弟穿新雨衣，開心地轉來轉去
      const tw = Math.sin(t * 2.4);
      sticker(ctx, 'r7_boy', 870, 815 - Math.abs(Math.sin(t * 4.8)) * 10, 600, { rot: tw * 0.08 });
    },
  });

  // 8、9 抱抱
  function hug(h, big) {
    return scene(['r8_hug'], {
      bg: '#f4b3bb',
      back(g) {
        bg(g, '#f4b3bb');
        for (let r = 760; r > 100; r -= 110) { const p = new Path2D(); p.arc(600, 450, r, 0, TAU); paper(g, p, r % 220 > 100 ? '#f7c3c9' : '#f4b3bb', { blur: 8, dy: 3, edge: false }); }
      },
      draw(ctx, t) {
        hearts(ctx, t, big ? 14 : 9, big ? 141 : 142, big);
        sticker(ctx, 'r8_hug', 600, 880, h, { rot: Math.sin(t * 1.5) * 0.04 });
      },
    });
  }
  list.r8 = hug(780, false);
  list.r9 = hug(880, true);

  // 看一看 1：很高興
  list.k1 = scene(['k1_boy'], {
    bg: '#f1e6cf',
    back(g) {
      g.fillStyle = '#f1e6cf'; g.fillRect(0, 0, W, H); g.fillStyle = paperPattern(g); g.fillRect(0, 0, W, H);
      paper(g, wobbly([[50, 40], [1150, 40], [1150, 600], [50, 600]], 11, 2), '#b9885a');
      paper(g, wobbly([[78, 66], [1122, 66], [1122, 574], [78, 574]], 12, 2), '#46684a', { blur: 4, dy: 1 });
      g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3;
      for (let k = 0; k < 2; k++) for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(120, 110 + k * 170 + i * 20); g.lineTo(460, 108 + k * 170 + i * 20); g.stroke(); }
      g.font = '42px serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('♪', 200, 152); g.fillText('♫', 330, 320);
      g.save(); g.translate(1050, 120); g.font = '34px "PingFang TC", sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)';
      ['X', '月', 'X', '日', '值', '日', '生'].forEach((c, i) => g.fillText(c, 0, i * 40)); g.restore();
      paper(g, wobbly([[60, 600], [1140, 600], [1140, 628], [60, 628]], 13, 1), '#a07448');
      paper(g, wobbly([[150, 584], [250, 584], [250, 600], [150, 600]], 14, 1), '#fafafa', { blur: 3 });
      paper(g, wave(-20, W + 20, 700, 6, 300, H, 15), '#e3d3b6');
    },
    draw(ctx, t) {
      // 紙剪的音符往上飄
      [[180, 520, 0, '#f6c84a', 0], [980, 480, 0.33, '#f59ac0', 1], [260, 760, 0.66, '#9ad0f5', 1], [930, 760, 0.15, '#f6c84a', 0]].forEach(([x, y, ph, col, kind], i) => {
        const u = (t * 0.28 + ph) % 1;
        ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI); ctx.translate(x + Math.sin(u * 6 + i) * 30, y - u * 380); ctx.rotate(Math.sin(u * 5 + i) * 0.3);
        noteShape(ctx, 46, col, kind); ctx.restore();
      });
      // 跟著音樂搖頭晃腦
      const beat = Math.abs(Math.sin(t * 3.2));
      sticker(ctx, 'k1_boy', 600, 870 - beat * 18, 760, { rot: Math.sin(t * 1.6) * 0.06 });
    },
  });
  list.kcover = list.k1;

  // 看一看 9：很害怕小狗
  function yard(g) {
    g.fillStyle = '#d6ebf6'; g.fillRect(0, 0, W, H); g.fillStyle = paperPattern(g); g.fillRect(0, 0, W, H);
    paper(g, blob(1110, 150, 150, 120, 21, 16, 0.15), '#7fb35e');
    paper(g, wobbly([[-20, 120], [1220, 120], [1220, 790], [-20, 790]], 22, 2), '#f6f3ec');
    g.strokeStyle = 'rgba(150,140,125,.35)'; g.lineWidth = 3;
    for (let y = 190; y < 790; y += 70) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (y / 70) % 2 ? 0 : 70; x < W; x += 140) { g.beginPath(); g.moveTo(x, y - 70); g.lineTo(x, y); g.stroke(); } }
    paper(g, wobbly([[-20, 80], [800, 80], [830, 128], [-20, 128]], 23, 2), '#c9584e');
    paper(g, wobbly([[60, 230], [340, 230], [340, 790], [60, 790]], 24, 2), '#3d3b44');
    paper(g, wobbly([[-20, 780], [1220, 780], [1220, 860], [-20, 860]], 25, 2), '#e4e0d6');
  }
  list.k9 = scene(['k9_boy', 'k9_dog'], {
    bg: '#eef3f6',
    back: yard,
    front(g) {
      // 門邊的牆擋住小狗屁股
      paper(g, wobbly([[30, 230], [110, 230], [110, 800], [30, 800]], 26, 1), '#f6f3ec', { blur: 8 });
    },
    draw(ctx, t) {
      // 小狗往前撲、叫
      const lunge = Math.max(0, Math.sin(t * 4.5)), bark = Math.max(0, Math.sin(t * 9));
      sticker(ctx, 'k9_dog', 250 + lunge * 40, 800, 380, { rot: lunge * 0.05 });
      burst(ctx, 430 + lunge * 40, 545, -0.2, bark, '#d8434a');
      // 鐵門
      ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.fillStyle = '#ffffff';
      ctx.fillRect(520, 320, 26, 470); ctx.fillRect(520, 320, 210, 24); ctx.fillRect(520, 766, 210, 24);
      for (let x = 560; x <= 700; x += 40) ctx.fillRect(x, 340, 14, 430);
      ctx.restore();
      // 小男孩發抖、往後縮
      const shy = Math.sin(t * 1.2) * 0.03;
      sticker(ctx, 'k9_boy', 880 + Math.sin(t * 38) * 4, 810, 620, { rot: 0.06 + shy });
      burst(ctx, 760, 420, Math.PI, Math.max(0, Math.sin(t * 7)), '#5b4033', 5);
      burst(ctx, 1010, 460, 0, Math.max(0, Math.sin(t * 7 + 1.5)), '#5b4033', 5);
    },
  });
  // ---------- 看一看其他頁 ----------
  function paperDrop(ctx, x, y, s, col = '#9fd4f5', edge = '#4b9ad1') {
    ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.moveTo(x, y - s * 1.6); ctx.quadraticCurveTo(x + s, y + s * 0.3, x, y + s); ctx.quadraticCurveTo(x - s, y + s * 0.3, x, y - s * 1.6);
    ctx.fillStyle = col; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  function fallingDrops(ctx, t, pts, s, dist, col, edge) {
    pts.forEach(([x, y, ph]) => { const u = (t * 0.8 + ph) % 1; ctx.save(); ctx.globalAlpha = Math.min(1, (1 - u) * 2) * Math.min(1, u * 8); paperDrop(ctx, x, y + u * dist, s, col, edge); ctx.restore(); });
  }
  function star(ctx, x, y, s, rot, col = '#ffd84a') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.shadowColor = 'rgba(40,30,20,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.restore();
  }
  function playground(g) {
    bg(g, '#a9d4ef');
    [[160, 100, 1.1], [870, 140, 1], [520, 70, 0.7]].forEach(([x, y, s], i) => paper(g, cloudPath(x, y, s, 201 + i), '#ffffff', { blur: 6 }));
    paper(g, wave(-20, W + 20, 560, 10, 300, H, 202), '#e9dcc3');
    [[60, 260, 80, 600], [300, 260, 340, 600]].forEach(([a, b, c, d], i) => paper(g, wobbly([[a - 8, d], [b - 8, b], [b + 8, b], [a + 8, d]], 203 + i, 1), '#3e6fb5'));
    paper(g, rect(40, 250, 340, 272, 205, 1), '#3e6fb5');
    paper(g, rect(130, 450, 230, 466, 206, 1), '#7a5236');
    paper(g, wobbly([[860, 610], [1060, 330], [1100, 350], [910, 620]], 207, 2), '#f2c84b');
    paper(g, rect(1040, 300, 1210, 600, 208), '#d0504e');
    paper(g, rect(1070, 190, 1180, 300, 209), '#3e6fb5'); paper(g, rect(1086, 206, 1164, 284, 210), '#a9d4ef', { blur: 2 });
  }
  list.k2 = scene(['k2_girl'], {
    bg: '#a9d4ef', back: playground,
    draw(ctx, t) {
      const sob = Math.abs(Math.sin(t * 5)) * 8 + Math.abs(Math.sin(t * 13)) * 3;
      const X = 600, Y = 920 - sob, Hh = 860;
      sticker(ctx, 'k2_girl', X, Y, Hh, { rot: Math.sin(t * 2.2) * 0.02 });
      const [ex, ey] = at('k2_girl', X, Y, Hh, 0.62, 0.42);
      fallingDrops(ctx, t, [[ex, ey, 0], [ex + 6, ey, 0.5]], 14, 160);
    },
  });

  list.k3 = scene(['k3_boy'], {
    bg: '#8fcbef',
    back(g) {
      bg(g, '#8fcbef');
      [[780, 120, 0.9], [1050, 230, 0.7]].forEach(([x, y, s], i) => paper(g, cloudPath(x, y, s, 221 + i), '#ffffff', { blur: 6 }));
      paper(g, wave(-20, W + 20, 620, 12, 260, H, 222), '#f0d49a');
      paper(g, wobbly([[860, 650], [1040, 400], [1210, 650]], 223, 2), '#e9be6a');
      paper(g, wobbly([[1040, 400], [1210, 650], [1110, 650]], 224, 2), '#d7a856', { blur: 2 });
      g.strokeStyle = '#4a4a4a'; g.lineWidth = 3;
      [[420, 200], [460, 175], [930, 320]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 14, y); g.quadraticCurveTo(x - 7, y - 8, x, y); g.quadraticCurveTo(x + 7, y - 8, x + 14, y); g.stroke(); });
    },
    draw(ctx, t) {
      // 紙剪的太陽在轉、在發熱
      ctx.save(); ctx.translate(110, 110); ctx.rotate(t * 0.3); ctx.shadowColor = 'rgba(40,30,20,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#f39a3a';
      for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(105, -18); ctx.lineTo(185 + Math.sin(t * 3 + i) * 16, 0); ctx.lineTo(105, 18); ctx.fill(); }
      ctx.beginPath(); ctx.arc(0, 0, 112, 0, TAU); ctx.fillStyle = '#f7b84a'; ctx.fill(); ctx.restore();
      const X = 600 + Math.sin(t * 1.3) * 10, Y = 925, Hh = 860;
      sticker(ctx, 'k3_boy', X, Y, Hh, { rot: Math.sin(t * 1.3) * 0.02 });
      const p1 = at('k3_boy', X, Y, Hh, 0.73, 0.2), p2 = at('k3_boy', X, Y, Hh, 0.3, 0.36);
      fallingDrops(ctx, t, [[p1[0], p1[1], 0], [p2[0], p2[1], 0.45], [p1[0] - 30, p1[1] + 30, 0.75]], 13, 90, '#dff3ff', '#5aa6d8');
    },
  });

  const SNOW = (() => { const r = rng(231); return Array.from({ length: 55 }, () => [r() * W, r() * H, 5 + r() * 9, 25 + r() * 45]); })();
  list.k4 = scene(['k4_kid', 'k4_penguin'], {
    bg: '#1f2d5e',
    back(g) {
      bg(g, '#1f2d5e');
      paper(g, wave(-20, W + 20, 640, 14, 240, H, 232), '#eef3fa');
      const ig = new Path2D(); ig.ellipse(230, 660, 200, 160, 0, Math.PI, TAU); ig.closePath(); paper(g, ig, '#f6f9fd');
      g.save(); g.clip(ig); g.strokeStyle = '#c3cce0'; g.lineWidth = 3;
      for (let y = 540; y < 660; y += 40) { g.beginPath(); g.moveTo(20, y); g.lineTo(440, y); g.stroke(); for (let x = 40 + ((y / 40) % 2) * 30; x < 440; x += 60) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 40); g.stroke(); } }
      g.restore();
      const door = new Path2D(); door.ellipse(370, 662, 50, 58, 0, Math.PI, TAU); door.closePath(); paper(g, door, '#5d6b86', { blur: 3 });
    },
    draw(ctx, t) {
      // 極光（半透明紙條在飄）
      [['rgba(110,230,170,.35)', 120, 0], ['rgba(130,200,250,.3)', 210, 1.6]].forEach(([c, y0, ph]) => {
        ctx.beginPath(); ctx.moveTo(-20, y0);
        for (let x = -20; x <= W + 20; x += 40) ctx.lineTo(x, y0 + Math.sin(x * 0.006 + t * 0.7 + ph) * 50);
        for (let x = W + 20; x >= -20; x -= 40) ctx.lineTo(x, y0 + 90 + Math.sin(x * 0.005 + t * 0.5 + ph) * 60);
        ctx.fillStyle = c; ctx.fill();
      });
      const wob = Math.sin(t * 5) * 0.12;
      sticker(ctx, 'k4_penguin', 1080 + Math.sin(t * 0.6) * 40, 720, 170, { rot: wob });
      sticker(ctx, 'k4_kid', 600 + Math.sin(t * 40) * 4, 925, 860, { rot: Math.sin(t * 31) * 0.008 });
      ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 12);
      [[-1, 260], [1, 940]].forEach(([s, x]) => { for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(x + s * i * 28, 480, 60 + i * 22, s > 0 ? -0.5 : Math.PI - 0.5, s > 0 ? 0.5 : Math.PI + 0.5); ctx.stroke(); } });
      ctx.restore();
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2;
      SNOW.forEach(([x, y, r, v]) => { ell(ctx, x + Math.sin(t + y) * 18, (y + t * v) % H, r, r); ctx.fill(); });
      ctx.restore();
    },
  });

  function classroom(g, wall) { bg(g, wall); paper(g, rect(-20, 650, 1220, 860, 241), '#e6e2d8'); }
  list.k5 = scene(['k5_boy', 'k5_teacher'], {
    bg: '#e3ece4',
    back(g) {
      classroom(g, '#e3ece4');
      paper(g, rect(-20, 110, 420, 480, 242), '#b08a5a'); paper(g, rect(-20, 130, 400, 460, 243), '#3f5c45', { blur: 3 });
      paper(g, rect(500, 60, 650, 650, 244), '#d9cfc2');
      paper(g, rect(930, 80, 1190, 655, 245), '#e9a35a');
      paper(g, blob(965, 380, 12, 12, 246, 8, 0.05), '#cfcfcf', { blur: 3 });
    },
    draw(ctx, t) {
      const sweep = Math.sin(t * 4);
      sticker(ctx, 'k5_boy', 390 + sweep * 10, 830, 600, { rot: sweep * 0.04 });
      sticker(ctx, 'k5_teacher', 830, 835, 660, { rot: Math.sin(t * 2) * 0.015 });
      [[300, 300, 0], [470, 260, 0.33], [390, 200, 0.66], [520, 400, 0.15]].forEach(([x, y, ph], i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 3 + ph * TAU); ctx.save(); ctx.globalAlpha = k; star(ctx, x, y, 18 + 10 * k, t + i); ctx.restore();
      });
    },
  });

  list.k6 = scene(['k6_teacher', 'k6_girl'], {
    bg: '#f8eeb8',
    back(g) {
      classroom(g, '#f8eeb8');
      paper(g, rect(-20, 60, 150, 650, 251), '#e7e2d6');
      paper(g, rect(540, 200, 880, 340, 252), '#d9c9a8');
      for (let x = 560; x < 860; x += 75) paper(g, rect(x, 220, x + 55, 320, 253 + x, 1), '#8a6a4a', { blur: 2 });
    },
    front(g) {
      paper(g, wobbly([[-20, 610], [600, 610], [560, 860], [-20, 860]], 261, 2), '#d8a466');
      paper(g, rect(-20, 600, 610, 628, 262, 1), '#b8824a');
      paper(g, rect(70, 530, 130, 604, 263, 1), '#8fc4e8');
      ['#e8505b', '#f2cf3b', '#5a9a5a'].forEach((c, i) => paper(g, rect(82 + i * 14, 486, 90 + i * 14, 534, 264 + i, 1), c, { blur: 2 }));
      paper(g, rect(170, 670, 330, 800, 268), '#6fa8dc');
    },
    draw(ctx, t) {
      // 時鐘
      ctx.save(); ctx.translate(1090, 120); ctx.shadowColor = 'rgba(40,30,20,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.fillStyle = '#c9454c'; ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(0, 0, 54, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = '#5b4033'; ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(1 + t * 0.05) * 26, -Math.cos(1 + t * 0.05) * 26); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(t * 0.8) * 42, -Math.cos(t * 0.8) * 42); ctx.stroke(); ctx.restore();
      const talk = Math.abs(Math.sin(t * 7));
      sticker(ctx, 'k6_teacher', 400, 860 - talk * 6, 660, { rot: Math.sin(t * 3) * 0.02 });
      burst(ctx, 540, 360, -0.5, Math.max(0, Math.sin(t * 6)), '#c9393f', 5);
      sticker(ctx, 'k6_girl', 880, 835, 620, { rot: -0.02 + Math.sin(t * 0.9) * 0.015 });
    },
  });

  list.k7 = scene(['k7_kid'], {
    bg: '#cfe4f2',
    back(g) {
      bg(g, '#cfe4f2');
      paper(g, rect(-20, 640, 1220, 860, 271), '#eae4da');
      paper(g, rect(-20, -20, 200, 650, 272), '#5a3a2a');
      paper(g, rect(760, 60, 1170, 400, 273), '#ffffff'); paper(g, rect(778, 78, 1152, 382, 274), '#bfe0f5', { blur: 2 });
      g.save(); g.beginPath(); g.rect(778, 78, 374, 304); g.clip();
      paper(g, wobbly([[760, 400], [880, 250], [980, 330], [1060, 220], [1180, 400]], 275, 2), '#8fc27a'); g.restore();
      paper(g, wobbly([[880, 760], [960, 740], [990, 790], [900, 805]], 276, 2), '#ee7a3a');
    },
    draw(ctx, t) {
      const k = 0.5 + 0.5 * Math.sin(t * 2.5);
      star(ctx, 1110, 120, 26 + 8 * k, t * 0.5, '#f7c84a');
      const pull = Math.abs(Math.sin(t * 3));
      sticker(ctx, 'k7_kid', 600, 850 - pull * 12, 720, { rot: Math.sin(t * 1.5) * 0.025 });
    },
  });

  list.k8 = scene(['k8_girl'], {
    bg: '#f6d6e8',
    back(g) {
      bg(g, '#f6d6e8');
      paper(g, rect(-20, 600, 1220, 860, 281), '#f3c6dc');
      paper(g, rect(40, 40, 420, 270, 282), '#ffffff'); paper(g, rect(56, 56, 404, 254, 283), '#bfe0f5', { blur: 2 });
      g.save(); g.beginPath(); g.rect(56, 56, 348, 198); g.clip(); paper(g, wobbly([[40, 270], [170, 160], [270, 220], [410, 140], [420, 270]], 284, 2), '#9ac98a'); g.restore();
      paper(g, rect(-20, 300, 250, 610, 285), '#ffffff');
      for (let y = 330; y < 600; y += 70) { paper(g, rect(0, y, 230, y + 58, 286 + y, 1), '#fbf6f8', { blur: 3 }); paper(g, rect(95, y + 26, 135, y + 32, 290 + y, 1), '#d8c8d0', { blur: 1 }); }
      paper(g, wobbly([[120, 700], [330, 690], [340, 760], [110, 770]], 291, 3), '#fff6dc');
      [[700, 770], [780, 770]].forEach(([x, y], i) => paper(g, blob(x, y, 34, 22, 292 + i, 12, 0.05), '#bfe0f5'));
    },
    draw(ctx, t) {
      const hop = Math.abs(Math.sin(t * 3));
      const X = 640, Y = 840 - hop * 8, Hh = 560;
      sticker(ctx, 'k8_girl', X, Y, Hh, { rot: Math.sin(t * 1.6) * 0.015 });
      // 剪紙泳衣掛在手上搖
      const [hx, hy] = at('k8_girl', X, Y, Hh, 0.43, 0.47);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.sin(t * 3) * 0.12);
      const suit = wobbly([[-34, 0], [34, 0], [44, 110], [12, 190], [-12, 190], [-44, 110]], 293, 2);
      paper(ctx, suit, '#c8b6e8');
      ctx.save(); ctx.clip(suit); for (let yy = 20; yy < 190; yy += 30) for (let xx = -40; xx < 44; xx += 28) { ctx.save(); ctx.translate(xx + ((yy / 30) % 2) * 14, yy); ctx.scale(0.4, 0.4); ctx.beginPath(); ctx.moveTo(0, 12); ctx.bezierCurveTo(-30, -8, -18, -34, 0, -18); ctx.bezierCurveTo(18, -34, 30, -8, 0, 12); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); }
      ctx.restore(); ctx.restore();
      // 泡泡
      [[860, 760, 0], [920, 740, 0.35], [800, 740, 0.7]].forEach(([x, y, ph]) => {
        const u = (t * 0.25 + ph) % 1; ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI);
        ell(ctx, x + Math.sin(u * 6) * 20, y - u * 380, 22, 22); ctx.fillStyle = 'rgba(200,235,255,.4)'; ctx.fill(); ctx.strokeStyle = 'rgba(90,160,210,.8)'; ctx.lineWidth = 2; ctx.stroke();
        ell(ctx, x + Math.sin(u * 6) * 20 - 7, y - u * 380 - 7, 5, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
      });
    },
  });

  list.k10 = scene(['k10_girl', 'k10_dog'], {
    bg: '#eef3f6', back: yard,
    draw(ctx, t) {
      ctx.save(); ctx.shadowColor = 'rgba(40,30,20,.3)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4; ctx.fillStyle = '#ffffff';
      ctx.fillRect(700, 320, 26, 470); ctx.fillRect(700, 320, 210, 24); ctx.fillRect(700, 766, 210, 24);
      for (let x = 740; x <= 880; x += 40) ctx.fillRect(x, 340, 14, 430);
      ctx.restore();
      sticker(ctx, 'k10_girl', 640, 800, 600, { rot: Math.sin(t * 1.4) * 0.02 });
      const wag = Math.sin(t * 10);
      sticker(ctx, 'k10_dog', 420, 800, 360, { rot: wag * 0.03, sx: 1 + wag * 0.01 });
      [[360, 420, 0], [420, 400, 0.4], [300, 440, 0.75]].forEach(([x, y, ph], i) => {
        const u = (t * 0.35 + ph) % 1; ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI); ctx.translate(x + Math.sin(u * 6 + i) * 15, y - u * 160);
        ctx.shadowColor = 'rgba(120,30,50,.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; const s2 = 24;
        ctx.beginPath(); ctx.moveTo(0, s2 * 0.35); ctx.bezierCurveTo(-s2, -s2 * 0.25, -s2 * 0.55, -s2, 0, -s2 * 0.5); ctx.bezierCurveTo(s2 * 0.55, -s2, s2, -s2 * 0.25, 0, s2 * 0.35);
        ctx.fillStyle = '#f06b7f'; ctx.fill(); ctx.restore();
      });
    },
  });
})();
