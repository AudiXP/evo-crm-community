# Analisis del sistema de modulos de Perfex CRM y aplicabilidad a Evo CRM

Analisis de la instalacion real de Perfex en `C:\wamp64\www\crmrodama` y evaluacion
de que logica/patrones son aplicables a nuestro ecosistema de plugins `@/plugin-host`
(React/TS), con ajustes y personalizaciones necesarias.

> Verificado leyendo codigo real de Perfex:
> `application/libraries/App_modules.php`, `App_module_installer.php`,
> `application/controllers/admin/Mods.php`, `application/helpers/modules_helper.php`,
> y modulos ejemplo (`modules/goals/`, `modules/openai/`).

---

## 1. Como funciona el sistema de modulos de Perfex

Perfex es PHP (CodeIgniter). Su sistema de modulos (desde v2.3.0) es **runtime
administrable**: se sube un `.zip`, se activa/desactiva desde una UI, y persiste en DB.

### 1.1 Estructura de un modulo

```
modules/<nombre>/
  <nombre>.php        # init file: cabeceras + registro de hooks (OBLIGATORIO, mismo nombre que la carpeta)
  install.php         # crea tablas (idempotente: if !table_exists)
  uninstall.php       # (opcional) limpieza
  controllers/        # controladores CodeIgniter
  models/
  views/
  language/<idioma>/<nombre>_lang.php
  libraries/
  migrations/         # (opcional) versionado de esquema
```

El init file lleva **cabeceras tipo WordPress** parseadas por regex:

```php
/*
Module Name: Goals
Description: Default module for defining goals
Version: 2.3.0
Requires at least: 2.3.*
*/
```

### 1.2 Descubrimiento y ciclo de vida (App_modules.php)

- **Descubrimiento:** `get_valid_modules()` recorre `APP_MODULES_PATH` y valida que
  exista `<carpeta>/<carpeta>.php`. `get_headers()` extrae metadatos por regex.
- **Estado en DB:** tabla `tblmodules` (`module_name`, `installed_version`, `active`).
- **activate($name):** inserta en DB si falta, `include` del init file, dispara
  `activate_<name>_module` y `module_activated`, marca `active=1`.
- **deactivate / uninstall:** hooks equivalentes; uninstall borra archivos y registro.
- **Versionado:** `is_database_upgrade_required()` compara Version del header vs DB;
  `App_module_migration` corre migraciones. `release_handler.php` permite auto-update.
- **Requisito minimo:** `is_minimum_version_requirement_met()` (header `Requires at least`).

### 1.3 Instalador desde .zip (App_module_installer.php)

`from_upload()`: descomprime a temp, valida con `check_module()` (que haya un `.php`
con cabecera `Module Name`), si es valido lo extrae a `APP_MODULES_PATH`, dispara
`module_installed`. **No ejecuta codigo del zip en la validacion**, solo lee cabeceras.

### 1.4 UI de gestion (controllers/admin/Mods.php)

- Solo `is_admin()`.
- `index()` -> vista `admin/modules/list` con `app_modules->get()`.
- Acciones: `activate`, `deactivate`, `uninstall`, `upload`, `upgrade_database`,
  `update_version`. Todas redirigen a `admin_url('modules')`.

### 1.5 El corazon: sistema de HOOKS (extensibilidad)

Perfex usa `bainternet/php-hooks` (port de los hooks de WordPress). Un modulo NO
edita el core: se **engancha** con `add_action` / `add_filter` y el core dispara
`do_action` / `apply_filters` en puntos definidos. Ejemplos reales (goals.php):

```php
hooks()->add_action('admin_init', 'goals_module_init_menu_items'); // agrega menu
hooks()->add_filter('get_dashboard_widgets', 'goals_add_dashboard_widget'); // widget
hooks()->add_filter('global_search_result_query', ...); // extiende busqueda
register_activation_hook('goals', 'goals_module_activation_hook'); // corre install.php
register_language_files('goals', ['goals']); // i18n
register_staff_capabilities('goals', $capabilities, _l('goals')); // permisos
```

