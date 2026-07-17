# Guía Definitiva: Implementar Módulos en Evo CRM Community

**Repositorio:** [evolution-foundation/evo-crm-community](https://github.com/evolution-foundation/evo-crm-community)  
**Contrato frontend oficial:** `@evoai/extension-points` v2.1.0  
**Stack:** React 19 · TypeScript · Vite · Ruby on Rails 7.1 · PostgreSQL  
**Versión del documento:** 3.1.0  
**Autor:** AudiXP  
**Cambios 3.1.0:** Fix transacción atómica en `toggle` · Estrategia de propagación de estado entre agentes · Guía de bootstrapping en componentes de slot · Migraciones encapsuladas por módulo

---

## 1. Introducción

**Evo CRM Community** es una plataforma open-source de soporte al cliente con IA, construida sobre React 19, TypeScript, Vite y Ruby on Rails 7.1. A medida que el negocio escala, surge la necesidad de inyectar funcionalidades a la medida sin alterar el código fuente del núcleo (*Core*).

Este documento es la guía técnica oficial para hacerlo correctamente. Combina:

- **Los principios del documento original** (aislamiento, resiliencia, ciclo de vida, seguridad).
- **El contrato real del repositorio** (`@evoai/extension-points` v2.1.0), que ya implementa la infraestructura de extensibilidad.
- **La capa Rails propia** que cubre lo que el contrato no incluye: activación dinámica, credenciales, hooks de ciclo de vida y la página de gestión de módulos.

> **Regla de oro:**  
> Lo que el contrato oficial cubre → **usar `@evoai/extension-points`**.  
> Lo que el contrato no cubre → **capa Rails propia, aislada del core**.

---

## 2. El Problema que Resuelve esta Arquitectura

Modificar directamente el código del CRM provoca tres problemas críticos:

**Merge conflicts** al sincronizar con el upstream oficial. Cualquier cambio en un componente del core entra en conflicto con las personalizaciones.

**Inestabilidad en producción.** Un error en una funcionalidad a la medida puede tumbar el flujo de conversaciones o la navegación del agente.

**Falta de control comercial.** Sin un sistema de activación por base de datos, no hay forma de controlar dinámicamente qué cliente tiene acceso a qué herramienta.

Esta arquitectura resuelve los tres: el código personalizado vive en `src/extensions/` (nunca tocado por el upstream), los errores quedan aislados por `PluginErrorBoundary` automático, y la activación se controla desde la base de datos vía Rails.

---

## 3. Lo que el Contrato Oficial Ya Provee (No Reinventar)

El frontend de Evo CRM ya incluye `@evoai/extension-points` v2.1.0. Esto significa que **no hay que construir** `ExtensionPoint.tsx`, `registry-validator.ts` ni ningún sistema de error boundary propio. Todo eso ya existe.

### 3.1 Slots de inyección disponibles

Estos son los únicos puntos de inyección de UI garantizados por el contrato:

| Slot ID | Estado | Posición en la UI |
|---|---|---|
| `header.right` | **Activo** | Derecha del header (escritorio y móvil) |
| `header.left` | **Activo** | Izquierda del header (móvil) |
| `sidebar.afterMain` | **Activo** | Debajo de la navegación principal del sidebar |
| `notifications.banner` | **Activo** | Banner superior de la app |
| `dashboard.widgets` | Reservado | Grid del dashboard (sin mount aún) |
| `settings.sections` | Reservado | Secciones de configuración (sin mount aún) |
| `admin.nav` | Reservado | Navegación del área admin (sin mount aún) |

> **Importante:** Los slots del documento original (`chat_actions`, `sidebar_menu`, `contact_profile`) **no existen** en el contrato real. Usarlos causaría que las contribuciones se ignoren silenciosamente.

### 3.2 Lo que el contrato maneja automáticamente

- **Error boundaries:** Cada contribución de slot se envuelve automáticamente en `PluginErrorBoundary`. Un crash en tu componente no afecta al resto de la UI. No necesitas `react-error-boundary` manual.
- **Deny-by-default en rutas:** Si una ruta declara `requiredCapability` pero no hay guard registrado, el acceso es denegado. No hay escalación de privilegios silenciosa.
- **Routing:** El `PluginHostProvider` maneja la inyección de rutas en el router principal. No se necesita modificar `App.tsx` ni el router del core.
- **Orden de slots:** Las contribuciones se ordenan por el campo `order` (ascendente), con desempate por `id.localeCompare`.

---

## 4. Estructura de Archivos

```text
src/extensions/
└── mi-modulo/
    ├── index.ts                        ← Entry point: registerPlugin() + i18n
    ├── manifest.ts                     ← Contrato con @evoai/extension-points
    ├── components/
    │   ├── ConversationAction.tsx      ← Botón en header.right
    │   └── SidebarSection.tsx          ← Widget en sidebar.afterMain
    ├── pages/
    │   ├── MiModuloPage.tsx            ← Vista completa (ruta /mi-modulo)
    │   └── AdminModulosPage.tsx        ← Gestión de módulos (ruta /admin/modulos)
    ├── runtime/
    │   └── MiModuloProvider.tsx        ← Puente Rails ↔ runtimeContext
    └── i18n/
        ├── es.json
        └── pt-BR.json
```

**Regla de importación única:** El core de Evo CRM **nunca** importa nada de `src/extensions/` directamente. El único punto de contacto es la llamada a `registerPlugin()` en el entry point del módulo, ejecutada antes del mount del router.

---

## 5. Implementación Paso a Paso

### 5.1 El Provider de Runtime (puente Rails → frontend)

Este componente consulta el estado de activación en Rails y lo inyecta en el `runtimeContext` del contrato. Es la pieza que conecta los dos mundos.

Resuelve tres problemas críticos:

**Bootstrapping seguro:** `isLoading: true` como estado inicial garantiza que ningún componente de slot renderice durante los milisegundos en que la promesa de `GET /api/v1/modules` aún no resolvió. Todos los componentes de slot deben respetar este estado (ver sección 5.3).

**Propagación entre agentes:** El contrato frontend es stateless por diseño. Cuando el `account_owner` activa un módulo desde la página admin, los demás agentes conectados no se enteran hasta que recargan la página. La solución es un canal ActionCable (`ModulesChannel`) que emite un evento `modules:changed` al activar o desactivar. El Provider escucha ese canal y re-fetcha automáticamente.

**Fallo silencioso controlado:** Si la API falla (red caída, error 500), el Provider cae a `isActive: false, isLoading: false`. El módulo queda invisible pero la app no se rompe.

```tsx
// src/extensions/mi-modulo/runtime/MiModuloProvider.tsx
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import axios from 'axios';

// Evo CRM usa @rails/actioncable — ya disponible en el bundle del core
import { createConsumer } from '@rails/actioncable';

interface MiModuloCtx {
  isActive: boolean;
  isLoading: boolean;        // true durante el fetch inicial — los slots deben respetar esto
  userRole: 'account_owner' | 'agent';
  refresh: () => void;       // expuesto para que AdminModulosPage pueda forzar re-fetch
}

const Context = createContext<MiModuloCtx | undefined>(undefined);

export const useMiModuloCtx = (): MiModuloCtx | undefined =>
  useContext(Context);

const fetchModuleState = async (): Promise<Omit<MiModuloCtx, 'isLoading' | 'refresh'>> => {
  const { data } = await axios.get('/api/v1/modules');
  return {
    isActive: (data.active_modules as string[]).includes('mi_modulo'),
    userRole: data.current_user_role ?? 'agent',
  };
};

export const MiModuloProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Omit<MiModuloCtx, 'refresh'>>({
    isActive: false,
    isLoading: true,   // ← crítico: arranca en true, nunca en false
    userRole: 'agent',
  });

  const subscriptionRef = useRef<ReturnType<typeof createConsumer> | null>(null);

  const refresh = async () => {
    try {
      const next = await fetchModuleState();
      setState(s => ({ ...s, ...next, isLoading: false }));
    } catch {
      // Fallo silencioso: módulo queda inactivo, app sigue funcionando
      setState(s => ({ ...s, isLoading: false }));
    }
  };

  useEffect(() => {
    // Fetch inicial
    refresh();

    // Canal ActionCable: propaga cambios a todos los agentes conectados
    // Rails emite `ModulesChannel#modules:changed` al hacer toggle
    const cable = createConsumer('/cable');
    subscriptionRef.current = cable;

    cable.subscriptions.create('ModulesChannel', {
      received: (data: { event: string }) => {
        if (data.event === 'modules:changed') {
          refresh();
        }
      },
    });

    return () => {
      cable.disconnect();
    };
  }, []);

  return (
    <Context.Provider value={{ ...state, refresh }}>
      {children}
    </Context.Provider>
  );
};
```

> **Nota:** Si el proyecto aún no usa ActionCable, la alternativa más simple es polling corto. Reemplaza la suscripción al cable por `setInterval(refresh, 30_000)` y limpia con `clearInterval` en el cleanup del efecto. El polling cada 30 segundos es suficiente para este caso de uso sin impacto significativo en el servidor.

### 5.2 El Manifiesto

El manifiesto reemplaza al `MiModuloModule` del documento original. Usa la API real del contrato en lugar de `points[]` y `target`.

```typescript
// src/extensions/mi-modulo/manifest.ts
import type { PluginManifest } from '@evoai/extension-points';
import { ConversationAction } from './components/ConversationAction';
import { SidebarSection } from './components/SidebarSection';
import { MiModuloProvider, useMiModuloCtx } from './runtime/MiModuloProvider';

