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

### Patrón híbrido: rama base (ejemplo) + rama derivada privada

Para casos reales que además deben servir de plantilla reutilizable (ej. F5 =
`RegistrarPagoExtension`):

- **Rama base `feature/arquitectura-plugins-mf`** = infra + **ejemplo**: contiene
  el remote de referencia (ej. `remotes/evo-plugin-ejemplo-boton-registrar-pago/`)
  que muestra el patrón de migración real. Es compartible y estable (se puede pintear).
- **Rama derivada privada `feature/plugin-<nombre>`** (ej.
  `feature/plugin-registrar-pago`) = instancia específica del negocio (endpoint,
  marca, reglas del CRM). Nace desde la rama base ya validada. No se comparte.
- La carpeta del ejemplo en la base lleva prefijo `evo-plugin-ejemplo-` (ej.
  `evo-plugin-ejemplo-boton-registrar-pago`) para mantener el patrón de
  nomenclatura y dejar claro que es un remote de ejemplo, no la instancia real.
  La rama privada usa nombre distinto (ej. `feature/plugin-registrar-pago`);
  rama vs carpeta son espacios distintos de git, sin colisión.
- Toda fase en cualquiera de las dos ramas debe cumplir R1–R6
  (`15-cumplimiento-restricciones-mf.md`).

Ver bitácora `14-bitacora-mf.md` §"Estrategia de ramas para F5".

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

## 3. Sincronización con upstream oficial

Cuando `evolution-foundation/evo-crm-community` o su submodulo `evo-ai-frontend-community`
se actualizan, el enfoque MF ya está aislado. Flujo de mantenimiento:

1. **Sync del host (submodulo):** en `evo-ai-frontend-community`, `git fetch upstream`
   y merge/rebase de `upstream/main` a tu `main` local. NUNCA desde ramas de trabajo ni
   `upstream/main` en vivo. Resuelve conflictos solo en los **2 puntos de contacto**
   (`vite.config.ts` + import en `main.tsx`); MF es plugin aditivo, bajo riesgo.
2. **Verificar contrato:** si upstream cambia `@/plugin-host/types.ts`, es bump de
   version del contrato. `validatePluginManifest` ya rebota remotos incompatibles con
   estado `incompatible_core_version`.
3. **Rebuild + redeploy del host** (`13-deploy-mf.md`). Los remotos NO se rebuildan salvo
   bump mayor del contrato.
4. **Remotos:** si el contrato no cambió, siguen igual. Si cambió versión mayor, cada
   tercero recompila su remote y actualiza su entrada en la allowlist firmada (nueva
   firma/SRI).
5. **Allowlist:** rotarla solo si cambió un remote; el host no se toca.
6. **Pin Swarm:** mover el pin del host solo tras validar build + allowlist; la version
   de cada remote vive en la allowlist, no en el pin del host.

Riesgos que SÍ requieren acción: bump mayor de React/Vite (los `shared` singleton deben
coincidir), cambio en `@/plugin-host` (bump de contrato + rebuild de remotos), y cambio
en `vite.config.ts` del upstream (fusionar con el plugin MF). Ver `11-preguntas-respuestas.md` P13.

### 3.1 Detección de actualizaciones upstream (¿cuándo hay novedades?)

El build de la imagen es **local** (no se baja de Docker Hub del oficial), así que
**Docker Hub NO sirve como sonda** de código. La fuente de verdad es el repo de
`evolution-foundation`. Mecanismos:

- **Check manual (git):** en el submódulo, `git fetch upstream` y comparar:
  `git log HEAD..upstream/main --oneline` lista los commits nuevos del oficial.
- **Versiones estables:** `git ls-remote --tags upstream` (o GitHub API de releases)
  para detectar tags/nuevas versiones en vez de seguir `main` flotante.
- **Sonda automática:** un job CI/CD o cron que hace `git ls-remote upstream` y compara
  el SHA HEAD con el **pin de tu submódulo** (`evo-ai-frontend-community` en `main` del
  padre). Si difiere -> alerta (Slack/email) o PR automático de sync.
- **Webhooks de GitHub:** suscribirse al evento `push` del repo oficial para recibir
  notificación en vivo (sin polling).

Cuando el SHA del oficial difiere del pin de tu submódulo, hay novedades upstream.
Con MF esto importa menos: mientras el **contrato** (`@/plugin-host/types.ts`) no cambie
de versión mayor, un update del host no rompe tus remotos.

### 3.2 Conocer la versión desplegada desde la UI admin

Para ver desde `/admin/mis-modulos` (o un panel de "Acerca de") qué versión del host
y del contrato está corriendo:

- El host expone su **build metadata** (commit SHA, tag/version, `evoCommunityRange`
  del contrato) vía un `runtimeContext` del remote "core" o un endpoint liviano del
  backend. La página admin lo muestra como "Host: vX.Y.Z (sha abc123) · Contrato: 1.x".
- Los **remotos** ya muestran su `version` (de `meta`) y la versión del `remoteEntry.js`
  en la allowlist (ver `12-diseno-ui-admin-modulos.md`).
- Esto habilita el **plugin de sonda de actualizaciones** (ver `09-roadmap-evolutivo.md`
  F7): compara el SHA/version del host desplegado contra el SHA del upstream y marca
  "Actualización disponible" en la UI.

Ver `11-preguntas-respuestas.md` P13 y `09-roadmap-evolutivo.md` (F7, plugin de sonda).
