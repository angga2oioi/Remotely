const RUN_RUNBOOK_TOOL = {
  type: 'function',
  function: {
    name: 'run_runbook',
    description:
      "Run a previously saved runbook against a specific EC2 instance, both taken from the lists given in context. Only call this when you're confident which instance and which runbook the user means.",
    parameters: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'The exact EC2 instance id to target, e.g. i-0123456789abcdef0' },
        runbookId: { type: 'string', description: 'The exact id of the runbook to run' },
        variables: {
          type: 'object',
          description:
            "Values for any {{variable}} placeholders the runbook's commands reference, keyed by variable name. Only fill in a value if the user's message actually specified it — omit anything you're not sure of so the app can ask the user directly.",
          additionalProperties: { type: 'string' }
        }
      },
      required: ['instanceId', 'runbookId']
    }
  }
}

function buildSystemPrompt(instances, runbooks) {
  const instanceList = instances
    .map((i) => {
      const awsTags = (i.tags ?? []).map((t) => `${t.Key}=${t.Value}`).join(', ')
      const appTags = (i.localTags ?? []).join(', ')
      return `- id=${i.id} name=${i.name ?? '(unnamed)'} state=${i.state} awsTags=[${awsTags}] appTags=[${appTags}]`
    })
    .join('\n')
  const runbookList = runbooks
    .map((r) => `- id=${r.id} name="${r.name}" commands=${JSON.stringify(r.commands)}`)
    .join('\n')

  return `You are an ops assistant embedded in a desktop app called Remotely. The user describes, in plain English, an action to take against one of their EC2 instances using a previously saved runbook (e.g. "restart nginx on the jenkins box").

Match their request to the single best instance (by name, tag, or id) and runbook (by name or what its commands do) from the lists below. Only the ids listed below are valid — never invent one.

If you find a confident, unambiguous match, call the run_runbook tool.
If nothing matches well, multiple instances/runbooks could plausibly match, or the request is unclear, do NOT call the tool — respond with plain text asking a clarifying question instead. Never guess when unsure, since this triggers a real action on real infrastructure.

Available EC2 instances:
${instanceList || '(none)'}

Available runbooks:
${runbookList || '(none)'}`
}

/**
 * Talks to whatever OpenAI-compatible chat/completions endpoint the user
 * configured (OpenAI, Azure OpenAI, OpenRouter, Ollama, vLLM, a LiteLLM
 * proxy, etc.) — nothing here is tied to one vendor.
 */
export const agentService = {
  /**
   * `messages` is the running chat history: [{role: 'user'|'assistant', content: string}].
   * Returns either {type: 'action', instanceId, runbookId, variables} (needs user confirmation
   * before executing) or {type: 'message', text} (a clarifying question or plain reply).
   */
  async interpret({ baseUrl, apiKey, model, messages, instances, runbooks }) {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: buildSystemPrompt(instances, runbooks) }, ...messages],
        tools: [RUN_RUNBOOK_TOOL],
        tool_choice: 'auto'
      })
    })

    const data = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(data?.error?.message || `Agent endpoint returned ${response.status}`)
    }

    const message = data?.choices?.[0]?.message
    const toolCall = message?.tool_calls?.[0]
    if (toolCall) {
      let args
      try {
        args = JSON.parse(toolCall.function.arguments)
      } catch {
        throw new Error('The model returned an invalid tool call.')
      }
      return {
        type: 'action',
        instanceId: args.instanceId,
        runbookId: args.runbookId,
        variables: args.variables ?? {}
      }
    }

    return { type: 'message', text: message?.content || "I'm not sure how to help with that." }
  }
}
