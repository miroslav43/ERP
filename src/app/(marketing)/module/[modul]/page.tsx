// src/app/(marketing)/module/[modul]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FEATURES, isFeatureKey, type FeatureKey } from "@/config/features";
import { type Domeniu, fisaModulului } from "@/content/landing/fise-module";
import { lunar, MODULE_NUCLEU, PRETURI_MODULE } from "@/content/landing/preturi";
import { RO } from "@/content/landing/ro";
import { cheieDinSlug, slugModul } from "@/content/landing/slug-module";

import { AntetSecundar } from "../../_componente/antet-secundar";
import { Banda } from "../../_componente/banda";
import { Cadru } from "../../_componente/cadru";
import { InMana } from "../../_componente/in-mana";
import { PrinGeam } from "../../_componente/prin-geam";
import { RandRegistru, Registru } from "../../_componente/registru";
import { arePrinGeam, capturiInalteAleModulului } from "../../_componente/vitrine";

/**
 * Pagina fiecărui modul.
 *
 * ── DE CE O RUTĂ DINAMICĂ, NU NOUĂSPREZECE FIȘIERE ────────────────────────
 * Conținutul există deja în `RO.module.grupuri`, iar `generateStaticParams` îl
 * prerandează pe tot la build: rezultatul sunt nouăsprezece pagini statice,
 * exact ca și cum ar fi scrise una câte una, dar fără nouăsprezece fișiere care
 * să se despartă unul de altul la prima schimbare de format.
 *
 * ── ADRESA E UN SLUG ROMÂNESC, NU CHEIA ───────────────────────────────────
 * Până la 17 sept 2026 adresa era cheia din `features.ts` (`/module/attendance`),
 * ca să nu existe o a doua hartă slug→cheie de ținut în pas cu catalogul. Acum
 * există — `content/landing/slug-module.ts` —, iar riscul pe care îl evita
 * compromisul e acoperit altfel: `continut.test.ts` cere ca harta să aibă exact
 * cheile din catalog, `dynamicParams = false` face ca o adresă necunoscută să dea
 * 404, iar adresele vechi au redirecturi permanente în `next.config.ts`. În
 * pagină, slug-ul se transformă în cheie la intrare; mai departe totul lucrează
 * pe cheie.
 *
 * ── FIȘA DETALIATĂ ────────────────────────────────────────────────────────
 * Paginile au pornit cu ~39 de cuvinte proprii — două propoziții și trei puncte
 * din catalogul de pe `/module`. La volumul ăla o pagină e găsită și necitită:
 * verdictul obișnuit în Search Console e „crawled, currently not indexed".
 *
 * Modulele care au fișă în `fise-module.ts` primesc în plus proză proprie,
 * matricea de roluri citită din `role_permissions`, legăturile către celelalte
 * module și limitele asumate. Cele fără fișă rămân pe conținutul din catalog —
 * mai puțin, dar nu greșit.
 */

type Proprietati = Readonly<{ params: Promise<{ modul: string }> }>;

/**
 * Domeniul unei permisiuni, în română.
 *
 * `none` și absența rândului se afișează identic — pentru cine citește pagina,
 * amândouă înseamnă „nu poate". Distincția se păstrează în date, fiindcă acolo
 * contează: un `none` e o decizie scrisă, iar unde apare merită spus în proză.
 */
const ETICHETA_DOMENIU: Readonly<Record<"all" | "team" | "own" | "fara", string>> = {
  all: "tot",
  team: "echipa lui",
  own: "ale lui",
  fara: "—",
};

function eticheta(domeniu: Domeniu): string {
  if (domeniu === null || domeniu === "none") return ETICHETA_DOMENIU.fara;
  return ETICHETA_DOMENIU[domeniu];
}

/** Celulele goale se sting, ca ochiul să cadă pe ce SE poate, nu pe ce nu. */
function clasaCelula(domeniu: Domeniu): string {
  return domeniu === null || domeniu === "none" ? "text-mk-text-inv-slab/45" : "";
}

