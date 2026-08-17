import Link from "next/link";

/**
 * Marcaj temporar, ca ruta rădăcină să nu rămână pagina generată de
 * `create-next-app`. Landing page-ul propriu-zis se construiește în Faza 1b,
 * împreună cu formularul „Cere demo".
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <p className="text-accent text-sm font-medium tracking-wide uppercase">Faza 0 — fundație</p>
      <h1 className="text-primary text-4xl font-semibold text-balance">Administrativo</h1>
      <p className="text-muted-foreground text-lg">
        Sistem de administrare a personalului pentru firme din România. Pontaj, concedii, salarii,
        SSM, flotă și inventar, într-un singur loc.
      </p>
      <p className="text-muted-foreground text-sm">
        Aplicația este în construcție. Landing page-ul și autentificarea se livrează în faza
        următoare.
      </p>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:bg-primary-hover w-fit rounded px-4 py-2 text-sm font-medium transition-colors"
      >
        Înapoi la început
      </Link>
    </main>
  );
}
