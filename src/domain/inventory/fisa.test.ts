import { describe, expect, it } from "vitest";

import {
  CAMPURI_FISA,
  campuriCompletate,
  custodie,
  evenimenteFisa,
  PRAG_GARANTIE_AVERTIZARE_ZILE,
  PRAG_GARANTIE_CRITIC_ZILE,
  treaptaGarantie,
  zileInEvidenta,
  type AlocareCronologie,
  type ObiectCompletitudine,
} from "./fisa";

const AZI = "2026-06-15";

/** Obiectul real de la `/inventar/44433528…`: trei câmpuri din douăsprezece. */
const LENOVO: ObiectCompletitudine = {
  denumire: "Lenovo",
  numar_inventar: "1",
  serie: null,
  model: null,
  producator: null,
  category_id: null,
  data_achizitie: null,
  valoare: 140,
  garantie_expira: null,
  stare: "nou",
  locatie: null,
  observatii: null,
};

describe("campuriCompletate", () => {
  it("numără cele douăsprezece câmpuri ale formularului", () => {
    expect(CAMPURI_FISA).toHaveLength(12);
  });

  it("dă 4 pentru obiectul din producție: denumire, număr, stare și valoarea", () => {
    expect(campuriCompletate(LENOVO)).toBe(4);
  });

  it("nu poate coborî sub 3: denumirea, numărul și starea sunt mereu scrise", () => {
    const minim: ObiectCompletitudine = {
      ...LENOVO,
      valoare: null,
    };
    expect(campuriCompletate(minim)).toBe(3);
  });

  it("numără valoarea 0 ca fiind COMPLETATĂ, nu ca pe un gol", () => {
    // Un obiect primit gratuit, sau amortizat integral, are valoare 0. E o
    // informație. `valoare || gol` ar fi ascuns-o — aceeași regulă ca în
    // `lista-definitii.tsx`.
    expect(campuriCompletate({ ...LENOVO, valoare: 0 })).toBe(4);
  });

  it("tratează un șir din spații albe ca gol", () => {
    // În bază, un câmp „curățat” de om rămâne des `" "`, nu `null`.
    expect(campuriCompletate({ ...LENOVO, locatie: "   " })).toBe(4);
    expect(campuriCompletate({ ...LENOVO, locatie: "Depozit" })).toBe(5);
  });

  it("dă 12 pentru o fișă completă", () => {
    const plina: ObiectCompletitudine = {
      denumire: "Laptop Dell Latitude 5540",
      numar_inventar: "LT-0012",
      serie: "5CG3210XYZ",
      model: "Latitude 5540",
      producator: "Dell",
      category_id: "0f1e3d00-0000-4000-8000-000000000001",
      data_achizitie: "2025-03-01",
      valoare: 4500,
      garantie_expira: "2028-03-01",
      stare: "bun",
      locatie: "Sediu · etaj 2",
      observatii: "Cu geantă și încărcător.",
    };
    expect(campuriCompletate(plina)).toBe(12);
  });
});

describe("custodie", () => {
  const ALOCARE = {
    id: "a1",
    predat_la: "2026-06-01T08:00:00+00:00",
    stare_la_predare: "bun",
    confirmat_de_angajat_la: null,
  } as const;

  it("spune „în stoc” pentru un obiect nepredat", () => {
    expect(custodie({ status: "in_stoc" }, null, null)).toEqual({ fel: "in_stoc" });
  });

  it("spune „alocat” și duce mai departe id-ul alocării, pentru returnare și PV", () => {
    const rezultat = custodie({ status: "alocat" }, ALOCARE, "Ionescu Ana");
    expect(rezultat).toEqual({
      fel: "alocat",
      alocareId: "a1",
      detinator: "Ionescu Ana",
      predatLa: "2026-06-01T08:00:00+00:00",
      stareLaPredare: "bun",
      confirmatLa: null,
    });
  });

  it("acceptă un deținător necunoscut: RLS poate ascunde fișa colegului", () => {
    const rezultat = custodie({ status: "alocat" }, ALOCARE, null);
    expect(rezultat.fel).toBe("alocat");
    if (rezultat.fel === "alocat") expect(rezultat.detinator).toBeNull();
  });

  it("ALOCAREA BATE STATUSUL: status „alocat” fără alocare deschisă înseamnă în stoc", () => {
    // `status` e un cache scris de trigger; sursa de adevăr sunt alocările.
    // Dacă triggerul n-a rulat, fișa nu trebuie să pretindă că cineva ține
    // obiectul — nu există niciun rând care să spună cine.
    expect(custodie({ status: "alocat" }, null, null)).toEqual({ fel: "in_stoc" });
  });

  it("ALOCAREA BATE STATUSUL: un obiect casat pe care cineva încă îl ține e „alocat”", () => {
    // Altfel obiectul ar dispărea din „ce am în primire” fără ca cineva să fi
    // consemnat returnarea.
    expect(custodie({ status: "casat" }, ALOCARE, "Popescu Dan").fel).toBe("alocat");
  });

  it("distinge „în reparație” de „în stoc”", () => {
    expect(custodie({ status: "in_reparatie" }, null, null)).toEqual({ fel: "in_reparatie" });
  });

  it("spune „casat” pentru starea terminală", () => {
    expect(custodie({ status: "casat" }, null, null)).toEqual({ fel: "casat" });
  });
});

