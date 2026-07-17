# Analisis del sistema de modulos de Odoo 19 y aplicabilidad a Evo CRM

Analisis de la instalacion real de Odoo 19 en `C:\1-odoo-19.0` y evaluacion de que
logica/patrones son aplicables a nuestro ecosistema de plugins `@/plugin-host`
(React/TS), con ajustes y personalizaciones necesarias.

> Verificado leyendo codigo real de Odoo:
> `odoo/modules/module.py` (`_DEFAULT_MANIFEST`, `load_manifest`),
> `odoo/addons/base/models/ir_module.py` (`STATES`, `button_install/uninstall/upgrade`),
> `odoo.conf` (`addons_path`), y addons reales
> (`odoo/addons/base/__manifest__.py`, `custom_addons/advanced_business_features/`,
> `custom_addons/conector_whatsapp/`).

---

## 1. Como funciona el sistema de modulos de Odoo

Odoo es Python (framework propio ORM) + frontend OWL (JS reactivo). Es el sistema mas
sofisticado de los tres analizados: **runtime administrable con grafo de dependencias
resuelto automaticamente**, ORM que crea/migra tablas por si mismo, y un pipeline de
assets para el frontend.

### 1.1 Estructura de un addon (modulo)

```
<addon>/
  __manifest__.py     # metadatos + dependencias + data + assets (OBLIGATORIO)
  __init__.py         # importa models/controllers
  models/*.py         # modelos ORM (definen tablas por herencia de models.Model)
  controllers/*.py    # rutas HTTP (@http.route)
  views/*.xml         # vistas, menus, acciones (declarativo)
  security/ir.model.access.csv  # RBAC por modelo
  data/*.xml          # datos semilla
  static/src/js|xml|scss/  # frontend OWL (assets)
  hooks.py            # pre_init/post_init/uninstall hooks
  wizard/             # asistentes (modelos transitorios)
  i18n/*.po           # traducciones
```

### 1.2 El manifest (`__manifest__.py`)

Diccionario Python. Campos por defecto en `_DEFAULT_MANIFEST` (module.py:56). Campos
mandatorios sin default: `name`, `author`, `license`. Ejemplo real (AudiXP):

```python
{
  'name': 'Caracteristicas de Negocio Avanzadas',
  'version': '19.0.1.76.0',
  'category': 'Sales',
  'summary': '...', 'description': '...',
  'author': 'AudiXP', 'website': '...',
  'depends': ['sale','purchase','stock','account','product', ...],  # GRAFO
  'data': ['security/ir.model.access.csv','views/....xml', ...],     # orden importa
  'assets': {                                                        # FRONTEND
     'web.assets_backend': [
        'advanced_business_features/static/src/js/....js',
        'advanced_business_features/static/src/xml/....xml',
        'advanced_business_features/static/src/scss/....scss',
     ],
  },
  'post_init_hook': 'hooks.post_init_hook',
  'installable': True, 'application': False, 'license': 'LGPL-3',
}
```

### 1.3 Descubrimiento y carga

- **addons_path** (odoo.conf): lista de carpetas donde buscar addons. Real:
  `odoo/addons, addons, custom_addons`.
- `load_manifest()` (module.py:398) parsea el `__manifest__.py`, aplica defaults,
  fuerza `depends: ['base']` si falta, valida version, marca `installable`.

### 1.4 Ciclo de vida (ir_module.py) - registro en DB `ir.module.module`

Estados (STATES, ir_module.py:140):
`uninstallable, uninstalled, installed, to upgrade, to remove, to install`.

- `button_install` / `button_immediate_install`: marca `to install` y resuelve el
  **grafo de dependencias** (instala upstream automaticamente).
- `button_uninstall` / `button_immediate_uninstall`: marca `to remove`; calcula
  **downstream dependencies** (que otros modulos se romperian).
- `button_upgrade`: `to upgrade`; corre migraciones.
- Hooks: `pre_init_hook`, `post_init_hook`, `uninstall_hook` (funciones Python que
  reciben el cursor/env). Ejemplo real (hooks.py): recomputar campos tras instalar.

### 1.5 ORM = migraciones automaticas

Diferencia clave con Perfex/otros: el desarrollador NO escribe SQL. Define un modelo
Python (`class X(models.Model)`) y el ORM **crea/altera la tabla** al instalar/actualizar.
Las migraciones de datos complejas van en `migrations/<version>/`.

### 1.6 Frontend OWL y pipeline de assets

