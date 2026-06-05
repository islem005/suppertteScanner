;(function() {
  if (typeof feather !== 'undefined') feather.replace()

  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('open')
  })

  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      document.getElementById('nav-links').classList.remove('open')
    })
  })
})()
