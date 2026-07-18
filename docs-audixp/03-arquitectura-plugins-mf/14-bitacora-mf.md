# 14 — Bitácora de Implementación Module Federation (AudiXP)

Registro cronológico de lo ejecutado en la arquitectura de plugins MF, con origen
de cada commit, decisiones y autores. El "qué/cuándo/quién" vive en `git log`;
este archivo registra el *porqué* y el linaje de la rama.

> Convención: `docs-audixp`, prefijo `14-` = documentación vigente (no archive/).

## Linaje de la rama `feature/arquitectura-plugins-mf`

- **Origen (padre):** `main` local del submódulo `evo-ai-frontend-community`,
  commit `c8bc64eacb0928a2cc77ac44d232415f5bf19ddd`.
- **De dónde sale `c8bc64e`:**
  - Es `main` local, que en el momento de la creación era **idéntico** a
    `upstream/main` (fork oficial `evolution-foundation/evo-ai-frontend-community`).
  - Corresponde al tag `v1.0.0` y al merge PR #260
    (`fix(custom-mcp): guard null tools`, EVO-2139) fusionado el 2026-07-14.
  - `git merge-base` de la rama con `upstream/main` es el propio `c8bc64e`;
    es decir, nació de un `main` ya pinteado y estable, NO de `upstream/main` en
    vivo ni de ramas de trabajo (ver `00-estrategia-ramas-mf.md` §3).
- **Creación:** `git checkout -b feature/arquitectura-plugins-mf main` → primer
  commit propio de la rama es `d9b0abf` (no hay commit "vacío" de creación; en
  Git la rama apunta al padre hasta el primer cambio).

## Historial de commits (submódulo)

| Commit | Fecha | Autor | Rama | Resumen |
|---|---|---|---|---|
| `c8bc64e` | 2026-07-14 | Guilherme Gomes (evolution-foundation) | `main` / `upstream/main` (tag `v1.0.0`) | Merge PR #260 — base estable/pinada de la que nace la rama MF |
| `d9b0abf` | 2026-07-17 | AudiXP | `feature/arquitectura-plugins-mf` | Fase 0/1: infra MF (federation, manifest-schema, remote-loader, PluginHostProvider) |
| `7ae4dda` | 2026-07-17 | AudiXP | `feature/arquitectura-plugins-mf` | Fase 2: allowlist firmada (verifySignedAllowlist/loadSignedAllowlist/bootstrapRemoteLoader) |

Monorepo padre (`evo-crm-community`): el pin del submódulo se movió a `7ae4dda`
en commit posterior de `main` del padre (push a `origin/main`).

## Estado de fases

- **Fase 0 (Dependencias y decisiones): COMPLETA** - @module-federation/vite instalado; npm install/tsc -b/vite build en verde; decisiones de firmante/allowlist documentadas.
- **Fase 1 (Host MF): COMPLETA** - vive en el commit d9b0abf (F0 y F1 fueron un solo commit porque son infra conjunta del host). Cumple F1.1-F1.4 + integridad end-to-end + orden topologico dependsOn.
- **Fase 2 (Allowlist firmada): COMPLETA** - verifySignedAllowlist / loadSignedAllowlist / bootstrapRemoteLoader; medio de entrega VITE_MF_ALLOWLIST (config o endpoint); feature-flag: cero remotos sin allowlist valida + firma.
- **Fase 3 (Remote ejemplo): COMPLETA** - remote de ejemplo en remotes/evo-plugin-ejemplo (header.right + ruta customer), firmado (SRI + allowlist firmada), script de firma (sign-mf-allowlist.mjs) y demo dev (dev-mf.mjs). Test de seguridad 8/8 (firma/SRI alterados -> rechazo).
- **Fase 4 (Pagina admin MF): COMPLETA** - /admin/mis-modulos lista in-tree y remotos con badge origen/firma/url/version + grafo dependsOn; UI @evoapi/design-system; acceso ACCOUNT_OWNER; v1 solo lectura.
- **Fase 5 en adelante: PENDIENTE** (ver abajo).

## Decisiones de implementación (F0 + F1)

1. **`@module-federation/vite` realidad vs documentación.** La doc
   (`03-configuracion-vite-mf.md`) asume `moduleFederation`, pero la versión
   instalada (`1.18.2`) exporta `federation`. Se usó `federation` con
   `name: 'evo_crm_host'`, `remotes: {}` y `shared` singleton.
