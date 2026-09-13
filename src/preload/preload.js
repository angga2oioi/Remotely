import { contextBridge, ipcRenderer } from 'electron'

/**
 * Only these explicit, whitelisted channels are reachable from the renderer.
 * ipcRenderer itself is never exposed, so the UI cannot invoke arbitrary
 * main-process channels or listen on ones it wasn't given. Raw AWS
 * credentials never cross this bridge — only project ids do.
 */
const api = {
  project: {
    list: () => ipcRenderer.invoke('project:list'),
    create: (input) => ipcRenderer.invoke('project:create', input),
    rename: (id, name) => ipcRenderer.invoke('project:rename', id, name),
    updateCredentials: (id, credentials) =>
      ipcRenderer.invoke('project:updateCredentials', id, credentials),
    hasCredentials: (id) => ipcRenderer.invoke('project:hasCredentials', id),
    delete: (id) => ipcRenderer.invoke('project:delete', id)
  },
  runbook: {
    list: () => ipcRenderer.invoke('runbook:list'),
    create: (input) => ipcRenderer.invoke('runbook:create', input),
    update: (id, patch) => ipcRenderer.invoke('runbook:update', id, patch),
    delete: (id) => ipcRenderer.invoke('runbook:delete', id),
    export: (runbook) => ipcRenderer.invoke('runbook:export', runbook),
    importFromFile: () => ipcRenderer.invoke('runbook:importFromFile'),
    copyToClipboard: (runbook) => ipcRenderer.invoke('runbook:copyToClipboard', runbook),
    importFromClipboard: () => ipcRenderer.invoke('runbook:importFromClipboard')
  },
  ec2: {
    listInstances: (projectId) => ipcRenderer.invoke('ec2:listInstances', projectId),
    startInstance: (projectId, instanceId) => ipcRenderer.invoke('ec2:startInstance', projectId, instanceId),
    stopInstance: (projectId, instanceId) => ipcRenderer.invoke('ec2:stopInstance', projectId, instanceId),
    attachSsmRole: (projectId, instanceId) => ipcRenderer.invoke('ec2:attachSsmRole', projectId, instanceId)
  },
  ssm: {
    runAndWait: (projectId, payload) => ipcRenderer.invoke('ssm:runAndWait', projectId, payload),
    listManagedInstanceIds: (projectId) => ipcRenderer.invoke('ssm:listManagedInstanceIds', projectId)
  },
  instanceTag: {
    listForProject: (projectId) => ipcRenderer.invoke('instanceTag:listForProject', projectId),
    add: (projectId, instanceId, tag) => ipcRenderer.invoke('instanceTag:add', projectId, instanceId, tag),
    remove: (projectId, instanceId, tag) => ipcRenderer.invoke('instanceTag:remove', projectId, instanceId, tag)
  },
  ssh: {
    pickKeyFile: () => ipcRenderer.invoke('ssh:pickKeyFile'),
    bootstrapSsm: (params) => ipcRenderer.invoke('ssh:bootstrapSsm', params)
  },
  sshTarget: {
    list: (projectId) => ipcRenderer.invoke('sshTarget:list', projectId),
    add: (projectId, target) => ipcRenderer.invoke('sshTarget:add', projectId, target),
    update: (projectId, targetId, patch) => ipcRenderer.invoke('sshTarget:update', projectId, targetId, patch),
    remove: (projectId, targetId) => ipcRenderer.invoke('sshTarget:remove', projectId, targetId),
    runAndWait: (projectId, payload) => ipcRenderer.invoke('sshTarget:runAndWait', projectId, payload)
  },
  agent: {
    getSettings: () => ipcRenderer.invoke('agent:getSettings'),
    saveSettings: (settings) => ipcRenderer.invoke('agent:saveSettings', settings),
    interpret: (projectId, messages) => ipcRenderer.invoke('agent:interpret', projectId, messages)
  },
  backup: {
    export: (password) => ipcRenderer.invoke('backup:export', password),
    import: (password) => ipcRenderer.invoke('backup:import', password)
  }
}

contextBridge.exposeInMainWorld('api', api)
