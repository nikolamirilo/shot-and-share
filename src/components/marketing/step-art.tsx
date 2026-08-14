/**
 * Three drawings of the three things a host does, so the copy underneath can
 * stop at one line.
 *
 * The parts that carry meaning - the code, the phone's beam, the arrow out -
 * are claret; everything holding them up is ink at low opacity.
 * `aria-hidden` throughout: the heading beside them already says what they say.
 */

const STROKE = {
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 132"
      role="img"
      aria-hidden
      className="h-auto w-full max-w-[15rem]"
    >
      {children}
    </svg>
  );
}

/** A form with a name and a date in it, and a code coming out of the other end. */
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

      {/* The code, arriving. It is the output of the form and it is the one
          claret object with any detail in it. */}
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

/** The printed card standing on a table, and a phone reading it. */
export function TableArt() {
  return (
    <Frame>
      {/* The table it stands on. */}
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

      {/* The beam. Three arcs is the sign every phone camera makes when it has
          found something, and it is the only motion in the drawing. */}
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
        {/* Scan corners on the screen, which is what a camera draws when it is
            about to read a code. */}
        <g stroke="var(--color-claret)" strokeWidth="2.5" {...STROKE}>
          <path d="M12 24v-6h6M34 24v-6h-6M12 50v6h6M34 50v6h-6" />
        </g>
      </g>
    </Frame>
  );
}

/** Photographs landing in one place, and one arrow out of it. */
export function KeepArt() {
  return (
    <Frame>
      {/* Three arriving, at three angles, because they come from three phones. */}
      <g opacity="0.4">
        <rect
          x="20"
          y="16"
          width="40"
          height="32"
          rx="5"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeOpacity="0.3"
          strokeWidth="2"
          transform="rotate(-12 40 32)"
        />
        <rect
          x="82"
          y="10"
          width="40"
          height="32"
          rx="5"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeOpacity="0.3"
          strokeWidth="2"
          transform="rotate(6 102 26)"
        />
        <rect
          x="142"
          y="18"
          width="40"
          height="32"
          rx="5"
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeOpacity="0.3"
          strokeWidth="2"
          transform="rotate(14 162 34)"
        />
      </g>

      {/* The one place they land. */}
      <rect
        x="26"
        y="54"
        width="148"
        height="52"
        rx="10"
        fill="var(--color-paper)"
        stroke="var(--color-ink)"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <g fill="var(--color-ink)" opacity="0.14">
        <rect x="38" y="64" width="34" height="24" rx="4" />
        <rect x="80" y="64" width="34" height="24" rx="4" />
        <rect x="122" y="64" width="34" height="24" rx="4" />
        <rect x="38" y="94" width="118" height="5" rx="2.5" />
      </g>

      {/* Out again, as one file, clear of the gallery's own edge - an arrow that
          starts inside the box it is leaving reads as a scratch on it. The only
          claret in the drawing, because taking them home is what the step is
          for. */}
      <g stroke="var(--color-claret)" strokeWidth="2.5" {...STROKE}>
        <path d="M100 112v14M93 119l7 7 7-7" />
      </g>
    </Frame>
  );
}
