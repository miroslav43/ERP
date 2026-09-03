// src/app/(app)/concedii/calendar/loading.tsx
// Vederea implicită e planificatorul (`vedere.ts`), nu grila lunară: un rând
// pe angajat, o coloană pe zi — până la 31 într-o lună, nu șapte pe săptămână.
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return <Schelet forma="tabel" coloane={31} randuri={6} />;
}
