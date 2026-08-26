import { useCallback, useLayoutEffect, useRef } from "react";

export default function AutoResizeTextarea({
  className = "",
  minHeight = 92,
  onChange,
  value,
  ...props
}) {
  const textareaRef = useRef(null);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.max(textarea.scrollHeight + 2, minHeight)}px`;
  }, [minHeight]);

  useLayoutEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize, value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      className={`auto-resize-textarea ${className}`.trim()}
      value={value}
      onChange={(event) => {
        onChange?.(event);
        window.requestAnimationFrame(resize);
      }}
    />
  );
}
