# 02 — Estructura de Módulos en Module Federation

## 1. Roles

### Host (shell)
- `evo-ai-frontend-community`.
- Mantiene `vite.config.ts` con el plugin `moduleFederation` y `shared` singleton.
- Carga remotos via `RemotePluginLoader` (allowlist firmada), no hardcodeados.
- Conserva `src/extensions/` para lo propio (hibrido).

### Remote (plugin federado)
- Build independiente que expone UN punto de entrada tipado.
- Debe compartir `@/plugin-host` (mismos tipos) y `shared` singleton con el host.
- Se despliega como `remoteEntry.js` firmado; su URL/version entra en la allowlist.

## 2. Carpeta de un remote (disciplina Perfex + tipos TS)

```
remote/evo-plugin-tercero/
├── vite.config.ts            # moduleFederation: exposes './plugin-manifest'
├── tsconfig.json             # mismo @/plugin-host que el host
├── package.json
└── src/
    ├── entry.ts              # export const manifest: PluginManifest
    ├── manifest.ts           # PluginManifest (id, slots, routes, guard)
    ├── index.ts              # onBoot / i18n (opcional)
    ├── components/
    │   └── MiSlot.tsx
    ├── pages/
    │   └── MiPagina.tsx
    └── i18n/
        ├── es.json
        └── pt-BR.json
```

Regla: el remote NUNCA importa del core salvo el tipo `PluginManifest` de
`@/plugin-host`. El core nunca importa del remote.

## 3. Contrato de exposición

Cada remote expone exactamente el manifest tipado:

```ts
// src/entry.ts
import type { PluginManifest } from '@/plugin-host';
import { MiSlot } from './components/MiSlot';

export const manifest: PluginManifest = {
  id: 'tercero-x',
  slots: { 'header.right': [{ id: 'tercero-x.action', order: 10, component: MiSlot }] },
  routes: [
    { id: 'tercero-x.page', path: '/tercero-x', namespace: 'customer', layout: 'main',
      element: () => import('./pages/MiPagina') },
  ],
  guard: ({ requiredRole, runtimeContext }) => {
    const role = (runtimeContext as { role?: string } | undefined)?.role;
    return !requiredRole || role === requiredRole;
  },
};
```

## 4. Mapeo al PluginManifest real

`src/plugin-host/types.ts:112` define `PluginManifest`:
`id`, `onBoot?`, `providers?`, `slots?`, `routes?`, `navItems?`, `guard?`,
`runtimeContext?`.

El remote usa ESTE tipo. `validatePluginManifest` (en el loader) rebota cualquier
`SlotId` fuera de la lista real y cualquier campo malformado.

> `runtimeContext`: un solo remote "core" puede declararlo; el resto usa contexto
> React interno. El loader respeta first-wins del host (`types.ts:76`).
