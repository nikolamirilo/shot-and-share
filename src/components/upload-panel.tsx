"use client";

import { useState } from "react";

import { Button, Hole, cx, inputClass } from "@/components/ui";
import type { UploadVariant } from "@/lib/appearance";

/**
 * The shape of the ask, with none of the machinery.
 *
 * The uploader owns compression, presigning, retries and progress; this owns
 * what a guest actually looks at. Splitting them is what lets the host's
 * preview render the real thing instead of a mock-up - the previous preview
 * drew its own coloured rectangles, which is why a change to the "Cards" colour
 * appeared to do nothing at all.
 *
 * Every variant keeps the same three parts: one obvious action, the line saying
 * what may be sent, and the optional name field. They differ in shape and in
 * how much of the screen they take, because that is the real choice a host is
 * making - a wedding wants the button impossible to miss, a conference wants
 * the gallery visible without scrolling.
 */

export interface UploadPanelProps {
  variant: UploadVariant;
  /** The primary action's label. Carries the progress text while busy. */
  label: string;
  /** What may be sent, and how much room is left. */
  hint: string;
  busy?: boolean;
  name: string;
  onNameChange?: (value: string) => void;
  onPick?: () => void;
  /** Only "Camera or library" offers the camera as its own button. */
  onCapture?: () => void;
  /** Files dropped onto the panel variant from a laptop. */
  onDropFiles?: (files: FileList) => void;
  /** Progress, the thank-you note, and errors. */
  children?: React.ReactNode;
  /**
   * Static rendering for the host's preview: smaller, and nothing here can be
   * clicked, focused or read out - it is a picture of the page, not the page.
   */
  preview?: boolean;
}

export function UploadPanel(props: UploadPanelProps) {
  const { variant, preview } = props;

  return (
    <section
      className={preview ? undefined : "mt-6 sm:mt-8"}
      aria-hidden={preview}
      inert={preview}
    >
      {variant === "panel" ? (
        <DropPanel {...props} />
      ) : variant === "bar" ? (
        <SlimBar {...props} />
      ) : variant === "split" ? (
        <SplitButtons {...props} />
      ) : (
        <BigButton {...props} />
      )}
    </section>
  );
}

/* --- the variants --------------------------------------------------------- */

/** One wide button on a card. The default, and the loudest. */
function BigButton({
  label,
  hint,
  busy,
  onPick,
  name,
  onNameChange,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-3" : "p-5 sm:p-6")}>
      <Action
        label={label}
        busy={busy}
        onClick={onPick}
        preview={preview}
        className={cx(
          "w-full",
          preview ? "py-2" : "min-h-16 py-4 text-[1.15rem] sm:py-5 sm:text-[1.3rem]",
        )}
      />
      <Hint text={hint} preview={preview} className="text-center" />
      <NameField
        name={name}
        onNameChange={onNameChange}
        preview={preview}
        className={preview ? "mt-3" : "mt-4 sm:mt-5"}
      />
      {children}
    </div>
  );
}

/**
 * A large dashed panel. The panel *is* the button, so the tap target is the
 * whole thing rather than a control inside it, and a laptop can drop files
 * anywhere on it.
 */
function DropPanel({
  label,
  hint,
  busy,
  onPick,
  onDropFiles,
  name,
  onNameChange,
  preview,
  children,
}: UploadPanelProps) {
  const [over, setOver] = useState(false);

  const inside = (
    <>
      <span className={cx("flex items-end justify-center", preview ? "gap-1.5" : "gap-3")}>
        <Hole size={preview ? 8 : 18} />
        <Hole size={preview ? 14 : 30} />
        <Hole size={preview ? 6 : 13} />
      </span>
      <span
        className={cx(
          "mt-3 block font-semibold leading-tight",
          preview ? "text-label" : "text-lead",
        )}
      >
        {label}
      </span>
      <span
        className={cx(
          "mt-1 block text-crust",
          preview ? "text-[0.625rem]" : "text-small",
        )}
      >
        {hint}
      </span>
    </>
  );

  // Sunken rather than dashed. The dashed rectangle was the convention for
  // "drop here", but the same thing is said by making the target a well the
  // page steps down into - and it says it without a line on a page that has
  // none. A drag over it fills with Gouda, which is the louder half of the cue
  // anyway.
  const shell = cx(
    "inset-shadow-well block w-full rounded-[1.25rem] text-center transition-colors",
    over ? "bg-gouda-light" : "bg-butter",
    preview ? "p-3" : "px-5 py-7 sm:p-8",
  );

  return (
    <div>
      {preview ? (
        <div className={shell}>{inside}</div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={onPick}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length > 0) onDropFiles?.(e.dataTransfer.files);
          }}
          className={cx(shell, "disabled:opacity-45")}
        >
          {inside}
        </button>
      )}
      <NameField
        name={name}
        onNameChange={onNameChange}
        preview={preview}
        className={preview ? "mt-3" : "mt-4"}
      />
      {children}
    </div>
  );
}

