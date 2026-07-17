# 11 — Preguntas y Respuestas: Plugins de Terceros con Module Federation

FAQ y explicación clara del ciclo de vida de un plugin de tercero en el enfoque MF,
incluyendo cómo se ve y cómo funciona `/admin/mis-modulos`. Complementa
`06-guia-modulos-plugin-host-mf.md` (diagrama) y `05-gestion-de-modulos-mf.md`.

> Referencia de UI: los `.jsx` de `archive/02-arquitectura-plugins/misc/`
> (AdminModulesPage / AdminModulesPreview) se usan SOLO como guía visual. Eran mock
> + Rails (`/api/v1/modules` inexistente) y fueron descartados; la UI real se construye
> contra `getRegisteredPlugins()` del registry en memoria.

---

## P1. ¿Cómo es el desarrollo de un plugin de tercero?

El tercero crea su **propio proyecto Vite** (no toca el código del host). Define un
`PluginManifest` con `id`, `slots`, `routes`, `guard` (el contrato real de
`@/plugin-host`) y lo expone como `./plugin-manifest`. Builda con `vite build`, lo
que produce un `remoteEntry.js` pequeño (solo el manifest) más los chunks de sus
páginas.

Clave: el remote declara `shared` singleton (react, react-dom, react-router-dom,
`@evoapi/design-system`) igual que el host, para usar la MISMA instancia de React.

## P2. ¿Cómo se "instala" ese plugin? (no es un .zip)

En Perfex/Odoo subes un `.zip` y el backend lo descomprime y ejecuta. En MF el
frontend es un bundle compilado y no puede ejecutar código arbitrario subido por UI.
La "instalación" es **dar de alta el remote en la allowlist firmada del host**:

```jsonc
// allowlist firmada (entregada al host, no editable por usuarios)
{
  "mi-plugin-tercero": {
    "url": "https://cdn.tercero.com/remoteEntry.js",
    "sriHash": "sha384-...",
    "publicKeyId": "tercero-1"
  }
}
```

Es decir: el remote ya está deployado en una URL; el host solo necesita saber que
puede cargarlo de ahí, que está firmado y no fue alterado.

## P3. Ciclo completo paso a paso (lenguaje claro)

1. **Desarrollo (tercero):** crea el proyecto, define el `PluginManifest`, declara
   `shared` singleton.
2. **Build:** `vite build` → `remoteEntry.js` + chunks.
3. **Firma:** firma el bundle con una clave que el host confía.
4. **Deploy:** publica `remoteEntry.js` en una URL (CDN / su servidor).
5. **Alta (instalación):** el operador agrega la entrada a la allowlist firmada del
   host (url + hash SRI + id de clave). Esto reemplaza al "subir .zip".
6. **Carga en runtime (host arranca):** `PluginHostProvider` lee la allowlist y, por
   cada remote: descarga `remoteEntry.js`, **verifica firma + SRI** (si falla, se
   rechaza y nunca se ejecuta), llama `container.get('./plugin-manifest')`, valida el
   manifest contra los `SlotId` reales, y hace `registerPlugin(manifest)`.
7. **Registro:** el remote entra al MISMO registry que los plugins in-tree. Sus slots
   y rutas se renderizan como cualquier plugin; si crashea, `PluginErrorBoundary` lo
   aísla.
8. **Visualización:** aparece en `/admin/mis-modulos` con badge de origen y estado.
9. **Activar/desactivar:**
   - **v1:** quitar/poner de la allowlist (configuración; no hay botón que ejecute
     código arbitrario).
   - **v2:** microservicio guarda qué remotes están activos; la UI muestra un toggle;
     al cambiar, el host recarga la allowlist (WS/SSE + polling).

Ver diagrama en `06-guia-modulos-plugin-host-mf.md` §6.5.

## P4. ¿Desde `/admin/mis-modulos` cómo se activa/desactiva un plugin?

**Aún no queda claro porque depende de la fase:**

- **v1 (documentada hoy):** la página es **solo lectura/auditoría**. Lista los remotos
  cargados, su origen, firma y grafo de dependencias. El "activar/desactivar" se hace
  quitando/poniendo la entrada de la **allowlist firmada** (config del host), no con un
  botón en la página. El toggle de la UI existiría pero deshabilitado o como "estado
  reflejado", no como acción que ejecuta código.
