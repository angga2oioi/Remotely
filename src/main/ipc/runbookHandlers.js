import { ipcMain, dialog, clipboard, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { runbookStore } from '../store/runbookStore.js'

const RUNBOOK_SCHEMA = 'remotely.runbook.v1'

function isValidRunbookEntry(entry) {
  return (
    entry &&
    typeof entry.name === 'string' &&
    entry.name.trim().length > 0 &&
    Array.isArray(entry.commands) &&
    entry.commands.length > 0 &&
    entry.commands.every((c) => typeof c === 'string')
  )
}

function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'runbook'
}

export function registerRunbookHandlers() {
  ipcMain.handle('runbook:list', () => runbookStore.list())

  ipcMain.handle('runbook:create', (_event, { name, commands }) => runbookStore.create({ name, commands }))

  ipcMain.handle('runbook:update', (_event, id, patch) => runbookStore.update(id, patch))

  ipcMain.handle('runbook:delete', (_event, id) => runbookStore.remove(id))

  // Writes a portable {schema, name, commands} JSON file that can be sent to
  // a teammate or checked into a repo — no project id or AWS credentials
  // are ever included.
  ipcMain.handle('runbook:export', async (event, runbook) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePath } = await dialog.showSaveDialog(window, {
      title: 'Export Runbook',
      defaultPath: `${slugify(runbook.name)}.runbook.json`,
      filters: [{ name: 'Remotely Runbook', extensions: ['json'] }]
    })
    if (canceled || !filePath) return { canceled: true }

    const payload = { schema: RUNBOOK_SCHEMA, name: runbook.name, commands: runbook.commands }
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2))
    return { canceled: false, filePath }
  })

  // Accepts one or more runbook JSON files (each a single object or an
  // array of them) and adds them to the global runbook library.
  ipcMain.handle('runbook:importFromFile', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import Runbook',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Remotely Runbook', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return []

    const imported = []
    for (const filePath of filePaths) {
      const raw = await fs.readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      const entries = Array.isArray(parsed) ? parsed : [parsed]
      for (const entry of entries) {
        if (!isValidRunbookEntry(entry)) continue
        imported.push(await runbookStore.create({ name: entry.name, commands: entry.commands }))
      }
    }
    return imported
  })

  // Copies a runbook as JSON text to the system clipboard, for pasting into
  // chat/email without going through a file.
  ipcMain.handle('runbook:copyToClipboard', (_event, runbook) => {
    clipboard.writeText(
      JSON.stringify({ schema: RUNBOOK_SCHEMA, name: runbook.name, commands: runbook.commands }, null, 2)
    )
    return true
  })

  // Reads runbook JSON (single object or array) off the system clipboard
  // and adds it to the global runbook library.
  ipcMain.handle('runbook:importFromClipboard', async () => {
    const text = clipboard.readText()
    if (!text.trim()) return []
    const parsed = JSON.parse(text)
    const entries = Array.isArray(parsed) ? parsed : [parsed]
    const imported = []
    for (const entry of entries) {
      if (!isValidRunbookEntry(entry)) continue
      imported.push(await runbookStore.create({ name: entry.name, commands: entry.commands }))
    }
    return imported
  })
}
