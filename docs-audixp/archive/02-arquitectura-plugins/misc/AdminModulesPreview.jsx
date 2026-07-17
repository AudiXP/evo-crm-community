import { useState } from "react";

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
    status: "ok",
    deps: [],
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

const SLOT_COLORS = {
  "header.right":      { bg: "rgba(0,255,167,0.12)",  text: "#00ffa7" },
  "header.left":       { bg: "rgba(0,255,167,0.12)",  text: "#00ffa7" },
  "sidebar.afterMain": { bg: "rgba(99,102,241,0.15)", text: "#818cf8" },
  "dashboard.widgets": { bg: "rgba(251,191,36,0.12)", text: "#fbbf24" },
  "notifications.banner": { bg: "rgba(239,68,68,0.12)", text: "#f87171" },
};

const IconPlug = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#00ffa7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
    <rect x="7" y="2" width="10" height="8" rx="2"/><path d="M7 6H4m13 0h3"/>
  </svg>
);
const IconCheck = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconAlert = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconSearch = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconCode = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);
const IconRoute = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>
  </svg>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    role="switch" aria-checked={checked} disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    style={{
      position:"relative", width:44, height:24, borderRadius:12, border:"none",
      cursor: disabled ? "not-allowed" : "pointer",
      background: checked ? "#00ffa7" : "rgba(255,255,255,0.1)",
      transition:"background 0.22s", flexShrink:0,
      opacity: disabled ? 0.4 : 1, outline:"none",
    }}
  >
    <span style={{
      position:"absolute", top:3, left: checked ? 23 : 3,
      width:18, height:18, borderRadius:"50%",
      background: checked ? "#0b0f14" : "rgba(255,255,255,0.55)",
      transition:"left 0.22s", boxShadow:"0 1px 3px rgba(0,0,0,0.4)",
    }}/>
  </button>
);

const SlotTag = ({ slot }) => {
  const c = SLOT_COLORS[slot] || { bg:"rgba(255,255,255,0.07)", text:"rgba(255,255,255,0.4)" };
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:9.5, fontWeight:700,
      color:c.text, background:c.bg, borderRadius:5, padding:"2px 7px",
      letterSpacing:"0.04em", textTransform:"uppercase" }}>
      <IconCode/>{slot}
    </span>
  );
};

const StatusPill = ({ mod }) => {
  if (!mod.depsOk) return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
      color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)",
      borderRadius:6, padding:"2px 8px" }}>
      <IconAlert size={11}/> Dependencias faltantes
    </span>
  );
  return (
    <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600,
      color:"#4ade80", background:"rgba(74,222,128,0.07)", border:"1px solid rgba(74,222,128,0.18)",
      borderRadius:6, padding:"2px 8px" }}>
      <IconCheck size={11}/> Listo
    </span>
  );
};

