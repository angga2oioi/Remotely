import { app, BrowserWindow, session, shell } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerIpcHandlers } from './ipc/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL']

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // Keep external links (e.g. AWS console deep-links) out of the app shell.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && RENDERER_DEV_URL) {
    window.loadURL(RENDERER_DEV_URL)
  } else {
    window.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  // The renderer only ever talks to the main process over IPC, never
  // directly to AWS, so no remote connect-src is needed in production.
  // Dev mode is deliberately looser: Vite's dev server and React Fast
  // Refresh inject inline/eval'd scripts and use a WebSocket for HMR.
  const csp = isDev
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; connect-src 'self' ws: http: https:;"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })

  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
