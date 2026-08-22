// src/app/(marketing)/page.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  FileText,
  KeyRound,
  Receipt,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { RUTA_AUTENTIFICARE } from "@/config/routes";
type StareModul = "disponibil" | "in_pregatire";

type Modul = Readonly<{
  titlu: string;
  descriere: string;
  icon: LucideIcon;
  stare: StareModul;
}>;

const MODULE: readonly Modul[] = [
  {
    titlu: "Organizații și echipă",
    descriere:
      "Datele firmei, membrii activi și invitațiile pe e-mail. Un utilizator poate face parte din mai multe firme și comută între ele fără să se delogheze.",
    icon: Building2,
    stare: "disponibil",
  },
  {
    titlu: "Roluri și permisiuni",
    descriere:
      "Cinci roluri predefinite, fiecare cu domeniu de acces: doar datele proprii, ale echipei sau ale întregii firme. Regulile se aplică pe server, nu doar în meniu.",
    icon: KeyRound,
    stare: "disponibil",
  },
  {
    titlu: "Jurnal de audit",
    descriere:
      "Cine a făcut modificarea, când, din ce adresă IP și ce s-a schimbat. Înregistrările se adaugă, nu se pot edita sau șterge.",
    icon: ScrollText,
    stare: "disponibil",
  },
  {
    titlu: "Notificări",
    descriere:
      "Anunțuri în aplicație și pe e-mail pentru invitații, aprobări și termene, cu preferințe per utilizator.",
    icon: Bell,
    stare: "disponibil",
  },
  {
    titlu: "Persoane și contracte",
    descriere:
      "Dosarul angajatului: date personale, contract individual de muncă, acte adiționale și documentele aferente, legate de persoană.",
    icon: Users,
    stare: "in_pregatire",
  },
  {
    titlu: "Pontaj și concedii",
    descriere:
      "Program de lucru, cereri de concediu cu aprobare pe linie ierarhică și situația zilelor rămase pentru fiecare angajat.",
    icon: CalendarClock,
    stare: "in_pregatire",
  },
  {
    titlu: "Documente",
    descriere:
      "Generare din șabloane, numerotare automată pe serii și arhivă cu istoricul versiunilor.",
    icon: FileText,
    stare: "in_pregatire",
  },
  {
    titlu: "Facturare și încasări",
    descriere: "Facturi emise, scadențe și situația încasărilor, în lei sau în altă valută.",
    icon: Receipt,
    stare: "in_pregatire",
  },
] as const;

const INCREDERE = [
  {
    titlu: "Datele unei firme rămân ale acelei firme",
    text: "Izolarea nu este făcută în interfață, ci în baza de date: fiecare interogare trece prin politici de acces pe rând. Chiar dacă o pagină ar cere datele altei organizații, baza de date refuză.",
    icon: ShieldCheck,
  },
  {
    titlu: "Permisiuni verificate pe server",
    text: "Fiecare acțiune declară permisiunea și domeniul necesar. Un buton ascuns în meniu nu este o măsură de securitate, așa că verificarea se face din nou la execuție.",
    icon: KeyRound,
  },
  {
    titlu: "Urmă completă pentru control",
    text: "Modificările importante ajung în jurnalul de audit, care nu poate fi modificat. Este util pentru controale interne și pentru clarificarea rapidă a unei situații.",
    icon: ScrollText,
  },
  {
    titlu: "GDPR luat în serios",
    text: "Colectăm strict datele necesare, aplicăm politici de retenție per organizație și răspundem cererilor de acces, rectificare, export sau ștergere.",
    icon: FileText,
  },
] as const;

const PASI = [
  {
    titlu: "Trimiți cererea de demo",
    text: "Completezi formularul în mai puțin de două minute. Nu îți cerem card și nu îți creăm cont fără acordul tău.",
  },
  {
    titlu: "Îți configurăm organizația",
    text: "Creăm firma cu datele reale și activăm exact modulele discutate. Ce nu este activ nu apare în aplicație.",
  },
  {
    titlu: "Îți inviți colegii",
    text: "Trimiți invitații pe e-mail, alegi rolul fiecăruia, iar ei intră direct în modulele care îi privesc.",
  },
] as const;

