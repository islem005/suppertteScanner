const Scanner = (() => {
  let stream = null;
  let detector = null;
  let fallbackDetect = null;
  let fallbackCanvas = null;
  let active = false;
  let loopId = null;
  let lastResults = [];
  let lastResultTime = 0;
  const SCAN_THROTTLE = 1200;
  const TARGET_FPS = 3;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let torchOn = false;
  let facingMode = 'environment';
  let onDetect = null;
  let videoEl = null;

  async function init() {
    if ('BarcodeDetector' in window) {
      detector = new BarcodeDetector({ formats: [
        'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
        'code_93', 'codabar', 'itf', 'upc_a', 'upc_e',
        'data_matrix', 'aztec', 'pdf417'
      ]});
    } else {
      try {
        const zbar = await import('https://cdn.jsdelivr.net/npm/zbar-wasm@2/dist/zbar-wasm.js');
        fallbackCanvas = document.createElement('canvas');
        fallbackDetect = async (video) => {
          const scale = Math.min(640 / video.videoWidth, 480 / video.videoHeight, 1);
          fallbackCanvas.width = Math.round(video.videoWidth * scale) || 1;
          fallbackCanvas.height = Math.round(video.videoHeight * scale) || 1;
          const ctx = fallbackCanvas.getContext('2d');
          if (!ctx) return [];
          ctx.drawImage(video, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
          const imageData = ctx.getImageData(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          const symbols = await zbar.scanImageData(imageData);
          return symbols.map(s => ({ rawValue: s.decode, format: s.typeName }));
        };
      } catch (_) {
        return { ok: false, error: 'Barcode decoder failed to load. Use Chrome on Android.' };
      }
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Camera access denied. Allow camera permissions.' };
    }
  }

  function start(video, callback) {
    if (!stream || (!detector && !fallbackDetect)) return;
    if (active) return;
    active = true;
    onDetect = callback;
    videoEl = video;
    videoEl.srcObject = stream;
    videoEl.play();
    scheduleDetect();
  }

  async function scheduleDetect() {
    if (!active) return;
    const startTime = performance.now();
    try {
      if (videoEl.readyState >= 2) {
        let codes;
        if (fallbackDetect) {
          codes = await fallbackDetect(videoEl);
        } else if (detector) {
          codes = await detector.detect(videoEl);
        } else {
          return;
        }
        if (active && codes.length > 0) {
          processResults(codes);
        }
      }
    } catch (_) {}
    if (!active) return;
    const elapsed = performance.now() - startTime;
    const delay = Math.max(0, FRAME_INTERVAL - elapsed);
    loopId = setTimeout(scheduleDetect, delay);
  }

  function processResults(codes) {
    const now = Date.now();
    for (const code of codes) {
      if (!code.rawValue) continue;
      if (lastResults.includes(code.rawValue) && now - lastResultTime < SCAN_THROTTLE) {
        continue;
      }
      lastResults.push(code.rawValue);
      lastResultTime = now;
      if (lastResults.length > 20) lastResults.shift();
      if (onDetect) onDetect(code.rawValue);
    }
  }

  function stop() {
    active = false;
    if (loopId) { clearTimeout(loopId); loopId = null; }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    lastResults = [];
    lastResultTime = 0;
    videoEl = null;
  }

  async function toggleTorch() {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    if (!capabilities?.torch) return false;
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    return torchOn;
  }

  function isTorchSupported() {
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    return !!capabilities?.torch;
  }

  async function restart(video, callback) {
    // Stop current camera + detection loop
    active = false;
    if (loopId) { clearTimeout(loopId); loopId = null; }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    lastResults = [];
    lastResultTime = 0;

    // Re-init camera
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
    } catch (e) {
      return { ok: false, error: 'Camera access denied.' };
    }

    // Restart detection
    active = true;
    onDetect = callback;
    videoEl = video;
    videoEl.srcObject = stream;
    videoEl.play();
    scheduleDetect();
    return { ok: true };
  }

  return { init, start, stop, restart, toggleTorch, isTorchSupported };
})();
