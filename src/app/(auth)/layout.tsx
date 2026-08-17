// src/app/(auth)/layout.tsx
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shell-ul ecranelor publice de autentificare. Sobru și îngust: singura sarcină
 * a acestor pagini este să ducă utilizatorul într-o sesiune validă.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-primary rounded text-2xl font-semibold tracking-tight">
            Administrativo
          </Link>
          <p className="text-muted-foreground mt-1 text-sm">
            Administrarea personalului, într-un singur loc.
          </p>
        </div>

        <div className="bg-surface border-border rounded-lg border p-6 shadow-sm sm:p-8">
          {children}
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs text-balance">
          Conturile se creează exclusiv prin invitație. Dacă nu aveți încă acces, cereți o invitație
          administratorului organizației dvs.
        </p>
      </main>
    </div>
  );
}
