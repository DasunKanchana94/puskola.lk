"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

/** A form's submit button that shows a spinner and blocks double clicks while the form is being saved. */
export function Submit({ children, className = "btn", disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    // Lets the top loading bar know the save has finished, even when the page address does not change.
    if (was.current && !pending) window.dispatchEvent(new Event("puskola:idle"));
    was.current = pending;
  }, [pending]);
  return (
    <button {...rest} className={className} disabled={disabled || pending} aria-busy={pending || undefined} data-busy={pending ? "1" : undefined}>
      {pending && <span className="spin" aria-hidden />}{children}
    </button>
  );
}
