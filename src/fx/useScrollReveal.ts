// Скролл-эффекты на GSAP ScrollTrigger. gsap грузится лениво (динамический
// import) — в чанк игрового стола не попадает. Уважает prefers-reduced-motion.
import { useEffect } from 'react';
import type { RefObject } from 'react';

const REDUCED = '(prefers-reduced-motion: reduce)';

interface RevealOptions {
  /** CSS-селектор элементов внутри контейнера. */
  selector?: string;
  /** Появление с блюром (каскад лобби). */
  blur?: boolean;
}

/**
 * Элементы с data-reveal въезжают с 3D-наклоном (rotateX) и stagger,
 * когда доезжают до 88% вьюпорта. Скролл назад не прячет их обратно (once).
 */
export function useScrollReveal(
  ref: RefObject<HTMLElement | null>,
  { selector = '[data-reveal]', blur = false }: RevealOptions = {},
): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia(REDUCED).matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (items.length === 0) return;

    // Прячем синхронно до загрузки gsap-чанка, чтобы не было вспышки контента.
    for (const el of items) el.style.opacity = '0';
    const showAll = () => {
      for (const el of items) el.style.opacity = '';
    };

    let killed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import('gsap'),
          import('gsap/ScrollTrigger'),
        ]);
        if (killed) return;
        gsap.registerPlugin(ScrollTrigger);

        gsap.set(items, {
          opacity: 0,
          y: 26,
          rotateX: -10,
          transformPerspective: 700,
          ...(blur ? { filter: 'blur(8px)' } : {}),
        });

        const triggers = ScrollTrigger.batch(items, {
          start: 'top 88%',
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              rotateX: 0,
              ...(blur ? { filter: 'blur(0px)' } : {}),
              duration: 0.7,
              stagger: 0.09,
              ease: 'power3.out',
              overwrite: true,
            });
          },
        });
        ScrollTrigger.refresh();

        cleanup = () => {
          for (const t of triggers) t.kill();
          gsap.set(items, { clearProps: 'all' });
        };
      } catch {
        showAll(); // gsap не загрузился — контент просто виден
      }
    })();

    return () => {
      killed = true;
      if (cleanup) cleanup();
      else showAll();
    };
    // Контейнер экрана монтируется один раз — зависимостей нет намеренно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Scrub-параллакс: элементы с data-parallax="N" смещаются на N% своей высоты,
 * пока контейнер проезжает вьюпорт. Скролл назад отматывает движение.
 */
export function useScrubParallax(
  ref: RefObject<HTMLElement | null>,
  selector = '[data-parallax]',
): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia(REDUCED).matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (items.length === 0) return;

    let killed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      if (killed) return;
      gsap.registerPlugin(ScrollTrigger);

      const tweens = items.map((el) =>
        gsap.to(el, {
          yPercent: Number(el.dataset.parallax ?? 20),
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.5,
          },
        }),
      );

      cleanup = () => {
        for (const t of tweens) {
          t.scrollTrigger?.kill();
          t.kill();
        }
      };
    })();

    return () => {
      killed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
