# Guia de Deploy: Plugin Registrar Pago (arquitectura @/plugin-host)

**Entorno:** Docker Swarm + Portainer + Traefik
**Estrategia:** construir TU PROPIA imagen del frontend en local (que YA INCLUYE el plugin
registrado en `@/plugin-host`), exportarla, subirla por FTP, importarla en el nodo y apuntar
el stack a esa imagen.
**Objetivo clave:** que `VITE_TEUSA_TRACK_API_URL` y `VITE_TEUSA_TRACK_API_TOKEN` se
definan **solo en el `environment:` del stack** (sin recompilar cuando cambien).

> Esta guia es la version del Enfoque B. La mecanica de build/despliegue es la MISMA que la
> del Enfoque A (`01-registrar-pago/02-deploy-registrar-pago.md`); lo unico que cambia es
> que la imagen ya compila el plugin Registrar Pago como contribucion de slot en lugar de un
> montaje manual en `MessageInput.tsx`.

---

## 1. Como funciona (mecanismo runtime de la imagen)

El `Dockerfile` compila el `dist` con **placeholders** en las variables `VITE_*` (ej.
`VITE_TEUSA_TRACK_API_URL_PLACEHOLDER`). Al arrancar el contenedor, `docker-entrypoint.sh`
hace `sed` para reemplazarlos por los valores del `environment:` del stack.

En el Enfoque B, el plugin se registra en `src/main.tsx` (`import '@/extensions/boton-registrar-pago'`)
y su `index.ts` llama `registerPlugin`. El build de la imagen incluye ese codigo; no hay
diferencia en el mecanismo de placeholders respecto al Enfoque A.

Archivos modificados en el fork (iguales a Enfoque A):
- `Dockerfile` -> `ENV VITE_TEUSA_TRACK_API_URL=..._PLACEHOLDER` (+ token)
- `docker-entrypoint.sh` -> dos lineas `sed` nuevas
- `src/extensions/boton-registrar-pago/*` -> plugin completo (modal, extension, manifest, index)
- `src/main.tsx` -> 1 linea `import '@/extensions/boton-registrar-pago'`
- `src/vite-env.d.ts` -> tipado de ambas variables

---

## 2. Prerrequisitos

- Docker instalado localmente (Windows: Docker Desktop).
- Acceso FTP/SFTP al servidor donde corre Swarm.
- Acceso SSH al nodo manager (`docker load` + actualizar servicio).

---

## 3. Paso 1 - Construir la imagen en local

```powershell
cd C:\evo-crm-community\evo-ai-frontend-community

docker build `
  --build-arg APP_VERSION=registrar-pago-plugin `
  -t evoapicloud/evo-ai-frontend-community:audixp-plugin-boton-registrar-pago `
  .
```

> Usa un tag propio (`audixp-plugin-boton-registrar-pago`) para no pisar la imagen oficial ni la
> del Enfoque A. No pasamos URLs en el build: quedan como placeholders y se resuelven en
> runtime.

Verifica:
```powershell
docker images | Select-String "evo-ai-frontend-community"
```

> **Verificacion de build (lint/tsc):** el `npm run build` dentro del Docker ejecuta
> `tsc -b && vite build`. Si termina en `FINISHED`, el codigo (incluido el plugin y su
> `registerPlugin`) compila correctamente. Si `tsc` fallara, la imagen NO se crearia.

---

## 4. Paso 2 - Exportar a .tar

```powershell
docker save evoapicloud/evo-ai-frontend-community:audixp-plugin-boton-registrar-pago `
  -o C:\evo-crm-community\frontend-audixp-plugin.tar
```

> Nombre distinto (`frontend-audixp-plugin.tar`) para no pisar el .tar del Enfoque A. El
> `.gitignore` de la raiz ya ignora `frontend-audixp.tar`; anade `frontend-audixp-plugin.tar`
> si quieres ignorar este tambien.

---

## 5. Paso 3 - Subir por FTP

Sube `C:\evo-crm-community\frontend-audixp-plugin.tar` a `/opt/evocrm/` en el servidor (FileZilla, WinSCP, etc.).

---

## 6. Paso 4 - Importar en el nodo manager

