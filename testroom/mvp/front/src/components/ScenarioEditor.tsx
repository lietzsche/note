import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'

type ScenarioAsset = {
  name?: string
  content: string
}

type ScenarioRecord = {
  id: number
  title: string
  features: ScenarioAsset[]
  steps: ScenarioAsset[]
  createdAt: string
  updatedAt: string
}

type ScenarioPayload = {
  title: string
  features: ScenarioAsset[]
  steps: ScenarioAsset[]
}

type RunResponse = {
  stdout?: string
  stderr?: string
  report?: CucumberReport
  error?: string
}

type RunScope = 'SCENARIO' | 'SERVICE'

type RunMetadata = {
  scope: RunScope
  serviceId?: number
  scenarioId?: number
  scenarioTitle?: string
  serviceFullRun?: boolean
}

type RunHistoryEntry = {
  id?: number
  scope: RunScope
  serviceId?: number | null
  serviceName?: string | null
  scenarioId?: number | null
  scenarioTitle?: string | null
  serviceFullRun?: boolean | null
  status?: string | null
  durationMs?: number | null
  reportUrl?: string | null
  runId: string
  error?: string | null
  httpStatus?: number | null
  stdout?: string | null
  stderr?: string | null
  report?: string | null
  createdAt: string
}

const STATUS_CLASS_MAP: Record<string, string> = {
  PASSED: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  COMPLETED: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  FAILED: 'bg-rose-100 text-rose-700 border border-rose-300',
  ERROR: 'bg-rose-100 text-rose-700 border border-rose-300',
  UNDEFINED: 'bg-amber-100 text-amber-700 border border-amber-300',
}

