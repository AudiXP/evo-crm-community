# 06 — Guía del Contrato @/plugin-host aplicada a Module Federation

Version MF de `02-arquitectura-plugins/01-guia-modulos-plugin-host.md`. El contrato
base (`src/plugin-host/*`) NO cambia: los remotos MF desembocan en el MISMO
`registerPlugin(manifest)`. La novedad es **como se obtiene y valida** ese manifest
antes de registrarlo.

## 1. Lo que el contrato real ya provee (no reinventar)

`src/plugin-host/` exporta desde `@/plugin-host`:
`registerPlugin`, `PluginSlot`, `PluginRoutes`, `PluginHostProvider`,
`PluginErrorBoundary`, `usePluginRuntimeContext`, `onRuntimeContextChanged`,
`evaluateRouteAccess`.

### Slot IDs REALES (`types.ts:3`)
`app.providers`, `header.left`, `header.right`, `sidebar.afterMain`, `admin.nav`,
`admin.routes`, `settings.sections`, `dashboard.widgets`, `notifications.banner`,
`setup.steps`. Los remotos MF solo pueden usar estos.

### Tipo PluginManifest REAL (`types.ts:112`)
`id`, `onBoot?`, `providers?`, `slots?`, `routes?`, `navItems?`, `guard?`,
`runtimeContext?` (**MAXIMO UNO** en todo el host, first-wins).

## 2. RemotePluginLoader (el puente MF -> registerPlugin)

Implementa los 6 requisitos de `src/plugin-host/remote-loader.md`. Vive en
`src/plugin-host/remote-loader.ts`:

```ts
import { registerPlugin } from './registry';
import type { PluginManifest } from './types';
import { validatePluginManifest } from './manifest-schema';

const ALLOWLIST: Record<string, { url: string; publicKey: CryptoKey }> = /* firmada */ {};

export async function registerRemotePlugin(remoteId: string): Promise<void> {
  const entry = ALLOWLIST[remoteId];
  if (!entry) throw new Error(`Remote ${remoteId} no esta en la allowlist`);

  const container = await loadRemoteContainer(entry.url);   // (1) allowlist
  await verifySignature(entry.url, entry.publicKey);        // (2) firma + (3) SRI
  const factory = await container.get('./plugin-manifest'); // expose del remote
  const mod = await factory();
  const manifest = mod.manifest as PluginManifest;

  validatePluginManifest(manifest);                         // (4) schema
  // (5) scope opt-in: el manifest declara slots/namespace; el host no amplia nada.
  // (6) aislamiento ya lo da PluginErrorBoundary en el render.
  registerPlugin(manifest);                                 // MISMO registry que in-tree
}
```

Mapeo a `remote-loader.md`:
1. Allowlist host-controlled -> `ALLOWLIST`.
2. Firma -> `verifySignature`.
3. SRI -> hash en la allowlist firmada.
4. Schema -> `validatePluginManifest` (valida contra `SlotId` reales y tipos).
5. Scope opt-in -> el manifest declara qué usa; el host lo respeta.
6. Isolation -> `PluginErrorBoundary` por contribucion (ya existe).

## 2.5 Integridad de Chunks y Orden de Carga en el RemotePluginLoader

Para evitar brechas donde la validacion cubra solo el `remoteEntry.js` pero deje
vulnerables los chunks diferidos, el cargador y el esquema de dependencias cumplen
dos reglas:

### 1. Integridad de extremo a extremo (entry + chunks)
El `sriHash` de la allowlist NO debe limitarse al `remoteEntry.js`. El mecanismo debe
validar un **build manifest firmado** por el autor que contenga el hash SRI de
**todos los chunks secundarios** que el entry importara bajo demanda. Si un chunk se
altera en el CDN, la validacion de integridad detiene su ejecucion antes del mount.
Sino, "firma + SRI" da falsa sensacion de seguridad: proteges el entry pero no el
codigo real.

### 2. Orden de carga topologico por grafo (`dependsOn`)
Para evitar race conditions donde un remote cargue antes que su dependencia, el
`RemotePluginLoader` NO itera la allowlist en orden arbitrario. Antes del bucle de
descargas, ejecuta un **ordenamiento topologico** basado en `meta.dependsOn`: las
dependencias core se registran primero, asegurando que los remotos dependientes
encuentren sus modulos ya en memoria. Sin esto, un remote podria quedar `missing_deps`
por timing, no por ausencia real.

