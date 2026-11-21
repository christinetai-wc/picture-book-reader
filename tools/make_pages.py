"""把原書 PDF 的插畫裁成網頁用的頁面圖（1600×1120，10:7），避開印在圖上的字。
裁切範圍放不滿 10:7 時，整張放進去，左右用同一張圖模糊補滿（不切到插畫）。
輸出 app/img/<書>/NN.jpg 和 app/img/pages.js（每頁的座標換算，動畫疊圖用）。
用法：python3 tools/make_pages.py
"""
import json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
OW, OH = 1600, 1120
SRC = {'rain': ROOT / 'source/1.下雨了.pdf', 'look': ROOT / 'source/2.看一看、想一想.pdf'}

# 每頁：(PDF 頁碼, 左/右半頁, 裁切 [x0,y0,x1,y1]（半頁的 0~1 座標）)
PAGES = {
    'rain': [
        (4, 'R', [0, 0.02, 1, 0.76]),     # 媽媽在窗邊
        (6, 'L', [0, 0.06, 1, 0.83]),     # 弟弟走進來
        (6, 'R', [0, 0.24, 1, 0.94]),    # 馬路溼了、青蛙
        (8, 'L', [0, 0.0, 1, 0.83]),      # 弟弟看窗外
        (8, 'R', [0, 0.0, 1, 0.77]),      # 穿雨衣踩水
        (10, 'L', [0, 0.04, 1, 0.83]),    # 媽媽拿雨衣
        (10, 'R', [0, 0.22, 1, 0.94]),   # 弟弟穿新雨衣
        (12, 'L', [0, 0.10, 1, 0.93]),    # 抱抱
        (12, 'L', [0.05, 0.25, 0.95, 0.88]),  # 抱抱（拉近）
    ],
    'look': [
        (4, 'L', [0, 0, 1, 0.77]), (4, 'R', [0, 0, 1, 0.77]),
        (6, 'L', [0, 0, 1, 0.77]), (6, 'R', [0, 0, 1, 0.77]),
        (8, 'L', [0, 0.20, 1, 0.94]), (8, 'R', [0, 0.20, 1, 0.94]),
        (10, 'L', [0, 0, 1, 0.79]), (10, 'R', [0, 0, 1, 0.79]),
        (12, 'L', [0, 0, 1, 0.79]), (12, 'R', [0, 0, 1, 0.79]),
    ],
}

def render(pdf, page, tmp):
    out = Path(tmp) / f'{pdf.stem}-{page}'
    if not Path(str(out) + '.png').exists():
        subprocess.run(['pdftoppm', '-r', '300', '-f', str(page), '-l', str(page), '-singlefile', '-png', str(pdf), str(out)], check=True)
    return Image.open(str(out) + '.png').convert('RGB')

maps = {}
with tempfile.TemporaryDirectory() as tmp:
    for book, pages in PAGES.items():
        outdir = ROOT / 'app/img' / book; outdir.mkdir(parents=True, exist_ok=True)
        maps[book] = []
        for n, (pg, side, (x0, y0, x1, y1)) in enumerate(pages, 1):
            spread = render(SRC[book], pg, tmp)
            w, h = spread.size
            half = spread.crop((0, 0, w // 2, h)) if side == 'L' else spread.crop((w // 2, 0, w, h))
            hw, hh = half.size
            x0, x1 = max(x0, 0.015), min(x1, 0.985)  # 去掉掃描的白邊
            box = (round(x0 * hw), round(y0 * hh), round(x1 * hw), round(y1 * hh))
            crop = half.crop(box)
            cw, ch = crop.size
            s = min(OW / cw, OH / ch)
            fw, fh = round(cw * s), round(ch * s)
            ox, oy = (OW - fw) // 2, (OH - fh) // 2
            # 背景：同一張圖放大鋪滿再模糊、稍微變淡
            sb = max(OW / cw, OH / ch)
            bg = crop.resize((round(cw * sb), round(ch * sb)), Image.LANCZOS)
            bx, by = (bg.width - OW) // 2, (bg.height - OH) // 2
            bg = bg.crop((bx, by, bx + OW, by + OH)).filter(ImageFilter.GaussianBlur(40))
            bg = ImageEnhance.Brightness(bg).enhance(0.92)
            bg.paste(crop.resize((fw, fh), Image.LANCZOS), (ox, oy))
            bg.save(outdir / f'{n:02d}.jpg', quality=84, optimize=True, progressive=True)
            # 半頁座標 (nx,ny) → 畫面座標（1200×840）：X = (nx*hw - box0)*s*k + ox*k
            k = 1200 / OW
            maps[book].append({'src': f'img/{book}/{n:02d}.jpg',
                               'a': [hw * s * k, (ox - box[0] * s) * k], 'b': [hh * s * k, (oy - box[1] * s) * k]})
            print(book, n, f'{fw}x{fh}', '補邊' if (fw, fh) != (OW, OH) else '')

(ROOT / 'app/img/pages.js').write_text('// 由 tools/make_pages.py 產生\nwindow.PAGE_IMGS = ' + json.dumps(maps, indent=1) + ';\n')
print('完成')
