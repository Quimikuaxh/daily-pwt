import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'

/** E2E-21: revisar el grafo emitido, porque los imports de tipos del protocolo no deben arrastrar el motor al cliente. */
describe('frontera de carga del cliente de combate', () => {
  it('mantiene motor, adaptador y datos de Gen 3 fuera de los imports en ejecución del hilo principal', () => {
    const seen = new Set<string>()
    const external = new Set<string>()
    function visit(path: string) {
      if (seen.has(path)) return
      seen.add(path)
      const source = readFileSync(path, 'utf8')
      if (path.endsWith('.json')) return
      const emitted = ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true,
      } }).outputText
      const ast = ts.createSourceFile(path, emitted, ts.ScriptTarget.ESNext, true)
      function dependency(specifier: string) {
        if (!specifier.startsWith('.')) { external.add(specifier); return }
        const target = resolve(dirname(path), specifier)
        visit(/\.(ts|tsx|json)$/.test(target) ? target : `${target}.ts`)
      }
      function scan(node: ts.Node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          dependency(node.moduleSpecifier.text)
        }
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
          dependency(node.arguments[0].text)
        }
        ts.forEachChild(node, scan)
      }
      scan(ast)
    }
    visit(resolve(import.meta.dirname, 'client.ts'))
    expect(seen.size).toBeGreaterThan(1)
    expect([...seen].some(path => path.endsWith('/i18n/es.ts'))).toBe(true)
    expect([...external].filter(name => /^@(?:pkmn|smogon)\//.test(name))).toEqual([])
    expect([...seen].filter(path => /\/(?:engine|messages)\.ts$|\/core\/nuzlocke\/|hoenn-emerald.*\.json$/.test(path))).toEqual([])
  })
})
