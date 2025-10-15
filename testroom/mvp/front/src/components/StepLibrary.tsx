import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'

type StepRecord = {
  id: number
  name?: string
  content: string
  createdAt: string
  updatedAt: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export default function StepLibrary({ serviceId }: { serviceId: string }) {
  const monaco = useMonaco()
  const typeLibrariesLoadedRef = useRef(false)
  const base = useMemo(() => `/api/services/${serviceId}/steps`, [serviceId])
  const [items, setItems] = useState<StepRecord[]>([])
  const [active, setActive] = useState<StepRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}${base}`)
        if (!res.ok) throw new Error(`Failed to load steps (${res.status})`)
        const data = (await res.json()) as StepRecord[]
        setItems(data)
        if (!active && data.length) setActive(data[0])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load steps')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [base])

  // Load QA type definitions into Monaco so that '@cucumber/cucumber' resolves
  useEffect(() => {
    if (!monaco || typeLibrariesLoadedRef.current) return

    let disposed = false
    const disposables: { dispose: () => void }[] = []

    const loadTypeDefinitions = async () => {
      const typescriptApi = monaco.languages?.typescript
      if (!typescriptApi) return
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}qa-type-definitions.json`, { cache: 'force-cache' })
        if (!res.ok) throw new Error(`types ${res.status}`)
        const bundle = (await res.json()) as { files: Record<string, string> }
        if (disposed) return

        const files = bundle?.files ?? {}
        typeLibrariesLoadedRef.current = true

        const defaults = typescriptApi.typescriptDefaults
        const currentOptions = defaults.getCompilerOptions()

        const modulePaths: Record<string, string[]> = {}
        const ensure = (name: string, rel: string) => {
          const uri = `file:///node_modules/${rel.replace(/\\/g, '/')}`
          if (!files[uri]) return
          modulePaths[name] = modulePaths[name] ?? []
          if (!modulePaths[name].includes(uri)) modulePaths[name].push(uri)
        }
        ensure('@cucumber/cucumber', '@cucumber/cucumber/lib/index.d.ts')
        ensure('@playwright/test', '@playwright/test/index.d.ts')
        ensure('playwright-core', 'playwright-core/index.d.ts')
        ensure('playwright', 'playwright/index.d.ts')
        ensure('playwright/test', 'playwright/types/test.d.ts')

        const next = {
          ...currentOptions,
          allowJs: true,
          allowSyntheticDefaultImports: true,
          module: typescriptApi.ModuleKind.CommonJS,
          moduleResolution: typescriptApi.ModuleResolutionKind.NodeJs,
          noEmit: true,
          target: typescriptApi.ScriptTarget.ES2020,
          typeRoots: [],
          types: [],
          paths: Object.keys(modulePaths).length > 0 ? { ...(currentOptions.paths ?? {}), ...modulePaths } : currentOptions.paths,
        }
        defaults.setCompilerOptions(next)
        defaults.setEagerModelSync(true)

        const importMetaLib = `interface ImportMetaEnv { readonly VITE_API_BASE_URL?: string; readonly [key: string]: string | undefined }\ninterface ImportMeta { readonly env: ImportMetaEnv }\n`
        disposables.push(defaults.addExtraLib(importMetaLib, 'file:///scenario/import-meta.d.ts'))
        Object.entries(files).forEach(([uri, content]) => {
          disposables.push(defaults.addExtraLib(content, uri))
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('StepLibrary: failed to load QA type definitions', e)
      }
    }
    loadTypeDefinitions()
    return () => {
      disposed = true
      disposables.forEach((d) => d.dispose())
      typeLibrariesLoadedRef.current = false
    }
  }, [monaco])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE_URL}${base}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'new.steps.ts', content: defaultContent }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created = (await res.json()) as StepRecord
      setItems((prev) => [created, ...prev])
      setActive(created)
      setFeedback('Created')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create step')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!active) return
    setIsSaving(true)
    setError(null)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE_URL}${base}/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: active.name, content: active.content }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = (await res.json()) as StepRecord
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      setActive(updated)
      setFeedback('Saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save step')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!active) return
    if (!confirm('Delete this step?')) return
    setIsSaving(true)
    setError(null)
    setFeedback(null)
    try {
      const res = await fetch(`${API_BASE_URL}${base}/${active.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      setItems((prev) => prev.filter((x) => x.id !== active.id))
      setActive(null)
      setFeedback('Deleted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete step')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] gap-4">
      <aside className="w-64 shrink-0 rounded border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Step Library</h2>
          <button
            className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
            onClick={handleCreate}
            disabled={isSaving}
          >
            New
          </button>
        </div>
        {isLoading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-500">No steps yet.</p>
        ) : (
          <ul className="space-y-1">
            {items.map((it) => {
              const isActive = active && active.id === it.id
              return (
                <li key={it.id}>
                  <button
                    type="button"
                    className={`w-full truncate rounded px-2 py-1 text-left text-xs ${
                      isActive ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-100'
                    }`}
                    onClick={() => setActive(it)}
                  >
                    {it.name || `steps-${it.id}.ts`}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <input
              className="w-full rounded border border-slate-300 px-3 py-1 text-sm"
              placeholder="Filename (optional)"
              value={active?.name || ''}
              onChange={(e) => active && setActive({ ...active, name: e.target.value })}
              disabled={!active}
            />
            <button
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
              onClick={handleSave}
              disabled={!active || isSaving}
            >
              Save
            </button>
            <button
              className="rounded border border-red-400 px-3 py-1 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              onClick={handleDelete}
              disabled={!active || isSaving}
            >
              Delete
            </button>
          </div>
          <div className="h-[60vh] overflow-hidden rounded border border-slate-200">
            <Editor
              height="100%"
              path={`file:///service/${serviceId}/${active?.name || 'steps.ts'}`}
              language="typescript"
              value={active?.content || ''}
              onChange={(v) => active && setActive({ ...active, content: v || '' })}
              options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 14 }}
            />
          </div>
        </div>

        {(feedback || error) && (
          <div>
            {feedback && <p className="text-sm text-emerald-700">{feedback}</p>}
            {error && <p className="text-sm text-rose-700">{error}</p>}
          </div>
        )}
      </main>
    </div>
  )
}

const defaultContent = `import { Given, When, Then } from '@cucumber/cucumber';

Given('공통 예시 스텝', async function () {
  // TODO
});
`
