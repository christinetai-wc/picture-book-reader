// 語音：示範朗讀（音檔優先，沒有就用瀏覽器 TTS）＋ 跟念辨識 ＋ 評分
(function () {
  // ---------- 評分 ----------
  const isHan = (c) => /\p{Script=Han}/u.test(c);
  const hanOnly = (s) => [...(s || '')].filter(isHan);

  // 小小孩、台灣口音常混的音都當一樣：捲舌、n/l、前後鼻音
  function normSyl(s) {
    return s.replace(/^zh/, 'z').replace(/^ch/, 'c').replace(/^sh/, 's').replace(/^n(?!g)/, 'l')
      .replace(/ing$/, 'in').replace(/eng$/, 'en').replace(/ü/g, 'v')
      .replace(/^(la|lo|lou)$/, 'le'); // 句尾 了/啦/囉 都算
  }
  function syls(chars) {
    const P = window.pinyinPro;
    if (!P || !chars.length) return chars.slice();
    let arr = P.pinyin(chars.join(''), { toneType: 'none', type: 'array' });
    if (arr.length !== chars.length) arr = chars.map((c) => P.pinyin(c, { toneType: 'none' }));
    return arr.map(normSyl);
  }

  // 回傳 { score: 0..1, hit: [true/false 每個目標漢字] }
  function score(target, heard) {
    const T = hanOnly(target), Hc = hanOnly(heard);
    if (!T.length) return { score: 1, hit: [] };
    const ts = syls(T), hs = syls(Hc);
    const n = T.length, m = Hc.length;
    const eq = (i, j) => T[i] === Hc[j] || ts[i] === hs[j];
    // 最長共同子序列（多念的字不扣分，漏念才扣）
    const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = eq(i, j) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hit = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (eq(i, j) && dp[i][j] === dp[i + 1][j + 1] + 1) { hit[i] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { score: dp[0][0] / n, hit };
  }

  // ---------- 辨識 ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let current = null;
  // 回傳 Promise<string[]> 候選句子（可能是空陣列＝沒聽到）
  function listen({ lang = 'zh-TW', onInterim, maxMs = 9000 } = {}) {
    return new Promise((resolve, reject) => {
      if (!SR) return reject({ code: 'unsupported' });
      const rec = new SR();
      current = rec;
      rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
      let finals = [''], last = '', done = false;
      const timer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, maxMs);
      rec.onresult = (ev) => {
        let interim = '';
        const alts = [];
        let fixed = '';
        for (let k = 0; k < ev.results.length; k++) {
          const res = ev.results[k];
          if (res.isFinal) {
            if (k === ev.results.length - 1) for (let a = 0; a < res.length; a++) alts.push(fixed + res[a].transcript);
            fixed += res[0].transcript;
          } else interim += res[0].transcript;
        }
        last = fixed + interim;
        if (alts.length) finals = alts;
        onInterim && onInterim(last);
      };
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer); current = null;
        const out = finals.filter(Boolean);
        if (!out.length && last) out.push(last);
        resolve(out);
      };
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          done = true; clearTimeout(timer); current = null; reject({ code: 'not-allowed' });
        }
      };
      rec.onend = finish;
      try { rec.start(); } catch (e) { done = true; clearTimeout(timer); reject({ code: 'start-failed', e }); }
    });
  }
  function stopListening() { if (current) try { current.stop(); } catch (e) {} }

  // ---------- 示範朗讀 ----------
  let audioEl = null, speakToken = 0;
  function zhVoice() {
    const vs = speechSynthesis.getVoices();
    return vs.find((v) => /zh[-_]TW/i.test(v.lang)) || vs.find((v) => /zh[-_]HK/i.test(v.lang)) || vs.find((v) => /^zh/i.test(v.lang));
  }
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};

  // text：顯示的句子；clip：{src, start, end, times:[每個漢字開始秒數]}；onChar(i)：念到第 i 個漢字
  function say(text, { clip, rate = 0.85, onChar } = {}) {
    stopSaying();
    clip = clip || (window.CLIPS || {})[hanOnly(text).join('')]; // 有 Gemini 音檔就用；key＝去掉標點的句子
    const token = ++speakToken;
    const n = hanOnly(text).length;
    return new Promise((resolve) => {
      const end = () => { if (token === speakToken) { onChar && onChar(n); resolve(); } };
      if (clip && clip.src) {
        if (!audioEl) audioEl = new Audio();
        audioEl.src = clip.src; audioEl.currentTime = clip.start || 0; audioEl.playbackRate = 1;
        const tick = () => {
          if (token !== speakToken) return;
          const t = audioEl.currentTime;
          if (clip.end && t >= clip.end) { audioEl.pause(); return end(); }
          if (clip.times && onChar) { let k = 0; while (k < clip.times.length && clip.times[k] <= t) k++; onChar(k); }
          requestAnimationFrame(tick);
        };
        audioEl.onended = end;
        audioEl.play().then(tick).catch(() => sayTTS());
        return;
      }
      sayTTS();
      function sayTTS() {
        if (!('speechSynthesis' in window)) return estimate();
        const u = new SpeechSynthesisUtterance(text);
        const v = zhVoice(); if (v) u.voice = v;
        u.lang = 'zh-TW'; u.rate = rate; u.pitch = 1.1;
        let started = 0, gotBoundary = false;
        u.onstart = () => { started = performance.now(); fake(); };
        u.onboundary = (e) => {
          if (!onChar) return; gotBoundary = true;
          onChar(hanOnly(text.slice(0, e.charIndex + (e.charLength || 1))).length);
        };
        u.onend = end; u.onerror = end;
        // 沒有 boundary 事件時，用估計的速度亮字
        function fake() {
          const per = 0.3 / rate;
          const step = () => {
            if (token !== speakToken || gotBoundary) return;
            onChar && onChar(Math.min(n - 1, Math.floor((performance.now() - started) / 1000 / per)));
            requestAnimationFrame(step);
          };
          step();
        }
        speechSynthesis.speak(u);
        // iOS 有時 onend 不會來
        setTimeout(() => { if (token === speakToken && !speechSynthesis.speaking) end(); }, n * 600 + 3000);
      }
      function estimate() {
        const t0 = performance.now(), per = 350;
        const step = () => {
          if (token !== speakToken) return;
          const k = Math.floor((performance.now() - t0) / per);
          onChar && onChar(k);
          if (k >= n) return end();
          requestAnimationFrame(step);
        };
        step();
      }
    });
  }
  function stopSaying() {
    speakToken++;
    if (audioEl) audioEl.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  window.Speech = { score, listen, stopListening, say, stopSaying, canListen: !!SR, hanOnly };
})();
