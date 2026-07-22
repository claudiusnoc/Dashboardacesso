import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarX2,
  Check,
  Plus,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import DocumentChecklist from "./DocumentChecklist";

function digits(value) {
  return value.replace(/\D/g, "").slice(0, 11);
}

export function formatCpf(value) {
  const cpf = digits(value || "");
  return cpf.length === 11
    ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpf;
}

export function AsoBadge({ value, compact = false }) {
  if (!value)
    return (
      <span className="aso-badge missing">
        <CalendarX2 size={14} />
        {compact ? "Sem data informada" : "ASO sem data"}
      </span>
    );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  const days = Math.ceil((due - today) / 86400000);
  const label = due.toLocaleDateString("pt-BR");
  if (days < 0)
    return (
      <span className="aso-badge expired">
        <AlertTriangle size={14} />
        {compact ? "Vencido" : "ASO vencido"} em {label}
      </span>
    );
  if (days <= 30)
    return (
      <span className="aso-badge warning">
        <CalendarClock size={14} />
        {compact ? "Vence" : "ASO vence"} em {label}
      </span>
    );
  return (
    <span className="aso-badge valid">
      <Check size={14} />
      {compact ? "Válido" : "ASO válido"} até {label}
    </span>
  );
}

export default function CollaboratorManager({
  caseId,
  onCountChange,
  onLinksChange,
  onManageDocuments,
  onDocumentsChange,
  allowCreate = true,
  variant = "default",
  copyChecklistOnLink = false,
}) {
  const [links, setLinks] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    city: "",
    next_aso_date: "",
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);
  const [documentPerson, setDocumentPerson] = useState(null);
  const wizard = variant === "wizard";

  function manageDocuments(person) {
    if (onManageDocuments) onManageDocuments(person);
    else setDocumentPerson(person);
  }

  async function loadLinks() {
    const { data, error } = await supabase
      .from("case_collaborators")
      .select("collaborator:collaborators(id,full_name,cpf,city,next_aso_date)")
      .eq("case_id", caseId);
    if (error) setMessage(error.message);
    else {
      const people = (data || [])
        .map((item) => item.collaborator)
        .filter(Boolean);
      setLinks(people);
      onCountChange?.(people.length);
      onLinksChange?.(people);
    }
  }

  useEffect(() => {
    loadLinks();
  }, [caseId]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchAttempted(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_collaborators", {
        search_term: query.trim(),
        result_limit: 10,
      });
      if (!active) return;
      setSearching(false);
      setSearchAttempted(true);
      if (error) setMessage(error.message);
      else {
        setResults(
          (data || []).filter(
            (person) => !links.some((linked) => linked.id === person.id),
          ),
        );
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, links]);

  async function findChecklistSource(targetCollaboratorId) {
    if (!copyChecklistOnLink || !links.length) return null;
    const { data, error } = await supabase
      .from("case_documents")
      .select("collaborator_id,updated_at")
      .eq("case_id", caseId)
      .eq("document_scope", "collaborator")
      .neq("collaborator_id", targetCollaboratorId)
      .order("updated_at", { ascending: false });
    if (error) return null;

    const sourceId = (data || []).find((document) =>
      links.some((person) => person.id === document.collaborator_id),
    )?.collaborator_id;
    return links.find((person) => person.id === sourceId) || null;
  }

  async function link(person) {
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("case_collaborators")
      .upsert(
        { case_id: caseId, collaborator_id: person.id },
        { onConflict: "case_id,collaborator_id", ignoreDuplicates: true },
      );
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    const source = await findChecklistSource(person.id);
    let copiedCount = 0;
    let copyError = null;
    if (source) {
      const { data, error: cloneError } = await supabase.rpc(
        "copy_collaborator_document_checklist",
        {
          p_case_id: caseId,
          p_source_collaborator_id: source.id,
          p_target_collaborator_id: person.id,
        },
      );
      copiedCount = Number(data) || 0;
      copyError = cloneError;
    }

    setQuery("");
    setResults([]);
    await loadLinks();
    if (copyError) {
      setMessage(
        `${person.full_name} foi vinculado, mas não foi possível copiar o checklist. Você pode defini-lo manualmente.`,
      );
    } else if (copiedCount) {
      onDocumentsChange?.();
    }
    setBusy(false);
  }

  async function unlink(person) {
    if (
      !window.confirm(
        `Retirar ${person.full_name} deste caso e remover seu checklist?`,
      )
    )
      return;
    setBusy(true);
    setDocumentPerson((current) =>
      current?.id === person.id ? null : current,
    );
    setMessage("");
    const { error: documentsError } = await supabase
      .from("case_documents")
      .delete()
      .eq("case_id", caseId)
      .eq("collaborator_id", person.id);
    if (documentsError) {
      setMessage(documentsError.message);
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("case_collaborators")
      .delete()
      .eq("case_id", caseId)
      .eq("collaborator_id", person.id);
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      await loadLinks();
      onDocumentsChange?.();
    }
  }

  async function createAndLink(event) {
    event.preventDefault();
    setMessage("");
    const cpf = digits(form.cpf);
    if (!form.full_name.trim() || cpf.length !== 11) {
      setMessage("Informe o nome e um CPF com 11 dígitos.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("collaborators")
      .insert({
        full_name: form.full_name.trim().toUpperCase(),
        cpf,
        city: form.city.trim().toUpperCase() || null,
        next_aso_date: form.next_aso_date || null,
        active: true,
        external_id: `portal:${cpf}`,
      })
      .select("id,full_name,cpf,city,next_aso_date")
      .single();
    if (error) {
      setBusy(false);
      setMessage(
        error.code === "23505"
          ? "Este CPF já está cadastrado. Localize o colaborador pela busca."
          : error.message,
      );
      return;
    }
    await link(data);
    setForm({ full_name: "", cpf: "", city: "", next_aso_date: "" });
    setShowNew(false);
    setBusy(false);
  }

  const linkedPeople = (
    <section className="linked-people-section">
      {wizard && (
        <header className="wizard-linked-heading">
          <div>
            <h3>Colaboradores vinculados</h3>
            <p>Estas pessoas farão parte desta solicitação de acesso.</p>
          </div>
          <span>{links.length}</span>
        </header>
      )}
      <div className="linked-people">
        {links.map((person) => (
          <article
            className={`person-row ${wizard ? "wizard-linked-person" : "person-row-action"}`}
            key={person.id}
            role={wizard ? undefined : "button"}
            tabIndex={wizard ? undefined : 0}
            onClick={wizard ? undefined : () => manageDocuments(person)}
            onKeyDown={
              wizard
                ? undefined
                : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      manageDocuments(person);
                    }
                  }
            }
            aria-label={
              wizard ? undefined : `Definir documentos de ${person.full_name}`
            }
          >
            <div>
              <strong>{person.full_name}</strong>
              <span>
                {formatCpf(person.cpf)} ·{" "}
                {person.city || "Cidade não informada"}
              </span>
              <AsoBadge value={person.next_aso_date} />
              <small className="person-document-hint">
                {wizard
                  ? "Vinculado a este caso"
                  : "Clique para definir documentos"}
              </small>
            </div>
            <button
              className="icon-button danger"
              onClick={(event) => {
                event.stopPropagation();
                unlink(person);
              }}
              disabled={busy}
              title="Retirar colaborador"
              aria-label={`Retirar ${person.full_name}`}
            >
              <X size={18} />
            </button>
          </article>
        ))}
        {!links.length && (
          <div className="wizard-linked-empty">
            <UserPlus size={21} aria-hidden="true" />
            <div>
              <strong>Nenhum colaborador vinculado</strong>
              <span>Use a busca abaixo para adicionar a primeira pessoa.</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );

  const collaboratorSearch = (
    <section className={wizard ? "wizard-collaborator-search" : ""}>
      {wizard && (
        <header>
          <div>
            <h3>Buscar colaborador existente</h3>
            <p>Digite o nome ou CPF e escolha a pessoa encontrada.</p>
          </div>
          <Search size={20} aria-hidden="true" />
        </header>
      )}
      <div className="employee-search">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou CPF"
          />
        </label>
        {results.length > 0 && (
          <div className="employee-results">
            {results.map((person) => (
              <button
                type="button"
                key={person.id}
                onClick={() => link(person)}
                disabled={busy}
              >
                <span>
                  <strong>{person.full_name}</strong>
                  <small>
                    {formatCpf(person.cpf)} ·{" "}
                    {person.city || "Cidade não informada"}
                  </small>
                </span>
                <span className="employee-result-action">
                  <Plus size={16} />
                  Vincular
                </span>
              </button>
            ))}
          </div>
        )}
        {wizard && searching && (
          <div className="wizard-search-feedback" role="status">
            Buscando colaboradores...
          </div>
        )}
        {wizard && searchAttempted && !searching && !results.length && (
          <div className="wizard-search-feedback empty">
            Nenhum colaborador disponível foi encontrado com esse termo.
          </div>
        )}
      </div>

      {allowCreate && (
        <>
          <div className={wizard ? "wizard-create-alternative" : ""}>
            {wizard && (
              <span>
                <strong>Não encontrou a pessoa?</strong>
                Cadastre somente se ela ainda não existir na base.
              </span>
            )}
            <button
              className={`button secondary ${wizard ? "wizard-create-button" : ""}`}
              type="button"
              onClick={() => setShowNew((value) => !value)}
            >
              {showNew ? <X size={17} /> : <UserPlus size={17} />}
              {showNew ? "Fechar cadastro" : "Cadastrar nova pessoa"}
            </button>
          </div>
          {showNew && (
            <form className="employee-form" onSubmit={createAndLink}>
              <label>
                Funcionário
                <input
                  value={form.full_name}
                  onChange={(event) =>
                    setForm({ ...form, full_name: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                CPF
                <input
                  value={formatCpf(form.cpf)}
                  onChange={(event) =>
                    setForm({ ...form, cpf: digits(event.target.value) })
                  }
                  inputMode="numeric"
                  required
                />
              </label>
              <label>
                Cidade de atuação
                <input
                  value={form.city}
                  onChange={(event) =>
                    setForm({ ...form, city: event.target.value })
                  }
                />
              </label>
              <label>
                Data do próximo ASO
                <input
                  type="date"
                  value={form.next_aso_date}
                  onChange={(event) =>
                    setForm({ ...form, next_aso_date: event.target.value })
                  }
                />
              </label>
              <div className="wide form-actions">
                <button className="button primary" disabled={busy}>
                  {busy ? "Cadastrando..." : "Cadastrar e vincular"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );

  return (
    <div
      className={`collaborator-manager ${wizard ? "wizard-collaborator-manager" : ""}`}
    >
      {wizard ? (
        <>
          {collaboratorSearch}
          {linkedPeople}
        </>
      ) : (
        <>
          {linkedPeople}
          {collaboratorSearch}
        </>
      )}
      {message && <div className="alert error">{message}</div>}
      <DocumentChecklist
        caseId={caseId}
        collaborator={documentPerson}
        open={Boolean(documentPerson)}
        onClose={() => setDocumentPerson(null)}
        onSaved={async () => {
          await loadLinks();
          onDocumentsChange?.();
        }}
      />
    </div>
  );
}
