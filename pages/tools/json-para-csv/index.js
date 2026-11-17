// pages/tools/json-para-csv/index.js
import ToolPage from "@/components/ToolPage";
import JsonToCsv from "@/features/json-to-csv/components/JsonToCsv";

function JsonToCsvPage() {
  return (
    <ToolPage slug="json-para-csv" wide>
      <JsonToCsv />
    </ToolPage>
  );
}

export default JsonToCsvPage;
