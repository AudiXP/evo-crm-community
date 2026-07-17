# Guia de Deploy: Reconstruir imagen en local + subir via FTP (Teusa Track en el stack)

**Entorno:** Docker Swarm + Portainer + Traefik
**Estrategia:** construir TU PROPIA imagen del frontend en local, exportarla, subirla por
FTP al servidor, importarla en el nodo y apuntar el stack a esa imagen.
**Objetivo clave:** que `VITE_TEUSA_TRACK_API_URL` y `VITE_TEUSA_TRACK_API_TOKEN` se
definan **solo en el `environment:` del stack** (sin recompilar cuando cambien), igual que
`VITE_API_URL`.

---

## 1. Como funciona (mecanismo runtime de la imagen)

El `Dockerfile` del frontend compila el `dist` con **placeholders** en las variables
`VITE_*` (ej. `VITE_TEUSA_TRACK_API_URL_PLACEHOLDER`). Al arrancar el contenedor, el
`docker-entrypoint.sh` hace un `sed` que reemplaza esos placeholders por los valores reales
que vienen del `environment:` del stack.

Se agregaron al proyecto (fork AudiXP) dos variables nuevas a ese mecanismo:

- `VITE_TEUSA_TRACK_API_URL`  -> URL del endpoint de pagos de Teusa Track
- `VITE_TEUSA_TRACK_API_TOKEN` -> token Bearer (opcional; si esta, se envia como
  `Authorization: Bearer <token>`)

Por eso puedes desplegar AHORA sin la URL/token definitivos: el boton funcionara y mostrara
un toast "Falta configurar..." hasta que definas las variables en el stack. Cuando las
tengas, solo editas el stack y reinicias el servicio (sin reconstruir la imagen).

Archivos modificados en el fork para habilitar esto:
- `Dockerfile` -> `ENV VITE_TEUSA_TRACK_API_URL=..._PLACEHOLDER` (y el token)
- `docker-entrypoint.sh` -> dos lineas `sed` nuevas
- `src/extensions/registrar-pago/RegistrarPagoExtension.tsx` -> lee `import.meta.env`
- `src/vite-env.d.ts` -> tipado de ambas variables

---

## 2. Prerrequisitos

- Docker instalado en tu maquina local (Windows: Docker Desktop).
- Acceso FTP/SFTP al servidor donde corre Swarm.
- Acceso SSH al nodo manager (para `docker load` y actualizar el servicio).

---

## 3. Paso 1 - Construir la imagen en local

Desde la carpeta del frontend:

```powershell
cd C:\evo-crm-community\evo-ai-frontend-community

docker build `
  --build-arg APP_VERSION=registrar-pago `
  -t evoapicloud/evo-ai-frontend-community:audixp-registrar-pago `
  .
```

> Usa un tag propio (`audixp-registrar-pago`) para no pisar la imagen oficial `1.0.0`.
> No pasamos las URLs en el build: quedan como placeholders y se resuelven en runtime.

Verifica que se creo:
```powershell
docker images | Select-String "evo-ai-frontend-community"
```

> **Verificacion del build (lint/tsc):** el `npm run build` dentro del Docker ejecuta
> `tsc -b && vite build`. Si el build termina en `FINISHED` (como en la ejecucion de
> referencia), significa que el codigo compila correctamente (TypeScript + Vite sin
> errores). Si `tsc` fallara, el build se detendria y la imagen NO se crearia.

---

## 4. Paso 2 - Exportar la imagen a un archivo .tar

```powershell
docker save evoapicloud/evo-ai-frontend-community:audixp-registrar-pago `
  -o C:\evo-crm-community\frontend-audixp.tar
```

Opcional (comprimir para subir menos MB por FTP):
```powershell
# Requiere gzip; si no, sube el .tar directamente
```

---

## 5. Paso 3 - Subir el .tar por FTP

Sube `C:\evo-crm-community\frontend-audixp.tar` a un directorio del servidor, por ejemplo
`/opt/evocrm/`, usando tu cliente FTP/SFTP (FileZilla, WinSCP, etc.).

