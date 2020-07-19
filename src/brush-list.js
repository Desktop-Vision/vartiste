import {ProceduralBrush, ImageBrush, LambdaBrush, FillBrush, NoiseBrush, FxBrush} from './brush.js'
const BrushList = [
  new ProceduralBrush({connected: true, hqBlending: true, tooltip: "Default"}),
  new ImageBrush('silky_textured', {width: 20, height: 20, autoRotate: true}),
  new ImageBrush('silky_textured', {textured: true, width: 64, height:16}),
  new ProceduralBrush({width: 20, height: 20, hardness: 0.9, connected: true, hqBlending: true, tooltip: "Hard"}),
  new ImageBrush('lines_condensed', {width: 20, height: 20, connected: true, dragRotate: true, tooltip: "Paint Brush"}),
  new ImageBrush('lines_condensed1', {width: 20, height: 20, connected: true, dragRotate: true, textured: true}),
  new ImageBrush('line_grunge2', {width: 20, height: 20}),
  new ImageBrush('line_grunge1', {width: 64, height: 16, textured: true}),
  new ImageBrush('dots', {width: 20, height: 20, autoRotate: true, drawEdges: false}),
  new LambdaBrush({connected: true, drawEdges: true, hqBlending: true, tooltip: "Vertical Line"}, (ctx, {width, height}) => {
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.stroke()
  }),
  new LambdaBrush({connected: true, drawEdges: true, hqBlending: true, tooltip: "Square"}, (ctx, {width, height}) => { ctx.fillRect(0,0,width,height)  }),
  new ImageBrush('diamond', {width: 20, height: 20, connected: true, hqBlending: true}),
  new FillBrush(),
  new FillBrush({mode: "source-atop", previewSrc: require('./assets/masked-bucket.png')}),
  new NoiseBrush(),
  new NoiseBrush({round: true}),
  new ImageBrush('cloth', {widht: 48, height: 48, drawEdges: true}),
  new FxBrush({baseBrush: new ProceduralBrush({connected: true, hqBlending: false}), type: 'blur', previewSrc: require('./assets/blur-preview.png')}),
  new FxBrush({baseBrush: new ProceduralBrush({connected: true, hqBlending: false}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
  new FxBrush({baseBrush: new ImageBrush('lines2', {width: 40, height: 20, connected: true}), dragRotate: true, type: 'nudge', previewSrc: require('./assets/nudge-brush.png')}),
  new ProceduralBrush({connected: true, hqBlending: 'always', minMovement: 1.3, invertScale: true, tooltip: "Charcoal Pencil"}),
]

export { BrushList }
