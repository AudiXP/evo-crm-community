# Guia: Boton "Registrar Pago" como PLUGIN (arquitectura @/plugin-host)

**Repositorio:** `evolution-foundation/evo-crm-community` (monorepo con submodulos)
**Submodulo frontend:** `evo-ai-frontend-community`
**Fork AudiXP:** `https://github.com/AudiXP/evo-ai-frontend-community.git`
**Rama sugerida:** `feature/plugin-boton-registrar-pago`
**Enfoque:** B (plugin registrado en `@/plugin-host`), a diferencia de `01-registrar-pago/`
donde el boton se monta manualmente en `MessageInput.tsx`.

Esta es la version del boton Registrar Pago usando el contrato de plugins oficial. El mismo
modal y envio a Teusa Track del Enfoque A, pero el boton se inyecta via `PluginSlot` y el
plugin se registra con `registerPlugin()`.

---

## 1. Objetivo

Igual que el Enfoque A: boton "Registrar Pago" en la UI que abre un modal con el formulario
Teusa Track (Factura, Metodo de pago, Monto, Estatus, Paid at, Referencia, Comentarios,
Soporte). Pero con estas diferencias de arquitectura:

- El boton NO se monta editando `MessageInput.tsx`. Se registra como contribucion de un slot.
- Se gana `PluginErrorBoundary` automatico (un crash del plugin no tumba el chat).
- El unico punto de contacto con el core es **1 linea de import** en `main.tsx`.

---

## 2. Estructura de archivos objetivo

```
evo-ai-frontend-community/
├── src/
│   ├── vite-env.d.ts                       <- Tipado VITE_TEUSA_TRACK_* (editado, igual que A)
│   ├── main.tsx                            <- UNICO archivo oficial modificado (1 linea import)
│   └── extensions/boton-registrar-pago/          <- Tu plugin aislado (nunca tocado por upstream)
│       ├── index.ts                        <- registerPlugin(RegistrarPagoManifest)
│       ├── manifest.ts                     <- PluginManifest (slots, guard)
│       ├── RegistrarPagoExtension.tsx      <- Boton + modal + envio FormData a Teusa Track
│       └── RegisterPaymentModal.tsx        <- Modal (igual que Enfoque A, design system)
```

> El `RegisterPaymentModal.tsx` es IDENTICO al del Enfoque A (usa `@evoapi/design-system`,
> react-hook-form + zod). No se repite aqui; ver `01-registrar-pago/01-guia-registrar-pago.md`
> seccion 5.1 para el codigo completo del modal.

---

## 3. El Manifest (registro en el host)

```ts
// src/extensions/boton-registrar-pago/manifest.ts
import type { PluginManifest } from '@/plugin-host';
import { RegistrarPagoExtension } from './RegistrarPagoExtension';

export const RegistrarPagoManifest: PluginManifest = {
  id: 'registrar_pago',
  onBoot: () => console.info('[RegistrarPago] plugin inicializado'),

  // Slot oficial mas cercano al composer hoy. Cuando el core exponga un slot
  // chat.* (p.ej. chat.composer.actions), mueve el boton ahi.
  slots: {
    'header.right': [
      {
        id: 'registrar-pago.action',
        order: 20,
        component: RegistrarPagoExtension,
      },
    ],
  },

  // Guard opcional: si mas adelante quieres activar/desactivar el boton por
  // backend, lee runtimeContext y devuelve boolean. Sin guard -> el slot
  // siempre se renderiza (no hay deny-by-default si la ruta no lo exige).
  // guard: ({ runtimeContext }) => { ... },
};
```

### 3.1 Por que `header.right` y no el composer
El contrato real (`src/plugin-host/types.ts`) NO tiene un slot `chat.*` hoy. Los slots
verificados montados en el core son `header.right` (Header.tsx) y `sidebar.afterMain`
(Sidebar.tsx). Por tanto el boton se inyecta en `header.right` hasta que exista un slot de
chat oficial. Esto es una limitacion del core, no del plugin.

---

## 4. El Entry Point

```ts
// src/extensions/boton-registrar-pago/index.ts
import { registerPlugin } from '@/plugin-host';
import { RegistrarPagoManifest } from './manifest';

registerPlugin(RegistrarPagoManifest);
```

> `registerPlugin` es idempotente por `id`: registrar dos veces el mismo id -> `console.warn`
> y se ignora. El host llama `bootAllPlugins()` dentro de `PluginHostProvider` (montado en
> `App`), asi que el import del plugin debe ejecutarse ANTES de que `App` monte.

---

## 5. El UNICO punto de contacto con el codigo oficial

```ts
// src/main.tsx (al inicio del archivo, antes de createRoot)
import '@/extensions/boton-registrar-pago';   // registra el plugin antes del mount del router
import { createRoot } from 'react-dom/client';
// ... resto igual
```

