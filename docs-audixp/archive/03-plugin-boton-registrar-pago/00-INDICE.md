# Indice local - 03-plugin-boton-registrar-pago

Esta carpeta es un proyecto documental AUTOCONTENIDO del **Enfoque B (arquitectura de
plugins)** aplicado al feature "Registrar Pago". Se redacta como si empezaramos desde cero
a construir el boton usando el contrato oficial `@/plugin-host` (registerPlugin + PluginSlot),
NO el montaje manual en MessageInput.tsx del Enfoque A.

No depende de las carpetas 01/02: cada archivo aqui es una copia adaptada y completa.

## Archivos

| Archivo | Contenido |
|---|---|
| `01-enfoque-inicial-gemini.md` | Estrategia de aislamiento (fork + rama + sync upstream) vista desde el enfoque de plugins: el unico punto de contacto ya es `registerPlugin()` + import en `main.tsx`. |
| `02-guia-modulos-plugin-host.md` | Contrato real `@/plugin-host` (copia autocontenida y corregida: sin Rails, SlotId reales, runtimeContext unico). |
| `03-guia-plugin-registrar-pago.md` | ⭐ Como implementar el boton Registrar Pago COMO PLUGIN: manifest, slot, entry point, y diferencias vs Enfoque A. |
| `04-deploy-plugin-registrar-pago.md` | Deploy de la imagen con el plugin ya registrado (build -> FTP -> docker load -> stack Swarm con VITE_TEUSA_TRACK_*). |
| `05-plan-implementacion.md` | ⭐ Plan por fases (0-5) con checklist para migrar del Enfoque A al Enfoque B: preparacion, investigacion en el core, creacion del plugin, punto de contacto, validacion y deploy. |

## Como leer

1. `01-enfoque-inicial-gemini.md` (filosofia y estrategia de sync).
2. `02-guia-modulos-plugin-host.md` (el contrato que usaremos).
3. `03-guia-plugin-registrar-pago.md` (la implementacion del boton como plugin).
4. `04-deploy-plugin-registrar-pago.md` (como llevarlo a produccion).
5. `05-plan-implementacion.md` (checklist de ejecucion por fases).

## Relacion con otras carpetas

- `01-registrar-pago/` = mismo feature pero Enfoque A (montaje manual, en produccion hoy).
- `02-arquitectura-plugins/` = teoria general del contrato (generica, sin un feature concreto).
- Esta carpeta = caso concreto Enfoque B, autocontenido.
