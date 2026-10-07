/*
 * Shot & Share - Lottie compositions, authored as code.
 *
 * Every shape is taken from the brand's own drawings (components/layout/logo.tsx
 * and components/marketing/step-art.tsx) so the animations are those drawings
 * moving, not new illustrations. Output is plain Bodymovin JSON (v5.7), playable
 * by lottie-web, lottie-react, dotlottie or the LottieFiles editor.
 *
 * Regenerate with: node scripts/build-lottie.js
 */
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2] || path.join(__dirname, "..", "src", "components", "marketing", "lottie");
const FR = 60;

const HEX = {
  ink: "#181214",
  claret: "#7A1230",
  paper: "#FFFFFF",
  linen: "#F6F2F3",
  rose: "#C25A72",
  roseSoft: "#E6B9C4",
  pine: "#2E4A45",
  chalk: "#FDF6F7",
};
const rgba = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(4)).concat(1);
};

/* ---- easing: [outX, outY, inX, inY] ----------------------------------- */
const EASE = {
  inOut: [0.42, 0, 0.58, 1],
  out: [0.22, 1, 0.36, 1],
  in: [0.55, 0, 0.9, 0.45],
  back: [0.22, 1.35, 0.36, 1],
  soft: [0.33, 0, 0.2, 1],
  linear: [0, 0, 1, 1],
};

const isProp = (v) => v && typeof v === "object" && !Array.isArray(v) && "a" in v;
const S = (v) => (isProp(v) ? v : { a: 0, k: v });

/** Keyframes: [[frame, value, ease]]; the ease shapes the segment leaving that key. */
function A(keys) {
  return {
    a: 1,
    k: keys.map(([t, v, ease = "inOut"], idx) => {
      const s = Array.isArray(v) ? v : [v];
      const kf = { t, s };
      if (idx < keys.length - 1) {
        if (ease === "hold") {
          kf.h = 1;
        } else {
          const [ox, oy, ix, iy] = typeof ease === "string" ? EASE[ease] : ease;
          const n = s.length;
          kf.o = { x: Array(n).fill(ox), y: Array(n).fill(oy) };
          kf.i = { x: Array(n).fill(ix), y: Array(n).fill(iy) };
        }
      }
      return kf;
    }),
  };
}

/* ---- shape items ------------------------------------------------------ */
const rc = (w, h, r = 0, p = [0, 0]) => ({ ty: "rc", d: 1, s: S([w, h]), p: S(p), r: S(r), nm: "Rect" });
const el = (w, h, p = [0, 0]) => ({ ty: "el", d: 1, s: S([w, h]), p: S(p), nm: "Ellipse" });
function sh(v, { i, o, c = false } = {}) {
  return {
    ty: "sh",
    d: 1,
    ks: S({ i: i || v.map(() => [0, 0]), o: o || v.map(() => [0, 0]), v, c }),
    nm: "Path",
  };
}
const fl = (color, o = 100) => ({
  ty: "fl",
  c: isProp(color) ? color : S(rgba(color)),
  o: S(o),
  r: 1,
  bm: 0,
  nm: "Fill",
});
const st = (color, w, { o = 100, lc = 2, lj = 2 } = {}) => ({
  ty: "st",
  c: S(rgba(color)),
  o: S(o),
  w: S(w),
  lc,
  lj,
  ml: 4,
  bm: 0,
  nm: "Stroke",
});
const tm = (s = 0, e = 100, o = 0) => ({ ty: "tm", s: S(s), e: S(e), o: S(o), m: 1, nm: "Trim" });
const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: "tr",
  p: S(p),
  a: S(a),
  s: S(s),
  r: S(r),
  o: S(o),
  sk: S(0),
  sa: S(0),
  nm: "Transform",
});
const gr = (nm, items, t = {}) => ({ ty: "gr", nm, it: [...items, tr(t)], np: items.length, cix: 2, bm: 0 });

/* A rect drawn at SVG coordinates (x, y, w, h). */
const rectAt = (x, y, w, h, r = 0) => rc(w, h, r, [x + w / 2, y + h / 2]);

