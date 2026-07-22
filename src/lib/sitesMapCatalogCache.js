import { supabase } from "./supabase";

// O cache não é uma fonte de dados: ele só evita repetir a mesma consulta
// enquanto o catálogo ainda estiver recente. O Supabase segue sendo a origem.
const CACHE_KEY = "claro-acessos:sites-map-catalog:v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

let memoryCatalog = null;
let memoryExpiresAt = 0;
let pendingRequest = null;

function hasStorage() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function normalizeCatalog(data) {
  const catalog = Array.isArray(data) ? data : data?.sites;
  return Array.isArray(catalog) ? catalog : [];
}

function isFresh(expiresAt) {
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function getCachedSitesMapCatalog() {
  if (memoryCatalog && isFresh(memoryExpiresAt)) {
    return memoryCatalog;
  }

  if (!hasStorage()) return null;

  try {
    const cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");

    if (
      !cached ||
      !Array.isArray(cached.catalog) ||
      !isFresh(cached.expiresAt)
    ) {
      return null;
    }

    memoryCatalog = cached.catalog;
    memoryExpiresAt = cached.expiresAt;
    return memoryCatalog;
  } catch {
    return null;
  }
}

function storeCatalog(catalog) {
  const expiresAt = Date.now() + CACHE_TTL_MS;
  memoryCatalog = catalog;
  memoryExpiresAt = expiresAt;

  if (!hasStorage()) return;

  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ catalog, expiresAt }),
    );
  } catch {
    // Alguns navegadores podem bloquear ou limitar localStorage. Nesse caso,
    // o cache em memória continua funcionando sem afetar a consulta oficial.
  }
}

export async function loadSitesMapCatalog({ force = false } = {}) {
  if (!force) {
    const cached = getCachedSitesMapCatalog();
    if (cached) return cached;
  }

  if (pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const { data, error } = await supabase.rpc("get_sites_map_catalog");

    if (error) throw error;

    const catalog = normalizeCatalog(data);
    storeCatalog(catalog);
    return catalog;
  })();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}

export function prefetchSitesMapCatalog() {
  return loadSitesMapCatalog().catch(() => null);
}
