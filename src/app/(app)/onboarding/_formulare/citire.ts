// src/app/(app)/onboarding/_formulare/citire.ts
//
// Traducerea stării asistentului în încărcătura acțiunii, și înapoi.
//
// Funcțiile de aici sunt PURE și trăiesc în afara componentei fiindcă testul
// rulează exact ce rulează ecranul. Dacă asistentul și-ar construi singur
// obiectul, testul ar măsura un contract pe care nu-l folosește nimeni — exact
// felul în care 1868 de teste au trecut peste un modul mort.

import type {
  ChecklistFelPas,
  ChecklistResponsabilTip,
  ChecklistTip,
  EtapaAsistentInput,
  PasAsistentInput,
  SalveazaSablonInput,
} from "@/schemas/checklist";

/** Un pas, așa cum îl ține ecranul: totul text, ca într-un formular. */
export interface StarePas {
  readonly id?: string;
  readonly titlu: string;
  readonly descriere: string;
  readonly fel: ChecklistFelPas;
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: string;
  readonly responsabil_employee_id: string;
  readonly termen_zile_relativ: string;
  readonly obligatoriu: boolean;
  readonly curs_id: string;
  readonly material_id: string;
}

export interface StareEtapa {
  readonly id?: string;
  readonly titlu: string;
  readonly descriere: string;
  readonly termen_zile_relativ: string;
  readonly pasi: readonly StarePas[];
}

export interface StareSablon {
  readonly id?: string;
  readonly denumire: string;
  readonly tip: ChecklistTip;
  readonly descriere: string;
  readonly department_id: string;
  readonly job_position_id: string;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string;
  readonly etape: readonly StareEtapa[];
  readonly pasi_fara_etapa: readonly StarePas[];
}

/**
 * Cardul ales de om → cele două coloane din care baza derivă `fel`.
 *
 * E singurul loc în care asistentul traduce o alegere în coloane. Inversa lui
 * `app.checklist_fel_derivat` (0089), care e sursa de adevăr: acolo `fel` e o
 * coloană GENERATĂ și nu se poate scrie. Aici doar pregătim intrarea din care
 * baza o va calcula, deci cele două nu pot diverge — cel mult putem trimite o
 * combinație pe care CHECK-urile o refuză, și atunci se vede pe loc.
 */
export function campuriDinFel(fel: ChecklistFelPas): {
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  readonly verificare_automata: string;
  /** `_automat_ck` cere `obligatoriu` pentru orice verificare automată. */
  readonly obligatoriuImpus: boolean;
} {
  switch (fel) {
    case "fisier":
      return { tip_dovada: "document", verificare_automata: "", obligatoriuImpus: false };
    case "semnatura":
      return { tip_dovada: "semnatura", verificare_automata: "", obligatoriuImpus: false };
    case "curs":
      return { tip_dovada: "bifa", verificare_automata: "curs_finalizat", obligatoriuImpus: true };
    case "citire":
      // Materialul nu e o „verificare automată”: pasul se bifează la
      // confirmarea citirii, printr-un trigger, nu dintr-un alt modul. Dar
      // `_material_ck` cere `obligatoriu`, deci îl impunem la fel.
      return { tip_dovada: "bifa", verificare_automata: "", obligatoriuImpus: true };
    case "automat":
      return {
        tip_dovada: "bifa",
        verificare_automata: "inventar_returnat",
        obligatoriuImpus: true,
      };
    case "bifa":
    default:
      return { tip_dovada: "bifa", verificare_automata: "", obligatoriuImpus: false };
  }
}

/** Coloanele unui pas existent → cardul pe care asistentul îl arată selectat. */
export function felDinCampuri(
  tipDovada: string,
  verificare: string | null,
  materialId?: string | null,
): ChecklistFelPas {
  if (verificare === "curs_finalizat") return "curs";
  if (verificare === "inventar_returnat") return "automat";
  if (materialId != null && materialId !== "") return "citire";
  if (tipDovada === "document") return "fisier";
  if (tipDovada === "semnatura") return "semnatura";
  return "bifa";
}

/** Un pas gol, cu implicitele care au sens într-un parcurs de integrare. */
export function pasNou(): StarePas {
  return {
    titlu: "",
    descriere: "",
    fel: "bifa",
    // `subiect`, nu `rol`: într-un onboarding cazul obișnuit e „o face noul
    // angajat”, iar până la 0089 era exact cazul care nu se putea exprima.
    responsabil_tip: "subiect",
    responsabil_rol: "",
    responsabil_employee_id: "",
    termen_zile_relativ: "0",
    obligatoriu: true,
    curs_id: "",
    material_id: "",
  };
}

export function etapaNoua(titlu: string, termen: string): StareEtapa {
  return { titlu, descriere: "", termen_zile_relativ: termen, pasi: [] };
}

/**
 * Etapele propuse la un șablon nou.
 *
 * Nu sunt obligatorii — se pot șterge sau redenumi — dar un ecran gol nu spune
 * nimic despre ce se așteaptă de la el, iar termenele negative sunt exact
 * lucrul pe care nimeni nu-l ghicește singur.
 */
export function etapeImplicite(): readonly StareEtapa[] {
  return [
    etapaNoua("Înainte de prima zi", "-5"),
    etapaNoua("Prima zi", "0"),
    etapaNoua("Prima săptămână", "7"),
    etapaNoua("Prima lună", "30"),
  ];
}