- **v2 (futuro, con microservicio):** sí hay botón toggle real. Al pulsarlo, el host
  llama `POST /api/v1/modules/:id/toggle` y recarga la allowlist dinámica. Aquí el
  `missing_deps` SÍ puede bloquear la activación.

No hay subida de `.zip` desde la UI en ninguna fase: eso sería inseguro en un frontend
compilado.

## P5. ¿Cómo se ve visualmente `/admin/mis-modulos`?

Basado en los `.jsx` de `misc` (como guía visual, adaptado al registry real):

- **Header:** título "Módulos", subtítulo "Activa o desactiva extensiones instaladas
  en esta instancia", y fila de stats: Total instalados / Activos / Con problemas.
- **Toolbar:** buscador (por nombre/descripción) + pestañas (Todos / Activos /
  Inactivos).
- **Lista de tarjetas (una por plugin):** muestra
  - nombre + versión (`v1.1.0`),
  - descripción,
  - autor ("por AudiXP"),
  - **toggle** de activación (verde cuando activo; deshabilitado si faltan deps),
  - **badge de estado**: "Listo" (verde) / "Dependencias faltantes" (ámbar) / "Error"
    (rojo),
  - **tags de slots** consumidos (`header.right`, `sidebar.afterMain`, …) y
    **tags de rutas** (`/mi-reporte`, …),
  - si `depsOk` es false: "Requiere: <ids faltantes>".
- **Novedad MF vs los .jsx:** cada tarjeta también muestra
  - **badge de origen**: `in-tree` (verde) vs `remote` (ámbar),
  - **estado de firma**: `firmado` / `firma-invalida` (del `RemotePluginLoader`),
  - **URL del remote** y **versión del `remoteEntry.js`**.
- **Nota para desarrolladores:** indica que la fuente de verdad es
  `getRegisteredPlugins()` (registry en memoria), no `/api/v1/modules`.
- **Toast:** "X activado / desactivado" (en v2, tras llamar al microservicio).

La maqueta de `misc` usa clases inline `bg-zinc-*` / colores fijos; la UI real debe
usar `@evoapi/design-system` (NO clases `bg-zinc-*`), según restricción del proyecto.

## P6. ¿Por qué no un .zip en la UI como Perfex/Odoo?

El frontend de Evo es un bundle compilado con Vite. Recibir un `.zip`, descomprimirlo
y ejecutar TS/JS arbitrario en el navegador sería un agujero de seguridad grave. MF
resuelve lo mismo (código de terceros en runtime) pero de forma segura: el remote es
un build firmado ya deployado, y el host solo lo acepta si pasa allowlist + firma + SRI.

## P7. ¿El plugin de tercero puede romper el shell?

No. Cada contribución se envuelve en `PluginErrorBoundary`. Un crash en un remote no
tumba el shell (igual que los plugins in-tree).

## P8. ¿Puede un tercero leer datos de otros plugins?

No por defecto. El `runtimeContext` del host es **único** (first-wins); solo un remote
"core" (sesión/rol) lo declara. Los demás usan su propio contexto React interno y
leen el `runtimeContext` compartido en sus `guard`/slots. El contrato prohíbe exponer
mutators por `runtimeContext`.

## P9. ¿Cómo se agrega un plugin nuevo de tercero y cómo se ve la UI?

### Flujo de "agregar" (NO es subir un .zip)
1. **Tercero entrega el build:** `vite build` → `remoteEntry.js` + chunks, firmado con
   clave confiable, deployado en una URL.
2. **Alta en allowlist firmada del host** (esto es el "agregar"; ver P10):
   ```jsonc
   {
     "mi-plugin-tercero": {
       "url": "https://cdn.tercero.com/remoteEntry.js",
       "sriHash": "sha384-...",
       "publicKeyId": "tercero-1"
     }
   }
   ```
3. **Carga automática al arrancar el host:** `PluginHostProvider` descarga, **verifica
   firma + SRI** (si falla → se rechaza), obtiene `./plugin-manifest`, valida contra
   `SlotId` reales, y hace `registerPlugin(manifest)`.
4. **Aparece en la UI** con badge `remote` y estado de firma `firmado`.

### Diseño de `/admin/mis-modulos`
- **Ruta:** `/admin/mis-modulos` (`namespace:'admin'`, `requiredRole: ACCOUNT_OWNER`,
  `guard` obligatorio; acceso por URL directa).
