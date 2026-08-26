import { ChevronDown, Clock3, History, UserRound } from "lucide-react";

function displayValue(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "Sem conteúdo";
}

function formattedTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário não informado";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CaseChangeHistory({
  entries,
  error,
  loading,
  open,
  onToggle,
}) {
  return (
    <section className={`case-change-history ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="case-change-history-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="case-change-history-content"
      >
        <span className="case-change-history-trigger-icon" aria-hidden="true">
          <History size={17} />
        </span>
        <span>
          <strong>Histórico deste bloco</strong>
          <small>
            {loading
              ? "Consultando a auditoria..."
              : `${entries.length} ${entries.length === 1 ? "atualização registrada" : "atualizações registradas"}`}
          </small>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </button>

      <div
        id="case-change-history-content"
        className="case-change-history-content"
        aria-hidden={!open}
      >
        <div className="case-change-history-inner">
          {loading ? (
            <div className="case-change-history-empty is-loading">
              <span />
              <span />
            </div>
          ) : error ? (
            <p className="case-change-history-empty">{error}</p>
          ) : entries.length ? (
            <ol className="case-change-history-list">
              {entries.map((entry) => (
                <li key={entry.id} className="case-change-entry">
                  <header>
                    <span className="case-change-avatar" aria-hidden="true">
                      {entry.actorInitials || <UserRound size={15} />}
                    </span>
                    <span className="case-change-actor">
                      <strong>{entry.actorName}</strong>
                      <small>
                        <Clock3 size={12} aria-hidden="true" />
                        {formattedTimestamp(entry.createdAt)}
                      </small>
                    </span>
                    <span className="case-change-count">
                      {entry.changes.length}{" "}
                      {entry.changes.length === 1 ? "campo" : "campos"}
                    </span>
                  </header>
                  <div className="case-change-fields">
                    {entry.changes.map((change) => (
                      <article key={`${entry.id}-${change.key}`}>
                        <span>{change.label}</span>
                        <div className="case-change-comparison">
                          <div>
                            <small>Antes</small>
                            <p className={!change.before ? "is-empty" : ""}>
                              {displayValue(change.before)}
                            </p>
                          </div>
                          <i aria-hidden="true">→</i>
                          <div>
                            <small>Depois</small>
                            <p className={!change.after ? "is-empty" : ""}>
                              {displayValue(change.after)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="case-change-history-empty">
              Nenhuma alteração em próximo passo ou observações foi registrada.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
