import { useCallback, useEffect, useMemo, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'

type RunResponse = {
  runDir?: string
  stdout?: string
  stderr?: string
  report?: unknown
}

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function ScenarioEditor() {
  const monaco = useMonaco()

  const [featureName, setFeatureName] = useState(DEFAULT_FEATURE_NAME)
  const [stepsName, setStepsName] = useState(DEFAULT_STEPS_NAME)
  const [featureContent, setFeatureContent] = useState(DEFAULT_FEATURE_CONTENT)
  const [stepsContent, setStepsContent] = useState(DEFAULT_STEPS_CONTENT)
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<RunResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const payload = useMemo(
    () => ({
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
    [featureName, featureContent, stepsName, stepsContent]
  )

  const postScenarioData = useCallback(
    async (path: string) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Request to ${path} failed with status ${response.status}`)
      }

      if (response.headers.get('content-length') === '0' || response.status === 204) {
        return null
      }

      const text = await response.text()
      return text ? (JSON.parse(text) as RunResponse) : null
    },
    [payload]
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage(null)
    setError(null)

    try {
      await postScenarioData('/api/scenarios')
      setSaveMessage('시나리오가 저장되었습니다.')
    } catch (err) {
      const message = err instanceof Error ? err.message : '시나리오 저장 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }, [postScenarioData])

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setRunResult(null)
    setError(null)

    try {
      const data = await postScenarioData('/api/run')
      setRunResult(data ?? { stdout: '실행이 완료되었습니다.' })
    } catch (err) {
      const message = err instanceof Error ? err.message : '시나리오 실행 중 오류가 발생했습니다.'
      setError(message)
    } finally {
      setIsRunning(false)
    }
  }, [postScenarioData])

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-900">Scenario Editor</h1>
        <p className="text-sm text-slate-600">
          Feature와 Step 코드를 작성하고 Spring 백엔드로 저장하거나 실행하세요.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Feature 파일명</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={featureName}
              onChange={(event) => setFeatureName(event.target.value)}
              placeholder="example.feature"
            />
          </label>
          <div className="overflow-hidden rounded border border-slate-200 shadow-sm">
            <Editor
              height="400px"
              defaultLanguage="gherkin"
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
            <span className="text-sm font-medium text-slate-700">Step 파일명</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={stepsName}
              onChange={(event) => setStepsName(event.target.value)}
              placeholder="example.steps.ts"
            />
          </label>
          <div className="overflow-hidden rounded border border-slate-200 shadow-sm">
            <Editor
              height="400px"
              defaultLanguage="typescript"
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
          {isSaving ? '저장 중...' : '저장'}
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning || isSaving}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isRunning ? '실행 중...' : '실행'}
        </button>
      </section>

      {(saveMessage || error) && (
        <section>
          {saveMessage && <p className="text-sm text-emerald-600">{saveMessage}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </section>
      )}

      {runResult && (
        <section className="flex flex-col gap-3 rounded border border-slate-200 p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">실행 결과</h2>
          {runResult.runDir && (
            <p className="text-sm text-slate-600">
              실행 디렉토리: <span className="font-mono">{runResult.runDir}</span>
            </p>
          )}
          {runResult.stdout && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">STDOUT</h3>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {runResult.stdout}
              </pre>
            </div>
          )}
          {runResult.stderr && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">STDERR</h3>
              <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900 p-3 text-xs text-red-200">
                {runResult.stderr}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default ScenarioEditor
