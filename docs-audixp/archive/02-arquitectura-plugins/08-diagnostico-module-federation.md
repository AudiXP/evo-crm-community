# Diagnostico: Cambio de Enfoque a Module Federation

Fecha: 2026-07-17
Autor: AudiXP
Alcance: `docs-audixp/02-arquitectura-plugins` + submodulo `evo-ai-frontend-community`

Este documento es el **diagnostico de investigacion** previo a adoptar Module
Federation (MF) como mecanismo de entrega de plugins, en lugar del modelo actual
de "plugins in-tree compilados en el bundle" (`src/extensions/` + `registerPlugin`).

---

## 1. Estado actual (linea base verificada)

### 1.1 Modelo hoy
- Plugins = modulos TypeScript **in-tree** en `src/extensions/<plugin>/`.
- El host `@/plugin-host` expone `registerPlugin(manifest)` (sincrono, idempotente
  por `id`). `src/plugin-host/types.ts:112`.
- Unico punto de contacto con el core: `import '@/extensions';` en `main.tsx`
  (barril `src/extensions/index.ts`).
- Registro estatico en build-time. No hay `import()` de URLs arbitrarias ni `eval`.
- Contrato de carga remota ya esbozado (no implementado) en
  `src/plugin-host/remote-loader.md`: allowlist de origenes, firma, SRI,
  validacion de manifest, scope opt-in, isolation por `PluginErrorBoundary`.

### 1.2 Stack real (verificado en `evo-ai-frontend-community/package.json`)
- `react` / `react-dom`: `^19.0.0`
- `vite`: `^6.3.1`
- `@vitejs/plugin-react`: `^4.3.4`
- `react-router-dom`: `^7.6.0`
- **NO existe** ninguna dependencia de Module Federation:
  - ausente `@module-federation/vite`, `@module-federation/enhanced`,
    `vite-plugin-module-federation`, `@originjs/vite-plugin-federation`.
- **NO existe** configuracion MF en `vite.config.ts`.

### 1.3 Contrato de plugin (lo que MF deberia respetar)
- Slots reales (`SlotId`): `app.providers`, `header.left/right`, `sidebar.afterMain`,
  `admin.nav`, `admin.routes`, `settings.sections`, `dashboard.widgets`,
  `notifications.banner`, `setup.steps`. `src/plugin-host/types.ts:3`.
- Rutas por namespace (`admin`|`customer`|`public`) vía `PluginRoutes({namespace})`.
- `runtimeContext`: **MAXIMO UNO** por host (first-wins). `types.ts:76-79`.
- `guards`: deny-by-default cuando hay `requiredRole`/`requiredRole` sin guard.
- Aislamiento: cada contribucion envuelta en `PluginErrorBoundary`.

---

## 2. Qué es Module Federation (y la variante "v2"/Rust enhance)

Module Federation es un estandar (original en webpack 5, hoy tambien en Vite via
`@module-federation/vite` / `@module-federation/enhanced`) que permite que un
"host" cargue en runtime componentes/modulos expuestos por "remotes" en otros
builds/bundles, compartiendo dependencias comunes (React, etc.) para no duplicarlas.

Casos de uso tipicos: micro-frontends, despliegue independiente de equipos,
plugins de terceros cargados en runtime.

---

## 3. Diagnostico: ¿Module Federation encaja en Evo CRM?

### 3.1 Lo que MF RESUELVE (y hoy NO tenemos)
| Capacidad | Modelo actual (in-tree) | Module Federation |
|---|---|---|
| Desplegar plugin sin rebuild del shell | NO (rebuild + pin Swarm) | SI (remote independiente) |
| Plugins de terceros en runtime | NO | SI (con allowlist + firma) |
| A/B o feature-flags por remoto | NO | SI |
| Actualizar plugin sin tocar el core | NO (todo en el bundle) | SI |

### 3.2 Lo que MF ROMPE o COMPLICA vs el contrato actual
1. **Orden de registro.** `PluginRoutes` exige que las rutas se registren ANTES
   del mount del router (`PluginRoutes.tsx`), y los plugins in-tree se importan en
   `main.tsx` antes de `createRoot`. Con MF, el remote se resuelve en **runtime**
   (promesa), por lo que el registro es asincrono y puede llegar despues del mount.
   => El host necesita un `registerRemotePlugin()` que espere el container MF y
   luego llame `registerPlugin`, con politica de "rutas tardias" (re-splat del router).
