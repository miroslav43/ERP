// src/lib/pdf/antet-organizatie.ts
// Datele de identificare ale firmei emitente, citite o singură dată și de
// aceeași manieră pentru toate documentele oficiale.
//
// Denumirea preferată e cea LEGALĂ (`legal_name`), nu cea uzuală: pe un stat de
// plată sau pe un fluturaș apare firma așa cum e înregistrată la Registrul
// Comerțului, nu cum îi spun angajații. Aceeași alegere ca la
// `documente/[id]/route.ts`, care generează contractul de muncă.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { AntetOrganizatie } from "./document";

export async function antetOrganizatie(
  db: SupabaseClient<Database>,
  organizationId: string,
  denumireUzuala: string,
): Promise<AntetOrganizatie> {
  const { data } = await db
    .from("organizations")
    .select("name, legal_name, cui, reg_com, adresa, oras, judet")
    .eq("id", organizationId)
    .maybeSingle<{
      name: string;
      legal_name: string | null;
      cui: string | null;
      reg_com: string | null;
      adresa: string | null;
      oras: string | null;
      judet: string | null;
    }>();

  // Fără rând (RLS, organizație ștearsă între timp) documentul se generează
  // oricum, cu denumirea din sesiune: un stat de plată fără antet e mai bun
  // decât un stat de plată inexistent.
  if (data === null) {
    return { denumire: denumireUzuala, cui: null, regCom: null, adresa: null };
  }

  const adresa = [data.adresa, data.oras, data.judet]
    .filter((v): v is string => v !== null && v.trim().length > 0)
    .join(", ");

  return {
    denumire: data.legal_name ?? data.name,
    cui: data.cui,
    regCom: data.reg_com,
    adresa: adresa.length > 0 ? adresa : null,
  };
}
