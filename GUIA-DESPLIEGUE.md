# Guía de despliegue — Alfa Tours

Todo lo necesario para publicar **alfatours.mx** con **Cloudflare Pages** conectado a
GitHub (se actualiza solo con cada cambio que subas), y para crear los correos del dominio
reenviados a tu Gmail. Sigue los pasos en orden.

> Datos de tu proyecto
> - Dominio: **alfatours.mx** (ya lo tienes en Cloudflare)
> - Gmail destino de correos: **alfatoursviajes@gmail.com**
> - Cuenta para GitHub: tu Gmail
> - WhatsApp / Tel: **669 116 0439**
> - Publicación: **Cloudflare Pages** (no GitHub Pages)

---

## Parte 0 · Antes de empezar (importante)

En tu carpeta quedó una carpeta oculta `.git` incompleta de una prueba. Bórrala primero
para arrancar limpio. En tu Mac abre la **Terminal** y pega:

```bash
cd "/Users/alansegura/Proyectos/Alfa Tours"
rm -rf .git
```

Los archivos del sitio ya están limpios y con `.gitignore` correcto (no se subirán fotos
originales, previews ni documentos internos).

---

## Parte 1 · Crear la cuenta y el repositorio en GitHub

1. Entra a <https://github.com> → **Sign up**. Usa tu Gmail para registrarte y confirma el
   correo.
2. Ya dentro, botón **+** (arriba a la derecha) → **New repository**.
3. Repository name: `alfatours`. Déjalo **Public**. **No** marques "Add a README".
4. Clic en **Create repository**. Deja esa pestaña abierta: te mostrará la URL del repo
   (algo como `https://github.com/TU_USUARIO/alfatours`).

---

## Parte 2 · Subir el sitio a GitHub

Elige **un** camino. El A es el más simple si no usas terminal.

### Opción A — GitHub Desktop (recomendado, sin comandos)
1. Descarga e instala **GitHub Desktop**: <https://desktop.github.com>. Inicia sesión con
   tu cuenta.
2. Menú **File → Add local repository** → elige la carpeta
   `/Users/alansegura/Proyectos/Alfa Tours`.
3. Si te dice que no es un repositorio, acepta **create a repository** aquí.
4. Abajo a la izquierda escribe un resumen ("Versión inicial del sitio") y clic en
   **Commit to main**.
5. Arriba, clic en **Publish repository**. Desmarca "Keep this code private" si quieres que
   sea público, y publica. Listo: tu código ya está en GitHub.

### Opción B — Terminal (Git)
```bash
cd "/Users/alansegura/Proyectos/Alfa Tours"
git init
git add .
git commit -m "Versión inicial del sitio Alfa Tours"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/alfatours.git
git push -u origin main
```
Si te pide usuario/contraseña, la "contraseña" es un **token** (GitHub → Settings →
Developer settings → Personal access tokens). Con GitHub Desktop te ahorras esto.

---

## Parte 3 · Publicar con Cloudflare Pages

1. Entra a <https://dash.cloudflare.com> con tu cuenta (la misma del dominio).
2. En el menú lateral: **Workers & Pages** → pestaña **Pages** → **Create application** →
   **Connect to Git**.
3. Autoriza a Cloudflare a acceder a tu GitHub y selecciona el repositorio **alfatours**.
4. En la configuración de build, como el sitio es estático **no** necesita compilarse:
   - **Framework preset:** `None`
   - **Build command:** *(déjalo vacío)*
   - **Build output directory:** `/`
5. Clic en **Save and Deploy**. En ~1 minuto tendrás una URL tipo
   `https://alfatours.pages.dev`. Ábrela y verifica que el sitio se vea bien.

Desde ahora, **cada vez que subas un cambio a GitHub, Cloudflare Pages lo publica solo.**

---

## Parte 4 · Conectar el dominio alfatours.mx

Como tu dominio ya vive en Cloudflare, esto es casi automático.

1. Dentro de tu proyecto de Pages, ve a la pestaña **Custom domains** → **Set up a custom
   domain**.
2. Escribe `alfatours.mx` y confirma. Cloudflare crea el registro DNS y el certificado
   HTTPS solo.
3. Repite para `www.alfatours.mx` (así ambas versiones funcionan).
4. Espera unos minutos. `https://alfatours.mx` mostrará tu sitio con candado (HTTPS).

