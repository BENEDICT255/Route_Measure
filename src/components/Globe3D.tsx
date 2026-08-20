import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — Photorealistic Interactive Earth
   ═══════════════════════════════════════════════════════════════════
   • Realistic Earth textures (day, night city lights, bump, clouds)
   • Thin natural atmospheric Fresnel rim (NOT a blue circle)
   • Directional sunlight with warm upper-right highlight
   • Stars as independent Points geometry (does NOT rotate with Earth)
   • Day/night shader blending city lights on dark hemisphere
   • Proper state-machine rotation: idle → drag → inertia → rest → idle
   • Frame-rate independent motion (delta-time based)
   • Responsive globe sizing based on min(vw, vh)
   • Respects prefers-reduced-motion
   ═══════════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ─────────────────────────────────────────────────────
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

// ─── COMPONENT ─────────────────────────────────────────────────────
export function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ─── RENDERER (transparent background!) ──────────────────────
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ─── SCENE & CAMERA ──────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );

    // Dynamic camera distance for responsive globe sizing
    const computeCameraZ = () => {
      const vw = container.clientWidth;
      const vh = container.clientHeight;
      const minDim = Math.min(vw, vh);
      // Globe should fill ~65-80% of the smaller viewport dimension
      // Closer camera = larger globe. Clamp between 1.4 and 2.2
      const z = THREE.MathUtils.clamp(2.6 - (minDim / 900), 1.4, 2.2);
      return z;
    };

    camera.position.set(0, 0, computeCameraZ());

    // ─── GLOBE GROUP ─────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial rotation — show Americas (matching reference image)
    let globeYaw = 1.2;
    let globePitch = 0.15;
    globeGroup.rotation.order = 'YXZ';
    globeGroup.rotation.y = globeYaw;
    globeGroup.rotation.x = globePitch;

    // ─── TEXTURES ────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();

    // Check if on mobile for lower-res textures
    const isMobile = window.innerWidth < 768;

    const earthMapTex = loader.load('/texture/earthmap.jpeg');
    earthMapTex.colorSpace = THREE.SRGBColorSpace;
    if (isMobile) {
      earthMapTex.minFilter = THREE.LinearFilter;
    }

    const earthBumpTex = loader.load('/texture/earthbump.jpeg');
    const earthCloudTex = loader.load('/texture/earthCloud.png');
    earthCloudTex.colorSpace = THREE.SRGBColorSpace;

    const earthNightTex = loader.load('/texture/earthmap_night.jpeg');
    earthNightTex.colorSpace = THREE.SRGBColorSpace;

    // ─── SUN DIRECTION ───────────────────────────────────────────
    const sunDir = new THREE.Vector3(4, 3, 5).normalize();

    // ─── 1. EARTH SPHERE (Day/Night Shader) ──────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);

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
      uniform sampler2D bumpMap;
      uniform vec3 sunDirection;
      uniform vec3 ambientColor;
      uniform float ambientIntensity;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vec3 normal = normalize(vWorldNormal);
        vec3 lightDir = normalize(sunDirection);

        // Lambertian diffuse
        float NdotL = dot(normal, lightDir);

        // Smooth transition zone across terminator
        float dayFactor = smoothstep(-0.15, 0.25, NdotL);

        // Sample textures
        vec4 dayColor = texture2D(dayMap, vUv);
        vec4 nightColor = texture2D(nightMap, vUv);

        // Day lighting: ambient + diffuse
        float diffuse = max(0.0, NdotL);
        vec3 litDay = dayColor.rgb * (ambientColor * ambientIntensity + vec3(1.0, 0.98, 0.92) * diffuse * 1.8);

        // Night: city lights with subtle blue ambient
        vec3 litNight = nightColor.rgb * 1.4 + dayColor.rgb * 0.03;

        // Blend
        vec3 finalColor = mix(litNight, litDay, dayFactor);

        // Specular highlight for oceans (darker areas in day texture)
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
        dayMap: { value: earthMapTex },
        nightMap: { value: earthNightTex },
        bumpMap: { value: earthBumpTex },
        sunDirection: { value: sunDir },
        ambientColor: { value: new THREE.Color(0.12, 0.14, 0.2) },
        ambientIntensity: { value: 1.0 },
      },
      vertexShader: earthDayNightVert,
      fragmentShader: earthDayNightFrag,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // ─── 2. CLOUD LAYER (very subtle) ────────────────────────────
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // ─── 3. THIN NATURAL ATMOSPHERE (Fresnel rim) ────────────────
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

        // Very thin — pow 6.0 makes it only visible near silhouette
        float intensity = pow(rim, 6.0) * 1.0;

        // Angle-dependent: stronger on sun-facing side, very faint on dark side
        float sunFacing = max(0.0, dot(vWorldNormal, sunDirection));
        intensity *= (0.1 + 1.6 * sunFacing);

        // Restrained deep atmospheric blue palette
        vec3 deepBlue = vec3(0.16, 0.41, 0.72);   // #2868B7
        vec3 limbBlue = vec3(0.29, 0.62, 1.0);     // #4A9EFF
        vec3 color = mix(deepBlue, limbBlue, sunFacing * 0.7);

        gl_FragColor = vec4(color, intensity * 0.45);
      }
    `;

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.022, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: sunDir } },
      vertexShader: atmosVert,
      fragmentShader: atmosFrag,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // ─── 4. STAR FIELD (independent of globe rotation) ───────────
    const starCount = isMobile ? 500 : 800;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Random position on a distant sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 25 + Math.random() * 25;

      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);

      // Varied brightness via size
      starSizes[i] = 0.5 + Math.random() * 1.5;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));

    const starMat = new THREE.PointsMaterial({
      color: 0xdde4f0,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    const starField = new THREE.Points(starGeo, starMat);
    // Stars are added directly to scene, NOT to globeGroup
    scene.add(starField);

    // ─── 5. LIGHTING (for cloud layer only — Earth uses custom shader) ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    const sun = new THREE.DirectionalLight(0xfff8ee, 2.2);
    sun.position.copy(sunDir.clone().multiplyScalar(10));
    scene.add(sun);

    // Warm rim light for the illuminated edge
    const warmRim = new THREE.DirectionalLight(0xffcc88, 0.3);
    warmRim.position.set(3, 4, 2);
    scene.add(warmRim);

    // Cool fill from dark side
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

    // ─── POINTER HANDLERS ────────────────────────────────────────
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

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
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);

    // ─── 7. ANIMATION LOOP (delta-time based) ────────────────────
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (disposed) return;

      const now = performance.now();
      const rawDt = now - prevFrameTime;
      prevFrameTime = now;

      const dt = Math.min(rawDt, 100);
      const frameFactor = dt / 16.667;

      // ── STATE MACHINE ────────────────────────────────────────
      switch (state) {
        case 'IDLE': {
          globeYaw += IDLE_SPEED * frameFactor;
          break;
        }

        case 'DRAGGING': {
          break;
        }

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

        case 'REST': {
          if (!prefersReducedMotion && now - restStartTime > IDLE_RESUME_DELAY) {
            state = 'RETURNING_TO_IDLE';
            idleEaseStart = now;
          }
          break;
        }

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

      // Apply rotation
      globeGroup.rotation.y = globeYaw;
      globeGroup.rotation.x = globePitch;

      // Very slow independent cloud drift
      if (!prefersReducedMotion) {
        cloudMesh.rotation.y += 0.00008 * frameFactor;
      }

      // Render
      renderer.render(scene, camera);
    };

    animate();

    // ─── RESIZE ──────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.position.z = computeCameraZ();
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // ─── VISIBILITY (pause when hidden) ──────────────────────────
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
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
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
