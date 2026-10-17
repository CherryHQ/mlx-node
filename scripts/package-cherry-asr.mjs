import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
execFileSync(process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '-b', 'packages/asr'], {
  cwd: root,
  stdio: 'inherit'
})
const output = resolve(root, 'distribution/asr')
await mkdir(output, { recursive: true })
await cp(resolve(root, 'packages/asr/dist'), resolve(output, 'dist'), { recursive: true })
await cp(resolve(root, 'packages/asr/src'), resolve(output, 'src'), { recursive: true })
await cp(resolve(root, 'packages/core/index.cjs'), resolve(output, 'core.cjs'))
await cp(resolve(root, 'packages/core/index.d.cts'), resolve(output, 'core.d.cts'))
await cp(resolve(root, 'LICENSE'), resolve(output, 'LICENSE'))
for (const file of await readdir(resolve(output, 'dist'))) {
  if (!file.endsWith('.js') && !file.endsWith('.d.ts')) continue
  const path = resolve(output, 'dist', file)
  const content = await readFile(path, 'utf8')
  await writeFile(path, content.replaceAll("'@mlx-node/core'", "'../core.cjs'"))
}
await writeFile(
  resolve(output, 'package.json'),
  JSON.stringify(
    {
      name: '@cherrystudio/mlx-asr',
      version: '0.0.16-cherry.1',
      description: 'MLX Node ASR JavaScript API with externally provisioned native bindings',
      license: 'MIT',
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
      files: ['dist', 'src', 'core.cjs', 'core.d.cts', 'LICENSE'],
      repository: { type: 'git', url: 'https://github.com/CherryHQ/mlx-node.git', directory: 'distribution/asr' },
      upstreamRevision: '5db3d24bc87a9eb6fdb48c7ab3c9d8f126bf8d7d'
    },
    null,
    2
  ) + '\n'
)
