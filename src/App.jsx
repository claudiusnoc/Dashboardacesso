import {
  useCallback,
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  ClipboardList,
  Database,
  Eye,
  EyeOff,
  FileClock,
  FileText,
  KeyRound,
  LayoutGrid,
  List,
  LogOut,
  Mail,
  MapPin,
  MapPinned,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { isConfigured, supabase } from "./lib/supabase";
import {
  getCachedAccessCasesList,
  refreshAccessCasesList,
} from "./lib/accessCasesListCache";
import { prefetchSitesMapCatalog } from "./lib/sitesMapCatalogCache";
import CollaboratorManager, {
  AsoBadge,
  formatCpf,
} from "./components/CollaboratorManager";
import CaseDocumentationPanel from "./components/CaseDocumentationPanel";
import CaseCard from "./components/CaseCard";
import DocumentChecklist from "./components/DocumentChecklist";
import MultiSelectFilter from "./components/MultiSelectFilter";
import {
  SiteTypeIcon,
  getSiteTypeColor,
  normalizeSiteType,
} from "./components/SiteTypeIcon";
import WorkflowTracker, {
  WORKFLOW_STAGES,
  WorkflowSummary,
  workflowDetailLabel,
  workflowLabel,
} from "./components/WorkflowTracker";
import claroLogoUrl from "../assets/claro-logo.png";
import eqsLogoDarkUrl from "../assets/eqs-logo-dark.png";
import eqsLogoJpgUrl from "../assets/eqs-logo.jpg";
import eqsLogoUrl from "../assets/eqs-logo.png";

const SiteCatalogOverview = lazy(
  () => import("./components/SiteCatalogOverview"),
);
const CompanyDocumentationPanel = lazy(
  () => import("./components/CompanyDocumentationPanel"),
);
const SitesMapPage = lazy(() => import("./components/SitesMapPage"));
const SiteLocationPreview = lazy(
  () => import("./components/SiteLocationPreview"),
);

const AuthContext = createContext(null);
const PortalRouteTransitionContext = createContext(null);
const PORTAL_ROUTE_SCAN_DURATION_MS = 320;
const ACTIVE = new Set([
  "RASCUNHO",
  "PENDENTE",
  "EM TRATATIVA",
  "LEVANTAMENTO DE DOCUMENTOS",
]);
const valueOrMissing = (value) => value || "Não informado";
const errorMessage = (error) =>
  error?.message || "Não foi possível concluir a operação.";
const cpfDigits = (value) => (value || "").replace(/\D/g, "").slice(0, 11);
const LIST_PAGE_SIZE = 9;
const COLLABORATOR_PAGE_SIZE = 10;
const MISSING_CLUSTER_VALUE = "__missing_cluster__";
const PORTAL_EMAIL_DOMAINS = new Set(["claro.com.br", "eqsengenharia.com.br"]);
const PORTAL_ROLES = new Set(["operacao_eqs", "cliente_claro"]);
const PASSWORD_PROMPT_KEY = "portal-acessos:password-prompt:v1";
let passwordPromptShownThisSession = false;
const passwordPromptDismissedKey = (userId) =>
  `${PASSWORD_PROMPT_KEY}:${userId}`;
const CASES_UI_PREFERENCES_KEY = "portal-acessos:cases-ui:v1";
const CASES_VIEW_OPTIONS = new Set([
  "all",
  "active",
  "released",
  "pending",
  "urgent",
]);
const CASES_DISPLAY_OPTIONS = new Set(["cards", "list"]);
const EMPTY_COLLABORATOR_FORM = {
  full_name: "",
  cpf: "",
  city: "",
  next_aso_date: "",
};
const WORKFLOW_FILTER_OPTIONS = WORKFLOW_STAGES.map((stage) => ({
  value: stage.key,
  label: workflowDetailLabel(stage.key),
}));
const WORKFLOW_FILTER_VALUES = new Set(
  WORKFLOW_FILTER_OPTIONS.map((option) => option.value),
);
const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  PENDENTE: "Pendente",
  "EM TRATATIVA": "Em tratativa",
  "LEVANTAMENTO DE DOCUMENTOS": "Levantamento de documentos",
  LIBERADO: "Liberado",
  CANCELADO: "Cancelado",
};

const REGIONAL_BANNER_COLORS = {
  NORTE: ["#345ff5", "#2d59f1", "#1f4be0"],
  METROPOLITANO: ["#8a68e8", "#6e4fd5", "#5437ba"],
  BH: ["#2c8291", "#176b79", "#0c5663"],
  SUL: ["#35ad7b", "#159568", "#08764f"],
  LESTE: ["#f0a43a", "#d88718", "#b86608"],
  "CENTRO-OESTE": ["#b84b69", "#982f50", "#751d3b"],
  TRIANGULO: ["#37b8b4", "#169b9a", "#087b7d"],
  "VALE DO ACO": ["#3f815c", "#286b48", "#164f34"],
};

function initialsFor(value) {
  const words = (value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "NI";
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function updateMeta(value) {
  const updated = new Date(value);
  if (Number.isNaN(updated.getTime())) {
    return { date: "Não informado", relative: "Sem horário" };
  }
  const today = new Date();
  const dayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const updateStart = new Date(
    updated.getFullYear(),
    updated.getMonth(),
    updated.getDate(),
  );
  const dayDifference = Math.round((dayStart - updateStart) / 86400000);
  const time = updated.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const relative =
    dayDifference === 0
      ? `Hoje às ${time}`
      : dayDifference === 1
        ? `Ontem às ${time}`
        : dayDifference > 1 && dayDifference < 7
          ? `${dayDifference} dias atrás · ${time}`
          : `Atualizado às ${time}`;
  return {
    date: updated.toLocaleDateString("pt-BR"),
    relative,
  };
}

function paginationItems(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const items = [1];
  if (currentPage > 4) items.push("start-ellipsis");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) items.push(page);
  if (currentPage < totalPages - 3) items.push("end-ellipsis");
  items.push(totalPages);
  return items;
}

function asoCategory(value) {
  if (!value) return "missing";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return "missing";
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "due_soon";
  return "valid";
}

function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function normalizeRegional(value) {
  return (value || "NORTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function regionalBannerStyle(value) {
  const regional = normalizeRegional(value);
  const colors =
    REGIONAL_BANNER_COLORS[regional] || REGIONAL_BANNER_COLORS.NORTE;
  return {
    "--regional-light": colors[0],
    "--regional-main": colors[1],
    "--regional-dark": colors[2],
  };
}

function formatCaseUpdate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function caseEventLabel(value) {
  const labels = {
    created: "Caso criado",
    case_created: "Caso criado",
    imported: "Caso importado",
    workflow_stage_updated: "Etapa atualizada",
    status_updated: "Status atualizado",
    document_requested: "Documentação solicitada",
    collaborator_linked: "Colaborador vinculado",
  };
  return labels[value] || valueOrMissing(value);
}

function useAuth() {
  return useContext(AuthContext);
}

function normalizedPortalEmail(value) {
  return (value || "").trim().toLowerCase();
}

function isAllowedPortalEmail(value) {
  const email = normalizedPortalEmail(value);
  const parts = email.split("@");
  return (
    parts.length === 2 &&
    Boolean(parts[0]) &&
    Boolean(parts[1]) &&
    PORTAL_EMAIL_DOMAINS.has(parts[1])
  );
}

function maskedPortalEmail(value) {
  const [localPart, domain] = normalizedPortalEmail(value).split("@");
  if (!localPart || !domain) return "seu e-mail corporativo";
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

function casesUiPreferencesKey(userId) {
  return `${CASES_UI_PREFERENCES_KEY}:${userId}`;
}

function readCasesUiPreferences(userId) {
  if (!userId || typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(casesUiPreferencesKey(userId)) || "null",
    );
    if (!stored || typeof stored !== "object") return null;
    const selectedValues = (value, allowedValues) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (item) =>
                  typeof item === "string" &&
                  (!allowedValues || allowedValues.has(item)),
              ),
            ),
          ]
        : null;
    return {
      query: typeof stored.query === "string" ? stored.query.slice(0, 160) : "",
      view: CASES_VIEW_OPTIONS.has(stored.view) ? stored.view : "all",
      display: CASES_DISPLAY_OPTIONS.has(stored.display)
        ? stored.display
        : "cards",
      selectedClusters: selectedValues(stored.selectedClusters),
      selectedStages: selectedValues(
        stored.selectedStages,
        WORKFLOW_FILTER_VALUES,
      ),
    };
  } catch {
    return null;
  }
}

function writeCasesUiPreferences(userId, preferences) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      casesUiPreferencesKey(userId),
      JSON.stringify(preferences),
    );
  } catch {
    // O portal permanece funcional quando o navegador bloqueia o storage.
  }
}

