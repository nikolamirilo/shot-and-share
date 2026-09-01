"use client";

import { useEffect, useRef, useState } from "react";
import { MdOutlineLogout } from "react-icons/md";

import { Button, cx } from "@/components/ui";

/**
 * Who you are signed in as, folded into one circle. A face is recognisable at
 * 40px in a way a 40px-wide fragment of a name is not, and it costs the same
 * width on a phone as on a laptop.
 *
 * The panel is anchored to the badge rather than centred: it belongs to the
 * thing you clicked, so it needs no backdrop to explain itself.
 */
export function AccountMenu({
  name,
  email,
  avatarUrl,
  align = "right",
  showName = false,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /**
   * Which edge of the badge the panel grows from. Wherever the badge is the
   * last thing on its row the panel hangs off its right edge; put the badge at
   * the *start* of a row and a right-anchored panel begins 190px off the left
   * of the screen, so that instance has to ask for `left`.
   */
  align?: "left" | "right";
  /**
   * Show the name beside the face rather than the face alone. A circle with two
   * letters in it is recognisable but anonymous; where this is the only sign of
   * who is signed in, the name is worth the width.
   *
   * `"wide"` for the header bar, which is full at a phone's width and can drop
   * back to the face; `true` anywhere with room to spare, such as the panel.
   */
  showName?: boolean | "wide";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayName = name?.trim() || email || "Host";
  /* The name already is the address when there is no profile name; printing it
     twice reads as a rendering bug rather than as two facts. */
  const showEmail = Boolean(email) && email !== displayName;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      // Escape gives the focus back to what opened the panel, not to the page.
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="account-panel"
        aria-label={`Account: ${displayName}`}
        title={displayName}
        className={cx(
          /* `max-w-full` is load-bearing: a <button> sizes shrink-to-fit, so
             without it the badge stays as wide as the name and walks straight
             out of the header rather than letting the name ellipsise. */
          "flex min-w-0 max-w-full touch-manipulation items-center gap-2 rounded-full transition-transform duration-150",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
          open ? "translate-y-0" : "hover:-translate-y-0.5",
        )}
      >
        <Face
          name={displayName}
          avatarUrl={avatarUrl}
          size={40}
          className="shadow-md"
        />
        {/* `truncate` is what lets a long name give way instead of pushing the
            row off the screen. On the bar the name waits for `xs`, below which
            the face is the whole badge again and the name is one tap away. */}
        {showName && (
          <span
            className={cx(
              "min-w-0 truncate pr-1 text-[0.9375rem] font-semibold leading-tight",
              showName === "wide" ? "hidden xs:block" : "block",
            )}
          >
            {displayName}
          </span>
        )}
      </button>

      {open && (
        <div
          id="account-panel"
          role="dialog"
          aria-label="Account"
          /* Anchored to whichever edge of the badge has the room - see `align`.
             `max-w` as well as `w-64`, so the panel still fits a 320px screen
             once the badge's own offset is taken off. */
          className={cx(
            "card absolute top-[calc(100%+0.625rem)] z-50 w-64 max-w-[calc(100vw-2.5rem)] p-4 shadow-lg",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          <div className="flex items-center gap-3">
            <Face name={displayName} avatarUrl={avatarUrl} size={48} />
            <div className="min-w-0">
              <p className="truncate text-body font-extrabold leading-tight tracking-[-0.02em]">
                {displayName}
              </p>
              {showEmail && (
                <p className="mt-1 truncate font-mono text-micro lowercase tracking-[0.06em] text-mist">
                  {email}
                </p>
              )}
            </div>
          </div>

          <form action="/auth/signout" method="post" className="mt-4">
            <Button type="submit" size="sm" className="w-full">
              <MdOutlineLogout aria-hidden className="shrink-0 text-[1.25em]" />
              Sign out
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * The picture, or the two letters standing in for one.
 *
 * Not `next/image`: the avatar comes from whichever identity provider the host
 * signed in with, and a build cannot know that hostname in advance. It is one
 * 96px thumbnail on one page, so the optimiser has nothing to win here anyway.
 */
function Face({
  name,
  avatarUrl,
  size,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  size: number;
  className?: string;
}) {
  // Google's CDN returns 403 for a referrer it does not recognise, and a
  // deleted or rotated picture 404s at any time - either way the initials have
  // to be underneath, not instead.
  const [broken, setBroken] = useState(false);
  const show = avatarUrl && !broken;

  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center overflow-hidden rounded-full bg-claret text-chalk",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {show ? (
        <img
          src={avatarUrl}
          alt=""
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-display font-extrabold leading-none tracking-[-0.02em] text-ink"
          style={{ fontSize: size * 0.4 }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}

/** Two letters at most: three stop looking like a monogram and start looking like a word. */
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.slice(0, 2) || "?").toUpperCase();
}