const ModuleCard = ({ mod, onToggle, toggling }) => {
  const isToggling = toggling === mod.id;
  return (
    <div style={{
      background:"rgba(255,255,255,0.03)",
      border:`1px solid ${mod.active ? "rgba(0,255,167,0.22)" : "rgba(255,255,255,0.07)"}`,
      borderRadius:12, padding:"18px 20px",
      display:"flex", flexDirection:"column", gap:12,
      transition:"border-color 0.25s",
      boxShadow: mod.active ? "0 0 0 1px rgba(0,255,167,0.04) inset" : "none",
    }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:5, flexWrap:"wrap" }}>
            <span style={{ fontSize:14, fontWeight:700, color:"#e6f1ec", letterSpacing:"-0.01em" }}>
              {mod.name}
            </span>
            <span style={{ fontSize:10, color:"rgba(230,241,236,0.3)", fontFamily:"monospace",
              background:"rgba(255,255,255,0.05)", borderRadius:4, padding:"1px 6px" }}>
              v{mod.version}
            </span>
          </div>
          <p style={{ margin:0, fontSize:12.5, color:"rgba(230,241,236,0.45)", lineHeight:1.55 }}>
            {mod.description}
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          {isToggling && (
            <span style={{ fontSize:11, color:"rgba(230,241,236,0.3)",
              animation:"spin 0.8s linear infinite", display:"inline-block" }}>↻</span>
          )}
          <Toggle checked={mod.active} disabled={!mod.depsOk || isToggling} onChange={v => onToggle(mod.id, v)}/>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <StatusPill mod={mod}/>
        <span style={{ fontSize:11, color:"rgba(230,241,236,0.28)" }}>por {mod.author}</span>
        {!mod.depsOk && (
          <span style={{ fontSize:11, color:"#fbbf24", marginLeft:"auto" }}>
            Requiere: {mod.deps.join(", ")}
          </span>
        )}
      </div>

      <div style={{ display:"flex", gap:5, flexWrap:"wrap", paddingTop:8,
        borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        {mod.slots.map(s => <SlotTag key={s} slot={s}/>)}
        {mod.routes.map(r => (
          <span key={r} style={{ display:"inline-flex", alignItems:"center", gap:3, fontSize:9.5,
            fontWeight:500, color:"rgba(230,241,236,0.3)", background:"rgba(255,255,255,0.04)",
            borderRadius:5, padding:"2px 7px" }}>
            <IconRoute/>{r}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function AdminModulesPage() {
  const [modules, setModules] = useState(MOCK_MODULES);
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleToggle = async (id, nextVal) => {
    setToggling(id);
    await new Promise(r => setTimeout(r, 650));
    setModules(prev => prev.map(m => m.id === id ? { ...m, active: nextVal } : m));
    setToggling(null);
    const mod = modules.find(m => m.id === id);
    showToast(nextVal ? `${mod.name} activado` : `${mod.name} desactivado`, nextVal ? "ok" : "off");
  };

  const active = modules.filter(m => m.active).length;
  const issues = modules.filter(m => !m.depsOk).length;

  const filtered = modules.filter(m => {
    const q = search.toLowerCase();
    const matchQ = m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q);
    const matchF = filter === "all" || (filter === "active" ? m.active : !m.active);
    return matchQ && matchF;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#0b0f14", color:"#e6f1ec",
      fontFamily:"Inter, system-ui, sans-serif" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input { font-family: inherit; }
        input:focus { outline:none; }
        button { font-family: inherit; }
        input::placeholder { color: rgba(230,241,236,0.22); }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.06)",
        padding:"24px 28px 18px", background:"rgba(255,255,255,0.015)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:3 }}>
          <IconPlug/>
          <h1 style={{ margin:0, fontSize:18, fontWeight:700, letterSpacing:"-0.02em" }}>Módulos</h1>
        </div>
        <p style={{ margin:"0 0 18px", fontSize:12.5, color:"rgba(230,241,236,0.38)", maxWidth:480 }}>
          Activa o desactiva extensiones instaladas. Los cambios aplican en el próximo refresh.
        </p>
        <div style={{ display:"flex", gap:28 }}>
          {[
            { label:"Instalados", value: modules.length, color:"#e6f1ec" },
            { label:"Activos",    value: active,          color:"#00ffa7" },
            { label:"Con problemas", value: issues,       color: issues > 0 ? "#fbbf24" : "rgba(230,241,236,0.3)" },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize:24, fontWeight:800, color:s.color, letterSpacing:"-0.04em", lineHeight:1 }}>
                {s.value}
              </div>
              <div style={{ fontSize:10, color:"rgba(230,241,236,0.3)", textTransform:"uppercase",
                letterSpacing:"0.06em", marginTop:3 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding:"14px 28px 10px" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ position:"relative", flex:1, minWidth:180 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)",
              color:"rgba(230,241,236,0.28)", pointerEvents:"none" }}>
              <IconSearch/>
            </span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar módulos…"
              style={{ width:"100%", padding:"8px 12px 8px 32px",
                background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
                borderRadius:8, fontSize:12.5, color:"#e6f1ec",
                transition:"border-color 0.2s" }}/>
          </div>
          <div style={{ display:"flex", background:"rgba(255,255,255,0.05)", borderRadius:8, padding:3, gap:2 }}>
            {[["all","Todos"],["active","Activos"],["inactive","Inactivos"]].map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ padding:"5px 12px", fontSize:11.5, fontWeight:600, borderRadius:6,
                  border:"none", cursor:"pointer", transition:"all 0.15s",
                  background: filter === k ? "rgba(0,255,167,0.14)" : "transparent",
                  color: filter === k ? "#00ffa7" : "rgba(230,241,236,0.4)" }}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ padding:"4px 28px 40px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"50px 20px", color:"rgba(230,241,236,0.22)" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
            <p style={{ fontSize:13 }}>Ningún módulo coincide.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map(mod => (
              <ModuleCard key={mod.id} mod={mod} onToggle={handleToggle} toggling={toggling}/>
            ))}
          </div>
        )}

        {/* Dev note */}
        <div style={{ marginTop:28, padding:"12px 16px",
          background:"rgba(0,255,167,0.03)", border:"1px solid rgba(0,255,167,0.09)",
          borderRadius:10, fontSize:11.5, color:"rgba(230,241,236,0.35)", lineHeight:1.7 }}>
          <span style={{ color:"#00ffa7", fontWeight:600 }}>Dev:</span>{" "}
          Lee el estado desde{" "}
          <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4,
            fontSize:11 }}>/api/v1/modules</code>
          {" "}· Activa/desactiva con{" "}
          <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4,
            fontSize:11 }}>/api/v1/modules/:id/toggle</code>
          {" "}· Se registra en frontend con{" "}
          <code style={{ background:"rgba(255,255,255,0.07)", padding:"1px 5px", borderRadius:4,
            fontSize:11 }}>registerPlugin()</code>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, zIndex:999,
          background: toast.type === "ok" ? "rgba(0,255,167,0.11)" : "rgba(255,255,255,0.07)",
          border:`1px solid ${toast.type === "ok" ? "rgba(0,255,167,0.3)" : "rgba(255,255,255,0.13)"}`,
          borderRadius:10, padding:"11px 16px",
          fontSize:13, fontWeight:500,
          color: toast.type === "ok" ? "#00ffa7" : "#e6f1ec",
          backdropFilter:"blur(8px)", animation:"slideUp 0.2s ease-out",
          display:"flex", alignItems:"center", gap:7,
          boxShadow:"0 8px 32px rgba(0,0,0,0.45)" }}>
          {toast.type === "ok" && <IconCheck size={14}/>}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
