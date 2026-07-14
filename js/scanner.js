const Scanner = (() => {
  let stream = null;
  let detector = null;
  let quaggaReady = false;
  let quaggaTarget = null;
  let active = false;
  let loopId = null;
  let lastResultTime = 0;
  const SCAN_THROTTLE = 1500;
  const TARGET_FPS = 3;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let torchOn = false;
  let facingMode = 'environment';
  let onDetect = null;
  let videoEl = null;
  let camFeedEl = null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function loadQuagga() {
    if (window.Quagga) return Promise.resolve(true);
    return new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function init() {
    if (isIOS) {
      quaggaReady = await loadQuagga();
      const msg = quaggaReady ? 'Quagga (iOS fallback)' : 'no decoder';
      console.warn('[Scanner] detection path:', msg, '| hasDecoder:', quaggaReady);
      if (quaggaReady) return { ok: true, hasDecoder: true };
      return { ok: false, error: 'Scanner not available on this device.', hasDecoder: false };
    }

    if ('BarcodeDetector' in window) {
      try {
        detector = new BarcodeDetector({ formats: [
          'qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39',
          'codabar', 'itf', 'upc_a', 'upc_e',
          'data_matrix', 'aztec', 'pdf417'
        ]});
      } catch (_) {}
    }

    if (!detector) {
      quaggaReady = await loadQuagga();
      if (quaggaReady) {
        console.warn('[Scanner] detection path: Quagga fallback | hasDecoder: true');
        return { ok: true, hasDecoder: true };
      }
    }

    const hasDecoder = !!detector;
    console.warn('[Scanner] detection path:', detector ? 'native BarcodeDetector' : 'no decoder', '| hasDecoder:', hasDecoder);

    try {
      stream = await scannerCore.startCamera(null, { facingMode });
      return { ok: true, hasDecoder };
    } catch (e) {
      return { ok: false, error: 'Camera not available.', hasDecoder: false };
    }
  }

  function start(video, callback) {
    if (active) return;
    active = true;
    onDetect = callback;
    videoEl = video;

    if (quaggaReady) {
      camFeedEl = video.closest('#camera-feed');
      videoEl.style.display = 'none';
      quaggaTarget = document.createElement('div');
      quaggaTarget.id = 'quagga-feed';
      quaggaTarget.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0';
      if (camFeedEl) {
        camFeedEl.style.position = 'relative';
        camFeedEl.insertBefore(quaggaTarget, camFeedEl.firstChild);
      } else {
        document.body.appendChild(quaggaTarget);
      }

      const qStyle = document.createElement('style');
      qStyle.textContent = '#quagga-feed video,#quagga-feed canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(0.4)}';
      document.head.appendChild(qStyle);

      Quagga.onDetected(function(result) {
        if (!active) return;
        const code = result && result.codeResult;
        if (code && code.code) {
          processResults([{ rawValue: code.code, format: code.format }]);
        }
      });

      Quagga.onProcessed(function() {
        if (!active) return;
        try {
          const ctx = Quagga.canvas.ctx.overlay;
          if (ctx) {
            ctx.clearRect(0, 0, Quagga.canvas.dom.overlay.width, Quagga.canvas.dom.overlay.height);
          }
        } catch(_) {}
      });

      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: quaggaTarget,
          constraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: "environment" }
          }
        },
        locator: { patchSize: "large", halfSample: true },
        numOfWorkers: 0,
        decoder: { readers: [
          'ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader',
          'codabar_reader', 'i2of5_reader', 'upc_reader', 'upc_e_reader'
        ]},
        locate: true
      }, function(err) {
        if (err) {
          console.error('[Scanner] Quagga init failed:', err);
          active = false;
          return;
        }
        Quagga.start();
      });
      return;
    }

    if (!stream) return;
    videoEl.srcObject = stream;
    videoEl.play();
    if (detector) {
      scheduleDetect();
    }
  }

  async function scheduleDetect() {
    if (!active) return;
    if (quaggaReady) return;
    const startTime = performance.now();
    try {
      if (videoEl.readyState >= 2) {
        let codes;
        if (detector) {
          codes = await detector.detect(videoEl);
        } else {
          return;
        }
        if (codes.length > 0) {
          console.warn('[Scanner] detected', codes.length, 'barcodes:', codes.map(c => c.rawValue).join(', '));
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
    if (now - lastResultTime < SCAN_THROTTLE) return;
    for (const code of codes) {
      if (!code.rawValue) continue;
      lastResultTime = now;
      if (onDetect) onDetect(code.rawValue);
      return;
    }
  }

  function stop() {
    active = false;
    if (loopId) { clearTimeout(loopId); loopId = null; }

    if (quaggaReady) {
      try { Quagga.stop(); } catch(_) {}
      if (quaggaTarget && quaggaTarget.parentNode) {
        quaggaTarget.parentNode.removeChild(quaggaTarget);
      }
      quaggaTarget = null;
      lastResultTime = 0;
      if (videoEl) videoEl.style.display = '';
      videoEl = null;
      return;
    }

    scannerCore.stopCamera(stream);
    stream = null;
    lastResultTime = 0;
    videoEl = null;
  }

  async function toggleTorch() {
    if (quaggaReady) return false;
    if (!stream) return false;
    torchOn = !torchOn;
    const ok = scannerCore.toggleTorch(stream, torchOn);
    if (!ok) {
      torchOn = !torchOn;
      return false;
    }
    return torchOn;
  }

  function isTorchSupported() {
    if (quaggaReady) return false;
    if (!stream) return false;
    const track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities?.();
    return !!capabilities?.torch;
  }

  async function restart(video, callback) {
    active = false;
    if (loopId) { clearTimeout(loopId); loopId = null; }

    if (quaggaReady) {
      try { Quagga.stop(); } catch(_) {}
      if (quaggaTarget && quaggaTarget.parentNode) {
        quaggaTarget.parentNode.removeChild(quaggaTarget);
      }
      quaggaTarget = null;
      lastResultTime = 0;
      active = true;
      onDetect = callback;
      videoEl = video;
      videoEl.style.display = 'none';
      camFeedEl = video.closest('#camera-feed');
      quaggaTarget = document.createElement('div');
      quaggaTarget.id = 'quagga-feed';
      quaggaTarget.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0';
      if (camFeedEl) {
        camFeedEl.style.position = 'relative';
        camFeedEl.insertBefore(quaggaTarget, camFeedEl.firstChild);
      } else {
        document.body.appendChild(quaggaTarget);
      }
      Quagga.onDetected(function(result) {
        if (!active) return;
        const code = result && result.codeResult;
        if (code && code.code) {
          processResults([{ rawValue: code.code, format: code.format }]);
        }
      });
      Quagga.onProcessed(function() {
        if (!active) return;
        try {
          const ctx = Quagga.canvas.ctx.overlay;
          if (ctx) {
            ctx.clearRect(0, 0, Quagga.canvas.dom.overlay.width, Quagga.canvas.dom.overlay.height);
          }
        } catch(_) {}
      });
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: quaggaTarget,
          constraints: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: { ideal: "environment" }
          }
        },
        locator: { patchSize: "large", halfSample: true },
        numOfWorkers: 0,
        decoder: { readers: [
          'ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader',
          'codabar_reader', 'i2of5_reader', 'upc_reader', 'upc_e_reader'
        ]},
        locate: true
      }, function(err) {
        if (err) {
          console.error('[Scanner] Quagga restart failed:', err);
          active = false;
          return;
        }
        Quagga.start();
      });
      return { ok: true };
    }

    scannerCore.stopCamera(stream);
    stream = null;
    lastResultTime = 0;

    try {
      stream = await scannerCore.startCamera(null, { facingMode });
    } catch (e) {
      return { ok: false, error: 'Camera access denied.' };
    }

    active = true;
    onDetect = callback;
    videoEl = video;
    videoEl.srcObject = stream;
    videoEl.play();
    if (detector) {
      scheduleDetect();
    }
    return { ok: true };
  }

  return { init, start, stop, restart, toggleTorch, isTorchSupported };
})();
