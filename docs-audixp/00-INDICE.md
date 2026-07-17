# Indice Maestro - Documentacion Evo CRM Community (AudiXP)

Esta carpeta agrupa la documentacion de las personalizaciones de AudiXP sobre
`evolution-foundation/evo-crm-community`.

## Enfoque activo

> **Module Federation (MF) es el punto de partida activo** para la arquitectura de
> plugins. Ver `03-arquitectura-plugins-mf/`. El modelo in-tree (plugins compilados
> en el bundle) queda como historial en `archive/02-arquitectura-plugins/`.

## Linea viva

### `03-arquitectura-plugins-mf/` — NUEVO ESTANDAR (Module Federation)
Unica carpeta viva de arquitectura de plugins. Documentacion orientada exclusivamente
a MF: host/remote, config Vite, `RemotePluginLoader`, pagina admin, casos CRM, retos,
roadmap, y sintesis Odoo/Perfex. Empieza por su `00-INDICE.md`. Rama puente de
infraestructura: `feature/arquitectura-plugins-mf`.

## Historial / archivo

### `archive/` — TRACABILIDAD (no es flujo actual)
Versiones previas movidas para no perder contexto:
- `archive/01-registrar-pago/` — Enfoque A (boton en produccion, montaje manual).
- `archive/02-arquitectura-plugins/` — teoria del modelo in-tree (contrato
  `@/plugin-host`, pagina admin solo-lectura, analisis Odoo/Perfex). Base del enfoque
  MF. Incluye `misc/` (maquetas `.jsx` descartadas: mock + Rails, usadas solo como
  guia visual de `/admin/mis-modulos`).
- `archive/03-plugin-boton-registrar-pago/` — caso concreto autocontenido (Enfoque B).

## Como leer segun tu objetivo

- **Arrancar arquitectura de plugins HOY** -> `03-arquitectura-plugins-mf/00-INDICE.md`
  y luego `00-estrategia-ramas-mf.md` (rama `feature/arquitectura-plugins-mf`).
- Entender el contrato base `@/plugin-host` (referencia in-tree) ->
  `archive/02-arquitectura-plugins/01-guia-modulos-plugin-host.md`.
- Ver el boton Registrar Pago como plugin (caso completo) ->
  `archive/03-plugin-boton-registrar-pago/`.
- Desplegar el boton actual (Enfoque A) -> `archive/01-registrar-pago/`.

## Notas de mantenimiento

- El `.gitignore` de la raiz ignora `frontend-audixp.tar` y `frontend-audixp-plugin.tar`.
- Commits en el monorepo `AudiXP/evo-crm-community` (rama `main`).
- Codigo de extensiones en el submodulo `evo-ai-frontend-community` (fork `AudiXP`).
- **Regla de numeracion:** `03-` = estandar MF vivo; `archive/` = historial. No crear
  dos carpetas con el mismo prefijo numerico.
