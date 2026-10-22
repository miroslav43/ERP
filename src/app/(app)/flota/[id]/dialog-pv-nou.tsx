// src/app/(app)/flota/[id]/dialog-pv-nou.tsx
//
// Caseta „Proces-verbal nou” deschisă prin parametru de pe fișa vehiculului
// (`?pv=nou&primita=…` / `&predata=…`, 0215, F12c). Server component: citește
// documentele curente ale vehiculului (bifele propuse) și calculează
// avertismentele, apoi dă casetei client valorile inițiale.
//
// Logica stă aici, nu în `page.tsx`: pagina fișei e editată și de celelalte
// extensii ale flotei, deci primește doar un import și un element (README F12
// §2.2, „regula de o linie”).
import type { ReactElement } from "react";

import { avertismentePv, bifePropuse, type DatePv } from "@/domain/fleet/proces-verbal";
import { toBucharestDateString, todayInBucharest } from "@/lib/format/date";
import type { AlocareVehicul } from "@/lib/queries/fleet";
import { documenteleCurenteLaBord } from "@/lib/queries/fleet-pv";
import type { CategorieVehicul, Combustibil } from "@/schemas/fleet";

import {
  capatDinParametri,
  descriereParti,
  eAlocareDinIstoric,
  type CapeteAlocare,
} from "./capete-pv";
import { DialogPv } from "./dialog-pv";

interface Proprietati {
  readonly organizationId: string;
  readonly vehicul: Readonly<{
    id: string;
    categorie: CategorieVehicul;
    tip_combustibil: Combustibil;
    km_curent: number;
    anvelope_montate: string | null;
  }>;
  readonly alocari: readonly AlocareVehicul[];
  readonly capete: ReadonlyMap<string, CapeteAlocare>;
  readonly parametri: Record<string, string | string[] | undefined>;
}

const unic = (v: string | string[] | undefined): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

export async function DialogPvNou({
  organizationId,
  vehicul,
  alocari,
  capete,
  parametri,
}: Proprietati): Promise<ReactElement | null> {
  if (unic(parametri["pv"]) !== "nou") return null;
  const nou = capatDinParametri(capete, unic(parametri["predata"]), unic(parametri["primita"]));
  if (nou === null) return null;

  const predata = nou.predata === null ? null : (alocari.find((a) => a.id === nou.predata) ?? null);
  const primita = nou.primita === null ? null : (alocari.find((a) => a.id === nou.primita) ?? null);
  const moment = primita?.de_la ?? predata?.pana_la ?? null;
  if (moment === null) return null;

  const kmAlocare = primita?.km_predare ?? predata?.km_restituire ?? null;
  const documente = await documenteleCurenteLaBord(organizationId, vehicul.id);
  const bife = bifePropuse(documente.flatMap((d) => (d.tip === null ? [] : [d.tip.cod])));
  const ziua = toBucharestDateString(new Date(moment));
  const anvelope =
    vehicul.anvelope_montate === "vara" ||
    vehicul.anvelope_montate === "iarna" ||
    vehicul.anvelope_montate === "all_season"
      ? vehicul.anvelope_montate
      : null;

  const ciorna: DatePv = {
    tip:
      predata !== null && primita !== null
        ? "transfer"
        : primita !== null
          ? "predare"
          : "restituire",
    stare: "ciorna",
    moment,
    data_pv: ziua,
    numar: "",
    numar_registru: null,
    km_bord: kmAlocare ?? vehicul.km_curent,
    nivel_rezervor: null,
    numar_chei: null,
    stare_generala: null,
    anvelope,
    documente_bord: bife.documente,
    dotari: bife.dotari,
    daune_constatate: null,
    daune: [],
    observatii: null,
    finalizat_la: null,
    confirmat_predator_la: null,
    confirmat_primitor_la: null,
    anulat_la: null,
    motiv_anulare: null,
  };
  const avertismente = avertismentePv(ciorna, {
    categorie: vehicul.categorie,
    documente: documente.map((d) => ({
      cod: d.tip?.cod ?? "",
      denumire: d.tip?.denumire ?? "Document",
      numar: d.numar,
      expira_la: d.expira_la,
      valabil: d.expira_la === null || d.expira_la >= ziua,
    })),
    kmCurentVehicul: vehicul.km_curent,
    predecesorLipit: null,
    alocareDinIstoric: eAlocareDinIstoric((primita ?? predata)?.observatii ?? null),
    ziuaIntocmirii: todayInBucharest(),
  });

  return (
    <DialogPv
      key={`${nou.predata ?? "-"}:${nou.primita ?? "-"}`}
      vehiculId={vehicul.id}
      categorie={vehicul.categorie}
      combustibil={vehicul.tip_combustibil}
      pvId={null}
      alocari={nou}
      kmAlocare={kmAlocare}
      initiale={{
        km_bord: ciorna.km_bord,
        nivel_rezervor: null,
        numar_chei: null,
        stare_generala: null,
        anvelope,
        documente_bord: bife.documente,
        dotari: bife.dotari,
        daune_constatate: null,
        daune: [],
        observatii: null,
      }}
      parti={descriereParti(
        // Capătul există, dar fișa poate fi ascunsă de RLS (capcana 18): „—”, nu „firmă”.
        predata === null ? null : (predata.sofer?.full_name ?? "—"),
        primita === null ? null : (primita.sofer?.full_name ?? "—"),
      )}
      avertismente={avertismente}
      deschisInitial
      etichetaDeclansator="Proces-verbal nou"
    />
  );
}
