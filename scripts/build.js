const { readdirSync } = require("fs");
const { join } = require("path");
const { exec } = require("child_process");

const hasDependency = ["test-utils", "core", "react", "preact"];
const noDependency = readdirSync(join(__dirname, "..", "packages")).filter(
  x => !hasDependency.some(y => y === x)
);

const command = exec(
  'lerna run --scope "@grafoo/*(' +
    noDependency.join("|") +
    ')" prepare && lerna run --scope "@grafoo/*(' +
    hasDependency.join("|") +
    ')" prepare'
);

command.stdout.pipe(process.stdout);
command.stderr.pipe(process.stderr);
