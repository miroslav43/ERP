// src/app/(app)/flota/aprobari/loading.tsx
// Aceeași formă ca fallback-ul de Suspense din page.tsx: foile de aprobat sunt
// o listă de fișe, nu un tabel.
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return <Schelet forma="lista" randuri={5} />;
}
