# 10 — Análisis Odoo + Perfex aplicado a Module Federation

Sintesis de `06-analisis-perfex-modulos.md` y `07-analisis-odoo-modulos.md`
aplicada al modelo **Module Federation (MF)** de Evo CRM. Extrae lo mejor de ambos
sistemas y lo adapta a un frontend federado con Vite, sin copiar su runtime install.

> Fuentes verificadas: Perfex en `C:\wamp64\www\crmrodama`; Odoo 19 en
> `C:\1-odoo-19.0`. Contrato real de Evo en `src/plugin-host/*` y
> `src/plugin-host/remote-loader.md`.

---

## 1. Introducción

Odoo y Perfex se analizaron para entender modelos de modulos maduros. Ambos son
backends monoliticos que cargan codigo dinamicamente (PHP/Python) y persisten estado
en DB. Evo CRM es un **frontend compilado (Vite)** sobre microservicios: no puede
"subir un .zip y activar en runtime" como ellos. Module Federation es el mecanismo
que acerca esa capacidad al frontend, pero respetando el contrato `@/plugin-host`.

Objetivo: tomar los **patrones de diseño** (no el runtime install) de Odoo/Perfex y
aplicarlos a remotos MF.

---

## 2. Lo mejor de Odoo aplicable a MF

### 2.1 Manifest rico con defaults → reforzar `PluginManifest` + `meta`
Odoo `_DEFAULT_MANIFEST` (`module.py:56`) define defaults y campos mandatorios
(`name`, `author`, `license`). Reforzamos la convencion `meta` del remote:

```ts
export interface AudixpModuleMeta {
  name: string;          // obligatorio (como Odoo)
  version: string;       // obligatorio
  author: string;        // obligatorio
  license?: string;      // Odoo lo exige
  category?: string;     // string libre, default 'Uncategorized' (Odoo: 'Sales', etc.)
  summary?: string;
  description?: string;
  application?: boolean; // Odoo: destacar como "App" en la UI
  dependsOn?: string[];  // ids de otros remotos/in-tree (grafo Odoo)
}
```
> No toca `src/plugin-host/types.ts`: vive como convencion del remote. `id` se toma
> de `PluginManifest.id` (no se duplica).

### 2.2 Resolución de dependencias (grafo) → validar antes de `registerPlugin`
El aporte mas valioso de Odoo: el grafo `depends` (`ir_module.py`, auto-install
upstream/downstream). En MF, el `RemotePluginLoader` valida `dependsOn` de cada
remote ANTES de `registerPlugin`:

```
por cada remote con meta.dependsOn:
  Todos los ids estan ya registrados (in-tree o remote)?
    SI -> ok
    NO -> missing_deps (badge; NO auto-install)
```

### 2.3 Categorías y aplicaciones → agrupar en la UI admin
`category` + `application` de Odoo inspiran `/admin/mis-modulos`: agrupar por
categoria y destacar "aplicaciones".

### 2.4 RBAC declarativo → capabilities evaluadas por `guard`
`ir.model.access.csv` + groups + `ir.rule` de Odoo mapea a: cada remote declara sus
`requiredRole`/`requiredCapability` y el `guard` las evalua (deny-by-default).

### 2.5 Patch de UI vía registries → paralelismo con `PluginSlot`
El `registry` + `patch()` de OWL es el equivalente conceptual a nuestros
`PluginSlot`. Nuestro modelo es superior (tipos + `PluginErrorBoundary`); se documenta
el paralelismo para quien venga de Odoo.

---

## 3. Lo mejor de Perfex aplicable a MF

### 3.1 Metadatos en cabeceras → ya superado por TS, util para UI admin
Las cabeceras regex de Perfex (`Module Name/Version/Author`) son utiles para la pagina
admin, pero TS ya las tipa mejor. Se adoptan como `meta` (§2.1).

