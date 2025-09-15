import { qs, openModal, closeModal } from './shared.js';
import { apiClient } from './apiClient.js';

let form;
let dropzone;
let inputFile;
let previewImg;
let btnGeo;
let btnCamera;
let toast;
let removeBtn;

// Variables para la cámara
let videoStream = null;
let cameraModal = null;
let videoElement = null;
let captureButton = null;
let retakeButton = null;
let closeButton = null;

let selectedFile = null;
let previewObjectUrl = null;

function bindEls() {
  form = qs('#plantForm');
  dropzone = qs('#dropzone');
  inputFile = qs('#imageInput');
  previewImg = qs('#imagePreview');
  btnGeo = qs('#btnGeo');
  btnCamera = qs('#btnCamera');
  toast = qs('#toast');
  removeBtn = qs('#dzRemove');
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function showToast(msg, timeout = 2500) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast && toast.classList.remove('show'), timeout);
}

function updatePreview(file) {
  if (!dropzone || !previewImg) return;
  const instructions = dropzone.querySelector('.dz-instructions');
  const removeBtnLocal = qs('#dzRemove');
  // Revocar URL previa si existe
  if (previewObjectUrl) {
    try { URL.revokeObjectURL(previewObjectUrl); } catch (_) {}
    previewObjectUrl = null;
  }
  if (!file) {
    previewImg.src = '';
    previewImg.style.display = 'none';
    dropzone.classList.remove('has-file');
    if (instructions) instructions.style.display = '';
    if (removeBtnLocal) removeBtnLocal.style.display = 'none';
    return;
  }
  const url = URL.createObjectURL(file);
  previewObjectUrl = url;
  previewImg.src = url;
  previewImg.style.display = 'block';
  dropzone.classList.add('has-file');
  if (instructions) instructions.style.display = 'none';
  if (removeBtnLocal) removeBtnLocal.style.display = '';
}

function wireDnD() {
  if (!dropzone || !inputFile) return;
  // Interacciones dropzone
  // Click y teclado para abrir selector
  dropzone.addEventListener('click', () => inputFile.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputFile.click();
    }
  });
  // Drag & drop
  dropzone.addEventListener('dragenter', (e) => { e.preventDefault(); dzEnter(); });
  dropzone.addEventListener('dragleave', () => dzLeave());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dzLeave();
    handleFiles(e.dataTransfer.files);
  });
  inputFile.addEventListener('change', (e) => handleFiles(e.target.files));
}

function handleFiles(files) {
  if (!files || !files.length) return;
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    showToast('El archivo debe ser una imagen');
    return;
  }
  selectedFile = file;
  updatePreview(file);
}

function dzEnter() {
  if (!dropzone) return;
  dropzone.classList.add('dragover');
}
function dzLeave() {
  if (!dropzone) return;
  dropzone.classList.remove('dragover');
}

function wireFocusHints() {
  if (!dropzone) return;
  // Accesibilidad: foco también realza sutilmente via clase
  dropzone.addEventListener('focus', () => { dropzone.classList.add('focus'); }, true);
  dropzone.addEventListener('blur', () => { dropzone.classList.remove('focus'); }, true);
}

function wireGeo() {
  if (!btnGeo) return;
  btnGeo.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      showToast('Geolocalización no soportada');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const latEl = qs('#latitude');
        const lngEl = qs('#longitude');
        if (latEl) latEl.value = latitude.toFixed(6);
        if (lngEl) lngEl.value = longitude.toFixed(6);
        showToast('Ubicación obtenida');
      },
      (err) => {
        console.error(err);
        showToast('No se pudo obtener ubicación');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

function createCameraModal() {
  // Crear el modal para la cámara
  const modalContent = document.createElement('div');
  modalContent.className = 'camera-modal-content';
  
  // Título del modal
  const title = document.createElement('h3');
  title.textContent = 'Tomar foto';
  title.style.marginTop = '0';
  title.style.marginBottom = '12px';
  
  // Instrucciones para PC
  const instructions = document.createElement('div');
  instructions.className = 'camera-instructions';
  instructions.innerHTML = `
    <p>Para tomar una buena foto:</p>
    <ul>
      <li>Asegúrate de tener buena iluminación</li>
      <li>Centra el espécimen en el recuadro</li>
      <li>Mantén la cámara estable</li>
    </ul>
  `;
  
  // Contenedor de video
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  
  // Marco de guía para la foto
  const guideFrame = document.createElement('div');
  guideFrame.className = 'guide-frame';
  
  // Elemento de video
  videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.playsInline = true; // Importante para iOS
  videoElement.style.width = '100%';
  videoElement.style.maxHeight = '70vh';
  videoElement.style.borderRadius = '8px';
  videoElement.style.backgroundColor = 'var(--bg)';
  
  videoContainer.appendChild(videoElement);
  videoContainer.appendChild(guideFrame);
  
  // Botones de acción
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'camera-buttons';
  buttonsContainer.style.display = 'flex';
  buttonsContainer.style.justifyContent = 'center';
  buttonsContainer.style.gap = '10px';
  buttonsContainer.style.marginTop = '16px';
  
  captureButton = document.createElement('button');
  captureButton.className = 'btn';
  captureButton.textContent = 'Capturar';
  
  retakeButton = document.createElement('button');
  retakeButton.className = 'btn btn-secondary';
  retakeButton.textContent = 'Volver a tomar';
  retakeButton.style.display = 'none';
  
  closeButton = document.createElement('button');
  closeButton.className = 'btn btn-secondary';
  closeButton.textContent = 'Cerrar';
  
  buttonsContainer.appendChild(captureButton);
  buttonsContainer.appendChild(retakeButton);
  buttonsContainer.appendChild(closeButton);
  
  // Añadir elementos al modal
  modalContent.appendChild(title);
  modalContent.appendChild(instructions);
  modalContent.appendChild(videoContainer);
  modalContent.appendChild(buttonsContainer);
  
  return modalContent;
}

function wireCamera() {
  if (!btnCamera) return;
  
  btnCamera.addEventListener('click', async () => {
    try {
      // Verificar soporte de mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Tu dispositivo no soporta la captura de fotos');
        return;
      }
      
      // Crear modal si no existe
      if (!cameraModal) {
        cameraModal = createCameraModal();
      }
      
      // Abrir modal
      openModal(cameraModal);
      
      // Configurar eventos de botones
      setupCameraEvents();
      
      // Iniciar la cámara
      await startCamera();
      
    } catch (err) {
      console.error('Error al iniciar la cámara:', err);
      showToast('No se pudo acceder a la cámara');
      closeModal();
    }
  });
}

