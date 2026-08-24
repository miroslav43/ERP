// src/app/(app)/organigrama/loading.tsx
// Arborele e o grilă de fișe; citirea din spate se trunchiază la 1000 de
// rânduri, deci așteptarea poate fi lungă.
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return <Schelet forma="carduri" randuri={6} />;
}
