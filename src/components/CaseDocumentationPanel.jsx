import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileText,
  FolderOpen,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const DOCUMENT_STATUSES = [
  { value: "pendente", label: "Pendente", tone: "pending", icon: Clock3 },
  {
    value: "em_elaboracao",
    label: "Em preparação",
    tone: "preparing",
    icon: FileClock,
  },
  {
    value: "coletado",
    label: "Coletado",
    tone: "collected",
    icon: ClipboardCheck,
  },
  { value: "enviado", label: "Enviado", tone: "sent", icon: FileText },
  {
    value: "vencido",
    label: "Vencido",
    tone: "expired",
    icon: AlertTriangle,
  },
  {
    value: "aprovado",
    label: "Concluído",
    tone: "approved",
    icon: CheckCircle2,
  },
];

const STATUS_BY_VALUE = new Map(
  DOCUMENT_STATUSES.map((status) => [status.value, status]),
);

function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function normalizeRelationship(value) {
  return Array.isArray(value) ? value[0] : value;
}

function groupByCategory(documents) {
  return documents.reduce((groups, document) => {
    const requirement = normalizeRelationship(document.requirement);
    const category = requirement?.category || "Outros";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push({
      ...document,
      requirement,
    });
    return groups;
  }, new Map());
}

function personSummary(documents) {
  const total = documents.length;
  const completed = documents.filter(
    (document) => document.status === "aprovado",
  ).length;
  const expired = documents.filter(
    (document) => document.status === "vencido",
  ).length;
  return {
    total,
    completed,
    expired,
    percentage: total ? Math.round((completed / total) * 100) : 0,
  };
}

function overallLabel(summary) {
  if (!summary.total) return "Checklist não definido";
  if (summary.expired)
    return `${summary.expired} vencido${summary.expired > 1 ? "s" : ""}`;
  if (summary.completed === summary.total) return "Documentação concluída";
  return "Documentação em andamento";
}

