const { runScript } = require("./spawn.js");

(async function main() {
  runScript("dev:raw", {
    cleanup: true,
    afterExit: () =>
      console.log(
        "🏁 Processo principal encerrado.\nPressione 'Enter' para voltar ao console...",
      ),
  });
})();
