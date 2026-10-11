const STROKE = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 132"
      aria-hidden
      className="h-auto w-full max-w-[15rem]"
    >
      {children}
    </svg>
  );
}

export function CreateArt() {
  return (
    <Frame>
      <rect
        x="12"
        y="20"
        width="104"
        height="92"
        rx="10"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeOpacity="0.18"
        strokeWidth="2"
      />
      <rect x="26" y="36" width="52" height="7" rx="3.5" fill="var(--color-ink)" opacity="0.75" />
      <rect x="26" y="52" width="76" height="6" rx="3" fill="var(--color-ink)" opacity="0.14" />
      <rect x="26" y="66" width="60" height="6" rx="3" fill="var(--color-ink)" opacity="0.14" />
      <rect x="26" y="86" width="44" height="14" rx="7" fill="var(--color-claret)" />

      <g transform="translate(124 44)">
        <rect
          x="0"
          y="0"
          width="64"
          height="64"
          rx="10"
          fill="var(--color-paper)"
          stroke="var(--color-claret)"
          strokeWidth="2.5"
        />
        <g fill="var(--color-claret)">
          <rect x="10" y="10" width="16" height="16" rx="4" />
          <rect x="38" y="10" width="16" height="16" rx="4" />
          <rect x="10" y="38" width="16" height="16" rx="4" />
          <rect x="32" y="32" width="6" height="6" rx="2" />
          <rect x="44" y="34" width="6" height="6" rx="2" />
          <rect x="36" y="44" width="6" height="6" rx="2" />
          <rect x="48" y="48" width="6" height="6" rx="2" />
        </g>
      </g>
      <path
        d="M116 76h6"
        stroke="var(--color-claret)"
        strokeWidth="2.5"
        {...STROKE}
      />
    </Frame>
  );
}

export function TableArt() {
  return (
    <Frame>
      <path
        d="M14 104h172"
        stroke="var(--color-ink)"
        strokeOpacity="0.18"
        strokeWidth="2.5"
        {...STROKE}
      />

      <g transform="translate(30 22)">
        <rect
          x="0"
          y="0"
          width="62"
          height="82"
          rx="8"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeOpacity="0.2"
          strokeWidth="2"
        />
        <rect x="16" y="12" width="30" height="30" rx="6" fill="var(--color-claret)" />
        <rect x="14" y="52" width="34" height="5" rx="2.5" fill="var(--color-ink)" opacity="0.22" />
        <rect x="20" y="63" width="22" height="5" rx="2.5" fill="var(--color-ink)" opacity="0.14" />
      </g>

      <g stroke="var(--color-claret)" strokeWidth="2.5" {...STROKE}>
        <path d="M100 56a10 10 0 0 1 0-14" opacity="0.9" />
        <path d="M108 62a20 20 0 0 0 0-26" opacity="0.55" />
        <path d="M116 68a30 30 0 0 0 0-38" opacity="0.28" />
      </g>

      <g transform="translate(128 30)">
        <rect
          x="0"
          y="0"
          width="46"
          height="74"
          rx="9"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeOpacity="0.28"
          strokeWidth="2.5"
        />
        <rect x="17" y="6" width="12" height="3" rx="1.5" fill="var(--color-ink)" opacity="0.25" />
        <g stroke="var(--color-claret)" strokeWidth="2.5" {...STROKE}>
          <path d="M12 24v-6h6M34 24v-6h-6M12 50v6h6M34 50v6h-6" />
        </g>
      </g>
    </Frame>
  );
}

export function KeepArt() {
  return (
    <Frame>
      <g
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeOpacity="0.22"
        strokeWidth="2"
      >
        <rect x="-14" y="30" width="58" height="34" rx="5" transform="rotate(-12 15 47)" />
        <rect x="-18" y="72" width="58" height="34" rx="5" transform="rotate(10 13 89)" />
      </g>

      <rect
        x="40"
        y="26"
        width="84"
        height="82"
        rx="10"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <rect x="50" y="38" width="18" height="22" rx="3" fill="var(--color-claret)" />
      <g fill="var(--color-ink)" opacity="0.14">
        <rect x="73" y="38" width="18" height="22" rx="3" />
        <rect x="96" y="38" width="18" height="22" rx="3" />
        <rect x="50" y="65" width="18" height="22" rx="3" />
        <rect x="73" y="65" width="18" height="22" rx="3" />
        <rect x="96" y="65" width="18" height="22" rx="3" />
        <rect x="50" y="95" width="64" height="5" rx="2.5" />
      </g>

      <g stroke="var(--color-claret)" strokeWidth="2.5" {...STROKE}>
        <path d="M124 67h8M128 63l4 4-4 4" />
      </g>

      <rect
        x="142"
        y="42"
        width="42"
        height="50"
        rx="6"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeOpacity="0.28"
        strokeWidth="2"
      />
      <g fill="var(--color-ink)">
        <rect x="145" y="94" width="36" height="3.5" rx="1.75" opacity="0.2" />
        <rect x="148" y="99" width="30" height="3.5" rx="1.75" opacity="0.13" />
      </g>
      <rect x="138" y="62" width="50" height="11" rx="3.5" fill="var(--color-claret)" />
    </Frame>
  );
}
