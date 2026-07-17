# Gestion de Modulos en Evo CRM (analisis + diseno de pagina admin)

Responde: "existe una pagina en el CRM para cargar modulos al estilo Perfex CRM u
Odoo?" y define el diseno de una pagina admin propia para el ecosistema de plugins
AudiXP. Documento de DISENO; la construccion se hace despues (ver `05-plan-implementacion.md`).

> Verificado leyendo `src/plugin-host/*` y `src/routes/index.tsx` directamente.
> Sin inventar backends: este monorepo NO usa Rails ni tiene `/api/v1/modules`.

---

## 1. Respuesta directa

**No existe** una pagina tipo "App Store" de Odoo ni "Modules" de Perfex donde subas
un `.zip` y el sistema lo instale/active con un click. Lo que Evo CRM tiene es el
contrato local `@/plugin-host`: un sistema de extensibilidad **a nivel de codigo**
(code-time), no una UI administrativa de instalacion en runtime.

| Capacidad | Odoo | Perfex CRM | Evo CRM (hoy) |
|---|---|---|---|
| Instalar modulo desde UI (subir zip) | Si | Si | **No** |
| Activar/desactivar desde UI (toggle persistente) | Si | Si | **No** (no hay backend de modulos) |
| Sistema de extensibilidad | `__manifest__.py` | Hooks PHP | `@/plugin-host` (registerPlugin) |
| Dependencias entre modulos | Automatico | Manual | `guard` manual en manifiesto |

## 2. Modelo real: "code-time", no "runtime administrable"

- Un modulo **existe** si su codigo esta importado en el barril `src/extensions/index.ts`.
- Se **activa** compilando/reconstruyendo la imagen; se **desactiva** comentando su
  linea en el barril y reconstruyendo.
- **No hay** un panel donde un usuario final prenda/apague modulos contra una DB.
- Registro en memoria: `registerPlugin(manifest)` (idempotente por `id`).

## 3. Que slots admin estan REALMENTE montados (verificado)

| Slot / API | Estado en el core | Ubicacion |
|---|---|---|
| `PluginRoutes({ namespace: 'admin' })` | **MONTADO** | `routes/index.tsx:1534` (envuelto en `PrivateRoute` + `MainLayout`) |
| `PluginRoutes({ namespace: 'customer' })` | MONTADO | `routes/index.tsx:1543` |
| `PluginRoutes({ namespace: 'public' })` | MONTADO | `routes/index.tsx:1554` |
| `header.right` / `header.left` | MONTADO | `Header.tsx` 220/275/276 |
| `sidebar.afterMain` | MONTADO | `Sidebar.tsx:203`, `Header.tsx:192` |
| `notifications.banner` | MONTADO | `App.tsx:70` |
| `setup.steps` | MONTADO | `pages/Setup/Setup.tsx:334` |
| `admin.nav` | **Tipo existe, NO montado** como PluginSlot | — |
| `settings.sections` | **Tipo existe, NO montado** | — |
| `dashboard.widgets` | **Tipo existe, NO montado** | — |

**Implicaciones para una pagina admin propia:**

1. **Viable YA:** una ruta `namespace: 'admin'` (p. ej. `/admin/mis-modulos`) SI se
   renderiza, porque `PluginRoutes({ namespace:'admin' })` esta montado.
2. **Sin menu automatico:** como `admin.nav` NO esta montado, la entrada de menu **no
   aparece sola**. Se accede por URL directa hasta que se monte `admin.nav` (parche
   local o upstream) o se agregue el link en el shell.
3. **Sin toggle persistente:** no hay backend de modulos. La primera version solo
   **lista** lo que hay en el registry en memoria.

## 4. APIs reales del registry para la pagina (exportadas de `@/plugin-host`)

Verificadas en `src/plugin-host/index.ts` y `registry.ts`:

| API | Devuelve |
|---|---|
| `getRegisteredPlugins()` | `readonly RegisteredPlugin[]` (manifiestos completos: id, slots, routes, navItems...) |
| `getPlugins()` | `readonly string[]` (solo ids) |
| `getSlotContributions(slot)` | contribuciones de un slot |
| `getRoutes(namespace?)` | rutas registradas |
| `subscribe(listener)` | se suscribe a cambios del registry; devuelve `unsubscribe` |

> No existe `useActiveModules`, `MOCK_MODULES`, ni axios a `/api/v1/modules`. Los `.jsx`
> que Gemini genero (mock + Rails) fueron descartados; usar estas APIs reales.

## 5. Diseno de la pagina admin (Enfoque B, como plugin propio)

Carpeta: `src/extensions/admin-modulos/` (un plugin mas del ecosistema).

### 5.1 Manifiesto (ruta admin real)

```ts
import type { PluginManifest } from '@/plugin-host';

export const AdminModulosManifest: PluginManifest = {
  id: 'admin-modulos',
  routes: [
    {
      id: 'admin-modulos.page',
      path: '/admin/mis-modulos',
      namespace: 'admin',          // MONTADO en routes/index.tsx
      layout: 'main',
      element: () => import('./pages/AdminModulosPage'),
      requiredRole: 'account_owner',
    },
  ],
  // navItems / admin.nav quedan pendientes: el slot admin.nav NO esta montado hoy.
};
```

### 5.2 Pagina (lista el registry en memoria, SIN backend)

```ts
// pages/AdminModulosPage.tsx (boceto)
import { useEffect, useState } from 'react';
import { getRegisteredPlugins, subscribe } from '@/plugin-host';

export default function AdminModulosPage() {
  const [plugins, setPlugins] = useState(() => getRegisteredPlugins());
  useEffect(() => subscribe(() => setPlugins(getRegisteredPlugins())), []);

  return (
    // Usar @evoapi/design-system (NO clases bg-zinc-*).
    // Por cada plugin mostrar: id, slots ocupados (Object.keys(p.slots ?? {})),
    // rutas (p.routes?.map(r => r.path)), navItems. Solo LECTURA en v1.
    // ...
  );
}
```

### 5.3 Fases de la pagina

- **v1 (esta rama, sin backend):** solo-lectura. Lista modulos instalados desde el
  registry. Sin toggle persistente. Diseno con `@evoapi/design-system`.
- **v2 (futuro, cuando exista backend real):** toggle activar/desactivar contra un
  microservicio (no Rails); propagacion via WS/SSE o polling. El frontend nunca llama
  a APIs de terceros directo (proxy backend).

## 6. Restricciones y verdades duras (no olvidar)

- `admin.nav` NO montado -> sin entrada de menu automatica.
- No hay backend de modulos -> v1 es solo lectura del registry en memoria.
- Rutas de plugin deben registrarse ANTES del mount de `<AppRouter>` (ver
  `PluginRoutes.tsx` 52-59): el import via barril en `main.tsx` lo garantiza.
- `runtimeContext`: MAXIMO UNO por host (first-wins). La pagina admin NO debe
  registrar runtimeContext; usa el registry directo.
