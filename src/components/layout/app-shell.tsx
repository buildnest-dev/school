"use client";

import { AppBanner } from "@/components/app/app-banner";
import * as Dialog from "@radix-ui/react-dialog";
import { FlaskConical, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Avatar } from "@/components/shared/blocks";
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
        !(env.dataSource === "api" && NO_BACKEND_YET.has(s.id)),
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

function Breadcrumbs({ area, pathname }: { area: Area; pathname: string }) {
  const rest = pathname.slice(AREA_ROOT[area].length).split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: AREA_ROOT[area] }];
  let acc = "";
  for (const seg of rest) {
    acc += `/${seg}`;
    const s = SCREENS.find((x) => x.area === area && screenHref(x) === `${AREA_ROOT[area]}${acc}`);
    crumbs.push({ label: s?.title ?? decodeURIComponent(seg), href: `${AREA_ROOT[area]}${acc}` });
  }
  if (crumbs.length < 2) return <span className="text-muted text-sm">{AREA_LABEL[area]}</span>;
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
          <p className="text-on-dark/70 mb-1.5 px-3 text-[0.68rem] font-bold tracking-[0.12em] uppercase">
            {group}
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
                      "flex items-center gap-3 rounded-md px-3 text-white/85 transition-colors hover:bg-white/10 hover:text-white",
                      large ? "min-h-12 text-base" : "min-h-10 text-sm",
                      active && "bg-white/15 font-semibold text-white",
                    )}
                  >
                    <Icon className="size-[18px] flex-none" aria-hidden="true" />
                    {s.title}
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
  if (!user) return null;

  const comfortable = area === "teacher" || area === "parent" || area === "student";
  const bottom = nav.items.filter((s) => s.nav?.group === nav.groups[0]?.[0]).slice(0, 5);

  const userCard = (
    <div className="border-ink-line mt-6 border-t pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={user.name} className="bg-accent-light text-ink" />
        <div className="min-w-0 text-sm">
          <p className="truncate font-semibold text-white">{user.name}</p>
          <p className="text-on-dark truncate text-xs">{ROLE_LABEL[user.role]}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1">
        {env.dataSource === "mock" ? (
          <Link
            href="/sign-in"
            className="text-on-dark flex min-h-10 items-center gap-2 rounded-md px-3 text-sm hover:bg-white/10 hover:text-white"
          >
            <FlaskConical className="size-4" aria-hidden="true" /> Switch dev role
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => {
            signOut();
            router.push("/sign-in");
          }}
          className="text-on-dark flex min-h-10 items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-paper min-h-screen lg:grid lg:grid-cols-[264px_1fr]">
      <a
        href="#app-main"
        className="bg-ink fixed top-[-60px] left-4 z-[100] rounded-sm px-4 py-2.5 text-white focus:top-3"
      >
        Skip to main content
      </a>

      <aside
        className="on-dark bg-ink sticky top-0 hidden h-screen flex-col overflow-y-auto px-4 py-5 lg:flex"
        aria-label={`${AREA_LABEL[area]} navigation`}
      >
        <BrandLogo onDark className="mb-1 px-1" />
        <p className="text-on-dark mb-6 px-1 text-xs">{AREA_LABEL[area]}</p>
        <nav aria-label="Main">
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

        <header className="border-line bg-paper sticky top-0 z-30 flex min-h-14 items-center justify-between gap-3 border-b px-4 lg:px-8">
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
                  className="on-dark bg-ink fixed inset-y-0 left-0 z-50 w-[300px] max-w-[88vw] overflow-y-auto px-4 py-5 lg:hidden"
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
            <Breadcrumbs area={area} pathname={pathname} />
          </div>
          <div className="text-muted hidden items-center gap-2 text-sm sm:flex">
            {user.tenantName ? (
              <span className="border-line bg-surface rounded-full border px-3 py-1 text-xs font-semibold">
                {user.tenantName}
              </span>
            ) : (
              <span className="border-line bg-surface rounded-full border px-3 py-1 text-xs font-semibold">
                Platform
              </span>
            )}
            <span>{user.name}</span>
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
