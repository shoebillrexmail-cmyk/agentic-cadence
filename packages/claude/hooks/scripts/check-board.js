const fs = require("fs");
const path = require("path");

try {
  const cwd = process.cwd();
  const claudeMd = fs.readFileSync(path.join(cwd, "CLAUDE.md"), "utf8");
  const match = claudeMd.match(/Sprint Board:\s*(.+)/);
  if (!match) process.exit(0);

  const boardPath = match[1].trim().replace(/`/g, "");
  const board = fs.readFileSync(boardPath, "utf8");

  const inProgress = board.split("## In Progress")[1];
  if (!inProgress) process.exit(0);

  const section = inProgress.split("##")[0];
  const items = section.match(/- \[.\].+/g);

  if (items && items.length > 0) {
    console.error("[Cadence] Stories still In Progress:");
    items.forEach((i) => console.error("  " + i.trim()));
  }
} catch (e) {
  // No CLAUDE.md, no board, or not in a project — silent exit
  process.exit(0);
}
