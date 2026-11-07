"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { gsap, useGsap } from "@/components/motion/gsap";
import { NAV_LINKS, ROUTES } from "@/lib/site";
import { BrandLogo } from "./brand-logo";

const linkClass =
  "relative inline-block py-2 text-[0.95rem] font-medium after:absolute after:inset-x-0 after:bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 hover:after:scale-x-100 focus-visible:after:scale-x-100";

/**
 * Transparent over the hero, solid once scrolled, with a thin reading-progress line.
 * Scroll state is written to CSS variables/attributes (no React re-render per scroll event).
 */
export function SiteHeader() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      el.dataset.solid = String(window.scrollY > 24);
      el.style.setProperty("--p", max > 0 ? String(Math.min(1, window.scrollY / max)) : "0");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Staggered entrance, then mark the nav as settled so the pending (hidden) state is released.
  useGsap(({ motion }) => {
    const el = ref.current;
    if (!motion || !el) return;
    gsap.fromTo(
      el.querySelectorAll("[data-nav-item]"),
      { opacity: 0, y: -14 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.07,
        onComplete: () => el.setAttribute("data-nav-state", "done"),
      },
    );
    return () => el.setAttribute("data-nav-state", "done");
  }, ref);

  return (
    <header
      ref={ref}
      data-nav-state="pending"
      data-solid="false"
      className="group/header data-[solid=true]:border-line data-[solid=true]:bg-paper sticky top-0 z-50 border-b border-transparent transition-[background-color,border-color] duration-300"
    >
      <div className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between gap-6 px-6">
        <span data-nav-item>
          <BrandLogo />
        </span>

        <nav
          aria-label="Primary"
          className="ml-8 hidden flex-1 items-center justify-between gap-8 lg:flex"
        >
          <ul className="flex gap-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href} data-nav-item>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-3">
            <span data-nav-item>
              <Button asChild size="sm">
                <Link href={ROUTES.demo}>Book a Demo</Link>
              </Button>
            </span>
          </div>
        </nav>

        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button
              type="button"
              data-nav-item
              className="border-ink text-ink inline-flex min-h-11 items-center gap-2.5 rounded-sm border px-3.5 text-sm font-semibold lg:hidden"
            >
              Menu <Menu className="size-4" aria-hidden="true" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-ink/30 fixed inset-0 top-18 z-40 lg:hidden" />
            <Dialog.Content
              aria-describedby={undefined}
              className="bg-paper border-line fixed inset-x-0 top-0 z-50 max-h-screen overflow-y-auto border-b px-6 pt-4 pb-6 shadow-xl lg:hidden"
            >
              <Dialog.Title className="sr-only">Site navigation</Dialog.Title>
              <div className="flex h-14 items-center justify-between">
                <BrandLogo />
                <Dialog.Close className="border-ink text-ink inline-flex min-h-11 items-center gap-2.5 rounded-sm border px-3.5 text-sm font-semibold">
                  Close <X className="size-4" aria-hidden="true" />
                </Dialog.Close>
              </div>
              <ul className="mt-2">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Dialog.Close asChild>
                      <Link
                        href={link.href}
                        className="border-line block border-b py-3.5 text-[1.05rem]"
                      >
                        {link.label}
                      </Link>
                    </Dialog.Close>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid gap-3">
                <Dialog.Close asChild>
                  <Button asChild>
                    <Link href={ROUTES.demo}>Book a Demo</Link>
                  </Button>
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div
        aria-hidden="true"
        className="bg-accent absolute inset-x-0 -bottom-px h-0.5 origin-left opacity-0 transition-opacity group-data-[solid=true]/header:opacity-100"
        style={{ transform: "scaleX(var(--p, 0))" }}
      />
    </header>
  );
}
