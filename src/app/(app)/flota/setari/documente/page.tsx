// src/app/(app)/flota/setari/documente/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { FileModul } from "@/components/ui/file-modul";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { FILE_FLOTA } from "@/config/file-module";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { nomenclatorDocumente, type TipDocument } from "@/lib/queries/fleet";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import type { CategorieVehicul } from "@/schemas/fleet";

import { ETICHETE_CATEGORIE } from "../../etichete";
import { DialogTipPropriu } from "./dialog-tip-propriu";
import { SetareTip } from "./setare-tip";

export const metadata: Metadata = { title: "Tipuri de document" };

/** „Se cere pentru”, spus în cuvinte: categoriile și plafonul de masă. */
function seCerePentru(tip: TipDocument): string {
  const categorii =
    tip.categorii_aplicabile === null
      ? "orice vehicul"
      : tip.categorii_aplicabile
          .map((c) => ETICHETE_CATEGORIE[c as CategorieVehicul] ?? c)
          .join(", ")
          .toLowerCase();
  return tip.masa_max_kg === null
    ? categorii
    : `${categorii}, până la ${tip.masa_max_kg.toLocaleString("ro-RO")} kg`;
}

/**
 * Nomenclatorul de documente al firmei (0202).
 *
 * Două liste, fiindcă se schimbă diferit:
 *  · tipurile COMUNE (de platformă) — firma doar le folosește sau nu și le face
 *    obligatorii sau nu, pentru ea (`vehicle_document_type_setari`); restul
 *    firmelor nu simt nimic. Aici se activează cele patru de transport (licență,
 *    copie conformă, tahograf, ADR), retrase pentru toți în 0116;
 *  · tipurile PROPRII firmei — se creează și se modifică întregi.
 *
 * Poarta e `vehicles:update = all`, poarta politicilor de setare și de
 * modificare. Crearea unui tip propriu cere în plus `vehicles:create = all`
 * (`vdt_insert`); fără el, butonul lipsește.
 */
export default async function PaginaTipuriDocument() {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "fleet"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "vehicles:update", "all")) {
    return (
      <AccesRestrictionat mesaj="Tipurile de document ale parcului auto le stabilește administratorul organizației." />
    );
  }
  const poateCrea = can(permisiuni, "vehicles:create", "all");

  const nomenclator = await nomenclatorDocumente(tenant.organizationId);
  const comune = nomenclator.filter((t) => !t.propriu);
  const proprii = nomenclator.filter((t) => t.propriu);

  const coloaneComune: readonly Coloana<TipDocument>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (t) => (
        <>
          {t.denumire}
          {t.setare === null ? null : (
            <span className="text-muted-foreground text-nota block">
              {t.activ_platforma ? "" : "Retras din nomenclatorul comun; "}
              setat pentru firmă
            </span>
          )}
        </>
      ),
    },
    {
      cheie: "aplicabil",
      antet: "Se cere pentru",
      peTelefon: "meta",
      celula: seCerePentru,
    },
    {
      cheie: "setare",
      antet: "Pentru firma dumneavoastră",
      // `actiuni`, nu `meta`: celula e un `<form>`, iar `meta` se randează pe
      // telefon într-un `<p>` — marcaj nevalid, hidratare ratată (React #418).
      peTelefon: "actiuni",
      celula: (t) => (
        <SetareTip tipId={t.id} denumire={t.denumire} activ={t.activ} obligatoriu={t.obligatoriu} />
      ),
    },
  ];

  const coloaneProprii: readonly Coloana<TipDocument>[] = [
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "titlu",
      celula: (t) => (
        <>
          {t.denumire}
          {t.descriere === null ? null : (
            <span className="text-muted-foreground text-nota block">{t.descriere}</span>
          )}
        </>
      ),
    },
    {
      cheie: "aplicabil",
      antet: "Se cere pentru",
      peTelefon: "meta",
      celula: seCerePentru,
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (t) =>
        !t.activ ? (
          <Badge ton="neutru">Retras</Badge>
        ) : t.obligatoriu ? (
          <Badge ton="succes">Obligatoriu</Badge>
        ) : (
          <Badge ton="neutru">Opțional</Badge>
        ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      antetAscuns: true,
      latime: "ingusta",
      peTelefon: "actiuni",
      celula: (t) => <DialogTipPropriu tip={t} />,
    },
  ];

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Tipuri de document"
        descriere="Ce documente ține firma pentru fiecare vehicul și care dintre ele aprind semaforul în roșu când lipsesc. Remorcile nu cer trusă și stingător, iar rovinieta se cere doar până la 3,5 t."
        file={<FileModul eticheta="Navigare parc auto" file={FILE_FLOTA} tenant={tenant} />}
      />

      <section aria-labelledby="tipuri-comune" className="space-y-3">
        <h2 id="tipuri-comune" className="text-sectiune font-semibold">
          Nomenclatorul comun
        </h2>
        <p className="text-muted-foreground text-corp">
          Tipurile pe care le are orice firmă. Puteți renunța la unul sau îl puteți face obligatoriu
          doar pentru firma dumneavoastră; documentele deja înregistrate rămân pe fișele
          vehiculelor.
        </p>
        <Tabel
          caption="Tipurile de document din nomenclatorul comun și setarea firmei pentru fiecare."
          coloane={coloaneComune}
          randuri={comune}
          cheieRand={(t) => t.id}
          gol={<p className="text-muted-foreground text-corp">Nomenclatorul comun este gol.</p>}
        />
      </section>

      <section aria-labelledby="tipuri-proprii" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="tipuri-proprii" className="text-sectiune font-semibold">
            Tipurile firmei
          </h2>
          {poateCrea ? <DialogTipPropriu /> : null}
        </div>
        <Tabel
          caption="Tipurile de document create de firmă."
          coloane={coloaneProprii}
          randuri={proprii}
          cheieRand={(t) => t.id}
          gol={
            <p className="text-muted-foreground text-corp">
              Firma nu are tipuri proprii. Adăugați unul pentru un document pe care nomenclatorul
              comun nu-l are — o autorizație locală, un permis de acces.
            </p>
          }
        />
      </section>
    </div>
  );
}