Helpers de registro (modules_helper.php): `register_activation_hook`,
`register_deactivation_hook`, `register_uninstall_hook`, `register_language_files`,
`register_staff_capabilities`, `register_cron_task`, `register_payment_gateway`,
`register_merge_fields`, `module_dir_path/url`, `module_views_path`.

---

## 2. Comparativa Perfex vs Evo CRM (`@/plugin-host`)

| Aspecto | Perfex (PHP/CI) | Evo CRM (`@/plugin-host`, React/TS) |
|---|---|---|
| Naturaleza | Runtime: instalar/activar desde UI, persiste en DB | Code-time: registrado en build (barril + `registerPlugin`) |
| Descubrimiento | Filesystem scan de `modules/` | Import estatico en `src/extensions/index.ts` |
| Metadatos | Cabeceras regex en `<modulo>.php` | `PluginManifest` (objeto TS tipado) |
| Extensibilidad | Hooks (`add_action`/`add_filter`) globales | Slots (`PluginSlot`) + rutas (`PluginRoutes`) + guards |
| Estado activo | Tabla `tblmodules` (active 0/1) | En memoria (registry); no persiste |
| Ciclo de vida | activate/deactivate/uninstall + migraciones | `onBoot()` (solo boot); sin uninstall/migraciones |
| Instalar .zip | Si (`from_upload`) | No (y no aplica: frontend compilado) |
| i18n | `register_language_files` | i18next `addResourceBundle` (manual en el entry) |
| Permisos | `register_staff_capabilities` (RBAC en DB) | `guard` + `requiredRole`/`requiredCapability` (deny-by-default) |
| Cron | `register_cron_task` | No aplica en frontend (seria backend) |
| Aislamiento de fallos | No hay boundary por modulo | `PluginErrorBoundary` por contribucion (superior) |

**Diferencia de fondo:** Perfex es un backend monolitico que carga PHP dinamicamente;
Evo CRM frontend es un bundle compilado (Vite). Por eso "subir un .zip y activar en
runtime" **no es directamente portable** al frontend: el codigo debe estar en el
bundle. Lo administrable-en-runtime pertenece a la capa backend (microservicios), no
al frontend.

---

## 3. Que ES aplicable y util (con ajustes)

### 3.1 Cabeceras de metadatos -> ya lo tenemos mejor (PluginManifest)
El patron de metadatos de Perfex (Name/Version/Author/Requires) es util para la
**pagina admin de modulos**. Ajuste: ampliar nuestro `PluginManifest` con metadatos
opcionales NO ejecutables para mostrarlos en la UI:

```ts
// Extension propuesta al manifest (campo opcional, no rompe el contrato):
meta?: {
  name: string;         // "Registrar Pago"
  version: string;      // "1.0.0"
  author?: string;      // "AudiXP"
  description?: string;
  requiresAtLeast?: string; // rango evoCommunity
};
```
> Como no debemos tocar `src/plugin-host/types.ts` (core), esto vive como convencion
> propia: cada plugin AudiXP exporta un `meta` que la pagina admin lee, o se envuelve
> el manifest con un wrapper `defineAudixpPlugin({ meta, manifest })`.

### 3.2 Helpers de registro (register_*) -> crear equivalentes AudiXP
Perfex encapsula el "boilerplate" en helpers. Replicable como utilidades en
`src/extensions/_shared/`:
- `registerAudixpPlugin(def)` -> envuelve `registerPlugin` + i18n + meta.
- `addAudixpI18n(ns, bundles)` -> envuelve `i18next.addResourceBundle`.
Ajuste: nuestros equivalentes son TS, no hooks globales.

### 3.3 Convencion de estructura de carpeta -> adoptar la disciplina
La estructura fija de Perfex (init/install/controllers/views/language) es buena
disciplina. Nuestro equivalente ya definido: `src/extensions/<plugin>/`
(`index.ts`, `manifest.ts`, `components/`, `pages/`, `i18n/`, `runtime/`).

