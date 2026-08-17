// src/components/feedback/empty-state.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = Readonly<{
  icon: LucideIcon;
  title: string;
  description: string;
  action?: Readonly<{ label: string; href: string }>;
  children?: ReactNode;
}>;

/**
 * Starea „gol" nu este o eroare și nu este „zero rezultate la filtrare":
 * trei mesaje distincte, fiecare cu acțiunea potrivită.
 */
export function EmptyState({ icon: Icon, title, description, action, children }: Props) {
  return (
    <div className="border-border bg-surface flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <Icon className="text-muted-foreground mb-4 size-10" aria-hidden />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-muted-foreground mt-1 max-w-prose text-sm text-pretty">{description}</p>
      {action !== undefined && (
        <Link
          href={action.href}
          className="bg-primary text-primary-foreground hover:bg-primary-hover mt-6 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          {action.label}
        </Link>
      )}
      {children}
    </div>
  );
}
