import * as THREE from 'three'
import type { RacingSnapshot } from './sim.ts'
import type { LevelManifest, RoadsideProp, TrafficVehicle } from './track.ts'
import { sampleTrack } from './track.ts'
import { trafficVehiclePose } from './traffic.ts'

export interface SceneRenderer {
  domElement: HTMLCanvasElement
  render: (snapshot: RacingSnapshot) => void
  resize: () => void
  dispose: () => void
}

const CAMERA_LOOK_AHEAD = 110
const CAMERA_BACK = 34
const CAMERA_HEIGHT = 16

export function createSceneRenderer(
  host: HTMLElement,
  level: LevelManifest,
): SceneRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  })
  renderer.domElement.className = 'game-canvas'
  renderer.domElement.dataset.testid = 'game-canvas'
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x08091a)
  host.append(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x171135)
  scene.fog = new THREE.Fog(0x171135, 180, 650)

  const camera = new THREE.PerspectiveCamera(61, 1, 0.1, 900)
  const sun = new THREE.DirectionalLight(0xfff4bf, 1.4)
  sun.position.set(-25, 42, 14)
  scene.add(sun)
  scene.add(new THREE.HemisphereLight(0xff8fcc, 0x162b2d, 1.8))
  scene.add(createHorizon())
  scene.add(createTerrain(level))
  scene.add(createRoad(level))
  scene.add(createStripes(level))
  scene.add(createProps(level))
  const traffic = createTrafficMeshes(level)
  scene.add(traffic.group)

  const car = createPlayerCar()
  scene.add(car)

  const resize = () => {
    const width = Math.max(1, host.clientWidth)
    const height = Math.max(1, host.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  const render = (snapshot: RacingSnapshot) => {
    const track = snapshot.track
    const carX = track.centerX + snapshot.car.lateral
    const carY = track.elevation + 0.74
    const carZ = -snapshot.car.distance

    car.position.set(carX, carY, carZ)
    car.rotation.set(0, snapshot.car.heading, -snapshot.car.drift * 0.2)
    updateTrafficMeshes(traffic.entries, snapshot)

    const chaseSample = sampleTrack(snapshot.level, snapshot.car.distance - CAMERA_BACK)
    const lookSample = sampleTrack(snapshot.level, snapshot.car.distance + CAMERA_LOOK_AHEAD)
    camera.position.set(
      chaseSample.centerX + snapshot.car.lateral * 0.42,
      chaseSample.elevation + CAMERA_HEIGHT,
      -(snapshot.car.distance - CAMERA_BACK),
    )
    camera.lookAt(
      lookSample.centerX + snapshot.car.lateral * 0.2,
      lookSample.elevation + 3.4,
      -(snapshot.car.distance + CAMERA_LOOK_AHEAD),
    )

    renderer.render(scene, camera)
  }

  resize()

  return {
    domElement: renderer.domElement,
    render,
    resize,
    dispose: () => {
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

function createRoad(level: LevelManifest): THREE.Mesh {
  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()

  for (const segment of level.segments) {
    const start = sampleTrack(level, segment.start)
    const end = sampleTrack(level, segment.start + segment.length)
    const startHalf = start.roadWidth * 0.5
    const endHalf = end.roadWidth * 0.5
    const shade = segment.index % 2 === 0 ? 0x31314a : 0x262840

    addQuad(positions, [
      start.centerX - startHalf,
      start.elevation + 0.03,
      -segment.start,
      start.centerX + startHalf,
      start.elevation + 0.03,
      -segment.start,
      end.centerX + endHalf,
      end.elevation + 0.03,
      -(segment.start + segment.length),
      end.centerX - endHalf,
      end.elevation + 0.03,
      -(segment.start + segment.length),
    ])
    pushQuadColor(colors, color.setHex(shade))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
}

function createStripes(level: LevelManifest): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color: 0xfff2ad })
  const edgeMaterial = new THREE.MeshBasicMaterial({ color: 0xff5ab3 })

  for (let distance = 24; distance < level.totalLength; distance += 48) {
    const sample = sampleTrack(level, distance)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 16), material)
    stripe.position.set(sample.centerX, sample.elevation + 0.08, -distance)
    group.add(stripe)

    for (const side of [-1, 1] as const) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 12), edgeMaterial)
      edge.position.set(
        sample.centerX + side * sample.roadWidth * 0.5,
        sample.elevation + 0.1,
        -distance,
      )
      group.add(edge)
    }
  }

  return group
}

function createTerrain(level: LevelManifest): THREE.Mesh {
  const positions: number[] = []
  const colors: number[] = []
  const color = new THREE.Color()

  for (const segment of level.segments) {
    const start = sampleTrack(level, segment.start)
    const end = sampleTrack(level, segment.start + segment.length)
    const width = 90

    addQuad(positions, [
      start.centerX - width,
      start.elevation - 0.22,
      -segment.start,
      start.centerX + width,
      start.elevation - 0.22,
      -segment.start,
      end.centerX + width,
      end.elevation - 0.22,
      -(segment.start + segment.length),
      end.centerX - width,
      end.elevation - 0.22,
      -(segment.start + segment.length),
    ])
    pushQuadColor(colors, color.setHex(segment.index % 2 === 0 ? 0x174640 : 0x1f334b))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  )
}

function createProps(level: LevelManifest): THREE.Group {
  const group = new THREE.Group()

  for (const prop of level.props) {
    group.add(createPropMesh(level, prop))
  }

  return group
}

interface TrafficMeshEntry {
  vehicle: TrafficVehicle
  mesh: THREE.Group
}

