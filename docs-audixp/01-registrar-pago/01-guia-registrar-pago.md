# Guía: Botón "Registrar Pago" en Conversaciones (adaptada al proyecto local)

**Repositorio:** `evolution-foundation/evo-crm-community` (monorepo con submódulos Git)
**Submódulo frontend:** `evo-ai-frontend-community`
**Tu fork:** `https://github.com/AudiXP/evo-ai-frontend-community.git`
**Rama de trabajo:** `feature/registrar-pago`

Esta guía es la versión **adaptada y corregida** de la conversación con Gemini. Se ajusta
a la estructura real de este repositorio (nombres de archivos, design system, aliases y
rutas comprobadas en el código local) e incorpora el formulario de **Teusa Track** como
destino de los datos.

---

## 1. Objetivo de la guía

Esta guía persigue dos propósitos entrelazados:

### 1.1 Agregar un botón personalizado en la ventana de conversaciones
El objetivo funcional es incorporar, al final de la barra de entrada de mensajes del chat
(donde están los botones de adjuntar `+`, emoji, respuestas rápidas y macros), un botón
propio **"Registrar Pago"**. Al hacer clic, abre un **modal con un formulario** cuyos
campos corresponden al sistema **Teusa Track**:

- **Factura** (texto, requerido)
- **Método de pago** (select: Transferencia / Efectivo / Tarjeta / Zelle, requerido)
- **Monto** (número positivo, requerido)
- **Estatus de pago** (select: Pendiente Confirmación / Aprobado / Rechazado, requerido)
- **Paid at** (fecha y hora de pago, requerido)
- **Referencia** (texto, opcional)
- **Comentarios** (texto, opcional)
- **Soporte pago** (adjunto de archivo, opcional)

El formulario se valida con `react-hook-form` + `zod` y respeta la estética del CRM vía el
design system `@evoapi/design-system`.

### 1.2 Mantener el código personalizado sincronizado con un repo que cambia constantemente
El repositorio oficial de Evolution Foundation se actualiza con frecuencia. Si modificamos
directamente los archivos del código core de las conversaciones, cada actualización generará
**conflictos de fusión (merge conflicts)** que hay que resolver a mano.

El segundo objetivo es integrar el botón de forma que, al traer cambios del upstream, **Git
resuelva la mayoría de las actualizaciones automáticamente**. Se logra aislando todo el
código propio en una carpeta propia y tocando el mínimo número de líneas del código oficial.

### 1.3 Enviar los datos a Teusa Track
Al guardar, el formulario debe enviar los campos (más el archivo de soporte) al endpoint de
Teusa Track vía `multipart/form-data`, usando una variable de entorno para la URL.

---

## 2. Las tres mejores estrategias para proteger tus cambios

Ordenadas de la más recomendada / moderna a la más tradicional:

### Estrategia 1 — Arquitectura Plug-and-Play (inyección de componentes) ⭐ Más recomendada
Crear los componentes como módulos totalmente independientes y aprovechar hooks/contextos
globales del frontend para "inyectar" el botón. Si el repo no expone plugins, se aplica un
**wrapper** en el punto de entrada del composer: carpeta aislada `src/extensions/registrar-pago/`
y, en el componente original, solo **una línea** para importar y renderizar la extensión.

- **Ventaja:** el archivo oficial solo difiere en 1-2 líneas; Git resuelve la actualización
  automáticamente el 99% de las veces.
- **Limitación:** depende de un punto de inyección estable.

### Estrategia 2 — Fork + Rama de personalización (estándar open-source)
1. Fork del repo oficial a tu cuenta (AudiXP).
2. Definir el repo original como remote `upstream`.
3. Rama específica `feature/registrar-pago`.
4. Actualizar con `git fetch upstream` + `git rebase upstream/main`.

- **Ventaja:** separa "oficial" de "tuyo"; el rebase reaplica tus cambios encima de los
  nuevos, haciendo la resolución de conflictos muy limpia.
- **Desventaja:** requiere disciplina con Git (rebase/merge).

### Estrategia 3 — Microfrontends / Módulos Federados (la más pro)
Si el proyecto usa Vite/Webpack con *Module Federation*, "Registrar Pago" se construye como
micro-aplicación consumida desde una URL externa en runtime. No se toca el código fuente.

- **Ventaja:** desacoplamiento total.
- **Desventaja:** requiere arquitectura preparada; sobre-ingeniería para un botón.

---

## 3. Estrategia seleccionada

Combinación de **Estrategia 2 (Fork + Rama)** + **Estrategia 1 (carpeta aislada /extensions)**:

- Fork `AudiXP/evo-ai-frontend-community`, rama `feature/registrar-pago`, `upstream` oficial.
- Todo el código propio en `src/extensions/registrar-pago/` (carpeta que upstream no conoce).
- Único punto de contacto con el código oficial: `MessageInput.tsx`, **2 inserciones**
  (1 import + 1 etiqueta JSX).

