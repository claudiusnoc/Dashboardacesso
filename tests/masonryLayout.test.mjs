import assert from "node:assert/strict";
import test from "node:test";
import {
  createMasonryLayout,
  getMasonryColumnCount,
} from "../src/lib/masonryLayout.js";

test("calcula colunas responsivas respeitando largura minima e limite", () => {
  assert.equal(getMasonryColumnCount(240), 1);
  assert.equal(getMasonryColumnCount(780), 3);
  assert.equal(getMasonryColumnCount(1800), 5);
});

test("posiciona o proximo card na coluna mais curta", () => {
  const layout = createMasonryLayout({
    keys: ["a", "b", "c", "d"],
    heights: { a: 300, b: 180, c: 240, d: 120 },
    width: 780,
  });

  assert.equal(layout.columns, 3);
  assert.deepEqual(
    layout.positions.map(({ lane, y }) => ({ lane, y })),
    [
      { lane: 0, y: 0 },
      { lane: 1, y: 0 },
      { lane: 2, y: 0 },
      { lane: 1, y: 192 },
    ],
  );
  assert.equal(layout.height, 312);
});

test("desalinha intencionalmente o inicio das colunas", () => {
  const layout = createMasonryLayout({
    keys: ["a", "b", "c", "d"],
    heights: { a: 300, b: 180, c: 240, d: 120 },
    width: 780,
    laneOffsets: [0, 30, 12],
  });

  assert.deepEqual(
    layout.positions.map(({ lane, y }) => ({ lane, y })),
    [
      { lane: 0, y: 0 },
      { lane: 1, y: 30 },
      { lane: 2, y: 12 },
      { lane: 1, y: 222 },
    ],
  );
  assert.equal(layout.height, 342);
});

test("mantem uma coluna e uma altura valida antes da medicao", () => {
  const layout = createMasonryLayout({
    keys: ["a", "b"],
    width: 0,
    estimatedHeight: 250,
  });

  assert.equal(layout.columns, 1);
  assert.equal(layout.columnWidth, 0);
  assert.equal(layout.height, 512);
});
