export interface TrackSegment {
  index: number
  start: number
  length: number
  curve: number
  elevation: number
  roadWidth: number
}

export interface RoadsideProp {
  id: string
  distance: number
  side: -1 | 1
  offset: number
  kind: 'palm' | 'sign' | 'crystal'
  color: string
}

export interface LevelManifest {
  id: string
  title: string
  segmentLength: number
  totalLength: number
  roadWidth: number
  checkpoints: number[]
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

export function createNeonRidgeLevel(): LevelManifest {
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
  }))
  const totalLength = segments.length * DEFAULT_SEGMENT_LENGTH

  return {
    id: 'neon-ridge-engine-m1',
    title: 'Neon Ridge Run',
    segmentLength: DEFAULT_SEGMENT_LENGTH,
    totalLength,
    roadWidth: DEFAULT_ROAD_WIDTH,
    checkpoints: [256, 512, 768, 960],
    segments,
    props: createRoadsideProps(totalLength),
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

export function wrapDistance(distance: number, totalLength: number): number {
  return ((distance % totalLength) + totalLength) % totalLength
}

function createRoadsideProps(totalLength: number): RoadsideProp[] {
  const props: RoadsideProp[] = []
  const colors = ['#ff5ab3', '#4ee7ff', '#ffe66f', '#7fff92']

  for (let distance = 80; distance < totalLength; distance += 56) {
    const side = Math.floor(distance / 56) % 2 === 0 ? -1 : 1
    const kindIndex = Math.floor(distance / 112) % 3
    props.push({
      id: `prop-${distance}`,
      distance,
      side,
      offset: 15 + (Math.floor(distance / 168) % 3) * 3,
      kind: kindIndex === 0 ? 'palm' : kindIndex === 1 ? 'sign' : 'crystal',
      color: colors[Math.floor(distance / 56) % colors.length],
    })
  }

  return props
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}
