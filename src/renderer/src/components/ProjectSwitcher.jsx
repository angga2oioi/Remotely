import { useState } from 'react'
import Modal from './Modal.jsx'

export default function ProjectSwitcher({ projects, selectedProjectId, onSelect, onNewProject, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await window.api.project.delete(selectedProjectId)
      setConfirming(false)
      onDeleted(selectedProjectId)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</label>
      <select
        value={selectedProjectId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={onNewProject}
          className="flex-1 rounded-md border border-dashed border-slate-700 px-2 py-1.5 text-xs font-medium text-slate-400 hover:border-sky-500 hover:text-sky-400"
        >
          + New Project
        </button>
        {selectedProject && (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-md border border-slate-700 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-slate-800"
          >
            Delete
          </button>
        )}
      </div>

      {confirming && (
        <Modal title={`Delete "${selectedProject?.name}"?`} onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-amber-400">
              This removes the project and{' '}
              {selectedProject?.type === 'ssh' ? 'its saved SSH targets' : 'its AWS credentials'} from this
              device. Runbooks aren't affected — they're shared across all projects. This can't be undone.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete Project'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
