import { useId, type InputHTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string | undefined;
  ref?: Ref<HTMLInputElement>;
}

/** Labelled input with hint and error wired to the control for screen readers. */
export function Input({ label, hint, error, required, className, ref, ...rest }: InputProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger-600">*</span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {hint && <p id={hintId} className="text-sm text-muted">{hint}</p>}
      <input
        id={id}
        ref={ref}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 w-full rounded-md border bg-surface px-3 text-base text-ink",
          error ? "border-danger-600" : "border-line-strong",
          "disabled:bg-neutral-100 disabled:text-muted",
          className
        )}
        {...rest}
      />
      {error && <p id={errorId} className="text-sm font-medium text-danger-700">{error}</p>}
    </div>
  );
}
