window.escapeHtml = function(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
};

window.showToast = function(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), 2000);
};

window.cropImage = function(dataUrl, aspectRatio, targetW, targetH) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      var existing = document.getElementById('crop-overlay');
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id = 'crop-overlay';

      var box = document.createElement('div');
      box.id = 'crop-box';

      var stage = document.createElement('div');
      stage.id = 'crop-stage';
      stage.style.touchAction = 'none';
      stage.style.userSelect = 'none';
      stage.style.webkitUserSelect = 'none';

      var cropImg = document.createElement('div');
      cropImg.id = 'crop-image';
      cropImg.style.backgroundImage = "url('" + dataUrl.replace(/'/g, '%27') + "')";

      var frame = document.createElement('div');
      frame.id = 'crop-frame';
      frame.style.aspectRatio = String(aspectRatio);

      var bottom = document.createElement('div');
      bottom.id = 'crop-bottom';

      var actions = document.createElement('div');
      actions.id = 'crop-actions';

      var btnCancel = document.createElement('button');
      btnCancel.id = 'crop-cancel';
      btnCancel.className = 'btn small';
      btnCancel.textContent = 'Cancel';

      var btnApply = document.createElement('button');
      btnApply.id = 'crop-apply';
      btnApply.className = 'btn primary';
      btnApply.textContent = 'Apply';

      actions.appendChild(btnCancel);
      actions.appendChild(btnApply);
      bottom.appendChild(actions);
      stage.appendChild(cropImg);
      stage.appendChild(frame);
      box.appendChild(stage);
      box.appendChild(bottom);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      var imgW = img.naturalWidth;
      var imgH = img.naturalHeight;

      var offX = 0, offY = 0;
      var maxOffX = 0, maxOffY = 0;
      var fitScale = 1;
      var zoomScale = 1;
      var firstCalc = true;

      function recalc() {
        var rect = stage.getBoundingClientRect();
        var W = rect.width - 40;
        var H = rect.height - 40;
        if (W <= 0 || H <= 0) return;
        var fw = W / imgW, fh = H / imgH;
        fitScale = fw > fh ? fw : fh;
        var s = fitScale * zoomScale;
        var scaledW = imgW * s;
        var scaledH = imgH * s;
        maxOffX = Math.max(0, scaledW - W);
        maxOffY = Math.max(0, scaledH - H);
        if (firstCalc) {
          offX = maxOffX / 2;
          offY = maxOffY / 2;
          firstCalc = false;
        }
        clampOff();
        cropImg.style.width = scaledW + 'px';
        cropImg.style.height = scaledH + 'px';
        updatePos();
      }

      function clampOff() {
        if (offX > maxOffX) offX = maxOffX;
        if (offY > maxOffY) offY = maxOffY;
        if (offX < 0) offX = 0;
        if (offY < 0) offY = 0;
      }

      function updatePos() {
        clampOff();
        cropImg.style.transform = 'translate(' + (-offX) + 'px,' + (-offY) + 'px)';
      }

      var raf = null;
      requestAnimationFrame(function() { recalc(); raf = null; });

      // ─── Pan (drag) ───
      var isDragging = false;
      var startX, startY, startOffX, startOffY;

      function onPointerDown(e) {
        if (e.touches && e.touches.length > 1) return;
        isDragging = true;
        var pt = e.touches ? e.touches[0] : e;
        startX = pt.clientX;
        startY = pt.clientY;
        startOffX = offX;
        startOffY = offY;
        stage.style.cursor = 'grabbing';
        e.preventDefault();
      }

      function onPointerMove(e) {
        if (e.touches) {
          if (e.touches.length === 2) { onPinchMove(e); return; }
          if (!isDragging) return;
        } else if (!isDragging) {
          return;
        }
        var pt = e.touches ? e.touches[0] : e;
        offX = startOffX - (pt.clientX - startX);
        offY = startOffY - (pt.clientY - startY);
        updatePos();
        e.preventDefault();
      }

      function onPointerUp() {
        isDragging = false;
        isPinching = false;
        stage.style.cursor = '';
      }

      // ─── Pinch Zoom ───
      var isPinching = false;
      var pinchStartDist = 0;
      var pinchStartZoom = 1;

      function onPinchMove(e) {
        if (e.touches.length !== 2) return;
        var dx = e.touches[0].clientX - e.touches[1].clientX;
        var dy = e.touches[0].clientY - e.touches[1].clientY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (!isPinching) {
          isPinching = true;
          isDragging = false;
          pinchStartDist = dist;
          pinchStartZoom = zoomScale;
        }
        if (pinchStartDist < 5) return;
        zoomScale = Math.max(0.5, Math.min(5, pinchStartZoom * (dist / pinchStartDist)));
        recalc();
        e.preventDefault();
      }

      stage.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      stage.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);

      window.addEventListener('resize', function() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function() { recalc(); raf = null; });
      });

      // ─── Mouse wheel zoom ───
      stage.addEventListener('wheel', function(e) {
        e.preventDefault();
        var delta = -e.deltaY * 0.001;
        zoomScale = Math.max(0.5, Math.min(5, zoomScale + delta));
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function() { recalc(); raf = null; });
      }, { passive: false });

      btnCancel.onclick = function() {
        overlay.remove();
        reject(new Error('cancelled'));
      };

      btnApply.onclick = function() {
        var rect = stage.getBoundingClientRect();
        var W = rect.width - 40;
        var H = rect.height - 40;
        var s = fitScale * zoomScale;
        var srcX = offX / s;
        var srcY = offY / s;
        var srcW = W / s;
        var srcH = H / s;

        var canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
        overlay.remove();
        resolve(canvas.toDataURL('image/webp', 0.92));
      };
    };
    img.onerror = function() { reject(new Error('Image load failed')); };
    img.src = dataUrl;
  });
};
