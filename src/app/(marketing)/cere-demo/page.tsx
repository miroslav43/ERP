// src/app/(marketing)/cere-demo/page.tsx
import type { Metadata } from "next";

import { CONTACT } from "@/content/landing/contact";
import { RO } from "@/content/landing/ro";

import { Cadru } from "../_componente/cadru";
import { FormularDemo } from "./formular-demo";

export const metadata: Metadata = {
  title: "Cere o demonstrație",
  description:
    "Completează formularul și îți arătăm Administrativo pe nevoile reale ale firmei tale. Fără card, fără cont creat automat.",
  alternates: { canonical: "/cere-demo" },
};

const ASTEPTARI = [
  {
    titlu: "Răspuns în cel mult o zi lucrătoare",
    text: "Te contactăm pe e-mail sau la telefon, dacă ni-l lași.",
  },
  {
    titlu: "O discuție, nu o prezentare de vânzări",
    text: "Ne spui cum lucrați acum și îți spunem sincer dacă te ajutăm sau nu.",
  },
  {
    titlu: "Îți spunem și ce nu e gata",
    text: "Lista completă e pe pagina principală, la „Ce nu facem”. Nu o ținem pentru a treia întâlnire.",
  },
] as const;

export default function PaginaCereDemo() {
  return (
    <Cadru text={RO}>
      <div className="max-w-mk mx-auto w-full px-[clamp(1rem,4vw,2.5rem)] py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div>
            <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              {RO.contact.supratitlu}
            </p>
            <h1 className="font-mk-display mt-5 max-w-[18ch] text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-balance">
              Spune-ne câteva lucruri despre firma ta
            </h1>
            <p className="text-mk-text-slab mt-5 max-w-[54ch] text-[1.0625rem] leading-[1.6]">
              Durează sub două minute. Câmpurile marcate cu asterisc sunt obligatorii.
            </p>
            <div className="mt-10 max-w-xl">
              <FormularDemo />
            </div>
          </div>

          <aside className="lg:pt-20">
            <h2 className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
              La ce să te aștepți
            </h2>
            <ul className="border-mk-rigla/40 mt-4 border-t">
              {ASTEPTARI.map((element) => (
                <li key={element.titlu} className="border-mk-rigla/40 border-b py-4">
                  <p className="text-[0.9375rem] font-medium">{element.titlu}</p>
                  <p className="text-mk-text-slab mt-1.5 text-[0.875rem] leading-[1.55]">
                    {element.text}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="mt-8 space-y-4">
              <div>
                <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                  {RO.contact.telefonEticheta}
                </dt>
                <dd className="mt-1">
                  <a
                    href={CONTACT.telefonLegatura}
                    className="font-mk-date text-[1.125rem] tabular-nums"
                  >
                    {CONTACT.telefon}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
                  {RO.contact.emailEticheta}
                </dt>
                <dd className="mt-1 text-[0.875rem] break-all">
                  <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </div>
    </Cadru>
  );
}