const FOCUS = "   focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function EtichetaStare({ stare }: { stare: StareModul }) {
  const esteDisponibil = stare === "disponibil";
  return (
    <span
      className={`border-border inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        esteDisponibil ? "text-success" : "text-muted-foreground"
      }`}
    >
      {esteDisponibil ? "Disponibil" : "În pregătire"}
    </span>
  );
}

export default function PaginaPrincipala() {
  return (
    <>
      <section className="border-border border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-accent text-xs font-semibold tracking-[0.18em] uppercase">
            ERP pentru firme mici și mijlocii din România
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Administrarea firmei, într-un singur loc, cu reguli clare de acces.
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-relaxed">
            Administrativo ține laolaltă datele firmei, oamenii și documentele. Fiecare coleg vede
            doar ce ține de rolul lui, iar tu vezi oricând cine ce a modificat. Fără fișiere trimise
            pe chat și fără tabele paralele.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/cere-demo"
              className={`bg-primary text-primary-foreground hover:bg-primary-hover inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-colors ${FOCUS}`}
            >
              Cere demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={RUTA_AUTENTIFICARE}
              className={`border-border bg-surface hover:border-primary inline-flex items-center justify-center rounded-md border px-6 py-3 text-sm font-medium transition-colors ${FOCUS}`}
            >
              Am deja cont
            </Link>
          </div>
          <dl className="border-border mt-14 grid max-w-3xl gap-8 border-t pt-8 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-sm">Roluri predefinite</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">5</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Module activate separat</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">per firmă</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-sm">Interfață și suport</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight">în română</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="module" className="border-border scroll-mt-20 border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Module</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
            Activezi doar ce folosești. Mai jos este starea reală a fiecărui modul, ca să știi de la
            început ce primești acum și ce urmează.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODULE.map((modul) => {
              const Icon = modul.icon;
              return (
                <li
                  key={modul.titlu}
                  className="border-border bg-surface flex flex-col rounded-lg border p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Icon className="text-primary h-5 w-5" aria-hidden="true" />
                    <EtichetaStare stare={modul.stare} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{modul.titlu}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {modul.descriere}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="incredere" className="border-border bg-surface scroll-mt-20 border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Date și securitate</h2>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed">
            Într-o aplicație folosită de mai multe firme, separarea datelor nu este un detaliu
            tehnic, ci baza încrederii. Iată cum o tratăm.
          </p>
          <ul className="mt-10 grid gap-x-10 gap-y-8 md:grid-cols-2">
            {INCREDERE.map((element) => {
              const Icon = element.icon;
              return (
                <li key={element.titlu} className="flex gap-4">
                  <Icon className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <h3 className="text-base font-semibold">{element.titlu}</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {element.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section id="pasi" className="border-border scroll-mt-20 border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Cum începi</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {PASI.map((pas, index) => (
              <li key={pas.titlu} className="border-border rounded-lg border p-6">
                <span className="text-accent text-sm font-semibold">Pasul {index + 1}</span>
                <h3 className="mt-3 text-base font-semibold">{pas.titlu}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{pas.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="bg-primary rounded-lg px-6 py-14 text-center sm:px-12">
            <h2 className="text-primary-foreground text-3xl font-semibold tracking-tight">
              Vezi Administrativo pe datele firmei tale
            </h2>
            <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl text-base leading-relaxed">
              Programăm o discuție scurtă, îți arătăm exact modulele care te interesează și îți
              spunem deschis ce nu este încă gata.
            </p>
            <Link
              href="/cere-demo"
              className={`bg-background text-foreground mt-8 inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-sm font-medium transition-opacity hover:opacity-90 ${FOCUS} focus-visible:ring-offset-primary`}
            >
              Cere demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
