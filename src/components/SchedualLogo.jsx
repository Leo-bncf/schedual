import React from 'react';

/**
 * Schedual brand logo — SVG icon + wordmark.
 * Props:
 *   size: 'sm' (28px icon, nav bar) | 'md' (36px) | 'lg' (56px, hero / email)
 *   wordmark: true (default) | false (icon only)
 *   dark: false (default — dark text on light bg) | true (white text on dark bg)
 */
export default function SchedualLogo({ size = 'md', wordmark = true, dark = false }) {
  const dims = {
    sm: { icon: 28, r: 6,  gap: 8,  font: 15, dots: 5, pad: 5 },
    md: { icon: 36, r: 8,  gap: 10, font: 19, dots: 6, pad: 6 },
    lg: { icon: 56, r: 12, gap: 14, font: 30, dots: 9, pad: 9 },
  }[size] || { icon: 36, r: 8, gap: 10, font: 19, dots: 6, pad: 6 };

  const { icon, r, gap, font, dots, pad } = dims;

  // 3×3 grid of rounded squares — row 1 fully opaque, rows 2-3 lighter
  const cols = [0, 1, 2];
  const rows = [0, 1, 2];
  const cell = (icon - pad * 2) / 3;
  const dotSize = cell * 0.62;
  const spacing = cell * 0.38 / 2;

  const opacities = [1, 0.55, 0.35]; // row opacity

  return (
    <div className="flex items-center" style={{ gap }}>
      {/* Icon */}
      <svg width={icon} height={icon} viewBox={`0 0 ${icon} ${icon}`} fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background pill */}
        <rect width={icon} height={icon} rx={r} fill="#2D3FA6" />
        {/* 3×3 dot grid */}
        {rows.map(row =>
          cols.map(col => {
            const x = pad + col * cell + spacing;
            const y = pad + row * cell + spacing;
            return (
              <rect
                key={`${row}-${col}`}
                x={x}
                y={y}
                width={dotSize}
                height={dotSize}
                rx={dotSize * 0.22}
                fill="white"
                opacity={opacities[row]}
              />
            );
          })
        )}
      </svg>

      {/* Wordmark */}
      {wordmark && (
        <span
          style={{
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: font,
            fontWeight: 600,
            color: dark ? '#ffffff' : '#172554',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          Schedual
        </span>
      )}
    </div>
  );
}