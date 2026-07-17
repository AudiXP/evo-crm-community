# Guia Definitiva (CORREGIDA): Implementar Modulos en Evo CRM Community

**Repositorio:** evolution-foundation/evo-crm-community
**Contrato frontend real:** @/plugin-host (codigo local en evo-ai-frontend-community, NO un paquete @evoai/extension-points externo)
**Stack real:** React 19 - TypeScript - Vite - microservicios (Go/Node: evo-ai-core-service, evo-auth-service, evo-nexus) - NO hay Ruby on Rails en este monorepo
**Version:** 3.1.0-corr (correccion de AudiXP sobre v3.1.0)
**Autor original:** AudiXP

> AVISO: esta version corregida se verifico leyendo src/plugin-host/* directamente. La v3.1.0 original tiene 4 discrepancias con el repo real.

---

## 1. Introduccion

El frontend ya incluye un sistema de plugins local: @/plugin-host. El objetivo es aislar codigo propio en src/extensions/, aprovechar PluginErrorBoundary y controlar activacion sin tocar el core.

> Regla de oro: lo que @/plugin-host cubre -> usar sus APIs. Lo que no cubre (activacion en DB, credenciales) -> capa backend propia (ver seccion 6, reescrita para el backend real).

---

## 2. El Problema que Resuelve

- Merge conflicts al sincronizar upstream -> codigo en src/extensions/.
- Inestabilidad -> PluginErrorBoundary aislado por plugin.
- Falta de control comercial -> activacion via backend (microservicio, NO Rails).

---

## 3. Lo que el Contrato Real Ya Provee (No Reinventar)

Todo existe en src/plugin-host/ y se importa desde '@/plugin-host':

| API | Archivo | Que hace |
|---|---|---|
| registerPlugin(manifest) | registry.ts | Registra plugin. Idempotente por id (duplicado -> console.warn, se ignora). |
| PluginSlot | PluginSlot.tsx | Renderiza contribuciones; envuelve cada una en PluginErrorBoundary. |
| PluginRoutes({ namespace }) | PluginRoutes.tsx | Devuelve <Route> para inyectar en el router (usar como funcion, no JSX). |
| PluginHostProvider | PluginHostProvider.tsx | Monta providers y llama bootAllPlugins() en useEffect. |
| PluginErrorBoundary | PluginErrorBoundary.tsx | Aisla crashes de slots/rutas. |
| usePluginRuntimeContext() | runtimeContext.ts | Lee el runtimeContext compartido. |
| onRuntimeContextChanged(cb) | runtimeContext.ts | Suscribe a cambios (bus EventTarget en memoria). |
| evaluateRouteAccess(args) | guards.ts | Evalua guards registrados. |

### 3.1 Slot IDs REALES (src/plugin-host/types.ts)

- app.providers
- header.left
- header.right
- sidebar.afterMain
- admin.nav
- admin.routes
- settings.sections
- dashboard.widgets
- notifications.banner
- setup.steps

| Slot ID | Montado en core (verificado) |
|---|---|
| header.right | SI Header.tsx (lineas 220, 276) |
| sidebar.afterMain | SI Sidebar.tsx (linea 203) |
| header.left | Tipo existe; la v3.1.0 original decia "no existe" por error -> SI existe |
| notifications.banner | Tipo existe |
| dashboard.widgets | Tipo existe (reservado) |
| settings.sections | Tipo existe (reservado) |
| admin.nav | Tipo existe |
| admin.routes | Tipo existe |
| app.providers | Tipo existe |
| setup.steps | Tipo existe |

> Los slots inventados del doc original (chat_actions, sidebar_menu, contact_profile) NO existen. Para inyectar en el composer de chat (donde hoy vive RegistrarPagoExtension), el slot oficial mas cercano es header.right o seguir montando el componente en MessageInput.tsx hasta que exista un slot chat.*.

### 3.2 Lo que el contrato maneja automaticamente

- Error boundaries: cada contribucion se envuelve en PluginErrorBoundary. No construir manual.
- Deny-by-default en rutas: evaluateRouteAccess -> si no hay guards y la ruta declara requiredCapability/requiredRole, deniega.
- Routing: PluginRoutes({ namespace }) se splattea dentro de <Routes> del core. Rutas deben registrarse ANTES de que el router monte.
- Orden de slots: por order ascendente.

### 3.3 Tipo PluginManifest REAL

interface PluginManifest {
  id: string;
  onBoot?: () => void;
  providers?: PluginProvider[];
  slots?: Partial<Record<SlotId, PluginSlotContribution[]>>;
  routes?: PluginRoute[];
  navItems?: PluginNavItem[];
  guard?: PluginGuard;
  runtimeContext?: PluginRuntimeContextDescriptor;  // MAXIMO UNO en todo el host (first-wins)
}

PluginSlotContribution { id: string; order?: number; component: ComponentType<PluginSlotComponentProps>; fallback?: ReactNode; }
PluginRoute { id; path; namespace?: 'admin'|'customer'|'public'; layout?: 'main'|'none'; element: () => Promise<{default: ComponentType}>; requiredCapability?; requiredRole?; fallback?; }
PluginNavItem { id; label; href; icon?; order?; }
PluginRuntimeContextDescriptor { Provider: ComponentType<{children}>; useValue: () => unknown; }

> CRITICO runtimeContext: el host resuelve el descriptor en registro y SOLO acepta el primero; registros posteriores se descartan con console.warn. Si varios modulos necesitan estado, usen su propio React context interno.

---

## 4. Estructura de Archivos

src/extensions/mi-modulo/
  index.ts                 # registerPlugin()
  manifest.ts              # PluginManifest
  components/HeaderAction.tsx
  pages/MiModuloPage.tsx
  pages/AdminModulosPage.tsx
  runtime/MiModuloProvider.tsx
  i18n/es.json
  i18n/pt-BR.json

Regla: el core nunca importa de src/extensions/ salvo la linea de registro (seccion 5.5).

---

## 5. Implementacion Paso a Paso

### 5.1 Provider de Runtime (React puro, consulta tu backend real)

Resuelve: bootstrapping seguro (isLoading: true inicial), propagacion (onRuntimeContextChanged en memoria; para entre clientes usa WS/SSE de tu backend), fallo silencioso.

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

interface MiModuloCtx { isActive: boolean; isLoading: boolean; userRole: 'account_owner' | 'agent'; }
const Ctx = createContext<MiModuloCtx | undefined>(undefined);
export const useMiModuloCtx = () => useContext(Ctx);

export function MiModuloProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MiModuloCtx>({ isActive: false, isLoading: true, userRole: 'agent' });
  useEffect(() => {
    axios.get('/api/v1/modules')
      .then(({ data }) => setState({ isActive: (data.active_modules ?? []).includes('mi_modulo'), userRole: data.current_user_role ?? 'agent', isLoading: false }))
      .catch(() => setState(s => ({ ...s, isLoading: false })));
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

Este provider es INTERNO del modulo. No es el runtimeContext del host (solo uno por host).

### 5.2 Manifiesto (API real)

import type { PluginManifest } from '@/plugin-host';
import { HeaderAction } from './components/HeaderAction';

export const MiModuloManifest: PluginManifest = {
  id: 'mi_modulo',
  onBoot: () => console.info('[MiModulo] inicializado'),
  slots: { 'header.right': [{ id: 'mi-modulo.action', order: 10, component: HeaderAction }] },
  routes: [
    { id: 'mi-modulo.vista', path: '/mi-modulo', namespace: 'customer', layout: 'main', element: () => import('./pages/MiModuloPage'), requiredCapability: 'mi-modulo.acceso', fallback: <div>Modulo no disponible</div> },
    { id: 'mi-modulo.admin', path: '/admin/mis-modulos', namespace: 'admin', layout: 'main', element: () => import('./pages/AdminModulosPage'), requiredRole: 'account_owner' },
  ],
  navItems: [{ id: 'mi-modulo.nav', label: 'Mi Modulo', href: '/mi-modulo', order: 50 }],
  guard: ({ requiredCapability, requiredRole, runtimeContext }) => {
    const ctx = runtimeContext as { isActive?: boolean; userRole?: string } | undefined;
    if (!ctx?.isActive) return false;
    if (requiredRole === 'account_owner') return ctx.userRole === 'account_owner';
    if (requiredCapability) return true;
    return !requiredCapability && !requiredRole;
  },
};

### 5.3 Componentes de Slot

import type { PluginSlotComponentProps } from '@/plugin-host';
import { useMiModuloCtx } from '../runtime/MiModuloProvider';

export function HeaderAction({ runtimeContext }: PluginSlotComponentProps) {
  const ctx = useMiModuloCtx();
  if (!ctx) return null;
  if (ctx.isLoading) return null;
  if (!ctx.isActive) return null;
  return <button onClick={() => fetch('/api/v1/mi_modulo/accion', { method: 'POST' })} className="...">Mi Accion</button>;
}

### 5.4 Entry Point

import { registerPlugin } from '@/plugin-host';
import i18n from 'i18next';
import { MiModuloManifest } from './manifest';
import es from './i18n/es.json';
import ptBR from './i18n/pt-BR.json';

i18n.addResourceBundle('es', 'mi-modulo', es, true, false);
i18n.addResourceBundle('pt-BR', 'mi-modulo', ptBR, true, false);
registerPlugin(MiModuloManifest);

### 5.5 Registro (CORREGIDO: NO es implicito en main.tsx)

La v3.1.0 decia poner import '@/extensions/mi-modulo' en main.tsx asumiendo que eso bastaba. En este repo main.tsx NO importa plugin-host ni extensions; el host se monta dentro de <App /> via PluginHostProvider, que llama bootAllPlugins() en useEffect. El import del modulo debe ejecutarse ANTES de que App monte -> importalo al inicio de src/main.tsx (antes de createRoot) o en App.tsx antes de <PluginHostProvider>.

// src/main.tsx (al inicio, antes de createRoot)
import '@/extensions/mi-modulo';
import { createRoot } from 'react-dom/client';

> PluginRoutes advierte: rutas deben registrarse antes del mount del router. El import temprano cumple esto. Hot-reload de rutas tras mount NO soportado en MVP.

---

## 6. Capa Backend (REESCRITO: NO hay Rails)

El contrato es stateless. Este monorepo NO usa Ruby on Rails (la seccion 6 de la v3.1.0 asume Rails/ActionCable/PostgreSQL que no estan aqui). La capa backend real son los microservicios del monorepo.

### 6.1 Endpoints a implementar en tu backend real
- GET /api/v1/modules -> { active_modules: string[], current_user_role: 'account_owner' | 'agent' }
- POST /api/v1/modules/:module_id/toggle -> solo admin
- PUT /api/v1/modules/:module_id/settings -> credenciales, solo admin
- POST /api/v1/mi_modulo/accion -> proxy seguro (frontend NUNCA llama a API de terceros directo)

### 6.2 Propagacion entre agentes (sin ActionCable)
El host solo emite runtimeContextChanged en memoria (mismo cliente). Para otros agentes usa WS/SSE de tu backend. Fallback: polling 30s en el provider.

useEffect(() => { const id = setInterval(refresh, 30_000); return () => clearInterval(id); }, []);

### 6.3 Seguridad
- Credenciales (token Teusa Track) en backend, nunca en import.meta.env si es secreto. Para Registrar Pago deployamos vars en stack Swarm (VITE_TEUSA_TRACK_API_URL/TOKEN) porque el frontend las consume directo; para ocultar el token, moverlo al proxy backend.
- GET /api/v1/modules nunca devuelve credenciales.

---

## 7. Pagina de Gestion de Modulos

Igual que v3.1.0 original (seccion 7), consumiendo tu backend real. Ruta del modulo (/admin/mis-modulos, requiredRole: 'account_owner'). MODULE_REGISTRY local lista metadatos; backend solo conoce IDs y estado.

---

## 8. Flujo de Activacion

Igual que v3.1.0 (seccion 8), reemplazando ActionCable por canal tiempo-real de tu backend (o polling 30s).

---

## 9. Reglas de Desarrollo (Checklist)

Codigo:
- Todo en src/extensions/mi-modulo/. Cero archivos fuera.
- Core solo importa el entry point. Puente = registerPlugin().
- TypeScript estricto.
- SlotId en lista real de seccion 3.1.

Registro:
- Importar modulo en main.tsx (o App.tsx antes de PluginHostProvider). main.tsx real NO lo hace solo.
- Rutas antes del mount del router.

runtimeContext:
- MAXIMO UN plugin puede registrar runtimeContext en todo el host (first-wins). Usa contexto React interno para estado propio.

Bootstrapping en slots:
- Tres guardas: !ctx -> ctx.isLoading -> !ctx.isActive.
- Sin spinner en header.right.

Backend:
- Endpoints en microservicio real (no Rails).
- Propagacion: WS/SSE de tu backend, o polling 30s fallback.

Seguridad:
- Credenciales en backend. Frontend via proxy.
- guard explicito; sin guard -> deny-by-default.

i18n:
- Namespace propio mi-modulo.*. No pisar auth, chat, contacts, agents, common.

Compatibilidad upstream:
- Riesgo de conflicto: linea de import en main.tsx (o App.tsx) y donde montes PluginRoutes.
- Rango: { "evoCommunityRange": ">=1.0.0-rc2 <2.0.0" }

---

## 10. Tabla de Equivalencias (v3.1.0 original -> Contrato REAL corregido)

| Concepto | v3.1.0 original | Contrato REAL @/plugin-host |
|---|---|---|
| Paquete | @evoai/extension-points ❌ | @/plugin-host (local) ✅ |
| ExtensionPoint.tsx | No construir | PluginSlot ✅ |
| ErrorBoundary manual | No construir | PluginErrorBoundary ✅ |
| registry-validator.ts | No construir | guard + evaluateRouteAccess ✅ |
| points[] / ExtensionTarget | No usar | slots con SlotId reales ✅ |
| useActiveModules | No construir | usePluginRuntimeContext / contexto interno ✅ |
| manifest con dependencies[] | Idea | guard verifica en runtime (no hay dependencies[] en el tipo) |
| Backend Rails + ActionCable | Asume Rails | ❌ No existe -> microservicios reales + polling/WS |
| routes[] | Adaptar | routes[] de PluginManifest (namespace, layout, fallback) ✅ |
| runtimeContext | Uno por modulo | ⚠️ MAXIMO UNO en todo el host (first-wins) |
| Registro en main.tsx | Si, implicito | ✅ Si, pero main.tsx real NO lo hace solo -> import explicito |
| header.left slot | "No existe" ❌ | ✅ SI existe en SlotId |

---

## 11. Nota sobre Registrar Pago (estado actual)

La extension RegistrarPagoExtension YA esta desplegada y funciona, pero hoy:
- Se monta manualmente en src/components/chat/message-input/MessageInput.tsx.
- Lee import.meta.env.VITE_TEUSA_TRACK_API_URL / TOKEN (inyectados por docker-entrypoint.sh desde stack Swarm).
- NO usa registerPlugin ni PluginSlot.

Migracion sugerida: mover el boton a slots: { 'header.right': [...] } (o esperar slot chat.* oficial) y registrar via registerPlugin, ganando PluginErrorBoundary y quitando la edicion a MessageInput.tsx. Las credenciales Teusa pueden seguir en stack Swarm o moverse al proxy backend.
