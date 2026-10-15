import spawnRunner from "./spawn.js";

(async function main() {
  spawnRunner.runScript("dev:raw", {
    cleanup: true,
    afterExit: () =>
      console.log(
        "🏁 Processo principal encerrado.\nPressione 'Enter' para voltar ao console...",
      ),
  });
})();
