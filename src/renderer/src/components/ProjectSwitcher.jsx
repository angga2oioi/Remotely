export default function ProjectSwitcher({ projects, selectedProjectId, onSelect, onNewProject }) {
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
      <button
        onClick={onNewProject}
        className="w-full rounded-md border border-dashed border-slate-700 px-2 py-1.5 text-xs font-medium text-slate-400 hover:border-sky-500 hover:text-sky-400"
      >
        + New Project
      </button>
    </div>
  )
}
