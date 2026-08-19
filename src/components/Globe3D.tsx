import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — Photorealistic Interactive Earth
   ═══════════════════════════════════════════════════════════════════
   • Realistic Earth textures (earthmap, earthbump, earthCloud)
   • Thin natural atmospheric Fresnel rim (NOT a blue circle)
   • Directional sunlight with warm upper-right highlight
   • Proper state-machine rotation: idle → drag → inertia → rest → idle
   • Frame-rate independent motion (delta-time based)
   • Subtle grounding glow beneath Earth
   • No galaxy starbox — transparent canvas blends with CSS background
   ═══════════════════════════════════════════════════════════════════ */

// ─── ROUTE DATA ────────────────────────────────────────────────────
interface RouteData {
  id: string;
  distanceLabel: string;
  color: string;
  points: [number, number][];
}

const DEMO_ROUTES: RouteData[] = [
  {
    id: 'route-europe',
    distanceLabel: '2.85 km',
    color: '#60a5fa',
    points: [
      [52.52, 13.405],   // Berlin
      [50.075, 14.437],  // Prague
      [48.137, 11.576],  // Munich
    ],
  },
  {
    id: 'route-africa',
    distanceLabel: '5.12 km',
    color: '#34d399',
    points: [
      [1.292, 36.821],   // Nairobi
      [-1.286, 36.817],
      [-4.043, 39.668],  // Mombasa
    ],
  },
  {
    id: 'route-asia',
    distanceLabel: '1.73 km',
    color: '#c084fc',
    points: [
      [6.927, 79.861],   // Colombo
      [3.139, 101.686],  // KL
      [1.352, 103.819],  // Singapore
    ],
  },
];

// ─── CONSTANTS ─────────────────────────────────────────────────────
const EARTH_RADIUS = 0.6;
const SPHERE_SEGMENTS = 64;

// Rotation physics
const IDLE_SPEED_DEG_PER_SEC = 0.35;         // ~0.35°/s eastward
const IDLE_SPEED = (IDLE_SPEED_DEG_PER_SEC * Math.PI) / 180;
const DRAG_SENSITIVITY = 0.005;              // rad per pixel
const PITCH_CLAMP = (60 * Math.PI) / 180;    // ±60° vertical limit
const DAMPING = 0.92;                        // per-frame at 60fps baseline
const VELOCITY_THRESHOLD = 0.00003;          // stop threshold
const IDLE_RESUME_DELAY = 4000;              // ms before idle resumes
const IDLE_EASE_DURATION = 1500;             // ms to ease into idle