export const MiModuloManifest: PluginManifest = {
  id: 'mi_modulo',
  
  // Equivalente al onBoot del documento original
  onBoot: () => {
    console.info('[MiModulo] Inicializado.');
  },

  // ─── Contribuciones a slots oficiales ────────────────────────────
  // Reemplaza al sistema de points[] + ExtensionTarget del doc original.
  // El PluginErrorBoundary se aplica automáticamente — no hay que envolverlos.
  slots: {
    'header.right': [
      {
        id: 'mi-modulo.conversation-action',
        order: 10,
        component: ConversationAction,
      },
    ],
    'sidebar.afterMain': [
      {
        id: 'mi-modulo.sidebar-section',
        order: 1,
        component: SidebarSection,
      },
    ],
  },

  // ─── Rutas inyectadas en el router principal ──────────────────────
  // Reemplaza al routes[] manual del doc original.
  // El contrato maneja layouts y guards automáticamente.
  routes: [
    {
      id: 'mi-modulo.vista-principal',
      path: '/mi-modulo',
      namespace: 'customer',        // PrivateRoute + MainLayout automático
      element: () => import('./pages/MiModuloPage'),
      requiredCapability: 'mi-modulo.acceso',
      fallback: <div>Módulo no disponible</div>,
    },
    {
      id: 'mi-modulo.admin-modulos',
      path: '/admin/mis-modulos',
      namespace: 'admin',           // PrivateRoute + MainLayout automático
      element: () => import('./pages/AdminModulosPage'),
      requiredRole: 'account_owner',
    },
  ],

  // ─── Ítem en el sidebar ───────────────────────────────────────────
  navItems: [
    {
      id: 'mi-modulo.nav',
      label: 'Mi Módulo',
      href: '/mi-modulo',
      order: 50,
    },
  ],

  // ─── Guard de acceso ─────────────────────────────────────────────
  // Reemplaza al registry-validator.ts del doc original.
  // El contrato aplica deny-by-default si no hay guard registrado.
  guard: ({ requiredCapability, requiredRole, runtimeContext }) => {
    const ctx = runtimeContext as MiModuloCtx | undefined;
    if (!ctx?.isActive) return false;

    if (requiredRole === 'account_owner') {
      return ctx.userRole === 'account_owner';
    }
    if (requiredCapability === 'mi-modulo.acceso') {
      return true; // cualquier usuario autenticado con módulo activo
    }

    return !requiredCapability && !requiredRole;
  },

  // ─── Contexto runtime (puente Rails → slots y guards) ────────────
  runtimeContext: {
    Provider: MiModuloProvider,
    useValue: useMiModuloCtx,
  },
};
```

### 5.3 Componentes de Slot

Cada componente recibe `runtimeContext` tipado. El `PluginErrorBoundary` los envuelve automáticamente.

**Contrato de bootstrapping obligatorio:** Todo componente de slot debe seguir este patrón de tres guardas en orden estricto. Saltarse alguna provoca parpadeos visuales (*layout shift*) en el header o sidebar del CRM durante el fetch inicial.

```tsx
// src/extensions/mi-modulo/components/ConversationAction.tsx
import type { PluginSlotComponentProps } from '@evoai/extension-points';
import type { MiModuloCtx } from '../runtime/MiModuloProvider';

