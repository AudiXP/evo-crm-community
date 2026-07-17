# Plan de Implementacion - Plugin Boton Registrar Pago (Enfoque B)

Plan por fases para migrar el boton "Registrar Pago" del Enfoque A (montaje manual en
`MessageInput.tsx`) al Enfoque B (plugin nativo `@/plugin-host`).

**Submodulo:** `evo-ai-frontend-community` (ruta REAL: `C:\evo-crm-community\evo-ai-frontend-community`, NO `apps/...`)
**Fork:** `AudiXP/evo-ai-frontend-community`
**Rama:** `feature/plugin-boton-registrar-pago`
**Carpeta del plugin:** `src/extensions/boton-registrar-pago/`

Leyenda de estado: [ ] pendiente - [~] parcial - [x] hecho

---

## Fase 0 - Preparacion (rama y fork)

- [x] 0.1 Entrar al submodulo real: `cd C:\evo-crm-community\evo-ai-frontend-community`
- [x] 0.2 Confirmar remotes: `git remote -v` (origin=AudiXP, upstream=oficial) - OK
- [ ] 0.3 Crear rama definitiva: `git checkout -b feature/plugin-boton-registrar-pago` (nace desde feature/arquitectura-plugins, NO desde feature/registrar-pago)
- [x] 0.4 Mecanismo de placeholders `VITE_TEUSA_TRACK_*` (Dockerfile + docker-entrypoint.sh) ya existe en el fork (Enfoque A)

---

## Fase 1 - Investigacion en el core (OBLIGATORIA antes de escribir codigo)

No modifica nada; solo lee el submodulo. Responde 3 preguntas:

- [ ] 1.A Ubicar el montaje actual del Enfoque A en `src/components/chat/message-input/MessageInput.tsx`
      (lineas exactas de import + JSX `<RegistrarPagoExtension .../>`).
- [ ] 1.B Encontrar el store/contexto REAL que expone el `conversationId` de la conversacion
      activa (Zustand/React Query/context). NO usar `useConversationStore` (inventado por Gemini).
- [ ] 1.C Confirmar slot destino: `header.right` (verificado en `Header.tsx` lineas 220, 276)
      o evaluar alternativa mientras no exista un slot `chat.composer.*`.

> Salida esperada de la Fase 1: nombre del hook/selector real del conversationId + confirmacion
> del slot. Sin esto, el codigo de la Fase 2 no se puede escribir correctamente.

---

## Fase 2 - Crear el plugin (codigo nuevo, sin tocar el core)

En `src/extensions/boton-registrar-pago/`:

- [ ] 2.1 `manifest.ts` - `PluginManifest` (id `registrar_pago`, slot `header.right`, onBoot)
- [ ] 2.2 `index.ts` - `registerPlugin(RegistrarPagoManifest)`
- [ ] 2.3 `RegistrarPagoExtension.tsx` - boton + modal; recibe `PluginSlotComponentProps`;
      lee `conversationId` del store real (Fase 1.B); `setIsOpen(false)` tras exito
- [ ] 2.4 `RegisterPaymentModal.tsx` - copiar tal cual del Enfoque A (usa `@evoapi/design-system`)
- [x] 2.5 `vite-env.d.ts` - tipado `VITE_TEUSA_TRACK_*` ya existe (Enfoque A); no tocar

> Ver codigo de referencia en `03-guia-plugin-registrar-pago.md` secciones 3-6.

---

## Fase 3 - Unico punto de contacto con el core

- [ ] 3.1 `src/main.tsx` - agregar 1 linea al inicio (antes de `createRoot`):
      `import '@/extensions/boton-registrar-pago';`
- [ ] 3.2 `MessageInput.tsx` - ELIMINAR las 2 lineas del Enfoque A (import + JSX).
      El composer queda 100% puro (sin acoplamiento).

> Resultado: el unico archivo oficial modificado pasa a ser `main.tsx` (1 linea), en vez de
> `MessageInput.tsx`. Menor riesgo de conflicto al hacer rebase con upstream.

---

## Fase 4 - Validacion local

- [ ] 4.1 `npm install` (si `node_modules` no esta)
- [ ] 4.2 `npm run lint`
- [ ] 4.3 `npm run build` (tsc -b && vite build) - debe terminar `FINISHED`
- [ ] 4.4 `npm run dev` - verificar boton en `header.right` + modal envia a Teusa Track

---

## Fase 5 - Deploy (detallado en 04-deploy-plugin-registrar-pago.md)

- [ ] 5.1 `docker build ... -t evoapicloud/evo-ai-frontend-community:audixp-plugin-boton-registrar-pago .`
- [ ] 5.2 `docker save ... -o C:\evo-crm-community\frontend-audixp-plugin.tar`
- [ ] 5.3 Subir `.tar` por FTP al nodo (`/opt/evocrm/`)
- [ ] 5.4 `docker load -i frontend-audixp-plugin.tar` en el nodo manager
- [ ] 5.5 Actualizar stack (image + `VITE_TEUSA_TRACK_*`) y Update en Portainer
- [ ] 5.6 Commit + push de la rama al fork; (opcional) PR al upstream

---

## Restricciones y notas criticas

- **runtimeContext unico:** SOLO UN plugin puede registrar `runtimeContext` en todo el host
  (first-wins). Para el estado del boton de pagos usar contexto React INTERNO, no el global.
- **Ruta del submodulo:** es la raiz del monorepo (`evo-ai-frontend-community/`), NO `apps/`.
- **conversationId:** el slot `header.right` no lo provee por props; obtenerlo del store real
  (Fase 1.B). No inventar hooks.
- **Credenciales Teusa:** siguen en el stack Swarm (`VITE_TEUSA_TRACK_*`) via placeholders;
  opcion futura: mover a proxy de microservicio.
- **Compatibilidad upstream:** tras la migracion, el unico archivo con riesgo de conflicto es
  `main.tsx` (1 linea).

---

## Orden recomendado de ejecucion

1. Fase 1 (investigacion) -> define hook del conversationId y slot.
2. Fase 0 (rama).
3. Fase 2 (crear plugin).
4. Fase 3 (conectar y limpiar Enfoque A).
5. Fase 4 (validar build local).
6. Fase 5 (deploy).
