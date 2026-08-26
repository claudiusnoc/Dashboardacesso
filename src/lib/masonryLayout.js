const safeNumber = (value, fallback) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export function getMasonryColumnCount(
  width,
  { minColumnWidth = 248, maxColumns = 5, gap = 12 } = {},
) {
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeGap = Math.max(0, Number(gap) || 0);
  const safeMinWidth = safeNumber(minColumnWidth, 248);
  const safeMaxColumns = Math.max(1, Math.floor(maxColumns) || 1);

  if (!safeWidth) return 1;

  return Math.max(
    1,
    Math.min(
      safeMaxColumns,
      Math.floor((safeWidth + safeGap) / (safeMinWidth + safeGap)),
    ),
  );
}

export function createMasonryLayout({
  keys,
  heights = {},
  width,
  minColumnWidth = 248,
  maxColumns = 5,
  gap = 12,
  estimatedHeight = 268,
}) {
  const safeKeys = Array.isArray(keys) ? keys : [];
  const safeWidth = Math.max(0, Number(width) || 0);
  const safeGap = Math.max(0, Number(gap) || 0);
  const columns = getMasonryColumnCount(safeWidth, {
    minColumnWidth,
    maxColumns,
    gap: safeGap,
  });
  const columnWidth = safeWidth
    ? (safeWidth - safeGap * (columns - 1)) / columns
    : 0;
  const laneHeights = Array.from({ length: columns }, () => 0);
  const positions = safeKeys.map((key, index) => {
    const lane =
      index < columns ? index : laneHeights.indexOf(Math.min(...laneHeights));
    const height = safeNumber(heights[key], estimatedHeight);
    const position = {
      key,
      index,
      lane,
      width: columnWidth,
      x: lane * (columnWidth + safeGap),
      y: laneHeights[lane],
    };

    laneHeights[lane] += height + safeGap;
    return position;
  });

  return {
    columns,
    columnWidth,
    height: safeKeys.length ? Math.max(...laneHeights) - safeGap : 0,
    positions,
  };
}
