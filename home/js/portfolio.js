;(function() {
  var container = document.getElementById('canvas-container')
  if (!container) return

  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced) return

  // ── Scene setup ──
  var scene = new THREE.Scene()
  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
  camera.position.z = 15

  var renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.8
  container.appendChild(renderer.domElement)

  // ── Generate organic blob geometry ──
  function createBlob(radius, segments, displacement, seed) {
    var geo = new THREE.SphereGeometry(radius, segments, segments)
    var pos = geo.attributes.position
    var count = pos.count

    for (var i = 0; i < count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      var len = Math.sqrt(x*x + y*y + z*z)
      var nx = x / len, ny = y / len, nz = z / len

      var theta = Math.acos(ny)
      var phi = Math.atan2(nz, nx)

      var noise =
        Math.sin(theta * 3 + seed) * 0.3 +
        Math.cos(phi * 4 + seed * 2) * 0.2 +
        Math.sin(theta * 2 + phi * 3 + seed * 1.5) * 0.25 +
        Math.cos(theta * 5 + phi * 2 + seed * 0.7) * 0.15

      var r = radius + displacement * noise
      pos.setXYZ(i, nx * r, ny * r, nz * r)
    }

    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }

  // ── Blob colors (warm Mediterranean) ──
  var blobColors = [
    { base: 0xc86a4e, emissive: 0xc86a4e },  // terracotta
    { base: 0xd4a843, emissive: 0xd4a843 },  // gold
    { base: 0x5a7a4a, emissive: 0x5a7a4a },  // olive
    { base: 0x1a6b8a, emissive: 0x1a6b8a },  // deep blue
  ]

  var blobs = []

  for (var i = 0; i < 5; i++) {
    var colorSet = blobColors[i % blobColors.length]
    var radius = 0.8 + Math.random() * 0.6
    var segments = 28
    var displacement = 0.4 + Math.random() * 0.5
    var seed = Math.random() * 10

    var geo = createBlob(radius, segments, displacement, seed)
    var mat = new THREE.MeshPhysicalMaterial({
      color: colorSet.base,
      emissive: colorSet.emissive,
      emissiveIntensity: 0.15,
      metalness: 0.1,
      roughness: 0.6,
      transparent: true,
      opacity: 0.7,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
    })

    var mesh = new THREE.Mesh(geo, mat)

    var dist = 4 + Math.random() * 5
    var angleH = Math.random() * Math.PI * 2
    var angleV = (Math.random() - 0.5) * 0.8

    mesh.position.x = Math.cos(angleH) * dist
    mesh.position.z = Math.sin(angleH) * dist
    mesh.position.y = Math.sin(angleV) * dist * 0.5

    mesh.rotation.x = Math.random() * Math.PI
    mesh.rotation.y = Math.random() * Math.PI

    mesh.userData = {
      basePos: mesh.position.clone(),
      rotSpeed: 0.1 + Math.random() * 0.2,
      rotX: (Math.random() - 0.5) * 0.005,
      rotY: (Math.random() - 0.5) * 0.005,
      rotZ: (Math.random() - 0.5) * 0.005,
      floatSpeed: 0.2 + Math.random() * 0.3,
      floatAmp: 0.2 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      orbitAngle: angleH,
      orbitSpeed: (Math.random() - 0.5) * 0.02,
      orbitRadius: dist,
      seed: seed,
      displacement: displacement,
      originalPos: geo.attributes.position.array.slice(),
    }

    scene.add(mesh)
    blobs.push({ mesh: mesh, geo: geo, mat: mat, colorSet: colorSet })
  }

  // ── Central blob (larger, slower) ──
  var centerGeo = createBlob(1.2, 32, 0.6, 7.3)
  var centerMat = new THREE.MeshPhysicalMaterial({
    color: 0xc86a4e,
    emissive: 0xc86a4e,
    emissiveIntensity: 0.1,
    metalness: 0.1,
    roughness: 0.5,
    transparent: true,
    opacity: 0.5,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
  })
  var centerBlob = new THREE.Mesh(centerGeo, centerMat)
  centerBlob.userData = {
    rotX: 0.002,
    rotY: 0.003,
    rotZ: 0.001,
    seed: 7.3,
    displacement: 0.6,
    originalPos: centerGeo.attributes.position.array.slice(),
  }
  scene.add(centerBlob)

  // ── Particles ──
  var particleCount = window.innerWidth < 480 ? 100 : (window.innerWidth < 768 ? 180 : 300)
  var particleGeo = new THREE.BufferGeometry()
  var positions = new Float32Array(particleCount * 3)
  var sizes = new Float32Array(particleCount)
  var pColors = new Float32Array(particleCount * 3)

  var palette = [
    new THREE.Color(0xc86a4e),
    new THREE.Color(0xd4a843),
    new THREE.Color(0x5a7a4a),
    new THREE.Color(0x1a6b8a),
  ]

  for (var i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 40
    positions[i * 3 + 1] = (Math.random() - 0.5) * 40
    positions[i * 3 + 2] = (Math.random() - 0.5) * 40
    sizes[i] = 0.02 + Math.random() * 0.06
    var c = palette[Math.floor(Math.random() * palette.length)]
    pColors[i * 3] = c.r * 0.6
    pColors[i * 3 + 1] = c.g * 0.6
    pColors[i * 3 + 2] = c.b * 0.6
  }

  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
  particleGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3))

  var particleMat = new THREE.PointsMaterial({
    size: 0.04,
    transparent: true,
    opacity: 0.4,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  var particles = new THREE.Points(particleGeo, particleMat)
  scene.add(particles)

  // ── Mouse / touch tracking ──
  var mouseX = 0
  var mouseY = 0
  var targetX = 0
  var targetY = 0

  document.addEventListener('mousemove', function(e) {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1
    mouseY = -(e.clientY / window.innerHeight) * 2 + 1
  })

  document.addEventListener('touchmove', function(e) {
    var t = e.touches[0]
    mouseX = (t.clientX / window.innerWidth) * 2 - 1
    mouseY = -(t.clientY / window.innerHeight) * 2 + 1
  }, { passive: true })

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

    // Smooth camera follow with idle drift
    if (Math.abs(mouseX) < 0.01 && Math.abs(mouseY) < 0.01) {
      targetX += (Math.sin(t * 0.08) * 0.2 - targetX) * 0.008
      targetY += (Math.cos(t * 0.06) * 0.15 - targetY) * 0.008
    } else {
      targetX += (mouseX - targetX) * 0.03
      targetY += (mouseY - targetY) * 0.03
    }

    camera.position.x = targetX * 2
    camera.position.y = targetY * 2
    camera.lookAt(0, 0, 0)

    // Animate blobs
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i]
      var mesh = b.mesh
      var ud = mesh.userData

      mesh.rotation.x += ud.rotX * ud.rotSpeed
      mesh.rotation.y += ud.rotY * ud.rotSpeed
      mesh.rotation.z += ud.rotZ * ud.rotSpeed

      ud.orbitAngle += ud.orbitSpeed
      mesh.position.x = Math.cos(ud.orbitAngle) * ud.orbitRadius
      mesh.position.z = Math.sin(ud.orbitAngle) * ud.orbitRadius
      mesh.position.y = ud.basePos.y + Math.sin(t * ud.floatSpeed + ud.phase) * ud.floatAmp

      // Breathe: gently pulse emissive
      var breathe = 0.1 + Math.sin(t * 0.5 + ud.phase) * 0.08
      b.mat.emissiveIntensity = breathe
    }

    // Central blob: slow rotation + gentle pulse
    centerBlob.rotation.x += centerBlob.userData.rotX
    centerBlob.rotation.y += centerBlob.userData.rotY
    centerBlob.rotation.z += centerBlob.userData.rotZ
    var centerPulse = 0.08 + Math.sin(t * 0.3) * 0.06
    centerMat.emissiveIntensity = centerPulse

    // Slow particle drift
    particles.rotation.y = t * 0.015
    particles.rotation.x = Math.sin(t * 0.008) * 0.015

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

  // ── Scroll animations ──
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

    var hero = document.getElementById('hero')
    if (hero) setTimeout(function() { hero.classList.add('is-visible') }, 100)
  } else {
    document.querySelectorAll('[data-animate]').forEach(function(el) {
      el.classList.add('is-visible')
    })
  }

})()
