import { CircleAlert } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/* DS text field: label → field → helper / error. 48px field, 1.5px border, 4px radius, Ruby error with icon. */
interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  optional?: boolean;
  helper?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, optional, helper, error, className, required, ...input },
  ref,
) {
  const id = useId();
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-p3 font-medium text-ink">
        {label}
        {optional ? <span className="font-normal text-muted"> (optional)</span> : required && <span className="text-ruby-700"> *</span>}
      </label>
      <input
        ref={ref}
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-12 w-full rounded-control border-[1.5px] bg-white px-4 text-p2 text-ink transition-colors placeholder:text-dusk-500",
          "hover:border-line-hover focus:border-focus focus:outline-none focus-visible:outline-none",
          error ? "border-ruby-500 hover:border-ruby-500 focus:border-ruby-500" : "border-line",
        )}
        {...input}
      />
      {helper && !error && (
        <p id={`${id}-helper`} className="text-p4 text-muted">
          {helper}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-p3 text-ruby-700">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
});
