# Gestion de Modulos en Evo CRM (analisis + diseno de pagina admin)

Responde: "existe una pagina en el CRM para cargar modulos al estilo Perfex CRM u
Odoo?" y define el diseno de una pagina admin propia para el ecosistema de plugins
AudiXP. Fusiona lo mejor de Odoo 19 (manifest rico + grafo de dependencias) y Perfex
CRM (UI de gestion + disciplina de carpetas), adaptado al contrato REAL y estatico del
frontend (`@/plugin-host`, React 19 / Vite).

Documento de DISENO; la construccion se hace despues (ver `05-plan-implementacion.md`).

> Verificado leyendo `src/plugin-host/*`, `src/routes/index.tsx`, `src/constants/roles.ts`
> y `src/plugin-host/guards.ts` directamente. Sin inventar backends: este monorepo NO usa
> Rails ni tiene `/api/v1/modules`.

---

## 1. Respuesta directa + paradigma

**No existe** una pagina tipo Odoo/Perfex para subir un `.zip` e instalar/activar en
runtime. Odoo y Perfex son backends monoliticos que escanean directorios y cargan codigo
sobre la marcha; Evo CRM compila el frontend de forma estatica (Vite). Redefinimos el
flujo con dos verdades:

1. **La existencia es code-time:** un modulo existe si su codigo esta en el bundle y su
   entry point esta expuesto en el barril `src/extensions/index.ts`.
2. **La activacion es (a lo sumo) runtime del cliente:** visibilidad, inyeccion en slots
   y rutas se resuelven en el cliente. v1 = solo lectura del registry en memoria; v2 =
   contrastar contra estado persistente de un microservicio.

### Matriz de equivalencias conceptuales

| Capacidad | Odoo 19 | Perfex CRM | Ecosistema AudiXP (Evo CRM) |
|---|---|---|---|
| Definicion de extension | `__manifest__.py` | Cabeceras regex PHP | `PluginManifest` + convencion `meta` |
| Estructura de carpetas | Directorio addon rigido | Directorio modulo rigido | Carpeta autocontenida en `src/extensions/` |
| Inyeccion de interfaz | Assets + registries OWL | Hooks PHP (`add_filter`) | Slots nativos (`PluginSlot`) tipados |
| Validacion de seguridad | `ir.model.access.csv` | Staff capabilities | `guard` en el manifest + `requiredRole` |
| Resolucion de dependencias | Grafo automatico en DB | Verificacion manual | Validacion en memoria (registry), sin auto-install |
| Aislamiento de fallos | Reversion transaccional | No hay | `PluginErrorBoundary` por contribucion |

| Comparacion runtime | Odoo | Perfex | Evo CRM (hoy) |
|---|---|---|---|
| Instalar desde UI (zip) | Si | Si | **No** |
| Activar/desactivar persistente | Si (DB) | Si (DB) | **No** (v1 solo lectura) |

## 2. Modelo real: "code-time", no "runtime administrable"

- Un modulo existe si su codigo esta importado en el barril `src/extensions/index.ts`.
- Se "activa" compilando/reconstruyendo la imagen; se "desactiva" comentando su linea.
- No hay panel que prenda/apague modulos contra DB (no hay backend de modulos).
- Registro en memoria: `registerPlugin(manifest)` (idempotente por `id`).

## 3. Slots admin REALMENTE montados (verificado)

| Slot / API | Estado en el core | Ubicacion |
|---|---|---|
| `PluginRoutes({ namespace: 'admin' })` | **MONTADO** | `routes/index.tsx:1534` (`PrivateRoute` + `MainLayout`) |
| `PluginRoutes({ namespace: 'customer' })` | MONTADO | `routes/index.tsx:1543` |
| `PluginRoutes({ namespace: 'public' })` | MONTADO | `routes/index.tsx:1554` |
| `header.right` / `header.left` | MONTADO | `Header.tsx` 220/275/276 |
| `sidebar.afterMain` | MONTADO | `Sidebar.tsx:203`, `Header.tsx:192` |
| `notifications.banner` | MONTADO | `App.tsx:70` |
| `setup.steps` | MONTADO | `pages/Setup/Setup.tsx:334` |
| `admin.nav` | **Tipo existe, NO montado** como PluginSlot | — |
| `settings.sections` / `dashboard.widgets` | **Tipo existe, NO montado** | — |

Implicaciones: (1) una ruta `namespace:'admin'` SI se renderiza; (2) `admin.nav` NO
montado -> sin entrada de menu automatica (acceso por URL); (3) sin backend -> v1 solo
lista el registry.

## 4. APIs reales del registry (exportadas de `@/plugin-host`)

| API | Devuelve |
|---|---|
| `getRegisteredPlugins()` | `readonly RegisteredPlugin[]` (manifiestos: id, slots, routes, navItems...) |
| `getPlugins()` | `readonly string[]` (ids) |
| `getSlotContributions(slot)` | contribuciones de un slot |
| `getRoutes(namespace?)` | rutas registradas |
| `subscribe(listener)` | suscribe a cambios; devuelve `unsubscribe` |

> No existe `useActiveModules`, `MOCK_MODULES`, ni axios a `/api/v1/modules`.

## 5. Manifest enriquecido: convencion `meta` (inspiracion Odoo)

Para poblar la pagina admin con datos descriptivos, cada modulo AudiXP exporta un objeto
`meta` de metadatos estaticos, SIN alterar los tipos del core (`@/plugin-host`).

