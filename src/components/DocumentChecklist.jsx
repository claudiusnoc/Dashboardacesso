import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import { supabase } from "../lib/supabase";

function groupRequirements(requirements) {
  return requirements.reduce((groups, requirement) => {
    const category = requirement.category || "Outros";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(requirement);
    return groups;
  }, new Map());
}

export default function DocumentChecklist({
  caseId,
  collaborator,
  open,
  onClose,
  onSaved,
}) {
  const [requirements, setRequirements] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [customName, setCustomName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const collaboratorId = collaborator?.id || "";

  async function loadChecklist() {
    if (!open || !caseId || !collaboratorId) return;
    setLoading(true);
    setMessage("");
    const [
      { data: catalog, error: catalogError },
      { data: existingDocuments, error: documentsError },
    ] = await Promise.all([
      supabase
        .from("document_requirements")
        .select("id,name,description,category,is_system")
        .eq("active", true)
        .eq("document_scope", "collaborator")
        .order("category")
        .order("name"),
      supabase
        .from("case_documents")
        .select("id,requirement_id,name,status")
        .eq("case_id", caseId)
        .eq("document_scope", "collaborator")
        .eq("collaborator_id", collaboratorId),
    ]);
    setLoading(false);
    if (catalogError || documentsError) {
      setMessage((catalogError || documentsError).message);
      return;
    }
    const linkedIds = new Set(
      (existingDocuments || [])
        .map((document) => document.requirement_id)
        .filter(Boolean),
    );
    setRequirements(catalog || []);
    setDocuments(existingDocuments || []);
    setSelectedIds(linkedIds);
  }

  useEffect(() => {
    loadChecklist();
  }, [open, caseId, collaboratorId]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose, open]);

  const groupedRequirements = useMemo(
    () => Array.from(groupRequirements(requirements).entries()),
    [requirements],
  );
  const existingRequirementIds = useMemo(
    () =>
      new Set(
        documents.map((document) => document.requirement_id).filter(Boolean),
      ),
    [documents],
  );

  function toggleRequirement(requirementId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(requirementId)) next.delete(requirementId);
      else next.add(requirementId);
      return next;
    });
  }

  async function addCustomRequirement(event) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    setBusy(true);
    setMessage("");

    let { data: requirement, error } = await supabase
      .from("document_requirements")
      .select("id,name,description,category,is_system,document_scope")
      .ilike("name", name)
      .maybeSingle();

    if (requirement && requirement.document_scope !== "collaborator") {
      setMessage(
        "Já existe um documento patronal com esse nome. Use outro nome para o documento do colaborador.",
      );
      setBusy(false);
      return;
    }

    if (!requirement && !error) {
      const created = await supabase
        .from("document_requirements")
        .insert({
          name,
          category: "Outros",
          required: false,
          active: true,
          is_system: false,
          document_scope: "collaborator",
        })
        .select("id,name,description,category,is_system")
        .single();
      requirement = created.data;
      error = created.error;
    } else if (requirement) {
      const updated = await supabase
        .from("document_requirements")
        .update({ active: true })
        .eq("id", requirement.id);
      error = updated.error;
    }

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    setRequirements((current) =>
      current.some((item) => item.id === requirement.id)
        ? current.map((item) =>
            item.id === requirement.id ? { ...item, active: true } : item,
          )
        : [...current, requirement],
    );
    setSelectedIds((current) => new Set([...current, requirement.id]));
    setCustomName("");
    setBusy(false);
  }

  async function confirmSelection() {
    setBusy(true);
    setMessage("");
    const catalogIds = new Set(requirements.map((item) => item.id));
    const selected = new Set(selectedIds);
    const toInsert = requirements.filter(
      (requirement) =>
        selected.has(requirement.id) &&
        !existingRequirementIds.has(requirement.id),
    );
    const toDelete = [...existingRequirementIds].filter(
      (requirementId) =>
        catalogIds.has(requirementId) && !selected.has(requirementId),
    );

    if (toDelete.length) {
      const { error } = await supabase
        .from("case_documents")
        .delete()
        .eq("case_id", caseId)
        .eq("document_scope", "collaborator")
        .eq("collaborator_id", collaboratorId)
        .in("requirement_id", toDelete);
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
    }

    if (toInsert.length) {
      const { error } = await supabase.from("case_documents").insert(
        toInsert.map((requirement) => ({
          case_id: caseId,
          collaborator_id: collaboratorId,
          requirement_id: requirement.id,
          name: requirement.name,
          status: "pendente",
          document_scope: "collaborator",
          is_client_visible: true,
        })),
      );
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    onSaved?.();
    onClose?.();
  }

  if (!open || !collaborator) return null;

  return (
    <div
      className="document-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        className="document-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-modal-title"
      >
        <header className="document-modal-header">
          <span className="document-modal-icon" aria-hidden="true">
            <FileText size={18} />
          </span>
          <div>
            <h2 id="document-modal-title">Documentos necessários</h2>
            <p>{collaborator.full_name}</p>
          </div>
          <button
            type="button"
            className="document-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </header>

        <div className="document-modal-body">
          <p className="document-modal-lead">
            Selecione os documentos que serão exigidos para este colaborador
            neste acesso.
          </p>

          {loading ? (
            <p className="muted-block">Carregando documentos...</p>
          ) : (
            <div className="document-modal-groups">
              {groupedRequirements.map(([category, items]) => (
                <section className="document-modal-group" key={category}>
                  <h3>{category}</h3>
                  <div className="document-modal-grid">
                    {items.map((requirement) => (
                      <label className="document-checkbox" key={requirement.id}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(requirement.id)}
                          onChange={() => toggleRequirement(requirement.id)}
                          disabled={busy}
                        />
                        <span>{requirement.name}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
              {!groupedRequirements.length && (
                <p className="muted-block">
                  Nenhum documento cadastrado no catálogo.
                </p>
              )}
              <form
                className="document-modal-custom"
                onSubmit={addCustomRequirement}
              >
                <label>
                  Documento fora da lista
                  <input
                    value={customName}
                    onChange={(event) => setCustomName(event.target.value)}
                    placeholder="Nome do documento"
                    disabled={busy}
                  />
                </label>
                <button
                  type="submit"
                  className="button secondary"
                  disabled={busy || !customName.trim()}
                >
                  <Plus size={16} />
                  Adicionar
                </button>
              </form>
            </div>
          )}
        </div>

        {message && <div className="alert error">{message}</div>}

        <footer className="document-modal-footer">
          <span>{selectedIds.size} selecionados</span>
          <div>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="button primary"
              onClick={confirmSelection}
              disabled={busy || loading}
            >
              {busy ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
