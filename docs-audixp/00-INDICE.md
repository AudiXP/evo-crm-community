# Indice de Documentacion - Evo CRM Community (AudiXP)

Esta carpeta agrupa la documentacion de las personalizaciones de AudiXP sobre
`evolution-foundation/evo-crm-community`. Hay DOS enfoques documentados:

- **Enfoque A (en produccion):** boton "Registrar Pago" montado directamente en
  `MessageInput.tsx`, con credenciales Teusa Track inyectadas desde el stack Swarm.
  Codigo en `src/extensions/registrar-pago/`. Ver carpeta `01-registrar-pago/`.
- **Enfoque B (objetivo):** migrar las extensiones al contrato de plugins oficial
  `@/plugin-host` (`registerPlugin` + `PluginSlot` + `runtimeContext`).
  - Teoria general del contrato: carpeta `02-arquitectura-plugins/`.
  - Caso concreto autocontenido (el boton como plugin, "desde cero"): carpeta
    `03-plugin-boton-registrar-pago/`.

---

## 01-registrar-pago/  (Enfoque A - feature desplegado)

| Archivo | Contenido |
|---|---|
| `00-enfoque-inicial-gemini.md` | Documento fundacional (chat Gemini): estrategia de aislamiento en `src/extensions/`, fork + rama, y sync con upstream. Origen de todas las decisiones del enfoque A. |
| `01-guia-registrar-pago.md` | Guia tecnica del boton: codigo del modal/extension, punto de contacto en `MessageInput.tsx`, y flujo a Teusa Track. |
| `02-deploy-registrar-pago.md` | Deploy Docker: build local -> exportar .tar -> FTP -> importar en nodo -> stack Swarm con `VITE_TEUSA_TRACK_*`. |
| `03-auditoria-registrar-pago.md` | Auditoria de problemas corregidos (archivos fuera de submodulo, falta de punto de contacto, estetica del modal). |

## 02-arquitectura-plugins/  (Enfoque B - objetivo)

| Archivo | Contenido |
|---|---|
| `01-guia-modulos-plugin-host.md` | **Fuente de verdad.** Guia de modulos/plugins corregida al repo real (`@/plugin-host`, sin Rails, `SlotId` reales, `runtimeContext` unico). |
| `02-guia-modulos-v3-original.md` | Referencia: version original v3.1.0 (asume `@evoai/extension-points` y Rails; CON ERRORES vs repo real). Solo para comparar. |

## 03-plugin-boton-registrar-pago/  (Enfoque B - caso concreto autocontenido)

Proyecto documental del boton Registrar Pago construido COMO PLUGIN (`@/plugin-host`),
"desde cero". Cada archivo es copia adaptada y completa (no depende de 01/02).

| Archivo | Contenido |
|---|---|
| `00-INDICE.md` | Indice local de la carpeta. |
| `01-enfoque-inicial-gemini.md` | Estrategia Gemini adaptada a plugins (fork+rama+sync; el punto de contacto es `registerPlugin` + import en `main.tsx`). |
| `02-guia-modulos-plugin-host.md` | Contrato real `@/plugin-host` (copia autocontenida y corregida). |
| `03-guia-plugin-registrar-pago.md` | ⭐ El boton Registrar Pago COMO PLUGIN: manifest, slot, entry point, diferencias vs Enfoque A. |
| `04-deploy-plugin-registrar-pago.md` | Deploy de la imagen con el plugin ya registrado (build -> FTP -> docker load -> stack Swarm). |

---

## Como leer segun tu objetivo

- Quieres entender/desplegar el boton actual -> lee `01-registrar-pago/` en orden 00 -> 03.
- Quieres la teoria del contrato de plugins -> lee `02-arquitectura-plugins/01-...`.
- Quieres ver el boton implementado como plugin (caso completo) -> lee `03-plugin-boton-registrar-pago/` en orden 00 -> 04.
- Quieres sincronizar con el repo oficial sin perder cambios -> empieza por
  `01-registrar-pago/00-enfoque-inicial-gemini.md` (la estrategia fork+rama aplica a ambos enfoques).

## Notas de mantenimiento

- El `.gitignore` de la raiz ignora `frontend-audixp.tar` (imagen Docker exportada).
- Los commits de esta carpeta se hacen en el monorepo `AudiXP/evo-crm-community` (rama `main`).
- El codigo de las extensiones vive en el submodulo `evo-ai-frontend-community`
  (rama `feature/registrar-pago`, fork `AudiXP`).
