export interface TrackSegment {
  index: number
  start: number
  length: number
  curve: number
  elevation: number
  roadWidth: number
  sectionId: string
}

export type RoadsidePropKind =
  | 'palm'
  | 'sign'
  | 'crystal'
  | 'holo-billboard'
  | 'chevron'
  | 'solar-arch'
  | 'radio-tower'

export type TrafficVehicleKind = 'coupe' | 'van' | 'truck'

export interface RoadsideProp {
  id: string
  distance: number
  sectionId: string
  side: -1 | 1
  offset: number
  kind: RoadsidePropKind
  color: string
}

export interface TrafficVehicle {
  id: string
  distance: number
  sectionId: string
  lane: -1 | 1
  speed: number
  kind: TrafficVehicleKind
  color: string
}

export interface DriftZone {
  id: string
  sectionId: string
  title: string
  start: number
  end: number
  targetScore: number
  bonusScore: number
  color: string
}

export interface RecoveryGate {
  id: string
  sectionId: string
  title: string
  distance: number
  radius: number
  boostAward: number
  timeAwardSeconds: number
  color: string
}

export interface ComboLadder {
  id: string
  sectionId: string
  title: string
  start: number
  end: number
  targetCombo: number
  bonusScore: number
  color: string
}

export interface RouteSection {
  id: string
  title: string
  start: number
  end: number
  checkpoint: number
  targetSeconds: number
  signatureProp: RoadsidePropKind
  primaryColor: string
  accentColor: string
  propStep: number
}

export type RouteDifficultyId = 'touring' | 'arcade' | 'rival'

export interface RouteDifficultyProfile {
  id: RouteDifficultyId
  title: string
  targetMultiplier: number
  silverDeltaSeconds: number
  bronzeDeltaSeconds: number
  latePenaltyPerSecond: number
}

export interface LevelManifest {
  id: string
  title: string
  difficulty: RouteDifficultyProfile
  generator: 'infinite-ridge-v1'
  proceduralSeed: number
  segmentLength: number
  totalLength: number
  roadWidth: number
  targetTimeSeconds: number
  checkpoints: number[]
  sections: RouteSection[]
  segments: TrackSegment[]
  props: RoadsideProp[]
  traffic: TrafficVehicle[]
  driftZones: DriftZone[]
  recoveryGates: RecoveryGate[]
  comboLadders: ComboLadder[]
}

export interface TrackSample {
  distance: number
  centerX: number
  elevation: number
  curve: number
  roadWidth: number
}

export interface ProceduralTrackOptions {
  difficultyId?: RouteDifficultyId
  seed?: number
  sectionCount?: number
}

const DEFAULT_SEGMENT_LENGTH = 64
const DEFAULT_ROAD_WIDTH = 18
export const DEFAULT_ROUTE_DIFFICULTY: RouteDifficultyId = 'arcade'
export const DEFAULT_TRACK_SEED = 0x19_86_09
const DEFAULT_SECTION_COUNT = 8
const SEGMENTS_PER_SECTION = 4
const MIN_SECTION_COUNT = 2
const MAX_SECTION_COUNT = 8

export const ROUTE_DIFFICULTY_PROFILES: Record<
  RouteDifficultyId,
  RouteDifficultyProfile
> = {
  touring: {
    id: 'touring',
    title: 'Touring',
    targetMultiplier: 1.08,
    silverDeltaSeconds: 3.5,
    bronzeDeltaSeconds: 6.8,
    latePenaltyPerSecond: 24,
  },
  arcade: {
    id: 'arcade',
    title: 'Arcade',
    targetMultiplier: 1,
    silverDeltaSeconds: 2.5,
    bronzeDeltaSeconds: 5,
    latePenaltyPerSecond: 32,
  },
  rival: {
    id: 'rival',
    title: 'Rival',
    targetMultiplier: 0.93,
    silverDeltaSeconds: 1.6,
    bronzeDeltaSeconds: 3.6,
    latePenaltyPerSecond: 44,
  },
}

interface SectionTheme {
  id: string
  title: string
  durationSeconds: number
  signatureProp: RoadsidePropKind
  primaryColor: string
  accentColor: string
  propStep: number
  curveAnchors: [number, number, number, number]
  elevationPhase: number
  elevationAmplitude: number
  roadNarrowing: number
}

