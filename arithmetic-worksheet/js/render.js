/**
 * プリントの描画（A4・mm単位）
 */
import { OPS, KINDS } from './generator.js';

const PAGE = { width: 210, height: 297, marginX: 12, marginTop: 12, marginBottom: 12, header: 26 };
const FONT_MAX = { large: 11, medium: 8.5, small: 6.5 }; // mm
const FONT_MIN = 3.2; // これより小さくなる場合は警告を出す
const PROBE_FONT_PX = 100; // 式の幅を測るときの文字サイズ
const WRITE_SPACE_EM = 0.6; // 式の右側に残す余白

/** プリントのタイトルを自動生成する */
export function autoTitle(state) {
  if (state.ops.length === 0) return '';
  if (state.ops.length > 1) return state.ops.map((op) => OPS[op].label).join('・');
  const op = state.ops[0];
  const s = state.opSettings[op];
  let detail = KINDS[op][s.kind].label;
  if (s.kind === '9x9' && s.dans.length > 0 && s.dans.length < 9) {
    detail += `（${s.dans.join('・')}のだん）`;
  }
  return `${OPS[op].label}　${detail}`;
}

/** シート内の問題から、式の各部分の最大桁数を求める */
function measure(problems) {
  const w = { a: 1, b: 1, ans: 1, rem: 0, hasRemainder: false };
  for (const p of problems) {
    w.a = Math.max(w.a, String(p.a).length);
    w.b = Math.max(w.b, String(p.b).length);
    w.ans = Math.max(w.ans, String(p.answer).length);
    if (p.remainder !== undefined) {
      w.hasRemainder = true;
      w.rem = Math.max(w.rem, String(p.remainder).length);
    }
  }
  return w;
}

/**
 * 列数・行の高さ・文字サイズを決める
 * @param {number} count 問題数
 * @param {number} exprEm いちばん長い式の横幅（em）
 */
export function computeLayout(count, exprEm, state) {
  const availW = PAGE.width - PAGE.marginX * 2;
  const availH = PAGE.height - PAGE.marginTop - PAGE.marginBottom - PAGE.header;
  const fontMax = FONT_MAX[state.size] ?? FONT_MAX.large;

  const fit = (cols) => {
    const rows = Math.ceil(count / cols);
    const rowH = availH / rows;
    const font = Math.min(fontMax, rowH * 0.62, (availW / cols - 3) / exprEm);
    return { cols, rows, rowH, font };
  };

  let best;
  if (state.cols === 'auto') {
    // いちばん文字を大きくできる列数をえらぶ（あまり変わらなければ列が多いほう）
    const candidates = [];
    for (let c = 1; c <= Math.min(5, count); c++) candidates.push(fit(c));
    const maxFont = Math.max(...candidates.map((f) => f.font));
    best = candidates.filter((f) => f.font >= maxFont * 0.88).pop();
  } else {
    best = fit(Math.max(1, Math.min(Number(state.cols), count)));
  }
  const { cols, rows, rowH, font } = best;

  return { cols, rows, rowH, font, tooSmall: font < FONT_MIN };
}

/* ------------------------------------------------------------------ */
/* DOM                                                                */
/* ------------------------------------------------------------------ */

function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function numberCell(value, digits, { blank, showAnswer, cls }) {
  const span = el('span', `num ${cls}`);
  span.style.setProperty('--digits', digits);
  if (blank) {
    span.classList.add('blank');
    if (showAnswer) {
      span.classList.add('filled');
      span.textContent = value;
    }
  } else {
    span.textContent = value;
  }
  return span;
}

