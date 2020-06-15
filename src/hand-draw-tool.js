import {Pool} from './pool.js'
import {Sfx} from './sfx.js'
import shortid from 'shortid'

AFRAME.registerComponent('hand-draw-tool', {
  dependencies: ['raycaster'],
  schema: {
    throttle: {type: 'int', default: 10}
  },
  init() {
    Pool.init(this)
    this.system = this.el.sceneEl.systems['paint-system']
    this.intersects = []
    this.clickStamp = 0
    this.distanceScale = 1.0
    this.id = shortid.generate()
    this.el.addEventListener('triggerchanged', (e) => {
      let threshold = 0.1
      this.pressure = (0 + e.detail.value - threshold)  / (1 - threshold)
      let wasDrawing = this.isDrawing
      this.isDrawing = this.pressure > 0.1

      if (this.isDrawing && !wasDrawing) {
        this.startDraw()
      }
      if (!this.isDrawing && wasDrawing) {
        this.endDraw()
      }
    })

    if (this.el.hasAttribute('cursor'))
    {
      document.addEventListener('mousedown', e => {
        if (e.button !== 0) return
        if (e.shiftKey) return
        if (this.el.is('looking')) return
        this.pressure = 1.0
        this.isDrawing = true
        this.startDraw()
      })

      document.addEventListener('mouseup', e=> {
        if (e.button !== 0) return
        if (this.el.is('looking')) return
        if (this.isDrawing) {
          this.isDrawing = false
          this.endDraw()
        }
      })

      document.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return
        if (e.shiftKey) return
        if (this.el.is('looking')) return
        this.pressure = 1.0
        this.isDrawing = true
        this.startDraw()
      })

      document.addEventListener('touchend', e => {
        if (this.el.is('looking')) return
        if (this.isDrawing) {
          this.isDrawing = false
          this.endDraw()
        }
      })

      document.addEventListener('wheel', e => {
        if (e.shiftKey) return
        this.el.sceneEl.systems['paint-system'].scaleBrush(-e.deltaY * ((e.deltaY > 50 || e.deltaY < -50) ? 1 : 100))
      })
    }

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  startDraw() {
    console.log("Start drawing")
    this.el.emit('startdrawing')
  },
  endDraw() {
    console.log("End drawing")
    this.el.emit('enddrawing')
    this.lastParams = undefined
  },
  tick() {
    if (this.lastCompositor) delete this.lastCompositor.components.compositor.overlays[this.id]
    if (this.el.components.raycaster.intersections.length == 0) return

    let intersection = this.el.components.raycaster.intersections.sort(i => navigator.xr ? i.distance : - i.distance)[0]
    let el = intersection.object.el

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

    let rotation = 0

    if (this.system.data.rotateBrush)
    {
      let objRot = this.pool('objRot', THREE.Quaternion)
      intersection.object.getWorldQuaternion(objRot)
      let objUp = this.pool('objUp', THREE.Vector3)
      objUp.set(0, 1, 0)
      objUp.applyQuaternion(objRot)

      let objDir = this.pool('objForward', THREE.Vector3)
      objDir.copy(intersection.point)
      let thisPos = this.pool('thisPos', THREE.Vector3)
      this.el.object3D.getWorldPosition(thisPos)
      objDir.sub(thisPos)
      objDir.normalize()

      let objRight = this.pool('objRight', THREE.Vector3)
      objRight.crossVectors(objDir, objUp)


      let thisRot = this.pool('thisRot', THREE.Quaternion)
      this.el.object3D.getWorldQuaternion(thisRot)
      let thisUp = this.pool('thisUp', THREE.Vector3)
      thisUp.copy(this.el.object3D.up)
      thisUp.applyQuaternion(thisRot)

      rotation = Math.atan2(thisUp.dot(objUp), thisUp.dot(objRight))

      if (intersection.object.el.hasAttribute('geometry'))
      {
        rotation = Math.PI / 2 - rotation
      }
      else
      {
        rotation = Math.PI / 2 + rotation
      }
    }

    let params = {pressure: this.pressure, rotation: rotation, sourceEl: this.el, distance: intersection.distance, scale: this.distanceScale, intersection: intersection}

    if (this.hasDrawn && this.singleShot) return

    if (this.isDrawing && !this.el.is("erasing")) {
      this.hasDrawn = true
      if (isDrawable)
      {
        Sfx.draw(this.el)
        drawCanvas.drawUV(intersection.uv, Object.assign({lastParams: this.lastParams}, params))
        this.lastParams = params
        this.lastParams.uv = intersection.uv
      }
      else
      {
        // console.log("emitting draw to", el, intersection)
        el.emit("draw", params)
      }
    }
    if (this.el.is("sampling"))
    {
      if (isDrawable)
      {
        this.system.selectColor(drawCanvas.pickColorUV(intersection.uv))
      }
    }
    if (this.el.is("erasing"))
    {
      if (isDrawable)
      {
        drawCanvas.eraseUV(intersection.uv, params)
      }
    }

    if (isDrawable)
    {
      let targetCompositor = (drawCanvas.target || drawCanvas).el
      if (targetCompositor.components.compositor)
      {
        targetCompositor.components.compositor.overlays[this.id] = Object.assign({uv: intersection.uv, el: this.el}, params)
        this.lastCompositor = targetCompositor
      }

    }
  }
})
