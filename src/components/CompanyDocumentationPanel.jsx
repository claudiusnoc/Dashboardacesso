import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  FileText,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const REQUIREMENT_OPTIONS = [
  { value: "a_definir", label: "A definir" },
  { value: "necessaria", label: "Necessária" },
  { value: "nao_necessaria", label: "Não necessária" },
];

const COMPANY_DOCUMENT_STATUSES = [
  { value: "pendente", label: "Pendente", tone: "pending", icon: Clock3 },
  {
    value: "coletado",
    label: "Recebido",
    tone: "collected",
    icon: ClipboardCheck,
  },
  {
    value: "aprovado",
    label: "Aprovado",
    tone: "approved",
    icon: CheckCircle2,
  },
];

const STATUS_BY_VALUE = new Map(
  COMPANY_DOCUMENT_STATUSES.map((status) => [status.value, status]),
);

function normalizeError(error) {
  return error?.message || "Não foi possível concluir a operação.";
}

export default function CompanyDocumentationPanel({
  caseId,
  requirement = "a_definir",
  isOperation,
  onRequirementChange,
}) {
  const [documents, setDocuments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");

  async function loadDocuments() {
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase
      .from("case_documents")
      .select("id,requirement_id,name,status,updated_at")
      .eq("case_id", caseId)
      .eq("document_scope", "company")
      .order("name");
    setLoading(false);
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    setDocuments(data || []);
  }

  useEffect(() => {
    loadDocuments();
  }, [caseId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!pickerOpen) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) setPickerOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, pickerOpen]);

  const completed = documents.filter(
    (document) => document.status === "aprovado",
  ).length;
  const linkedRequirementIds = useMemo(
    () => new Set(documents.map((document) => document.requirement_id)),
    [documents],
  );
  const availableRequirements = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return catalog.filter(
      (item) =>
        !linkedRequirementIds.has(item.id) &&
        (!term ||
          [item.name, item.description]
            .filter(Boolean)
            .some((value) => value.toLocaleLowerCase("pt-BR").includes(term))),
    );
  }, [catalog, linkedRequirementIds, query]);
  const exactCatalogMatch = catalog.some(
    (item) =>
      item.name.toLocaleLowerCase("pt-BR") ===
      query.trim().toLocaleLowerCase("pt-BR"),
  );

  async function changeRequirement(nextRequirement) {
    if (!isOperation || nextRequirement === requirement || busy) return;
    if (nextRequirement === "nao_necessaria") {
      const documentCount = documents.length;
      const confirmed = window.confirm(
        documentCount
          ? `Marcar a documentação patronal como não necessária?\n\nOs ${documentCount} documento${documentCount === 1 ? "" : "s"} deste checklist serão apagados. Esta ação não pode ser desfeita.`
          : "Marcar a documentação patronal como não necessária?",
      );
      if (!confirmed) return;
    }

    setBusy(true);
    setMessage("");
    const { error } = await supabase.rpc("set_company_documents_requirement", {
      p_case_id: caseId,
      p_requirement: nextRequirement,
    });
    setBusy(false);
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    if (nextRequirement === "nao_necessaria") setDocuments([]);
    onRequirementChange?.(nextRequirement);
    setNotice("Configuração patronal atualizada");
  }

  async function openPicker() {
    setPickerOpen(true);
    setPickerLoading(true);
    setQuery("");
    setMessage("");
    const { data, error } = await supabase
      .from("document_requirements")
      .select("id,name,description")
      .eq("active", true)
      .eq("document_scope", "company")
      .order("name");
    if (error) {
      setPickerLoading(false);
      setMessage(normalizeError(error));
      return;
    }
    setCatalog(data || []);
    setPickerLoading(false);
  }

  async function addRequirement(requirementItem) {
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase
      .from("case_documents")
      .insert({
        case_id: caseId,
        requirement_id: requirementItem.id,
        name: requirementItem.name,
        status: "pendente",
        document_scope: "company",
        is_client_visible: true,
      })
      .select("id,requirement_id,name,status,updated_at")
      .single();
    setBusy(false);
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    setDocuments((current) =>
      [...current, data].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    );
    setNotice(`${data.name} adicionado`);
  }

  async function createAndAddRequirement(event) {
    event.preventDefault();
    const name = query.trim();
    if (!name || exactCatalogMatch) return;
    setBusy(true);
    setMessage("");

    const { data: existing, error: lookupError } = await supabase
      .from("document_requirements")
      .select("id,name,description,document_scope,active")
      .ilike("name", name)
      .maybeSingle();

    if (lookupError) {
      setBusy(false);
      setMessage(normalizeError(lookupError));
      return;
    }
    if (
      existing?.document_scope !== undefined &&
      existing.document_scope !== "company"
    ) {
      setBusy(false);
      setMessage(
        "Já existe um documento de colaborador com esse nome. Use um nome patronal diferente.",
      );
      return;
    }

    let requirementItem = existing;
    if (requirementItem && !requirementItem.active) {
      const { error } = await supabase
        .from("document_requirements")
        .update({ active: true })
        .eq("id", requirementItem.id);
      if (error) {
        setBusy(false);
        setMessage(normalizeError(error));
        return;
      }
      requirementItem = { ...requirementItem, active: true };
      setCatalog((current) => [...current, requirementItem]);
    }
    if (!requirementItem) {
      const { data, error } = await supabase
        .from("document_requirements")
        .insert({
          name,
          category: "Documentos Patronais",
          required: false,
          active: true,
          is_system: false,
          document_scope: "company",
        })
        .select("id,name,description")
        .single();
      if (error) {
        setBusy(false);
        setMessage(normalizeError(error));
        return;
      }
      requirementItem = data;
      setCatalog((current) => [...current, data]);
    }

    const { data: document, error: documentError } = await supabase
      .from("case_documents")
      .insert({
        case_id: caseId,
        requirement_id: requirementItem.id,
        name: requirementItem.name,
        status: "pendente",
        document_scope: "company",
        is_client_visible: true,
      })
      .select("id,requirement_id,name,status,updated_at")
      .single();
    setBusy(false);
    if (documentError) {
      setMessage(normalizeError(documentError));
      return;
    }
    setDocuments((current) =>
      [...current, document].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    );
    setQuery("");
    setNotice(`${document.name} cadastrado e adicionado`);
  }

  async function updateStatus(document, status) {
    if (!isOperation || document.status === status) return;
    setSavingId(document.id);
    setMessage("");
    const { data, error } = await supabase
      .from("case_documents")
      .update({ status })
      .eq("id", document.id)
      .eq("document_scope", "company")
      .select("status,updated_at")
      .single();
    setSavingId("");
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id ? { ...item, ...data } : item,
      ),
    );
    setNotice(`Status de ${document.name} atualizado`);
  }

  function startEditing(document) {
    setEditingId(document.id);
    setEditingName(document.name);
  }

  async function saveName(document) {
    const name = editingName.trim();
    if (!name || name === document.name) {
      setEditingId("");
      return;
    }
    setSavingId(document.id);
    setMessage("");
    const { data, error } = await supabase
      .from("case_documents")
      .update({ name })
      .eq("id", document.id)
      .eq("document_scope", "company")
      .select("name,updated_at")
      .single();
    setSavingId("");
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    setDocuments((current) =>
      current.map((item) =>
        item.id === document.id ? { ...item, ...data } : item,
      ),
    );
    setEditingId("");
    setNotice("Nome atualizado neste caso");
  }

  async function deleteDocument(document) {
    const confirmed = window.confirm(
      `Excluir “${document.name}” deste checklist?\n\nO cadastro continuará disponível para outros casos.`,
    );
    if (!confirmed) return;
    setSavingId(document.id);
    setMessage("");
    const { error } = await supabase
      .from("case_documents")
      .delete()
      .eq("id", document.id)
      .eq("document_scope", "company");
    setSavingId("");
    if (error) {
      setMessage(normalizeError(error));
      return;
    }
    setDocuments((current) =>
      current.filter((item) => item.id !== document.id),
    );
    setNotice(`${document.name} excluído do caso`);
  }

  const requirementLabel =
    REQUIREMENT_OPTIONS.find((option) => option.value === requirement)?.label ||
    "A definir";

  return (
    <section
      className={`side-panel company-documents-panel state-${requirement}`}
      aria-labelledby="company-documents-title"
    >
      <header className="company-documents-heading">
        <span className="company-documents-icon" aria-hidden="true">
          <Building2 size={22} />
        </span>
        <div>
          <h2 id="company-documents-title">Documentação patronal</h2>
          {requirement === "necessaria" && (
            <p>
              {completed}/{documents.length} aprovado
              {documents.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {isOperation ? (
          <label className="company-requirement-select">
            <span className="sr-only">
              Necessidade da documentação patronal
            </span>
            <select
              value={requirement}
              onChange={(event) => changeRequirement(event.target.value)}
              disabled={busy}
            >
              {REQUIREMENT_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
        ) : (
          <span className="company-requirement-badge">{requirementLabel}</span>
        )}
      </header>

      {notice && (
        <div className="company-documents-notice" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}
      {message && <div className="alert error">{message}</div>}

      {requirement === "a_definir" && (
        <div className="company-documents-state">
          <FileText size={22} aria-hidden="true" />
          <div>
            <strong>Necessidade ainda não definida</strong>
            <span>
              {isOperation
                ? "Escolha se a detentora exige documentos da empresa."
                : "A operação EQS ainda não concluiu esta configuração."}
            </span>
          </div>
        </div>
      )}

      {requirement === "nao_necessaria" && (
        <div className="company-documents-collapsed">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>Documentação patronal não necessária</span>
        </div>
      )}

      {requirement === "necessaria" && (
        <div className="company-documents-content">
          {loading ? (
            <div
              className="company-documents-loading"
              aria-label="Carregando documentos"
            >
              <span />
              <span />
              <span />
            </div>
          ) : documents.length ? (
            <div className="company-document-list">
              {documents.map((document) => {
                const status =
                  STATUS_BY_VALUE.get(document.status) ||
                  STATUS_BY_VALUE.get("pendente");
                const StatusIcon = status.icon;
                const editing = editingId === document.id;
                return (
                  <article className="company-document-item" key={document.id}>
                    <span
                      className={`company-document-state ${status.tone}`}
                      aria-hidden="true"
                    >
                      <StatusIcon size={16} />
                    </span>
                    {editing ? (
                      <form
                        className="company-document-edit"
                        onSubmit={(event) => {
                          event.preventDefault();
                          saveName(document);
                        }}
                      >
                        <label>
                          <span className="sr-only">Nome do documento</span>
                          <input
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            maxLength={160}
                            autoFocus
                            disabled={savingId === document.id}
                          />
                        </label>
                        <button
                          type="submit"
                          className="company-icon-button save"
                          aria-label={`Salvar nome de ${document.name}`}
                          disabled={
                            !editingName.trim() || savingId === document.id
                          }
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          className="company-icon-button"
                          onClick={() => setEditingId("")}
                          aria-label="Cancelar edição"
                          disabled={savingId === document.id}
                        >
                          <X size={16} />
                        </button>
                      </form>
                    ) : (
                      <div className="company-document-copy">
                        <strong>{document.name}</strong>
                        {!isOperation && <span>{status.label}</span>}
                      </div>
                    )}

                    {!editing &&
                      (isOperation ? (
                        <div className="company-document-actions">
                          <label
                            className={`company-document-status ${status.tone}`}
                          >
                            <span className="sr-only">
                              Status de {document.name}
                            </span>
                            <select
                              value={document.status}
                              onChange={(event) =>
                                updateStatus(document, event.target.value)
                              }
                              disabled={savingId === document.id}
                            >
                              {COMPANY_DOCUMENT_STATUSES.map((option) => (
                                <option value={option.value} key={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={13} aria-hidden="true" />
                          </label>
                          <button
                            type="button"
                            className="company-icon-button"
                            onClick={() => startEditing(document)}
                            aria-label={`Editar ${document.name}`}
                            disabled={savingId === document.id}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="company-icon-button danger"
                            onClick={() => deleteDocument(document)}
                            aria-label={`Excluir ${document.name} do caso`}
                            disabled={savingId === document.id}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`company-document-readonly ${status.tone}`}
                        >
                          {status.label}
                        </span>
                      ))}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="company-documents-empty">
              <FilePlus2 size={22} aria-hidden="true" />
              <div>
                <strong>Nenhum documento solicitado</strong>
                <span>
                  {isOperation
                    ? "Adicione os documentos exigidos pela detentora."
                    : "A operação EQS ainda não adicionou itens ao checklist."}
                </span>
              </div>
            </div>
          )}

          {isOperation && (
            <button
              type="button"
              className="button secondary company-add-document"
              onClick={openPicker}
              disabled={busy}
            >
              <Plus size={17} />
              Adicionar documento
            </button>
          )}
        </div>
      )}

      {pickerOpen && (
        <div
          className="document-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy)
              setPickerOpen(false);
          }}
        >
          <section
            className="document-modal company-document-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="company-document-modal-title"
          >
            <header className="document-modal-header">
              <span className="document-modal-icon" aria-hidden="true">
                <Building2 size={18} />
              </span>
              <div>
                <h2 id="company-document-modal-title">
                  Adicionar documento patronal
                </h2>
                <p>Escolha um cadastro existente ou crie um novo.</p>
              </div>
              <button
                type="button"
                className="document-modal-close"
                onClick={() => setPickerOpen(false)}
                disabled={busy}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="document-modal-body company-document-modal-body">
              <label className="company-document-search">
                Buscar ou cadastrar documento
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: balanço patrimonial"
                  autoFocus
                  disabled={busy}
                />
              </label>

              <div className="company-catalog-list">
                {pickerLoading ? (
                  <p className="company-catalog-empty">
                    Carregando catálogo patronal...
                  </p>
                ) : (
                  availableRequirements.map((item) => (
                    <div className="company-catalog-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        {item.description && <span>{item.description}</span>}
                      </div>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => addRequirement(item)}
                        disabled={busy}
                      >
                        Adicionar
                      </button>
                    </div>
                  ))
                )}
                {!pickerLoading && !availableRequirements.length && (
                  <p className="company-catalog-empty">
                    {query.trim()
                      ? "Nenhum documento disponível com esse nome."
                      : "Todos os documentos cadastrados já estão neste caso."}
                  </p>
                )}
              </div>

              {query.trim() && !exactCatalogMatch && (
                <form
                  className="company-document-create"
                  onSubmit={createAndAddRequirement}
                >
                  <div>
                    <strong>Cadastrar “{query.trim()}”</strong>
                    <span>
                      O novo documento ficará disponível para outros casos.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={busy}
                  >
                    <Plus size={16} />
                    Cadastrar e adicionar
                  </button>
                </form>
              )}
            </div>

            {message && <div className="alert error">{message}</div>}
            <footer className="document-modal-footer">
              <span>{documents.length} no checklist</span>
              <button
                type="button"
                className="button secondary"
                onClick={() => setPickerOpen(false)}
                disabled={busy}
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