`PluginRoutes` exige rutas registradas ANTES del mount del router. MF resuelve el
remote en runtime (promesa). Solucion: `registerRemotePlugin` se invoca en
`PluginHostProvider` (que ya hace `bootAllPlugins` en `useEffect`), y tras
registrar, el `subscribe()` del host re-renderiza slots; las rutas se re-splattean
porque el core usa `getRoutes()`.

## 4. runtimeContext único en MF

El loader respeta first-wins (`types.ts:76`). Solo un remote "core" (sesión/rol)
puede declarar `runtimeContext`. Los demás remotos usan contexto React interno y
leen el `runtimeContext` compartido en sus `guard`/`slot`. Si un remote posterior
intenta registrarlo, se dropea con `console.warn` (igual que in-tree).

## 5. Ejemplo de remote (inyección real)

```ts
// remote/evo-plugin-tercero/src/entry.ts
import type { PluginManifest } from '@/plugin-host';
import { MiSlot } from './components/MiSlot';

export const manifest: PluginManifest = {
  id: 'tercero-x',
  slots: { 'header.right': [{ id: 'tercero-x.action', order: 10, component: MiSlot }] },
  routes: [{ id: 'tercero-x.page', path: '/tercero-x', namespace: 'customer',
    layout: 'main', element: () => import('./pages/MiPagina') }],
  guard: ({ requiredRole, runtimeContext }) => {
    const role = (runtimeContext as { role?: string } | undefined)?.role;
    return !requiredRole || role === requiredRole;
  },
};
```

## 6. Reglas de desarrollo (checklist MF)

- Remote: build propio, `exposes './plugin-manifest'`, `shared` singleton.
- Host: `registerRemotePlugin` desde allowlist firmada; ningun remote sin firma/SRI.
- `SlotId` en lista real; `validatePluginManifest` rebota lo demas.
- `runtimeContext`: un solo remote "core" lo declara.
- i18n: namespace propio; no pisar `auth, chat, contacts, agents, common`.
- El remote NO importa del core salvo el tipo `PluginManifest`.
- El core nunca importa del remote.

## 6.5 Diagrama de flujo: ciclo de un remote de tercero (MF)

```
[TERCERO]                        [HOST evo-ai-frontend-community]            [USUARIO admin]
────────                         ───────────────────────────────            ───────────────
1. Desarrolla PluginManifest
   (id, slots, routes, guard)
        │
2. vite build ──► remoteEntry.js
   (+ chunks de sus páginas)
        │
3. Firma el bundle con clave     4. Deploy remoteEntry.js en URL
   confiable (AudiXP)                  │
        │                              ▼
        │                  5. Alta en ALLOWLIST FIRMADA del host
        │                     { id, url, sriHash, publicKeyId }
        │                              │
        │                              ▼  (arranque del host)
        │                  6. PluginHostProvider lee allowlist
        │                     │
        │                     ├─ 7a. Descarga remoteEntry.js
        │                     ├─ 7b. VERIFICA firma + SRI ──falla?──► se RECHAZA (no ejecuta)
        │                     ├─ 7c. container.get('./plugin-manifest')
        │                     ├─ 7d. validatePluginManifest (SlotId reales)
        │                     └─ 7e. registerPlugin(manifest)
        │                              │
        │                              ▼
        │                  8. Slot/ruta se renderiza (PluginErrorBoundary aísla)
        │                              │
        └──────────────────────────────┘
                                       │
                             9. /admin/mis-modulos lista el remote
                                (badge origen + estado de firma + deps)
                                       │
                             10. v1: activar/desactivar = quitar/poner
                                 de la allowlist (config).
                                 v2: toggle persistente vía microservicio.

Leyenda:
- Pasos 1-4 = lado del tercero (NO toca el core del host).
- Paso 5     = "instalación" (no es subir .zip: es dar de alta en allowlist firmada).
- Pasos 7    = RemotePluginLoader (implementa remote-loader.md).
- Paso 10    = v1 solo allowlist; el botón en UI con persistencia es v2.
```

Ver `11-preguntas-respuestas.md` para la explicación paso a paso en lenguaje claro
y el aspecto visual de `/admin/mis-modulos`.

## 7. Equivalencias (in-tree -> MF)

| Concepto | In-tree | MF |
|---|---|---|
| Registro | `import '@/extensions'` + `registerPlugin` | `registerRemotePlugin` (allowlist) -> `registerPlugin` |
| Deps | barril | allowlist firmada + `dependsOn` validado |
| Build | uno solo | host + N remotes |
| Pin Swarm | commit submodulo | version de remote en allowlist |
| Seguridad | guard + roles | guard + roles + firma + SRI + allowlist |
