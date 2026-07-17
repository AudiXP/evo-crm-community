# 09 — Roadmap Evolutivo de Module Federation

Plan por fases para adoptar MF en `evo-ai-frontend-community`, partiendo del modelo
in-tree existente. Es la reorientacion de `05-plan-implementacion` al enfoque MF.

Leyenda: [ ] pendiente - [~] parcial - [x] hecho

## Fase 0 — Dependencias y decisiones
- [x] 0.1 Agregar `@module-federation/vite` a devDependencies del host.
- [x] 0.2 Confirmar compatibilidad con Vite 6 (y React 19).
- [x] 0.3 Cerradas: MF para terceros/desacoplados; firma por clave AudiXP (operador); allowlist via config build-time (VITE_MF_ALLOWLIST) o endpoint firmado.
      internos desacoplados? ¿quien firma? ¿allowlist de config o endpoint?

## Fase 1 — Host MF
- [x] 1.1 vite.config.ts host con federation + `shared` singleton
      (react/react-dom/react-router-dom/@evoapi/design-system).
- [x] 1.2 Mantener `import '@/extensions';` para lo propio (hibrido).
- [x] 1.3 manifest-schema.ts: `validatePluginManifest` contra `SlotId` reales y tipos.
- [x] 1.4 remote-loader.ts: `registerRemotePlugin` (allowlist + firma + SRI + schema).

## Fase 2 — Allowlist firmada
- [x] 2.1 Mecanismo de entrega de la allowlist (config build-time VITE_MF_ALLOWLIST o endpoint firmado).
- [x] 2.2 Sin allowlist valida, MF no se habilita (feature-flag de seguridad).

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

---

## Criterios de terminado por fase (Definition of Done)

Cada fase se considera completa solo si cumple TODOS sus criterios. Esto convierte
este roadmap en el plan de implementacion ejecutable (no solo hoja de ruta).

### F0 — Dependencias y decisiones
- [ ] `@module-federation/vite` instalado; `npm install` y `npm run build` pasan.
- [ ] Se documenta la decision: MF para terceros/desacoplados; quién firma (clave
      AudiXP o partner); allowlist via config build-time o endpoint firmado.
- **DoD:** el submodulo builda con el plugin MF presente (aunque aun no exponga remotos).

### F1 — Host MF
- [ ] `vite.config.ts` tiene `moduleFederation` con `shared` singleton para
      `react`, `react-dom`, `react-router-dom`, `@evoapi/design-system`.
- [ ] `manifest-schema.ts` rechaza `SlotId` fuera de la lista real y valida version
      semantica del contrato (estado `incompatible_core_version`).
- [ ] `remote-loader.ts` implementa los 6 requisitos de `remote-loader.md` y desemboca
      en `registerPlugin`.
- [ ] Integridad end-to-end (entry + chunks) y orden topologico por `dependsOn`
      (ver `06-guia-modulos-plugin-host-mf.md` §2.5).
- **DoD:** `npm run lint` + `npm run build` en verde; un test carga un remote mock
      firmado y aparece en `getRegisteredPlugins()`.

### F2 — Allowlist firmada
- [ ] Existe mecanismo de entrega (config o endpoint) y el host NO carga ningun
      remote sin allowlist valida + firma + SRI.
- **DoD:** con allowlist vacia, cero remotos cargados; con entrada firmada valida,
      el remote carga; con firma/SRI alterados, el remote se rechaza (test).

### F3 — Remote ejemplo
- [ ] Remote de prueba con `header.right` + 1 ruta `customer`, firmado.
- [ ] Ciclo end-to-end verificado (carga -> `registerPlugin` -> slot/ruta visibles).
- [ ] Crash del remote aislado por `PluginErrorBoundary` (shell no cae).
- **DoD:** demo manual en `npm run dev` + test de aislamiento.

### F4 — Pagina admin MF
- [ ] `/admin/mis-modulos` lista in-tree Y remotos con badge origen, estado de firma,
      URL/version y grafo `dependsOn` (`ok`/`missing_deps`).
- **DoD:** UI con `@evoapi/design-system`, acceso por `requiredRole: ACCOUNT_OWNER`,
      sin clases `bg-zinc-*`.

### F5 — Caso real (Registrar Pago)
- [ ] `RegistrarPagoExtension` migrado a remote MF; `MessageInput.tsx` ya no lo edita
      manualmente.
- **DoD:** el boton funciona como remote; build en verde; comportamiento igual a hoy.

### F6 — Documentacion y deploy
- [ ] Esta carpeta MF completa y `00-INDICE.md` actualizado.
- [ ] Pin Swarm = version de remote en allowlist (no `main` flotante).
- **DoD:** commit en `feature/arquitectura-plugins-mf` (submodulo) + push + pin del
      submodulo actualizado en el monorepo padre.

---

## Fase 7 — Sonda de actualizaciones upstream (plugin AudiXP)

Objetivo: conocer desde la UI admin cuándo el oficial (`evolution-foundation`) se
actualizó, y qué versión del host/contrato está desplegada. Ver `00-estrategia-ramas-mf.md`
§3.1/§3.2 y `11-preguntas-respuestas.md` P13.

- [ ] 7.1 El host expone **build metadata** (commit SHA, tag/version, `evoCommunityRange`
      del contrato) vía `runtimeContext` del remote "core" o endpoint liviano del backend.
- [ ] 7.2 La página `/admin/mis-modulos` (o panel "Acerca de") muestra
      "Host: vX.Y.Z (sha abc123) · Contrato: 1.x" y la versión de cada remote.
- [ ] 7.3 **Plugin de sonda** (in-tree AudiXP, no remoto de tercero): consulta el SHA/
      version del upstream oficial de forma segura:
      - Opción A (backend): un microservicio hace `git ls-remote upstream` (o GitHub API/
        webhook) y expone `upstreamSha` al frontend; el plugin compara con el SHA del host
        desplegado y marca "Actualización disponible".
      - Opción B (frontend, limitado): el plugin consulta la GitHub API de commits/releases
        del repo oficial (CORS/rate-limit aplican; requiere proxy o token). No consulta
        Docker Hub (el build es local).
- [ ] 7.4 Al detectar diferencia, la UI muestra badge "Actualización disponible" y enlace
      a la guía de sincronización (`00-estrategia-ramas-mf.md` §3). No aplica ni descarga
      nada automáticamente (la sincronización es manual/CI por seguridad).
- **DoD:** un admin ve en `/admin/mis-modulos` la versión del host desplegado y un aviso
      cuando el SHA del upstream difiere del pin local.

---

## Resumen ejecutivo F0 (arranque inmediato en el submodulo)

1. `cd evo-ai-frontend-community` -> `git checkout -b feature/arquitectura-plugins-mf`
   (nace de `main` local estable).
2. Agregar `@module-federation/vite` a devDependencies; `npm install`.
3. `vite.config.ts`: plugin `moduleFederation`, `remotes: {}`, `shared` singleton.
4. `src/plugin-host/manifest-schema.ts` + `remote-loader.ts` (implementa
   `remote-loader.md`).
5. `npm run lint` + `npm run build` en verde.
6. Commit en la rama del submodulo + push a `origin/AudiXP` + actualizar pin en padre.
