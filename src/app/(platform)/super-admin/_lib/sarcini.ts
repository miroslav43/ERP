import type { StatusOrganizatie } from "../_components/insigne";

export type RandOrganizatiePanou = Readonly<{
  id: string;
  name: string;
  status: StatusOrganizatie;
  /** Include `nucleu`, care e mereu pornit — deci „doar nucleul" înseamnă 1. */
  moduleActive: number;
  administratori: number;
}>;

export type SarcinaPanou = Readonly<{
  cheie: string;
  titlu: string;
  detaliu: string;
  href: string;
  eticheta: string;
  urgent: boolean;
}>;

/**
 * Din starea platformei → lista de lucruri care cer acțiune.
 *
 * Funcție pură, ca să poată fi testată fără bază de date: apelantul face
 * interogările, ea doar decide ce merită arătat.
 *
 * Regula care ține panoul folositor: se raportează DOAR ce e detectabil ȘI
 * rezolvabil, cu un buton care duce exact acolo unde se rezolvă. Un panou mereu
 * plin nu mai înseamnă nimic — ăsta trebuie să se golească atunci când ți-ai
 * făcut treaba.
 */
export function construiesteSarcini(
  stare: Readonly<{
    cereriDemoNoi: number;
    organizatii: readonly RandOrganizatiePanou[];
  }>,
): readonly SarcinaPanou[] {
  const sarcini: SarcinaPanou[] = [];

  if (stare.cereriDemoNoi > 0) {
    const una = stare.cereriDemoNoi === 1;
    sarcini.push({
      cheie: "cereri-demo",
      titlu: una
        ? "O cerere de demonstrație așteaptă răspuns"
        : `${stare.cereriDemoNoi} cereri de demonstrație așteaptă răspuns`,
      detaliu: una ? "Neatinsă de la primire." : "Neatinse de la primire.",
      href: "/super-admin/cereri-demo",
      eticheta: "Deschide",
      urgent: true,
    });
  }

  for (const org of stare.organizatii) {
    // O firmă arhivată nu mai e treaba nimănui: n-are rost să ceară acțiune.
    if (org.status === "archived") continue;

    if (org.moduleActive <= 1) {
      sarcini.push({
        cheie: "fara-module",
        titlu: `${org.name} are pornit doar nucleul`,
        detaliu: "Niciun modul de lucru activ de la înregistrare.",
        href: `/super-admin/organizatii/${org.id}/module`,
        eticheta: "Module",
        urgent: false,
      });
    }

    if (org.administratori === 0) {
      sarcini.push({
        cheie: "fara-admin",
        titlu: `${org.name} nu are niciun administrator`,
        detaliu: "Nimeni nu poate administra firma din interior.",
        href: `/super-admin/organizatii/${org.id}/membri`,
        eticheta: "Membri",
        urgent: true,
      });
    }
  }

  return sarcini;
}
