import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — High Performance Photorealistic Interactive Earth
   ═══════════════════════════════════════════════════════════════════
   • Ultra-smooth 60fps rendering with zero main-thread freezing
   • Photorealistic day/night terminator with glowing city lights
   • Atmospheric Fresnel rim glow & subtle orbiting trajectory rings
   • Independent background starfield
   • State-machine inertia physics & auto-resume idle rotation
   • Full WebGL resource lifecycle management & memory disposal
   ═══════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS = 0.62;
const SPHERE_SEGMENTS = 52;

// Rotation physics
const IDLE_SPEED_DEG_PER_SEC = 0.35;
const IDLE_SPEED = (IDLE_SPEED_DEG_PER_SEC * Math.PI) / 180;
const DRAG_SENSITIVITY = 0.0045;
const PITCH_CLAMP = (55 * Math.PI) / 180;
const DAMPING = 0.93;
const VELOCITY_THRESHOLD = 0.00002;
const IDLE_RESUME_DELAY = 3500;
const IDLE_EASE_DURATION = 1200;

export function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const disposables: { dispose: () => void }[] = [];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── RENDERER ────────────────────────────────────────────────
    const width = container.clientWidth || window.innerWidth * 0.55;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ─── SCENE & CAMERA ──────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);

    const computeCameraZ = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const minDim = Math.min(w, h);
      return THREE.MathUtils.clamp(2.45 - minDim / 950, 1.45, 2.15);
    };

    camera.position.set(0, 0, computeCameraZ());

    // ─── GLOBE GROUP ─────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial orientation: Center on Africa/Europe/Middle East matching reference
    let globeYaw = 0.25;
    let globePitch = 0.12;
    globeGroup.rotation.order = 'YXZ';
    globeGroup.rotation.y = globeYaw;
    globeGroup.rotation.x = globePitch;

    // ─── TEXTURES WITH FAST PROGRESSIVE LOADING ──────────────────
    const loader = new THREE.TextureLoader();

    // Use optimized textures for fast instant paint
    const dayTexture = loader.load('/textures/earth-day.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });
    dayTexture.colorSpace = THREE.SRGBColorSpace;
    dayTexture.minFilter = THREE.LinearFilter;
    disposables.push(dayTexture);

    const nightTexture = loader.load('/textures/earth-night.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });
    nightTexture.colorSpace = THREE.SRGBColorSpace;
    nightTexture.minFilter = THREE.LinearFilter;
    disposables.push(nightTexture);

    const cloudTexture = loader.load('/texture/earthCloud.png');
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.minFilter = THREE.LinearFilter;
    disposables.push(cloudTexture);

    // ─── SUN DIRECTION (Top-Right illumination) ──────────────────
    const sunDir = new THREE.Vector3(3.8, 2.5, 4.2).normalize();

    // ─── 1. EARTH SPHERE SHADER (Day/Night Blender) ──────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(earthGeo);

    const earthVert = `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const earthFrag = `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      uniform vec3 ambientColor;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(sunDirection);

        float NdotL = dot(normal, lightDir);
        float dayFactor = smoothstep(-0.2, 0.28, NdotL);

        vec4 dayColor = texture2D(dayMap, vUv);
        vec4 nightColor = texture2D(nightMap, vUv);

        // Day lighting
        float diffuse = max(0.0, NdotL);
        vec3 litDay = dayColor.rgb * (ambientColor + vec3(1.0, 0.98, 0.94) * (diffuse * 1.65));

        // Night side: vibrant gold/amber city lights
        vec3 litNight = nightColor.rgb * 1.55 + dayColor.rgb * 0.025;

        // Blend along terminator
        vec3 finalColor = mix(litNight, litDay, dayFactor);

        // Ocean specular glint
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfDir)), 32.0);
        float oceanMask = clamp(1.0 - length(dayColor.rgb) * 1.3, 0.0, 1.0);
        finalColor += vec3(0.18, 0.22, 0.3) * spec * oceanMask * dayFactor;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: dayTexture },
        nightMap: { value: nightTexture },
        sunDirection: { value: sunDir },
        ambientColor: { value: new THREE.Color(0.12, 0.15, 0.22) },
      },
      vertexShader: earthVert,
      fragmentShader: earthFrag,
    });
    disposables.push(earthMat);

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // ─── 2. CLOUD LAYER ──────────────────────────────────────────
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(cloudGeo);

    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    disposables.push(cloudMat);

    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // ─── 3. ATMOSPHERIC FRESNEL RIM GLOW ─────────────────────────
    const atmosVert = `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const atmosFrag = `
      uniform vec3 sunDirection;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = 1.0 - max(0.0, dot(viewDir, vWorldNormal));
        float intensity = pow(rim, 4.8) * 1.1;

        float sunFacing = max(0.0, dot(vWorldNormal, sunDirection));
        intensity *= (0.15 + 1.45 * sunFacing);

        vec3 deepBlue = vec3(0.14, 0.38, 0.78);
        vec3 brightCyan = vec3(0.32, 0.68, 1.0);
        vec3 color = mix(deepBlue, brightCyan, sunFacing * 0.8);

        gl_FragColor = vec4(color, intensity * 0.55);
      }
    `;

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(atmosGeo);

    const atmosMat = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: sunDir } },
      vertexShader: atmosVert,
      fragmentShader: atmosFrag,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    disposables.push(atmosMat);

    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // ─── 4. ORBITAL TRAJECTORY RINGS ─────────────────────────────
    const createOrbitRing = (radiusX: number, radiusY: number, tiltX: number, tiltY: number, colorHex: number, opacity: number) => {
      const curve = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, 2 * Math.PI, false, 0);
      const points = curve.getPoints(100);
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(p.x, p.y, 0)));
      disposables.push(ringGeo);

      const ringMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
      });
      disposables.push(ringMat);

      const ring = new THREE.Line(ringGeo, ringMat);
      ring.rotation.x = tiltX;
      ring.rotation.y = tiltY;
      return ring;
    };

    const orbit1 = createOrbitRing(EARTH_RADIUS * 1.28, EARTH_RADIUS * 1.15, Math.PI / 3.2, Math.PI / 6, 0x38bdf8, 0.22);
    const orbit2 = createOrbitRing(EARTH_RADIUS * 1.42, EARTH_RADIUS * 1.25, -Math.PI / 4, Math.PI / 4, 0x2563eb, 0.15);
    scene.add(orbit1);
    scene.add(orbit2);

    // ─── 5. COSMIC STARFIELD ─────────────────────────────────────
    const starCount = 450;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 22 + Math.random() * 20;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    disposables.push(starGeo);

    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.065,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    disposables.push(starMat);

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ─── 6. LIGHTING ─────────────────────────────────────────────
    const sunLight = new THREE.DirectionalLight(0xfff6ea, 2.0);
    sunLight.position.copy(sunDir.clone().multiplyScalar(10));
    scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(ambientLight);

    // ─── 7. INTERACTION PHYSICS STATE MACHINE ────────────────────
    type State = 'IDLE' | 'DRAGGING' | 'INERTIA' | 'REST' | 'RETURNING_TO_IDLE';
    let state: State = prefersReducedMotion ? 'REST' : 'IDLE';

    let velocityYaw = 0;
    let velocityPitch = 0;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let lastPointerTime = 0;
    let restStartTime = 0;
    let idleEaseStart = 0;
    let prevFrameTime = performance.now();

    const onPointerDown = (e: PointerEvent) => {
      state = 'DRAGGING';
      setIsInteracting(true);
      velocityYaw = 0;
      velocityPitch = 0;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      lastPointerTime = performance.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (state !== 'DRAGGING') return;

      const now = performance.now();
      const dt = Math.max(now - lastPointerTime, 1);

      const dx = e.clientX - prevPointerX;
      const dy = e.clientY - prevPointerY;

      globeYaw += dx * DRAG_SENSITIVITY;
      globePitch += dy * DRAG_SENSITIVITY;
      globePitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, globePitch));

      velocityYaw = (dx * DRAG_SENSITIVITY) / (dt / 16.67);
      velocityPitch = (dy * DRAG_SENSITIVITY) / (dt / 16.67);

      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      lastPointerTime = now;
    };

    const onPointerUp = () => {
      if (state !== 'DRAGGING') return;
      const maxVel = 0.035;
      velocityYaw = Math.max(-maxVel, Math.min(maxVel, velocityYaw));
      velocityPitch = Math.max(-maxVel, Math.min(maxVel, velocityPitch));
      state = 'INERTIA';
      setIsInteracting(false);
    };

    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // ─── 8. ANIMATION LOOP (Delta-time based) ────────────────────
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (disposed) return;

      const now = performance.now();
      const rawDt = now - prevFrameTime;
      prevFrameTime = now;

      const dt = Math.min(rawDt, 64);
      const frameFactor = dt / 16.667;

      switch (state) {
        case 'IDLE':
          globeYaw += IDLE_SPEED * frameFactor;
          break;

        case 'DRAGGING':
          break;

        case 'INERTIA': {
          const dampPower = Math.pow(DAMPING, frameFactor);
          velocityYaw *= dampPower;
          velocityPitch *= dampPower;

          globeYaw += velocityYaw * frameFactor;
          globePitch += velocityPitch * frameFactor;
          globePitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, globePitch));

          if (Math.abs(velocityYaw) < VELOCITY_THRESHOLD && Math.abs(velocityPitch) < VELOCITY_THRESHOLD) {
            velocityYaw = 0;
            velocityPitch = 0;
            state = 'REST';
            restStartTime = now;
          }
          break;
        }

        case 'REST':
          if (!prefersReducedMotion && now - restStartTime > IDLE_RESUME_DELAY) {
            state = 'RETURNING_TO_IDLE';
            idleEaseStart = now;
          }
          break;

        case 'RETURNING_TO_IDLE': {
          const elapsed = now - idleEaseStart;
          const t = Math.min(elapsed / IDLE_EASE_DURATION, 1);
          const eased = t * t * (3 - 2 * t);
          globeYaw += IDLE_SPEED * eased * frameFactor;

          if (t >= 1) state = 'IDLE';
          break;
        }
      }

      globeGroup.rotation.y = globeYaw;
      globeGroup.rotation.x = globePitch;

      if (!prefersReducedMotion) {
        cloudMesh.rotation.y += 0.00007 * frameFactor;
        orbit1.rotation.z += 0.0004 * frameFactor;
        orbit2.rotation.z -= 0.0003 * frameFactor;
      }

      renderer.render(scene, camera);
    };

    animate();

    // ─── RESIZE & VISIBILITY ─────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.position.z = computeCameraZ();
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
      } else {
        prevFrameTime = performance.now();
        animate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ─── DISPOSAL & CLEANUP ──────────────────────────────────────
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      disposables.forEach((d) => d.dispose());

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: isInteracting ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    />
  );
}
