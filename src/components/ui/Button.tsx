import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle, type LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
 * Arnifi DS CTA: near-square corners (2px), Inter Medium label, primary carries a darker arrow segment
 * on the right. Sizes M 44 / L 48 / XL 56.
 */
type Variant = "primary" | "secondary" | "tertiary" | "text";
type Size = "m" | "l" | "xl";

interface StyleProps {
  variant?: Variant;
  size?: Size;
  /** Right-hand arrow segment ("→" in the PRD copy). */
  arrow?: boolean;
  /** Leading back arrow for "Back to …" actions. */
  back?: boolean;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  /** Looks disabled but stays focusable and clickable, so a click can explain what's missing. */
  softDisabled?: boolean;
  className?: string;
  children: ReactNode;
}

const sizes: Record<Size, string> = {
  m: "min-h-11 text-p3",
  l: "min-h-12 text-p3",
  xl: "min-h-14 text-p2",
};

// `soft` styles a focusable "not ready yet" button; `disabled` styles a real disabled button.
const variants: Record<Variant, { body: string; segment: string; soft: string; disabled: string }> = {
  primary: {
    body: "bg-brand text-white hover:bg-brand-hover",
    segment: "bg-arnique-1000",
    soft: "bg-dusk-300 text-dusk-700",
    disabled: "disabled:bg-dusk-300 disabled:text-dusk-700",
  },
  secondary: {
    body: "bg-arnique-200 text-arnique-1100 hover:bg-arnique-300",
    segment: "bg-arnique-300",
    soft: "bg-dusk-300 text-dusk-700",
    disabled: "disabled:bg-dusk-300 disabled:text-dusk-700",
  },
  tertiary: {
    body: "bg-white text-ink border border-line hover:bg-cool hover:border-line-hover",
    segment: "border-l border-line",
    soft: "bg-white text-dusk-700 border border-line",
    disabled: "disabled:text-dusk-700 disabled:hover:bg-white",
  },
  text: {
    body: "text-brand hover:text-brand-hover underline-offset-4 hover:underline",
    segment: "",
    soft: "text-dusk-700",
    disabled: "disabled:text-dusk-700 disabled:no-underline",
  },
};

function classes({ variant = "primary", size = "l", fullWidth, softDisabled, loading, className }: Omit<StyleProps, "children">) {
  const v = variants[variant];
  return cn(
    "group inline-flex items-stretch justify-between overflow-hidden rounded-cta font-medium transition-[color,background-color,border-color,transform] duration-150 select-none enabled:active:scale-[0.98] [&:is(a)]:active:scale-[0.98]",
    loading ? "cursor-progress" : "disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
    variant === "text" ? "min-h-11 text-p3" : sizes[size],
    fullWidth && "w-full",
    softDisabled ? v.soft : v.body,
    // A loading button keeps its colour; only a genuinely unavailable action greys out.
    !loading && v.disabled,
    className,
  );
}

function Content({ variant = "primary", arrow, back, icon: Icon, loading, softDisabled, children }: StyleProps) {
  const padded = variant === "text" ? "px-0" : "px-5";
  const showSegment = arrow && variant !== "text";
  return (
    <>
      <span className={cn("flex flex-1 items-center justify-center gap-2 py-2 text-center", padded)}>
        {loading ? (
          <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" />
        ) : back ? (
          <ArrowLeft aria-hidden className="size-4 shrink-0" />
        ) : Icon ? (
          <Icon aria-hidden className="size-4 shrink-0" />
        ) : null}
        <span>{children}</span>
        {arrow && variant === "text" && <ArrowRight aria-hidden className="size-4 shrink-0" />}
      </span>
      {showSegment && (
        <span
          aria-hidden
          className={cn("flex w-12 shrink-0 items-center justify-center", softDisabled ? "bg-dusk-400" : variants[variant].segment, !loading && "group-disabled:bg-dusk-400")}
        >
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );
}

type ButtonProps = StyleProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

export function Button({ variant, size, arrow, back, icon, loading, fullWidth, softDisabled, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={softDisabled || undefined}
      className={classes({ variant, size, fullWidth, softDisabled, loading, className })}
      {...rest}
    >
      <Content variant={variant} arrow={arrow} back={back} icon={icon} loading={loading} softDisabled={softDisabled}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = StyleProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href">;

export function ButtonLink({ variant, size, arrow, back, icon, fullWidth, className, children, href, ...rest }: ButtonLinkProps) {
  return (
    <Link href={href} className={classes({ variant, size, fullWidth, className })} {...rest}>
      <Content variant={variant} arrow={arrow} back={back} icon={icon}>
        {children}
      </Content>
    </Link>
  );
}
