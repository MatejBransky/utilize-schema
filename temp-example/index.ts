import { readFileSync, writeFileSync } from "node:fs";
import { compile } from "@utilize/json-schema-to-typescript-lite";

async function generate() {
  writeFileSync(
    "person.d.ts",
    await compile(JSON.parse(readFileSync("person.json", "utf-8")), "Person")
  );
}

generate();
