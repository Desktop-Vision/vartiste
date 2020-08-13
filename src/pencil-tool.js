import {Sfx} from './sfx.js'
import {Util} from './util.js'
import {Pool} from './pool.js'
import Color from "color"

AFRAME.registerSystem('pencil-tool', {
  clonePencil() {
    if (!this.lastGrabbed) return
    this.lastGrabbed.createLockedClone()
  },
  deletePencil() {
    if (!this.lastGrabbed) return
    if (!this.lastGrabbed.data.locked) return
    this.lastGrabbed.el.remove()
  },
  unlockPencil() {
    if (!this.lastGrabbed) return
    if (!this.lastGrabbed.data.locked) return
    let system = this.systems['paint-system']
    let tool = this.lastGrabbed.el.components['hand-draw-tool']
    if (!tool) return
    Object.assign(system.data, tool.system.data)
    system.brush = tool.system.brush
    system.el.emit('brushchanged', {brush: system.brush})
  },
  toggleGrabRotation() {
    document.querySelectorAll('*[manipulator]').forEach(e=>{
      if (e.is("rotating"))
      {
        e.removeState("rotating")
      }
      else
      {
        e.addState("rotating")
      }
    })
  },
  toggleTriggerGrab() {
    document.querySelectorAll('*[manipulator]').forEach(e=>{
      if (e.is("grabmode"))
      {
        e.removeState("grabmode")
        e.removeEventListener('triggerdown', e.components.manipulator.onGripClose)
        e.removeEventListener('triggerup', e.components.manipulator.onGripOpen)
      }
      else
      {
        e.addState("grabmode")
        e.addEventListener('triggerdown', e.components.manipulator.onGripClose)
        e.addEventListener('triggerup', e.components.manipulator.onGripOpen)
      }
    })
  },
})

