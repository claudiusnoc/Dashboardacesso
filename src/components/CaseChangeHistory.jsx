import {
  AlignLeft,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  CircleDot,
  Clock3,
  History,
  Route,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FILTERS = [
  { key: "all", label: "Tudo" },
  { key: "stage", label: "Etapa" },
  { key: "responsibility", label: "Responsável" },
  { key: "notes", label: "Anotações" },
];

const ICONS = {
  stage: Route,
  responsibility: UsersRound,
  notes: AlignLeft,
  update: CircleDot,
  event: CalendarClock,
};

function initialsFor(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formattedTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário não informado";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((today - target) / 86400000);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function groupedEntries(entries) {
  const groups = [];
  entries.forEach((entry) => {
    const key = dayKey(entry.createdAt);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: dayLabel(entry.createdAt), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  });
  return groups;
}

function ActivityIcon({ category, size = 16 }) {
  const Icon = ICONS[category] || History;
  return <Icon size={size} aria-hidden="true" />;
}

function ActivityDetails({ entry }) {
  if (entry.fields?.length) {
    return (
      <div className="activity-detail-fields">
        {entry.fields.map((field) => (
          <div key={`${entry.id}-${field.key}`}>
            <span>{field.label}</span>
            <p className={!field.value ? "is-empty" : ""}>
              {field.value || "Sem conteúdo"}
            </p>
          </div>
        ))}
      </div>
    );
  }
  return entry.summary ? (
    <p className="activity-detail-copy">{entry.summary}</p>
  ) : null;
}

function ActivityRow({ entry, expanded, highlighted, onToggle, reduceMotion }) {
  const contentId = `activity-${String(entry.id).replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <motion.li
      layout="position"
      className={`activity-row activity-${entry.category} ${expanded ? "is-expanded" : ""} ${highlighted ? "is-highlighted" : ""}`}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 330, damping: 30 }
      }
    >
      <button
        type="button"
        className="activity-row-trigger"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
      >
        <span className="activity-row-icon">
          <ActivityIcon category={entry.category} />
        </span>
        <span className="activity-row-copy">
          <strong>{entry.title}</strong>
          {entry.summary && <span>{entry.summary}</span>}
          <small>
            <span className="activity-actor-mark" aria-hidden="true">
              {initialsFor(entry.actorName) || <UserRound size={11} />}
            </span>
            {entry.actorName} · {formattedTimestamp(entry.createdAt)}
          </small>
        </span>
        <motion.span
          className="activity-row-chevron"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 420, damping: 28 }
          }
          aria-hidden="true"
        >
          <ChevronDown size={15} />
        </motion.span>
      </button>
      <motion.div
        id={contentId}
        className="activity-row-content"
        initial={false}
        animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 30 }
        }
        aria-hidden={!expanded}
        inert={expanded ? undefined : ""}
      >
        <ActivityDetails entry={entry} />
      </motion.div>
    </motion.li>
  );
}

function ActivityPreview({
  entries,
  total,
  loading,
  error,
  onOpen,
  reduceMotion,
}) {
  const preview = entries.slice(0, 3);
  return (
    <section
      className="case-activity-preview"
      aria-labelledby="case-activity-title"
    >
      <button
        type="button"
        className="case-activity-preview-button"
        onClick={onOpen}
        disabled={loading}
        aria-haspopup="dialog"
      >
        <span className="case-activity-preview-heading">
          <span className="case-activity-preview-icon">
            <History size={17} />
          </span>
          <span>
            <strong id="case-activity-title">Atividade do caso</strong>
            <small>
              {loading
                ? "Carregando atividades..."
                : `${total} ${total === 1 ? "registro" : "registros"}`}
            </small>
          </span>
        </span>
        {error ? (
          <span className="case-activity-preview-state">{error}</span>
        ) : preview.length ? (
          <span className="activity-preview-stack">
            {preview.map((entry, index) => (
              <motion.span
                key={entry.id}
                className={`activity-preview-card activity-${entry.category}`}
                initial={false}
                animate={{ y: index * 7, scale: 1 - index * 0.025 }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 360, damping: 32 }
                }
                style={{ zIndex: preview.length - index }}
              >
                <span>
                  <ActivityIcon category={entry.category} size={14} />
                </span>
                <strong>{entry.title}</strong>
                <small>{formattedTimestamp(entry.createdAt)}</small>
              </motion.span>
            ))}
          </span>
        ) : !loading ? (
          <span className="case-activity-preview-state">
            Nenhuma atividade registrada.
          </span>
        ) : null}
        <span className="case-activity-preview-action">
          Ver histórico completo <ArrowUpRight size={15} />
        </span>
      </button>
    </section>
  );
}

export default function CaseChangeHistory({
  entries,
  total,
  error,
  loading,
  open,
  onOpenChange,
  onLoadMore,
  hasMore,
  loadingMore,
  highlightedId,
}) {
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const closeButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const returnFocusRef = useRef(null);
  const filteredEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          filter === "all" ||
          entry.category === filter ||
          (filter === "notes" && entry.category === "update"),
      ),
    [entries, filter],
  );
  const groups = useMemo(
    () => groupedEntries(filteredEntries),
    [filteredEntries],
  );

  useEffect(() => {
    if (!open) return undefined;
    returnFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onOpenChange]);

  return (
    <>
      <ActivityPreview
        entries={entries}
        total={total}
        loading={loading}
        error={error}
        onOpen={() => onOpenChange(true)}
        reduceMotion={reduceMotion}
      />
      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="activity-drawer-layer">
              <motion.button
                type="button"
                className="activity-drawer-backdrop"
                aria-label="Fechar histórico"
                onClick={() => onOpenChange(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.aside
                ref={drawerRef}
                className="activity-drawer"
                role="dialog"
                aria-modal="true"
                aria-labelledby="activity-drawer-title"
                initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                transition={
                  reduceMotion
                    ? { duration: 0.15 }
                    : {
                        type: "spring",
                        stiffness: 420,
                        damping: 40,
                        mass: 0.5,
                      }
                }
              >
                <header className="activity-drawer-heading">
                  <span className="activity-drawer-heading-icon">
                    <History size={19} />
                  </span>
                  <span>
                    <small>Registro unificado</small>
                    <h2 id="activity-drawer-title">Atividade do caso</h2>
                  </span>
                  <span className="activity-drawer-count">{total}</span>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => onOpenChange(false)}
                    aria-label="Fechar histórico"
                  >
                    <X size={18} />
                  </button>
                </header>

                <nav
                  className="activity-filters"
                  aria-label="Filtrar histórico"
                >
                  {FILTERS.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={filter === item.key ? "is-active" : ""}
                      aria-pressed={filter === item.key}
                      onClick={() => setFilter(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>

                <div className="activity-drawer-body">
                  {loading ? (
                    <div className="activity-drawer-state is-loading">
                      <span />
                      <span />
                      <span />
                    </div>
                  ) : error ? (
                    <div className="activity-drawer-state">
                      <History size={22} />
                      <p>{error}</p>
                    </div>
                  ) : groups.length ? (
                    groups.map((group) => (
                      <section className="activity-day" key={group.key}>
                        <h3>{group.label}</h3>
                        <ol>
                          {group.entries.map((entry) => (
                            <ActivityRow
                              key={entry.id}
                              entry={entry}
                              expanded={expandedId === entry.id}
                              highlighted={highlightedId === entry.id}
                              onToggle={() =>
                                setExpandedId((current) =>
                                  current === entry.id ? null : entry.id,
                                )
                              }
                              reduceMotion={reduceMotion}
                            />
                          ))}
                        </ol>
                      </section>
                    ))
                  ) : (
                    <div className="activity-drawer-state">
                      <Clock3 size={22} />
                      <p>Nenhuma atividade neste filtro.</p>
                    </div>
                  )}
                  {hasMore && filter === "all" && (
                    <button
                      type="button"
                      className="activity-load-more"
                      onClick={onLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Carregando..." : "Mostrar mais"}
                    </button>
                  )}
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
