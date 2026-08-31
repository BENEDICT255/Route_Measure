import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════
   Globe3D — ThreeJS Earth (from C:\Users\surface laptop\Downloads\MAP\threejs-earth)
   ═══════════════════════════════════════════════════════════════════
   • Exact Earth mesh with /texture/earthmap.jpeg & /texture/earthbump.jpeg
   • Cloud mesh with /texture/earthCloud.png
   • Galaxy background sphere with /texture/galaxy.png (THREE.BackSide)
   • AmbientLight + PointLight at (5, 3, 5)
   • Physics & momentum from threejs-earth main.js
   • Pointer event support (mouse & touch) + memory cleanup
   ═══════════════════════════════════════════════════════════════════ */

export function Globe3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const disposables: { dispose: () => void }[] = [];

    const width = container.clientWidth || window.innerWidth * 0.6;
    const height = container.clientHeight || window.innerHeight;

    // ─── 1. SCENE & RENDERER ─────────────────────────────────────
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // ─── 2. TEXTURE LOADER ───────────────────────────────────────
    const loader = new THREE.TextureLoader();

    const earthMapTex = loader.load('/texture/earthmap.jpeg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    disposables.push(earthMapTex);

    const earthBumpTex = loader.load('/texture/earthbump.jpeg');
    disposables.push(earthBumpTex);

    const earthCloudTex = loader.load('/texture/earthCloud.png', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    disposables.push(earthCloudTex);

    const galaxyTex = loader.load('/texture/galaxy.png', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    });
    disposables.push(galaxyTex);

    // ─── 3. EARTH MESH ───────────────────────────────────────────
    const earthGeometry = new THREE.SphereGeometry(0.5, 64, 64);
    disposables.push(earthGeometry);

    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthMapTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.01,
    });
    disposables.push(earthMaterial);

    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earthMesh);

    // Initial rotation: Americas centered
    earthMesh.rotation.y = 1.2;
    earthMesh.rotation.x = 0.15;

    // ─── 4. CLOUD MESH ───────────────────────────────────────────
    const cloudGeometry = new THREE.SphereGeometry(0.515, 64, 64);
    disposables.push(cloudGeometry);

    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: earthCloudTex,
      transparent: true,
      opacity: 0.8,
    });
    disposables.push(cloudMaterial);

    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloudMesh.rotation.y = 1.2;
    cloudMesh.rotation.x = 0.15;
    scene.add(cloudMesh);

    // ─── 5. GALAXY BACKGROUND SPHERE ────────────────────────────
    const starGeometry = new THREE.SphereGeometry(5, 64, 64);
    disposables.push(starGeometry);

    const starMaterial = new THREE.MeshBasicMaterial({
      map: galaxyTex,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.85,
    });
    disposables.push(starMaterial);

    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    scene.add(starMesh);

    // ─── 6. LIGHTING ─────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.4);
    pointLight.position.set(5, 3, 5);
    scene.add(pointLight);

    // ─── 7. CAMERA ───────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);

    const updateCameraPosition = () => {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      const minDim = Math.min(w, h);
      camera.aspect = w / h;
      camera.position.z = minDim < 600 ? 1.9 : 1.7;
      camera.updateProjectionMatrix();
    };
    updateCameraPosition();

    // ─── 8. ROTATION PHYSICS (from threejs-earth main.js) ─────────
    const BASE_IDLE_X = 0.0018;
    let targetRotationX = 0.03;
    let targetRotationY = 0.01;
    let isDragging = false;
    let mouseXOnMouseDown = 0;
    let mouseYOnMouseDown = 0;

    const slowingFactor = 0.96;
    const dragFactor = 0.00035;

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      setIsInteracting(true);
      const halfX = (container.clientWidth || width) / 2;
      const halfY = (container.clientHeight || height) / 2;
      mouseXOnMouseDown = event.clientX - halfX;
      mouseYOnMouseDown = event.clientY - halfY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDragging) return;
      const halfX = (container.clientWidth || width) / 2;
      const halfY = (container.clientHeight || height) / 2;
      const mouseX = event.clientX - halfX;
      const mouseY = event.clientY - halfY;
      targetRotationX = (mouseX - mouseXOnMouseDown) * dragFactor;
      targetRotationY = (mouseY - mouseYOnMouseDown) * dragFactor;
      mouseXOnMouseDown = mouseX;
      mouseYOnMouseDown = mouseY;
    };

    const onPointerUp = () => {
      isDragging = false;
      setIsInteracting(false);
    };

    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });

    // ─── 9. ANIMATION LOOP ───────────────────────────────────────
    let frameId: number;

    const render = () => {
      earthMesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), targetRotationX);
      earthMesh.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), targetRotationY);

      cloudMesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), targetRotationX * 1.05);
      cloudMesh.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), targetRotationY);

      targetRotationY = targetRotationY * slowingFactor;
      targetRotationX = isDragging
        ? targetRotationX
        : targetRotationX * slowingFactor + (1 - slowingFactor) * BASE_IDLE_X;

      renderer.render(scene, camera);
    };

    const animate = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(animate);
      render();
    };
    animate();

    // ─── 10. RESIZE & VISIBILITY ─────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      updateCameraPosition();
    };
    window.addEventListener('resize', onResize);

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
      } else {
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
