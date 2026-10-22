import { Lightbulb } from "lucide-react";
import { Disclosure } from "@/components/ui/Disclosure";

/* How to get two screenshots that line up — most false positives come from captures that don't match. */
export function CaptureTips() {
  return (
    <Disclosure title="How to get matching screenshots" icon={Lightbulb}>
      <div className="grid gap-6 text-p3 text-dusk-800 md:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">From Figma</p>
          <p className="mt-1">Select the frame, then Export → PNG at 1x. Or right-click → Copy as PNG and paste it straight into the upload box.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">From the website</p>
          <p className="mt-1">
            Open the page at the frame&apos;s width (for example 1440). In Chrome DevTools, use the device toolbar to set the size, then ⋮ → Capture
            full size screenshot.
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">Before you capture</p>
          <p className="mt-1">
            Close cookie banners, pause carousels and animations, and scroll to the top. Live data such as dates will show up as differences. Long
            full-page captures are fine — up to 64 megapixels, for example 1440 × 44,000 px.
          </p>
        </div>
      </div>
    </Disclosure>
  );
}
