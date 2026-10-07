/**
 * A drawn stand-in for the code, not a scannable one. The real QR is generated
 * per event; a live code in a marketing page would point a room of wedding
 * guests at a demo event. Same pattern as the contact sheet's, as one path.
 */
export function QrGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-1 -1 24 24"
      className={className}
      shapeRendering="crispEdges"
      aria-hidden
    >
      <rect x="-1" y="-1" width="24" height="24" fill="#FFFFFF" />
      <path fill="#181214" d="M0 0h7v1h-7zM8 0h2v1h-2zM11 0h1v1h-1zM15 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM9 1h2v1h-2zM13 1h1v1h-1zM15 1h1v1h-1zM21 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h2v1h-2zM11 2h1v1h-1zM13 2h1v1h-1zM15 2h1v1h-1zM17 2h3v1h-3zM21 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM10 3h3v1h-3zM15 3h1v1h-1zM17 3h3v1h-3zM21 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h2v1h-2zM12 4h2v1h-2zM15 4h1v1h-1zM17 4h3v1h-3zM21 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM9 5h1v1h-1zM11 5h2v1h-2zM15 5h1v1h-1zM21 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h8v1h-8zM8 7h3v1h-3zM0 8h2v1h-2zM3 8h2v1h-2zM6 8h2v1h-2zM9 8h1v1h-1zM11 8h2v1h-2zM14 8h2v1h-2zM17 8h2v1h-2zM20 8h2v1h-2zM2 9h1v1h-1zM5 9h1v1h-1zM7 9h2v1h-2zM10 9h1v1h-1zM13 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM0 10h2v1h-2zM3 10h1v1h-1zM5 10h2v1h-2zM8 10h1v1h-1zM10 10h2v1h-2zM13 10h2v1h-2zM16 10h1v1h-1zM18 10h2v1h-2zM21 10h1v1h-1zM1 11h2v1h-2zM4 11h1v1h-1zM7 11h1v1h-1zM9 11h1v1h-1zM12 11h1v1h-1zM14 11h2v1h-2zM17 11h1v1h-1zM20 11h1v1h-1zM0 12h1v1h-1zM2 12h2v1h-2zM5 12h2v1h-2zM8 12h1v1h-1zM10 12h2v1h-2zM13 12h1v1h-1zM16 12h1v1h-1zM18 12h2v1h-2zM21 12h1v1h-1zM1 13h1v1h-1zM4 13h1v1h-1zM7 13h1v1h-1zM9 13h1v1h-1zM12 13h1v1h-1zM14 13h2v1h-2zM17 13h1v1h-1zM20 13h1v1h-1zM0 14h2v1h-2zM3 14h2v1h-2zM6 14h1v1h-1zM8 14h2v1h-2zM11 14h1v1h-1zM13 14h2v1h-2zM16 14h2v1h-2zM19 14h1v1h-1zM21 14h1v1h-1zM8 15h1v1h-1zM10 15h2v1h-2zM13 15h1v1h-1zM16 15h1v1h-1zM18 15h2v1h-2zM0 16h7v1h-7zM8 16h2v1h-2zM11 16h1v1h-1zM13 16h2v1h-2zM16 16h2v1h-2zM19 16h1v1h-1zM21 16h1v1h-1zM0 17h1v1h-1zM6 17h1v1h-1zM9 17h1v1h-1zM12 17h1v1h-1zM14 17h2v1h-2zM17 17h1v1h-1zM20 17h1v1h-1zM0 18h1v1h-1zM2 18h3v1h-3zM6 18h1v1h-1zM8 18h2v1h-2zM11 18h1v1h-1zM13 18h2v1h-2zM16 18h2v1h-2zM19 18h1v1h-1zM21 18h1v1h-1zM0 19h1v1h-1zM2 19h3v1h-3zM6 19h1v1h-1zM10 19h1v1h-1zM12 19h1v1h-1zM15 19h1v1h-1zM17 19h2v1h-2zM20 19h1v1h-1zM0 20h1v1h-1zM2 20h3v1h-3zM6 20h1v1h-1zM8 20h2v1h-2zM11 20h2v1h-2zM14 20h1v1h-1zM16 20h2v1h-2zM19 20h1v1h-1zM21 20h1v1h-1zM0 21h7v1h-7zM9 21h1v1h-1zM12 21h1v1h-1zM14 21h2v1h-2zM17 21h1v1h-1zM20 21h1v1h-1z" />
    </svg>
  );
}
