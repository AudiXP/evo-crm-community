# 09 — Roadmap Evolutivo de Module Federation

Plan por fases para adoptar MF en `evo-ai-frontend-community`, partiendo del modelo
in-tree existente. Es la reorientacion de `05-plan-implementacion` al enfoque MF.

Leyenda: [ ] pendiente - [~] parcial - [x] hecho

## Fase 0 — Dependencias y decisiones
- [ ] 0.1 Agregar `@module-federation/vite` a devDependencies del host.
- [ ] 0.2 Confirmar compatibilidad con Vite 6 (y React 19).
- [ ] 0.3 Cerrar preguntas abiertas del diagnostico: ¿MF solo terceros o tambien
      internos desacoplados? ¿quien firma? ¿allowlist de config o endpoint?

## Fase 1 — Host MF
- [ ] 1.1 `vite.config.ts` host con `moduleFederation` + `shared` singleton
      (react/react-dom/react-router-dom/@evoapi/design-system).
- [ ] 1.2 Mantener `import '@/extensions';` para lo propio (hibrido).
- [ ] 1.3 `manifest-schema.ts`: `validatePluginManifest` contra `SlotId` reales y tipos.
- [ ] 1.4 `remote-loader.ts`: `registerRemotePlugin` (allowlist + firma + SRI + schema).

## Fase 2 — Allowlist firmada
- [ ] 2.1 Mecanismo de entrega de la allowlist (config build-time o endpoint firmado).
- [ ] 2.2 Sin allowlist valida, MF no se habilita (feature-flag de seguridad).

## Fase 3 — Remote ejemplo
- [ ] 3.1 Crear remote de prueba (`header.right` + 1 ruta `customer`) con firma.
- [ ] 3.2 Ciclo end-to-end: host carga remote, `registerPlugin`, slot/ruta visibles.
- [ ] 3.3 Verificar aislamiento (`PluginErrorBoundary`) si el remote crashea.

## Fase 4 — Pagina admin MF
- [ ] 4.1 `/admin/mis-modulos` lista in-tree Y remotos.
- [ ] 4.2 Badge origen (`in-tree` vs `remote`) + estado de firma + URL/version.
- [ ] 4.3 Grafo `dependsOn` con badge `ok` / `missing_deps`.

## Fase 5 — Caso real (Registrar Pago)
- [ ] 5.1 Migrar `RegistrarPagoExtension` a remote MF (caso `07-casos-de-uso-crm.md`).
- [ ] 5.2 Quitar la edicion manual a `MessageInput.tsx`; inyectar via slot.

## Fase 6 — Documentacion y deploy
- [ ] 6.1 Completar `03-arquitectura-plugins-mf/` (esta carpeta).
- [ ] 6.2 Actualizar `00-INDICE.md` de la carpeta y vincular con `02-arquitectura-plugins`.
- [ ] 6.3 El host MF por si solo NO cambia comportamiento visible salvo remotos
      cargados. Deploy real cuando haya contenido con valor (p. ej. tras Fase 5).
- [ ] 6.4 Regla de pin Swarm: version de remote en allowlist firmada, no `main` flotante.

## Vision a futuro
- Marketplace interno de remotes firmados por AudiXP.
- Toggle persistente de remotos contra microservicio (v2): `POST /api/v1/modules/:id/toggle`,
  propagacion WS/SSE + polling 30s, `missing_deps` SI bloquea activacion.
- Slots nuevos oficiales (`chat.*`) para desmontar el acoplamiento en el composer.
