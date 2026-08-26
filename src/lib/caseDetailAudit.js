export const CASE_DETAIL_CHANGE_FIELDS = [
  { key: "workflow_stage", label: "Etapa atual", category: "stage" },
  {
    key: "current_responsibility",
    label: "Responsável atual",
    category: "responsibility",
  },
  { key: "next_action", label: "Próximo passo", category: "notes" },
  { key: "notes", label: "Observações", category: "notes" },
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

function cleanValue(value) {
  return String(value ?? "").trim();
}

function publicEventDescription(event) {
  const description = cleanValue(event?.description);
  if (event?.event_type !== "Etapa atualizada") return description;
  const finalStage = description.match(/\spara\s(.+?)\.?$/i)?.[1];
  return finalStage
    ? `Etapa atualizada para ${finalStage}`
    : "Etapa da demanda atualizada";
}

export function activityFromAuditRow(
  row,
  actorName = "Usuário não identificado",
  formatWorkflow = (value) => value,
) {
  const changes = caseDetailChanges(
    row?.before_data,
    row?.after_data,
    formatWorkflow,
  );
  if (!changes.length) return null;

  const fields = changes.map((change) => ({
    key: change.key,
    label: change.label,
    value: cleanValue(change.after),
  }));
  const only = fields.length === 1 ? fields[0] : null;
  let title = `${fields.length} informações atualizadas`;
  if (only?.key === "workflow_stage") {
    title = `Etapa atualizada para ${only.value || "não informada"}`;
  } else if (only?.key === "current_responsibility") {
    title = `Responsável definido como ${only.value || "não informado"}`;
  } else if (only?.key === "next_action") {
    title = "Próximo passo atualizado";
  } else if (only?.key === "notes") {
    title = cleanValue(row?.before_data?.notes)
      ? "Observação atualizada"
      : "Observação adicionada";
  }

  return {
    id: `audit:${row.id}`,
    source: "audit",
    category:
      only?.key === "workflow_stage"
        ? "stage"
        : only?.key === "current_responsibility"
          ? "responsibility"
          : only
            ? "notes"
            : "update",
    title,
    summary:
      only && ["next_action", "notes"].includes(only.key)
        ? only.value
        : fields.map(({ label }) => label).join(" · "),
    actorName,
    createdAt: row.created_at,
    fields,
  };
}

export function activityFromEventRow(event, actorName = "Sistema") {
  return {
    id: `event:${event.id}`,
    source: "event",
    category: event.event_type === "Etapa atualizada" ? "stage" : "event",
    title: cleanValue(event.event_type) || "Atividade registrada",
    summary: publicEventDescription(event),
    actorName,
    createdAt: event.created_at,
    fields: [],
  };
}

export function activityFromRpcRow(row) {
  const fields = Array.isArray(row?.fields) ? row.fields : [];
  return {
    id: row.activity_key,
    source: row.source,
    category: row.category || "event",
    title: row.activity_title || "Atividade registrada",
    summary: row.description_public || "",
    actorName: row.actor_name || "Sistema",
    createdAt: row.occurred_at,
    fields,
  };
}

export function mergeCaseActivities(auditEntries = [], eventEntries = []) {
  const auditStages = auditEntries.filter(
    (entry) => entry.category === "stage",
  );
  const isDuplicatedStageEvent = (event) =>
    event.category === "stage" &&
    auditStages.some(
      (audit) =>
        Math.abs(new Date(audit.createdAt) - new Date(event.createdAt)) <= 5000,
    );

  return [
    ...auditEntries,
    ...eventEntries.filter((event) => !isDuplicatedStageEvent(event)),
  ]
    .filter(Boolean)
    .sort((a, b) => {
      const dateDifference = new Date(b.createdAt) - new Date(a.createdAt);
      return dateDifference || String(b.id).localeCompare(String(a.id));
    });
}