export const ConversationAction = ({ runtimeContext }: PluginSlotComponentProps) => {
  const ctx = runtimeContext as MiModuloCtx | undefined;

  // GUARDA 1 — contexto no disponible aún (Provider no montó)
  if (!ctx) return null;

  // GUARDA 2 — fetch inicial en curso: no renderizar nada para evitar layout shift
  // Nunca mostrar un spinner aquí — el header del CRM es un área de alta densidad visual
  if (ctx.isLoading) return null;

  // GUARDA 3 — módulo inactivo en base de datos
  if (!ctx.isActive) return null;

  // A partir de aquí, el módulo está activo y el contexto es confiable
  const handleClick = async () => {
    // Siempre a través del proxy Rails — nunca a la API de terceros directamente
    await fetch('/api/v1/mi_modulo/accion', { method: 'POST' });
  };

  return (
    <button
      onClick={handleClick}
      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
    >
      Mi Acción
    </button>
  );
};
```

> **Sobre el fallback de rutas:** El campo `fallback` en el manifiesto renderiza un componente React *en lugar* de la ruta protegida cuando el guard devuelve `false`. No es una redirección de React Router. Si el módulo se desactiva en caliente mientras el usuario está en `/mi-modulo`, el comportamiento exacto depende de cómo el Plugin Host Runtime reaccione al cambio de `runtimeContext` — esto debe probarse en desarrollo antes de deploy. Para garantizar una experiencia controlada, añadir una redirección explícita dentro del `fallback`:
> ```tsx
> fallback: <Navigate to="/dashboard" replace />
> ```

### 5.4 El Entry Point

```typescript
// src/extensions/mi-modulo/index.ts
import { registerPlugin } from '@evoai/extension-points';
import i18n from 'i18next';
import { MiModuloManifest } from './manifest';
import es from './i18n/es.json';
import ptBR from './i18n/pt-BR.json';

