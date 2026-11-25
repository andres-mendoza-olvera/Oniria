# Manual técnico de Oniria

## 1. Introducción

Oniria es una red social para contar sueños: la persona los escribe, los dicta o los acompaña con imágenes, recibe una interpretación psicológica y una imagen creada con IA, y puede publicarlos para sus amigos.

Este manual explica cómo está construida la aplicación, cómo instalarla, desplegarla y mantenerla. Cubre la aplicación web (frontend en HTML, CSS y JavaScript; backend en Node.js con Express; base de datos PostgreSQL en Supabase) y su integración con dos motores de IA: Gemini, de Google, y el modelo propio Oniria, un Qwen2.5-3B afinado con LoRA (`oniria-3b-v2`) que está en fase beta.

Está pensado para quien mantenga, despliegue o evalúe el proyecto. La integración del modelo propio vive en la rama `oniria-beta` (pull request n.º 1 del repositorio `andres-mendoza-olvera/Oniria`).

## 2. Arquitectura general

La aplicación tiene cuatro capas. El navegador pide páginas y llama a la API REST del servidor Express; el servidor guarda todo en PostgreSQL (Supabase) y decide qué motor de IA usa. Las claves viven solo en el servidor.

```
Navegador (HTML + CSS + JS)
        │  fetch / formularios
        ▼
Servidor Express (Render) ── sesiones, validación, seguridad
        │            │               │
        ▼            ▼               ▼
 PostgreSQL     Gemini (Google)   Oniria (API en la PC, por túnel)
 + Storage      + FLUX (Cloudflare)
```

Flujo de un sueño con el modelo propio activo:

1. El servidor revisa el texto con el detector de riesgo (`seguridad.js`). Si hay señales, responde con apoyo y no usa ninguna IA.
2. Gemini clasifica el sueño (título, emoción, tipo, tema, elementos, acciones) al mismo tiempo que Oniria lo analiza (`/analizar`).
3. La persona ve la primera lectura con preguntas. Responde, o escribe «omitir».
4. Oniria da la interpretación (`/interpretar`). Si falla, tarda demasiado o se niega a interpretar por falta de contexto, responde Gemini.
5. Se guarda la conversación y se crea la imagen (Cloudflare FLUX) y se sube a Supabase Storage.

Con imágenes adjuntas, Gemini hace todo, porque Oniria todavía no lee imágenes.

## 3. Tecnologías y dependencias

| Pieza | Para qué se usa |
|---|---|
| Node.js 20+ y Express 5 | Servidor y API REST |
| `express-session` y `connect-pg-simple` | Sesiones guardadas en la tabla `sesiones` |
| `pg` | Conexión a PostgreSQL |
| `bcrypt` | Cifrado de contraseñas |
| `multer` | Subida de imágenes en memoria (máximo 3, de 5 MB) |
| `dotenv` | Lectura del archivo `.env` |
| `@electric-sql/pglite` y `jsdom` (desarrollo) | Pruebas con base en memoria y DOM simulado |
| Supabase | PostgreSQL y Storage de imágenes |
| Gemini | Interpretación, clasificación e imágenes adjuntas |
| Cloudflare Workers AI (FLUX.1 schnell) | Imagen de cada sueño |
| API de Gmail | Correos de verificación y recuperación |
| httpSMS | SMS de verificación (opcional) |
| Render | Hosting del servidor |

## 4. Estructura del proyecto

| Ruta | Contenido |
|---|---|
| `server.js` | Rutas, sesiones, IA, seguridad y administración |
| `oniria.js` | Cliente del modelo propio y traducción de sus etiquetas a las estadísticas |
| `seguridad.js` | Detector de riesgo (crisis) y de cuidado (ideación pasiva), con autopruebas |
| `etiquetas.js` | Limpieza de elementos y acciones de cada sueño |
| `Comun.js`, `Tema.js` | Utilidades compartidas del frontend y tema claro u oscuro |
| `*.html`, `*.css`, `*-script.js` | Una página y su comportamiento (Feedback, Sueno, Perfil, Estadisticas, Admin, LogIn, Registro…) |
| `Graficas.js` y `Graficas.css` | Gráficas de las estadísticas |
| `migraciones/` | Cambios de la base de datos, numerados del 001 al 013 |
| `herramientas/` | `crear-admin.js` y `clasificar-suenos.js` |
| `tests/` | Pruebas automáticas (`npm test`) |
| `.github/workflows/pruebas.yml` | Pruebas en cada push y pull request |