/** A compact row, so the gallery starts higher up the screen. */
function SlimBar({
  label,
  hint,
  busy,
  onPick,
  name,
  onNameChange,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-2.5" : "p-4")}>
      {/* Side by side leaves the name field about sixty pixels wide on a small
          phone. Below 480 the two stack; it is still far shorter than the
          panel variants, which is the whole point of this one. */}
      <div
        className={cx(
          preview
            ? "flex items-center gap-2"
            : "flex flex-col gap-2.5 xs:flex-row xs:items-center xs:gap-3",
        )}
      >
        <Action
          label={label}
          busy={busy}
          onClick={onPick}
          preview={preview}
          className={preview ? "shrink-0" : "w-full shrink-0 xs:w-auto"}
        />
        <NameField
          name={name}
          onNameChange={onNameChange}
          preview={preview}
          className="min-w-0 flex-1"
          inline
        />
      </div>
      <Hint text={hint} preview={preview} />
      {children}
    </div>
  );
}

/**
 * Two buttons. A guest holding a phone at the party wants the camera; a guest
 * on the sofa afterwards wants the camera roll. Asking is cheaper than guessing.
 */
function SplitButtons({
  label,
  hint,
  busy,
  onPick,
  onCapture,
  name,
  onNameChange,
  preview,
  children,
}: UploadPanelProps) {
  return (
    <div className={cx("card", preview ? "p-3" : "p-5 sm:p-6")}>
      {/* Half a phone's width does not hold "Choose photos" at 17px next to
          the large button's padding: both labels wrapped, and a two-line
          button beside a one-line one is the worst thing on the guest page.
          Below 480 they stack full width, which is a better shape for a thumb
          anyway; side by side returns as soon as there is room for it. */}
      <div
        className={cx(
          "grid",
          preview
            ? "grid-cols-2 gap-2"
            : "grid-cols-1 gap-2.5 xs:grid-cols-2 sm:gap-3",
        )}
      >
        <Action
          label={busy ? label : "Take a photo"}
          busy={busy}
          onClick={onCapture}
          preview={preview}
          className={preview ? "py-2" : "py-4"}
        />
        <Action
          label="Choose photos"
          busy={busy}
          onClick={onPick}
          preview={preview}
          variant="secondary"
          className={preview ? "py-2" : "py-4"}
        />
      </div>
      <Hint text={hint} preview={preview} className="text-center" />
      <NameField
        name={name}
        onNameChange={onNameChange}
        preview={preview}
        className={preview ? "mt-3" : "mt-4 sm:mt-5"}
      />
      {children}
    </div>
  );
}

/* --- the shared parts ----------------------------------------------------- */

function Action({
  label,
  busy,
  onClick,
  preview,
  variant = "primary",
  className,
}: {
  label: string;
  busy?: boolean;
  onClick?: () => void;
  preview?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  // A preview must not put a second "Add your photos" button in the host's tab
  // order, so it renders the same box without being one.
  if (preview) {
    return (
      <span
        className={cx(
          "inline-flex items-center justify-center rounded-xl px-3 text-label font-semibold",
          variant === "primary"
            ? "bg-pepper text-butter shadow-md"
            : "bg-cream text-pepper shadow-md",
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Button
      size="lg"
      variant={variant}
      disabled={busy}
      onClick={onClick}
      className={className}
    >
      {label}
    </Button>
  );
}

function Hint({
  text,
  preview,
  className,
}: {
  text: string;
  preview?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cx(
        "text-crust",
        preview ? "mt-2 text-[0.625rem] leading-snug" : "mt-3 text-small",
        className,
      )}
    >
      {text}
    </p>
  );
}

function NameField({
  name,
  onNameChange,
  preview,
  inline,
  className,
}: {
  name?: string;
  onNameChange?: (value: string) => void;
  preview?: boolean;
  /** Sitting beside the button rather than under it: no label above. */
  inline?: boolean;
  className?: string;
}) {
  const label = "Your name - optional";

  if (preview) {
    return (
      <div className={className}>
        {!inline && (
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-rind">
            {label}
          </p>
        )}
        <div
          className={cx(
            "inset-shadow-well rounded-lg bg-butter",
            inline ? "h-6" : "mt-1 h-6",
          )}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {!inline && (
        <label
          htmlFor="guest-name"
          className="block font-mono text-micro uppercase tracking-[0.16em] text-rind"
        >
          {label}
        </label>
      )}
      <input
        id="guest-name"
        value={name}
        onChange={(e) => onNameChange?.(e.target.value)}
        maxLength={60}
        aria-label={inline ? label : undefined}
        placeholder={inline ? "Your name - optional" : "So the host knows who to thank"}
        className={cx(inputClass, inline ? undefined : "mt-1.5")}
      />
    </div>
  );
}
