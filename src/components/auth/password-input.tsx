"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/primitives";

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} className="pr-10" {...props} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

/** Live password checklist — prevents errors before submit instead of reporting them after. */
export function PasswordChecklist({ value }: { value: string }) {
  const rules = [
    { ok: value.length >= 8, label: "8+ characters" },
    { ok: /[A-Za-z]/.test(value), label: "A letter" },
    { ok: /\d/.test(value), label: "A number" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.label} className={r.ok ? "text-success" : "text-muted-foreground"}>
          <span aria-hidden>{r.ok ? "✓" : "○"}</span> {r.label}
          <span className="sr-only">{r.ok ? " (met)" : " (not met)"}</span>
        </li>
      ))}
    </ul>
  );
}
