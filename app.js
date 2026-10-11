/**
 * ============================================================================
 * CLIENTE SEGURO - ENCUESTA DE SATISFACCIÓN ANTIGRAVITY
 * ============================================================================
 * - Sin credenciales, tokens ni URLs de webhooks en el cliente (100% blindado)
 * - Comunicación exclusiva con el backend seguro a través de '/api/submit'
 * - Validación reactiva, cálculo de progreso y experiencia de usuario fluida
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Endpoint de la API en el backend seguro
  const API_ENDPOINT = '/api/submit';

  // Elementos principales del DOM
  const surveyForm = document.getElementById('surveyForm');
  const surveySection = document.getElementById('surveySection');
  const successSection = document.getElementById('successSection');
  
  // Elementos de progreso
  const progressBar = document.getElementById('progressBar');
  const progressPercentage = document.getElementById('progressPercentage');
  const progressBarContainer = document.getElementById('progressBarContainer');

  // Campos del formulario
  const idEstudianteInput = document.getElementById('id_estudiante');
  const comentariosInput = document.getElementById('comentarios_adicionales');
  const charCount = document.getElementById('charCount');
  const formAlert = document.getElementById('formAlert');

  // Botones y estados de acción
  const btnSubmit = document.getElementById('btnSubmit');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const btnSubmitIcon = document.getElementById('btnSubmitIcon');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnReset = document.getElementById('btnReset');
  const btnNewResponse = document.getElementById('btnNewResponse');
  const btnToggleHistory = document.getElementById('btnToggleHistory');
  const btnExportJson = document.getElementById('btnExportJson');
  const historyContainer = document.getElementById('historyContainer');
  const historyList = document.getElementById('historyList');
  const recordsBadge = document.getElementById('recordsBadge');

  // Elementos del resumen de éxito
  const summaryIdEstudiante = document.getElementById('summaryIdEstudiante');
  const summarySatisfaccion = document.getElementById('summarySatisfaccion');
  const summaryClaridad = document.getElementById('summaryClaridad');
  const summaryAplicabilidad = document.getElementById('summaryAplicabilidad');
  const summaryComentarios = document.getElementById('summaryComentarios');
  const summaryRecordId = document.getElementById('summaryRecordId');
  const summaryN8nStatus = document.getElementById('summaryN8nStatus');
  const n8nSuccessText = document.getElementById('n8nSuccessText');

  // Textos y etiquetas descriptivas para las escalas
  const scaleLabels = {
    nivel_satisfaccion: {
      '1': '1 - Muy insatisfecho',
      '2': '2 - Insatisfecho',
      '3': '3 - Neutral',
      '4': '4 - Satisfecho',
      '5': '5 - Muy satisfecho'
    },
    claridad_contenido: {
      '1': '1 - Muy poco claro',
      '2': '2 - Poco claro',
      '3': '3 - Aceptable',
      '4': '4 - Claro',
      '5': '5 - Muy claro'
    },
    aplicabilidad_practica: {
      '1': '1 - Nada aplicable',
      '2': '2 - Poco aplicable',
      '3': '3 - Moderadamente aplicable',
      '4': '4 - Aplicable',
      '5': '5 - Muy aplicable'
    }
  };

  // Clave en LocalStorage para historial en el navegador
  const STORAGE_KEY = 'antigravity_survey_responses';

  /**
   * Obtiene respuestas respaldadas en localStorage
   */
  const getStoredResponses = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  };

  /**
   * Guarda una nueva respuesta en localStorage como historial de usuario
   */
  const saveResponse = (responseData) => {
    const list = getStoredResponses();
    list.unshift(responseData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
    updateHistoryUI();
  };

  /**
   * Actualiza el badge de respuestas y la lista histórica
   */
  const updateHistoryUI = () => {
    const list = getStoredResponses();
    const count = list.length;
    recordsBadge.textContent = `${count} ${count === 1 ? 'respuesta registrada' : 'respuestas registradas'}`;

    if (count > 0) {
      btnExportJson.style.display = 'inline-block';
    } else {
      btnExportJson.style.display = 'none';
    }

    if (list.length === 0) {
      historyList.innerHTML = '<p style="color: var(--text-dim); font-size: 0.825rem;">Aún no hay respuestas guardadas en este navegador.</p>';
      return;
    }

    historyList.innerHTML = list.map((item) => `
      <div class="history-item">
        <div>
          <span class="history-id">${escapeHtml(item.id_estudiante)}</span>
          ${item.airtable_id ? `<span style="font-size: 0.72rem; color: #818cf8; margin-left: 0.4rem;">[Airtable: ${escapeHtml(item.airtable_id)}]</span>` : ''}
          <div style="font-size: 0.72rem; color: var(--text-dim);">
            ${new Date(item.fecha_registro).toLocaleDateString()} ${new Date(item.fecha_registro).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div class="history-scores">
          <span>Sat: <strong>${item.nivel_satisfaccion}/5</strong></span> | 
          <span>Clar: <strong>${item.claridad_contenido}/5</strong></span> | 
          <span>Apli: <strong>${item.aplicabilidad_practica}/5</strong></span>
        </div>
      </div>
    `).join('');
  };

  /**
   * Calcula y actualiza la barra de progreso reactiva
   */
  const updateProgress = () => {
    const totalRequired = 4;
    let completed = 0;

    if (idEstudianteInput.value.trim().length >= 2) {
      completed++;
    }

    const scaleFields = ['nivel_satisfaccion', 'claridad_contenido', 'aplicabilidad_practica'];
    scaleFields.forEach((fieldName) => {
      const checked = surveyForm.querySelector(`input[name="${fieldName}"]:checked`);
      if (checked) {
        completed++;
      }
    });

    const percent = Math.round((completed / totalRequired) * 100);
    progressBar.style.width = `${percent}%`;
    progressPercentage.textContent = `${percent}%`;
    progressBarContainer.setAttribute('aria-valuenow', percent);
  };

  /**
   * Contador de caracteres
   */
  comentariosInput.addEventListener('input', () => {
    charCount.textContent = comentariosInput.value.length;
  });

  /**
   * Limpiar errores al interactuar con campos
   */
  idEstudianteInput.addEventListener('input', () => {
    clearFieldError('id_estudiante', 'id-error');
    if (formAlert) formAlert.hidden = true;
    updateProgress();
  });

  const radioInputs = surveyForm.querySelectorAll('input[type="radio"]');
  radioInputs.forEach(radio => {
    radio.addEventListener('change', () => {
      const groupName = radio.name;
      let errorId = '';
      if (groupName === 'nivel_satisfaccion') errorId = 'satisfaccion-error';
      if (groupName === 'claridad_contenido') errorId = 'claridad-error';
      if (groupName === 'aplicabilidad_practica') errorId = 'aplicabilidad-error';

      clearFieldError(groupName, errorId);
      if (formAlert) formAlert.hidden = true;
      updateProgress();
    });
  });

  function clearFieldError(groupName, errorId) {
    const groupElement = document.getElementById(`group-${groupName}`);
    const errorElement = document.getElementById(errorId);
    if (groupElement) groupElement.classList.remove('has-error');
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.classList.remove('visible');
    }
  }

  function setFieldError(groupName, errorId, message) {
    const groupElement = document.getElementById(`group-${groupName}`);
    const errorElement = document.getElementById(errorId);
    if (groupElement) groupElement.classList.add('has-error');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.add('visible');
    }
  }

  /**
   * Validación del lado del cliente
   */
  function validateForm() {
    let isValid = true;
    let firstInvalidGroup = null;

    // 1. Validar ID de Estudiante
    const idVal = idEstudianteInput.value.trim();
    if (!idVal) {
      setFieldError('id_estudiante', 'id-error', 'Por favor ingresa tu identificador de estudiante.');
      isValid = false;
      firstInvalidGroup = firstInvalidGroup || document.getElementById('group-id_estudiante');
    } else if (idVal.length < 2) {
      setFieldError('id_estudiante', 'id-error', 'El identificador debe tener al menos 2 caracteres.');
      isValid = false;
      firstInvalidGroup = firstInvalidGroup || document.getElementById('group-id_estudiante');
    } else {
      clearFieldError('id_estudiante', 'id-error');
    }

    // 2. Validar nivel_satisfaccion
    const satChecked = surveyForm.querySelector('input[name="nivel_satisfaccion"]:checked');
    if (!satChecked) {
      setFieldError('nivel_satisfaccion', 'satisfaccion-error', 'Por favor selecciona tu nivel de satisfacción.');
      isValid = false;
      firstInvalidGroup = firstInvalidGroup || document.getElementById('group-nivel_satisfaccion');
    } else {
      clearFieldError('nivel_satisfaccion', 'satisfaccion-error');
    }

    // 3. Validar claridad_contenido
    const clarChecked = surveyForm.querySelector('input[name="claridad_contenido"]:checked');
    if (!clarChecked) {
      setFieldError('claridad_contenido', 'claridad-error', 'Por favor califica la claridad del contenido.');
      isValid = false;
      firstInvalidGroup = firstInvalidGroup || document.getElementById('group-claridad_contenido');
    } else {
      clearFieldError('claridad_contenido', 'claridad-error');
    }

    // 4. Validar aplicabilidad_practica
    const aplChecked = surveyForm.querySelector('input[name="aplicabilidad_practica"]:checked');
    if (!aplChecked) {
      setFieldError('aplicabilidad_practica', 'aplicabilidad-error', 'Por favor califica la aplicabilidad práctica.');
      isValid = false;
      firstInvalidGroup = firstInvalidGroup || document.getElementById('group-aplicabilidad_practica');
    } else {
      clearFieldError('aplicabilidad_practica', 'aplicabilidad-error');
    }

    if (!isValid && firstInvalidGroup) {
      firstInvalidGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return isValid;
  }

  /**
   * Estado visual del botón durante el envío
   */
  const setSubmittingState = (isSubmitting, statusText = 'Finalizar y Enviar Encuesta') => {
    btnSubmit.disabled = isSubmitting;
    btnReset.disabled = isSubmitting;
    if (isSubmitting) {
      btnSpinner.hidden = false;
      btnSubmitIcon.hidden = true;
      btnSubmitText.textContent = statusText;
      formAlert.hidden = true;
      formAlert.textContent = '';
    } else {
      btnSpinner.hidden = true;
      btnSubmitIcon.hidden = false;
      btnSubmitText.textContent = 'Finalizar y Enviar Encuesta';
    }
  };

  /**
   * Procesamiento y Envío a través del Backend Seguro
   */
  surveyForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    formAlert.hidden = true;
    formAlert.textContent = '';

    // Detección de protocolo file:// (guía al usuario si no inició el backend)
    if (window.location.protocol === 'file:') {
      formAlert.textContent = '⚠️ Estás ejecutando el archivo directamente con protocolo "file://". Para procesar los envíos de forma segura con Airtable y n8n sin exponer credenciales, inicia el servidor ejecutando "npm start" y abre http://localhost:3000.';
      formAlert.hidden = false;
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const formData = {
      id_estudiante: idEstudianteInput.value.trim(),
      nivel_satisfaccion: Number(surveyForm.querySelector('input[name="nivel_satisfaccion"]:checked').value),
      claridad_contenido: Number(surveyForm.querySelector('input[name="claridad_contenido"]:checked').value),
      aplicabilidad_practica: Number(surveyForm.querySelector('input[name="aplicabilidad_practica"]:checked').value),
      comentarios_adicionales: comentariosInput.value.trim()
    };

    setSubmittingState(true, 'Procesando en servidor seguro...');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = result.error || `Error en el servidor (${response.status})`;
        throw new Error(errorMsg);
      }

      // Registro exitoso
      const finalRecord = {
        ...formData,
        airtable_id: result.airtableId,
        fecha_registro: result.data?.fecha_registro || new Date().toISOString()
      };

      saveResponse(finalRecord);

      // Actualizar pantalla de confirmación
      summaryIdEstudiante.textContent = finalRecord.id_estudiante;
      summarySatisfaccion.textContent = scaleLabels.nivel_satisfaccion[finalRecord.nivel_satisfaccion];
      summaryClaridad.textContent = scaleLabels.claridad_contenido[finalRecord.claridad_contenido];
      summaryAplicabilidad.textContent = scaleLabels.aplicabilidad_practica[finalRecord.aplicabilidad_practica];

      if (summaryN8nStatus) {
        summaryN8nStatus.textContent = '✓ Enviado a n8n';
      }

      if (n8nSuccessText) {
        n8nSuccessText.textContent = 'Guardado en Airtable y notificado vía n8n';
      }

      if (finalRecord.comentarios_adicionales) {
        summaryComentarios.textContent = `"${finalRecord.comentarios_adicionales}"`;
      } else {
        summaryComentarios.textContent = 'Sin comentarios adicionales.';
      }

      // Transición a pantalla de éxito
      surveySection.hidden = true;
      successSection.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
      console.error('[Error de Envío]:', error);
      formAlert.textContent = `⚠️ ${error.message}`;
      formAlert.hidden = false;
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } finally {
      setSubmittingState(false);
    }
  });

  /**
   * Botón de reiniciar
   */
  btnReset.addEventListener('click', () => {
    setTimeout(() => {
      charCount.textContent = '0';
      formAlert.hidden = true;
      formAlert.textContent = '';
      ['id_estudiante', 'nivel_satisfaccion', 'claridad_contenido', 'aplicabilidad_practica'].forEach(name => {
        let errId = 'id-error';
        if (name === 'nivel_satisfaccion') errId = 'satisfaccion-error';
        if (name === 'claridad_contenido') errId = 'claridad-error';
        if (name === 'aplicabilidad_practica') errId = 'aplicabilidad-error';
        clearFieldError(name, errId);
      });
      updateProgress();
    }, 10);
  });

  /**
   * Botón para nueva encuesta
   */
  btnNewResponse.addEventListener('click', () => {
    surveyForm.reset();
    charCount.textContent = '0';
    formAlert.hidden = true;
    formAlert.textContent = '';
    updateProgress();
    successSection.hidden = true;
    surveySection.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /**
   * Alternar vista del registro local
   */
  btnToggleHistory.addEventListener('click', () => {
    const isHidden = historyContainer.hidden;
    historyContainer.hidden = !isHidden;
    btnToggleHistory.textContent = isHidden ? 'Ocultar registro local' : 'Ver registro local';
  });

  /**
   * Exportar historial local a JSON
   */
  btnExportJson.addEventListener('click', () => {
    const list = getStoredResponses();
    if (list.length === 0) return;

    const jsonString = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(list, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `encuestas_antigravity_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  updateProgress();
  updateHistoryUI();
});
