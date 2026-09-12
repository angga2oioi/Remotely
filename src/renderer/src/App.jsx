import { useEffect, useState } from 'react'
import ProjectForm from './components/ProjectForm.jsx'
import ProjectSwitcher from './components/ProjectSwitcher.jsx'
import Ec2List from './components/Ec2List.jsx'
import RunbookManager from './components/RunbookManager.jsx'
import AgentChat from './components/AgentChat.jsx'
import ExportBackupModal from './components/ExportBackupModal.jsx'
import ImportBackupModal from './components/ImportBackupModal.jsx'

const VIEWS = {
  instances: { label: 'EC2 Instances', Component: Ec2List },
  runbooks: { label: 'Runbooks', Component: RunbookManager },
  agent: { label: 'Agent Mode', Component: AgentChat }
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [activeView, setActiveView] = useState('instances')
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [bootError, setBootError] = useState(null)

  useEffect(() => {
    if (!window.api) {
      setBootError('window.api is unavailable — the preload script did not load.')
      setLoading(false)
      return
    }
    window.api.project
      .list()
      .then((list) => {
        setProjects(list)
        if (list.length > 0) setSelectedProjectId(list[0].id)
        else setShowProjectForm(true)
      })
      .catch((err) => setBootError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function handleProjectCreated(project) {
    setProjects((prev) => [...prev, project])
    setSelectedProjectId(project.id)
    setShowProjectForm(false)
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400">Loading…</div>
  }

  if (bootError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-6 text-center text-red-400">
        Failed to start: {bootError}
      </div>
    )
  }

  const { Component } = VIEWS[activeView]

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100">
      <nav className="flex w-64 shrink-0 flex-col gap-6 border-r border-slate-800 bg-slate-950 p-4">
        <h1 className="text-xl font-bold tracking-tight">Remotely</h1>

        <ProjectSwitcher
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onNewProject={() => setShowProjectForm(true)}
        />

        {selectedProjectId && (
          <ul className="flex flex-col gap-1">
            {Object.entries(VIEWS).map(([key, view]) => (
              <li key={key}>
                <button
                  onClick={() => setActiveView(key)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    activeView === key ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {view.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-col gap-1 border-t border-slate-800 pt-4">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">Backup</p>
          <button
            onClick={() => setShowExportModal(true)}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Export All Settings…
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Import All Settings…
          </button>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto p-6">
        {showProjectForm ? (
          <ProjectForm
            onCreated={handleProjectCreated}
            onCancel={projects.length > 0 ? () => setShowProjectForm(false) : undefined}
          />
        ) : selectedProjectId ? (
          <Component projectId={selectedProjectId} />
        ) : null}
      </main>

      {showExportModal && <ExportBackupModal onClose={() => setShowExportModal(false)} />}
      {showImportModal && (
        <ImportBackupModal
          onClose={() => setShowImportModal(false)}
          onImported={() => window.location.reload()}
        />
      )}
    </div>
  )
}
