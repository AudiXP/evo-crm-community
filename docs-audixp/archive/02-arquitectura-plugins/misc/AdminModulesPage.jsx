import { useState, useEffect } from "react";

// ─── Mock data — en producción viene de /api/v1/modules ───────────────────────
const MOCK_MODULES = [
  {
    id: "mi_modulo_personalizado",
    name: "Mi Módulo Personalizado",
    description: "Inyecta acciones en la interfaz de conversaciones y expone una vista de reporte propio.",
    version: "1.1.0",
    author: "AudiXP",
    slots: ["header.right", "sidebar.afterMain"],
    routes: ["/mi-reporte"],
    active: true,
    status: "ok",          // "ok" | "missing_deps" | "error"
    deps: ["core_conversations"],
    depsOk: true,
  },
  {
    id: "analytics_widget",
    name: "Analytics Widget",
    description: "Panel de métricas avanzadas en el dashboard. Requiere que el módulo de reportes base esté activo.",
    version: "0.9.2",
    author: "AudiXP",
    slots: ["dashboard.widgets"],
    routes: [],
    active: false,
    status: "missing_deps",
    deps: ["reporting_base"],
    depsOk: false,
  },
  {
    id: "whatsapp_quick_reply",
    name: "WhatsApp Quick Reply",
    description: "Respuestas rápidas predefinidas inyectadas en el panel de conversación activa.",
    version: "2.0.1",
    author: "AudiXP",
    slots: ["header.right"],
    routes: [],
    active: false,
    status: "ok",
    deps: [],
    depsOk: true,
  },
  {
    id: "contact_enrichment",
    name: "Contact Enrichment",
    description: "Enriquece perfiles de contacto con datos externos vía API proxy seguro en Rails.",
    version: "1.0.0",
    author: "AudiXP",
    slots: ["sidebar.afterMain"],
    routes: ["/admin/enrichment-settings"],
    active: true,
    status: "ok",
    deps: [],
    depsOk: true,
  },
];

// ─── Slot badge color map ─────────────────────────────────────────────────────
const SLOT_COLORS = {
  "header.right":      { bg: "rgba(0,255,167,0.12)",  text: "#00ffa7" },
  "header.left":       { bg: "rgba(0,255,167,0.12)",  text: "#00ffa7" },
  "sidebar.afterMain": { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  "dashboard.widgets": { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
  "notifications.banner": { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
};

// ─── Icons (inline SVG, sin dependencias externas) ───────────────────────────
const IconPlug = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
    <rect x="7" y="2" width="10" height="8" rx="2"/>
    <path d="M7 6H4m13 0h3"/>
  </svg>
);
const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconAlert = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconRefresh = ({ size = 14, spin = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={spin ? { animation: "spin 1s linear infinite" } : {}}>
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.28-3.61"/>
  </svg>
);
const IconCode = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconRoute = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>
  </svg>
);
const IconSearch = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ─── Toggle Switch ────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      position: "relative",
      width: 44,
      height: 24,
      borderRadius: 12,
      border: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      background: checked ? "#00ffa7" : "rgba(255,255,255,0.1)",
      transition: "background 0.22s",
      flexShrink: 0,
      opacity: disabled ? 0.45 : 1,
      outline: "none",
    }}
  >
    <span style={{
      position: "absolute",
      top: 3,
      left: checked ? 23 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: checked ? "#0b0f14" : "rgba(255,255,255,0.6)",
      transition: "left 0.22s",
      boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    }}/>
  </button>
);

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status, depsOk }) => {
  if (status === "missing_deps") return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
      color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.25)",
      borderRadius:6, padding:"2px 8px" }}>
      <IconAlert size={11}/> Dependencias faltantes
    </span>
  );
  if (status === "error") return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
      color:"#f87171", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)",
      borderRadius:6, padding:"2px 8px" }}>
      <IconAlert size={11}/> Error
    </span>
  );
  return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
      color:"#4ade80", background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)",
      borderRadius:6, padding:"2px 8px" }}>
      <IconCheck size={11}/> Listo
    </span>
  );
};