```ts
// src/extensions/_shared/types.ts (convencion propia, NO toca el core)
export interface AudixpModuleMeta {
  // 'id' NO se duplica aqui: se toma del PluginManifest.id para evitar desincronizacion.
  name: string;
  version: string;
  author: string;
  license?: string;
  category?: string;         // string libre con default 'Uncategorized' (como Odoo). NO union cerrada.
  summary?: string;
  description?: string;
  application?: boolean;     // true = destacar como "App" principal en la UI
  dependsOn?: string[];      // ids de otros plugins AudiXP requeridos (grafo)
}
```

> Correccion vs propuestas previas: `category` es string libre (evita editar el tipo por
> cada categoria nueva) y `meta` NO repite `id` (se usa `manifest.id`).

## 6. Resolucion de dependencias en memoria (inspiracion Odoo, adaptada)

Adoptamos el principio del grafo `depends` de Odoo, pero SIN auto-install (no hay
instalacion runtime en un bundle compilado). Solo **validar y advertir**:

```
getRegisteredPlugins()  ->  por cada plugin con meta.dependsOn:
   Todos los ids de dependsOn estan en el registry?
      SI  -> estado "ok"
      NO  -> estado "missing_deps"  (badge de advertencia visual)
```

Diferencia importante con la propuesta de Gemini:
- En **v1 (solo lectura) NO hay toggle**. `missing_deps` es un **indicador visual**
  (badge/alerta), NO un control que bloquea activacion (no hay nada que activar en
  code-time: si el plugin esta en el bundle, ya esta activo).
- El bloqueo de activacion por `missing_deps` solo tiene sentido en **v2** (cuando exista
  toggle persistente contra backend).

## 7. Diseno de la pagina admin (plugin autocontenido)

Carpeta: `src/extensions/admin-modulos/`.

### 7.1 Manifiesto (ruta admin real) + guard OBLIGATORIO

```ts
// src/extensions/admin-modulos/manifest.ts
import type { PluginManifest } from '@/plugin-host';
import { ROLE_KEYS } from '@/constants/roles';

export const AdminModulosManifest: PluginManifest = {
  id: 'admin-modulos',
  routes: [
    {
      id: 'admin-modulos.page',
      path: '/admin/mis-modulos',
      namespace: 'admin',                 // MONTADO en routes/index.tsx
      layout: 'main',
      element: () => import('./pages/AdminModulosPage'),
      requiredRole: ROLE_KEYS.ACCOUNT_OWNER, // 'account_owner' (verificado en constants/roles.ts)
    },
  ],
  // CRITICO: sin este guard la ruta queda INACCESIBLE (ver 7.2).
  guard: ({ requiredRole, runtimeContext }) => {
    if (!requiredRole) return true;
    const role = (runtimeContext as { role?: string } | undefined)?.role;
    return role === requiredRole; // o usar isAdminRole(role) segun politica deseada
  },
};
```

### 7.2 VERDAD DURA sobre el guard (deny-by-default) — verificado en guards.ts

`evaluateRouteAccess` (src/plugin-host/guards.ts) hace **deny-by-default**:

```ts
if (guards.length === 0) {
  return !args.requiredCapability && !args.requiredRole; // con requiredRole presente => FALSE (deniega)
}
```

Es decir: si un plugin declara `requiredRole` **pero NINGUN plugin registra un `guard`**,
la ruta se **DENIEGA**. Por eso el plugin admin DEBE incluir su propio `guard` que valide
el rol contra el `runtimeContext`. Roles reales (constants/roles.ts):
`super_admin, account_owner, administrator, agent`; `isAdminRole()` cubre los 3 admin.

### 7.3 Pagina (lista el registry, SIN backend)

```ts
// pages/AdminModulosPage.tsx (boceto)
import { useEffect, useState } from 'react';
import { getRegisteredPlugins, subscribe } from '@/plugin-host';

export default function AdminModulosPage() {
  const [plugins, setPlugins] = useState(() => getRegisteredPlugins());
  useEffect(() => subscribe(() => setPlugins(getRegisteredPlugins())), []);
  // UI con @evoapi/design-system (NO clases bg-zinc-*).
  // Por plugin: meta.name/version/author/category, slots (Object.keys(p.slots ?? {})),
  // rutas (p.routes?.map(r => r.path)), estado dependsOn (ok | missing_deps).
  // Agrupar por meta.category; destacar meta.application. Solo LECTURA en v1.
  return null;
}
```

### 7.4 Fases evolutivas

- **v1 (esta rama, sin backend):** solo lectura/auditoria. Lista modulos del registry,
  muestra slots/rutas consumidos, evalua grafo `dependsOn` (badge `ok`/`missing_deps`),
  agrupa por `category`. Sin toggle persistente. `@evoapi/design-system`.
- **v2 (futuro, con microservicio):** toggle `POST /api/v1/modules/:id/toggle` a un proxy
  backend; estado persistido; credenciales inyectadas por el backend (frontend sin
  secretos); propagacion via WS/SSE + polling 30s de contingencia. `missing_deps` SI
  bloquea activacion aqui.

## 8. Restricciones y verdades duras (checklist)

- **Rutas tempranas:** los plugins deben registrarse ANTES del mount de `<AppRouter>`
  (ver `PluginRoutes.tsx` 52-59). El import del barril en `main.tsx` lo garantiza.
- **Guard obligatorio con requiredRole:** deny-by-default; sin `guard` propio la ruta se
  deniega (seccion 7.2).
- **Menu del sistema:** `admin.nav` NO montado -> acceso por URL directa
  (`/admin/mis-modulos`) o link estatico inyectado en el shell.
- **runtimeContext:** MAXIMO UNO por host (first-wins). La pagina admin NO debe registrar
  runtimeContext; lee el registry directo. El `guard` puede leer el runtimeContext que
  provea otro plugin (p. ej. el de sesion/rol) si existe.
- **Aislamiento total:** cada contribucion se envuelve en `PluginErrorBoundary`; el fallo
  de un plugin no tumba el panel.
