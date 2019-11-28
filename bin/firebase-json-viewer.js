#!/usr/bin/env node

const program = require("commander");
const Server = require("../server");

program
  .option(
    "-d, --database <url>",
    "Firebase database URL (https://myapp.firebaseio.com)"
  )
  .option(
    "-s, --serviceAccount <path>",
    "Optional, Firebase service account json file"
  )
  .option(
    "-t, --token <string>",
    "Optional, Firebase access token for restful api"
  )
  .parse(process.argv);

const { database, serviceAccount, token } = program;

if (!database) {
  program.outputHelp();
  return;
}

Server({ database, serviceAccount, token });