// ─── Slot Tag ────────────────────────────────────────────────────────────────
const SlotTag = ({ slot }) => {
  const c = SLOT_COLORS[slot] || { bg:"rgba(255,255,255,0.07)", text:"rgba(255,255,255,0.5)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:600,
      color: c.text, background: c.bg, borderRadius:5, padding:"2px 7px",
      letterSpacing:"0.02em", textTransform:"uppercase" }}>
      <IconCode size={10}/>{slot}
    </span>
  );
};

// ─── Module Card ─────────────────────────────────────────────────────────────
const ModuleCard = ({ mod, onToggle, toggling }) => {
  const isToggling = toggling === mod.id;
  const canActivate = mod.depsOk;

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${mod.active ? "rgba(0,255,167,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 12,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      transition: "border-color 0.25s, box-shadow 0.25s",
      boxShadow: mod.active ? "0 0 0 1px rgba(0,255,167,0.05) inset" : "none",
    }}>
      {/* Header row */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontSize:15, fontWeight:700, color:"#e6f1ec", letterSpacing:"-0.01em" }}>
              {mod.name}
            </span>
            <span style={{ fontSize:10, color:"rgba(230,241,236,0.3)", fontFamily:"monospace",
              background:"rgba(255,255,255,0.05)", borderRadius:4, padding:"1px 6px" }}>
              v{mod.version}
            </span>
          </div>
          <p style={{ margin:0, fontSize:13, color:"rgba(230,241,236,0.5)", lineHeight:1.55 }}>
            {mod.description}
          </p>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
          <Toggle
            checked={mod.active}
            disabled={!canActivate || isToggling}
            onChange={(val) => onToggle(mod.id, val)}
          />
          {isToggling && (
            <span style={{ color:"rgba(230,241,236,0.35)", animation:"spin 1s linear infinite" }}>
              <IconRefresh size={13} spin/>
            </span>
          )}
        </div>
      </div>

      {/* Status + author row */}
      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <StatusBadge status={mod.active ? "ok" : mod.status} depsOk={mod.depsOk}/>
        <span style={{ fontSize:11, color:"rgba(230,241,236,0.3)" }}>
          por {mod.author}
        </span>
        {!mod.depsOk && (
          <span style={{ fontSize:11, color:"#fbbf24", marginLeft:"auto" }}>
            Requiere: {mod.deps.join(", ")}
          </span>
        )}
      </div>

      {/* Slots + routes */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingTop:2, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        {mod.slots.map(s => <SlotTag key={s} slot={s}/>)}
        {mod.routes.map(r => (
          <span key={r} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10,
            fontWeight:500, color:"rgba(230,241,236,0.35)", background:"rgba(255,255,255,0.04)",
            borderRadius:5, padding:"2px 7px", letterSpacing:"0.01em" }}>
            <IconRoute size={10}/>{r}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminModulesPage() {
  const [modules, setModules] = useState(MOCK_MODULES);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "active" | "inactive"
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = async (id, nextValue) => {
    setToggling(id);
    // Simula llamada a /api/v1/modules/:id/toggle
    await new Promise(r => setTimeout(r, 700));
    setModules(prev => prev.map(m => m.id === id ? { ...m, active: nextValue } : m));
    setToggling(null);
    const mod = modules.find(m => m.id === id);
    showToast(
      nextValue ? `${mod.name} activado` : `${mod.name} desactivado`,
      nextValue ? "ok" : "off"
    );
  };

  const active = modules.filter(m => m.active).length;
  const withIssues = modules.filter(m => !m.depsOk).length;

  const filtered = modules.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "active" ? m.active : !m.active);
    return matchSearch && matchFilter;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b0f14",
      color: "#e6f1ec",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "0",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: rgba(230,241,236,0.25); }
        input:focus { outline: none; border-color: rgba(0,255,167,0.4) !important; }
        button { font-family: inherit; }
      `}</style>

      {/* ── Header ─────────────────────────────────────── */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "28px 32px 20px",
        background: "rgba(255,255,255,0.015)",
      }}>
        <div style={{ maxWidth: 860, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <span style={{ color:"#00ffa7", opacity:0.8 }}>
              <IconPlug size={20} color="#00ffa7"/>
            </span>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, letterSpacing:"-0.02em" }}>
              Módulos
            </h1>
          </div>
          <p style={{ margin:0, fontSize:13, color:"rgba(230,241,236,0.4)", maxWidth:500 }}>
            Activa o desactiva extensiones instaladas en esta instancia. Los cambios aplican en el próximo refresh de la app.
          </p>

          {/* Stats row */}
          <div style={{ display:"flex", gap:24, marginTop:20 }}>
            {[
              { label:"Total instalados", value: modules.length },
              { label:"Activos", value: active, accent:"#00ffa7" },
              { label:"Con problemas", value: withIssues, accent: withIssues > 0 ? "#fbbf24" : undefined },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", flexDirection:"column", gap:2 }}>
                <span style={{ fontSize:22, fontWeight:700, color: s.accent || "#e6f1ec", letterSpacing:"-0.03em" }}>
                  {s.value}
                </span>
                <span style={{ fontSize:11, color:"rgba(230,241,236,0.35)", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────── */}
      <div style={{ padding:"16px 32px", maxWidth:860, margin:"0 auto" }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          {/* Search */}
          <div style={{ position:"relative", flex:1, minWidth:200 }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)",
              color:"rgba(230,241,236,0.3)", pointerEvents:"none" }}>
              <IconSearch size={15}/>
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar módulos…"
              style={{
                width:"100%", padding:"9px 12px 9px 36px",
                background:"rgba(255,255,255,0.05)",
                border:"1px solid rgba(255,255,255,0.09)",
                borderRadius:8, fontSize:13, color:"#e6f1ec",
                transition:"border-color 0.2s",
              }}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:8, padding:3 }}>
            {[
              { key:"all",      label:"Todos" },
              { key:"active",   label:"Activos" },
              { key:"inactive", label:"Inactivos" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding:"6px 14px", fontSize:12, fontWeight:600, borderRadius:6,
                  border:"none", cursor:"pointer", transition:"all 0.15s",
                  background: filter === f.key ? "rgba(0,255,167,0.15)" : "transparent",
                  color: filter === f.key ? "#00ffa7" : "rgba(230,241,236,0.45)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Module list ────────────────────────────────── */}
      <div style={{ padding:"0 32px 40px", maxWidth:860, margin:"0 auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:"rgba(230,241,236,0.25)" }}>
            <IconSearch size={32}/>
            <p style={{ marginTop:12, fontSize:14 }}>Ningún módulo coincide con tu búsqueda.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(mod => (
              <ModuleCard
                key={mod.id}
                mod={mod}
                onToggle={handleToggle}
                toggling={toggling}
              />
            ))}
          </div>
        )}

        {/* Developer note */}
        <div style={{
          marginTop:32, padding:"14px 18px",
          background:"rgba(0,255,167,0.04)",
          border:"1px solid rgba(0,255,167,0.1)",
          borderRadius:10, fontSize:12,
          color:"rgba(230,241,236,0.4)", lineHeight:1.7,
        }}>
          <span style={{ color:"#00ffa7", fontWeight:600 }}>Nota para desarrolladores:</span>{" "}
          Esta página llama a <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4 }}>/api/v1/modules</code> para leer el estado
          y a <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4 }}>/api/v1/modules/:id/toggle</code> para activar/desactivar.
          Los módulos se registran en Rails con <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4 }}>SystemModule</code> y en el frontend
          con <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4 }}>registerPlugin()</code> de <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4 }}>@evoai/extension-points</code>.
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:"fixed", bottom:28, right:28,
          background: toast.type === "ok" ? "rgba(0,255,167,0.12)" : "rgba(255,255,255,0.07)",
          border: `1px solid ${toast.type === "ok" ? "rgba(0,255,167,0.35)" : "rgba(255,255,255,0.15)"}`,
          borderRadius:10, padding:"12px 18px",
          fontSize:13, fontWeight:500,
          color: toast.type === "ok" ? "#00ffa7" : "#e6f1ec",
          backdropFilter:"blur(8px)",
          animation:"slideIn 0.2s ease-out",
          zIndex:999, display:"flex", alignItems:"center", gap:8,
          boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast.type === "ok" ? <IconCheck size={15}/> : null}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
