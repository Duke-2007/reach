import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "public", "data");
const sourcePath = path.join(dataDirectory, "simulator_grid.json");
const targetPath = path.join(dataDirectory, "brief_targeting.json");
const simulator = JSON.parse(await readFile(sourcePath, "utf8"));

await writeFile(
  targetPath,
  `${JSON.stringify({
    placeholder: simulator.placeholder,
    note: simulator.note,
    at_observed_coverage: simulator.at_observed_coverage,
  }, null, 2)}\n`,
  "utf8",
);
