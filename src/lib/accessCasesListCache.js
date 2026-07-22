import { supabase } from "./supabase";

const ACCESS_CASES_LIST_SELECT =
  "id,display_name,status,stage,workflow_stage,current_responsibility,updated_at,case_sites(position,site:sites(station,holder,eqs_cluster,station_type))";

// Snapshot transitório para evitar que a lista pisque vazia entre rotas.
// O Supabase continua sendo a fonte oficial e é consultado a cada montagem.
let cachedOwnerId = null;
let cachedCases = null;
let pendingOwnerId = null;
let pendingRequest = null;

export function getCachedAccessCasesList(ownerId) {
  if (!ownerId || ownerId !== cachedOwnerId) return null;
  return cachedCases;
}

export async function refreshAccessCasesList(ownerId) {
  if (!ownerId)
    throw new Error("Usuário não identificado para carregar casos.");

  if (pendingRequest && pendingOwnerId === ownerId) return pendingRequest;

  const request = (async () => {
    const { data, error } = await supabase
      .from("access_cases")
      .select(ACCESS_CASES_LIST_SELECT)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const cases = Array.isArray(data) ? data : [];
    cachedOwnerId = ownerId;
    cachedCases = cases;
    return cases;
  })();

  pendingOwnerId = ownerId;
  pendingRequest = request;

  try {
    return await request;
  } finally {
    if (pendingRequest === request) {
      pendingOwnerId = null;
      pendingRequest = null;
    }
  }
}
