import { useRouter } from "next/router";
import CertificateEditor from "@/components/CertificateEditor";

export default function EditCertificatePage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : null;
  if (!router.isReady || !id) return null;
  return <CertificateEditor recordId={id} />;
}
