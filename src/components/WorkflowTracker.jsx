import {
  CalendarClock,
  CircleCheckBig,
  FileStack,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";

export const WORKFLOW_STAGES = [
  {
    key: "blockage_identified",
    label: "Bloqueio identificado",
    Icon: ShieldAlert,
  },
  {
    key: "documents_preparation",
    label: "Documentação em preparação",
    Icon: FileStack,
  },
  {
    key: "holder_validation",
    label: "Validação pela detentora",
    Icon: SearchCheck,
  },
  {
    key: "new_access_attempt",
    label: "Nova tentativa de acesso",
    Icon: CalendarClock,
  },
  {
    key: "access_released",
    label: "Acesso liberado",
    Icon: CircleCheckBig,
  },
];

export function workflowLabel(value) {
  return (
    WORKFLOW_STAGES.find((stage) => stage.key === value)?.label ||
    "Etapa não informada"
  );
}

const WORKFLOW_SHORT_LABELS = {
  blockage_identified: "Bloqueio",
  documents_preparation: "Documentação",
  holder_validation: "Validação",
  new_access_attempt: "Nova tentativa",
  access_released: "Liberado",
};

const WORKFLOW_DETAIL_LABELS = {
  blockage_identified: "Bloqueio identificado",
  documents_preparation: "Documentação",
  holder_validation: "Análise",
  new_access_attempt: "Agendamento",
  access_released: "Concluído",
};

export function workflowDetailLabel(value) {
  return WORKFLOW_DETAIL_LABELS[value] || "Etapa não informada";
}

export function WorkflowSummary({ value, variant = "row" }) {
  const currentIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage.key === value,
  );
  const released = value === "access_released";
  const stageNumber = currentIndex >= 0 ? currentIndex + 1 : null;
  const detail = stageNumber
    ? `Etapa ${stageNumber} de ${WORKFLOW_STAGES.length} · ${WORKFLOW_SHORT_LABELS[value]}`
    : "Etapa não informada";

  return (
    <span
      className={`workflow-summary ${variant} stage-${value || "unknown"}`}
      aria-label={`${released ? "Concluído" : "Em andamento"}. ${detail}`}
    >
      <span className="workflow-summary-track" aria-hidden="true">
        {WORKFLOW_STAGES.map((stage, index) => {
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "future";
          return (
            <span
              className={`workflow-summary-step ${state}`}
              key={stage.key}
            />
          );
        })}
      </span>
      <span className="workflow-summary-copy">
        <strong>{released ? "Concluído" : "Em andamento"}</strong>
        <small>{detail}</small>
      </span>
    </span>
  );
}

export default function WorkflowTracker({
  value,
  compact = false,
  variant = "default",
}) {
  const currentIndex = WORKFLOW_STAGES.findIndex(
    (stage) => stage.key === value,
  );

  if (compact) {
    const stage = WORKFLOW_STAGES[currentIndex] || WORKFLOW_STAGES[0];
    const Icon = stage.Icon;
    return (
      <span
        className={`workflow-compact stage-${stage.key} ${
          currentIndex < 0 ? "unknown" : ""
        }`}
        tabIndex="0"
        aria-label={`Etapa atual: ${stage.label}`}
        data-tooltip={stage.label}
      >
        <Icon size={17} strokeWidth={2.2} />
      </span>
    );
  }

  if (variant === "detail") {
    return (
      <ol
        className="workflow-track detail"
        aria-label="Progresso do caso de acesso"
      >
        {WORKFLOW_STAGES.map((stage, index) => {
          const state =
            index < currentIndex
              ? "complete"
              : index === currentIndex
                ? "current"
                : "future";
          return (
            <li className={`workflow-step ${state}`} key={stage.key}>
              <span
                className="workflow-marker"
                aria-label={`${workflowDetailLabel(stage.key)}: ${
                  state === "complete"
                    ? "concluída"
                    : state === "current"
                      ? "etapa atual"
                      : "próxima etapa"
                }`}
                aria-current={state === "current" ? "step" : undefined}
              >
                {index + 1}
              </span>
              <span className="workflow-detail-label">
                {workflowDetailLabel(stage.key)}
              </span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="workflow-track" aria-label="Progresso do caso de acesso">
      {WORKFLOW_STAGES.map((stage, index) => {
        const Icon = stage.Icon;
        const state =
          index < currentIndex
            ? "complete"
            : index === currentIndex
              ? "current"
              : "future";
        return (
          <li className={`workflow-step ${state}`} key={stage.key}>
            <span
              className="workflow-marker"
              tabIndex="0"
              aria-label={`${stage.label}: ${
                state === "complete"
                  ? "concluída"
                  : state === "current"
                    ? "etapa atual"
                    : "próxima etapa"
              }`}
              aria-current={state === "current" ? "step" : undefined}
              data-tooltip={stage.label}
            >
              <Icon size={20} strokeWidth={2.2} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
