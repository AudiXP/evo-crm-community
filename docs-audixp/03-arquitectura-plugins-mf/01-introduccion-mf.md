# 01 — Introduccion a Module Federation en Evo CRM

## 1. Qué es Module Federation (MF)

Module Federation es un estandar (original en webpack 5, hoy tambien en Vite via
`@module-federation/vite` / `@module-federation/enhanced`) que permite que un
"host" cargue en **runtime** componentes/modulos expuestos por "remotes" en otros
builds/bundles, compartiendo dependencias comunes (React, etc.) para no duplicarlas.

- **Host:** la shell (`evo-ai-frontend-community`). Conoce los remotos que puede
  cargar (via allowlist firmada) y los registra en `@/plugin-host`.
- **Remote:** un build independiente que expone un punto de entrada tipado
  (`./plugin-manifest`) devolviendo un `PluginManifest`.

## 2. Motivacion en Evo CRM

El modelo in-tree (`src/extensions/` + `registerPlugin`) obliga a rebuild + pin
Swarm para cualquier cambio de plugin. MF resuelve:

| Capacidad | In-tree (hoy) | Module Federation |
|---|---|---|
| Desplegar plugin sin rebuild del shell | NO | SI (remote independiente) |
| Plugins de terceros en runtime | NO | SI (allowlist + firma) |
| A/B o feature-flags por remoto | NO | SI |
| Actualizar plugin sin tocar el core | NO | SI |

## 3. Modelo hibrido (decisión de arquitectura)

El host **no abandona** el modelo in-tree. MF se suma como SEGUNDA via de registro:

| Via | Mecanismo | Uso |
|---|---|---|
| In-tree (actual) | `import '@/extensions';` + `registerPlugin` | Codigo propio de AudiXP (simple, seguro, sin red) |
| Remoto (nuevo) | MF container + `registerRemotePlugin` | Terceros / despliegue independiente / A-B |

Ambas desembocan en el MISMO `registerPlugin(manifest)` del core. MF es solo la
forma de **obtener y validar** el manifest + los componentes antes de registrarlos.

## 4. Stack real del repo (verificado)

- `react` / `react-dom`: `^19.0.0`
- `vite`: `^6.3.1` — **NO webpack** (build = `tsc -b && vite build`)
- `react-router-dom`: `^7.6.0`
- paths `@/*` -> `./src/*` (tsconfig)
- **Sin** dependencias de MF hoy: hay que agregar `@module-federation/vite`.

## 5. Contrato que MF debe respetar

Del core `@/plugin-host` (`src/plugin-host/types.ts`):
- `registerPlugin(manifest)` sincrono, idempotente por `id`.
- `SlotId` reales fijos: `app.providers`, `header.left/right`, `sidebar.afterMain`,
  `admin.nav`, `admin.routes`, `settings.sections`, `dashboard.widgets`,
  `notifications.banner`, `setup.steps`.
- `runtimeContext`: **MAXIMO UNO** por host (first-wins).
- `guards`: deny-by-default cuando hay `requiredRole`/`requiredCapability` sin guard.
- Aislamiento: cada contribucion se envuelve en `PluginErrorBoundary`.

Ver `06-guia-modulos-plugin-host-mf.md` para el mapeo completo.