describe("evenimenteFisa", () => {
  const NUME = new Map<string, string | null>([["e1", "Ionescu Ana"]]);

  it("dă un singur punct pentru un obiect nepredat: înregistrarea", () => {
    const puncte = evenimenteFisa(
      { status: "in_stoc", created_at: "2026-08-30T20:18:56+00:00" },
      [],
      NUME,
    );
    expect(puncte).toHaveLength(1);
    expect(puncte[0]?.fel).toBe("inregistrare");
    expect(puncte[0]?.moment).toBe("2026-08-30T20:18:56+00:00");
  });

  it("desface o alocare încheiată în două puncte, predare și returnare", () => {
    const istoric: readonly AlocareCronologie[] = [
      {
        id: "a1",
        employee_id: "e1",
        predat_la: "2026-03-01T08:00:00+00:00",
        returnat_la: "2026-05-01T08:00:00+00:00",
        stare_la_predare: "nou",
        stare_la_returnare: "uzat",
      },
    ];
    const puncte = evenimenteFisa(
      { status: "in_stoc", created_at: "2026-01-01T08:00:00+00:00" },
      istoric,
      NUME,
    );
    expect(puncte.map((p) => p.fel)).toEqual(["returnare", "predare", "inregistrare"]);
    expect(puncte[0]?.stare).toBe("uzat");
    expect(puncte[0]?.angajat).toBe("Ionescu Ana");
    expect(puncte[1]?.stare).toBe("nou");
  });

  it("nu produce punct de returnare cât alocarea e deschisă", () => {
    const istoric: readonly AlocareCronologie[] = [
      {
        id: "a1",
        employee_id: "e1",
        predat_la: "2026-03-01T08:00:00+00:00",
        returnat_la: null,
        stare_la_predare: "bun",
        stare_la_returnare: null,
      },
    ];
    const puncte = evenimenteFisa(
      { status: "alocat", created_at: "2026-01-01T08:00:00+00:00" },
      istoric,
      NUME,
    );
    expect(puncte.map((p) => p.fel)).toEqual(["predare", "inregistrare"]);
  });

  it("ordonează descrescător, cel mai recent primul", () => {
    const istoric: readonly AlocareCronologie[] = [
      {
        id: "a2",
        employee_id: "e1",
        predat_la: "2026-05-01T08:00:00+00:00",
        returnat_la: null,
        stare_la_predare: "bun",
        stare_la_returnare: null,
      },
      {
        id: "a1",
        employee_id: "e1",
        predat_la: "2026-02-01T08:00:00+00:00",
        returnat_la: "2026-04-01T08:00:00+00:00",
        stare_la_predare: "nou",
        stare_la_returnare: "bun",
      },
    ];
    const puncte = evenimenteFisa(
      { status: "alocat", created_at: "2026-01-01T08:00:00+00:00" },
      istoric,
      NUME,
    );
    expect(puncte.map((p) => p.moment)).toEqual([
      "2026-05-01T08:00:00+00:00",
      "2026-04-01T08:00:00+00:00",
      "2026-02-01T08:00:00+00:00",
      "2026-01-01T08:00:00+00:00",
    ]);
  });

  it("pune casarea prima și FĂRĂ dată — `inventory_items` n-are `casat_la`", () => {
    const puncte = evenimenteFisa(
      { status: "casat", created_at: "2026-01-01T08:00:00+00:00" },
      [],
      NUME,
    );
    expect(puncte[0]?.fel).toBe("casare");
    expect(puncte[0]?.moment).toBeNull();
  });

  it("nu cade când numele angajatului lipsește din hartă", () => {
    const istoric: readonly AlocareCronologie[] = [
      {
        id: "a1",
        employee_id: "necunoscut",
        predat_la: "2026-03-01T08:00:00+00:00",
        returnat_la: null,
        stare_la_predare: "bun",
        stare_la_returnare: null,
      },
    ];
    const puncte = evenimenteFisa(
      { status: "alocat", created_at: "2026-01-01T08:00:00+00:00" },
      istoric,
      new Map(),
    );
    expect(puncte[0]?.angajat).toBeNull();
  });

  it("dă chei distincte pentru predarea și returnarea aceleiași alocări", () => {
    const istoric: readonly AlocareCronologie[] = [
      {
        id: "a1",
        employee_id: "e1",
        predat_la: "2026-03-01T08:00:00+00:00",
        returnat_la: "2026-05-01T08:00:00+00:00",
        stare_la_predare: "nou",
        stare_la_returnare: "bun",
      },
    ];
    const puncte = evenimenteFisa(
      { status: "in_stoc", created_at: "2026-01-01T08:00:00+00:00" },
      istoric,
      NUME,
    );
    expect(new Set(puncte.map((p) => p.cheie)).size).toBe(puncte.length);
  });
});

