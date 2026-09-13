const RUN_RUNBOOK_TOOL = {
  type: 'function',
  function: {
    name: 'run_runbook',
    description:
      "Run a previously saved runbook against a specific target (an EC2 instance or an SSH host, depending on the project), both taken from the lists given in context. Only call this when you're confident which target and which runbook the user means.",
    parameters: {
      type: 'object',
      properties: {
        instanceId: { type: 'string', description: 'The exact id of the target to run the runbook against' },
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

function describeResource(resource, resourceType) {
  if (resourceType === 'ssh') {
    return `- id=${resource.id} name=${resource.name} connection=${resource.username}@${resource.host}:${resource.port}`
  }
  const awsTags = (resource.tags ?? []).map((t) => `${t.Key}=${t.Value}`).join(', ')
  const appTags = (resource.localTags ?? []).join(', ')
  return `- id=${resource.id} name=${resource.name ?? '(unnamed)'} state=${resource.state} awsTags=[${awsTags}] appTags=[${appTags}]`
}

function buildSystemPrompt(resources, runbooks, resourceType) {
  const resourceLabel = resourceType === 'ssh' ? 'SSH targets' : 'EC2 instances'
  const resourceList = resources.map((r) => describeResource(r, resourceType)).join('\n')
  const runbookList = runbooks
    .map((r) => `- id=${r.id} name="${r.name}" commands=${JSON.stringify(r.commands)}`)
    .join('\n')

  return `You are an ops assistant embedded in a desktop app called Remotely. The user describes, in plain English, an action to take against one of their ${resourceLabel} using a previously saved runbook (e.g. "restart nginx on the jenkins box").

Match their request to the single best target (by name, tag, or id) and runbook (by name or what its commands do) from the lists below. Only the ids listed below are valid — never invent one.

If you find a confident, unambiguous match, call the run_runbook tool.
If nothing matches well, multiple targets/runbooks could plausibly match, or the request is unclear, do NOT call the tool — respond with plain text asking a clarifying question instead. Never guess when unsure, since this triggers a real action on real infrastructure.

Available ${resourceLabel}:
${resourceList || '(none)'}

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
   * `resourceType` is the project's type ('aws' or 'ssh'), which only changes how the
   * target list is described to the model — the tool call shape stays the same.
   * Returns either {type: 'action', instanceId, runbookId, variables} (needs user confirmation
   * before executing) or {type: 'message', text} (a clarifying question or plain reply).
   */
  async interpret({ baseUrl, apiKey, model, messages, instances, runbooks, resourceType }) {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: buildSystemPrompt(instances, runbooks, resourceType) }, ...messages],
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