function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);
  const hydrationVersion = useRef(0);
  const profileRef = useRef(null);

  function applyProfile(nextProfile) {
    profileRef.current = nextProfile;
    setProfile(nextProfile);
  }

  async function refreshHasPassword() {
    if (!supabase) {
      setHasPassword(false);
      return false;
    }
    const { data, error } = await supabase.rpc("current_user_has_password");
    if (error) return false;
    setHasPassword(Boolean(data));
    return Boolean(data);
  }

  const switchTestRole = useCallback(
    async (role) => {
      if (!supabase || !profile?.can_switch_role) return false;
      const { error } = await supabase.rpc("set_portal_test_role", {
        p_role: role,
      });
      if (error) return false;
      applyProfile({ ...profile, test_role: role });
      return true;
    },
    [profile],
  );

  useEffect(() => {
    let active = true;
    const updateProfile = applyProfile;
    async function hydrate(next, event) {
      const version = ++hydrationVersion.current;
      if (!active) return;
      setSession(next);
      if (!next) {
        updateProfile(null);
        setHasPassword(false);
        setLoading(false);
        return;
      }
      const sessionEmail = normalizedPortalEmail(next.user?.email);
      if (!isAllowedPortalEmail(sessionEmail)) {
        updateProfile(null);
        if (active && version === hydrationVersion.current) setLoading(false);
        return;
      }

      const currentProfile = profileRef.current;
      const requiresProfileValidation =
        event === "INITIAL_SESSION" || event === "USER_UPDATED";
      const canKeepCurrentProfile =
        !requiresProfileValidation &&
        currentProfile &&
        PORTAL_ROLES.has(currentProfile.role) &&
        currentProfile.auth_user_id === next.user?.id &&
        normalizedPortalEmail(currentProfile.email) === sessionEmail;
      if (canKeepCurrentProfile) {
        setLoading(false);
        return;
      }

      updateProfile(null);
      setLoading(true);
      const { data } = await supabase
        .from("app_users")
        .select("id,name,email,role,auth_user_id,test_role,can_switch_role")
        .eq("auth_user_id", next.user.id)
        .single();
      const validProfile =
        data &&
        PORTAL_ROLES.has(data.role) &&
        normalizedPortalEmail(data.email) === sessionEmail;
      if (active && version === hydrationVersion.current) {
        updateProfile(validProfile ? data : null);
        setLoading(false);
        refreshHasPassword();
      }
    }
    supabase.auth
      .getSession()
      .then(({ data }) => hydrate(data.session, "INITIAL_SESSION"))
      .catch(() => hydrate(null));
    const { data } = supabase.auth.onAuthStateChange((event, next) =>
      hydrate(next, event),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const effectiveRole = profile?.test_role || profile?.role || "";
  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isPortalUser: Boolean(
        session &&
        profile &&
        PORTAL_ROLES.has(profile.role) &&
        isAllowedPortalEmail(session.user?.email) &&
        normalizedPortalEmail(profile.email) ===
          normalizedPortalEmail(session.user?.email),
      ),
      isOperation: effectiveRole === "operacao_eqs",
      hasPassword,
      refreshHasPassword,
      canSwitchRole: Boolean(profile?.can_switch_role),
      testRole: profile?.test_role || null,
      switchTestRole,
    }),
    [session, profile, loading, hasPassword, effectiveRole, switchTestRole],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function PortalRouteTransitionProvider({ children }) {
  const location = useLocation();
  const sequence = useRef(0);
  const [request, setRequest] = useState(null);

  function requestScanline(to) {
    if (!to || to === location.pathname) return;
    sequence.current += 1;
    setRequest({ to, sequence: sequence.current });
  }

  useEffect(() => {
    if (!request) return undefined;

    const hasReachedTarget = request.to === location.pathname;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const completionDelay = hasReachedTarget
      ? reducedMotion
        ? 80
        : PORTAL_ROUTE_SCAN_DURATION_MS + 60
      : 1200;
    const timer = window.setTimeout(() => {
      setRequest((current) =>
        current?.sequence === request.sequence ? null : current,
      );
    }, completionDelay);

    return () => window.clearTimeout(timer);
  }, [location.pathname, request]);

  const value = {
    activeSequence: request?.to === location.pathname ? request.sequence : null,
    requestScanline,
  };

  return (
    <PortalRouteTransitionContext.Provider value={value}>
      {children}
    </PortalRouteTransitionContext.Provider>
  );
}

function usePortalRouteTransition() {
  return useContext(PortalRouteTransitionContext);
}

function SetupRequired() {
  return (
    <main className="center-page">
      <section className="setup-panel">
        <Database size={30} />
        <h1>Conectar o Supabase</h1>
        <p>
          O portal está pronto para usar o banco central. Configure as variáveis
          públicas antes de iniciar.
        </p>
        <pre>
          VITE_SUPABASE_URL={"<url-do-projeto>"}
          {"\n"}VITE_SUPABASE_ANON_KEY={"<chave-anon>"}
        </pre>
        <p className="muted">
          Use <code>.env.example</code> como referência. Nenhum dado operacional
          será salvo localmente.
        </p>
      </section>
    </main>
  );
}

const SIGNIN_SUCCESS_ANIMATION_MS = 1120;
const SIGNIN_SUCCESS_HOLD_MS = 500;
const SIGNIN_PORTAL_TRANSITION_MS = 980;
const SIGNIN_PORTAL_TRANSITION_REDUCED_MS = 220;

function AccessScannerVisual() {
  return (
    <>
      <span className="signin-scanner-grid" aria-hidden="true" />
      <span className="signin-scanner-beam" aria-hidden="true" />
      <span className="signin-scanner-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="presentation">
          <circle className="signin-scanner-ring" cx="12" cy="12" r="8.25" />
          <path
            className="signin-scanner-corners"
            d="M8.2 6.5H6.5v1.7m9.3-1.7h1.7v1.7m0 7.6v1.7h-1.7m-7.6 0H6.5v-1.7"
          />
          <path className="signin-scanner-line" d="M7.4 12h9.2" />
          <path
            className="signin-scanner-check"
            d="m8.3 12.2 2.4 2.4 5.2-5.6"
          />
          <path
            className="signin-scanner-cross"
            d="m9.2 9.2 5.6 5.6m0-5.6-5.6 5.6"
          />
        </svg>
      </span>
    </>
  );
}

function smartCardProfile(profile) {
  if (!profile) {
    return {
      name: "Identidade corporativa",
      initials: "ID",
      company: "Portal Claro MG",
      role: "Perfil protegido",
    };
  }

  const name = profile.name?.trim() || "Usuário autorizado";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const isOperation = profile.role === "operacao_eqs";

  return {
    name,
    initials: initials || "ID",
    company: isOperation ? "EQS Engenharia" : "Claro Brasil",
    role: isOperation
      ? "Operação EQS · Minas Gerais"
      : "Cliente Claro · Minas Gerais",
  };
}

function SmartCardLoginVisual({
  method,
  profile,
  state,
  portalTransitionActive,
}) {
  const credential = smartCardProfile(profile);
  const visualState = portalTransitionActive ? "success" : state;
  const isMagicLink = method === "magic-link";
  const statusCopy = {
    idle: isMagicLink
      ? "Credencial pronta para receber o link"
      : "Smart card aguardando leitura",
    loading: isMagicLink
      ? "Gerando link seguro para a credencial..."
      : "Lendo chip e perfil de acesso...",
    success: isMagicLink
      ? "Link seguro enviado para a credencial"
      : "Chip confirmado · acesso autorizado",
    error: isMagicLink
      ? "Não foi possível validar este Login"
      : "Credencial recusada · confira os dados",
  }[visualState];
  const titleCopy = {
    idle: isMagicLink ? "Receba seu acesso" : "Insira para validar",
    loading: isMagicLink ? "Emitindo credencial" : "Validando perfil",
    success: isMagicLink ? "Link emitido" : "Acesso autorizado",
    error: "Credencial não validada",
  }[visualState];

  return (
    <div
      className={`signin-smart-visual is-${visualState} ${isMagicLink ? "is-magic-link" : "is-password"}`}
    >
      <div className="signin-smart-brand">
        <span className="signin-claro-support">
          <img src={claroLogoUrl} alt="Claro" />
        </span>
        <span aria-hidden="true" />
        <img src={eqsLogoDarkUrl} alt="EQS Engenharia" />
      </div>

      <div className="signin-smart-heading">
        <p className="signin-eyebrow">Smart card corporativo</p>
        <h1>{titleCopy}</h1>
      </div>

      <div className="signin-smart-stage" aria-hidden="true">
        <span className="signin-smart-grid" />
        <article className="signin-smart-card">
          <span className="signin-smart-card-edge" />
          <div className="signin-smart-factor">
            <span className="signin-smart-avatar">{credential.initials}</span>
            <span className="signin-smart-chip">
              <svg viewBox="0 0 54 39" role="presentation">
                <defs>
                  <linearGradient
                    id="signin-chip-metal"
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="1"
                  >
                    <stop offset="0" stopColor="#f0d58c" />
                    <stop offset="0.52" stopColor="#d5b36a" />
                    <stop offset="1" stopColor="#9b743d" />
                  </linearGradient>
                </defs>
                <rect
                  x="1"
                  y="1"
                  width="52"
                  height="37"
                  rx="8"
                  fill="url(#signin-chip-metal)"
                />
                <g fill="none" stroke="rgba(76, 52, 24, .48)" strokeWidth="1">
                  <path d="M18 1v10l-5 5v7l5 5v10M36 1v10l5 5v7l-5 5v10" />
                  <path d="M1 13h12l5-3h18l5 3h12M1 27h12l5 3h18l5-3h12" />
                  <rect x="18" y="10" width="18" height="20" rx="4" />
                </g>
              </svg>
            </span>
            <small>CHIP ID</small>
          </div>
          <div className="signin-smart-card-content">
            <div className="signin-smart-card-top">
              <span>ACESSO OPERACIONAL</span>
              <img src={claroLogoUrl} alt="" />
            </div>
            <div className="signin-smart-identity">
              <strong>{credential.name}</strong>
              <span>{credential.company}</span>
              <small>{credential.role}</small>
            </div>
            <div className="signin-smart-card-bottom">
              <span>PERFIL · PORTAL</span>
              <span className="signin-smart-insert-mark">
                {isMagicLink ? "LINK SEGURO" : "INSERIR ↓"}
              </span>
            </div>
          </div>
          <span className="signin-smart-approved">
            {isMagicLink ? "LINK EMITIDO" : "AUTORIZADA"}
          </span>
        </article>

        <div className="signin-smart-reader">
          <span className="signin-smart-reader-back" />
          <span className="signin-smart-slot-recess" />
          <span className="signin-smart-slot-lip" />
          <span className="signin-smart-reader-front" />
          <span className="signin-smart-slot-lip-front" />
          <div className="signin-smart-reader-face">
            <div>
              <span>LEITOR CORPORATIVO</span>
              <strong>
                {isMagicLink ? "EMISSÃO DE ACESSO" : "VALIDAÇÃO DE PERFIL"}
              </strong>
            </div>
            <span className="signin-smart-leds">
              <i />
              <i />
              <i />
            </span>
          </div>
          <span className="signin-smart-reader-base" />
        </div>
      </div>

      <p className="signin-smart-status">
        <i aria-hidden="true" />
        <span>{statusCopy}</span>
      </p>
    </div>
  );
}

function Login() {
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState("password");
  const [password, setPassword] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [passwordSuccessHold, setPasswordSuccessHold] = useState(false);
  const [passwordAttemptActive, setPasswordAttemptActive] = useState(false);
  const [portalTransitionActive, setPortalTransitionActive] = useState(false);
  const passwordRedirectTimer = useRef(null);
  const passwordAttemptId = useRef(0);
  const [submitFeedback, setSubmitFeedback] = useState({
    state: "idle",
    sequence: 0,
  });

  function showSubmitFeedback(state) {
    setSubmitFeedback((current) => ({
      state,
      sequence: current.sequence + 1,
    }));
  }

  function clearSubmitFeedback() {
    setSubmitFeedback((current) =>
      current.state === "idle"
        ? current
        : { state: "idle", sequence: current.sequence + 1 },
    );
  }

  function schedulePasswordPortalTransition(delay) {
    const attemptId = passwordAttemptId.current;
    if (passwordRedirectTimer.current) {
      window.clearTimeout(passwordRedirectTimer.current);
    }
    passwordRedirectTimer.current = window.setTimeout(() => {
      if (attemptId !== passwordAttemptId.current) return;
      setPortalTransitionActive(true);
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      passwordRedirectTimer.current = window.setTimeout(
        () => {
          if (attemptId !== passwordAttemptId.current) return;
          passwordRedirectTimer.current = null;
          setPasswordSuccessHold(false);
        },
        reduceMotion
          ? SIGNIN_PORTAL_TRANSITION_REDUCED_MS
          : SIGNIN_PORTAL_TRANSITION_MS,
      );
    }, delay);
  }

  function handleSubmitAnimationEnd(event) {
    if (
      event.target !== event.currentTarget ||
      event.animationName !== "signin-scanner-confirm" ||
      method !== "password" ||
      submitFeedback.state !== "success" ||
      !passwordSuccessHold
    ) {
      return;
    }
    schedulePasswordPortalTransition(SIGNIN_SUCCESS_HOLD_MS);
  }

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setTimeout(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  useEffect(
    () => () => {
      if (passwordRedirectTimer.current) {
        window.clearTimeout(passwordRedirectTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!session || loading || profile) return;
    passwordAttemptId.current += 1;
    if (passwordRedirectTimer.current) {
      window.clearTimeout(passwordRedirectTimer.current);
      passwordRedirectTimer.current = null;
    }
    setBusy(false);
    setPasswordAttemptActive(false);
    setPasswordSuccessHold(false);
    setPortalTransitionActive(false);
    setError("Este Login não está autorizado para acessar o portal.");
    showSubmitFeedback("error");
    supabase.auth.signOut({ scope: "local" });
  }, [loading, profile, session]);

  useEffect(() => {
    if (!passwordAttemptActive || !session || loading || !profile) return;

    setPasswordAttemptActive(false);
    setBusy(false);
    showSubmitFeedback("success");

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    schedulePasswordPortalTransition(
      reduceMotion
        ? SIGNIN_SUCCESS_HOLD_MS
        : SIGNIN_SUCCESS_ANIMATION_MS + SIGNIN_SUCCESS_HOLD_MS,
    );
  }, [loading, passwordAttemptActive, profile, session]);

  if (session && profile && !passwordSuccessHold) {
    return <Navigate to="/casos" replace />;
  }

  function selectMethod(nextMethod) {
    passwordAttemptId.current += 1;
    if (passwordRedirectTimer.current) {
      window.clearTimeout(passwordRedirectTimer.current);
      passwordRedirectTimer.current = null;
    }
    setPasswordSuccessHold(false);
    setPasswordAttemptActive(false);
    setPortalTransitionActive(false);
    setMethod(nextMethod);
    setPassword("");
    setMagicLinkSent(false);
    setError("");
    setNotice("");
    setResendSeconds(0);
    clearSubmitFeedback();
  }

  function validateEmail() {
    const normalizedEmail = normalizedPortalEmail(email);
    if (!isAllowedPortalEmail(normalizedEmail)) {
      setError("Use um Login @claro.com.br ou @eqsengenharia.com.br.");
      showSubmitFeedback("error");
      return null;
    }
    return normalizedEmail;
  }

  async function requestMagicLink() {
    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;

    setBusy(true);
    setError("");
    setNotice("");
    showSubmitFeedback("loading");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        // Contas são provisionadas automaticamente para domínios autorizados;
        // o gatilho no banco atribui o papel conforme o domínio do e-mail.
        shouldCreateUser: true,
        emailRedirectTo: new URL(
          "casos",
          new URL(import.meta.env.BASE_URL, window.location.origin),
        ).href,
      },
    });
    setBusy(false);
    if (authError) {
      setError(
        "Não foi possível enviar o link agora. Confira o Login ou tente novamente em instantes.",
      );
      showSubmitFeedback("error");
      return;
    }

    setEmail(normalizedEmail);
    setMagicLinkSent(true);
    setResendSeconds(60);
    setNotice("Enviamos um link de acesso para seu e-mail.");
    showSubmitFeedback("success");
  }

  async function signInWithPassword() {
    const normalizedEmail = validateEmail();
    if (!normalizedEmail) return;
    if (!password) {
      setError("Digite sua senha para continuar.");
      showSubmitFeedback("error");
      return;
    }

    if (passwordRedirectTimer.current) {
      window.clearTimeout(passwordRedirectTimer.current);
      passwordRedirectTimer.current = null;
    }
    passwordAttemptId.current += 1;
    setPasswordSuccessHold(true);
    setPasswordAttemptActive(true);
    setPortalTransitionActive(false);
    setBusy(true);
    setError("");
    setNotice("");
    showSubmitFeedback("loading");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (authError) {
      setBusy(false);
      setPasswordAttemptActive(false);
      setPasswordSuccessHold(false);
      setError("Não foi possível entrar. Confira seu Login e sua senha.");
      showSubmitFeedback("error");
      return;
    }
  }

  function submit(event) {
    event.preventDefault();
    if (method === "password") signInWithPassword();
    else requestMagicLink();
  }

  const submitLabel = portalTransitionActive
    ? "Acesso autorizado"
    : busy
      ? method === "password"
        ? "Validando acesso..."
        : "Enviando link..."
      : submitFeedback.state === "success"
        ? method === "password"
          ? "Acesso liberado"
          : "Link de acesso enviado"
        : submitFeedback.state === "error"
          ? "Tentar novamente"
          : method === "password"
            ? "Entrar com senha"
            : "Enviar link de acesso";

  const submitDetail = portalTransitionActive
    ? "Abrindo o portal"
    : busy
      ? method === "password"
        ? "Verificando credencial"
        : "Gerando link seguro"
      : submitFeedback.state === "success"
        ? method === "password"
          ? "Credencial confirmada"
          : "Confira sua caixa de entrada"
        : submitFeedback.state === "error"
          ? method === "password"
            ? "Revise Login e senha"
            : "Revise o Login informado"
          : method === "password"
            ? "Validação segura"
            : "Link temporário e seguro";

  return (
    <main
      className={`signin-page ${portalTransitionActive ? "is-portal-transition" : ""}`}
    >
      <div className="signin-shell">
        <section
          className="signin-context"
          aria-label="Portal de Acessos Claro MG"
        >
          <SmartCardLoginVisual
            method={method}
            profile={profile}
            state={submitFeedback.state}
            portalTransitionActive={portalTransitionActive}
          />
        </section>

        <section className="signin-card" aria-labelledby="signin-title">
          <div className="signin-card-heading">
            <p className="signin-eyebrow">Acesso restrito</p>
            <h2 id="signin-title">Entre no portal</h2>
            <p>Use sua credencial corporativa.</p>
          </div>
          <form
            onSubmit={submit}
            className="signin-form"
            aria-busy={busy || passwordSuccessHold}
          >
            <fieldset className="signin-methods" aria-label="Forma de acesso">
              <legend>Forma de acesso</legend>
              <button
                type="button"
                className={`signin-method ${method === "password" ? "is-selected" : ""}`}
                aria-pressed={method === "password"}
                onClick={() => selectMethod("password")}
                disabled={busy || passwordSuccessHold}
              >
                <span className="signin-method-icon">
                  <KeyRound size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Senha</strong>
                </span>
              </button>
              <button
                type="button"
                className={`signin-method ${method === "magic-link" ? "is-selected" : ""}`}
                aria-pressed={method === "magic-link"}
                onClick={() => selectMethod("magic-link")}
                disabled={busy || passwordSuccessHold}
              >
                <span className="signin-method-icon">
                  <Mail size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong>Link por e-mail</strong>
                </span>
              </button>
            </fieldset>

            <label htmlFor="signin-email">
              Login
              <span className="signin-field">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                    setNotice("");
                    clearSubmitFeedback();
                  }}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="nome@claro.com.br"
                  required
                  disabled={busy || passwordSuccessHold}
                />
              </span>
            </label>
            <p className="signin-domain-hint">
              Apenas @claro.com.br e @eqsengenharia.com.br
            </p>
            <p className="signin-code-hint">
              Primeira vez? Entre com o link por e-mail e crie sua senha no
              primeiro acesso.
            </p>

            {method === "password" && (
              <label htmlFor="signin-password">
                Senha
                <span className="signin-field">
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError("");
                      clearSubmitFeedback();
                    }}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    required
                    disabled={busy || passwordSuccessHold}
                  />
                </span>
              </label>
            )}
            {error && (
              <p className="signin-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="signin-notice" role="status">
                {notice}
              </p>
            )}
            <button
              type="submit"
              className={`signin-submit signin-submit-${method} is-${submitFeedback.state}`}
              disabled={busy || passwordSuccessHold}
              data-feedback={submitFeedback.state}
              onAnimationEnd={handleSubmitAnimationEnd}
            >
              {method === "magic-link" ? (
                <AccessScannerVisual key={submitFeedback.sequence} />
              ) : (
                <span className="signin-password-mark" aria-hidden="true">
                  <KeyRound
                    className="signin-password-key"
                    size={20}
                    strokeWidth={1.8}
                  />
                  <Check
                    className="signin-password-check"
                    size={22}
                    strokeWidth={2}
                  />
                </span>
              )}
              <span
                className="signin-submit-copy"
                aria-live={method === "password" ? "polite" : undefined}
              >
                <span className="signin-submit-label">{submitLabel}</span>
                <span className="signin-submit-detail">{submitDetail}</span>
              </span>
            </button>
            {method === "magic-link" && magicLinkSent && (
              <div className="signin-aux-actions">
                <button
                  type="button"
                  className="signin-secondary-action"
                  onClick={requestMagicLink}
                  disabled={busy || resendSeconds > 0}
                >
                  {resendSeconds > 0
                    ? `Reenviar em ${resendSeconds}s`
                    : "Reenviar link"}
                </button>
              </div>
            )}
          </form>
          <p className="signin-card-footer">
            {method === "password"
              ? "Use a senha definida para o seu Login."
              : magicLinkSent
                ? `Abra o link enviado para ${maskedPortalEmail(email)} para continuar.`
                : "O link é temporário e só pode ser usado uma vez."}
          </p>
        </section>
      </div>
      <div className="signin-network-transition" aria-hidden="true">
        <span className="signin-network-grid" />
        <svg
          className="signin-network-paths"
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
        >
          <path d="M0 684C238 458 394 610 612 352S1010 250 1440 72" />
          <path d="M0 186C246 286 370 82 658 430S1080 712 1440 590" />
          <path d="M82 900C284 678 510 764 742 544S1110 414 1440 462" />
          <circle cx="238" cy="538" r="5" />
          <circle cx="612" cy="352" r="5" />
          <circle cx="1010" cy="250" r="5" />
          <circle cx="658" cy="430" r="5" />
          <circle cx="1110" cy="414" r="5" />
        </svg>
        <span className="signin-network-beam" />
        <div className="signin-transition-portal-shell">
          <div className="signin-transition-sidebar">
            <span className="signin-transition-brand">C</span>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="signin-transition-content">
            <div className="signin-transition-topbar">
              <span />
              <span />
            </div>
            <div className="signin-transition-kpis">
              <span />
              <span />
              <span />
            </div>
            <div className="signin-transition-table">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Brand({ compact = false }) {
  if (compact) {
    return (
      <div className="brand-lockup compact">
        <img src={eqsLogoDarkUrl} alt="EQS Engenharia" />
      </div>
    );
  }

  return (
    <div className="brand-lockup">
      <img src={claroLogoUrl} alt="Claro" />
      <span />
      <img src={eqsLogoUrl} alt="EQS Engenharia" />
    </div>
  );
}

