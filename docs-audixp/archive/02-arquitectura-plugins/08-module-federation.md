# Module Federation para el Ecosistema de Plugins AudiXP

Fecha: 2026-07-17
Autor: AudiXP
Complementa: `08-diagnostico-module-federation.md` + `src/plugin-host/remote-loader.md`

Diseno de adoptar **Module Federation (MF)** como mecanismo de entrega de plugins
remotos (terceros / despliegue independiente), respetando el contrato REAL de
`@/plugin-host` verificado en `01-guia-modulos-plugin-host.md`.

> No es construccion; es diseno. La implementacion va en fases (seccion 7).

---

## 1. Principio rector: modelo hibrido

El host NO abandona el modelo in-tree. MF se suma como una SEGUNDA via de registro:

| Via | Mecanismo | Uso |
|---|---|---|
| In-tree (actual) | `import '@/extensions';` + `registerPlugin` | Codigo propio de AudiXP (simple, seguro, sin red) |
| Remoto (nuevo) | MF container + `registerRemotePlugin` | Terceros / despliegue independiente / A-B |

Ambas desembocan en el MISMO `registerPlugin(manifest)` del core. MF es solo la
forma de **obtener y validar** el manifest + los componentes antes de registrarlos.

---

## 2. Topologia

```
[HOST: evo-ai-frontend-community]
  vite.config.ts (plugin module-federation)
  shared: react, react-dom, react-router-dom (singleton)
  registra remotes desde allowlist firmada
        |
        |  carga en runtime
        v
[REMOTE A: plugin-tercero-1]      [REMOTE B: plugin-tercero-2]
  vite.config.ts (exposes ./plugin-manifest)
  exporta: { manifest: PluginManifest, bootstrap?: () => void }
```

El host NUNCA ejecuta JS de un remote sin pasar por `RemotePluginLoader`
(allowlist + firma + SRI + validacion de schema).

---

## 3. Configuracion del HOST (`vite.config.ts`)

```ts
// vite.config.ts (host) — solo lo nuevo, el resto se conserva
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moduleFederation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    moduleFederation({
      name: 'evo_crm_host',
      remotes: {}, // se resuelven en runtime via RemotePluginLoader, no aqui hardcodeado
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.6.0' },
        '@evoapi/design-system': { singleton: true },
      },
    }),
  ],
});
```

> `react`/`react-dom`/`react-router-dom` DEBEN ser `singleton: true` para que los
> remotes usen la MISMA instancia que el host (sino `PluginSlot`/`PluginErrorBoundary`
> fallan por contexto/hooks distintos). `01-guia-modulos-plugin-host.md:3.2` ya lo exige.

---

## 4. Contrato del REMOTE (exposes)

Cada remote expone UN punto de entrada tipado que devuelve el `PluginManifest`:

```ts
// remote/evo-plugin-tercero/src/entry.ts
import type { PluginManifest } from '@/plugin-host'; // MISMO pkg/tipos que el host
import { MiSlot } from './components/MiSlot';

export const manifest: PluginManifest = {
  id: 'tercero-x',
  slots: { 'header.right': [{ id: 'tercero-x.action', order: 10, component: MiSlot }] },
  routes: [{ id: 'tercero-x.page', path: '/tercero-x', namespace: 'customer', layout: 'main', element: () => import('./pages/MiPagina') }],
  guard: ({ requiredRole, runtimeContext }) => {
    const role = (runtimeContext as { role?: string } | undefined)?.role;
    return !requiredRole || role === requiredRole;
  },
};
```

```ts
// remote/evo-plugin-tercero/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moduleFederation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    moduleFederation({
      name: 'tercero_x',
      filename: 'remoteEntry.js',
      exposes: { './plugin-manifest': './src/entry.ts' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.6.0' },
        '@evoapi/design-system': { singleton: true },
      },
    }),
  ],
});
```

---

## 5. `RemotePluginLoader` (el puente MF -> `registerPlugin`)

Vive en `src/plugin-host/` (o `src/extensions/_shared/`). Aplica los 6 requisitos
de `remote-loader.md` antes de registrar:

