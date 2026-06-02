# Footers

## Scanner Footer (`scanner.html`)

Fixed bottom bar in scanner view:
- **Left**: Clear button (`x-circle` icon) to clear scan results and reset
- **Center**: Camera source toggle (front/back camera switch) if available
- **Right**: Results panel toggle button

```html
<div id="bottom-bar">
  <div class="bottom-left">
    <button id="btn-clear" class="icon-btn" aria-label="Clear"><i data-feather="x-circle"></i></button>
  </div>
  <div class="bottom-center">
    <button id="btn-switch-cam" class="icon-btn" aria-label="Switch camera"><i data-feather="refresh-cw"></i></button>
  </div>
  <div class="bottom-right">
    <button id="btn-toggle-results" class="icon-btn" aria-label="Toggle results">
      <i data-feather="list"></i> <span id="scan-count">0</span>
    </button>
  </div>
</div>
```

## Dashboard/Admin Sidebar Footer

Bottom section of the sidebar with sign-out button:
```html
<div id="sidebar-footer">
  <button id="btn-logout" class="sidebar-logout">
    <i data-feather="log-out"></i> Sign Out
  </button>
</div>
```

## Branding Footer Text

Store branding includes `footer_text` displayed in the scanner view. If set in `store_branding`, it appears as a small text line below the scanner frame.