> Si en DNS ya existían registros viejos de `@` o `www` (por ejemplo de una prueba con
> GitHub Pages), bórralos para que no haya conflicto. Cloudflare Pages pone los suyos.

---

## Parte 5 · Correos del dominio (Cloudflare Email Routing → Gmail)

Recibirás **gratis** en direcciones `@alfatours.mx`, reenviadas a tu Gmail.

### 5.1 Activa Email Routing
1. En Cloudflare, con `alfatours.mx` seleccionado, ve a **Email → Email Routing**.
2. Clic en **Get started / Enable**. Cloudflare agrega solo los registros **MX**, **SPF** y
   **DKIM** necesarios. Acepta.

### 5.2 Verifica tu Gmail como destino
1. En **Destination addresses**, agrega **alfatoursviajes@gmail.com**.
2. Abre el correo de verificación que llega a ese Gmail y confírmalo.

### 5.3 Crea las direcciones
En **Routing rules → Custom addresses**, crea las cuatro:

| Dirección                 | Reenvía a                  |
|---------------------------|----------------------------|
| viajes@alfatours.mx       | alfatoursviajes@gmail.com  |
| transportes@alfatours.mx  | alfatoursviajes@gmail.com  |
| adm@alfatours.mx          | alfatoursviajes@gmail.com  |
| facturas@alfatours.mx     | alfatoursviajes@gmail.com  |

Activa además un **Catch-all** hacia el mismo Gmail, para no perder correos mal escritos.

### 5.4 Prueba
Desde otra cuenta distinta, envía un correo a `viajes@alfatours.mx` y confirma que llega a
tu Gmail.

---

## Parte 6 · Responder DESDE tu dominio en Gmail (opcional, recomendado)

Para que tus respuestas salgan como `viajes@alfatours.mx` y no como el Gmail:

1. En tu cuenta de Google activa la **Verificación en 2 pasos**.
2. Genera una **Contraseña de aplicación** en <https://myaccount.google.com/apppasswords>.
3. En Gmail: **Configuración → Cuentas e importación → Enviar como → Agregar otra dirección
   de correo**.
4. Escribe `viajes@alfatours.mx`. En SMTP usa:
   - Servidor: `smtp.gmail.com`
   - Puerto: `587`
   - Usuario: `alfatoursviajes@gmail.com`
   - Contraseña: la **contraseña de aplicación** generada
   - Conexión: **TLS**
5. Gmail manda un código a `viajes@alfatours.mx`; como ya se reenvía a tu bandeja, lo
   recibirás. Confírmalo.

Repite para `transportes@`, `adm@` y `facturas@` si quieres responder desde cualquiera.

---

## Parte 7 · Actualizar la web a futuro

Cada cambio (texto, foto, precio) se publica solo tras subirlo a GitHub:

- **GitHub Desktop:** haz el cambio en los archivos → escribe un resumen → **Commit to
  main** → **Push origin**. Cloudflare Pages republica en ~1 min.
- **Terminal:**
  ```bash
  cd "/Users/alansegura/Proyectos/Alfa Tours"
  git add .
  git commit -m "Descripción del cambio"
  git push
  ```

---

## Parte 8 · Reemplazar o agregar fotos

Todas las imágenes viven en `img/`. Para cambiar una unidad, sustituye el archivo por otro
con el **mismo nombre** (ver `img/MANIFIESTO-IMAGENES.md`). El logo real ya está como
`img/logo.png`.

---

## Pendientes por confirmar (Alan)

- [ ] **Agencia de viajes:** confirmar si siguen dados de alta como agencia. Si sí,
      agregamos ese servicio con su distintivo legal.
- [ ] **Dominio .com.mx:** los flyers dicen `alfatours.com.mx`. Considera comprarlo y
      redirigirlo a `alfatours.mx` para no perder a quien lo escriba así.
- [ ] **Rotulado de unidades:** unificar el color del logo en las vans (hoy unas naranja y
      otras rojo/vino).
- [ ] **Chatbot de cotización:** pendiente de construir en otro chat (prompt ya listo).

---

## Referencias oficiales

- Cloudflare Pages · empezar con Git: <https://developers.cloudflare.com/pages/get-started/git-integration/>
- Cloudflare Pages · dominio personalizado: <https://developers.cloudflare.com/pages/configuration/custom-domains/>
- Cloudflare Email Routing: <https://developers.cloudflare.com/email-routing/get-started/enable-email-routing/>