// ─── HELPERS ───────────────────────────────────────────────────────
function latLonToVec3(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(r * Math.sin(phi) * Math.cos(theta)),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// ─── BADGE STATE ───────────────────────────────────────────────────
interface BadgeState {
  id: string;
  label: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
}

// ─── COMPONENT ─────────────────────────────────────────────────────
export function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [badges, setBadges] = useState<BadgeState[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);
  const badgesRef = useRef<BadgeState[]>([]);

  const flushBadges = useCallback(() => {
    setBadges([...badgesRef.current]);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // ─── RENDERER (transparent background!) ──────────────────────
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);        // fully transparent
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ─── SCENE & CAMERA ──────────────────────────────────────────
    const scene = new THREE.Scene();
    // No scene background — transparent canvas matches CSS gradient

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 1.76);

    // ─── GLOBE GROUP ─────────────────────────────────────────────
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Initial rotation — Europe/Africa/Middle East facing camera
    // Y rotation controls longitude, X controls tilt
    let globeYaw = -2.3;     // initial longitude rotation (show Africa/Europe)
    let globePitch = 0.18;   // slight axial tilt
    globeGroup.rotation.order = 'YXZ';
    globeGroup.rotation.y = globeYaw;
    globeGroup.rotation.x = globePitch;

    // ─── TEXTURES ────────────────────────────────────────────────
    const loader = new THREE.TextureLoader();
    const earthMapTex = loader.load('/texture/earthmap.jpeg');
    earthMapTex.colorSpace = THREE.SRGBColorSpace;
    const earthBumpTex = loader.load('/texture/earthbump.jpeg');
    const earthCloudTex = loader.load('/texture/earthCloud.png');
    earthCloudTex.colorSpace = THREE.SRGBColorSpace;

    // ─── 1. EARTH SPHERE ─────────────────────────────────────────
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthMapTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.012,
      specular: new THREE.Color(0x111822),
      shininess: 18,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // ─── 2. CLOUD LAYER (very subtle) ────────────────────────────
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
    const cloudMat = new THREE.MeshPhongMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    globeGroup.add(cloudMesh);

    // ─── 3. THIN NATURAL ATMOSPHERE (Fresnel rim — NOT a ring) ───
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

        // Very thin — pow 5.0 makes it only visible near silhouette
        float intensity = pow(rim, 5.0) * 1.2;

        // Stronger on sun-facing side, very faint on dark side
        float sunFacing = max(0.0, dot(vWorldNormal, sunDirection));
        intensity *= (0.15 + 1.8 * sunFacing);

        // Natural blue/cyan atmospheric color
        vec3 color = mix(vec3(0.2, 0.4, 0.8), vec3(0.5, 0.75, 1.0), sunFacing);

        gl_FragColor = vec4(color, intensity * 0.55);
      }
    `;

    const sunDir = new THREE.Vector3(4, 3, 5).normalize();

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, SPHERE_SEGMENTS, SPHERE_SEGMENTS);
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

    // ─── 4. SUBTLE GROUNDING GLOW ────────────────────────────────
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 256;
    glowCanvas.height = 256;
    const gctx = glowCanvas.getContext('2d');
    if (gctx) {
      const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(25, 60, 130, 0.22)');
      grad.addColorStop(0.4, 'rgba(15, 35, 80, 0.10)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 256, 256);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowGeo = new THREE.PlaneGeometry(2.2, 0.8);
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.set(0, -EARTH_RADIUS - 0.08, 0);
    scene.add(glowMesh);

    // ─── 5. LIGHTING ─────────────────────────────────────────────
    // Ambient — fills dark side subtly
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    // Main sun — warm white from upper-right
    const sun = new THREE.DirectionalLight(0xfff8ee, 2.6);
    sun.position.copy(sunDir.clone().multiplyScalar(10));
    scene.add(sun);

    // Warm rim light — subtle golden highlight on upper-right edge
    const warmRim = new THREE.DirectionalLight(0xffcc88, 0.4);
    warmRim.position.set(3, 4, 2);
    scene.add(warmRim);

    // Cool fill — very subtle blue from the opposite side
    const coolFill = new THREE.DirectionalLight(0x3366aa, 0.15);
    coolFill.position.set(-4, -1, -3);
    scene.add(coolFill);

    // ─── 6. ROUTE OVERLAYS ───────────────────────────────────────
    const routeMidpoints: { id: string; label: string; color: string; vec: THREE.Vector3 }[] = [];

    DEMO_ROUTES.forEach((route) => {
      const pts = route.points.map(([lat, lon]) =>
        latLonToVec3(lat, lon, EARTH_RADIUS * 1.006),
      );

      // Thin route line
      const curve = new THREE.CatmullRomCurve3(pts);
      const curvePoints = curve.getPoints(48);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(route.color),
        transparent: true,
        opacity: 0.9,
      });
      globeGroup.add(new THREE.Line(lineGeo, lineMat));

      // Tiny coordinate ring markers
      pts.forEach((vec) => {
        // Outer ring
        const ringGeo = new THREE.RingGeometry(0.006, 0.009, 16);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(route.color),
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(vec);
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        globeGroup.add(ring);

        // Center dot
        const dotGeo = new THREE.SphereGeometry(0.004, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(route.color),
        });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(vec);
        globeGroup.add(dot);
      });

      // Badge midpoint
      const midVec = pts[Math.floor(pts.length / 2)].clone().multiplyScalar(1.06);
      routeMidpoints.push({
        id: route.id,
        label: route.distanceLabel,
        color: route.color,
        vec: midVec,
      });
    });

    // ─── 7. ROTATION STATE MACHINE ───────────────────────────────
    // States: IDLE | DRAGGING | INERTIA | REST | RETURNING_TO_IDLE
    type GlobeState = 'IDLE' | 'DRAGGING' | 'INERTIA' | 'REST' | 'RETURNING_TO_IDLE';
    let state: GlobeState = 'IDLE';

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

      // Kill any previous velocity
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

      // Immediate rotation
      globeYaw += dx * DRAG_SENSITIVITY;
      globePitch += dy * DRAG_SENSITIVITY;
      globePitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, globePitch));

      // Track velocity (pixels/ms → rad/frame equivalent)
      velocityYaw = (dx * DRAG_SENSITIVITY) / (dt / 16.67);
      velocityPitch = (dy * DRAG_SENSITIVITY) / (dt / 16.67);

      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      lastPointerTime = now;
    };

    const onPointerUp = () => {
      if (state !== 'DRAGGING') return;

      // Clamp release velocity to prevent crazy spin
      const maxVel = 0.04;
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

    // ─── 8. ANIMATION LOOP (delta-time based) ────────────────────
    let frameId: number;
    let frameCount = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (disposed) return;

      const now = performance.now();
      const rawDt = now - prevFrameTime;
      prevFrameTime = now;

      // Clamp delta to avoid huge jumps (tab switch, etc.)
      const dt = Math.min(rawDt, 100);
      // Normalized frame factor (1.0 at 60fps)
      const frameFactor = dt / 16.667;

      frameCount++;

      // ── STATE MACHINE ────────────────────────────────────────
      switch (state) {
        case 'IDLE': {
          // Slow consistent eastward rotation
          globeYaw += IDLE_SPEED * frameFactor;
          break;
        }

        case 'DRAGGING': {
          // Rotation applied directly in pointer handler
          break;
        }

        case 'INERTIA': {
          // Apply frame-rate-independent damping
          const dampPower = Math.pow(DAMPING, frameFactor);
          velocityYaw *= dampPower;
          velocityPitch *= dampPower;

          globeYaw += velocityYaw * frameFactor;
          globePitch += velocityPitch * frameFactor;
          globePitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, globePitch));

          // Check if effectively stopped
          if (Math.abs(velocityYaw) < VELOCITY_THRESHOLD && Math.abs(velocityPitch) < VELOCITY_THRESHOLD) {
            velocityYaw = 0;
            velocityPitch = 0;
            state = 'REST';
            restStartTime = now;
          }
          break;
        }

        case 'REST': {
          // Wait for idle resume delay
          if (now - restStartTime > IDLE_RESUME_DELAY) {
            state = 'RETURNING_TO_IDLE';
            idleEaseStart = now;
          }
          break;
        }

        case 'RETURNING_TO_IDLE': {
          // Ease into idle rotation over IDLE_EASE_DURATION ms
          const elapsed = now - idleEaseStart;
          const t = Math.min(elapsed / IDLE_EASE_DURATION, 1);
          // Smooth ease-in-out
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
      cloudMesh.rotation.y += 0.00008 * frameFactor;

      // Render
      renderer.render(scene, camera);

      // ── PROJECT BADGES (every 2nd frame) ─────────────────────
      if (frameCount % 2 === 0 && routeMidpoints.length > 0) {
        const w = container.clientWidth;
        const h = container.clientHeight;
        const newBadges: BadgeState[] = [];

        routeMidpoints.forEach((rm) => {
          const worldPos = rm.vec.clone().applyMatrix4(globeGroup.matrixWorld);
          const camDir = camera.position.clone().sub(worldPos).normalize();
          const normal = worldPos.clone().normalize();
          const dot = normal.dot(camDir);

          if (dot > 0.18) {
            const projected = worldPos.clone().project(camera);
            newBadges.push({
              id: rm.id,
              label: rm.label,
              color: rm.color,
              x: ((projected.x + 1) * w) / 2,
              y: ((-projected.y + 1) * h) / 2,
              visible: true,
            });
          } else {
            newBadges.push({ id: rm.id, label: rm.label, color: rm.color, x: 0, y: 0, visible: false });
          }
        });

        badgesRef.current = newBadges;
        flushBadges();
      }
    };

    animate();

    // ─── RESIZE ──────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
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
  }, [flushBadges]);

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
    >
      {/* Floating distance badges */}
      {badges.map((b) =>
        b.visible ? (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              transform: 'translate(-50%, -100%) translateY(-10px)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                background: 'rgba(8, 15, 30, 0.82)',
                backdropFilter: 'blur(6px)',
                color: '#e2e8f0',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                padding: '3px 8px',
                borderRadius: '12px',
                border: `1px solid ${b.color}44`,
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: b.color,
                  display: 'inline-block',
                  boxShadow: `0 0 4px ${b.color}`,
                }}
              />
              {b.label}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}