/** Modulul și grupul din care face parte, căutate o singură dată. */
function gasesteModul(cheie: string) {
  for (const grup of RO.module.grupuri) {
    const modul = grup.module.find((m) => m.cheie === cheie);
    if (modul !== undefined) return { modul, grup };
  }
  return null;
}

export function generateStaticParams(): { modul: string }[] {
  return RO.module.grupuri.flatMap((grup) =>
    grup.module.map((m) => ({ modul: slugModul(m.cheie) })),
  );
}

// Doar slug-urile prerandate răspund; orice altceva — inclusiv o cheie veche fără
// redirect — e 404, nu o pagină randată la cerere.
export const dynamicParams = false;

export async function generateMetadata({ params }: Proprietati): Promise<Metadata> {
  const { modul: slug } = await params;
  const cheie = cheieDinSlug(slug) ?? "";
  const gasit = gasesteModul(cheie);
  if (gasit === null) return { title: "Modul negăsit" };

  // Titlul din fișă e mai lung și conține cuvintele care se tastează efectiv.
  // Fără fișă se cade pe catalog: descrierea tăiată la lungimea pe care o
  // afișează motoarele, ca să nu fie al doilea text de întreținut degeaba.
  const fisa = fisaModulului(cheie);
  return {
    title: fisa?.titluPagina ?? `${gasit.modul.titlu} — modul Administrativo`,
    description: fisa?.metaDescriere ?? gasit.modul.text.slice(0, 155),
    alternates: { canonical: `/module/${slug}` },
  };
}

