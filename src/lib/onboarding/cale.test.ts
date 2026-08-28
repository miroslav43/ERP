import { describe, expect, it } from "vitest";

import { PERMISSION_KEYS } from "@/config/permissions";

import {
  BUCKET_CHECKLISTS,
  LIMITA_DOVADA_BYTES,
  RESURSA_CHECKLISTS,
  construiesteCaleDovada,
  prefixCaleDovada,
  verificaDovada,
} from "./cale";

const ORG = "11111111-1111-1111-1111-111111111111";
const ANG = "22222222-2222-2222-2222-222222222222";
const PAS = "33333333-3333-3333-3333-333333333333";

describe("contractul de cale", () => {
  it("segmentul 2 e o resursă REALĂ din catalogul de permisiuni", () => {
    // Poarta care lipsea în 0073: `app.path_resource` validează doar FORMA, nu
    // apartenența la catalog. Un cuvânt plauzibil dar inexistent — `onboarding`,
    // de pildă — trece regexul și face `has_permission` să întoarcă `'none'`,
    // adică refuz TĂCUT la fiecare încărcare.
    const resurse = new Set(PERMISSION_KEYS.map((k) => k.split(":")[0]));
    expect(resurse.has(RESURSA_CHECKLISTS)).toBe(true);
    expect(resurse.has("onboarding")).toBe(false);
  });

  it("respectă forma pe care o citește app.checklist_poate_dovada", () => {
    const cale = construiesteCaleDovada({
      organizationId: ORG,
      employeeId: ANG,
      instanceItemId: PAS,
      numeFisier: "Contract semnat.pdf",
    });
    const segmente = cale.split("/");
    expect(segmente).toHaveLength(5);
    expect(segmente[0]).toBe(ORG);
    expect(segmente[1]).toBe(RESURSA_CHECKLISTS);
    expect(segmente[2]).toBe(ANG);
    expect(segmente[3]).toBe(PAS);
    expect(segmente[4]).toMatch(/-contract-semnat\.pdf$/);
  });

  it("prefixul acoperă și PASUL, nu doar persoana", () => {
    // Poarta din bază se ancorează pe segmentul 4. O verificare de aplicație
    // mai laxă decât cea din bază nu servește la nimic.
    const prefix = prefixCaleDovada(ORG, ANG, PAS);
    expect(prefix).toBe(`${ORG}/${RESURSA_CHECKLISTS}/${ANG}/${PAS}/`);
    expect(
      construiesteCaleDovada({
        organizationId: ORG,
        employeeId: ANG,
        instanceItemId: PAS,
        numeFisier: "x.pdf",
      }).startsWith(prefix),
    ).toBe(true);
  });

  it("numele bucketului e cel din migrare", () => {
    expect(BUCKET_CHECKLISTS).toBe("org-checklists");
  });
});

describe("verificaDovada", () => {
  it("acceptă un PDF de dimensiune rezonabilă", () => {
    expect(verificaDovada({ size: 1024, type: "application/pdf" })).toBeNull();
  });

  it("refuză fișierul gol", () => {
    expect(verificaDovada({ size: 0, type: "application/pdf" })?.mesaj).toContain("gol");
  });

  it("refuză peste plafon — mai devreme decât bucketul, cu mesaj citibil", () => {
    expect(
      verificaDovada({ size: LIMITA_DOVADA_BYTES + 1, type: "application/pdf" })?.mesaj,
    ).toContain("20 MB");
  });

  it("refuză un tip neacceptat și îl NUMEȘTE", () => {
    const problema = verificaDovada({ size: 10, type: "image/svg+xml" });
    expect(problema?.mesaj).toContain("image/svg+xml");
  });

  it("nu se împiedică de un tip lipsă", () => {
    expect(verificaDovada({ size: 10, type: "" })?.mesaj).toContain("necunoscut");
  });
});
