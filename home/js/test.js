/* ═══ SKANER — Homepage Test JS ═══ */

;(function() {

  // ── I18N Strings ──
  var strings = {
    fr: {
      navWhat: 'Fonctionnalités',
      navSteps: 'Étapes',
      navWhy: 'Pourquoi',
      navSignIn: 'Connexion',
      navCTA: 'Commencer',
      heroTitle: '\'C\'est combien ?\'',
      heroSub: 'SKANER : vos clients scannent le code-barres, le prix apparaît. Directement sur leur téléphone, sans rien installer.',
      phoneName: 'Lait',
      phonePrice: '100 DZD',
      whatTitle: 'Comment ça marche',
      whatSub: 'Deux expériences, une plateforme.',
      whatCustTitle: 'Pour vos clients',
      whatCustDesc: 'Ils scannent le code-barres avec leur téléphone. Prix et nom s\'affichent. Rien à installer.',
      whatCustAction: 'Partagez le lien.',
      whatOwnerTitle: 'Pour vous',
      whatOwnerDesc: 'Connectez-vous au tableau de bord. Ajoutez des produits, modifiez les prix.',
      whatOwnerAction: 'Gérez en ligne.',
      stepsTitle: 'Trois étapes',
      step1Title: 'Créez votre magasin',
      step1Desc: 'Nom et email. Votre lien scanner est prêt.',
      step2Title: 'Importez vos produits',
      step2Desc: 'CSV ou un par un. Vos prix, votre catalogue.',
      step3Title: 'Partagez le lien',
      step3Desc: 'Sur les étagères, les tickets. Les clients scannent.',
      whyTitle: 'Pourquoi les gérants nous font confiance',
      why1Title: 'Fini de répéter',
      why1Desc: 'Chaque étagère affiche les prix. Les clients scannent et voient eux-mêmes.',
      why2Title: 'Modifiez, c\'est instantané',
      why2Desc: 'Changez un prix en ligne. Vu partout, tout de suite.',
      why3Title: 'Ça marche partout',
      why3Desc: 'Pas d\'appli. Navigateur + appareil photo = magasin intelligent.',
      why4Title: 'Votre marque',
      why4Desc: 'Le scanner affiche votre logo, vos couleurs. Une expérience personnalisée.',
      ctaTitle: 'Prêt ?',
      ctaSub: 'Gratuit. Sans carte bancaire.',
      ctaCTA: 'Créer mon magasin →',
      footerTagline: 'SKANER — Le scan simplifié.',
      footerCopy: '© 2026 ivond'
    },
    en: {
      navWhat: 'Features',
      navSteps: 'Steps',
      navWhy: 'Why',
      navSignIn: 'Sign In',
      navCTA: 'Get Started',
      heroTitle: 'Tired of repeating<br><span class="highlight">prices</span> all day?',
      heroSub: 'Customers scan the barcode, the price pops up. SKANER works in the browser — no app to install.',
      phoneName: 'Milk',
      phonePrice: '100 DZD',
      whatTitle: 'How it works',
      whatSub: 'Two sides of SKANER.',
      whatCustTitle: 'For Your Customers',
      whatCustDesc: 'They open your link, point the camera at a barcode — the price and name appear. Nothing to install, nothing to learn.',
      whatCustAction: 'Just share the link.',
      whatOwnerTitle: 'For You, the Store Owner',
      whatOwnerDesc: 'Log into your dashboard. Add products, change prices, track scan stats. From your phone or laptop.',
      whatOwnerAction: 'Manage from your dashboard.',
      stepsTitle: 'Three things to do',
      step1Title: 'Create Your Store',
      step1Desc: 'Enter your name and email. Your scanner link is ready in 30 seconds.',
      step2Title: 'Upload Products',
      step2Desc: 'CSV, Excel, or one by one. Your products, your prices.',
      step3Title: 'Share the Link',
      step3Desc: 'On shelves, receipts, social media. Customers scan — that\'s it.',
      whyTitle: 'Why store owners trust us',
      why1Title: 'Stop repeating prices',
      why1Desc: 'Every shelf becomes a price display. Customers scan and see the price themselves.',
      why2Title: 'Update once, it\'s everywhere',
      why2Desc: 'Change a price in the dashboard — it\'s instant on every phone.',
      why3Title: 'Works on any phone',
      why3Desc: 'No app to install. Browser + camera = smart store.',
      why4Title: 'Your brand, your colors',
      why4Desc: 'The scanner shows your logo, colors, and contact info. A customized experience.',
      ctaTitle: 'Ready to transform your store?',
      ctaSub: 'Free. Ready in 30 seconds. No credit card.',
      ctaCTA: 'Create My Store →',
      footerTagline: 'SKANER — In-store barcode scanning made simple.',
      footerCopy: '© 2026 ivond'
    }
  }

  // ── Language toggle ──
  var currentLang = 'fr'

  function applyLang(lang) {
    currentLang = lang
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.dataset.i18n
      var txt = strings[lang][key]
      if (txt !== undefined) el.innerHTML = txt
    })
    document.documentElement.lang = lang
    document.querySelectorAll('.lang-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang)
    })
  }

  document.querySelectorAll('.lang-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyLang(btn.dataset.lang)
    })
  })

  applyLang('fr')

  // ── Hamburger menu ──
  var navToggle = document.getElementById('nav-toggle')
  var navLinks = document.getElementById('nav-links')
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('open')
    })
    navLinks.querySelectorAll('.nav-link').forEach(function(a) {
      a.addEventListener('click', function() {
        navLinks.classList.remove('open')
      })
    })
  }

  // ── Scroll progress bar ──
  var progressBar = document.getElementById('scroll-progress')
  if (progressBar) {
    window.addEventListener('scroll', function() {
      var scrollTop = window.scrollY
      var docHeight = document.documentElement.scrollHeight - window.innerHeight
      var progress = docHeight > 0 ? (scrollTop / docHeight) : 0
      progressBar.style.transform = 'scaleX(' + Math.min(progress, 1) + ')'
    })
  }

  // ── Splash: stamp fall ──
  var splash = document.getElementById('splash')
  if (splash) {
    var stamps = [
      // { text, font, bg, color }
      { t: 'Combien ?', f: 'Playfair Display', s: 2.5 },
      { t: 'كم ؟', f: 'Noto Naskh Arabic, serif', s: 2.8 },
      { t: 'COMBIEN', f: 'DM Sans', s: 1.8 },
      { t: 'قداه ؟', f: 'Noto Naskh Arabic, serif', s: 2.2 },
      { t: 'combien', f: 'Georgia', s: 2.0 },
      { t: 'شحال ؟', f: 'Noto Naskh Arabic, serif', s: 2.4 },
      { t: 'C\'est combien ?', f: 'Playfair Display', s: 2.2 },
      { t: 'بقداش ؟', f: 'Noto Naskh Arabic, serif', s: 2.3 },
      { t: 'How much?', f: 'DM Sans', s: 1.6 },
      { t: 'QUANT-O?', f: 'monospace', s: 1.7 },
      { t: 'kombien', f: 'cursive', s: 2.0 },
      { t: 'شحال ؟!', f: 'Noto Kufi Arabic, sans-serif', s: 2.5 },
      { t: 'Combien!!!', f: 'DM Sans', s: 1.9 },
      { t: '?? كم', f: 'serif', s: 2.6 },
      { t: 'قداه', f: 'Noto Naskh Arabic, serif', s: 2.1 },
      { t: 'Cmb?', f: 'monospace', s: 1.5 },
      { t: 'Combien ?!', f: 'Playfair Display', s: 2.3 },
      { t: 'بقداش !', f: 'Noto Kufi Arabic, sans-serif', s: 2.2 },
      { t: 'شحال من مرة ؟', f: 'Noto Naskh Arabic, serif', s: 2.0 },
    ]

    var bgColors = [
      'rgba(200,106,78,0.06)', 'rgba(59,130,246,0.05)',
      'rgba(168,85,247,0.05)', 'rgba(34,197,94,0.05)',
      'rgba(234,179,8,0.05)', 'rgba(236,72,153,0.05)',
      'rgba(100,116,139,0.06)', 'rgba(249,115,22,0.05)',
      'rgba(20,184,166,0.05)'
    ]

    // Create stamps
    for (var i = 0; i < stamps.length; i++) {
      (function(idx) {
        var s = stamps[idx]
        var el = document.createElement('div')
        el.className = 'splash-stamp'

        // Random position across full screen
        var left = 0.5 + Math.random() * 75

        // Random rotation (-12 to 12 deg)
        var rot = (Math.random() * 24 - 12).toFixed(1)

        el.textContent = s.t
        el.style.left = left + '%'
        el.style.top = (2 + Math.random() * 85) + '%'
        el.style.fontFamily = s.f
        el.style.fontSize = (0.8 + Math.random() * s.s) + 'rem'
        el.style.fontWeight = (idx % 3 === 0) ? '900' : (idx % 3 === 1 ? '700' : '400')
        el.style.background = bgColors[idx % bgColors.length]
        el.style.border = '1px solid ' + bgColors[idx % bgColors.length].replace('0.0', '0.15')
        el.style.setProperty('--stamp-rotate', rot + 'deg')
        el.style.setProperty('--stamp-opacity', (0.08 + Math.random() * 0.1))
        el.style.animationDuration = (0.6 + Math.random() * 0.8) + 's'
        el.style.animationDelay = (Math.random() * 2.5) + 's'

        // Right-to-left for Arabic
        if (s.f.indexOf('Arabic') > -1) {
          el.style.direction = 'rtl'
        }

        splash.appendChild(el)
      })(i)
    }

    // After 4.5s, fade splash → typewriter
    setTimeout(function() {
      splash.classList.add('hide')

      setTimeout(function() {
        // Typewriter on hero title first
        var titleEl = document.querySelector('#hero h1')
        var subEl = document.querySelector('.hero-sub')
        var titleText = ''
        var subText = ''

        if (titleEl) {
          titleText = titleEl.textContent
          titleEl.textContent = ''
          titleEl.style.opacity = '1'
        }
        if (subEl) {
          subText = subEl.textContent
          subEl.textContent = ''
          subEl.style.opacity = '1'
        }

        // Reveal hero elements (including phone mockup)
        document.querySelectorAll('#hero [data-animate]').forEach(function(el) {
          el.classList.add('is-visible')
        })

        // Type title, then sub
        var i = 0
        function typeTitle() {
          if (i < titleText.length) {
            titleEl.textContent += titleText.charAt(i)
            i++
            var d = titleText.charAt(i - 1) === ' ' ? 20 : 35 + Math.random() * 20
            setTimeout(typeTitle, d)
          } else {
            // Title done → start sub
            var j = 0
            function typeSub() {
              if (j < subText.length) {
                subEl.textContent += subText.charAt(j)
                j++
                var d2 = subText.charAt(j - 1) === ' ' ? 12 : 20 + Math.random() * 12
                setTimeout(typeSub, d2)
              }
            }
            setTimeout(typeSub, 200)
          }
        }
        typeTitle()
      }, 800)
    }, 4500)
  }

  // ── Intersection Observer animations ──
  var animateEls = document.querySelectorAll('[data-animate]')
  if (animateEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var delay = parseInt(entry.target.dataset.delay) || 0
          setTimeout(function() {
            entry.target.classList.add('is-visible')
          }, delay)
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15 })

    animateEls.forEach(function(el) {
      observer.observe(el)
    })

    // Safety: reveal all hidden elements after 12s (accounts for splash + typing)
    setTimeout(function() {
      document.querySelectorAll('[data-animate]:not(.is-visible)').forEach(function(el) {
        if (el.dataset.animate === 'fade-up' || el.dataset.animate === 'scale-in') {
          el.classList.add('is-visible')
        }
      })
    }, 12000)
  } else {
    // Fallback: show everything immediately
    animateEls.forEach(function(el) { el.classList.add('is-visible') })
  }

})()