AFRAME.registerComponent('pencil-tool', {
  dependencies: ['grab-activate', 'six-dof-tool'],
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
    detailTip: {type: 'boolean', default: false},

    radius: {default: 0.03},
    tipRatio: {default: 0.2},
    extraStates: {type: 'array'},

    enabled: {default: true},

    locked: {default: false}
  },
  events: {
    'bbuttonup': function(e) {
      this.createLockedClone()
    },
    'stateadded': function(e) {
      if (e.detail === 'grabbed') {
        this.system.lastGrabbed = this
      }
    },
    activate: function() { this.activatePencil() }
  },
  init() {
    this.el.classList.add('grab-root')

    this.el.sceneEl.systems['button-caster'].install(['bbutton'])

    for (let s of this.data.extraStates)
    {
      this.el.addState(s)
    }

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('segments-radial', 10)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.handle = cylinder
    this.el.append(cylinder)

    let tip;

    if (this.data.detailTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
      tip.setAttribute('segments-height', 2)
      tip.setAttribute('segments-radial', 4)
    }
    else if (this.data.pressureTip)
    {
      tip = document.createElement('a-sphere')
      tip.setAttribute('radius', tipHeight / 2)
      tip.setAttribute('segments-height', 12)
      tip.setAttribute('segments-width', 16)
    }
    else if (this.data.scaleTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
      tip.setAttribute('segments-height', 2)
      tip.setAttribute('segments-radial', 16)
    }
    else
    {
      tip = document.createElement('a-cylinder')
      tip.setAttribute('radius', radius / 2)
      tip.setAttribute('segments-height', 1)
      tip.setAttribute('segments-width', 16)
    }
    tip.setAttribute('height', tipHeight)
    tip.setAttribute('position', `0 -${cylinderHeight / 2 + tipHeight / 2} 0`)

    if (this.el.is("erasing"))
    {
      tip.setAttribute('material', 'metalness: 0; roughness: 0.9; color: #eee')
    }
    else
    {
      tip.setAttribute("show-current-color", "")

      if (this.data.detailTip)
      {
        Util.whenLoaded(tip, () => {
          tip.setAttribute('material', {shader: 'standard'})
          tip.getObject3D('mesh').material.flatShading = true
          tip.getObject3D('mesh').material.needsUpdate = true
        })
      }
    }
    tip.classList.add('clickable')
    tip.setAttribute('propogate-grab', "")
    this.el.append(tip)
    tip.setAttribute('material', 'side: double')
    this.tip = tip

    let brushPreview = document.createElement('a-plane')
    brushPreview.setAttribute("show-current-brush", "")
    brushPreview.setAttribute('width', radius)
    brushPreview.setAttribute('height', radius)
    brushPreview.setAttribute('rotation', '-90 180 0')
    brushPreview.setAttribute('position', `0 ${cylinderHeight / 2 + 0.0001} 0`)
    this.el.append(brushPreview)


    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)
    this.el.object3D.up.set(0, 0, 1)

    this.el.setAttribute('hand-draw-tool', "")
    this.el.setAttribute('grab-options', "showHand: false")

    // Pre-activation
    this.raycasterTick = this.el.components.raycaster.tick
    this.el.components.raycaster.tick = function() {}

  },
  update(oldData) {
    this.updateEnabled()

    if (this.el.hasAttribute('preactivate-tooltip') && !this.el.hasAttribute('tooltip-style'))
    {
      this.el.setAttribute('tooltip-style', "scale: 0.3 0.3 1.0; offset: 0 -0.2 0")
    }
  },
  activatePencil({subPencil = false} = {}) {
    console.log("Activating pencil")
    if (this.raycasterTick) this.el.components.raycaster.tick = this.raycasterTick
    this.el.addEventListener('raycaster-intersection', e => {
      if (!this.data.enabled) return
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    })

    this.el.addEventListener('raycaster-intersection-cleared', e => {
      if (!this.data.enabled) return
      this.el.components['hand-draw-tool'].endDraw()
      this.el.components['hand-draw-tool'].isDrawing = false
    })

    this.el.addEventListener('click', e => {
      if (this.el.is('grabbed'))
      {
        this.data.enabled = !this.data.enabled
        this.updateEnabled()
      }
    })

    // Move the pencil's parent to the world root, so it doesn't get
    // accidentally hidden when the UI is hidden
    if (!subPencil)
    {
      let wm = new THREE.Matrix4
      this.el.object3D.updateMatrixWorld()
      wm.copy(this.el.object3D.matrixWorld)
      this.el.object3D.parent.remove(this.el.object3D)
      document.querySelector('#world-root').object3D.add(this.el.object3D)
      Util.applyMatrix(wm, this.el.object3D)
    }

    this.tick = AFRAME.utils.throttleTick(this._tick, this.data.throttle, this)
    this.activatePencil = function() { throw new Error("Tried to activate already activated pencil") }
  },
  calcFar() {
    return this.tipHeight * this.el.object3D.scale.x
  },
  updateRaycaster: function(far)
  {
    // setAttribute constitutes a memory problem. So just do this part manually
    let data = this.data
    var raycaster = this.raycaster;

    // Set raycaster properties.
    raycaster.far = data.far;
    raycaster.near = data.near;

    // Calculate unit vector for line direction. Can be multiplied via scalar to performantly
    // adjust line length.
    this.unitLineEndVec3.copy(data.origin).add(data.direction).normalize();
  },
  updateDrawTool() {
    let far = this.calcFar()
    this.el.components.raycaster.data.far = far
    this.updateRaycaster.call(this.el.components.raycaster)
    let handDrawTool = this.el.components['hand-draw-tool']
    let intersection = this.el.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]

    if (intersection)
    {
      let ratio = intersection.distance / far
      if (this.data.scaleTip)
      {
        handDrawTool.distanceScale = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        handDrawTool.distanceScale = 1.0
      }

      if (this.data.pressureTip)
      {
        handDrawTool.pressure = THREE.Math.lerp(1.0, 0.1, ratio)
      }
      else
      {
        this.el.components['hand-draw-tool'].pressure = 1.0
      }
    }
  },
  _tick() {
    this.updateDrawTool()
  },
  tick() {},
  updateEnabled() {
    this.tip.setAttribute('visible', this.data.enabled)

    let handDrawTool = this.el.components['hand-draw-tool']
    if (!this.data.enabled && handDrawTool.isDrawing)
    {
      console.log("Ending draw")
      handDrawTool.endDraw()
      handDrawTool.isDrawing = false
    }
    else if (this.data.enabled && this.el.components.raycaster.intersectedEls.length > 0)
    {
      handDrawTool.isDrawing = true
      handDrawTool.startDraw()
    }
  },
  createLockedClone() {
    let clone = document.createElement('a-entity')
    this.el.parentEl.append(clone)
    clone.setAttribute('pencil-tool', Object.assign({}, this.el.getAttribute('pencil-tool'), {locked: true}))

    Util.whenLoaded(clone, () => {
      Util.positionObject3DAtTarget(clone.object3D, this.el.object3D)
      let newComponent = clone.components['pencil-tool']
      let handDrawTool = clone.components['hand-draw-tool']
      let oldPaintSystem = handDrawTool.system
      if (newComponent.tip.hasAttribute('show-current-color'))
      {
        newComponent.tip.removeAttribute('show-current-color')
        newComponent.tip.setAttribute('material', {color: oldPaintSystem.data.color, shader: 'flat'})
      }

      newComponent.handle.setAttribute('material', 'emissive', Color(`hsl(${Math.random() * 360}, 100%, 80%)`).rgb().hex())
      newComponent.handle.setAttribute('material', 'emissiveIntensity', 0.04)

      handDrawTool.system = {
        data: Object.assign({}, oldPaintSystem.data),
        brush: oldPaintSystem.brush.clone()
      }

      clone.emit('activated', {})
    })

    return clone
  }
})