## 5. Base de datos

PostgreSQL en Supabase. Las tablas principales:

| Tabla | Contenido |
|---|---|
| `usuarios` | Cuenta, perfil, preferencias, rol (`usuario`, `moderador`, `admin`), sanciones y aceptación de políticas |
| `sesiones` | Sesiones de `express-session` |
| `publicaciones` | Sueños publicados, con emoción, tipo, tema, `motor`, `elementos` y `acciones` |
| `medios_publicacion` | Imágenes de cada publicación |
| `corazones` | Reacciones |
| `comentarios` | Comentarios |
| `amistades` y `bloqueos` | Relaciones entre cuentas |
| `conversaciones` | Chat de cada sueño (mensajes, historial, imágenes, `motor`, `fase_oniria`, `etiquetas_oniria`, `elementos`, `acciones`) |
| `memorias` | Resumen breve de cada sueño para dar continuidad a la IA |
| `reportes` | Reportes de publicaciones o comentarios |
| `opiniones` | Valoración de 1 a 5 y comentario sobre la experiencia |

Migraciones, a aplicar en orden en el SQL Editor de Supabase. Todas usan `IF NOT EXISTS` y se pueden repetir:

| N.º | Cambio |
|---|---|
| 001–010 | Perfil, teléfono, bloqueos, preferencias, políticas, conversaciones, administración, cuentas eliminadas, reacciones y memoria |
| 011 | Motor de IA: `motor`, `fase_oniria`, `etiquetas_oniria` |
| 012 | `elementos` y `acciones` con índices GIN |
| 013 | Tabla `opiniones` |

Antes de aplicar migraciones en la base real, haz una copia de seguridad con `pg_dump` o desde Database > Backups en Supabase.

## 6. API REST

Las rutas están en `server.js`, agrupadas por tema. Todas las rutas `/api` exigen sesión, salvo las de acceso.

| Módulo | Rutas principales |
|---|---|
| Cuenta y acceso | `POST /registro`, `POST /login`, `POST /cerrar-sesion`, `GET /verificar/:token`, `POST /olvide-contrasena`, `POST /restablecer/:token`, `GET /api/yo` |
| Verificación en 2 pasos | `GET /api/acceso`, `POST /api/acceso/enviar`, `POST /api/acceso/verificar` |
| Chat del sueño | `POST /api/sueno/mensaje`, `GET /api/conversaciones`, `GET` y `DELETE /api/conversaciones/:id`, `POST /api/conversaciones/:id/publicar` |
| Estado y opiniones | `GET /api/estado-ia`, `POST /api/opiniones` |
| Feed y publicaciones | `GET /api/feed`, `GET` y `DELETE /api/publicaciones/:id`, comentarios, `corazon` y `reaccion` |
| Amigos y bloqueos | `/api/amigos/:id`, `/api/solicitudes`, `/api/bloqueos/:id`, `GET /api/usuarios` |
| Perfil y memoria | `GET /api/perfil/:id`, `PUT /api/perfil`, `/api/memoria`, `/api/telefono`, `POST /api/cuenta/eliminar` |
| Estadísticas | `GET /api/mis-estadisticas`, `GET /api/clima-onirico` |
| Moderación | `POST /api/reportes` |
| Administración (moderador o admin) | `/api/admin/usuarios`, `/api/admin/reportes`, `/api/admin/publicaciones`, `/api/admin/estadisticas`, `/api/admin/equipo` |

Errores: las respuestas de error llevan `{ error: "mensaje" }` y el código HTTP correspondiente (400 datos inválidos, 401 sin sesión, 404 no existe, 429 límite, 503 IA no disponible). Si Gemini está saturado, el 503 trae `origen: "gemini"` y la página muestra un aviso.

## 7. Inteligencia artificial

**Gemini** interpreta, clasifica y atiende los sueños con imágenes. El servidor prueba varios modelos en orden (`GEMINI_MODEL`) y reintenta si Google responde 503, 429 o 500.

