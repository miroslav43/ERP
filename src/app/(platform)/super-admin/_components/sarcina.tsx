import Link from "next/link";

type Props = Readonly<{
  titlu: string;
  detaliu: string;
  href: string;
  eticheta: string;
  urgent?: boolean;
}>;

/** Un rând din coada de lucru: ce e, de ce, și butonul care o rezolvă. */
export function Sarcina({ titlu, detaliu, href, eticheta, urgent = false }: Props) {
  return (
    <li className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <span
        aria-hidden="true"
        className={`size-2 shrink-0 rounded-full ${
          urgent ? "bg-accent ring-accent/20 ring-4" : "bg-muted-foreground/50"
        }`}
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-foreground text-sm font-semibold">{titlu}</span>
        <span className="text-muted-foreground text-sm">{detaliu}</span>
      </span>
      <Link
        href={href}
        className="border-border bg-background text-primary hover:border-primary ms-auto shrink-0 rounded-md border px-3 py-1.5 text-sm font-semibold transition"
      >
        {eticheta}
      </Link>
    </li>
  );
}
