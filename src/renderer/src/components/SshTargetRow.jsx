import { useState } from 'react'
import RunbookVariablesModal from './RunbookVariablesModal.jsx'
import { extractVariables, applyVariables } from '../lib/runbookVariables.js'

export default function SshTargetRow({ target, projectId, runbooks, onEdit, onChanged }) {
  const [selectedRunbookId, setSelectedRunbookId] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingRunbook, setPendingRunbook] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function handleRunClick() {
    const runbook = runbooks.find((r) => r.id === selectedRunbookId)
    if (!runbook) return
    const variables = extractVariables(runbook.commands)
    if (variables.length > 0) {
      setPendingRunbook({ runbook, variables })
    } else {
      executeRunbook(runbook.name, runbook.commands)
    }
  }

  function handleVariablesSubmit(values) {
    const { runbook } = pendingRunbook
    setPendingRunbook(null)
    executeRunbook(runbook.name, applyVariables(runbook.commands, values))
  }

  async function executeRunbook(name, commands) {
    setRunning(true)
    setResult(null)
    try {
      const outcome = await window.api.sshTarget.runAndWait(projectId, { targetId: target.id, commands })
      setResult(outcome)
    } catch (err) {
      setResult({ status: 'Error', error: err.message })
    } finally {
      setRunning(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await window.api.sshTarget.remove(projectId, target.id)
      await onChanged()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <tr className="align-top">
      <td className="px-4 py-2">{target.name}</td>
      <td className="px-4 py-2 font-mono">
        {target.username}@{target.host}:{target.port}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <select
              value={selectedRunbookId}
              onChange={(e) => setSelectedRunbookId(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
            >
              <option value="">Run command…</option>
              {runbooks.map((runbook) => (
                <option key={runbook.id} value={runbook.id}>
                  {runbook.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRunClick}
              disabled={!selectedRunbookId || running}
              className="rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {running ? 'Running…' : 'Run'}
            </button>
            <button
              onClick={() => onEdit(target)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-red-400 hover:bg-slate-700 disabled:opacity-50"
            >
              Delete
            </button>
          </div>

          {result && (
            <div className="max-w-md rounded-md border border-slate-700 bg-slate-950 p-2 text-xs">
              <p className={result.status === 'Success' ? 'font-medium text-emerald-400' : 'font-medium text-red-400'}>
                {result.status}
              </p>
              {result.output && <pre className="mt-1 whitespace-pre-wrap text-slate-300">{result.output}</pre>}
              {result.error && <pre className="mt-1 whitespace-pre-wrap text-red-400">{result.error}</pre>}
            </div>
          )}
        </div>
      </td>
    </tr>

    {pendingRunbook && (
      <RunbookVariablesModal
        runbookName={pendingRunbook.runbook.name}
        variables={pendingRunbook.variables}
        onCancel={() => setPendingRunbook(null)}
        onSubmit={handleVariablesSubmit}
      />
    )}
    </>
  )
}
