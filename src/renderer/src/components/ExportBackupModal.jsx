import { useState } from 'react'
import Modal from './Modal.jsx'

export default function ExportBackupModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) {
      setError('Use a password of at least 8 characters — it protects your AWS credentials.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setExporting(true)
    setError(null)
    try {
      const outcome = await window.api.backup.export(password)
      if (!outcome.canceled) setResult(outcome.filePath)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal title="Export All Settings" onClose={onClose}>
      {result ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-emerald-400">Exported to {result}</p>
          <p className="text-xs text-slate-400">
            Keep the password somewhere safe — without it, this file can't be decrypted, even by you.
          </p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            Bundles every project, its AWS credentials, runbooks, instance tags, and agent mode
            settings into one file, encrypted with the password below — so you can move everything to
            another device. Nothing is stored in plain text.
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
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Confirm password
            <input
              required
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              disabled={exporting}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
