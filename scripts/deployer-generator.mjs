#!/usr/bin/env node

/**
 * Build Cardano Swaps deployer GCScripts from CIP-57 plutus.json blueprints.
 *
 * Install:
 *   pnpm add -D @meshsdk/core
 *
 * Run:
 *   node scripts/deployer-generator.mjs
 */

import {
  applyParamsToScript,
  resolveScriptHash,
} from "@meshsdk/core";

import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";

import {
  dirname,
  join,
  resolve,
} from "node:path";

import {
  fileURLToPath,
} from "node:url";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SCRIPT_DIRECTORY = dirname(
  fileURLToPath(import.meta.url),
);

const PROJECT_ROOT = resolve(
  SCRIPT_DIRECTORY,
  "..",
);

/**
 * Input template must be pure, comment-free JSON.
 */
const TEMPLATE_FILE = resolve(
  PROJECT_ROOT,
  "scripts/deploy.gcscript.json",
);

/**
 * Generated JSONC deployers are written here.
 */
const TARGET_DIRECTORY = resolve(
  PROJECT_ROOT,
  "src/intents/utils",
);

/**
 * Each entry generates:
 *
 *   <name>-<commit>.gcscript.jsonc
 *
 * For newer Aiken blueprints, use the purpose-specific entries:
 *
 * - spending validator: *.spend
 * - minting policy:     *.mint
 *
 * The *.else entry is a fallback handler and does not have the published
 * spending-validator or minting-policy hash.
 */
