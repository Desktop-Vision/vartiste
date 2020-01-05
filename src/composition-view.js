AFRAME.registerComponent('forward-draw', {
  schema: {type: 'selector'},
  update() {
    this.target = this.data.components['draw-canvas']
  },
  drawUV(...args) {
    this.target.drawUV(...args)
  },
  selectColor(...args) {
    this.target.selectColor(...args)
  },
  eraseUV(...args) {
    this.target.eraseUV(...args)
  }
})

AFRAME.registerComponent('composition-view', {
  dependencies: ['gltf-model'],
  schema: {
    compositor: {type: 'selector'}
  },
  init() {
    this.el.classList.add('canvas')

    if (!this.data.compositor.hasLoaded)
    {
      this.data.compositor.addEventListener('loaded', e => this.setupCanvas())
    }
    else
    {
      this.setupCanvas()
    }

    // this.setAttribute("draw-canvas", {canvas: this.compositor.canvasthing})
  },
  setupCanvas(){
    console.log("SetupCanvas")
    this.compositor = this.data.compositor.components.compositor
    let {compositor} = this
    this.el.setAttribute('forward-draw', this.data.compositor)
  },
  tick() {
    if (!this.inited && this.el.getObject3D('mesh'))
    {
      this.el.getObject3D('mesh').traverse(o => {
        if (o.type == "Mesh") { o.material = this.data.compositor.getObject3D('mesh').material}
      })
      this.inited = true
    }
  }
})
