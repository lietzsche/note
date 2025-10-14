import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type Service = {
  id: number
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  scenarioCount: number
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE_URL}/api/services`)
        if (!res.ok) throw new Error(`Failed with ${res.status}`)
        const data = (await res.json()) as Service[]
        setServices(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load services')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Services</h1>
        <p className="text-sm text-slate-600">Select a service to manage its scenarios.</p>
      </header>

      {/* Create form */}
      <section className="mb-8 rounded border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Create a Service</h2>
        <form
          className="flex flex-col gap-3 max-w-xl"
          onSubmit={async (e: FormEvent) => {
            e.preventDefault()
            if (!name.trim()) return
            setIsCreating(true)
            setError(null)
            try {
              const res = await fetch(`${API_BASE_URL}/api/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: description || undefined }),
              })
              if (!res.ok) {
                const msg = await res.text()
                throw new Error(msg || `Failed to create service (${res.status})`)
              }
              const created = (await res.json()) as Service
              setServices((prev) => {
                const exists = prev.some((s) => s.id === created.id)
                return exists ? prev.map((s) => (s.id === created.id ? created : s)) : [created, ...prev]
              })
              setName('')
              setDescription('')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to create service')
            } finally {
              setIsCreating(false)
            }
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Name</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payments API"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Description (optional)</span>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-slate-700"
            >
              {isCreating ? 'Creating…' : 'Create Service'}
            </button>
          </div>
        </form>
      </section>

      {isLoading && <p className="text-slate-600">Loading services…</p>}
      {error && <p className="text-rose-600">{error}</p>}
      {!isLoading && !error && (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {services.map((svc) => (
            <li key={svc.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">
                <Link className="hover:underline" to={`/services/${svc.id}`}>
                  {svc.name}
                </Link>
              </h2>
              {svc.description && <p className="mt-1 text-sm text-slate-600">{svc.description}</p>}
              <p className="mt-2 text-xs text-slate-500">{svc.scenarioCount} scenarios</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
