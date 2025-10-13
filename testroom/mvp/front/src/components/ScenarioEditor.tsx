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
  runDir?: string
  stdout?: string
  stderr?: string
  report?: CucumberReport
  error?: string
}

type TypeDefinitionResponse = {
  files: Record<string, string>
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const DEFAULT_TITLE = 'New Scenario'
const DEFAULT_FEATURE_NAME = 'example.feature'
const DEFAULT_STEPS_NAME = 'example.steps.ts'
const DEFAULT_FEATURE_CONTENT = `Feature: Example
  Scenario: Visit Playwright
    Given I open playwright homepage
    When I interact with the page
    Then I should see the expected result`

const DEFAULT_STEPS_CONTENT = `import { Given, When, Then } from '@cucumber/cucumber';

Given('I open playwright homepage', async function () {
  await this.page.goto('https://playwright.dev');
});

When('I interact with the page', async function () {
  // TODO: implement step
});

Then('I should see the expected result', async function () {
  // TODO: add assertions
});
`

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

function ScenarioEditor() {
  const monaco = useMonaco()
  const typeLibrariesLoadedRef = useRef(false)

  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null)
  const [title, setTitle] = useState(DEFAULT_TITLE)
  const [featureName, setFeatureName] = useState(DEFAULT_FEATURE_NAME)
  const [stepsName, setStepsName] = useState(DEFAULT_STEPS_NAME)
  const [featureContent, setFeatureContent] = useState(DEFAULT_FEATURE_CONTENT)
  const [stepsContent, setStepsContent] = useState(DEFAULT_STEPS_CONTENT)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)

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

  const scenarioPayload = useMemo<ScenarioPayload>(
    () => ({
      title: title.trim() || DEFAULT_TITLE,
      features: [
        {
          name: featureName.trim() || DEFAULT_FEATURE_NAME,
          content: featureContent,
        },
      ],
      steps: [
        {
          name: stepsName.trim() || DEFAULT_STEPS_NAME,
          content: stepsContent,
        },
      ],
    }),
    [title, featureName, featureContent, stepsName, stepsContent]
  )

  const runPayload = useMemo(
    () => ({
      features: scenarioPayload.features,
      steps: scenarioPayload.steps,
    }),
    [scenarioPayload]
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

        defaults.setCompilerOptions({
          ...currentOptions,
          allowJs: true,
          allowSyntheticDefaultImports: true,
          module: typescriptApi.ModuleKind.CommonJS,
          moduleResolution: typescriptApi.ModuleResolutionKind.NodeJs,
          noEmit: true,
          target: typescriptApi.ScriptTarget.ES2020,
          typeRoots: [],
          types: [],
        })
        defaults.setEagerModelSync(true)

        Object.entries(files).forEach(([uri, content]) => disposables.push(defaults.addExtraLib(content, uri)))
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

  const applyScenario = useCallback((scenario: ScenarioRecord) => {
    setSelectedScenarioId(scenario.id)
    setTitle(scenario.title ?? DEFAULT_TITLE)
    setFeatureName(scenario.features[0]?.name ?? DEFAULT_FEATURE_NAME)
    setFeatureContent(scenario.features[0]?.content ?? DEFAULT_FEATURE_CONTENT)
    setStepsName(scenario.steps[0]?.name ?? DEFAULT_STEPS_NAME)
    setStepsContent(scenario.steps[0]?.content ?? DEFAULT_STEPS_CONTENT)
  }, [])

  const resetEditor = useCallback(() => {
    setSelectedScenarioId(null)
    setTitle(DEFAULT_TITLE)
    setFeatureName(DEFAULT_FEATURE_NAME)
    setFeatureContent(DEFAULT_FEATURE_CONTENT)
    setStepsName(DEFAULT_STEPS_NAME)
    setStepsContent(DEFAULT_STEPS_CONTENT)
  }, [])

  const loadScenarios = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const data = await fetchJson<ScenarioRecord[]>('/api/scenarios')
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
  }, [applyScenario, fetchJson, resetEditor])

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
        const created = await fetchJson<ScenarioRecord>('/api/scenarios', {
          method: 'POST',
          body: JSON.stringify(scenarioPayload),
        })
        upsertScenarioInList(created)
        applyScenario(created)
        setFeedback('Scenario saved.')
      } else {
        const updated = await fetchJson<ScenarioRecord>(`/api/scenarios/${selectedScenarioId}`, {
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
      await fetchJson<void>(`/api/scenarios/${selectedScenarioId}`, {
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
  }, [fetchJson, resetEditor, selectedScenarioId])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setError(null)
    setFeedback(null)
    setRunResult(null)

    try {
      const response = await fetch(`${API_BASE_URL}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runPayload),
      })

      let payload: RunResponse | null = null
      try {
        payload = (await response.json()) as RunResponse
      } catch {
        payload = null
      }

      if (!response.ok) {
        const message =
          payload?.error ||
          `Failed to execute the scenario. Server responded with status ${response.status}.`
        setError(message)
        if (payload) {
          setRunResult(payload)
        }
        return
      }

      setRunResult(payload ?? { stdout: 'Run completed.' })
      setFeedback('Scenario executed.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to execute the scenario. Please try again.'
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }, [runPayload])

  return (
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

      <div className="flex flex-1 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">Scenario Editor</h1>
          <p className="text-sm text-slate-600">
            Draft feature and step code, save versions to Spring, and execute against the QA runner.
          </p>
        </header>

        <section className="grid gap-6 rounded border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-3">
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

          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">Step file</span>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={stepsName}
                onChange={(event) => setStepsName(event.target.value)}
                placeholder={DEFAULT_STEPS_NAME}
              />
            </label>
            <div className="overflow-hidden rounded border border-slate-200 shadow-inner">
              <Editor
                height="400px"
                language="typescript"
                value={stepsContent}
                onChange={(value) => setStepsContent(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  suggest: {
                    showSnippets: true,
                  },
                }}
              />
            </div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isRunning}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSaving ? 'Saving…' : selectedScenarioId === null ? 'Save Scenario' : 'Update Scenario'}
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning || isSaving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isRunning ? 'Running…' : 'Run Scenario'}
          </button>
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
          <section className="flex flex-col gap-3 rounded border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Run output</h2>
            {runResult.runDir && (
              <p className="text-sm text-slate-600">
                Run directory: <span className="font-mono">{runResult.runDir}</span>
              </p>
            )}
            {runResult.error && (
              <div>
                <h3 className="text-sm font-semibold text-red-600">Error</h3>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-rose-50 p-3 text-xs text-rose-700">
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
                      className="max-h-48 overflow-auto rounded bg-amber-50 p-3 text-xs text-amber-800"
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
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {runResult.stdout}
                </pre>
              </div>
            )}
            {runResult.stderr && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700">STDERR</h3>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-red-200">
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
                      <figure key={attachment.id} className="flex flex-col gap-1">
                        <img
                          src={dataUrl}
                          alt={attachment.stepName ?? 'Failure screenshot'}
                          className="max-h-60 rounded border border-slate-200 bg-slate-100 object-contain"
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
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
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
      </div>
    </div>
  )
}

export default ScenarioEditor
