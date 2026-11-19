// 天黑了：五個場景，用程式畫「油畫筆觸」背景，角色即時畫，會動。
// 邏輯座標 W×H（10:7），由 main.js 縮放到螢幕。
(function () {
  const W = 1200, H = 840;

  // ---------- 小工具 ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const noise = (x, y) =>
    Math.sin(x * 0.011 + Math.sin(y * 0.007) * 2) * 0.5 + Math.sin(y * 0.013 + x * 0.004) * 0.5;
  const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const seg = (t, a, b) => ease((t - a) / (b - a));

  function brush(g, x, y, a, L, w, col, alpha, bend) {
    const dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2;
    g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(x - dx, y - dy);
    g.quadraticCurveTo(x - dy * bend, y + dx * bend, x + dx, y + dy); g.stroke();
  }

  // 在區域內刷很多筆
  function paint(g, o) {
    const r = rng(o.seed || 1);
    const [x0, y0, x1, y1] = o.box || [0, 0, W, H];
    g.lineCap = 'round';
    let made = 0, tries = 0;
    while (made < o.n && tries < o.n * 6) {
      tries++;
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (o.inside && !o.inside(x, y)) continue;
      made++;
      const L = o.len[0] + r() * (o.len[1] - o.len[0]);
      const w = o.width[0] + r() * (o.width[1] - o.width[0]);
      brush(g, x, y, o.angle(x, y, r), L, w, o.color(x, y, r), o.alpha == null ? 0.85 : o.alpha, (r() - 0.5) * (o.bend || 0.3));
    }
    g.globalAlpha = 1;
  }

  function layer(S, draw) {
    const c = document.createElement('canvas');
    c.width = Math.round(W * S); c.height = Math.round(H * S);
    const g = c.getContext('2d'); g.scale(S, S); draw(g);
    return c;
  }
  function sprite(k, box, draw) { // box: [x0,y0,x1,y1] 本地座標
    const [x0, y0, x1, y1] = box, c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * k); c.height = Math.ceil((y1 - y0) * k);
    const g = c.getContext('2d'); g.scale(k, k); g.translate(-x0, -y0); draw(g);
    return { c, box };
  }
  function drawSprite(ctx, sp, x, y, sc, rot) {
    const [x0, y0, x1, y1] = sp.box;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.drawImage(sp.c, x0, y0, x1 - x0, y1 - y0); ctx.restore();
  }

  // ---------- 天空 ----------
  const SKY_DARK = ['#2b4a9e', '#1d3580', '#3b5fb4', '#162a66', '#4d70c0', '#122050', '#24418f'];
  const SKY_MID = ['#c8d4f2', '#9fb3e6', '#7f98d8', '#b7c6ee'];
  const WARM = ['#fff6d6', '#ffe7a3', '#ffd27a', '#ffffff', '#ffc46b'];

  function paintSky(g, src, o = {}) {
    const [sx, sy] = src, reach = o.reach || 900;
    const grd = g.createRadialGradient(sx, sy, 10, sx, sy, reach);
    grd.addColorStop(0, o.core || '#5a78c4'); grd.addColorStop(0.25, '#2f4f9f');
    grd.addColorStop(1, '#14245a');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    paint(g, {
      n: o.n || 5200, seed: o.seed || 11, len: [34, 96], width: [4, 9], bend: 0.35,
      angle: (x, y) => {
        const d = Math.hypot(x - sx, y - sy);
        return Math.atan2(y - sy, x - sx) + (o.swirl || 0) * Math.exp(-d / 260) + noise(x, y) * 0.35;
      },
      color: (x, y, r) => {
        const t = Math.hypot(x - sx, y - sy) / reach;
        if (t < (o.pale || 0.18) && r() < 0.8) return pick(SKY_MID, r());
        if (r() < 0.07) return '#8aa2dc';
        return pick(SKY_DARK, r());
      },
    });
  }

  function paintGlow(g, src, radius, seed) { // 透明層：暖色放射筆觸
    const [sx, sy] = src;
    const grd = g.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grd.addColorStop(0, 'rgba(255,240,190,0.95)'); grd.addColorStop(0.35, 'rgba(255,214,140,0.45)');
    grd.addColorStop(1, 'rgba(255,214,140,0)');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    const r = rng(seed); g.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 1.6) * radius;
      const x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d;
      brush(g, x, y, a + (r() - 0.5) * 0.3, 20 + r() * 70, 2 + r() * 5, pick(WARM, r()), (1 - d / radius) * 0.9, 0.2);
    }
    g.globalAlpha = 1;
  }

  // ---------- 山 ----------
  function ridgeFn(pts) {
    return (x) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax);
      }
      return 1e9;
    };
  }
  const GREENS = ['#2a4f28', '#3d6a33', '#1e3a22', '#173020', '#4a7a3c', '#22402a', '#2f5a2b'];
  const RIM = ['#8fb86c', '#b9cf86', '#6f9e58', '#a8c47c'];
  function paintMountain(g, pts, seed, o = {}) {
    const ridge = ridgeFn(pts);
    const p = new Path2D(); p.moveTo(pts[0][0], H + 10);
    pts.forEach(([x, y]) => p.lineTo(x, y)); p.lineTo(pts[pts.length - 1][0], H + 10); p.closePath();
    g.fillStyle = o.base || '#24432a'; g.fill(p);
    g.save(); g.clip(p);
    paint(g, {
      n: o.n || 1800, seed, len: [24, 70], width: [4, 9], bend: 0.4,
      box: [pts[0][0], Math.min(...pts.map((q) => q[1])), pts[pts.length - 1][0], H],
      inside: (x, y) => y > ridge(x),
      angle: (x) => {
        const s = (ridge(x + 4) - ridge(x - 4)) / 8;
        return Math.atan(s) + Math.PI / 2 * 0.55 * Math.sign(s || 1) + noise(x, 0) * 0.25;
      },
      color: (x, y, r) => {
        const dd = y - ridge(x);
        if (dd < (o.rim || 60) && r() < 0.6) return pick(o.rimColors || RIM, r());
        return pick(o.greens || GREENS, r());
      },
    });
    g.restore();
    return ridge;
  }

  // ---------- 月亮 ----------
  let moonCache = null;
  function moonSprite(k) {
    if (moonCache && moonCache.k === k) return moonCache.sp;
    const sp = sprite(k, [-240, -240, 240, 240], (g) => {
      const r = rng(77); g.lineCap = 'round';
      for (let i = 0; i < 900; i++) {
        const a = r() * Math.PI * 2, d = 70 + Math.pow(r(), 1.4) * 170;
        const x = Math.cos(a) * d, y = Math.sin(a) * d;
        brush(g, x, y, a + Math.PI / 2 + (r() - 0.5) * 0.4, 18 + r() * 40, 2 + r() * 5,
          pick(['#ffffff', '#e8eefc', '#c8d4f2', '#fff8dc'], r()), Math.max(0, 1 - (d - 70) / 170) * 0.9, 0.5);
      }
      g.globalAlpha = 1;
      const grd = g.createRadialGradient(-10, -10, 5, 0, 0, 72);
      grd.addColorStop(0, '#fffdf0'); grd.addColorStop(1, '#f4e3a4');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 72, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(0, 0, 72, 0, 7); g.clip();
      for (let i = 0; i < 160; i++) {
        const a = r() * 7, d = r() * 70;
        brush(g, Math.cos(a) * d, Math.sin(a) * d, a + 1.6, 10 + r() * 20, 3 + r() * 4,
          pick(['#f6d77a', '#fff4c8', '#eec35a', '#fffbe6'], r()), 0.6, 0.6);
      }
      g.restore();
    });
    moonCache = { k, sp };
    return sp;
  }

  // ---------- 星星 ----------
  function makeStars(seed, n, inside) {
    const r = rng(seed), out = [];
    while (out.length < n) {
      const x = r() * W, y = r() * H * 0.6;
      if (!inside || inside(x, y)) out.push({ x, y, p: r() * 6.28, s: 3 + r() * 5 });
    }
    return out;
  }
  function drawStars(ctx, stars, t, alpha) {
    if (alpha <= 0) return;
    ctx.fillStyle = '#fffbe6';
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2.2 + s.p);
      ctx.globalAlpha = alpha * (0.3 + 0.7 * tw);
      const k = s.s * (0.6 + 0.4 * tw);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - k); ctx.quadraticCurveTo(s.x, s.y, s.x + k, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + k); ctx.quadraticCurveTo(s.x, s.y, s.x - k, s.y);
      ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - k); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 會流動的筆觸（天空在動） ----------
  function makeFlow(seed, n, inside, angle) {
    const r = rng(seed), ps = [];
    function spawn(p) {
      for (let i = 0; i < 30; i++) {
        p.x = r() * W; p.y = r() * H;
        if (!inside || inside(p.x, p.y)) break;
      }
      p.life = 0; p.max = 2 + r() * 3; p.w = 2 + r() * 3;
      p.col = pick(['#9fb3e6', '#c8d4f2', '#6f8ed6', '#e8eefc'], r());
      return p;
    }
    for (let i = 0; i < n; i++) { const p = spawn({}); p.life = r() * p.max; ps.push(p); }
    return {
      draw(ctx, dt) {
        ctx.lineCap = 'round';
        for (const p of ps) {
          p.life += dt;
          if (p.life > p.max) spawn(p);
          const a = angle(p.x, p.y);
          p.x += Math.cos(a) * 18 * dt; p.y += Math.sin(a) * 18 * dt;
          const k = Math.sin(Math.PI * p.life / p.max);
          brush(ctx, p.x, p.y, a, 40, p.w, p.col, 0.5 * k, 0.3);
        }
        ctx.globalAlpha = 1;
      },
    };
  }

  // ---------- 貓頭鷹 ----------
  const OWL_BOX = [-140, -175, 140, 160];
  const owlCache = {};
  function owlPath() {
    const P = new Path2D();
    P.moveTo(0, 140);
    P.bezierCurveTo(-90, 140, -125, 80, -118, 10);
    P.bezierCurveTo(-112, -60, -118, -110, -100, -160);
    P.quadraticCurveTo(-62, -126, -30, -128);
    P.quadraticCurveTo(0, -132, 30, -128);
    P.quadraticCurveTo(62, -126, 100, -160);
    P.bezierCurveTo(118, -110, 112, -60, 118, 10);
    P.bezierCurveTo(125, 80, 90, 140, 0, 140);
    return P;
  }
  function owlBody(k, folded) {
    const key = k + (folded ? 'f' : 'o');
    if (owlCache[key]) return owlCache[key];
    owlCache[key] = sprite(k, OWL_BOX, (g) => {
      const P = owlPath();
      g.fillStyle = '#5a4535'; g.fill(P);
      g.save(); g.clip(P);
      paint(g, {
        n: 1100, seed: 5, box: [-130, -170, 130, 150], len: [12, 30], width: [3, 5.5], bend: 0.5,
        angle: (x, y) => Math.PI / 2 + x * 0.004 + noise(x * 3, y * 3) * 0.3,
        color: (x, y, r) => pick(['#6e5644', '#4a382b', '#7d6552', '#3d2e24', '#8a735f'], r()),
      });
      // 肚子
      g.fillStyle = '#e6cfc6'; g.beginPath(); g.ellipse(0, 62, 74, 80, 0, 0, 7); g.fill();
      paint(g, {
        n: 360, seed: 6, box: [-74, -18, 74, 142], len: [8, 18], width: [3, 5], bend: 0.6,
        inside: (x, y) => (x * x) / (74 * 74) + ((y - 62) ** 2) / (80 * 80) < 0.95,
        angle: (x) => Math.PI / 2 + x * 0.006,
        color: (x, y, r) => pick(['#f3e3dc', '#d9bdb2', '#ecd8cf', '#cfb1a6'], r()),
      });
      g.lineCap = 'round';
      [[0, 18], [-30, 36], [30, 36], [0, 58], [-42, 66], [42, 66], [-18, 88], [18, 88], [-36, 104], [36, 104], [0, 116]]
        .forEach(([x, y], i) => {
          brush(g, x - 3, y, Math.PI / 2 + 0.3, 14, 4, '#4b3629', 0.9, 0);
          brush(g, x + 3, y, Math.PI / 2 - 0.3, 14, 4, '#4b3629', 0.9, 0);
        });
      // 臉盤
      [-44, 44].forEach((ex) => {
        g.fillStyle = '#806753'; g.beginPath(); g.arc(ex, -62, 50, 0, 7); g.fill();
        const r = rng(ex + 100);
        for (let i = 0; i < 90; i++) {
          const a = r() * 7, d = 30 + r() * 20;
          brush(g, ex + Math.cos(a) * d, -62 + Math.sin(a) * d, a, 10, 3, pick(['#9a826d', '#6b5443', '#a68d76'], r()), 0.8, 0);
        }
      });
      if (folded) {
        [-1, 1].forEach((s) => {
          g.fillStyle = '#463427'; g.beginPath(); g.ellipse(s * 100, 48, 32, 92, -s * 0.12, 0, 7); g.fill();
          paint(g, {
            n: 160, seed: 9 + s, box: [s * 100 - 34, -44, s * 100 + 34, 140], len: [14, 28], width: [3, 5],
            inside: (x, y) => ((x - s * 100) ** 2) / (32 * 32) + ((y - 48) ** 2) / (92 * 92) < 0.9,
            angle: () => Math.PI / 2 + s * 0.15, color: (x, y, r) => pick(['#5a4535', '#3a2a20', '#6b5443'], r()),
          });
        });
      }
      g.restore();
    });
    return owlCache[key];
  }
  const WING_BOX = [-20, -40, 200, 90];
  function owlWing(k) {
    const key = 'w' + k;
    if (owlCache[key]) return owlCache[key];
    owlCache[key] = sprite(k, WING_BOX, (g) => {
      const P = new Path2D();
      P.moveTo(0, 0); P.bezierCurveTo(60, -40, 150, -30, 195, 10);
      P.lineTo(170, 30); P.lineTo(185, 45); P.lineTo(150, 55); P.lineTo(160, 72);
      P.lineTo(110, 70); P.bezierCurveTo(70, 80, 20, 60, 0, 30); P.closePath();
      g.fillStyle = '#4a3729'; g.fill(P); g.save(); g.clip(P);
      paint(g, {
        n: 380, seed: 21, box: WING_BOX, len: [16, 34], width: [3, 5],
        angle: (x) => 0.15 + x * 0.002, color: (x, y, r) => pick(['#5a4535', '#3a2a20', '#7a6250', '#8a735f'], r()),
      });
      g.restore();
    });
    return owlCache[key];
  }
  // open: 0 閉眼 … 1 睜開；look: [-1..1, -1..1]
  function drawOwl(ctx, k, x, y, sc, o = {}) {
    const open = o.open == null ? 1 : o.open, look = o.look || [0, 0];
    if (o.wings != null) {
      const wsp = owlWing(k);
      [-1, 1].forEach((s) => {
        ctx.save(); ctx.translate(x + s * 95 * sc, y + 10 * sc); ctx.scale(s * sc, sc);
        ctx.rotate(-o.wings); ctx.drawImage(wsp.c, WING_BOX[0], WING_BOX[1], WING_BOX[2] - WING_BOX[0], WING_BOX[3] - WING_BOX[1]);
        ctx.restore();
      });
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.translate(-x, -y);
    drawSprite(ctx, owlBody(k, o.wings == null), x, y, sc);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const er = o.wide ? 36 : 30;
    [-44, 44].forEach((ex) => {
      if (open < 0.12) {
        ctx.strokeStyle = '#2a1d15'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(ex, -66, er * 0.8, 0.25 * Math.PI, 0.75 * Math.PI); ctx.stroke();
        return;
      }
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, -62, er, er * open, 0, 0, 7);
      ctx.fillStyle = '#fbf7ee'; ctx.fill(); ctx.strokeStyle = '#2a1d15'; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
      ctx.fillStyle = '#1f1a17'; ctx.beginPath(); ctx.arc(ex + look[0] * 12, -62 + look[1] * 10, o.wide ? 11 : 13, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + look[0] * 12 - 4, -66 + look[1] * 10, 4, 0, 7); ctx.fill();
      ctx.restore();
    });
    // 嘴
    ctx.fillStyle = '#e8913a'; ctx.strokeStyle = '#8a4a1a'; ctx.lineWidth = 2;
    if (o.beak) {
      ctx.beginPath(); ctx.moveTo(-13, -36); ctx.lineTo(13, -36); ctx.lineTo(4, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c8473a'; ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(8, -20); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8913a'; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-12, -36); ctx.lineTo(12, -36); ctx.lineTo(0, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore(); ctx.restore();
  }
  // 眨眼：t 秒時的睜眼程度
  function blink(t, period, phase) {
    const u = ((t + (phase || 0)) % period);
    return u < 0.18 ? Math.abs(Math.cos(u / 0.18 * Math.PI)) : 1;
  }

  // ---------- 小老鼠 ----------
  function furBlob(ctx, cx, cy, rx, ry, rot, seed, n, cols) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.fillStyle = cols[0]; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, 7); ctx.fill();
    const r = rng(seed); ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = r() * 7, d = Math.sqrt(r());
      const x = Math.cos(a) * rx * d, y = Math.sin(a) * ry * d;
      brush(ctx, x, y, Math.atan2(y, x) + 0.3, 8 + r() * 14, 2.5, pick(cols, r()), 0.8, 0.4);
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  const MOUSE_FUR = ['#8d8a93', '#a9a6ae', '#6f6c75', '#c2bfc6', '#5e5b63'];
  function tail(ctx, pts, w) {
    ctx.strokeStyle = '#c98a8a'; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,220,0.6)'; ctx.lineWidth = w * 0.35; ctx.stroke();
  }
  function drawMouse(ctx, x, y, sc, t, o = {}) { // 面向左、受驚嚇
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    const sw = Math.sin(t * 9) * 12;
    tail(ctx, [50, 30, 140, 70 + sw, 190, -20, 230, 10 - sw], 7);
    // 腳
    ctx.strokeStyle = '#d9a3a3'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-10, 45); ctx.lineTo(-25, 82 + sw * 0.5); ctx.moveTo(30, 45); ctx.lineTo(45, 80 - sw * 0.5); ctx.stroke();
    furBlob(ctx, 0, 0, 72, 56, -0.25, 31, 220, MOUSE_FUR);
    // 手舉起來
    ctx.beginPath(); ctx.moveTo(-40, -10); ctx.lineTo(-70, -40 + sw); ctx.moveTo(-10, -20); ctx.lineTo(-20, -60 - sw); ctx.stroke();
    // 耳朵
    [[-38, -98, 32], [-92, -88, 27]].forEach(([ex, ey, er]) => {
      ctx.fillStyle = '#8d8a93'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, 7); ctx.fill();
      ctx.fillStyle = '#e9b2b6'; ctx.beginPath(); ctx.arc(ex, ey + 3, er * 0.62, 0, 7); ctx.fill();
    });
    furBlob(ctx, -62, -48, 48, 42, 0.2, 32, 140, MOUSE_FUR);
    // 嘴尖
    ctx.fillStyle = '#9a97a0'; ctx.beginPath(); ctx.moveTo(-90, -70); ctx.quadraticCurveTo(-130, -45, -122, -36);
    ctx.quadraticCurveTo(-100, -20, -70, -22); ctx.fill();
    ctx.fillStyle = '#e48a96'; ctx.beginPath(); ctx.arc(-123, -38, 7, 0, 7); ctx.fill();
    // 眼睛（驚嚇大眼）
    [[-78, -62], [-52, -66]].forEach(([ex, ey]) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(ex, ey, 14, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1f1f1f'; ctx.beginPath(); ctx.arc(ex - 4, ey, 6, 0, 7); ctx.fill();
    });
    // 鬍鬚
    ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-110, -40); ctx.lineTo(-150, -55); ctx.moveTo(-110, -36); ctx.lineTo(-152, -36); ctx.moveTo(-108, -32); ctx.lineTo(-146, -18); ctx.stroke();
    ctx.restore();
    // 驚嚇符號
    if (o.shock) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      const j = Math.sin(t * 14) * 3;
      ctx.beginPath(); ctx.moveTo(-190, -130 + j); ctx.lineTo(-170, -160); ctx.lineTo(-155, -130); ctx.lineTo(-140, -162); ctx.lineTo(-125, -128); ctx.lineTo(-108, -158 - j); ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-10, 110); ctx.lineTo(-30, 150); ctx.moveTo(15, 112); ctx.lineTo(-5, 158); ctx.moveTo(40, 110); ctx.lineTo(22, 148); ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- 地面、土丘 ----------
  const GROUND = ['#b08870', '#8c6a5a', '#c9a48a', '#6d5a6a', '#9e7a66', '#d1b29a'];
  const MOUND = ['#c9a58a', '#e6d2c0', '#a67c66', '#8a6250', '#d8bca6', '#f0e2d4'];
  function paintGround(g, top, seed) {
    g.fillStyle = '#8c6c5c'; g.fillRect(0, top, W, H - top);
    paint(g, {
      n: 2600, seed, box: [0, top - 10, W, H], len: [20, 50], width: [4, 8], bend: 0.3,
      angle: (x, y) => 0.1 + noise(x, y) * 0.4, color: (x, y, r) => pick(GROUND, r()),
    });
  }
  function paintMound(g, cx, cy, rx, ry, hole, seed) {
    const P = new Path2D(); P.ellipse(cx, cy, rx, ry, 0, Math.PI, 2 * Math.PI); P.lineTo(cx + rx, cy + 60); P.lineTo(cx - rx, cy + 60); P.closePath();
    g.fillStyle = '#a6806a'; g.fill(P); g.save(); g.clip(P);
    paint(g, {
      n: 2600, seed, box: [cx - rx, cy - ry, cx + rx, cy + 60], len: [24, 60], width: [4, 9], bend: 0.5,
      angle: (x, y) => Math.atan2(y - cy, x - cx) + Math.PI / 2 + noise(x, y) * 0.25,
      color: (x, y, r) => {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        if (d > 0.82 && r() < 0.5) return pick(['#f0e2d4', '#e6d2c0', '#ffffff'], r());
        return pick(MOUND, r());
      },
    });
    g.restore();
    // 洞
    const [hx, hy, hrx, hry] = hole;
    const grd = g.createRadialGradient(hx, hy + 20, 10, hx, hy, hrx);
    grd.addColorStop(0, '#120c10'); grd.addColorStop(0.7, '#2b1e22'); grd.addColorStop(1, '#4a3432');
    g.fillStyle = grd; g.beginPath(); g.ellipse(hx, hy, hrx, hry, 0, Math.PI, 2 * Math.PI);
    g.lineTo(hx + hrx, hy + 50); g.lineTo(hx - hrx, hy + 50); g.closePath(); g.fill();
  }
  function grass(g, x, y, n, seed, h) {
    const r = rng(seed); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * 60, lean = (r() - 0.5) * 1.1, L = h * (0.6 + r() * 0.6);
      g.strokeStyle = pick(['#3f6b3a', '#5f8f4a', '#2c4f2c', '#86a85f'], r()); g.lineWidth = 3 + r() * 3;
      g.beginPath(); g.moveTo(bx, y); g.quadraticCurveTo(bx + lean * L * 0.3, y - L * 0.6, bx + lean * L, y - L); g.stroke();
    }
  }
  function pine(g, x, y, h, seed) {
    const r = rng(seed);
    g.strokeStyle = '#3a2a20'; g.lineWidth = 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h * 0.3); g.stroke();
    for (let i = 0; i < 260; i++) {
      const v = r(), yy = y - h * 0.15 - v * h * 0.85, half = (1 - v) * h * 0.32;
      const xx = x + (r() * 2 - 1) * half;
      brush(g, xx, yy, (xx < x ? -0.6 : 0.6) + Math.PI / 2 * (xx < x ? 1 : 0) + (r() - 0.5) * 0.3, 12 + r() * 16, 3 + r() * 3,
        pick(['#2f5a2b', '#4f7f3a', '#1e3a22', '#6a9a4a', '#284a2a'], r()), 0.9, 0.2);
    }
    g.globalAlpha = 1;
  }
  function trunk(g, x0, x1, seed) {
    g.fillStyle = '#5a4030'; g.fillRect(x0, 0, x1 - x0, H);
    paint(g, {
      n: 600, seed, box: [x0, 0, x1, H], len: [20, 50], width: [3, 6],
      angle: () => Math.PI / 2 + (Math.random() - 0.5) * 0.1,
      color: (x, y, r) => pick(['#6b4c38', '#4a3426', '#8a6a50', '#3a2a20', '#a08060'], r()),
    });
  }
  function branch(g, x0, y0, x1, y1, w, seed) {
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#5a4030'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const r = rng(seed), a = Math.atan2(y1 - y0, x1 - x0);
    for (let i = 0; i < 260; i++) {
      const u = r(), off = (r() - 0.5) * w * (1 - u * 0.5);
      const x = x0 + (x1 - x0) * u - Math.sin(a) * off, y = y0 + (y1 - y0) * u + Math.cos(a) * off;
      brush(g, x, y, a, 14 + r() * 26, 2 + r() * 3, pick(['#6b4c38', '#3a2a20', '#8a6a50', '#a08060'], r()), 0.9, 0.1);
    }
    g.restore(); g.globalAlpha = 1;
  }
  function foliage(g, inside, seed, n) {
    paint(g, {
      n, seed, inside, len: [20, 50], width: [4, 9], bend: 0.5,
      angle: (x, y) => -0.9 + noise(x, y) * 0.6,
      color: (x, y, r) => pick(['#2f5a2b', '#4f7f3a', '#1e3a22', '#6a9a4a', '#7fae63', '#284a2a'], r()),
    });
  }

  // ======================================================================
  // 場景定義：build(S) 畫靜態層；draw(ctx, t, dt) 每格畫
  // ======================================================================
  const scenes = {};

  // 1. 太陽一下山，天就黑了
  scenes.sunset = {
    bg: '#14245a',
    build(S) {
      const V = [560, 660];
      this.sky = layer(S, (g) => paintSky(g, V, { reach: 900, seed: 3, swirl: 0, pale: 0.12 }));
      this.glow = layer(S, (g) => paintGlow(g, [560, 640], 430, 8));
      this.front = layer(S, (g) => {
        paintMountain(g, [[-60, 720], [240, 300], [700, 800]], 41, { rim: 70 });
        paintMountain(g, [[420, 860], [1000, 260], [1320, 520]], 42, { rim: 70 });
      });
      const rl = ridgeFn([[-60, 720], [240, 300], [700, 800]]), rr = ridgeFn([[420, 860], [1000, 260], [1320, 520]]);
      this.isSky = (x, y) => y < Math.min(rl(x), rr(x)) - 10;
      this.stars = makeStars(5, 40, this.isSky);
      this.flow = makeFlow(9, 70, this.isSky, (x, y) => Math.atan2(y - 660, x - 560) + noise(x, y) * 0.35);
    },
    draw(ctx, t, dt) {
      const sink = seg(t, 0.6, 4.2);
      ctx.drawImage(this.sky, 0, 0, W, H);
      this.flow.draw(ctx, dt);
      ctx.globalAlpha = 1 - seg(t, 1.5, 5); ctx.drawImage(this.glow, 0, 0, W, H); ctx.globalAlpha = 1;
      // 太陽
      const sy = 600 + sink * 200;
      const grd = ctx.createRadialGradient(552, sy - 8, 5, 552, sy, 52);
      grd.addColorStop(0, '#ffb08a'); grd.addColorStop(1, '#e85a3a');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(552, sy, 52, 0, 7); ctx.fill();
      ctx.drawImage(this.front, 0, 0, W, H);
      // 天慢慢變黑
      ctx.fillStyle = '#060c26'; ctx.globalAlpha = 0.5 * seg(t, 1.8, 5.5); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      drawStars(ctx, this.stars, t, seg(t, 4, 6));
    },
  };

  // 2. 天一黑，月亮就出來了
  scenes.moonrise = {
    bg: '#14245a',
    build(S) {
      const hills = [[-20, 700], [180, 610], [430, 720], [650, 630], [900, 740], [1100, 640], [1230, 690]];
      this.sky = layer(S, (g) => paintSky(g, [920, 210], { reach: 800, seed: 13, swirl: 1.2, pale: 0.18 }));
      this.front = layer(S, (g) => paintMountain(g, hills, 51, { rim: 50, n: 1500 }));
      const rf = ridgeFn(hills);
      this.isSky = (x, y) => y < rf(x) - 10;
      this.stars = makeStars(7, 30, (x, y) => this.isSky(x, y) && Math.hypot(x - 920, y - 210) > 200);
      this.flow = makeFlow(19, 80, this.isSky, (x, y) => {
        const d = Math.hypot(x - 920, y - 210);
        return Math.atan2(y - 210, x - 920) + 1.2 * Math.exp(-d / 260) + noise(x, y) * 0.35;
      });
      this.S = S;
    },
    draw(ctx, t, dt) {
      const up = seg(t, 0.5, 4);
      ctx.drawImage(this.sky, 0, 0, W, H);
      ctx.fillStyle = '#060c26'; ctx.globalAlpha = 0.35 * (1 - up); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
      this.flow.draw(ctx, dt);
      drawStars(ctx, this.stars, t, 0.9);
      const mx = 980 - up * 60, my = 700 - up * 490;
      const pulse = 1 + Math.sin(t * 1.6) * 0.03;
      ctx.globalAlpha = 0.4 + 0.6 * up;
      drawSprite(ctx, moonSprite(this.S), mx, my, pulse, t * 0.05);
      ctx.globalAlpha = 1;
      ctx.drawImage(this.front, 0, 0, W, H);
    },
  };

  // 3. 月亮一出來，貓頭鷹就醒了
  scenes.owlwake = {
    bg: '#14245a',
    build(S) {
      this.S = S;
      const inFol = (x, y) => (x > 700 && y < 560 - (x - 700) * -0.2 && (x - 1200) ** 2 / (520 * 520) + (y - 200) ** 2 / (420 * 420) < 1);
      const inFol2 = (x, y) => ((x - 330) ** 2) / (330 * 330) + ((y - 800) ** 2) / (150 * 150) < 1;
      this.isSky = (x, y) => !inFol(x, y) && !inFol2(x, y) && x < 990;
      this.sky = layer(S, (g) => {
        paintSky(g, [230, 190], { reach: 900, seed: 23, swirl: 1.1, pale: 0.16 });
        g.fillStyle = '#24432a';
        foliage(g, inFol, 61, 2600);
        foliage(g, inFol2, 62, 1200);
      });
      this.front = layer(S, (g) => {
        trunk(g, 1000, 1110, 63);
        branch(g, 1030, 690, 380, 720, 34, 64);
        branch(g, 640, 712, 520, 650, 12, 65);
      });
      this.flow = makeFlow(29, 70, this.isSky, (x, y) => {
        const d = Math.hypot(x - 230, y - 190);
        return Math.atan2(y - 190, x - 230) + 1.1 * Math.exp(-d / 260) + noise(x, y) * 0.35;
      });
    },
    draw(ctx, t, dt) {
      ctx.drawImage(this.sky, 0, 0, W, H);
      this.flow.draw(ctx, dt);
      drawSprite(ctx, moonSprite(this.S), 230, 190, 1 + Math.sin(t * 1.6) * 0.03, t * 0.05);
      ctx.drawImage(this.front, 0, 0, W, H);
      // 醒來：先閉眼睡著（頭慢慢晃），1.6 秒眼睛張開，之後偶爾眨眼、看看四周
      const wake = seg(t, 1.6, 2.1);
      const sleepBob = (1 - wake) * Math.sin(t * 2) * 0.04;
      const open = wake < 1 ? wake : blink(t, 3.6, 0.5);
      const lk = t > 3 ? [Math.sin(t * 0.7) * 0.8, 0] : [0, 0];
      const k = Math.min(3, this.S * 1.2);
      const hop = t > 1.6 && t < 2.2 ? -Math.sin((t - 1.6) / 0.6 * Math.PI) * 14 : 0;
      drawOwl(ctx, k, 700, 560 + hop, 1.05, { open, look: lk, tilt: sleepBob + (t > 3 ? Math.sin(t * 0.7) * 0.05 : 0) });
      // 睡覺的 Zzz
      if (wake < 1) {
        ctx.fillStyle = '#e8eefc'; ctx.font = 'bold 40px sans-serif';
        for (let i = 0; i < 3; i++) {
          const u = ((t * 0.6 + i / 3) % 1);
          ctx.globalAlpha = Math.sin(u * Math.PI) * (1 - wake);
          ctx.fillText('z', 800 + u * 60 + i * 6, 420 - u * 90);
        }
        ctx.globalAlpha = 1;
      }
    },
  };

  // 4. 貓頭鷹一醒，小老鼠就躲起來了
  scenes.mousehide = {
    bg: '#14245a',
    build(S) {
      this.S = S;
      this.isSky = (x, y) => y < 400 && x > 150 && x < 560;
      this.back = layer(S, (g) => {
        paintSky(g, [420, 130], { reach: 700, seed: 33, swirl: 1.1, pale: 0.12, n: 3600 });
        paintGround(g, 470, 71);
        pine(g, 280, 560, 300, 72); pine(g, 440, 570, 360, 73);
        trunk(g, 40, 100, 74);
        branch(g, 70, 300, 240, 290, 16, 75);
        paintMound(g, 900, 760, 420, 380, [820, 730, 150, 130], 76);
        grass(g, 600, 560, 14, 77, 150); grass(g, 1100, 820, 10, 78, 90); grass(g, 640, 830, 8, 79, 80);
      });
      this.flow = makeFlow(39, 30, this.isSky, (x, y) => Math.atan2(y - 130, x - 420) + noise(x, y) * 0.35);
    },
    draw(ctx, t, dt) {
      ctx.drawImage(this.back, 0, 0, W, H);
      this.flow.draw(ctx, dt);
      drawSprite(ctx, moonSprite(this.S), 420, 130, 0.55 + Math.sin(t * 1.6) * 0.015, t * 0.05);
      // 遠處的貓頭鷹醒著
      drawOwl(ctx, this.S * 0.5, 165, 247, 0.32, { open: blink(t, 3.1, 0.2), look: [0.8, 0.2] });
      // 小老鼠：尾巴搖 → 鑽進洞 → 洞裡偷看
      const hide = seg(t, 2.0, 3.4);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(820, 730, 152, 132, 0, Math.PI, 2 * Math.PI); ctx.lineTo(972, 860); ctx.lineTo(668, 860); ctx.closePath(); ctx.clip();
      const mx = 820 + hide * 30, my = 760 - hide * 30, ms = 1 - hide * 0.55;
      furBlob(ctx, mx, my, 120 * ms, 86 * ms, 0, 81, 260, MOUSE_FUR);
      ctx.fillStyle = '#120c10'; ctx.globalAlpha = hide * 0.9; ctx.beginPath(); ctx.ellipse(mx, my, 125 * ms, 90 * ms, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
      const wig = Math.sin(t * 7) * 30 * (1 - hide);
      const tl = 1 - seg(t, 2.6, 3.6);
      if (tl > 0.02) {
        const ex = 715 - 260 * tl, ey = 800 + 20 * tl;
        tail(ctx, [715, 790, 715 - 90 * tl, 830 + wig * 0.3, 715 - 180 * tl, 830 - wig, ex, ey - 60 * tl + wig], 8);
      }
      // 洞裡的眼睛
      if (t > 4) {
        const o = blink(t, 2.8, 0);
        const peek = seg(t, 4, 4.6);
        ctx.fillStyle = '#fff6c8'; ctx.globalAlpha = peek;
        [[800, 680], [838, 680]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.ellipse(ex, ey, 9, 9 * o, 0, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#111'; [[802, 681], [840, 681]].forEach(([ex, ey]) => { ctx.beginPath(); ctx.ellipse(ex, ey, 4, 4 * o, 0, 0, 7); ctx.fill(); });
        ctx.globalAlpha = 1;
      }
    },
  };

  // 5. 因為貓頭鷹一找到小老鼠，就會把牠給吃了
  scenes.owlhunt = {
    bg: '#14245a',
    build(S) {
      this.S = S;
      this.isSky = (x, y) => y < 330;
      this.back = layer(S, (g) => {
        paintSky(g, [600, -100], { reach: 900, seed: 43, swirl: 0.6, pale: 0.0, n: 3000 });
        paintGround(g, 330, 81);
        paintMound(g, 1020, 700, 420, 480, [1000, 640, 170, 170], 82);
        grass(g, 760, 330, 12, 83, 200); grass(g, 1100, 830, 10, 84, 90);
      });
      this.flow = makeFlow(49, 30, this.isSky, (x, y) => 0.2 + noise(x, y) * 0.5);
    },
    draw(ctx, t, dt) {
      ctx.drawImage(this.back, 0, 0, W, H);
      this.flow.draw(ctx, dt);
      // 貓頭鷹張開翅膀撲過來
      const k = Math.min(4, this.S * 2);
      const flap = 0.45 + Math.sin(t * 5) * 0.4;
      const lean = Math.sin(t * 2.5) * 10;
      drawOwl(ctx, k, 280 + lean, 610, 1.6, { open: 1, wide: true, look: [0.9, 0.2], beak: true, wings: flap });
      // 小老鼠嚇得跳起來
      const jump = Math.abs(Math.sin(t * 5.5)) * 34;
      drawMouse(ctx, 980, 650 - jump, 0.95, t, { shock: true });
    },
  };

  // 封面：貓頭鷹在樹上
  scenes.cover = {
    bg: '#14245a',
    build(S) { scenes.owlwake.build.call(this, S); },
    draw(ctx, t, dt) {
      ctx.drawImage(this.sky, 0, 0, W, H);
      this.flow.draw(ctx, dt);
      drawSprite(ctx, moonSprite(this.S), 230, 190, 1 + Math.sin(t * 1.6) * 0.03, t * 0.05);
      ctx.drawImage(this.front, 0, 0, W, H);
      drawOwl(ctx, Math.min(3, this.S * 1.2), 700, 560, 1.05, { open: blink(t, 3.2, 1), look: [Math.sin(t * 0.6) * 0.7, 0], tilt: Math.sin(t * 0.6) * 0.05 });
    },
  };
  // 讀完：月亮＋星星，貓頭鷹眨眼
  scenes.end = scenes.cover;

  window.Scenes = { W, H, list: scenes };
})();
