import { useState } from 'react'

const initialState = {
  name: '',
  region: 'us-east-1',
  accessKeyId: '',
  secretAccessKey: '',
  sessionToken: ''
}

export default function ProjectForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(initialState)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const project = await window.api.project.create({
        name: form.name,
        region: form.region,
        credentials: {
          accessKeyId: form.accessKeyId,
          secretAccessKey: form.secretAccessKey,
          sessionToken: form.sessionToken || undefined
        }
      })
      setForm(initialState)
      onCreated(project)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-slate-700 bg-slate-800 p-5">
      <h2 className="text-base font-semibold text-slate-100">New Project</h2>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Project name
        <input
          required
          value={form.name}
          onChange={update('name')}
          placeholder="Payments Service"
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        AWS region
        <input
          required
          value={form.region}
          onChange={update('region')}
          placeholder="us-east-1"
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Access key ID
        <input
          required
          value={form.accessKeyId}
          onChange={update('accessKeyId')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Secret access key
        <input
          required
          type="password"
          value={form.secretAccessKey}
          onChange={update('secretAccessKey')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Session token (optional, for temporary STS credentials)
        <input
          type="password"
          value={form.sessionToken}
          onChange={update('sessionToken')}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}
