# Headers

## Scanner Top Bar (scanner.html)

Fixed at top of scanner view. Contains:
- **Store identity**: Profile logo + store name on left
- **Action row**: Torch toggle (`zap` icon), scan counter, install button
- **Profile strip**: Social links (Instagram, TikTok, Website, Email, Phone, Facebook, Twitter, YouTube) shown as Feather icons

Structure:
```html
<div id="top-bar">
  <div id="profile-bar">
    <div id="profile-avatar" class="hidden">
      <img id="profile-logo" src="" alt="Logo">
    </div>
    <span id="profile-name">Store Name</span>
  </div>
  <div id="profile-links">
    <a id="profile-instagram" class="hidden" target="_blank" aria-label="Instagram"><i data-feather="instagram"></i></a>
    <!-- ... other social links ... -->
  </div>
  <div id="action-bar">
    <button id="btn-torch" class="icon-btn" aria-label="Toggle flash"><i data-feather="zap"></i></button>
    <span id="scan-counter">0</span>
    <button id="btn-install" class="icon-btn" aria-label="Install app"><i data-feather="download"></i></button>
  </div>
</div>
```

Social link icons use Feather icons: `instagram`, `twitter`, `facebook`, `youtube`, `globe` (website), `mail` (email), `phone` (phone).

## Dashboard Sidebar Header

Contains the user section at the top:
- Avatar circle (first letter of name)
- Display name / email
- Sign out button at the bottom

```html
<div id="sidebar">
  <div id="sidebar-header">
    <div class="sidebar-avatar">A</div>
    <span id="sidebar-username">admin@store.com</span>
  </div>
  <nav id="sidebar-nav"><!-- nav items injected by JS --></nav>
  <div id="sidebar-footer">
    <button id="btn-logout" class="sidebar-logout">
      <i data-feather="log-out"></i> Sign Out
    </button>
  </div>
</div>
```

## Admin Sidebar

Same structure as dashboard sidebar. Nav items:
- Overview (`bar-chart-2`), Stores (`home`), Users (`users`), Promotions (`gift`), Discounts (`tag`), Branding (`droplet`), Activity (`clock`), Profile (`user`)

## Active Nav Item Indicator

Active state uses a **left border accent** (2px solid `--color-primary`) instead of background fill:

```css
.nav-item.active {
  border-left: 2px solid var(--color-primary);
  color: var(--text-primary);
  background: var(--color-primary-muted);
}
```

## Sidebar Responsive

- Desktop: sidebar always visible (220px width)
- Mobile (<=768px): sidebar slides from left, backdrop overlay, close button
- Toggle button (`btn-toggle-sidebar`) with `menu` icon
- Backdrop (`sidebar-backdrop`) closes sidebar on tap
