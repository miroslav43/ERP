"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, LayoutDashboard, Mail, ScrollText } from "lucide-react";

/**
 * Navigația consolei de platformă.
 *
 * Grupată pe intenție, nu alfabetic: „Control" e ce SCHIMBI, „Urmă" e ce
 * CITEȘTI. Cele două intrări lipsă din vechiul meniu — panoul și e-mailurile —
 * sunt adăugate: existau ca pagini, dar nu se putea ajunge la ele din interfață.
 */
const GRUPURI = [
  {
    titlu: "Control",
    legaturi: [
      { href: "/super-admin", eticheta: "Panou", Icon: LayoutDashboard, exact: true },
      { href: "/super-admin/organizatii", eticheta: "Organizații", Icon: Building2, exact: false },
      {
        href: "/super-admin/cereri-demo",
        eticheta: "Cereri demo",
        Icon: ClipboardList,
        exact: false,
      },
    ],
  },
  {
    titlu: "Urmă",
    legaturi: [
      {
        href: "/super-admin/jurnal-audit",
        eticheta: "Jurnal audit",
        Icon: ScrollText,
        exact: false,
      },
      { href: "/super-admin/emailuri", eticheta: "E-mailuri", Icon: Mail, exact: false },
    ],
  },
] as const;

type Props = Readonly<{ numarOrganizatii: number; numarCereriNoi: number }>;

export function RailPlatforma({ numarOrganizatii, numarCereriNoi }: Props) {
  const cale = usePathname();

  const numarul = (href: string): number | null => {
    if (href === "/super-admin/organizatii") return numarOrganizatii;
    // Zero cereri nu merită o pastilă: o insignă care arată mereu „0" devine
    // zgomot și încetează să mai atragă atenția când chiar apare ceva.
    if (href === "/super-admin/cereri-demo") return numarCereriNoi > 0 ? numarCereriNoi : null;
    return null;
  };

  return (
    <nav
      aria-label="Secțiuni ale consolei de platformă"
      className="bg-navy-abis flex shrink-0 flex-col gap-7 border-white/10 p-3 max-md:border-b md:w-56 md:border-e"
    >
      {GRUPURI.map((grup) => (
        <div key={grup.titlu} className="flex flex-col gap-1">
          <span className="px-2 font-mono text-[0.6rem] font-medium tracking-[0.15em] text-white/40 uppercase max-md:hidden">
            {grup.titlu}
          </span>
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {grup.legaturi.map(({ href, eticheta, Icon, exact }) => {
              const activ = exact ? cale === href : cale === href || cale.startsWith(`${href}/`);
              const numar = numarul(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activ ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition ${
                      activ
                        ? "bg-white/10 text-white"
                        : "text-white/55 hover:bg-white/5 hover:text-white/90"
                    }`}
                  >
                    {/* Singurul auriu din rail: indicatorul de pagină activă. */}
                    {activ ? (
                      <span
                        aria-hidden="true"
                        className="bg-accent absolute -start-3 top-1.5 bottom-1.5 w-[3px] rounded-e-sm max-md:hidden"
                      />
                    ) : null}
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{eticheta}</span>
                    {numar !== null ? (
                      <span className="bg-accent text-navy-abis ms-auto rounded-full px-1.5 font-mono text-[0.68rem] font-semibold tabular-nums">
                        {numar}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
