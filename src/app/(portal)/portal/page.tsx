// src/app/(portal)/portal/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import {
  CalendarDays,
  Clock,
  FileText,
  Megaphone,
  Plus,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { getEnabledFeatures } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, oraInBucharest, todayInBucharest } from "@/lib/format/date";
import { citestePerioada, setariPontaj } from "@/lib/queries/attendance";
import { configZiDin, intervalulPropus } from "@/domain/attendance/calcul-ore";
import { stareaCeasului } from "@/domain/attendance/ceas";
import { formatOreCuUnitate } from "@/lib/format/ore";
import { cn } from "@/lib/ui/cn";
import { anunturiPublicate, idAnunturiCitite } from "@/lib/queries/announcements";
import { cursurileMele, restanteDinCursuri } from "@/lib/queries/cursuri";
import {
  cererileMele,
  fisaMea,
  pontajulMeu,
  soldurileMele,
  tipuriConcediu,
} from "@/lib/queries/portal";
import { meritaPontata } from "@/domain/attendance/zi-de-pontat";

import { ETICHETE_STATUS_CERERE, ETICHETE_TIP_ZI, TONURI_STATUS_CERERE } from "./etichete";
import { FaraFisa } from "./fara-fisa";
import { IndemnInstalare } from "./indemn-instalare";
import { PontareRapida } from "./pontare-rapida";

export const metadata: Metadata = { title: "Portalul meu" };

/** Statusurile care încă așteaptă un răspuns de la altcineva. */
const IN_ASTEPTARE: ReadonlySet<string> = new Set(["trimisa", "in_aprobare"]);

