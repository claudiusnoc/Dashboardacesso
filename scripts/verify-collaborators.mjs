import { readFile } from "node:fs/promises";

const report = JSON.parse(
  await readFile("data/import/collaborators-report.json", "utf8"),
);
const failures = [];
if (report.collaborators !== 170)
  failures.push(["collaborators", report.collaborators]);
if (report.unique_cpfs !== 170)
  failures.push(["unique_cpfs", report.unique_cpfs]);
if (report.missing_next_aso !== 3)
  failures.push(["missing_next_aso", report.missing_next_aso]);
if (report.rejected_records.length)
  failures.push(["rejected_records", report.rejected_records]);
if (failures.length) {
  console.error("Falha na validação dos colaboradores:", failures);
  process.exit(1);
}
console.log("Colaboradores validados:", report);
