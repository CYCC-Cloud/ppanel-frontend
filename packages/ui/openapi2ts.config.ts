import { resolve } from "node:path";
import type { OpenAPIObject, SchemaObject } from "openapi3-ts";

const responseRequiredOverrides: Record<string, string[]> = {
  DownloadLink: [],
  NodeDNS: ["proto", "address", "domains"],
  NodeOutbound: ["name", "protocol", "address", "port", "password", "rules"],
};

function requireResponseProperties(openAPIData: OpenAPIObject) {
  const schemas = openAPIData.components?.schemas ?? {};

  for (const [name, schema] of Object.entries(schemas)) {
    if (name.endsWith("Request") || "$ref" in schema) {
      continue;
    }

    const responseSchema = schema as SchemaObject;
    if (responseSchema.properties) {
      if (name.endsWith("ResponseSuccessBean")) {
        Reflect.deleteProperty(responseSchema.properties, "data");
      }
      const typeName = name.split(".").at(-1) ?? name;
      responseSchema.required =
        responseRequiredOverrides[typeName] ??
        Object.keys(responseSchema.properties);
    }
  }

  return openAPIData;
}

// openapi2ts only strips the prefix shared by every path. Common also serves
// /healthz and /readyz, so strip /v1 explicitly to keep names like
// getCommonSiteConfig instead of getV1CommonSiteConfig.
function commonFunctionName({
  method,
  path,
}: {
  method: string;
  path: string;
}) {
  const name = path
    .replace(/^\/v1(?=\/)/, "")
    .split("/")
    .map((segment) => {
      const word = segment
        .replace(/[-_](\w)/g, (_, letter: string) => letter.toUpperCase())
        .replace(/\W/g, "");
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");

  return `${method}${name}`;
}

// This fork's backend contract lives in its own `docs/public/swagger`, so the
// generator must read from disk. `@umijs/openapi` only fetches a `schemaPath`
// that starts with `http` and otherwise hands the string to CommonJS
// `require`, which resolves a relative path against the generator's own module
// rather than this file. It also does not understand a `file://` URL, so an
// absolute path is the only correct form. cosmiconfig loads this config as
// CommonJS, which is why the base is `__dirname` and not `import.meta.url`.
const swaggerPath = (name: string) =>
  resolve(__dirname, "../../docs/public/swagger", `${name}.json`);

const baseConfig = {
  requestLibPath: "import request from '@workspace/ui/lib/request';",
  serversPath: "./src/services",
  templatesFolder: "./openapi-templates",
  apiPrefix: "import.meta.env.VITE_API_PREFIX || ''",
  hook: {
    afterOpenApiDataInited: requireResponseProperties,
  },
};

const config = [
  {
    ...baseConfig,
    schemaPath: swaggerPath("common"),
    projectName: "common",
    hook: {
      ...baseConfig.hook,
      customFunctionName: commonFunctionName,
    },
  },
  {
    ...baseConfig,
    schemaPath: swaggerPath("user"),
    projectName: "user",
  },
  {
    ...baseConfig,
    schemaPath: swaggerPath("admin"),
    projectName: "admin",
  },
];

export default config;
