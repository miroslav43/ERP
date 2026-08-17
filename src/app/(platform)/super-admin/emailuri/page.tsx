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

function Skeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-surface h-14 animate-pulse rounded-md" />
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
      <div role="alert" className="border-border bg-surface rounded-lg border p-6 text-center">
        <AlertTriangle aria-hidden="true" className="text-danger mx-auto size-6" />
        <p className="text-foreground mt-2 text-sm">Nu am putut încărca jurnalul de emailuri.</p>
        <a
          href="/super-admin/emailuri"
          className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring mt-3 inline-block rounded-md px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          Reîncearcă
        </a>
      </div>
    );
  }
  const randuri = data ?? [];
  if (randuri.length === 0) {
    return (
      <div className="border-border bg-surface rounded-lg border p-8 text-center">
        <Inbox aria-hidden="true" className="text-muted-foreground mx-auto size-6" />
        <p className="text-foreground mt-2 text-sm font-medium">Niciun email înregistrat</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Trimite o invitație dintr-o organizație sau completează formularul de demo — mesajele apar
          aici imediat.
        </p>
        <Link
          href="/super-admin/organizatii"
          className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring mt-4 inline-block rounded-md px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
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

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Emailuri trimise sau pregătite pentru trimitere</caption>
        <thead className="bg-surface text-muted-foreground text-xs uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Destinatar
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Șablon
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Stare
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Moment
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Acțiuni
            </th>
          </tr>
        </thead>
        <tbody>
          {randuri.map((rand) => {
            const cheie = isTemplateKey(rand.template) ? rand.template : null;
            const html = cheie === null ? undefined : previzualizari.get(cheie);
            const eticheta = cheie === null ? rand.template : TEMPLATE_LABELS[cheie];
            return (
              <tr key={rand.id} className="border-border border-t align-top">
                <td className="px-3 py-2">
                  <span className="text-foreground block">{rand.destinatar}</span>
                  <span className="text-muted-foreground block text-xs">{rand.subiect}</span>
                  {rand.error === null ? null : (
                    <span className="text-danger mt-1 block text-xs">{rand.error}</span>
                  )}
                </td>
                <td className="text-muted-foreground px-3 py-2">{eticheta}</td>
                <td
                  className={`px-3 py-2 ${CULORI_STATUS[rand.status] ?? "text-muted-foreground"}`}
                >
                  {ETICHETE_STATUS[rand.status] ?? rand.status}
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {formatDateTime(new Date(rand.sent_at ?? rand.created_at))}
                </td>
                <td className="px-3 py-2">
                  {config.mode === "test" && html !== undefined ? (
                    <PreviewEmail subiect={rand.subiect} sablon={eticheta} html={html} />
                  ) : (
                    <span className="text-muted-foreground text-xs">{rand.provider_id ?? "—"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <main className="space-y-6 p-6">
      <header className="flex items-start gap-3">
        <Mail aria-hidden="true" className="text-primary mt-0.5 size-5" />
        <div>
          <h1 className="text-foreground text-xl font-semibold">Emailuri</h1>
          <p className="text-muted-foreground text-sm">
            {config.mode === "test"
              ? "Modul test: mesajele sunt doar înregistrate, nu pleacă spre destinatari."
              : "Modul live: mesajele sunt trimise prin Resend."}
          </p>
        </div>
      </header>

      <form
        method="get"
        className="border-border bg-surface flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="text-muted-foreground text-xs font-medium">
            Destinatar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filtre.q}
            placeholder="ana@exemplu.ro"
            className="border-border bg-background text-foreground focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-muted-foreground text-xs font-medium">
            Stare
          </label>
          <select
            id="status"
            name="status"
            defaultValue={filtre.status}
            className="border-border bg-background text-foreground focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
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
          <label htmlFor="sablon" className="text-muted-foreground text-xs font-medium">
            Șablon
          </label>
          <select
            id="sablon"
            name="sablon"
            defaultValue={filtre.sablon}
            className="border-border bg-background text-foreground focus-visible:ring-ring rounded-md border px-2.5 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="">Toate</option>
            {EMAIL_TEMPLATE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TEMPLATE_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          Filtrează
        </button>
      </form>

      <div aria-live="polite">
        <Suspense key={`${filtre.status}|${filtre.sablon}|${filtre.q}`} fallback={<Skeleton />}>
          <TabelEmailuri filtre={filtre} />
        </Suspense>
      </div>
    </main>
  );
}
