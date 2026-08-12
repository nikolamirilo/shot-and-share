import { ImageResponse } from "next/og";

import { MARK } from "@/components/layout/logo";

/**
 * The home-screen icon. Safari will not take an SVG here, so the mark is drawn
 * once at 180px and rendered to PNG at build time rather than a binary being
 * checked into `public/` and drifting from the logo it is meant to be.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F6F2F3",
        }}
      >
        <svg width={132} height={132} viewBox="0 0 200 200">
          <g stroke="#181214" strokeWidth={MARK.frameWidth} strokeLinecap="square" fill="none">
            <path d={MARK.bracket} />
            {MARK.corners.map((deg) => (
              <path key={deg} d={MARK.bracket} transform={`rotate(${deg} 100 100)`} />
            ))}
          </g>
          <g
            stroke="#7A1230"
            strokeWidth={MARK.trailWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {MARK.trail.map((d) => (
              <path key={d} d={d} />
            ))}
          </g>
          <rect
            x={MARK.print.x}
            y={MARK.print.y}
            width={MARK.print.size}
            height={MARK.print.size}
            rx={MARK.print.rx}
            fill="#7A1230"
            transform={MARK.print.tilt}
          />
        </svg>
      </div>
    ),
    size,
  );
}