Eso es todo. `MessageInput.tsx` **no se toca**. Esto hace que al hacer `git rebase
upstream/main` el unico archivo con riesgo de conflicto sea `main.tsx` (1 linea).

---

## 6. RegistrarPagoExtension.tsx (boton + envio)

Igual que el Enfoque A, pero recibe `PluginSlotComponentProps` del host (el `runtimeContext`
compartido) en lugar de `conversationId` por prop del composer. Como `header.right` no tiene
el `conversationId` del chat, el plugin debe obtenerlo de otra fuente (contexto de ruta,
selector de store, o un prop del slot si el core lo pasa). Mientras tanto, se puede leer del
store de conversaciones activa.

```tsx
import { useState } from 'react';
import type { PluginSlotComponentProps } from '@/plugin-host';
import { Button } from '@evoapi/design-system/button';
import { toast } from 'sonner';
import { RegisterPaymentModal, type PaymentFormValues } from './RegisterPaymentModal';

const TEUSA_TRACK_ENDPOINT = import.meta.env.VITE_TEUSA_TRACK_API_URL as string | undefined;
const TEUSA_TRACK_TOKEN = import.meta.env.VITE_TEUSA_TRACK_API_TOKEN as string | undefined;
const isPlaceholder = (v?: string) => !v || v.includes('_PLACEHOLDER');

export const RegistrarPagoExtension = (_props: PluginSlotComponentProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // TODO: obtener conversationId real (store de conversacion activa o prop del slot).
  const conversationId = undefined;

  const handlePaymentSubmit = async (data: PaymentFormValues, file: File | null) => {
    if (isPlaceholder(TEUSA_TRACK_ENDPOINT)) {
      toast.error('Falta configurar VITE_TEUSA_TRACK_API_URL en el stack.');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('invoice', data.invoice);
      formData.append('payment_method', data.paymentMethod);
      formData.append('amount', data.amount.toString());
      formData.append('status', data.status);
      formData.append('paid_at', data.paidAt);
      formData.append('reference', data.reference ?? '');
      formData.append('comments', data.comments ?? '');
      formData.append('conversation_id', String(conversationId ?? ''));
      if (file) formData.append('payment_support', file);

      const headers: Record<string, string> = {};
      if (!isPlaceholder(TEUSA_TRACK_TOKEN)) headers.Authorization = `Bearer ${TEUSA_TRACK_TOKEN}`;

      const response = await fetch(TEUSA_TRACK_ENDPOINT as string, { method: 'POST', headers, body: formData });
      if (!response.ok) throw new Error(`Error Teusa Track (${response.status})`);
      toast.success('Pago registrado exitosamente en Teusa Track!');
    } catch (error) {
      console.error(error);
      toast.error('Hubo un error al procesar el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline"
        className="h-9 flex-shrink-0 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
        onClick={() => setIsOpen(true)}>
        Registrar Pago
      </Button>
      <RegisterPaymentModal isOpen={isOpen} onClose={() => setIsOpen(false)}
        onSubmit={handlePaymentSubmit} isSubmitting={isSubmitting} />
    </>
  );
};
```

---

## 7. Tipado de variables (vite-env.d.ts)

Igual que Enfoque A: anadir `VITE_TEUSA_TRACK_API_URL` / `VITE_TEUSA_TRACK_API_TOKEN` a
`ImportMetaEnv`. El build deja placeholders que `docker-entrypoint.sh` reemplaza en runtime
con los valores del `environment:` del stack Swarm.

---

## 8. Diferencias respecto al Enfoque A (recapitulacion)

| Aspecto | Enfoque A (01-registrar-pago) | Enfoque B (este doc) |
|---|---|---|
| Donde vive el boton | Montado en `MessageInput.tsx` (2 lineas) | Slot `header.right` via `registerPlugin` |
| Archivos oficiales tocados | `MessageInput.tsx` | `main.tsx` (1 linea import) |
| Aislamiento de fallos | Manual (crash afecta el composer) | `PluginErrorBoundary` automatico |
| Activacion dinamica | No (siempre visible) | Posible via `guard` + `runtimeContext` |
| Riesgo de conflicto al rebase | `MessageInput.tsx` | `main.tsx` (1 linea) |

---

## 9. Pendientes propios del Enfoque B

1. **Slot de chat:** pedir/esperar un `SlotId` tipo `chat.composer.actions` para mover el boton
   al composer (hoy usa `header.right`).
2. **conversationId:** el slot `header.right` no lo provee; obtenerlo del store de conversacion
   activa o documentar prop del slot cuando exista.
3. **Activacion por backend:** implementar `guard` + `runtimeContext` si se quiere toggle on/off.
4. **runtimeContext unico:** recuerda que SOLO UN plugin puede registrar `runtimeContext` en
   todo el host (first-wins). Si no lo necesitas, usa contexto React interno.
