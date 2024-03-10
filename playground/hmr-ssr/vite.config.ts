import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

export default defineConfig({
  experimental: {
    hmrPartialAccept: true,
  },
  plugins: [
    {
      name: 'mock-custom',
      async handleHotUpdate({ file, read, server }) {
        if (file.endsWith('customFile.js')) {
          const content = await read()
          const msg = content.match(/export const msg = '(\w+)'/)[1]
          server.hot.send('custom:foo', { msg })
          server.hot.send('custom:remove', { msg })
        }
      },
      configureServer(server) {
        server.hot.on('custom:remote-add', ({ a, b }, client) => {
          client.send('custom:remote-add-result', { result: a + b })
        })
      },
    },
    virtualPlugin(),
    transformCountPlugin(),
    queryPlugin(),
  ],
})

function virtualPlugin(): Plugin {
  let num = 0
  return {
    name: 'virtual-file',
    resolveId(id, importer) {
      if (id === 'virtual:file' || id === '\0virtual:file') {
        return '\0virtual:file'
      }
    },
    load(id) {
      if (id === '\0virtual:file') {
        return `\
import { virtual as _virtual } from "/importedVirtual.js";
export const virtual = _virtual + '${num}';`
      }
    },
    configureServer(server) {
      server.hot.on('virtual:increment', async () => {
        const mod = await server
          .getModuleGraph('server')
          .getModuleByUrl('\0virtual:file')
        if (mod) {
          num++
          server.reloadEnvironmentModule(mod)
        }
      })
    },
  }
}

function queryPlugin(): Plugin {
  return {
    name: 'query-resolver',
    transform(code, id) {
      if (id.includes('?query1')) {
        return `export default ${JSON.stringify(code + 'query1')}`
      }

      if (id.includes('?query2')) {
        return `export default ${JSON.stringify(code + 'query2')}`
      }
    },
  }
}

function transformCountPlugin(): Plugin {
  let num = 0
  return {
    name: 'transform-count',
    transform(code) {
      if (code.includes('__TRANSFORM_COUNT__')) {
        return code.replace('__TRANSFORM_COUNT__', String(++num))
      }
    },
  }
}
