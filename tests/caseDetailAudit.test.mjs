import test from "node:test";
import assert from "node:assert/strict";
import { caseDetailChanges } from "../src/lib/caseDetailAudit.js";

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
