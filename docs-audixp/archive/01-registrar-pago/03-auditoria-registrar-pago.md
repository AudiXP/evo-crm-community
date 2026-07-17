# Auditoría: Extensión "Registrar Pago" (Evo CRM Community)

**Fecha:** 2026-07-16
**Autor de la revisión:** Auditoría técnica (Kilo)
**Repositorio base:** `evolution-foundation/evo-crm-community` (monorepo con submódulos)
**Submódulo afectado:** `evo-ai-frontend-community`
**Estrategia aplicada:** Fork (AudiXP) + rama `feature/registrar-pago` + carpeta aislada `src/extensions/`

---

## 1. Resumen

Se revisó el trabajo realizado siguiendo la guía de Gemini para agregar un botón
**"Registrar Pago"** al final de la ventana de conversaciones, que abre un modal con
el formulario: número de comprobante, monto y banco.

Se encontraron **3 problemas estructurales** en la implementación previa y se corrigieron.
El estado final es funcional y compatible con la estrategia de mínimo impacto.

---

## 2. Estado de la configuración Git (✅ correcto)

Dentro de `evo-ai-frontend-community`:

```
origin   -> https://github.com/AudiXP/evo-ai-frontend-community.git
upstream -> https://github.com/evolution-foundation/evo-ai-frontend-community.git
rama actual: feature/registrar-pago
```

La configuración de fork + upstream está bien hecha.

---

## 3. Problemas encontrados y corregidos

### ❌ Problema 1 — Archivos fuera del submódulo (CRÍTICO)
Los archivos de la extensión se habían creado en:
`C:\evo-crm-community\src\extensions\registrar-pago\...`

Ese path está **fuera** del submódulo `evo-ai-frontend-community`, por lo que Git del
frontend **jamás los rastrearía** y no se subirían a tu fork (AudiXP). El monorepo
`evo-crm-community` los veía como archivos sueltos sin seguimiento.

**✅ Corrección:** se movieron a
`evo-ai-frontend-community/src/extensions/registrar-pago/` y se eliminó la carpeta
equivocada del nivel raíz.

### ❌ Problema 2 — Falta el punto de contacto con el código oficial
La guía de Gemini indicaba modificar `ChatInput.tsx`. En este repositorio el componente
real es `src/components/chat/message-input/MessageInput.tsx` (no existe `ChatInput.tsx`).
No se había editado ningún archivo del composer, así que el botón **nunca se renderizaba**.

**✅ Corrección:** en `MessageInput.tsx` se agregaron:
- Import de la extensión (1 línea).
- Renderizado `<RegistrarPagoExtension conversationId={conversationId} />` dentro del
  bloque de acciones del composer (junto a Macros/Emoji/+).

### ❌ Problema 3 — Estética del modal rota (no usa el design system)
El modal original usaba clases `bg-zinc-900`, `bg-zinc-800`, etc., que **no existen** en
este proyecto. El frontend utiliza el design system `@evoapi/design-system` con clases
`bg-background`, `border-border`, `text-muted-foreground`, `text-destructive`.

**✅ Corrección:** el modal ahora usa `Dialog`, `DialogContent`, `DialogHeader`,
`DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input` y `Label` del
design system, manteniendo la coherencia visual con el resto del CRM.

---

## 4. Archivos finales

```
evo-ai-frontend-community/
├── src/
│   ├── components/chat/message-input/MessageInput.tsx   (modificado: +import, +1 render)
│   └── extensions/registrar-pago/
│       ├── RegisterPaymentModal.tsx                     (modal con react-hook-form + zod)
│       └── RegistrarPagoExtension.tsx                   (botón + estado del modal)
```

Punto de impacto en código oficial: **solo 2 inserciones** en `MessageInput.tsx`
(1 import + 1 etiqueta JSX). Esto hace que un futuro `git rebase upstream/main` resuelva
casi siempre sin conflictos.

---

## 5. Validación pendiente

- ⚠️ **No se pudo ejecutar `npm run lint` ni `tsc`** porque `node_modules` no está instalado
  en el entorno local. Se recomienda instalar dependencias y correr:
  ```bash
  cd evo-ai-frontend-community
  npm install
  npm run lint
  npm run build
  ```
- ⚠️ **Backend no implementado.** `handlePaymentSubmit` solo hace `console.log`. Para
  guardar el pago de verdad falta:
  1. Endpoint en `evo-ai-crm-community` (Rails): modelo `Payment` + controller.
  2. Servicio en el frontend que haga `POST /api/v1/payments` con
     `{ receiptNumber, amount, bank, conversationId }`.

---

## 6. Cómo mantener los cambios sincronizados (resumen operativo)

```bash
cd evo-ai-frontend-community

# 1. Guardar progreso en TU fork (AudiXP)
git add .
git commit -m "feat: agregar extension registrar pago en conversaciones"
git push origin feature/registrar-pago

# 2. Traer novedades del repo oficial sin perder tus cambios
git fetch upstream
git rebase upstream/main
# (si hay conflicto, será casi siempre solo en MessageInput.tsx)
```

---

## 7. Conclusión

La lógica de la extensión (botón + modal con validación Zod) era correcta. Los errores
eran de **ubicación** (fuera del submódulo) y de **integración/estética** (no se conectaba
al composer real y no usaba el design system). Todo está ahora corregido y listo para
instalar dependencias, validar y continuar con la integración al backend.
