# Estrategia de Ramas — Ecosistema de Plugins AudiXP

Política transversal de Git para el desarrollo de módulos locales (`src/extensions/`)
en el fork `AudiXP/evo-ai-frontend-community`, dentro del monorrepo
`AudiXP/evo-crm-community` (submódulo).

## Contexto

- El fork oficial local es `upstream/main` (el `main` del proyecto evo-ai-frontend-community).
  `origin` apunta al fork `AudiXP`.
- El frontend es submódulo del monorrepo. El monorrepo padre fija un **commit SHA**
  (pin) del submódulo. Un `pull upstream main` a la ligera puede mover ese pin y
  desalinearse del padre, rompiendo el entorno Docker Swarm.
- Por eso toda rama de trabajo **debe nacer del `main` local (oficial), ya pinteado y estable**,
  y no de ramas de trabajo previas ni de `upstream/main` en vivo.

## Flujo de ramas

1. `feature/arquitectura-plugins` — rama puente de infraestructura.
   - Nace desde `main` local.
   - Contenido: SOLO convención + archivo barril `src/extensions/index.ts`.
   - NO introduce scaffolding ni helpers inventados (evita chocar con futuras
     actualizaciones menores del core).
   - `main.tsx` apunta al barril con `import '@/extensions';` (un único punto de contacto).
   - Documentación de esta política en `docs-audixp/02-arquitectura-plugins/`.

2. `feature/plugin-boton-registrar-pago` — rama del plugin concreto.
   - Nace desde `feature/arquitectura-plugins` (no desde `main` directo, para heredar el barril).
   - Crea `src/extensions/boton-registrar-pago/` y lo descomenta en el barril.
   - Migra el Enfoque A (montaje manual en `MessageInput.tsx`) al Enfoque B
     (plugin nativo `@/plugin-host`).

## Regla de pin (Swarm)

- El commit del submódulo usado por el stack Swarm debe ser uno ya validado y
  deployado, no `main` flotante.
- Antes de mover el pin en el monorrepo padre, reconstruir imagen, `docker save`,
  FTP, `docker load` y actualizar el servicio en el stack.

## Naming

- Carpeta del módulo: `src/extensions/<nombre-plugin>/` (singular, p. ej. `boton-registrar-pago`).
- Ramas: `feature/<nombre-plugin>` o `feature/arquitectura-plugins` para infra.
- Tag de imagen: `audixp-<nombre-plugin>`.
