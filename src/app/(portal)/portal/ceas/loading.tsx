// src/app/(portal)/portal/ceas/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/**
 * Învelișul portalului e `force-dynamic` și face șase interogări la fiecare
 * navigare. Scurtătura de pe ecranul de start deschide pagina la rece, deci
 * fără schelet omul se uită la un ecran gol exact în secunda în care se grăbește.
 */
export default function Incarcare() {
  return <Schelet forma="carduri" randuri={1} />;
}
