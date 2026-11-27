import { useRouter } from "next/router";
import PositionEditor from "@/components/PositionEditor";

export default function EditPositionPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;

  if (!router.isReady || !id) return null;

  return <PositionEditor recordId={id} />;
}
