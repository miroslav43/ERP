// src/app/(marketing)/module/[modul]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isFeatureKey, type FeatureKey } from "@/config/features";
import { lunar, MODULE_NUCLEU, PRETURI_MODULE } from "@/content/landing/preturi";
import { RO } from "@/content/landing/ro";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { RandRegistru, Registru } from "../../_componente/registru";

/**
 * Pagina fiecărui modul.
 *
 * ── DE CE O RUTĂ DINAMICĂ, NU NOUĂSPREZECE FIȘIERE ────────────────────────
 * Conținutul există deja în `RO.module.grupuri`, iar `generateStaticParams` îl
 * prerandează pe tot la build: rezultatul sunt nouăsprezece pagini statice,
 * exact ca și cum ar fi scrise una câte una, dar fără nouăsprezece fișiere care
 * să se despartă unul de altul la prima schimbare de format.
 *
 * Cheia din adresă E cheia de modul din `features.ts`. Alegerea nu e comoditate:
 * `/module/attendance` e verificabil față de catalog, iar un slug frumos ca
 * `/module/pontaj` ar fi cerut o a doua hartă slug→cheie, adică încă un loc unde
 * două liste trebuie ținute împreună. Costul: adresele sunt în engleză, deși
 * situl e în română. Compromis asumat, în favoarea faptului că o adresă greșită
 * dă 404 la build, nu în producție.
 *
 * ── DE CE NU E ÎN SITEMAP ─────────────────────────────────────────────────
 * Paginile astea sunt încă subțiri: două-trei propoziții și trei puncte, luate
 * din catalogul de pe `/module`. Trimise la indexare așa, ar concura cu pagina
 * părinte pe aceleași cuvinte și ar dilua-o. Intră în sitemap când fiecare
 * primește text propriu — până atunci sunt utile ca navigare și ca destinație de
 * link intern, ceea ce e deja mai mult decât aveau.
 */

type Proprietati = Readonly<{ params: Promise<{ modul: string }> }>;

/** Modulul și grupul din care face parte, căutate o singură dată. */
function gasesteModul(cheie: string) {
  for (const grup of RO.module.grupuri) {
    const modul = grup.module.find((m) => m.cheie === cheie);
    if (modul !== undefined) return { modul, grup };
  }
  return null;
}

export function generateStaticParams(): { modul: string }[] {
  return RO.module.grupuri.flatMap((grup) => grup.module.map((m) => ({ modul: m.cheie })));
}

export async function generateMetadata({ params }: Proprietati): Promise<Metadata> {
  const { modul: cheie } = await params;
  const gasit = gasesteModul(cheie);
  if (gasit === null) return { title: "Modul negăsit" };

  return {
    title: `${gasit.modul.titlu} — modul Administrativo`,
    // Descrierea vine din catalog, tăiată la lungimea pe care o afișează
    // motoarele. Scrisă separat, ar fi al doilea text de întreținut pentru
    // aceeași informație.
    description: gasit.modul.text.slice(0, 155),
    alternates: { canonical: `/module/${cheie}` },
  };
}

export default async function PaginaModul({ params }: Proprietati) {
  const { modul: cheie } = await params;
  if (!isFeatureKey(cheie)) notFound();
  const gasit = gasesteModul(cheie);
  if (gasit === null) notFound();

  const { modul, grup } = gasit;
  const pret = PRETURI_MODULE[cheie as FeatureKey];
  const inNucleu = (MODULE_NUCLEU as readonly string[]).includes(cheie);

  // Celelalte module din același grup — navigarea laterală care lipsea.
  const vecini = grup.module.filter((m) => m.cheie !== cheie);

  return (
    <Cadru text={RO}>
      <AntetSecundar
        text={{
          supratitlu: grup.titlu,
          titlu: modul.titlu,
          lead: modul.text,
        }}
      />

      <Banda inaltime="medie">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {modul.puncte.map((punct) => (
            <li key={punct} className="border-mk-rigla/40 border-t pt-4">
              <p className="text-[0.9375rem] leading-[1.6]">{punct}</p>
            </li>
          ))}
        </ul>

        {/*
          Prețul, pe pagina modulului. E prima întrebare a cuiva care a ajuns
          aici căutând exact modulul ăsta, iar răspunsul stă în tabelul canonic,
          nu scris a doua oară.
        */}
        <div className="border-mk-rigla mt-12 border-t pt-6">
          <p className="font-mk-date text-mk-text-slab text-[0.6875rem] tracking-[0.14em] uppercase">
            Cât costă
          </p>
          <p className="mt-3 text-[1.0625rem] leading-[1.6]">
            {inNucleu ? (
              <>
                Vine în nucleu, împreună cu abonamentul de bază. Nu se cumpără separat și nu se
                poate stinge.
              </>
            ) : pret === undefined ? (
              <>Prețul acestui modul se stabilește la cerere.</>
            ) : (
              <>
                <span className="font-mk-date">{lunar(pret, "ro")}</span>, peste nucleu.{" "}
                {RO.preturi.mentiuneTva}
              </>
            )}
          </p>
          <Link
            href="/preturi"
            className="mt-4 inline-block text-[0.9375rem] underline underline-offset-4"
          >
            Vezi toate pachetele
          </Link>
        </div>
      </Banda>

      {vecini.length > 0 && (
        <Banda inaltime="scurta" supratitlu="Din același grup" titlu={grup.titlu}>
          <Registru>
            {vecini.map((vecin) => (
              <RandRegistru
                key={vecin.cheie}
                cod={vecin.cheie}
                titlu={vecin.titlu}
                text={vecin.text}
                dreapta={
                  <p className="mt-3">
                    <Link
                      href={`/module/${vecin.cheie}`}
                      className="text-[0.9375rem] underline underline-offset-4"
                    >
                      Vezi modulul
                    </Link>
                  </p>
                }
              />
            ))}
          </Registru>
          <Link
            href="/module"
            className="mt-8 inline-block text-[0.9375rem] underline underline-offset-4"
          >
            Toate cele nouăsprezece module
          </Link>
        </Banda>
      )}
    </Cadru>
  );
}
