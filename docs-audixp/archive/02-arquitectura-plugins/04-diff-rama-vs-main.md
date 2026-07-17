# Diff: `feature/arquitectura-plugins` vs `main` oficial

Comparacion tecnica de la rama puente contra el `main` oficial local del submodulo
`evo-ai-frontend-community`.

## Resumen del diff

Exactamente **2 archivos, +13 lineas, 0 borrados**:

| Archivo | Cambio |
|---|---|
| `src/extensions/index.ts` | **Nuevo** (9 lineas). Barril/conmutador central de modulos AudiXP, con el import del plugin **comentado**. Hoy no ejecuta nada. |
| `src/main.tsx` | **+4 lineas**: comentario + `import '@/extensions';` (unico punto de contacto con el core). |

No toca componentes, rutas, admin ni el chat. Funcionalmente la app se comporta
**identica** al `main` oficial (el barril esta vacio/comentado). Es puro andamiaje:
deja el "enchufe" listo para registrar plugins.

## Contenido del barril (estado actual)

```ts
// src/extensions/index.ts
// Conmutador central de modulos locales AudiXP para Evo CRM.
// main.tsx importa este archivo una sola vez (import '@/extensions').
// Cada nuevo modulo propio se registra aqui, sin tocar el core.

// Registro de pagos (Enfoque B: plugin nativo @/plugin-host)
// import './boton-registrar-pago';

// Futuros modulos AudiXP se agregan aqui...
```

## Cambio en main.tsx

```ts
import { initGA4 } from './utils/ga4Utils';

// AudiXP: conmutador central de modulos locales (plugins propios).
// Punto de contacto unico con el core. No tocar el resto del core.
import '@/extensions';
```

## Infraestructura de plugins que YA trae el oficial (no la agregamos nosotros)

El fork oficial ya monta el host de plugins. Verificado en el codigo:

| Punto | Ubicacion | 
|---|---|
| `PluginHostProvider` (monta providers + `bootAllPlugins()`) | `App.tsx` |
| `PluginSlot id="header.right"` / `header.left` | `Header.tsx` (lineas 220, 275, 276) |
| `PluginSlot id="sidebar.afterMain"` | `Sidebar.tsx` (203), `Header.tsx` (192) |
| `PluginSlot id="notifications.banner"` | `App.tsx` (70) |
| `PluginSlot` (setup.steps) | `pages/Setup/Setup.tsx` (334) |
| `PluginRoutes({ namespace: 'admin' })` | `routes/index.tsx` (1534) |
| `PluginRoutes({ namespace: 'customer' })` | `routes/index.tsx` (1543) |
| `PluginRoutes({ namespace: 'public' })` | `routes/index.tsx` (1554) |

> Es decir: la rama `feature/arquitectura-plugins` NO reinventa el host (ya viene de
> fabrica). Solo agrega el barril como convencion de registro centralizado.

## Comando para reproducir el diff

```bash
cd C:\evo-crm-community\evo-ai-frontend-community
git diff --stat main feature/arquitectura-plugins
git diff main feature/arquitectura-plugins
```
