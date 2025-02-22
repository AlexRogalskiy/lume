import { encode } from "./deps/base64.ts";
import { parse } from "./deps/flags.ts";
import { cyan, green, red } from "./deps/colors.ts";
import {
  checkDenoVersion,
  getImportMap,
  ImportMap,
  toUrl,
} from "./core/utils.ts";

/** Returns the Lume & Deno arguments */
export async function getArgs(args: string[]): Promise<[string[], string[]]> {
  const sep = args.indexOf("--");
  const lumeArgs = sep === -1 ? args : args.slice(0, sep);
  const denoArgs = [
    "--unstable",
    "-A",
    `--no-check`,
  ];

  if (lumeArgs.includes("--quiet")) {
    denoArgs.push("--quiet");
  }

  // Deno flags
  const parsedArgs = parse(sep === -1 ? [] : args.slice(sep + 1));

  // Regular flags
  for (const [name, value] of Object.entries(parsedArgs)) {
    switch (name) {
      case "_":
      case "import-map":
        break;

      default: {
        const flagName = name.length === 1 ? `-${name}` : `--${name}`;
        denoArgs.push(value === true ? flagName : `${flagName}=${value}`);
      }
    }
  }

  // Merge the import map
  let importMap: ImportMap;

  if (parsedArgs["import-map"]) {
    const mapUrl = await toUrl(parsedArgs["import-map"]);
    const mapContent = await (await fetch(mapUrl)).text();
    const parsedMap = JSON.parse(mapContent) as ImportMap;
    importMap = getImportMap(parsedMap, mapUrl);
  } else {
    importMap = await getImportMap();
  }

  const mapUrl = `data:application/json;base64,${
    encode(JSON.stringify(importMap))
  }`;
  denoArgs.push(`--import-map=${mapUrl}`);

  return [lumeArgs, denoArgs];
}

export default async function main(args: string[]) {
  const denoInfo = checkDenoVersion();

  if (denoInfo) {
    console.log("----------------------------------------");
    console.error(red("Error running Lume"));
    console.log(`Lume needs Deno ${green(denoInfo.minimum)} or greater`);
    console.log(`Your current version is ${red(denoInfo.current)}`);
    console.log(`Run ${cyan(denoInfo.command)} and try again`);
    console.log("----------------------------------------");
    Deno.exit(1);
  }

  const [lumeArgs, denoArgs] = await getArgs(args);
  const cli = new URL("./cli.ts", import.meta.url).href;
  const process = Deno.run({
    cmd: [
      Deno.execPath(),
      "run",
      ...denoArgs,
      cli,
      ...lumeArgs,
    ],
  });

  const status = await process.status();
  process.close();

  if (!status.success) {
    addEventListener("unload", () => Deno.exit(1));
  }
}

// Run the current command
if (import.meta.main) {
  main(Deno.args);
}
