import { useState } from 'react'
import Modal from './Modal.jsx'

export default function RunbookVariablesModal({ runbookName, variables, onCancel, onSubmit }) {
  const [values, setValues] = useState(() => Object.fromEntries(variables.map((name) => [name, ''])))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <Modal title={`Run "${runbookName}"`} onClose={onCancel}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <p className="text-xs text-slate-400">This runbook needs a value for each variable before it can run.</p>

        {variables.map((name, index) => (
          <label key={name} className="flex flex-col gap-1 text-sm text-slate-300">
            {name}
            <input
              required
              autoFocus={index === 0}
              value={values[name]}
              onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </label>
        ))}

        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500"
          >
            Run
          </button>
        </div>
      </form>
    </Modal>
  )
}
