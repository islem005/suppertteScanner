window.escapeHtml = function(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
};
window.esc = window.escapeHtml;

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

      var imgW = img.naturalWidth;
      var imgH = img.naturalHeight;

      // ── Build DOM ──
      var overlay = document.createElement('div');
      overlay.id = 'crop-overlay';

      var box = document.createElement('div');
      box.id = 'crop-box';

      var stage = document.createElement('div');
      stage.id = 'crop-stage';
      stage.style.touchAction = 'none';
      stage.style.userSelect = 'none';
      stage.style.webkitUserSelect = 'none';

      var imageEl = document.createElement('div');
      imageEl.id = 'crop-image';
      imageEl.style.backgroundImage = "url('" + dataUrl.replace(/'/g, '%27') + "')";
      imageEl.style.backgroundRepeat = 'no-repeat';
      imageEl.style.backgroundSize = 'contain';
      imageEl.style.backgroundPosition = 'center';
      imageEl.style.width = '100%';
      imageEl.style.height = '100%';
      imageEl.style.pointerEvents = 'auto';

      var frame = document.createElement('div');
      frame.id = 'crop-rect';

      // Corner handles
      var handleData = [
        { cls: 'crop-handle crop-handle-tl', pos: 'tl' },
        { cls: 'crop-handle crop-handle-tr', pos: 'tr' },
        { cls: 'crop-handle crop-handle-bl', pos: 'bl' },
        { cls: 'crop-handle crop-handle-br', pos: 'br' }
      ];
      var handles = handleData.map(function(h) {
        var el = document.createElement('div');
        el.className = h.cls;
        frame.appendChild(el);
        return el;
      });

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
      stage.appendChild(imageEl);
      stage.appendChild(frame);
      box.appendChild(stage);
      box.appendChild(bottom);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // ── State ──
      var stageW = 0, stageH = 0;
      var fitScale = 1;
      var zoomScale = 1;
      var panX = 0, panY = 0;
      var maxPanX = 0, maxPanY = 0;

      var rectX, rectY, rectW, rectH;
      var MIN_RECT = 40;

      var dragMode = null;
      var startX, startY;
      var startPanX, startPanY;
      var startRectX, startRectY, startRectW, startRectH;
      var activeHandle = null;

      var isPinching = false;
      var pinchStartDist = 0;
      var pinchStartZoom = 1;

      var raf = null;

      // ── Layout ──
      function layout() {
        var sr = stage.getBoundingClientRect();
        stageW = sr.width;
        stageH = sr.height;
        if (stageW <= 0 || stageH <= 0) return;

        fitScale = Math.min(stageW / imgW, stageH / imgH);

        if (rectX === undefined) {
          var mw = stageW * 0.85;
          var mh = stageH * 0.85;
          rectW = Math.min(mw, stageH * 0.6 * aspectRatio);
          rectH = rectW / aspectRatio;
          if (rectH > mh) { rectH = mh; rectW = rectH * aspectRatio; }
          if (rectW > mw) { rectW = mw; rectH = rectW / aspectRatio; }
          rectX = (stageW - rectW) / 2;
          rectY = (stageH - rectH) / 2;
        }

        updateImage();
        updateRect();
      }

      function updateImage() {
        var s = fitScale * zoomScale;
        var dw = imgW * s;
        var dh = imgH * s;
        var bx = (stageW - dw) / 2;
        var by = (stageH - dh) / 2;

        maxPanX = dw > stageW ? (dw - stageW) / 2 : 0;
        maxPanY = dh > stageH ? (dh - stageH) / 2 : 0;

        if (panX > maxPanX) panX = maxPanX;
        if (panX < -maxPanX) panX = -maxPanX;
        if (panY > maxPanY) panY = maxPanY;
        if (panY < -maxPanY) panY = -maxPanY;

        imageEl.style.backgroundSize = dw + 'px ' + dh + 'px';
        imageEl.style.backgroundPosition = (bx + panX) + 'px ' + (by + panY) + 'px';
      }

      function updateRect() {
        frame.style.left = rectX + 'px';
        frame.style.top = rectY + 'px';
        frame.style.width = rectW + 'px';
        frame.style.height = rectH + 'px';
      }

      // ── Pointers ──
      function getPt(e) {
        return e.touches ? e.touches[0] : e;
      }

      function onPointerDown(e) {
        if (e.touches && e.touches.length === 2) {
          isPinching = true;
          dragMode = null;
          var dx = e.touches[0].clientX - e.touches[1].clientX;
          var dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStartDist = Math.sqrt(dx * dx + dy * dy);
          pinchStartZoom = zoomScale;
          e.preventDefault();
          return;
        }

        var t = e.target;
        var pt = getPt(e);

        if (t.classList.contains('crop-handle')) {
          dragMode = 'resize';
          activeHandle = t;
          startX = pt.clientX;
          startY = pt.clientY;
          startRectX = rectX;
          startRectY = rectY;
          startRectW = rectW;
          startRectH = rectH;
          e.preventDefault();
          return;
        }

        if (t === frame || t.closest('#crop-rect')) {
          dragMode = 'rect';
          startX = pt.clientX;
          startY = pt.clientY;
          startRectX = rectX;
          startRectY = rectY;
          e.preventDefault();
          return;
        }

        if (maxPanX > 0 || maxPanY > 0) {
          dragMode = 'image';
          startX = pt.clientX;
          startY = pt.clientY;
          startPanX = panX;
          startPanY = panY;
          e.preventDefault();
        }
      }

      function onPointerMove(e) {
        if (e.touches && e.touches.length === 2 && isPinching) {
          var dx = e.touches[0].clientX - e.touches[1].clientX;
          var dy = e.touches[0].clientY - e.touches[1].clientY;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (pinchStartDist >= 5) {
            zoomScale = Math.max(0.5, Math.min(5, pinchStartZoom * (dist / pinchStartDist)));
            updateImage();
          }
          e.preventDefault();
          return;
        }

        if (!dragMode) return;
        var pt = getPt(e);
        var dx = pt.clientX - startX;
        var dy = pt.clientY - startY;

        if (dragMode === 'image') {
          panX = startPanX + dx;
          panY = startPanY + dy;
          updateImage();
        } else if (dragMode === 'rect') {
          rectX = Math.max(0, Math.min(stageW - rectW, startRectX + dx));
          rectY = Math.max(0, Math.min(stageH - rectH, startRectY + dy));
          updateRect();
        } else if (dragMode === 'resize') {
          doResize(dx, dy);
        }
        e.preventDefault();
      }

      function onPointerUp() {
        dragMode = null;
        isPinching = false;
        activeHandle = null;
      }

      function doResize(dx, dy) {
        if (!activeHandle) return;
        var cls = activeHandle.className;
        var isLeft = cls.includes('tl') || cls.includes('bl');
        var isRight = cls.includes('tr') || cls.includes('br');
        var isTop = cls.includes('tl') || cls.includes('tr');
        var isBottom = cls.includes('bl') || cls.includes('br');

        var nw = isRight ? Math.max(MIN_RECT, startRectW + dx)
                         : Math.max(MIN_RECT, startRectW - dx);
        var nh = nw / aspectRatio;

        if (nh > stageH - 10) { nh = stageH - 10; nw = nh * aspectRatio; }
        if (nw > stageW - 10) { nw = stageW - 10; nh = nw / aspectRatio; }
        if (nw < MIN_RECT) { nw = MIN_RECT; nh = nw / aspectRatio; }
        if (nh < MIN_RECT) { nh = MIN_RECT; nw = nh * aspectRatio; }

        var nx = isLeft ? startRectX + (startRectW - nw) : startRectX;
        var ny = isTop ? startRectY + (startRectH - nh) : startRectY;

        if (nx < 0) nx = 0;
        if (ny < 0) ny = 0;
        if (nx + nw > stageW) nx = stageW - nw;
        if (ny + nh > stageH) ny = stageH - nh;

        rectW = nw; rectH = nh; rectX = nx; rectY = ny;
        updateRect();
      }

      // ── Wheel zoom ──
      stage.addEventListener('wheel', function(e) {
        e.preventDefault();
        var d = -e.deltaY * 0.001;
        zoomScale = Math.max(0.5, Math.min(5, zoomScale + d));
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function() { updateImage(); raf = null; });
      }, { passive: false });

      // ── Events ──
      stage.addEventListener('mousedown', onPointerDown);
      stage.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('touchend', onPointerUp);
      window.addEventListener('touchcancel', onPointerUp);

      window.addEventListener('resize', function() {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function() { layout(); raf = null; });
      });

      // ── Buttons ──
      btnCancel.onclick = function() {
        overlay.remove();
        reject(new Error('cancelled'));
      };

      btnApply.onclick = function() {
        var s = fitScale * zoomScale;
        var dw = imgW * s;
        var dh = imgH * s;
        var bx = (stageW - dw) / 2 + panX;
        var by = (stageH - dh) / 2 + panY;

        var sx = Math.max(0, (rectX - bx) / s);
        var sy = Math.max(0, (rectY - by) / s);
        var sw = Math.min(rectW / s, imgW - sx);
        var sh = Math.min(rectH / s, imgH - sy);

        var canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        var ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        overlay.remove();
        resolve(canvas.toDataURL('image/webp', 0.92));
      };

      // ── Init ──
      requestAnimationFrame(function() { layout(); raf = null; });
    };
    img.onerror = function() { reject(new Error('Image load failed')); };
    img.src = dataUrl;
  });
};
