import test from "node:test";
import assert from "node:assert/strict";
import {
  activityFromAuditRow,
  activityFromEventRow,
  caseDetailChanges,
  mergeCaseActivities,
} from "../src/lib/caseDetailAudit.js";

test("identifica alterações em próximo passo e observações", () => {
  const changes = caseDetailChanges(
    { next_action: "Aguardar documentos", notes: "Contato inicial" },
    { next_action: "Enviar para validação", notes: "Checklist concluído" },
  );

  assert.deepEqual(
    changes.map(({ key, before, after }) => ({ key, before, after })),
    [
      {
        key: "next_action",
        before: "Aguardar documentos",
        after: "Enviar para validação",
      },
      {
        key: "notes",
        before: "Contato inicial",
        after: "Checklist concluído",
      },
    ],
  );
});

test("não cria histórico para valores operacionais equivalentes", () => {
  const changes = caseDetailChanges(
    { next_action: null, notes: "Sem pendências" },
    { next_action: "", notes: "Sem pendências" },
  );

  assert.equal(changes.length, 0);
});

test("formata a etapa no comparativo sem alterar o valor persistido", () => {
  const labels = {
    documentacao: "Documentação em preparação",
    validacao: "Em validação",
  };
  const changes = caseDetailChanges(
    { workflow_stage: "documentacao" },
    { workflow_stage: "validacao" },
    (value) => labels[value],
  );

  assert.deepEqual(changes[0], {
    key: "workflow_stage",
    label: "Etapa atual",
    before: "Documentação em preparação",
    after: "Em validação",
  });
});

test("normaliza cada campo como atividade mostrando apenas o novo valor", () => {
  const scenarios = [
    ["workflow_stage", "holder_validation", "Etapa atualizada para Validação"],
    ["current_responsibility", "CLARO", "Responsável definido como CLARO"],
    ["next_action", "Solicitar liberação", "Próximo passo atualizado"],
    ["notes", "Cliente avisado", "Observação adicionada"],
  ];

  for (const [key, value, title] of scenarios) {
    const entry = activityFromAuditRow(
      {
        id: key,
        before_data: { [key]: "" },
        after_data: { [key]: value },
        created_at: "2026-08-26T12:00:00Z",
      },
      "Ana Lima",
      (stage) => (stage === "holder_validation" ? "Validação" : stage),
    );
    assert.equal(entry.title, title);
    assert.equal(
      entry.fields[0].value,
      key === "workflow_stage" ? "Validação" : value,
    );
    assert.equal("before" in entry.fields[0], false);
  }
});

test("remove a duplicidade entre auditoria e evento de etapa próximos", () => {
  const audit = activityFromAuditRow({
    id: "audit-1",
    before_data: { workflow_stage: "one" },
    after_data: { workflow_stage: "two" },
    created_at: "2026-08-26T12:00:00Z",
  });
  const duplicatedEvent = activityFromEventRow({
    id: "event-1",
    event_type: "Etapa atualizada",
    description: "Etapa alterada de Um para Dois.",
    created_at: "2026-08-26T12:00:03Z",
  });
  const creationEvent = activityFromEventRow({
    id: "event-2",
    event_type: "Caso criado",
    description: "Demanda iniciada.",
    created_at: "2026-08-26T11:00:00Z",
  });

  const merged = mergeCaseActivities([audit], [duplicatedEvent, creationEvent]);
  assert.deepEqual(
    merged.map(({ id }) => id),
    ["audit:audit-1", "event:event-2"],
  );
});

test("remove a comparação textual de eventos legados de etapa", () => {
  const entry = activityFromEventRow({
    id: "event-1",
    event_type: "Etapa atualizada",
    description: "Etapa alterada de Cadastro para Validação da detentora.",
    created_at: "2026-08-26T12:00:00Z",
  });

  assert.equal(entry.summary, "Etapa atualizada para Validação da detentora");
  assert.equal(entry.summary.includes("alterada de"), false);
});
