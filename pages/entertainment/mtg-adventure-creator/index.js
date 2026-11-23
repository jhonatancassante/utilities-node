import AppHead from "@/components/AppHead";
import Layout from "@/components/Layout";
import MtgAdventureCreator from "@/features/mtg-adventure-creator/components/MtgAdventureCreator";

function MtgAdventureCreatorPage() {
  return (
    <>
      <AppHead
        title="Criador de Aventuras de Magic"
        description="Gere cinco cartas de Magic e transforme-as no ponto de partida de uma aventura de RPG."
      />

      <Layout>
        <MtgAdventureCreator />
      </Layout>
    </>
  );
}

export default MtgAdventureCreatorPage;
