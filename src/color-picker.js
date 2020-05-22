// Based on https://jsfiddle.net/gftruj/tLo2vh99/
const Color = require('color')
const {Undo} = require('./undo.js')

AFRAME.registerComponent("color-picker", {
  schema: {brightness: {type: 'float', default: 0.5}},
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/color-wheel.glsl')

    var material = new THREE.ShaderMaterial({
      uniforms: {
        brightness: {
          type: 'f',
          value: this.data.brightness
        }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.mesh = this.el.getObject3D('mesh');

    this.mesh.material = material;

		this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv
      point.x = point.x * 2 - 1
      point.y = point.y * 2 - 1

      var polarPosition = {
        r: Math.sqrt(point.x * point.x + point.y * point.y),
        theta: Math.PI + Math.atan2(point.y, point.x)
      };
      var angle = ((polarPosition.theta * (180 / Math.PI)) + 180) % 360;
      var h, s, l
      h = angle / 360;
      s = polarPosition.r;
      l = this.data.brightness;
      console.log(this.data.brightness, l)
      var color = Color({h: h * 360, s: s * 100,v:l * 100}).rgb().hex()
      this.handleColor(color)
    })
  },
  handleColor(color) {
    this.system.selectColor(color)
  },
  update(oldData) {
    this.mesh.material.uniforms.brightness.value = this.data.brightness
  }
})

AFRAME.registerComponent("brightness-picker", {
  schema: {target: {type: 'selector'}},
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/brightness-ramp.glsl')

    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
    });

    this.mesh = this.el.getObject3D('mesh');

    this.mesh.material = material;

    this.el.addEventListener("draw", (e)=>{
      let point = e.detail.intersection.uv

      if (this.data.target)
      {
        this.data.target.setAttribute("color-picker", {brightness: point.y})

        let color = this.system.data.color
        this.system.selectColor(Color(color).value(100 * point.y).rgb().hex())
      }
      else
      {
        this.brightness = point.y
        this.el.emit('brightnesschanged', {brightness: this.brightness})
      }
    })
  }
})

AFRAME.registerComponent("opacity-picker", {
  init() {
    this.system = document.querySelector('a-scene').systems['paint-system']

    var vertexShader = require('./shaders/pass-through.vert')

    var fragmentShader = require('./shaders/opacity-ramp.glsl')

    var material = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true
    });

    this.mesh = this.el.getObject3D('mesh');
    this.mesh.material = material;

    let geometry = new THREE.Geometry()
    geometry.vertices.push(new THREE.Vector3(0,0.05,0.01))
    geometry.vertices.push(new THREE.Vector3(-0.05,0.2,0.01))
    geometry.vertices.push(new THREE.Vector3(0.05,0.2,0.01))
    geometry.faces.push(new THREE.Face3(0,1,2))
    this.indicator = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: 0xa87732, side: THREE.DoubleSide}))
    this.el.object3D.add(this.indicator)

    this.adjustIndicator(this.system.data.opacity)

    let edges = new THREE.EdgesGeometry( this.mesh.geometry );
    let edgeMaterial = new THREE.LineBasicMaterial( { color: 0xffffff, linewidth: 1 } );
    let edgeSegments = new THREE.LineSegments( edges, edgeMaterial );
    this.el.object3D.add( edgeSegments );

    this.el.addEventListener("click", (e)=> {
      if (this.layer && !this.wasDrawing) {
        let oldOpacity = this.layer.oldOpacity
        Undo.push(() => {
          this.layer.opacity = oldOpacity
          this.layer.touch()
        })
      }
      this.handleClick(e)
    })
    this.el.addEventListener("draw", (e)=>{
      if (this.layer && !this.wasDrawing)
      {
        this.wasDrawing  = true
        let oldOpacity = this.layer.opacity
        Undo.push(() => {
          this.layer.opacity = oldOpacity
          this.adjustIndicator(oldOpacity)
        })
        e.detail.sourceEl.addEventListener('enddrawing', () => {this.wasDrawing = false}, {once: true})
      }
      this.handleClick(e)
    })

    this.el.sceneEl.addEventListener('opacitychanged', (e) => {
      if (this.layer) return
      this.adjustIndicator(e.detail.opacity)
    })
  },
  adjustIndicator(opacity) {
    let width = this.mesh.geometry.metadata.parameters.width
    let x = Math.pow(opacity, 1/2.2)
    this.indicator.position.x = x * width - width / 2
  },
  handleClick(e) {
    let point = e.detail.intersection.uv

    let opacity = Math.pow(point.x, 2.2)

    if (opacity > 0.95) opacity = 1

    this.adjustIndicator(opacity)

    if (this.layer)
    {
      console.log("Setting layer opacity", opacity)
      this.layer.opacity = opacity
      this.layer.touch()
    }
    else
    {
      this.system.selectOpacity(opacity)
    }
  }
})

AFRAME.registerComponent("show-current-color", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.el.setAttribute('material', {shader: 'flat', transparent: true, color: this.system.data.color})
    this.el.sceneEl.addEventListener('colorchanged', (e) => {
      this.el.setAttribute('material', {color: e.detail.color})
    })
    this.el.sceneEl.addEventListener('opacitychanged', (e) => {
      //this.el.setAttribute('material', {opacity: e.detail.opacity})
    })
  }
})

AFRAME.registerComponent("show-current-brush", {
  init() {
    this.system = this.el.sceneEl.systems['paint-system']
    this.baseWidth = this.el.getAttribute('width')
    this.el.setAttribute('material', {shader: 'flat', transparent: true, color: '#fff'})
    let brushChanged = (brush) => {
      this.el.setAttribute('material', {src: brush.previewSrc})
      this.el.setAttribute('height', this.baseWidth / brush.width * brush.height)
    }
    this.el.sceneEl.addEventListener('brushchanged', e => brushChanged(e.detail.brush))
    brushChanged(this.system.brush)
  },
})

AFRAME.registerComponent("palette", {
  schema: {
    colors: {type: 'array'}
  },
  init() {
    this.el.addEventListener('click', (e) => {
      if (e.target.hasAttribute('click-action')) {
        this[e.target.getAttribute('click-action')](e)
        return
      }
      if (!e.target.hasAttribute("button-style")) return

      let system = this.el.sceneEl.systems['paint-system']
      system.selectOpacity(1.0)
      system.selectColor(e.target.getAttribute('button-style').color)
    })
  },
  update(oldData) {
    this.el.querySelectorAll('.custom').forEach(e => this.el.removeChild(e))

    for (let color of this.data.colors)
    {
      this.addButton(color)
    }
  },
  addToPalette(e) {
    let system = this.el.sceneEl.systems['paint-system']
    this.addButton(system.data.color)
    this.data.colors.push(system.data.color)
  },
  addButton(color) {
    let newButton = document.createElement('a-entity')
    newButton.setAttribute('icon-button', "")
    newButton.setAttribute('button-style', `color: ${color}`)
    newButton.setAttribute('tooltip', color)
    newButton.classList.add('custom')
    this.el.append(newButton)
  }
})
