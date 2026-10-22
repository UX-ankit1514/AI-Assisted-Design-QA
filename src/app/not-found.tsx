import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-[36rem] flex-col items-start gap-4 px-6 py-20">
      <h1 className="font-serif text-l4 font-medium text-heading">Page Not Found</h1>
      <p className="text-p2 text-muted">This page doesn&apos;t exist. Start a new comparison or open your design issues.</p>
      <div className="flex gap-3">
        <ButtonLink href="/" arrow>
          New Comparison
        </ButtonLink>
        <ButtonLink href="/issues" variant="tertiary">
          Design Issues
        </ButtonLink>
      </div>
    </div>
  );
}
