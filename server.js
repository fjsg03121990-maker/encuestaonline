/**
 * ============================================================================
 * SERVIDOR BACKEND SEGURO - ENCUESTA DE SATISFACCIÓN ANTIGRAVITY
 * ============================================================================
 * Arquitectura segura Zero-Dependencies (Node.js nativo):
 * - El backend valida y reenvía las respuestas de forma segura al Webhook de n8n
 * - n8n gestiona el almacenamiento en Airtable y el envío del correo de notificación
 * - Aplica Rate Limiting en memoria para evitar spam y ataques DoS
 * - Valida y sanitiza exhaustivamente todas las entradas antes de procesarlas
 * - Aplica cabeceras de seguridad HTTP (CSP, Anti-Sniffing, Anti-Clickjacking)
 * - Previene Path Traversal y fuga de archivos confidenciales
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Cargar variables de entorno de forma segura
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.join(__dirname, '.env'));
  }
} catch (_) {
  // Fallback si .env no existe o fue inyectado por el entorno de despliegue
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Directorio raíz para archivos estáticos permitidos
const PUBLIC_DIR = path.resolve(__dirname);

// Tipos MIME permitidos
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Archivos explícitamente bloqueados para prevenir fuga de código o secretos
const BLOCKED_FILES = new Set(['.env', '.env.example', '.gitignore', 'package.json', 'package-lock.json', 'server.js']);

/**
 * 2. Rate Limiting en memoria por dirección IP
 * Limita a un máximo de 6 envíos por ventana de 5 minutos por IP
 */
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 6;
const ipRequestHistory = new Map();

// Limpieza periódica de registros antiguos cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, history] of ipRequestHistory.entries()) {
    const valid = history.filter(time => now - time < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      ipRequestHistory.delete(ip);
    } else {
      ipRequestHistory.set(ip, valid);
    }
  }
}, 10 * 60 * 1000);

function checkRateLimit(ip) {
  const now = Date.now();
  const history = (ipRequestHistory.get(ip) || []).filter(time => now - time < RATE_LIMIT_WINDOW_MS);
  
  if (history.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  history.push(now);
  ipRequestHistory.set(ip, history);
  return true;
}

/**
 * 3. Cabeceras de seguridad HTTP (Hardening)
 */
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "script-src 'self'; " +
    "connect-src 'self'; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none';"
  );
}

/**
 * 4. Validador y Sanitizador estricto de entrada
 */
function validateAndSanitizeInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, message: 'Cuerpo de solicitud inválido.' };
  }

  // 4.1 Identificador del estudiante
  if (typeof body.id_estudiante !== 'string') {
    return { valid: false, message: 'El identificador de estudiante es obligatorio y debe ser texto.' };
  }
  const idEstudiante = body.id_estudiante.trim().slice(0, 80);
  if (idEstudiante.length < 2) {
    return { valid: false, message: 'El identificador de estudiante debe tener al menos 2 caracteres.' };
  }

  // 4.2 Nivel de Satisfacción (entero 1 a 5)
  const nivelSatisfaccion = Number(body.nivel_satisfaccion);
  if (!Number.isInteger(nivelSatisfaccion) || nivelSatisfaccion < 1 || nivelSatisfaccion > 5) {
    return { valid: false, message: 'El nivel de satisfacción debe ser un número entero entre 1 y 5.' };
  }

  // 4.3 Claridad del Contenido (entero 1 a 5)
  const claridadContenido = Number(body.claridad_contenido);
  if (!Number.isInteger(claridadContenido) || claridadContenido < 1 || claridadContenido > 5) {
    return { valid: false, message: 'La claridad del contenido debe ser un número entero entre 1 y 5.' };
  }

  // 4.4 Aplicabilidad Práctica (entero 1 a 5)
  const aplicabilidadPractica = Number(body.aplicabilidad_practica);
  if (!Number.isInteger(aplicabilidadPractica) || aplicabilidadPractica < 1 || aplicabilidadPractica > 5) {
    return { valid: false, message: 'La aplicabilidad práctica debe ser un número entero entre 1 y 5.' };
  }

  // 4.5 Comentarios Adicionales (texto opcional, máx 1000 caracteres)
  let comentarios = '';
  if (body.comentarios_adicionales && typeof body.comentarios_adicionales === 'string') {
    comentarios = body.comentarios_adicionales.trim().slice(0, 1000);
  }

  return {
    valid: true,
    data: {
      id_estudiante: idEstudiante,
      nivel_satisfaccion: nivelSatisfaccion,
      claridad_contenido: claridadContenido,
      aplicabilidad_practica: aplicabilidadPractica,
      comentarios_adicionales: comentarios,
      fecha_registro: new Date().toISOString()
    }
  };
}

/**
 * 5. Disparo seguro al Webhook de n8n desde el servidor
 * n8n se encarga de guardar en Airtable y despachar el email
 */
