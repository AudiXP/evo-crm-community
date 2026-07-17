# 03 — Configuración de Module Federation en Vite

> El repo usa **Vite 6**, NO webpack. La configuracion de MF se hace con
> `@module-federation/vite` (o `@module-federation/enhanced`). No hay `webpack.config.js`.

## 1. Dependencias a agregar

En `evo-ai-frontend-community/package.json` (devDependencies):
- `@module-federation/vite` (compatible con Vite 6).

## 2. Configuración del HOST

```ts
// evo-ai-frontend-community/vite.config.ts (solo lo nuevo; el resto se conserva)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moduleFederation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    moduleFederation({
      name: 'evo_crm_host',
      // Los remotos NO se hardcodean aqui: se resuelven en runtime via
      // RemotePluginLoader desde la allowlist firmada.
      remotes: {},
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.6.0' },
        '@evoapi/design-system': { singleton: true },
      },
    }),
  ],
});
```

Puntos criticos:
- `react` / `react-dom` / `react-router-dom` DEBEN ser `singleton: true` para que
  los remotos usen la MISMA instancia que el host. Si no, `PluginSlot` /
  `PluginErrorBoundary` fallan por contexto/hooks distintos.
- `@evoapi/design-system` tambien singleton (la UI admin lo usa).

## 3. Configuración del REMOTE

```ts
// remote/evo-plugin-tercero/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { moduleFederation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    moduleFederation({
      name: 'tercero_x',
      filename: 'remoteEntry.js',
      exposes: { './plugin-manifest': './src/entry.ts' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        'react-router-dom': { singleton: true, requiredVersion: '^7.6.0' },
        '@evoapi/design-system': { singleton: true },
      },
    }),
  ],
});
```

`exposes: { './plugin-manifest': './src/entry.ts' }` es el contrato: el host
hace `container.get('./plugin-manifest')` y recibe el `PluginManifest`.

## 4. Resolución de remotos en runtime (no hardcodeados)

El host no lista remotos en `vite.config.ts`. En su lugar, `RemotePluginLoader`
(ver `06-guia-modulos-plugin-host-mf.md`) carga cada `remoteEntry.js` desde la
allowlist firmada y llama `container.get('./plugin-manifest')`.

Esto permite:
- Actualizar/agregar remotos sin rebuild del host.
- Que el pin Swarm pase a ser "version del remote" en la allowlist (ver
  `00-estrategia-ramas-mf.md`).

## 5. Build y tipos

- El remote y el host comparten el MISMO `@/plugin-host` (versionado del contrato).
- `tsc -b && vite build` en ambos. El `PluginManifest` debe ser idéntico en tipos.
- `tsconfig.json` del remote: `paths` `@/*` -> `./src/*` y acceso a `@/plugin-host`.