async function startCamera() {
  try {
    // Obtener acceso a la cámara
    const constraints = {
      video: {
        facingMode: 'environment', // Usar cámara trasera por defecto
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    videoStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = videoStream;
    
    // Mostrar botón de captura y ocultar botón de volver a tomar
    captureButton.style.display = 'block';
    retakeButton.style.display = 'none';
    
  } catch (err) {
    console.error('Error al acceder a la cámara:', err);
    throw err;
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }
}

function setupCameraEvents() {
  // Botón de captura
  captureButton.onclick = capturePhoto;
  
  // Botón de volver a tomar
  retakeButton.onclick = async () => {
    await startCamera();
  };
  
  // Botón de cerrar
  closeButton.onclick = () => {
    stopCamera();
    closeModal();
  };
}

function capturePhoto() {
  if (!videoStream) return;
  
  // Crear un canvas para capturar la imagen
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // Establecer dimensiones del canvas según el video
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  // Añadir efecto de flash
  const flash = document.createElement('div');
  flash.className = 'camera-flash';
  videoElement.parentNode.appendChild(flash);
  
  // Reproducir sonido de cámara si está disponible
  try {
    const shutterSound = new Audio('data:audio/mp3;base64,SUQzAwAAAAAAJlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHMA//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAABAAADQgD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAA5TEFNRTMuMTAwAc0AAAAAAAAAABSAJAJAQgAAgAAAA0L2S8XwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//sQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=');
    shutterSound.play();
  } catch (e) {
    console.log('No se pudo reproducir el sonido de cámara');
  }
  
  // Dibujar el frame actual del video en el canvas
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  // Convertir a blob
  canvas.toBlob(blob => {
    // Crear un archivo a partir del blob
    const fileName = `photo_${new Date().getTime()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    
    // Procesar el archivo como si fuera subido
    handleFiles([file]);
    
    // Eliminar el flash después de un tiempo
    setTimeout(() => {
      if (flash && flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
      
      // Detener la cámara y cerrar el modal
      stopCamera();
      closeModal();
    }, 600);
    
  }, 'image/jpeg', 0.9);
  
  // Mostrar botón de volver a tomar y ocultar botón de captura
  captureButton.style.display = 'none';
  retakeButton.style.display = 'block';
}

function init() {
  wireDnD();
  wireFocusHints();
  wireGeo();
  wireCamera();
}

function startWhenReady() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

// Eliminado: vt:ready/setTimeout; ahora el router invoca mountForm()
// window.addEventListener('vt:ready', startWhenReady, { once: true });
// setTimeout(startWhenReady, 700);

export async function mountForm() {
  // Re-vincular elementos del DOM de esta vista
  bindEls();
  if (!form) {
    // Nada que montar si aún no existe el markup
    return;
  }
  // Reset de estado de archivo/preview para cada montaje
  selectedFile = null;
  updatePreview(null);
  init();

  // Listeners por instancia de DOM (no se duplican porque los nodos antiguos se destruyen en cada render)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const scientific_name = qs('#scientific_name')?.value.trim() || '';
    const common_name = qs('#common_name')?.value.trim() || '';
    const family = qs('#family')?.value.trim() || '';
    const description = qs('#description')?.value.trim() || '';
    const latitude = qs('#latitude')?.value.trim() || '';
    const longitude = qs('#longitude')?.value.trim() || '';

    if (!scientific_name || !common_name) {
      showToast('Completa al menos Nombre científico y Nombre común');
      return;
    }

    // Mantener metadatos locales para futura integración de storage o backend
    const _client = {
      scientific_name,
      description: description || null,
      coordinates: (latitude && longitude) ? { lat: Number(latitude), lng: Number(longitude) } : null,
      image: selectedFile ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size } : null
    };

    try {
      // Enviar como multipart/form-data para incluir la imagen (campo 'imagen')
      const fd = new FormData();
      fd.append('name', common_name || scientific_name);
      if (family) fd.append('family', family);
      if (scientific_name) fd.append('scientific_name', scientific_name);
      if (description) fd.append('description', description);
      if (latitude) fd.append('latitude', latitude);
      if (longitude) fd.append('longitude', longitude);
      if (selectedFile) fd.append('imagen', selectedFile);

      const { data, error } = await apiClient.request('/plants/submissions', {
        method: 'POST',
        auth: false,
        body: fd
      });

      if (error) throw error;

      // Reset UI
      selectedFile = null;
      updatePreview(null);
      form.reset();
      showToast('Enviado. ¡Gracias por tu aporte!');
    } catch (err) {
      console.error(err);
      showToast('No se pudo enviar el aporte');
    }
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      selectedFile = null;
      if (inputFile) inputFile.value = '';
      updatePreview(null);
    });
  }
}