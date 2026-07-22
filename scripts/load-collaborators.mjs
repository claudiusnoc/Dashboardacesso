import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secretKey) {
  throw new Error(
    "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY somente neste terminal.",
  );
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const collaborators = JSON.parse(
  await readFile("data/import/collaborators.json", "utf8"),
);

for (let index = 0; index < collaborators.length; index += 100) {
  const batch = collaborators.slice(index, index + 100);
  const { error } = await supabase
    .from("collaborators")
    .upsert(batch, { onConflict: "cpf" });
  if (error)
    throw new Error(
      `Carga de colaboradores ${index + 1}-${index + batch.length}: ${error.message}`,
    );
}

const { count, error } = await supabase
  .from("collaborators")
  .select("id", { count: "exact", head: true });
if (error) throw error;
console.log(JSON.stringify({ collaborators: count }, null, 2));