> Nota: NO se puede "subir solo archivos modificados" en este flujo, porque lo que se
> despliega es la imagen Docker completa (un solo .tar). Es el metodo correcto y confiable.

---

## 6. Paso 4 - Importar la imagen en el nodo manager

Conectate por SSH al nodo manager y carga la imagen:

```bash
cd /opt/evocrm
docker load -i frontend-audixp.tar
docker images | grep evo-ai-frontend-community
```

> En Swarm con varios nodos, repite `docker load` en cada nodo que pueda correr el
> servicio, o usa un registry privado. Para un solo nodo manager esto basta.

---

## 7. Paso 5 - Ajustar el stack

En el servicio `evocrm_frontend` del stack:

1. Cambia la imagen a tu tag.
2. Agrega las variables de Teusa Track (puedes dejarlas vacias o con placeholder hasta
   tener las definitivas).

```yaml
  evocrm_frontend:
    image: evoapicloud/evo-ai-frontend-community:audixp-registrar-pago
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
      # Teusa Track — definir cuando tengas los valores definitivos.
      # Mientras esten vacios, el boton mostrara "Falta configurar...".
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

> Importante: si dejas la variable en `""` (vacia), el entrypoint NO reemplaza el
> placeholder (la condicion `[ -n "$VAR" ]` es falsa). El codigo detecta el placeholder
> y lo trata como "no configurado" (muestra el toast). En cuanto pongas un valor real y
> reinicies, el endpoint queda activo.

---

## 8. Paso 6 - Redeploy en Portainer

1. Portainer -> Stacks -> tu stack.
2. Pega el stack editado (nueva `image:` + variables Teusa).
3. **Update the stack**. Swarm hara rolling update de `evocrm_frontend`.
4. Verifica:
   ```bash
   docker service ps evocrm_frontend
   docker service logs evocrm_frontend --tail 50
   ```

---

## 9. Cuando tengas la URL y el token definitivos

No hay que reconstruir la imagen. Solo:

1. En Portainer, edita el stack:
   ```yaml
   VITE_TEUSA_TRACK_API_URL: "https://api.teusatrack.com/api/v1/pagos"
   VITE_TEUSA_TRACK_API_TOKEN: "el-token-real"
   ```
2. **Update the stack** (o reinicia el servicio). El entrypoint reemplazara los
   placeholders en el JS al arrancar.

---

## 10. Verificacion final

- Abre `https://evocrm.meudominio.com`, entra a una conversacion.
- Aparece el boton **Registrar Pago** junto a Macros/Emoji.
- Abre el modal, completa y envia. En Network del navegador, el POST debe ir a la URL de
  Teusa Track con `Authorization: Bearer ...` (si definiste token).
- Si ves "Falta configurar VITE_TEUSA_TRACK_API_URL en el stack", la variable esta vacia.

---

## 11. Resumen de comandos

```powershell
# Local
cd C:\evo-crm-community\evo-ai-frontend-community
docker build --build-arg APP_VERSION=registrar-pago -t evoapicloud/evo-ai-frontend-community:audixp-registrar-pago .
docker save evoapicloud/evo-ai-frontend-community:audixp-registrar-pago -o C:\evo-crm-community\frontend-audixp.tar
# -> subir frontend-audixp.tar por FTP a /opt/evocrm/
```
```bash
# Nodo manager (SSH)
cd /opt/evocrm && docker load -i frontend-audixp.tar && docker images | grep evo-ai-frontend-community


# -> editar stack (image + VITE_TEUSA_*) y Update en Portainer
```

---

## 12. Pendientes

1. **URL y token definitivos de Teusa Track** (se ponen en el stack, sin recompilar).
2. **Esquema de auth:** el codigo usa `Authorization: Bearer <token>`. Si Teusa Track usa
   otro header (ej. `X-API-Key`), ajustar en `RegistrarPagoExtension.tsx` y reconstruir.
3. **Multi-nodo:** cargar el .tar en todos los nodos o usar registry privado.
4. **Precarga de factura:** pasar `defaultInvoice` desde la conversacion cuando exista la
   fuente de datos.
