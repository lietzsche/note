import { useCallback, useEffect, useMemo, useState } from 'react'
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
  report?: unknown
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

function ScenarioEditor() {
  const monaco = useMonaco()

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
      const data = await fetchJson<RunResponse>('/api/run', {
        method: 'POST',
        body: JSON.stringify(runPayload),
      })
      setRunResult(data ?? { stdout: 'Run completed.' })
      setFeedback('Scenario executed.')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to execute the scenario. Please try again.'
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }, [fetchJson, runPayload])

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
          </section>
        )}
      </div>
    </div>
  )
}

export default ScenarioEditor
