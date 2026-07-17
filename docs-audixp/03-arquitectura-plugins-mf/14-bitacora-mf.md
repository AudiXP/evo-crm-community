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

Monorepo padre (`evo-crm-community`): el pin del submódulo se movió a `d9b0abf`
en commit posterior de `main` del padre (push a `origin/main`).

## Estado de fases

- **Fase 0 (Dependencias y decisiones): COMPLETA** - @module-federation/vite instalado; npm install/tsc -b/vite build en verde; decisiones de firmante/allowlist documentadas.
- **Fase 1 (Host MF): COMPLETA** - vive en el commit d9b0abf (F0 y F1 fueron un solo commit porque son infra conjunta del host). Cumple F1.1-F1.4 + integridad end-to-end + orden topologico dependsOn.
- **Fase 2 en adelante: PENDIENTE** (ver abajo).

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

## Pendiente (Fase 2 en adelante, no hecha aún)

- F2: mecanismo de entrega de la allowlist firmada (config build-time / endpoint)
  + keyring host-controlled.
- F3: remote ejemplo (`header.right` + 1 ruta `customer`) firmado, ciclo
  end-to-end, aislamiento `PluginErrorBoundary`.
- F4: `/admin/mis-modulos` con badge origen/firma/`dependsOn`.
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
