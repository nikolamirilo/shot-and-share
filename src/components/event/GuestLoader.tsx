import { LogoMark } from "@/components/layout/Logo";

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
