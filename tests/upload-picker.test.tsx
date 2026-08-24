import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Uploader } from "@/components/upload/uploader";
import { HIDDEN_FILE_INPUT } from "@/lib/client/picker";
import {
  ACCEPT_ATTRIBUTE_ALL,
  ACCEPT_ATTRIBUTE_PHOTO,
  acceptAttribute,
  isSafari,
} from "@/lib/media";

/**
 * The reported break: on a recent iPhone a guest opens the picker, selects
 * their photos, taps the button that confirms the selection - and nothing
 * happens. The same page on an older iOS works.
 *
 * Two halves to it, and both are checked here: what we ask the picker for, and
 * what the input the picker belongs to looks like.
 */

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
    // Both of these carry "Safari" in the string and neither is Safari.
    expect(isSafari(CHROME)).toBe(false);
    expect(isSafari(ANDROID)).toBe(false);
    expect(isSafari(CHROME_ON_IOS)).toBe(false);
    expect(isSafari(undefined)).toBe(false);
  });

  /**
   * The fix for the reported symptom.
   *
   * Recent iOS passes the accept list to the system photo picker, and an entry
   * it cannot resolve to a type - a bare extension, or a MIME type it has no
   * mapping for - leaves the sheet unable to confirm what was selected. Older
   * iOS ignored what it did not recognise, which is why the same list worked
   * there.
   */
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

  it("still offers video to Safari on a plan that has it", () => {
    // The wildcards are cut down, not cut out: a guest whose host pays for
    // video must still be able to pick a clip.
    expect(acceptAttribute({ video: true, ua: IPHONE_18 })).toContain("video/*");
    expect(acceptAttribute({ video: false, ua: IPHONE_18 })).not.toContain(
      "video",
    );
  });

  it("keeps the long list for everything else", () => {
    // Extensions are what a desktop file manager matches on, and dropping them
    // everywhere would grey out HEIC on Windows - the bug this list fixed.
    expect(acceptAttribute({ video: false, ua: CHROME })).toBe(
      ACCEPT_ATTRIBUTE_PHOTO,
    );
    expect(acceptAttribute({ video: true, ua: ANDROID })).toBe(
      ACCEPT_ATTRIBUTE_ALL,
    );
    // No user agent is the server rendering the page, before the browser has
    // said who it is.
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
        filesPerPick={20}
        remainingBytes={4096}
        onUploaded={() => {}}
      />,
    );
  }

  it("is a real element on the page, not a clipped one", () => {
    // `sr-only` clips the input to nothing and hides its overflow. A file input
    // with no box has been an unreliable thing to open from script on iOS for
    // several releases, and this is the other half of the reported break.
    const html = markup();
    const inputs = html.match(/<input[^>]*type="file"[^>]*>/g) ?? [];

    expect(inputs.length).toBe(2);
    for (const input of inputs) {
      expect(input).toContain(HIDDEN_FILE_INPUT);
      expect(input).not.toContain("sr-only");
      expect(input).not.toContain("display:none");
      // The attribute, not the aria one: `hidden` takes the input out of the
      // layout entirely, which is the thing being avoided.
      expect(input).not.toMatch(/\shidden[\s=/>]/);
    }
  });

  it("keeps the camera and the library apart", () => {
    // `capture` turns the picker into a viewfinder for every use of the input
    // it is on, so the library button needs an input without it.
    const html = markup();
    expect(html).toContain('id="guest-files"');
    expect(html).toContain('id="guest-camera"');
    expect(html.match(/capture="environment"/g)?.length).toBe(1);
    expect(html.match(/multiple/g)?.length).toBe(1);
  });
});