// Registrar traducciones bajo namespace propio
// Nunca sobreescribir namespaces del core: auth, chat, contacts, etc.
i18n.addResourceBundle('es', 'mi-modulo', es, true, false);
i18n.addResourceBundle('pt-BR', 'mi-modulo', ptBR, true, false);

// Registro en el Plugin Host Runtime
// Debe ejecutarse antes del mount del router — el import en main.tsx lo garantiza
registerPlugin(MiModuloManifest);
```

### 5.5 Registro en main.tsx (una línea)

```typescript
// src/main.tsx
import '@/extensions/mi-modulo';   // ← Esta línea, antes de todo lo demás
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

---

## 6. La Capa Rails: Solo lo que el Contrato No Cubre

El contrato frontend es stateless. No persiste qué módulos están activos, no guarda credenciales y no tiene hooks de ciclo de vida. Eso es responsabilidad exclusiva de tu capa Rails.

### 6.1 Migración

```ruby
# db/migrate/YYYYMMDDHHMMSS_create_system_modules.rb
class CreateSystemModules < ActiveRecord::Migration[7.1]
  def change
    create_table :system_modules do |t|
      t.string  :module_id,  null: false
      t.boolean :active,     null: false, default: false
      t.jsonb   :settings,   null: false, default: {}
      t.timestamps
    end
    add_index :system_modules, :module_id, unique: true
  end
end
```

