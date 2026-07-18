# 15 — Cumplimiento de Restricciones Duras (Module Federation)

Checklist de **aceptación obligatoria** que se aplica a TODA fase posterior a F4
(F5, F6, F7, ...). No es historia: es política del contrato MF. Toda fase se
considera "hecha" solo si cumple las 6 restricciones duras listadas aquí y su
verificación correspondiente pasa en verde.

> Convención: `docs-audixp`, prefijo `15-` = documentación vigente (no archive/).

## Restricciones duras (no negociables)

| # | Restricción | Qué significa | Verificación obligatoria |
|---|---|---|---|
| R1 | `shared` singleton siempre | `react`, `react-dom`, `react-router-dom`, `@evoapi/design-system` se declaran `shared` singleton en host Y en cada remote (mismo patrón que `remotes/evo-plugin-ejemplo/vite.config.ts`). | Revisar el `vite.config.ts` del remote antes del `build`; grep `singleton: true` para las 4 deps. |
| R2 | Ningún remote sin allowlist + firma + SRI | Un remote solo se carga si está en la allowlist firmada con `sriHash` + `publicKeyId`. `registerRemotePlugin` lanza si falta. | Test `remote-loader.spec.ts`: remote ausente en allowlist -> rechazado; SRI/firma alterados -> rechazado. |
| R3 | `runtimeContext` first-wins | Máximo un `runtimeContext` registrado. El 2º se descarta con `console.warn`. Los remotes de negocio NO deben declararlo. | En `entry.ts` del remote: ausencia de `runtimeContext`. El registry ya lo dropea. |
| R4 | `SlotId` solo los reales | Solo los `SlotId` de `types.ts:3` (app.providers, header.left, header.right, sidebar.afterMain, admin.nav, admin.routes, settings.sections, dashboard.widgets, notifications.banner, setup.steps). No inventar. | `validatePluginManifest` rebota SlotId fuera de lista. Confirmar en el manifest del remote. |
| R5 | UI con `@evoapi/design-system` (no `bg-zinc-*`) | Componentes del remote usan `Button`/`Card`/`Badge`/etc. Queda prohibido `bg-zinc-*`. | Lint + grep `bg-zinc` sobre `remotes/<remote>/src`. |
| R6 | MF aditivo (no tocar el core) | Solo se tocan `vite.config.ts` + la línea de `import '@/extensions'` en `main.tsx` como puntos de contacto. El core (`src/components/**`, `src/pages/**` del host) NO se edita. | `git diff --stat` de la fase solo debe tocar `remotes/`, `scripts/`, docs y (ya hechos) `vite.config.ts`/`main.tsx`. |

## Checklist por fase

Antes de marcar cualquier fase como COMPLETA:

- [ ] R1: `vite.config.ts` del remote declara `shared` singleton para las 4 deps.
- [ ] R2: el remote está en la allowlist firmada (`scripts/sign-mf-allowlist.mjs`) con SRI + `publicKeyId`; loader lo exige en runtime.
- [ ] R3: `entry.ts` del remote NO declara `runtimeContext`.
- [ ] R4: el `PluginManifest` del remote usa solo `SlotId` reales (validado por schema).
- [ ] R5: sin clases `bg-zinc-*`; todo con design-system.
- [ ] R6: `git diff --stat` confirma que el core no cambió.
- [ ] Verificación global: `npm run lint` 0 errores, `tsc -b` exit 0, `vite build` OK, `vitest` del loader en verde.

## Notas de implementación (F0–F4 ya cumplen R1–R6)

- El host (`feature/arquitectura-plugins-mf`) cumple R1 (shared singleton en `vite.config.ts`),
  R2/R3/R4 (loader + schema + `registerPlugin`), R5 (UI admin con design-system),
  R6 (solo `vite.config.ts` + `main.tsx` tocados).
- El remote de ejemplo `remotes/evo-plugin-ejemplo/` es la plantilla de referencia para
  R1–R6 en cualquier nuevo remote (ver F3, `14-bitacora-mf.md`). El ejemplo de caso
  real `remotes/evo-plugin-ejemplo-boton-registrar-pago/` (F5, rama base
  `feature/arquitectura-plugins-mf`) aplica el mismo patrón al botón Registrar Pago.
- El ajuste post-F4 (`meta.category`, cambio de contrato MENOR) no afecta ninguna R; es
  retrocompatible y no requiere bump mayor (ver `14-bitacora-mf.md` §Ajuste post-F4).
