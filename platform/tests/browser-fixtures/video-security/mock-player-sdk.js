/* Test-only Player.js API double. Not Bunny's player, CDN, token validation or DRM. */
;(() => {
  const players = []
  window.__mockBunnyPlayers = players
  window.playerjs = {
    Player: function Player(iframe) {
      const handlers = new Map()
      const state = { seconds: 0, paused: true, iframe, seekCalls: [], playCalls: 0, pauseCalls: 0 }
      this.__state = state
      this.on = (event, callback) => {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event).add(callback)
        if (event === 'ready') setTimeout(() => callback(), 0)
      }
      this.off = (event, callback) => {
        if (callback) handlers.get(event)?.delete(callback)
        else handlers.delete(event)
      }
      this.getCurrentTime = (callback) => setTimeout(() => callback(state.seconds), 0)
      this.setCurrentTime = (seconds) => { state.seconds = seconds; state.seekCalls.push(seconds) }
      this.getPaused = (callback) => setTimeout(() => callback(state.paused), 0)
      this.getDuration = (callback) => setTimeout(() => callback(5400), 0)
      this.play = () => { state.paused = false; state.playCalls += 1 }
      this.pause = () => { state.paused = true; state.pauseCalls += 1 }
      this.supports = (_kind, _name, callback) => callback?.(true)
      this.__emit = (event, data) => {
        if (event === 'timeupdate') state.seconds = data.seconds
        for (const callback of handlers.get(event) ?? []) callback(data)
      }
      players.push(this)
    }
  }
})()
