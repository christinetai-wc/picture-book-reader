// 《下雨了》《看一看、想一想》：用原書插畫（tools/make_pages.py 裁好），上面疊會動的效果。
// 效果的位置用「原書半頁 0~1 座標」寫，P(x,y) 換成畫面座標。
(function () {
  const { W, H, list } = window.Scenes;
  const IM = window.PAGE_IMGS;
  const TAU = Math.PI * 2;

  const cache = {};
  function img(src) {
    if (!cache[src]) {
      const i = new Image(); i.decoding = 'async';
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
  const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU); };

  // ---------- 效果 ----------
  function makeRain(n, seed, slant = 0.12) {
    const r = rng(seed), d = [];
    for (let i = 0; i < n; i++) d.push({ x: r() * (W + 300), y: r() * H, v: 520 + r() * 300, l: 36 + r() * 36 });
    return (ctx, t, alpha = 0.75) => {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + alpha + ')'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
      for (const q of d) {
        const y = (q.y + t * q.v) % (H + 100) - 50, x = ((q.x - (y + 50) * slant) % (W + 300) + W + 300) % (W + 300) - 150;
        ctx.moveTo(x, y); ctx.lineTo(x - q.l * slant, y + q.l);
      }
      ctx.stroke(); ctx.restore();
    };
  }
  const RAIN = makeRain(80, 7), RAIN2 = makeRain(50, 8, 0.05);
  function clipRect(ctx, P, x0, y0, x1, y1, outside) {
    const [ax, ay] = P(x0, y0), [bx, by] = P(x1, y1);
    ctx.beginPath(); if (outside) ctx.rect(0, 0, W, H); ctx.rect(ax, ay, bx - ax, by - ay); ctx.clip(outside ? 'evenodd' : 'nonzero');
  }
  function ripples(ctx, t, pts, P, L) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5;
    pts.forEach(([x, y, ph]) => {
      const u = (t * 0.8 + ph) % 1, [px, py] = P(x, y), r = L(0.012 + u * 0.05);
      ctx.globalAlpha = 1 - u; ell(ctx, px, py, r, r * 0.3); ctx.stroke();
    });
    ctx.restore();
  }
  function drops(ctx, t, pts, P, L, col = ['#bfe6ff', '#5aa6d8'], fall = 0.08, speed = 0.8) {
    ctx.save(); ctx.fillStyle = col[0]; ctx.strokeStyle = col[1]; ctx.lineWidth = 2;
    pts.forEach(([x, y, ph, sz]) => {
      const u = (t * speed + ph) % 1, [px, py0] = P(x, y), py = py0 + L(fall) * u, s = L(sz || 0.014);
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.6) * Math.min(1, u * 6);
      ctx.beginPath(); ctx.moveTo(px, py - s * 1.6); ctx.quadraticCurveTo(px + s, py + s * 0.3, px, py + s);
      ctx.quadraticCurveTo(px - s, py + s * 0.3, px, py - s * 1.6); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }
  function floaters(ctx, t, pts, P, L, drawOne, rise = 0.18, speed = 0.3) {
    pts.forEach(([x, y, ph, s], i) => {
      const u = (t * speed + ph) % 1, [px, py] = P(x, y);
      ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI);
      ctx.translate(px + Math.sin(u * 6 + i) * L(0.02), py - L(rise) * u); ctx.rotate(Math.sin(u * 5 + i) * 0.25);
      drawOne(ctx, L(s || 0.05), i); ctx.restore();
    });
  }
  function heart(ctx, s, fill, stroke) {
    ctx.beginPath(); ctx.moveTo(0, s * 0.35); ctx.bezierCurveTo(-s, -s * 0.25, -s * 0.55, -s, 0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.55, -s, s, -s * 0.25, 0, s * 0.35); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
  }
  function sparkle(ctx, s, col = '#fff6b0') {
    ctx.fillStyle = col; ctx.strokeStyle = '#e8a83a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(0, 0, s, 0); ctx.quadraticCurveTo(0, 0, 0, s); ctx.quadraticCurveTo(0, 0, -s, 0); ctx.quadraticCurveTo(0, 0, 0, -s); ctx.fill(); ctx.stroke();
  }
  function twinkles(ctx, t, pts, P, L) {
    pts.forEach(([x, y, ph, s]) => {
      const k = 0.5 + 0.5 * Math.sin(t * 3 + ph * TAU), [px, py] = P(x, y);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(px, py); ctx.rotate(t * 0.8 + ph); sparkle(ctx, L(s || 0.03) * (0.6 + 0.4 * k)); ctx.restore();
    });
  }
  function lines(ctx, t, groups, P, L, col = '#ffffff', w = 5) {
    // 一組組閃動的短線（叫聲、發抖）
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    groups.forEach(([x, y, ang, ph]) => {
      const k = Math.max(0, Math.sin(t * 9 + ph * TAU)), [px, py] = P(x, y);
      ctx.globalAlpha = k;
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.45, r0 = L(0.02), r1 = L(0.02 + 0.035 * (0.6 + 0.4 * k));
        ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * r0, py + Math.sin(a) * r0); ctx.lineTo(px + Math.cos(a) * r1, py + Math.sin(a) * r1); ctx.stroke();
      }
    });
    ctx.restore();
  }
  const snowFlakes = (() => { const r = rng(41); return Array.from({ length: 60 }, () => [r() * W, r() * H, 3 + r() * 7, 25 + r() * 45]); })();
  function snow(ctx, t) {
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.9)';
    snowFlakes.forEach(([x, y, r, v]) => { ell(ctx, x + Math.sin(t * 0.8 + y) * 18, (y + t * v) % H, r, r); ctx.fill(); });
    ctx.restore();
  }

  // ---------- 場景 ----------
  function photo(book, n, fx = {}) {
    const m = IM[book][n - 1];
    const P = (x, y) => [m.a[0] * x + m.a[1], m.b[0] * y + m.b[1]];
    const L = (v) => m.a[0] * v;
    return {
      bg: '#000',
      get ready() { return img(m.src).p; },
      build() { img(m.src); },
      draw(ctx, t, dt) {
        const im = img(m.src).i;
        // 慢慢呼吸的鏡頭（輕微放大縮小），效果跟著一起動
        const z = 1 + 0.03 * (0.5 - 0.5 * Math.cos(t * 0.35));
        const [fx0, fy0] = fx.focus ? P(...fx.focus) : [W / 2, H / 2];
        ctx.save(); ctx.translate(fx0, fy0); ctx.scale(z, z); ctx.translate(-fx0, -fy0);
        if (im.complete && im.naturalWidth) ctx.drawImage(im, 0, 0, W, H);
        if (fx.draw) fx.draw(ctx, t, P, L);
        ctx.restore();
      },
    };
  }
  function prefetch() { for (const b in IM) IM[b].forEach((m) => img(m.src)); }

  // 下雨了
  list.r1 = photo('rain', 1, { focus: [0.55, 0.4], draw(ctx, t, P) { ctx.save(); clipRect(ctx, P, 0.27, 0.2, 0.88, 0.74, true); RAIN(ctx, t); ctx.restore(); } });
  list.r2 = photo('rain', 2, { focus: [0.5, 0.45], draw(ctx, t, P) { ctx.save(); clipRect(ctx, P, 0.42, 0.1, 0.92, 0.58); RAIN2(ctx, t, 0.8); ctx.restore(); } });
  list.r3 = photo('rain', 3, {
    focus: [0.6, 0.6],
    draw(ctx, t, P, L) { ripples(ctx, t, [[0.12, 0.84, 0], [0.22, 0.85, 0.5], [0.48, 0.83, 0.25], [0.55, 0.84, 0.75], [0.35, 0.9, 0.4]], P, L); RAIN(ctx, t); },
  });
  list.r4 = photo('rain', 4, { focus: [0.65, 0.35], draw(ctx, t, P) { ctx.save(); clipRect(ctx, P, 0, 0, 0.44, 0.86); RAIN(ctx, t, 0.85); ctx.restore(); } });
  list.r5 = photo('rain', 5, {
    focus: [0.35, 0.45],
    draw(ctx, t, P, L) {
      ripples(ctx, t, [[0.25, 0.68, 0], [0.42, 0.66, 0.35], [0.15, 0.62, 0.7], [0.55, 0.7, 0.5]], P, L);
      // 踩水濺起的水花
      const u = (t * 1.1) % 1, [fx0, fy0] = P(0.42, 0.62);
      ctx.save(); ctx.fillStyle = 'rgba(220,240,255,.95)'; ctx.strokeStyle = '#7fb3d8'; ctx.lineWidth = 2; ctx.globalAlpha = 1 - u;
      for (let i = 0; i < 8; i++) { const a = -Math.PI * (0.1 + i * 0.11); ell(ctx, fx0 + Math.cos(a) * L(0.12) * u, fy0 + Math.sin(a) * L(0.1) * u + L(0.08) * u * u, L(0.008), L(0.012), a); ctx.fill(); ctx.stroke(); }
      ctx.restore();
      RAIN(ctx, t);
    },
  });
  list.r6 = photo('rain', 6, { focus: [0.45, 0.5], draw(ctx, t, P) { ctx.save(); clipRect(ctx, P, 0.42, 0.12, 0.8, 0.52); RAIN2(ctx, t, 0.8); ctx.restore(); } });
  list.r7 = photo('rain', 7, { focus: [0.6, 0.6], draw(ctx, t, P) { ctx.save(); clipRect(ctx, P, 0.6, 0.22, 0.86, 0.56); RAIN2(ctx, t, 0.8); ctx.restore(); } });
  const HEARTS = (() => { const r = rng(5); return Array.from({ length: 10 }, () => [0.05 + r() * 0.9, 0.95, r(), 0.03 + r() * 0.03]); })();
  const hugFx = (focus) => ({
    focus,
    draw(ctx, t, P, L) { floaters(ctx, t, HEARTS, P, L, (c, s, i) => heart(c, s, i % 3 ? null : 'rgba(255,190,200,.6)', '#e0606e'), 0.8, 0.12); },
  });
  list.r8 = photo('rain', 8, hugFx([0.5, 0.45]));
  list.r9 = photo('rain', 9, hugFx([0.55, 0.5]));
  list.rcover = list.r5;

  // 看一看、想一想
  list.k1 = photo('look', 1, {
    focus: [0.5, 0.35],
    draw(ctx, t, P, L) {
      floaters(ctx, t, [[0.08, 0.45, 0, 0.07], [0.9, 0.35, 0.33, 0.06], [0.12, 0.7, 0.66, 0.06], [0.88, 0.62, 0.15, 0.05]], P, L, (c, s, i) => {
        c.font = 'bold ' + Math.round(s * 1.6) + 'px serif'; c.fillStyle = ['#f6d34a', '#f59ac0', '#ffd27a', '#9ad0f5'][i]; c.strokeStyle = '#5b4033'; c.lineWidth = 2;
        const ch = ['♫', '♪', '♪', '♩'][i]; c.fillText(ch, 0, 0); c.strokeText(ch, 0, 0);
      }, 0.25, 0.3);
    },
  });
  list.k2 = photo('look', 2, { focus: [0.5, 0.35], draw(ctx, t, P, L) { drops(ctx, t, [[0.63, 0.44, 0, 0.016], [0.61, 0.4, 0.5, 0.012]], P, L, ['#bfe6ff', '#5aa6d8'], 0.12, 0.7); } });
  list.k3 = photo('look', 3, {
    focus: [0.5, 0.35],
    draw(ctx, t, P, L) {
      const [sx, sy] = P(0.06, 0.06), k = 0.5 + 0.5 * Math.sin(t * 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, L(0.25));
      g.addColorStop(0, 'rgba(255,200,80,' + (0.25 + 0.2 * k) + ')'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
      drops(ctx, t, [[0.67, 0.3, 0, 0.014], [0.36, 0.42, 0.4, 0.012], [0.7, 0.18, 0.7, 0.011]], P, L, ['#dff3ff', '#5aa6d8'], 0.07, 0.7);
      drops(ctx, t, [[0.57, 0.62, 0.2, 0.01]], P, L, ['#f7a6bf', '#d0587a'], 0.1, 0.6);
    },
  });
  list.k4 = photo('look', 4, {
    focus: [0.5, 0.4],
    draw(ctx, t, P, L) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const [ax, ay] = P(0, 0.12), [bx] = P(1, 0);
      ctx.beginPath(); ctx.moveTo(ax, ay);
      for (let x = ax; x <= bx; x += 30) ctx.lineTo(x, ay + Math.sin(x * 0.008 + t * 0.9) * L(0.04));
      for (let x = bx; x >= ax; x -= 30) ctx.lineTo(x, ay + L(0.12) + Math.sin(x * 0.006 + t * 0.7) * L(0.05));
      ctx.fillStyle = 'rgba(100,230,170,' + (0.08 + 0.06 * Math.sin(t * 1.3)) + ')'; ctx.fill(); ctx.restore();
      lines(ctx, t * 1.4, [[0.2, 0.5, Math.PI, 0], [0.82, 0.3, 0, 0.5], [0.85, 0.65, 0, 0.25]], P, L, '#ffffff', 5);
      snow(ctx, t);
    },
  });
  list.k5 = photo('look', 5, { focus: [0.45, 0.5], draw(ctx, t, P, L) { twinkles(ctx, t, [[0.22, 0.42, 0, 0.035], [0.4, 0.38, 0.4, 0.03], [0.3, 0.33, 0.7, 0.025], [0.49, 0.5, 0.2, 0.03]], P, L); } });
  list.k6 = photo('look', 6, {
    focus: [0.5, 0.55],
    draw(ctx, t, P, L) {
      const [cx, cy] = P(0.865, 0.175), a = t * 1.0;
      ctx.save(); ctx.strokeStyle = '#d8434a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(a) * L(0.035), cy - Math.cos(a) * L(0.035)); ctx.stroke(); ctx.restore();
      lines(ctx, t, [[0.47, 0.58, -0.6, 0]], P, L, '#c9393f', 4);
    },
  });
  list.k7 = photo('look', 7, { focus: [0.5, 0.45], draw(ctx, t, P, L) { twinkles(ctx, t, [[0.935, 0.07, 0, 0.04]], P, L); } });
  list.k8 = photo('look', 8, {
    focus: [0.45, 0.5],
    draw(ctx, t, P, L) {
      floaters(ctx, t, [[0.7, 0.8, 0, 0.025], [0.78, 0.75, 0.3, 0.018], [0.62, 0.78, 0.6, 0.02], [0.85, 0.82, 0.8, 0.022]], P, L, (c, s) => {
        ell(c, 0, 0, s, s); c.fillStyle = 'rgba(200,235,255,.35)'; c.fill(); c.strokeStyle = 'rgba(90,160,210,.8)'; c.lineWidth = 2; c.stroke();
        ell(c, -s * 0.35, -s * 0.35, s * 0.2, s * 0.2); c.fillStyle = '#fff'; c.fill();
      }, 0.35, 0.25);
    },
  });
  list.k9 = photo('look', 9, {
    focus: [0.5, 0.55],
    draw(ctx, t, P, L) {
      lines(ctx, t, [[0.3, 0.62, -0.3, 0], [0.3, 0.62, 0.3, 0.5]], P, L, '#c9393f', 5);
      lines(ctx, t * 1.6, [[0.59, 0.38, Math.PI, 0.2], [0.82, 0.42, 0, 0.7]], P, L, '#5b4033', 4);
    },
  });
  list.k10 = photo('look', 10, {
    focus: [0.45, 0.6],
    draw(ctx, t, P, L) {
      floaters(ctx, t, [[0.3, 0.5, 0, 0.03], [0.38, 0.48, 0.4, 0.025], [0.25, 0.52, 0.75, 0.02]], P, L, (c, s) => heart(c, s, '#f37b8f', '#c9455a'), 0.16, 0.35);
    },
  });
  list.kcover = list.k1;

  window.PhotoScenes = { prefetch, ready: (key) => (list[key] && list[key].ready) || Promise.resolve() };
})();
