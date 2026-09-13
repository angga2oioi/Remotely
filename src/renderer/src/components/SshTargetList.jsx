import { useEffect, useState } from 'react'
import SshTargetRow from './SshTargetRow.jsx'
import SshTargetForm from './SshTargetForm.jsx'

export default function SshTargetList({ projectId }) {
  const [targets, setTargets] = useState([])
  const [runbooks, setRunbooks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formTarget, setFormTarget] = useState(null) // null = closed, {} = add, target = edit
  const [showForm, setShowForm] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [targetList, runbookList] = await Promise.all([
        window.api.sshTarget.list(projectId),
        window.api.runbook.list()
      ])
      setTargets(targetList)
      setRunbooks(runbookList)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  function openAddForm() {
    setFormTarget(null)
    setShowForm(true)
  }

  function openEditForm(target) {
    setFormTarget(target)
    setShowForm(true)
  }

  async function handleSaved() {
    setShowForm(false)
    await refresh()
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">SSH Targets</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            onClick={openAddForm}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            + Add Target
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700 text-sm">
          <thead className="bg-slate-800 text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Connection</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {targets.map((target) => (
              <SshTargetRow
                key={target.id}
                target={target}
                projectId={projectId}
                runbooks={runbooks}
                onEdit={openEditForm}
                onChanged={refresh}
              />
            ))}
            {targets.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No targets yet — add a host to run runbooks against it over SSH.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <SshTargetForm
          projectId={projectId}
          target={formTarget}
          onClose={() => setShowForm(false)}
          onSaved={handleSaved}
        />
      )}
    </section>
  )
}