export default async function PaginaPortal() {
  const { tenant, user } = await requireTenant();
  const [moduleActive, permisiuni, stare] = await Promise.all([
    getEnabledFeatures(tenant.organizationId),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    fisaMea(tenant.organizationId, user.id),
  ]);

  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const fisa = stare.fisa;

  const azi = todayInBucharest();
  const an = Number(azi.slice(0, 4));
  const luna = Number(azi.slice(5, 7));

  // Porțile se verifică ÎNAINTE de a compune promisiunea, nu după: un
  // `Promise.resolve([])` pus în urma unei interogări deja plecate ar plăti
  // oricum drumul dus-întors.
  const vedeConcedii = moduleActive.has("leave") && can(permisiuni, "leave:read", "own");
  const vedePontaj = moduleActive.has("attendance") && can(permisiuni, "attendance:read", "own");
  const vedeAnunturi =
    moduleActive.has("announcements") && can(permisiuni, "announcements:read", "own");
  const vedeCursuri = moduleActive.has("courses") && can(permisiuni, "courses:read", "own");
  const poateCereConcediu = moduleActive.has("leave") && can(permisiuni, "leave:create", "own");
  const poatePontaZiua =
    moduleActive.has("attendance") && can(permisiuni, "attendance:create", "own");

  const [solduri, cereri, tipuri, zile, anunturi, citite, cursuri, perioada, setari] =
    await Promise.all([
      vedeConcedii ? soldurileMele(tenant.organizationId, an, fisa.id) : Promise.resolve([]),
      vedeConcedii ? cererileMele(tenant.organizationId, fisa.id, 20) : Promise.resolve([]),
      vedeConcedii
        ? tipuriConcediu(tenant.organizationId)
        : Promise.resolve(new Map<string, { denumire: string; scade_din_sold: boolean }>()),
      vedePontaj ? pontajulMeu(tenant.organizationId, an, luna, fisa.id) : Promise.resolve([]),
      vedeAnunturi
        ? anunturiPublicate(tenant.organizationId, new Date().toISOString())
        : Promise.resolve([]),
      vedeAnunturi
        ? idAnunturiCitite(tenant.organizationId, fisa.id)
        : Promise.resolve(new Set<string>()),
      vedeCursuri ? cursurileMele(tenant.organizationId, fisa.id) : Promise.resolve([]),
      // Perioada și setările intră în ACELAȘI `Promise.all`, nu după el: puse în
      // urma unei interogări deja plecate, ar plăti un al doilea drum dus-întors
      // pe fiecare deschidere a aplicației.
      poatePontaZiua ? citestePerioada(tenant.organizationId, an, luna) : Promise.resolve(null),
      poatePontaZiua ? setariPontaj(tenant.organizationId, azi) : Promise.resolve(null),
    ]);

  // Soldul despre care se întreabă e cel de odihnă: dintre tipurile care SCAD
  // din sold, cel cu dreptul anual cel mai mare. Fără filtrul pe
  // `scade_din_sold`, un „concediu fără plată" configurat cu plafon generos ar
  // urca în față cu o cifră exactă și fără niciun înțeles.
  const soldPrincipal =
    [...solduri]
      .filter((s) => tipuri.get(s.leave_type_id)?.scade_din_sold === true)
      .sort((a, b) => b.drept_anual - a.drept_anual)[0] ?? null;

  const ziDeAzi = zile.find((z) => z.data === azi) ?? null;

  /*
   * Pontarea rapidă (0096). Modul e `oprit` până când firma îl aprinde din
   * `/pontaj/setari`, deci pentru orice organizație existentă ecranul rămâne
   * exact ce era.
   *
   * Ora vine din ceasul SERVERULUI, ca și la scriere: aici doar decide ce buton
   * se desenează, dar dacă ecranul și acțiunea ar folosi ceasuri diferite,
   * butonul ar arăta „Am ieșit" pentru o zi pe care serverul o crede neîncepută.
   */
  const modPontare = setari?.mod_pontare_rapida ?? "oprit";
  const configZi = configZiDin(setari);
  const stareCeas = stareaCeasului(ziDeAzi, oraInBucharest(new Date()));
  const intervalPropus =
    setari?.program_start === null || setari?.program_start === undefined
      ? null
      : intervalulPropus(setari.program_start.slice(0, 5), configZi);
  const oreLuna = zile.reduce((total, z) => total + (z.ore_lucrate ?? 0), 0);
  const suplimentareLuna = zile.reduce((total, z) => total + (z.ore_suplimentare ?? 0), 0);

  /*
   * Cardul „Astăzi" se face auzit doar când e ceva de făcut CHIAR AZI: ziua nu e
   * pontată, omul are dreptul s-o ponteze, iar firma chiar lucrează în ziua asta.
   * Ultima condiție e cea care lipsea: `ziDeAzi` e `null` și sâmbăta, deci fără
   * `meritaPontata` cardul ar fi strigat „pontează-te acum" în repausul
   * săptămânal al fiecărui birou.
   */
  const promoveazaPontaj =
    poatePontaZiua &&
    ziDeAzi === null &&
    meritaPontata(
      azi,
      setari === null
        ? null
        : {
            lucreazaWeekend: setari.lucreaza_weekend,
            lucreazaSarbatori: setari.lucreaza_sarbatori,
          },
    );

  /*
   * Contorul de cursuri vine din ACEEAȘI listă pe care o afișează ecranul, nu
   * dintr-un `count()` separat. O interogare care numără și una care listează
   * diverg întotdeauna, la momentul cel mai prost — în acest repo, contorul de
   * sarcini de aprobare a afișat „7 de semnat" la nesfârșit.
   */
  const restante = restanteDinCursuri(cursuri, azi);

  const inAsteptare = cereri.filter((c) => IN_ASTEPTARE.has(c.status));
  const necitite = anunturi.filter((a) => !citite.has(a.id));

  return (
    // Ordinea în DOM e aceeași pe ambele ecrane — se schimbă doar așezarea. Așa,
    // ordinea de citire la tastatură și la cititorul de ecran rămâne una singură,
    // iar nimeni nu întreține două.
    <div className="mx-auto max-w-6xl space-y-3 p-4 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
      <div className="space-y-3 lg:sticky lg:top-20">
        <section className="bg-surface border-border rounded-panou border p-4">
          <p className="text-muted-foreground text-nota">Bună ziua,</p>
          <p className="text-foreground text-titlu font-semibold">{fisa.full_name ?? fisa.marca}</p>
          <p className="text-muted-foreground text-corp mt-1">
            Marca {fisa.marca}
            {fisa.hired_on === null ? null : ` · angajat din ${formatDate(fisa.hired_on)}`}
          </p>
        </section>

        {/*
          Invitația de instalare stă sub salut, nu peste el: e utilă o dată, iar
          după ce omul a instalat (sau a închis-o) dispare definitiv. Componenta
          decide singură — pe laptop și în aplicația deja instalată nu randează
          nimic, deci nu are nevoie de nicio poartă aici.
        */}
        <IndemnInstalare />

        {/*
          Cardul promovat al cursurilor. DISPARE complet când nu e nimic de
          făcut — nu devine „0 cursuri". Un contor pe zero e zgomot care învață
          omul să nu se mai uite.
        */}
        {restante.deFacut === 0 ? null : (
          <section
            aria-labelledby="cursuri-restante"
            className="border-primary bg-surface rounded-panou border p-4"
          >
            <h2 id="cursuri-restante" className="text-foreground font-semibold">
              {restante.deFacut === 1
                ? "Aveți un curs de parcurs"
                : `Aveți ${String(restante.deFacut)} cursuri de parcurs`}
            </h2>
            {restante.celMaiApropiatTermen === null ? null : (
              <p className="text-muted-foreground text-corp mt-1">
                {restante.celMaiApropiatTermen < azi
                  ? `Unul are termenul depășit din ${formatDate(restante.celMaiApropiatTermen)}.`
                  : `Cel mai apropiat termen: ${formatDate(restante.celMaiApropiatTermen)}.`}
              </p>
            )}
            <Link
              href="/portal/cursurile-mele"
              className={cn(buton({ varianta: "primar" }), "mt-3")}
            >
              Începeți acum
            </Link>
          </section>
        )}

        {soldPrincipal === null ? null : (
          <section
            aria-labelledby="sold"
            className="bg-primary text-primary-foreground rounded-panou p-4"
          >
            <h2 id="sold" className="text-corp font-medium opacity-90">
              Zile de concediu rămase în {an}
            </h2>
            <p className="mt-1 text-4xl font-semibold tabular-nums">
              {(soldPrincipal.ramase ?? 0).toLocaleString("ro-RO")}
            </p>
            <p className="text-corp mt-2 opacity-90">
              din {soldPrincipal.drept_anual.toLocaleString("ro-RO")} · folosite{" "}
              {soldPrincipal.folosite.toLocaleString("ro-RO")}
              {soldPrincipal.in_asteptare > 0
                ? ` · în așteptare ${soldPrincipal.in_asteptare.toLocaleString("ro-RO")}`
                : null}
            </p>
            {/* Fiecare buton primar stă în cardul de care se leagă, iar cardul
                apare doar când are ce cere: cursuri restante, sold de concediu,
                ziua nepontată. Comentariul de aici a spus cândva „singurul buton
                primar de pe ecran" — nu mai e adevărat de la cardul de cursuri
                încoace, iar afirmația falsă e mai rea decât regula lipsă.
                Pe telefon nu există buton plutitor: bara de jos are deja cinci
                ținte pentru degetul mare, iar al șaselea le-ar acoperi. */}
            {poateCereConcediu ? (
              <Link
                href="/portal/concediile-mele/noua"
                className={cn(
                  buton({ varianta: "primar" }),
                  // Cardul e deja `bg-primary`: paleta butonului se INVERSEAZĂ,
                  // altfel ar dispărea în fundal.
                  "bg-primary-foreground text-primary hover:bg-primary-foreground mt-4",
                )}
              >
                <Plus aria-hidden="true" className="size-4" />
                Cerere nouă
              </Link>
            ) : null}
          </section>
        )}
      </div>

      <div className="space-y-3">
        {vedePontaj && promoveazaPontaj ? (
          /*
            Aceeași croială ca la cardul de sold: fundal plin, o cifră mare și
            butonul în cardul de care se leagă. Diferă ce spune cifra — acolo e
            un drept care se consumă, aici e o zi care lipsește.
          */
          <section
            aria-labelledby="azi"
            className="bg-primary text-primary-foreground rounded-panou p-4"
          >
            <h2 id="azi" className="text-corp font-medium opacity-90">
              Astăzi nu e pontat nimic
            </h2>
            <p className="mt-1 text-4xl font-semibold tabular-nums">0 ore</p>
            <p className="text-corp mt-2 opacity-90">
              Luna aceasta: {oreLuna.toLocaleString("ro-RO")} ore
              {suplimentareLuna > 0
                ? ` · ${suplimentareLuna.toLocaleString("ro-RO")} suplimentare`
                : null}
            </p>
            <Link
              href={`/portal/pontajul-meu/zi/${azi}`}
              className={cn(
                buton({ varianta: "primar" }),
                // Cardul e deja `bg-primary`: paleta butonului se INVERSEAZĂ.
                "bg-primary-foreground text-primary hover:bg-primary-foreground mt-4",
              )}
            >
              <Clock aria-hidden="true" className="size-4" />
              Pontează-te acum
            </Link>
          </section>
        ) : vedePontaj ? (
          <section
            aria-labelledby="azi"
            className="bg-surface border-border rounded-panou border p-4"
          >
            <h2 id="azi" className="text-foreground text-corp font-semibold">
              Astăzi
            </h2>
            {poatePontaZiua && modPontare !== "oprit" ? (
              <PontareRapida
                stare={stareCeas}
                mod={modPontare}
                intervalPropus={intervalPropus}
                numeFirma={tenant.name}
                cereCod={(setari?.verificare_pontare ?? "fara") === "cod_qr"}
                lunaDeschisa={perioada !== null && perioada.status === "deschisa"}
              />
            ) : null}

            {ziDeAzi === null ? (
              <>
                {modPontare === "oprit" ? (
                  <p className="text-muted-foreground text-corp mt-1">
                    Nu e pontat nimic pe ziua de azi.
                  </p>
                ) : null}
                {/* Formularul cu ore rămâne accesibil chiar și cu pontarea
                    rapidă pornită: ziua neobișnuită — venit mai târziu, plecat
                    mai devreme — se completează tot de aici. */}
                {poatePontaZiua && perioada !== null && perioada.status === "deschisa" ? (
                  <Link
                    href={`/portal/pontajul-meu/zi/${azi}`}
                    className="text-primary text-corp mt-2 inline-block underline-offset-2 hover:underline"
                  >
                    {modPontare === "oprit" ? "Completează ziua" : "A fost altfel? Scrie orele"}
                  </Link>
                ) : null}
              </>
            ) : ziDeAzi.tip_zi !== "lucratoare" ? (
              <p className="text-foreground text-corp mt-1">
                {ETICHETE_TIP_ZI[ziDeAzi.tip_zi] ?? ziDeAzi.tip_zi}
              </p>
            ) : (
              <p className="text-foreground text-corp mt-1">
                <span className="text-titlu font-semibold tabular-nums">
                  {(ziDeAzi.ore_lucrate ?? 0).toLocaleString("ro-RO")}
                </span>{" "}
                ore pontate
                {(ziDeAzi.ore_suplimentare ?? 0) > 0
                  ? ` · ${(ziDeAzi.ore_suplimentare ?? 0).toLocaleString("ro-RO")} suplimentare`
                  : null}
              </p>
            )}
            <p className="text-muted-foreground border-border text-corp mt-3 border-t pt-3">
              Luna aceasta:{" "}
              <span className="text-foreground font-medium tabular-nums">
                {oreLuna.toLocaleString("ro-RO")}
              </span>{" "}
              ore
              {suplimentareLuna > 0
                ? ` · ${suplimentareLuna.toLocaleString("ro-RO")} suplimentare`
                : null}
            </p>
          </section>
        ) : null}

        {inAsteptare.length === 0 ? null : (
          <section aria-labelledby="asteapta" className="space-y-2">
            <h2 id="asteapta" className="text-foreground text-corp font-semibold">
              Așteaptă răspuns
            </h2>
            <ul className="space-y-2">
              {inAsteptare.slice(0, 3).map((cerere) => (
                <li key={cerere.id}>
                  {/* Rândul întreg e ținta de atingere: pe telefon, un link
                      îngust într-un card de trei rânduri se ratează. */}
                  <Link
                    href={`/portal/concediile-mele/${cerere.id}`}
                    className="bg-surface border-border hover:border-ring rounded-panou flex items-start justify-between gap-3 border p-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground text-corp font-medium">
                        {tipuri.get(cerere.leave_type_id)?.denumire ?? "Concediu"}
                      </p>
                      <p className="text-muted-foreground text-corp">
                        {formatDate(cerere.data_inceput)} – {formatDate(cerere.data_sfarsit)}
                        {cerere.zile_lucratoare === null
                          ? null
                          : ` · ${cerere.zile_lucratoare.toLocaleString("ro-RO")} zile`}
                      </p>
                    </div>
                    <Badge
                      className="shrink-0"
                      ton={TONURI_STATUS_CERERE[cerere.status] ?? "neutru"}
                    >
                      {ETICHETE_STATUS_CERERE[cerere.status] ?? cerere.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
            {inAsteptare.length > 3 ? (
              <Link
                href="/portal/concediile-mele"
                className="text-primary text-nota underline-offset-2 hover:underline"
              >
                și încă {(inAsteptare.length - 3).toLocaleString("ro-RO")}
              </Link>
            ) : null}
          </section>
        )}
      </div>

      <div className="space-y-3">
        {necitite.length === 0 ? null : (
          <section aria-labelledby="anunturi" className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="anunturi" className="text-foreground text-corp font-semibold">
                {necitite.length.toLocaleString("ro-RO")}{" "}
                {necitite.length === 1 ? "anunț necitit" : "anunțuri necitite"}
              </h2>
              <Link
                href="/portal/anunturi"
                className="text-primary text-nota underline-offset-2 hover:underline"
              >
                Toate
              </Link>
            </div>
            <ul className="space-y-2">
              {necitite.slice(0, 3).map((anunt) => (
                <li key={anunt.id}>
                  <Link
                    href={`/portal/anunturi/${anunt.id}`}
                    className="bg-surface border-border hover:border-ring rounded-panou flex min-h-11 items-center justify-between gap-3 border p-3 transition-colors"
                  >
                    <span className="text-foreground text-corp min-w-0 truncate font-medium">
                      {anunt.titlu}
                    </span>
                    <span
                      aria-label="Necitit"
                      className="bg-primary size-2 shrink-0 rounded-full"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav
          aria-label="Scurtături"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1"
        >
          {vedeConcedii ? (
            <Scurtatura
              href="/portal/concediile-mele"
              eticheta="Concediile mele"
              descriere={`${cereri.length.toLocaleString("ro-RO")} cereri`}
              Iconita={CalendarDays}
            />
          ) : null}
          {vedePontaj ? (
            <Scurtatura
              href="/portal/pontajul-meu"
              eticheta="Pontajul meu"
              descriere={`${formatOreCuUnitate(oreLuna)} luna aceasta`}
              Iconita={Clock}
            />
          ) : null}
          {moduleActive.has("payroll") && can(permisiuni, "payroll:read", "own") ? (
            <Scurtatura
              href="/portal/salariul-meu"
              eticheta="Salariul meu"
              descriere="Ultimul fluturaș aprobat"
              Iconita={Wallet}
            />
          ) : null}
          {vedeAnunturi ? (
            <Scurtatura
              href="/portal/anunturi"
              eticheta="Anunțuri"
              descriere={`${anunturi.length.toLocaleString("ro-RO")} pe avizier`}
              Iconita={Megaphone}
            />
          ) : null}
          {moduleActive.has("employee_portal") && can(permisiuni, "employees:read", "own") ? (
            <Scurtatura
              href="/portal/documentele-mele"
              eticheta="Documentele mele"
              descriere="Adeverințe și fișe"
              Iconita={FileText}
            />
          ) : null}
        </nav>
      </div>
    </div>
  );
}

function Scurtatura({
  href,
  eticheta,
  descriere,
  Iconita,
}: {
  readonly href: string;
  readonly eticheta: string;
  readonly descriere: string;
  readonly Iconita: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="bg-surface border-border hover:border-ring rounded-panou flex min-h-16 items-center gap-3 border p-4 transition-colors"
    >
      <Iconita aria-hidden="true" className="text-primary size-5 shrink-0" />
      <span className="min-w-0">
        <span className="text-foreground text-corp block font-medium">{eticheta}</span>
        <span className="text-muted-foreground text-nota block">{descriere}</span>
      </span>
    </Link>
  );
}