AFRAME.registerComponent('multi-pencil-base', {
  init() {
    this.el.setAttribute('grab-options', "showHand: false")
    this.el.classList.add('grab-root')

    let activate = (e) => {
      if (e.detail === 'grabbed')
      {
        this.el.querySelectorAll('*[pencil-tool]').forEach(e => e.components['pencil-tool'].activatePencil({subPencil: true}))
        this.el.removeEventListener('stateadded', activate)
      }
    };
    this.el.addEventListener('stateadded', activate)

  },
  calcFarFn(pencil) {
    return (() => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x)
  }
})

AFRAME.registerComponent('pencil-broom', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  init() {
    this.base = this.el.components['multi-pencil-base']

    for (let j = 0; j < 4; j++)
    {
      for (let i = 0; i < 3; i++)
      {
        let pencil = document.createElement('a-entity')
        pencil.setAttribute('pencil-tool', "")
        pencil.setAttribute('position', `${j * 0.05 + (j % 2) *0.02} 0 ${i * 0.05}`)
        pencil['redirect-grab'] = this.el
        this.el.append(pencil)
        pencil.components['pencil-tool'].calcFar = this.base.calcFarFn(pencil)
      }
    }
  },
})

AFRAME.registerComponent('spike-ball', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  init() {
    this.base = this.el.components['multi-pencil-base']
    for (let i = 0; i < 10; i++)
    {
      let pencil = document.createElement('a-entity')
      pencil.setAttribute('pencil-tool', "")
      pencil.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`)
      pencil['redirect-grab'] = this.el
      this.el.append(pencil)
      pencil.components['pencil-tool'].calcFar = this.base.calcFarFn(pencil)
    }

    // TODO: Need to make each pencil's far value match the parent scale
  }
})

AFRAME.registerComponent('hammer-tool', {
  dependencies: ['multi-pencil-base', 'six-dof-tool'],
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},
  },
  init() {
    let handleHeight = 0.3
    let handleRadius = 0.03
    let handle = document.createElement('a-cylinder')
    handle.setAttribute('radius', handleRadius)
    handle.setAttribute('height', handleHeight)
    handle.setAttribute('segments-radial', 10)
    handle.setAttribute('segments-height', 1)
    handle.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    handle.classList.add('clickable')
    handle.setAttribute('propogate-grab', "")
    this.el.append(handle)

    let headRadius = 0.05
    let headLength = 0.2
    let headHolder = document.createElement('a-entity')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('rotation', '0 0 90')
    headHolder.setAttribute('position', `0 ${handleHeight / 2.0} 0`)
    this.el.append(headHolder)
    let head = document.createElement('a-cylinder')
    this.head = head
    head.setAttribute('radius', headRadius)
    head.setAttribute('height', headLength)
    head.setAttribute('segments-radial', 10)
    head.setAttribute('segments-height', 1)
    // head.classList.add('clickable')
    head.setAttribute('propogate-grab', "")
    head.setAttribute('material', 'side: double; color: #aaa; metalness: 0.9; roughness: 0.4')
    head.setAttribute('raycaster', `objects: .canvas; showLine: true; direction: 0 1 0; origin: 0 0 0; far: ${headLength / 2}`)
    head.setAttribute('hand-draw-tool', "")
    headHolder.append(head)

    let tip = document.createElement('a-sphere')
    tip.setAttribute('radius', 0.01)
    tip.setAttribute('show-current-color', "")
    tip.setAttribute('position', `0 ${headLength / 2} 0`)
    tip.setAttribute('propogate-grab', "")
    tip.setAttribute('segments-height', 8)
    tip.setAttribute('segments-width', 12)
    head.append(tip)
    this.tip = tip

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)

    head.addEventListener('raycaster-intersection', e => {
      let pct = THREE.Math.mapLinear(this.speed, 0, 0.008, 0, 1)
      console.log("Hit", this.speed, pct)
      // this.updateDrawTool()
      let handDrawTool = head.components['hand-draw-tool']
      handDrawTool.pressure = pct
      // handDrawTool.distanceScale = pct
      handDrawTool.isDrawing = true
      handDrawTool.hasDrawn = false
      handDrawTool.singleShot = true
      handDrawTool.startDraw()
      Sfx.bang(this.el)
      this.el.addState('hitting')
    })

    head.addEventListener('raycaster-intersection-cleared', e => {
      console.log("Hit cleared")
      this.el.removeState('hitting')
    })
  },
  tick(t, dt) {
    if (!this.velocity)
    {
      this.velocity = new THREE.Vector3()
      this.lastPosition = new THREE.Vector3()
      this.position = new THREE.Vector3()
      this.tip.object3D.getWorldPosition(this.lastPosition)
      return
    }

    if (this.el.is("hitting"))
    {
      let handDrawTool = this.head.components['hand-draw-tool']
      if (handDrawTool.hasDrawn)
      {
        handDrawTool.isDrawing = false
        handDrawTool.hasDrawn = false
        handDrawTool.endDraw()
      }
      return
    }

    let {lastPosition, position, velocity} = this
    this.tip.object3D.getWorldPosition(position)
    velocity.subVectors(position, lastPosition)
    this.speed = velocity.length() / dt
    lastPosition.copy(position)
    // console.log(this.speed)
  }
})

AFRAME.registerComponent('drip-tool', {
  dependencies: ['six-dof-tool'],
  schema: {
    radius: {default: 0.06},
    tipRatio: {default: 0.2},

    maxRate: {default: 120},
  },
  events: {
    click: function(e) { this.addDrop() }
  },
  init() {
    Pool.init(this)
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")

    let radius = this.data.radius
    let height = 0.3
    let tipHeight = height * this.data.tipRatio
    let cylinderHeight = height - tipHeight
    let cylinder = document.createElement('a-cylinder')
    this.height = height
    this.tipHeight = tipHeight
    cylinder.setAttribute('radius', radius)
    cylinder.setAttribute('height', cylinderHeight)
    cylinder.setAttribute('segments-radial', 10)
    cylinder.setAttribute('segments-height', 1)
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.setAttribute('position', `0 ${-cylinderHeight / 2.0} 0`)
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    this.drops = []
    this.raycaster = new THREE.Raycaster()
  },
  addDrop() {
    let drop = document.createElement('a-sphere')
    drop.setAttribute('radius', this.data.radius * 2.0 / 3.0)
    drop.setAttribute('color', this.el.sceneEl.systems['paint-system'].brush.color)
    Util.whenLoaded(drop, () => {
      drop.object3D.position.copy(this.el.object3D.position)
    })
    drop.object3D.velocity = new THREE.Vector3(0, 0, 0)
    this.el.parentEl.append(drop)
    this.drops.push(drop)
  },
  tick(t,dt) {
    this.updateDrops(t, dt)

    if (!this.el.is("grabbed")) return

    let up = this.pool('up', THREE.Vector3)
    up.set(0, 1.0, 0)
    up.transformDirection(this.el.object3D.matrixWorld)
    let amount = (1 - up.dot(this.el.sceneEl.object3D.up)) / 2.0

    amount = THREE.Math.smootherstep(amount, 0.005, 1.0)

    if (!this.lastDropTime) {
      this.lastDropTime = t
      return
    }

    let expectedInterval = this.data.maxRate / amount

    if (t - this.lastDropTime > expectedInterval)
    {
      this.addDrop()
      this.lastDropTime = t
    }
  },
  updateDrops(t,dt) {
    if (this.drops.length === 0) return
    let nextPos = this.pool('nextPos', THREE.Vector3)
    let objects = Array.from(document.querySelectorAll('.canvas, .clickable')).filter(el => !(el == this.el || this.el.contains(el))).map(o => o.object3D)

    let direction = this.pool('dir', THREE.Vector3)
    let posWorld = this.pool('posWorld', THREE.Vector3)

    let intersections = []

    for (let drop of this.drops)
    {
      let d3D = drop.object3D
      d3D.velocity.y += - 9.8 * dt / 1000.0 / 1000.0

      d3D.velocity.clampLength(0, 0.005)
      nextPos.copy(d3D.position)
      nextPos.addScaledVector(d3D.velocity, dt)

      direction.copy(d3D.velocity).transformDirection(d3D.matrixWorld).normalize()

      posWorld.copy(d3D.position)
      d3D.parent.localToWorld(posWorld)

      this.raycaster.set(posWorld, direction)
      this.raycaster.far = d3D.velocity.length() * dt + 0.01

      intersections.length = 0
      this.raycaster.intersectObjects(objects, true, intersections)

      let intersection = intersections.filter(i => i.object.el).sort(i => navigator.xr ? i.distance : - i.distance)[0]

      if (intersection)
      {
        this.removeDrop(drop)

        let el = intersection.object.el
        if (el)
        {
          let isDrawable = false
          let drawCanvas
          if ('draw-canvas' in el.components)
          {
            isDrawable = true
            drawCanvas = el.components['draw-canvas']
          }
          else if ('forward-draw' in el.components)
          {
            isDrawable = true
            drawCanvas = el.components['forward-draw']
          }
          if (isDrawable)
          {
            drawCanvas.drawUV(intersection.uv, {})
          }
        }
      }

      d3D.position.copy(nextPos)

      if (d3D.position.length() > 10) this.removeDrop()
    }
  },
  removeDrop(drop) {
    if (this.drops.indexOf(drop) < 0) return
    Sfx.play('sfx-05', drop)
    this.el.parentEl.removeChild(drop)
    this.drops.splice(this.drops.indexOf(drop), 1)
  },
})

AFRAME.registerComponent('vertex-tool', {
  dependencies: ['pencil-tool'],
  init() {

  },
})

AFRAME.registerComponent('six-dof-tool', {
  events: {
    click: function(e) {
      if (e.detail && e.detail.type === "speech")
      {
        this.flyToUser()
      }
    }
  },
  flyToUser() {
    let target = document.querySelector('#camera')
    Util.positionObject3DAtTarget(this.el.object3D, target.object3D, {transformOffset: {x: 0, y: 0, z: -0.5}})
    this.el.emit('activate')
  }
})
