import { useState } from 'react'
import Modal from './Modal.jsx'

const emptyForm = { name: '', host: '', port: '22', username: '', privateKeyPath: '', passphrase: '' }

export default function SshTargetForm({ projectId, target, onClose, onSaved }) {
  const [form, setForm] = useState(
    target
      ? {
          name: target.name,
          host: target.host,
          port: String(target.port ?? 22),
          username: target.username,
          privateKeyPath: target.privateKeyPath,
          passphrase: ''
        }
      : emptyForm
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function pickKey() {
    const path = await window.api.ssh.pickKeyFile()
    if (path) setForm((prev) => ({ ...prev, privateKeyPath: path }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        host: form.host,
        port: Number(form.port) || 22,
        username: form.username,
        privateKeyPath: form.privateKeyPath,
        ...(form.passphrase ? { passphrase: form.passphrase } : {})
      }
      if (target) {
        await window.api.sshTarget.update(projectId, target.id, payload)
      } else {
        await window.api.sshTarget.add(projectId, payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={target ? 'Edit Target' : 'Add Target'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Name
          <input
            required
            autoFocus
            value={form.name}
            onChange={update('name')}
            placeholder="db-primary"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
            Host
            <input
              required
              value={form.host}
              onChange={update('host')}
              placeholder="10.0.1.23 or db.example.com"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex w-20 flex-col gap-1 text-sm text-slate-300">
            Port
            <input
              value={form.port}
              onChange={update('port')}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Username
          <input
            required
            value={form.username}
            onChange={update('username')}
            placeholder="ubuntu / ec2-user / root"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Private key
          <div className="flex gap-2">
            <input
              readOnly
              value={form.privateKeyPath}
              placeholder="No file selected"
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-400"
            />
            <button
              type="button"
              onClick={pickKey}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Browse…
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Passphrase{' '}
          {target?.hasPassphrase && <span className="text-xs text-slate-500">(leave blank to keep the current one)</span>}
          <input
            type="password"
            value={form.passphrase}
            onChange={update('passphrase')}
            placeholder={target?.hasPassphrase ? '••••••••' : 'only if the key is encrypted'}
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
            disabled={saving || !form.privateKeyPath}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
