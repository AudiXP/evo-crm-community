# Enfoque Inicial (Gemini) adaptado a Arquitectura de Plugins

> Documento fundacional reescrito para el Enfoque B: el boton "Registrar Pago" se construye
> como un PLUGIN del contrato `@/plugin-host`, no como montaje manual en MessageInput.tsx.

Mantener tu codigo personalizado (boton y modal) al dia con un repositorio que se actualiza
constantemente es uno de los desafios mas comunes. Si modificas el codigo directamente en las
carpetas del proyecto original, cada `git pull` o actualizacion de version te costara
**conflictos de fusion (merge conflicts)** interminables.

Aqui las tres mejores estrategias, ordenadas de la mas recomendada a la mas tradicional,
**vistas desde la arquitectura de plugins**.

---

## 1. La Estrategia Ideal: Plugin Plug-and-Play (registro en el host)

En lugar de "meter mano" en el codigo core de las conversaciones, creas tus componentes como
un plugin totalmente independiente en `src/extensions/boton-registrar-pago/` y lo **registras** en
el host de plugins mediante `registerPlugin()` (contrato `@/plugin-host`). El host se encarga
de renderizarlo en el slot correspondiente (`header.right` hoy; `chat.*` cuando exista) y de
aislarlo con `PluginErrorBoundary`.

* **Paso A:** Creas la carpeta aislada `src/extensions/boton-registrar-pago/` con `index.ts`
  (entry point que llama `registerPlugin(manifest)`), `manifest.ts`, el modal y la extension.
* **Paso B:** El UNICO punto de contacto con el codigo oficial es **una linea de import** al
  inicio de `src/main.tsx` (antes de `createRoot`):

```ts
// src/main.tsx (inicio del archivo)
import '@/extensions/boton-registrar-pago';   // registra el plugin antes del mount del router
import { createRoot } from 'react-dom/client';
```

* **Ventaja:** el archivo oficial (`main.tsx`) solo difiere en 1 linea. El composer
  (`MessageInput.tsx`) **no se toca**. Git resuelve la actualizacion automaticamente el 99%
  de las veces. El boton gana `PluginErrorBoundary` automatico y deja de depender de ediciones
  manuales en el componente del chat.

---

## 2. El Enfoque Git: Fork + Rama de Personalizacion

Practica estandar de la industria para open-source:

1. Fork del repo oficial `evo-ai-frontend-community` a tu cuenta (AudiXP).
2. Define el repo original como remote `upstream`:
```bash
git remote add upstream https://github.com/evolution-foundation/evo-ai-frontend-community.git
```
3. Crea una rama especifica para tus cambios (p. ej. `feature/plugin-registrar-pago`) y
   trabaja ahi.
4. Para actualizarte con el creador:
```bash
git fetch upstream
git rebase upstream/main
```

* **Ventaja:** separa "oficial" de "tuyo"; el rebase reaplica tus cambios encima de los
  nuevos, resolviendo conflictos de forma limpia.
* **Desventaja:** requiere disciplina con Git (rebase/merge).

---

## 3. Microfrontends / Modulos Federados (la mas pro)

Si el proyecto usara Vite/Webpack con Module Federation, "Registrar Pago" se construiria como
micro-aplicacion consumida desde una URL externa en runtime. No se toca el codigo fuente.

* **Ventaja:** desacoplamiento total.
* **Desventaja:** requiere arquitectura preparada; sobre-ingenieria para un boton.

---

## Estrategia seleccionada (Enfoque B)

Combinacion de **Estrategia 2 (Fork + Rama)** + **Estrategia 1 (plugin en /extensions)**:

- Fork `AudiXP/evo-ai-frontend-community`, rama `feature/plugin-registrar-pago`, `upstream` oficial.
- Todo el codigo propio en `src/extensions/boton-registrar-pago/` (carpeta que upstream no conoce).
- Unico punto de contacto con el codigo oficial: `src/main.tsx`, **1 linea de import**
  (el plugin se registra a si mismo via `registerPlugin`). El composer NO se edita.

Es la forma mas limpia, segura y alineada al contrato del proyecto. Ver
`03-guia-plugin-registrar-pago.md` para la implementacion concreta.
