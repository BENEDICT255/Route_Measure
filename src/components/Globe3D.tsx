import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — Photorealistic Daylight Earth with Crisp Clouds & Sun Strip
   ═══════════════════════════════════════════════════════════════════
   • Vibrant natural continents with terrain elevation bump mapping
   • Focused specular ocean glint under upper-left sunlight
   • Crisp, wispy alpha-blended cloud layer
   • Razor-sharp, glowing electric-blue 'sun strip' atmospheric crescent
   • Deep cosmos starfield with upper-left sparkling star accent
   • Responsive camera projection scaling seamlessly with browser zoom
   • Interactive drag with natural inertia & smooth idle rotation
   ═══════════════════════════════════════════════════════════════════ */

const EARTH_RADIUS = 0.58;
const SPHERE_SEGMENTS = 64;

export function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const disposables: { dispose: () => void }[] = [];

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── 1. SCENE & RENDERER ─────────────────────────────────────
    const width = container.clientWidth || window.innerWidth * 0.6;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // ─── 2. CAMERA & RESPONSIVE PROJECTION ───────────────────────
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);

    const updateCamera = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / h;
      camera.aspect = aspect;

      let camZ = 1.74;
      let camX = 0.12;
      let camY = -0.02;

      if (aspect < 1.0) {
        camZ = 2.18;
        camX = 0.0;
        camY = 0.12;
      } else if (aspect < 1.4) {
        camZ = 1.88;
        camX = 0.08;
      } else {
        camZ = THREE.MathUtils.clamp(1.72 - (w - 1200) * 0.00012, 1.52, 1.78);
        camX = 0.13;
      }

      camera.position.set(camX, camY, camZ);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    };
    updateCamera();

    // ─── 3. TEXTURE LOADER ───────────────────────────────────────
    const loader = new THREE.TextureLoader();

    // Daylight Map
    const earthDayTex = loader.load('/textures/earth-day.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthDayTex.colorSpace = THREE.SRGBColorSpace;
    earthDayTex.minFilter = THREE.LinearFilter;
    disposables.push(earthDayTex);

    // Bump Map
    const earthBumpTex = loader.load('/texture/earthbump.jpeg');
    earthBumpTex.minFilter = THREE.LinearFilter;
    disposables.push(earthBumpTex);

    // Night Lights Map
    const earthNightTex = loader.load('/texture/earthmap_night.jpeg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthNightTex.colorSpace = THREE.SRGBColorSpace;
    earthNightTex.minFilter = THREE.LinearFilter;
    disposables.push(earthNightTex);

    // Alpha Clouds Map
    const earthCloudTex = loader.load('/texture/earthCloud.png', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    earthCloudTex.colorSpace = THREE.SRGBColorSpace;
    earthCloudTex.minFilter = THREE.LinearFilter;
    disposables.push(earthCloudTex);

    // ─── 4. SUN DIRECTION (Upper-Left Lighting) ──────────────────
    const sunDir = new THREE.Vector3(-0.72, 0.46, 0.52).normalize();

    // ─── 5. GLOBE GROUP ──────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    let globeYaw = 1.35;
    let globePitch = 0.12;
    globeGroup.rotation.order = 'YXZ';
    globeGroup.rotation.y = globeYaw;
    globeGroup.rotation.x = globePitch;

    // ─── 6. EARTH SURFACE SHADER ─────────────────────────────────
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
      uniform sampler2D bumpMap;
      uniform sampler2D nightMap;
      uniform vec3 sunDirection;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 sun = normalize(sunDirection);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // Bump map elevation
        vec2 texel = vec2(1.0 / 2048.0, 1.0 / 1024.0);
        float hL = texture2D(bumpMap, vUv - vec2(texel.x, 0.0)).r;
        float hR = texture2D(bumpMap, vUv + vec2(texel.x, 0.0)).r;
        float hD = texture2D(bumpMap, vUv - vec2(0.0, texel.y)).r;
        float hU = texture2D(bumpMap, vUv + vec2(0.0, texel.y)).r;
        vec3 bumpNorm = normalize(normal + vec3((hL - hR) * 0.02, (hD - hU) * 0.02, 0.0));

        float NdotL = dot(bumpNorm, sun);
        float dayFactor = smoothstep(-0.12, 0.28, NdotL);

        vec4 dayColor = texture2D(dayMap, vUv);
        vec4 nightColor = texture2D(nightMap, vUv);

        vec3 vibrantDay = dayColor.rgb;

        // Sunlight illumination
        float diffuse = max(0.0, NdotL);
        vec3 sunLight = vec3(1.08, 1.04, 0.98) * diffuse * 1.75 + vec3(0.06, 0.10, 0.18) * 0.85;
        vec3 litDay = vibrantDay * sunLight;

        // Subtle, tight ocean specular glint
        float isWater = 1.0 - clamp(length(vibrantDay) * 1.15, 0.0, 1.0);
        vec3 halfDir = normalize(sun + viewDir);
        float spec = pow(max(0.0, dot(normal, halfDir)), 68.0);
        litDay += vec3(0.35, 0.60, 0.90) * spec * isWater * dayFactor * 0.85;

        // Sunset rim at terminator
        float terminator = 1.0 - abs(NdotL * 3.5);
        if (terminator > 0.0) {
          litDay += vec3(0.3, 0.15, 0.05) * pow(terminator, 2.0) * (1.0 - isWater) * 0.3;
        }

        // Night side city lights
        vec3 litNight = nightColor.rgb * 1.5 + vibrantDay * vec3(0.015, 0.025, 0.05);

        vec3 finalColor = mix(litNight, litDay, dayFactor);

        // Internal atmospheric horizon haze
        float fresnel = 1.0 - max(0.0, dot(viewDir, normal));
        float sunFacing = max(0.0, dot(normal, sun));
        vec3 atmosHaze = vec3(0.25, 0.60, 0.95) * pow(fresnel, 3.4) * (0.10 + 1.2 * sunFacing);
        finalColor += atmosHaze * 0.40;

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const earthMat = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: earthDayTex },
        bumpMap: { value: earthBumpTex },
        nightMap: { value: earthNightTex },
        sunDirection: { value: sunDir },
      },
      vertexShader: earthVert,
      fragmentShader: earthFrag,
    });
    disposables.push(earthMat);

    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // ─── 7. CRISP ALPHA CLOUD LAYER ──────────────────────────────
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(cloudGeo);

    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.58,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    disposables.push(cloudMaterial);

    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMaterial);
    globeGroup.add(cloudMesh);

    // ─── 8. ATMOSPHERE CRESCENT "SUN STRIP" SHADER ───────────────
    // Razor-thin electric-blue rim along the illuminated upper-left crescent
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.024, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    disposables.push(atmosGeo);

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
        vec3 normal = normalize(vWorldNormal);
        vec3 sun = normalize(sunDirection);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);

        // Thin, sharp rim calculation
        float rim = 1.0 - max(0.0, dot(viewDir, normal));
        float thinStrip = pow(rim, 4.8);

        // Sun alignment factor (concentrated on upper-left sunlit crescent)
        float sunAlignment = dot(normal, sun);
        float sunFactor = smoothstep(-0.25, 0.85, sunAlignment);

        // Brilliant cyan / electric-blue to diamond-white colors
        vec3 deepBlue = vec3(0.14, 0.46, 0.96);
        vec3 electricCyan = vec3(0.38, 0.85, 1.0);
        vec3 diamondWhite = vec3(0.92, 0.97, 1.0);

        vec3 stripColor = mix(deepBlue, electricCyan, sunFactor);
        stripColor = mix(stripColor, diamondWhite, pow(max(0.0, sunAlignment), 3.5) * 0.7);

        float intensity = thinStrip * (0.05 + 2.8 * sunFactor);

        gl_FragColor = vec4(stripColor, intensity * 0.96);
      }
    `;

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

    // ─── 9. DEEP SPACE COSMOS & STARFIELD ────────────────────────
    const starCount = 550;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 24 + Math.random() * 20;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      starSizes[i] = 0.4 + Math.random() * 1.4;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
    disposables.push(starGeo);

    const starMat = new THREE.PointsMaterial({
      color: 0xdde6f8,
      size: 0.075,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    disposables.push(starMat);

    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    // ─── 10. SPARKLING DIAMOND STAR ACCENT (Upper-Left Horizon) ──
    const flareCanvas = document.createElement('canvas');
    flareCanvas.width = 64;
    flareCanvas.height = 64;
    const ctx = flareCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.2, 'rgba(180, 220, 255, 0.8)');
    grad.addColorStop(0.5, 'rgba(60, 140, 255, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const flareTex = new THREE.CanvasTexture(flareCanvas);
    disposables.push(flareTex);

    const flareMat = new THREE.SpriteMaterial({
      map: flareTex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.85,
    });
    disposables.push(flareMat);

    const flareSprite = new THREE.Sprite(flareMat);
    flareSprite.position.set(-1.12, 0.90, -2.5);
    flareSprite.scale.set(0.28, 0.28, 1);
    scene.add(flareSprite);

    // ─── 11. LIGHTING (For cloud mesh) ───────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const mainSun = new THREE.DirectionalLight(0xfff8ee, 2.2);
    mainSun.position.copy(sunDir.clone().multiplyScalar(10));
    scene.add(mainSun);

    // ─── 12. ROTATION PHYSICS & MOMENTUM ─────────────────────────
    const IDLE_SPEED = prefersReducedMotion ? 0 : 0.0016;
    const DRAG_FACTOR = 0.0045;
    const PITCH_LIMIT = (55 * Math.PI) / 180;
    const DAMPING = 0.93;
    const IDLE_RESUME_DELAY = 3000;
    const IDLE_EASE_DURATION = 1200;

    type State = 'IDLE' | 'DRAGGING' | 'INERTIA' | 'REST' | 'RESUMING';
    let state: State = prefersReducedMotion ? 'REST' : 'IDLE';

    let velocityYaw = 0;
    let velocityPitch = 0;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let lastTime = 0;
    let restStartTime = 0;
    let resumeStartTime = 0;
    let prevFrameTime = performance.now();

    const onPointerDown = (e: PointerEvent) => {
      state = 'DRAGGING';
      setIsInteracting(true);
      velocityYaw = 0;
      velocityPitch = 0;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      lastTime = performance.now();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (state !== 'DRAGGING') return;
      const now = performance.now();
      const dt = Math.max(now - lastTime, 1);

      const dx = e.clientX - prevPointerX;
      const dy = e.clientY - prevPointerY;

      globeYaw += dx * DRAG_FACTOR;
      globePitch += dy * DRAG_FACTOR;
      globePitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, globePitch));

      velocityYaw = (dx * DRAG_FACTOR) / (dt / 16.67);
      velocityPitch = (dy * DRAG_FACTOR) / (dt / 16.67);

      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      lastTime = now;
    };

    const onPointerUp = () => {
      if (state !== 'DRAGGING') return;
      const maxV = 0.04;
      velocityYaw = Math.max(-maxV, Math.min(maxV, velocityYaw));
      velocityPitch = Math.max(-maxV, Math.min(maxV, velocityPitch));
      state = 'INERTIA';
      setIsInteracting(false);
    };

    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // ─── 13. ANIMATION LOOP ──────────────────────────────────────
    let frameId: number;

    const animate = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);

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
          const damp = Math.pow(DAMPING, frameFactor);
          velocityYaw *= damp;
          velocityPitch *= damp;

          globeYaw += velocityYaw * frameFactor;
          globePitch += velocityPitch * frameFactor;
          globePitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, globePitch));

          if (Math.abs(velocityYaw) < 0.00004 && Math.abs(velocityPitch) < 0.00004) {
            velocityYaw = 0;
            velocityPitch = 0;
            state = 'REST';
            restStartTime = now;
          }
          break;
        }

        case 'REST':
          if (!prefersReducedMotion && now - restStartTime > IDLE_RESUME_DELAY) {
            state = 'RESUMING';
            resumeStartTime = now;
          }
          break;

        case 'RESUMING': {
          const elapsed = now - resumeStartTime;
          const t = Math.min(elapsed / IDLE_EASE_DURATION, 1);
          const ease = t * t * (3 - 2 * t);
          globeYaw += IDLE_SPEED * ease * frameFactor;

          if (t >= 1) {
            state = 'IDLE';
          }
          break;
        }
      }

      globeGroup.rotation.y = globeYaw;
      globeGroup.rotation.x = globePitch;

      if (!prefersReducedMotion) {
        cloudMesh.rotation.y += 0.00006 * frameFactor;
      }

      renderer.render(scene, camera);
    };
    animate();

    // ─── 14. RESIZE OBSERVER ─────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      updateCamera();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', updateCamera);

    // ─── 15. VISIBILITY CHANGE ───────────────────────────────────
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
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateCamera);
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
