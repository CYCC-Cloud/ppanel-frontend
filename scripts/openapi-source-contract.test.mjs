import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

// This fork generates its API types from its own backend contract, so codegen
// must read the Swagger checked into this repository. Fetching upstream's
// assets instead would regenerate `packages/ui/src/services` without the
// fork's fields and silently delete them, because the generator clears each
// service directory before writing.
test("openapi2ts reads this repository's Swagger assets", async () => {
  const config = await readFile(
    new URL("../packages/ui/openapi2ts.config.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(
    config,
    /raw\.githubusercontent\.com/,
    "openapi2ts must not fetch Swagger from a remote repository"
  );
  assert.doesNotMatch(
    config,
    /gateway/,
    "the retired gateway client must not be generated"
  );
  assert.match(
    config,
    /resolve\(\s*__dirname,\s*"\.\.\/\.\.\/docs\/public\/swagger"/,
    "openapi2ts must resolve Swagger relative to its own config file"
  );

  for (const spec of ["common", "user", "admin"]) {
    assert.match(
      config,
      new RegExp(`swaggerPath\\("${spec}"\\)`),
      `openapi2ts must read ${spec}.json from this repository`
    );
    await access(
      new URL(`../docs/public/swagger/${spec}.json`, import.meta.url)
    );
  }

  console.log("OpenAPI source contract OK");
});