function formatDateTime(value: string | undefined | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatDuration(durationMs: number | undefined | null) {
  if (durationMs === undefined || durationMs === null) return '-'
  if (durationMs < 1000) return `${durationMs} ms`
  const seconds = durationMs / 1000
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  const minutes = seconds / 60
  return `${minutes.toFixed(1)} min`
}

function resolveStatusClasses(status: string | undefined | null) {
  if (!status) return 'bg-slate-100 text-slate-600 border border-slate-300'
  const key = status.toUpperCase()
  return STATUS_CLASS_MAP[key] ?? 'bg-slate-100 text-slate-600 border border-slate-300'
}

function normalizeStatusLabel(status: string | undefined | null) {
  if (!status) return 'UNKNOWN'
  return status.toUpperCase()
}

function parseHistoryReport(report: string | null | undefined): CucumberReport | null {
  if (!report) return null
  try {
    const parsed = JSON.parse(report)
    return Array.isArray(parsed) ? (parsed as CucumberReport) : null
  } catch {
    return null
  }
}

function extractHistoryDetails(report: string | null | undefined): FailureDetails {
  const parsed = parseHistoryReport(report)
  return extractFailureDetails(parsed)
}

type TypeDefinitionResponse = {
  files: Record<string, string>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

type ScenarioEditorProps = {
  basePath?: string
}

const DEFAULT_TITLE = 'New Scenario'
const DEFAULT_FEATURE_NAME = 'example.feature'
const DEFAULT_FEATURE_CONTENT = `Feature: Example
  Scenario: Visit Playwright
    Given I open playwright homepage
    When I interact with the page
    Then I should see the expected result`

function extractFailureDetails(report: CucumberReport | undefined | null): FailureDetails {
  const details: FailureDetails = { attachments: [], messages: [] }
  if (!Array.isArray(report)) {
    return details
  }

  const pushEmbeddings = (
    embeddings: CucumberEmbedding[] | undefined,
    baseId: string,
    scenarioName: string | undefined,
    stepName: string | undefined
  ) => {
    embeddings?.forEach((embedding, embeddingIndex) => {
      const data = embedding.data ?? embedding.media?.data
      const encoding = embedding.media?.encoding
      const mimeType = embedding.mime_type ?? embedding.mediaType ?? embedding.media?.type
      if (!data || !mimeType) {
        return
      }
      if (encoding && encoding !== 'base64') {
        return
      }
      details.attachments.push({
        id: `${baseId}-embedding-${embeddingIndex}`,
        mimeType,
        data,
        scenarioName,
        stepName,
      })
    })
  }

  const pushAttachments = (
    attachments: CucumberAttachment[] | undefined,
    baseId: string,
    scenarioName: string | undefined,
    stepName: string | undefined
  ) => {
    attachments?.forEach((attachment, attachmentIndex) => {
      const data = attachment.data ?? attachment.body
      const mimeType = attachment.mediaType
      const encoding = attachment.contentEncoding
      if (!data || !mimeType) {
        return
      }
      if (encoding && encoding !== 'base64') {
        return
      }
      details.attachments.push({
        id: `${baseId}-attachment-${attachmentIndex}`,
        mimeType,
        data,
        scenarioName,
        stepName,
      })
    })
  }

  report.forEach((feature, featureIndex) => {
    feature.elements?.forEach((scenario, scenarioIndex) => {
      const steps = scenario.steps ?? []
      const hooks = [...(scenario.before ?? []), ...(scenario.after ?? [])]

      const scenarioFailed =
        steps.some((step) => step.result?.status?.toLowerCase() === 'failed') ||
        hooks.some((hook) => hook.result?.status?.toLowerCase() === 'failed') ||
        (scenario.after ?? []).some(
          (hook) =>
            (hook.attachments && hook.attachments.length > 0) ||
            (hook.embeddings && hook.embeddings.length > 0) ||
            hook.text
        )

      if (!scenarioFailed) {
        return
      }

      steps.forEach((step, stepIndex) => {
        const status = step.result?.status?.toLowerCase()
        if (status === 'failed' && step.result?.error_message) {
          details.messages.push(step.result.error_message)
        }

        const baseId = `${featureIndex}-${scenarioIndex}-${stepIndex}`
        const scenarioName = scenario.name
        const stepName = step.name

        pushEmbeddings(step.embeddings, baseId, scenarioName, stepName)
        pushAttachments(step.attachments, baseId, scenarioName, stepName)
      })

      ;(scenario.after ?? []).forEach((hook, hookIndex) => {
        const hookStatus = hook.result?.status?.toLowerCase()
        if (hookStatus === 'failed' && hook.result?.error_message) {
          details.messages.push(hook.result.error_message)
        }
        if (hook.text) {
          details.messages.push(hook.text)
        }

        const baseId = `${featureIndex}-${scenarioIndex}-after-${hookIndex}`
        const scenarioName = scenario.name
        const stepName = 'After hook'

        pushEmbeddings(hook.embeddings, baseId, scenarioName, stepName)
        pushAttachments(hook.attachments, baseId, scenarioName, stepName)
      })
    })
  })

  return details
}

type CucumberEmbedding = {
  data?: string
  mime_type?: string
  mediaType?: string
  media?: {
    type?: string
    encoding?: string
    data?: string
  }
}

type CucumberAttachment = {
  data?: string
  mediaType?: string
  contentEncoding?: string
  body?: string
}

type CucumberHook = {
  result?: {
    status?: string
    error_message?: string
  }
  embeddings?: CucumberEmbedding[]
  attachments?: CucumberAttachment[]
  text?: string
}

type CucumberStep = {
  name?: string
  result?: {
    status?: string
    error_message?: string
  }
  embeddings?: CucumberEmbedding[]
  attachments?: CucumberAttachment[]
}

type CucumberElement = {
  name?: string
  steps?: CucumberStep[]
  before?: CucumberHook[]
  after?: CucumberHook[]
}

type CucumberFeature = {
  name?: string
  elements?: CucumberElement[]
}

type CucumberReport = CucumberFeature[]

type FailureAttachment = {
  id: string
  mimeType: string
  data: string
  scenarioName?: string
  stepName?: string
}

type FailureDetails = {
  attachments: FailureAttachment[]
  messages: string[]
}

function ScenarioEditor({ basePath = '/api/scenarios' }: ScenarioEditorProps) {
  const monaco = useMonaco()
  const typeLibrariesLoadedRef = useRef(false)

  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [featureName, setFeatureName] = useState(DEFAULT_FEATURE_NAME)
  const [featureContent, setFeatureContent] = useState(DEFAULT_FEATURE_CONTENT)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isRunningService, setIsRunningService] = useState(false)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState<FailureAttachment | null>(null)

  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([])
  const [isRunHistoryLoading, setIsRunHistoryLoading] = useState(false)
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'editor' | 'history'>('editor')

  useEffect(() => {
    if (!monaco) {
      return
    }

    if (!monaco.languages.getLanguages().some((lang) => lang.id === 'gherkin')) {
      monaco.languages.register({
        id: 'gherkin',
        extensions: ['.feature'],
        aliases: ['Gherkin', 'feature'],
      })
    }

    const completionProvider = monaco.languages.registerCompletionItemProvider('typescript', {
      triggerCharacters: ['G', 'W', 'T'],
      provideCompletionItems(model, position) {
        const { languages, Range } = monaco
        const importLine = "import { Given, When, Then } from '@cucumber/cucumber';"

        const alreadyImported = model
          .getLinesContent()
          .slice(0, 20)
          .some((line) => line.includes("@cucumber/cucumber"))

        const range = new Range(
          position.lineNumber,
          position.column - model.getWordUntilPosition(position).word.length,
          position.lineNumber,
          position.column
        )

        const importEdit = alreadyImported
          ? []
          : [
              {
                range: new Range(1, 1, 1, 1),
                text: `${importLine}\n`,
              },
            ]

        const suggestions = ['Given', 'When', 'Then'].map((keyword) => ({
          label: keyword,
          kind: languages.CompletionItemKind.Snippet,
          insertText: `${keyword}('$1', async function () {\n  $0\n});`,
          insertTextRules: languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          additionalTextEdits: importEdit,
          documentation: `${keyword} step definition`,
        }))

        return { suggestions }
      },
    })

    return () => {
      completionProvider.dispose()
    }
  }, [monaco])

  const normalizedFeatureName = useMemo(
    () => featureName.trim() || DEFAULT_FEATURE_NAME,
    [featureName]
  )

  const featureEditorPath = useMemo(
    () => `file:///scenario/${normalizedFeatureName}`,
    [normalizedFeatureName]
  )

  const serviceRunPath = useMemo(() => {
    // If this editor is scoped to a service (e.g., /api/services/{id}/scenarios),
    // derive the corresponding run endpoint: /api/services/{id}/run
    if (!basePath) return null
    const match = basePath.match(/^\/api\/services\/(\d+)\/scenarios$/)
    if (!match) return null
    const serviceId = match[1]
    return `/api/services/${serviceId}/run`
  }, [basePath])

  const serviceId = useMemo(() => {
    if (!serviceRunPath) return undefined
    const match = serviceRunPath.match(/\/api\/services\/(\d+)\/run$/)
    if (!match) return undefined
    return Number.parseInt(match[1], 10)
  }, [serviceRunPath])

  const resolvedTitle = useMemo(() => (title.trim() ? title.trim() : DEFAULT_TITLE), [title])

  const scenarioPayload = useMemo<ScenarioPayload>(
    () => ({
      title: resolvedTitle,
      features: [
        {
          name: normalizedFeatureName,
          content: featureContent,
        },
      ],
      // Steps are managed in the service Step Library; scenarios don't carry steps.
      steps: [],
    }),
    [resolvedTitle, normalizedFeatureName, featureContent]
  )

  const scenarioRunMetadata = useMemo<RunMetadata>(
    () => ({
      scope: 'SCENARIO',
      serviceId,
      scenarioId: selectedScenarioId ?? undefined,
      scenarioTitle: resolvedTitle,
      serviceFullRun: false,
    }),
    [serviceId, selectedScenarioId, resolvedTitle]
  )

  const runPayload = useMemo(
    () => ({
      features: scenarioPayload.features,
      steps: scenarioPayload.steps,
      metadata: scenarioRunMetadata,
    }),
    [scenarioPayload, scenarioRunMetadata]
  )

  const scenarioHistory = useMemo(() => {
    const filtered = runHistory.filter((entry) => {
      if (entry.scope !== 'SCENARIO') return false
      const entryServiceId = entry.serviceId ?? undefined
      if (serviceId !== undefined) {
        if (entryServiceId !== undefined && entryServiceId !== null && entryServiceId !== serviceId) {
          return false
        }
        if (selectedScenarioId !== null && entry.scenarioId !== undefined && entry.scenarioId !== null) {
          return entry.scenarioId === selectedScenarioId
        }
        if (entry.scenarioTitle && entry.scenarioTitle === resolvedTitle) {
          return true
        }
        return entryServiceId === serviceId || entryServiceId === undefined || entryServiceId === null
      }

      if (selectedScenarioId !== null && entry.scenarioId !== undefined && entry.scenarioId !== null) {
        return entry.scenarioId === selectedScenarioId
      }

      if (entry.scenarioTitle && entry.scenarioTitle === resolvedTitle) {
        return true
      }

      return true
    })
    return filtered.slice(0, 20)
  }, [runHistory, serviceId, selectedScenarioId, resolvedTitle])

  const serviceHistory = useMemo(() => {
    if (serviceId === undefined) return []
    const filtered = runHistory.filter(
      (entry) =>
        entry.scope === 'SERVICE' &&
        entry.serviceId !== undefined &&
        entry.serviceId !== null &&
        entry.serviceId === serviceId
    )
    return filtered.slice(0, 20)
  }, [runHistory, serviceId])

  const panelButtonClass = (panel: 'editor' | 'history') =>
    `rounded px-3 py-2 text-sm font-semibold ${
      activePanel === panel
        ? 'bg-slate-900 text-white'
        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
    }`

  const HistoryList = ({
    title,
    items,
    onSelectAttachment,
  }: {
    title: string
    items: RunHistoryEntry[]
    onSelectAttachment: (attachment: FailureAttachment) => void
  }) => (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-500">{items.length} run{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No runs recorded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((entry) => {
            const failureDetails = extractHistoryDetails(entry.report)
            const imageAttachments = failureDetails.attachments.filter((attachment) =>
              attachment.mimeType.toLowerCase().startsWith('image/')
            )
            const textAttachments = failureDetails.attachments.filter((attachment) =>
              attachment.mimeType.toLowerCase().startsWith('text/')
            )
            const decodeAttachment = (value: string) => {
              try {
                return atob(value)
              } catch {
                return value
              }
            }
            return (
              <li
                key={entry.id ?? entry.runId}
                className="rounded border border-slate-200 bg-white p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {entry.scenarioTitle || entry.serviceName || entry.scope}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${resolveStatusClasses(entry.status)}`}
                  >
                    {normalizeStatusLabel(entry.status)}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                  <span>Duration: {formatDuration(entry.durationMs)}</span>
                  <span>HTTP: {entry.httpStatus ?? '-'}</span>
                  <span className="sm:text-right">
                    Run ID:{' '}
                    <span className="font-mono text-[11px] text-slate-700">{entry.runId}</span>
                  </span>
                </div>
                {entry.error && (
                  <p className="mt-2 text-xs text-rose-600">
                    Error: <span className="font-mono text-[11px]">{entry.error}</span>
                  </p>
                )}
                {entry.stdout && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-slate-600">Show stdout</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800">
                      {entry.stdout}
                    </pre>
                  </details>
                )}
                {entry.stderr && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-slate-600">Show stderr</summary>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-800">
                      {entry.stderr}
                    </pre>
                  </details>
                )}
                {failureDetails.messages.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-slate-600">
                      Failure messages ({failureDetails.messages.length})
                    </summary>
                    <div className="mt-1 space-y-1">
                      {failureDetails.messages.map((message, index) => (
                        <pre
                          key={`history-failure-message-${entry.runId}-${index}`}
                          className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800"
                        >
                          {message}
                        </pre>
                      ))}
                    </div>
                  </details>
                )}
                {imageAttachments.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-600">
                      Screenshots ({imageAttachments.length})
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {imageAttachments.map((attachment) => {
                        const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`
                        return (
                          <button
                            key={attachment.id}
                            type="button"
                            className="group overflow-hidden rounded border border-slate-200 bg-slate-100"
                            onClick={() => onSelectAttachment(attachment)}
                          >
                            <img
                              src={dataUrl}
                              alt={attachment.stepName ?? 'Screenshot'}
                              className="h-20 w-28 object-cover transition group-hover:opacity-80"
                            />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {textAttachments.length > 0 && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-slate-600">
                      Failure logs ({textAttachments.length})
                    </summary>
                    <div className="mt-1 space-y-2">
                      {textAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="rounded border border-slate-200 bg-slate-50 p-2"
                        >
                          <p className="text-[11px] font-medium text-slate-600">
                            {attachment.scenarioName && `${attachment.scenarioName}: `}
                            {attachment.stepName ?? 'Log'}
                          </p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-slate-700">
                            {decodeAttachment(attachment.data)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )

  const fetchJson = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Request to ${path} failed with status ${response.status}`)
      }

      if (response.status === 204) {
        return undefined as T
      }

      return (await response.json()) as T
    },
    []
  )

  const loadRunHistory = useCallback(async () => {
    setIsRunHistoryLoading(true)
    setRunHistoryError(null)
    try {
      const data = await fetchJson<RunHistoryEntry[]>('/api/results')
      setRunHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load run history. Please try again.'
      setRunHistoryError(message)
    } finally {
      setIsRunHistoryLoading(false)
    }
  }, [fetchJson])

  useEffect(() => {
    void loadRunHistory()
  }, [loadRunHistory])

  useEffect(() => {
    if (activePanel === 'history') {
      void loadRunHistory()
    }
  }, [activePanel, loadRunHistory])

  useEffect(() => {
    if (!monaco || typeLibrariesLoadedRef.current) {
      return
    }

    let disposed = false
    const disposables: { dispose: () => void }[] = []

    const loadTypeDefinitions = async () => {
      const typescriptApi = monaco.languages?.typescript
      if (!typescriptApi) {
        return
      }

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}qa-type-definitions.json`, {
          cache: 'force-cache',
        })

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`)
        }

        const bundle = (await response.json()) as TypeDefinitionResponse

        if (disposed) {
          return
        }

        const files = bundle?.files ?? {}
        if (!Object.keys(files).length) {
          console.warn('ScenarioEditor: QA type definitions bundle is empty')
          typeLibrariesLoadedRef.current = true
          return
        }

        typeLibrariesLoadedRef.current = true

        const defaults = typescriptApi.typescriptDefaults
        const currentOptions = defaults.getCompilerOptions()

        const modulePaths: Record<string, string[]> = {}
        const ensureModulePath = (moduleName: string, relativePath: string) => {
          const normalized = relativePath.replace(/\\/g, '/')
          const uri = `file:///node_modules/${normalized}`
          if (!files[uri]) {
            return
          }
          modulePaths[moduleName] = modulePaths[moduleName] ?? []
          if (!modulePaths[moduleName].includes(uri)) {
            modulePaths[moduleName].push(uri)
          }
        }

        ensureModulePath('@cucumber/cucumber', '@cucumber/cucumber/lib/index.d.ts')
        ensureModulePath('@playwright/test', '@playwright/test/index.d.ts')
        ensureModulePath('playwright-core', 'playwright-core/index.d.ts')
        ensureModulePath('playwright', 'playwright/index.d.ts')
        ensureModulePath('playwright/test', 'playwright/types/test.d.ts')

        const nextCompilerOptions = {
          ...currentOptions,
          allowJs: true,
          allowSyntheticDefaultImports: true,
          module: typescriptApi.ModuleKind.CommonJS,
          moduleResolution: typescriptApi.ModuleResolutionKind.NodeJs,
          noEmit: true,
          target: typescriptApi.ScriptTarget.ES2020,
          typeRoots: [],
          types: [],
          paths:
            Object.keys(modulePaths).length > 0
              ? {
                  ...(currentOptions.paths ?? {}),
                  ...modulePaths,
                }
              : currentOptions.paths,
        }

        defaults.setCompilerOptions(nextCompilerOptions)
        defaults.setEagerModelSync(true)

        const importMetaLib = `interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly [key: string]: string | undefined
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
`
        disposables.push(defaults.addExtraLib(importMetaLib, 'file:///scenario/import-meta.d.ts'))

        Object.entries(files).forEach(([uri, content]) => {
          disposables.push(defaults.addExtraLib(content, uri))
        })
      } catch (error) {
        if (!disposed) {
          console.error('ScenarioEditor: failed to load QA type definitions bundle', error)
        }
      }
    }

    loadTypeDefinitions()

    return () => {
      disposed = true
      disposables.forEach((disposable) => disposable.dispose())
      typeLibrariesLoadedRef.current = false
    }
  }, [monaco])

  const failureDetails = useMemo(() => extractFailureDetails(runResult?.report), [runResult])
  const imageAttachments = useMemo(
    () => failureDetails.attachments.filter((attachment) => attachment.mimeType.startsWith('image/')),
    [failureDetails.attachments]
  )
  const textAttachments = useMemo(
    () => failureDetails.attachments.filter((attachment) => attachment.mimeType.startsWith('text/')),
    [failureDetails.attachments]
  )

  const isBusy = isSaving || isRunning || isRunningService

  const applyScenario = useCallback((scenario: ScenarioRecord) => {
    setSelectedScenarioId(scenario.id)
    setTitle(scenario.title ?? DEFAULT_TITLE)
    setFeatureName(scenario.features[0]?.name ?? DEFAULT_FEATURE_NAME)
    setFeatureContent(scenario.features[0]?.content ?? DEFAULT_FEATURE_CONTENT)
  }, [])

  const resetEditor = useCallback(() => {
    setSelectedScenarioId(null)
    setTitle(DEFAULT_TITLE)
    setFeatureName(DEFAULT_FEATURE_NAME)
    setFeatureContent(DEFAULT_FEATURE_CONTENT)
  }, [])

  const loadScenarios = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchJson<ScenarioRecord[]>(basePath)
      setScenarios(data)
      if (data.length > 0) {
        applyScenario(data[0])
      } else {
        resetEditor()
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load scenarios from the server.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [applyScenario, fetchJson, resetEditor, basePath])

  useEffect(() => {
    void loadScenarios()
  }, [loadScenarios])

  const handleSelectScenario = useCallback(
    (id: number) => {
      const scenario = scenarios.find((item) => item.id === id)
      if (!scenario) {
        return
      }
      applyScenario(scenario)
      setFeedback(null)
      setError(null)
    },
    [applyScenario, scenarios]
  )

  const upsertScenarioInList = useCallback((updated: ScenarioRecord) => {
    setScenarios((current) => {
      const exists = current.some((item) => item.id === updated.id)
      if (exists) {
        return current.map((item) => (item.id === updated.id ? updated : item))
      }
      return [updated, ...current]
    })
  }, [])

  const handleNewScenario = useCallback(() => {
    resetEditor()
    setFeedback(null)
    setError(null)
    setRunResult(null)
  }, [resetEditor])

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setFeedback(null)
    setError(null)

    try {
      if (selectedScenarioId === null) {
        const created = await fetchJson<ScenarioRecord>(basePath, {
          method: 'POST',
          body: JSON.stringify(scenarioPayload),
        })
        upsertScenarioInList(created)
        applyScenario(created)
        setFeedback('Scenario saved.')
      } else {
        const updated = await fetchJson<ScenarioRecord>(`${basePath}/${selectedScenarioId}`, {
          method: 'PUT',
          body: JSON.stringify(scenarioPayload),
        })
        upsertScenarioInList(updated)
        applyScenario(updated)
        setFeedback('Scenario updated.')
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save the scenario. Please try again.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [applyScenario, fetchJson, scenarioPayload, selectedScenarioId, upsertScenarioInList])

  const handleDelete = useCallback(async () => {
    if (selectedScenarioId === null) {
      resetEditor()
      return
    }

    if (!window.confirm('Delete this scenario?')) {
      return
    }

    setError(null)
    setFeedback(null)

    try {
      await fetchJson<void>(`${basePath}/${selectedScenarioId}`, {
        method: 'DELETE',
      })
      setScenarios((current) => current.filter((item) => item.id !== selectedScenarioId))
      resetEditor()
      setRunResult(null)
      setFeedback('Scenario deleted.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete the scenario. Please try again.'
      setError(message)
    }
  }, [fetchJson, resetEditor, selectedScenarioId, basePath])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setFeedback(null)
    setRunResult(null)

    try {
      // In service context, run current feature against the Service Step Library via backend
      const url = serviceRunPath ? `${API_BASE_URL}${serviceRunPath}` : `${API_BASE_URL}/api/run`
      const payload = serviceRunPath
        ? { features: scenarioPayload.features, metadata: scenarioRunMetadata }
        : runPayload
      const body = JSON.stringify(payload)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      let parsedResponse: RunResponse | null = null
      try {
        parsedResponse = (await response.json()) as RunResponse
      } catch {
        parsedResponse = null
      }

      if (!response.ok) {
        const message =
          parsedResponse?.error ||
          `Failed to execute the scenario. Server responded with status ${response.status}.`
        setError(message)
        if (parsedResponse) {
          setRunResult(parsedResponse)
        }
        return
      }

      setRunResult(parsedResponse ?? { stdout: 'Run completed.' })
      setFeedback('Scenario executed.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to execute the scenario. Please try again.'
      setError(message)
    } finally {
      setIsRunning(false)
      void loadRunHistory()
    }
  }, [runPayload, serviceRunPath, scenarioPayload, scenarioRunMetadata, loadRunHistory])

  // Removed: redundant "Run Service (all steps)" button/handler. Use Run Scenario instead.

  return (
    <>
      <div className="flex min-h-screen flex-col gap-6 bg-slate-100 p-6 lg:flex-row">
        <aside className="flex w-full flex-col gap-4 rounded border border-slate-200 bg-white p-4 shadow-sm lg:w-72">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Scenarios</h2>
            <button
              type="button"
              className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700"
              onClick={handleNewScenario}
            >
              New
            </button>
          </div>
          {isLoading ? (
            <p className="text-sm text-slate-500">Loading scenarios...</p>
          ) : scenarios.length === 0 ? (
            <p className="text-sm text-slate-500">No saved scenarios yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {scenarios.map((scenario) => {
                const isActive = scenario.id === selectedScenarioId
                return (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectScenario(scenario.id)}
                      className={`w-full rounded border px-3 py-2 text-left text-sm transition hover:border-blue-400 ${
                        isActive
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <span className="block truncate font-medium">{scenario.title}</span>
                      <span className="text-xs text-slate-500">
                        Updated {new Date(scenario.updatedAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <div className="flex flex-1 flex-col gap-6 min-w-0">
          <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">Scenario Workspace</h1>
            <p className="text-sm text-slate-600">
              Draft feature files, save them to Spring, and execute runs against the QA runner.
            </p>
          </header>
          <div className="flex gap-2">
            <button
              type="button"
              className={panelButtonClass('editor')}
              onClick={() => setActivePanel('editor')}
            >
              Scenario editor
            </button>
            <button
              type="button"
              className={panelButtonClass('history')}
              onClick={() => setActivePanel('history')}
            >
              Run history
            </button>
          </div>

          {activePanel === 'editor' ? (
            <>
              <section className="grid min-w-0 gap-6 rounded border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-1">
                <div className="flex min-w-0 flex-col gap-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Scenario title</span>
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder={DEFAULT_TITLE}
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-700">Feature file</span>
                    <input
                      className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      value={featureName}
                      onChange={(event) => setFeatureName(event.target.value)}
                      placeholder={DEFAULT_FEATURE_NAME}
                    />
                  </label>
                  <div className="overflow-hidden rounded border border-slate-200 shadow-inner">
                    <Editor
                      height="400px"
                      path={featureEditorPath}
                      language="gherkin"
                      value={featureContent}
                      onChange={(value) => setFeatureContent(value ?? '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-center text-sm text-slate-500">
                  Steps are managed in the service Step Library.
                </div>
              </section>

              <section className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isBusy}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? 'Saving…' : selectedScenarioId === null ? 'Save Scenario' : 'Update Scenario'}
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isBusy}
                  className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isRunning ? 'Running…' : 'Run Scenario'}
                </button>

                {serviceRunPath && (
                  <button
                    type="button"
                    onClick={async () => {
                      // Run all features under the service with the full Step Library
                      setIsRunningService(true)
                      setError(null)
                      setFeedback(null)
                      setRunResult(null)
                      try {
                        const payload = {
                          metadata: {
                            scope: 'SERVICE' as RunScope,
                            serviceId,
                            serviceFullRun: true,
                          },
                        }
                        const response = await fetch(`${API_BASE_URL}${serviceRunPath}`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload),
                        })
                        let serviceResponse: RunResponse | null = null
                        try {
                          serviceResponse = (await response.json()) as RunResponse
                        } catch {
                          serviceResponse = null
                        }
                        if (!response.ok) {
                          setError(
                            serviceResponse?.error ||
                              `Failed to execute the service run. Server responded with status ${response.status}.`
                          )
                          if (serviceResponse) setRunResult(serviceResponse)
                          return
                        }
                        setRunResult(serviceResponse ?? { stdout: 'Service (all features) run completed.' })
                        setFeedback('Service executed with all features.')
                      } catch (err) {
                        const message = err instanceof Error ? err.message : 'Failed to execute service run.'
                        setError(message)
                      } finally {
                        setIsRunningService(false)
                        void loadRunHistory()
                      }
                    }}
                    disabled={isBusy}
                    className="rounded bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Run Service (all features)
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="rounded border border-red-400 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete Scenario
                </button>
              </section>

              {(feedback || error) && (
                <section>
                  {feedback && <p className="text-sm text-emerald-600">{feedback}</p>}
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </section>
              )}

              {runResult && (
                <section className="flex flex-col gap-3 overflow-x-hidden rounded border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-800">Run output</h2>
                  {runResult.error && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-600">Error</h3>
                      <pre className="mt-1 max-h-48 w-full overflow-auto rounded bg-rose-50 p-3 text-xs text-rose-700">
                        {runResult.error}
                      </pre>
                    </div>
                  )}
                  {failureDetails.messages.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-red-600">Failure details</h3>
                      <div className="mt-1 space-y-2">
                        {failureDetails.messages.map((message, index) => (
                          <pre
                            key={`failure-message-${index}`}
                            className="max-h-48 w-full overflow-auto rounded bg-amber-50 p-3 text-xs text-amber-800"
                          >
                            {message}
                          </pre>
                        ))}
                      </div>
                    </div>
                  )}
                  {runResult.stdout && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">STDOUT</h3>
                      <pre className="mt-1 max-h-48 w-full overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                        {runResult.stdout}
                      </pre>
                    </div>
                  )}
                  {runResult.stderr && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">STDERR</h3>
                      <pre className="mt-1 max-h-48 w-full overflow-auto rounded bg-slate-900 p-3 text-xs text-red-200">
                        {runResult.stderr}
                      </pre>
                    </div>
                  )}
                  {imageAttachments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Captured screenshots</h3>
                      <div className="mt-2 flex flex-wrap gap-4">
                        {imageAttachments.map((attachment) => {
                          const dataUrl = `data:${attachment.mimeType};base64,${attachment.data}`
                          return (
                            <figure key={attachment.id} className="flex max-w-xs flex-col gap-1">
                              <img
                                src={dataUrl}
                                alt={attachment.stepName ?? 'Failure screenshot'}
                                className="h-auto max-h-60 w-full cursor-zoom-in rounded border border-slate-200 bg-slate-100 object-contain transition hover:shadow-lg"
                                onClick={() => setSelectedScreenshot(attachment)}
                              />
                              <figcaption className="text-xs text-slate-600">
                                {attachment.scenarioName && (
                                  <span className="font-medium">{attachment.scenarioName}: </span>
                                )}
                                {attachment.stepName ?? 'Screenshot'}
                              </figcaption>
                            </figure>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  {textAttachments.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">Failure logs</h3>
                      <div className="mt-2 space-y-2">
                        {textAttachments.map((attachment) => {
                          let decoded = attachment.data
                          try {
                            decoded = atob(attachment.data)
                          } catch {
                            // ignore decoding errors
                          }
                          return (
                            <div key={attachment.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                              <p className="text-xs font-medium text-slate-600">
                                {attachment.scenarioName && `${attachment.scenarioName}: `}
                                {attachment.stepName ?? 'After hook log'}
                              </p>
                              <pre className="mt-1 max-h-48 w-full overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                                {decoded}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          ) : (
            <section className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-800">Run history</h2>
                <button
                  type="button"
                  onClick={() => void loadRunHistory()}
                  disabled={isRunHistoryLoading}
                  className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRunHistoryLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
              {runHistoryError && <p className="text-sm text-rose-600">{runHistoryError}</p>}
              {isRunHistoryLoading && runHistory.length === 0 ? (
                <p className="text-sm text-slate-500">Loading run history...</p>
              ) : (
                <div className="space-y-3">
                  {serviceId !== undefined && (
                    <HistoryList
                      title="Service runs"
                      items={serviceHistory}
                      onSelectAttachment={setSelectedScreenshot}
                    />
                  )}
                  <HistoryList
                    title={serviceId !== undefined ? 'Scenario runs' : 'Recent scenario runs'}
                    items={scenarioHistory}
                    onSelectAttachment={setSelectedScreenshot}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={`data:${selectedScreenshot.mimeType};base64,${selectedScreenshot.data}`}
              alt={selectedScreenshot.stepName ?? 'Failure screenshot'}
              className="h-auto max-h-[90vh] w-auto max-w-[90vw] rounded shadow-2xl"
            />
            <button
              type="button"
              className="absolute right-2 top-2 rounded bg-black/60 px-3 py-1 text-sm font-semibold text-white hover:bg-black/80"
              onClick={() => setSelectedScreenshot(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ScenarioEditor
