# 12 — Diseño UI: /admin/mis-modulos (enfoque MF)

Documentacion formal del diseno visual de la pagina de gestion de modulos en el
enfoque Module Federation. Complementa `05-gestion-de-modulos-mf.md` §9 y
`11-preguntas-respuestas.md` (P4/P5).

> Referencia visual: los `.jsx` de `archive/02-arquitectura-plugins/misc/`
> (`AdminModulesPage.jsx`, `AdminModulesPreview.jsx`) se usan SOLO como guia de
> maqueta. Eran mock + Rails (`/api/v1/modules` inexistente) y fueron descartados.

## 1. Reglas de implementacion

- Fuente de verdad: `getRegisteredPlugins()` (registry en memoria del core).
- UI con **`@evoapi/design-system`** (NO clases `bg-zinc-*` ni colores fijos inline).
- Ruta `namespace: 'admin'`, `requiredRole: ROLE_KEYS.ACCOUNT_OWNER`, `guard`
  OBLIGATORIO (deny-by-default). Acceso por URL directa (`admin.nav` no montado).
- Suscripcion via `subscribe()` para reflejar altas/bajas de remotos en runtime.

## 2. Layout

```
┌─ Módulos ───────────────────────────────────────────────┐
│ Activa o desactiva extensiones instaladas en esta instancia│
│ Total: 4   Activos: 2   Con problemas: 1                 │
│ [ Buscar módulos… ]   [Todos] [Activos] [Inactivos]      │
├──────────────────────────────────────────────────────────┤
│ <tarjeta por plugin, agrupadas por meta.category>        │
└──────────────────────────────────────────────────────────┘
```

## 3. Tarjeta de módulo

Campos por tarjeta:

| Zona | Contenido |
|---|---|
| Titulo | Nombre + `v<version>` (mono) |
| Descripcion | `meta.description` |
| Autor | "por <author>" |
| Toggle | activacion (verde ON; deshabilitado si `depsOk=false`) |
| Badge estado | `Listo` / `Dependencias faltantes` / `Error` |
| Tags slots | `header.right`, `sidebar.afterMain`, … (colores por slot) |
| Tags rutas | `/mi-reporte`, … |
| Badge origen | `in-tree` (verde) / `remote` (ambar) |
| Estado firma | `firmado` / `firma-invalida` |
| Remote (solo MF) | URL del `remoteEntry.js` + version del build |
| Deps | si `!depsOk`: "Requiere: <ids>" |

## 4. Mock visual (texto)

```
┌─ Módulos ───────────────────────────────────────────────┐
│ Activa o desactiva extensiones instaladas.               │
│ Total: 4   Activos: 2   Con problemas: 1                 │
│ [ Buscar módulos… ]   [Todos] [Activos] [Inactivos]      │
├──────────────────────────────────────────────────────────┤
│ Mi Módulo Personalizado            [toggle ON]           │
│ v1.1.0 · por AudiXP                                    │
│ [Listo]  header.right  sidebar.afterMain  /mi-reporte   │
│ [in-tree]                                                │
├──────────────────────────────────────────────────────────┤
│ Analytics Widget                   [toggle OFF]          │
│ v0.9.2 · por AudiXP                                    │
│ [Dependencias faltantes]  Requiere: reporting_base       │
│ dashboard.widgets  [remote] [firmado] cdn…/remoteEntry.js│
├──────────────────────────────────────────────────────────┤
│ WhatsApp Quick Reply               [toggle ON]           │
│ v2.0.1 · por TerceroX                                 │
│ [Listo]  header.right                                 │
│ [remote] [firmado] cdn.tercerox.com/remoteEntry.js        │
└──────────────────────────────────────────────────────────┘
```

## 5. Comportamiento por fase

- **v1 (hoy):** solo lectura/auditoria. El toggle refleja el estado de la allowlist
  firmada; NO ejecuta codigo ni sube nada. Una nota dev indica la fuente
  (`getRegisteredPlugins()`).
- **v2 (futuro):** el toggle llama `POST /api/v1/modules/:id/toggle` al microservicio;
  el host recarga la allowlist (WS/SSE + polling 30s). `missing_deps` SI bloquea la
  activacion. Toast "X activado / desactivado".
- **Aislamiento:** cada contribucion en `PluginErrorBoundary`; un remote que crashea
  no tumba el shell.

## 6. Pestaña Marketplace (v2+, ver `11-preguntas-respuestas.md` P12)

Para un catálogo de terceros donde el admin instala desde la UI, la toolbar gana una
pestaña **"Marketplace"** además de Todos/Activos/Inactivos:
- Lista del **catálogo firmado** (nombre, plan/precio, autor, badge `instalado`/`disponible`).
- Botón **Instalar** → microservicio valida firma+SRI del remote y firma la allowlist.
- Botón **Desinstalar** → quita la entrada vía microservicio.
- El frontend NUNCA escribe orígenes arbitrarios: solo elige de un catálogo curado.

## 7. Dar de alta un plugin nuevo (no es desde esta UI en v1)

El alta de un remote NO se hace desde `/admin/mis-modulos` en v1 (ver
`11-preguntas-respuestas.md` P9/P10/P11). Es configuración del host (allowlist
firmada en el pipeline de deploy). En v2 el alta pasa por el microservicio de
marketplace (P12). Esta página solo lo **lista y audita** una vez ya cargado.
