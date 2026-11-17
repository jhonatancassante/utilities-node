// pages/tools/txt-para-csv/index.js
import ToolPage from "@/components/ToolPage";
import TxtToCsv from "@/features/txt-to-csv/components/TxtToCsv";

function TxtToCsvPage() {
  return (
    <ToolPage slug="txt-para-csv" wide>
      <TxtToCsv />
    </ToolPage>
  );
}

export default TxtToCsvPage;
