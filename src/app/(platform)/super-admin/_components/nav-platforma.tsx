// src/app/(platform)/super-admin/_components/nav-platforma.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, ScrollText } from "lucide-react";

const LEGATURI = [
  { href: "/super-admin/organizatii", eticheta: "Organizații", Icon: Building2 },
  { href: "/super-admin/cereri-demo", eticheta: "Cereri demo", Icon: ClipboardList },
  { href: "/super-admin/jurnal-audit", eticheta: "Jurnal audit", Icon: ScrollText },
] as const;

export function NavigatiePlatforma() {
  const caleCurenta = usePathname();

  return (
    <nav aria-label="Secțiuni ale panoului de platformă" className="md:w-56 md:shrink-0">
      <ul className="flex gap-1 overflow-x-auto md:flex-col">
        {LEGATURI.map(({ href, eticheta, Icon }) => {
          const activ = caleCurenta === href || caleCurenta.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={activ ? "page" : undefined}
                className={` flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition   ${
                  activ
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon aria-hidden="true" className="size-4" />
                {eticheta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