2. **`requiredVersion` de `react-router-dom` fijado a `^7.6.0`** para coincidir
   con el `package.json` del host (react-router-dom `^7.6.0`, React `^19`).
3. **`validatePluginManifest`** valida contra `SlotId` reales de `types.ts:3` y
   `EVO_COMMUNITY_RANGE = '>=1.0.0-rc2 <2.0.0'`; estado
   `incompatible_core_version` si el `meta.contractVersion` del remote no
   satisface el rango.
4. **`remote-loader.ts`** implementa los 6 requisitos de `remote-loader.md`:
   allowlist host-controlled, firma (header `X-Mf-Signature` + Web Crypto
   `crypto.subtle.verify`, ECDSA P-256 / Ed25519), SRI sha384 end-to-end
   (entry + chunks vía `sriHash` de la allowlist), schema, scope opt-in y
   aislamiento. Además: integridad end-to-end y orden topológico por
   `meta.dependsOn`. Desemboca en `registerPlugin` (mismo registry que in-tree).
5. **Carga en `PluginHostProvider`** vía `registerAllRemotePlugins()` en
   `useEffect` temprano; sin allowlist cargada = cero remotos (feature-flag de
   seguridad). El loader se exporta desde `@/plugin-host`.
6. **Restricciones duras cumplidas:** `shared` singleton siempre; ningún remote
   sin allowlist+firma+SRI; `runtimeContext` first-wins (garantizado por
   `registerPlugin`); `SlotId` solo los reales; UI con `@evoapi/design-system`;
   MF aditivo (solo toca `vite.config.ts` + `PluginHostProvider`, no el core).

## Verificación

- `npm run lint` (archivos MF nuevos): 0 errores.
- `tsc -b`: exit 0.
- `vite build`: `✓ built` (host con plugin federation; `remoteEntry` generado).
- `npm install`: `@module-federation/vite@1.18.2` resuelto.

## Pendiente (Fase 4 en adelante, no hecha aún)

- F5: migrar `RegistrarPagoExtension` a remote MF.
- F6: deploy Docker Swarm + allowlist firmada al contenedor (`13-deploy-mf.md`).
- F7: plugin de sonda de actualizaciones upstream.

## Cómo recuperar el linaje en cualquier momento

```powershell
cd C:\evo-crm-community\evo-ai-frontend-community
git log --oneline -3 feature/arquitectura-plugins-mf
git merge-base feature/arquitectura-plugins-mf upstream/main   # -> c8bc64e
git log c8bc64e --oneline -1
```

## Resumen F2 — Allowlist firmada

- `remote-loader.ts`: nuevas funciones `verifySignedAllowlist` (valida la firma del
  documento allowlist con la clave del operador del keyring), `loadSignedAllowlist`
  (medio de entrega: JSON inline / endpoint URL; si falta o firma invalida ->
  allowlist vacia) y `bootstrapRemoteLoader` (lee `import.meta.env.VITE_MF_ALLOWLIST`,
  verifica y activa; fallo -> cero remotos). Cumple F2 DoD: allowlist vacia = 0 remotos;
  firma/SRI alterados = rechazo.
- `PluginHostProvider`: ahora `await bootstrapRemoteLoader()` antes de
  `registerAllRemotePlugins()` en el useEffect temprano.
- `index.ts`: exporta `bootstrapRemoteLoader`, `loadSignedAllowlist`, `verifySignedAllowlist`.
- Verificado: lint 0 errores, `tsc -b` exit 0, `vite build` OK.
## Resumen F3 — Remote ejemplo

- `remotes/evo-plugin-ejemplo/`: remote MF de prueba con `vite.config.ts` (plugin
  `federation`, `exposes './plugin-manifest'`, `shared` singleton), `src/entry.ts`
  (PluginManifest con `header.right` + 1 ruta `customer` namespace `customer`),
  `src/components/AccionEjemplo.tsx` y `src/pages/PaginaEjemplo.tsx` usando
  `@evoapi/design-system` (Button/Card, sin clases bg-zinc-*). `npm run build`
  genera `dist/remoteEntry.js` (16 kB) + chunks.
