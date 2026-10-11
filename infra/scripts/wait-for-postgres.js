const { exec } = require("node:child_process");

function checkPostgres() {
  exec("docker exec postgres-dev pg_isready --host localhost", handleReturn);

  function handleReturn(error, stdout) {
    if (stdout.search("accepting connections") === -1) {
      process.stdout.write(".");
      setTimeout(checkPostgres, 500);

      return;
    }

    console.log("\n🟢 Postgres está aceitando conexões!\n\n");
  }
}

process.stdout.write("\n🔴 Aguardando Postgres aceitar conexões");

checkPostgres();