El frontend de Odoo (OWL, JS reactivo similar a React) se extiende **sin editar el
core** declarando archivos en `assets` del manifest. Se inyectan en bundles nombrados
(`web.assets_backend`, `web.assets_frontend`). Un addon puede **hacer patch** de
componentes con `patch()` o registrar en `registry` (p. ej. `brand_custom_filter_menu.js`
inserta un item en el menu de filtros). Es el equivalente conceptual mas cercano a
nuestro `@/plugin-host` (slots) pero resuelto por concatenacion de assets + registries.

### 1.7 UI de gestion (Apps)

La app "Apps" (vistas `ir_module_views.xml`) lista addons con estado, permite
instalar/actualizar/desinstalar y subir modulos. RBAC por `ir.model.access.csv` +
`res.groups` + `ir.rule` (reglas de registro).

---

## 2. Comparativa Odoo vs Evo CRM (`@/plugin-host`)

| Aspecto | Odoo (Python + OWL) | Evo CRM (`@/plugin-host`, React/TS) |
|---|---|---|
| Naturaleza | Runtime: instalar/actualizar/desinstalar desde UI, persiste en DB | Code-time: registrado en build (barril + `registerPlugin`) |
| Descubrimiento | `addons_path` scan + `load_manifest` | Import estatico en `src/extensions/index.ts` |
| Metadatos | `__manifest__.py` (dict con defaults) | `PluginManifest` (objeto TS tipado) |
| Dependencias | Grafo resuelto AUTO (upstream/downstream) | `guard` manual; sin resolucion de grafo |
| Estado | `ir.module.module` (6 estados) + transacciones | En memoria (registry); no persiste |
| Migraciones DB | ORM las genera + `migrations/<version>/` | No aplica (esquema en microservicios backend) |
| Hooks ciclo vida | pre/post_init, uninstall (Python) | `onBoot()` solo boot |
| Extensibilidad UI | assets + `patch()` + registries (OWL) | slots tipados + rutas + `PluginErrorBoundary` |
| RBAC | `ir.model.access.csv` + groups + `ir.rule` | `guard` + `requiredRole`/`requiredCapability` |
| Instalar en runtime | Si (subir modulo + boton) | No (bundle compilado) |
| Aislamiento fallos | Reversion transaccional de instalacion | `PluginErrorBoundary` por contribucion |

**Diferencia de fondo:** Odoo es un servidor Python que carga codigo dinamicamente y
tiene ORM propio; Evo CRM frontend es un bundle compilado (Vite) sobre microservicios.
La "instalacion en runtime con grafo de dependencias y ORM" es la joya de Odoo pero
**no portable** a un frontend compilado. Lo que si es inspirador es su **modelo de
manifest rico, resolucion de dependencias, y patch de UI via assets/registries**.

---

## 3. Que ES aplicable y util (con ajustes)

### 3.1 Manifest rico con defaults -> ampliar convencion `meta` (ya iniciada con Perfex)
El `_DEFAULT_MANIFEST` de Odoo (defaults + campos mandatorios name/author/license) es
mejor modelo que las cabeceras regex de Perfex. Reforzar nuestra convencion `meta`:

```ts
meta?: {
  name: string; version: string; author: string; license?: string;
  category?: string; summary?: string; description?: string;
  dependsOn?: string[];       // ids de otros plugins AudiXP (para validar orden)
  application?: boolean;       // si aparece como "app" en la UI admin
};
```

### 3.2 Resolucion de dependencias entre plugins -> util y factible en TS
El grafo `depends` de Odoo es el patron mas valioso. En nuestro registry (memoria)
podemos validar que los `dependsOn` de un plugin esten registrados antes de bootear, y
ordenar/avisar si falta uno. Ajuste: NO instalar automaticamente (no hay runtime
install), solo **validar y advertir** en `onBoot`/en la pagina admin.

### 3.3 Patch de UI via registries -> ya lo tenemos como slots (superior en tipado)
El mecanismo OWL de `registry` + `patch()` es el equivalente a nuestros `PluginSlot`.
Nuestro modelo es mas seguro (tipos + `PluginErrorBoundary`). No copiar; documentar el
paralelismo para quien venga de Odoo.

### 3.4 RBAC declarativo (ir.model.access.csv) -> convencion de capabilities por plugin
Odoo separa permisos en un CSV declarativo. Adoptable como convencion: cada plugin
declara sus capabilities y el `guard` las evalua (paralelo a lo visto en Perfex).

