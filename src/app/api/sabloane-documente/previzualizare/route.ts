// src/app/api/sabloane-documente/previzualizare/route.ts
//
// Previzualizarea PDF a unui șablon aflat ÎN EDITOR, înainte de salvare.
//
// ── DE CE O RUTĂ, ȘI NU O SERVER ACTION ─────────────────────────────────────
// Rezultatul e un fișier binar de câteva sute de kiloocteți, nu date. O acțiune
// l-ar fi întors prin serializarea React ca `base64` într-un răspuns de flux,
// adică ~33% în plus și o conversie în plus la ambele capete. Exact motivul
// pentru care fluturașii și statele de plată sunt tot rute (`api/export/…`).
//
// ── DE CE NU CONSUMĂ NUMĂR DE SERIE ─────────────────────────────────────────
// `genereazaDocument` alocă un număr pe (organizație, serie) și scrie un rând
// în `hr_issued_documents` — acolo e documentul de referință, cu amprenta lui
// SHA-256. O previzualizare care ar trece prin el ar consuma numere din serie
// la fiecare apăsare de buton, iar registrul firmei ar avea găuri pe care nimic
// nu le explică. Aici se randează DOAR: aceleași `curataHtml` + `pdfDinDocument`
// ca la emiterea reală, fără nicio scriere.
//
// Consecința pe care o acceptăm: numărul tipărit e `000000`, iar documentul
// poartă mențiunea SPECIMEN. Previzualizarea nu trebuie să poată fi confundată
// cu un act.
//
// ── DE CE VALORI-SPECIMEN ───────────────────────────────────────────────────
// Vezi `VALORI_EXEMPLU` din `lib/documents/variabile.ts`. Pe scurt: butonul
// trebuie să meargă înainte ca firma să aibă vreun angajat, iar un
// `{{cnp_complet}}` tastat într-un șablon nu are voie să devină un mod de a
// citi CNP-uri fără audit.
import { getPermissionMap, can } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { curataHtml, variabileFolosite } from "@/lib/documents/curata-html";
import { VALORI_EXEMPLU, VARIABILE_PER_COD, esteCodInrolare } from "@/lib/documents/variabile";
import { antetOrganizatie } from "@/lib/pdf/antet-organizatie";
import { numeFisier } from "@/lib/pdf/document";
import { pdfDinDocument } from "@/lib/pdf/din-html";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Plafonul din `salveazaSablonDocumentSchema` — aceeași limită, același motiv. */
const MAXIM_CARACTERE = 200_000;

const raspunsText = (mesaj: string, status: number): Response =>
  new Response(mesaj, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(request: Request): Promise<Response> {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") return raspunsText("Trebuie să te autentifici.", 401);
  if (rezolvare.status !== "ok") return raspunsText("Alege mai întâi o organizație.", 403);
  const { tenant } = rezolvare;

  /*
   * ACEEAȘI POARTĂ CA LA SALVARE.
   *
   * O rută nu e păzită de RLS, fiindcă nu citește nimic din tabelele păzite:
   * documentul se compune din textul trimis de client și din valori-specimen.
   * Fără verificarea de mai jos, orice membru autentificat ar putea randa
   * documentele firmei — inofensiv ca date, dar tot o poartă lipsă.
   */
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "employees:update", "all")) {
    return raspunsText("Nu aveți dreptul de a modifica șabloanele de documente.", 403);
  }

  let corp: unknown;
  try {
    corp = await request.json();
  } catch {
    return raspunsText("Cererea nu a putut fi citită.", 400);
  }
  const { cod, continut_html: brut, denumire } = (corp ?? {}) as Record<string, unknown>;

  if (typeof cod !== "string" || !esteCodInrolare(cod)) {
    return raspunsText("Tipul de document nu este cunoscut.", 400);
  }
  if (typeof brut !== "string" || brut.length === 0) {
    return raspunsText("Documentul nu poate fi gol.", 400);
  }
  if (brut.length > MAXIM_CARACTERE) {
    return raspunsText("Documentul e prea lung.", 400);
  }

  // Aceeași ordine ca în `salveazaSablonDocument`: întâi curățarea, apoi
  // verificarea variabilelor, pe REZULTAT. Altfel previzualizarea ar reclama o
  // variabilă ascunsă într-un atribut pe care curățarea oricum îl aruncă.
  const curat = curataHtml(brut);
  if (curat === "") {
    return raspunsText(
      "După curățare nu a rămas niciun text. Verifică dacă documentul are conținut, nu doar formatare.",
      422,
    );
  }

  const cunoscute = VARIABILE_PER_COD[cod];
  const necunoscute = variabileFolosite(curat).filter((v) => !cunoscute.includes(v));
  if (necunoscute.length > 0) {
    return raspunsText(
      `Documentul folosește variabile care nu există: ${necunoscute.map((v) => `{{${v}}}`).join(", ")}.`,
      422,
    );
  }

  // Interpolarea specimenelor. Deliberat NU se trece prin `genereazaDocument`:
  // vezi capul fișierului. Valorile nu se evadează aici, fiindcă `curataHtml` a
  // rulat deja peste șablon, iar specimenele sunt constante scrise de noi.
  const html = curat.replace(/\{\{\s*([a-z_]+)\s*\}\}/gu, (_potrivire, cheie: string) =>
    cheie === "organizatie_denumire"
      ? (tenant.legalName ?? tenant.name)
      : (VALORI_EXEMPLU[cheie] ?? `{{${cheie}}}`),
  );

  const db = await createServerSupabase();
  const organizatie = await antetOrganizatie(
    db,
    tenant.organizationId,
    tenant.legalName ?? tenant.name,
  );

  const titlu =
    typeof denumire === "string" && denumire.trim() !== "" ? denumire.trim() : "Document";

  const octeti = await pdfDinDocument({
    html,
    // Numărul e vizibil fictiv: seria reală a șablonului n-are ce căuta pe un
    // document care nu s-a înregistrat nicăieri.
    numarAfisat: "SPECIMEN 000000",
    titlu,
    organizatie,
    codVerificare: "SPECIMEN — document neemis",
    amprenta: "fără amprentă",
  });

  return new Response(octeti as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${numeFisier(`previzualizare-${cod}`)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
