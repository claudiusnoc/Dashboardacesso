import {
  Building2,
  ChevronDown,
  CircleAlert,
  FileText,
  MapPin,
  Network,
  Signal,
  UsersRound,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SITE_TYPE_COLORS, SiteTypeIcon } from "./SiteTypeIcon";
import "./SiteMapDetailPanel.css";

const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
  "EM TRATATIVA": "Em tratativa",
  "LEVANTAMENTO DE DOCUMENTOS": "Levantamento de documentos",
  LIBERADO: "Liberado",
  CANCELADO: "Cancelado",
};

function hasValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    !["", "N/A", "NA"].includes(String(value).trim().toUpperCase())
  );
}

function displayValue(value) {
  return hasValue(value) ? String(value).trim() : "Não informado";
}

function initials(name) {
  const words = name.trim().split(/\s+/);
  return `${words[0][0]}${words.length > 1 ? words.at(-1)[0] : ""}`.toLocaleUpperCase(
    "pt-BR",
  );
}

function coordinates(detail) {
  if (!hasValue(detail.latitude) || !hasValue(detail.longitude))
    return "Não informadas";
  const latitude = Number(detail.latitude);
  const longitude = Number(detail.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
    : "Não informadas";
}

export default function SiteMapDetailPanel({
  detail,
  loading,
  error,
  onClose,
}) {
  const priorityMatch = String(detail?.priority_level || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/nivel\s*(\d+)/i);
  const level = priorityMatch ? Number(priorityMatch[1]) : null;
  const technicians = [1, 2, 3]
    .map((position) => ({
      position,
      name: detail?.[`energy_technician_${position}`],
    }))
    .filter(({ name }) => hasValue(name));
  const cases = detail?.cases || [];

  return (
    <aside
      className="site-map-detail site-detail-panel"
      aria-labelledby="site-detail-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="site-detail-header">
        {detail && !loading && (
          <span
            className="site-detail-type-icon"
            aria-hidden="true"
            style={{
              background:
                SITE_TYPE_COLORS[detail.station_type_normalized] ||
                SITE_TYPE_COLORS.Outras,
            }}
          >
            <SiteTypeIcon
              type={detail.station_type_normalized}
              family="signal"
              size={25}
            />
          </span>
        )}
        <div className="site-detail-identity">
          <h2 id="site-detail-title">
            {loading
              ? "Carregando site…"
              : detail?.station || "Detalhes do site"}
          </h2>
          {detail && !loading && <p>{displayValue(detail.municipality)}</p>}
        </div>
        <button
          type="button"
          className="site-detail-close"
          onClick={onClose}
          aria-label="Fechar detalhes do site"
        >
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      {loading && (
        <div
          className="site-map-detail-loading"
          role="status"
          aria-label="Carregando detalhes"
        >
          <span />
          <span />
          <span />
        </div>
      )}
      {error && !loading && (
        <div className="site-map-detail-error" role="alert">
          <CircleAlert size={20} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
      {detail && !loading && !error && (
        <div className="site-detail-content" key={detail.id}>
          <div
            className={`site-detail-decision${level === 0 ? " is-critical" : ""}`}
          >
            <div className="site-detail-metric site-detail-priority">
              <Signal size={22} aria-hidden="true" />
              <div>
                <strong>
                  {level === null
                    ? displayValue(detail.priority_level)
                    : `NÍVEL ${level}`}
                </strong>
                <span>
                  {level === 0 ? "Prioridade · Crítico" : "Prioridade"}
                </span>
              </div>
            </div>
            <div className="site-detail-metric site-detail-load">
              <Network size={24} aria-hidden="true" />
              <div>
                <strong
                  className={
                    !hasValue(detail.loaded_station_count)
                      ? "is-missing"
                      : String(detail.loaded_station_count).length > 4
                        ? "is-text-value"
                        : ""
                  }
                >
                  {displayValue(detail.loaded_station_count)}
                </strong>
                <span>
                  {String(detail.loaded_station_count).trim() === "1"
                    ? "estação que carrega"
                    : "estações que carrega"}
                </span>
              </div>
            </div>
          </div>

          <section
            className="site-detail-team"
            aria-labelledby="site-detail-team-title"
          >
            <div className="site-detail-section-heading">
              <UsersRound size={19} aria-hidden="true" />
              <h3 id="site-detail-team-title">Equipe responsável</h3>
              <span
                className="site-detail-count"
                aria-label={`${technicians.length} técnicos informados`}
              >
                {technicians.length}
              </span>
            </div>
            {technicians.length ? (
              <ul className="site-detail-team-list">
                {technicians.map(({ position, name }) => (
                  <li key={position}>
                    <span className="site-detail-avatar" aria-hidden="true">
                      {initials(String(name))}
                    </span>
                    <span className="site-detail-technician-name">
                      {String(name).trim()}
                    </span>
                    <span
                      className="site-detail-technician-order"
                      aria-label={`Técnico ${position}`}
                    >
                      {position}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="site-detail-empty">Equipe não informada.</p>
            )}
          </section>

          <dl className="site-detail-metadata">
            <div>
              <dt>Tipologia</dt>
              <dd>{displayValue(detail.station_type_normalized)}</dd>
            </div>
            <div>
              <dt>Detentora</dt>
              <dd>{displayValue(detail.holder)}</dd>
            </div>
            <div>
              <dt>Cluster EQS</dt>
              <dd>{displayValue(detail.eqs_cluster)}</dd>
            </div>
          </dl>
          <div className="site-detail-address">
            <MapPin size={20} aria-hidden="true" />
            <div>
              <p>{displayValue(detail.address)}</p>
              {hasValue(detail.postal_code) && (
                <span>CEP {detail.postal_code}</span>
              )}
            </div>
          </div>

          <details className="site-detail-disclosure">
            <summary>
              <FileText size={19} aria-hidden="true" />
              <h3>Dados complementares</h3>
              <ChevronDown
                size={18}
                className="site-detail-chevron"
                aria-hidden="true"
              />
            </summary>
            <dl className="site-detail-extra">
              <div>
                <dt>Nome completo</dt>
                <dd>
                  {displayValue(detail.full_station || detail.smart_plan_name)}
                </dd>
              </div>
              {hasValue(detail.smart_plan_name) &&
                detail.smart_plan_name !== detail.full_station && (
                  <div>
                    <dt>Nome Smart Plan</dt>
                    <dd>{detail.smart_plan_name}</dd>
                  </div>
                )}
              <div>
                <dt>Tipologia original</dt>
                <dd>{displayValue(detail.station_type)}</dd>
              </div>
              <div>
                <dt>Coordenadas</dt>
                <dd>{coordinates(detail)}</dd>
              </div>
            </dl>
          </details>

          <details
            className="site-detail-disclosure site-detail-cases"
            open={cases.length > 0}
          >
            <summary>
              <Building2 size={19} aria-hidden="true" />
              <h3>Casos vinculados</h3>
              <span className="site-detail-count">{cases.length}</span>
              <ChevronDown
                size={18}
                className="site-detail-chevron"
                aria-hidden="true"
              />
            </summary>
            {cases.length ? (
              <ul>
                {cases.map((item) => (
                  <li key={item.id}>
                    <div>
                      <strong>{item.display_name}</strong>
                      <span>{STATUS_LABELS[item.status] || item.status}</span>
                    </div>
                    <Link to={`/casos/${item.id}`}>Ver caso</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="site-detail-empty">Nenhum caso vinculado.</p>
            )}
          </details>
        </div>
      )}
    </aside>
  );
}
