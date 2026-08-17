// src/app/(marketing)/cere-demo/page.tsx
import type { Metadata } from "next";
import { Clock, MessageSquare, ShieldCheck } from "lucide-react";
import { FormularDemo } from "./formular-demo";

export const metadata: Metadata = {
  title: "Cere demo",
  description:
    "Completează formularul și îți arătăm Administrativo pe nevoile reale ale firmei tale. Fără card, fără cont creat automat.",
};

const ASTEPTARI = [
  {
    titlu: "Răspuns în maximum o zi lucrătoare",
    text: "Te contactăm pe e-mail sau la telefon, dacă ni-l lași.",
    icon: Clock,
  },
  {
    titlu: "Discuție, nu prezentare de vânzări",
    text: "Ne spui cum lucrați acum și îți spunem sincer dacă te ajutăm sau nu.",
    icon: MessageSquare,
  },
  {
    titlu: "Datele tale rămân la noi",
    text: "Folosim datele din formular doar pentru a te contacta în legătură cu această cerere.",
    icon: ShieldCheck,
  },
] as const;

export default function PaginaCereDemo() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <p className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">Cere demo</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Spune-ne câteva lucruri despre firma ta
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
            Durează sub două minute. Câmpurile marcate cu asterisc sunt obligatorii.
          </p>
          <div className="mt-10 max-w-xl">
            <FormularDemo />
          </div>
        </div>

        <aside className="lg:pt-16">
          <h2 className="text-sm font-semibold">La ce să te aștepți</h2>
          <ul className="mt-4 space-y-6">
            {ASTEPTARI.map((element) => {
              const Icon = element.icon;
              return (
                <li key={element.titlu} className="flex gap-3">
                  <Icon className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium">{element.titlu}</p>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {element.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
