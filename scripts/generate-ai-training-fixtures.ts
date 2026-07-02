import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDemoBinaryFixtures } from "../src/lib/ecuIntelligence/demoFixtures";

const outputDirectory = resolve(process.cwd(), "tests", "fixtures", "ecu-intelligence");

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  for (const [name, buffer] of Object.entries(buildDemoBinaryFixtures())) {
    await writeFile(resolve(outputDirectory, name), buffer);
  }
  console.log(`Generated harmless ECU Intelligence fixtures in ${outputDirectory}`);
}

void main();
