"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  className?: string;
}

function Slider({
  value,
  defaultValue = [0],
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDual = (value ?? defaultValue).length === 2;

  const vals = value ?? defaultValue;
  const v0 = vals[0];
  const v1 = isDual ? vals[1] : v0;

  const toPct = (v: number) => ((v - min) / (max - min)) * 100;
  const fromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  // Single thumb mode
  if (!isDual) {
    const pct = toPct(v0);
    const handleChange = (clientX: number) => {
      onValueChange?.([fromClientX(clientX)]);
    };

    return (
      <div
        ref={trackRef}
        className={cn("relative w-full h-6 flex items-center cursor-pointer select-none touch-none", className)}
        onMouseDown={(e) => {
          handleChange(e.clientX);
          const onMove = (ev: MouseEvent) => handleChange(ev.clientX);
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
        onTouchStart={(e) => handleChange(e.touches[0].clientX)}
        onTouchMove={(e) => handleChange(e.touches[0].clientX)}
      >
        <div className="relative w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-[var(--brand-gold)] rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute w-4 h-4 rounded-full bg-white border-2 border-[var(--brand-gold)] shadow-sm -translate-x-1/2"
          style={{ left: `${pct}%` }}
        />
      </div>
    );
  }

  // Dual thumb (range) mode
  const pct0 = toPct(v0);
  const pct1 = toPct(v1);
  const activeThumbRef = useRef<0 | 1>(0);

  const handleDualChange = (clientX: number) => {
    const newVal = fromClientX(clientX);
    const thumb = activeThumbRef.current;
    const updated = [v0, v1] as [number, number];

    if (thumb === 0) {
      updated[0] = Math.min(newVal, updated[1]);
    } else {
      updated[1] = Math.max(newVal, updated[0]);
    }
    onValueChange?.(updated);
  };

  const startDrag = (clientX: number) => {
    // Determine which thumb is closer
    const newVal = fromClientX(clientX);
    const dist0 = Math.abs(newVal - v0);
    const dist1 = Math.abs(newVal - v1);
    activeThumbRef.current = dist0 <= dist1 ? 0 : 1;
    handleDualChange(clientX);
  };

  return (
    <div
      ref={trackRef}
      className={cn("relative w-full h-6 flex items-center cursor-pointer select-none touch-none", className)}
      onMouseDown={(e) => {
        startDrag(e.clientX);
        const onMove = (ev: MouseEvent) => handleDualChange(ev.clientX);
        const onUp = () => {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      }}
      onTouchStart={(e) => startDrag(e.touches[0].clientX)}
      onTouchMove={(e) => handleDualChange(e.touches[0].clientX)}
    >
      {/* Track background */}
      <div className="relative w-full h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
        {/* Active range */}
        <div
          className="absolute h-full bg-[var(--brand-gold)] rounded-full"
          style={{ left: `${pct0}%`, width: `${pct1 - pct0}%` }}
        />
      </div>
      {/* Thumb 0 (left) */}
      <div
        className="absolute w-4 h-4 rounded-full bg-white border-2 border-[var(--brand-gold)] shadow-sm -translate-x-1/2 z-10"
        style={{ left: `${pct0}%` }}
      />
      {/* Thumb 1 (right) */}
      <div
        className="absolute w-4 h-4 rounded-full bg-white border-2 border-[var(--brand-gold)] shadow-sm -translate-x-1/2 z-10"
        style={{ left: `${pct1}%` }}
      />
    </div>
  );
}

export { Slider };
