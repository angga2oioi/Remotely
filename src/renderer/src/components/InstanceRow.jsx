import { useState } from 'react'
import Modal from './Modal.jsx'
import SshBootstrapModal from './SshBootstrapModal.jsx'
import RunbookVariablesModal from './RunbookVariablesModal.jsx'
import { extractVariables, applyVariables } from '../lib/runbookVariables.js'

const STATE_COLORS = {
  running: 'bg-emerald-500/20 text-emerald-400',
  stopped: 'bg-slate-500/20 text-slate-400',
  pending: 'bg-amber-500/20 text-amber-400',
  stopping: 'bg-amber-500/20 text-amber-400'
}

export default function InstanceRow({ instance, projectId, tags, runbooks, isManaged, onTagsChanged, onInstanceChanged }) {
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tagSaving, setTagSaving] = useState(false)
  const [sshModalOpen, setSshModalOpen] = useState(false)

  const [selectedRunbookId, setSelectedRunbookId] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingRunbook, setPendingRunbook] = useState(null)

  async function handleAddTag(e) {
    e.preventDefault()
    const tag = tagInput.trim()
    if (!tag) return
    setTagSaving(true)
    try {
      await window.api.instanceTag.add(projectId, instance.id, tag)
      setTagInput('')
      setTagModalOpen(false)
      await onTagsChanged()
    } finally {
      setTagSaving(false)
    }
  }

  async function removeTag(tag) {
    await window.api.instanceTag.remove(projectId, instance.id, tag)
    await onTagsChanged()
  }

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
      const outcome = await window.api.ssm.runAndWait(projectId, {
        instanceId: instance.id,
        commands,
        comment: `Runbook "${name}" via Remotely`
      })
      setResult(outcome)
    } catch (err) {
      setResult({ status: 'Error', error: err.message })
    } finally {
      setRunning(false)
    }
  }

  const stateClass = STATE_COLORS[instance.state] ?? 'bg-slate-500/20 text-slate-400'

  return (
    <>
      <tr className="align-top">
        <td className="px-4 py-2">
          <div className="flex flex-col gap-1.5">
            <span>{instance.name ?? '—'}</span>
            <div className="flex flex-wrap items-center gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="text-slate-400 hover:text-red-400">
                    ×
                  </button>
                </span>
              ))}
              <button
                onClick={() => setTagModalOpen(true)}
                className="rounded-full border border-dashed border-slate-600 px-2 py-0.5 text-xs text-slate-400 hover:border-sky-500 hover:text-sky-400"
              >
                + tag
              </button>
            </div>
          </div>
        </td>
        <td className="px-4 py-2 font-mono">{instance.id}</td>
        <td className="px-4 py-2">{instance.type}</td>
        <td className="px-4 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${stateClass}`}>{instance.state}</span>
        </td>
        <td className="px-4 py-2">{instance.privateIp ?? '—'}</td>
        <td className="px-4 py-2">
          <div className="flex flex-col gap-2">
            {isManaged ? (
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
              </div>
            ) : (
              <div className="flex flex-col items-start gap-1">
                <p className="max-w-xs text-xs text-amber-400">
                  {instance.iamInstanceProfileArn
                    ? 'Not managed by SSM Agent yet — commands can\'t run here.'
                    : 'No IAM role attached and not managed by SSM Agent — commands can\'t run here.'}
                </p>
                <button
                  onClick={() => setSshModalOpen(true)}
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Bootstrap via SSH…
                </button>
              </div>
            )}

            {result && (
              <div className="max-w-md rounded-md border border-slate-700 bg-slate-950 p-2 text-xs">
                <p
                  className={
                    result.status === 'Success'
                      ? 'font-medium text-emerald-400'
                      : 'font-medium text-red-400'
                  }
                >
                  {result.status}
                </p>
                {result.output && <pre className="mt-1 whitespace-pre-wrap text-slate-300">{result.output}</pre>}
                {result.error && <pre className="mt-1 whitespace-pre-wrap text-red-400">{result.error}</pre>}
              </div>
            )}
          </div>
        </td>
      </tr>

      {tagModalOpen && (
        <Modal title={`Tag ${instance.name ?? instance.id}`} onClose={() => setTagModalOpen(false)}>
          <form onSubmit={handleAddTag} className="flex flex-col gap-3">
            <input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="e.g. prod, db-primary"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTagModalOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={tagSaving || !tagInput.trim()}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {tagSaving ? 'Adding…' : 'Add Tag'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {sshModalOpen && (
        <SshBootstrapModal
          instance={instance}
          projectId={projectId}
          onClose={() => setSshModalOpen(false)}
          onInstanceChanged={onInstanceChanged}
        />
      )}

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
