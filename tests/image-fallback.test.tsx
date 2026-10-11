import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SRC = "https://cdn.example/owner/event/thumb/photo.webp";

async function loadStore() {
  vi.resetModules();
  return import("@/lib/client/image-optimizer");
}

async function markup(disabled: boolean) {
  vi.resetModules();
  if (disabled) {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION", "1");
  } else {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION", "");
  }
  const { Photo } = await import("@/components/ui/Photo");
  return renderToStaticMarkup(
    <Photo src={SRC} alt="" width={640} height={480} sizes="320px" />,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("photographs on the page", () => {
  it("go through the optimiser while the optimiser is answering", async () => {
    expect(await markup(false)).toContain("/_next/image");
  });

  it("come straight from the bucket once the switch is set", async () => {
    const html = await markup(true);
    expect(html).not.toContain("/_next/image");
    expect(html).toContain(`src="${SRC}"`);
    expect(html).not.toContain("srcset");
  });
});

describe("giving up on the optimiser", () => {
  let store: Awaited<ReturnType<typeof loadStore>>;

  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION", "");
    store = await loadStore();
  });

  it("does not happen because one photograph failed", () => {
    store.reportOptimiserFailure();
    store.reportOptimiserFailure();
    expect(store.isOptimiserOff()).toBe(false);
  });

  it("happens once enough of them have", () => {
    for (let i = 0; i < 3; i += 1) store.reportOptimiserFailure();
    expect(store.isOptimiserOff()).toBe(true);
  });

  it("tells the photographs already on the page", () => {
    const told = vi.fn();
    store.subscribeToOptimiser(told);
    for (let i = 0; i < 3; i += 1) store.reportOptimiserFailure();
    store.reportOptimiserFailure();
    expect(told).toHaveBeenCalledTimes(1);
  });

  it("starts given up on when the switch is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION", "1");
    const flipped = await loadStore();
    expect(flipped.isOptimiserOff()).toBe(true);
  });
});