2. **Sharing de React 19.** MF debe `shared: ['react','react-dom','react-router-dom']`
   con `singleton: true` para que los remotes usen la MISMA instancia de React que
   el host. Si no, `PluginSlot`/`PluginErrorBoundary` no reconocen los componentes
   remotos (error de hooks/contexto). Esto ya es un riesgo hoy con `context` interno.
3. **runtimeContext unico.** MF no cambia la restriccion de `runtimeContext` (uno por
   host). Un remote que quiera exponer `runtimeContext` competiria con el primero.
   => Regla: solo el host (o un remote "core") puede registrar `runtimeContext`;
   los demas remotes usan contexto React interno.
4. **Tipado del manifest.** El remote expone un `PluginManifest` (tipado en el host).
   MF entrega JS; el host debe validar el schema del manifest remoto ANTES de
   `registerPlugin` (ya contemplado en `remote-loader.md` punto 4).
5. **Seguridad.** MF carga JS de un origen. Hay que aplicar SI O SI la allowlist +
   firma + SRI de `remote-loader.md`. MF "clasico" no firma por defecto; hay que
   combinarlo con subresource integrity o un manifest firmado.
6. **Entorno Docker Swarm / pin.** Hoy el pin fija el commit del submodulo. Con MF,
   el host queda estable y cada remote se despliega/versiona por separado; el pin
   pasa a ser "version del remote" resuelta por el host (config o allowlist firmada).
7. **i18n.** Los remotes deben registrar su propio namespace en `i18next` en su
   `onBoot`; el host no debe pisar namespaces (`auth, chat, contacts, agents, common`).

### 3.3 Riesgos tecnicos especificos en este repo
- Vite 6 + React 19: MF via `@module-federation/vite` es compatible, pero requiere
  `vite.config.ts` propio en host y en cada remote, mas `moduleFederation` plugin.
  Hoy `vite.config.ts` NO tiene nada de eso (hay que crearlo).
- `react-router-dom` v7 con rutas inyectadas: el host usa `<Routes>` y splattea
  `PluginRoutes`. Rutas MF que lleguen tarde necesitan `useRoutes` dinamico o un
  re-render del router tras registro (el host ya hace `subscribe()`; aprovecharlo).
- El build del remote y del host deben compartir el MISMO `tsconfig`/tipos de
  `@/plugin-host` para que el `PluginManifest` sea compatible (versionado del contrato).

---

## 4. Veredicto de la investigacion

- **MF es viables** y es, de hecho, la evolucion natural del `remote-loader.md` ya
  documentado. Convierte el "futuro" remoto en un mecanismo real.
- **NO reemplaza** el modelo in-tree para plugins internos de AudiXP: el barril
  `src/extensions/` es mas simple y seguro para codigo propio. MF es para plugins
  de terceros / despliegue independiente.
- **Hibrido recomendado:** host soporta AMBOS:
  - plugins in-tree (`registerPlugin`) para lo propio;
  - remotes MF (`registerRemotePlugin`) para terceros/despliegue independiente.
- **Precio de entrada:** crear `vite.config.ts` MF en host + cada remote, definir
  `shared` singleton, y un `RemotePluginLoader` que valide firma/manifest antes de
  registrar. Todo eso ya esta esbozado en `remote-loader.md`.

---

## 5. Preguntas abiertas (decidir antes de implementar)

1. ¿MF solo para terceros, o tambien para modulos internos de AudiXP desacoplados?
2. ¿Quien firma los remotes? (clave AudiXP en el pipeline de build del remote).
3. ¿El host resuelve la lista de remotes de una config firmada o de un endpoint?
4. ¿Vite 6 + `@module-federation/vite` o migrar a otra herramienta? (Vite 6 alcanza).

---

## 6. Siguiente paso

Ver `08-module-federation.md` para el diseno propuesto (host/remote, shared,
`RemotePluginLoader`, mapeo al contrato `@/plugin-host`, y fases).
