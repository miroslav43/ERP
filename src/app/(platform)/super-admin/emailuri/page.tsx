// src/app/(platform)/super-admin/emailuri/page.tsx
import { Suspense } from "react";
import { AlertTriangle, Inbox, Mail } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format/date";
import { getEmailConfig } from "@/lib/email/config";
import {
  EMAIL_TEMPLATE_KEYS,
  SAMPLE_MESSAGES,
  TEMPLATE_LABELS,
  isTemplateKey,
  renderEmail,
  type EmailTemplateKey,
} from "@/lib/email/templates";
import { PreviewEmail } from "./preview-email";
import Link from "next/link";
import { Buton, buton } from "@/components/ui/buton";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { cn } from "@/lib/ui/cn";

export const metadata = { title: "Emailuri · Super-Admin" };
export const dynamic = "force-dynamic";

const STATUSURI = ["queued", "sent", "delivered", "bounced", "complained", "failed"] as const;
type StatusEmail = (typeof STATUSURI)[number];
// Filtrul vine din query string, deci trebuie validat înainte de a ajunge în enum-ul din baza de date.
const esteStatus = (v: string): v is StatusEmail => (STATUSURI as readonly string[]).includes(v);
const ETICHETE_STATUS: Readonly<Record<string, string>> = {
  queued: "În așteptare",
  sent: "Trimis",
  delivered: "Livrat",
  bounced: "Respins",
  complained: "Reclamat",
  failed: "Eșuat",
};
const CULORI_STATUS: Readonly<Record<string, string>> = {
  queued: "text-muted-foreground",
  sent: "text-accent",
  delivered: "text-success",
  bounced: "text-danger",
  complained: "text-warning",
  failed: "text-danger",
};

type SearchParams = Readonly<Record<string, string | string[] | undefined>>;
const primaValoare = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

type Filtre = Readonly<{ status: string; sablon: string; q: string }>;

/** Cheia necunoscută se arată ca atare — baza poate avea șabloane pe care codul nu le știe. */
const etichetaSablon = (cheie: string): string =>
  isTemplateKey(cheie) ? TEMPLATE_LABELS[cheie] : cheie;

function Skeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface rounded-control h-14 animate-pulse" />
      ))}
    </div>
  );
}