/* ---- layers ------------------------------------------------------------ */
function layer(nm, shapes, { ind, op, p = [0, 0, 0], a = [0, 0, 0], s = [100, 100, 100], r = 0, o = 100 }) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm,
    sr: 1,
    ks: { o: S(o), r: S(r), p: S(p), a: S(a), s: S(s) },
    ao: 0,
    shapes,
    ip: 0,
    op,
    st: 0,
    bm: 0,
  };
}

function comp(nm, w, h, op, layers) {
  // First layer in the list is drawn on top.
  return {
    v: "5.7.4",
    fr: FR,
    ip: 0,
    op,
    w,
    h,
    nm,
    ddd: 0,
    assets: [],
    layers: layers.map((L, i) => ({ ...L, ind: i + 1, op })),
    markers: [],
  };
}

/* A rounded corner bracket: the same object as the logo's, at any size. */
function bracketPath(x0, y0, arm, radius) {
  // From the end of the vertical arm, up to the corner, and along the top.
  const k = radius * (2 / 3);
  return sh(
    [
      [x0, y0 + arm],
      [x0, y0 + radius],
      [x0 + radius, y0],
      [x0 + arm, y0],
    ],
    {
      i: [[0, 0], [0, 0], [-k, 0], [0, 0]],
      o: [[0, 0], [0, -k], [0, 0], [0, 0]],
    },
  );
}

/* A circular arc as one cubic, angles in degrees, screen coordinates. */
function arcPath(cx, cy, r, a0, a1) {
  const rad = (d) => (d * Math.PI) / 180;
  const t0 = rad(a0);
  const t1 = rad(a1);
  const k = (4 / 3) * Math.tan((t1 - t0) / 4) * r;
  const p0 = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)];
  const p1 = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
  const round = (v) => v.map((n) => +n.toFixed(3));
  return sh([round(p0), round(p1)], {
    o: [round([-Math.sin(t0) * k, Math.cos(t0) * k]), [0, 0]],
    i: [[0, 0], round([Math.sin(t1) * k, -Math.cos(t1) * k])],
  });
}

/* ======================================================================== */
/* 1. The mark: brackets close in, the print leaves the frame.              */
/* ======================================================================== */
function mark({ bracket = HEX.ink, dot = HEX.claret, nm = "Shot & Share mark" } = {}) {
  const OP = 96;
  const corners = [0, 90, 180, 270];

  const brackets = corners.map((deg, idx) => {
    const t0 = idx * 3;
    const inner = gr(
      "Bracket arm",
      [
        sh(
          [
            [26, 76],
            [26, 34],
            [34, 26],
            [76, 26],
          ],
          {
            i: [[0, 0], [0, 0], [-5.333, 0], [0, 0]],
            o: [[0, 0], [0, -5.333], [0, 0], [0, 0]],
          },
        ),
        st(bracket, 18, { lc: 3, lj: 1 }),
      ],
      {
        p: A([
          [t0, [-26, -26], "back"],
          [t0 + 22, [0, 0]],
        ]),
        o: A([
          [t0, 0, "out"],
          [t0 + 10, 100],
        ]),
      },
    );
    return gr(`Bracket ${deg}`, [inner], { a: [100, 100], p: [100, 100], r: deg });
  });

  const trails = [
    { d: [[58, 82], [82, 82]], t: 38 },
    { d: [[46, 101], [82, 101]], t: 33 },
    { d: [[58, 120], [82, 120]], t: 41 },
  ].map(({ d, t }, i) =>
    gr(`Trail ${i + 1}`, [
      sh(d),
      tm(A([[t, 100, "out"], [t + 22, 0]]), 100),
      st(dot, 11, { lc: 2, lj: 2 }),
    ]),
  );

  const print = gr("Print", [rc(46, 46, 10, [117, 101]), fl(dot)], {
    a: [117, 101],
    p: A([
      [16, [100, 101], "hold"],
      [32, [100, 101], "soft"],
      [56, [117, 101]],
    ]),
    s: A([
      [14, [0, 0], "back"],
      [32, [100, 100]],
    ]),
    r: A([
      [32, 0, "soft"],
      [56, -12],
    ]),
  });

  return comp(nm, 200, 200, OP, [
    layer("Print", [print], {}),
    layer("Trails", trails, {}),
    layer("Frame", brackets, {}),
  ]);
}

