import Link from "next/link";
import { MdAdd } from "react-icons/md";

/** The header dropped its New event button, so creating one lives here. */
export function NewEventFab() {
  return (
    <Link
      href="/dashboard/events/new"
      aria-label="New event"
      title="New event"
      className="fixed right-5 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 grid h-14 w-14 place-items-center rounded-full bg-claret text-chalk shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:shadow-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <MdAdd aria-hidden className="text-3xl" />
    </Link>
  );
}