Es la forma más rápida, segura y estándar para el ecosistema React de Evo CRM.

---

## 0. Conceptos clave del monorepo

`evo-crm-community` es un paraguas que apunta a repositorios separados vía **submódulos**.
El frontend de la UI vive en `evo-ai-frontend-community/`. Por eso **todos tus cambios de UI
van DENTRO de esa carpeta**, nunca en la raíz de `evo-crm-community`.

```
cd evo-ai-frontend-community
git remote -v
# origin   -> https://github.com/AudiXP/evo-ai-frontend-community.git   (tu fork)
# upstream -> https://github.com/evolution-foundation/evo-ai-frontend-community.git (oficial)
```

---

## 4. Estructura de archivos objetivo

```
evo-ai-frontend-community/
├── src/
│   ├── vite-env.d.ts                       <- Tipado de VITE_TEUSA_TRACK_API_URL (editado)
│   ├── components/chat/message-input/
│   │   └── MessageInput.tsx                <- ÚNICO archivo oficial modificado (2 líneas)
│   └── extensions/registrar-pago/          <- Tu código aislado (nunca tocado por upstream)
│       ├── RegisterPaymentModal.tsx        <- Modal Teusa Track (react-hook-form + zod)
│       └── RegistrarPagoExtension.tsx      <- Botón + envío FormData a Teusa Track
```

> ⚠️ **No crees `src/` en la raíz de `evo-crm-community`**. Debe ir dentro del submódulo
> `evo-ai-frontend-community/src/...` o Git no lo rastreará.

---

## 5. Paso A — Crear la carpeta aislada `src/extensions/registrar-pago/`

### 5.1 `RegisterPaymentModal.tsx`

Usa el **design system del proyecto** (`@evoapi/design-system`), NO clases `bg-zinc-*`
(que no existen aquí; el proyecto usa tokens `bg-background`, `border-border`,
`text-muted-foreground`, `text-destructive`, `bg-muted`). Dependencias ya presentes en
`package.json`: `react-hook-form`, `zod`, `@hookform/resolvers`.

```tsx
import { useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system/dialog';
import { Button } from '@evoapi/design-system/button';
import { Input } from '@evoapi/design-system/input';
import { Label } from '@evoapi/design-system/label';

// Esquema de validación con Zod adaptado a Teusa Track
const paymentSchema = z.object({
  invoice: z.string().min(1, 'La factura es requerida'),
  paymentMethod: z.string().min(1, 'El método de pago es requerido'),
  amount: z.coerce.number().positive('El monto debe ser un número positivo'),
  status: z.string().min(1, 'El estatus es requerido'),
  paidAt: z.string().min(1, 'La fecha de pago es requerida'),
  reference: z.string().optional(),
  comments: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentSchema>;

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia Bancaria' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta de Crédito/Débito' },
  { value: 'zelle', label: 'Zelle' },
] as const;

export const PAYMENT_STATUS_OPTIONS = [
  { value: 'Pendiente Confirmación', label: 'Pendiente Confirmación' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'Rechazado', label: 'Rechazado' },
] as const;

interface RegisterPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PaymentFormValues, file: File | null) => Promise<void>;
  isSubmitting?: boolean;
  defaultInvoice?: string;
}

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  defaultInvoice,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoice: defaultInvoice ?? '',
      status: 'Pendiente Confirmación',
      amount: undefined,
      paidAt: '',
      reference: '',
      comments: '',
    },
  });

  const handleFormSubmit = async (data: PaymentFormValues) => {
    await onSubmit(data, selectedFile);
    reset();
    setSelectedFile(null);
    onClose();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Crear Pago Factura</DialogTitle>
          <DialogDescription>
            Completa el formulario para registrar el pago en Teusa Track.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Fila 1: Factura & Método de Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="invoice">Factura</Label>
              <Input id="invoice" type="text" placeholder="TE-FAC-00000" {...register('invoice')} />
              {errors.invoice && (
                <p className="text-sm text-destructive">{errors.invoice.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">Método de pago *</Label>
              <select
                id="paymentMethod"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...register('paymentMethod')}
              >
                <option value="">Seleccione una opción</option>
                {PAYMENT_METHOD_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>
              )}
            </div>
          </div>

          {/* Fila 2: Monto & Estatus de Pago */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Monto *</Label>
              <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Estatus de pago *</Label>
              <select
                id="status"
                className="w-full h-10 px-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                {...register('status')}
              >
                {PAYMENT_STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.status && (
                <p className="text-sm text-destructive">{errors.status.message}</p>
              )}
            </div>
          </div>

          {/* Fila 3: Paid At */}
          <div className="space-y-1.5">
            <Label htmlFor="paidAt">Paid at</Label>
            <Input id="paidAt" type="datetime-local" className="[color-scheme:dark]" {...register('paidAt')} />
            {errors.paidAt && (
              <p className="text-sm text-destructive">{errors.paidAt.message}</p>
            )}
          </div>

          {/* Fila 4: Referencia */}
          <div className="space-y-1.5">
            <Label htmlFor="reference">Referencia</Label>
            <textarea
              id="reference"
              rows={2}
              className="w-full p-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register('reference')}
            />
          </div>

          {/* Fila 5: Comentarios */}
          <div className="space-y-1.5">
            <Label htmlFor="comments">Comentarios</Label>
            <textarea
              id="comments"
              rows={2}
              className="w-full p-3 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              {...register('comments')}
            />
          </div>

          {/* Fila 6: Soporte Pago (File Upload) */}
          <div className="space-y-1.5">
            <Label>Soporte pago</Label>
            <div className="border border-dashed border-border bg-muted/50 rounded-lg p-4 text-center hover:bg-muted transition-colors relative">
              <input
                type="file"
                id="file-upload"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
              />
              <p className="text-sm text-muted-foreground">
                {selectedFile ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Archivo seleccionado: {selectedFile.name}
                  </span>
                ) : (
                  <span>
                    Arrastra y suelta tus archivos o{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400 hover:underline">Examina</strong>
                  </span>
                )}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

> **Nota:** los valores de la captura de Teusa Track (ej. `TE-FAC-13095`, deuda, balance)
> eran datos de ejemplo y **NO se hardcodean**. `invoice` se precarga vía `defaultInvoice`
> (prop opcional) o queda en blanco; los montos de deuda/balance deben venir del contexto
> real de la factura cuando se integre.

### 5.2 `RegistrarPagoExtension.tsx`

Envia los datos a Teusa Track usando `FormData` (para adjuntar el archivo). La URL y el
token se leen de `import.meta.env` (placeholders reemplazados en runtime por el
`docker-entrypoint.sh` con los valores del `environment:` del stack). Usa `toast` de
`sonner` (ya disponible en el proyecto).

```tsx
import { useState } from 'react';
import { Button } from '@evoapi/design-system/button';
import { toast } from 'sonner';
import { RegisterPaymentModal, type PaymentFormValues } from './RegisterPaymentModal';

