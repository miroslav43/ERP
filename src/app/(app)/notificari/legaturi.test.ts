// src/app/(app)/notificari/legaturi.test.ts
import { describe, expect, it } from "vitest";

import type { ContextPorti } from "@/config/porti-ruta";

import { CONTEXT_APLICATIE_GOL, caleaInAplicatie, type ContextAplicatie } from "./legaturi";

const ID = "3f8c1d2e-1111-4222-8333-444455556666";
const FISA = "9a7b6c5d-2222-4333-8444-555566667777";
const CURS = "1c2d3e4f-3333-4444-8555-666677778888";

/** Un manager tipic: pontaj (aprobare pe echipă, creare proprie), concedii, cursuri; fără REGES. */
const MANAGER: ContextPorti = {
  features: new Set(["attendance", "leave", "courses", "announcements", "onboarding", "reges"]),
  permissions: new Map([
    ["attendance:read", "team"],
    ["attendance:approve", "team"],
    ["attendance:create", "own"],
    ["leave:read", "team"],
    ["courses:read", "team"],
    ["announcements:read", "all"],
    ["checklists:read", "team"],
  ]),
};

function ctx(porti: ContextPorti, rest: Partial<ContextAplicatie> = {}): ContextAplicatie {
  return { porti, fisaProprie: FISA, ...CONTEXT_APLICATIE_GOL, ...rest };
}

const notificare = (link: string | null, tip: string | null = null, id: string | null = null) => ({
  link,
  entity_type: tip,
  entity_id: id,
});

describe("caleaInAplicatie — obiectul bate coada", () => {
  it("cererea de concediu duce la fișa cererii, nu la coada de aprobări", () => {
    expect(
      caleaInAplicatie(notificare("/concedii/aprobari", "leave_request", ID), ctx(MANAGER)),
    ).toBe(`/concedii/${ID}`);
  });

  it("săptămâna de aprobat se deschide în luna ei, cu ancora submisiei", () => {
    const cu = ctx(MANAGER, {
      saptamani: new Map([[ID, { saptamanaStart: "2026-10-05", employeeId: FISA }]]),
    });
    expect(
      caleaInAplicatie(notificare("/pontaj/aprobare", "attendance_week_submission", ID), cu),
    ).toBe(`/pontaj/aprobare?an=2026&luna=10#saptamana-${ID}`);
    expect(
      caleaInAplicatie(notificare("/pontaj/saptamana", "attendance_week_submission", ID), cu),
    ).toBe(`/pontaj/saptamana?saptamana=2026-10-05&angajat=${FISA}`);
    expect(
      caleaInAplicatie(notificare("/pontaj", "attendance_week_submission_fara_pontaj", ID), cu),
    ).toBe(`/pontaj?an=2026&luna=10&angajat=${FISA}`);
  });

  it("fără săptămâna în context, rămâne coada, prin poartă", () => {
    expect(
      caleaInAplicatie(
        notificare("/pontaj/aprobare", "attendance_week_submission", ID),
        ctx(MANAGER),
      ),
    ).toBe("/pontaj/aprobare");
  });
});

describe("caleaInAplicatie — poarta paginii-țintă", () => {
  it("REGES: coada de transmis, dar nimic fără `reges:read all` sau cu modulul oprit", () => {
    expect(caleaInAplicatie(notificare("/reges"), ctx(MANAGER))).toBeNull();
    const admin: ContextPorti = {
      features: MANAGER.features,
      permissions: new Map([...MANAGER.permissions, ["reges:read", "all"]]),
    };
    expect(caleaInAplicatie(notificare("/reges"), ctx(admin))).toBe("/reges?stare=de_transmis");
    const faraModul: ContextPorti = { features: new Set(), permissions: admin.permissions };
    expect(caleaInAplicatie(notificare("/reges"), ctx(faraModul))).toBeNull();
  });

  it("anunțul: doar dacă se mai vede sub RLS (neexpirat, neșters)", () => {
    expect(caleaInAplicatie(notificare(`/anunturi/${ID}`), ctx(MANAGER))).toBeNull();
    expect(
      caleaInAplicatie(
        notificare(`/anunturi/${ID}`),
        ctx(MANAGER, { anunturiVizibile: new Set([ID]) }),
      ),
    ).toBe(`/anunturi/${ID}`);
  });

  it("o rută necunoscută registrului se lasă cum e; una cunoscută fără drept devine text", () => {
    expect(caleaInAplicatie(notificare("/ceva-nou"), ctx(MANAGER))).toBe("/ceva-nou");
    expect(caleaInAplicatie(notificare(`/onboarding/${ID}`), ctx(MANAGER))).toBe(
      `/onboarding/${ID}`,
    );
    const faraOnboarding: ContextPorti = { features: MANAGER.features, permissions: new Map() };
    expect(caleaInAplicatie(notificare(`/onboarding/${ID}`), ctx(faraOnboarding))).toBeNull();
    expect(caleaInAplicatie(notificare(null), ctx(MANAGER))).toBeNull();
  });
});

describe("caleaInAplicatie — legăturile de portal pentru rolurile din aplicație", () => {
  it("ziua pontată duce la săptămâna proprie; luna, la luna proprie", () => {
    expect(caleaInAplicatie(notificare("/portal/pontajul-meu/zi/2026-10-07"), ctx(MANAGER))).toBe(
      `/pontaj/saptamana?saptamana=2026-10-05&angajat=${FISA}`,
    );
    expect(caleaInAplicatie(notificare("/portal/pontajul-meu?an=2026&luna=9"), ctx(MANAGER))).toBe(
      `/pontaj?an=2026&luna=9&angajat=${FISA}`,
    );
  });

  it("fără fișă proprie (administrator extern), fără parametrul de angajat", () => {
    expect(
      caleaInAplicatie(
        notificare("/portal/pontajul-meu?an=2026&luna=9"),
        ctx(MANAGER, { fisaProprie: null }),
      ),
    ).toBe("/pontaj?an=2026&luna=9");
  });

  it("cursul din portal duce la stadiul cursului, pe angajatul înrolării", () => {
    const cu = ctx(MANAGER, { inrolari: new Map([[ID, { courseId: CURS, employeeId: FISA }]]) });
    expect(caleaInAplicatie(notificare(`/portal/cursurile-mele/${ID}`), cu)).toBe(
      `/cursuri/${CURS}/stadiu?angajat=${FISA}`,
    );
    expect(caleaInAplicatie(notificare(`/portal/cursurile-mele/${ID}`), ctx(MANAGER))).toBe(
      "/cursuri",
    );
  });

  it("o legătură de portal fără echivalent rămâne text, nu drum spre /panou", () => {
    expect(caleaInAplicatie(notificare("/portal/altceva"), ctx(MANAGER))).toBeNull();
  });
});