const SECTION_THEMES: SectionTheme[] = [
  {
    id: 'city-overlook',
    title: 'City Overlook',
    durationSeconds: 4.2,
    signatureProp: 'holo-billboard',
    primaryColor: '#ff5ab3',
    accentColor: '#ffe66f',
    propStep: 56,
    curveAnchors: [0.08, 0.34, 0.5, 0.28],
    elevationPhase: 0,
    elevationAmplitude: 2.4,
    roadNarrowing: 0.3,
  },
  {
    id: 'switchback-arc',
    title: 'Switchback Arc',
    durationSeconds: 3.3,
    signatureProp: 'chevron',
    primaryColor: '#4ee7ff',
    accentColor: '#ff8bd1',
    propStep: 48,
    curveAnchors: [-0.12, -0.42, -0.58, -0.3],
    elevationPhase: 1.3,
    elevationAmplitude: 2.9,
    roadNarrowing: 0.8,
  },
  {
    id: 'neon-causeway',
    title: 'Neon Causeway',
    durationSeconds: 3.3,
    signatureProp: 'solar-arch',
    primaryColor: '#7fff92',
    accentColor: '#b57cff',
    propStep: 52,
    curveAnchors: [0.18, 0.38, 0.22, -0.18],
    elevationPhase: 2.15,
    elevationAmplitude: 3.3,
    roadNarrowing: 0.6,
  },
  {
    id: 'radio-crest',
    title: 'Radio Crest',
    durationSeconds: 3.3,
    signatureProp: 'radio-tower',
    primaryColor: '#ffe66f',
    accentColor: '#4ee7ff',
    propStep: 44,
    curveAnchors: [-0.2, 0.08, 0.44, 0.16],
    elevationPhase: 3.5,
    elevationAmplitude: 3.8,
    roadNarrowing: 0.7,
  },
]

export function createNeonRidgeLevel(
  difficultyId: RouteDifficultyId = DEFAULT_ROUTE_DIFFICULTY,
): LevelManifest {
  return createProceduralTrack({ difficultyId })
}

export function createProceduralTrack(
  options: ProceduralTrackOptions = {},
): LevelManifest {
  const difficulty =
    ROUTE_DIFFICULTY_PROFILES[options.difficultyId ?? DEFAULT_ROUTE_DIFFICULTY]
  const seed = normalizeSeed(options.seed ?? DEFAULT_TRACK_SEED)
  const sectionCount = clampSectionCount(options.sectionCount ?? DEFAULT_SECTION_COUNT)
  const sections = createRouteSections(difficulty, seed, sectionCount)
  const segments = createTrackSegments(sections, seed)
  const totalLength = segments.length * DEFAULT_SEGMENT_LENGTH

  return {
    id: 'neon-ridge-drift-m2',
    title: 'Neon Ridge Drift',
    difficulty,
    generator: 'infinite-ridge-v1',
    proceduralSeed: seed,
    segmentLength: DEFAULT_SEGMENT_LENGTH,
    totalLength,
    roadWidth: DEFAULT_ROAD_WIDTH,
    targetTimeSeconds: sections.at(-1)?.targetSeconds ?? 0,
    checkpoints: sections.map((section) => section.checkpoint),
    sections,
    segments,
    props: createRoadsideProps(sections, seed),
    traffic: createTrafficVehicles(sections, seed),
    driftZones: createDriftZones(sections, difficulty, seed),
    recoveryGates: createRecoveryGates(sections, difficulty, seed),
    comboLadders: createComboLadders(sections, difficulty, seed),
  }
}

export function sampleTrack(level: LevelManifest, distance: number): TrackSample {
  const wrappedDistance = wrapDistance(distance, level.totalLength)
  const segmentIndex = Math.min(
    level.segments.length - 1,
    Math.floor(wrappedDistance / level.segmentLength),
  )
  const segment = level.segments[segmentIndex]
  const next = level.segments[(segmentIndex + 1) % level.segments.length]
  const localT = (wrappedDistance - segment.start) / segment.length
  const easedT = smoothStep(localT)

  return {
    distance: wrappedDistance,
    centerX: calculateCenterOffset(level, wrappedDistance),
    elevation: lerp(segment.elevation, next.elevation, easedT),
    curve: lerp(segment.curve, next.curve, easedT),
    roadWidth: lerp(segment.roadWidth, next.roadWidth, localT),
  }
}