function Protected({ children, operationOnly = false }) {
  const auth = useAuth();
  if (auth.loading) return <Loading />;
  if (!auth.session) return <Navigate to="/login" replace />;
  if (!auth.isPortalUser) return <RestrictedPortalSession />;
  if (operationOnly && !auth.isOperation)
    return <Navigate to="/casos" replace />;
  return children;
}

function RestrictedPortalSession() {
  useEffect(() => {
    supabase.auth.signOut({ scope: "local" });
  }, []);

  return (
    <main className="center-page">
      <Alert type="error">
        Este Login não está autorizado para acessar o portal.
      </Alert>
    </main>
  );
}

function AppShell({ children, contentClassName = "", shellClassName = "" }) {
  const { profile, isOperation, hasPassword, canSwitchRole, testRole, switchTestRole } =
    useAuth();
  const { activeSequence, requestScanline } = usePortalRouteTransition();
  const [open, setOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (!profile?.id) return undefined;

    const timer = window.setTimeout(() => {
      prefetchSitesMapCatalog();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || hasPassword || passwordPromptShownThisSession) {
      return undefined;
    }
    let dismissed = false;
    try {
      dismissed =
        window.localStorage.getItem(passwordPromptDismissedKey(profile.id)) ===
        "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return undefined;
    passwordPromptShownThisSession = true;
    const timer = window.setTimeout(() => setPasswordDialogOpen(true), 1100);
    return () => window.clearTimeout(timer);
  }, [profile?.id, hasPassword]);

  const navigationGroups = [
    {
      label: "Consulta",
      items: [
        { to: "/casos", label: "Casos de acesso", icon: ClipboardList },
        { to: "/mapa-sites", label: "Mapa de Sites", icon: MapPinned },
        { to: "/sites", label: "Tipologia geral", icon: Database },
      ],
    },
    ...(isOperation
      ? [
          {
            label: "Gestão",
            items: [
              { to: "/novo", label: "Novo cadastro", icon: Plus },
              {
                to: "/colaboradores",
                label: "Colaboradores",
                icon: UsersRound,
              },
            ],
          },
        ]
      : []),
  ];
  const profileInitials = String(profile?.name || "U")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
  const activeNavigationItem = navigationGroups
    .flatMap(({ items }) => items)
    .find(
      ({ to }) =>
        location.pathname === to ||
        (to === "/casos" && location.pathname.startsWith("/casos/")),
    );
  const routeTransitionActive = Boolean(activeSequence);

  function handleSidebarNavigation(event, to, isActive) {
    setOpen(false);

    const isPlainPrimaryClick =
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.currentTarget.target !== "_blank";
    if (!isActive && !event.defaultPrevented && isPlainPrimaryClick) {
      requestScanline(to);
    }
  }

  return (
    <div className={`app-shell ${shellClassName}`.trim()}>
      <header className="mobile-header">
        <button
          className="icon-button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu />
        </button>
        <strong>Portal de Acessos</strong>
      </header>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <button
          className="sidebar-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="sidebar-rail-mark" aria-hidden="true">
              <img src={eqsLogoJpgUrl} alt="" />
            </span>
            <Brand compact />
          </div>
        </div>
        <div className="product-name">
          <strong>Portal de Acessos</strong>
          <span>Claro MG</span>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {navigationGroups.map(({ label: groupLabel, items }) => (
            <div className="sidebar-nav-group" key={groupLabel}>
              <span className="sidebar-nav-group-label">{groupLabel}</span>
              {items.map(({ to, label, icon: Icon }) => {
                const isActive =
                  location.pathname === to ||
                  (to === "/casos" && location.pathname.startsWith("/casos/"));

                return (
                  <Link
                    key={to}
                    to={to}
                    className={isActive ? "active" : ""}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={label}
                    title={label}
                    onClick={(event) =>
                      handleSidebarNavigation(event, to, isActive)
                    }
                  >
                    <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    <span className="nav-label">{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {canSwitchRole && (
          <div className="sidebar-test-view">
            <span className="sidebar-test-view-label">Modo teste</span>
            {testRole ? (
              <button
                type="button"
                className="sidebar-test-view-toggle"
                onClick={() =>
                  switchTestRole(
                    testRole === "operacao_eqs" ? "cliente_claro" : "operacao_eqs",
                  )
                }
                title={
                  testRole === "operacao_eqs"
                    ? "Ver como Cliente"
                    : "Ver como Operador"
                }
              >
                <ArrowLeftRight size={19} strokeWidth={1.8} aria-hidden="true" />
                <span className="nav-label">
                  Ver como {testRole === "operacao_eqs" ? "Cliente" : "Operador"}
                </span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="sidebar-test-view-option"
                  onClick={() => switchTestRole("operacao_eqs")}
                  title="Ver como Operador"
                >
                  <Eye size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="nav-label">Ver como Operador</span>
                </button>
                <button
                  type="button"
                  className="sidebar-test-view-option"
                  onClick={() => switchTestRole("cliente_claro")}
                  title="Ver como Cliente"
                >
                  <Eye size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="nav-label">Ver como Cliente</span>
                </button>
              </>
            )}
          </div>
        )}
        {!hasPassword && (
          <button
            type="button"
            className="sidebar-password-cta"
            onClick={() => setPasswordDialogOpen(true)}
            title="Definir senha"
          >
            <KeyRound size={19} strokeWidth={1.8} aria-hidden="true" />
            <span className="nav-label">Definir senha</span>
          </button>
        )}
        <div className="user-block">
          <span className="avatar" aria-hidden="true">
            {profileInitials}
          </span>
          <span>
            <strong>{profile.name}</strong>
            <small>
              {isOperation ? "Operação EQS" : "Cliente Claro"}
              {testRole ? " · teste" : ""}
            </small>
          </span>
          <button
            className="icon-button sidebar-signout"
            onClick={() => supabase.auth.signOut()}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main
        className={`main-content portal-route-surface ${
          routeTransitionActive ? "is-scanline-entering" : ""
        } ${contentClassName}`.trim()}
        data-route-transition={
          routeTransitionActive ? `scanline-${activeSequence}` : undefined
        }
      >
        <span className="portal-context-scanline" aria-hidden="true" />
        <div className="portal-route-view">{children}</div>
        <span className="sr-only" role="status" aria-live="polite">
          {routeTransitionActive && activeNavigationItem
            ? `${activeNavigationItem.label} aberto`
            : ""}
        </span>
      </main>
      <PasswordSetupDialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
      />
    </div>
  );
}

function PasswordSetupDialog({ open, onClose }) {
  const { profile, refreshHasPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setBusy(false);
    setError("");
    setDone(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || done) return;
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("A senha precisa ter pelo menos 8 caracteres, com letras e números.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    if (updateError) {
      setBusy(false);
      setError(
        "Não foi possível definir a senha agora. Tente novamente em instantes.",
      );
      return;
    }
    await refreshHasPassword();
    setBusy(false);
    setDone(true);
  }

  function handleSkip() {
    try {
      window.localStorage.setItem(
        passwordPromptDismissedKey(profile?.id || "guest"),
        "1",
      );
    } catch {
      // O lembrete pode reaparecer se o navegador bloquear o storage.
    }
    onClose();
  }

  return (
    <div
      className="password-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) handleSkip();
      }}
    >
      <section
        className="password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
      >
        <span className="password-dialog-icon" aria-hidden="true">
          <KeyRound size={22} />
        </span>
        <p className="password-dialog-eyebrow">Acesso direto</p>
        <h2 id="password-dialog-title">Defina sua senha</h2>
        <p className="password-dialog-lead">
          Você entrou pelo link mágico. Crie uma senha para entrar direto com
          login e senha nas próximas vezes.
        </p>
        {done ? (
          <div className="password-dialog-done">
            <CircleCheckBig size={28} aria-hidden="true" />
            <strong>Senha criada com sucesso</strong>
            <span>Agora você pode entrar com seu e-mail e senha.</span>
            <button
              type="button"
              className="button primary"
              onClick={onClose}
            >
              Concluir
            </button>
          </div>
        ) : (
          <form
            className="password-dialog-form"
            onSubmit={handleSubmit}
            aria-busy={busy}
          >
            <label htmlFor="password-setup-new">
              Nova senha
              <span className="signin-field has-action">
                <KeyRound size={18} aria-hidden="true" />
                <input
                  id="password-setup-new"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="signin-field-action"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff size={17} aria-hidden="true" />
                  ) : (
                    <Eye size={17} aria-hidden="true" />
                  )}
                </button>
              </span>
            </label>
            <label htmlFor="password-setup-confirm">
              Confirmar senha
              <span className="signin-field">
                <KeyRound size={18} aria-hidden="true" />
                <input
                  id="password-setup-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(event) => {
                    setConfirm(event.target.value);
                    setError("");
                  }}
                  autoComplete="new-password"
                  required
                />
              </span>
            </label>
            <p className="password-dialog-hint">
              Mínimo de 8 caracteres, com letras e números.
            </p>
            {error && <Alert type="error">{error}</Alert>}
            <div className="password-dialog-actions">
              <button
                type="button"
                className="signin-secondary-action"
                onClick={handleSkip}
                disabled={busy}
              >
                Agora não
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={busy || !password || !confirm}
              >
                {busy ? "Criando senha..." : "Criar senha"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function SitesMapRoute() {
  return (
    <AppShell
      contentClassName="map-page-content"
      shellClassName="map-app-shell"
    >
      <Suspense
        fallback={
          <div className="map-route-loading" role="status">
            <MapPinned size={24} />
            <span>Carregando o mapa de sites…</span>
          </div>
        }
      >
        <SitesMapPage />
      </Suspense>
    </AppShell>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
  leadingAction,
  className = "",
}) {
  return (
    <header className={`page-header ${className}`}>
      <div>
        {leadingAction}
        {eyebrow && <span className="page-header-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
function Loading() {
  return (
    <div className="loading" role="status">
      Carregando dados...
    </div>
  );
}
function Alert({ type = "info", children }) {
  return <div className={`alert ${type}`}>{children}</div>;
}
function Empty({ title, text }) {
  return (
    <div className="empty">
      <Search size={24} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function CasesPage() {
  const { isOperation, profile } = useAuth();
  const [initialState] = useState(() => ({
    cases: getCachedAccessCasesList(profile?.id),
    preferences: readCasesUiPreferences(profile?.id),
  }));
  const [cases, setCases] = useState(() => initialState.cases || []),
    [query, setQuery] = useState(() => initialState.preferences?.query || ""),
    [view, setView] = useState(() => initialState.preferences?.view || "all"),
    [display, setDisplay] = useState(
      () => initialState.preferences?.display || "cards",
    ),
    [selectedClusters, setSelectedClusters] = useState(
      () => initialState.preferences?.selectedClusters || null,
    ),
    [selectedStages, setSelectedStages] = useState(
      () => initialState.preferences?.selectedStages || null,
    ),
    [listPage, setListPage] = useState(1),
    [expandedId, setExpandedId] = useState(null),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(() => initialState.cases === null);
  const [preferencesOwnerId, setPreferencesOwnerId] = useState(
    () => profile?.id || null,
  );

  useEffect(() => {
    const preferences = readCasesUiPreferences(profile?.id);
    setQuery(preferences?.query || "");
    setView(preferences?.view || "all");
    setDisplay(preferences?.display || "cards");
    setSelectedClusters(preferences?.selectedClusters || null);
    setSelectedStages(preferences?.selectedStages || null);
    setListPage(1);
    setExpandedId(null);
    setPreferencesOwnerId(profile?.id || null);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id || preferencesOwnerId !== profile.id) return;
    writeCasesUiPreferences(profile.id, {
      query,
      view,
      display,
      selectedClusters,
      selectedStages,
    });
  }, [
    display,
    preferencesOwnerId,
    profile?.id,
    query,
    selectedClusters,
    selectedStages,
    view,
  ]);

  useEffect(() => {
    let alive = true;
    const snapshot = getCachedAccessCasesList(profile?.id);

    if (snapshot === null) {
      setCases([]);
      setLoading(true);
    } else {
      setCases(snapshot);
      setLoading(false);
    }
    setError("");

    refreshAccessCasesList(profile?.id)
      .then((nextCases) => {
        if (!alive) return;
        setCases(nextCases);
        setError("");
        setLoading(false);
      })
      .catch((loadError) => {
        if (!alive) return;
        setError(errorMessage(loadError));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [profile?.id]);
  const clusterOptions = useMemo(() => {
    const values = [
      ...new Set(
        cases.flatMap((item) =>
          (item.case_sites || [])
            .map((link) => link.site?.eqs_cluster)
            .filter(Boolean),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const options = values.map((value) => ({ value, label: value }));
    const hasMissingCluster = cases.some(
      (item) => !(item.case_sites || []).some((link) => link.site?.eqs_cluster),
    );
    if (hasMissingCluster)
      options.push({
        value: MISSING_CLUSTER_VALUE,
        label: "Não informado",
      });
    return options;
  }, [cases]);
  const filtered = useMemo(
    () =>
      cases.filter((item) => {
        const itemClusters = (item.case_sites || [])
          .map((link) => link.site?.eqs_cluster)
          .filter(Boolean);
        const filterableClusters = itemClusters.length
          ? itemClusters
          : [MISSING_CLUSTER_VALUE];
        const itemHolders = (item.case_sites || [])
          .map((link) => link.site?.holder)
          .filter(Boolean);
        const searchable = `${item.display_name} ${workflowLabel(item.workflow_stage)} ${item.stage || ""} ${item.current_responsibility || ""} ${itemClusters.join(" ")} ${itemHolders.join(" ")}`;
        const matchesView =
          view === "all" ||
          (view === "released" && item.workflow_stage === "access_released") ||
          (view === "active" &&
            item.workflow_stage !== "access_released" &&
            item.status !== "CANCELADO") ||
          (view === "pending" && item.status === "PENDENTE") ||
          (view === "urgent" && item.workflow_stage === "blockage_identified");
        return (
          searchable.toLowerCase().includes(query.toLowerCase()) &&
          matchesView &&
          (selectedClusters === null ||
            filterableClusters.every((itemCluster) =>
              selectedClusters.includes(itemCluster),
            )) &&
          (selectedStages === null ||
            selectedStages.includes(item.workflow_stage))
        );
      }),
    [cases, query, selectedClusters, selectedStages, view],
  );
  const viewCounts = useMemo(
    () => ({
      active: cases.filter(
        (item) =>
          item.workflow_stage !== "access_released" &&
          item.status !== "CANCELADO",
      ).length,
      released: cases.filter(
        (item) => item.workflow_stage === "access_released",
      ).length,
      pending: cases.filter((item) => item.status === "PENDENTE").length,
      urgent: cases.filter(
        (item) => item.workflow_stage === "blockage_identified",
      ).length,
      blockage_identified: cases.filter(
        (item) => item.workflow_stage === "blockage_identified",
      ).length,
      documents_preparation: cases.filter(
        (item) => item.workflow_stage === "documents_preparation",
      ).length,
      holder_validation: cases.filter(
        (item) => item.workflow_stage === "holder_validation",
      ).length,
      new_access_attempt: cases.filter(
        (item) => item.workflow_stage === "new_access_attempt",
      ).length,
      all: cases.length,
    }),
    [cases],
  );
  useEffect(() => {
    if (expandedId && !filtered.some((item) => item.id === expandedId))
      setExpandedId(null);
  }, [expandedId, filtered]);
  useEffect(() => {
    if (display === "cards") setExpandedId(null);
  }, [display]);
  useEffect(() => {
    setListPage(1);
    setExpandedId(null);
  }, [query, selectedClusters, selectedStages, view]);
  const listPageCount = Math.max(
    1,
    Math.ceil(filtered.length / LIST_PAGE_SIZE),
  );
  const visibleListCases = filtered.slice(
    (listPage - 1) * LIST_PAGE_SIZE,
    listPage * LIST_PAGE_SIZE,
  );
  const listStart = filtered.length ? (listPage - 1) * LIST_PAGE_SIZE + 1 : 0;
  const listEnd = Math.min(listPage * LIST_PAGE_SIZE, filtered.length);
  const changeListPage = (nextPage) => {
    const page = Math.min(Math.max(nextPage, 1), listPageCount);
    setListPage(page);
    setExpandedId(null);
  };
  const clearFilters = () => {
    setQuery("");
    setSelectedClusters(null);
    setSelectedStages(null);
    setView("all");
  };
  const hasFilters = Boolean(
    query ||
    selectedClusters !== null ||
    selectedStages !== null ||
    view !== "all",
  );
  const clustersFor = (item) =>
    [
      ...new Set(
        (item.case_sites || [])
          .map((link) => link.site?.eqs_cluster)
          .filter(Boolean),
      ),
    ].join(", ") || "Não informado";
  const holdersFor = (item) =>
    [
      ...new Set(
        (item.case_sites || [])
          .map((link) => link.site?.holder)
          .filter(Boolean),
      ),
    ].join(", ");
  const metrics = [
    {
      filter: "all",
      label: "Total de casos",
      value: viewCounts.all,
      detail: "",
      icon: ClipboardList,
      tone: "blue",
    },
    {
      filter: "active",
      label: "Em andamento",
      value: viewCounts.active,
      detail: `${viewCounts.all ? Math.round((viewCounts.active / viewCounts.all) * 100) : 0}% do total`,
      icon: Clock3,
      tone: "amber",
    },
    {
      filter: "released",
      label: "Liberados",
      value: viewCounts.released,
      detail: `${viewCounts.all ? Math.round((viewCounts.released / viewCounts.all) * 100) : 0}% do total`,
      icon: CircleCheckBig,
      tone: "green",
    },
    {
      filter: "pending",
      label: "Pendentes",
      value: viewCounts.pending,
      detail: `${viewCounts.all ? Math.round((viewCounts.pending / viewCounts.all) * 100) : 0}% do total`,
      icon: FileClock,
      tone: "slate",
    },
    {
      filter: "urgent",
      label: "Urgentes",
      value: viewCounts.urgent,
      detail: `${viewCounts.all ? Math.round((viewCounts.urgent / viewCounts.all) * 100) : 0}% do total`,
      icon: BellRing,
      tone: "red",
    },
  ];
  return (
    <AppShell contentClassName="cases-page">
      <PageHeader
        className="cases-header"
        title="Casos de acesso"
        description={
          loading
            ? "Carregando demandas operacionais..."
            : `${viewCounts.all} demandas operacionais cadastradas no portal.`
        }
        action={
          isOperation && (
            <Link className="button primary" to="/novo">
              <Plus size={18} />
              Novo acesso
            </Link>
          )
        }
      />
      <section className="case-metrics" aria-label="Filtrar casos por situação">
        {metrics.map(({ filter, label, value, detail, icon: Icon, tone }) => (
          <button
            type="button"
            className={`case-metric tone-${tone} ${view === filter ? "active" : ""}`}
            onClick={() => setView(filter)}
            aria-pressed={view === filter}
            key={filter}
          >
            <span className="case-metric-icon">
              <Icon size={18} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
              {detail && <small>{detail}</small>}
            </div>
          </button>
        ))}
      </section>
      <section className="case-filter-bar" aria-label="Filtros dos casos">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por estação, etapa ou responsável..."
          />
        </label>
        <MultiSelectFilter
          label="Clusters EQS"
          allLabel="Todos os clusters"
          emptyLabel="Nenhum cluster"
          countLabel="clusters"
          options={clusterOptions}
          selectedValues={selectedClusters}
          onValuesChange={setSelectedClusters}
        />
        <MultiSelectFilter
          label="Etapas do acesso"
          allLabel="Todas as etapas"
          emptyLabel="Nenhuma etapa"
          countLabel="etapas"
          options={WORKFLOW_FILTER_OPTIONS}
          selectedValues={selectedStages}
          onValuesChange={setSelectedStages}
        />
        <button
          type="button"
          className="case-filter-action"
          onClick={clearFilters}
          disabled={!hasFilters}
          aria-label="Limpar filtros"
          title="Limpar filtros"
        >
          <X size={17} />
        </button>
        <div
          className="display-switch"
          role="group"
          aria-label="Modo de exibição"
        >
          <button
            type="button"
            className={display === "cards" ? "active" : ""}
            onClick={() => setDisplay("cards")}
            aria-pressed={display === "cards"}
            title="Exibir cards"
          >
            <LayoutGrid size={17} />
            Cards
          </button>
          <button
            type="button"
            className={display === "list" ? "active" : ""}
            onClick={() => setDisplay("list")}
            aria-pressed={display === "list"}
            title="Exibir lista"
          >
            <List size={17} />
            Lista
          </button>
        </div>
      </section>
      {error && <Alert type="error">{error}</Alert>}
      {loading ? (
        <Loading />
      ) : !filtered.length ? (
        <section className="case-empty-state">
          <Empty
            title="Nenhum caso encontrado"
            text="Ajuste os filtros ou cadastre uma nova demanda."
          />
        </section>
      ) : display === "cards" ? (
        <section className="case-card-grid">
          {filtered.map((item) => (
            <CaseCard
              item={item}
              clusters={clustersFor(item)}
              holders={holdersFor(item)}
              key={item.id}
            />
          ))}
        </section>
      ) : (
        <section className="case-list">
          <div className="list-head">
            <span>Estação</span>
            <span>Cluster EQS</span>
            <span>Progresso</span>
            <span>Responsável</span>
            <span>Atualizado</span>
            <span />
          </div>
          {visibleListCases.map((item) => {
            const expanded = expandedId === item.id;
            const responsibility = valueOrMissing(item.current_responsibility);
            const updated = updateMeta(item.updated_at);
            const primarySite = (item.case_sites || [])
              .slice()
              .sort((a, b) => (a.position || 0) - (b.position || 0))[0]?.site;
            const siteType = normalizeSiteType(primarySite?.station_type);
            const siteTypeColor = getSiteTypeColor(siteType);
            return (
              <article
                className={`case-entry ${expanded ? "expanded" : ""}`}
                data-stage={item.workflow_stage}
                key={item.id}
              >
                <button
                  type="button"
                  className="case-line"
                  onClick={() => setExpandedId(expanded ? null : item.id)}
                  aria-expanded={expanded}
                  aria-controls={`case-progress-${item.id}`}
                >
                  <span className="case-station-cell">
                    <span
                      className="case-list-site-icon"
                      style={{ "--site-type-color": siteTypeColor }}
                      title={`Tipologia: ${siteType}`}
                      aria-hidden="true"
                    >
                      <SiteTypeIcon
                        type={siteType}
                        family="structural"
                        size={20}
                      />
                    </span>
                    <span className="case-station-copy">
                      <strong>{item.display_name}</strong>
                      <small>{holdersFor(item) || "Sem detentora"}</small>
                    </span>
                  </span>
                  <span className="cluster-value">
                    <span>{clustersFor(item)}</span>
                  </span>
                  <span className="case-progress-cell">
                    <WorkflowSummary value={item.workflow_stage} />
                  </span>
                  <span
                    className="case-responsibility"
                    data-owner={responsibility.toUpperCase()}
                  >
                    <span className="responsibility-avatar">
                      {initialsFor(responsibility)}
                    </span>
                    <span>{responsibility}</span>
                  </span>
                  <span className="updated-value">
                    <strong>{updated.date}</strong>
                    <small>{updated.relative}</small>
                  </span>
                  <ChevronRight
                    className="case-chevron"
                    size={18}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <div
                    className="case-expansion"
                    id={`case-progress-${item.id}`}
                  >
                    <div className="case-expansion-heading">
                      <strong>Andamento do acesso</strong>
                      <Link
                        className="button secondary"
                        to={`/casos/${item.id}`}
                      >
                        Ver detalhes
                        <ChevronRight size={17} />
                      </Link>
                    </div>
                    <WorkflowTracker
                      value={item.workflow_stage}
                      variant="detail"
                    />
                  </div>
                )}
              </article>
            );
          })}
          <footer className="case-list-footer">
            <span>
              Mostrando {listStart} a {listEnd} de {filtered.length} casos
            </span>
            <nav className="case-pagination" aria-label="Paginação dos casos">
              <button
                type="button"
                onClick={() => changeListPage(listPage - 1)}
                disabled={listPage === 1}
                aria-label="Página anterior"
                title="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              {paginationItems(listPageCount, listPage).map((page) =>
                typeof page === "number" ? (
                  <button
                    type="button"
                    className={page === listPage ? "active" : ""}
                    onClick={() => changeListPage(page)}
                    aria-current={page === listPage ? "page" : undefined}
                    aria-label={`Página ${page}`}
                    key={page}
                  >
                    {page}
                  </button>
                ) : (
                  <span className="case-pagination-ellipsis" key={page}>
                    …
                  </span>
                ),
              )}
              <button
                type="button"
                onClick={() => changeListPage(listPage + 1)}
                disabled={listPage === listPageCount}
                aria-label="Próxima página"
                title="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </nav>
          </footer>
        </section>
      )}
    </AppShell>
  );
}

function SiteSearch({ selected, onSelect, disabled = false }) {
  const [query, setQuery] = useState(selected?.station || ""),
    [results, setResults] = useState([]),
    [open, setOpen] = useState(false),
    [activeIndex, setActiveIndex] = useState(0);
  const requestId = useRef(0);
  useEffect(() => {
    if (disabled) {
      setOpen(false);
      return;
    }
    if (selected && query === selected.station) return;
    if (query.trim().length < 2) {
      setOpen(false);
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      const { data } = await supabase.rpc("search_sites", {
        search_term: query.trim(),
        result_limit: 10,
      });
      if (id === requestId.current) {
        setResults(data || []);
        setActiveIndex(0);
        setOpen(true);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [disabled, query, selected]);
  function choose(site) {
    setQuery(site.station);
    setOpen(false);
    onSelect(site);
  }
  function keyDown(event) {
    if (!open || !results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[activeIndex]);
    }
    if (event.key === "Escape") setOpen(false);
  }
  return (
    <div className="autocomplete">
      <label>
        Site/estação
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            onSelect(null);
          }}
          onKeyDown={keyDown}
          onFocus={() => results.length && setOpen(true)}
          placeholder="Digite ao menos 2 caracteres"
          autoComplete="off"
          disabled={disabled}
        />
      </label>
      {open && (
        <div className="suggestions" role="listbox">
          {results.map((site, index) => (
            <button
              type="button"
              key={site.id}
              className={index === activeIndex ? "active" : ""}
              onMouseDown={() => choose(site)}
            >
              <strong>{site.station}</strong>
              <span>
                {valueOrMissing(site.holder)} ·{" "}
                {valueOrMissing(site.eqs_cluster)}
              </span>
            </button>
          ))}
          {!results.length && (
            <div className="no-result">Nenhuma estação encontrada.</div>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ current }) {
  const steps = [
    { label: "Site", description: "Local da demanda", icon: Building2 },
    {
      label: "Colaboradores",
      description: "Equipe que fará o acesso",
      icon: UsersRound,
    },
    {
      label: "Documentação",
      description: "Funcionários e empresa",
      icon: FileText,
    },
  ];
  return (
    <ol className="stepper">
      {steps.map(({ label, description, icon: Icon }, index) => {
        const number = index + 1;
        const state =
          number < current
            ? "completed"
            : number === current
              ? "current"
              : "upcoming";
        return (
          <li
            key={label}
            className={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="stepper-mark">
              {state === "completed" ? <Check size={17} /> : <Icon size={18} />}
            </span>
            <span className="stepper-copy">
              <small>Etapa {number}</small>
              <strong>{label}</strong>
              <em>{description}</em>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
function ReadField({ label, value, wide }) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      <input
        value={value || ""}
        placeholder="Preenchido após selecionar o site"
        readOnly
      />
    </label>
  );
}
function NewCasePage() {
  const navigate = useNavigate();
  const [site, setSite] = useState(null),
    [step, setStep] = useState(1),
    [caseId, setCaseId] = useState(null),
    [warning, setWarning] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [linkedCollaborators, setLinkedCollaborators] = useState([]);
  const [documentPerson, setDocumentPerson] = useState(null);
  const [documentRefreshKey, setDocumentRefreshKey] = useState(0);
  const [companyRequirement, setCompanyRequirement] = useState("a_definir");

  function refreshDocuments() {
    setDocumentRefreshKey((current) => current + 1);
  }
  async function saveSite(force = false) {
    if (caseId) {
      setStep(2);
      return;
    }
    if (!site) {
      setError("Selecione uma estação válida na lista.");
      return;
    }
    setBusy(true);
    setError("");
    setWarning("");
    const { data: links, error: duplicateError } = await supabase
      .from("case_sites")
      .select("case_id,access_cases(id,status,display_name)")
      .eq("site_id", site.id);
    if (duplicateError) {
      setError(errorMessage(duplicateError));
      setBusy(false);
      return;
    }
    const active = (links || [])
      .map((link) => link.access_cases)
      .filter((item) => item && ACTIVE.has(item.status));
    if (active.length && !force) {
      setWarning(
        `Esta estação já possui ${active.length} caso(s) ativo(s). Confirme para criar uma nova demanda.`,
      );
      setBusy(false);
      return;
    }
    const { data, error: createError } = await supabase.rpc(
      "create_access_case",
      { p_site_id: site.id },
    );
    setBusy(false);
    if (createError) setError(errorMessage(createError));
    else {
      setCaseId(data);
      setStep(2);
    }
  }
  const stepDescription =
    step === 1
      ? "Selecione o local da demanda"
      : step === 2
        ? "Vincule os colaboradores que farão o acesso"
        : "Defina os documentos dos funcionários e da empresa";

  return (
    <AppShell contentClassName="new-case-page">
      <PageHeader
        title="Novo caso de acesso"
        description={`Etapa ${step} de 3 · ${stepDescription}`}
        action={
          <Link to="/casos" className="button secondary">
            <ArrowLeft size={18} />
            Voltar aos casos
          </Link>
        }
      />
      <Stepper current={step} />
      <section className={`form-panel new-case-wizard wizard-step-${step}`}>
        {step === 1 && (
          <>
            <div className="section-heading wizard-section-heading">
              <span className="wizard-heading-icon" aria-hidden="true">
                <Building2 size={22} />
              </span>
              <div>
                <h2>Qual site precisa de acesso?</h2>
                <p>
                  Busque a estação pelo código. Os demais dados serão
                  preenchidos automaticamente pela base oficial.
                </p>
              </div>
            </div>
            <div className="site-form wizard-site-form">
              <div className="wizard-site-search">
                <SiteSearch
                  selected={site}
                  onSelect={setSite}
                  disabled={Boolean(caseId)}
                />
                <small>
                  {caseId
                    ? "O caso já foi criado para este site."
                    : "Digite pelo menos dois caracteres e escolha uma opção da lista."}
                </small>
              </div>
              <div className="wizard-site-data">
                <ReadField label="Detentora" value={site?.holder} />
                <ReadField label="Cluster EQS" value={site?.eqs_cluster} />
                <ReadField
                  label="Coordenador EQS"
                  value={site?.eqs_coordinator}
                />
                <ReadField label="Nível" value={site?.priority_level} />
                <ReadField label="Endereço" value={site?.address} wide />
              </div>
            </div>
            <div className="wizard-data-note">
              <Database size={17} aria-hidden="true" />
              <p>
                Os dados vêm da tipologia oficial e são alterados somente na
                Tipologia Geral.
              </p>
            </div>
            {warning && (
              <Alert type="warning">
                {warning}
                <button
                  className="button warning-button"
                  onClick={() => saveSite(true)}
                >
                  Criar mesmo assim
                </button>
              </Alert>
            )}
            {error && <Alert type="error">{error}</Alert>}
            <div className="form-actions wizard-footer-actions">
              <button
                className="button primary"
                onClick={() => saveSite()}
                disabled={busy}
              >
                {busy
                  ? "Criando caso..."
                  : caseId
                    ? "Voltar para colaboradores"
                    : "Criar caso e continuar"}
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="section-heading wizard-section-heading">
              <span className="wizard-heading-icon" aria-hidden="true">
                <UsersRound size={22} />
              </span>
              <div>
                <h2>Quem fará o acesso?</h2>
                <p>
                  Procure primeiro na base de colaboradores. Cadastre uma nova
                  pessoa somente quando ela ainda não existir.
                </p>
              </div>
            </div>
            <CollaboratorManager
              caseId={caseId}
              variant="wizard"
              onLinksChange={setLinkedCollaborators}
              onDocumentsChange={refreshDocuments}
            />
            <div className="form-actions split wizard-footer-actions">
              <button className="button secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={18} />
                Voltar
              </button>
              <div>
                <button
                  className="button secondary"
                  onClick={() => navigate(`/casos/${caseId}`)}
                >
                  Concluir depois
                </button>
                <button className="button primary" onClick={() => setStep(3)}>
                  Configurar documentação
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="section-heading wizard-section-heading">
              <span className="wizard-heading-icon" aria-hidden="true">
                <FileText size={22} />
              </span>
              <div>
                <h2>Documentação necessária</h2>
                <p>
                  Configure separadamente os documentos dos colaboradores e os
                  documentos patronais da empresa.
                </p>
              </div>
            </div>
            <div className="new-case-documentation-layout">
              <div className="wizard-employee-documents">
                <CaseDocumentationPanel
                  caseId={caseId}
                  collaborators={linkedCollaborators}
                  isOperation
                  refreshKey={documentRefreshKey}
                  onManageDocuments={setDocumentPerson}
                  title="Documentação dos colaboradores"
                  description="Defina e acompanhe o checklist individual de cada pessoa vinculada."
                  emptyOperationMessage="Volte à etapa anterior e vincule um colaborador para configurar seu checklist."
                />
              </div>
              <div className="wizard-company-documents">
                <Suspense
                  fallback={
                    <div className="side-panel company-documents-fallback">
                      Carregando documentação patronal...
                    </div>
                  }
                >
                  <CompanyDocumentationPanel
                    caseId={caseId}
                    requirement={companyRequirement}
                    isOperation
                    onRequirementChange={setCompanyRequirement}
                  />
                </Suspense>
              </div>
            </div>
            <div className="form-actions split wizard-footer-actions">
              <button className="button secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={18} />
                Voltar
              </button>
              <div>
                <button
                  className="button primary"
                  onClick={() => navigate(`/casos/${caseId}`)}
                >
                  <Check size={18} />
                  Concluir cadastro
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      <DocumentChecklist
        caseId={caseId}
        collaborator={documentPerson}
        open={Boolean(documentPerson)}
        onClose={() => setDocumentPerson(null)}
        onSaved={refreshDocuments}
      />
    </AppShell>
  );
}

function CaseDetailPage() {
  const { id } = useParams(),
    { isOperation } = useAuth(),
    navigate = useNavigate();
  const [item, setItem] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [linkedCollaborators, setLinkedCollaborators] = useState([]);
  const [safeCollaborators, setSafeCollaborators] = useState([]);
  const [safeCollaboratorsLoading, setSafeCollaboratorsLoading] =
    useState(false);
  const [safeCollaboratorsError, setSafeCollaboratorsError] = useState("");
  const [documentPerson, setDocumentPerson] = useState(null);
  const [documentRefreshKey, setDocumentRefreshKey] = useState(0);

  function refreshDocuments() {
    setDocumentRefreshKey((current) => current + 1);
  }

  function handleCollaboratorLinksChange(people) {
    setLinkedCollaborators(people);
    setDocumentPerson((current) =>
      current && !people.some((person) => person.id === current.id)
        ? null
        : current,
    );
  }

  async function loadCase() {
    const { data, error: loadError } = await supabase
      .from("access_cases")
      .select(
        "*,case_sites(position,site:sites(*)),case_events(*),case_documents(*)",
      )
      .eq("id", id)
      .single();
    if (loadError) setError(errorMessage(loadError));
    else {
      setItem(data);
      setForm(data);
    }
  }
  useEffect(() => {
    loadCase();
  }, [id]);
  useEffect(() => {
    if (isOperation) {
      setSafeCollaborators([]);
      setSafeCollaboratorsError("");
      setSafeCollaboratorsLoading(false);
      return undefined;
    }
    let active = true;
    setSafeCollaboratorsLoading(true);
    setSafeCollaboratorsError("");
    supabase
      .rpc("get_case_collaborators_safe", { p_case_id: id })
      .then(({ data, error: collaboratorsError }) => {
        if (!active) return;
        setSafeCollaboratorsLoading(false);
        if (collaboratorsError) {
          setSafeCollaborators([]);
          setSafeCollaboratorsError(
            "Não foi possível carregar os colaboradores.",
          );
          return;
        }
        const people = data || [];
        setSafeCollaborators(people);
        setCollaboratorCount(people.length);
      });
    return () => {
      active = false;
    };
  }, [id, isOperation]);
  async function save(event) {
    event.preventDefault();
    setSaved(false);
    setError("");
    let workflowData = null;
    if (form.workflow_stage !== item.workflow_stage) {
      const { data, error: workflowError } = await supabase
        .rpc("set_case_workflow_stage", {
          p_case_id: id,
          p_workflow_stage: form.workflow_stage,
        })
        .single();
      if (workflowError) {
        setError(errorMessage(workflowError));
        return;
      }
      workflowData = data;
    }
    const payload = {
      current_responsibility: form.current_responsibility,
      next_action: form.next_action,
      notes: form.notes,
    };
    const { data, error: saveError } = await supabase
      .from("access_cases")
      .update(payload)
      .eq("id", id)
      .select("current_responsibility,next_action,notes,updated_at")
      .single();
    if (saveError) {
      setError(errorMessage(saveError));
      return;
    }
    let caseEvents = null;
    if (workflowData) {
      const { data: events, error: eventsError } = await supabase
        .from("case_events")
        .select("*")
        .eq("case_id", id)
        .order("created_at", { ascending: false });
      if (!eventsError) caseEvents = events;
    }
    setItem((current) => ({
      ...current,
      ...data,
      ...(workflowData || {}),
      case_events: caseEvents || current.case_events,
    }));
    setForm((current) => ({ ...current, ...data, ...(workflowData || {}) }));
    setSaved(true);
  }
  async function deleteCase() {
    if (!isOperation || deleteBusy) return;
    const confirmed = window.confirm(
      `Excluir o caso "${item.display_name}"?\n\nO caso, seus vínculos, eventos e checklists serão removidos. A exclusão ficará registrada na auditoria.`,
    );
    if (!confirmed) return;
    setDeleteBusy(true);
    setError("");
    const { data: attachments, error: attachmentsError } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("case_id", id);
    if (attachmentsError) {
      setError(errorMessage(attachmentsError));
      setDeleteBusy(false);
      return;
    }
    const { error: deleteError } = await supabase
      .from("access_cases")
      .delete()
      .eq("id", id);
    if (deleteError) {
      setError(errorMessage(deleteError));
      setDeleteBusy(false);
      return;
    }
    const storagePaths = (attachments || [])
      .map((attachment) => attachment.storage_path)
      .filter(Boolean);
    if (storagePaths.length) {
      await supabase.storage.from("case-documents").remove(storagePaths);
    }
    navigate("/casos", { replace: true });
  }
  if (!item || !form)
    return (
      <AppShell
        shellClassName="case-detail-shell"
        contentClassName="case-detail-page"
      >
        {error ? <Alert type="error">{error}</Alert> : <Loading />}
      </AppShell>
    );
  const sites =
    item.case_sites
      ?.slice()
      .sort((a, b) => a.position - b.position)
      .map((link) => link.site) || [];
  const primarySite = sites[0] || {};
  const siteType = normalizeSiteType(primarySite.station_type);
  const siteTypeColor = getSiteTypeColor(siteType);
  const regional =
    primarySite.eqs_cluster || primarySite.claro_cluster || "Não informado";
  const siteName = primarySite.holder || "Local não informado";
  const responsibilityOptions = [
    ...new Set(
      [form.current_responsibility, "EQS", "CLARO", "DETENTORA"].filter(
        Boolean,
      ),
    ),
  ];
  const timeline = (item.case_events || [])
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return (
    <AppShell
      shellClassName="case-detail-shell"
      contentClassName="case-detail-page"
    >
      <PageHeader
        className="case-detail-header"
        leadingAction={
          <Link
            to="/casos"
            className="case-detail-back"
            aria-label="Voltar aos casos"
            title="Voltar aos casos"
          >
            <ArrowLeft size={18} />
          </Link>
        }
        eyebrow={`Casos de acesso / ${item.display_name}`}
        title="Detalhe da demanda"
        description={
          item.is_legacy_group
            ? "Caso legado com múltiplas estações"
            : "Operação de acesso · Minas Gerais"
        }
        action={
          isOperation && (
            <div className="page-header-actions">
              <button
                type="button"
                className="button danger"
                onClick={deleteCase}
                disabled={deleteBusy}
              >
                <Trash2 size={17} />
                {deleteBusy ? "Excluindo..." : "Excluir caso"}
              </button>
            </div>
          )
        }
      />
      <div className="case-detail-layout">
        <section
          className="case-site-banner"
          style={regionalBannerStyle(regional)}
          aria-label={`Resumo do site ${item.display_name}, tipologia ${siteType}`}
        >
          <span
            className="case-site-icon"
            style={{ "--site-type-color": siteTypeColor }}
            aria-hidden="true"
          >
            <SiteTypeIcon type={siteType} family="structural" size={36} />
          </span>
          <div className="case-site-copy">
            <strong>{item.display_name}</strong>
            <span className="case-site-context">
              {siteName} · {valueOrMissing(regional)}
            </span>
            <span className="case-site-type">
              <SiteTypeIcon type={siteType} family="structural" size={13} />
              {siteType}
            </span>
            <small>
              <MapPin size={17} />
              {valueOrMissing(primarySite.address)}
            </small>
          </div>
          <div className="case-site-update">
            <span>Atualizado em</span>
            <strong>
              <CalendarDays size={17} />
              {formatCaseUpdate(item.updated_at)}
            </strong>
          </div>
        </section>
        <Suspense
          fallback={
            <div
              className="case-site-map-preview is-loading"
              aria-label="Carregando localização do site"
            >
              <span>Carregando localização...</span>
            </div>
          }
        >
          <SiteLocationPreview site={primarySite} />
        </Suspense>
        <div className="case-detail-primary">
          <section
            className="case-workflow-panel"
            aria-labelledby="workflow-title"
          >
            <h2 id="workflow-title">Andamento do acesso</h2>
            <WorkflowTracker value={item.workflow_stage} variant="detail" />
          </section>

          <form className="case-operation-panel" onSubmit={save}>
            <div className="case-operation-top">
              <div className="case-operation-controls">
                <div className="case-stage-control">
                  <label>
                    Etapa atual
                    <select
                      value={form.workflow_stage}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          workflow_stage: event.target.value,
                        })
                      }
                      disabled={!isOperation}
                    >
                      {WORKFLOW_STAGES.map((stage) => (
                        <option value={stage.key} key={stage.key}>
                          {stage.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Responsável atual
                  <select
                    value={form.current_responsibility || ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        current_responsibility: event.target.value,
                      })
                    }
                    disabled={!isOperation}
                  >
                    <option value="">Não informado</option>
                    {responsibilityOptions.map((option) => (
                      <option value={option} key={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="counted-field case-next-action">
                Próximo passo
                <textarea
                  value={form.next_action || ""}
                  onChange={(event) =>
                    setForm({ ...form, next_action: event.target.value })
                  }
                  readOnly={!isOperation}
                  maxLength={500}
                />
                <span className="field-count">
                  {(form.next_action || "").length}/500
                </span>
              </label>
            </div>
            <label className="counted-field case-notes-field">
              Observações
              <textarea
                value={form.notes || ""}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
                readOnly={!isOperation}
                maxLength={1000}
                placeholder="Adicionar observações (opcional)..."
              />
              <span className="field-count">
                {(form.notes || "").length}/1000
              </span>
            </label>
            {isOperation && (
              <footer className="case-operation-actions">
                {saved && (
                  <span className="success-text">
                    <Check size={17} />
                    Alterações salvas
                  </span>
                )}
                <button className="button primary">Salvar alterações</button>
              </footer>
            )}
          </form>
          <CaseDocumentationPanel
            caseId={id}
            collaborators={isOperation ? linkedCollaborators : safeCollaborators}
            isOperation={isOperation}
            refreshKey={documentRefreshKey}
            onManageDocuments={setDocumentPerson}
          />
          {error && <Alert type="error">{error}</Alert>}
        </div>

        <aside className="case-detail-sidebar">
          <section className="side-panel case-collaborators-panel">
            <header className="detail-side-heading">
              <UsersRound size={23} />
              <h2>Colaboradores</h2>
              <span>{collaboratorCount}</span>
            </header>
            {isOperation ? (
              <CollaboratorManager
                caseId={id}
                onCountChange={setCollaboratorCount}
                onLinksChange={handleCollaboratorLinksChange}
                onManageDocuments={setDocumentPerson}
                onDocumentsChange={refreshDocuments}
                allowCreate={false}
                copyChecklistOnLink
              />
            ) : safeCollaboratorsLoading ? (
              <p className="muted-block">Carregando colaboradores...</p>
            ) : safeCollaboratorsError ? (
              <p className="muted-block">{safeCollaboratorsError}</p>
            ) : safeCollaborators.length ? (
              <div className="client-case-collaborator-list">
                {safeCollaborators.map((collaborator, index) => (
                  <article
                    className="client-case-collaborator"
                    key={`${collaborator.full_name}-${index}`}
                  >
                    <span
                      className="client-case-collaborator-mark"
                      aria-hidden="true"
                    >
                      {collaborator.full_name
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part.replace(".", ""))
                        .join("")}
                    </span>
                    <div>
                      <strong>{collaborator.full_name}</strong>
                      <span>
                        <Check size={13} aria-hidden="true" />
                        <b>{collaborator.cpf_masked}</b>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted-block">
                Nenhum colaborador vinculado a esta demanda.
              </p>
            )}
          </section>
          <section className="side-panel case-timeline-panel">
            <header className="detail-side-heading">
              <Clock3 size={23} />
              <h2>Linha do tempo</h2>
            </header>
            <div className="case-timeline-list">
              {timeline.map((event) => (
                <div className="timeline-line" key={event.id}>
                  <strong>{caseEventLabel(event.event_type)}</strong>
                  <span>{event.description}</span>
                  <small>
                    {new Date(event.created_at).toLocaleString("pt-BR")}
                  </small>
                </div>
              ))}
              {!timeline.length && (
                <p className="muted-block">Nenhum evento registrado.</p>
              )}
            </div>
          </section>
          <Suspense
            fallback={
              <div className="side-panel company-documents-fallback">
                Carregando documentação patronal...
              </div>
            }
          >
            <CompanyDocumentationPanel
              caseId={id}
              requirement={item.company_documents_requirement || "a_definir"}
              isOperation={isOperation}
              onRequirementChange={(companyDocumentsRequirement) => {
                setItem((current) => ({
                  ...current,
                  company_documents_requirement: companyDocumentsRequirement,
                }));
                setForm((current) => ({
                  ...current,
                  company_documents_requirement: companyDocumentsRequirement,
                }));
              }}
            />
          </Suspense>
        </aside>
      </div>
      <DocumentChecklist
        caseId={id}
        collaborator={documentPerson}
        open={Boolean(documentPerson)}
        onClose={() => setDocumentPerson(null)}
        onSaved={refreshDocuments}
      />
    </AppShell>
  );
}

function EditField({ label, field, form, setForm, wide, disabled }) {
  return (
    <label className={wide ? "wide" : ""}>
      {label}
      <input
        value={form[field] || ""}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        readOnly={disabled}
      />
    </label>
  );
}

function SitesPage() {
  const { isOperation } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null);
  const [message, setMessage] = useState("");
  const [analyticsVersion, setAnalyticsVersion] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [searching, setSearching] = useState(false);

  async function search(event, requestedType = typeFilter) {
    event?.preventDefault();
    if (!isOperation) return;
    if (query.trim().length < 2 && !requestedType) {
      setMessage("Digite ao menos dois caracteres ou escolha uma tipologia.");
      return;
    }
    setSearching(true);
    const { data, error } = await supabase.rpc("search_sites_for_typology", {
      p_search: query.trim(),
      p_type: requestedType || null,
      p_limit: 20,
    });
    setSearching(false);
    if (error) {
      setMessage(errorMessage(error));
      return;
    }
    setResults(data || []);
    setMessage("");
  }

  function handleTypeSelect(nextType) {
    setTypeFilter(nextType);
    setSelected(null);
    setForm(null);
    if (isOperation && nextType) search(null, nextType);
    if (!nextType && query.trim()) search(null, "");
    if (!nextType && !query.trim()) setResults([]);
  }

  async function openSite(site) {
    if (!isOperation) return;
    const { data, error } = await supabase
      .from("sites")
      .select("*")
      .eq("id", site.id)
      .single();
    if (error) setMessage(errorMessage(error));
    else {
      setSelected(data);
      setForm(data);
      setMessage("");
    }
  }

  async function save(event) {
    event.preventDefault();
    const parseCoordinate = (value, label) => {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return null;
      }
      const parsed = Number(String(value).replace(",", "."));
      if (!Number.isFinite(parsed)) {
        throw new Error(`${label} precisa ser um número válido.`);
      }
      return parsed;
    };

    let latitude;
    let longitude;
    try {
      latitude = parseCoordinate(form.latitude, "Latitude");
      longitude = parseCoordinate(form.longitude, "Longitude");
    } catch (validationError) {
      setMessage(validationError.message);
      return;
    }

    const payload = {
      station_type: form.station_type || null,
      municipality: form.municipality || null,
      holder: form.holder || null,
      eqs_cluster: form.eqs_cluster || null,
      eqs_coordinator: form.eqs_coordinator || null,
      priority_level: form.priority_level || null,
      address: form.address || null,
      latitude,
      longitude,
    };
    const { error } = await supabase
      .from("sites")
      .update(payload)
      .eq("id", selected.id);
    if (error) {
      setMessage(errorMessage(error));
      return;
    }
    setSelected({ ...selected, ...payload });
    setForm({ ...form, ...payload });
    setAnalyticsVersion((version) => version + 1);
    setMessage("Correção salva e registrada na auditoria.");
  }

  return (
    <AppShell contentClassName="typology-page-content">
      <PageHeader
        title="Tipologia geral"
        description="Distribuição das estações por tipologia, município e demandas vinculadas."
      />
      <Suspense
        fallback={
          <section
            className="typology-overview typology-overview-loading"
            aria-label="Carregando tipologia geral"
          >
            <div className="typology-skeleton typology-skeleton-hero" />
            <div className="typology-skeleton typology-skeleton-index" />
            <div className="typology-skeleton typology-skeleton-insight" />
          </section>
        }
      >
        <SiteCatalogOverview
          refreshKey={analyticsVersion}
          selectedType={typeFilter}
          onTypeSelect={isOperation ? handleTypeSelect : undefined}
        />
      </Suspense>

      {isOperation ? (
        <section
          className="site-correction-workspace"
          aria-labelledby="site-correction-title"
        >
          <header className="site-correction-heading">
            <div>
              <span>Operação EQS</span>
              <h2 id="site-correction-title">Correções de cadastro</h2>
              <p>
                Localize uma estação para corrigir seus dados. Cada alteração é
                gravada na trilha de auditoria.
              </p>
            </div>
            <span className="site-audit-badge">Auditoria ativa</span>
          </header>

          <div className="site-correction-grid">
            <section className="site-search-panel" aria-label="Buscar estação">
              <form className="site-search-form" onSubmit={search}>
                <label className="search-field">
                  <Search size={18} aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value.toUpperCase())
                    }
                    placeholder="Código, nome ou tipologia"
                  />
                </label>
                <button className="button primary" disabled={searching}>
                  {searching ? "Buscando…" : "Buscar"}
                </button>
              </form>
              {typeFilter && (
                <div className="site-search-filter">
                  <span>Recorte ativo</span>
                  <strong>{typeFilter}</strong>
                  <button
                    type="button"
                    onClick={() => handleTypeSelect("")}
                    aria-label="Remover filtro de tipologia"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
              <div className="site-search-results" aria-live="polite">
                {results.map((site) => {
                  const siteType = normalizeSiteType(site.station_type);
                  return (
                    <button
                      type="button"
                      key={site.id}
                      onClick={() => openSite(site)}
                      className={selected?.id === site.id ? "is-active" : ""}
                    >
                      <span
                        className="site-search-result-icon"
                        style={{ "--type-accent": getSiteTypeColor(siteType) }}
                        aria-hidden="true"
                      >
                        <SiteTypeIcon
                          type={siteType}
                          family="structural"
                          size={22}
                        />
                      </span>
                      <span className="site-search-result-copy">
                        <strong>{site.station}</strong>
                        <small>
                          {valueOrMissing(site.municipality)} · {siteType}
                        </small>
                      </span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </button>
                  );
                })}
                {!results.length && (
                  <Empty
                    title={
                      typeFilter
                        ? `Nenhuma estação ${typeFilter}`
                        : "Encontre uma estação"
                    }
                    text={
                      typeFilter
                        ? "Tente outro recorte ou complemente com o código da estação."
                        : "Busque por código, nome ou escolha uma tipologia no índice acima."
                    }
                  />
                )}
              </div>
            </section>

            <section className="site-edit-panel" aria-label="Correção do site">
              {form ? (
                <form className="site-edit-form site-form" onSubmit={save}>
                  <header className="site-edit-form-header wide">
                    <span
                      className="site-edit-type-icon"
                      style={{
                        "--type-accent": getSiteTypeColor(form.station_type),
                      }}
                      aria-hidden="true"
                    >
                      <SiteTypeIcon
                        type={form.station_type}
                        family="structural"
                        size={30}
                      />
                    </span>
                    <div>
                      <span>Estação selecionada</span>
                      <h3>{form.station}</h3>
                      <p>
                        {valueOrMissing(form.full_station || form.municipality)}
                      </p>
                    </div>
                    <small>{normalizeSiteType(form.station_type)}</small>
                  </header>
                  <ReadField label="Estação" value={form.station} />
                  <ReadField
                    label="Tipologia geral"
                    value={normalizeSiteType(form.station_type)}
                  />
                  <EditField
                    label="Tipologia original"
                    field="station_type"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Município"
                    field="municipality"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Detentora"
                    field="holder"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Cluster EQS"
                    field="eqs_cluster"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Coordenador EQS"
                    field="eqs_coordinator"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Prioridade"
                    field="priority_level"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Latitude"
                    field="latitude"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Longitude"
                    field="longitude"
                    form={form}
                    setForm={setForm}
                  />
                  <EditField
                    label="Endereço"
                    field="address"
                    form={form}
                    setForm={setForm}
                    wide
                  />
                  <div className="wide form-actions">
                    <button className="button primary">
                      Salvar correção auditada
                    </button>
                  </div>
                </form>
              ) : (
                <Empty
                  title="Nenhuma estação selecionada"
                  text="Escolha um resultado para revisar e corrigir os dados do cadastro."
                />
              )}
              {message && <Alert>{message}</Alert>}
            </section>
          </div>
        </section>
      ) : (
        <section className="typology-readonly-note">
          <div>
            <span>Modo consulta</span>
            <h2>Dados compartilhados, sem edição direta</h2>
            <p>
              Para explorar estações, municípios e tipologias em detalhe, use o
              Mapa de Sites. Alterações permanecem sob responsabilidade da EQS.
            </p>
          </div>
          <Link className="button secondary" to="/mapa-sites">
            <MapPinned size={17} />
            Abrir Mapa de Sites
          </Link>
        </section>
      )}
    </AppShell>
  );
}

function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState([]),
    [query, setQuery] = useState(""),
    [asoFilter, setAsoFilter] = useState("all"),
    [collaboratorPage, setCollaboratorPage] = useState(1),
    [editingId, setEditingId] = useState(null),
    [editForm, setEditForm] = useState(null),
    [showCreate, setShowCreate] = useState(false),
    [createForm, setCreateForm] = useState(EMPTY_COLLABORATOR_FORM),
    [creating, setCreating] = useState(false),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: loadError } = await supabase
        .from("collaborators")
        .select("id,full_name,cpf,city,next_aso_date,active")
        .order("full_name");
      if (alive) {
        setCollaborators(data || []);
        setError(loadError ? errorMessage(loadError) : "");
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const termDigits = term.replace(/\D/g, "");
    return collaborators.filter((person) => {
      const text =
        `${person.full_name || ""} ${person.city || ""}`.toLocaleLowerCase(
          "pt-BR",
        );
      const matchesSearch =
        !term ||
        text.includes(term) ||
        (termDigits && (person.cpf || "").includes(termDigits));
      const matchesAso =
        asoFilter === "all" || asoCategory(person.next_aso_date) === asoFilter;
      return matchesSearch && matchesAso;
    });
  }, [asoFilter, collaborators, query]);

  const asoCounts = useMemo(
    () =>
      collaborators.reduce(
        (counts, person) => {
          counts[asoCategory(person.next_aso_date)] += 1;
          counts.all += 1;
          return counts;
        },
        { all: 0, expired: 0, due_soon: 0, valid: 0, missing: 0 },
      ),
    [collaborators],
  );

  const metrics = [
    {
      filter: "all",
      label: "Todos",
      detail: "Base completa",
      value: asoCounts.all,
      icon: UsersRound,
      tone: "blue",
    },
    {
      filter: "expired",
      label: "Vencidos",
      detail: "ASO vencido",
      value: asoCounts.expired,
      icon: TriangleAlert,
      tone: "red",
    },
    {
      filter: "due_soon",
      label: "Próximos 30 dias",
      detail: "Vencem em breve",
      value: asoCounts.due_soon,
      icon: CalendarClock,
      tone: "amber",
    },
    {
      filter: "valid",
      label: "Regulares",
      detail: "ASO válido",
      value: asoCounts.valid,
      icon: CircleCheckBig,
      tone: "green",
    },
    {
      filter: "missing",
      label: "Sem data",
      detail: "ASO não informado",
      value: asoCounts.missing,
      icon: CalendarX2,
      tone: "slate",
    },
  ];

  const collaboratorPageCount = Math.max(
    1,
    Math.ceil(filtered.length / COLLABORATOR_PAGE_SIZE),
  );
  const visibleCollaborators = filtered.slice(
    (collaboratorPage - 1) * COLLABORATOR_PAGE_SIZE,
    collaboratorPage * COLLABORATOR_PAGE_SIZE,
  );
  const collaboratorStart = filtered.length
    ? (collaboratorPage - 1) * COLLABORATOR_PAGE_SIZE + 1
    : 0;
  const collaboratorEnd = Math.min(
    collaboratorPage * COLLABORATOR_PAGE_SIZE,
    filtered.length,
  );

  useEffect(() => {
    setCollaboratorPage(1);
  }, [asoFilter, query]);

  useEffect(() => {
    setCollaboratorPage((current) => Math.min(current, collaboratorPageCount));
  }, [collaboratorPageCount]);

  function edit(person) {
    setEditingId(person.id);
    setEditForm({
      full_name: person.full_name || "",
      cpf: person.cpf || "",
      city: person.city || "",
      next_aso_date: person.next_aso_date || "",
    });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setError("");
  }

  function toggleCreate() {
    setShowCreate((current) => !current);
    setEditingId(null);
    setEditForm(null);
    setError("");
    setMessage("");
  }

  async function createCollaborator(event) {
    event.preventDefault();
    const cpf = cpfDigits(createForm.cpf);
    if (!createForm.full_name.trim() || cpf.length !== 11) {
      setError("Informe o nome e um CPF com 11 dígitos.");
      return;
    }
    setCreating(true);
    setError("");
    setMessage("");
    const { data, error: createError } = await supabase
      .from("collaborators")
      .insert({
        external_id: `portal:${cpf}`,
        full_name: createForm.full_name.trim().toUpperCase(),
        cpf,
        city: createForm.city.trim().toUpperCase() || null,
        next_aso_date: createForm.next_aso_date || null,
        active: true,
      })
      .select("id,full_name,cpf,city,next_aso_date,active")
      .single();
    setCreating(false);
    if (createError) {
      setError(
        createError.code === "23505"
          ? "Este CPF já está cadastrado. Localize o colaborador pela busca."
          : errorMessage(createError),
      );
      return;
    }
    setCollaborators((current) =>
      [...current, data].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "pt-BR"),
      ),
    );
    setCreateForm(EMPTY_COLLABORATOR_FORM);
    setShowCreate(false);
    setAsoFilter("all");
    setQuery("");
    setCollaboratorPage(1);
    setMessage(
      "Colaborador cadastrado e disponível para vinculação aos casos.",
    );
  }

  async function saveCollaborator(event) {
    event.preventDefault();
    const cpf = cpfDigits(editForm.cpf);
    if (!editForm.full_name.trim() || cpf.length !== 11) {
      setError("Informe o nome e um CPF com 11 dígitos.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    const payload = {
      full_name: editForm.full_name.trim().toUpperCase(),
      cpf,
      city: editForm.city.trim().toUpperCase() || null,
      next_aso_date: editForm.next_aso_date || null,
    };
    const { data, error: saveError } = await supabase
      .from("collaborators")
      .update(payload)
      .eq("id", editingId)
      .select("id,full_name,cpf,city,next_aso_date,active")
      .single();
    setSaving(false);
    if (saveError) {
      setError(
        saveError.code === "23505"
          ? "Este CPF já pertence a outro colaborador."
          : errorMessage(saveError),
      );
      return;
    }
    setCollaborators((current) =>
      current
        .map((person) => (person.id === data.id ? data : person))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR")),
    );
    setEditingId(null);
    setEditForm(null);
    setMessage("Dados do colaborador atualizados e registrados na auditoria.");
  }

  function changeCollaboratorPage(nextPage) {
    setCollaboratorPage(Math.min(Math.max(nextPage, 1), collaboratorPageCount));
    setEditingId(null);
    setEditForm(null);
  }

  return (
    <AppShell contentClassName="collaborators-page">
      <PageHeader
        className="collaborators-header"
        title="Colaboradores"
        description="Base de colaboradores restrita à operação EQS."
        action={
          <button
            type="button"
            className="button primary"
            onClick={toggleCreate}
            aria-expanded={showCreate}
          >
            {showCreate ? <X size={18} /> : <Plus size={18} />}
            {showCreate ? "Fechar cadastro" : "Novo colaborador"}
          </button>
        }
      />

      {showCreate && (
        <section className="collaborator-create-panel">
          <header className="collaborator-form-heading">
            <span className="collaborator-form-icon">
              <UserPlus size={19} />
            </span>
            <div>
              <h2>Novo colaborador</h2>
              <p>Novo registro na base operacional EQS.</p>
            </div>
          </header>
          <form
            className="collaborator-form-grid"
            onSubmit={createCollaborator}
          >
            <label>
              Nome
              <input
                value={createForm.full_name}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    full_name: event.target.value,
                  })
                }
                autoFocus
                required
              />
            </label>
            <label>
              CPF
              <input
                value={formatCpf(createForm.cpf)}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    cpf: cpfDigits(event.target.value),
                  })
                }
                inputMode="numeric"
                required
              />
            </label>
            <label>
              Cidade de atuação
              <input
                value={createForm.city}
                onChange={(event) =>
                  setCreateForm({ ...createForm, city: event.target.value })
                }
              />
            </label>
            <label>
              Data do próximo ASO
              <input
                type="date"
                value={createForm.next_aso_date}
                onChange={(event) =>
                  setCreateForm({
                    ...createForm,
                    next_aso_date: event.target.value,
                  })
                }
              />
            </label>
            <div className="collaborator-form-actions">
              <button
                type="button"
                className="button secondary"
                onClick={toggleCreate}
                disabled={creating}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={creating}>
                <Check size={17} />
                {creating ? "Cadastrando..." : "Cadastrar colaborador"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section
        className="collaborator-metrics"
        aria-label="Filtrar colaboradores pela validade do ASO"
      >
        {metrics.map(({ filter, label, detail, value, icon: Icon, tone }) => (
          <button
            type="button"
            className={`collaborator-metric tone-${tone} ${
              asoFilter === filter ? "active" : ""
            }`}
            onClick={() => setAsoFilter(filter)}
            aria-pressed={asoFilter === filter}
            key={filter}
          >
            <span className="collaborator-metric-icon">
              <Icon size={20} />
            </span>
            <span className="collaborator-metric-copy">
              <strong>{value}</strong>
              <span>{label}</span>
              <small>{detail}</small>
            </span>
          </button>
        ))}
      </section>

      <section className="collaborator-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, CPF ou cidade"
          />
        </label>
        <span className="result-count">
          {filtered.length}{" "}
          {filtered.length === 1 ? "colaborador" : "colaboradores"}
        </span>
      </section>
      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert>{message}</Alert>}
      {loading ? (
        <Loading />
      ) : (
        <section className="collaborator-directory">
          <div className="collaborator-head">
            <span>Colaborador</span>
            <span>CPF</span>
            <span>Cidade de atuação</span>
            <span>Próximo ASO</span>
            <span>Status</span>
            <span>Ações</span>
          </div>
          {visibleCollaborators.map((person) => {
            const editing = editingId === person.id;
            const category = asoCategory(person.next_aso_date);
            return (
              <article
                className={`collaborator-entry ${editing ? "editing" : ""}`}
                key={person.id}
              >
                <div className="collaborator-line">
                  <span className="collaborator-identity">
                    <span
                      className={`collaborator-avatar status-${category}`}
                      aria-hidden="true"
                    >
                      {initialsFor(person.full_name)}
                    </span>
                    <strong>{person.full_name}</strong>
                  </span>
                  <span className="cpf-value">{formatCpf(person.cpf)}</span>
                  <span>{person.city || "Não informada"}</span>
                  <time dateTime={person.next_aso_date || undefined}>
                    {formatDateOnly(person.next_aso_date)}
                  </time>
                  <AsoBadge value={person.next_aso_date} compact />
                  <button
                    type="button"
                    className="icon-button edit-collaborator"
                    onClick={() => (editing ? cancelEdit() : edit(person))}
                    title={editing ? "Fechar edição" : "Editar colaborador"}
                    aria-label={
                      editing
                        ? `Fechar edição de ${person.full_name}`
                        : `Editar ${person.full_name}`
                    }
                  >
                    {editing ? <X size={18} /> : <Pencil size={17} />}
                  </button>
                </div>
                {editing && editForm && (
                  <form
                    className="collaborator-edit-form"
                    onSubmit={saveCollaborator}
                  >
                    <header className="collaborator-edit-heading">
                      <strong>Editar colaborador</strong>
                      <span>{formatCpf(editForm.cpf)}</span>
                    </header>
                    <label>
                      Nome
                      <input
                        value={editForm.full_name}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            full_name: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      CPF
                      <input
                        value={formatCpf(editForm.cpf)}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            cpf: cpfDigits(event.target.value),
                          })
                        }
                        inputMode="numeric"
                        required
                      />
                    </label>
                    <label>
                      Cidade de atuação
                      <input
                        value={editForm.city}
                        onChange={(event) =>
                          setEditForm({ ...editForm, city: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Data do próximo ASO
                      <input
                        type="date"
                        value={editForm.next_aso_date}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            next_aso_date: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="collaborator-edit-actions">
                      <button
                        type="button"
                        className="button secondary"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                      <button className="button primary" disabled={saving}>
                        <Check size={17} />
                        {saving ? "Salvando..." : "Salvar alterações"}
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
          {!filtered.length && (
            <Empty
              title="Nenhum colaborador encontrado"
              text="Revise o nome, CPF ou cidade pesquisada."
            />
          )}
          {!!filtered.length && (
            <footer className="collaborator-directory-footer">
              <span>
                Mostrando {collaboratorStart} a {collaboratorEnd} de{" "}
                {filtered.length} colaboradores
              </span>
              <nav
                className="case-pagination"
                aria-label="Paginação dos colaboradores"
              >
                <button
                  type="button"
                  onClick={() => changeCollaboratorPage(collaboratorPage - 1)}
                  disabled={collaboratorPage === 1}
                  aria-label="Página anterior"
                  title="Página anterior"
                >
                  <ChevronLeft size={16} />
                </button>
                {paginationItems(collaboratorPageCount, collaboratorPage).map(
                  (page) =>
                    typeof page === "number" ? (
                      <button
                        type="button"
                        className={page === collaboratorPage ? "active" : ""}
                        onClick={() => changeCollaboratorPage(page)}
                        aria-current={
                          page === collaboratorPage ? "page" : undefined
                        }
                        aria-label={`Página ${page}`}
                        key={page}
                      >
                        {page}
                      </button>
                    ) : (
                      <span className="case-pagination-ellipsis" key={page}>
                        …
                      </span>
                    ),
                )}
                <button
                  type="button"
                  onClick={() => changeCollaboratorPage(collaboratorPage + 1)}
                  disabled={collaboratorPage === collaboratorPageCount}
                  aria-label="Próxima página"
                  title="Próxima página"
                >
                  <ChevronRight size={16} />
                </button>
              </nav>
            </footer>
          )}
        </section>
      )}
    </AppShell>
  );
}

export default function App() {
  if (!isConfigured) return <SetupRequired />;
  return (
    <AuthProvider>
      <PortalRouteTransitionProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/casos"
            element={
              <Protected>
                <CasesPage />
              </Protected>
            }
          />
          <Route
            path="/casos/:id"
            element={
              <Protected>
                <CaseDetailPage />
              </Protected>
            }
          />
          <Route
            path="/novo"
            element={
              <Protected operationOnly>
                <NewCasePage />
              </Protected>
            }
          />
          <Route
            path="/sites"
            element={
              <Protected>
                <SitesPage />
              </Protected>
            }
          />
          <Route
            path="/mapa-sites"
            element={
              <Protected>
                <SitesMapRoute />
              </Protected>
            }
          />
          <Route
            path="/colaboradores"
            element={
              <Protected operationOnly>
                <CollaboratorsPage />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/casos" replace />} />
        </Routes>
      </PortalRouteTransitionProvider>
    </AuthProvider>
  );
}