### 6.2 Controlador con Ciclo de Vida

Implementa los tres hooks (Pre-Init, Post-Init, Uninstall) con dos correcciones críticas respecto a la v3.0.0:

**Transacción atómica:** En la v3.0.0, `record.save!` y `run_post_init` eran llamadas secuenciales sin protección. Si `run_post_init` fallaba (red caída, validación), el módulo quedaba `active: true` en la DB pero sin `settings` inicializados — el frontend lo vería activo y el proxy de Rails fallaría al intentar leer `settings['encrypted_token']` (nil). Ambas operaciones ahora viven dentro de una transacción: si cualquiera falla, el registro vuelve a `active: false`.

**Broadcast ActionCable:** Al finalizar el toggle exitosamente, Rails emite un evento `modules:changed` al canal `ModulesChannel`. El `MiModuloProvider` de todos los agentes conectados lo recibe y re-fetcha el estado automáticamente, sin que ningún agente tenga que recargar la página.

```ruby
# app/controllers/api/v1/modules_controller.rb
class Api::V1::ModulesController < ApplicationController

  # GET /api/v1/modules
  # Solo envía IDs públicos — la columna settings nunca sale del servidor
  def index
    active_modules = SystemModule.where(active: true).pluck(:module_id)
    render json: {
      active_modules: active_modules,
      current_user_role: current_user.role   # 'account_owner' | 'agent'
    }
  end

  # POST /api/v1/modules/:module_id/toggle
  def toggle
    authorize_admin!
    record = SystemModule.find_or_initialize_by(module_id: params[:module_id])

    if !record.active
      # PRE-INIT: Validar prerequisitos antes de abrir la transacción
      unless pre_init_ok?(record.module_id)
        return render json: {
          success: false,
          error: 'Prerequisitos de base de datos no cumplidos.'
        }, status: :bad_request
      end

      # TRANSACCIÓN ATÓMICA: save! y run_post_init son una sola unidad
      # Si run_post_init falla, el record NO queda active: true en la DB
      ActiveRecord::Base.transaction do
        record.active = true
        record.save!
        run_post_init(record)   # lanza excepción si falla → rollback automático
      end

    else
      # UNINSTALL: fuera de transacción — la limpieza es best-effort
      run_uninstall(record.module_id)
      record.update!(active: false)
    end

    # BROADCAST: notifica a todos los agentes conectados vía ActionCable
    # El MiModuloProvider de cada cliente re-fetcha /api/v1/modules al recibir esto
    ActionCable.server.broadcast('ModulesChannel', { event: 'modules:changed' })

    render json: { success: true, active: record.active }

  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, errors: e.record.errors.full_messages },
           status: :unprocessable_entity
  rescue => e
    # Captura fallos en run_post_init (red, validación de settings, etc.)
    Rails.logger.error "[Modules] toggle falló para #{params[:module_id]}: #{e.message}"
    render json: { success: false, error: 'Error al inicializar el módulo.' },
           status: :internal_server_error
  end

  # PUT /api/v1/modules/:module_id/settings
  # Endpoint exclusivo para credenciales — solo admin, nunca expuesto en /index
  def update_settings
    authorize_admin!
    record = SystemModule.find_by!(module_id: params[:module_id])
    record.update!(settings: params[:settings].permit!.to_h)
    render json: { success: true }
  end

  # POST /api/v1/mi_modulo/accion
  # Proxy seguro: el frontend nunca llama a la API de terceros directamente
  def proxy_action
    record = SystemModule.find_by!(module_id: 'mi_modulo', active: true)
    token = record.settings['encrypted_token']
    result = ExternalApiService.call(token, params)
    render json: result
  end

  private

  # PRE-INIT: Verifica prerequisitos antes de activar
  def pre_init_ok?(module_id)
    case module_id
    when 'mi_modulo'
      ActiveRecord::Base.connection.table_exists?('conversations')
    else
      true
    end
  end

  # POST-INIT: Seed de configuración + migraciones encapsuladas del módulo
  # IMPORTANTE: Las tablas propias del módulo se crean AQUÍ, no en migraciones globales.
  # Esto garantiza que solo existan en la DB del cliente que activó el módulo.
  def run_post_init(record)
    case record.module_id
    when 'mi_modulo'
      # 1. Crear tablas propias del módulo si aún no existen
      unless ActiveRecord::Base.connection.table_exists?('mi_modulo_transacciones')
        ActiveRecord::Base.connection.execute(<<~SQL)
          CREATE TABLE mi_modulo_transacciones (
            id          BIGSERIAL PRIMARY KEY,
            account_id  BIGINT NOT NULL,
            payload     JSONB NOT NULL DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX ON mi_modulo_transacciones (account_id);
        SQL
      end

      # 2. Seed de configuración inicial con valores seguros vacíos
      # El token real se carga después vía PUT /api/v1/modules/:id/settings
      record.update!(settings: {
        api_url: 'https://api.thirdparty.com',
        encrypted_token: '',
        requires_approval: true
      })
    end
  end

  # UNINSTALL: Limpieza lógica — nunca borrar datos del usuario
  def run_uninstall(module_id)
    Rails.logger.info "[Modules] Desactivando: #{module_id}"
    # Aquí desactivar jobs, webhooks o suscripciones del módulo
    # No hacer DROP TABLE — los datos del cliente deben preservarse
  end

  def authorize_admin!
    render json: { error: 'Forbidden' }, status: :forbidden \
      unless current_user.account_owner?
  end
end
```