/* ======================================================================== */
/* 2. Scan: a phone camera finding the code on the table card.             */
/*    Transparent overlay, drawn over the QR itself.                        */
/* ======================================================================== */
function scan() {
  const OP = 180;
  const corners = [0, 90, 180, 270];
  const brackets = corners.map((deg) =>
    gr(`Scan corner ${deg}`, [
      gr(
        "Arm",
        [bracketPath(10, 10, 44, 12), st(HEX.claret, 9, { lc: 2, lj: 2 })],
        {
          p: A([
            [0, [-16, -16], "back"],
            [22, [0, 0], "hold"],
            [62, [0, 0], "in"],
            [70, [6, 6], "out"],
            [82, [0, 0], "hold"],
            [148, [0, 0], "in"],
            [170, [-16, -16], "hold"],
            [180, [-16, -16]],
          ]),
          o: A([
            [0, 0, "out"],
            [12, 100, "hold"],
            [150, 100, "in"],
            [168, 0, "hold"],
            [180, 0],
          ]),
        },
      ),
    ], { a: [100, 100], p: [100, 100], r: deg }),
  );

  const sweep = gr(
    "Scan line",
    [
      gr("Core", [rc(150, 4, 2, [0, 0]), fl(HEX.claret, 85)]),
      gr("Glow", [rc(150, 26, 13, [0, -11]), fl(HEX.claret, 14)]),
    ],
    {
      p: A([
        [20, [100, 34], "inOut"],
        [58, [100, 166], "hold"],
        [180, [100, 166]],
      ]),
      o: A([
        [18, 0, "out"],
        [26, 100, "hold"],
        [52, 100, "in"],
        [62, 0, "hold"],
        [180, 0],
      ]),
    },
  );

  // "Found": the whole viewfinder breathes once, then a pine tick lands.
  const tick = gr(
    "Found",
    [
      gr("Tick", [sh([[-9, 0], [-3, 6], [9, -6]]), st(HEX.chalk, 5, { lc: 2, lj: 2 })]),
      gr("Disc", [el(38, 38), fl(HEX.pine)]),
    ],
    {
      p: [100, 100],
      s: A([
        [70, [0, 0], "back"],
        [86, [100, 100], "hold"],
        [132, [100, 100], "in"],
        [146, [0, 0], "hold"],
        [180, [0, 0]],
      ]),
    },
  );

  return comp("Scan the table card", 200, 200, OP, [
    layer("Found", [tick], {}),
    layer("Sweep", [sweep], {}),
    layer("Viewfinder", brackets, {}),
  ]);
}

