"use client";

import { useLayoutEffect, useRef } from "react";

export function GrowingTextarea({
  value,
  className,
  maxHeight = 320,
  ...props
}: React.ComponentProps<"textarea"> & { value: string; maxHeight?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.style.height = "0px";
    box.style.height = `${Math.min(box.scrollHeight + box.offsetHeight - box.clientHeight, maxHeight)}px`;
  }, [value, maxHeight]);
  return <textarea ref={ref} value={value} className={`resize-none ${className ?? ""}`} {...props} />;
}
