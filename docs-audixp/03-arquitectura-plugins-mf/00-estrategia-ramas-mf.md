# Estrategia de Ramas — Arquitectura de Plugins Module Federation (AudiXP)

Politica transversal de Git para el ecosistema de plugins basado en **Module
Federation (MF)** en el fork `AudiXP/evo-ai-frontend-community`, dentro del
monorepo `AudiXP/evo-crm-community` (submodulo).

Adaptacion de `02-arquitectura-plugins/00-estrategia-ramas.md` al mundo MF:
el cambio clave es que cada **remote** es su propio build/repo, no una carpeta
mas dentro de `src/extensions/`.

## Contexto

- El fork oficial local es `upstream/main` (el `main` del proyecto
  evo-ai-frontend-community). `origin` apunta al fork `AudiXP`.
- El frontend es submodulo del monorepo. El monorepo padre fija un **commit SHA**
  (pin) del submodulo.
- En MF el **host** (`evo-ai-frontend-community`) queda estable; cada **remote**
  se versiona y despliega de forma independiente.

## Flujo de ramas

### Host (shell estable)
1. `feature/arquitectura-plugins-mf` — rama puente de infraestructura MF.
   - Nace desde `main` local (oficial, ya pinteado y estable).
   - Contenido: `vite.config.ts` con `moduleFederation` + `shared` singleton,
     `RemotePluginLoader` (`registerRemotePlugin`), `manifest-schema.ts`,
     allowlist firmada. NO introduce plugins de negocio.
   - `main.tsx` mantiene `import '@/extensions';` para lo propio (hibrido).
   - Documentacion en `docs-audixp/03-arquitectura-plugins-mf/`.

### Remotes (un repo/build por plugin tercero o desacoplado)
2. `feature/remote-<nombre-plugin>` — cada remote MF.
   - Nace desde `main` local del repo del remote (o desde `main` del host si el
     remote vive en el mismo fork).
   - Crea el build MF con `exposes: { './plugin-manifest': ... }`.
   - Debe compartir `@/plugin-host` (mismos tipos) y `shared` singleton.
   - Se despliega como `remoteEntry.js` firmado; su URL/version entra en la
     allowlist firmada del host.

## Regla de pin (Swarm) — revisada para MF

- El commit del submodulo host usado por el stack Swarm debe ser uno ya validado
  y deployado, no `main` flotante.
- **Novedad MF:** el "pin" de un plugin tercero ya NO es el commit del submodulo,
  sino la **version del remote** resuelta por el host desde la allowlist firmada.
  El host queda estable; actualizar un remote = nueva entrada firmada en la
  allowlist, sin rebuild del shell.
- Antes de mover el pin del host en el monorepo padre: reconstruir imagen,
  `docker save`, FTP, `docker load`, actualizar servicio en el stack.

## Naming

- Carpeta del remote (en su propio repo): `src/` con `manifest.ts`, `index.ts`,
  `components/`, `pages/`, `i18n/`.
- Branches de remote: `feature/remote-<nombre-plugin>`.
- Tag de imagen / version de remote: `audixp-remote-<nombre-plugin>@<semver>`.
- Allowlist: un documento/manifest firmado que mapea `remoteId -> { url, hash SRI, publicKey }`.

## Compatibilidad upstream

- Riesgo de conflicto en el host: `vite.config.ts` (plugin MF) y la linea de
  import en `main.tsx`. Mantener el MF como plugin aditivo, sin tocar el core.
- Rango de contrato: `{ "evoCommunityRange": ">=1.0.0-rc2 <2.0.0" }` (mismo del
  enfoque in-tree; el `PluginManifest` es el contrato versionado).
