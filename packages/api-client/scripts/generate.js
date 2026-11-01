import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openApiPath = path.resolve(__dirname, '../../../docs/contracts/openapi.yaml');
const outputPath = path.resolve(__dirname, '../src/schema.d.ts');

async function generate() {
  if (!fs.existsSync(openApiPath)) {
    throw new Error(`OpenAPI spec not found at: ${openApiPath}`);
  }

  const ast = await openapiTS(new URL(`file://${openApiPath}`));
  const types = astToString(ast);

  const header = `/* DO NOT EDIT - AUTOMATICALLY GENERATED FROM docs/contracts/openapi.yaml */\n\n`;
  const content = header + types;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`Generated types successfully written to ${outputPath}`);
}

generate().catch((err) => {
  console.error('Failed to generate types:', err);
  process.exit(1);
});