/* ======================================================================== */
/* 3. Step one: a form fills in and a code comes out of the other end.     */
/* ======================================================================== */
function create() {
  const OP = 240;
  const grow = (nm, x, y, w, h, r, color, opacity, t0, t1, tOut) =>
    gr(nm, [rectAt(x, y, w, h, r), fl(color, opacity)], {
      a: [x, y + h / 2],
      p: [x, y + h / 2],
      s: A([
        [t0, [0, 100], "out"],
        [t1, [100, 100], "hold"],
        [tOut, [100, 100], "in"],
        [tOut + 16, [0, 100], "hold"],
        [OP, [0, 100]],
      ]),
    });

  const form = [
    grow("Title", 26, 36, 52, 7, 3.5, HEX.ink, 75, 8, 30, 196),
    grow("Field 1", 26, 52, 76, 6, 3, HEX.ink, 14, 22, 42, 198),
    grow("Field 2", 26, 66, 60, 6, 3, HEX.ink, 14, 30, 50, 200),
    gr("Button", [rectAt(26, 86, 44, 14, 7), fl(HEX.claret)], {
      a: [48, 93],
      p: [48, 93],
      s: A([
        [56, [100, 100], "in"],
        [62, [90, 90], "out"],
        [76, [100, 100]],
      ]),
    }),
    gr("Card", [rectAt(12, 20, 104, 92, 10), st(HEX.ink, 2, { o: 18 }), fl(HEX.paper)]),
  ];

  const connector = gr("Connector", [
    sh([[116, 76], [123, 76]]),
    tm(0, A([[66, 0, "out"], [80, 100, "hold"], [196, 100, "in"], [210, 0, "hold"], [OP, 0]])),
    st(HEX.claret, 2.5),
  ]);

  const pop = (nm, x, y, w, h, r, t) =>
    gr(nm, [rectAt(x, y, w, h, r), fl(HEX.claret)], {
      a: [x + w / 2, y + h / 2],
      p: [x + w / 2, y + h / 2],
      s: A([
        [t, [0, 0], "back"],
        [t + 14, [100, 100]],
      ]),
    });
  const ox = 124;
  const oy = 44;
  const modules = [
    pop("Finder 1", ox + 10, oy + 10, 16, 16, 4, 88),
    pop("Finder 2", ox + 38, oy + 10, 16, 16, 4, 92),
    pop("Finder 3", ox + 10, oy + 38, 16, 16, 4, 96),
    pop("Dot 1", ox + 32, oy + 32, 6, 6, 2, 104),
    pop("Dot 2", ox + 44, oy + 34, 6, 6, 2, 107),
    pop("Dot 3", ox + 36, oy + 44, 6, 6, 2, 110),
    pop("Dot 4", ox + 48, oy + 48, 6, 6, 2, 113),
  ];
  const code = gr(
    "Code",
    [...modules, gr("Code card", [rectAt(ox, oy, 64, 64, 10), st(HEX.claret, 2.5), fl(HEX.paper)])],
    {
      a: [156, 76],
      p: [156, 76],
      s: A([
        [76, [0, 0], "back"],
        [96, [100, 100], "hold"],
        [196, [100, 100], "in"],
        [214, [0, 0], "hold"],
        [OP, [0, 0]],
      ]),
    },
  );

  return comp("Step 1 - make the link", 200, 132, OP, [
    layer("Code", [code], {}),
    layer("Connector", [connector], {}),
    layer("Form", form, {}),
  ]);
}

