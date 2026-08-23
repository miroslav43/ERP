// src/app/(app)/concedii/calendar/loading.tsx
// Grila lunii: șapte zile pe săptămână, șase săptămâni afișate.
import { Schelet } from "@/components/ui/schelet";

export default function Incarcare() {
  return <Schelet forma="tabel" coloane={7} randuri={6} />;
}
