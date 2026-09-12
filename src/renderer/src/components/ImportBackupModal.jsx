import { useState } from 'react'
import Modal from './Modal.jsx'

export default function ImportBackupModal({ onClose, onImported }) {
  const [password, setPassword] = useState('')
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setImporting(true)
    setError(null)
    try {
      const outcome = await window.api.backup.import(password)
      if (!outcome.canceled) setResult(outcome)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  function handleDone() {
    onImported()
    onClose()
  }

  return (
    <Modal title="Import All Settings" onClose={onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">
            Imported {result.projectCount} project(s) and {result.runbookCount} runbook(s).
          </p>
          <div className="flex justify-end">
            <button
              onClick={handleDone}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Reload App
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-xs text-amber-400">
            This replaces every project, AWS credential, runbook, instance tag, and agent mode setting
            currently on this device with what's in the backup file. This can't be undone.
          </p>
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Password
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={importing}
              className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {importing ? 'Importing…' : 'Select File & Import'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
