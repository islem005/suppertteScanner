// ─── Scanner Core ───────────────────────────────────────────────────
// Shared camera + barcode detection logic for the scanner PWA
// Exposed on window.scannerCore for use by scanner.js and other consumers
// ───────────────────────────────────────────────────────────────────

window.scannerCore = (() => {
  /**
   * Initialize a camera stream
   * @param {HTMLVideoElement} [videoEl] - optional video element to attach stream to
   * @param {{ facingMode?: string, width?: number, height?: number }} [opts]
   * @returns {Promise<MediaStream>}
   */
  async function startCamera(videoEl, opts = {}) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: opts.facingMode || 'environment',
        width: { ideal: opts.width || 1280 },
        height: { ideal: opts.height || 720 }
      },
      audio: false
    });
    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play();
    }
    return stream;
  }

  /**
   * Stop all tracks in a media stream
   * @param {MediaStream|null} stream
   */
  function stopCamera(stream) {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  }

  /**
   * Toggle torch/flashlight on the active video track
   * @param {MediaStream} stream
   * @param {boolean} on
   * @returns {boolean} whether torch was successfully set
   */
  function toggleTorch(stream, on) {
    const track = stream?.getVideoTracks()[0];
    if (!track || !('applyConstraints' in track)) return false;
    try {
      track.applyConstraints({ advanced: [{ torch: !!on }] });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect barcodes in a video frame using BarcodeDetector API
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<Array<{ rawValue: string, format: string, cornerPoints: Array<{x:number,y:number}> }>>}
   */
  async function detectBarcode(videoEl) {
    if (!('BarcodeDetector' in window)) return [];
    const detector = new BarcodeDetector({
      formats: [
        'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39',
        'qr_code', 'data_matrix', 'itf', 'codabar', 'pdf417', 'aztec',
        'msi', 'databar', 'databar_expanded'
      ]
    });
    return detector.detect(videoEl);
  }

  /**
   * Capture a still frame from video as a Blob
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<Blob>}
   */
  function captureFrame(videoEl) {
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  }

  return { startCamera, stopCamera, toggleTorch, detectBarcode, captureFrame };
})();
