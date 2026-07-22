import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  SiteTypeIcon,
  getSiteTypeColor,
  normalizeSiteType,
} from "./SiteTypeIcon";
import { WorkflowSummary } from "./WorkflowTracker";

const missing = "Não informado";

export default function CaseCard({ item, clusters, holders }) {
  const primarySite = (item.case_sites || [])
    .slice()
    .sort((a, b) => (a.position || 0) - (b.position || 0))[0]?.site;
  const siteType = normalizeSiteType(primarySite?.station_type);
  const siteTypeColor = getSiteTypeColor(siteType);

  return (
    <Link
      className="case-card"
      data-stage={item.workflow_stage}
      to={`/casos/${item.id}`}
      aria-label={`Abrir caso ${item.display_name}`}
    >
      <header className="case-card-header">
        <span
          className="case-card-site-icon"
          style={{ "--site-type-color": siteTypeColor }}
          title={`Tipologia: ${siteType}`}
          aria-hidden="true"
        >
          <SiteTypeIcon type={siteType} family="structural" size={22} />
        </span>
        <div>
          <h2>{item.display_name}</h2>
          <span>{holders || "Sem detentora"}</span>
        </div>
      </header>

      <dl className="case-card-data">
        <div>
          <dt>Cluster EQS</dt>
          <dd>{clusters || missing}</dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{item.current_responsibility || missing}</dd>
        </div>
      </dl>

      <div className="case-card-lower">
        <WorkflowSummary value={item.workflow_stage} variant="card" />
        <footer className="case-card-footer">
          <span>
            Atualizado em{" "}
            {new Date(item.updated_at).toLocaleDateString("pt-BR")}
          </span>
          <ChevronRight size={18} aria-hidden="true" />
        </footer>
      </div>
    </Link>
  );
}
