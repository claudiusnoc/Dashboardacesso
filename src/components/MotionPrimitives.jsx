import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Save, TriangleAlert } from "lucide-react";

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function TiltSurface({
  as: Element = "div",
  children,
  className = "",
  disabled = false,
  max = 5,
  ...props
}) {
  const surfaceRef = useRef(null);

  function resetTilt() {
    const surface = surfaceRef.current;
    if (!surface) return;
    surface.style.setProperty("--tilt-x", "0deg");
    surface.style.setProperty("--tilt-y", "0deg");
    surface.style.setProperty("--tilt-glare-opacity", "0");
  }

  useEffect(() => {
    if (disabled) resetTilt();
  }, [disabled]);

  function handlePointerMove(event) {
    if (
      disabled ||
      event.pointerType === "touch" ||
      prefersReducedMotion() ||
      !window.matchMedia?.("(hover: hover)").matches
    ) {
      return;
    }

    const surface = surfaceRef.current;
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const horizontal = (event.clientX - bounds.left) / bounds.width;
    const vertical = (event.clientY - bounds.top) / bounds.height;
    const rotateY = (horizontal - 0.5) * max * 2;
    const rotateX = (0.5 - vertical) * max * 2;

    surface.style.setProperty("--tilt-x", `${rotateX.toFixed(2)}deg`);
    surface.style.setProperty("--tilt-y", `${rotateY.toFixed(2)}deg`);
    surface.style.setProperty("--tilt-glare-x", `${horizontal * 100}%`);
    surface.style.setProperty("--tilt-glare-y", `${vertical * 100}%`);
    surface.style.setProperty("--tilt-glare-opacity", "1");
  }

  return (
    <Element
      {...props}
      ref={surfaceRef}
      className={`motion-tilt ${className}`.trim()}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
    >
      {children}
      <span className="motion-tilt-glare" aria-hidden="true" />
    </Element>
  );
}

export function AnimatedNumber({ value, duration = 650, locale = "pt-BR" }) {
  const numericValue = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);
  const elementRef = useRef(null);

  useEffect(() => {
    const startValue = previousValueRef.current;
    previousValueRef.current = numericValue;

    if (prefersReducedMotion() || startValue === numericValue) {
      setDisplayValue(numericValue);
      return undefined;
    }

    let frameId;
    let startTime;
    let observer;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (numericValue - startValue) * easedProgress);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    const startAnimation = () => {
      frameId = window.requestAnimationFrame(animate);
    };

    if ("IntersectionObserver" in window && elementRef.current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          startAnimation();
        },
        { threshold: 0.2 },
      );
      observer.observe(elementRef.current);
    } else {
      startAnimation();
    }

    return () => {
      observer?.disconnect();
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, [duration, numericValue]);

  const formattedValue = new Intl.NumberFormat(locale, {
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
  }).format(displayValue);

  return (
    <span ref={elementRef} className="motion-number" aria-label={String(value)}>
      <span aria-hidden="true">{formattedValue}</span>
    </span>
  );
}

const ACTION_STATES = {
  idle: { icon: Save, label: "Registrar atualização" },
  loading: { icon: LoaderCircle, label: "Gravando histórico..." },
  success: { icon: Check, label: "Atualização registrada" },
  error: { icon: TriangleAlert, label: "Tentar novamente" },
};

export function StatefulActionButton({
  state = "idle",
  className = "",
  ...props
}) {
  const current = ACTION_STATES[state] || ACTION_STATES.idle;
  const Icon = current.icon;

  return (
    <button
      {...props}
      className={`stateful-action-button ${className}`.trim()}
      data-state={state}
      disabled={props.disabled || state === "loading"}
      aria-busy={state === "loading"}
    >
      <span className="stateful-action-scan" aria-hidden="true" />
      <span key={state} className="stateful-action-content" aria-live="polite">
        <Icon size={16} aria-hidden="true" />
        <span>{current.label}</span>
      </span>
    </button>
  );
}
