# ESTADO - docs-audixp

> Documento de estado de la documentacion de plugins de Evo CRM Community (AudiXP).

## Enfoque activo

**Module Federation (MF).** El nuevo trabajo de arquitectura de plugins parte de
`03-arquitectura-plugins-mf/`.

- Modelo: hibrido. Lo propio de AudiXP sigue como in-tree (`registerPlugin`);
  terceros / despliegue independiente se entregan como remotos MF que desembocan en
  el MISMO `registerPlugin` del core `@/plugin-host`.
- Rama puente de infraestructura: **`feature/arquitectura-plugins-mf`**.

## Referencia (no activa)

`02-arquitectura-plugins/` es la documentacion del modelo in-tree (plugins compilados
en el bundle: barril `src/extensions/index.ts` + `registerPlugin`). Se mantiene como
base y trazabilidad del enfoque MF, pero ya no es el punto de partida.

## Archivo (historial)

`archive/` contiene versiones previas (Enfoque A del boton, teoria in-tree original,
caso concreto Enfoque B). No es el flujo actual; sirve para consulta y auditoria.

## Orden de carpetas

| Prefijo | Significado |
|---|---|
| `02-` | Referencia in-tree (legacy mantenido) |
| `03-` | Nuevo estandar MF (activo) |
| `archive/` | Historial / trazabilidad |

No duplicar prefijos numericos entre carpetas vivas.
