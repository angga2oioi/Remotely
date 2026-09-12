import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import RunbookVariablesModal from './RunbookVariablesModal.jsx'
import { extractVariables, applyVariables } from '../lib/runbookVariables.js'

const emptySettingsForm = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }

export default function AgentChat({ projectId }) {
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [settings, setSettings] = useState(null) // null = not configured yet, once loaded
  const [showSettingsForm, setShowSettingsForm] = useState(false)
  const [settingsForm, setSettingsForm] = useState(emptySettingsForm)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState(null)

  const [instances, setInstances] = useState([])
  const [runbooks, setRunbooks] = useState([])

  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const [pendingVariables, setPendingVariables] = useState(null) // {index, missing}
  const [loadError, setLoadError] = useState(null)

  const bottomRef = useRef(null)

  useEffect(() => {
    window.api.agent
      .getSettings()
      .then((existing) => {
        setSettings(existing)
        if (existing) {
          setSettingsForm((prev) => ({ ...prev, baseUrl: existing.baseUrl ?? prev.baseUrl, model: existing.model ?? prev.model }))
        }
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setSettingsLoaded(true))
  }, [])

  useEffect(() => {
    Promise.all([window.api.ec2.listInstances(projectId), window.api.runbook.list(projectId)])
      .then(([instanceList, runbookList]) => {
        setInstances(instanceList)
        setRunbooks(runbookList)
      })
      .catch((err) => setLoadError(err.message))
  }, [projectId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function saveSettings(e) {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsError(null)
    try {
      const saved = await window.api.agent.saveSettings(settingsForm)
      setSettings(saved)
      setShowSettingsForm(false)
      setSettingsForm((prev) => ({ ...prev, apiKey: '' }))
    } catch (err) {
      setSettingsError(err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  function appendMessage(msg) {
    setMessages((prev) => [...prev, msg])
  }

  function historyForAgent(all) {
    return all.filter((m) => m.kind === 'text').map((m) => ({ role: m.role, content: m.text }))
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    const nextMessages = [...messages, { role: 'user', kind: 'text', text }]
    setMessages(nextMessages)
    setSending(true)
    try {
      const result = await window.api.agent.interpret(projectId, historyForAgent(nextMessages))
      if (result.type === 'message') {
        appendMessage({ role: 'assistant', kind: 'text', text: result.text })
        return
      }
      const instance = instances.find((i) => i.id === result.instanceId)
      const runbook = runbooks.find((r) => r.id === result.runbookId)
      if (!instance || !runbook) {
        appendMessage({
          role: 'assistant',
          kind: 'text',
          text: "I picked an instance or runbook that doesn't seem to exist anymore — can you rephrase?"
        })
        return
      }
      appendMessage({
        role: 'assistant',
        kind: 'action',
        status: 'pending',
        instance,
        runbook,
        variables: result.variables
      })
    } catch (err) {
      appendMessage({ role: 'assistant', kind: 'text', text: `Error: ${err.message}` })
    } finally {
      setSending(false)
    }
  }

  function setMessageStatus(index, status) {
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, status } : m)))
  }

  function confirmAction(index) {
    const msg = messages[index]
    const missing = extractVariables(msg.runbook.commands).filter((name) => !(name in msg.variables))
    if (missing.length > 0) {
      setPendingVariables({ index, missing })
      return
    }
    runAction(index, msg.variables)
  }

  function cancelAction(index) {
    setMessageStatus(index, 'cancelled')
  }

  async function runAction(index, variables) {
    setMessageStatus(index, 'running')
    const msg = messages[index]
    const commands = applyVariables(msg.runbook.commands, variables)
    let outcome
    try {
      outcome = await window.api.ssm.runAndWait(projectId, {
        instanceId: msg.instance.id,
        commands,
        comment: `Runbook "${msg.runbook.name}" via Remotely Agent`
      })
    } catch (err) {
      outcome = { status: 'Error', error: err.message }
    }
    setMessages((prev) => [
      ...prev.map((m, i) => (i === index ? { ...m, status: 'confirmed' } : m)),
      {
        role: 'assistant',
        kind: 'result',
        outcome,
        runbookName: msg.runbook.name,
        instanceName: msg.instance.name ?? msg.instance.id
      }
    ])
  }

  function handleVariablesSubmit(values) {
    const { index } = pendingVariables
    const msg = messages[index]
    setPendingVariables(null)
    runAction(index, { ...msg.variables, ...values })
  }

  if (!settingsLoaded) {
    return <p className="text-sm text-slate-400">Loading…</p>
  }

  if (loadError) {
    return <p className="text-sm text-red-400">Failed to load: {loadError}</p>
  }

  const configured = Boolean(settings?.hasApiKey)

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-100">Agent Mode</h2>
        {configured && (
          <button
            onClick={() => setShowSettingsForm(true)}
            className="text-xs font-medium text-slate-400 hover:text-slate-200"
          >
            Settings
          </button>
        )}
      </div>

      {!configured ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-md text-sm text-slate-400">
            Describe what you want in plain English (e.g. "restart nginx on the jenkins box") and the
            agent matches it to a saved runbook and instance, then asks you to confirm before running
            anything. Point it at any OpenAI-compatible endpoint — OpenAI, Azure OpenAI, OpenRouter,
            Ollama, vLLM, a LiteLLM proxy, whatever you already use.
          </p>
          <button
            onClick={() => setShowSettingsForm(true)}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Setup Agent
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">Try: "restart nginx on the jenkins box"</p>
            )}
            {messages.map((msg, index) => (
              <MessageBubble
                key={index}
                msg={msg}
                onConfirm={() => confirmAction(index)}
                onCancel={() => cancelAction(index)}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. restart nginx on the jenkins box"
              disabled={sending}
              className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {sending ? 'Thinking…' : 'Send'}
            </button>
          </form>
        </>
      )}

      {showSettingsForm && (
        <Modal title="Agent Settings" onClose={() => setShowSettingsForm(false)}>
          <p className="mb-3 text-xs text-slate-400">
            Credentials are stored encrypted and only ever leave this machine to call the endpoint you
            configure.
          </p>
          <form onSubmit={saveSettings} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Endpoint base URL
              <input
                required
                value={settingsForm.baseUrl}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.openai.com/v1"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              Model
              <input
                required
                value={settingsForm.model}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="gpt-4o-mini"
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-300">
              API key {configured && <span className="text-xs text-slate-500">(leave blank to keep the current one)</span>}
              <input
                type="password"
                value={settingsForm.apiKey}
                onChange={(e) => setSettingsForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder={configured ? '••••••••' : 'sk-...'}
                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100"
              />
            </label>
            {settingsError && <p className="text-sm text-red-400">{settingsError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSettingsForm(false)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingVariables && (
        <RunbookVariablesModal
          runbookName={messages[pendingVariables.index].runbook.name}
          variables={pendingVariables.missing}
          onCancel={() => setPendingVariables(null)}
          onSubmit={handleVariablesSubmit}
        />
      )}
    </section>
  )
}

function MessageBubble({ msg, onConfirm, onCancel }) {
  if (msg.kind === 'text') {
    return (
      <div
        className={
          msg.role === 'user'
            ? 'self-end rounded-lg bg-sky-600 px-3 py-2 text-sm text-white'
            : 'self-start rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-100'
        }
      >
        {msg.text}
      </div>
    )
  }

  if (msg.kind === 'action') {
    return (
      <div className="self-start rounded-lg border border-slate-600 bg-slate-900 p-3 text-sm text-slate-100">
        <p>
          Run <span className="font-semibold">"{msg.runbook.name}"</span> on{' '}
          <span className="font-semibold">{msg.instance.name ?? msg.instance.id}</span> ({msg.instance.id})?
        </p>
        {Object.keys(msg.variables).length > 0 && (
          <ul className="mt-1 text-xs text-slate-400">
            {Object.entries(msg.variables).map(([key, value]) => (
              <li key={key}>
                {key} = {value}
              </li>
            ))}
          </ul>
        )}
        {msg.status === 'pending' && (
          <div className="mt-2 flex gap-2">
            <button onClick={onCancel} className="rounded-md px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700">
              Cancel
            </button>
            <button onClick={onConfirm} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white hover:bg-sky-500">
              Confirm
            </button>
          </div>
        )}
        {msg.status === 'running' && <p className="mt-2 text-xs text-amber-400">Running…</p>}
        {msg.status === 'cancelled' && <p className="mt-2 text-xs text-slate-500">Cancelled.</p>}
        {msg.status === 'confirmed' && <p className="mt-2 text-xs text-emerald-400">Confirmed.</p>}
      </div>
    )
  }

  if (msg.kind === 'result') {
    return (
      <div className="self-start rounded-lg border border-slate-600 bg-slate-950 p-3 text-xs">
        <p className={msg.outcome.status === 'Success' ? 'font-medium text-emerald-400' : 'font-medium text-red-400'}>
          {msg.runbookName} on {msg.instanceName}: {msg.outcome.status}
        </p>
        {msg.outcome.output && <pre className="mt-1 whitespace-pre-wrap text-slate-300">{msg.outcome.output}</pre>}
        {msg.outcome.error && <pre className="mt-1 whitespace-pre-wrap text-red-400">{msg.outcome.error}</pre>}
      </div>
    )
  }

  return null
}
