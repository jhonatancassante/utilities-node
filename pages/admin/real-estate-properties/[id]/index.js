import { useRouter } from "next/router";
import RealEstatePropertyEditor from "@/components/RealEstatePropertyEditor";

export default function EditRealEstatePropertyPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  if (!router.isReady || !id) {
    return null;
  }
  return <RealEstatePropertyEditor recordId={id} />;
}
