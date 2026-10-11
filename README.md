# 🚀 Encuesta de Satisfacción - Curso Antigravity (encuestaonline)

Página web moderna y segura para la recolección de feedback de estudiantes sobre el curso de Antigravity. El sistema implementa una arquitectura segura con un backend ligero en Node.js que valida los datos, aplica límites de tasa (*rate limiting*) y los reenvía de forma protegida a un webhook de **n8n**, el cual gestiona la persistencia en **Airtable** y el envío automático de notificaciones por correo electrónico.

---

## ✨ Características

- **Diseño Moderno & Glassmorphism:** Interfaz visual *dark-mode* de alto nivel con degradados armónicos, tarjetas interactivas de calificación y diseño 100% responsivo (móvil y escritorio).
- **Escalas Interactivas de Calificación (1 a 5):**
  1. `IdEstudiante`: Identificador de texto del alumno (carnet / matrícula).
  2. `NivelSatisfaccion`: Escala 1 a 5 (*Muy insatisfecho* a *Muy satisfecho*).
  3. `ClaridadContenido`: Escala 1 a 5 (*Muy poco claro* a *Muy claro*).
  4. `AplicabilidadPractica`: Escala 1 a 5 (*Nada aplicable* a *Muy aplicable*).
  5. `ComentariosAdicionales`: Campo de texto libre con contador de caracteres dinámico.
- **Barra de Progreso Reactiva:** Informa al estudiante del avance del formulario en tiempo real.
- **Arquitectura Segura (BFF - Backend for Frontend):**
  - Cero dependencias externas (`Node.js` nativo).
  - Ninguna credencial ni URL sensible en el frontend del navegador.
  - *Rate Limiting* en memoria por dirección IP para mitigar spam y ataques automatizados.
  - Validación y sanitización estricta de datos del lado del servidor.
  - Cabeceras de seguridad HTTP (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`).
  - Protección contra *Path Traversal* y bloqueo de archivos sensibles.
- **Automatización Completa con n8n:**
  - El backend envía los datos formateados al webhook de n8n.
  - n8n inserta el registro en **Airtable** y despacha el correo electrónico de confirmación.

---

## 📁 Estructura del Proyecto

```text
├── index.html         # Interfaz web semántica y accesible
├── styles.css         # Estilos visuales premium, variables CSS y animaciones
├── app.js             # Lógica cliente (progreso reactivo, validación y envío a /api/submit)
├── server.js          # Servidor HTTP seguro (Rate Limiting, proxy a n8n, cabeceras)
├── package.json       # Configuración y scripts npm
├── .env.example       # Plantilla de variables de entorno
└── .gitignore         # Exclusión estricta de archivos sensibles (.env)
```

---

## 🛠️ Requisitos Previos

- [Node.js](https://nodejs.org/) (versión 18 o superior).

---

## 🚀 Instalación y Puesta en Marcha

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/fjsg03121990-maker/encuestaonline.git
   cd encuestaonline
   ```

2. **Configurar las variables de entorno:**
   Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
   Edita `.env` con la URL de tu Webhook de n8n:
   ```env
   PORT=3000
   N8N_WEBHOOK_URL=https://tu-instancia.n8n.cloud/webhook/tu-identificador
   ```

3. **Iniciar el servidor:**
   ```bash
   npm start
   ```

4. **Acceder a la aplicación:**
   Abre en tu navegador favorito:
   👉 **`http://localhost:3000`**

---

## 🔒 Consideraciones de Seguridad

- **Variables de Entorno:** El archivo `.env` nunca debe subirse al repositorio. Está protegido en `.gitignore`.
- **Validación Dual:** Las validaciones existen tanto en el navegador para guiar al alumno como en el servidor para garantizar la integridad de los datos.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.
>>>>>>> e22ae7c (Initial commit: Encuesta de satisfaccion segura para el curso Antigravity)
