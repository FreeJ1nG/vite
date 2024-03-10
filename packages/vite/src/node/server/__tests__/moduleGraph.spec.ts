import { describe, expect, it } from 'vitest'
import { EnvironmentModuleGraph, ModuleGraph } from '../moduleGraph'
import type { ModuleNode } from '../moduleGraph'

describe('moduleGraph', () => {
  describe('invalidateModule', () => {
    it('removes an ssr error', async () => {
      const moduleGraph = new EnvironmentModuleGraph(
        'browser',
        async (url) => ({
          id: url,
        }),
      )
      const entryUrl = '/x.js'

      const entryModule = await moduleGraph.ensureEntryFromUrl(entryUrl, false)
      entryModule.error = new Error(`unable to execute module`)

      expect(entryModule.error).to.be.a('error')
      moduleGraph.invalidateModule(entryModule)
      expect(entryModule.error).toBe(null)
    })

    it('ensureEntryFromUrl should based on resolvedId', async () => {
      const moduleGraph = new EnvironmentModuleGraph('browser', async (url) => {
        if (url === '/xx.js') {
          return { id: '/x.js' }
        } else {
          return { id: url }
        }
      })
      const meta = { vite: 'test' }

      const mod1 = await moduleGraph.ensureEntryFromUrl('/x.js', false)
      mod1.meta = meta
      const mod2 = await moduleGraph.ensureEntryFromUrl('/xx.js', false)
      expect(mod2.meta).to.equal(meta)
    })

    it('ensure backward compatibility', async () => {
      const browserModuleGraph = new EnvironmentModuleGraph(
        'browser',
        async (url) => ({ id: url }),
      )
      const serverModuleGraph = new EnvironmentModuleGraph(
        'server',
        async (url) => ({ id: url }),
      )
      const moduleGraph = new ModuleGraph({
        browser: browserModuleGraph,
        server: serverModuleGraph,
      })

      const addBrowserModule = (url: string) =>
        browserModuleGraph.ensureEntryFromUrl(url)
      const getBrowserModule = (url: string) =>
        browserModuleGraph.getModuleById(url)

      const addServerModule = (url: string) =>
        serverModuleGraph.ensureEntryFromUrl(url)
      const getServerModule = (url: string) =>
        serverModuleGraph.getModuleById(url)

      const browserModule1 = await addBrowserModule('/1.js')
      const serverModule1 = await addServerModule('/1.js')
      const module1 = moduleGraph.getModuleById('/1.js')!
      expect(module1._browserModule).toBe(browserModule1)
      expect(module1._serverModule).toBe(serverModule1)

      const module2b = await moduleGraph.ensureEntryFromUrl('/b/2.js')
      const module2s = await moduleGraph.ensureEntryFromUrl('/s/2.js')
      expect(module2b._browserModule).toBe(getBrowserModule('/b/2.js'))
      expect(module2s._serverModule).toBe(getServerModule('/s/2.js'))

      const importersUrls = ['/1/a.js', '/1/b.js', '/1/c.js']
      ;(await Promise.all(importersUrls.map(addBrowserModule))).forEach((mod) =>
        browserModule1.importers.add(mod),
      )
      ;(await Promise.all(importersUrls.map(addServerModule))).forEach((mod) =>
        serverModule1.importers.add(mod),
      )

      expect(module1.importers.size).toBe(importersUrls.length)

      const browserModule1importersValues = [...browserModule1.importers]
      const serverModule1importersValues = [...serverModule1.importers]

      const module1importers = module1.importers
      const module1importersValues = [...module1importers.values()]
      expect(module1importersValues.length).toBe(importersUrls.length)
      expect(module1importersValues[1]._browserModule).toBe(
        browserModule1importersValues[1],
      )
      expect(module1importersValues[1]._serverModule).toBe(
        serverModule1importersValues[1],
      )

      const module1importersFromForEach: ModuleNode[] = []
      module1.importers.forEach((imp) => {
        moduleGraph.invalidateModule(imp)
        module1importersFromForEach.push(imp)
      })
      expect(module1importersFromForEach.length).toBe(importersUrls.length)
      expect(module1importersFromForEach[1]._browserModule).toBe(
        browserModule1importersValues[1],
      )
      expect(module1importersFromForEach[1]._serverModule).toBe(
        serverModule1importersValues[1],
      )
    })
  })
})
