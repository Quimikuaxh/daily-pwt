import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { createServer } from 'vite'
import { ROOT } from './lib/paths.mjs'

const { values } = parseArgs({ options: {
  seeds: { type: 'string', default: '1000' }, margins: { type: 'string', default: '10,15,20,25' },
  scenarios: { type: 'string', default: 'A,B,C' }, prefix: { type: 'string', default: 'calibracion-draft:v1' },
  absolute: { type: 'string' }, relative: { type: 'string' },
  out: { type: 'string' }, help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log('node scripts/simulate-nuzlocke-draft.mjs [--seeds 1000] [--margins 10,15,20,25] [--absolute 30,40] [--relative 6,8] [--scenarios A,B,C] [--prefix texto] [--out resultado.json] (usar --margins "" para solo absoluta)')
} else {
  // Vite transforma los módulos TS del núcleo sin compilar la app ni abrir un puerto.
  const server = await createServer({ root: ROOT, configFile: false, appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false, ws: false }, logLevel: 'error' })
  try {
    const { simulateDraft, loadSimulationInputs } = await server.ssrLoadModule('/scripts/simulate-nuzlocke-draft.ts')
    const { definition, calendar, ...source } = loadSimulationInputs(ROOT)
    const absolute = values.absolute?.split(',').map(Number)
    if (absolute && absolute.length !== 2) throw new Error('--absolute requiere dos valores: 30,40')
    const relative = values.relative?.split(',').map(Number)
    if (relative && relative.length !== 2) throw new Error('--relative requiere dos porcentajes: 6,8')
    const result = simulateDraft(definition, calendar, { seeds: Number(values.seeds), margins: values.margins === '' ? [] : values.margins.split(',').map(Number),
      ...(absolute ? { absoluteWindows: [{ below: absolute[0], above: absolute[1] }] } : {}),
      ...(relative ? { relativeWindows: [{ below: relative[0], above: relative[1] }] } : {}), scenarios: values.scenarios.split(','), prefix: values.prefix })
    const json = `${JSON.stringify({ ...source, ...result }, null, 2)}\n`
    if (values.out) await writeFile(values.out, json)
    else process.stdout.write(json)
  } finally {
    await server.close()
  }
}
