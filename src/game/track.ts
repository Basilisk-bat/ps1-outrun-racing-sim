export interface TrackSegment {
  index: number
  start: number
  length: number
  curve: number
  elevation: number
  roadWidth: number
  sectionId: string
}

export type RoadsidePropKind = 'palm' | 'sign' | 'crystal'

export interface RoadsideProp {
  id: string
  distance: number
  sectionId: string
  side: -1 | 1
  offset: number
  kind: RoadsidePropKind
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

export interface LevelManifest {
  id: string
  title: string
  segmentLength: number
  totalLength: number
  roadWidth: number
  targetTimeSeconds: number
  checkpoints: number[]
  sections: RouteSection[]
  segments: TrackSegment[]
  props: RoadsideProp[]
}

export interface TrackSample {
  distance: number
  centerX: number
  elevation: number
  curve: number
  roadWidth: number
}

const DEFAULT_SEGMENT_LENGTH = 64
const DEFAULT_ROAD_WIDTH = 16

interface SectionSpec {
  id: string
  title: string
  startSegment: number
  endSegment: number
  targetSeconds: number
  signatureProp: RoadsidePropKind
  primaryColor: string
  accentColor: string
  propStep: number
}

const SECTION_SPECS: SectionSpec[] = [
  {
    id: 'sunset-gate',
    title: 'Sunset Gate',
    startSegment: 0,
    endSegment: 3,
    targetSeconds: 4.2,
    signatureProp: 'palm',
    primaryColor: '#ff5ab3',
    accentColor: '#ffe66f',
    propStep: 56,
  },
  {
    id: 'glass-narrows',
    title: 'Glass Narrows',
    startSegment: 4,
    endSegment: 7,
    targetSeconds: 7.5,
    signatureProp: 'sign',
    primaryColor: '#4ee7ff',
    accentColor: '#ff8bd1',
    propStep: 48,
  },
  {
    id: 'magenta-crest',
    title: 'Magenta Crest',
    startSegment: 8,
    endSegment: 11,
    targetSeconds: 10.8,
    signatureProp: 'crystal',
    primaryColor: '#7fff92',
    accentColor: '#b57cff',
    propStep: 52,
  },
  {
    id: 'final-drop',
    title: 'Final Drop',
    startSegment: 12,
    endSegment: 15,
    targetSeconds: 14.1,
    signatureProp: 'sign',
    primaryColor: '#ffe66f',
    accentColor: '#4ee7ff',
    propStep: 44,
  },
]

export function createNeonRidgeLevel(): LevelManifest {
  const sections = createRouteSections()
  const curvePattern = [
    0, 0.18, 0.34, 0.18, 0, -0.22, -0.4, -0.24, 0, 0.08, 0.32, 0.5, 0.24, -0.16,
    -0.34, 0,
  ]
  const segments: TrackSegment[] = curvePattern.map((curve, index) => ({
    index,
    start: index * DEFAULT_SEGMENT_LENGTH,
    length: DEFAULT_SEGMENT_LENGTH,
    curve,
    elevation: Math.sin(index * 0.78) * 2.8,
    roadWidth: DEFAULT_ROAD_WIDTH - (index % 5 === 3 ? 1.5 : 0),
    sectionId: sectionForSegmentIndex(sections, index).id,
  }))
  const totalLength = segments.length * DEFAULT_SEGMENT_LENGTH

  return {
    id: 'neon-ridge-engine-m1',
    title: 'Neon Ridge Run',
    segmentLength: DEFAULT_SEGMENT_LENGTH,
    totalLength,
    roadWidth: DEFAULT_ROAD_WIDTH,
    targetTimeSeconds: sections.at(-1)?.targetSeconds ?? 0,
    checkpoints: sections.map((section) => section.checkpoint),
    sections,
    segments,
    props: createRoadsideProps(sections),
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

function createRouteSections(): RouteSection[] {
  return SECTION_SPECS.map((section) => ({
    id: section.id,
    title: section.title,
    start: section.startSegment * DEFAULT_SEGMENT_LENGTH,
    end: (section.endSegment + 1) * DEFAULT_SEGMENT_LENGTH,
    checkpoint: (section.endSegment + 1) * DEFAULT_SEGMENT_LENGTH,
    targetSeconds: section.targetSeconds,
    signatureProp: section.signatureProp,
    primaryColor: section.primaryColor,
    accentColor: section.accentColor,
    propStep: section.propStep,
  }))
}

function sectionForSegmentIndex(sections: RouteSection[], segmentIndex: number): RouteSection {
  const segmentStart = segmentIndex * DEFAULT_SEGMENT_LENGTH
  const section = sections.find(
    (candidate) => segmentStart >= candidate.start && segmentStart < candidate.end,
  )

  if (!section) {
    throw new Error(`No route section for segment ${segmentIndex}`)
  }

  return section
}

function createRoadsideProps(sections: RouteSection[]): RoadsideProp[] {
  const props: RoadsideProp[] = []

  for (const section of sections) {
    for (let distance = section.start + 40; distance < section.end; distance += section.propStep) {
      const localIndex = Math.floor((distance - section.start) / section.propStep)
      const side = (localIndex + section.start / DEFAULT_SEGMENT_LENGTH) % 2 === 0 ? -1 : 1
      const kind = propKindForIndex(section, localIndex)
      props.push({
        id: `${section.id}-prop-${distance}`,
        distance,
        sectionId: section.id,
        side,
        offset: 14 + ((localIndex + section.id.length) % 3) * 3,
        kind,
        color: localIndex % 2 === 0 ? section.primaryColor : section.accentColor,
      })
    }
  }

  return props
}

function propKindForIndex(section: RouteSection, index: number): RoadsidePropKind {
  if (index % 3 === 0) {
    return section.signatureProp
  }

  return index % 3 === 1 ? 'sign' : 'crystal'
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}
