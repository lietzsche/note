import { useParams } from 'react-router-dom'
import { useState } from 'react'
import ScenarioEditor from '../components/ScenarioEditor'
import StepLibrary from '../components/StepLibrary'

export default function ServiceScenariosPage() {
  const params = useParams()
  const serviceId = params.serviceId as string
  const basePath = `/api/services/${serviceId}/scenarios`
  const [tab, setTab] = useState<'scenarios' | 'steps'>('scenarios')

  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-semibold ${
            tab === 'scenarios' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800'
          }`}
          onClick={() => setTab('scenarios')}
        >
          Scenarios
        </button>
        <button
          type="button"
          className={`rounded px-3 py-2 text-sm font-semibold ${
            tab === 'steps' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800'
          }`}
          onClick={() => setTab('steps')}
        >
          Step Library
        </button>
      </div>

      {tab === 'scenarios' ? (
        <ScenarioEditor basePath={basePath} />
      ) : (
        <StepLibrary serviceId={serviceId} />
      )}
    </div>
  )
}

