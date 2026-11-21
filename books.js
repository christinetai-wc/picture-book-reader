// 三本書的內文（照原書）。一頁一句，不在逗號拆段（繪本在練整句句型）。
// line: { text, speaker? ('mom'|'boy'), blank? }  blank：句子裡「＿＿＿」之後小孩自由回答，只評前半句
window.BOOKS = [
  {
    id: 'rain', title: '下雨了', cover: 'rcover', pattern: '因為……所以……',
    pages: [
      { scene: 'r1', lines: [{ speaker: 'mom', text: '啊！下雨了，今天要穿雨衣。' }] },
      { scene: 'r2', lines: [{ speaker: 'boy', text: '您怎麼知道下雨了？' }] },
      { scene: 'r3', lines: [{ speaker: 'mom', text: '因為我看到馬路溼了，所以知道下雨了。' }] },
      { scene: 'r4', lines: [{ speaker: 'boy', text: '為什麼下雨就要穿雨衣？' }] },
      { scene: 'r5', lines: [{ speaker: 'mom', text: '因為雨衣可以保護我們不被淋溼，所以要穿雨衣。' }] },
      { scene: 'r6', lines: [{ speaker: 'boy', text: '為什麼我有這件雨衣？' }] },
      { scene: 'r7', lines: [{ speaker: 'mom', text: '因為我看到這件雨衣很漂亮，所以買給你。' }] },
      { scene: 'r8', lines: [{ speaker: 'mom', text: '為什麼要抱我？' }] },
      { scene: 'r9', lines: [{ speaker: 'boy', text: '因為我最喜歡媽媽了，所以要抱您。' }] },
    ],
  },
  {
    id: 'look', title: '看一看、想一想', cover: 'kcover', pattern: '觀察、推論',
    pages: [
      { scene: 'k1', lines: [{ text: '這個小朋友很高興，因為我看到他在笑。' }] },
      { scene: 'k2', lines: [{ text: '這個小朋友很難過，因為我看到她在哭。' }] },
      { scene: 'k3', lines: [{ text: '這個小朋友覺得很熱，因為我看到他在流汗。' }] },
      { scene: 'k4', lines: [{ text: '這個小朋友覺得很冷，因為我看到她在發抖。' }] },
      { scene: 'k5', lines: [{ blank: true, text: '這個小朋友被老師稱讚了，因為我看到＿＿＿。' }] },
      { scene: 'k6', lines: [{ blank: true, text: '這個小朋友被老師罵了，因為我看到＿＿＿。' }] },
      { scene: 'k7', lines: [{ blank: true, text: '這個小朋友要去爬山，因為我看到他＿＿＿。' }] },
      { scene: 'k8', lines: [{ blank: true, text: '這個小朋友要去游泳，因為我看到她＿＿＿。' }] },
      { scene: 'k9', lines: [{ blank: true, text: '這個小朋友很害怕小狗，因為我看到＿＿＿。' }] },
      { scene: 'k10', lines: [{ blank: true, text: '這個小朋友很喜歡小狗，因為我看到＿＿＿。' }] },
    ],
  },
  {
    id: 'tianhei', title: '天黑了', cover: 'cover', pattern: '一……就……',
    pages: [
      { scene: 'sunset', lines: [{ text: '太陽一下山，天就黑了。' }] },
      { scene: 'moonrise', lines: [{ text: '天一黑，月亮就出來了。' }] },
      { scene: 'owlwake', lines: [{ text: '月亮一出來，貓頭鷹就醒了。' }] },
      { scene: 'mousehide', lines: [{ text: '貓頭鷹一醒，小老鼠就躲起來了。' }] },
      { scene: 'owlhunt', lines: [{ text: '因為貓頭鷹一找到小老鼠，就會把牠給吃了。' }] },
    ],
  },
];
window.SPEAKERS = { mom: '媽媽', boy: '弟弟' };
// 填空句示範完，提示小孩自己說
window.BLANK_CUE = '換你說說看，你看到什麼？';
