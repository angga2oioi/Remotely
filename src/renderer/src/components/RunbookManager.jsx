import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { extractVariables } from '../lib/runbookVariables.js'

const emptyForm = { name: '', script: '' }

function VariablesHint({ script }) {
  const variables = extractVariables(script)
  if (variables.length === 0) return null
  return (
    <p className="text-xs text-slate-500">
      Detected variables: {variables.map((name) => `{{${name}}}`).join(', ')} — you'll be asked to fill
      these in each time this runbook is run.
    </p>
  )
}

export default function RunbookManager({ projectId }) {
  const [runbooks, setRunbooks] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  async function refresh() {
    setRunbooks(await window.api.runbook.list(projectId))
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  function flash(message) {
    setNotice(message)
    setTimeout(() => setNotice(null), 3000)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const commands = form.script.split('\n').map((line) => line.trim()).filter(Boolean)
      if (commands.length === 0) throw new Error('Enter at least one command')
      await window.api.runbook.create(projectId, { name: form.name, commands })
      setForm(emptyForm)
      setShowCreateModal(false)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(runbook) {
    setEditingId(runbook.id)
    setEditForm({ name: runbook.name, script: runbook.commands.join('\n') })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(emptyForm)
    setEditError(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    try {
      const commands = editForm.script.split('\n').map((line) => line.trim()).filter(Boolean)
      if (commands.length === 0) throw new Error('Enter at least one command')
      await window.api.runbook.update(editingId, { name: editForm.name, commands })
      setEditingId(null)
      await refresh()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete(id) {
    await window.api.runbook.delete(id)
    await refresh()
  }

  async function handleExport(runbook) {
    const result = await window.api.runbook.export(runbook)
    if (!result.canceled) flash(`Exported to ${result.filePath}`)
  }

  async function handleCopy(runbook) {
    await window.api.runbook.copyToClipboard(runbook)
    flash(`"${runbook.name}" copied to clipboard`)
  }

  async function handleImportFromFile() {
    setError(null)
    try {
      const imported = await window.api.runbook.importFromFile(projectId)
      if (imported.length > 0) {
        await refresh()
        flash(`Imported ${imported.length} runbook(s)`)
      }
    } catch (err) {
      setError(`Import failed: ${err.message}`)
    }
  }

  async function handleImportFromClipboard() {
    setError(null)
    try {
      const imported = await window.api.runbook.importFromClipboard(projectId)
      if (imported.length === 0) {
        setError('Clipboard did not contain a valid runbook')
        return
      }
      await refresh()
      flash(`Imported ${imported.length} runbook(s) from clipboard`)
    } catch (err) {
      setError(`Import failed: ${err.message}`)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Runbooks</h2>
        <div className="flex gap-2">
          <button
            onClick={handleImportFromClipboard}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Import from Clipboard
          </button>
          <button
            onClick={handleImportFromFile}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Import from File
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            + New Runbook
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-400">
        Save a named shell command sequence once, then run it against any instance in this project
        straight from the EC2 list — no more hunting for the right PEM key or remembering the exact
        commands. Export or copy a runbook to share it with a teammate or another project; only
        import runbooks from sources you trust, since they run as-is on your instances.
      </p>

      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {showCreateModal && (
        <Modal title="New Runbook" onClose={() => setShowCreateModal(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Name
              <input
                required
                autoFocus
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Restart nginx"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Commands (one shell command per line — use <code>{'{{variable}}'}</code> for values to fill in at run time)
              <textarea
                required
                rows={5}
                value={form.script}
                onChange={(e) => setForm((prev) => ({ ...prev, script: e.target.value }))}
                placeholder={'sudo systemctl restart {{service_name}}'}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </label>
            <VariablesHint script={form.script} />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Runbook'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="flex flex-col gap-2">
        {runbooks.map((runbook) =>
          editingId === runbook.id ? (
            <form
              key={runbook.id}
              onSubmit={saveEdit}
              className="flex flex-col gap-3 rounded-lg border border-sky-600 bg-slate-800 p-4"
            >
              <input
                required
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
              <textarea
                required
                rows={5}
                value={editForm.script}
                onChange={(e) => setEditForm((prev) => ({ ...prev, script: e.target.value }))}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100"
              />
              <VariablesHint script={editForm.script} />
              {editError && <p className="text-xs text-red-400">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div key={runbook.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-start justify-between">
                <h3 className="font-medium text-slate-100">{runbook.name}</h3>
                <div className="flex gap-3 text-xs font-medium">
                  <button onClick={() => startEdit(runbook)} className="text-slate-400 hover:text-slate-200">
                    Edit
                  </button>
                  <button onClick={() => handleCopy(runbook)} className="text-slate-400 hover:text-slate-200">
                    Copy
                  </button>
                  <button onClick={() => handleExport(runbook)} className="text-slate-400 hover:text-slate-200">
                    Export
                  </button>
                  <button onClick={() => handleDelete(runbook.id)} className="text-red-400 hover:text-red-300">
                    Delete
                  </button>
                </div>
              </div>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-xs text-slate-300">
                {runbook.commands.join('\n')}
              </pre>
            </div>
          )
        )}
        {runbooks.length === 0 && (
          <p className="text-sm text-slate-500">No runbooks yet for this project.</p>
        )}
      </div>
    </section>
  )
}
