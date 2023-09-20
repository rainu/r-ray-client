type ServerConfig = {
  headerPrefix: string
  forwardRequestHeaderPrefix: string,
  forwardResponseHeaderPrefix: string,
  forwardResponseStatusHeader: string,
  statusHeader: string
}

type Client = {
  config: ServerConfig | null
  baseUrl: string
  loadConfig: () => Promise<void>
  extractHeader: (response: Response, name: string) => string | null
  fetch: typeof fetch
}

export const client = (url: string, username?: string, password?: string): Client => {
  return {
    config: null,
    baseUrl: url.replace(/\/$/, ''),

    loadConfig() {
      return fetch(`${this.baseUrl}/.meta`).then(r => r.json()).then(meta => {
        this.config = meta
      })
    },

    extractHeader(response: Response, name: string): string | null {
      return response.headers.get(this.config?.headerPrefix + name)
    },

    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {

      // first contact - read configuration from proxy
      if (!this.config) {
        await this.loadConfig()
      }
      if (!this.config) {
        return Promise.reject("unable to load config")
      }

      const headerPrefix = this.config.headerPrefix

      let realInput = `${this.baseUrl}/${input.toString()}`
      let realInit: RequestInit = {}

      if (init) {
        realInit = {
          ...init,
        }

        let realHeaders = new Headers()

        //transfer headers
        new Headers(init.headers).forEach((v, k, p) => {
          realHeaders.append(`${headerPrefix}${k}`, v)
        })

        realInit.headers = realHeaders
      } else {
        realInit.headers = new Headers()
      }

      // forward response status
      realInit.headers.set(this.config.forwardResponseStatusHeader, '1')

      // forward browser headers to target
      realInit.headers.set(this.config.forwardRequestHeaderPrefix + '0', '^accept.*$')
      realInit.headers.set(this.config.forwardRequestHeaderPrefix + '1', '^content-.*$')
      realInit.headers.set(this.config.forwardRequestHeaderPrefix + '2', '^user-agent$')

      // let forward the targets header directly (without any prefix)
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '0', '^accept-.*$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '1', '^age$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '2', '^content-.*$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '3', '^cache-control$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '4', '^date$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '5', '^expires$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '6', '^last-modified$')
      realInit.headers.set(this.config.forwardResponseHeaderPrefix + '7', '^vary$')

      if (username) {
        let credentials = btoa(`${username}:${password}`)
        realInit.headers.set("Authorization", `Basic ${credentials}`)
      }

      const statusHeader = this.config.statusHeader.toLowerCase()

      return fetch(realInput, realInit).then((response): Response => {

        //transfer headers/status
        let realHeaders = new Headers()
        let status = response.status
        let statusText = response.statusText
        const lHeaderPrefix = headerPrefix.toLowerCase()

        response.headers.forEach((v, k, p) => {
          if (k.startsWith(lHeaderPrefix)) {
            if (k === statusHeader) {
              let parts = v.split(" ")
              status = Number.parseInt(parts[1])
              statusText = parts.slice(2).join(" ")
            } else {
              realHeaders.append(k, v)
              realHeaders.append(k.substring(headerPrefix.length), v)
            }
          }
        })

        return new Response(response.body, {
          headers: realHeaders,
          status,
          statusText
        })
      })
    }
  }
}