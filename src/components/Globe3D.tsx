import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — Realistic Interactive Daylight Earth (Approved Version)
   ═══════════════════════════════════════════════════════════════════
   • Photorealistic daylight Earth with subtle atmospheric rim
   • Americas initial orientation matching approved visual reference
   • Gentle cloud layer & independent starfield
   • Delta-time physics (idle → drag → inertia → rest → idle)
   • Resource disposal for zero memory leaks & high performance
   ═══════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS = 0.6;
const SPHERE_SEGMENTS = 64;

// Rotation physics
const IDLE_SPEED_DEG_PER_SEC = 0.35;
const IDLE_SPEED = (IDLE_SPEED_DEG_PER_SEC * Math.PI) / 180;
const DRAG_SENSITIVITY = 0.005;
const PITCH_CLAMP = (60 * Math.PI) / 180;
const DAMPING = 0.92;
const VELOCITY_THRESHOLD = 0.00003;
const IDLE_RESUME_DELAY = 4000;
const IDLE_EASE_DURATION = 1500;

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
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ─── SCENE & CAMERA ──────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);

    const computeCameraZ = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const minDim = Math.min(w, h);
      return THREE.MathUtils.clamp(2.6 - minDim / 900, 1.4, 2.2);
    };

    camera.position.set(0, 0, computeCameraZ());

    // ─── GLOBE GROUP ─────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial rotation: Americas centered matching approved reference
    let globeYaw = 1.2;
    let globePitch = 0.15;
    globeGroup.rotation.order = 'YXZ';
    globeGroup.rotation.y = globeYaw;
    globeGroup.rotation.x = globePitch;

    // ─── TEXTURES ────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();

    const earthDayTex = loader.load('/textures/earth-day.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    earthDayTex.minFilter = THREE.LinearFilter;
    disposables.push(earthDayTex);

    const earthNightTex = loader.load('/textures/earth-night.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    earthNightTex.minFilter = THREE.LinearFilter;
    disposables.push(earthNightTex);

    const earthCloudTex = loader.load('/texture/earthCloud.png', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthCloudTex.colorSpace = THREE.SRGBColorSpace;
    earthCloudTex.minFilter = THREE.LinearFilter;
    disposables.push(earthCloudTex);

    // ─── SUN DIRECTION ───────────────────────────────────────────
    const sunDir = new THREE.Vector3(4, 3, 5).normalize();

    // ─── 1. EARTH SPHERE (Day/Night Shader) ──────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(earthGeo);

    const earthDayNightVert = `
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

    const earthDayNightFrag = `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(sunDirection);

        float NdotL = dot(normal, lightDir);
        float dayFactor = smoothstep(-0.15, 0.25, NdotL);

        vec4 dayColor = texture2D(dayMap, vUv);
        vec4 nightColor = texture2D(nightMap, vUv);

        // Day lighting: ambient + diffuse
        float diffuse = max(0.0, NdotL);
        vec3 litDay = dayColor.rgb * (ambientColor * ambientIntensity + vec3(1.0, 0.98, 0.92) * diffuse * 1.8);

        // Night: city lights with subtle ambient
        vec3 litNight = nightColor.rgb * 1.4 + dayColor.rgb * 0.03;

        vec3 finalColor = mix(litNight, litDay, dayFactor);

        // Ocean specular highlight
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        vec3 halfDir = normalize(lightDir + viewDir);
        float spec = pow(max(0.0, dot(normal, halfDir)), 40.0);
        float specMask = 1.0 - clamp(length(dayColor.rgb) * 1.2, 0.0, 1.0);
        finalColor += vec3(0.15, 0.18, 0.22) * spec * specMask * dayFactor;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: earthDayTex },
        nightMap: { value: earthNightTex },
        sunDirection: { value: sunDir },
        ambientColor: { value: new THREE.Color(0.12, 0.14, 0.2) },
        ambientIntensity: { value: 1.0 },
      },
      vertexShader: earthDayNightVert,
      fragmentShader: earthDayNightFrag,
    });
    disposables.push(earthMat);

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // ─── 2. CLOUD LAYER ──────────────────────────────────────────
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(cloudGeo);

    const cloudMat = new THREE.MeshPhongMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    disposables.push(cloudMat);

    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // ─── 3. THIN ATMOSPHERIC FRESNEL RIM ────────────────────────
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
        float intensity = pow(rim, 6.0) * 1.0;

        float sunFacing = max(0.0, dot(vWorldNormal, sunDirection));
        intensity *= (0.1 + 1.6 * sunFacing);

        vec3 deepBlue = vec3(0.16, 0.41, 0.72);
        vec3 limbBlue = vec3(0.29, 0.62, 1.0);
        vec3 color = mix(deepBlue, limbBlue, sunFacing * 0.7);

        gl_FragColor = vec4(color, intensity * 0.45);
      }
    `;

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.022, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
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

    // ─── 4. STAR FIELD ───────────────────────────────────────────
    const starCount = 600;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 25 + Math.random() * 25;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      starSizes[i] = 0.5 + Math.random() * 1.5;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    disposables.push(starGeo);

    const starMat = new THREE.PointsMaterial({
      color: 0xdde4f0,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    disposables.push(starMat);

    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ─── 5. LIGHTING ─────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const sun = new THREE.DirectionalLight(0xfff8ee, 2.2);
    sun.position.copy(sunDir.clone().multiplyScalar(10));
    scene.add(sun);

    const warmRim = new THREE.DirectionalLight(0xffcc88, 0.3);
    warmRim.position.set(3, 4, 2);
    scene.add(warmRim);

    const coolFill = new THREE.DirectionalLight(0x3366aa, 0.08);
    coolFill.position.set(-4, -1, -3);
    scene.add(coolFill);

    // ─── 6. ROTATION STATE MACHINE ───────────────────────────────
    type GlobeState = 'IDLE' | 'DRAGGING' | 'INERTIA' | 'REST' | 'RETURNING_TO_IDLE';
    let state: GlobeState = prefersReducedMotion ? 'REST' : 'IDLE';

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
      const maxVel = prefersReducedMotion ? 0.01 : 0.04;
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

    // ─── 7. ANIMATION LOOP ───────────────────────────────────────
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (disposed) return;

      const now = performance.now();
      const rawDt = now - prevFrameTime;
      prevFrameTime = now;

      const dt = Math.min(rawDt, 100);
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

          if (t >= 1) {
            state = 'IDLE';
          }
          break;
        }
      }

      globeGroup.rotation.y = globeYaw;
      globeGroup.rotation.x = globePitch;

      if (!prefersReducedMotion) {
        cloudMesh.rotation.y += 0.00008 * frameFactor;
      }

      renderer.render(scene, camera);
    };

    animate();

    // ─── RESIZE ──────────────────────────────────────────────────
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

    // ─── VISIBILITY ──────────────────────────────────────────────
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
      } else {
        prevFrameTime = performance.now();
        animate();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ─── CLEANUP ─────────────────────────────────────────────────
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
