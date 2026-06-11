(function() {
  const video = document.getElementById('scanner');
  const toast = document.getElementById('toast');

  const profileAvatar = document.getElementById('profile-avatar');
  const profileLogo = document.getElementById('profile-logo');
  const profileName = document.getElementById('profile-name');
  const profileInstagram = document.getElementById('profile-instagram');
  const profileTiktok = document.getElementById('profile-tiktok');
  const profileWebsite = document.getElementById('profile-website');
  const profileEmail = document.getElementById('profile-email');
  const profilePhone = document.getElementById('profile-phone');
  const profileFacebook = document.getElementById('profile-facebook');
  const profileTwitter = document.getElementById('profile-twitter');
  const profileYoutube = document.getElementById('profile-youtube');

  const bannerCarousel = document.getElementById('banner-carousel');
  const bannerTrack = document.getElementById('banner-track');
  const bannerDots = document.getElementById('banner-dots');
  const bannerFallback = document.getElementById('banner-fallback');
  const bannerText = document.getElementById('banner-text');
  let bannerSwiper = null;

  const camName = document.getElementById('cam-name');
  const camPrice = document.getElementById('cam-price');
  const camFeed = document.getElementById('camera-feed');

  const promoContent = document.getElementById('promo-content');
  const promoImage = document.getElementById('promo-image');

  const discArea = document.getElementById('discount-area');
  const discTrack = document.getElementById('discount-track');
  const discDots = document.getElementById('discount-dots');

  const btnInstall = document.getElementById('btn-install');
  const apiBase = '/api';

  let deferredPrompt = null;
  let storeSlug = null;
  let storeName = null;
  let storeId = null;
  let placeholderPromo = null;
  let discItems = [];
  let discSwiper = null;
  let lastScanTime = 0;
  let idleCheckInterval = null;
  let clientId = null;
  let sessionId = null;

  // ── Store slug detection ────────────────────────────────────────────
  // Priority 1: If we're on a store subdomain (my-store.ivond.com),
  // extract the slug from the hostname.
  // Priority 2: Fall back to path-based slug (/my-store) for backward compat.
  const host = location.hostname;
  if (host.endsWith('.ivond.com') && host !== 'ivond.com' && !host.startsWith('admin.') && !host.startsWith('www.')) {
    storeSlug = host.split('.')[0];
  } else {
    const path = location.pathname.replace(/\/+$/, '');
    const reserved = ['', '/', '/index.html', '/scanner.html', '/dashboard', '/dashboard/', '/admin', '/admin/'];
    if (path && !reserved.includes(path) && !path.startsWith('/dashboard')) {
      storeSlug = path.replace(/^\//, '');
    }
  }

  // ── Client Tracking IDs ────────────────────────────────────────
  sessionId = sessionStorage.getItem('scanner_session') || (() => { const id = crypto.randomUUID(); sessionStorage.setItem('scanner_session', id); return id })();

  // ── PWA Install ───────────────────────────────────────────────
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('App installed!');
  });

  async function boot() {
    if (typeof feather !== 'undefined') feather.replace();

    if (storeSlug) {
      try {
        const res = await fetch(`${apiBase}/stores/slug/${storeSlug}`);
        if (!res.ok) throw new Error('Store not found');
        const store = await res.json();
        storeName = store.name;
        storeId = store.id;
        document.title = storeName; // Dynamic page title per store

        try {
          const br = await fetch(`${apiBase}/branding/${store.id}`);
          const brand = await br.json();
          if (brand.primary_color) document.documentElement.style.setProperty('--color-primary', brand.primary_color);
          if (brand.accent_color) document.documentElement.style.setProperty('--color-success', brand.accent_color);
          if (brand.logo_url) { profileLogo.src = brand.logo_url; profileAvatar.classList.remove('hidden'); }
          if (brand.display_name) profileName.textContent = brand.display_name;
          else profileName.textContent = storeName;
          if (brand.instagram_url) { profileInstagram.href = brand.instagram_url; profileInstagram.classList.remove('hidden'); }
          if (brand.tiktok_url) { profileTiktok.href = brand.tiktok_url; profileTiktok.classList.remove('hidden'); }
          if (brand.website_url) { profileWebsite.href = brand.website_url; profileWebsite.classList.remove('hidden'); }
          if (brand.contact_email) { profileEmail.href = 'mailto:' + brand.contact_email; profileEmail.classList.remove('hidden'); }
          if (brand.contact_phone) { profilePhone.href = 'tel:' + brand.contact_phone; profilePhone.classList.remove('hidden'); }
          if (brand.facebook_url) { profileFacebook.href = brand.facebook_url; profileFacebook.classList.remove('hidden'); }
          if (brand.twitter_url) { profileTwitter.href = brand.twitter_url; profileTwitter.classList.remove('hidden'); }
          if (brand.youtube_url) { profileYoutube.href = brand.youtube_url; profileYoutube.classList.remove('hidden'); }
          if (typeof feather !== 'undefined') feather.replace();
        } catch { console.warn('Branding fetch failed') }

        try {
          const banners = await (await fetch(`${apiBase}/promotions/banners/${store.id}`)).json();
          if (Array.isArray(banners) && banners.length > 0) {
            startCarousel(banners);
            bannerFallback.classList.add('hidden');
          } else {
            bannerCarousel.classList.add('hidden');
            bannerFallback.classList.add('hidden');
          }
        } catch {
          console.warn('Banners fetch failed');
          bannerCarousel.classList.add('hidden');
          bannerFallback.classList.add('hidden');
        }

        try {
          const offers = await (await fetch(`${apiBase}/promotions/offers/${store.id}`)).json();
          if (Array.isArray(offers) && offers.length > 0) {
            placeholderPromo = offers.find(o => !o.trigger_type && !o.trigger_value) || offers[0];
            if (placeholderPromo.image_url || placeholderPromo.image_data) {
              promoImage.src = placeholderPromo.image_url || placeholderPromo.image_data;
              promoContent.classList.remove('hidden');
            }
          }
        } catch { console.warn('Offers fetch failed') }

        try {
          const discounts = await (await fetch(`${apiBase}/discounts/${store.id}?featured=1`)).json();
          if (Array.isArray(discounts) && discounts.length > 0) {
            discItems = discounts;
            startDiscountCarousel();
          }
        } catch { console.warn('Discounts fetch failed') }

      } catch (e) {
        showToast('Store not found');
        camName.textContent = 'Camera ready';
        return;
      }

      // Initialize client ID and fire page_view
      try {
        clientId = await Storage.getClientId();
        const deviceType = /mobile|iphone|ipad|ipod|android/i.test(navigator.userAgent) ? 'mobile' :
          /tablet|ipad/i.test(navigator.userAgent) ? 'tablet' : 'desktop';
        fetch(`${apiBase}/page-views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'skaner-csrf-token' },
          body: JSON.stringify({
            store_slug: storeSlug,
            client_id: clientId,
            session_id: sessionId,
            device_type: deviceType,
            referrer: document.referrer || null
          })
        }).catch(() => {});
      } catch {}
    } else {
      profileName.textContent = 'SKANER';
    }

    const result = await Scanner.init();
    if (result.ok) {
      Scanner.start(video, onBarcode);

      camFeed.addEventListener('click', async () => {
        camName.textContent = 'Restarting camera…';
        const r = await Scanner.restart(video, onBarcode);
        camName.textContent = r.ok ? 'Camera ready' : r.error;
        if (r.ok) showToast('Camera refreshed');
      });
    } else {
      camFeed.classList.add('hidden');
      camName.textContent = result.error;
      camName.classList.add('hint');
    }
  }

  async function onBarcode(code) {
    let productInfo = null;
    lastScanTime = Date.now();

    if (storeSlug) {
      try {
        const res = await fetch(`${apiBase}/lookup/${storeSlug}?barcode=${encodeURIComponent(code)}`);
        productInfo = await res.json();
      } catch {}

      fetch(`${apiBase}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'skaner-csrf-token' },
        body: JSON.stringify({
          store_slug: storeSlug,
          barcode: code,
          client_id: clientId,
          session_id: sessionId
        })
      }).catch(() => {});
    }

    vibrate();

    if (productInfo && productInfo.found) {
      camName.textContent = productInfo.name;
      camName.classList.remove('hint');

      // Check for matching discount by barcode
      let discMatch = null;
      try {
        const dr = await fetch(`${apiBase}/discounts/${storeId}?barcode=${encodeURIComponent(code)}`);
        const dl = await dr.json();
        if (Array.isArray(dl) && dl.length > 0) discMatch = dl[0];
      } catch {}

      if (discMatch) {
        const origPrice = productInfo.price != null ? parseFloat(productInfo.price) : NaN;
        const discPrice = discMatch.new_price != null ? parseFloat(discMatch.new_price) : NaN;
        camPrice.innerHTML = `<span style="text-decoration:line-through;color:var(--text-tertiary);font-size:var(--text-sm)">${isNaN(origPrice) ? '—' : origPrice.toFixed(2)} DA</span> ${isNaN(discPrice) ? '—' : discPrice.toFixed(2)} DA`;
        camPrice.classList.remove('error');
      } else {
        const p = productInfo.price != null ? parseFloat(productInfo.price) : NaN;
        camPrice.textContent = `${isNaN(p) ? '—' : p.toFixed(2)} DA`;
        camPrice.classList.remove('error');
      }

      // Show category-matched discounts
      if (productInfo.category && storeId) {
        try {
          const dr = await fetch(`${apiBase}/discounts/${storeId}?category=${encodeURIComponent(productInfo.category)}`);
          const catDiscs = await dr.json();
          if (Array.isArray(catDiscs) && catDiscs.length > 0) {
            discItems = catDiscs;
            startDiscountCarousel();
          }
        } catch {}
      }
    } else if (storeSlug) {
      camName.textContent = 'Unknown product';
      camName.classList.add('hint');
      camPrice.textContent = code;
      camPrice.classList.add('error');
    } else {
      showToast(`Scanned: ${code}`);
    }
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

  function startCarousel(banners) {
    if (bannerSwiper) { bannerSwiper.destroy(true, true); bannerSwiper = null }
    bannerTrack.innerHTML = '';
    banners.forEach(b => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      if (b.image_url || b.image_data) {
        const img = document.createElement('img');
        img.src = b.image_url || b.image_data;
        img.alt = b.title || '';
        slide.appendChild(img);
      }
      bannerTrack.appendChild(slide);
    });
    bannerCarousel.classList.remove('hidden');
    bannerSwiper = new Swiper('#banner-carousel', {
      loop: banners.length > 1,
      autoplay: banners.length > 1 ? { delay: 5000, disableOnInteraction: false } : false,
      pagination: { el: '#banner-dots', clickable: true }
    });
  }

  // ─── Discount Carousel ───
  function startDiscountCarousel() {
    if (discSwiper) { discSwiper.destroy(true, true); discSwiper = null }
    discDots.innerHTML = '';

    if (discItems.length < 2) { discArea.classList.add('hidden'); return }

    const wrapper = document.getElementById('discount-wrapper');
    wrapper.innerHTML = '';

    discItems.forEach(d => {
      const slide = document.createElement('div');
      slide.className = 'swiper-slide discount-card';

      const img = document.createElement('img');
      img.src = d.image_url || d.image_data || '';
      img.alt = d.name || '';
      img.loading = 'lazy';
      slide.appendChild(img);

      const name = document.createElement('div');
      name.className = 'discount-name';
      name.textContent = d.name || '';
      slide.appendChild(name);

      const oldP = document.createElement('div');
      oldP.className = 'discount-old-price';
      oldP.textContent = (d.original_price || 0).toFixed(2) + ' DA';
      slide.appendChild(oldP);

      const newP = document.createElement('div');
      newP.className = 'discount-new-price';
      newP.textContent = (d.new_price || 0).toFixed(2) + ' DA';
      slide.appendChild(newP);

      if (d.discount_percent) {
        const badge = document.createElement('div');
        badge.className = 'discount-badge';
        badge.textContent = '-' + d.discount_percent + '%';
        slide.appendChild(badge);
      }

      wrapper.appendChild(slide);
    });

    discArea.classList.remove('hidden');
    discSwiper = new Swiper('#discount-track', {
      slidesPerView: 3,
      spaceBetween: 0,
      loop: discItems.length >= 5,
      autoplay: { delay: 5000, disableOnInteraction: false },
      pagination: { el: '#discount-dots', clickable: true }
    });
  }

  // ─── Idle Detection ───
  function checkIdle() {
    if (!storeId) return;
    if (Date.now() - lastScanTime > 30000 && discItems.length > 0) {
      fetch(`${apiBase}/discounts/${storeId}?featured=1`).then(r => r.json()).then(dl => {
        if (Array.isArray(dl) && dl.length > 0) {
          discItems = dl;
          startDiscountCarousel();
        }
      }).catch(() => {});
    }
  }

  idleCheckInterval = setInterval(checkIdle, 10000);

  if (btnInstall) {
    btnInstall.addEventListener('click', async () => {
      if (!deferredPrompt) {
        const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
        if (isIos) {
          showToast('Tap Share → Add to Home Screen');
        } else if (window.matchMedia('(display-mode: standalone)').matches) {
          showToast('Already installed');
        } else {
          showToast('Visit a few times, then install will be ready');
        }
        return;
      }
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        deferredPrompt = null;
      }
    });
  } else {
    console.warn('Missing #btn-install — install button not rendered');
  }

window.addEventListener('unhandledrejection', e => {
    console.warn('Unhandled:', e.reason);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
