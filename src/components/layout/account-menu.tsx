"use client";

import { useEffect, useRef, useState } from "react";

import { Button, cx } from "@/components/ui";

/**
 * Who you are signed in as, folded into one circle.
 *
 * The header had a truncated name that only appeared above 1024px and a "Sign
 * out" link that competed with "New event" for the same handful of pixels. A
 * face is recognisable at 40px in a way a 40px-wide fragment of a name is not,
 * and it costs the same width on a phone as on a laptop - so the identity is
 * finally visible everywhere, and the one action nobody performs twice a day
 * moves behind it.
 *
 * The panel is anchored to the badge rather than centred on the screen. It
 * belongs to the thing you clicked, and a card that flies out of the corner it
 * was summoned from does not need a backdrop to explain itself.
 */
export function AccountMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
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
    <div ref={wrapRef} className="relative">
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
          "block touch-manipulation rounded-full transition-transform duration-150",
          "focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink",
          open ? "translate-y-0" : "hover:-translate-y-0.5",
        )}
      >
        <Face
          name={displayName}
          avatarUrl={avatarUrl}
          size={40}
          className="shadow-md"
        />
      </button>

      {open && (
        <div
          id="account-panel"
          role="dialog"
          aria-label="Account"
          /* Right-anchored: the badge is the last thing in the header, so a
             panel that grew leftwards from its left edge would hang off the
             screen on a phone. */
          className="card absolute right-0 top-[calc(100%+0.625rem)] z-50 w-64 p-4 shadow-lg"
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
