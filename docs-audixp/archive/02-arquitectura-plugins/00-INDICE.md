# Indice local - 02-arquitectura-plugins

Esta carpeta documenta la **teoria general del contrato de plugins** `@/plugin-host`
y la rama puente `feature/arquitectura-plugins`, que establece la infraestructura de
registro de modulos (barril) y la pagina admin de gestion de modulos.

Es la base sobre la que se construye `03-plugin-boton-registrar-pago` (caso concreto).

## Archivos

| Archivo | Contenido |
|---|---|
| `00-estrategia-ramas.md` | Politica de ramas Git: nacer de `main` oficial local, flujo `arquitectura-plugins` -> `plugin-boton-registrar-pago`, regla de pin Swarm, naming. |
| `01-gestion-de-modulos.md` | Analisis "hay pagina tipo Odoo/Perfex?" (no) + modelo code-time + slots admin realmente montados + diseno de la pagina admin como plugin propio (solo-lectura, sin backend). |
| `01-guia-modulos-plugin-host.md` | **Fuente de verdad** del contrato real `@/plugin-host` (corregida: sin Rails, `SlotId` reales, `runtimeContext` unico, APIs del registry). |
| `02-guia-modulos-v3-original.md` | Referencia historica: version v3.1.0 original (asume `@evoai/extension-points` y Rails; CON ERRORES vs repo real). Solo para comparar. |
| `04-diff-rama-vs-main.md` | Diff verificado de `feature/arquitectura-plugins` vs `main` (2 archivos, +13 lineas) + infraestructura que ya trae el oficial. |
| `05-plan-implementacion.md` | Plan por fases (0-5) para completar la rama puente: barril, investigacion en core, pagina admin de modulos, validacion, commit/push, nota de deploy. |
| `06-analisis-perfex-modulos.md` | Analisis del sistema de modulos de Perfex CRM (instalacion real en `C:\wamp64\www\crmrodama`): ciclo de vida, hooks, installer .zip, UI de gestion, y que patrones son aplicables/no aplicables a `@/plugin-host` con recomendaciones. |
| `07-analisis-odoo-modulos.md` | Analisis del sistema de modulos de Odoo 19 (instalacion real en `C:\1-odoo-19.0`): manifest rico, grafo de dependencias, ORM/migraciones, hooks de ciclo de vida, assets/OWL, y que patrones aplican a `@/plugin-host` (manifest `meta`, validacion de dependencias) + sintesis comparativa Perfex/Odoo/Evo. |
| `08-diagnostico-module-federation.md` | Diagnostico de investigacion: estado actual (in-tree, sin MF), que es Module Federation, veredicto de encaje en Evo CRM, fricciones vs el contrato `@/plugin-host`, preguntas abiertas. |
| `08-module-federation.md` | Diseno de adopcion de Module Federation como segunda via de registro (hibrido con in-tree): topologia, config host/remote, `RemotePluginLoader` que implementa `remote-loader.md`, resolucion de fricciones, fases y restricciones duras. |

## Como leer

1. `00-estrategia-ramas.md` (como y desde donde ramificar).
2. `01-guia-modulos-plugin-host.md` (el contrato real que usaremos).
3. `01-gestion-de-modulos.md` (que se puede administrar hoy y diseno de la pagina admin).
4. `04-diff-rama-vs-main.md` (que cambio exactamente la rama puente).
5. `05-plan-implementacion.md` (checklist de ejecucion por fases).
6. `08-diagnostico-module-federation.md` (investigacion y veredicto sobre MF).
7. `08-module-federation.md` (diseno de MF como via hibrida de plugins remotos).

## Relacion con otras carpetas

- `01-registrar-pago/` = feature "Registrar Pago" Enfoque A (montaje manual, en produccion hoy).
- `03-plugin-boton-registrar-pago/` = mismo feature en Enfoque B (plugin), caso concreto
  autocontenido que NACE de esta rama `feature/arquitectura-plugins`.

## Notas de mantenimiento

- Los `.jsx` que Gemini genero para la pagina admin (mock + Rails) fueron descartados:
  usaban `MOCK_MODULES` y axios a `/api/v1/modules` (backend inexistente). El diseno
  correcto (registry en memoria, `@evoapi/design-system`) esta en `01-gestion-de-modulos.md`.
- La pagina admin se DOCUMENTA aqui y se CONSTRUYE despues (Fase 2 del plan).