export function calculateCenterOffset(level: LevelManifest, distance: number): number {
  const wrappedDistance = wrapDistance(distance, level.totalLength)
  let centerX = 0

  for (const segment of level.segments) {
    const consumed = Math.min(
      segment.length,
      Math.max(0, wrappedDistance - segment.start),
    )
    if (consumed <= 0) {
      continue
    }
    centerX += segment.curve * consumed * 0.22
    if (wrappedDistance < segment.start + segment.length) {
      break
    }
  }

  return centerX
}

export function nextCheckpoint(level: LevelManifest, distance: number): number {
  const lapDistance = wrapDistance(distance, level.totalLength)
  return level.checkpoints.find((checkpoint) => checkpoint > lapDistance) ?? level.totalLength
}

export function currentRouteSection(level: LevelManifest, distance: number): RouteSection {
  const lapDistance = wrapDistance(distance, level.totalLength)
  return (
    level.sections.find(
      (section) => lapDistance >= section.start && lapDistance < section.end,
    ) ?? level.sections[0]
  )
}

export function currentDriftZone(level: LevelManifest, distance: number): DriftZone | undefined {
  const lapDistance = wrapDistance(distance, level.totalLength)
  return level.driftZones.find((zone) => lapDistance >= zone.start && lapDistance < zone.end)
}

export function currentRecoveryGate(
  level: LevelManifest,
  distance: number,
): RecoveryGate | undefined {
  const lapDistance = wrapDistance(distance, level.totalLength)
  return level.recoveryGates.find(
    (gate) => Math.abs(lapDistance - gate.distance) <= gate.radius,
  )
}

export function currentComboLadder(
  level: LevelManifest,
  distance: number,
): ComboLadder | undefined {
  const lapDistance = wrapDistance(distance, level.totalLength)
  return level.comboLadders.find(
    (ladder) => lapDistance >= ladder.start && lapDistance < ladder.end,
  )
}

export function checkpointTargetSeconds(level: LevelManifest, distance: number): number {
  const checkpoint = nextCheckpoint(level, distance)
  return (
    level.sections.find((section) => section.checkpoint === checkpoint)?.targetSeconds ??
    level.targetTimeSeconds
  )
}

export function wrapDistance(distance: number, totalLength: number): number {
  return ((distance % totalLength) + totalLength) % totalLength
}

function createDriftZones(
  sections: RouteSection[],
  difficulty: RouteDifficultyProfile,
  seed: number,
): DriftZone[] {
  const canonical = isCanonicalTrack(seed, sections.length)

  return sections.map((section, index) => {
    const length = section.end - section.start
    const startOffset = canonical
      ? length * (0.28 + (index % 2) * 0.06)
      : length * seededRange(seed, index, 89, 0.24, 0.36)
    const endOffset = canonical
      ? length * (0.72 + (index % 3) * 0.035)
      : length * seededRange(seed, index, 97, 0.66, 0.82)
    const pressure = difficulty.id === 'rival' ? 1.18 : difficulty.id === 'touring' ? 0.86 : 1
    const targetScore = Math.round((120 + index * 14) * pressure)

    return {
      id: `${section.id}-drift-zone`,
      sectionId: section.id,
      title: `${section.title} Drift`,
      start: roundGeometry(section.start + startOffset),
      end: roundGeometry(Math.min(section.end - 18, section.start + endOffset)),
      targetScore,
      bonusScore: Math.round(targetScore * 0.55),
      color: section.accentColor,
    }
  })
}

function createRecoveryGates(
  sections: RouteSection[],
  difficulty: RouteDifficultyProfile,
  seed: number,
): RecoveryGate[] {
  const canonical = isCanonicalTrack(seed, sections.length)

  return sections.map((section, index) => {
    const length = section.end - section.start
    const distanceRatio = canonical
      ? 0.84 - (index % 2) * 0.035
      : seededRange(seed, index, 101, 0.76, 0.9)
    const pressureScale =
      difficulty.id === 'rival' ? 1.2 : difficulty.id === 'touring' ? 0.88 : 1

    return {
      id: `${section.id}-recovery-gate`,
      sectionId: section.id,
      title: `${section.title} Recovery`,
      distance: roundGeometry(section.start + length * distanceRatio),
      radius: roundGeometry(canonical ? 13 : seededRange(seed, index, 103, 10, 16)),
      boostAward: Math.round(16 * pressureScale),
      timeAwardSeconds: roundSeconds(1.6 * pressureScale),
      color: section.primaryColor,
    }
  })
}

