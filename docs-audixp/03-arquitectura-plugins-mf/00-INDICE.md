# Indice local - 03-arquitectura-plugins-mf

Esta carpeta es el **nuevo punto de partida** para la arquitectura de plugins de
Evo CRM basada en **Module Federation (MF)**. Nace como evolucion del enfoque
in-tree de `02-arquitectura-plugins`, pero se asume MF como modelo base desde cero.

Stack real verificado en `evo-ai-frontend-community`: React 19, Vite 6,
react-router-dom 7, **sin webpack**. Por eso la configuracion es Vite
(`@module-federation/vite`), no Webpack.

Modelo: **hibrido**. Lo propio de AudiXP sigue como in-tree (`registerPlugin`);
los terceros / despliegue independiente se entregan como remotos MF que desembocan
en el MISMO `registerPlugin` del core `@/plugin-host`.

## Archivos

| Archivo | Contenido |
|---|---|
| `00-estrategia-ramas-mf.md` | Politica de ramas/Git adaptada a MF: cada remote = su propio repo/build; el pin Swarm pasa a ser version de remote en allowlist firmada. |
| `01-introduccion-mf.md` | Conceptos MF (host/remote, shared, singleton), motivacion en Evo CRM, modelo hibrido. |
| `02-estructura-modulos-mf.md` | Roles host/remote, carpetas del remote, `exposes './plugin-manifest'`, mapeo al `PluginManifest` real. |
| `03-configuracion-vite-mf.md` | `vite.config.ts` host + remote con `@module-federation/vite`, `shared` singleton. |
| `04-comunicacion-entre-modulos.md` | Sharing de dependencias + comunicacion via contrato `@/plugin-host` (slots, rutas, runtimeContext unico, guards, i18n). |
| `05-gestion-de-modulos-mf.md` | Reorientacion de `01-gestion-de-modulos.md` al enfoque MF: existencia = remote registrado en runtime; pagina admin lista remotos con badge origen y firma. |
| `06-guia-modulos-plugin-host-mf.md` | Version MF de `01-guia-modulos-plugin-host.md`: `RemotePluginLoader` implementa `remote-loader.md` y desemboca en `registerPlugin`. |
| `07-casos-de-uso-crm.md` | Casos en `evo-crm-community`: Registrar Pago como remote, terceros, A/B, despliegue independiente. |
| `08-retos-y-soluciones.md` | Versionado del contrato, performance de remotes, seguridad (firma/SRI), registro async post-mount, runtimeContext unico, sharing React, i18n, compatibilidad upstream, **aislamiento y fuga de datos (CSP, sin secretos en contexto, bifurcacion iframe-sandbox, CSS scoped)**. |
| `09-roadmap-evolutivo.md` | Fases F0-F6 (deps -> host -> loader -> allowlist -> remote ejemplo -> admin -> doc). |
| `10-analisis-odoo-perfex-mf.md` | Sintesis de `06-analisis-perfex-modulos.md` y `07-analisis-odoo-modulos.md` aplicada al modelo MF. |
| `11-preguntas-respuestas.md` | FAQ + ciclo completo de un plugin de tercero (paso a paso) + aspecto visual de `/admin/mis-modulos` + paso a paso de la allowlist firmada en el pipeline de deploy (P11) + propuesta de marketplace mediado por microservicio (P12). |
| `12-diseno-ui-admin-modulos.md` | Diseño formal de la UI `/admin/mis-modulos` (enfoque MF): layout, tarjeta, mock visual, comportamiento v1/v2. |
| `13-deploy-mf.md` | Deploy en producción (Docker Swarm): host se builda igual que la referencia; remotos como builds independientes + allowlist firmada entregada al contenedor; pin Swarm = versión de remote. |

## Como leer

1. `00-estrategia-ramas-mf.md` (rama/build de cada remote).
2. `01-introduccion-mf.md` (conceptos y motivacion).
3. `02-estructura-modulos-mf.md` + `03-configuracion-vite-mf.md` (forma tecnica).
4. `06-guia-modulos-plugin-host-mf.md` (el contrato real aplicado a remotos).
5. `05-gestion-de-modulos-mf.md` (que se administra y pagina admin).
6. `10-analisis-odoo-perfex-mf.md` (lecciones de Odoo/Perfex en MF).
7. `09-roadmap-evolutivo.md` (siguientes pasos).

## Relacion con 02-arquitectura-plugins

Esta carpeta NO reemplaza documentalmente a `02-arquitectura-plugins`; la asume
como origen. Los archivos `05/06/09/10` son reorientaciones de su contraparte
in-tree. El contrato base sigue siendo `@/plugin-host`
(`src/plugin-host/types.ts`, `registry.ts`, `remote-loader.md`).

### Antecedente descartado (no copiar)
Los `.jsx` de `archive/02-arquitectura-plugins/misc/`
(`AdminModulesPage.jsx`, `AdminModulesPreview.jsx`) fueron descartados: usaban
`MOCK_MODULES` y axios a `/api/v1/modules` (backend inexistente) y asumían Rails.
Se conservan SOLO como guia visual de la maqueta de `/admin/mis-modulos` (ver
`11-preguntas-respuestas.md` P5). La UI real se construye contra
`getRegisteredPlugins()` con `@evoapi/design-system`, no con esos archivos.

### Punto de partida de implementacion
Arrancar por la rama puente **`feature/arquitectura-plugins-mf`**
(`00-estrategia-ramas-mf.md`): crea la infra MF en el host antes de cualquier remote.