export default function CaseDocumentationPanel({
  caseId,
  collaborators = [],
  isOperation,
  refreshKey = 0,
  onManageDocuments,
  title = "Documentação do acesso",
  description = "Acompanhamento individual dos documentos exigidos neste caso.",
  emptyOperationMessage = "Vincule um colaborador no painel lateral para iniciar o checklist.",
}) {
  const [documents, setDocuments] = useState([]);
  const [expandedId, setExpandedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDocuments() {
      setLoading((current) => current || documents.length === 0);
      setMessage("");
      const { data, error } = await supabase
        .from("case_documents")
        .select(
          "id,collaborator_id,requirement_id,name,status,due_date,evidence_note,updated_at,requirement:document_requirements(category,description)",
        )
        .eq("case_id", caseId)
        .eq("document_scope", "collaborator")
        .order("name");

      if (!active) return;
      setLoading(false);
      if (error) {
        setMessage(error.message);
        return;
      }
      setDocuments(data || []);
    }

    loadDocuments();
    return () => {
      active = false;
    };
  }, [caseId, refreshKey]);

  const panelCollaborators = useMemo(() => {
    if (collaborators.length) return collaborators;
    if (!isOperation && documents.length) {
      return [
        {
          id: "visible-documents",
          full_name: "Documentos disponibilizados",
          cpf: "",
          city: "",
        },
      ];
    }
    return [];
  }, [collaborators, documents, isOperation]);

  useEffect(() => {
    if (!panelCollaborators.length) {
      setExpandedId("");
      return;
    }
    setExpandedId((current) =>
      panelCollaborators.some((person) => person.id === current)
        ? current
        : panelCollaborators[0].id,
    );
  }, [panelCollaborators]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 2400);
    return () => clearTimeout(timer);
  }, [notice]);

  const documentsByPerson = useMemo(() => {
    const groups = new Map();
    if (!collaborators.length && !isOperation && documents.length) {
      groups.set("visible-documents", documents);
      return groups;
    }
    documents.forEach((document) => {
      const key = document.collaborator_id || "case";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(document);
    });
    return groups;
  }, [collaborators.length, documents, isOperation]);

  const visibleCollaborators = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    if (!term) return panelCollaborators;
    return panelCollaborators.filter((person) =>
      [person.full_name, person.cpf, person.city]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
    );
  }, [panelCollaborators, query]);

  const overall = useMemo(() => personSummary(documents), [documents]);

  async function updateDocumentStatus(document, status) {
    if (!isOperation || document.status === status) return;
    setSavingId(document.id);
    setMessage("");
    const { data, error } = await supabase
      .from("case_documents")
      .update({ status })
      .eq("id", document.id)
      .select("status,updated_at")
      .single();

    setSavingId("");
    if (error) {
      setMessage(error.message);
      return;
    }

    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id ? { ...item, ...data } : item,
      ),
    );
    setNotice(`Status de ${document.name} atualizado`);
  }

  return (
    <section
      className="case-documentation-panel"
      aria-labelledby="case-documentation-title"
    >
      <header className="case-documentation-header">
        <div className="case-documentation-title">
          <span className="case-documentation-icon" aria-hidden="true">
            <FolderOpen size={22} />
          </span>
          <div>
            <h2 id="case-documentation-title">{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        <div
          className="case-documentation-summary"
          aria-label="Resumo documental"
        >
          <span>
            <strong>{panelCollaborators.length}</strong>
            {isOperation ? "colaboradores" : "checklists"}
          </span>
          <span>
            <strong>
              {overall.completed}/{overall.total}
            </strong>
            concluídos
          </span>
          <span className={overall.expired ? "has-expired" : ""}>
            <strong>{overall.percentage}%</strong>
            progresso
          </span>
        </div>
      </header>

      {(panelCollaborators.length > 1 || notice) && (
        <div className="case-documentation-toolbar">
          {panelCollaborators.length > 1 ? (
            <label className="case-documentation-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Buscar colaborador</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar colaborador nesta demanda"
              />
            </label>
          ) : (
            <span />
          )}
          {notice && (
            <span className="case-documentation-notice" role="status">
              <Check size={15} />
              {notice}
            </span>
          )}
        </div>
      )}

      {message && <div className="alert error">{message}</div>}

      {loading ? (
        <div
          className="documentation-skeleton"
          aria-label="Carregando documentação"
        >
          {[0, 1].map((item) => (
            <span key={item} />
          ))}
        </div>
      ) : !panelCollaborators.length ? (
        <div className="case-documentation-empty">
          {isOperation ? (
            <UserRound size={25} aria-hidden="true" />
          ) : (
            <FileText size={25} aria-hidden="true" />
          )}
          <div>
            <strong>
              {isOperation
                ? "Nenhum colaborador vinculado"
                : "Nenhum documento disponibilizado"}
            </strong>
            <span>
              {isOperation
                ? emptyOperationMessage
                : "A operação EQS ainda não liberou documentos deste caso para consulta."}
            </span>
          </div>
        </div>
      ) : !visibleCollaborators.length ? (
        <div className="case-documentation-empty compact">
          <Search size={22} aria-hidden="true" />
          <div>
            <strong>Nenhum colaborador encontrado</strong>
            <span>Revise o termo informado na busca.</span>
          </div>
        </div>
      ) : (
        <div className="document-collaborator-list">
          {visibleCollaborators.map((person) => {
            const personDocuments = documentsByPerson.get(person.id) || [];
            const summary = personSummary(personDocuments);
            const categories = Array.from(
              groupByCategory(personDocuments).entries(),
            );
            const expanded = expandedId === person.id;
            return (
              <article
                className={`document-collaborator ${expanded ? "expanded" : ""}`}
                key={person.id}
              >
                <button
                  type="button"
                  className="document-collaborator-trigger"
                  onClick={() => setExpandedId(expanded ? "" : person.id)}
                  aria-expanded={expanded}
                  aria-controls={`documents-${person.id}`}
                >
                  <span className="document-person-mark" aria-hidden="true">
                    <UserRound size={17} />
                  </span>
                  <span className="document-person-copy">
                    <strong>{person.full_name}</strong>
                    <small>{overallLabel(summary)}</small>
                  </span>
                  <span className="document-person-count">
                    <strong>
                      {summary.completed}/{summary.total}
                    </strong>
                    documentos
                  </span>
                  <span className="document-person-progress">
                    <strong>{summary.percentage}%</strong>
                    <span aria-hidden="true">
                      <i
                        style={{
                          transform: `scaleX(${summary.percentage / 100})`,
                        }}
                      />
                    </span>
                  </span>
                  <ChevronDown className="document-person-chevron" size={18} />
                </button>

                {expanded && (
                  <div
                    className="document-collaborator-content"
                    id={`documents-${person.id}`}
                  >
                    {categories.length ? (
                      <div className="document-category-grid">
                        {categories.map(([category, categoryDocuments]) => {
                          const categorySummary =
                            personSummary(categoryDocuments);
                          return (
                            <section
                              className="document-category"
                              key={category}
                            >
                              <header>
                                <h3>{category}</h3>
                                <span>
                                  {categorySummary.completed}/
                                  {categorySummary.total}
                                </span>
                              </header>
                              <div className="document-category-items">
                                {categoryDocuments.map((document) => {
                                  const status =
                                    STATUS_BY_VALUE.get(document.status) ||
                                    STATUS_BY_VALUE.get("pendente");
                                  const StatusIcon = status.icon;
                                  const detail = document.due_date
                                    ? `Validade ${formatDate(document.due_date)}`
                                    : document.evidence_note;
                                  return (
                                    <div
                                      className="case-document-row"
                                      key={document.id}
                                    >
                                      <span
                                        className={`case-document-state ${status.tone}`}
                                        aria-hidden="true"
                                      >
                                        <StatusIcon size={14} />
                                      </span>
                                      <span className="case-document-copy">
                                        <strong
                                          title={
                                            document.requirement?.description ||
                                            undefined
                                          }
                                        >
                                          {document.name}
                                        </strong>
                                        {detail && <small>{detail}</small>}
                                      </span>
                                      {isOperation ? (
                                        <label
                                          className={`case-document-status ${status.tone}`}
                                        >
                                          <span className="sr-only">
                                            Status de {document.name}
                                          </span>
                                          <select
                                            value={document.status}
                                            onChange={(event) =>
                                              updateDocumentStatus(
                                                document,
                                                event.target.value,
                                              )
                                            }
                                            disabled={savingId === document.id}
                                          >
                                            {DOCUMENT_STATUSES.map((option) => (
                                              <option
                                                value={option.value}
                                                key={option.value}
                                              >
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                          <ChevronDown
                                            size={13}
                                            aria-hidden="true"
                                          />
                                        </label>
                                      ) : (
                                        <span
                                          className={`case-document-status readonly ${status.tone}`}
                                        >
                                          {status.label}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="document-person-empty">
                        <FileText size={20} aria-hidden="true" />
                        <span>
                          Nenhum documento foi definido para este colaborador.
                        </span>
                      </div>
                    )}

                    {isOperation && (
                      <footer className="document-collaborator-actions">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => onManageDocuments?.(person)}
                        >
                          <SlidersHorizontal size={16} />
                          {personDocuments.length
                            ? "Editar documentos necessários"
                            : "Definir documentos necessários"}
                        </button>
                      </footer>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