function createComboLadders(
  sections: RouteSection[],
  difficulty: RouteDifficultyProfile,
  seed: number,
): ComboLadder[] {
  const canonical = isCanonicalTrack(seed, sections.length)

  return sections.map((section, index) => {
    const length = section.end - section.start
    const startRatio = canonical
      ? 0.14 + (index % 3) * 0.025
      : seededRange(seed, index, 109, 0.1, 0.22)
    const endRatio = canonical
      ? 0.9 - (index % 2) * 0.025
      : seededRange(seed, index, 113, 0.82, 0.93)
    const pressure = difficulty.id === 'rival' ? 1.24 : difficulty.id === 'touring' ? 0.82 : 1
    const targetCombo = Math.round((170 + index * 28) * pressure)

    return {
      id: `${section.id}-combo-ladder`,
      sectionId: section.id,
      title: `${section.title} Combo`,
      start: roundGeometry(section.start + length * startRatio),
      end: roundGeometry(section.start + length * endRatio),
      targetCombo,
      bonusScore: Math.round(targetCombo * 0.62),
      color: index % 2 === 0 ? section.primaryColor : section.accentColor,
    }
  })
}

function createRouteSections(
  difficulty: RouteDifficultyProfile,
  seed: number,
  sectionCount: number,
): RouteSection[] {
  let cumulativeSeconds = 0

  return Array.from({ length: sectionCount }, (_, index) => {
    const theme = themeForIndex(index)
    const start = index * SEGMENTS_PER_SECTION * DEFAULT_SEGMENT_LENGTH
    const end = start + SEGMENTS_PER_SECTION * DEFAULT_SEGMENT_LENGTH
    cumulativeSeconds += sectionDurationSeconds(theme, seed, sectionCount, index)

    return {
      id: theme.id,
      title: theme.title,
      start,
      end,
      checkpoint: end,
      targetSeconds: roundSeconds(cumulativeSeconds * difficulty.targetMultiplier),
      signatureProp: theme.signatureProp,
      primaryColor: theme.primaryColor,
      accentColor: theme.accentColor,
      propStep: theme.propStep,
    }
  })
}

function createTrackSegments(sections: RouteSection[], seed: number): TrackSegment[] {
  const canonical = isCanonicalTrack(seed, sections.length)
  const segments: TrackSegment[] = []

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    const theme = themeForIndex(sectionIndex)

    for (let localIndex = 0; localIndex < SEGMENTS_PER_SECTION; localIndex += 1) {
      const index = sectionIndex * SEGMENTS_PER_SECTION + localIndex
      const curve = createSegmentCurve(theme, seed, sections.length, sectionIndex, localIndex)
      segments.push({
        index,
        start: index * DEFAULT_SEGMENT_LENGTH,
        length: DEFAULT_SEGMENT_LENGTH,
        curve,
        elevation: createSegmentElevation(theme, seed, canonical, sectionIndex, localIndex),
        roadWidth: createSegmentRoadWidth(theme, seed, canonical, sectionIndex, localIndex),
        sectionId: section.id,
      })
    }
  }

  return canonical ? segments : removeCurveBias(segments)
}

function createSegmentCurve(
  theme: SectionTheme,
  seed: number,
  sectionCount: number,
  sectionIndex: number,
  localIndex: number,
): number {
  const baseCurve = theme.curveAnchors[localIndex]

  if (isCanonicalTrack(seed, sectionCount)) {
    return baseCurve
  }

  const sectionBias = seededRange(seed, sectionIndex, 19, -0.12, 0.12)
  const localJitter = seededRangeLocal(seed, sectionIndex, localIndex, 23, -0.09, 0.09)
  const wave =
    Math.sin((seed % 997) * 0.013 + (sectionIndex * SEGMENTS_PER_SECTION + localIndex) * 0.84) *
    0.06
  const strength = seededRange(seed, sectionIndex, 31, 0.82, 1.18)

  return roundGeometry(clamp(baseCurve * strength + sectionBias + localJitter + wave, -0.58, 0.58))
}

