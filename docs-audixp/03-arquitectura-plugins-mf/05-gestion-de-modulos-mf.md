# 05 — Gestión de Módulos en Evo CRM (enfoque Module Federation)

Reorientacion de `02-arquitectura-plugins/01-gestion-de-modulos.md` al modelo MF.
La pregunta base sigue siendo "existe una pagina tipo Odoo/Perfex para gestionar
modulos?" — pero la respuesta evoluciona porque ahora un modulo puede ser un
**remote MF cargado en runtime**, no solo codigo in-tree compilado.

> Verificado contra `src/plugin-host/*`, `src/routes/index.tsx`, `constants/roles.ts`,
> `src/plugin-host/guards.ts` y `src/plugin-host/remote-loader.md`. Sin inventar backends.

## 1. Paradigma MF vs in-tree

| Verdad | In-tree (hoy) | Module Federation |
|---|---|---|
| Existencia | codigo en el bundle + linea en barril | remote en allowlist firmada, cargado en runtime |
| Activacion | rebuild/reconstruir imagen | registrar el remote (allowlist) |
| Desactivacion | comentar linea en barril | quitar de allowlist firmada |
| Toggle persistente | no (v1) | no (v1); futuro via microservicio |

El modelo sigue siendo **mayormente code/allowlist-time**: un remote existe si esta
en la allowlist firmada del host y su `remoteEntry.js` carga. La "activacion" en
runtime del cliente es visibilidad/inyeccion en slots y rutas.

## 2. Matriz de equivalencias (con MF)

| Capacidad | Odoo 19 | Perfex CRM | Evo CRM MF |
|---|---|---|---|
| Definicion de extension | `__manifest__.py` | Cabeceras regex PHP | `PluginManifest` + `meta` (remote MF) |
| Estructura | Directorio addon | Directorio modulo | Remote MF autocontenido (build propio) |
| Inyeccion UI | Assets + registries OWL | Hooks PHP | Slots tipados (`PluginSlot`) de remote |
| Seguridad | `ir.model.access.csv` | Staff capabilities | `guard` + allowlist firmada + firma/SRI |
| Dependencias | Grafo auto-install | Verificacion manual | Validacion en runtime antes de `registerPlugin` |
| Aislamiento | Reversion transaccional | No hay | `PluginErrorBoundary` por contribucion |

## 3. Slots admin REALMENTE montados (igual que in-tree)

Verificado en `01-gestion-de-modulos.md` §3: `PluginRoutes({namespace:'admin'})`
MONTADO en `routes/index.tsx:1534`. `admin.nav` tipo existe pero NO montado como
PluginSlot -> acceso por URL `/admin/mis-modulos` o link estatico.

## 4. APIs del registry (igual que in-tree)

`getRegisteredPlugins()`, `getPlugins()`, `getSlotContributions(slot)`,
`getRoutes(namespace?)`, `subscribe(listener)`. El remote MF termina llamando
`registerPlugin`, por lo que aparece en este mismo registry. No hay
`useActiveModules`, `MOCK_MODULES` ni axios a `/api/v1/modules`.

## 5. Manifest enriquecido (meta) — también para remotos

Cada remote MF exporta `meta` de metadatos estaticos (NO altera tipos del core):

```ts
// convencion propia en el remote (no toca @/plugin-host)
export interface AudixpModuleMeta {
  name: string;
  version: string;
  author: string;
  license?: string;
  category?: string;          // string libre, default 'Uncategorized'
  summary?: string;
  description?: string;
  application?: boolean;
  dependsOn?: string[];       // ids de remotos/in-tree requeridos (grafo)
}
```

`meta.id` NO se duplica: se toma de `PluginManifest.id`.

## 6. Resolución de dependencias en runtime (grafo Odoo adaptado a MF)

En MF, el loader valida `dependsOn` de cada remote ANTES de `registerPlugin`:

```
por cada remote con meta.dependsOn:
  Todos los ids de dependsOn estan ya registrados (in-tree o remote)?
    SI -> estado "ok"
    NO -> estado "missing_deps" (badge de advertencia; NO auto-install)
```

Diferencia con Odoo: en MF **solo se valida y advierte**, no se instala nada (no hay
runtime install en frontend compilado). El bloqueo por `missing_deps` solo aplica en
v2 (toggle persistente contra microservicio).

