// 流程：進頁 → 動畫＋示範朗讀（字一個一個亮）→ 換你念（麥克風）→ 評分 → 過關翻頁
(function () {
  const $ = (s) => document.querySelector(s);
  const { W, H, list: SCENES } = window.Scenes;
  const BOOK = window.BOOK;

  // ---------- 設定（家長用，長按右上角齒輪） ----------
  const DEFAULTS = { threshold: 0.8, maxTries: 3, rate: 0.85 };
  let cfg = { ...DEFAULTS };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('pbr-cfg') || '{}')); } catch (e) {}
  const saveCfg = () => { try { localStorage.setItem('pbr-cfg', JSON.stringify(cfg)); } catch (e) {} };

  // ---------- 畫布 ----------
  const canvas = $('#stage'), ctx = canvas.getContext('2d');
  let scene = null, sceneKey = '', sceneT0 = 0, lastNow = 0, S = 1, fitScale = 1;
  function resize() {
    const wrap = $('#stageWrap'), r = wrap.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const cw = Math.floor(W * s), ch = Math.floor(H * s);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    fitScale = canvas.width / W;
    const newS = Math.min(2, Math.max(0.5, Math.round(fitScale * 4) / 4));
    if (newS !== S) { S = newS; if (scene) { scene.build(S); } }
    $('#fx').style.width = cw + 'px'; $('#fx').style.height = ch + 'px';
  }
  function setScene(key, restart = true) {
    const sc = SCENES[key];
    if (key !== sceneKey || !sc._S || sc._S !== S) { sc.build(S); sc._S = S; }
    scene = sc; sceneKey = key;
    if (restart) sceneT0 = performance.now();
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - (lastNow || now)) / 1000); lastNow = now;
    if (scene) {
      ctx.setTransform(fitScale, 0, 0, fitScale, 0, 0);
      ctx.fillStyle = scene.bg; ctx.fillRect(0, 0, W, H);
      scene.draw(ctx, (now - sceneT0) / 1000, dt);
    }
    requestAnimationFrame(frame);
  }

  // ---------- 狀態 ----------
  let pageIdx = -1, segIdx = 0, tries = 0, mode = 'cover', passedPage = false;
  const PAGES = BOOK.pages;
  const sentenceEl = $('#sentence'), micBtn = $('#mic'), replayBtn = $('#replay'), nextBtn = $('#next'), heardEl = $('#heard');
  let charEls = []; // 每段的漢字 span：charEls[seg][k]

  function renderSentence() {
    sentenceEl.innerHTML = ''; charEls = [];
    if (pageIdx < 0 || pageIdx >= PAGES.length) return;
    PAGES[pageIdx].segs.forEach((text, si) => {
      const segEl = document.createElement('span'); segEl.className = 'seg'; segEl.dataset.seg = si;
      const arr = [];
      for (const c of text) {
        const sp = document.createElement('span'); sp.textContent = c;
        if (Speech.hanOnly(c).length) { sp.className = 'ch'; arr.push(sp); segEl.appendChild(sp); continue; }
        sp.className = 'punct';
        // 標點黏住前一個字，避免「。」自己掉到下一行
        const prev = segEl.lastChild;
        if (prev && prev.classList.contains('ch')) {
          const nw = document.createElement('span'); nw.className = 'nw';
          segEl.replaceChild(nw, prev); nw.append(prev, sp);
        } else segEl.appendChild(sp);
      }
      charEls.push(arr); sentenceEl.appendChild(segEl);
      if (si < PAGES[pageIdx].segs.length - 1) sentenceEl.appendChild(document.createElement('wbr'));
    });
    markSegs();
  }
  function markSegs() {
    sentenceEl.querySelectorAll('.seg').forEach((el, i) => {
      el.classList.toggle('done', i < segIdx); el.classList.toggle('now', i === segIdx);
    });
  }
  function karaoke(k) {
    (charEls[segIdx] || []).forEach((el, i) => { el.classList.toggle('lit', i < k); el.classList.toggle('reading', i === k); });
  }
  function clearMarks() {
    (charEls[segIdx] || []).forEach((el) => el.classList.remove('lit', 'reading', 'hit', 'miss'));
  }
  function renderDots() {
    const d = $('#dots'); d.innerHTML = '';
    PAGES.forEach((p, i) => {
      const s = document.createElement('span');
      s.className = 'dot' + (i < pageIdx ? ' done' : '') + (i === pageIdx ? ' now' : '');
      d.appendChild(s);
    });
  }

  function setMode(m) {
    mode = m; document.body.dataset.mode = m;
    micBtn.classList.toggle('ready', m === 'turn');
    micBtn.classList.toggle('listening', m === 'listening');
    micBtn.disabled = !(m === 'turn' || m === 'listening');
    replayBtn.disabled = m !== 'turn';
    nextBtn.hidden = !(passedPage || tries >= cfg.maxTries) || mode === 'cover' || mode === 'end';
  }

  // ---------- 頁面流程 ----------
  function goCover() {
    Speech.stopSaying(); Speech.stopListening();
    pageIdx = -1; passedPage = false; setScene('cover'); renderSentence(); renderDots();
    setMode('cover');
  }
  function goPage(i) {
    Speech.stopSaying(); Speech.stopListening();
    if (i >= PAGES.length) return goEnd();
    pageIdx = i; segIdx = 0; tries = 0; passedPage = false;
    try { localStorage.setItem('pbr-page-' + BOOK.id, String(i)); } catch (e) {}
    setScene(PAGES[i].scene); renderSentence(); renderDots(); heardEl.textContent = '';
    setMode('demo');
    setTimeout(() => { if (pageIdx === i && mode === 'demo') demo(); }, 900);
  }
  function goEnd() {
    pageIdx = PAGES.length; setScene('end'); renderSentence(); renderDots(); setMode('end');
    celebrate(true);
    Speech.say('讀完了！好棒！', { rate: cfg.rate });
  }

  async function demo() {
    const myPage = pageIdx, mySeg = segIdx;
    setMode('demo'); clearMarks(); heardEl.textContent = '';
    const text = PAGES[pageIdx].segs[segIdx];
    await Speech.say(text, { rate: cfg.rate, onChar: karaoke });
    if (pageIdx !== myPage || segIdx !== mySeg || mode !== 'demo') return;
    await sleep(350);
    karaoke(-1); (charEls[segIdx] || []).forEach((el) => el.classList.add('lit'));
    chime([660, 880]);
    setMode('turn');
  }

  async function onMic() {
    if (mode === 'listening') { Speech.stopListening(); return; }
    if (mode !== 'turn') return;
    Speech.stopSaying();
    if (!Speech.canListen) { // 不能辨識的瀏覽器：家長聽，按一下就算過
      return judge(1, null);
    }
    setMode('listening'); heardEl.textContent = '';
    let alts;
    try {
      alts = await Speech.listen({ onInterim: (s) => (heardEl.textContent = s) });
    } catch (e) {
      setMode('turn');
      heardEl.textContent = e.code === 'not-allowed' ? '要先允許使用麥克風喔' : '麥克風打不開，再按一次';
      return;
    }
    if (!alts.length) {
      setMode('turn'); heardEl.textContent = '沒聽到耶，大聲一點再說一次';
      Speech.say('沒聽到耶，再說一次', { rate: cfg.rate });
      return;
    }
    const text = PAGES[pageIdx].segs[segIdx];
    let best = { score: -1 }, bestAlt = '';
    for (const a of alts) { const r = Speech.score(text, a); if (r.score > best.score) { best = r; bestAlt = a; } }
    heardEl.textContent = '聽到：' + bestAlt;
    judge(best.score, best.hit);
  }

  async function judge(sc, hit) {
    const els = charEls[segIdx] || [];
    els.forEach((el, i) => { el.classList.remove('lit', 'reading'); el.classList.add(!hit || hit[i] ? 'hit' : 'miss'); });
    setMode('result');
    if (sc >= cfg.threshold) {
      celebrate(sc >= 0.95);
      chime([523, 659, 784, 1047]);
      const myPage = pageIdx;
      await sleep(400);
      await Speech.say(pickPraise(), { rate: cfg.rate });
      if (pageIdx !== myPage) return;
      els.forEach((el) => { el.classList.remove('miss'); el.classList.add('hit'); });
      segIdx++; tries = 0;
      if (segIdx < PAGES[pageIdx].segs.length) { markSegs(); demo(); }
      else { passedPage = true; segIdx = PAGES[pageIdx].segs.length - 1; setMode('result'); await sleep(700); if (pageIdx === myPage) goPage(pageIdx + 1); }
    } else {
      tries++;
      const myPage = pageIdx, mySeg = segIdx;
      await sleep(500);
      await Speech.say(tries >= cfg.maxTries ? '沒關係，我們看下一頁' : '差一點點，再聽一次', { rate: cfg.rate });
      if (pageIdx !== myPage || segIdx !== mySeg) return;
      if (tries >= cfg.maxTries) { setMode('result'); nextBtn.hidden = false; nextBtn.classList.add('bounce'); return; }
      demo();
    }
  }
  const PRAISE = ['好棒！', '念得真好！', '太厲害了！', '好棒喔！'];
  const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];

  function onNext() {
    if (mode === 'cover') return;
    nextBtn.classList.remove('bounce');
    if (pageIdx < PAGES.length - 1 && segIdx < PAGES[pageIdx].segs.length - 1 && !passedPage) {
      // 跳過這一段
      segIdx++; tries = 0; markSegs(); setMode('demo'); demo(); return;
    }
    goPage(pageIdx + 1);
  }

  // ---------- 效果 ----------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let actx = null;
  function chime(freqs) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime + i * 0.09;
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.55);
      });
    } catch (e) {}
  }
  function celebrate(big) {
    const fx = $('#fx'), n = big ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'); s.className = 'star';
      s.textContent = ['★', '✦', '★', '✧'][i % 4];
      s.style.left = 50 + (Math.random() - 0.5) * 20 + '%'; s.style.top = '55%';
      s.style.setProperty('--dx', (Math.random() - 0.5) * 140 + 'vmin');
      s.style.setProperty('--dy', -(20 + Math.random() * 50) + 'vmin');
      s.style.setProperty('--rot', (Math.random() - 0.5) * 720 + 'deg');
      s.style.color = ['#ffd84a', '#fff3b0', '#ffb347', '#ffffff'][i % 4];
      s.style.fontSize = 4 + Math.random() * 5 + 'vmin';
      fx.appendChild(s); setTimeout(() => s.remove(), 1600);
    }
  }

  // ---------- 家長設定 ----------
  function openSettings() {
    const d = $('#settings');
    $('#setThreshold').value = Math.round(cfg.threshold * 100); $('#vThreshold').textContent = Math.round(cfg.threshold * 100) + '%';
    $('#setTries').value = cfg.maxTries; $('#vTries').textContent = cfg.maxTries;
    $('#setRate').value = cfg.rate; $('#vRate').textContent = cfg.rate;
    $('#srNote').textContent = Speech.canListen ? '這台裝置可以語音辨識。' : '⚠️ 這個瀏覽器不能語音辨識：小孩念完按麥克風就直接過關（請大人聽）。';
    d.showModal();
  }
  function bindSettings() {
    const g = $('#gear'); let timer = null;
    const start = (e) => { e.preventDefault(); g.classList.add('hold'); timer = setTimeout(() => { g.classList.remove('hold'); openSettings(); }, 1000); };
    const cancel = () => { clearTimeout(timer); g.classList.remove('hold'); };
    g.addEventListener('pointerdown', start); g.addEventListener('pointerup', cancel); g.addEventListener('pointerleave', cancel);
    $('#setThreshold').oninput = (e) => { cfg.threshold = e.target.value / 100; $('#vThreshold').textContent = e.target.value + '%'; saveCfg(); };
    $('#setTries').oninput = (e) => { cfg.maxTries = +e.target.value; $('#vTries').textContent = e.target.value; saveCfg(); };
    $('#setRate').oninput = (e) => { cfg.rate = +e.target.value; $('#vRate').textContent = e.target.value; saveCfg(); };
    $('#closeSettings').onclick = () => $('#settings').close();
    $('#simForm').onsubmit = (e) => {
      e.preventDefault();
      const s = $('#simText').value; $('#settings').close();
      if (mode !== 'turn') { heardEl.textContent = '（等麥克風亮起來再測）'; return; }
      const r = Speech.score(PAGES[pageIdx].segs[segIdx], s);
      heardEl.textContent = '測試：' + s + '（' + Math.round(r.score * 100) + '%）';
      judge(r.score, r.hit);
    };
    $('#jump').onchange = (e) => { const v = +e.target.value; $('#settings').close(); v < 0 ? goCover() : goPage(v); };
    const sel = $('#jump');
    PAGES.forEach((p, i) => { const o = document.createElement('option'); o.value = i; o.textContent = '第 ' + (i + 1) + ' 頁：' + p.segs.join(''); sel.appendChild(o); });
  }

  // ---------- 開始 ----------
  function init() {
    resize(); setScene('cover'); requestAnimationFrame(frame);
    window.addEventListener('resize', () => { resize(); });
    $('#start').onclick = () => {
      // iOS：第一次點擊時解鎖聲音
      chime([440]);
      if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(''); speechSynthesis.speak(u); }
      $('#start').disabled = true;
      // 等書名念完再翻頁（之前固定等 1.2 秒，會把「天黑了」切掉）
      Speech.say(BOOK.title, { rate: cfg.rate }).then(() => sleep(300)).then(() => { $('#start').disabled = false; goPage(0); });
    };
    $('#again').onclick = () => goPage(0);
    micBtn.onclick = onMic;
    replayBtn.onclick = () => { if (mode === 'turn') demo(); };
    nextBtn.onclick = onNext;
    $('#home').onclick = goCover;
    bindSettings();
    goCover();
    window.PBR = { goPage, goCover, goEnd, setScene }; // 除錯用
  }
  init();
})();