function createSegmentElevation(
  theme: SectionTheme,
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): number {
  const index = sectionIndex * SEGMENTS_PER_SECTION + localIndex

  if (canonical) {
    return roundGeometry(Math.sin(index * 0.78) * 2.8)
  }

  const phase = theme.elevationPhase + seededRange(seed, sectionIndex, 37, -0.6, 0.6)
  const crest =
    Math.sin(index * 0.68 + phase) * theme.elevationAmplitude +
    seededRangeLocal(seed, sectionIndex, localIndex, 41, -0.65, 0.65)

  return roundGeometry(crest)
}

function createSegmentRoadWidth(
  theme: SectionTheme,
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): number {
  const index = sectionIndex * SEGMENTS_PER_SECTION + localIndex

  if (canonical) {
    return DEFAULT_ROAD_WIDTH - (index % 5 === 3 ? 1.5 : 0)
  }

  const apexPinch = localIndex === 2 ? theme.roadNarrowing : theme.roadNarrowing * 0.35
  const jitter = seededRangeLocal(seed, sectionIndex, localIndex, 47, 0, 0.95)

  return roundGeometry(clamp(DEFAULT_ROAD_WIDTH - apexPinch - jitter, 12.8, 17.5))
}

function createRoadsideProps(sections: RouteSection[], seed: number): RoadsideProp[] {
  const props: RoadsideProp[] = []
  const canonical = isCanonicalTrack(seed, sections.length)

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]

    for (let distance = section.start + 40; distance < section.end; distance += section.propStep) {
      const localIndex = Math.floor((distance - section.start) / section.propStep)
      const side = createPropSide(section, seed, canonical, sectionIndex, localIndex)
      const kind = propKindForIndex(section, seed, canonical, sectionIndex, localIndex)

      props.push({
        id: `${section.id}-prop-${distance}`,
        distance,
        sectionId: section.id,
        side,
        offset: createPropOffset(section, seed, canonical, sectionIndex, localIndex),
        kind,
        color: localIndex % 2 === 0 ? section.primaryColor : section.accentColor,
      })
    }
  }

  return props
}

function createTrafficVehicles(sections: RouteSection[], seed: number): TrafficVehicle[] {
  const traffic: TrafficVehicle[] = []
  const canonical = isCanonicalTrack(seed, sections.length)

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]
    const sectionLength = section.end - section.start

    for (let localIndex = 0; localIndex < 2; localIndex += 1) {
      const baseDistance = section.start + sectionLength * (0.34 + localIndex * 0.34)
      const jitter = canonical
        ? 0
        : seededRangeLocal(seed, sectionIndex, localIndex, 71, -12, 16)
      const distance = roundGeometry(
        clamp(baseDistance + jitter, section.start + 52, section.end - 42),
      )
      const lane = createTrafficLane(seed, canonical, sectionIndex, localIndex)
      const speed = canonical
        ? 30 + ((sectionIndex + localIndex) % 3) * 5
        : seededRangeLocal(seed, sectionIndex, localIndex, 73, 26, 44)

      traffic.push({
        id: `${section.id}-traffic-${localIndex + 1}`,
        distance,
        sectionId: section.id,
        lane,
        speed: roundGeometry(speed),
        kind: trafficKindForIndex(seed, canonical, sectionIndex, localIndex),
        color: localIndex % 2 === 0 ? section.accentColor : section.primaryColor,
      })
    }
  }

  return traffic
}

function createTrafficLane(
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): -1 | 1 {
  if (canonical) {
    return (sectionIndex + localIndex) % 2 === 0 ? -1 : 1
  }

  return seededUnit(seed, sectionIndex, localIndex, 79) < 0.5 ? -1 : 1
}

function trafficKindForIndex(
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): TrafficVehicleKind {
  if (canonical) {
    return (['coupe', 'van', 'truck'] as const)[(sectionIndex + localIndex) % 3]
  }

  const roll = seededUnit(seed, sectionIndex, localIndex, 83)
  if (roll < 0.5) {
    return 'coupe'
  }
  return roll < 0.78 ? 'van' : 'truck'
}

function createPropSide(
  section: RouteSection,
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): -1 | 1 {
  if (canonical) {
    return (localIndex + section.start / DEFAULT_SEGMENT_LENGTH) % 2 === 0 ? -1 : 1
  }

  return seededUnit(seed, sectionIndex, localIndex, 53) < 0.5 ? -1 : 1
}