function createTrafficMeshes(level: LevelManifest): {
  group: THREE.Group
  entries: TrafficMeshEntry[]
} {
  const group = new THREE.Group()
  const entries = level.traffic.map((vehicle) => {
    const mesh = createTrafficVehicleMesh(vehicle)
    group.add(mesh)
    return { vehicle, mesh }
  })

  return { group, entries }
}

function updateTrafficMeshes(entries: TrafficMeshEntry[], snapshot: RacingSnapshot): void {
  for (const entry of entries) {
    const pose = trafficVehiclePose(
      snapshot.level,
      entry.vehicle,
      snapshot.car.distance,
      snapshot.telemetry.elapsed,
    )
    const sample = sampleTrack(snapshot.level, pose.absoluteDistance)
    entry.mesh.visible = pose.distanceAhead < 540
    entry.mesh.position.set(
      sample.centerX + pose.laneLateral,
      sample.elevation + 0.6,
      -pose.absoluteDistance,
    )
    entry.mesh.rotation.set(0, sample.curve * 0.42, entry.vehicle.lane * 0.025)
  }
}

function createTrafficVehicleMesh(vehicle: TrafficVehicle): THREE.Group {
  const group = new THREE.Group()
  const bodyDimensions = trafficBodyDimensions(vehicle.kind)
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color: vehicle.color,
    flatShading: true,
  })
  const glassMaterial = new THREE.MeshLambertMaterial({
    color: 0xb6fcff,
    flatShading: true,
  })
  const shadowMaterial = new THREE.MeshLambertMaterial({
    color: 0x171321,
    flatShading: true,
  })
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyDimensions.width, bodyDimensions.height, bodyDimensions.length),
    bodyMaterial,
  )
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(bodyDimensions.width * 0.68, bodyDimensions.height * 0.72, bodyDimensions.length * 0.38),
    glassMaterial,
  )
  const rear = new THREE.Mesh(
    new THREE.BoxGeometry(bodyDimensions.width * 0.78, 0.22, 0.24),
    shadowMaterial,
  )

  body.position.y = bodyDimensions.height * 0.5
  cabin.position.set(0, bodyDimensions.height + 0.22, -bodyDimensions.length * 0.1)
  rear.position.set(0, bodyDimensions.height * 0.66, bodyDimensions.length * 0.52)
  group.add(body, cabin, rear)

  return group
}

function trafficBodyDimensions(kind: TrafficVehicle['kind']): {
  width: number
  height: number
  length: number
} {
  if (kind === 'truck') {
    return { width: 3.2, height: 1.45, length: 6.2 }
  }
  if (kind === 'van') {
    return { width: 2.9, height: 1.35, length: 5.2 }
  }
  return { width: 2.55, height: 1.05, length: 4.6 }
}

function createPropMesh(level: LevelManifest, prop: RoadsideProp): THREE.Object3D {
  const sample = sampleTrack(level, prop.distance)
  const group = new THREE.Group()
  const x = sample.centerX + prop.side * (sample.roadWidth * 0.5 + prop.offset)
  group.position.set(x, sample.elevation, -prop.distance)

  if (prop.kind === 'palm') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.42, 6, 4),
      new THREE.MeshLambertMaterial({ color: 0x603a35, flatShading: true }),
    )
    trunk.position.y = 3
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 4.2, 5),
      new THREE.MeshLambertMaterial({ color: prop.color, flatShading: true }),
    )
    crown.position.y = 7
    group.add(trunk, crown)
  } else if (prop.kind === 'sign') {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 4.2, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xf4e4a8 }),
    )
    post.position.y = 2.1
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.1, 0.35),
      new THREE.MeshLambertMaterial({ color: prop.color }),
    )
    sign.position.y = 5
    group.add(post, sign)
  } else {
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(2.2, 0),
      new THREE.MeshLambertMaterial({ color: prop.color, flatShading: true }),
    )
    crystal.position.y = 2.5
    group.add(crystal)
  }

  return group
}

function createPlayerCar(): THREE.Group {
  const group = new THREE.Group()
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xff2f87, flatShading: true })
  const glassMaterial = new THREE.MeshLambertMaterial({ color: 0x89f7ff, flatShading: true })
  const tireMaterial = new THREE.MeshLambertMaterial({ color: 0x11111d, flatShading: true })
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 5.2), bodyMaterial)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 2.1), glassMaterial)
  cabin.position.set(0, 0.74, -0.62)
  group.add(body, cabin)

  for (const x of [-1.75, 1.75]) {
    for (const z of [-1.8, 1.8]) {
      const tire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 1.0), tireMaterial)
      tire.position.set(x, -0.22, z)
      group.add(tire)
    }
  }

  return group
}

function createHorizon(): THREE.Group {
  const group = new THREE.Group()
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 18),
    new THREE.MeshBasicMaterial({ color: 0xffd36e }),
  )
  sun.position.set(0, 78, -520)
  group.add(sun)

  const mountainsMaterial = new THREE.MeshBasicMaterial({ color: 0x2a2454 })
  for (let index = 0; index < 9; index += 1) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(38, 72, 3), mountainsMaterial)
    peak.position.set(-190 + index * 48, 18 + (index % 2) * 5, -610)
    peak.rotation.y = Math.PI / 4
    group.add(peak)
  }

  return group
}

function addQuad(positions: number[], quad: number[]): void {
  positions.push(
    quad[0],
    quad[1],
    quad[2],
    quad[3],
    quad[4],
    quad[5],
    quad[6],
    quad[7],
    quad[8],
    quad[0],
    quad[1],
    quad[2],
    quad[6],
    quad[7],
    quad[8],
    quad[9],
    quad[10],
    quad[11],
  )
}

function pushQuadColor(colors: number[], color: THREE.Color): void {
  for (let index = 0; index < 6; index += 1) {
    colors.push(color.r, color.g, color.b)
  }
}
