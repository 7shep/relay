const DEFAULT_MODEL = 'luna-5.6'

// The browser only talks to a local companion bridge. Credentials never belong in localStorage.
export function createLunaProvider({ endpoint = import.meta.env.VITE_LUNA_BRIDGE_URL, model = DEFAULT_MODEL } = {}) {
  const configured = Boolean(endpoint)
  return {
    model,
    provider: 'Luna 5.6',
    health: () => ({ status: configured ? 'ready' : 'not configured', endpointConfigured: configured }),
    async run({ agent, context, signal, onEvent }) {
      if (!configured) throw new Error('Luna bridge is not configured. Set VITE_LUNA_BRIDGE_URL in the local companion environment.')
      const response = await fetch(`${endpoint.replace(/\/$/, '')}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({ model, agent, context, stream: true }),
      })
      if (!response.ok) throw new Error(`Luna bridge returned ${response.status}`)
      if (!response.body) return response.json()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result = null
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        lines.forEach((line) => {
          if (!line.trim()) return
          const event = JSON.parse(line)
          result = event.result || result
          onEvent?.(event)
        })
        if (done) break
      }
      if (buffer.trim()) {
        const event = JSON.parse(buffer)
        result = event.result || result
        onEvent?.(event)
      }
      return result
    },
  }
}
