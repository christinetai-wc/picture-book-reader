# DEVLOG

### 2026-11-20 發布到 GitHub Pages
- 公開 repo christinetai-wc/picture-book-reader，app/ 用 gh-pages 分支發布（tools/deploy.sh）
- 原書掃描檔（source/、ref/）和原始 wav 不上傳
- 繼續用瀏覽器辨識，不做 Gemini 判讀，所以不需要後端

### 2026-11-19 最後一頁改回整句
- 「因為貓頭鷹一找到小老鼠，就會把牠給吃了」不再拆兩段：這本在練整句句型
- 音稿合併成一行，音檔重切成 14 句

### 2026-11-19 修書名被切掉
- 封面按開始後固定 1.2 秒就翻頁，會切掉 1.8 秒的「天黑了」→ 改成等書名念完再翻
- make_clips 每句尾巴多留 0.4 秒（但不超過下一句開頭）

### 2026-11-19 換成 Gemini 示範音
- Gemini（Fola）整段 wav 存在 audio/gemini/tianhei.wav
- tools/make_clips.py：Whisper 逐字時間＋靜音偵測切成 15 句 m4a（app/audio/），產生 app/clips.js，字幕跟著真人聲音亮
- 稱讚、鼓勵的話也改用 Gemini 音檔

### 2026-11-19 天黑了試作版
- 建專案，三本 PDF 移進 source/
- 天黑了 5 頁場景用 Canvas 程式筆觸重畫並加動畫
- 示範朗讀（暫用瀏覽器 TTS）＋字幕逐字亮、瀏覽器語音辨識、拼音寬鬆評分、80% 過關、3 次沒過可跳過
- 寫 Gemini 音稿，等使用者產生音檔後切句
