AFRAME.registerComponent('pencil-tool', {
  schema: {
    throttle: {type: 'int', default: 30},
    scaleTip: {type: 'boolean', default: true},
    pressureTip: {type: 'boolean', default: false},

    radius: {default: 0.03},
    tipRatio: {default: 0.2},
    extraStates: {type: 'array'}
  },
  init() {
    this.el.classList.add('grab-root')

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
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip;

    if (this.data.pressureTip)
    {
      tip = document.createElement('a-sphere')
      tip.setAttribute('radius', tipHeight / 2)
    }
    else if (this.data.scaleTip)
    {
      tip = document.createElement('a-cone')
      tip.setAttribute('radius-top', radius)
      tip.setAttribute('radius-bottom', 0)
    }
    else
    {
      tip = document.createElement('a-cylinder')
      tip.setAttribute('radius', radius / 2)
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
    }
    tip.classList.add('clickable')
    tip.setAttribute('propogate-grab', "")
    this.el.append(tip)
    tip.setAttribute('material', 'side: double')

    // let brushPreview = document.createElement('a-plane')
    // brushPreview.setAttribute("show-current-brush", "")
    // brushPreview.setAttribute('width', radius)
    // brushPreview.setAttribute('height', radius)
    // brushPreview.setAttribute('rotation', '-90 0 0')
    // brushPreview.setAttribute('position', `0 ${cylinderHeight / 2 + 0.0001} 0`)
    // this.el.append(brushPreview)


    this.el.setAttribute('raycaster', `objects: .canvas; showLine: false; direction: 0 -1 0; origin: 0 -${cylinderHeight / 2} 0; far: ${tipHeight}`)

    this.el.addEventListener('raycaster-intersection', e => {
      console.log("Hand draw initialized")
      this.updateDrawTool()
      this.el.components['hand-draw-tool'].isDrawing = true
      this.el.components['hand-draw-tool'].startDraw()
    })

    this.el.addEventListener('raycaster-intersection-cleared', e => {
      this.el.components['hand-draw-tool'].endDraw()
    })

    this.el.setAttribute('hand-draw-tool', "")
    this.el.setAttribute('grab-options', "showHand: false")

    this._tick = this.tick
    this.tick = AFRAME.utils.throttleTick(this.tick, this.data.throttle, this)
  },
  calcFar() {
    return this.tipHeight * this.el.object3D.scale.x
  },
  updateDrawTool() {
    let far = this.calcFar()
    this.el.setAttribute('raycaster', {far})
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
  tick() {
    let handDrawTool = this.el.components['hand-draw-tool']
    if (!handDrawTool.isDrawing) return
    this.updateDrawTool()
  }
})

AFRAME.registerComponent('pencil-broom', {
  init() {
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")
    for (let j = 0; j < 4; j++)
    {
      for (let i = 0; i < 3; i++)
      {
        let pencil = document.createElement('a-entity')
        pencil.setAttribute('pencil-tool', "")
        pencil.setAttribute('position', `${j * 0.05 + (j % 2) *0.02} 0 ${i * 0.05}`)
        pencil['redirect-grab'] = this.el
        this.el.append(pencil)
        pencil.components['pencil-tool'].calcFar = () => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x
      }
    }
  },
})

AFRAME.registerComponent('spike-ball', {
  init() {
    this.el.classList.add('grab-root')
    this.el.setAttribute('grab-options', "showHand: false")
    for (let i = 0; i < 10; i++)
    {
      let pencil = document.createElement('a-entity')
      pencil.setAttribute('pencil-tool', "")
      pencil.setAttribute('rotation', `${Math.random() * 360} ${Math.random() * 360} ${Math.random() * 360}`)
      pencil['redirect-grab'] = this.el
      this.el.append(pencil)
      pencil.components['pencil-tool'].calcFar = () => pencil.components['pencil-tool'].tipHeight * this.el.object3D.scale.x
    }

    // TODO: Need to make each pencil's far value match the parent scale
  }
})
