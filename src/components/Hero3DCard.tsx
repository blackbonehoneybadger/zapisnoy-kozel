// Парящие 3D-карты (Three.js) за заголовком главного экрана.
// Three грузится лениво динамическим import — в стартовый чанк не попадает.
// Текстура — текущая неон-рубашка /art/card-back.svg (медиа сохраняем).
// Без WebGL или при prefers-reduced-motion — статичный фоллбэк из <img>.
// Рендер-цикл останавливается, когда блок вне вьюпорта или вкладка скрыта.
import { useEffect, useRef, useState } from 'react';

type Mode = 'loading' | 'webgl' | 'fallback';

function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Hero3DCard({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>('loading');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !webglSupported()) {
      setMode('fallback');
      return;
    }

    let disposed = false;
    let stop: (() => void) | undefined;

    void (async () => {
      const THREE = await import('three');
      if (disposed || !hostRef.current) return;
      setMode('webgl');

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // DPR cap
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        35,
        host.clientWidth / Math.max(host.clientHeight, 1),
        0.1,
        50,
      );
      camera.position.z = 10;

      scene.add(new THREE.AmbientLight(0xffffff, 1.1));
      const key = new THREE.DirectionalLight(0xd8c7ff, 1.6);
      key.position.set(2, 3, 5);
      scene.add(key);
      const rim = new THREE.PointLight(0x19d68a, 6, 20);
      rim.position.set(-3, -2, 4);
      scene.add(rim);

      const tex = new THREE.TextureLoader().load('/art/card-back.svg');
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

      const edge = new THREE.MeshStandardMaterial({ color: 0x120827, roughness: 0.6 });
      const face = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.92,
      });
      const geo = new THREE.BoxGeometry(2.5, 3.5, 0.06);
      const mats = [edge, edge, edge, edge, face, face];

      const left = new THREE.Mesh(geo, mats);
      left.position.set(-2.7, 0.6, -1.6);
      left.rotation.z = 0.24;
      const right = new THREE.Mesh(geo, mats);
      right.position.set(2.7, -0.4, -2.2);
      right.rotation.z = -0.3;
      scene.add(left, right);

      // Цели наклона: указатель + скролл страницы.
      let px = 0;
      let py = 0;
      let tx = 0;
      let ty = 0;
      const onPointer = (e: PointerEvent) => {
        tx = (e.clientX / window.innerWidth) * 2 - 1;
        ty = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('pointermove', onPointer, { passive: true });

      let scrollRot = 0;
      const onScroll = () => {
        scrollRot = window.scrollY * 0.003;
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      const clock = new THREE.Clock();
      let elapsed = 0;
      const render = () => {
        elapsed += clock.getDelta();
        px += (tx - px) * 0.06;
        py += (ty - py) * 0.06;

        left.rotation.y = Math.sin(elapsed * 0.35) * 0.55 + px * 0.35 + scrollRot;
        left.rotation.x = Math.sin(elapsed * 0.28) * 0.16 + py * 0.22;
        left.position.y = 0.6 + Math.sin(elapsed * 0.8) * 0.16;

        right.rotation.y = Math.sin(elapsed * 0.3 + 2) * 0.55 - px * 0.3 - scrollRot;
        right.rotation.x = Math.sin(elapsed * 0.24 + 1) * 0.16 + py * 0.2;
        right.position.y = -0.4 + Math.sin(elapsed * 0.7 + 1.6) * 0.16;

        renderer.render(scene, camera);
      };

      // Крутим цикл только когда блок видим и вкладка активна.
      let inView = true;
      const applyLoop = () => {
        renderer.setAnimationLoop(inView && !document.hidden ? render : null);
      };
      const io = new IntersectionObserver((entries) => {
        inView = entries.some((e) => e.isIntersecting);
        applyLoop();
      });
      io.observe(host);
      const onVisibility = () => applyLoop();
      document.addEventListener('visibilitychange', onVisibility);
      applyLoop();

      const ro = new ResizeObserver(() => {
        const w = host.clientWidth;
        const h = Math.max(host.clientHeight, 1);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(host);

      stop = () => {
        renderer.setAnimationLoop(null);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('scroll', onScroll);
        geo.dispose();
        edge.dispose();
        face.dispose();
        tex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      disposed = true;
      stop?.();
    };
  }, []);

  return (
    <div ref={hostRef} aria-hidden className={`overflow-hidden ${className}`}>
      {mode === 'fallback' && (
        <>
          <img
            src="/art/card-back.svg"
            alt=""
            className="absolute left-[4%] top-[14%] w-16 rotate-[14deg] rounded-lg opacity-40"
          />
          <img
            src="/art/card-back.svg"
            alt=""
            className="absolute right-[4%] top-[42%] w-16 rotate-[-16deg] rounded-lg opacity-35"
          />
        </>
      )}
    </div>
  );
}
