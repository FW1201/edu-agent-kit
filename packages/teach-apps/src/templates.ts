import type { Quiz } from "@edu-agent-kit/core";

export type TeachAppTemplate = "quiz" | "flashcards";

export interface FlashCard {
  front: string;
  back: string;
}

/** Safely embed JSON inside a <script> tag. */
function embed(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

const BASE_CSS = `
*{box-sizing:border-box}body{font-family:-apple-system,"Noto Sans TC",sans-serif;max-width:720px;margin:0 auto;padding:1.2rem;background:#0d1117;color:#e6edf3;line-height:1.6}
h1{color:#00d4ff}button{font:inherit;padding:.5rem 1rem;border-radius:8px;border:1px solid #30363d;background:#161b22;color:#e6edf3;cursor:pointer;margin:.2rem 0}
button:hover{border-color:#00d4ff}.opt{display:block;width:100%;text-align:left;margin:.3rem 0}
.correct{background:#11341a;border-color:#1f7a1f}.wrong{background:#3a1212;border-color:#a33}
.card{border:1px solid #30363d;border-radius:12px;padding:1.5rem;min-height:140px;background:#161b22}
.muted{color:#8b949e}.exp{font-size:.9rem;color:#8b949e;margin:.3rem 0 1rem}
`;

/** Build a self-contained interactive quiz HTML page from a Quiz. */
export function quizHtml(quiz: Quiz): string {
  const data = {
    title: quiz.title,
    questions: quiz.questions.map((q) => ({
      prompt: q.prompt,
      options: q.options.map((o) => ({ text: o.text, correct: o.correct })),
      explanation: q.explanation ?? "",
    })),
  };
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${quiz.title}</title>
<style>${BASE_CSS}</style></head><body>
<h1 id="t"></h1><div id="app"></div><div id="score" class="muted"></div>
<script>const DATA=${embed(data)};
document.getElementById('t').textContent=DATA.title;
let answered=0,correctCount=0;const app=document.getElementById('app');
DATA.questions.forEach((q,qi)=>{const box=document.createElement('div');box.innerHTML='<p><b>'+(qi+1)+'. '+q.prompt+'</b></p>';
q.options.forEach((o)=>{const b=document.createElement('button');b.className='opt';b.textContent=o.text;
b.onclick=()=>{if(b.dataset.done)return;b.dataset.done='1';answered++;if(o.correct){b.classList.add('correct');correctCount++;}else{b.classList.add('wrong');}
Array.from(box.querySelectorAll('button')).forEach(x=>x.disabled=true);
if(q.explanation){const e=document.createElement('div');e.className='exp';e.textContent='解析：'+q.explanation;box.appendChild(e);}
document.getElementById('score').textContent='已作答 '+answered+'/'+DATA.questions.length+'　答對 '+correctCount;};box.appendChild(b);});
app.appendChild(box);});</script></body></html>`;
}

/** Build a self-contained flashcards HTML page. */
export function flashcardsHtml(title: string, cards: FlashCard[]): string {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${BASE_CSS}</style></head><body>
<h1>${title}</h1><div class="card" id="card" onclick="flip()"></div>
<p class="muted" id="pos"></p><button onclick="prev()">← 上一張</button> <button onclick="flip()">翻面</button> <button onclick="next()">下一張 →</button>
<script>const CARDS=${embed(cards)};let i=0,back=false;
function render(){const c=CARDS[i];document.getElementById('card').textContent=back?c.back:c.front;
document.getElementById('pos').textContent=(i+1)+' / '+CARDS.length+(back?'（背面）':'（正面）');}
function flip(){back=!back;render();}function next(){i=(i+1)%CARDS.length;back=false;render();}
function prev(){i=(i-1+CARDS.length)%CARDS.length;back=false;render();}render();</script></body></html>`;
}

export const TEMPLATES: { id: TeachAppTemplate; title: string; description: string }[] = [
  { id: "quiz", title: "互動測驗", description: "自我檢測：點選作答、即時對錯與解析、計分。需 Quiz 資料。" },
  { id: "flashcards", title: "單字/概念閃卡", description: "翻卡複習。需 cards（front/back）資料。" },
];
