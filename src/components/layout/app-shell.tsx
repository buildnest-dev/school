"use client";

import { AppBanner } from "@/components/app/app-banner";
import * as Dialog from "@radix-ui/react-dialog";
import { FlaskConical, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/shared/blocks";
import { isDemoHost } from "@/config/demo";
import {
  AREA_ROOT,
  ROLE_LABEL,
  NO_BACKEND_YET,
  SCREENS,
  canAccess,
  screenHref,
  screensFor,
  type ScreenDef,
} from "@/config/screens";
import { useServices } from "@/hooks/use-services";
import { env } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import type { Area, Role } from "@/types";
import { BrandLogo } from "./brand-logo";
import { NAV_ICONS } from "./nav-icons";

/** How far the side menu was scrolled, kept while moving between pages. */
let menuScroll = 0;

const AREA_LABEL: Record<Area, string> = {
  platform: "Platform administration",
  school: "School administration",
  teacher: "Teacher workspace",
  parent: "Parent portal",
  student: "Student portal",
};

function useNav(area: Area, role: Role | undefined) {
  return useMemo(() => {
    const items = screensFor(area).filter(
      (s) =>
        s.nav &&
        role !== undefined &&
        canAccess(role, s) &&
        // A screen that is not built yet is not offered in the menu of the live app.
        !(env.dataSource === "api" && s.status === "planned") &&
        !(env.dataSource === "api" && NO_BACKEND_YET.has(s.id) && !isDemoHost()),
    );
    const groups = new Map<string, ScreenDef[]>();
    for (const s of items.sort((a, b) => (a.nav?.order ?? 0) - (b.nav?.order ?? 0))) {
      const g = s.nav?.group ?? "";
      groups.set(g, [...(groups.get(g) ?? []), s]);
    }
    return { items, groups: [...groups.entries()] };
  }, [area, role]);
}

function isActive(pathname: string, s: ScreenDef) {
  const href = screenHref(s);
  if (s.path === "") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Breadcrumbs({ area, pathname, role }: { area: Area; pathname: string; role?: Role }) {
  const rest = pathname.slice(AREA_ROOT[area].length).split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: AREA_ROOT[area] }];
  let acc = "";
  for (const seg of rest) {
    acc += `/${seg}`;
    const s = SCREENS.find((x) => x.area === area && screenHref(x) === `${AREA_ROOT[area]}${acc}`);
    crumbs.push({ label: s?.title ?? decodeURIComponent(seg), href: `${AREA_ROOT[area]}${acc}` });
  }
  if (crumbs.length < 2)
    return (
      <span className="text-muted text-sm">
        {area === "school" && role ? `${ROLE_LABEL[role]} workspace` : AREA_LABEL[area]}
      </span>
    );
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="text-muted flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="text-ink font-semibold">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="hover:text-ink underline-offset-4 hover:underline">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function NavList({
  groups,
  pathname,
  onNavigate,
  large,
}: {
  groups: [string, ScreenDef[]][];
  pathname: string;
  onNavigate?: () => void;
  large?: boolean;
}) {
  return (
    <div className="grid gap-5">
      {groups.map(([group, items]) => (
        <div key={group}>
          <p className="text-on-dark/70 mb-2 flex items-center gap-2 px-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
            <span aria-hidden="true" className="bg-gold size-1.5 rounded-full" />
            {group}
            <span aria-hidden="true" className="h-px flex-1 bg-white/10" />
          </p>
          <ul className="grid gap-0.5">
            {items.map((s) => {
              const Icon = NAV_ICONS[s.nav?.icon ?? "layout"] ?? NAV_ICONS.layout!;
              const active = isActive(pathname, s);
              return (
                <li key={s.id}>
                  <Link
                    href={screenHref(s)}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group/nav flex items-center gap-3 rounded-full py-1 pr-3 pl-1.5 text-white/85 transition-[background-color,color,transform] duration-200 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
                      large ? "min-h-12 text-base" : "min-h-11 text-sm",
                      active &&
                        "bg-accent-light hover:bg-accent-light text-ink hover:text-ink font-semibold shadow-[0_6px_16px_rgb(0_0_0/0.25)] hover:translate-x-0",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-8 flex-none place-items-center rounded-full transition-colors",
                        active
                          ? "bg-deep-green text-accent-light"
                          : "bg-white/[0.07] group-hover/nav:bg-white/15",
                      )}
                    >
                      <Icon className="size-[17px]" />
                    </span>
                    <span className="leading-tight">{s.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Application shell: sidebar (desktop), drawer + bottom bar (mobile), breadcrumbs and a dev-data banner. */
export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  const { user, signOut } = useSession();
  const services = useServices();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = useNav(area, user?.role);
  const asideRef = useRef<HTMLElement>(null);
  const signedIn = !!user;
  // The menu is drawn again on every page, so it would jump back to the top. Keep where it was
  // scrolled, and make sure the page you are on is in view.
  useLayoutEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    el.scrollTop = menuScroll;
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
    menuScroll = el.scrollTop;
  }, [signedIn, pathname]);
  if (!user) return null;

  const comfortable = area === "teacher" || area === "parent" || area === "student";
  const bottom = nav.items.filter((s) => s.nav?.group === nav.groups[0]?.[0]).slice(0, 5);

  const userCard = (
    <div className="border-ink-line sticky bottom-0 z-10 -mx-4 mt-auto -mb-5 border-t bg-[#2a140c]/95 px-4 pt-4 pb-5 backdrop-blur">
      <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5">
        <Avatar name={user.name} className="bg-accent-light text-ink" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold text-white">{user.name}</p>
          <p className="text-on-dark truncate text-xs">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        {env.dataSource === "mock" ? (
          <Link
            href="/sign-in"
            className="text-on-dark flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2 text-xs whitespace-nowrap hover:bg-white/10 hover:text-white"
          >
            <FlaskConical className="size-3.5" aria-hidden="true" /> Dev role
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            signOut();
            router.push("/sign-in");
          }}
          className="text-on-dark flex min-h-9 items-center justify-center gap-1.5 rounded-full px-2 text-xs whitespace-nowrap hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-3.5" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-page min-h-screen lg:grid lg:grid-cols-[230px_1fr]">
      <a
        href="#app-main"
        className="bg-ink fixed top-[-60px] left-4 z-[100] rounded-sm px-4 py-2.5 text-white focus:top-3"
      >
        Skip to main content
      </a>

      <aside
        ref={asideRef}
        onScroll={(e) => {
          menuScroll = e.currentTarget.scrollTop;
        }}
        className="on-dark bg-sidebar sticky top-0 hidden h-screen flex-col overflow-y-auto px-4 py-5 lg:flex"
        aria-label={`${AREA_LABEL[area]} navigation`}
      >
        <BrandLogo onDark className="mb-1 px-1" />
        <p className="text-gold mb-6 px-1 text-xs font-semibold tracking-wide">
          {AREA_LABEL[area]}
        </p>
        <nav aria-label="Main" className="pb-6">
          <NavList groups={nav.groups} pathname={pathname} large={comfortable} />
        </nav>
        {userCard}
      </aside>

      <div className="min-w-0">
        {services.mode === "mock" ? (
          <div className="border-warn/30 flex items-center gap-2 border-b bg-[#fbf3e1] px-4 py-1.5 text-xs text-[#6b4306]">
            <FlaskConical className="size-3.5 flex-none" aria-hidden="true" />
            <span>
              <strong>Development mock data.</strong> Nothing here is stored on a server and nobody
              is notified.
            </span>
          </div>
        ) : null}

        <header className="border-line bg-paper/90 sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 border-b px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Dialog.Root open={open} onOpenChange={setOpen}>
              <Dialog.Trigger
                className="border-ink text-ink grid size-11 flex-none place-items-center rounded-md border lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="bg-ink/50 fixed inset-0 z-50 lg:hidden" />
                <Dialog.Content
                  aria-describedby={undefined}
                  className="on-dark bg-sidebar fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw] overflow-y-auto px-4 py-5 lg:hidden"
                >
                  <Dialog.Title className="sr-only">Menu</Dialog.Title>
                  <div className="mb-5 flex items-center justify-between">
                    <BrandLogo onDark />
                    <Dialog.Close
                      className="grid size-11 place-items-center rounded-md text-white hover:bg-white/10"
                      aria-label="Close menu"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <nav aria-label="Main">
                    <NavList
                      groups={nav.groups}
                      pathname={pathname}
                      onNavigate={() => setOpen(false)}
                      large
                    />
                  </nav>
                  {userCard}
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
            <Breadcrumbs area={area} pathname={pathname} role={user.role} />
          </div>
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <span className="border-line bg-surface text-ink rounded-full border px-3 py-1 text-xs font-semibold">
              {user.tenantName ?? "Platform"}
            </span>
            <span className="border-line bg-surface shadow-card flex items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5">
              <Avatar name={user.name} className="bg-deep-green text-accent-light size-9" />
              <span className="leading-tight">
                <span className="text-ink block text-sm font-bold">{user.name}</span>
                <span className="text-muted block text-xs">{ROLE_LABEL[user.role]}</span>
              </span>
            </span>
          </div>
        </header>

        <main
          id="app-main"
          className={cn("px-4 py-6 lg:px-8 lg:py-8", comfortable && "pb-28 text-[1.02rem] lg:pb-8")}
        >
          <AppBanner />
          {children}
        </main>
      </div>

      {comfortable && bottom.length > 0 ? (
        <nav
          aria-label="Quick navigation"
          className="border-line bg-paper fixed inset-x-0 bottom-0 z-40 grid border-t lg:hidden"
          style={{ gridTemplateColumns: `repeat(${bottom.length + 1}, minmax(0, 1fr))` }}
        >
          {bottom.map((s) => {
            const Icon = NAV_ICONS[s.nav?.icon ?? "layout"] ?? NAV_ICONS.layout!;
            const active = isActive(pathname, s);
            return (
              <Link
                key={s.id}
                href={screenHref(s)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-[0.64rem] font-semibold",
                  active ? "text-accent-ink" : "text-muted",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{s.nav?.short ?? s.title.split(" ")[0]}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-muted flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.64rem] font-semibold"
          >
            <Menu className="size-5" aria-hidden="true" />
            More
          </button>
        </nav>
      ) : null}
    </div>
  );
}
