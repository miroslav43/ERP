// src/app/(app)/functii/loading.tsx
import { Schelet } from "@/components/ui/schelet";

// `tabel`, nu `lista`: ecranul a devenit tabel peste 768px și carduri sub, iar
// un schelet care nu seamănă cu ce urmează produce exact saltul pe care ar
// trebui să-l acopere.
export default function Incarcare() {
  return <Schelet forma="tabel" coloane={6} />;
}
