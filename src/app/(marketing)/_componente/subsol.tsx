import Link from "next/link";

import { CONTACT } from "@/content/landing/contact";
import type { ContinutLanding } from "@/content/landing/tipuri";

import { Marca } from "./marca";

/** Subsolul: pânza de la cotorul registrului. Pe cerneală, ca tot ce închide. */
export function Subsol({ text }: { text: ContinutLanding }) {
  const an = new Date().getFullYear();

  return (
    <footer className="mk-cerneala bg-mk-cerneala text-mk-text-inv">
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <Marca clasa="h-6 w-6" />
              <span className="font-mk-display text-[1.0625rem] font-semibold tracking-[-0.01em]">
                Administrativo
              </span>
            </div>
            <p className="text-mk-text-inv-slab mt-4 max-w-[42ch] text-[0.875rem] leading-[1.6]">
              {text.subsol.descriere}
            </p>
          </div>

          {text.subsol.coloane.map((coloana) => (
            <nav key={coloana.titlu} aria-label={coloana.titlu} className="md:col-span-2">
              <h2 className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
                {coloana.titlu}
              </h2>
              <ul className="mt-4 space-y-2.5">
                {coloana.legaturi.map((legatura) => (
                  <li key={`${coloana.titlu}-${legatura.eticheta}`}>
                    <Link
                      href={legatura.href}
                      className="text-mk-text-inv-slab hover:text-mk-text-inv text-[0.875rem] transition-colors"
                    >
                      {legatura.eticheta}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="md:col-span-12 lg:col-span-2">
            <h2 className="font-mk-date text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {text.subsol.contactTitlu}
            </h2>
            <ul className="mt-4 space-y-2.5 text-[0.875rem]">
              <li>
                <a href={CONTACT.telefonLegatura} className="font-mk-date tracking-[0.04em]">
                  {CONTACT.telefon}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CONTACT.email}`}
                  className="text-mk-text-inv-slab hover:text-mk-text-inv break-all transition-colors"
                >
                  {CONTACT.email}
                </a>
              </li>
              <li className="text-mk-text-inv-slab">{text.contact.program}</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-mk-rigla-inv border-t">
        <div className="max-w-mk mx-auto flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-2 px-[clamp(1rem,4vw,2.5rem)] py-5">
          <p className="text-mk-text-inv-slab text-[0.75rem]">
            © {an} Administrativo. {text.subsol.copyright}
          </p>
          <p className="text-mk-text-inv-slab max-w-[52ch] text-[0.75rem]">
            {text.subsol.notaDiacritice}
          </p>
        </div>
      </div>
    </footer>
  );
}
