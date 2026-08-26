export const CASE_DETAIL_CHANGE_FIELDS = [
  { key: "workflow_stage", label: "Etapa atual" },
  { key: "current_responsibility", label: "Responsável atual" },
  { key: "next_action", label: "Próximo passo" },
  { key: "notes", label: "Observações" },
];

function fieldValue(field, value, formatWorkflow) {
  if (field === "workflow_stage" && value) return formatWorkflow(value);
  return value ?? "";
}

export function caseDetailChanges(
  beforeData,
  afterData,
  formatWorkflow = (value) => value,
) {
  return CASE_DETAIL_CHANGE_FIELDS.flatMap(({ key, label }) => {
    const before = fieldValue(key, beforeData?.[key], formatWorkflow);
    const after = fieldValue(key, afterData?.[key], formatWorkflow);
    return String(before) === String(after)
      ? []
      : [{ key, label, before, after }];
  });
}
