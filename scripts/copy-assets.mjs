import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const source = resolve(root, 'src/assets');
const target = resolve(root, 'dist/assets');
const licenseSource = resolve(root, 'licenses');
const licenseTarget = resolve(root, 'dist/licenses');

await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

await rm(licenseTarget, { recursive: true, force: true });
await mkdir(licenseTarget, { recursive: true });
await cp(resolve(root, 'THIRD_PARTY_NOTICES.md'), resolve(licenseTarget, 'THIRD_PARTY_NOTICES.md'));
await cp(licenseSource, licenseTarget, { recursive: true });
