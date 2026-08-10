import { ImageResponse } from "next/og";

/**
 * The home-screen icon. Safari will not take an SVG here, so the mark is drawn
 * once at 180px and rendered to PNG at build time rather than a binary being
 * checked into `public/` and drifting from the logo it is meant to be.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const bracket = "M 26 76 L 26 34 Q 26 26 34 26 L 76 26";
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
          <g stroke="#181214" strokeWidth={18} strokeLinecap="square" fill="none">
            <path d={bracket} />
            <path d={bracket} transform="rotate(90 100 100)" />
            <path d={bracket} transform="rotate(180 100 100)" />
            <path d={bracket} transform="rotate(270 100 100)" />
          </g>
          <circle cx={100} cy={100} r={20} fill="#7A1230" />
        </svg>
      </div>
    ),
    size,
  );
}