### 3.5 Hooks de ciclo de vida -> mapear a onBoot (frontend) + backend para lo demas
`post_init_hook` de Odoo (recomputar/inicializar tras instalar) mapea parcialmente a
nuestro `onBoot()`. pre_init/uninstall que tocan datos pertenecen al backend.

### 3.6 Categoria/aplicacion para la pagina admin -> agrupar modulos
`category` y `application` de Odoo permiten agrupar/mostrar apps. Util para la UI
`/admin/mis-modulos`: agrupar por categoria y destacar "aplicaciones".

---

## 4. Que NO es aplicable (o solo con backend)

| Concepto Odoo | Por que no aplica al frontend Evo | Alternativa |
|---|---|---|
| Instalar/desinstalar addon en runtime | Frontend es bundle compilado (Vite) | Module Federation / remote-loader (investigacion, con backend) |
| ORM que crea/migra tablas | El esquema vive en microservicios (Go/Node) | Migraciones en cada microservicio |
| Grafo de deps con auto-install de upstream | No hay instalacion runtime; el codigo ya esta en el bundle | Validar/advertir deps en el registry (3.2) |
| Estado en `ir.module.module` (6 estados) | No hay backend de modulos ni tabla | v2: microservicio de estado; v1 solo lectura |
| pre/post_init/uninstall que tocan datos | Frontend no gestiona DB | Hooks en el backend correspondiente |
| Pipeline de assets por bundle | Vite ya bundlea; no concatenamos assets dinamicos | Imports estaticos + code splitting de Vite |

---

## 5. Recomendaciones concretas para nuestro proyecto

1. **Reforzar el `meta` del plugin** con los campos de Odoo (name/version/author/license/
   category/summary/description/dependsOn/application). Unifica con lo recomendado en el
   analisis de Perfex. Prioridad: media. Encaja en Fase 2 del plan.
2. **Implementar validacion de dependencias entre plugins** (`dependsOn`) en el registry:
   al bootear, verificar que los ids requeridos esten presentes; si falta, `console.warn`
   y/o marcar el plugin como "no satisfecho" en la pagina admin. NO auto-instalar.
   Prioridad: media-alta (es el aporte mas valioso de Odoo).
3. **Agrupar por categoria y destacar aplicaciones** en `/admin/mis-modulos` (inspirado
   en la app Apps de Odoo). Prioridad: media, cuando se construya la pagina.
4. **Documentar el paralelismo slots <-> registries/patch OWL** para desarrolladores que
   vengan de Odoo. Prioridad: baja (didactico).
5. **RBAC**: convencion de capabilities por plugin evaluada por `guard` (comun a Perfex y
   Odoo). Prioridad: media.
6. **NO intentar instalacion/ORM en runtime en el frontend.** La carga dinamica real, si
   alguna vez se necesita, es Module Federation / remote-loader con backend (tarea aparte).
   Prioridad: baja / investigacion.

---

## 6. Conclusion

Odoo aporta dos ideas superiores a Perfex que SI podemos aprovechar en TS sin runtime
install: (a) un **manifest rico con defaults y campos mandatorios claros**, y (b) la
**resolucion/validacion de dependencias entre modulos** (grafo `depends`). Ambas caben
en nuestra convencion `meta` + una validacion en el registry, sin tocar el core. Su
extensibilidad de UI (assets/registries/patch OWL) ya la iguala o supera nuestro
`@/plugin-host` con slots tipados y `PluginErrorBoundary`. Lo unico realmente no
portable es la instalacion en runtime con ORM y migraciones automaticas, que en nuestra
arquitectura pertenece a los microservicios backend, no al frontend compilado.

### Sintesis de los tres sistemas (Perfex, Odoo, Evo)

| Fortaleza | Perfex | Odoo | Aplicable a Evo (como) |
|---|---|---|---|
| Metadatos de modulo | Cabeceras regex | `__manifest__.py` (rico) | Convencion `meta` (adoptar de Odoo) |
| Dependencias | Manual | Grafo auto | Validar/advertir en registry (de Odoo) |
| Extensibilidad UI | Hooks WP | assets/registries OWL | Slots tipados (ya superior) |
| RBAC | staff capabilities | csv + groups + rules | `guard` + capabilities |
| Instalacion runtime | .zip | grafo + ORM | NO (backend futuro) |
| Aislamiento fallos | No | Transaccional | `PluginErrorBoundary` (ya superior) |
