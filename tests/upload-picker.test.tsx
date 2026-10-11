import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Uploader } from "@/components/upload/Uploader";
import { HIDDEN_FILE_INPUT } from "@/constants/upload";
import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  acceptAttribute,
  isSafari,
} from "@/lib/media";

const IPHONE_18 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const CHROME_ON_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("what the file picker is asked for", () => {
  it("knows Safari from the browsers that borrow its name", () => {
    expect(isSafari(IPHONE_18)).toBe(true);
    expect(isSafari(IPAD)).toBe(true);
    expect(isSafari(CHROME)).toBe(false);
    expect(isSafari(ANDROID)).toBe(false);
    expect(isSafari(CHROME_ON_IOS)).toBe(false);
    expect(isSafari(undefined)).toBe(false);
  });

  it("gives Safari the two wildcards and nothing it cannot resolve", () => {
    const photo = acceptAttribute({ video: false, ua: IPHONE_18 });
    const all = acceptAttribute({ video: true, ua: IPHONE_18 });

    expect(photo).toBe("image/*");
    expect(all).toBe("image/*,video/*");

    for (const accept of [photo, all]) {
      expect(accept).not.toContain(".");
      expect(accept).not.toContain("heif");
      expect(accept).not.toContain("avif");
    }
  });

  it("keeps the long list for everything else", () => {
    expect(acceptAttribute({ video: false, ua: CHROME })).toBe(
      ACCEPT_ATTRIBUTE_PHOTO,
    );
    expect(acceptAttribute({ video: true, ua: ANDROID })).toBe(
      ACCEPT_ATTRIBUTE_ALL,
    );
    expect(acceptAttribute({ video: true })).toBe(ACCEPT_ATTRIBUTE_ALL);
  });
});

describe("the input the picker belongs to", () => {
  function markup() {
    return renderToStaticMarkup(
      <Uploader
        token="t"
        variant="split"
        allowVideo
        maxFileBytes={1024}

        remainingBytes={4096}
        onUploaded={() => {}}
      />,
    );
  }

  it("is a real element on the page, not a clipped one", () => {
    const html = markup();
    const inputs = html.match(/<input[^>]*type="file"[^>]*>/g) ?? [];

    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input).toContain(HIDDEN_FILE_INPUT);
      expect(input).not.toContain("sr-only");
      expect(input).not.toContain("display:none");
      expect(input).not.toMatch(/\shidden[\s=/>]/);
    }
  });

  it("keeps the camera and the library apart", () => {
    const html = markup();
    expect(html).toContain('id="guest-files"');
    expect(html).toContain('id="guest-camera"');
    expect(html.match(/capture="environment"/g)?.length).toBe(1);
    expect(html.match(/multiple/g)?.length).toBe(1);
  });
});

describe("opening the picker without script", () => {
  function markup(variant: "button" | "split" | "panel" | "bar") {
    return renderToStaticMarkup(
      <Uploader
        token="t"
        variant={variant}
        allowVideo
        maxFileBytes={1024}
        remainingBytes={4096}
        onUploaded={() => {}}
      />,
    );
  }

  it("points every upload button at its input with a label", () => {
    for (const variant of ["button", "split", "panel", "bar"] as const) {
      const html = markup(variant);
      expect(html).toContain('for="guest-files"');
    }
    expect(markup("split")).toContain('for="guest-camera"');
  });
});

describe("browsers that are not the browser", () => {
  const INSTAGRAM =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.19.109";

  it("still gives them Safari's accept list, since that is what they are", () => {
    expect(isSafari(INSTAGRAM)).toBe(true);
    expect(acceptAttribute({ video: true, ua: INSTAGRAM })).toBe(
      "image/*,video/*",
    );
  });
});
