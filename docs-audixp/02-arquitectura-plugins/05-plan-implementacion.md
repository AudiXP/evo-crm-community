# Plan de Implementacion - feature/arquitectura-plugins

Plan por fases para dejar la rama puente `feature/arquitectura-plugins` COMPLETA
antes de pasar a `feature/plugin-boton-registrar-pago`. Esta rama establece la
infraestructura de registro de plugins (barril) y la pagina admin de gestion de
modulos (solo-lectura, sin backend).

Leyenda de estado: [ ] pendiente - [~] parcial - [x] hecho

> Regla de oro: minimo impacto al core. Unico contacto permanente = `import '@/extensions'`
> en `main.tsx`. Todo lo demas vive en `src/extensions/`.

---

## Fase 0 - Rama puente (infra de registro)

- [x] 0.1 Rama `feature/arquitectura-plugins` creada desde `main` local (oficial, sin `pull upstream`).
- [x] 0.2 Barril `src/extensions/index.ts` (conmutador central, imports comentados).
- [x] 0.3 `main.tsx` -> `import '@/extensions';` (unico punto de contacto).
- [x] 0.4 Commit + push a `origin/AudiXP` (rama puente).
- [x] 0.5 Doc `00-estrategia-ramas.md` (politica de ramas).
- [x] 0.6 Doc `04-diff-rama-vs-main.md` (diff verificado 2 archivos / +13 lineas).
- [x] 0.7 Doc `01-gestion-de-modulos.md` (analisis Odoo/Perfex + diseno pagina admin).

---

## Fase 1 - Investigacion en el core (solo lectura)

- [x] 1.1 Confirmar APIs del registry exportadas por `@/plugin-host`
      (`getRegisteredPlugins`, `getPlugins`, `getSlotContributions`, `getRoutes`, `subscribe`).
- [x] 1.2 Confirmar que `PluginRoutes({ namespace:'admin' })` esta MONTADO (`routes/index.tsx:1534`).
- [x] 1.3 Confirmar que `admin.nav` / `settings.sections` / `dashboard.widgets` NO estan montados.
- [ ] 1.4 Confirmar rol real disponible para `requiredRole` (que valor usa el core para "account_owner").
- [ ] 1.5 Confirmar como se resuelve el guard cuando el plugin NO define `guard` (deny-by-default con requiredRole).

---

## Fase 2 - Pagina admin de gestion de modulos (plugin propio, v1 solo-lectura)

> Construccion posterior a la documentacion (decision: documentar y despues construir).

- [ ] 2.1 Crear `src/extensions/admin-modulos/manifest.ts` (ruta `/admin/mis-modulos`, `namespace:'admin'`, `requiredRole:'account_owner'`).
- [ ] 2.2 Crear `src/extensions/admin-modulos/pages/AdminModulosPage.tsx`
      (lee `getRegisteredPlugins()`, se suscribe con `subscribe()`; solo lectura).
- [ ] 2.3 UI con `@evoapi/design-system` (NO clases `bg-zinc-*`). Mostrar por plugin: id, slots, rutas, navItems.
- [ ] 2.4 Crear `src/extensions/admin-modulos/index.ts` (`registerPlugin(AdminModulosManifest)`).
- [ ] 2.5 Descomentar/registrar en barril: `import './admin-modulos';`.
- [ ] 2.6 (Opcional/futuro) resolver acceso al menu: `admin.nav` NO montado -> acceso por URL, o parche del shell.

---

## Fase 3 - Validacion

- [ ] 3.1 `npm install` (submodulo no tiene node_modules por defecto).
- [ ] 3.2 `npm run lint`.
- [ ] 3.3 `npm run build` (verifica que el barril + pagina compilan).
- [ ] 3.4 `npm run dev` y navegar a `/admin/mis-modulos` como account_owner: la pagina lista el registry.
- [ ] 3.5 Verificar que sin modulos registrados la pagina no rompe (estado vacio).

---

## Fase 4 - Commit y push (rama arquitectura-plugins)

- [ ] 4.1 Commit del plugin `admin-modulos` en el submodulo.
- [ ] 4.2 Push a `origin/AudiXP` rama `feature/arquitectura-plugins`.
- [ ] 4.3 Commit de docs en el monorepo padre.

---

## Fase 5 - Deploy (NOTA)

- La rama `feature/arquitectura-plugins` por si sola NO cambia comportamiento visible
  salvo la pagina admin. NO requiere deploy independiente obligatorio.
- El deploy real (imagen -> FTP -> `docker load` -> stack Swarm) se hace cuando exista
  contenido con valor de negocio (p. ej. junto con `feature/plugin-boton-registrar-pago`).
- Regla de pin Swarm: el commit del submodulo usado por el stack debe ser uno validado
  y deployado, no `main` flotante (ver `00-estrategia-ramas.md`).

---

## Relacion con 03-plugin-boton-registrar-pago

- `feature/plugin-boton-registrar-pago` nace DESPUES, desde `feature/arquitectura-plugins`.
- Hereda el barril `src/extensions/index.ts` ya creado aqui.
- Tras completar esta rama, revisar/reajustar la carpeta `03` para reflejar que la
  infra (barril) ya existe y que el plugin del boton solo agrega su carpeta + su linea
  en el barril.
