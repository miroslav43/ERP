import { describe, expect, it } from "vitest";

import {
  IMPLICIT_PONTARE_RAPIDA,
  configPontareRapida,
  cePoateFace,
  cumSeTrateazaCodul,
  type RandPontareRapida,
} from "./pontare-rapida";

/** Cum arată rândul citit din `setari_pontare_rapida`: `time` vine cu secunde. */
function rand(peste: Partial<RandPontareRapida> = {}): RandPontareRapida {
  return {
    mod_pontare_rapida: "ceas",
    verificare_pontare: "fara",
    program_start: null,
    necesita_aprobare: true,
    ...peste,
  };
}

describe("configPontareRapida", () => {
  /*
    Testul care justifică modulul. Firma Wiselearning avea modulul pornit, un
    afiș QR tipăribil și ZERO rânduri de setări — iar cele cinci ecrane care
    citeau `setari?.mod_pontare_rapida ?? "oprit"` îi spuneau angajatului că
    afișul pe care tocmai l-a scanat „e probabil vechi".
  */
  it("fără niciun rând salvat, pontarea rapidă e pornită pe ceas", () => {
    const config = configPontareRapida(null);

    expect(config.mod).toBe("ceas");
    expect(config.verificare).toBe("optional");
    expect(config.programStart).toBeNull();
  });

  it("implicitele publicate sunt aceleași cu cele aplicate", () => {
    // Ecranul de setări desenează valorile din `IMPLICIT_PONTARE_RAPIDA` pentru
    // o firmă neconfigurată. Dacă cele două s-ar despărți, ecranul ar arăta o
    // stare pe care serverul n-o aplică.
    const config = configPontareRapida(null);

    expect(config.mod).toBe(IMPLICIT_PONTARE_RAPIDA.mod);
    expect(config.verificare).toBe(IMPLICIT_PONTARE_RAPIDA.verificare);
  });

  it("un rând salvat bate implicitul, inclusiv când firma a stins pontarea", () => {
    const config = configPontareRapida(rand({ mod_pontare_rapida: "oprit" }));

    expect(config.mod).toBe("oprit");
  });

  it("ora de început pierde secundele cu care o întoarce Postgres", () => {
    // `time` iese ca `"08:30:00"`, iar aritmetica din `calcul-ore` lucrează pe
    // `HH:MM`. Fără tăiere, `intervalulPropus` primește o oră pe care n-o
    // recunoaște și întoarce null — butonul de confirmare dispare tăcut.
    const config = configPontareRapida(rand({ program_start: "08:30:00" }));

    expect(config.programStart).toBe("08:30");
  });
});

describe("cePoateFace", () => {
  it("modul `ceas` dă butonul de intrare, nu și confirmarea zilei", () => {
    const rezultat = cePoateFace(configPontareRapida(rand({ mod_pontare_rapida: "ceas" })), false);

    expect(rezultat.poateCeas).toBe(true);
    expect(rezultat.poateConfirma).toBe(false);
  });

  it("modul `ambele` le dă pe amândouă", () => {
    const config = configPontareRapida(
      rand({ mod_pontare_rapida: "ambele", program_start: "08:30:00" }),
    );
    const rezultat = cePoateFace(config, false);

    expect(rezultat.poateCeas).toBe(true);
    expect(rezultat.poateConfirma).toBe(true);
  });

  it("modul `oprit` nu dă niciun buton", () => {
    const rezultat = cePoateFace(configPontareRapida(rand({ mod_pontare_rapida: "oprit" })), true);

    expect(rezultat.poateCeas).toBe(false);
    expect(rezultat.poateConfirma).toBe(false);
  });

  /*
    Miezul stării `optional`. Cu `cod_qr`, butonul obișnuit NU se desenează —
    cine n-are afișul lângă el nu mai poate ponta deloc. `optional` există
    tocmai ca să nu fie nevoie de alegerea aia.
  */
  it("`cod_qr` ascunde butonul obișnuit și cere scanarea", () => {
    const config = configPontareRapida(rand({ verificare_pontare: "cod_qr" }));
    const rezultat = cePoateFace(config, true);

    expect(rezultat.cereScanare).toBe(true);
    expect(rezultat.poateCeas).toBe(false);
  });

  it("`optional` păstrează butonul ȘI oferă scanarea, când firma are afiș", () => {
    const config = configPontareRapida(rand({ verificare_pontare: "optional" }));
    const rezultat = cePoateFace(config, true);

    expect(rezultat.cereScanare).toBe(false);
    expect(rezultat.poateCeas).toBe(true);
    expect(rezultat.oferaScanare).toBe(true);
  });

  it("`optional` fără niciun afiș nu propune o scanare imposibilă", () => {
    const config = configPontareRapida(rand({ verificare_pontare: "optional" }));
    const rezultat = cePoateFace(config, false);

    expect(rezultat.oferaScanare).toBe(false);
    expect(rezultat.poateCeas).toBe(true);
  });

  it("`fara` nu pomenește niciodată de afiș, chiar dacă firma are unul", () => {
    const config = configPontareRapida(rand({ verificare_pontare: "fara" }));
    const rezultat = cePoateFace(config, true);

    expect(rezultat.cereScanare).toBe(false);
    expect(rezultat.oferaScanare).toBe(false);
  });
});

describe("cumSeTrateazaCodul", () => {
  it("pe încredere, codul scanat se ignoră cu totul", () => {
    expect(cumSeTrateazaCodul("fara", null)).toBe("ignorat");
    expect(cumSeTrateazaCodul("fara", "cod-de-pe-un-afis-vechi")).toBe("ignorat");
  });

  it("cu cod obligatoriu, lipsa lui e un refuz, nu o pontare fără loc", () => {
    expect(cumSeTrateazaCodul("cod_qr", null)).toBe("cerut_lipsa");
    expect(cumSeTrateazaCodul("cod_qr", "cod-valid-din-afis")).toBe("de_rezolvat");
  });

  /*
    Asimetria care contează la `optional`: absența codului e în regulă (omul a
    apăsat butonul din portal), dar un cod PREZENT se rezolvă întotdeauna. Un
    afiș vechi n-are voie să treacă tăcut drept pontare fără punct de lucru —
    ar arăta ca o scanare reușită și ar înregistra altceva.
  */
  it("cu cod opțional, absența trece, dar un cod prezent se verifică", () => {
    expect(cumSeTrateazaCodul("optional", null)).toBe("ignorat");
    expect(cumSeTrateazaCodul("optional", "cod-de-pe-afis")).toBe("de_rezolvat");
  });
});
