"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("border-line mb-5 flex gap-1 overflow-x-auto border-b", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "text-muted hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink -mb-px min-h-11 flex-none border-b-[3px] border-transparent px-4 text-sm font-semibold whitespace-nowrap transition-colors",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = RadixTabs.Content;
