import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldShell { label: string; hint?: string; error?: string | undefined; required?: boolean }

/** Label, hint and error wired to the control for screen readers. */
function Shell({ id, label, hint, error, required, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required && (<><span aria-hidden="true" className="ml-0.5 text-danger-600">*</span><span className="sr-only"> (required)</span></>)}
      </label>
      {hint && <p id={`${id}-hint`} className="text-sm text-muted">{hint}</p>}
      {children}
      {error && <p id={`${id}-error`} className="text-sm font-medium text-danger-700">{error}</p>}
    </div>
  );
}
const describedBy = (id: string, hint?: string, error?: string) => [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
const control = (error?: string) => cn("w-full rounded-md border bg-surface px-3 text-base text-ink disabled:bg-neutral-100 disabled:text-muted", error ? "border-danger-600" : "border-line-strong");

export function Textarea({ label, hint, error, required, className, ref, ...rest }: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  const id = useId();
  return (
    <Shell id={id} label={label} {...(hint ? { hint } : {})} error={error} {...(required ? { required } : {})}>
      <textarea id={id} ref={ref} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(control(error), "min-h-28 py-2", className)} {...rest} />
    </Shell>
  );
}

export function Select({ label, hint, error, required, className, children, ref, ...rest }: FieldShell & SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  const id = useId();
  return (
    <Shell id={id} label={label} {...(hint ? { hint } : {})} error={error} {...(required ? { required } : {})}>
      <select id={id} ref={ref} required={required} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, hint, error)} className={cn(control(error), "min-h-11", className)} {...rest}>{children}</select>
    </Shell>
  );
}

/** A switch-style checkbox with a visible label and optional description. */
export function Toggle({ label, description, ref, ...rest }: { label: string; description?: string; ref?: Ref<HTMLInputElement> } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} ref={ref} type="checkbox" role="switch" className="mt-1 size-5 shrink-0 accent-[var(--color-lagoon-600)]" aria-describedby={description ? `${id}-d` : undefined} {...rest} />
      <label htmlFor={id} className="grid gap-0.5"><span className="font-semibold">{label}</span>{description && <span id={`${id}-d`} className="text-sm text-muted">{description}</span>}</label>
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 border-t border-line pt-6 first:border-0 first:pt-0">
      <div><h3 className="text-base font-bold">{title}</h3>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
      {children}
    </section>
  );
}
