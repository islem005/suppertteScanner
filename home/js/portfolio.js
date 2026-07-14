;(function() {
  var container = document.getElementById('canvas-container')
  if (!container) return

  // ── Check reduced motion ──
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // ── Three.js scene ──
  var scene = new THREE.Scene()
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 12

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  // ── Objects ──
  var objects = []
  var geometries = [
    new THREE.IcosahedronGeometry(1.2, 0),
    new THREE.TorusKnotGeometry(0.9, 0.3, 64, 8),
    new THREE.OctahedronGeometry(1.0, 0),
    new THREE.TetrahedronGeometry(1.1, 0)
  ]
  var colors = [0x6366f1, 0xf59e0b, 0xef4444, 0xa855f7]

  for (var i = 0; i < 8; i++) {
    var geo = geometries[i % geometries.length]
    var color = colors[i % colors.length]
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.15 + Math.random() * 0.15,
      metalness: 0.8,
      roughness: 0.2,
    })
    var mesh = new THREE.Mesh(geo, mat)

    var radius = 4 + Math.random() * 5
    var theta = Math.random() * Math.PI * 2
    var phi = Math.random() * Math.PI * 2

    mesh.position.x = Math.sin(theta) * Math.cos(phi) * radius
    mesh.position.y = Math.sin(theta) * Math.sin(phi) * radius
    mesh.position.z = Math.cos(theta) * radius * 0.5

    mesh.rotation.x = Math.random() * Math.PI
    mesh.rotation.y = Math.random() * Math.PI

    mesh.userData = {
      speed: 0.2 + Math.random() * 0.4,
      rotX: (Math.random() - 0.5) * 0.01,
      rotY: (Math.random() - 0.5) * 0.01,
      rotZ: (Math.random() - 0.5) * 0.01,
      floatSpeed: 0.3 + Math.random() * 0.5,
      floatAmp: 0.2 + Math.random() * 0.3,
      baseY: mesh.position.y,
      phase: Math.random() * Math.PI * 2
    }

    scene.add(mesh)
    objects.push(mesh)
  }

  // ── Particles ──
  var particleCount = Math.min(400, Math.floor(window.innerWidth * 0.15))
  var particleGeo = new THREE.BufferGeometry()
  var positions = new Float32Array(particleCount * 3)
  for (var i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 50
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  var particleMat = new THREE.PointsMaterial({
    color: 0x6366f1,
    size: 0.04,
    transparent: true,
    opacity: 0.5
  })
  var particles = new THREE.Points(particleGeo, particleMat)
  scene.add(particles)

  // ── Mouse / touch tracking ──
  var mouseX = 0
  var mouseY = 0
  var targetX = 0
  var targetY = 0

  function onPointerMove(x, y) {
    mouseX = (x / window.innerWidth) * 2 - 1
    mouseY = -(y / window.innerHeight) * 2 + 1
  }

  document.addEventListener('mousemove', function(e) {
    onPointerMove(e.clientX, e.clientY)
  })

  document.addEventListener('touchmove', function(e) {
    var t = e.touches[0]
    onPointerMove(t.clientX, t.clientY)
  }, { passive: true })

  // ── Card 3D tilt ──
  var card = document.querySelector('.product-card')
  if (card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect()
      var x = (e.clientX - rect.left) / rect.width
      var y = (e.clientY - rect.top) / rect.height
      var tiltX = (y - 0.5) * -20
      var tiltY = (x - 0.5) * 20
      card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)'
    })

    card.addEventListener('mouseleave', function() {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
    })

    // Mobile: subtle tilt based on orientation
    if (window.DeviceOrientationEvent) {
      var orientBeta = null
      var orientGamma = null
      var cardTiltActive = true

      window.addEventListener('deviceorientation', function(e) {
        if (e.beta !== null && e.gamma !== null) {
          orientBeta = e.beta
          orientGamma = e.gamma
        }
      })

      // Poll orientation for card tilt (less frequent)
      if ('ondeviceorientation' in window) {
        setInterval(function() {
          if (!cardTiltActive || orientBeta === null || orientGamma === null) return

          var isMobile = window.innerWidth < 768
          if (!isMobile) return

          var tiltX = Math.max(-15, Math.min(15, (orientBeta - 45) * 0.3))
          var tiltY = Math.max(-15, Math.min(15, orientGamma * 0.3))

          if (card) {
            card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)'
          }
        }, 200)
      }
    }
  }

  // ── Animation loop ──
  var clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    var t = clock.getElapsedTime()

    // Smooth mouse lerp
    targetX += (mouseX - targetX) * 0.05
    targetY += (mouseY - targetY) * 0.05

    // Camera follows mouse
    camera.position.x = targetX * 1.5
    camera.position.y = targetY * 1.5
    camera.lookAt(0, 0, 0)

    // Rotate objects
    for (var i = 0; i < objects.length; i++) {
      var obj = objects[i]
      var ud = obj.userData
      obj.rotation.x += ud.rotX * ud.speed
      obj.rotation.y += ud.rotY * ud.speed
      obj.rotation.z += ud.rotZ * ud.speed
      obj.position.y = ud.baseY + Math.sin(t * ud.floatSpeed + ud.phase) * ud.floatAmp
    }

    // Rotate particle field slowly
    particles.rotation.y = t * 0.03

    renderer.render(scene, camera)
  }

  animate()

  // ── Resize ──
  function onResize() {
    var w = window.innerWidth
    var h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }

  window.addEventListener('resize', onResize)

})()
