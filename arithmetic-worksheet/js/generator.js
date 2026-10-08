/**
 * 問題生成ロジック（DOMに依存しない純粋なモジュール）
 *
 * 問題オブジェクトの形:
 *   { op: 'add'|'sub'|'mul'|'div', a, b, answer, remainder?, blank: 'answer'|'a'|'b' }
 */

export const OPS = {
  add: { symbol: '+', label: 'たし算' },
  sub: { symbol: '−', label: 'ひき算' },
  mul: { symbol: '×', label: 'かけ算' },
  div: { symbol: '÷', label: 'わり算' },
};

/** 各演算で選べる出題範囲 */
export const KINDS = {
  add: {
    '1+1': { label: '1けた + 1けた', a: [1, 9], b: [1, 9] },
    '2+1': { label: '2けた + 1けた', a: [10, 99], b: [1, 9] },
    '2+2': { label: '2けた + 2けた', a: [10, 99], b: [10, 99] },
    '3+2': { label: '3けた + 2けた', a: [100, 999], b: [10, 99] },
    '3+3': { label: '3けた + 3けた', a: [100, 999], b: [100, 999] },
  },
  sub: {
    '10-1': { label: '10までの数 − 1けた', a: [2, 10], b: [1, 9] },
    '18-1': { label: '18までの数 − 1けた', a: [10, 18], b: [1, 9] },
    '2-1': { label: '2けた − 1けた', a: [10, 99], b: [1, 9] },
    '2-2': { label: '2けた − 2けた', a: [10, 99], b: [10, 99] },
    '3-2': { label: '3けた − 2けた', a: [100, 999], b: [10, 99] },
    '3-3': { label: '3けた − 3けた', a: [100, 999], b: [100, 999] },
  },
  mul: {
    '9x9': { label: '九九', a: [1, 9], b: [1, 9] },
    '2x1': { label: '2けた × 1けた', a: [10, 99], b: [2, 9] },
    '3x1': { label: '3けた × 1けた', a: [100, 999], b: [2, 9] },
    '2x2': { label: '2けた × 2けた', a: [10, 99], b: [10, 99] },
  },
  div: {
    '9x9': { label: '九九のぎゃく', divisor: [1, 9], dividend: [1, 89] },
    '2/1': { label: '2けた ÷ 1けた', divisor: [2, 9], dividend: [10, 99] },
    '3/1': { label: '3けた ÷ 1けた', divisor: [2, 9], dividend: [100, 999] },
    '2/2': { label: '2けた ÷ 2けた', divisor: [10, 99], dividend: [10, 99] },
    '3/2': { label: '3けた ÷ 2けた', divisor: [10, 99], dividend: [100, 999] },
  },
};

export const DEFAULT_OP_SETTINGS = {
  add: { kind: '1+1', carry: 'any' },
  sub: { kind: '18-1', borrow: 'any' },
  mul: { kind: '9x9', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9], ordered: false },
  div: { kind: '9x9', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9], remainder: 'no' },
};

/* ------------------------------------------------------------------ */
/* 乱数                                                               */
/* ------------------------------------------------------------------ */

