"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// The root is 44px tall (tap target) with a smaller visual track inside.
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "group inline-flex h-11 w-14 shrink-0 cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="relative inline-flex h-7 w-12 items-center rounded-full bg-input transition-colors group-data-[state=checked]:bg-success">
        <SwitchPrimitive.Thumb className="block size-6 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[1.375rem]" />
      </span>
    </SwitchPrimitive.Root>
  );
}
