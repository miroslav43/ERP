// src/components/feedback/error-boundary.tsx
"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type ErrorStateProps = Readonly<{
  title?: string;
  description?: string;
  onRetry: () => void;
  correlationId?: string;
}>;

/** Se folosește direct în `error.tsx`: `<ErrorState onRetry={reset} correlationId={error.digest} />`. */
export function ErrorState({ title, description, onRetry, correlationId }: ErrorStateProps) {
  return (
    <div role="alert" className="border-danger/40 bg-danger/5 rounded-lg border p-8 text-center">
      <AlertTriangle className="text-danger mx-auto mb-3 size-8" aria-hidden />
      <h3 className="text-base font-semibold">{title ?? "Nu am putut încărca datele"}</h3>
      <p className="text-muted-foreground mx-auto mt-1 max-w-prose text-sm text-pretty">
        {description ?? "A apărut o eroare de rețea sau de server. Încercați din nou."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="border-border hover:bg-surface mt-5 inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium"
      >
        <RotateCcw className="size-4" aria-hidden />
        Reîncearcă
      </button>
      {correlationId !== undefined && (
        <p className="text-muted-foreground mt-3 font-mono text-xs">Cod eroare: {correlationId}</p>
      )}
    </div>
  );
}

type BoundaryProps = Readonly<{ children: ReactNode; description?: string }>;
type BoundaryState = Readonly<{ eroare: Error | null }>;

/**
 * `error.tsx` prinde doar erorile de randare ale rutei. Pentru secțiuni
 * independente (un card de dashboard care nu trebuie să doboare pagina)
 * folosim acest boundary local.
 */
export class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { eroare: null };

  static getDerivedStateFromError(eroare: Error): BoundaryState {
    return { eroare };
  }

  override componentDidCatch(eroare: Error, info: ErrorInfo): void {
    console.error("[ui] eroare de randare", eroare.message, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.eroare === null) return this.props.children;
    return (
      <ErrorState
        onRetry={() => this.setState({ eroare: null })}
        {...(this.props.description === undefined ? {} : { description: this.props.description })}
      />
    );
  }
}