function createPropOffset(
  section: RouteSection,
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  localIndex: number,
): number {
  if (canonical) {
    return 14 + ((localIndex + section.id.length) % 3) * 3
  }

  return roundGeometry(13 + Math.floor(seededUnit(seed, sectionIndex, localIndex, 59) * 5) * 2.4)
}

function propKindForIndex(
  section: RouteSection,
  seed: number,
  canonical: boolean,
  sectionIndex: number,
  index: number,
): RoadsidePropKind {
  if (canonical) {
    if (index % 4 === 0) {
      return section.signatureProp
    }

    if (index % 4 === 1) {
      return 'sign'
    }
    return index % 4 === 2 ? 'crystal' : 'palm'
  }

  const roll = seededUnit(seed, sectionIndex, index, 61)
  if (roll < 0.34) {
    return section.signatureProp
  }
  if (roll < 0.5) {
    return 'sign'
  }
  if (roll < 0.66) {
    return 'crystal'
  }
  if (roll < 0.78) {
    return 'palm'
  }
  if (roll < 0.86) {
    return 'chevron'
  }
  return roll < 0.93 ? 'holo-billboard' : 'radio-tower'
}

function themeForIndex(index: number): SectionTheme {
  const baseTheme = SECTION_THEMES[index % SECTION_THEMES.length]
  const lap = Math.floor(index / SECTION_THEMES.length)

  if (lap === 0) {
    return baseTheme
  }

  const sign = lap % 2 === 0 ? 1 : -1

  return {
    ...baseTheme,
    id: `${baseTheme.id}-${lap + 1}`,
    title: `${baseTheme.title} ${lap + 1}`,
    durationSeconds: Math.max(2.45, baseTheme.durationSeconds - lap * 0.72),
    propStep: Math.max(36, baseTheme.propStep - lap * 3),
    curveAnchors: baseTheme.curveAnchors.map((curve) =>
      roundGeometry(curve * sign),
    ) as SectionTheme['curveAnchors'],
  }
}

function sectionDurationSeconds(
  theme: SectionTheme,
  seed: number,
  sectionCount: number,
  sectionIndex: number,
): number {
  if (isCanonicalTrack(seed, sectionCount)) {
    return theme.durationSeconds
  }

  const jitter = seededRange(seed, sectionIndex, 67, -0.22, 0.42)
  return Math.max(2.8, theme.durationSeconds + jitter)
}

function removeCurveBias(segments: TrackSegment[]): TrackSegment[] {
  const averageCurve =
    segments.reduce((sum, segment) => sum + segment.curve, 0) / segments.length

  return segments.map((segment) => ({
    ...segment,
    curve: roundGeometry(clamp(segment.curve - averageCurve * 0.75, -0.58, 0.58)),
  }))
}

function isCanonicalTrack(seed: number, sectionCount: number): boolean {
  return seed === DEFAULT_TRACK_SEED && sectionCount === DEFAULT_SECTION_COUNT
}

function clampSectionCount(sectionCount: number): number {
  if (!Number.isFinite(sectionCount)) {
    return DEFAULT_SECTION_COUNT
  }

  return Math.max(MIN_SECTION_COUNT, Math.min(MAX_SECTION_COUNT, Math.round(sectionCount)))
}

function normalizeSeed(seed: number): number {
  if (!Number.isFinite(seed)) {
    return DEFAULT_TRACK_SEED
  }

  return Math.trunc(Math.abs(seed)) >>> 0
}

function seededRange(
  seed: number,
  sectionIndex: number,
  salt: number,
  min: number,
  max: number,
): number {
  return lerp(min, max, seededUnit(seed, sectionIndex, salt))
}

function seededRangeLocal(
  seed: number,
  sectionIndex: number,
  localIndex: number,
  salt: number,
  min: number,
  max: number,
): number {
  return lerp(min, max, seededUnit(seed, sectionIndex, localIndex, salt))
}

function seededUnit(seed: number, ...values: number[]): number {
  let hash = seed >>> 0

  for (const value of values) {
    hash ^= Math.trunc(value) + 0x9e3779b9 + (hash << 6) + (hash >>> 2)
    hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d)
    hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b)
    hash ^= hash >>> 16
  }

  return (hash >>> 0) / 0x1_0000_0000
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function roundSeconds(value: number): number {
  return Math.round(value * 10) / 10
}

function roundGeometry(value: number): number {
  return Math.round(value * 10_000) / 10_000
}
