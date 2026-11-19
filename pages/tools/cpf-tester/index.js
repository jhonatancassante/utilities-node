// pages/tools/cpf-tester/index.js
import ToolPage from "@/components/ToolPage";
import CpfTester from "@/features/cpf-tester/components/CpfTester";

function CpfTesterPage() {
  return (
    <ToolPage slug="cpf-tester" wide>
      <CpfTester />
    </ToolPage>
  );
}

export default CpfTesterPage;
