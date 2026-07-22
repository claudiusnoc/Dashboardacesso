export const SITE_TYPE_COLORS = {
  Greenfield: "#157a52",
  Rooftop: "#285a9c",
  Indoor: "#b86e0d",
  "Pole Site": "#6f4fa3",
  "Cow Site": "#087c7b",
  "Street Level": "#a44f6b",
  Underground: "#52606d",
  "Central/Sala": "#7a5b32",
  Híbrida: "#d52b1e",
  Outras: "#667085",
  "Não informada": "#98a2b3",
};

const STRUCTURAL_PATHS = {
  Greenfield: [
    "M16 4v5M12.5 8h7M10 27 16 9l6 18M12 20h8M11 24h10M7 28h18",
    "M10 7.5c-2 1-3.2 2.7-3.2 5M22 7.5c2 1 3.2 2.7 3.2 5",
  ],
  Rooftop: [
    "M5 27h22M7 27V16h18v11M11 16v-4h10v4M16 12V5",
    "M12 8.5c1-1 2.3-1.5 4-1.5s3 .5 4 1.5M11 21h3v3h-3zM18 21h3v3h-3z",
  ],
  Indoor: [
    "M6 4h20v24H6zM10 8h12M16 24v4",
    "M16 20v.1M12.5 18a5 5 0 0 1 7 0M10 15.5a8.4 8.4 0 0 1 12 0",
  ],
  "Pole Site": [
    "M16 4v24M10 28h12M12 7h4v7h-4zM16 8h4v7h-4z",
    "M9 9c-1.8 1.2-2.8 3-2.8 5M23 9c1.8 1.2 2.8 3 2.8 5",
  ],
  "Cow Site": [
    "M7 21h18v5H7zM10 26a2 2 0 1 0 4 0M19 26a2 2 0 1 0 4 0M16 21V6M12.5 10h7",
    "M10 8c-1.8 1.2-2.8 3-2.8 5M22 8c1.8 1.2 2.8 3 2.8 5",
  ],
  "Street Level": [
    "M4 27h24M9 27V15h9v12M11 18h5M11 21h5M22 27V9M20 12h4",
    "M19.5 6.5c1.5-.8 3.5-.8 5 0M21 9c.7-.4 1.8-.4 2.5 0",
  ],
  Underground: [
    "M4 10h24M7 14h18v12H7zM11 18h10M11 22h10M10 7l2 3M16 6v4M22 7l-2 3",
    "M9 29h14",
  ],
  "Central/Sala": [
    "M7 4h18v24H7zM10 8h12v5H10zM10 15h12v5H10zM10 22h12v3H10z",
    "M12 10.5h.1M12 17.5h.1M12 23.5h.1",
  ],
  Híbrida: [
    "M4 28h24M6 28V17h9v11M11 17V7M8 10h6M18 28l4-16 4 16M20 21h4M19 25h6",
    "M7 7c1-1 2.3-1.5 4-1.5S14 6 15 7",
  ],
  Outras: [
    "M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0M9 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0M27 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0M9 24a2 2 0 1 1-4 0 2 2 0 0 1 4 0M27 24a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    "m9 10 5 4M23 10l-5 4M9 22l5-4M23 22l-5-4",
  ],
};

const SIGNAL_PATHS = {
  Greenfield: [
    "M8 27h16M11 27l5-17 5 17M13 20h6M12 24h8M16 10V5",
    "M10 7c-2 1.2-3 3-3 5M22 7c2 1.2 3 3 3 5",
  ],
  Rooftop: [
    "M5 27h22M8 27V18l8-5 8 5v9M16 13V6M12 10c1-1.3 2.3-2 4-2s3 .7 4 2",
    "M13 27v-6h6v6",
  ],
  Indoor: [
    "M7 10V6h4M21 6h4v4M25 22v4h-4M11 26H7v-4",
    "M16 22v.1M12.5 19a5 5 0 0 1 7 0M10 16a8.5 8.5 0 0 1 12 0",
  ],
  "Pole Site": ["M16 5v23M11 28h10M11 9l5-2v7l-5 2zM21 9l-5-2v7l5 2z"],
  "Cow Site": [
    "M6 22h20v4H6zM11 27h.1M21 27h.1M16 22V7M12 11l4-2 4 2",
    "M9 8c-1.5 1-2.5 2.5-2.5 4.5M23 8c1.5 1 2.5 2.5 2.5 4.5",
  ],
  "Street Level": [
    "M5 27h22M9 27V16h9v11M22 27V8M19 11h6",
    "M19 6c2-1.2 4-1.2 6 0",
  ],
  Underground: [
    "M4 10h24M8 15c2.5 0 4.2 1.5 5 4.5.8-3 2.5-4.5 5-4.5s4.2 1.5 5 4.5",
    "M10 24h12M12 28h8",
  ],
  "Central/Sala": ["M7 5h18v22H7zM11 10h10M11 16h10M11 22h10"],
  Híbrida: [
    "M5 27V17h10v10M17 27l5-17 5 17M19 21h6M18 25h8M10 17V7",
    "M7 10c1-1 2-1.5 3-1.5s2 .5 3 1.5",
  ],
  Outras: [
    "M16 5v22M5 16h22M8 8l16 16M24 8 8 24",
    "M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ],
};

export function normalizeSiteType(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("pt-BR");
  if (!normalized) return "Não informada";
  if (/[/+]/.test(normalized)) return "Híbrida";
  if (normalized === "GREENFIELD") return "Greenfield";
  if (normalized === "ROOFTOP") return "Rooftop";
  if (normalized === "INDOOR") return "Indoor";
  if (["POLESITE", "POLE SITE"].includes(normalized)) return "Pole Site";
  if (["COWSITE", "COW SITE"].includes(normalized)) return "Cow Site";
  if (["STREETLEVEL", "STREET LEVEL"].includes(normalized)) {
    return "Street Level";
  }
  if (["UNDERGROUND", "UNDERGROUND SITE"].includes(normalized)) {
    return "Underground";
  }
  if (["CENTRAL", "SALA", "CENTRAL/SALA"].includes(normalized)) {
    return "Central/Sala";
  }
  if (normalized === "HÍBRIDA" || normalized === "HIBRIDA") return "Híbrida";
  if (normalized === "NÃO INFORMADA" || normalized === "NAO INFORMADA") {
    return "Não informada";
  }
  return "Outras";
}

export function getSiteTypeColor(value) {
  return SITE_TYPE_COLORS[normalizeSiteType(value)] || SITE_TYPE_COLORS.Outras;
}

export function SiteTypeIcon({
  type,
  family = "structural",
  size = 32,
  className = "",
  title,
}) {
  const normalized = normalizeSiteType(type);
  const source = family === "signal" ? SIGNAL_PATHS : STRUCTURAL_PATHS;
  const paths = source[normalized] || source.Outras;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={family === "signal" ? 2.45 : 1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {paths.map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}

export function drawSiteTypeSignalGlyph(
  context,
  type,
  { x, y, size, color = "#fff", lineWidth = 2.45 },
) {
  const normalized = normalizeSiteType(type);
  const paths = SIGNAL_PATHS[normalized] || SIGNAL_PATHS.Outras;
  context.save();
  context.translate(x - size / 2, y - size / 2);
  context.scale(size / 32, size / 32);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  paths.forEach((path) => context.stroke(new Path2D(path)));
  context.restore();
}
