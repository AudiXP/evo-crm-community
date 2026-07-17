# 08 — Retos y Soluciones en Module Federation

Problemas comunes al adoptar MF en Evo CRM y como resolverlos dentro del contrato
`@/plugin-host`.

## 1. Versionado del contrato

- **Reto:** el `PluginManifest` (el contrato) evoluciona; un remote viejo puede
  enviar campos distintos.
- **Solucion:** `validatePluginManifest` valida contra los tipos actuales antes de
  `registerPlugin`. Versionar el contrato (`evoCommunityRange >=1.0.0-rc2 <2.0.0`).
  Remotos y host comparten el MISMO `@/plugin-host`. Cambios breaking = bump mayor
  del contrato y coexists estencia por version en la allowlist.

## 2. Performance de remotes

- **Reto:** cada `remoteEntry.js` es una red adicional en el arranque.
- **Solucion:** cargar remotos en `PluginHostProvider` (paralelo, no bloqueante para
  el shell). Usar `remoteEntry` pequeno que solo expone el manifest; el resto del
  codigo del remote via `import()` perezoso de sus propias rutas. Cachear por SRI hash.

## 3. Seguridad (crítico)

- **Reto:** MF ejecuta JS de origen remoto en el browser del usuario.
- **Solucion (obligatoria):** allowlist host-controlled + firma del bundle + SRI
  (los 3 primeros puntos de `remote-loader.md`). Ningun remote se ejecuta sin los
  tres. La allowlist es firmada y NO editable por end users. Manifest validado por
  schema antes de registrar. Scope opt-in.

## 4. Registro async POST-mount

- **Reto:** `PluginRoutes` exige rutas antes del mount del router; MF resuelve en
  runtime.
- **Solucion:** `registerRemotePlugin` en `PluginHostProvider` (useEffect temprano);
  tras registrar, `subscribe()` re-renderiza slots y el core re-splattera rutas desde
  `getRoutes()`. Rutas que lleguen muy tarde = warning, no crash.

## 5. runtimeContext único

- **Reto:** varios remotes podrian querer ser "el" runtimeContext.
- **Solucion:** first-wins en el host (`types.ts:76`). Solo un remote "core"
  (sesion/rol) lo declara; el resto usa contexto React interno y lee el compartido
  en `guard`/slots. Registro posterior se dropea con `console.warn`.

## 6. Sharing de React / hooks

- **Reto:** sin `singleton: true`, los remotos usan otra instancia de React y
  `PluginSlot`/`PluginErrorBoundary` fallan.
- **Solucion:** `shared` singleton para `react`, `react-dom`, `react-router-dom`,
  `@evoapi/design-system` en host y remotes (`03-configuracion-vite-mf.md`).

## 7. i18n

- **Reto:** colision de claves entre remotos.
- **Solucion:** namespace propio por remote (`tercero-x.*`); el host no pisa
  `auth, chat, contacts, agents, common`. El remote registra su bundle en `onBoot`.

## 8. Compatibilidad upstream

- **Reto:** al hacer `pull upstream main`, el `vite.config.ts` (plugin MF) y la linea
  de import en `main.tsx` pueden chocar.
- **Solucion:** MF como plugin aditivo; no tocar el core. Mantener el barril in-tree
  como ruta predominante para lo propio.

## 9. Aislamiento y Fuga de Datos (Seguridad en Runtime)

- **Reto:** Module Federation NO es un sandbox. Un remote de tercero inyectado en un
  slot (ej. `header.right`) comparte el MISMO hilo de ejecucion, DOM y ambito React
  que el host. Tecnicamente podria interceptar eventos globales o exfiltrar datos. El
  aislamiento CSS tampoco esta garantizado nativamente por MF.
- **Soluciones y restricciones duras:**
  1. **CSP estricta (requisito v1.5+):** el host debe enviar cabeceras CSP donde
     `script-src` restrinja la ejecucion SOLO a los dominios de la allowlist firmada,
     y `connect-src` limite los destinos de red (evita que un remote comprometido
     haga `fetch()` a servidores externos). SRI protege el entry, pero sin CSP un
     remote comprometido aun puede abrir conexiones arbitraras.
  2. **Prohibicion de secretos en contextos:** el host NUNCA inyecta tokens de API,
     credenciales o secretos en `runtimeContext` ni por props. El remote opera solo
     con IDs/roles. Toda peticion a APIs externas se delega a un proxy en el backend.
     El contrato ya prohíbe mutators en `runtimeContext`; aqui se prohibe ademas pasar
     secretos.
  3. **Bifurcacion de arquitectura de carga:**
     - *Remotos de alta confianza:* cargados directo via `RemotePluginLoader` (MF
       directo) para aprovechar `shared` singleton y tipado.
     - *Remotos de mercado abierto / baja confianza:* cargados aislados en `iframe`
       con atributo `sandbox` estricto, comunicandose con el host solo via
       `window.postMessage`. Se sacrifica tipado directo y sharing de React a cambio
       de seguridad absoluta del DOM. (Trade-off documentado; no es MVP.)
  4. **Aislamiento de estilos (CSS):** prohibido el uso de selectores CSS globales en
     remotos. Obligatorio CSS Modules / Scoped CSS para que el CSS de un tercero no
     corrompa la UI del host (ni viceversa).
