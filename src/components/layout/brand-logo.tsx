import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The ZAQSA School logo. `onDark` uses the version with white letters. */
export function BrandLogo({ onDark = false, className }: { onDark?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND} home`}
      className={cn("inline-flex w-fit items-center no-underline", className)}
    >
      <Image
        src={onDark ? "/brand/logo-light.png" : "/brand/logo.png"}
        alt=""
        width={600}
        height={198}
        priority
        className="h-14 w-auto sm:h-16"
      />
    </Link>
  );
}
