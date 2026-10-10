import { LogoMark } from "@/components/layout/logo";

/**
 * What a guest sees between tapping the link and the page arriving.
 *
 * The page cannot draw anything until the database has answered: the token has
 * to be resolved, the event read, the tier looked up and the cover photograph
 * signed. On a venue's wifi that is a second or two in which the tap did
 * nothing at all - which reads as a dead QR code, at the one moment the
 * product has to look like it works.
 *
 * It is the mark and nothing else. A guest is waiting two seconds, not
 * watching something, so the whole screen is one object doing one thing:
 * breathing, with its own frame leaving it in echoes - a shutter going off
 * slowly. Deliberately not a skeleton of the page either, because four covers
 * are possible and we do not yet know which one this event picked.
 *
 * Linen rather than the well, even though a full-screen cover arrives dark: a
 * light screen going dark once is a photograph landing, where a dark screen
 * going light is a flash of the wrong page.
 */

/** Two echoes, half a cycle apart, so one is always leaving. */
const ECHOES = [{ delay: "0ms" }, { delay: "1200ms" }];

export function GuestLoader() {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-linen px-6"
      role="status"
      aria-busy="true"
      aria-label="Opening the event"
    >
      <div className="relative h-20 w-20">
        {/* Inset to the frame's own bounds rather than the box's: the mark is
            drawn on a 200 canvas and its brackets stop at 26. */}
        {ECHOES.map((echo) => (
          <span
            key={echo.delay}
            aria-hidden="true"
            className="mark-echo absolute inset-[13%] rounded-[22%] border-2 border-claret/40"
            style={{ animationDelay: echo.delay }}
          />
        ))}
        <LogoMark className="mark-breathe relative h-20 w-20" />
      </div>

      <p className="eyebrow text-mist">getting the photos ready</p>
    </div>
  );
}
