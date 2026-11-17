// pages/tools/pdf-merger/index.js
import ToolPage from "@/components/ToolPage";
import PdfMerger from "@/features/pdf-merger/components/PdfMerger";

function PdfMergerPage() {
  return (
    <ToolPage slug="pdf-merger">
      <PdfMerger />
    </ToolPage>
  );
}

export default PdfMergerPage;
