import type { RacingSnapshot } from './sim.ts'

export interface ArcadeAudio {
  update: (snapshot: RacingSnapshot) => void
  dispose: () => void
}

type WindowWithAudioContext = Window & {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
}

export function createArcadeAudio(target: Window = window): ArcadeAudio {
  let context: AudioContext | undefined
  let engineOscillator: OscillatorNode | undefined
  let engineGain: GainNode | undefined
  let engineFilter: BiquadFilterNode | undefined
  let masterGain: GainNode | undefined
  let lastCheckpointCount = 0
  let lastNearMissCount = 0
  let lastHitCount = 0
  let lastBoostActive = false
  let announcedTimeOver = false

  const unlock = () => {
    const audioContext = ensureContext()
    void audioContext?.resume()
  }

  const ensureContext = () => {
    if (context) {
      return context
    }

    const audioTarget = target as WindowWithAudioContext
    const AudioContextCtor = audioTarget.AudioContext ?? audioTarget.webkitAudioContext
    if (!AudioContextCtor) {
      return undefined
    }

    const audioContext = new AudioContextCtor()
    context = audioContext
    masterGain = audioContext.createGain()
    masterGain.gain.value = 0.18
    masterGain.connect(audioContext.destination)

    engineFilter = audioContext.createBiquadFilter()
    engineFilter.type = 'lowpass'
    engineFilter.frequency.value = 520
    engineFilter.Q.value = 0.7

    engineGain = audioContext.createGain()
    engineGain.gain.value = 0.0001

    engineOscillator = audioContext.createOscillator()
    engineOscillator.type = 'sawtooth'
    engineOscillator.frequency.value = 90
    engineOscillator.connect(engineFilter)
    engineFilter.connect(engineGain)
    engineGain.connect(masterGain)
    engineOscillator.start()

    return audioContext
  }

  const playTone = (frequency: number, duration: number, gain: number, type: OscillatorType) => {
    const audioContext = ensureContext()
    if (!audioContext || !masterGain) {
      return
    }

    const oscillator = audioContext.createOscillator()
    const toneGain = audioContext.createGain()
    oscillator.type = type
    oscillator.frequency.value = frequency
    toneGain.gain.setValueAtTime(0.0001, audioContext.currentTime)
    toneGain.gain.exponentialRampToValueAtTime(gain, audioContext.currentTime + 0.015)
    toneGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration)
    oscillator.connect(toneGain)
    toneGain.connect(masterGain)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + duration + 0.02)
  }

  target.addEventListener('keydown', unlock, { once: true })
  target.addEventListener('pointerdown', unlock, { once: true })

  return {
    update: (snapshot) => {
      if (!context || !engineOscillator || !engineGain || !engineFilter) {
        return
      }

      const now = context.currentTime
      const revs = 82 + snapshot.car.speed * 2.3 + Math.abs(snapshot.car.drift) * 68
      const gain = snapshot.telemetry.raceExpired ? 0.004 : 0.018 + snapshot.car.speed / 4600
      const filter = 420 + snapshot.car.speed * 8 + (snapshot.car.boostActive ? 520 : 0)
      engineOscillator.frequency.setTargetAtTime(revs, now, 0.045)
      engineGain.gain.setTargetAtTime(gain, now, 0.08)
      engineFilter.frequency.setTargetAtTime(filter, now, 0.08)

      if (snapshot.telemetry.checkpointSplits.length > lastCheckpointCount) {
        playTone(880, 0.08, 0.12, 'square')
        playTone(1320, 0.16, 0.09, 'square')
      }
      if (snapshot.traffic.nearMissCount > lastNearMissCount) {
        playTone(1640, 0.09, 0.08, 'triangle')
      }
      if (snapshot.traffic.hitCount > lastHitCount || snapshot.car.collisionCount > lastHitCount) {
        playTone(110, 0.22, 0.16, 'sawtooth')
      }
      if (snapshot.car.boostActive && !lastBoostActive) {
        playTone(720, 0.06, 0.08, 'square')
      }
      if (snapshot.telemetry.raceExpired && !announcedTimeOver) {
        playTone(196, 0.42, 0.11, 'triangle')
        announcedTimeOver = true
      }

      lastCheckpointCount = snapshot.telemetry.checkpointSplits.length
      lastNearMissCount = snapshot.traffic.nearMissCount
      lastHitCount = Math.max(snapshot.traffic.hitCount, snapshot.car.collisionCount)
      lastBoostActive = snapshot.car.boostActive
      if (!snapshot.telemetry.raceExpired) {
        announcedTimeOver = false
      }
    },
    dispose: () => {
      target.removeEventListener('keydown', unlock)
      target.removeEventListener('pointerdown', unlock)
      engineOscillator?.stop()
      void context?.close()
    },
  }
}