/* ======================================================================== */
/* 4. Step two: the card on the table, a phone reading it.                 */
/* ======================================================================== */
function table() {
  const OP = 240;

  const tableLine = gr("Table", [sh([[14, 104], [186, 104]]), st(HEX.ink, 2.5, { o: 18 })]);

  const card = gr("Card", [
    gr("Code", [rectAt(46, 34, 30, 30, 6), fl(HEX.claret)], {
      a: [61, 49],
      p: [61, 49],
      s: A([
        [108, [100, 100], "out"],
        [116, [112, 112], "in"],
        [128, [100, 100]],
      ]),
    }),
    gr("Line 1", [rectAt(44, 74, 34, 5, 2.5), fl(HEX.ink, 22)]),
    gr("Line 2", [rectAt(50, 85, 22, 5, 2.5), fl(HEX.ink, 14)]),
    gr("Card body", [rectAt(30, 22, 62, 82, 8), st(HEX.ink, 2, { o: 20 }), fl(HEX.paper)]),
  ]);

  // Concentric waves leaving the code towards the phone, twice per loop.
  const wave = (r, t) =>
    A([
      [t, 0, "out"],
      [t + 10, 100, "in"],
      [t + 24, 0, "hold"],
      [t + 40, 0, "out"],
      [t + 50, 100, "in"],
      [t + 64, 0, "hold"],
      [OP, 0],
    ]);
  const arcs = [14, 26, 38].map((r, i) =>
    gr(`Wave ${i + 1}`, [arcPath(86, 49, r, -40, 40), st(HEX.claret, 2.5)], { o: wave(r, 34 + i * 6) }),
  );

  const px = 128;
  const py = 30;
  const corners = gr(
    "Scan corners",
    [
      sh([[px + 12, py + 24], [px + 12, py + 18], [px + 18, py + 18]]),
      sh([[px + 34, py + 24], [px + 34, py + 18], [px + 28, py + 18]]),
      sh([[px + 12, py + 50], [px + 12, py + 56], [px + 18, py + 56]]),
      sh([[px + 34, py + 50], [px + 34, py + 56], [px + 28, py + 56]]),
      st(HEX.claret, 2.5),
    ],
    {
      a: [151, 67],
      p: [151, 67],
      s: A([
        [22, [140, 140], "back"],
        [36, [100, 100], "hold"],
        [116, [100, 100], "in"],
        [126, [70, 70], "hold"],
        [OP, [70, 70]],
      ]),
      o: A([
        [22, 0, "out"],
        [30, 100, "hold"],
        [116, 100, "in"],
        [124, 0, "hold"],
        [OP, 0],
      ]),
    },
  );
  const check = gr(
    "Sent",
    [
      gr("Tick", [sh([[-4.5, 0], [-1.5, 3], [4.5, -3]]), st(HEX.chalk, 2.4)]),
      gr("Disc", [el(17, 17), fl(HEX.pine)]),
    ],
    {
      p: [151, 67],
      s: A([
        [120, [0, 0], "back"],
        [134, [100, 100], "hold"],
        [176, [100, 100], "in"],
        [188, [0, 0], "hold"],
        [OP, [0, 0]],
      ]),
    },
  );
  const phone = gr("Phone", [
    check,
    corners,
    gr("Speaker", [rectAt(px + 17, py + 6, 12, 3, 1.5), fl(HEX.ink, 25)]),
    gr("Body", [rectAt(px, py, 46, 74, 9), st(HEX.ink, 2.5, { o: 28 }), fl(HEX.paper)]),
  ]);

  // Two prints leave the phone: the photos, sent.
  const sent = [0, 1].map((n) => {
    const t = 134 + n * 10;
    return gr(
      `Print ${n + 1}`,
      [
        gr("Trail", [sh([[-15, 0], [-7, 0]]), st(HEX.claret, 2.2)], {}),
        gr("Shape", [rc(11, 11, 2.5, [0, 0]), fl(HEX.claret)], { r: -12 }),
      ],
      {
        p: A([
          [t, [158, 60], "soft"],
          [t + 30, [194 - n * 6, 22 + n * 12], "hold"],
          [OP, [194 - n * 6, 22 + n * 12]],
        ]),
        r: -34,
        s: A([
          [t, [40, 40], "out"],
          [t + 12, [100, 100]],
        ]),
        o: A([
          [t, 0, "out"],
          [t + 6, 100, "hold"],
          [t + 18, 100, "in"],
          [t + 30, 0, "hold"],
          [OP, 0],
        ]),
      },
    );
  });

  return comp("Step 2 - put it on the tables", 200, 132, OP, [
    layer("Sent", sent, {}),
    layer("Phone", [phone], {
      a: [151, 104, 0],
      p: A([
        [0, [151, 134, 0], "out"],
        [28, [151, 104, 0], "hold"],
        [196, [151, 104, 0], "in"],
        [222, [151, 134, 0], "hold"],
        [OP, [151, 134, 0]],
      ]),
      r: A([
        [0, 9, "out"],
        [28, 0, "hold"],
        [196, 0, "in"],
        [222, 9, "hold"],
        [OP, 9],
      ]),
      o: A([
        [0, 0, "out"],
        [14, 100, "hold"],
        [206, 100, "in"],
        [222, 0, "hold"],
        [OP, 0],
      ]),
    }),
    layer("Waves", arcs, {}),
    layer("Card", [card], {}),
    layer("Table", [tableLine], {}),
  ]);
}

