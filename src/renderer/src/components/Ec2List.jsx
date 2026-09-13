import { useEffect, useMemo, useState } from 'react'
import InstanceRow from './InstanceRow.jsx'

export default function Ec2List({ projectId }) {
  const [instances, setInstances] = useState([])
  const [runbooks, setRunbooks] = useState([])
  const [tagsByInstance, setTagsByInstance] = useState({})
  const [managedInstanceIds, setManagedInstanceIds] = useState(null) // null = unknown, don't gate on it
  const [tagFilter, setTagFilter] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [instanceList, runbookList, tagMap] = await Promise.all([
        window.api.ec2.listInstances(projectId),
        window.api.runbook.list(),
        window.api.instanceTag.listForProject(projectId)
      ])
      setInstances(instanceList)
      setRunbooks(runbookList)
      setTagsByInstance(tagMap)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }

    // Best-effort: an instance can be "running" in EC2 but not registered
    // with SSM (no agent, no instance IAM profile, no network path), which
    // makes Run Command fail. Don't block the whole list if this errors —
    // e.g. missing ssm:DescribeInstanceInformation permission — just skip
    // the upfront check in that case.
    try {
      setManagedInstanceIds(new Set(await window.api.ssm.listManagedInstanceIds(projectId)))
    } catch {
      setManagedInstanceIds(null)
    }
  }

  async function refreshTagsOnly() {
    setTagsByInstance(await window.api.instanceTag.listForProject(projectId))
  }

  useEffect(() => {
    refresh()
  }, [projectId])

  const visibleInstances = useMemo(() => {
    const filter = tagFilter.trim().toLowerCase()
    if (!filter) return instances
    return instances.filter((instance) =>
      (tagsByInstance[instance.id] ?? []).some((tag) => tag.toLowerCase().includes(filter))
    )
  }, [instances, tagsByInstance, tagFilter])

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">EC2 Instances</h2>
        <div className="flex items-center gap-2">
          <input
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter by tag…"
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          />
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="min-w-full divide-y divide-slate-700 text-sm">
          <thead className="bg-slate-800 text-left text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Instance ID</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">State</th>
              <th className="px-4 py-2">Private IP</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {visibleInstances.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                projectId={projectId}
                tags={tagsByInstance[instance.id] ?? []}
                runbooks={runbooks}
                isManaged={managedInstanceIds ? managedInstanceIds.has(instance.id) : true}
                onTagsChanged={refreshTagsOnly}
                onInstanceChanged={refresh}
              />
            ))}
            {visibleInstances.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {instances.length === 0 ? 'No instances found for this project.' : 'No instances match that tag.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
