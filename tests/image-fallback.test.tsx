import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What happens to a gallery when the image optimiser stops answering.
 *
 * Vercel meters transformations - one photograph at one width is one - and
 * past the plan's monthly ceiling `/_next/image` returns an error instead of a
 * picture. On a photo app that is not a slower page: it is every frame on the
 * wall broken at once, on a link a host has already handed round a wedding.
 *
 * So there are two ways out, and this covers both:
 *
 *  - the switch, set before the quota runs out, which serves every photograph
 *    straight from the bucket;
 *  - the catch, for when it runs out anyway: photographs that fail retry
 *    themselves unoptimised, and once a few have had to, the page stops asking
 *    the optimiser for anything at all.
 */

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
  const { Photo } = await import("@/components/ui/photo");
  return renderToStaticMarkup(
    <Photo src={SRC} alt="" width={640} height={480} sizes="320px" />,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("photographs on the page", () => {
  it("go through the optimiser while the optimiser is answering", async () => {
    // The normal path, unchanged: the wrapper is not a bare <img> in disguise.
    expect(await markup(false)).toContain("/_next/image");
  });

  it("come straight from the bucket once the switch is set", async () => {
    const html = await markup(true);
    expect(html).not.toContain("/_next/image");
    expect(html).toContain(`src="${SRC}"`);
    // No srcSet either: an unresized file has exactly one width.
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
    // One failure is one photograph's own business - an object deleted from
    // the bucket, a signature that expired while the tab sat in a pocket. That
    // one falls back on its own; the other forty-nine keep their resizes.
    store.reportOptimiserFailure();
    store.reportOptimiserFailure();
    expect(store.isOptimiserOff()).toBe(false);
  });

  it("happens once enough of them have", () => {
    // Three is not bad luck, it is the service. Everything still to load is
    // asked for raw rather than fetched twice.
    for (let i = 0; i < 3; i += 1) store.reportOptimiserFailure();
    expect(store.isOptimiserOff()).toBe(true);
  });

  it("tells the photographs already on the page", () => {
    const told = vi.fn();
    store.subscribeToOptimiser(told);
    for (let i = 0; i < 3; i += 1) store.reportOptimiserFailure();
    // Once, on the change - not once per failure, and not again afterwards.
    store.reportOptimiserFailure();
    expect(told).toHaveBeenCalledTimes(1);
  });

  it("starts given up on when the switch is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_IMAGE_OPTIMIZATION", "1");
    const flipped = await loadStore();
    expect(flipped.isOptimiserOff()).toBe(true);
  });
});