describe("treaptaGarantie", () => {
  it("respectă pragurile din constante", () => {
    expect(PRAG_GARANTIE_AVERTIZARE_ZILE).toBe(60);
    expect(PRAG_GARANTIE_CRITIC_ZILE).toBe(14);
  });

  it("este „neaplicabil” fără dată, NU „lipsa” ca la flotă", () => {
    // Un obiect fără garanție e cazul obișnuit — un birou, un scaun. Dacă
    // lipsa ar fi gravă, orice registru ar porni roșu în ziua importului.
    expect(treaptaGarantie(null, AZI)).toBe("neaplicabil");
  });

  it("este „expirat” pentru o garanție trecută", () => {
    expect(treaptaGarantie("2026-06-14", AZI)).toBe("expirat");
  });

  it("este „critic” în ultimele două săptămâni", () => {
    expect(treaptaGarantie("2026-06-29", AZI)).toBe("critic");
  });

  it("este „curand” în cele două luni de preaviz", () => {
    expect(treaptaGarantie("2026-08-14", AZI)).toBe("curand");
  });

  it("este „in_regula” dincolo de preaviz", () => {
    expect(treaptaGarantie("2026-08-15", AZI)).toBe("in_regula");
  });

  it("nu declară expirată garanția care se termină CHIAR azi", () => {
    expect(treaptaGarantie(AZI, AZI)).toBe("critic");
  });
});

describe("zileInEvidenta", () => {
  it("dă 0 în ziua înregistrării", () => {
    expect(zileInEvidenta("2026-06-15T09:00:00+00:00", AZI)).toBe(0);
  });

  it("numără zilele calendaristice, nu orele", () => {
    expect(zileInEvidenta("2026-06-01T09:00:00+00:00", AZI)).toBe(14);
    expect(zileInEvidenta("2026-06-01T20:00:00+00:00", AZI)).toBe(14);
  });

  it("ia ziua în Europe/Bucharest, nu în UTC", () => {
    // 30 iunie 22:30 UTC = 1 iulie 01:30 la București (vara, UTC+3). Tăierea
    // brută a ISO-ului ar fi dat 30 iunie, adică o zi în plus de vechime.
    expect(zileInEvidenta("2026-06-30T22:30:00+00:00", "2026-07-01")).toBe(0);
  });

  it("nu întoarce niciodată un număr negativ", () => {
    // Ceasul serverului și `created_at` din bază pot fi despărțite de câteva
    // secunde; „obiect înregistrat peste −1 zile” n-are ce căuta pe ecran.
    expect(zileInEvidenta("2026-06-16T09:00:00+00:00", AZI)).toBe(0);
  });
});