function intrarePas(pas: StarePas): PasAsistentInput {
  const campuri = campuriDinFel(pas.fel);
  return {
    ...(pas.id === undefined ? {} : { id: pas.id }),
    titlu: pas.titlu.trim(),
    descriere: pas.descriere.trim(),
    // Câmpul celuilalt tip de responsabil nu pleacă la server: `_responsabil_ck`
    // cere EXACT una dintre combinații, iar ce a rămas scris într-un control
    // care nu mai e randat ar face refuzul să pară fără cauză.
    responsabil_tip: pas.responsabil_tip,
    responsabil_rol: pas.responsabil_tip === "rol" ? pas.responsabil_rol : "",
    responsabil_employee_id: pas.responsabil_tip === "angajat" ? pas.responsabil_employee_id : "",
    termen_zile_relativ: pas.termen_zile_relativ,
    obligatoriu: campuri.obligatoriuImpus ? true : pas.obligatoriu,
    tip_dovada: campuri.tip_dovada,
    verificare_automata: campuri.verificare_automata,
    curs_id: pas.fel === "curs" ? pas.curs_id : "",
    material_id: pas.fel === "citire" ? pas.material_id : "",
  } as PasAsistentInput;
}

/** Starea ecranului → încărcătura lui `salveazaSablon`. Cheile sunt EXACT cele din schemă. */
export function intrareSablon(stare: StareSablon): SalveazaSablonInput {
  return {
    ...(stare.id === undefined ? {} : { id: stare.id }),
    denumire: stare.denumire.trim(),
    tip: stare.tip,
    descriere: stare.descriere.trim(),
    department_id: stare.department_id,
    job_position_id: stare.job_position_id,
    activ: stare.activ,
    valabil_de_la: stare.valabil_de_la,
    valabil_pana_la: stare.valabil_pana_la,
    // Etapele GOALE se trimit: o etapă fără pași e legitimă în constructor, iar
    // ștergerea ei tăcută la salvare ar face munca omului să dispară.
    etape: stare.etape.map((etapa): EtapaAsistentInput => ({
      ...(etapa.id === undefined ? {} : { id: etapa.id }),
      titlu: etapa.titlu.trim(),
      descriere: etapa.descriere.trim(),
      termen_zile_relativ: etapa.termen_zile_relativ,
      pasi: etapa.pasi.map(intrarePas),
    })),
    pasi_fara_etapa: stare.pasi_fara_etapa.map(intrarePas),
  } as SalveazaSablonInput;
}

/** Câți pași are șablonul, peste toate etapele. Poarta din 0088 refuză zero. */
export function numarPasi(stare: StareSablon): number {
  return (
    stare.etape.reduce((suma, etapa) => suma + etapa.pasi.length, 0) + stare.pasi_fara_etapa.length
  );
}

/** Mută un element într-o listă, fără să mute nimic dacă ținta e în afara ei. */
export function muta<T>(lista: readonly T[], de: number, la: number): readonly T[] {
  if (de === la || de < 0 || la < 0 || de >= lista.length || la >= lista.length) return lista;
  const copie = [...lista];
  const [element] = copie.splice(de, 1);
  if (element === undefined) return lista;
  copie.splice(la, 0, element);
  return copie;
}

/** Antetul unui șablon citit din bază, exact cât îi trebuie asistentului. */
export interface SablonCitit {
  readonly id: string;
  readonly denumire: string;
  readonly tip: ChecklistTip;
  readonly descriere: string | null;
  readonly department_id: string | null;
  readonly job_position_id: string | null;
  readonly activ: boolean;
  readonly valabil_de_la: string;
  readonly valabil_pana_la: string | null;
}

export interface EtapaCitita {
  readonly id: string;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly termen_zile_relativ: number;
}

export interface PasCitit {
  readonly id: string;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: string | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: string;
  readonly verificare_automata: string | null;
  readonly curs_id: string | null;
  readonly material_id: string | null;
  readonly etapa_id: string | null;
}

/**
 * Ce e în bază → starea asistentului.
 *
 * Pașii unui șablon scris înainte de 0089 n-au etapă: ajung în
 * `pasi_fara_etapa`, într-o secțiune proprie, nu se pierd și nu se împing cu
 * forța într-o etapă inventată.
 */
export function stareDinSablon(
  sablon: SablonCitit,
  etape: readonly EtapaCitita[],
  pasi: readonly PasCitit[],
): StareSablon {
  const catreStare = (p: PasCitit): StarePas => ({
    id: p.id,
    titlu: p.titlu,
    descriere: p.descriere ?? "",
    fel: felDinCampuri(p.tip_dovada, p.verificare_automata, p.material_id),
    responsabil_tip: p.responsabil_tip,
    responsabil_rol: p.responsabil_rol ?? "",
    responsabil_employee_id: p.responsabil_employee_id ?? "",
    termen_zile_relativ: String(p.termen_zile_relativ),
    obligatoriu: p.obligatoriu,
    curs_id: p.curs_id ?? "",
    material_id: p.material_id ?? "",
  });

  return {
    id: sablon.id,
    denumire: sablon.denumire,
    tip: sablon.tip,
    descriere: sablon.descriere ?? "",
    department_id: sablon.department_id ?? "",
    job_position_id: sablon.job_position_id ?? "",
    activ: sablon.activ,
    valabil_de_la: sablon.valabil_de_la,
    valabil_pana_la: sablon.valabil_pana_la ?? "",
    etape: etape.map((e) => ({
      id: e.id,
      titlu: e.titlu,
      descriere: e.descriere ?? "",
      termen_zile_relativ: String(e.termen_zile_relativ),
      pasi: pasi.filter((p) => p.etapa_id === e.id).map(catreStare),
    })),
    pasi_fara_etapa: pasi.filter((p) => p.etapa_id === null).map(catreStare),
  };
}
