"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentPropsWithoutRef } from "react";
import { Input } from "./field";

/** A password field with a Show / Hide button, so a typing mistake can be seen and fixed. */
export function PasswordInput(props: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className="pr-12" />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="text-muted hover:text-ink absolute inset-y-0 right-0 grid w-11 place-items-center"
      >
        {shown ? (
          <EyeOff className="size-5" aria-hidden="true" />
        ) : (
          <Eye className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
