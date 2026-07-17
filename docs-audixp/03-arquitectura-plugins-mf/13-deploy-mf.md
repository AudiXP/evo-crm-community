# 13 — Deploy en Producción (Module Federation)

Guia de deploy para la arquitectura MF. Reutiliza el flujo Docker Swarm del host
documentado en `archive/01-registrar-pago/02-deploy-registrar-pago.md` y le agrega
lo especifico de MF: **remotos como builds independientes** y **allowlist firmada**
entregada al contenedor.

> Entorno: Docker Swarm + Portainer + Traefik (igual que la guia de referencia).
> El shell sigue siendo una imagen Docker; los remotos se publican aparte.

---

## 1. Diferencia clave vs el deploy in-tree

| Concepto | In-tree (referencia) | Module Federation |
|---|---|---|
| Qué se lleva la imagen | TODO el codigo (plugins incluidos) | Solo el host + remotos dados de alta en la allowlist |
| Plugins | compilados en el bundle | build independiente por remote, publicado en URL |
| Cambiar un plugin | reconstruir imagen | nueva entrada en allowlist firmada (sin rebuild del host) |
| Pin Swarm | commit del submodulo | version de remote en la allowlist |

El host MF se deploya **igual** que en la referencia; lo nuevo es el pipeline de
cada remote y la entrega de la allowlist.

---

## 2. Prerrequisitos

- Docker en local (Windows: Docker Desktop).
- Acceso FTP/SFTP al servidor y SSH al nodo manager (Swarm).
- Clave de firma del operador (para firmar la allowlist) en entorno de secretos
  seguro (ej. Vault) del pipeline CI/CD.
- Claves publicas de los terceros de confianza (para verificar firma de remotos).

---

## 3. Paso 1 — Build del HOST (sin remotos dentro)

Desde la carpeta del frontend (rama `feature/arquitectura-plugins-mf`):

```powershell
cd C:\evo-crm-community\evo-ai-frontend-community

docker build `
  --build-arg APP_VERSION=mf-host `
  -t evoapicloud/evo-ai-frontend-community:audixp-mf-host `
  .
```

El host incluye `vite.config.ts` con MF, `RemotePluginLoader` y `manifest-schema`
(Fase 1). NO contiene los remotos: estos se cargan en runtime desde la allowlist.

> Si `npm run build` (dentro del Docker: `tsc -b && vite build`) termina en
> `FINISHED`, el host compila. Si `tsc` falla, la imagen no se crea.

---

## 4. Paso 2 — Exportar y subir el HOST por FTP

```powershell
docker save evoapicloud/evo-ai-frontend-community:audixp-mf-host `
  -o C:\evo-crm-community\frontend-audixp-mf.tar
```
Sube `frontend-audixp-mf.tar` por FTP a `/opt/evocrm/` en el servidor.

---

## 5. Paso 3 — Importar en el nodo manager

```bash
cd /opt/evocrm
docker load -i frontend-audixp-mf.tar
docker images | grep evo-ai-frontend-community
```

Multi-nodo: repetir `docker load` en cada nodo o usar registry privado.

---

## 6. Paso 4 — Build y publicación de un REMOTE (tercero)

El remote es su PROPIO build, fuera de la imagen del host.

```powershell
cd C:\ruta\a\mi-plugin-tercero
# 1) build MF -> remoteEntry.js + chunks
npm run build
# 2) firmar el bundle (entry + chunks) con la clave del tercero
#    -> produce sriHash por chunk y firma del build manifest
# 3) publicar remoteEntry.js + chunks en la URL (CDN / servidor del tercero)
```

El remote NO se mete en la imagen de Swarm; vive en su URL. El host lo busca en
runtime. (Ver `06-guia-modulos-plugin-host-mf.md` §2.5: integridad entry+chunks.)

---

## 7. Paso 5 — Allowlist firmada (lo nuevo de MF)

Crear/actualizar el documento allowlist y firmarlo con la clave del operador:

```jsonc
// allowlist.mf.json (firmado)
{
  "mi-plugin-tercero": {
    "url": "https://cdn.tercero.com/remoteEntry.js",
    "sriHash": "sha384-...",          // cubre entry + chunks (build manifest)
    "publicKeyId": "tercero-1"
  }
}
```