- **Header:** "Módulos" + stats (Total / Activos / Con problemas).
- **Toolbar:** buscador + pestañas (Todos / Activos / Inactivos).
- **Tarjeta por plugin:** nombre+versión, descripción, autor, **toggle** de activación
  (deshabilitado si faltan deps), badge de estado (`Listo` / `Dependencias faltantes` /
  `Error`), tags de **slots** y **rutas**, y novedades MF: badge **origen**
  (`in-tree`/`remote`), **estado de firma** (`firmado`/`firma-invalida`), **URL del
  remote** + versión del build, y grafo `dependsOn` (`ok`/`missing_deps`).
- **v1:** solo lectura/auditoría (el toggle refleja la allowlist, no ejecuta código).
  **v2:** toggle persistente vía microservicio.
- UI con `@evoapi/design-system`, NO clases `bg-zinc-*`. Mock visual y detalle en
  `12-diseno-ui-admin-modulos.md`.

## P10. ¿No se puede dar de alta el remote desde el mismo /admin/mis-modulos?

**No, por diseño y por seguridad.** La "alta en la allowlist firmada" es una
operación de **configuración del host**, no una acción de usuario en la UI, y hay
razones concretas:

- **Ejecución de código ajeno:** dar de alta un remote significa que el host va a
  **descargar y ejecutar JS de un origen externo** en el navegador de todos los
  usuarios. Permitirlo desde una pantalla cualquiera sería un agujero enorme: cualquiera
  con acceso a la UI podría inyectar código arbitario. Por eso está protegido por
  **allowlist + firma + SRI**, controlados por el operador que despliega el shell.
- **La allowlist es firmada y no editable por usuarios** (ver `remote-loader.md`).
  `/admin/mis-modulos` es una página de **auditoría/lectura** (v1), no un panel de
  "instalar". Igual que en Odoo/Perfex la instalación la hace un admin con acceso al
  servidor/backoffice, aquí la "instalación" la hace quien opera el despliegue.
- **Separación de responsabilidades:** el frontend nunca decide qué remotos son
  confiables; eso lo decide la configuración firmada del host en el pipeline de deploy.
- **v2 (futuro):** sí puede haber un botón de activar/desactivar persistente en la UI,
  pero **solo sobre remotos YA dados de alta en la allowlist**. La carga inicial
  (dar a conocer un nuevo origen) sigue siendo configuración del host, no acción UI.

En resumen: `/admin/mis-modulos` **lista y audita** los remotos que el host ya conoce
por su allowlist; **no es el lugar para dar de alta nuevos orígenes**.

## P11. Paso a paso: la allowlist firmada en el pipeline de deploy

La allowlist NO se escribe en la UI ni en el navegador. Es un **archivo de
configuración firmado** que acompaña al despliegue del shell. Flujo:

1. **El tercero publica su remote.** `vite build` → `remoteEntry.js` + chunks,
   servidos en una URL (CDN). El tercero (o AudiXP) genera la **firma** del bundle
   con una clave confiable y publica el `sriHash` (Subresource Integrity).
2. **El operador registra la entrada.** Crea/actualiza el documento allowlist:
   ```jsonc
   {
     "mi-plugin-tercero": {
       "url": "https://cdn.tercero.com/remoteEntry.js",
       "sriHash": "sha384-...",
       "publicKeyId": "tercero-1"
     }
   }
   ```
3. **Se firma el documento allowlist.** Con la clave privada del operador (distinta
   de la del tercero). Esto garantiza que nadie puede alterar la allowlist en tránsito
   ni en reposo.
4. **Llega al host en el deploy.** El pipeline (build imagen → FTP → `docker load` →
   stack Swarm, ver `archive/01-registrar-pago/02-deploy-registrar-pago.md`) entrega
   el allowlist firmado al contenedor del frontend (variable de entorno, archivo
   montado, o config del stack). El host NUNCA lo edita; solo lo lee.
5. **Verificación en runtime.** Al arrancar, `RemotePluginLoader`:
   - comprueba la **firma del documento allowlist** con la clave pública del operador,
   - por cada entrada: descarga `remoteEntry.js`, verifica **SRI** contra `sriHash`,
     valida la **firma del bundle** con `publicKeyId`,
   - si algo falla → el remote se **rechaza** y no se ejecuta (se registra el error).
6. **Registro.** Solo los remotes que pasan todo lo anterior llegan a
   `registerPlugin(manifest)` y aparecen en `/admin/mis-modulos`.

