// src/components/ui/callout.tsx
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Blocul de mesaj din pagină. Înlocuiește ~30 de casete scrise de mână, cu
 * cinci rețete concurente și patru opacități diferite pentru același înțeles
 * (`bg-warning/8`, `/10`, `/12`; `bg-danger/5`, `/8`).
 *
 * Ce se repară aici, o singură dată:
 *
 * **Pictograma e obligatorie prin construcție.** Un bloc de eroare identificat
 * doar prin chenar roșu dispare la tipărire alb-negru și pentru cine nu
 * distinge roșul de verde.
 *
 * **`role="alert"` intră automat pe `eroare`**, nu se scrie de mână — era
 * omis exact acolo unde conta.
 *
 * **Corpul rămâne `text-foreground`, nu `text-danger`.** Pe `bg-danger/8`,
 * cerneala dă 13,11:1, iar roșul 5,36:1: amândouă trec, dar amestecul lor în
 * același bloc arată ca două sisteme. Roșul rămâne al pictogramei și al
 * mesajului de sub un câmp — acolo e semnal, aici ar fi decor.
 *
 * Informativul e NEUTRU, nu albastru: albastrul nu există în paleta acestui
 * produs, iar „informativ” nu e o stare care cere culoare.
 */
export type FelCallout = "neutru" | "informativ" | "atentie" | "eroare";

const CADRU: Readonly<Record<FelCallout, string>> = {
  neutru: "border-border bg-surface",
  informativ: "border-border bg-surface",
  atentie: "border-warning/40 bg-warning/12",
  eroare: "border-danger/40 bg-danger/8",
};

const CULOARE_PICTOGRAMA: Readonly<Record<FelCallout, string>> = {
  neutru: "text-muted-foreground",
  informativ: "text-muted-foreground",
  atentie: "text-foreground",
  eroare: "text-danger",
};

const PICTOGRAMA = {
  neutru: Info,
  informativ: Info,
  atentie: AlertTriangle,
  eroare: AlertCircle,
} as const;

export type PropsCallout = Readonly<{
  fel: FelCallout;
  titlu?: string;
  children: ReactNode;
  /** Butonul sau linkul din colțul din dreapta — „Șterge filtrele”, „Reîncearcă”. */
  actiune?: ReactNode;
  className?: string;
}>;

export function Callout({ fel, titlu, children, actiune, className }: PropsCallout): ReactElement {
  const Pictograma = PICTOGRAMA[fel];

  return (
    <div
      role={fel === "eroare" ? "alert" : undefined}
      className={cn(
        "text-foreground rounded-panou text-corp flex items-start gap-2.5 border p-3",
        CADRU[fel],
        className,
      )}
    >
      <Pictograma
        aria-hidden="true"
        className={cn("size-4 shrink-0 translate-y-0.5", CULOARE_PICTOGRAMA[fel])}
      />
      <div className="min-w-0 flex-1">
        {titlu === undefined ? null : <p className="font-medium">{titlu}</p>}
        <div className={cn(titlu === undefined ? "" : "mt-0.5")}>{children}</div>
      </div>
      {actiune === undefined ? null : <div className="shrink-0">{actiune}</div>}
    </div>
  );
}