Entregar la allowlist al contenedor (elegir uno):
- **Variable de entorno** en el `environment:` del stack (Swarm), o
- **Archivo montado** (`config` de Docker / secret), o
- **Endpoint firmado** servido por el microservicio (v1.5+ / v2).

Sin allowlist valida, el host NO carga ningun remote (feature-flag de seguridad).

> Regla de pin Swarm (revisada): el pin del host es el commit validado del submodulo;
> la "version" de cada remote vive en la allowlist firmada, no en `main` flotante.

---

## 8. Paso 6 — Ajustar el stack y redeploy

En el servicio `evocrm_frontend` del stack:

```yaml
  evocrm_frontend:
    image: evoapicloud/evo-ai-frontend-community:audixp-mf-host
    environment:
      # ... variables VITE_* existentes ...
      VITE_MF_ALLOWLIST: "/etc/evo/allowlist.mf.json"   # ruta del archivo montado
    configs:
      - source: mf_allowlist
        target: /etc/evo/allowlist.mf.json
    deploy:
      <<: *deploy-default
      labels:
        - traefik.enable=1
        # ... routers/labels igual que la guia de referencia ...
```

Portainer -> Stacks -> tu stack -> pega el stack editado -> **Update the stack**.
Swarm hace rolling update de `evocrm_frontend`.

---

## 9. Paso 7 — Verificación

- `docker service ps evocrm_frontend` y `docker service logs evocrm_frontend --tail 50`.
- Abrir `https://evocrm.meudominio.com/admin/mis-modulos` como `account_owner`.
- El remote aparece con badge `remote` y estado de firma `firmado`.
- Probar el slot/ruta del remote; si crashea, `PluginErrorBoundary` aísla (shell OK).
- Alterar la firma/SRI de la allowlist en prueba -> el remote se rechaza (no carga).

---

## 10. Actualizar un plugin sin rebuild del host

1. El tercero publica nuevo `remoteEntry.js` + chunks y nueva firma/SRI.
2. Se actualiza la entrada en la allowlist firmada (mismo `publicKeyId`).
3. Redeploy del stack (solo cambia la allowlist/ config; el host queda igual) O, en
   v2, el microservicio empuja la allowlist en caliente (WS/SSE).

El pin Swarm del host NO cambia: solo cambia la version del remote en la allowlist.

---

## 11. Resumen de comandos

```powershell
# Local: host
cd C:\evo-crm-community\evo-ai-frontend-community
docker build --build-arg APP_VERSION=mf-host -t evoapicloud/evo-ai-frontend-community:audixp-mf-host .
docker save evoapicloud/evo-ai-frontend-community:audixp-mf-host -o C:\evo-crm-community\frontend-audixp-mf.tar
# -> subir frontend-audixp-mf.tar por FTP a /opt/evocrm/

# Local: remote (tercero)
cd C:\ruta\a\mi-plugin-tercero
npm run build            # -> remoteEntry.js + chunks
# firmar + publicar en CDN
```
```bash
# Nodo manager (SSH)
cd /opt/evocrm && docker load -i frontend-audixp-mf.tar && docker images | grep evo-ai-frontend-community
# -> editar stack (nueva image: + config mf_allowlist) y Update en Portainer
```

---

## 12. Pendientes / notas

- **Claves en Vault:** la clave de firma de la allowlist nunca en el repo ni en el
  stack como texto plano; inyectada por el pipeline CI/CD (ver `11-preguntas-respuestas.md` P11).
- **Multi-nodo:** cargar el `.tar` del host en todos los nodos o registry privado.
- **Revocación en caliente (v2):** el microservicio invalida una entrada y empuja vía
  WS/SSE sin redeploy (ver `11` P12).
- **CSP:** el host debe enviar cabera CSP (`script-src`/`connect-src`) acotada a los
  orígenes de la allowlist (ver `08-retos-y-soluciones.md` §9).
- Guia base del host: `archive/01-registrar-pago/02-deploy-registrar-pago.md`.
