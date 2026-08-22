// src/app/(platform)/super-admin/cereri-demo/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/actions/types";
import type { Database, Json } from "@/types/database";
import { STATUSURI_CERERE, type StatusCerere } from "./constante";

/** Banda de angajați este enum în baza de date, nu text liber. */
type BandaAngajati = Database["public"]["Enums"]["employee_band"];

// Constantele au fost mutate în `./constante` — un modul "use server" poate
// exporta doar funcții async.

export type CerereDemo = Readonly<{
  id: string;
  nume: string;
  firma: string;
  email: string;
  telefon: string | null;
  nrAngajati: BandaAngajati | null;
  mesaj: string | null;
  status: StatusCerere;
  createdAt: string;
}>;

export type ListaCereri = Readonly<{
  cereri: readonly CerereDemo[];
  contorizare: Readonly<Record<StatusCerere, number>>;
}>;

const CAMPURI = "id, nume, firma, email, telefon, nr_angajati, mesaj, status, created_at";

const LIMITA_LISTA = 200;

const RUTA = "/super-admin/cereri-demo";

const schemaSchimbaStatus = z.object({
  id: z.uuid("Cererea selectată nu este validă."),
  status: z.enum(STATUSURI_CERERE, "Alege un status valid."),
});

/** ALLOW-LIST pentru audit (S7): doar aceste câmpuri ajung în audit_logs. */
const CAMPURI_AUDITATE = ["status"] as const;

function doarCampuriPermise(
  sursa: Readonly<Record<string, Json | undefined>>,
): Record<string, Json | undefined> {
  return Object.fromEntries(
    CAMPURI_AUDITATE.filter((cheie) => cheie in sursa).map(
      (cheie): readonly [string, Json | undefined] => [cheie, sursa[cheie]],
    ),
  );
}

function eroare(
  cod: "INTERZIS" | "VALIDARE" | "NEGASIT" | "EROARE_INTERNA",
  mesaj: string,
  fieldErrors: Readonly<Record<string, readonly string[]>> | null,
): ActionResult<never> {
  return { ok: false, error: { code: cod, message: mesaj, fieldErrors, requestId: "" } };
}

type RandCerere = Readonly<{
  id: string;
  nume: string;
  firma: string;
  email: string;
  telefon: string | null;
  nr_angajati: BandaAngajati | null;
  mesaj: string | null;
  status: StatusCerere;
  created_at: string;
}>;

function mapeaza(rand: RandCerere): CerereDemo {
  return {
    id: rand.id,
    nume: rand.nume,
    firma: rand.firma,
    email: rand.email,
    telefon: rand.telefon,
    nrAngajati: rand.nr_angajati,
    mesaj: rand.mesaj,
    status: rand.status,
    createdAt: rand.created_at,
  };
}

/** Citirea listei. Guard explicit de platformă pe fiecare apel. */
export async function citesteCereriDemo(
  status: StatusCerere | null,
): Promise<ActionResult<ListaCereri>> {
  await requirePlatformAdmin();
  const supabase = createAdminSupabase();

  const interogare = supabase
    .from("demo_requests")
    .select(CAMPURI)
    .order("created_at", { ascending: false })
    .limit(LIMITA_LISTA);

  const [rezultatLista, rezultatContor] = await Promise.all([
    status === null ? interogare : interogare.eq("status", status),
    supabase.from("demo_requests").select("status"),
  ]);

  if (rezultatLista.error || rezultatContor.error) {
    console.error("[super-admin.cereri-demo] citire eșuată", {
      lista: rezultatLista.error?.message,
      contor: rezultatContor.error?.message,
    });
    return eroare(
      "EROARE_INTERNA",
      "Nu am putut încărca cererile de demo. Încearcă din nou peste câteva momente.",
      null,
    );
  }

  const randuriContor = rezultatContor.data ?? [];
  const contorizare = Object.fromEntries(
    STATUSURI_CERERE.map((cheie) => [
      cheie,
      randuriContor.filter((rand) => rand.status === cheie).length,
    ]),
  ) as Record<StatusCerere, number>;

  return {
    ok: true,
    data: { cereri: (rezultatLista.data ?? []).map(mapeaza), contorizare },
  };
}

/**
 * O singură cerere — pentru pre-completarea formularului de organizație nouă
 * (`/super-admin/organizatii/nou?cerere=id`). `null` la id invalid sau cerere
 * inexistentă: pagina tratează asta ca formular gol, nu ca eroare.
 */
export async function citesteCerereDemo(id: string): Promise<CerereDemo | null> {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from("demo_requests")
    .select(CAMPURI)
    .eq("id", id)
    .maybeSingle();
  if (error !== null || data === null) return null;
  return mapeaza(data);
}

/** Schimbarea statusului. Audit prin RPC log_audit_event (S6), cu allow-list (S7). */
export async function schimbaStatusCerere(
  raw: unknown,
): Promise<ActionResult<{ id: string; status: StatusCerere }>> {
  const admin = await requirePlatformAdmin();
  const validare = schemaSchimbaStatus.safeParse(raw);
  if (!validare.success) {
    const flat = z.flattenError(validare.error);
    return eroare("VALIDARE", "Verifică datele trimise.", flat.fieldErrors);
  }
  const { id, status } = validare.data;
  const supabase = createAdminSupabase();

  const anterior = await supabase.from("demo_requests").select("status").eq("id", id).maybeSingle();

  if (anterior.error) {
    console.error("[super-admin.cereri-demo] citire status", anterior.error.message);
    return eroare("EROARE_INTERNA", "Nu am putut citi cererea selectată.", null);
  }
  if (!anterior.data) {
    return eroare("NEGASIT", "Cererea nu mai există.", null);
  }

  const actualizare = await supabase
    .from("demo_requests")
    .update({ status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle();

  if (actualizare.error || !actualizare.data) {
    console.error("[super-admin.cereri-demo] actualizare status", actualizare.error?.message);
    return eroare("EROARE_INTERNA", "Nu am putut salva noul status. Încearcă din nou.", null);
  }

  const jurnal = await supabase.rpc("log_audit_event", {
    p_action: "update",
    p_status: "success",
    p_organization_id: null,
    p_entity_type: "demo_requests",
    p_entity_id: id,
    p_before: doarCampuriPermise({ status: anterior.data.status }),
    p_after: doarCampuriPermise({ status: actualizare.data.status }),
    p_ip: null,
    p_user_agent: null,
    p_request_id: null,
    p_error_code: null,
  });
  if (jurnal.error) {
    console.error("[super-admin.cereri-demo] audit eșuat", {
      actor: admin.id,
      message: jurnal.error.message,
    });
  }

  revalidatePath(RUTA);
  return { ok: true, data: { id, status: actualizare.data.status } };
}