```ts
// src/plugin-host/remote-loader.ts (nuevo, implementa remote-loader.md)
import { registerPlugin } from './registry';
import type { PluginManifest } from './types';
import { validatePluginManifest } from './manifest-schema'; // valida contra tipos

const ALLOWLIST: Record<string, { url: string; publicKey: CryptoKey }> = /* firmada */ {};

export async function registerRemotePlugin(remoteId: string): Promise<void> {
  const entry = ALLOWLIST[remoteId];
  if (!entry) throw new Error(`Remote ${remoteId} no esta en la allowlist`);

  // 1) cargar container MF (runtime)
  const container = await loadRemoteContainer(entry.url);

  // 2) SRI/firma: verificar remoteEntry antes de evaluar (remote-loader.md 2-3)
  await verifySignature(entry.url, entry.publicKey);

  // 3) obtener manifest expuesto
  const factory = await container.get('./plugin-manifest');
  const mod = await factory();
  const manifest = mod.manifest as PluginManifest;

  // 4) validar schema del manifest (remote-loader.md 4)
  validatePluginManifest(manifest);

  // 5) runtimeContext: si el remote lo declara, respetar first-wins del host
  //    (types.ts:76) — si ya hay uno, dropear con warn (igual que in-tree).

  // 6) aislamiento ya lo da PluginErrorBoundary en el render de slots/rutas.
  registerPlugin(manifest);
}
```

Mapeo a `remote-loader.md`:
- (1) allowlist -> `ALLOWLIST` host-controlled.
- (2) firma -> `verifySignature`.
- (3) SRI -> hash en la allowlist firmada.
- (4) schema -> `validatePluginManifest`.
- (5) scope opt-in -> el manifest declara slots/namespace; el host no amplia nada.
- (6) isolation -> ya cubierto por `PluginErrorBoundary` en `PluginSlot`/`PluginRoutes`.

---

## 6. Resolucion de las fricciones del diagnostico

| Friccion (diagnostico 3.2) | Solucion en este diseno |
|---|---|
| Registro asincrono llega tras mount | `registerRemotePlugin` se llama en `PluginHostProvider` (ya hace `bootAllPlugins` en useEffect). Tras registrar, `subscribe()` del host re-renderiza slots; rutas se re-splattean (el core ya usa `getRoutes()`). |
| Sharing React 19 | `shared` singleton en host y remotes (seccion 3-4). |
| runtimeContext unico | El loader respeta first-wins; remotes que no sean "core" usan contexto React interno. |
| Tipado del manifest | Remote y host comparten `@/plugin-host`; `validatePluginManifest` valida en runtime. |
| Seguridad | Allowlist + firma + SRI obligatorios en `registerRemotePlugin`. |
| Pin Swarm | El pin pasa a ser "version del remote" en la allowlist firmada; el host queda estable. |
| i18n | Cada remote registra su namespace en `onBoot`; el host no pisa namespaces reservados. |

---

## 7. Fases propuestas

- **F0 — Deps:** agregar `@module-federation/vite` (o `@module-federation/enhanced`) a
  `evo-ai-frontend-community` devDeps. Verificar Vite 6 compatible.
- **F1 — Host:** `vite.config.ts` con `moduleFederation` + `shared` singleton.
- **F2 — Loader:** `remote-loader.ts` (`registerRemotePlugin`) + `manifest-schema.ts`,
  aplicando `remote-loader.md`.
- **F3 — Allowlist firmada:** mecanismo de entrega de la allowlist (config build-time o
  endpoint firmado). Sin esto, MF no se habilita.
- **F4 — Remote ejemplo:** un remote de prueba (`header.right` + 1 ruta `customer`)
  que demuestre el ciclo end-to-end + firma.
- **F5 — Pagina admin:** `admin-modulos` (`01-gestion-de-modulos.md`) muestra TAMBIEN
  remotos registrados, con badge de origen (in-tree vs remote) y estado de firma.
- **F6 — Doc:** actualizar `01-guia-modulos-plugin-host.md` y `00-INDICE.md` con MF.

---

## 8. Restricciones duras (checklist)

- MF **no** se usa para codigo propio de AudiXP si el barril in-tree alcanza (mas simple).
- `react`/`react-dom`/`react-router-dom` SIEMPRE `singleton: true` en host y remotes.
- Ningun remote se ejecuta sin allowlist + firma + SRI validos.
- `runtimeContext`: un solo remote "core" puede declararlo; el resto usa contexto interno.
- El host nunca muta el estado del remote ni expone mutators por `runtimeContext`.
- El remote NO puede registrar slots/namespace fuera de los `SlotId` reales
  (`types.ts:3`); `validatePluginManifest` lo rebota.
- `PluginErrorBoundary` por contribucion se conserva (aislamiento total).

---

## 9. Relacion con la documentacion existente

- `08-diagnostico-module-federation.md` — por que y veredicto.
- `src/plugin-host/remote-loader.md` — requisitos de seguridad que `RemotePluginLoader` implementa.
- `01-gestion-de-modulos.md` — la pagina admin absorbe remotos en F5.
- `00-estrategia-ramas.md` — un remote MF es su propio repo/build; el pin Swarm pasa a
  version de remote en la allowlist.
