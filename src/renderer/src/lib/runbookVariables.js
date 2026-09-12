const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

/** Unique {{variable}} names referenced across a runbook's commands, in first-seen order. */
export function extractVariables(commands) {
  const text = Array.isArray(commands) ? commands.join('\n') : commands
  const seen = new Set()
  const names = []
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const name = match[1]
    if (!seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }
  return names
}

/** Replaces every {{name}} occurrence across all commands with values[name]. */
export function applyVariables(commands, values) {
  return commands.map((line) =>
    line.replace(VARIABLE_PATTERN, (match, name) => (name in values ? values[name] : match))
  )
}
