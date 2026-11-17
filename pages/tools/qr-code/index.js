// pages/tools/qr-code/index.js
import ToolPage from "@/components/ToolPage";
import QrCodeGenerator from "@/features/qr-code/components/QrCodeGenerator";

function QrCodePage() {
  return (
    <ToolPage slug="qr-code">
      <QrCodeGenerator />
    </ToolPage>
  );
}

export default QrCodePage;
