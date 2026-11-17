// pages/tools/txt-to-csv/index.js
import ToolPage from "@/components/ToolPage";
import TxtToCsv from "@/features/txt-to-csv/components/TxtToCsv";

function TxtToCsvPage() {
  return (
    <ToolPage slug="txt-to-csv" wide>
      <TxtToCsv />
    </ToolPage>
  );
}

export default TxtToCsvPage;