- `scripts/sign-mf-allowlist.mjs`: herramienta de operador (P11) que genera claves
  ECDSA P-256, firma el bundle (SRI) y el documento allowlist, y emite
  `.mf/allowlist.signed.json` + `.mf/keyring.json` + `.mf/bundle-signature.txt`.
- `scripts/dev-mf.mjs`: demo manual — sirve el remote en :4174 con header
  `X-Mf-Signature` y arranca el host en :5173 con `VITE_MF_ALLOWLIST` +
  `VITE_MF_KEYRING` inyectadas. Ciclo end-to-end cableado.
- `remote-loader.ts`: `bootstrapRemoteLoader` ahora tambien carga el keyring desde
  `VITE_MF_KEYRING` (host-controlled) antes de validar la allowlist firmada.
- `src/plugin-host/__tests__/remote-loader.spec.ts`: 8 tests (F2/F3 DoD) — firma
  del documento valida, firma alterada rechazada, keyring faltante rechazado,
  allowlist vacia = 0 remotos, schema + rango del contrato (incompatible_core_version).
- Correccion en `manifest-schema.ts` (satisfiesRange): el tokenizador ahora separa
  operador de version, permitiendo `>=1.0.0-rc2` (syntax literal del contrato).
- Verificado: lint 0 errores, tsc -b exit 0, vite build host OK, vitest 8/8.
- Pendiente de verificacion visual en navegador (demo manual): slot/ruta visibles
  y aislamiento PluginErrorBoundary ante crash del remote.
## Resumen F4 — Pagina admin MF (/admin/mis-modulos)

- `src/plugin-host/registry.ts`: nuevo mapa `registrationMeta` + tipos
  `PluginOrigin`/`PluginSignatureStatus`/`PluginRegistrationMeta`; `registerPlugin`
  inicializa origen `in-tree`; `setPluginRegistrationMeta`/`getPluginRegistrationMeta`
  exponen metadatos de auditoria. Exportado por `@/plugin-host`.
- `src/plugin-host/remote-loader.ts`: tras `registerPlugin`, marca el plugin como
  `origin: 'remote'` + `signatureStatus: 'signed'` + `remoteUrl` + `buildVersion`.
- `src/pages/Admin/MisModulos/AdminModulesPage.tsx`: pagina v1 (solo lectura/auditoria)
  que lee `getRegisteredPlugins()` + `subscribe()` + `getPluginRegistrationMeta(id)`;
  stats (Total/Activos/Con problemas), buscador, tabs Todos/Activos/Inactivos, tarjeta
  por plugin con badge estado/origen/firma, tags de slots y rutas, URL del remote y
  grafo `dependsOn` (Requiere <ids>). UI con @evoapi/design-system, sin clases bg-zinc-*.
- `src/extensions/index.ts` (barrel AudiXP): registra la ruta admin `mis-modulos`
  via `registerPlugin` con `requiredRole: ROLE_KEYS.ACCOUNT_OWNER` + guard deny-by-default;
  `main.tsx` importa `@/extensions` (unico punto de contacto aditivo con el core).
  El host ya monta rutas `namespace:'admin'` via `PluginRoutes` (routes/index.tsx).
- `src/plugin-host/__tests__/registry-meta.spec.ts`: 4 tests (origen in-tree por
  defecto, remote+firma, fuente de verdad, set parcial).
- Verificado: lint 0 errores, tsc -b exit 0, vite build OK, vitest 4/4.
- v1: el toggle refleja el estado pero esta deshabilitado (no ejecuta codigo); el alta
  de remotos sigue siendo configuracion del host (allowlist firmada), no accion UI.

### Ajuste post-F4: campo meta.category (cambio de contrato MENOR)
- Se anadio 'category?: string' a PluginManifestMeta (manifest-schema.ts) y a
  PluginRegistrationMeta (registry.ts), propagado por remote-loader tras registerPlugin.
- AdminModulesPage agrupa las tarjetas por category (fallback 'Sin categoria').
- El barrel in-tree marca evo-admin-mis-modulos con category 'Administracion'; el remote
  de ejemplo declara category 'Ejemplo' en su meta.
- Retrocompatible: campo opcional, no afecta validatePluginManifest ni requiere bump mayor.
- Documentado tambien en 12-diseno-ui-admin-modulos.md (esperado de UI).