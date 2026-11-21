"""把原書人物剪成透明 WebP（拼貼用）：先擦掉印在圖上的字 → macOS Vision 去背 → 縮小存到 app/img/cut/。
用法：~/venvs/myenv/bin/python tools/make_cutouts.py   （需要 OpenCV；會先編譯 tools/cutout.swift）
半頁原圖從 source/ PDF 產生在 ref/half/（不公開）。
"""
import subprocess, tempfile, shutil
from pathlib import Path
import cv2, numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
HALF = ROOT / 'ref/half'
OUT = ROOT / 'app/img/cut'; OUT.mkdir(parents=True, exist_ok=True)
TMP = Path(tempfile.mkdtemp())
BIN = TMP / 'cutout'
subprocess.run(['swiftc', '-O', str(ROOT / 'tools/cutout.swift'), '-o', str(BIN)], check=True)

# 名稱: (半頁, 要擦的字範圍[x0,y0,x1,y1]（0~1）, 先裁的範圍（None=整頁）, 要第幾個主體（從 1 開始，依面積大到小；0＝全部主體合在一起）[, 剪好後要清掉的範圍（貼紙的 0~1）])
SPRITES = {
    'r1_bird1': ('rain_4L', [], [0, 0, 0.6, 0.45], 1),
    'r1_bird2': ('rain_4L', [], [0, 0, 0.6, 0.45], 2),
    'r1_mom': ('rain_4R', [], [0.3, 0.22, 0.86, 0.73], 1),
    'r2_mom': ('rain_6L', [], [0.3, 0.04, 0.68, 0.84], 1),
    'r2_boy': ('rain_6L', [], [0.62, 0.42, 0.98, 0.84], 1),
    'r3_frog': ('rain_6R', [[0.9, 0.9, 1, 1]], [0.45, 0.5, 1, 1], 1),
    'r3_window': ('rain_6R', [], [0.12, 0.3, 0.44, 0.5], 1),
    'r4_boy': ('rain_8L', [[0.0, 0.83, 1, 1]], [0.4, 0.075, 1, 0.92], 1),
    'r5_boy': ('rain_8R', [], None, 1),
    'r6_mom': ('rain_10L', [], [0.25, 0.1, 0.62, 0.86], 1),
    'r6_boy': ('rain_10L', [], [0.58, 0.38, 0.86, 0.88], 1),
    'r7_mom': ('rain_10R', [[0, 0, 1, 0.21]], [0.1, 0.2, 0.55, 1], 1),
    'r7_boy': ('rain_10R', [], [0.5, 0.425, 0.9, 1], 1),
    'r8_hug': ('rain_12L', [[0, 0.95, 0.15, 1]], None, 1),
    'k1_boy': ('look_4L', [[0.12, 0.76, 0.9, 0.95]], None, 1),
    'k2_girl': ('look_4R', [[0.1, 0.76, 0.95, 0.95]], [0, 0, 0.835, 1], 1, [[0.8, 0.48, 1, 0.7]]),
    'k3_boy': ('look_6L', [[0.1, 0.76, 0.95, 0.95]], None, 1),
    'k4_kid': ('look_6R', [[0.1, 0.76, 0.95, 0.95]], [0.1, 0, 0.8, 1], 1),
    'k4_penguin': ('look_6R', [], [0.78, 0.62, 0.97, 0.86], 1),
    'k5_boy': ('look_8L', [[0, 0, 1, 0.2]], [0.08, 0.28, 0.5, 1], 1),
    'k5_teacher': ('look_8L', [[0, 0, 1, 0.2]], [0.48, 0.12, 0.95, 1], 1),
    'k6_teacher': ('look_8R', [[0, 0, 1, 0.2]], [0.15, 0.2, 0.66, 1], 1),
    'k6_girl': ('look_8R', [[0, 0, 1, 0.2]], [0.62, 0.25, 0.95, 1], 1),
    'k7_kid': ('look_10L', [[0.1, 0.8, 0.95, 0.95]], [0, 0, 1, 0.8], 1),
    'k8_girl': ('look_10R', [[0.1, 0.8, 0.95, 0.95]], [0, 0, 1, 0.8], 0),
    'k10_girl': ('look_12R', [[0.1, 0.8, 0.95, 0.95]], [0.37, 0.15, 0.78, 0.8], 1),
    'k10_dog': ('look_12R', [[0.1, 0.8, 0.95, 0.95]], [0.1, 0.42, 0.44, 0.78], 1),
    'k9_boy': ('look_12L', [], [0.45, 0, 1, 1], 1),
    'k9_dog': ('look_12L', [], [0, 0.3, 0.45, 1], 1),
}

def erase_text(img, boxes):
    """在指定範圍把深色的字擦掉（OpenCV inpaint）。"""
    if not boxes: return img
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mask = np.zeros((h, w), np.uint8)
    for x0, y0, x1, y1 in boxes:
        a, b, c, d = int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)
        sub = gray[b:d, a:c]
        mask[b:d, a:c] = (sub < 120).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    return cv2.inpaint(img, mask, 7, cv2.INPAINT_TELEA)

import sys
only = set(sys.argv[1:])
for name, (half, boxes, crop, pick, *rest) in SPRITES.items():
    if only and name not in only: continue
    img = cv2.imread(str(HALF / f'{half}.png'))
    img = erase_text(img, boxes)
    if crop:
        h, w = img.shape[:2]
        img = img[int(crop[1] * h):int(crop[3] * h), int(crop[0] * w):int(crop[2] * w)]
    src = TMP / f'{name}.png'; cv2.imwrite(str(src), img)
    res = subprocess.run([str(BIN), str(src), str(TMP / 'o')], capture_output=True, text=True, check=True).stdout
    # 依面積排序挑主體
    rows = [l.split() for l in res.strip().splitlines() if ' i' in l]
    if not rows: print(name, '找不到主體'); continue
    rows.sort(key=lambda r: -float(r[-1]))
    if pick == 0:
        inst = 'all'; im = Image.open(TMP / 'o' / f'{name}_all.png'); im = im.crop(im.getbbox())
    else:
        inst = rows[pick - 1][1]; im = Image.open(TMP / 'o' / f'{name}_{inst}.png')
    if rest:  # 清掉黏到的別的東西
        im = im.convert('RGBA'); a = np.array(im)
        for x0, y0, x1, y1 in rest[0]:
            a[int(y0 * a.shape[0]):int(y1 * a.shape[0]), int(x0 * a.shape[1]):int(x1 * a.shape[1]), 3] = 0
        im = Image.fromarray(a); im = im.crop(im.getbbox())
    im.thumbnail((900, 900), Image.LANCZOS)
    im.save(OUT / f'{name}.webp', 'WEBP', quality=86, method=6)  # webp 比 png 小很多
    print(name, inst, im.size)
shutil.rmtree(TMP)
