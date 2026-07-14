;(function() {
  var container = document.getElementById('canvas-container')
  if (!container) return

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // ── Scene setup ──
  var scene = new THREE.Scene()
  var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 14

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.appendChild(renderer.domElement)

  // ── Objects ──
  var objects = []
  var wireframeObjects = []

  var wireGeometries = [
    new THREE.IcosahedronGeometry(1.0, 0),
    new THREE.OctahedronGeometry(0.9, 0),
    new THREE.TetrahedronGeometry(1.1, 0),
  ]
  var wireColors = [0x6366f1, 0xf59e0b, 0xa855f7]

  // Wireframe objects (existing behavior)
  for (var i = 0; i < 6; i++) {
    var geo = wireGeometries[i % wireGeometries.length]
    var color = wireColors[i % wireColors.length]
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      wireframe: true,
      transparent: true,
      opacity: 0.12 + Math.random() * 0.12,
      metalness: 0.8,
      roughness: 0.2,
    })
    var mesh = new THREE.Mesh(geo, mat)

    var radius = 5 + Math.random() * 6
    var theta = Math.random() * Math.PI * 2
    var phi = Math.random() * Math.PI * 2

    mesh.position.x = Math.sin(theta) * Math.cos(phi) * radius
    mesh.position.y = Math.sin(theta) * Math.sin(phi) * radius
    mesh.position.z = Math.cos(theta) * radius * 0.4

    mesh.rotation.x = Math.random() * Math.PI
    mesh.rotation.y = Math.random() * Math.PI

    mesh.userData = {
      speed: 0.15 + Math.random() * 0.3,
      rotX: (Math.random() - 0.5) * 0.008,
      rotY: (Math.random() - 0.5) * 0.008,
      rotZ: (Math.random() - 0.5) * 0.008,
      floatSpeed: 0.2 + Math.random() * 0.4,
      floatAmp: 0.15 + Math.random() * 0.2,
      baseY: mesh.position.y,
      phase: Math.random() * Math.PI * 2,
      orbitSpeed: (Math.random() - 0.5) * 0.05,
      orbitRadius: radius,
      baseX: mesh.position.x,
      baseZ: mesh.position.z,
      theta: theta
    }

    scene.add(mesh)
    wireframeObjects.push(mesh)
    objects.push(mesh)
  }

  // ── Glowing solid shapes ──
  var solidGeometries = [
    new THREE.SphereGeometry(0.3, 16, 16),
    new THREE.IcosahedronGeometry(0.25, 0),
  ]

  for (var i = 0; i < 4; i++) {
    var geo = solidGeometries[i % solidGeometries.length]
    var color = wireColors[i % wireColors.length]
    var mat = new THREE.MeshPhysicalMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.5,
      metalness: 0.3,
      roughness: 0.4,
    })
    var mesh = new THREE.Mesh(geo, mat)
    var radius = 3 + Math.random() * 4
    var angle = Math.random() * Math.PI * 2

    mesh.position.x = Math.cos(angle) * radius
    mesh.position.y = (Math.random() - 0.5) * 4
    mesh.position.z = Math.sin(angle) * radius

    mesh.userData = {
      orbitSpeed: 0.02 + Math.random() * 0.03,
      orbitRadius: radius,
      angle: angle,
      baseY: mesh.position.y,
      floatSpeed: 0.3 + Math.random() * 0.4,
      floatAmp: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2
    }

    scene.add(mesh)
    objects.push(mesh)
  }

  // ── Large ring ──
  var ringGeo = new THREE.TorusGeometry(3.5, 0.03, 16, 64)
  var ringMat = new THREE.MeshBasicMaterial({
    color: 0x6366f1,
    transparent: true,
    opacity: 0.15
  })
  var ring = new THREE.Mesh(ringGeo, ringMat)
  ring.rotation.x = Math.PI / 3
  ring.rotation.z = 0.2
  scene.add(ring)
  objects.push(ring)

  var ring2Geo = new THREE.TorusGeometry(4.5, 0.02, 16, 64)
  var ring2Mat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.08
  })
  var ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
  ring2.rotation.x = -Math.PI / 4
  ring2.rotation.z = 0.5
  scene.add(ring2)
  objects.push(ring2)

  // ── Particles ──
  var particleDensity = window.innerWidth < 480 ? 150 : (window.innerWidth < 768 ? 250 : 400)
  var particleCount = Math.min(particleDensity, 500)
  var particleGeo = new THREE.BufferGeometry()
  var positions = new Float32Array(particleCount * 3)
  var particleColors = new Float32Array(particleCount * 3)
  var colorPalette = [
    new THREE.Color(0x6366f1),
    new THREE.Color(0xa855f7),
    new THREE.Color(0xf59e0b),
    new THREE.Color(0xef4444),
  ]

  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 50
    positions[i * 3 + 1] = (Math.random() - 0.5) * 50
    positions[i * 3 + 2] = (Math.random() - 0.5) * 50

    var c = colorPalette[Math.floor(Math.random() * colorPalette.length)]
    particleColors[i * 3] = c.r
    particleColors[i * 3 + 1] = c.g
    particleColors[i * 3 + 2] = c.b
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

  var particleMat = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  var particles = new THREE.Points(particleGeo, particleMat)
  scene.add(particles)

  // ── Mouse / touch ──
  var mouseX = 0
  var mouseY = 0
  var targetX = 0
  var targetY = 0
  var isTouching = false

  function onPointerMove(x, y) {
    mouseX = (x / window.innerWidth) * 2 - 1
    mouseY = -(y / window.innerHeight) * 2 + 1
  }

  document.addEventListener('mousemove', function(e) {
    isTouching = false
    onPointerMove(e.clientX, e.clientY)
  })

  document.addEventListener('touchmove', function(e) {
    isTouching = true
    var t = e.touches[0]
    onPointerMove(t.clientX, t.clientY)
  }, { passive: true })

  document.addEventListener('touchend', function() {
    isTouching = false
  })

  // ── Card 3D tilt ──
  var card = document.querySelector('.product-card')
  if (card) {
    card.addEventListener('mousemove', function(e) {
      var rect = card.getBoundingClientRect()
      var x = (e.clientX - rect.left) / rect.width
      var y = (e.clientY - rect.top) / rect.height
      var tiltX = (y - 0.5) * -16
      var tiltY = (x - 0.5) * 16
      card.style.transform = 'perspective(800px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg)'
    })

    card.addEventListener('mouseleave', function() {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg)'
    })
  }

  // ── Animation loop ──
  var clock = new THREE.Clock()

  function animate() {
    requestAnimationFrame(animate)
    var t = clock.getElapsedTime()

    // Smooth mouse lerp (with auto-rotate when idle on touch)
    if (isTouching || Math.abs(mouseX) < 0.01 && Math.abs(mouseY) < 0.01) {
      // Gentle idle rotation
      targetX += (Math.sin(t * 0.1) * 0.3 - targetX) * 0.01
      targetY += (Math.cos(t * 0.08) * 0.2 - targetY) * 0.01
    } else {
      targetX += (mouseX - targetX) * 0.03
      targetY += (mouseY - targetY) * 0.03
    }

    camera.position.x = targetX * 2
    camera.position.y = targetY * 2
    camera.lookAt(0, 0, 0)

    // Update wireframe objects
    for (var i = 0; i < wireframeObjects.length; i++) {
      var obj = wireframeObjects[i]
      var ud = obj.userData
      obj.rotation.x += ud.rotX * ud.speed
      obj.rotation.y += ud.rotY * ud.speed
      obj.rotation.z += ud.rotZ * ud.speed

      // Orbital motion
      ud.theta += ud.orbitSpeed * ud.speed
      obj.position.x = Math.sin(ud.theta) * ud.orbitRadius
      obj.position.z = Math.cos(ud.theta) * ud.orbitRadius
      obj.position.y = ud.baseY + Math.sin(t * ud.floatSpeed + ud.phase) * ud.floatAmp
    }

    // Update solid orbiting objects
    for (var i = wireframeObjects.length; i < objects.length - 2; i++) {
      var obj = objects[i]
      var ud = obj.userData
      ud.angle += ud.orbitSpeed
      obj.position.x = Math.cos(ud.angle) * ud.orbitRadius
      obj.position.z = Math.sin(ud.angle) * ud.orbitRadius
      obj.position.y = ud.baseY + Math.sin(t * ud.floatSpeed + ud.phase) * ud.floatAmp
      obj.rotation.x += 0.01
      obj.rotation.y += 0.02

      // Pulse emissive
      var pulse = 0.3 + Math.sin(t * 0.8 + ud.phase) * 0.2
      if (obj.material) obj.material.emissiveIntensity = pulse
    }

    // Rotate rings
    ring.rotation.z = t * 0.05
    ring.rotation.y = t * 0.03
    ring2.rotation.z = -t * 0.04
    ring2.rotation.x = t * 0.02

    // Rotate particle field
    particles.rotation.y = t * 0.02
    particles.rotation.x = Math.sin(t * 0.01) * 0.02

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

  // ── Scroll animations (Intersection Observer) ──
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.1 })

    document.querySelectorAll('[data-animate]').forEach(function(el) {
      observer.observe(el)
    })

    // Immediate: show hero
    var hero = document.getElementById('hero')
    if (hero) setTimeout(function() { hero.classList.add('is-visible') }, 100)
  } else {
    document.querySelectorAll('[data-animate]').forEach(function(el) {
      el.classList.add('is-visible')
    })
  }

})()
