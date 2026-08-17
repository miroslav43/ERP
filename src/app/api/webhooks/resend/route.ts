// src/app/api/webhooks/resend/route.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getEmailConfig } from "@/lib/email/config";
import type { Enums } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOLERANTA_SECUNDE = 300;

/** Verificare svix: HMAC-SHA256 peste `${id}.${timestamp}.${body}`, comparat în timp constant. */
function verificaSemnatura(
  args: Readonly<{
    body: string;
    id: string;
    timestamp: string;
    header: string;
    secret: string;
  }>,
): boolean {
  const ts = Number.parseInt(args.timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const acum = Math.floor(Date.now() / 1000);
  if (Math.abs(acum - ts) > TOLERANTA_SECUNDE) return false;

  const cheieBruta = args.secret.startsWith("whsec_") ? args.secret.slice(6) : args.secret;
  let cheie: Buffer;
  try {
    cheie = Buffer.from(cheieBruta, "base64");
  } catch {
    return false;
  }
  if (cheie.length === 0) return false;

  const asteptat = createHmac("sha256", cheie)
    .update(`${args.id}.${args.timestamp}.${args.body}`)
    .digest();

  return args.header.split(" ").some((parte) => {
    const [versiune, valoare] = parte.split(",");
    if (versiune !== "v1" || valoare === undefined || valoare === "") return false;
    const primit = Buffer.from(valoare, "base64");
    return primit.length === asteptat.length && timingSafeEqual(primit, asteptat);
  });
}

const evenimentSchema = z.object({
  type: z.string().min(1),
  data: z.object({ email_id: z.string().min(1).optional() }),
});

type StareEmail = Enums<"email_status">;
type StareFinala = Exclude<StareEmail, "queued">;
const MAPARE: Readonly<Record<string, StareFinala>> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};
/** Stările din care avem voie să avansăm — un „delivered” întârziat nu suprascrie un „bounced”. */
const PRECEDENTE: Readonly<Record<StareFinala, readonly StareEmail[]>> = {
  sent: ["queued"],
  delivered: ["queued", "sent"],
  bounced: ["queued", "sent", "delivered"],
  complained: ["queued", "sent", "delivered"],
  failed: ["queued", "sent"],
};

export async function POST(request: Request): Promise<Response> {
  const config = getEmailConfig();
  if (config.webhookSecret === null) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET nu este configurat");
    return Response.json({ ok: false, error: "Webhook neconfigurat." }, { status: 500 });
  }
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const semnatura = request.headers.get("svix-signature");
  if (id === null || timestamp === null || semnatura === null) {
    return Response.json({ ok: false, error: "Antete svix lipsă." }, { status: 400 });
  }
  const body = await request.text();
  if (body.length > 64_000) {
    return Response.json({ ok: false, error: "Payload prea mare." }, { status: 413 });
  }
  if (
    !verificaSemnatura({ body, id, timestamp, header: semnatura, secret: config.webhookSecret })
  ) {
    return Response.json({ ok: false, error: "Semnătură invalidă." }, { status: 401 });
  }

  let brut: unknown;
  try {
    brut = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, error: "JSON invalid." }, { status: 400 });
  }
  const eveniment = evenimentSchema.safeParse(brut);
  if (!eveniment.success) {
    return Response.json({ ok: false, error: "Structură necunoscută." }, { status: 400 });
  }

  const stare = MAPARE[eveniment.data.type];
  const emailId = eveniment.data.data.email_id;
  // 200 pentru evenimente pe care nu le urmărim: altfel Resend reîncearcă la nesfârșit.
  if (stare === undefined || emailId === undefined) {
    return Response.json({ ok: true, ignorat: true });
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("email_log")
    .update({
      status: stare,
      ...(stare === "bounced" || stare === "complained" || stare === "failed"
        ? { error: `Eveniment Resend: ${eveniment.data.type}` }
        : {}),
    })
    .eq("provider_id", emailId)
    .in("status", PRECEDENTE[stare]);

  if (error !== null) {
    console.error("[resend-webhook] actualizare eșuată", { emailId, message: error.message });
    return Response.json({ ok: false, error: "Actualizare eșuată." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
