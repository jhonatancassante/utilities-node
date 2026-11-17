// pages/tools/pdf-splitter/index.js
import ToolPage from "@/components/ToolPage";
import PdfSplitter from "@/features/pdf-splitter/components/PdfSplitter";

function PdfSplitterPage() {
  return (
    <ToolPage wide slug="pdf-splitter">
      <PdfSplitter />
    </ToolPage>
  );
}

export default PdfSplitterPage;
