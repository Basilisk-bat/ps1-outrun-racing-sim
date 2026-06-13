export interface InputState {
  accelerate: boolean
  brake: boolean
  steer: -1 | 0 | 1
  reset: boolean
}

export interface InputController {
  state: InputState
  dispose: () => void
  consumeReset: () => boolean
}

const KEY_BINDINGS: Record<string, keyof Omit<InputState, 'steer'>> = {
  ArrowUp: 'accelerate',
  KeyW: 'accelerate',
  ArrowDown: 'brake',
  KeyS: 'brake',
  KeyR: 'reset',
}

export function createInputState(): InputState {
  return {
    accelerate: false,
    brake: false,
    steer: 0,
    reset: false,
  }
}

export function createInputController(target: Window = window): InputController {
  const state = createInputState()
  const pressed = new Set<string>()

  const syncSteer = () => {
    const left = pressed.has('ArrowLeft') || pressed.has('KeyA')
    const right = pressed.has('ArrowRight') || pressed.has('KeyD')
    state.steer = left === right ? 0 : left ? -1 : 1
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) {
      return
    }

    pressed.add(event.code)
    syncSteer()

    const action = KEY_BINDINGS[event.code]
    if (action) {
      state[action] = true
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    pressed.delete(event.code)
    syncSteer()

    const action = KEY_BINDINGS[event.code]
    if (action && action !== 'reset') {
      state[action] = false
    }
  }

  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)

  return {
    state,
    dispose: () => {
      target.removeEventListener('keydown', onKeyDown)
      target.removeEventListener('keyup', onKeyUp)
    },
    consumeReset: () => {
      const shouldReset = state.reset
      state.reset = false
      pressed.delete('KeyR')
      return shouldReset
    },
  }
}
