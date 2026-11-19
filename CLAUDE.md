# picture-book-reader（繪本跟念網頁）

作者委託把《我會想・我會說》繪本做成網頁：示範朗讀 → 小孩跟念 → 瀏覽器語音辨識 → 達門檻（預設 80%）翻頁。給很小的小孩用（3～7 歲），裝置是 iPad／手機。插畫重畫已獲作者同意。

## 開發指令
- 預覽：`preview_start` 名稱 `picture-book`（設定在 search-info/.claude/launch.json，python http.server 8765，根目錄 app/）
- 語法檢查：`cd app && node -e "for (const f of ['main.js','speech.js','scenes.js','book.js']) new Function(require('fs').readFileSync(f,'utf8'))"`
- 除錯：主控台 `PBR.goPage(i)`、`PBR.setScene('owlwake')`；長按右上齒輪 1 秒開家長設定，有「假裝小孩說」可測評分

## 結構
- `source/` 三本原書 PDF（掃描檔，無文字層）；`ref/` 天黑了逐頁參考圖
- `app/index.html`、`style.css`
- `app/book.js` 內文（一頁一整句，不在逗號拆段）
- `app/scenes.js` 場景：Canvas 程式筆觸（油畫感）＋角色即時畫；`build(S)` 畫靜態層、`draw(ctx,t,dt)` 每格
- `app/speech.js` 示範朗讀（音檔優先→瀏覽器 TTS）、辨識（webkitSpeechRecognition zh-TW）、評分（拼音 LCS）
- `app/main.js` 流程狀態機：cover → demo → turn → listening → result → 下一段／下一頁 → end
- `app/clips.js` 示範音檔表（key＝去標點的句子）、`app/audio/NN.m4a` 每句音檔：都由 `tools/make_clips.py` 產生，不要手改
- `audio/gemini-script.md` 給 AI Studio 的音稿（make_clips 也從這裡讀句子順序）；`audio/gemini/` 原始 wav
- 重切音檔：先 `~/venvs/myenv/bin/whisper audio/gemini/X.wav --model large-v3-turbo --language zh --word_timestamps True --output_format json --output_dir <暫存>`，再 `python3 tools/make_clips.py audio/gemini/X.wav <暫存>/X.json`

## 慣例
- 邏輯座標 1200×840（10:7），所有場景用這個座標
- 筆觸用 seed 亂數，畫面每次一樣
- UI 文字繁中；按鈕用圖示，小孩不用識字

## 地雷
- 語音辨識需要 https 或 localhost；iPad Safari 要開「Siri 與聽寫」
- Claude artifact 的 dictation 只支援 Chromium，iPad 不能用，所以不要發布成 artifact
- iOS 第一次發聲要在使用者點擊裡（封面開始鈕負責解鎖）
- `[hidden]` 要 `!important`，不然 `.round{display:grid}` 會蓋掉
