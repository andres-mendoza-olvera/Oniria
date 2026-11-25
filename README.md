# Oniria

Red social para contar sueños: la persona los escribe, los dicta o adjunta imágenes, recibe una interpretación psicológica y una imagen creada con IA, y puede publicarlos para sus amigos.

- **Frontend:** HTML semántico, CSS (Flexbox y Grid, responsive, tema claro y oscuro) y JavaScript ES6+ sin frameworks.
- **Backend:** Node.js 20+ y Express 5, API REST, sesiones en PostgreSQL.
- **Base de datos:** PostgreSQL en Supabase (las imágenes, en Supabase Storage).
- **IA:** modelo propio **Oniria** (Qwen2.5-3B con LoRA, en beta) y **Gemini** como respaldo y para imágenes; imágenes generadas con FLUX en Cloudflare Workers AI.
- **Seguridad:** contraseñas con bcrypt, verificación en 2 pasos (correo o SMS), detección de riesgo antes de cualquier IA y sanciones desde un panel de administración.

> Manual técnico completo: `docs/MANUAL_TECNICO.md`.

## Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase (base de datos PostgreSQL y un bucket de Storage)
- Claves de Gemini y de Cloudflare Workers AI
- Una cuenta de Google Cloud con la API de Gmail (para los correos)
- Opcional: la API del modelo Oniria y un servicio de SMS (httpSMS)

## Instalación

```bash
git clone https://github.com/andres-mendoza-olvera/Oniria.git
cd Oniria
npm install
cp .env.example .env     # en Windows: copy .env.example .env
# edita .env con tus datos
node server.js
```

La página queda en `http://localhost:3000`.

### Base de datos

En el SQL Editor de Supabase aplica, en orden, los archivos de `migraciones/` (001 a 013). Todos usan `IF NOT EXISTS`, así que se pueden repetir sin dañar datos.

### Variables de entorno

Las claves **nunca** se suben a GitHub: `.env` está en `.gitignore`. `.env.example` lista todas las variables:

| Variable | Para qué sirve |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL (Supabase, *Session pooler*) |
| `SESSION_SECRET` | Firma de las cookies de sesión |
| `BASE_URL`, `PORT` | Dirección pública y puerto |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini (interpretación y clasificación) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Generación de imágenes |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Almacenamiento de imágenes |
| `GMAIL_*` | Envío de correos con la API de Gmail |
| `HTTPSMS_API_KEY`, `HTTPSMS_FROM` | SMS (opcional) |
| `ONIRIA_ACTIVO`, `ONIRIA_URL`, `ONIRIA_API_KEY`, `ONIRIA_TIMEOUT_MS` | Modelo propio (opcional; sin él se usa Gemini) |

## Pruebas

```bash
npm test
```

Ejecuta 8 grupos de pruebas automáticas sobre una base PostgreSQL en memoria y un DOM simulado: no usan Supabase, Gemini ni el modelo, y no gastan cuota. También corren en GitHub Actions (`.github/workflows/pruebas.yml`).

## Estructura

| Ruta | Contenido |
|---|---|
| `server.js` | Servidor Express: rutas, sesiones, IA, seguridad |
| `oniria.js` | Cliente del modelo propio y traductor de etiquetas a estadísticas |
| `seguridad.js` | Detector de riesgo y de cuidado (autopruebas con `node seguridad.js`) |
| `etiquetas.js` | Limpieza de elementos y acciones de cada sueño |
| `*.html`, `*.css`, `*-script.js`, `Comun.js` | Páginas y su comportamiento |
| `migraciones/` | Cambios de la base de datos, numerados |
| `herramientas/` | Scripts de apoyo (crear administrador, clasificar sueños) |
| `tests/` | Pruebas automáticas |

## Seguridad y privacidad

- Todo mensaje pasa primero por el detector de riesgo; si hay señales, no se usa la IA y se muestra apoyo con líneas de ayuda (911, Línea de la Vida 800 911 2000, Locatel 55 5658 1111). Estos mensajes deben ser revisados por un profesional.
- Las claves van solo en el servidor. Si una clave se expone, se regenera.
- Las interpretaciones las genera una IA como reflexión personal y no sustituyen la opinión de un profesional.

## Estado del proyecto

El modelo propio Oniria está en **beta**: puede tardar de 1 a 4 minutos y, si no responde, la página usa Gemini sin avisar a la persona. No lee imágenes todavía.
