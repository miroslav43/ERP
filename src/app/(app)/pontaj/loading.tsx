// src/app/(app)/pontaj/loading.tsx
// Foaia colectivă are o coloană de nume, 28–31 de coloane de zi și cinci de
// total. Numărul exact depinde de lună, deci scheletul redă densitatea
// cadrului, nu fiecare zi în parte.
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return <Schelet forma="tabel" coloane={12} />;
}