/** シード付き乱数（mulberry32）。同じシードなら同じ問題を再現できる */
export function createRng(seed) {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/* くり上がり・くり下がり判定                                         */
/* ------------------------------------------------------------------ */

export function hasCarry(a, b) {
  let carry = 0;
  while (a > 0 || b > 0) {
    const s = (a % 10) + (b % 10) + carry;
    if (s >= 10) return true;
    carry = 0;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

export function hasBorrow(a, b) {
  while (b > 0) {
    if (a % 10 < b % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

function matchFlag(flag, value) {
  if (flag === 'yes') return value;
  if (flag === 'no') return !value;
  return true;
}

/* ------------------------------------------------------------------ */
/* 演算ごとの「問題空間」                                             */
/* ------------------------------------------------------------------ */

/**
 * 演算と設定から問題空間を作る。
 * 空間が小さいときは全列挙（重複なしで出題できる）、大きいときはランダム抽出。
 * @returns {{ enumerate: () => object[] | null, sample: ((rng) => object | null) | null, size: number }}
 */
export function buildSpace(op, settings) {
  const s = { ...DEFAULT_OP_SETTINGS[op], ...settings };
  const kind = KINDS[op][s.kind];
  if (!kind) throw new Error(`不明な出題範囲です: ${op}/${s.kind}`);

  if (op === 'add' || op === 'sub' || op === 'mul') {
    let [aMin, aMax] = kind.a;
    const [bMin, bMax] = kind.b;
    const dans = op === 'mul' && s.kind === '9x9' ? normalizeDans(s.dans) : null;

    const make = (a, b) => {
      if (op === 'add') {
        if (!matchFlag(s.carry, hasCarry(a, b))) return null;
        return { op, a, b, answer: a + b };
      }
      if (op === 'sub') {
        if (b > a) return null;
        if (s.kind === '18-1' && a - b > 9) return null;
        if (!matchFlag(s.borrow, hasBorrow(a, b))) return null;
        return { op, a, b, answer: a - b };
      }
      if (dans && !dans.includes(a)) return null;
      return { op, a, b, answer: a * b };
    };

    const size = (aMax - aMin + 1) * (bMax - bMin + 1);
    return {
      size,
      enumerate: () => {
        if (size > ENUMERATE_LIMIT) return null;
        const list = [];
        const aValues = dans ?? range(aMin, aMax);
        for (const a of aValues) {
          for (let b = bMin; b <= bMax; b++) {
            const p = make(a, b);
            if (p) list.push(p);
          }
        }
        return list;
      },
      sample: (rng) => {
        const a = dans ? rng.pick(dans) : rng.int(aMin, aMax);
        return make(a, rng.int(bMin, bMax));
      },
    };
  }

  // わり算: 「わる数 × 商 (+ あまり)」から組み立てる
  const [dMin, dMax] = kind.divisor;
  const [nMin, nMax] = kind.dividend;
  const divisors = s.kind === '9x9' ? normalizeDans(s.dans) : range(dMin, dMax);

  const make = (dividend, divisor) => {
    if (dividend < nMin || dividend > nMax) return null;
    const q = Math.floor(dividend / divisor);
    const r = dividend % divisor;
    if (q < 1) return null;
    if (s.kind === '9x9' && q > 9) return null;
    if (s.remainder === 'no' && r !== 0) return null;
    if (s.remainder === 'yes' && r === 0) return null;
    const p = { op: 'div', a: dividend, b: divisor, answer: q };
    if (s.remainder !== 'no') p.remainder = r;
    return p;
  };

  // わり算は最大でも 900 × 90 通り程度なので常に全列挙する
  return {
    size: (nMax - nMin + 1) * divisors.length,
    enumerate: () => {
      const list = [];
      for (const d of divisors) {
        for (let n = nMin; n <= nMax; n++) {
          const p = make(n, d);
          if (p) list.push(p);
        }
      }
      return list;
    },
    sample: null,
  };
}

const ENUMERATE_LIMIT = 50000;

function range(min, max) {
  const r = [];
  for (let i = min; i <= max; i++) r.push(i);
  return r;
}

function normalizeDans(dans) {
  const list = [...new Set((dans ?? []).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 9)
    .sort((x, y) => x - y);
  if (list.length === 0) throw new Error('段を1つ以上えらんでください。');
  return list;
}

const keyOf = (p) => `${p.op}:${p.a}:${p.b}`;

/* ------------------------------------------------------------------ */
/* 出題                                                               */
/* ------------------------------------------------------------------ */

/**
 * 1つの演算について count 問を作る。
 * できるだけ重複させず、出せる問題が足りなければ一巡してから繰り返す。
 */
export function generateForOp(op, settings, count, rng) {
  if (count <= 0) return [];
  const space = buildSpace(op, settings);
  const all = space.enumerate();

  if (all) {
    if (all.length === 0) throw new Error(`${OPS[op].label}: この条件では問題を作れません。条件を見直してください。`);
    const ordered = op === 'mul' && settings?.ordered;
    const out = [];
    while (out.length < count) {
      const pool = ordered ? all : shuffle(all, rng);
      out.push(...pool.slice(0, count - out.length));
    }
    return out.map((p) => ({ ...p }));
  }

  // 空間が大きい場合: ランダム抽出しつつ重複を避ける
  const out = [];
  const seen = new Set();
  const maxAttempts = count * 2000;
  for (let i = 0; out.length < count && i < maxAttempts; i++) {
    const p = space.sample(rng);
    if (!p || seen.has(keyOf(p))) continue;
    seen.add(keyOf(p));
    out.push(p);
  }
  if (out.length === 0) throw new Error(`${OPS[op].label}: この条件では問題を作れません。条件を見直してください。`);
  const n = out.length;
  for (let i = 0; out.length < count; i++) out.push({ ...out[i % n] });
  return out;
}

/** 合計 total 問を、選ばれた演算に均等に配分する */
export function distribute(total, ops) {
  const base = Math.floor(total / ops.length);
  let rest = total - base * ops.length;
  return ops.map(() => base + (rest-- > 0 ? 1 : 0));
}

/** 虫食い算の空欄位置を決める */
function assignBlank(p, mode, rng) {
  if (mode === 'answer' || p.remainder !== undefined) return 'answer';
  if (mode === 'operand') return rng.next() < 0.5 ? 'a' : 'b';
  if (mode === 'mixed') return rng.pick(['answer', 'a', 'b']);
  return 'answer';
}

/**
 * プリント全体（複数枚）の問題を作る
 * @param {object} config
 * @param {string[]} config.ops 出題する演算（例: ['add', 'sub']）
 * @param {object} config.opSettings 演算ごとの設定
 * @param {number} config.perSheet 1枚あたりの問題数
 * @param {number} config.sheets 枚数
 * @param {string} config.blank 'answer' | 'operand' | 'mixed'
 * @param {number} config.seed
 * @returns {object[][]} シートごとの問題配列
 */
export function generateWorksheets(config) {
  const { ops, opSettings = {}, perSheet, sheets = 1, blank = 'answer', seed } = config;
  if (!ops?.length) throw new Error('計算の種類を1つ以上えらんでください。');
  const rng = createRng(seed);
  const total = perSheet * sheets;
  const counts = distribute(total, ops);

  const byOp = ops.map((op, i) => generateForOp(op, opSettings[op], counts[i], rng));

  let all;
  if (ops.length === 1) {
    all = byOp[0];
  } else {
    // 各シートに演算がまんべんなく入るよう、シートごとに配分してからシャッフル
    all = [];
    const cursors = byOp.map(() => 0);
    for (let s = 0; s < sheets; s++) {
      const sheetCounts = distribute(perSheet, ops);
      const sheet = [];
      ops.forEach((_, i) => {
        sheet.push(...byOp[i].slice(cursors[i], cursors[i] + sheetCounts[i]));
        cursors[i] += sheetCounts[i];
      });
      all.push(...shuffle(sheet, rng));
    }
  }

  for (const p of all) p.blank = assignBlank(p, blank, rng);

  const result = [];
  for (let s = 0; s < sheets; s++) result.push(all.slice(s * perSheet, (s + 1) * perSheet));
  return result;
}