function renderProblem(p, index, w, state, isAnswer) {
  const item = el('div', 'problem');

  if (state.numbers) item.append(el('span', 'no', `(${index + 1})`));

  const expr = el('span', 'expr');
  const isBlank = (part) => p.blank === part;
  expr.append(
    numberCell(p.a, w.a, { blank: isBlank('a'), showAnswer: isAnswer, cls: 'a' }),
    el('span', 'sym', OPS[p.op].symbol),
    numberCell(p.b, w.b, { blank: isBlank('b'), showAnswer: isAnswer, cls: 'b' }),
    el('span', 'sym', '='),
  );

  const ans = el('span', 'ans');
  if (p.blank === 'answer') {
    const v = el('span', 'num answer-slot');
    v.style.setProperty('--digits', w.ans);
    if (isAnswer) {
      v.classList.add('filled');
      v.textContent = p.answer;
    }
    ans.append(v);
  } else {
    ans.append(numberCell(p.answer, w.ans, { blank: false, cls: 'given' }));
  }
  if (p.remainder !== undefined) {
    ans.append(el('span', 'amari', 'あまり'));
    const r = el('span', 'num answer-slot');
    r.style.setProperty('--digits', Math.max(1, w.rem));
    if (isAnswer) {
      r.classList.add('filled');
      r.textContent = p.remainder;
    }
    ans.append(r);
  }
  expr.append(ans);
  item.append(expr);
  return item;
}

function renderHeader(state, title, count, isAnswer, sheetNo, sheetTotal) {
  const header = el('header', 'sheet-header');
  const top = el('div', 'sheet-header-top');
  const h = el('h2', 'sheet-title', title);
  if (isAnswer) h.append(el('span', 'answer-badge', 'こたえ'));
  top.append(h);
  if (sheetTotal > 1) top.append(el('span', 'sheet-no', `${sheetNo} / ${sheetTotal}`));
  header.append(top);

  if (!isAnswer) {
    const meta = el('div', 'sheet-meta');
    const h2 = state.header;
    if (h2.date) meta.append(el('span', 'meta-item', '　　月　　日'));
    if (h2.name) meta.append(el('span', 'meta-item meta-name', 'なまえ'));
    if (h2.time) meta.append(el('span', 'meta-item', 'タイム（　　分　　秒）'));
    if (h2.score) meta.append(el('span', 'meta-item', `　　　／${count}`));
    header.append(meta);
  }
  return header;
}

/** 実際に描画して、いちばん長い式の幅（em）を測る */
function measureWidestEm(items) {
  const probe = el('div', 'sheet-probe');
  probe.style.fontSize = `${PROBE_FONT_PX}px`;
  probe.append(...items);
  document.body.append(probe);
  const widest = Math.max(...items.map((item) => item.getBoundingClientRect().width));
  probe.remove();
  return widest / PROBE_FONT_PX + WRITE_SPACE_EM;
}

function renderSheet(problems, state, { title, isAnswer, sheetNo, sheetTotal }) {
  const widths = measure(problems);
  const items = problems.map((p, i) => renderProblem(p, i, widths, state, isAnswer));
  const layout = computeLayout(problems.length, measureWidestEm(items), state);

  const sheet = el('section', `sheet${isAnswer ? ' is-answer' : ''}`);
  sheet.style.setProperty('--font', `${layout.font.toFixed(2)}mm`);
  sheet.append(renderHeader(state, title, problems.length, isAnswer, sheetNo, sheetTotal));

  const grid = el('div', 'problems');
  grid.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${layout.rows}, ${layout.rowH.toFixed(2)}mm)`;
  grid.style.gridAutoFlow = state.flow === 'row' ? 'row' : 'column';
  grid.append(...items);
  sheet.append(grid);
  return { sheet, layout };
}

/**
 * 全シートを描画して container に入れる
 * @returns {{ warnings: string[] }}
 */
export function renderWorksheets(container, sheets, state) {
  const title = state.title.trim() || autoTitle(state);
  const frag = document.createDocumentFragment();
  const warnings = new Set();

  const pages = [];
  sheets.forEach((problems, i) => pages.push({ problems, isAnswer: false, sheetNo: i + 1 }));
  if (state.answers) {
    sheets.forEach((problems, i) => pages.push({ problems, isAnswer: true, sheetNo: i + 1 }));
  }

  for (const page of pages) {
    const { sheet, layout } = renderSheet(page.problems, state, {
      title,
      isAnswer: page.isAnswer,
      sheetNo: page.sheetNo,
      sheetTotal: sheets.length,
    });
    if (layout.tooSmall) warnings.add('文字がとても小さくなっています。1まいの問題数をへらすか、列数を見直してください。');
    frag.append(sheet);
  }

  container.replaceChildren(frag);
  return { warnings: [...warnings], pageCount: pages.length };
}