```bash
cd /opt/evocrm
docker load -i frontend-audixp-plugin.tar
docker images | grep evo-ai-frontend-community
```

---

## 7. Paso 5 - Ajustar el stack

En `evocrm_frontend` del stack: cambia la imagen a tu tag plugin y agrega las vars Teusa.

```yaml
  evocrm_frontend:
    image: evoapicloud/evo-ai-frontend-community:audixp-plugin-boton-registrar-pago
    networks:
      - evonet
      - red_megachatapp
    environment:
      VITE_APP_ENV: "production"
      VITE_API_URL: "https://evocrmapi.meudominio.com"
      VITE_AUTH_API_URL: "https://evocrmapi.meudominio.com"
      VITE_EVOAI_API_URL: "https://evocrmapi.meudominio.com"
      VITE_AGENT_PROCESSOR_URL: "https://evocrmapi.meudominio.com"
      VITE_WS_URL: "https://evocrmapi.meudominio.com"
      VITE_TEUSA_TRACK_API_URL: ""
      VITE_TEUSA_TRACK_API_TOKEN: ""
    deploy:
      <<: *deploy-default
      labels:
        - traefik.enable=1
        - traefik.docker.network=red_megachatapp
        - traefik.http.routers.evocrm_frontend.rule=Host(`evocrm.meudominio.com`)
        - traefik.http.routers.evocrm_frontend.entrypoints=websecure
        - traefik.http.routers.evocrm_frontend.priority=1
        - traefik.http.routers.evocrm_frontend.tls.certresolver=letsencryptresolver
        - traefik.http.routers.evocrm_frontend.service=evocrm_frontend
        - traefik.http.services.evocrm_frontend.loadbalancer.server.port=80
        - traefik.http.services.evocrm_frontend.loadbalancer.passHostHeader=true
```

> Si la variable queda `""`, el entrypoint no reemplaza el placeholder; el codigo lo detecta
> y muestra "Falta configurar...". Al poner un valor real y reiniciar, el endpoint se activa.

---

## 8. Paso 6 - Redeploy en Portainer

1. Portainer -> Stacks -> tu stack.
2. Pega el stack editado (nueva `image:` + vars Teusa).
3. **Update the stack**. Swarm hace rolling update de `evocrm_frontend`.
4. Verifica:
   ```bash
   docker service ps evocrm_frontend
   docker service logs evocrm_frontend --tail 50
   ```

---

## 9. Cuando tengas URL y token definitivos

No reconstruyas. Solo edita el stack:
```yaml
VITE_TEUSA_TRACK_API_URL: "https://api.teusatrack.com/api/v1/pagos"
VITE_TEUSA_TRACK_API_TOKEN: "el-token-real"
```
**Update the stack** (o reinicia el servicio). El entrypoint reemplaza los placeholders.

---

## 10. Verificacion final

- Abre `https://evocrm.meudominio.com`, entra a una conversacion.
- El boton **Registrar Pago** aparece (en `header.right` para el Enfoque B, no dentro del
  composer como el Enfoque A).
- Abre el modal, completa y envia. El POST va a Teusa Track con `Authorization: Bearer ...`
  (si definiste token).
- Si ves "Falta configurar VITE_TEUSA_TRACK_API_URL en el stack", la variable esta vacia.

---

## 11. Diferencia clave vs Enfoque A en produccion

| | Enfoque A (01-registrar-pago) | Enfoque B (este doc) |
|---|---|---|
| Tag imagen | `audixp-registrar-pago` | `audixp-plugin-boton-registrar-pago` |
| Archivo .tar | `frontend-audixp.tar` | `frontend-audixp-plugin.tar` |
| Boton vive en | composer (`MessageInput.tsx`) | slot `header.right` del plugin |
| Aislamiento | manual | `PluginErrorBoundary` automatico |

El resto del flujo (build -> save -> FTP -> load -> stack -> Portainer) es identico.

---

## 12. Pendientes

1. URL/token definitivos de Teusa Track (en el stack, sin recompilar).
2. Esquema de auth (Bearer vs X-API-Key) en `RegistrarPagoExtension.tsx`.
3. Multi-nodo: cargar el .tar en todos los nodos o usar registry privado.
4. Mover el boton de `header.right` al composer cuando el core exponga un slot `chat.*`.