async function sendToN8nServer(surveyData) {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('La URL del Webhook de n8n no está configurada en el archivo .env del servidor.');
  }

  const scaleTexts = {
    satisfaccion: ['', '1 - Muy insatisfecho', '2 - Insatisfecho', '3 - Neutral', '4 - Satisfecho', '5 - Muy satisfecho'],
    claridad: ['', '1 - Muy poco claro', '2 - Poco claro', '3 - Aceptable', '4 - Claro', '5 - Muy claro'],
    aplicabilidad: ['', '1 - Nada aplicable', '2 - Poco aplicable', '3 - Moderadamente aplicable', '4 - Aplicable', '5 - Muy aplicable']
  };

  const payload = {
    // Formato estándar
    id_estudiante: surveyData.id_estudiante,
    nivel_satisfaccion: surveyData.nivel_satisfaccion,
    claridad_contenido: surveyData.claridad_contenido,
    aplicabilidad_practica: surveyData.aplicabilidad_practica,
    comentarios_adicionales: surveyData.comentarios_adicionales,
    
    // Nombres exactos de las columnas de Airtable para mapeo directo en n8n
    IdEstudiante: surveyData.id_estudiante,
    NivelSatisfaccion: surveyData.nivel_satisfaccion,
    ClaridadContenido: surveyData.claridad_contenido,
    AplicabilidadPractica: surveyData.aplicabilidad_practica,
    ComentariosAdicionales: surveyData.comentarios_adicionales,

    // Textos explicativos para el correo de n8n
    nivel_satisfaccion_label: scaleTexts.satisfaccion[surveyData.nivel_satisfaccion] || '',
    claridad_contenido_label: scaleTexts.claridad[surveyData.claridad_contenido] || '',
    aplicabilidad_practica_label: scaleTexts.aplicabilidad[surveyData.aplicabilidad_practica] || '',

    curso: 'Antigravity',
    fecha_registro: surveyData.fecha_registro
  };

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`El Webhook de n8n respondió con código ${response.status}. ${errorText}`);
  }

  const responseData = await response.json().catch(() => ({}));
  return responseData;
}

/**
 * 6. Servidor HTTP Principal
 */
const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);

  // Obtener IP del cliente de forma segura
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // ENDPOINT API SEGURO: POST /api/submit
  // -------------------------------------------------------------
  if (pathname === '/api/submit') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Método no permitido. Utiliza POST.' }));
    }

    // 6.1 Verificación de Rate Limiting
    if (!checkRateLimit(clientIp)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        error: 'Demasiadas solicitudes. Has alcanzado el límite permitido de envíos. Por favor espera unos minutos.' 
      }));
    }

    // 6.2 Lectura del cuerpo con límite de tamaño (Máx 64 KB)
    let bodyData = '';
    const MAX_BODY_BYTES = 64 * 1024;
    let exceeded = false;

    req.on('data', chunk => {
      bodyData += chunk;
      if (bodyData.length > MAX_BODY_BYTES) {
        exceeded = true;
        req.destroy();
      }
    });

    req.on('end', async () => {
      if (exceeded) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'El tamaño de la carga útil excede el límite permitido.' }));
      }

      let parsedBody;
      try {
        parsedBody = JSON.parse(bodyData);
      } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Formato JSON inválido.' }));
      }

      // 6.3 Validación estricta de campos
      const validation = validateAndSanitizeInput(parsedBody);
      if (!validation.valid) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: validation.message }));
      }

      const surveyData = validation.data;

      try {
        // 6.4 Envío seguro al Webhook de n8n (el cual inserta en Airtable y envía el email)
        const n8nResult = await sendToN8nServer(surveyData);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Encuesta enviada exitosamente a n8n para guardado en Airtable y notificación.',
          n8nData: n8nResult,
          data: surveyData
        }));

      } catch (error) {
        console.error('[API Submit Error]:', error.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          error: 'No se pudo enviar la encuesta a n8n: ' + error.message
        }));
      }
    });

    return;
  }

  // -------------------------------------------------------------
  // SERVICIO SEGURO DE ARCHIVOS ESTÁTICOS
  // -------------------------------------------------------------
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Método no permitido.');
  }

  let requestPath = pathname === '/' ? '/index.html' : pathname;
  // Prevenir Path Traversal
  const safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Asegurar que la ruta resuelta está estrictamente dentro de PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Acceso denegado.');
  }

  // Bloquear archivos confidenciales o del sistema
  const fileName = path.basename(filePath);
  if (BLOCKED_FILES.has(fileName) || fileName.startsWith('.')) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Acceso prohibido al archivo.');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Recurso no encontrado.');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      return res.end();
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

let currentPort = PORT;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    currentPort++;
    console.warn(`⚠️ Puerto ${currentPort - 1} ocupado. Reintentando en puerto ${currentPort}...`);
    setTimeout(() => {
      server.listen(currentPort, '0.0.0.0');
    }, 200);
  } else {
    console.error('Error crítico del servidor:', err);
  }
});

server.listen(currentPort, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor Seguro de Encuesta Activo`);
  console.log(`📍 Escuchando en: http://0.0.0.0:${currentPort}`);
  console.log(`🔒 Arquitectura: Webhook n8n (Airtable + Email)`);
  console.log(`====================================================`);
});
