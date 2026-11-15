import React from 'react';

interface MimixMarkProps {
  size?: number;
  monochrome?: boolean;
  className?: string;
}

/**
 * Minimalist geometric MIMIX emblem: five precision equalizer bars sculpted into an "M".
 */
export const MimixMark: React.FC<MimixMarkProps> = ({
  size = 32,
  monochrome = false,
  className = '',
}) => {
  const gradId = React.useId();

  if (monochrome) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <circle cx="18" cy="18" r="16.5" fill="currentColor" fillOpacity="0.12" />
        <rect x="8" y="10" width="3.2" height="16" rx="1.6" fill="currentColor" />
        <rect x="12.6" y="13" width="3.2" height="10" rx="1.6" fill="currentColor" />
        <rect x="16.4" y="15.5" width="3.2" height="8" rx="1.6" fill="currentColor" />
        <rect x="20.2" y="13" width="3.2" height="10" rx="1.6" fill="currentColor" />
        <rect x="24.8" y="10" width="3.2" height="16" rx="1.6" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="6" y1="8" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF4D6D" />
          <stop offset="50%" stopColor="#FF7849" />
          <stop offset="100%" stopColor="#FBBF24" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="34" height="34" rx="10" fill="#13131A" />
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="9.5"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="1"
      />
      <rect x="7.5" y="9.5" width="3.3" height="17" rx="1.65" fill={`url(#${gradId})`} />
      <rect x="12.2" y="12.5" width="3.3" height="10.5" rx="1.65" fill={`url(#${gradId})`} />
      <rect x="16.35" y="15.5" width="3.3" height="7.5" rx="1.65" fill="#FFFFFF" />
      <rect x="20.5" y="12.5" width="3.3" height="10.5" rx="1.65" fill={`url(#${gradId})`} />
      <rect x="25.2" y="9.5" width="3.3" height="17" rx="1.65" fill={`url(#${gradId})`} />
    </svg>
  );
};

/**
 * Draws the monochrome MIMIX equalizer-M emblem onto an HTML5 Canvas (PNG & Video exports).
 */
export function drawMimixMarkOnCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
) {
  ctx.save();
  ctx.fillStyle = color;

  const s = radius / 16.5;
  const bars = [
    { x: -10, y: -8, w: 3.2, h: 16 },
    { x: -5.4, y: -5, w: 3.2, h: 10 },
    { x: -1.6, y: -2.5, w: 3.2, h: 8 },
    { x: 2.2, y: -5, w: 3.2, h: 10 },
    { x: 6.8, y: -8, w: 3.2, h: 16 },
  ];

  bars.forEach((b) => {
    ctx.beginPath();
    ctx.roundRect(cx + b.x * s, cy + b.y * s, b.w * s, b.h * s, (b.w * s) / 2);
    ctx.fill();
  });

  ctx.restore();
}
