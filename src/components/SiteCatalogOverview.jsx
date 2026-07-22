import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, MapPinned } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  SiteTypeIcon,
  getSiteTypeColor,
  normalizeSiteType,
} from "./SiteTypeIcon";

const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const TYPE_ORDER = [
  "Greenfield",
  "Rooftop",
  "Indoor",
  "Pole Site",
  "Cow Site",
  "Street Level",
  "Underground",
  "Central/Sala",
  "Híbrida",
  "Outras",
  "Não informada",
];

function HorizontalValueLabel({ x, y, width, height, value }) {
  return (
    <text
      x={Number(x) + Number(width) + 8}
      y={Number(y) + Number(height) / 2}
      dominantBaseline="middle"
      className="typology-chart-value-label"
    >
      {numberFormat.format(value)}
    </text>
  );
}

function MunicipalityTick({ x, y, payload }) {
  const label = String(payload.value || "");
  const compact = label.length > 20 ? `${label.slice(0, 19)}…` : label;
  return (
    <text
      x={x}
      y={y}
      dy="0.32em"
      textAnchor="end"
      className="typology-chart-axis-label"
    >
      {compact}
    </text>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="typology-chart-tooltip">
      <strong>{label}</strong>
      <span>{numberFormat.format(payload[0].value)} sites</span>
    </div>
  );
}

function TypologyOverviewSkeleton() {
  return (
    <section
      className="typology-overview typology-overview-loading"
      aria-label="Carregando tipologia geral"
    >
      <div className="typology-skeleton typology-skeleton-hero" />
      <div className="typology-skeleton typology-skeleton-index" />
      <div className="typology-skeleton typology-skeleton-insight" />
    </section>
  );
}