**Oniria (modelo propio, beta)** corre en una API FastAPI en la PC del autor y se expone por un túnel. El servidor la llama con una clave (`ONIRIA_API_KEY`) y un tiempo máximo (`ONIRIA_TIMEOUT_MS`, 300000 ms por defecto, porque el modelo tarda de 1 a 4 minutos). Sus dos pasos son:

| Paso | Qué devuelve |
|---|---|
| `/analizar` | Análisis, lectura inicial y preguntas; indica si es publicable |
| `/interpretar` | Interpretación final y etiquetas (emociones con intensidad, temas, entornos, personajes, elementos y acciones) |

`oniria.js` traduce esas etiquetas a las categorías de las estadísticas: seis emociones, cuatro tipos y seis temas. Si el modelo no da un tema reconocible, no se pisa el que puso Gemini.

**Respaldo silencioso:** si Oniria está caída, devuelve error, tarda demasiado o se niega a interpretar («sin más contexto…»), responde Gemini sin avisar a la persona. Tras una falla, el servidor deja de llamar al modelo 60 segundos.

**Memoria:** cada sueño deja un resumen breve en `memorias`; la IA recibe hasta 12 recuerdos recientes para dar continuidad. La persona puede verlos, editarlos o desactivarlos.

**Imágenes:** Gemini escribe una descripción en inglés; Cloudflare FLUX la dibuja; el servidor la sube a Supabase Storage.

## 8. Seguridad

| Medida | Cómo funciona |
|---|---|
| Contraseñas | Cifradas con bcrypt; el correo se normaliza |
| Sesiones | Cookie `httpOnly`, `sameSite=lax` y `secure` en HTTPS; los datos viven en PostgreSQL y duran 7 días |
| Verificación en 2 pasos | Código de 6 dígitos por correo o SMS, con hash, caducidad de 10 minutos, 5 intentos y límite de envíos |
| Roles | `usuario`, `moderador` y `admin`; las cuentas de administración solo ven su panel |
| Sanciones | Suspensión o baneo con motivo, desde el panel; cuentas eliminadas se anonimizan |
| Datos de entrada | Consultas parametrizadas, texto limitado en tamaño, imágenes de 5 MB como máximo y solo tipos permitidos |
| Cuidado del texto en pantalla | El frontend usa `textContent`; `innerHTML` solo se usa para iconos propios |
| Límites | 25 mensajes por conversación, 30 borradores por persona, 30 opiniones al día |
| Claves | Solo en variables de entorno del servidor; nunca en el repositorio |

**Detección de riesgo, en dos niveles y antes de cualquier IA:**

1. `evaluarRiesgo`: lenguaje explícito de crisis. Responde con un mensaje de crisis y teléfonos (911, Línea de la Vida 800 911 2000, Locatel 55 5658 1111).
2. `evaluarCuidado`: ideación pasiva («ya no quería seguir adelante», «nadie notaría si desapareciera»). Responde con un mensaje de cuidado y los mismos teléfonos.

Gemini añade `senal_cuidado` en su respuesta; si es verdadera, se descarta su respuesta. En ningún caso se guarda el mensaje como sueño. Los patrones son reglas, no una garantía: los mensajes deben ser revisados por un profesional y los teléfonos verificados.

**Privacidad:** al registrarse se aceptan los Términos y la Política. Si cambian, la fecha `POLITICAS_VIGENTES_DESDE` en `server.js` obliga a aceptarlos otra vez al entrar.

## 9. Instalación y configuración local

```bash
git clone https://github.com/andres-mendoza-olvera/Oniria.git
cd Oniria
npm install
cp .env.example .env       # en Windows: copy .env.example .env
node server.js             # http://localhost:3000
```

1. Crea un proyecto en Supabase y aplica las migraciones 001 a 013.
2. Llena `.env`. Para la base usa el *Session pooler* (usuario `postgres.<ref>`, puerto 5432 o 6543).
3. Crea una cuenta de administración con `ADMIN_CONTRASENA='...' node herramientas/crear-admin.js correo@ejemplo.com apodo "Nombre"` (la contraseña no se escribe en el código).
4. Para probar sin gastar cuota, activa el modo falso del modelo (`ONIRIA_FAKE=1` en la API del modelo) con la misma clave que `ONIRIA_API_KEY`.

