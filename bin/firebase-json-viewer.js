#!/usr/bin/env node

const program = require("commander");
const Server = require("../server");

program
  .option("-d, --database <url>", "Firebase database URL (https://myapp.firebaseio.com)")
  .option("-s, --serviceAccount <path>", "Optional, Firebase service account json file")
  .parse(process.argv);

const { database, serviceAccount } = program;

if (!database) {
  program.outputHelp();
  return;
}

Server(database, serviceAccount);