### 3.2 Helpers de registro (`register_*`) → equivalentes TS en el remote
Perfex encapsula boilerplate en `register_activation_hook`, `register_language_files`,
`register_staff_capabilities` (`modules_helper.php`). Replicables como utilidades del
remote (no globales):

- `registerAudixpPlugin(def)` → envuelve `registerPlugin` + `meta` + i18n.
- `addAudixpI18n(ns, bundles)` → envuelve `i18next.addResourceBundle`.

### 3.3 Estructura de carpeta fija → disciplina para remotos MF
La estructura rigida de Perfex (`<modulo>.php`, `install.php`, `language/`, ...) se
adopta como disciplina del remote: `manifest.ts`, `index.ts`, `components/`, `pages/`,
`i18n/` (ver `02-estructura-modulos-mf.md`).

### 3.4 UI de gestión de módulos → inspirar `/admin/mis-modulos`
La vista `admin/modules/list` de Perfex (nombre, version, autor, estado, acciones)
inspira la pagina admin. En MF se enriquece con **badge de origen** (`in-tree` vs
`remote`) y **estado de firma** (del `RemotePluginLoader`). v1 solo lectura.

### 3.5 RBAC por módulo → mapear a `guard` + `requiredCapability`
`register_staff_capabilities` de Perfex mapea limpio a `guard` + `requiredRole`
(comun con Odoo §2.4).

---

## 4. Qué NO aplicar en MF

| Concepto | Origen | Por qué no aplica | Alternativa MF |
|---|---|---|---|
| Instalación runtime por .zip | Perfex `from_upload` | Frontend compilado; no carga TS dinamico | `RemotePluginLoader` + allowlist firmada |
| ORM / migraciones automáticas | Odoo | Esquema en microservicios backend | Migraciones en cada microservicio |
| Auto-install de upstream deps | Odoo | No hay instalación runtime en bundle | Solo validación/aviso (`missing_deps`) |
| Cron / auto-update | Perfex/Odoo | Frontend no corre cron | Scheduler del microservicio / pipeline imagen |
| Hooks globales estilo WP | Perfex | Slots tipados son mas seguros en TS | `PluginSlot` + `PluginErrorBoundary` |

---

## 5. Síntesis para MF

| Concepto | Odoo | Perfex | MF en Evo CRM |
|---|---|---|---|
| Manifest | `__manifest__.py` rico | Cabeceras regex | `PluginManifest` + convencion `meta` |
| Dependencias | Grafo auto-install | Requiere mínimo manual | Validación en runtime antes de `registerPlugin` |
| Extensibilidad UI | Assets + patch OWL | Hooks WP | Slots tipados + remotos MF |
| RBAC | CSV + groups + rules | `register_staff_capabilities` | `guard` + capabilities declaradas |
| Gestión UI | Apps | Mods.php | `/admin/mis-modulos` con origen y estado |
| Runtime install | Sí (grafo + ORM) | Sí (.zip) | No (solo loader MF + allowlist firmada) |
| Aislamiento | Reversión transaccional | No hay | `PluginErrorBoundary` por contribución |

---

## 6. Conclusión

- **Odoo aporta:** manifest rico (defaults + campos mandatorios) y grafo de
  dependencias (validado, no auto-instalado).
- **Perfex aporta:** disciplina de estructura de carpeta fija y helpers de registro
  (`register_*`) que reducen boilerplate en el remote.
- **MF en Evo CRM combina ambos:** contrato fuerte (`PluginManifest` + `meta`) +
  loader seguro (`RemotePluginLoader`: allowlist + firma + SRI + schema) + UI admin
  clara (`/admin/mis-modulos` con origen y firma).
- Lo que no aplica (runtime install, ORM, cron, migraciones) se delega al backend /
  microservicios, no al frontend federado.

Ver `05-gestion-de-modulos-mf.md` (UI admin) y `06-guia-modulos-plugin-host-mf.md`
(`RemotePluginLoader`) para la materializacion de esta sintesis.
