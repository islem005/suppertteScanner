;(function() {
  if (typeof feather !== 'undefined') feather.replace()
  if (typeof I18N !== 'undefined') I18N.applyHtml()

  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('open')
  })

  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      document.getElementById('nav-links').classList.remove('open')
    })
  })

  const langBtn = document.getElementById('nav-lang-btn')
  const langDropdown = document.getElementById('nav-lang-dropdown')
  if (langBtn && langDropdown) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      langDropdown.classList.toggle('hidden')
    })
    document.addEventListener('click', () => langDropdown.classList.add('hidden'))
    langDropdown.querySelectorAll('.nav-lang-option').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof I18N !== 'undefined') {
          I18N.setLang(btn.dataset.lang)
          location.reload()
        }
      })
    })
  }
})()