> Principio: el frontend **consume** la allowlist firmada; no la **produce**. Quien
> produce/configura orígenes confiables es el pipeline de deploy del operador.

## P12. ¿Y un marketplace de terceros donde el admin agrega plugins desde la UI?

Tu punto es válido: si habrá **marketplace** (catálogo de terceros que el admin revisa
y "compra"), meterle la allowlist a mano en el deploy no escala. Propuesta: **no
eliminas la allowlist firmada, le pones un mediador de confianza** (un microservicio),
para que la UI pueda pedir altas sin romper la seguridad de P10.

### Arquitectura propuesta (v2+)
```
[Admin] --(1) "instalar X"--> [/admin/mis-modulos]
        <-------------------(5) estado
[Host frontend] --(2) POST /marketplace/install {remoteId}
        --> [Microservicio catálogo/allowlist]
              - valida que remoteId existe en el CATÁLOGO FIRMADO del marketplace
              - valida firma + SRI del remote contra claves del marketplace
              - firma y escribe la entrada en la allowlist del host (o la sirve firmada)
        <--(3) allowlist actualizada (firmada)
[Host] --(4) recarga allowlist (WS/SSE + polling) y carga el remote
```

### Por qué esto sigue siendo seguro (y resuelve P10)
- El admin **no escribe orígenes arbitrarios**: solo elige de un **catálogo firmado**
  curado por AudiXP/terceros de confianza. No hay campo "pegá una URL cualquiera".
- El microservicio es quien **firma** la allowlist, no el navegador. El frontend sigue
  sin decidir qué es confiable; lo decide el servicio que ya tiene las claves.
- Antes de instalar, el servicio verifica **firma + SRI** del remote (reutiliza la
  lógica de `remote-loader.md`). Si el remote del catálogo fue alterado, se rechaza.
- El frontend solo ejecuta lo que el allowlist firmada (ahora emitida por el
  microservicio) le autoriza. El toggle de activar/desactivar persiste en el
  microservicio.

### UX en /admin/mis-modulos (marketplace)
- Pestaña nueva **"Marketplace"** (además de Todos/Activos/Inactivos): lista del
  catálogo firmado con nombre, precio/plan, autor, badge `instalado`/`disponible`.
- Botón **"Instalar"** en cada item disponible → llama al microservicio → tras
  confirmación, el remote aparece en "Instalados" y se carga.
- Botón **"Desinstalar"** → quita la entrada de la allowlist (vía microservicio).
- La pestaña "Todos" sigue mostrando estado, firma y orígenes como en el diseño actual.

### Fases sugeridas
- **v1:** allowlist firmada manual en deploy (P11). UI solo lectura.
- **v1.5:** microservicio sirve la allowlist firmada (el deploy ya no la edita a mano,
  pero sigue sin UI de instalación).
- **v2:** marketplace + botones Instalar/Desinstalar en UI, mediados por el
  microservicio que firma. Toggle persistente de activación.

### Revocación en caliente (Kill-Switch)
Si la clave de un tercero o su CDN se comprometen, la v2 del microservicio de
marketplace NO depende de un redeploy del host. El microservicio emite una orden de
revocación que invalida la entrada en la allowlist dinámica y la empuja en caliente a
los clientes conectados vía WebSockets/SSE. Al recibirla, el host desmonta
dinámicamente los componentes del remote del registry en memoria (kill-switch).

### Contrato y restricción del Design System
`shared: { '@evoapi/design-system': { singleton: true } }` evita duplicar la librería,
pero si un remote se compiló con una versión mayor con breaking changes, la UI
colapsará. Por eso, además de la validación de esquema en `validatePluginManifest`
(que debe verificar la versión semántica del contrato del manifest), el contrato de
aceptación para terceros impone un **rango estricto de compatibilidad** (ej. `^1.4.0`)
en el `package.json` del remote. Si la versión requerida excede el rango del host, el
loader aborta el registro con estado `incompatible_core_version`.

Ver `12-diseno-ui-admin-modulos.md` (pestañas) y `09-roadmap-evolutivo.md` (v2).

---

## Relación con las fases

Arrancar por la rama puente **`feature/arquitectura-plugins-mf`** (ver
`00-estrategia-ramas-mf.md`): crea la infra MF en el host (vite.config con MF,
`RemotePluginLoader`, `manifest-schema`, allowlist firmada). Sin ella, ningún remote
de tercero puede cargarse. Las fases completas están en `09-roadmap-evolutivo.md`.