Variables de entorno:

| Variable | Para qué sirve |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Conexión a PostgreSQL |
| `SESSION_SECRET` | Firma de cookies (obligatoria) |
| `BASE_URL`, `PORT` | Dirección pública y puerto |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Imágenes con FLUX |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_BUCKET` | Storage |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER` | Correos |
| `HTTPSMS_API_KEY`, `HTTPSMS_FROM`, `HTTPSMS_BASE_URL` | SMS opcional |
| `ONIRIA_ACTIVO`, `ONIRIA_URL`, `ONIRIA_API_KEY`, `ONIRIA_TIMEOUT_MS` | Modelo propio |

## 10. Despliegue, respaldo y reversión

**Despliegue en Render:** el servicio web ejecuta `node server.js`. Las variables se configuran en Environment y Render redespliega al guardar o al fusionar en `main`.

**Modelo propio por túnel:** la API del modelo corre en la PC (`uvicorn api:app --host 127.0.0.1 --port 8000`) y se publica con un túnel de dominio fijo, por ejemplo ngrok. `ONIRIA_URL` apunta a ese dominio. Cloudflare corta las respuestas de más de unos 100 segundos, así que con ese túnel el modelo necesitaría un sistema de trabajos con consulta periódica. Si la PC se apaga, la página funciona solo con Gemini.

**Orden para publicar una versión nueva:**

1. Respaldar la base de datos.
2. Etiquetar el `main` actual (`git tag antes-de-beta` y `git push origin antes-de-beta`).
3. Aplicar las migraciones nuevas.
4. Configurar las variables de entorno en Render.
5. Fusionar el pull request y revisar que el despliegue diga Live.

**Reversión:** botón *Revert* del pull request fusionado, o *Rollback* a un despliegue anterior en Render. La base no se revierte con git; las migraciones solo agregan columnas, así que el código anterior sigue funcionando.

## 11. Pruebas

`npm test` ejecuta 8 grupos de pruebas con el ejecutor integrado de Node. No tocan Supabase, Gemini ni el modelo.

| Grupo | Qué verifica |
|---|---|
| Seguridad (`seguridad.js`) | Frases que deben y no deben activar crisis o cuidado |
| Etiquetas (`etiquetas.js`) | Limpieza de elementos y acciones |
| Flujo de IA | Gemini, Oniria, memoria y estadísticas sobre PostgreSQL en memoria |
| Estado y seguridad en el chat | Gemini saturado, «omitir», cuidado y publicar y seguir conversando |
| Opiniones | Validación, propiedad de la conversación, límite diario y apoyo |
| Interfaz del chat | Botones, avisos y listas de teléfonos con jsdom |
| Interfaz de opiniones | Widget, aviso de imágenes y mensaje de espera |
| Gráficas | Etiquetas y ranking de estadísticas |

Las pruebas corren en GitHub Actions (`.github/workflows/pruebas.yml`) en cada push y pull request.

## 12. Limitaciones conocidas y mantenimiento

- El modelo propio tarda de 1 a 4 minutos y depende de una PC encendida con túnel; para producción conviene un sistema de trabajos asíncrono.
- Oniria no lee imágenes; en esos casos responde Gemini.
- El detector de riesgo se basa en reglas y no es infalible; Gemini añade una segunda señal. El módulo en Python del modelo todavía no tiene el nivel de cuidado.
- Las tablas de Supabase tienen RLS desactivado: el acceso es solo desde el servidor con credenciales privadas, pero conviene activarlo con políticas.
- Revisar con un profesional los mensajes de crisis y de cuidado, y confirmar los teléfonos.
- El texto de privacidad debe mencionar el uso de IA y el envío de textos a terceros (Google y Cloudflare); al cambiarlo, actualizar `POLITICAS_VIGENTES_DESDE`.
- Regenerar las claves si alguna se expone (Gemini, Oniria, base de datos).
- Dos reentrenamientos pendientes del modelo: respuestas sin contexto («omitir») y modismos.
