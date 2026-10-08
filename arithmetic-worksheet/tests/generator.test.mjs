import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRng,
  hasCarry,
  hasBorrow,
  distribute,
  generateForOp,
  generateWorksheets,
  KINDS,
} from '../js/generator.js';

const rng = () => createRng(12345);
const key = (p) => `${p.op}:${p.a}:${p.b}`;

test('同じシードなら同じ問題になる', () => {
  const cfg = { ops: ['add', 'mul'], perSheet: 30, sheets: 2, seed: 42 };
  assert.deepEqual(generateWorksheets(cfg), generateWorksheets(cfg));
  assert.notDeepEqual(generateWorksheets(cfg), generateWorksheets({ ...cfg, seed: 43 }));
});

test('くり上がり・くり下がりの判定', () => {
  assert.equal(hasCarry(5, 4), false);
  assert.equal(hasCarry(5, 5), true);
  assert.equal(hasCarry(123, 456), false);
  assert.equal(hasCarry(195, 4), false);
  assert.equal(hasCarry(195, 5), true);
  assert.equal(hasBorrow(15, 3), false);
  assert.equal(hasBorrow(13, 5), true);
  assert.equal(hasBorrow(305, 102), false);
  assert.equal(hasBorrow(305, 106), true);
});

test('問題数の配分', () => {
  assert.deepEqual(distribute(10, ['a', 'b', 'c']), [4, 3, 3]);
  assert.deepEqual(distribute(2, ['a', 'b', 'c']), [1, 1, 0]);
});

test('九九: 81問以内なら重複しない、段の指定が効く', () => {
  const list = generateForOp('mul', { kind: '9x9', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, 81, rng());
  assert.equal(new Set(list.map(key)).size, 81);

  const dan = generateForOp('mul', { kind: '9x9', dans: [3, 7] }, 30, rng());
  assert.ok(dan.every((p) => [3, 7].includes(p.a) && p.answer === p.a * p.b));
});

test('九九: じゅんばんに並べる', () => {
  const list = generateForOp('mul', { kind: '9x9', dans: [2], ordered: true }, 9, rng());
  assert.deepEqual(list.map((p) => p.b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('たし算: くり上がり あり/なし', () => {
  for (const kind of Object.keys(KINDS.add)) {
    const yes = generateForOp('add', { kind, carry: 'yes' }, 50, rng());
    const no = generateForOp('add', { kind, carry: 'no' }, 50, rng());
    assert.ok(yes.every((p) => hasCarry(p.a, p.b) && p.answer === p.a + p.b), kind);
    assert.ok(no.every((p) => !hasCarry(p.a, p.b)), kind);
  }
});

test('ひき算: 答えが負にならない、くり下がり条件が効く', () => {
  for (const kind of Object.keys(KINDS.sub)) {
    const all = generateForOp('sub', { kind, borrow: 'any' }, 50, rng());
    assert.ok(all.every((p) => p.answer >= 0 && p.answer === p.a - p.b), kind);
    const yes = generateForOp('sub', { kind, borrow: 'yes' }, 30, rng());
    assert.ok(yes.every((p) => hasBorrow(p.a, p.b)), kind);
  }
  const k = generateForOp('sub', { kind: '18-1', borrow: 'yes' }, 36, rng());
  assert.ok(k.every((p) => p.a >= 10 && p.a <= 18 && p.answer <= 9));
});

test('わり算: あまりの指定が効き、検算が合う', () => {
  for (const kind of Object.keys(KINDS.div)) {
    const no = generateForOp('div', { kind, remainder: 'no' }, 40, rng());
    assert.ok(no.every((p) => p.a === p.b * p.answer && p.remainder === undefined), kind);
    const yes = generateForOp('div', { kind, remainder: 'yes' }, 40, rng());
    assert.ok(yes.every((p) => p.a === p.b * p.answer + p.remainder && p.remainder > 0 && p.remainder < p.b), kind);
  }
  const nine = generateForOp('div', { kind: '9x9', dans: [1, 2, 3, 4, 5, 6, 7, 8, 9], remainder: 'any' }, 200, rng());
  assert.ok(nine.every((p) => p.answer >= 1 && p.answer <= 9));
  // 1でわると、あまりは出ない
  assert.throws(() => generateForOp('div', { kind: '9x9', dans: [1], remainder: 'yes' }, 5, rng()), /作れません/);
});

test('大きな範囲でも指定数を作れて重複しない', () => {
  const list = generateForOp('add', { kind: '3+3', carry: 'no' }, 100, rng());
  assert.equal(list.length, 100);
  assert.equal(new Set(list.map(key)).size, 100);
});

test('候補より多い問題数を求めたら一巡してから繰り返す', () => {
  const list = generateForOp('mul', { kind: '9x9', dans: [5] }, 20, rng());
  assert.equal(list.length, 20);
  assert.equal(new Set(list.slice(0, 9).map(key)).size, 9);
});

test('ミックス: 各シートに演算がまんべんなく入る', () => {
  const sheets = generateWorksheets({ ops: ['add', 'sub', 'mul', 'div'], perSheet: 20, sheets: 3, seed: 1 });
  assert.equal(sheets.length, 3);
  for (const sheet of sheets) {
    assert.equal(sheet.length, 20);
    for (const op of ['add', 'sub', 'mul', 'div']) {
      assert.equal(sheet.filter((p) => p.op === op).length, 5);
    }
  }
});

test('虫食い算: あまりのある問題は答えの欄だけ空ける', () => {
  const sheets = generateWorksheets({
    ops: ['mul', 'div'],
    opSettings: { div: { kind: '2/1', remainder: 'yes' } },
    perSheet: 40,
    blank: 'operand',
    seed: 7,
  });
  for (const p of sheets[0]) {
    if (p.op === 'div') assert.equal(p.blank, 'answer');
    else assert.ok(['a', 'b'].includes(p.blank));
  }
});

test('不正な設定はエラーにする', () => {
  assert.throws(() => generateWorksheets({ ops: [], perSheet: 10, seed: 1 }), /1つ以上/);
  assert.throws(() => generateForOp('mul', { kind: '9x9', dans: [] }, 5, rng()), /段/);
});
