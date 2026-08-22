// src/app/(marketing)/legal/confidentialitate/page.tsx
import type { Metadata } from "next";

import { RO } from "@/content/landing/ro";

import { Cadru } from "../../_componente/cadru";

export const metadata: Metadata = {
  title: "Politica de confidențialitate",
  description:
    "Ce date colectăm în Administrativo, de ce, și care sunt drepturile tale conform GDPR. Document în curs de validare juridică.",
};

const SECTIUNI = [
  {
    titlu: "1. Operatorul de date",
    nota: "Denumire completă, CUI, sediu, date de contact și, dacă este cazul, responsabilul cu protecția datelor.",
  },
  {
    titlu: "2. Ce date colectăm",
    nota: "Date din formularul de demo (nume, firmă, e-mail, telefon, număr de angajați, mesaj), date de cont, date introduse de client în aplicație și date tehnice (adresă IP, agent de navigare) păstrate în jurnalul de audit.",
  },
  {
    titlu: "3. Temeiul și scopul prelucrării",
    nota: "Interes legitim pentru răspunsul la cererea de demo, executarea contractului pentru datele de cont, obligații legale pentru documentele contabile.",
  },
  {
    titlu: "4. Cine are acces",
    nota: "Angajații noștri strict pe bază de necesitate, plus împuterniciții: furnizorul de găzduire a bazei de date și furnizorul de e-mail tranzacțional.",
  },
  {
    titlu: "5. Transferuri în afara Spațiului Economic European",
    nota: "DE CONFIRMAT: locația efectivă a serverelor și garanțiile aplicabile pentru fiecare împuternicit.",
  },
  {
    titlu: "6. Cât timp păstrăm datele",
    nota: "Cererile de demo, datele de cont după încetarea contractului și jurnalul de audit au termene diferite, configurate prin politicile de retenție.",
  },
  {
    titlu: "7. Drepturile tale",
    nota: "Acces, rectificare, ștergere, restricționare, portabilitate, opoziție și dreptul de a depune plângere la ANSPDCP.",
  },
  {
    titlu: "8. Cookie-uri",
    nota: "Cookie-ul de sesiune este strict necesar pentru autentificare. DE CONFIRMAT dacă se adaugă vreun instrument de analiză.",
  },
  {
    titlu: "9. Securitate",
    nota: "Izolarea datelor între organizații la nivel de bază de date, verificarea permisiunilor pe server, jurnal de audit care nu poate fi modificat, criptare în tranzit.",
  },
  { titlu: "10. Modificări ale politicii", nota: "Cum anunțăm modificările și de când se aplică." },
] as const;

export default function PaginaConfidentialitate() {
  return (
    <Cadru text={RO}>
      <div className="mx-auto w-full max-w-3xl px-[clamp(1rem,4vw,2.5rem)] py-16 sm:py-24">
        <h1 className="font-mk-display text-[clamp(2rem,4vw,3rem)] leading-[1.04] font-semibold tracking-[-0.02em]">
          Politica de confidențialitate
        </h1>
        <p className="text-mk-text-slab mt-4 text-base leading-relaxed">
          Structura de mai jos descrie onest ce date atinge aplicația astăzi. Textul final, cu
          formulările cerute de GDPR, este în curs de validare juridică.
        </p>
        <p className="border-mk-sl bg-mk-sl-hartie text-mk-sl-apasat mt-6 rounded border p-4 text-sm">
          DE COMPLETAT DE JURIST — până la validare, acest document are rol informativ, nu de
          politică asumată juridic.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIUNI.map((sectiune) => (
            <section key={sectiune.titlu}>
              <h2 className="font-mk-display text-[1.125rem] font-semibold">{sectiune.titlu}</h2>
              <p className="text-mk-text-slab mt-2 text-sm leading-relaxed">{sectiune.nota}</p>
              <p className="text-mk-sl-apasat mt-2 text-sm font-medium">DE COMPLETAT DE JURIST</p>
            </section>
          ))}
        </div>
      </div>
    </Cadru>
  );
}