const VALIDATOR_SETS = [
  // ---------------------------------------------------------------------------
  // Latest protocol v2 — Plutus V3
  // ---------------------------------------------------------------------------

  {
    name: "swap-v2-one-way",
    commit: "0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f",

    description:
      "Latest Cardano Swaps protocol v2 one-way swap validator set with optional order expiration.",

    plutusJsonUrl:
      "https://raw.githubusercontent.com/fallen-icarus/cardano-swaps/0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f/aiken/plutus.json",

    versionsUrl:
      "https://github.com/fallen-icarus/cardano-swaps/blob/0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f/VERSIONS.md",

    spendingValidator:
      "one_way_swap.swap_script.spend",

    beaconPolicy:
      "one_way_swap.beacon_script.mint",

    expectedHashes: {
      spendingValidator:
        "ef69e7b2174184c1a1e140f255af81bb6a8daf7d3796563ec7bdeccb",

      beaconPolicy:
        "4557249e92a42c371f494c32fcfbb31648ef14c4fb69056e56269af3",
    },
  },

  {
    name: "swap-v2-two-way",
    commit: "0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f",

    description:
      "Latest Cardano Swaps protocol v2 two-way swap validator set with optional order expiration.",

    plutusJsonUrl:
      "https://raw.githubusercontent.com/fallen-icarus/cardano-swaps/0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f/aiken/plutus.json",

    versionsUrl:
      "https://github.com/fallen-icarus/cardano-swaps/blob/0b24fc374c8b30ca5f46b70ab4e078cdd7333e2f/VERSIONS.md",

    spendingValidator:
      "two_way_swap.swap_script.spend",

    beaconPolicy:
      "two_way_swap.beacon_script.mint",

    expectedHashes: {
      spendingValidator:
        "81bd68c4428281814bb2c69d75af4bc45876dfdc0af82c1ed4b8a8b4",

      beaconPolicy:
        "ca68d83fa7afe2dab5bfdaa9ee2fd5e0dc584f0d5cbbac887c2b77a2",
    },
  },

  // ---------------------------------------------------------------------------
  // Latest protocol v1 — Plutus V2
  // ---------------------------------------------------------------------------

  {
    name: "swap-v1-one-way",
    commit: "9ec41e7619f5ba9d3dd46dd194e2146098093721",

    description:
      "Current audited Cardano Swaps protocol v1 one-way swap validator set.",

    plutusJsonUrl:
      "https://raw.githubusercontent.com/fallen-icarus/cardano-swaps/9ec41e7619f5ba9d3dd46dd194e2146098093721/aiken/plutus.json",

    versionsUrl:
      "https://github.com/fallen-icarus/cardano-swaps/blob/9ec41e7619f5ba9d3dd46dd194e2146098093721/VERSIONS.md",

    spendingValidator:
      "one_way_swap.swap_script",

    beaconPolicy:
      "one_way_swap.beacon_script",

    expectedHashes: {
      spendingValidator:
        "01fa36465dfe36e26c21fdbf720e4bdafcc0b86bb5367fca46012f56",

      beaconPolicy:
        "47cec2a1404ed91fc31124f29db15dc1aae77e0617868bcef351b8fd",
    },
  },

  {
    name: "swap-v1-two-way",
    commit: "9ec41e7619f5ba9d3dd46dd194e2146098093721",

    description:
      "Current audited Cardano Swaps protocol v1 two-way swap validator set.",

    plutusJsonUrl:
      "https://raw.githubusercontent.com/fallen-icarus/cardano-swaps/9ec41e7619f5ba9d3dd46dd194e2146098093721/aiken/plutus.json",

    versionsUrl:
      "https://github.com/fallen-icarus/cardano-swaps/blob/9ec41e7619f5ba9d3dd46dd194e2146098093721/VERSIONS.md",

    spendingValidator:
      "two_way_swap.swap_script",

    beaconPolicy:
      "two_way_swap.beacon_script",

    expectedHashes: {
      spendingValidator:
        "87381f0bf416e2dae7497d3fcd8087cf677b3cb4b2aeba36ed8f8f79",

      beaconPolicy:
        "84662c22dc5c0cadad7b2ebf9757ce9ea61dbd8fe64bc8c43c112a40",
    },
  },

  // ---------------------------------------------------------------------------
  // Historical protocol v2 used by NeonSoup — Plutus V2
  // ---------------------------------------------------------------------------

  {
    name: "swap-v2-one-way",
    commit: "520ea1d27d5fdee36f7f461e725aaf2be05e79f4",

    description:
      "Historical Cardano Swaps protocol v2 one-way validator set initially used by NeonSoup.",

    plutusJsonUrl:
      "https://raw.githubusercontent.com/fallen-icarus/cardano-swaps/520ea1d27d5fdee36f7f461e725aaf2be05e79f4/aiken/plutus.json",

    versionsUrl:
      "https://github.com/fallen-icarus/cardano-swaps/blob/520ea1d27d5fdee36f7f461e725aaf2be05e79f4/VERSIONS.md",

    spendingValidator:
      "one_way_swap.swap_script",

    beaconPolicy:
      "one_way_swap.beacon_script",

    expectedHashes: {
      spendingValidator:
        "1d6cff26bcab91d2061aad0bd259cbb7d76d25ced2eeaed5926a42ad",

      beaconPolicy:
        "c4d7d117d9ebcde6db28db40837ff2b1401e9eaaa6eecea9e070e209",
    },
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function assertHex(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(value)
  ) {
    throw new Error(
      `${label} is not valid hexadecimal.`,
    );
  }

  return value.toLowerCase();
}

function normalizeFileName(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (
    !normalized ||
    normalized === "." ||
    normalized === ".."
  ) {
    throw new Error(
      `Invalid filename: ${JSON.stringify(value)}`,
    );
  }

  return normalized;
}

function verifyHash(actual, expected, label) {
  if (!expected) {
    return;
  }

  if (
    actual.toLowerCase() !== expected.toLowerCase()
  ) {
    throw new Error(
      `${label} hash mismatch.\n` +
      `Expected: ${expected}\n` +
      `Actual:   ${actual}`,
    );
  }
}

function getBlueprintHash(validator, label) {
  return assertHex(
    validator.hash,
    `${label} blueprint hash`,
  );
}

/**
 * Decode one definite-length CBOR byte string.
 *
 * Returns the contained hexadecimal payload when the complete input is one
 * CBOR byte string. Returns null when the input is not a CBOR byte string.
 */
function decodeCborBytestring(hex, label) {
  const bytes = Buffer.from(
    assertHex(hex, label),
    "hex",
  );

  const first = bytes[0];
  const major = first >> 5;
  const additional = first & 0x1f;

  if (major !== 2) {
    return null;
  }

  let length;
  let offset = 1;

  if (additional < 24) {
    length = additional;
  } else if (additional === 24) {
    if (bytes.length < 2) {
      throw new Error(
        `${label} has an incomplete CBOR byte-string header.`,
      );
    }

    length = bytes[offset];
    offset += 1;
  } else if (additional === 25) {
    if (bytes.length < 3) {
      throw new Error(
        `${label} has an incomplete CBOR byte-string header.`,
      );
    }

    length = bytes.readUInt16BE(offset);
    offset += 2;
  } else if (additional === 26) {
    if (bytes.length < 5) {
      throw new Error(
        `${label} has an incomplete CBOR byte-string header.`,
      );
    }

    length = bytes.readUInt32BE(offset);
    offset += 4;
  } else {
    throw new Error(
      `${label} uses an unsupported CBOR byte-string encoding.`,
    );
  }

  if (offset + length !== bytes.length) {
    return null;
  }

  return bytes
    .subarray(offset)
    .toString("hex");
}

/**
 * Wrap hexadecimal bytes in one definite-length CBOR byte string.
 */
function cborEncodeBytestring(hex, label) {
  const payload = Buffer.from(
    assertHex(hex, label),
    "hex",
  );

  let header;

  if (payload.length < 24) {
    header = Buffer.from([
      0x40 + payload.length,
    ]);
  } else if (payload.length < 0x100) {
    header = Buffer.from([
      0x58,
      payload.length,
    ]);
  } else if (payload.length < 0x10000) {
    header = Buffer.alloc(3);
    header[0] = 0x59;
    header.writeUInt16BE(
      payload.length,
      1,
    );
  } else {
    header = Buffer.alloc(5);
    header[0] = 0x5a;
    header.writeUInt32BE(
      payload.length,
      1,
    );
  }

  return Buffer.concat([
    header,
    payload,
  ]).toString("hex");
}

/**
 * GameChanger consumes scriptHex using the double-CBOR-wrapped representation
 * found on some tooling on Cardano:
 *
 *   CBOR bytes(CBOR bytes(flat UPLC))
 *
 * Aiken blueprint compiledCode normally has one CBOR byte-string layer.
 * Mesh applyParamsToScript currently returns two layers.
 *
 * This function adds only missing outer layers. It never parses, changes, or
 * recompiles the underlying UPLC.
 */
function normalizeGcScriptHex(
  scriptHex,
  label,
) {
  let normalized = assertHex(
    scriptHex,
    label,
  );

  let layers = 0;
  let inner = normalized;

  while (true) {
    const decoded = decodeCborBytestring(
      inner,
      label,
    );

    if (decoded === null) {
      break;
    }

    layers += 1;
    inner = decoded;
  }

  if (layers > 2) {
    throw new Error(
      `${label} has ${layers} CBOR byte-string layers; expected at most 2.`,
    );
  }

  while (layers < 2) {
    normalized = cborEncodeBytestring(
      normalized,
      label,
    );

    layers += 1;
  }

  return normalized;
}

async function downloadJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },

    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download ${url}: ` +
      `${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

function getValidator(
  blueprint,
  title,
  sourceUrl,
) {
  const validators = blueprint?.validators;

  if (!Array.isArray(validators)) {
    throw new Error(
      `No validators array found in ${sourceUrl}`,
    );
  }

  const validator = validators.find(
    (candidate) => candidate?.title === title,
  );

  if (validator) {
    return validator;
  }

  const available = validators
    .map((candidate) => candidate?.title)
    .filter(Boolean)
    .join("\n  - ");

  throw new Error(
    `Validator ${JSON.stringify(title)} was not found in ${sourceUrl}.\n` +
    `Available validators:\n  - ${available || "(none)"}`,
  );
}

function getPlutusVersion(blueprint) {
  const version = String(
    blueprint?.preamble?.plutusVersion ?? "",
  )
    .trim()
    .toLowerCase()
    .replace(/^plutus/, "")
    .replace(/^v/, "");

  if (!["1", "2", "3"].includes(version)) {
    throw new Error(
      "Unsupported or missing " +
      "blueprint.preamble.plutusVersion: " +
      JSON.stringify(
        blueprint?.preamble?.plutusVersion,
      ),
    );
  }

  return {
    mesh: `V${version}`,
    gcscript: `plutus_v${version}`,
  };
}

function createCommentBlock(set, hashes) {
  return `/*
 * AUTO-GENERATED FILE — DO NOT EDIT
 *
 * Name: ${set.name}
 * Commit: ${set.commit}
 * Description: ${set.description}
 * Plutus blueprint: ${set.plutusJsonUrl}
 * Cardano Swaps versions: ${set.versionsUrl}
 *
 * Spending validator hash: ${hashes.spendingValidator}
 * Beacon policy hash: ${hashes.beaconPolicy}
 *
 * Generated by scripts/deployer-generator.mjs
 */

`;
}

// -----------------------------------------------------------------------------
// Build
// -----------------------------------------------------------------------------

async function buildValidatorSet(template, set) {
  const blueprint = await downloadJson(
    set.plutusJsonUrl,
  );

  const version = getPlutusVersion(
    blueprint,
  );

  const spendingValidator = getValidator(
    blueprint,
    set.spendingValidator,
    set.plutusJsonUrl,
  );

  const beaconPolicy = getValidator(
    blueprint,
    set.beaconPolicy,
    set.plutusJsonUrl,
  );

  /**
   * Aiken blueprint compiledCode is usually only CBOR-wrapped once.
   * Keep that original form for blueprint/hash logic, but normalize the value
   * passed to GameChanger to exactly two wrappers.
   */
  const rawSpendingScript = assertHex(
    spendingValidator.compiledCode,
    `${set.name} spending validator compiledCode`,
  );

  const spendingScript = normalizeGcScriptHex(
    rawSpendingScript,
    `${set.name} spending validator`,
  );

  const rawBeaconScript = assertHex(
    beaconPolicy.compiledCode,
    `${set.name} beacon policy compiledCode`,
  );

  /**
   * CIP-57/Aiken blueprints publish the canonical unparameterized validator
   * hash. Use it as the expected spending-validator hash.
   */
  const spendingHash = getBlueprintHash(
    spendingValidator,
    `${set.name} spending validator`,
  );

  verifyHash(
    spendingHash,
    set.expectedHashes?.spendingValidator,
    `${set.name} spending validator`,
  );

  /**
   * Cardano Swaps parameterizes the beacon policy with the spending-validator
   * hash as a Plutus bytes value.
   *
   * Mesh currently returns the applied script in the double-CBOR form, but it
   * is normalized anyway so output remains stable if that behavior changes.
   */
  const parameterizedBeaconScript = normalizeGcScriptHex(
    applyParamsToScript(
      rawBeaconScript,
      [spendingHash],
    ),

    `${set.name} parameterized beacon policy`,
  );

  const beaconHash = resolveScriptHash(
    parameterizedBeaconScript,
    version.mesh,
  );

  verifyHash(
    beaconHash,
    set.expectedHashes?.beaconPolicy,
    `${set.name} beacon policy`,
  );

  const gcscript = structuredClone(template);

  gcscript.args ??= {};

  gcscript.args[
    "kernel-spending-validator-script-bytes"
  ] = spendingScript;

  gcscript.args[
    "kernel-spending-validator-script-lang"
  ] = version.gcscript;

  gcscript.args[
    "kernel-beacon-policy-script-bytes"
  ] = parameterizedBeaconScript;

  gcscript.args[
    "kernel-beacon-policy-script-lang"
  ] = version.gcscript;

  gcscript.args[
    "expected-kernel-spending-validator-script-hash"
  ] = spendingHash;

  gcscript.args[
    "expected-kernel-beacon-policy-script-hash"
  ] = beaconHash;

  gcscript.args[
    "kernel-validator-set-name"
  ] = set.name;

  gcscript.args[
    "deploy-beacon-assetName"
  ] = set.name;


  gcscript.args[
    "kernel-validator-set-description"
  ] = set.description;

  gcscript.args[
    "kernel-validator-set-commit"
  ] = set.commit;

  gcscript.args[
    "kernel-validator-set-plutus-json-url"
  ] = set.plutusJsonUrl;

  gcscript.args[
    "kernel-validator-set-versions-url"
  ] = set.versionsUrl;

  return {
    gcscript,

    hashes: {
      spendingValidator: spendingHash,
      beaconPolicy: beaconHash,
    },
  };
}

async function main() {
  /**
   * The template must be valid, comment-free JSON.
   */
  const template = JSON.parse(
    await readFile(
      TEMPLATE_FILE,
      "utf8",
    ),
  );

  await mkdir(
    TARGET_DIRECTORY,
    {
      recursive: true,
    },
  );

  for (const set of VALIDATOR_SETS) {
    const generatedName = normalizeFileName(
      `${set.name}-${set.commit}`,
    );

    const outputPath = join(
      TARGET_DIRECTORY,
      `${generatedName}.gcscript.jsonc`,
    );

    const result = await buildValidatorSet(
      template,
      set,
    );

    const json = JSON.stringify(
      result.gcscript,
      null,
      2,
    );

    const output =
      createCommentBlock(
        set,
        result.hashes,
      ) +
      json +
      "\n";

    await writeFile(
      outputPath,
      output,
      "utf8",
    );

    console.log(
      `Generated ${outputPath}`,
    );

    console.log(
      `  spending: ${result.hashes.spendingValidator}`,
    );

    console.log(
      `  beacon:   ${result.hashes.beaconPolicy}`,
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.stack
      : error,
  );

  process.exitCode = 1;
});