## 7. Diseño de la página admin (`/admin/mis-modulos`) en enfoque MF

Igual estructura de `01-gestion-de-modulos.md` §7, pero la pagina LISTA tanto
in-tree como remotos, con:

- **Badge de origen:** `in-tree` vs `remote (MF)`.
- **Estado de firma:** `firmado` / `firma-invalida` (del `RemotePluginLoader`).
- **URL del remote** y `version` del `remoteEntry.js`.
- Grafo `dependsOn` con badge `ok` / `missing_deps`.
- Agrupacion por `meta.category`; destaque de `meta.application`.
- Solo LECTURA en v1.

Manifiesto de la pagina (ruta admin real, guard OBLIGATORIO por deny-by-default):

```ts
export const AdminModulosManifest: PluginManifest = {
  id: 'admin-modulos',
  routes: [{
    id: 'admin-modulos.page', path: '/admin/mis-modulos', namespace: 'admin',
    layout: 'main', element: () => import('./pages/AdminModulosPage'),
    requiredRole: ROLE_KEYS.ACCOUNT_OWNER,
  }],
  guard: ({ requiredRole, runtimeContext }) => {
    const role = (runtimeContext as { role?: string } | undefined)?.role;
    return !requiredRole || role === requiredRole;
  },
};
```

## 8. Restricciones duras (checklist)

- Rutas tempranas: remotos deben registrarse ANTES del mount de `<AppRouter>`
  (el loader se llama en `PluginHostProvider`).
- Guard obligatorio con `requiredRole`: deny-by-default.
- `admin.nav` NO montado -> acceso por URL directa.
- `runtimeContext`: MAXIMO UNO por host (first-wins). La pagina admin NO lo registra.
- Aislamiento total: `PluginErrorBoundary` por contribucion.
- Un remote NO se ejecuta sin allowlist + firma + SRI validos.

## 9. Diseño de la UI `/admin/mis-modulos` (enfoque MF)

Documentacion formal del diseno visual. Version extendida en
`12-diseno-ui-admin-modulos.md`. Basado en la maqueta de
`archive/02-arquitectura-plugins/misc/` (usada SOLO como guia visual; era mock +
Rails y fue descartada). La UI real se construye contra `getRegisteredPlugins()`
con `@evoapi/design-system` (NO clases `bg-zinc-*`).

### 9.1 Layout
- **Header:** titulo "Modulos", subtitulo "Activa o desactiva extensiones instaladas
  en esta instancia", y fila de stats: Total instalados / Activos / Con problemas.
- **Toolbar:** buscador (nombre/descripcion) + pestañas (Todos / Activos / Inactivos).
- **Lista:** tarjetas, una por plugin (in-tree o remote), agrupadas por `meta.category`
  y destacando `meta.application`.

### 9.2 Tarjeta de modulo (campos)
- Nombre + version (`v1.1.0`), descripcion, autor.
- **Toggle** de activacion (verde activo; deshabilitado si faltan deps).
- **Badge de estado:** `Listo` / `Dependencias faltantes` / `Error`.
- **Tags de slots** consumidos y **tags de rutas**.
- **Novedades MF:**
  - Badge de **origen**: `in-tree` (verde) vs `remote` (ambar).
  - **Estado de firma**: `firmado` / `firma-invalida` (del `RemotePluginLoader`).
  - **URL del remote** y **version** del `remoteEntry.js` (solo remotos).
  - Grafo `dependsOn`: badge `ok` / `missing_deps`.

### 9.3 Comportamiento
- **v1:** solo lectura/auditoria. El toggle refleja el estado de la allowlist; NO sube
  codigo ni ejecuta nada.
- **v2:** el toggle llama al microservicio (`POST /api/v1/modules/:id/toggle`) y el
  host recarga la allowlist (WS/SSE + polling 30s). `missing_deps` SI bloquea aqui.
- **Aislamiento:** `PluginErrorBoundary` por contribucion; un remote que crashea no
  tumba el shell.
- **Toast:** "X activado / desactivado" (v2).
- **Nota dev:** fuente de verdad = `getRegisteredPlugins()` en memoria.

