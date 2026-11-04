"use client";

import { useEffect } from "react";

/**
 * iOS Safari keeps the pre-zoom paint when the page is zoomed out: the visual
 * viewport widens, Safari expands the layout viewport to match, but part of the
 * page can keep rendering from the old layout. On a phone that shows up as a
 * narrow column of content with a blank strip on the right - the top of the
 * page "not fitting" while the bottom looks correct.
 *
 * Reading the new size and forcing a fresh composite after any visual viewport
 * change makes the whole document repaint at the current width, so the layout is
 * never left half-updated.
 */
export function ViewportGuard() {
  useEffect(() => {
    const vv = window.visualViewport;
    // Marker so QA can confirm the guard is mounted in the live build.
    document.documentElement.dataset.viewportGuard = "1";

    // Force an initial repaint after mount. iOS Safari can leave the page
    // half-painted at a stale scale when it first renders; repainting once
    // at the correct width clears any stale layer.
    const initialRepaint = window.setTimeout(() => {
      const root = document.documentElement;
      root.classList.add("viewport-repaint");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => root.classList.remove("viewport-repaint"));
      });
    }, 120);

    if (!vv) {
      return () => {
        window.clearTimeout(initialRepaint);
        delete document.documentElement.dataset.viewportGuard;
      };
    }

    let timer: number | undefined;
    let frame = 0;
    let lastWidth = vv.width;
    let lastScale = vv.scale;

    const repaint = () => {
      const root = document.documentElement;
      root.classList.add("viewport-repaint");
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => root.classList.remove("viewport-repaint"));
      });
    };

    const onChange = () => {
      const scaleChanged = Math.abs(vv.scale - lastScale) > 0.01;
      const widthChanged = Math.abs(vv.width - lastWidth) > 1;
      if (!scaleChanged && !widthChanged) return;

      lastScale = vv.scale;
      lastWidth = vv.width;

      // Flush the reflow for the new width before repainting.
      void document.documentElement.offsetWidth;

      window.clearTimeout(timer);
      timer = window.setTimeout(repaint, 140);
    };

    vv.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    window.addEventListener("resize", onChange);

    return () => {
      window.clearTimeout(initialRepaint);
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      vv.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
      window.removeEventListener("resize", onChange);
      document.documentElement.classList.remove("viewport-repaint");
      delete document.documentElement.dataset.viewportGuard;
    };
  }, []);

  return null;
}
