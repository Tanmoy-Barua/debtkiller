import { useEffect, useState } from "react";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  return reduced;
}

export function useIsMobilePerf() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < 900 || navigator.hardwareConcurrency <= 4;
  });

  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < 900 || navigator.hardwareConcurrency <= 4);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return mobile;
}
