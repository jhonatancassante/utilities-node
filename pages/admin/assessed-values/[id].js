import { useRouter } from "next/router";
import AssessedValueEditor from "@/components/AssessedValueEditor";
export default function EditAssessedValuePage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  if (!router.isReady || !id) return null;
  return <AssessedValueEditor recordId={id} />;
}