export default function SiteCatalogOverview({
  refreshKey = 0,
  selectedType = "",
  onTypeSelect,
}) {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState(selectedType);

  useEffect(() => {
    let active = true;

    async function loadAnalytics() {
      setError("");
      const { data, error: requestError } = await supabase.rpc(
        "get_site_typology_overview",
      );
      if (!active) return;
      if (requestError) {
        setError(requestError.message);
        setAnalytics(null);
        return;
      }
      setAnalytics(data);
    }

    loadAnalytics();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (selectedType) setActiveType(selectedType);
  }, [selectedType]);

  const typeRows = useMemo(() => {
    const counts = new Map(
      (analytics?.station_types || []).map((item) => [
        normalizeSiteType(item.label),
        Number(item.value || 0),
      ]),
    );
    const total = Number(analytics?.total_sites || 0);
    return TYPE_ORDER.map((type) => {
      const value = counts.get(type) || 0;
      return {
        type,
        value,
        percentage: total ? (value / total) * 100 : 0,
        color: getSiteTypeColor(type),
      };
    });
  }, [analytics]);

  const municipalityData = useMemo(
    () => (analytics?.municipalities || []).slice(0, 7),
    [analytics],
  );
  const totalSites = Number(analytics?.total_sites || 0);
  const typedSites = Number(analytics?.typed_sites || 0);
  const sitesWithCases = Number(analytics?.sites_with_cases || 0);
  const typeCompletion = totalSites ? (typedSites / totalSites) * 100 : 0;
  const caseCoverage = totalSites ? (sitesWithCases / totalSites) * 100 : 0;
  const activeTypeData = typeRows.find((item) => item.type === activeType);
  const mapDestination = activeType
    ? `/mapa-sites?tipo=${encodeURIComponent(activeType)}`
    : "/mapa-sites";

  const selectType = (type) => {
    const nextType = activeType === type ? "" : type;
    setActiveType(nextType);
    onTypeSelect?.(nextType);
  };

  if (!analytics && !error) return <TypologyOverviewSkeleton />;

  if (error) {
    return (
      <section className="typology-overview-error" role="status">
        <strong>Tipologia geral indisponível</strong>
        <span>
          Atualize a página para tentar carregar os indicadores novamente.
        </span>
      </section>
    );
  }

  return (
    <section
      className="typology-overview"
      aria-labelledby="typology-overview-title"
    >
      <div className="typology-hero">
        <div className="typology-hero-copy">
          <span className="typology-eyebrow">Panorama compartilhado</span>
          <h2 id="typology-overview-title">
            <strong>{numberFormat.format(totalSites)}</strong>
            <span>sites no inventário de tipologias</span>
          </h2>
          <p>
            Uma visão única da infraestrutura Claro, organizada por tipologia e
            pronta para consulta no mapa.
          </p>
        </div>

        <div
          className="typology-health-grid"
          aria-label="Indicadores de qualidade"
        >
          <article>
            <span>Tipologia preenchida</span>
            <strong>{percentFormat.format(typeCompletion)}%</strong>
            <small>
              {numberFormat.format(typedSites)} de{" "}
              {numberFormat.format(totalSites)}
            </small>
          </article>
          <article>
            <span>Com caso vinculado</span>
            <strong>{percentFormat.format(caseCoverage)}%</strong>
            <small>
              {numberFormat.format(sitesWithCases)} sites acompanhados
            </small>
          </article>
        </div>
      </div>

      <section
        className="typology-index"
        aria-labelledby="typology-index-title"
      >
        <header className="typology-section-heading">
          <div>
            <span>Índice visual</span>
            <h3 id="typology-index-title">Tipologias da infraestrutura</h3>
            <p>
              Selecione uma tipologia para destacá-la e abrir o mesmo recorte no
              mapa.
            </p>
          </div>
          <small>
            {numberFormat.format(
              typeRows.filter((item) => item.value > 0).length,
            )}{" "}
            registradas
          </small>
        </header>

        <div className="typology-type-grid">
          {typeRows.map((item) => {
            const isActive = activeType === item.type;
            return (
              <button
                type="button"
                key={item.type}
                className={isActive ? "is-active" : ""}
                aria-pressed={isActive}
                onClick={() => selectType(item.type)}
                style={{ "--type-accent": item.color }}
              >
                <span className="typology-type-icon" aria-hidden="true">
                  <SiteTypeIcon
                    type={item.type}
                    family="structural"
                    size={25}
                  />
                </span>
                <span className="typology-type-copy">
                  <strong>{item.type}</strong>
                  <small>
                    {percentFormat.format(item.percentage)}% do inventário
                  </small>
                </span>
                <em>{numberFormat.format(item.value)}</em>
              </button>
            );
          })}
        </div>

        <div className="typology-focus-card">
          <span
            className="typology-focus-icon"
            style={{
              "--type-accent": activeTypeData?.color || "#285a9c",
            }}
            aria-hidden="true"
          >
            <SiteTypeIcon
              type={activeTypeData?.type || "Outras"}
              family="structural"
              size={28}
            />
          </span>
          <div>
            <span>
              {activeTypeData ? "Tipologia selecionada" : "Visão completa"}
            </span>
            <strong>
              {activeTypeData
                ? `${activeTypeData.type} · ${numberFormat.format(activeTypeData.value)} sites`
                : `${numberFormat.format(totalSites)} sites em todas as tipologias`}
            </strong>
            <small>
              {activeTypeData
                ? `${percentFormat.format(activeTypeData.percentage)}% do inventário atual.`
                : "Escolha uma tipologia para comparar sua presença territorial."}
            </small>
          </div>
          <Link className="typology-map-link" to={mapDestination}>
            <MapPinned size={16} />
            Ver no mapa
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="typology-insights-grid">
        <section
          className="typology-chart-card"
          aria-labelledby="municipality-chart-title"
        >
          <header className="typology-section-heading">
            <div>
              <span>Concentração territorial</span>
              <h3 id="municipality-chart-title">Municípios com mais sites</h3>
              <p>Leitura rápida das maiores concentrações no inventário.</p>
            </div>
            <small>
              {numberFormat.format(analytics.municipality_count || 0)}{" "}
              municípios
            </small>
          </header>
          <div
            className="typology-municipality-chart"
            role="img"
            aria-label="Gráfico de quantidade de sites por município"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={municipalityData}
                layout="vertical"
                margin={{ top: 4, right: 45, bottom: 4, left: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="#e8edf2" />
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={126}
                  axisLine={false}
                  tickLine={false}
                  tick={<MunicipalityTick />}
                />
                <Tooltip
                  cursor={{ fill: "#f1f5f8" }}
                  content={<ChartTooltip />}
                />
                <Bar
                  dataKey="value"
                  barSize={15}
                  radius={[0, 5, 5, 0]}
                  isAnimationActive={false}
                >
                  {municipalityData.map((item, index) => (
                    <Cell
                      key={item.label}
                      fill={index === 0 ? "#d52b1e" : "#274c6b"}
                    />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    content={<HorizontalValueLabel />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          className="typology-coverage-card"
          aria-labelledby="coverage-title"
        >
          <header className="typology-section-heading">
            <div>
              <span>Leitura operacional</span>
              <h3 id="coverage-title">Cobertura em demandas</h3>
              <p>Sites com ao menos um caso de acesso já vinculado.</p>
            </div>
          </header>
          <div className="typology-coverage-body">
            <div
              className="typology-coverage-ring"
              style={{ "--coverage": `${caseCoverage}%` }}
              aria-label={`${percentFormat.format(caseCoverage)} por cento dos sites têm caso vinculado`}
            >
              <div>
                <strong>{percentFormat.format(caseCoverage)}%</strong>
                <span>vinculados</span>
              </div>
            </div>
            <dl>
              <div>
                <dt>Com caso</dt>
                <dd>{numberFormat.format(sitesWithCases)}</dd>
              </div>
              <div>
                <dt>Sem caso</dt>
                <dd>
                  {numberFormat.format(analytics.sites_without_cases || 0)}
                </dd>
              </div>
              <div className="typology-data-health-row">
                <dt>Tipologia não informada</dt>
                <dd>{numberFormat.format(analytics.untyped_sites || 0)}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </section>
  );
}
