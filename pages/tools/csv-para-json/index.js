// pages/tools/csv-para-json/index.js
import ToolPage from "@/components/ToolPage";
import CsvToJson from "@/features/csv-to-json/components/CsvToJson";

function CsvToJsonPage() {
  return (
    <ToolPage slug="csv-para-json" wide>
      <CsvToJson />
    </ToolPage>
  );
}

export default CsvToJsonPage;
