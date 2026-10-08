import { OPS, KINDS, DEFAULT_OP_SETTINGS, generateWorksheets, randomSeed } from './generator.js';
import { renderWorksheets, autoTitle } from './render.js';

const STORAGE_KEY = 'arithmetic-worksheet:v1';
const LIMITS = { perSheet: [1, 100], sheets: [1, 20] };

const DEFAULT_STATE = {
  ops: ['mul'],
  opSettings: structuredClone(DEFAULT_OP_SETTINGS),
  perSheet: 20,
  sheets: 1,
  blank: 'answer',
  cols: 'auto',
  size: 'auto',
  flow: 'column',
  numbers: true,
  answers: true,
  header: { name: true, date: true, time: true, score: false },
  title: '',
  seed: 0,
};

/* ------------------------------------------------------------------ */
/* 状態の保存・復元（URL と localStorage）                              */
/* ------------------------------------------------------------------ */

function encodeState(state) {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** 読み込んだ値を検証し、足りない項目は既定値で補う */
function sanitize(raw) {
  const s = structuredClone(DEFAULT_STATE);
  if (!raw || typeof raw !== 'object') return s;

  if (Array.isArray(raw.ops)) {
    const ops = raw.ops.filter((op) => op in OPS);
    if (ops.length) s.ops = [...new Set(ops)];
  }
  for (const op of Object.keys(OPS)) {
    const src = raw.opSettings?.[op];
    if (!src) continue;
    const dst = s.opSettings[op];
    if (src.kind in KINDS[op]) dst.kind = src.kind;
    for (const key of ['carry', 'borrow', 'remainder']) {
      if (key in dst && ['any', 'yes', 'no'].includes(src[key])) dst[key] = src[key];
    }
    if ('dans' in dst && Array.isArray(src.dans)) {
      const dans = src.dans.map(Number).filter((n) => n >= 1 && n <= 9);
      if (dans.length) dst.dans = [...new Set(dans)].sort((a, b) => a - b);
    }
    if ('ordered' in dst) dst.ordered = !!src.ordered;
  }
  s.perSheet = clampInt(raw.perSheet, ...LIMITS.perSheet, s.perSheet);
  s.sheets = clampInt(raw.sheets, ...LIMITS.sheets, s.sheets);
  if (['answer', 'operand', 'mixed'].includes(raw.blank)) s.blank = raw.blank;
  if (['auto', '1', '2', '3', '4', '5'].includes(String(raw.cols))) s.cols = String(raw.cols);
  if (['auto', 'large', 'medium', 'small'].includes(raw.size)) s.size = raw.size;
  if (['row', 'column'].includes(raw.flow)) s.flow = raw.flow;
  for (const key of ['numbers', 'answers']) if (typeof raw[key] === 'boolean') s[key] = raw[key];
  for (const key of Object.keys(s.header)) {
    if (typeof raw.header?.[key] === 'boolean') s.header[key] = raw.header[key];
  }
  if (typeof raw.title === 'string') s.title = raw.title.slice(0, 60);
  if (Number.isInteger(raw.seed) && raw.seed >= 0) s.seed = raw.seed >>> 0;
  return s;
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function loadState() {
  const hash = location.hash.slice(1);
  if (hash) {
    try {
      return sanitize(decodeState(hash));
    } catch {
      /* 壊れたリンクは無視して既定値へ */
    }
  }
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    /* ストレージが使えない環境でも動くように */
  }
  const s = sanitize(saved);
  s.seed = randomSeed();
  return s;
}

function persist(state) {
  history.replaceState(null, '', `#${encodeState(state)}`);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------------ */
/* フォーム                                                           */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);

const FLAG_LABELS = {
  carry: { title: 'くり上がり', any: 'どちらも', yes: 'あり', no: 'なし' },
  borrow: { title: 'くり下がり', any: 'どちらも', yes: 'あり', no: 'なし' },
  remainder: { title: 'あまり', no: 'なし', yes: 'あり', any: 'まぜる' },
};

function radioGroup(name, title, options, value) {
  const fs = document.createElement('fieldset');
  fs.className = 'chips';
  fs.innerHTML = `<legend>${title}</legend>`;
  for (const [v, label] of options) {
    const id = `${name}-${v}`;
    fs.insertAdjacentHTML(
      'beforeend',
      `<input type="radio" id="${id}" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><label for="${id}">${label}</label>`,
    );
  }
  return fs;
}

function buildOpPanel(op, state) {
  const s = state.opSettings[op];
  const panel = document.createElement('div');
  panel.className = 'op-panel';
  panel.dataset.op = op;
  panel.hidden = !state.ops.includes(op);

  const kindSelect = document.createElement('select');
  kindSelect.name = `${op}-kind`;
  kindSelect.id = `${op}-kind`;
  for (const [key, k] of Object.entries(KINDS[op])) {
    kindSelect.add(new Option(k.label, key, false, key === s.kind));
  }
  const kindField = document.createElement('div');
  kindField.className = 'field';
  kindField.innerHTML = `<label for="${op}-kind">${OPS[op].label}のはんい</label>`;
  kindField.append(kindSelect);
  panel.append(kindField);

  for (const flag of ['carry', 'borrow', 'remainder']) {
    if (!(flag in s)) continue;
    const L = FLAG_LABELS[flag];
    const keys = flag === 'remainder' ? ['no', 'yes', 'any'] : ['any', 'yes', 'no'];
    panel.append(radioGroup(`${op}-${flag}`, L.title, keys.map((k) => [k, L[k]]), s[flag]));
  }

  if ('dans' in s) {
    const fs = document.createElement('fieldset');
    fs.className = 'dans';
    fs.dataset.showWhen = '9x9';
    fs.hidden = s.kind !== '9x9';
    const legend = op === 'div' ? 'わる数（だん）' : 'だん';
    fs.innerHTML = `<legend>${legend} <button type="button" class="link-btn" data-dans-all>すべて</button> <button type="button" class="link-btn" data-dans-none>クリア</button></legend>`;
    for (let d = 1; d <= 9; d++) {
      const id = `${op}-dan-${d}`;
      fs.insertAdjacentHTML(
        'beforeend',
        `<input type="checkbox" id="${id}" name="${op}-dan" value="${d}" ${s.dans.includes(d) ? 'checked' : ''}><label for="${id}">${d}</label>`,
      );
    }
    panel.append(fs);
  }

  if ('ordered' in s) {
    const wrap = document.createElement('label');
    wrap.className = 'check';
    wrap.dataset.showWhen = '9x9';
    wrap.hidden = s.kind !== '9x9';
    wrap.innerHTML = `<input type="checkbox" name="${op}-ordered" ${s.ordered ? 'checked' : ''}> だんの じゅんばんに ならべる`;
    panel.append(wrap);
  }
  return panel;
}

function initForm(form, state) {
  const opsBox = $('#op-panels', form);
  for (const op of Object.keys(OPS)) opsBox.append(buildOpPanel(op, state));

  for (const op of Object.keys(OPS)) $(`[name=op][value=${op}]`, form).checked = state.ops.includes(op);
  form.perSheet.value = state.perSheet;
  form.sheets.value = state.sheets;
  form.blank.value = state.blank;
  form.cols.value = state.cols;
  form.size.value = state.size;
  form.flow.value = state.flow;
  form.numbers.checked = state.numbers;
  form.answers.checked = state.answers;
  for (const key of Object.keys(state.header)) form[`header-${key}`].checked = state.header[key];
  form.title.value = state.title;
}

/** フォームの内容から状態を読み取る（seed は維持） */
function readForm(form, prev) {
  const ops = [...form.querySelectorAll('[name=op]:checked')].map((i) => i.value);
  const opSettings = structuredClone(prev.opSettings);
  for (const op of Object.keys(OPS)) {
    const s = opSettings[op];
    s.kind = form[`${op}-kind`].value;
    for (const flag of ['carry', 'borrow', 'remainder']) {
      if (flag in s) s[flag] = form.querySelector(`[name=${op}-${flag}]:checked`)?.value ?? s[flag];
    }
    if ('dans' in s) {
      s.dans = [...form.querySelectorAll(`[name=${op}-dan]:checked`)].map((i) => Number(i.value));
    }
    if ('ordered' in s) s.ordered = form[`${op}-ordered`].checked;
  }
  return {
    ...prev,
    ops,
    opSettings,
    perSheet: clampInt(form.perSheet.value, ...LIMITS.perSheet, prev.perSheet),
    sheets: clampInt(form.sheets.value, ...LIMITS.sheets, prev.sheets),
    blank: form.blank.value,
    cols: form.cols.value,
    size: form.size.value,
    flow: form.flow.value,
    numbers: form.numbers.checked,
    answers: form.answers.checked,
    header: Object.fromEntries(Object.keys(prev.header).map((k) => [k, form[`header-${k}`].checked])),
    title: form.title.value,
  };
}

function syncVisibility(form, state) {
  for (const panel of form.querySelectorAll('.op-panel')) {
    const op = panel.dataset.op;
    panel.hidden = !state.ops.includes(op);
    const kind = state.opSettings[op].kind;
    for (const node of panel.querySelectorAll('[data-show-when]')) node.hidden = node.dataset.showWhen !== kind;
  }
  form.title.placeholder = autoTitle(state);
}

/* ------------------------------------------------------------------ */
/* 起動                                                               */
/* ------------------------------------------------------------------ */

function main() {
  const form = $('#settings');
  const sheetsBox = $('#sheet-list');
  const status = $('#status');
  let state = loadState();

  initForm(form, state);

  const render = () => {
    syncVisibility(form, state);
    status.replaceChildren();
    status.className = 'status';
    try {
      const sheets = generateWorksheets(state);
      const { warnings, pageCount } = renderWorksheets(sheetsBox, sheets, state);
      const total = state.perSheet * state.sheets;
      status.textContent = `${total}問・${pageCount}ページ（A4）`;
      if (warnings.length) {
        status.classList.add('is-warning');
        status.textContent += ` ／ ${warnings.join(' ')}`;
      }
      $('#print').disabled = false;
    } catch (e) {
      status.classList.add('is-error');
      status.textContent = e.message;
      sheetsBox.replaceChildren();
      $('#print').disabled = true;
    }
    persist(state);
  };

  let timer = 0;
  const scheduleRender = () => {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  };

  form.addEventListener('input', () => {
    state = readForm(form, state);
    scheduleRender();
  });
  form.addEventListener('submit', (e) => e.preventDefault());

  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-dans-all], [data-dans-none]');
    if (!btn) return;
    const checked = btn.hasAttribute('data-dans-all');
    btn.closest('fieldset').querySelectorAll('input[type=checkbox]').forEach((i) => (i.checked = checked));
    state = readForm(form, state);
    scheduleRender();
  });

  $('#shuffle').addEventListener('click', () => {
    state = { ...state, seed: randomSeed() };
    render();
  });
  $('#print').addEventListener('click', () => window.print());
  $('#share').addEventListener('click', async () => {
    const btn = $('#share');
    try {
      await navigator.clipboard.writeText(location.href);
      btn.dataset.done = 'コピーしました';
    } catch {
      btn.dataset.done = 'コピーできませんでした';
    }
    setTimeout(() => delete btn.dataset.done, 1800);
  });
  $('#reset').addEventListener('click', () => {
    state = { ...structuredClone(DEFAULT_STATE), seed: randomSeed() };
    $('#op-panels').replaceChildren();
    initForm(form, state);
    render();
  });

  new ResizeObserver(fitPreview).observe($('.preview'));
  render();
  // Webフォントの読み込み後に、式の幅を測り直す
  document.fonts?.ready.then(render);
}

/** 画面幅に合わせてプレビューを縮小する（印刷時は等倍） */
function fitPreview() {
  const box = $('#sheet-list');
  const available = $('.preview').clientWidth;
  if (!available) return;
  const sheetPx = (210 / 25.4) * 96;
  box.style.setProperty('--zoom', Math.min(1, available / sheetPx).toFixed(3));
}

main();
