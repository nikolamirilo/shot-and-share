"use client";

import { useEffect, useRef, useState } from "react";
import { MdOutlineLogout } from "react-icons/md";

import { Button, cx } from "@/components/ui";

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
  align?: "left" | "right";
  showName?: boolean | "wide";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const displayName = name?.trim() || email || "Host";
  const showEmail = Boolean(email) && email !== displayName;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
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
          /*
           * `max-w-full` is load-bearing: a <button> sizes shrink-to-fit, so without it
           * the badge stays as wide as the name instead of letting it ellipsise.
           */
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

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.slice(0, 2) || "?").toUpperCase();
}