### 6.4 Canal ActionCable

```ruby
# app/channels/modules_channel.rb
class ModulesChannel < ApplicationCable::Channel
  def subscribed
    # Solo usuarios autenticados pueden suscribirse
    reject unless current_user
    stream_from 'ModulesChannel'
  end
end
```

### 6.3 Rutas Rails

```ruby
# config/routes.rb
namespace :api do
  namespace :v1 do
    get    'modules',                    to: 'modules#index'
    post   'modules/:module_id/toggle',  to: 'modules#toggle'
    put    'modules/:module_id/settings', to: 'modules#update_settings'

    # Endpoint proxy por módulo — nunca exponer el token al frontend
    post   'mi_modulo/accion',           to: 'modules#proxy_action'
  end
end
```

---

## 7. La Página de Gestión de Módulos

El CRM no incluye una página admin de módulos estilo Odoo/Perfex. Se construye como una ruta del propio módulo, disponible en `/admin/mis-modulos` solo para `account_owner`.

```tsx
// src/extensions/mi-modulo/pages/AdminModulosPage.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  slots: string[];
  active: boolean;
  depsOk: boolean;
  deps: string[];
}

// Registro local de metadatos — el backend solo conoce IDs y estado
const MODULE_REGISTRY: Omit<ModuleInfo, 'active' | 'depsOk'>[] = [
  {
    id: 'mi_modulo',
    name: 'Mi Módulo Personalizado',
    version: '1.1.0',
    description: 'Inyecta acciones en conversaciones y expone vistas de reporte.',
    slots: ['header.right', 'sidebar.afterMain'],
    deps: [],
  },
  // Agrega aquí cada nuevo módulo que registres
];

export default function AdminModulosPage() {
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/v1/modules').then(({ data }) => {
      const activeSet = new Set<string>(data.active_modules);
      setModules(
        MODULE_REGISTRY.map(m => ({
          ...m,
          active: activeSet.has(m.id),
          depsOk: m.deps.every(d => activeSet.has(d)),
        }))
      );
    });
  }, []);

  const toggle = async (id: string) => {
    setToggling(id);
    try {
      await axios.post(`/api/v1/modules/${id}/toggle`);
      // El MiModuloProvider escucha el broadcast de ActionCable y actualiza automáticamente.
      // La línea siguiente re-fetcha la lista de la página para reflejar el cambio en la UI local.
      const { data } = await axios.get('/api/v1/modules');
      const activeSet = new Set<string>(data.active_modules);
      setModules(prev =>
        prev.map(m => ({ ...m, active: activeSet.has(m.id), depsOk: m.deps.every(d => activeSet.has(d)) }))
      );
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Error al cambiar el estado del módulo.';
      alert(msg); // reemplazar con el sistema de toast del CRM en producción
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Módulos instalados</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Activa o desactiva extensiones. Los cambios aplican en el próximo refresh.
      </p>
      <div className="flex flex-col gap-3">
        {modules.map(mod => (
          <div key={mod.id}
            className={`rounded-xl border p-4 transition-colors ${
              mod.active ? 'border-primary/20 bg-primary/5' : 'border-border bg-card'
            }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{mod.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">v{mod.version}</span>
                </div>
                <p className="text-xs text-muted-foreground">{mod.description}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {mod.slots.map(s => (
                    <span key={s} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <button
                disabled={!mod.depsOk || toggling === mod.id}
                onClick={() => toggle(mod.id)}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  mod.active ? 'bg-primary' : 'bg-muted'
                } disabled:opacity-40`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-background transition-all ${
                  mod.active ? 'left-6' : 'left-1'
                }`}/>
              </button>
            </div>
            {!mod.depsOk && (
              <p className="text-xs text-yellow-500 mt-2">
                Requiere módulos activos: {mod.deps.join(', ')}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Flujo Completo de Activación

```
Admin entra a /admin/mis-modulos
        │
        ▼
Toggle → POST /api/v1/modules/mi_modulo/toggle
        │
        ├─ pre_init_ok?  ──── falla ──▶ 400 · Toast de error en UI
        │
        ▼
  ActiveRecord::Base.transaction do
    SystemModule.active = true  (save!)
    run_post_init               (crea tabla + seed de settings)
  end  ← rollback automático si cualquier paso falla
        │
        ▼
ActionCable.server.broadcast('ModulesChannel', { event: 'modules:changed' })
        │
        ├──────────────────────────────────────────────┐
        ▼                                              ▼
  Admin (MiModuloProvider)               Agente A, B, C… (MiModuloProvider)
  recibe broadcast → refresh()           reciben broadcast → refresh()
  re-fetcha /api/v1/modules              re-fetcha /api/v1/modules
        │                                              │
        └──────────────────────┬───────────────────────┘
                               ▼
                   runtimeContext.isActive = true
                               │
                   ├─ slots     → componentes se renderizan
                   ├─ guard     → rutas se habilitan
                   └─ navItems  → ítem aparece en sidebar
```

> **Sin ActionCable configurado:** El Provider usa `setInterval(refresh, 30_000)` como fallback. Los agentes verán el cambio en máximo 30 segundos sin recargar la página.

---

## 9. Reglas de Desarrollo (Checklist)

**Código**

- Todo el módulo vive en `src/extensions/mi-modulo/`. Cero archivos fuera de esa carpeta.
- El core nunca importa de `/extensions` directamente. El único puente es `registerPlugin()`.
- TypeScript estricto obligatorio. Un error de tipos detiene el build de Vite y bloquea el deploy.
- Los Slot IDs usados deben estar en la tabla de la sección 3.1. IDs inventados se ignoran silenciosamente.

**Bootstrapping en componentes de slot**

- Todo componente de slot aplica las tres guardas en orden: `!ctx` → `ctx.isLoading` → `!ctx.isActive`.
- Nunca mostrar spinners en slots del header — es un área de alta densidad visual.
- El campo `fallback` de las rutas renderiza un componente, no hace redirect. Usar `<Navigate to="/dashboard" replace />` para control explícito.

**Rails — transacciones y migraciones**

- `save!` y `run_post_init` siempre dentro de `ActiveRecord::Base.transaction`. Sin transacción, un fallo en `run_post_init` deja el módulo `active: true` sin `settings`, rompiendo el proxy.
- Las tablas propias del módulo se crean en `run_post_init` con SQL directo, **nunca en migraciones globales**. Las migraciones globales se ejecutan en todos los entornos aunque el módulo nunca se active.
- `run_uninstall` nunca hace `DROP TABLE`. Los datos del usuario se preservan siempre.

**Propagación de estado**

- Siempre emitir `ActionCable.server.broadcast('ModulesChannel', { event: 'modules:changed' })` al finalizar un toggle exitoso.
- Si ActionCable no está configurado, usar `setInterval(refresh, 30_000)` en el Provider como fallback.
- Sin propagación, los agentes ven el estado anterior hasta recargar la página manualmente.

**Seguridad**

- Nunca exponer tokens o credenciales en el frontend. Van en `SystemModule.settings` (jsonb en PostgreSQL).
- El frontend llama a `/api/v1/mi_modulo/accion` (proxy Rails). Rails hace la llamada firmada al tercero.
- El endpoint `/api/v1/modules` nunca devuelve la columna `settings`.
- El guard siempre debe ser explícito. Sin guard → deny-by-default del contrato.

**i18n**

- Usar namespace propio: `mi-modulo.*`. Nunca sobreescribir: `auth`, `chat`, `contacts`, `agents`, `common`.

**Compatibilidad con upstream**

- Al hacer `git pull` del upstream, cero merge conflicts estructurales.
- Los únicos archivos en riesgo de conflicto son `src/main.tsx` (la línea del import) y `config/routes.rb`.
- Declarar el rango de versión soportado:

```json
// En la documentación interna del módulo
{ "evoCommunityRange": ">=1.0.0-rc2 <2.0.0" }
```

---

## 10. Tabla de Equivalencias: Documento Original → Contrato Real

Esta tabla muestra qué pieza del documento original se reemplaza con qué del contrato oficial, y qué se mantiene igual.

| Concepto | Estado | Dónde vive en v3.1.0 |
|---|---|---|
| `ExtensionPoint.tsx` | ❌ No construir | `PluginSlot` del contrato (automático) |
| `ErrorBoundary` manual | ❌ No construir | `PluginErrorBoundary` del contrato (automático) |
| `registry-validator.ts` | ❌ No construir | `guard` en el manifiesto + deny-by-default |
| `ExtensionTarget` / `points[]` | ❌ No usar | `slots{}` con Slot IDs oficiales |
| `useActiveModules` hook | ❌ No construir | `runtimeContext` vía `MiModuloProvider` |
| `manifest.ts` con `dependencies[]` | ✅ Mantener idea | `guard` verifica dependencias en runtime |
| `ModulesController` Rails | ✅ Con corrección | Transacción atómica + broadcast ActionCable (§6.2) |
| Hooks Pre-Init / Post-Init / Uninstall | ✅ Con corrección | `run_post_init` dentro de transacción (§6.2) |
| Seguridad: credenciales en `settings` jsonb | ✅ Mantener completo | `SystemModule.settings` + endpoint proxy |
| `routes[]` en el manifiesto | ✅ Adaptar forma | `routes[]` de `PluginManifest` con `namespace` + `<Navigate>` en fallback |
| Migraciones de tablas del módulo | ✅ Nuevo patrón | SQL en `run_post_init`, nunca en migraciones globales (§6.2) |
| Propagación de estado entre agentes | ✅ Nuevo | `ModulesChannel` ActionCable + `refresh()` en Provider (§5.1, §6.4) |
| Bootstrapping seguro en slots | ✅ Nuevo | Tres guardas obligatorias en componentes de slot (§5.3) |
| Página admin de módulos | ✅ Nuevo | `AdminModulosPage.tsx` en ruta `admin` (§7) |
