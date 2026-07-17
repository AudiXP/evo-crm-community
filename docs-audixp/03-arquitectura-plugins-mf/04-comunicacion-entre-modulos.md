# 04 — Comunicación entre Módulos en MF

## 1. Compartición de dependencias (shared singleton)

El mecanismo base de MF para no duplicar React: `shared` con `singleton: true`
en host y remotes (`03-configuracion-vite-mf.md`). Esto garantiza UNA instancia de
`react`, `react-dom`, `react-router-dom`, `@evoapi/design-system`.

Sin esto, los componentes remotos rompen al usar hooks/contexto del host
(`PluginSlot`, `PluginErrorBoundary`, `usePluginRuntimeContext`).

## 2. Comunicación vía el contrato `@/plugin-host`

MF no inventa un canal propio: los remotos se comunican con el host a través del
mismo contrato que los plugins in-tree. Tres mecanismos:

### 2.1 Slots (inyección de UI)
El remote declara `slots` con `SlotId` reales. El host los renderiza en
`PluginSlot` (ya envuelve en `PluginErrorBoundary`). El remote NO toca el DOM del
host; solo contribuye componentes tipados.

```ts
slots: { 'header.right': [{ id: 'tercero-x.action', order: 10, component: MiSlot }] }
```

### 2.2 Rutas (namespace)
El remote declara `routes` con `namespace: 'admin' | 'customer' | 'public'`. El
host las splattea en `<Routes>` via `PluginRoutes({ namespace })`. Deben registrarse
antes del mount del router; el loader se llama en `PluginHostProvider` para cumplirlo
(ver `06-guia-modulos-plugin-host-mf.md` §Registro async).

### 2.3 runtimeContext (único, first-wins)
`types.ts:76` — a lo sumo UN plugin registra `runtimeContext` en todo el host.
Regla MF: solo un remote "core" (p. ej. el de sesión/rol) puede declararlo. Los
demás remotos usan su **propio contexto React interno** y lo leen en sus slots.
El `guard` de un remote puede leer el `runtimeContext` que provea el remote core.

## 3. Seguridad de la comunicación

- Cada remote declara (opt-in) qué slots / namespace / capabilities usa; el host
  valida el manifest antes de registrar (`remote-loader.md` punto 5).
- `guards` deny-by-default: si el remote declara `requiredRole` / `requiredCapability`
  y no registra `guard`, la ruta se deniega.
- `PluginErrorBoundary` aísla crashes de un remote; no tumba el shell.

## 4. i18n

Cada remote registra su propio namespace en `i18next` en `onBoot`:
`i18n.addResourceBundle('es', 'tercero-x', es, true, false)`. El host NO pisa los
namespaces reservados (`auth, chat, contacts, agents, common`). Para coordinar
textos comunes, el host expone un namespace `common` que el remote puede consumir
pero no sobrescribir.

## 5. Lo que NO se comunica por MF

- Estado mutable del host hacia el remote mediante mutators en `runtimeContext`
  (el contrato lo prohíbe: `types.ts:71-75`). Usar contexto React interno del remote.
- Llamadas a APIs de terceros directas desde el remote: deben ir por proxy backend
  (mismo principio que el modelo in-tree).
