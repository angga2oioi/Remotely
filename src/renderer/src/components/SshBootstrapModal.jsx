import { useState } from 'react'
import Modal from './Modal.jsx'

export default function SshBootstrapModal({ instance, projectId, onClose, onInstanceChanged }) {
  const [host, setHost] = useState(instance.publicIp || instance.privateIp || '')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('ec2-user')
  const [keyPath, setKeyPath] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [running, setRunning] = useState(false)
  const [roleStatus, setRoleStatus] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function pickKey() {
    const path = await window.api.ssh.pickKeyFile()
    if (path) setKeyPath(path)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setRunning(true)
    setError(null)
    setResult(null)
    setRoleStatus(null)

    // Do this first: an agent that starts before a role exists won't pick
    // up credentials just because a role shows up later — it needs a
    // restart, which the SSH step below always does anyway. Attaching the
    // role before that restart means one click covers both fixes in the
    // right order, instead of the user having to know the order matters.
    if (!instance.iamInstanceProfileArn) {
      try {
        await window.api.ec2.attachSsmRole(projectId, instance.id)
        setRoleStatus({ ok: true, message: 'IAM role attached.' })
      } catch (err) {
        setRoleStatus({ ok: false, message: `Could not attach IAM role: ${err.message}` })
      }
    }

    try {
      const outcome = await window.api.ssh.bootstrapSsm({
        host,
        port: Number(port) || 22,
        username,
        privateKeyPath: keyPath,
        passphrase: passphrase || undefined
      })
      setResult(outcome)
    } catch (err) {
      setError(err.message)
    } finally {
      setRunning(false)
      await onInstanceChanged()
    }
  }

  return (
    <Modal title={`Bootstrap SSM Agent on ${instance.name ?? instance.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-slate-400">
          Attaches an IAM role with SSM permissions if this instance doesn't have one yet, then connects
          once over SSH with your key to install/restart the SSM Agent — one click covers both, in the
          right order, so future runbooks go through AWS Systems Manager instead of SSH. Best-effort for
          Amazon Linux, Ubuntu/Debian, and RHEL-family distros — the key never leaves your machine or
          gets saved by this app.
        </p>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Host
          <input
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm text-slate-300">
            Username
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ec2-user / ubuntu / admin"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <label className="flex w-20 flex-col gap-1 text-sm text-slate-300">
            Port
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-300">
          Private key
          <div className="flex gap-2">
            <input
              readOnly
              value={keyPath}
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
          Passphrase (only if the key is encrypted)
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
        </label>

        {roleStatus && (
          <p className={`text-sm ${roleStatus.ok ? 'text-emerald-400' : 'text-red-400'}`}>{roleStatus.message}</p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {result && (
          <div className="rounded-md border border-slate-700 bg-slate-950 p-2 text-xs">
            <p className={result.exitCode === 0 ? 'font-medium text-emerald-400' : 'font-medium text-red-400'}>
              Exit code {result.exitCode}
            </p>
            {result.stdout && <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-slate-300">{result.stdout}</pre>}
            {result.stderr && <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
          </div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={running || !keyPath}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run Bootstrap'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
