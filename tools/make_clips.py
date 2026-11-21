"""把 Gemini 整段 wav 切成每句 m4a，並用 Whisper 逐字時間產生 app/clips-<書>.js。
用法：python tools/make_clips.py <書 id> audio/gemini/<書 id>.wav whisper.json
句子順序讀 audio/gemini-script-<書 id>.md（「媽媽：」這類說話者前綴會去掉）
whisper.json 由：whisper X.wav --model large-v3-turbo --language zh --word_timestamps True --output_format json
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = sys.argv[1]
LINES = [re.sub(r'^(媽媽|弟弟|旁白)\s*[:：]\s*', '', l.strip())
         for l in (ROOT / f'audio/gemini-script-{BOOK}.md').read_text().split('---', 1)[1].splitlines()
         if l.strip() and not l.startswith('Style') and not l.startswith('<') and not l.startswith('（')]
han = lambda s: re.findall(r'\p{Han}', s) if False else [c for c in s if '一' <= c <= '鿿']

wav, wj = sys.argv[2], sys.argv[3]
words = [w for s in json.load(open(wj))['segments'] for w in s['words']]
chars = []  # (char, start, end)
for w in words:
    cs = han(w['word'])
    if not cs: continue
    step = (w['end'] - w['start']) / len(cs)
    for i, c in enumerate(cs):
        chars.append((c, w['start'] + i * step, w['start'] + (i + 1) * step))

# 停頓（找每句真正開始的地方；Whisper 第一個字常把前面的靜音也算進去）
out = subprocess.run(['ffmpeg', '-hide_banner', '-i', wav, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
sil_end = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', out)]
sil_start = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', out)]

need = sum(len(han(l)) for l in LINES)
assert need == len(chars), f'字數不合：稿 {need}、Whisper {len(chars)}'

clips_dir = ROOT / 'app/audio' / BOOK; clips_dir.mkdir(parents=True, exist_ok=True)

def line_start(cs):
    first = cs[0][1]
    se = [e for e in sil_end if first - 0.8 < e <= cs[0][2]]
    return max(first, se[-1]) if se else first

groups, k = [], 0
for line in LINES:
    groups.append(chars[k:k + len(han(line))]); k += len(han(line))
starts = [line_start(g) for g in groups] + [1e9]
clips = {}
for n, line in enumerate(LINES, 1):
    cs = groups[n - 1]; t0 = starts[n - 1]
    last = cs[-1][2]
    ss = [s for s in sil_start if last - 0.3 <= s < last + 0.6]
    t1 = ss[0] if ss else last
    a, b = max(0, t0 - 0.08), t1 + 0.4  # 尾巴多留一點，免得最後一個字的尾音被切
    b = min(b, starts[n] - 0.12)  # 但不能吃到下一句的開頭
    name = f'{n:02d}.m4a'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', wav, '-ss', f'{a:.3f}', '-to', f'{b:.3f}',
                    '-af', 'afade=t=in:d=0.03', '-c:a', 'aac', '-b:a', '96k', str(clips_dir / name)], check=True)
    times = [round(max(0, max(c[1], t0) - a), 2) for c in cs]
    clips[''.join(han(line))] = {'src': f'audio/{BOOK}/' + name, 'times': times}
    print(n, line, f'{a:.2f}-{b:.2f}', times[:4], '…')

(ROOT / f'app/clips-{BOOK}.js').write_text('// 由 tools/make_clips.py 產生，不要手改\nObject.assign(window.CLIPS, ' +
                                    json.dumps(clips, ensure_ascii=False, indent=1) + ');\n')
print(f'寫入 app/clips-{BOOK}.js，共', len(clips), '句')
