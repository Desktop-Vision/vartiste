import {Util} from './util.js'
import {Pool} from './pool.js'
import {Undo} from './undo.js'
import {bumpCanvasToNormalCanvas} from './material-transformations.js'
import {CanvasShaderProcessor} from './canvas-shader-processor.js'
import {FX} from './layer-modes.js'

// Allows you to easily run predifined shader effects without needing to worry
// about setting up a [`CanvasShaderProcessor`](#CanvasShaderProcessor)
//
// Use the `availableFX` property to see which effects are available.
AFRAME.registerSystem('canvas-fx', {
  init() {
    this.processors = {}
    this.availableFX = FX
  },
  processorFor(fx) {
    // if (fx in this.processors) return this.processors[fx];
    this.processors[fx] = new CanvasShaderProcessor({fx})
    return this.processors[fx]
  },

  // Applies the effect named by `fx` to the canvas given by `canvas`. `fx` must
  // be one of the preset effects listed in `availableFX`
  applyFX(fx, canvas) {
    let processor = this.processorFor(fx)
    return this.applyProcessor(processor, canvas)
  },
  applyProcessor(processor, canvas) {
    if (!canvas) canvas = Compositor.drawableCanvas
    if (canvas instanceof AFRAME.AEntity) canvas = canvas.getObject3D('mesh').material.map.image
    Undo.pushCanvas(canvas)
    processor.setInputCanvas(canvas)
    processor.update()
    let ctx = canvas.getContext('2d')
    let oldOperation = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(processor.canvas,
                  0, 0, processor.canvas.width, processor.canvas.height,
                  0, 0, canvas.width, canvas.height
                  )
    ctx.globalCompositeOperation = oldOperation
    if (canvas.touch) canvas.touch()
    return canvas
  },
})
