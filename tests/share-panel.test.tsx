import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SharePanel } from "@/components/dashboard/SharePanel";
import { findTheme } from "@/lib/appearance";
import { codeColours, qrSvg } from "@/lib/qr";

const LINK = "https://shotandshare.com/e/aVeryLongTokenValue123456";
const CODE = qrSvg(LINK, codeColours(findTheme("cheese").palette));

function render(over: { codeSvg?: string | null; revoked?: boolean } = {}) {
  return renderToStaticMarkup(
    <SharePanel
      eventId="11111111-2222-3333-4444-555555555555"
      link={LINK}
      codeSvg={CODE}
      revoked={false}
      opens={0}
      uploaders={0}
      {...over}
    />,
  );
}

const CODE_MARK = 'aria-label="QR code for this event"';

describe("the code on the share panel", () => {
  it("is in the page itself, not behind a second request", () => {
    const html = render();
    expect(html).toContain(CODE_MARK);
    expect(html).not.toContain("/qr");
  });

  it("shows nothing in the box when every link has been turned off", () => {
    const html = render({ revoked: true, codeSvg: null });
    expect(html).not.toContain(CODE_MARK);
    expect(html).toContain("no active link");
  });
});