async function TabelEmailuri({ filtre }: { readonly filtre: Filtre }) {
  const supabase = await createServerSupabase();
  const config = getEmailConfig();
  let cerere = supabase
    .from("email_log")
    .select("id, destinatar, subiect, template, status, provider_id, error, sent_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (esteStatus(filtre.status)) cerere = cerere.eq("status", filtre.status);
  if (filtre.sablon !== "") cerere = cerere.eq("template", filtre.sablon);
  if (filtre.q !== "") cerere = cerere.ilike("destinatar", `%${filtre.q}%`);

  const { data, error } = await cerere;
  if (error !== null) {
    return (
      <div role="alert" className="border-border bg-surface rounded-panou border p-6 text-center">
        <AlertTriangle aria-hidden="true" className="text-danger mx-auto size-6" />
        <p className="text-foreground text-corp mt-2">Nu am putut încărca jurnalul de emailuri.</p>
        <a href="/super-admin/emailuri" className={cn(buton({ varianta: "primar" }), "mt-3")}>
          Reîncearcă
        </a>
      </div>
    );
  }
  const randuri = data ?? [];
  if (randuri.length === 0) {
    return (
      <div className="border-border bg-surface rounded-panou border p-8 text-center">
        <Inbox aria-hidden="true" className="text-muted-foreground mx-auto size-6" />
        <p className="text-foreground text-corp mt-2 font-medium">Niciun email înregistrat</p>
        <p className="text-muted-foreground text-corp mt-1">
          Trimite o invitație dintr-o organizație sau completează formularul de demo — mesajele apar
          aici imediat.
        </p>
        <Link href="/super-admin/organizatii" className={cn(buton({ varianta: "primar" }), "mt-4")}>
          Mergi la organizații
        </Link>
      </div>
    );
  }

  const previzualizari = new Map<EmailTemplateKey, string>(
    EMAIL_TEMPLATE_KEYS.map(
      (k) => [k, renderEmail(SAMPLE_MESSAGES[k], { appUrl: config.appUrl }).html] as const,
    ),
  );

  type RandEmail = (typeof randuri)[number];

  /*
   * Jurnalul se citește tăiat la 100 de rânduri, fără cursor keyset, deci
   * antetele nu pretind că sortează. Butonul de previzualizare stă pe `insigna`,
   * nu pe `meta`: varianta de card pune metadatele într-un `<p>`, iar dialogul
   * din `PreviewEmail` e conținut de flux — l-ar închide devreme la parsare.
   */
  const coloane: readonly Coloana<RandEmail>[] = [
    {
      cheie: "destinatar",
      antet: "Destinatar",
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          <span className="text-foreground block">{rand.destinatar}</span>
          <span className="text-muted-foreground text-nota block">{rand.subiect}</span>
          {rand.error === null ? null : (
            <span className="text-danger text-nota mt-1 block">{rand.error}</span>
          )}
        </>
      ),
    },
    {
      cheie: "sablon",
      antet: "Șablon",
      peTelefon: "meta",
      celula: (rand) => (
        <span className="text-muted-foreground">{etichetaSablon(rand.template)}</span>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (rand) => (
        <span className={CULORI_STATUS[rand.status] ?? "text-muted-foreground"}>
          {ETICHETE_STATUS[rand.status] ?? rand.status}
        </span>
      ),
    },
    {
      cheie: "moment",
      antet: "Moment",
      peTelefon: "meta",
      celula: (rand) => (
        <span className="text-muted-foreground">
          {formatDateTime(new Date(rand.sent_at ?? rand.created_at))}
        </span>
      ),
    },
    {
      cheie: "actiuni",
      antet: "Acțiuni",
      peTelefon: "insigna",
      celula: (rand) => {
        const cheie = isTemplateKey(rand.template) ? rand.template : null;
        const html = cheie === null ? undefined : previzualizari.get(cheie);
        return config.mode === "test" && html !== undefined ? (
          <PreviewEmail subiect={rand.subiect} sablon={etichetaSablon(rand.template)} html={html} />
        ) : (
          <span className="text-muted-foreground text-nota">{rand.provider_id ?? "—"}</span>
        );
      },
    },
  ];

  return (
    <Tabel
      caption="Emailuri trimise sau pregătite pentru trimitere"
      coloane={coloane}
      randuri={randuri}
      cheieRand={(rand) => rand.id}
      densitate="compact"
      // Citirea are `.limit(100)`: la fix o sută de rânduri jurnalul e aproape
      // sigur tăiat, iar până acum nimic nu o spunea.
      trunchiat={randuri.length >= 100}
      gol={null}
    />
  );
}

export default async function PaginaEmailuri({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const filtre: Filtre = {
    status: primaValoare(params["status"]),
    sablon: primaValoare(params["sablon"]),
    q: primaValoare(params["q"]),
  };
  const config = getEmailConfig();

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Mail aria-hidden="true" className="text-primary mt-0.5 size-5" />
        <div>
          <h1 className="text-foreground text-titlu font-semibold">Emailuri</h1>
          <p className="text-muted-foreground text-corp">
            {config.mode === "test"
              ? "Modul test: mesajele sunt doar înregistrate, nu pleacă spre destinatari."
              : "Modul live: mesajele sunt trimise prin Resend."}
          </p>
        </div>
      </header>

      <form
        method="get"
        className="border-border bg-surface rounded-panou flex flex-wrap items-end gap-3 border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-muted-foreground text-nota font-medium">
            Destinatar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filtre.q}
            placeholder="ana@exemplu.ro"
            className="border-border bg-background text-foreground rounded-control text-corp border px-2.5 py-1.5"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-muted-foreground text-nota font-medium">
            Stare
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filtre.status}
            className="border-border bg-background text-foreground rounded-control text-corp border px-2.5 py-1.5"
          >
            <option value="">Toate</option>
            {STATUSURI.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STATUS[s] ?? s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="sablon" className="text-muted-foreground text-nota font-medium">
            Șablon
          </label>
          <select
            id="sablon"
            name="sablon"
            defaultValue={filtre.sablon}
            className="border-border bg-background text-foreground rounded-control text-corp border px-2.5 py-1.5"
          >
            <option value="">Toate</option>
            {EMAIL_TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <Buton type="submit" varianta="primar">
          Filtrează
        </Buton>
      </form>

      <div aria-live="polite">
        <Suspense key={`${filtre.status}|${filtre.sablon}|${filtre.q}`} fallback={<Skeleton />}>
          <TabelEmailuri filtre={filtre} />
        </Suspense>
      </div>
    </div>
  );
}
