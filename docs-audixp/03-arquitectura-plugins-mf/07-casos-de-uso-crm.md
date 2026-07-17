# 07 — Casos de Uso de MF en evo-crm-community

Aplicacion concreta de Module Federation al contexto del monorepo
`evo-crm-community` (submodulo `evo-ai-frontend-community`).

## 1. Registrar Pago como remote MF

Hoy `RegistrarPagoExtension` se monta manualmente en
`src/components/chat/message-input/MessageInput.tsx` y lee
`import.meta.env.VITE_TEUSA_TRACK_API_URL/TOKEN`. Con MF:

- Se convierte en un **remote** `audixp-remote-registrar-pago` que expone
  `./plugin-manifest`.
- Inyecta el boton via `slots: { 'header.right': [...] }` (o espera slot `chat.*`
  oficial) en lugar de editar `MessageInput.tsx`.
- Gana `PluginErrorBoundary` y deja de tocar el core.
- Las credenciales Teusa pueden seguir en stack Swarm o moverse al proxy backend
  (el remote llama al proxy, no a la API de terceros directo).
- Despliegue independiente: actualizar el boton = nueva version del remote en la
  allowlist, sin rebuild del shell.

## 2. Módulos de terceros (marketplace interno)

Un partner entrega `remoteEntry.js` firmado. El host lo agrega a la allowlist
firmada; el remote aparece en `/admin/mis-modulos` con badge `remote` y estado de
firma. Sin acceso al codigo fuente del host.

## 3. A/B y feature-flags por remoto

Dos remotes `checkout-a` / `checkout-b` exponen la misma ruta `namespace:'customer'`.
La allowlist decide cual esta activo por cliente/porcentaje. El host no cambia.

## 4. Despliegue independiente de equipos

El equipo de "reportes" despliega su remote sin coordinar con el equipo del shell.
El pin Swarm del host queda estable; solo cambia la version del remote en la allowlist.

## 5. Plugins internos desacoplados (opcional)

AudiXP puede sacar ciertos modulos propios a remotes para liberar el bundle del
host (code-splitting agresivo). No es obligatorio: lo propio puede seguir in-tree
por simplicidad.

## 6. Qué NO hacer

- No usar MF para reemplazar el barril in-tree de codigo propio si el barril alcanza.
- No cargar remotos sin allowlist + firma + SRI (riesgo de ejecucion de codigo arbitrario).
- No declarar `runtimeContext` en mas de un remote.
