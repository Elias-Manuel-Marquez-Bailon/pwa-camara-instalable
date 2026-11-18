// ================================================================
//  Inspección Visual PWA - app.js
//  JavaScript Vanilla, sin async/await: solo .then/.catch/.finally
// ================================================================

// ---------- Referencias del DOM ----------
const btnInstalar        = document.getElementById('btn-instalar');
const avisoIos           = document.getElementById('aviso-ios');
const btnCerrarIos       = document.getElementById('btn-cerrar-ios');
const visorVideo         = document.getElementById('visor-camara');
const placeholder        = document.getElementById('placeholder');
const mensajeEstado      = document.getElementById('mensaje-estado');
const avisoPermiso       = document.getElementById('aviso-permiso');
const btnPrepararCamara  = document.getElementById('btn-preparar-camara');
const btnConfirmar       = document.getElementById('btn-confirmar-permiso');
const btnCancelar        = document.getElementById('btn-cancelar-permiso');
const btnAlternar        = document.getElementById('btn-alternar-camara');
const btnApagar          = document.getElementById('btn-apagar-camara');

function actualizarMensajeEstado(texto) {
  mensajeEstado.textContent = texto;
}

// ================================================================
//  1. REGISTRO DEL SERVICE WORKER (requisito de instalabilidad)
// ================================================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registro) => console.log('SW registrado. Scope:', registro.scope))
      .catch((error) => console.error('Error al registrar SW:', error));
  });
}

// ================================================================
//  2. INSTALACIÓN (Android / Chrome): beforeinstallprompt
// ================================================================
let eventoInstalacionDiferido = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();               // evita el mini-banner automático
  eventoInstalacionDiferido = event;    // lo guardamos para usarlo después
  btnInstalar.hidden = false;           // mostramos nuestro botón
});

btnInstalar.addEventListener('click', () => {
  if (!eventoInstalacionDiferido) return;

  eventoInstalacionDiferido.prompt();   // abre el diálogo nativo de instalación
  eventoInstalacionDiferido.userChoice
    .then((resultado) => {
      if (resultado.outcome === 'accepted') {
        console.log('El usuario instaló la app');
        btnInstalar.hidden = true;
      } else {
        console.log('El usuario canceló la instalación');
      }
    })
    .finally(() => {
      eventoInstalacionDiferido = null; // el evento solo se puede usar una vez
    });
});

window.addEventListener('appinstalled', () => {
  btnInstalar.hidden = true;
  actualizarMensajeEstado('¡App instalada correctamente!');
});

// ================================================================
//  3. INSTALACIÓN (iPhone / iOS): instrucciones manuales
//     Safari nunca dispara beforeinstallprompt.
// ================================================================
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS
const yaInstalada = window.navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches;

if (esIOS && !yaInstalada) {
  avisoIos.hidden = false;
}
btnCerrarIos.addEventListener('click', () => { avisoIos.hidden = true; });

// ================================================================
//  4. CONTROL DE CÁMARA
// ================================================================
let streamActual = null;
let modoCamaraActual = 'environment'; // 'environment' = trasera | 'user' = frontal

// Libera el sensor: obligatorio antes de cambiar de lente
function detenerCamaraActiva() {
  if (streamActual) {
    streamActual.getTracks().forEach((track) => {
      track.stop();
    });
    streamActual = null;
  }
}

function actualizarBotones(camaraEncendida) {
  btnAlternar.disabled = !camaraEncendida;
  btnApagar.disabled = !camaraEncendida;
  btnPrepararCamara.disabled = camaraEncendida;
  placeholder.hidden = camaraEncendida;
}

function iniciarCamara(modo) {
  detenerCamaraActiva();

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    actualizarMensajeEstado('Tu navegador no soporta la cámara o no estás en HTTPS.');
    return Promise.resolve();
  }

  const restricciones = {
    video: { facingMode: modo },
    audio: false
  };

  actualizarMensajeEstado('Encendiendo cámara...');

  return navigator.mediaDevices.getUserMedia(restricciones)
    .then((stream) => {
      streamActual = stream;
      visorVideo.srcObject = stream;
      // Efecto espejo solo en la frontal (más natural para el usuario)
      visorVideo.style.transform = modo === 'user' ? 'scaleX(-1)' : 'none';
      actualizarBotones(true);
      actualizarMensajeEstado(`Cámara activa (${modo === 'environment' ? 'Trasera' : 'Frontal'})`);
    })
    .catch((error) => {
      actualizarBotones(false);
      if (error.name === 'NotAllowedError') {
        actualizarMensajeEstado('Permiso denegado. Habilita el acceso a la cámara en los ajustes de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
        actualizarMensajeEstado('No se detectó el sensor de cámara solicitado en este dispositivo.');
      } else {
        actualizarMensajeEstado(`Error al acceder al hardware: ${error.message}`);
      }
    });
}

// ================================================================
//  5. FLUJO PRE-PERMISO (UX Ética)
// ================================================================
// Paso 1: solo mostramos el aviso, NO tocamos el hardware todavía
btnPrepararCamara.addEventListener('click', () => {
  avisoPermiso.hidden = false;
  actualizarMensajeEstado('Lee el aviso antes de continuar.');
});

// Paso 2: el usuario confirma conscientemente -> ahora sí pedimos permiso
btnConfirmar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  iniciarCamara(modoCamaraActual);
});

btnCancelar.addEventListener('click', () => {
  avisoPermiso.hidden = true;
  actualizarMensajeEstado('No se encendió la cámara. Puedes solicitarla cuando quieras.');
});

// ================================================================
//  6. ALTERNAR Y APAGAR
// ================================================================
btnAlternar.addEventListener('click', () => {
  modoCamaraActual = modoCamaraActual === 'environment' ? 'user' : 'environment';
  btnAlternar.disabled = true; // evita doble clic mientras cambia
  iniciarCamara(modoCamaraActual).finally(() => {
    btnAlternar.disabled = !streamActual;
  });
});

btnApagar.addEventListener('click', () => {
  detenerCamaraActiva();
  visorVideo.srcObject = null;
  actualizarBotones(false);
  actualizarMensajeEstado('Cámara apagada. El sensor fue liberado.');
});

// Buena práctica: liberar la cámara si el usuario sale de la app
window.addEventListener('pagehide', detenerCamaraActiva);
