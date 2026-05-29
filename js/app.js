(function() {
  const video = document.getElementById('scanner');
  const toast = document.getElementById('toast');
  const resultOverlay = document.getElementById('result-overlay');
  const resultName = document.getElementById('result-name');
  const resultPrice = document.getElementById('result-price');
  const title = document.getElementById('title');
  const storeProfile = document.getElementById('store-profile');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileLogo = document.getElementById('profile-logo');
  const profileName = document.getElementById('profile-name');
  const profileInstagram = document.getElementById('profile-instagram');
  const profileTiktok = document.getElementById('profile-tiktok');
  const profileWebsite = document.getElementById('profile-website');
  const profileEmail = document.getElementById('profile-email');
  const profilePhone = document.getElementById('profile-phone');
  const apiBase = '/api';
  const btnInstall = document.getElementById('btn-install');
  let deferredPrompt = null;
  let storeSlug = null;
  let storeName = null;
  let storeId = null;
  let resultTimer = null;

  const path = location.pathname.replace(/\/+$/, '');
  const reserved = ['', '/', '/index.html', '/scanner.html', '/dashboard', '/dashboard/', '/admin', '/admin/'];
  if (path && !reserved.includes(path) && !path.startsWith('/dashboard')) {
    storeSlug = path.replace(/^\//, '');
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferredPrompt = e
    btnInstall.classList.remove('hidden')
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    btnInstall.classList.add('hidden')
    showToast('App installed!')
  })

  async function boot() {
    if (typeof feather !== 'undefined') feather.replace();
    if (storeSlug) {
      try {
        const res = await fetch(`${apiBase}/stores/slug/${storeSlug}`);
        const store = await res.json();
        storeName = store.name;
        storeId = store.id;
        try {
          const br = await fetch(`${apiBase}/branding/${store.id}`);
          const brand = await br.json();
          if (brand.primary_color) document.documentElement.style.setProperty('--color-primary', brand.primary_color);
          if (brand.accent_color) document.documentElement.style.setProperty('--color-success', brand.accent_color);
          if (brand.logo_url) { profileLogo.src = brand.logo_url; profileAvatar.classList.remove('hidden') }
          if (brand.display_name) profileName.textContent = brand.display_name
          else profileName.textContent = storeName
          if (brand.instagram_url) { profileInstagram.href = brand.instagram_url; profileInstagram.classList.remove('hidden') }
          if (brand.tiktok_url) { profileTiktok.href = brand.tiktok_url; profileTiktok.classList.remove('hidden') }
          if (brand.website_url) { profileWebsite.href = brand.website_url; profileWebsite.classList.remove('hidden') }
          if (brand.contact_email) { profileEmail.href = 'mailto:' + brand.contact_email; profileEmail.classList.remove('hidden') }
          if (brand.contact_phone) { profilePhone.href = 'tel:' + brand.contact_phone; profilePhone.classList.remove('hidden') }
          if (brand.logo_url || brand.display_name || brand.instagram_url || brand.tiktok_url || brand.website_url || brand.contact_email || brand.contact_phone) {
            storeProfile.classList.remove('hidden')
          }
          if (typeof feather !== 'undefined') feather.replace();
        } catch {}
      } catch {
        showToast('Store not found');
      }
    }

    const result = await Scanner.init();
    if (!result.ok) {
      document.getElementById('scan-frame').style.display = 'none';
      document.getElementById('scan-hint').textContent = result.error;
      document.getElementById('scan-hint').style.color = 'var(--color-danger)';
      document.getElementById('scan-hint').style.fontSize = '14px';
      return;
    }
    Scanner.start(video, onBarcode);
    if (!Scanner.isTorchSupported()) {
      document.getElementById('btn-torch').style.display = 'none';
    }
  }

  async function onBarcode(code) {
    let productInfo = null;

    if (storeSlug) {
      try {
        const res = await fetch(`${apiBase}/lookup/${storeSlug}?barcode=${encodeURIComponent(code)}`);
        productInfo = await res.json();
      } catch {}

      fetch(`${apiBase}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_slug: storeSlug, barcode: code })
      }).catch(() => {});
    }

    vibrate();

    if (productInfo && productInfo.found) {
      showProduct(productInfo.name, productInfo.price);
    } else if (storeSlug) {
      showNoProduct(code);
    } else {
      showToast(`Scanned: ${code}`);
    }
  }

  function showProduct(name, price) {
    resultOverlay.className = 'found show';
    resultName.textContent = name;
    resultPrice.textContent = `${parseFloat(price).toFixed(2)} DA`;
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => resultOverlay.classList.remove('show'), 2500);
  }

  function showNoProduct(code) {
    resultOverlay.className = 'not-found show';
    resultName.textContent = 'Unknown product';
    resultPrice.textContent = code;
    clearTimeout(resultTimer);
    resultTimer = setTimeout(() => resultOverlay.classList.remove('show'), 2000);
  }

  function vibrate() {
    try { navigator.vibrate(30); } catch (_) {}
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._hide);
    toast._hide = setTimeout(() => toast.classList.remove('show'), 1500);
  }

  document.getElementById('btn-torch').addEventListener('click', async () => {
    const on = await Scanner.toggleTorch();
    document.getElementById('btn-torch').classList.toggle('active', on);
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const result = await deferredPrompt.userChoice
    if (result.outcome === 'accepted') {
      deferredPrompt = null
      btnInstall.classList.add('hidden')
    }
  });

  window.addEventListener('unhandledrejection', e => {
    console.warn('Unhandled:', e.reason);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
