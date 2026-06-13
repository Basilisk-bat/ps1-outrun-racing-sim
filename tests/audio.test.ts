import { describe, expect, it, vi } from 'vitest'
import { createArcadeAudio } from '../src/game/audio.ts'
import { RacingSim } from '../src/game/sim.ts'

class FakeAudioParam {
  value = 0
  readonly targets: number[] = []

  setValueAtTime(value: number, _startTime: number): AudioParam {
    this.value = value
    return this as unknown as AudioParam
  }

  exponentialRampToValueAtTime(value: number, _endTime: number): AudioParam {
    this.value = value
    return this as unknown as AudioParam
  }

  setTargetAtTime(value: number, _startTime: number, _timeConstant: number): AudioParam {
    this.value = value
    this.targets.push(value)
    return this as unknown as AudioParam
  }
}

class FakeGain {
  readonly gainParam = new FakeAudioParam()
  readonly gain = this.gainParam as unknown as AudioParam
  readonly connect = vi.fn((_destination: AudioNode) => undefined)
}

class FakeBiquadFilter {
  type: BiquadFilterType = 'lowpass'
  readonly frequencyParam = new FakeAudioParam()
  readonly qParam = new FakeAudioParam()
  readonly frequency = this.frequencyParam as unknown as AudioParam
  readonly Q = this.qParam as unknown as AudioParam
  readonly connect = vi.fn((_destination: AudioNode) => undefined)
}

class FakeOscillator {
  type: OscillatorType = 'sine'
  readonly frequencyParam = new FakeAudioParam()
  readonly frequency = this.frequencyParam as unknown as AudioParam
  readonly connect = vi.fn((_destination: AudioNode) => undefined)
  readonly start = vi.fn()
  readonly stop = vi.fn((_when?: number) => undefined)
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = []

  currentTime = 1
  readonly destination = {} as AudioDestinationNode
  readonly gains: FakeGain[] = []
  readonly filters: FakeBiquadFilter[] = []
  readonly oscillators: FakeOscillator[] = []
  readonly resume = vi.fn(() => Promise.resolve())
  readonly close = vi.fn(() => Promise.resolve())

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createGain(): GainNode {
    const gain = new FakeGain()
    this.gains.push(gain)
    return gain as unknown as GainNode
  }

  createBiquadFilter(): BiquadFilterNode {
    const filter = new FakeBiquadFilter()
    this.filters.push(filter)
    return filter as unknown as BiquadFilterNode
  }

  createOscillator(): OscillatorNode {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator as unknown as OscillatorNode
  }
}

describe('arcade audio', () => {
  it('stays inert when Web Audio is unavailable', () => {
    const { target } = createTarget()
    const audio = createArcadeAudio(target)

    expect(() => audio.update(new RacingSim().snapshot())).not.toThrow()
    expect(() => audio.dispose()).not.toThrow()
  })

  it('lazily unlocks the engine loop and reacts to gameplay cues', () => {
    FakeAudioContext.instances = []
    const { target, listeners } = createTarget(FakeAudioContext as unknown as typeof AudioContext)
    const audio = createArcadeAudio(target)
    const snapshot = new RacingSim().snapshot()

    snapshot.car.speed = 84
    snapshot.car.drift = 0.32
    snapshot.car.boostActive = true
    snapshot.telemetry.checkpointSplits.push({
      checkpointIndex: 0,
      lap: 1,
      checkpointDistance: 200,
      sectionId: 'sunset-gate',
      sectionTitle: 'Sunset Gate',
      targetSeconds: 4.2,
      actualSeconds: 4,
      deltaSeconds: -0.2,
      grade: 'gold',
      score: 1000,
      cumulativeScore: 1000,
      collisionPenalty: 0,
      offroadPenaltySeconds: 0,
    })
    snapshot.traffic.nearMissCount = 1

    audio.update(snapshot)
    expect(FakeAudioContext.instances).toHaveLength(0)

    fireListener(listeners, 'keydown')
    expect(FakeAudioContext.instances).toHaveLength(1)
    const context = FakeAudioContext.instances[0]
    expect(context.resume).toHaveBeenCalledTimes(1)

    audio.update(snapshot)

    expect(context.oscillators[0].frequencyParam.targets.at(-1)).toBeGreaterThan(250)
    expect(context.filters[0].frequencyParam.targets.at(-1)).toBeGreaterThan(1000)
    expect(context.oscillators.length).toBeGreaterThan(4)

    audio.dispose()
    expect(context.oscillators[0].stop).toHaveBeenCalled()
    expect(context.close).toHaveBeenCalled()
  })
})

function createTarget(audioContextCtor?: typeof AudioContext): {
  target: Window
  listeners: Map<string, EventListenerOrEventListenerObject>
} {
  const listeners = new Map<string, EventListenerOrEventListenerObject>()
  const target = {
    AudioContext: audioContextCtor,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.set(type, listener)
    }),
    removeEventListener: vi.fn((_type: string, _listener: EventListenerOrEventListenerObject) => undefined),
  }

  return {
    target: target as unknown as Window,
    listeners,
  }
}

function fireListener(
  listeners: Map<string, EventListenerOrEventListenerObject>,
  type: string,
): void {
  const listener = listeners.get(type)
  if (!listener) {
    throw new Error(`Missing ${type} listener`)
  }

  const event = { type } as Event
  if (typeof listener === 'function') {
    listener(event)
  } else {
    listener.handleEvent(event)
  }
}