### 3.4 Pagina admin de modulos -> el modelo de Mods.php inspira la UI (solo lectura v1)
La vista `admin/modules/list` (nombre, version, autor, estado, acciones) es
exactamente el diseno de nuestra pagina `/admin/mis-modulos` (ver
`01-gestion-de-modulos.md`). Ajuste critico: en v1 NO hay activate/deactivate
persistente (no hay backend de modulos), solo **listado** del registry en memoria.

### 3.5 RBAC por modulo -> mapear a guard/requiredRole
`register_staff_capabilities` mapea limpio a nuestro `guard` + `requiredRole`.
Adoptable: cada plugin declara sus capacidades y el guard las evalua.

### 3.6 i18n por modulo con fallback a ingles -> adoptar el fallback
`register_language_files` carga el idioma y cae a ingles si falta. Buen patron:
nuestros bundles i18next deberian tener fallback consistente.

---

## 4. Que NO es aplicable (o solo con backend)

| Concepto Perfex | Por que no aplica al frontend Evo | Alternativa |
|---|---|---|
| Subir .zip e instalar en runtime | Frontend es bundle compilado; no carga PHP/TS dinamico | Federacion de modulos (Module Federation) o remote-loader (ver `plugin-host/remote-loader.md`), NO trivial |
| Activar/desactivar persistente en DB | No hay backend de modulos ni tabla `tblmodules` | v2: microservicio real que exponga estado; v1 solo lectura |
| Migraciones de esquema por modulo | El esquema vive en microservicios backend | Migraciones en el servicio correspondiente |
| Cron por modulo | Frontend no corre cron | Backend / scheduler del microservicio |
| Hooks globales estilo WordPress | Nuestro modelo usa slots tipados + rutas (mas seguro en TS) | Slots `@/plugin-host` (ya superiores por PluginErrorBoundary) |
| Auto-update via `release_handler.php` | Deploy es imagen Docker -> FTP -> stack Swarm | Pipeline de imagen (ya documentado) |

---

## 5. Recomendaciones concretas para nuestro proyecto

1. **Adoptar metadatos de modulo (meta)** como convencion AudiXP para poblar la pagina
   admin, sin tocar el core (`types.ts`). Prioridad: media. Encaja en Fase 2 del plan.
2. **Crear helpers `src/extensions/_shared/`** (`registerAudixpPlugin`, `addAudixpI18n`)
   inspirados en los `register_*` de Perfex. Reduce boilerplate y unifica i18n+meta.
   Prioridad: media.
3. **Disenar la pagina `/admin/mis-modulos`** con las columnas del `admin/modules/list`
   de Perfex (nombre, version, autor, estado, slots/rutas), pero **solo lectura v1**.
   Ya planificada (Fase 2). Prioridad: alta cuando toque construir.
4. **Mapear RBAC**: documentar como cada plugin declara capacidades y las evalua el
   `guard` (paralelo a `register_staff_capabilities`). Prioridad: media.
5. **NO intentar instalacion por .zip en runtime** en el frontend. Si en el futuro se
   quiere carga dinamica real, evaluar Module Federation / el `remote-loader` del host
   como tarea aparte, con backend. Prioridad: baja / investigacion.
6. **Estado persistente de activacion**: aplazar a v2 cuando exista microservicio; el
   frontend nunca decide activacion contra terceros directo (proxy backend). Prioridad:
   baja.

---

## 6. Conclusion

El valor real de Perfex para nosotros NO es su carga dinamica por .zip (no portable a
un frontend compilado), sino su **disciplina de diseno**: metadatos de modulo,
helpers de registro, estructura de carpeta fija, UI de gestion y RBAC por modulo. De
todo eso, nuestro `@/plugin-host` ya iguala o supera la extensibilidad (slots tipados
+ `PluginErrorBoundary`), y lo que conviene "copiar" son las **convenciones de
metadatos, helpers y la UI de listado** (solo lectura por ahora). La administracion en
runtime (activar/instalar) queda como capa backend futura, no frontend.