// Endpoint y token de Teusa Track.
// El build deja placeholders que el docker-entrypoint.sh reemplaza en runtime con los
// valores del `environment:` del stack (igual que VITE_API_URL, etc.). Asi puedes
// definir la URL y el token SOLO en el stack, sin recompilar cada vez que cambien.
const TEUSA_TRACK_ENDPOINT = import.meta.env.VITE_TEUSA_TRACK_API_URL as string | undefined;
const TEUSA_TRACK_TOKEN = import.meta.env.VITE_TEUSA_TRACK_API_TOKEN as string | undefined;

// Placeholders que quedan en el JS cuando la variable NO fue inyectada (imagen recien
// construida sin valor en el stack). Se tratan como "no configurado".
const isPlaceholder = (v?: string) => !v || v.includes('_PLACEHOLDER');

interface RegistrarPagoExtensionProps {
  conversationId?: string | number;
  defaultInvoice?: string;
}

export const RegistrarPagoExtension = ({
  conversationId,
  defaultInvoice,
}: RegistrarPagoExtensionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      if (file) {
        formData.append('payment_support', file);
      }

      const headers: Record<string, string> = {};
      if (!isPlaceholder(TEUSA_TRACK_TOKEN)) {
        headers.Authorization = `Bearer ${TEUSA_TRACK_TOKEN}`;
      }

      const response = await fetch(TEUSA_TRACK_ENDPOINT as string, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error al registrar el pago en Teusa Track (${response.status})`);
      }

      toast.success('Pago creado y registrado exitosamente en Teusa Track!');
    } catch (error) {
      console.error('Error enviando pago:', error);
      toast.error('Hubo un error al procesar el pago. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-9 flex-shrink-0 gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
        onClick={() => setIsOpen(true)}
      >
        Registrar Pago
      </Button>

      <RegisterPaymentModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handlePaymentSubmit}
        isSubmitting={isSubmitting}
        defaultInvoice={defaultInvoice}
      />
    </>
  );
};
```

### 5.3 Tipado de las variables de entorno (`src/vite-env.d.ts`)

Anadir al archivo existente:

```ts
interface ImportMetaEnv {
  readonly VITE_TEUSA_TRACK_API_URL?: string;
  readonly VITE_TEUSA_TRACK_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

La URL y el token de Teusa Track se definen en el `environment:` del stack (ver
`GUIA-deploy-registrar-pago.md`). El flujo es:

1. El `Dockerfile` (fork AudiXP) compila el `dist` con placeholders
   (`VITE_TEUSA_TRACK_API_URL_PLACEHOLDER`, `VITE_TEUSA_TRACK_API_TOKEN_PLACEHOLDER`).
2. El `docker-entrypoint.sh` reemplaza esos placeholders al arrancar el contenedor con los
   valores del `environment:` del stack.
3. Asi puedes cambiar la URL/token SOLO en el stack, sin recompilar.

> Para desarrollo local puedes usar un `.env` en la raiz del frontend:
> ```
> VITE_TEUSA_TRACK_API_URL=https://api.teusatrack.com/api/v1/pagos
> VITE_TEUSA_TRACK_API_TOKEN=token-de-pruebas
> ```
---

## 6. Paso B — El ÚNICO punto de contacto con el código oficial

El componente del composer en este repo es
`src/components/chat/message-input/MessageInput.tsx` (**no** `ChatInput.tsx`).

### 6.1 Import (después de `import AudioRecorder from '../audio';`)

```tsx
// Extensión personalizada (AudiXP): botón "Registrar Pago" + modal de formulario.
// Vive aislada en src/extensions/ para minimizar conflictos al sincronizar con upstream.
import { RegistrarPagoExtension } from '@/extensions/registrar-pago/RegistrarPagoExtension';
```

### 6.2 Renderizado (junto a Macros/Emoji, antes del bloque "Message Signature")

```tsx
{/* Extensão personalizada AudiXP: Registrar Pago */}
<RegistrarPagoExtension conversationId={conversationId} />

{/* Message Signature (extra do CRM, sem equivalente no protótipo — mantido) */}
```

`conversationId` ya es prop disponible en `MessageInput` (tipo `string | number`).

---

## 7. Guardar y subir a tu fork (AudiXP)

```bash
cd evo-ai-frontend-community

git add .
git commit -m "feat: agregar extension registrar pago (Teusa Track) en conversaciones"
git push origin feature/registrar-pago
```

---

## 8. Validar en local (requiere dependencias instaladas)

```bash
cd evo-ai-frontend-community
npm install
npm run lint
npm run build      # Equivale a tsc -b && vite build
npm run dev        # Para ver el botón y probar el modal manualmente
```

> Si `node_modules` no está instalado, `lint`/`build` no pueden ejecutarse.

---

## 9. Sincronizar con el repo oficial (cuando suban novedades)

```bash
cd evo-ai-frontend-community
git checkout feature/registrar-pago
git fetch upstream
git rebase upstream/main
```

Por qué es casi inmune a conflictos: tu código entero vive en
`src/extensions/registrar-pago/` (carpeta que upstream no conoce). El único archivo donde
podría chocar es `MessageInput.tsx`, y solo por 2 líneas de inserción.

---

## 10. Correcciones aplicadas vs. la propuesta original de Gemini

| Issue en la propuesta de Gemini | Corrección aplicada |
|---|---|
| Clases `bg-zinc-900/950`, `text-zinc-300/400`, `border-zinc-800` (no existen en el proyecto) | Reemplazadas por tokens del design system (`bg-background`, `border-border`, `text-muted-foreground`, `bg-muted`, `text-destructive`) |
| `import React, { useState }` con `React.ChangeEvent` sin usar `React` | `import { useState, type ChangeEvent } from 'react'` y `ChangeEvent<HTMLInputElement>` |
| Literales con `[cite: 1]` pegados en textos y mensajes | Eliminados todos los `[cite: 1]` |
| Valores hardcodeados de la captura (`TE-FAC-13095`, deuda, balance) | No se hardcodean; `invoice` vía `defaultInvoice` opcional, resto en blanco |
| Endpoint hardcodeado en el componente | Leido de `import.meta.env.VITE_TEUSA_TRACK_API_URL` (+ `VITE_TEUSA_TRACK_API_TOKEN`), con placeholders reemplazados en runtime por `docker-entrypoint.sh` desde el `environment:` del stack; tipado en `vite-env.d.ts` |
| Sin autenticación en el `fetch` | Documentado como TODO (header `Authorization` pendiente de confirmar) |

---

## 11. Pendientes

1. **Autenticación Teusa Track:** confirmar esquema (Bearer token / API key) y añadir el
   header al `fetch`.
2. **Precarga de `invoice`/deuda:** obtener la factura real de la conversación para pasarla
   como `defaultInvoice` (hoy opcional, queda en blanco).
3. **Respuesta del endpoint:** manejar el cuerpo de la respuesta (id de pago creado) si se
   requiere mostrar confirmación con datos.
4. **Backend Evo (opcional):** si se quiere también persistir en `evo-ai-crm-community`
   (Rails), crear modelo `Payment` + controller y un servicio en el frontend.