export default async function PaginaModul({ params }: Proprietati) {
  const { modul: slug } = await params;
  const cheie = cheieDinSlug(slug) ?? "";
  if (!isFeatureKey(cheie)) notFound();
  const gasit = gasesteModul(cheie);
  if (gasit === null) notFound();

  const { modul, grup } = gasit;
  const pret = PRETURI_MODULE[cheie as FeatureKey];
  const inNucleu = (MODULE_NUCLEU as readonly string[]).includes(cheie);
  // Fișa detaliată există deocamdată doar pentru o parte dintre module. Cele
  // fără rămân pe conținutul din catalog — mai puțin, dar nu greșit.
  const fisa = fisaModulului(cheie);

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
        firimituri={[
          { eticheta: "Acasă", href: "/" },
          { eticheta: "Module", href: "/module" },
          { eticheta: modul.titlu, href: `/module/${slug}` },
        ]}
      />

      {/*
        Chenarul „prin geam", doar pentru modulele cu vitrină construită
        (catalogul din `vitrine.ts`). Opțional prin construcție, exact ca `fisa`
        de mai jos: modulele fără vitrină nu randează nimic aici.

        `arePrinGeam` se importă din `vitrine.ts`, NU din `prin-geam.tsx`:
        fișierul acela e `"use client"`, iar aici suntem în graful de server,
        unde exporturile lui sunt referințe care aruncă la apel. Vezi
        `vitrine.test.ts`.
      */}
      {arePrinGeam(cheie) && <PrinGeam cheie={cheie} titlu={modul.titlu} />}

      {/*
        Capturile înalte, pentru modulele care se folosesc de pe telefon.
        Deocamdată doar portalul angajatului: o fereastră de birou de 1440px nu
        poate arăta un produs despre care pagina spune că se ține în mână.
      */}
      {capturiInalteAleModulului(cheie).length > 0 && (
        <InMana
          supratitlu="Ecran real"
          titlu={`${modul.titlu} pe telefonul angajatului`}
          chei={capturiInalteAleModulului(cheie)}
          // Măsurat cu Lighthouse pe 18 sept 2026: pe șablonul de modul banda
          // ajunge la ~617px de sus, iar prima imagine DEVINE elementul LCP.
          // Fără asta, ea rămâne `loading="lazy"` și își întârzie singură
          // descoperirea. Pe `/pontaj-pe-telefon` banda e sub linia de
          // plutire, deci acolo parametrul rămâne stins, deliberat.
          susInPagina
        />
      )}

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
            ) : pret !== undefined ? (
              <>
                <span className="font-mk-date">{lunar(pret, "ro")}</span>, peste nucleu.{" "}
                {RO.preturi.mentiuneTva}
              </>
            ) : // Ramură de neatins: testul „fiecare modul are preț sau e în nucleu” o
            // exclude. A stat aici „Prețul acestui modul se stabilește la cerere” —
            // o negare a prețului publicat, care aștepta prima cheie fără tarif.
            null}
          </p>
          <Link
            href="/preturi"
            className="mt-4 inline-block text-[0.9375rem] underline underline-offset-4"
          >
            Vezi toate pachetele
          </Link>
        </div>
      </Banda>

      {fisa !== undefined && (
        <>
          <Banda inaltime="medie" titlu="Cum funcționează">
            <div className="mt-6 max-w-[68ch] space-y-4">
              {fisa.intro.map((p) => (
                <p key={p} className="text-mk-text-slab text-[0.9375rem] leading-[1.7]">
                  {p}
                </p>
              ))}
            </div>
          </Banda>

          {/* Scenariul concret: cine apasă, pe ce ecran, ce rămâne în urmă.
              Partea care deosebește pagina de fișa tehnică de deasupra. */}
          {fisa.cazDeUtilizare !== undefined && (
            <Banda inaltime="medie" supratitlu="Într-o zi obișnuită" titlu="Cum arată în practică">
              <p className="text-mk-text-slab mt-6 max-w-[68ch] text-[0.9375rem] leading-[1.7]">
                {fisa.cazDeUtilizare}
              </p>
            </Banda>
          )}

          {/*
            Matricea de roluri. E partea care nu se poate copia de la altcineva,
            fiindcă descrie chiar produsul ăsta — și e singura pagină din tot
            situl unde se vede că refuzul e o decizie, nu o scăpare.

            Condiționată pe `actiuni.length`, fiindcă un modul poate să n-aibă
            NICIO permisiune proprie: `asistent` e păzit doar de comutatorul de
            modul, iar ce poate atinge depinde de permisiunile celui care
            întreabă, nu de ale lui. Fără gardă, fișa lui ar randa antetul de
            tabel gol sub un lead care promite „regulile de mai jos" — adică
            exact genul de promisiune fără acoperire pe care fișele astea există
            ca să-l elimine.
          */}
          {fisa.actiuni.length > 0 && (
            <Banda
              fundal="cerneala"
              inaltime="medie"
              supratitlu="Roluri"
              titlu="Cine ce poate face"
              aliniereTitlu="larg"
              // Fraza fixă e rezerva; un modul care țintește o căutare anume își
              // scrie lead-ul lui în fișă. Identică pe 18 pagini din 19, fraza
              // asta era una dintre sursele de n-grame comune.
              lead={
                fisa.leadRoluri ??
                "Regulile de mai jos sunt impuse în baza de date, nu în interfață. Un rol fără permisiune nu primește un buton dezactivat: cererea lui e refuzată la sursă."
              }
            >
              {/* `relative` pe containerul derulabil: fără el, orice conținut
                poziționat absolut scapă și târăște pagina lateral. */}
              <div className="relative mt-8 overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-mk-rigla-inv/40 border-b">
                      <th
                        scope="col"
                        className="font-mk-date text-mk-text-inv-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.12em] uppercase"
                      >
                        Acțiune
                      </th>
                      {["Admin", "HR", "Manager", "Angajat"].map((rol) => (
                        <th
                          key={rol}
                          scope="col"
                          className="font-mk-date text-mk-text-inv-slab py-2 pr-4 text-[0.6875rem] font-medium tracking-[0.12em] uppercase"
                        >
                          {rol}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {fisa.actiuni.map((actiune) => (
                      <tr key={actiune.cheie} className="border-mk-rigla-inv/40 border-b">
                        <th
                          scope="row"
                          className="py-2.5 pr-4 text-[0.9375rem] leading-[1.4] font-normal"
                        >
                          {actiune.ce}
                          <span className="font-mk-date text-mk-text-inv-slab ml-2 text-[0.6875rem] tracking-[0.04em] whitespace-nowrap">
                            {actiune.cheie}
                          </span>
                        </th>
                        {[actiune.orgAdmin, actiune.hr, actiune.manager, actiune.angajat].map(
                          (domeniu, i) => (
                            <td
                              key={`${actiune.cheie}-${String(i)}`}
                              className={`py-2.5 pr-4 text-[0.875rem] whitespace-nowrap ${clasaCelula(domeniu)}`}
                            >
                              {eticheta(domeniu)}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-mk-text-inv-slab mt-8 max-w-[72ch] text-[0.9375rem] leading-[1.7]">
                {fisa.notaPermisiuni}
              </p>
            </Banda>
          )}

          <Banda
            inaltime="medie"
            titlu="Ce se leagă de ce"
            lead={
              fisa.leadLegaturi ??
              "Modulele nu sunt aplicații separate care se trimit date. E aceeași bază, iar ce se aprobă într-un loc apare în celălalt o singură dată."
            }
          >
            <div className="border-mk-rigla/40 mt-8 border-t">
              {fisa.legaturi.map((legatura) => (
                <div
                  key={legatura.catre}
                  className="border-mk-rigla/40 grid gap-2 border-b py-5 md:grid-cols-12 md:gap-8"
                >
                  <h3 className="font-mk-display text-[1rem] leading-[1.25] font-semibold md:col-span-4">
                    <Link
                      href={`/module/${slugModul(legatura.catre)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {FEATURES[legatura.catre].denumire}
                    </Link>
                  </h3>
                  <p className="text-mk-text-slab text-[0.9375rem] leading-[1.6] md:col-span-8">
                    {legatura.text}
                  </p>
                </div>
              ))}
            </div>
            {fisa.ghiduri !== undefined && (
              <div className="mt-10">
                <p className="font-mk-date text-mk-text-slab text-[0.6875rem] font-medium tracking-[0.14em] uppercase">
                  Pe același subiect
                </p>
                <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                  {fisa.ghiduri.map((g) => (
                    <li key={g.href}>
                      <Link href={g.href} className="text-[0.9375rem] underline underline-offset-4">
                        {g.eticheta}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Banda>

          {/*
            Limitele, pe modul. Aceeași regulă ca pe `/de-ce-nu`: se scriu înainte
            să fie descoperite, fiindcă altfel se descoperă oricum, mai târziu și
            mai prost.
          */}
          <Banda inaltime="medie" titlu={`Ce nu face modulul ${modul.titlu}`}>
            <ul className="mt-6 max-w-[72ch] space-y-3">
              {fisa.nuFace.map((limita) => (
                <li
                  key={limita}
                  className="border-mk-rigla/40 text-mk-text-slab border-l pl-4 text-[0.9375rem] leading-[1.65]"
                >
                  {limita}
                </li>
              ))}
            </ul>
          </Banda>
        </>
      )}

      {vecini.length > 0 && (
        <Banda inaltime="scurta" supratitlu="Din același grup" titlu={grup.titlu}>
          <Registru>
            {vecini.map((vecin) => (
              <RandRegistru
                key={vecin.cheie}
                cod={vecin.cheie}
                titlu={vecin.titlu}
                // FĂRĂ `text`: banda asta retipărea descrierea din catalog a
                // fiecărui frate. În grupul „Personal" însemna 137–145 de cuvinte
                // copiate pe fiecare pagină, iar auditul din 17 sept 2026 a măsurat
                // 34–40% n-grame comune între frați — aproape tot de aici. Relația
                // dintre module se explică oricum mai sus, în „Ce se leagă de ce",
                // cu o frază proprie per pereche. Aici rămâne navigație.
                dreapta={
                  <p className="mt-3">
                    <Link
                      href={`/module/${slugModul(vecin.cheie)}`}
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
