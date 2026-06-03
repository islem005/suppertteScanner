const Scanner = (() => {
  let stream = null;
  let detector = null;
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
    if (!('BarcodeDetector' in window)) {
      return { ok: false, error: 'BarcodeDetector not supported. Use Chrome on Android or Safari 16.4+.' };
    }
    detector = new BarcodeDetector({ formats: [
      'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
      'code_93', 'codabar', 'itf', 'upc_a', 'upc_e',
      'data_matrix', 'aztec', 'pdf417'
    ]});

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
    if (!stream || !detector) return;
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
        const codes = await detector.detect(videoEl);
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
