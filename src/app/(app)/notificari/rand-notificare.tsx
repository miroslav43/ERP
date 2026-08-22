// src/app/(app)/notificari/rand-notificare.tsx
"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Info,
  ListTodo,
  Megaphone,
  OctagonAlert,
} from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import type { RandNotificare as Notificare, TipNotificare } from "@/lib/queries/notifications";
import { marcheazaNotificareaCitita } from "./actions";

const ICONITA_TIP: Readonly<Record<TipNotificare, typeof Bell>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: OctagonAlert,
  task: ListTodo,
  reminder: Bell,
  approval: ClipboardCheck,
  announcement: Megaphone,
};

const CULOARE_TIP: Readonly<Record<TipNotificare, string>> = {
  info: "text-primary",
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
  task: "text-foreground",
  reminder: "text-foreground",
  approval: "text-primary",
  announcement: "text-primary",
};

/**
 * Rândul întreg e ținta de click — nu doar titlul — la cererea explicită de a
 * naviga „de oriunde pe linie", nu doar de pe un link îngust. Un singur
 * element interactiv per rând (`<Link>` sau `<button>`, niciodată amândouă),
 * ca să nu imbricăm conținut interactiv unul în celălalt.
 *
 * `href` suprascrie `notificare.link`. Există pentru portal: legăturile din
 * notificări sunt scrise de triggere, în bază, cu rute de aplicație mare
 * codificate literal (`/concedii/<id>`, `/pontaj/saptamana`). Un angajat care le
 * urmează brut e scos din portal și adus înapoi de poartă — adică apasă pe
 * „Cererea a fost respinsă" și ajunge unde era. Portalul le traduce prin
 * `caleaDePortal` și trimite rezultatul aici; `null` înseamnă „fără link", ceea
 * ce e mai onest decât o cale ghicită.
 */
export function RandNotificare({
  notificare,
  href,
}: {
  readonly notificare: Notificare;
  readonly href?: string | null;
}) {
  const Iconita = ICONITA_TIP[notificare.kind];
  const necitita = notificare.read_at === null;
  const destinatie = href === undefined ? notificare.link : href;

  const continut = (
    <>
      <span className={`mt-0.5 shrink-0 ${CULOARE_TIP[notificare.kind]}`}>
        <Iconita aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-foreground truncate font-medium">{notificare.title}</span>
          {necitita ? (
            <span
              className="bg-primary inline-block h-2 w-2 shrink-0 rounded-full"
              aria-hidden="true"
            />
          ) : null}
        </span>
        {notificare.body !== null && notificare.body.length > 0 ? (
          <span className="text-muted-foreground mt-0.5 block text-sm break-words">
            {notificare.body}
          </span>
        ) : null}
        <span className="text-muted-foreground mt-1 block text-xs">
          {formatDateTime(notificare.created_at)}
        </span>
      </span>
      {necitita ? <span className="sr-only">, necitită</span> : null}
    </>
  );

  const clasa =
    "flex w-full items-start gap-3 rounded-md p-4 text-left transition-colors hover:bg-background focus-visible:bg-background outline-none";

  if (destinatie !== null) {
    return (
      <Link
        href={destinatie}
        onClick={() => {
          if (necitita) void marcheazaNotificareaCitita({ id: notificare.id });
        }}
        className={clasa}
      >
        {continut}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={!necitita}
      onClick={() => {
        void marcheazaNotificareaCitita({ id: notificare.id });
      }}
      className={`${clasa} disabled:cursor-default disabled:hover:bg-transparent`}
    >
      {continut}
    </button>
  );
}
