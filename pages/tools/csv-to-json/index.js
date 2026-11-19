// pages/tools/csv-to-json/index.js
import ToolPage from "@/components/ToolPage";
import CsvToJson from "@/features/csv-to-json/components/CsvToJson";

function CsvToJsonPage() {
  return (
    <ToolPage slug="csv-to-json" wide>
      <CsvToJson />
    </ToolPage>
  );
}

export default CsvToJsonPage;
