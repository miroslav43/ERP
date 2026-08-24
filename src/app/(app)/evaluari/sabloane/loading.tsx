// src/app/(app)/evaluari/sabloane/loading.tsx
import { Schelet } from "@/components/ui/schelet";

/**
 * Șabloanele se randează ca grilă de carduri, nu ca tabel — scheletul
 * segmentului părinte (bandă de indicatori plus tabel) ar fi desenat altceva
 * decât apare.
 */
export default function Incarcare() {
  return <Schelet forma="carduri" randuri={4} />;
}