/* ======================================================================== */
/* 5. Step three: the gallery fills, the night leaves as one bundle.       */
/* ======================================================================== */
function keep() {
  const OP = 240;
  const tiles = [
    [50, 38],
    [73, 38],
    [96, 38],
    [50, 65],
    [73, 65],
    [96, 65],
  ];
  // Newest first, like the real gallery: they arrive bottom-right to top-left,
  // and the last to land - top-left - stays claret, the frame still warm.
  const order = [5, 4, 3, 2, 1, 0];
  const at = (k) => 18 + order.indexOf(k) * 12;

  const tileGroups = tiles.map(([x, y], k) => {
    const t = at(k);
    const nextT = k === 0 ? null : t + 12;
    const warm = gr("Warm", [rectAt(x, y, 18, 22, 3), fl(HEX.claret)], {
      o: nextT === null
        ? A([[t, 100, "hold"], [196, 100, "in"], [212, 0, "hold"], [OP, 0]])
        : A([[t, 100, "hold"], [nextT, 100, "inOut"], [nextT + 10, 0, "hold"], [OP, 0]]),
    });
    const cool = gr("Cool", [rectAt(x, y, 18, 22, 3), fl(HEX.ink, 14)]);
    return gr(`Tile ${k + 1}`, [warm, cool], {
      a: [x + 9, y + 11],
      p: [x + 9, y + 11],
      s: A([
        [t, [0, 0], "back"],
        [t + 14, [100, 100], "hold"],
        [196 + (5 - k) * 2, [100, 100], "in"],
        [212 + (5 - k) * 2, [0, 0], "hold"],
        [OP, [0, 0]],
      ]),
    });
  });

  const caption = gr("Caption", [rectAt(50, 95, 64, 5, 2.5), fl(HEX.ink, 14)], {
    a: [50, 97.5],
    p: [50, 97.5],
    s: A([
      [86, [0, 100], "out"],
      [102, [100, 100], "hold"],
      [196, [100, 100], "in"],
      [212, [0, 100], "hold"],
      [OP, [0, 100]],
    ]),
  });

  const gallery = gr("Gallery", [...tileGroups, caption, gr("Frame", [rectAt(40, 26, 84, 82, 10), st(HEX.ink, 2, { o: 20 }), fl(HEX.paper)])]);

  const prints = gr("Arriving", [
    gr("Print A", [rc(58, 34, 5, [15, 47]), st(HEX.ink, 2, { o: 22 }), fl(HEX.paper)], { a: [15, 47], p: [15, 47], r: -12 }),
    gr("Print B", [rc(58, 34, 5, [11, 89]), st(HEX.ink, 2, { o: 22 }), fl(HEX.paper)], { a: [11, 89], p: [11, 89], r: 10 }),
  ]);

  const arrow = gr("Out", [
    sh([[124, 67], [132, 67]]),
    sh([[128, 63], [132, 67], [128, 71]]),
    tm(0, A([[96, 0, "out"], [112, 100, "hold"], [196, 100, "in"], [208, 0, "hold"], [OP, 0]])),
    st(HEX.claret, 2.5),
  ]);

  const bundle = gr(
    "Bundle",
    [
      gr("Band", [rectAt(138, 62, 50, 11, 3.5), fl(HEX.claret)], {
        p: A([
          [120, [26, 0], "out"],
          [138, [0, 0]],
        ]),
        o: A([
          [120, 0, "out"],
          [128, 100],
        ]),
      }),
      gr("Stack", [
        gr("Edge 1", [rectAt(145, 94, 36, 3.5, 1.75), fl(HEX.ink, 20)]),
        gr("Edge 2", [rectAt(148, 99, 30, 3.5, 1.75), fl(HEX.ink, 13)]),
        gr("Top print", [rectAt(142, 42, 42, 50, 6), st(HEX.ink, 2, { o: 28 }), fl(HEX.paper)]),
      ]),
    ],
    {
      a: [163, 72],
      p: [163, 72],
      s: A([
        [106, [0, 0], "back"],
        [124, [100, 100], "hold"],
        [198, [100, 100], "in"],
        [214, [0, 0], "hold"],
        [OP, [0, 0]],
      ]),
    },
  );

  return comp("Step 3 - take them home", 200, 132, OP, [
    layer("Bundle", [bundle], {}),
    layer("Arrow", [arrow], {}),
    layer("Gallery", [gallery], {}),
    layer("Arriving", [prints], {}),
  ]);
}

/* ------------------------------------------------------------------------ */
const all = {
  mark: mark(),
  markOnClaret: mark({ bracket: HEX.chalk, dot: HEX.roseSoft, nm: "Shot & Share mark (on claret)" }),
  scan: scan(),
  create: create(),
  table: table(),
  keep: keep(),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, data] of Object.entries(all)) {
  const json = JSON.stringify(data);
  fs.writeFileSync(path.join(OUT, `${name}.json`), json);
  console.log(name.padEnd(14), `${(json.length / 1024).toFixed(1)} KB`, `${data.op} frames`);
}
