let glBackingCanvas

const FX_UV_PASSTHROUGH = require('./shaders/fx-uv-passthrough.vert')

export class CanvasShaderProcessor {
  constructor({source, canvas, fx, vertexShader = FX_UV_PASSTHROUGH}) {
      if (fx) {
        source = require(`./shaders/fx/${fx}.glsl`)
      }

    this.source = source
    this.vertSource = vertexShader

    this.canvas = canvas
    if (!canvas)
    {
      if (!glBackingCanvas)
      {
        glBackingCanvas = document.createElement('canvas')
        glBackingCanvas.width = 2048
        glBackingCanvas.height = 2048
      }
      this.canvas = glBackingCanvas
    }

    this.textures = {}
    this.textureIdx = {}
  }
  getContext() {
    return this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl");
  }
  createShader(gl, type, source) {
    let shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader
  }
  getProgram(gl) {
    if (this.program)
    {
      gl.useProgram(this.program);
      return this.program
    }
    let vertexShader = this.createShader(gl, gl.VERTEX_SHADER, this.vertSource)
    let fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, this.source)

    let program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
      throw new Error(gl.getProgramInfoLog(program))
    }
    gl.useProgram(program);
    this.program = program

    this.initialUpdate();

    return this.program
  }
  setInputCanvas(canvas, {resize = true} = {}) {
    if (resize && (this.canvas.width !== canvas.width || this.canvas.height !== canvas.height))
    {
      this.canvas.width = canvas.width
      this.canvas.height = canvas.height
    }
    this.setupTexture(this.getContext(), "u_input", canvas)
    this.setUniform("u_width", "uniform1f", canvas.width)
    this.setUniform("u_height", "uniform1f", canvas.height)
  }
  setCanvasAttribute(name, canvas) {
    this.setupTexture(this.getContext(), name, canvas)
    this.setUniform(`${name}_width`, "uniform1f", canvas.width)
    this.setUniform(`${name}_height`, "uniform1f", canvas.height)
  }
  setUniform(name, type, value){
    let gl = this.getContext()
    let program = this.getProgram(gl)
    let location = gl.getUniformLocation(program, name)
    if (location)
    {
      if (typeof value === 'function') { value = value() }
      gl[type](location, value)
    }
  }
  setUniforms(type, vals) {
    for (let name in vals)
    {
      this.setUniform(name, type, vals[name])
    }
  }
  setupTexture(gl, name, textureCanvas) {
    let program = this.getProgram(gl)

    if (!this.textures[name])
    {
      console.log("Creating texture for", name)
      this.textures[name] = gl.createTexture()
      this.textureIdx[name] = Object.values(this.textures).length - 1
    }

    let texture = this.textures[name]
    let idx = this.textureIdx[name]

    if (!textureCanvas)
    {
      throw new Error("No canvas")
    }

    gl.activeTexture(gl.TEXTURE0 + idx);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    // Set the parameters so we can render any size image.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

   var location = gl.getUniformLocation(program, name);
   gl.uniform1i(location, idx);
  }
  initialUpdate()
  {
    let gl = this.getContext()
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    let program = this.getProgram(gl)

    let positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    let positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    var positions = this.vertexPositions || [
      -1, -1,
      1, -1,
      1, 1,
      1, 1,
      -1, 1,
      -1, -1
    ];
    let typedArray = new Float32Array(positions)
    this.positionLength = positions.length
    console.log("typedArray", typedArray)
    gl.bufferData(gl.ARRAY_BUFFER, typedArray, gl.STATIC_DRAW);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset)

    this.hasDoneInitialUpdate = true
  }
  createVertexBuffer({name, list, size, type, normalize = false, stride = 0, offset = 0}) {
    let gl = this.getContext()
    let program = this.getProgram(gl)
    let attributeLocation = gl.getAttribLocation(program, name);

    type = type === undefined ? gl.FLOAT : type

    if (type !== gl.FLOAT)
    {
      throw new Error("TODO: Update to support other types")
    }

    let buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(list), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attributeLocation)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.vertexAttribPointer(attributeLocation, size, type, normalize, stride, offset)
  }
  update() {
    let canvas = this.canvas
    let gl = this.getContext()

    gl.clear(gl.COLOR_BUFFER_BIT);

    let program = this.getProgram(gl)

    var primitiveType = gl.TRIANGLES;
    var offset = 0;
    var count = this.positionLength / 2;
    gl.drawArrays(primitiveType, offset, count);
  }
  drawBrush(brush, ctx, x, y, {rotation=0, pressure=1.0, distance=0.0, eraser=false, scale=1.0, reupdate=true} = {})
  {
    let {width, height, autoRotate} = brush
    width = Math.floor(width)
    height = Math.floor(height)

    this.setInputCanvas(ctx.canvas)

    this.initialUpdate()
    if (!('u_brush' in this.textures)) this.setCanvasAttribute("u_brush", brush.overlayCanvas)

    this.setUniform("u_color", "uniform3fv", brush.color3.toArray())
    this.setUniforms("uniform1f", {
      u_x: x,
      u_y: y,
      u_brush_width: brush.width * scale,
      u_brush_height: brush.height * scale,
      u_brush_rotation: autoRotate ? 2*Math.PI*Math.random() : rotation,
      u_opacity: brush.opacity * pressure,
      u_t: document.querySelector('a-scene').time % 1.0
    })

    this.update()

    ctx.globalAlpha = 1
    let oldOp = ctx.globalCompositeOperation
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(this.canvas,
      0, 0, this.canvas.width, this.canvas.height,
      0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = oldOp
  }
}

const FORWARD = new THREE.Vector3(0, 0, 1)

export class UVStretcher extends CanvasShaderProcessor
{
  constructor(options) {
    super(Object.assign({vertexShader: require('./shaders/stretch-brush-uv-passthrough.vert')}, options))
    this.vertexPositions = []
    this.uvs = []
  }
  createMesh(points) {
    let point1 = new THREE.Vector3
    let point2 = new THREE.Vector3
    let point3 = new THREE.Vector3
    let direction = new THREE.Vector3
    let direction2 = new THREE.Vector3
    this.vertexPositions.length = 0
    this.uvs.length = 0
    let distance = 0
    let segDistance = 0
    let accumDistance = 0
    for (let i = 0; i < points.length - 1; ++i)
    {
      point1.set(points[i].x, points[i].y, 0)
      point2.set(points[i + 1].x, points[i + 1].y, 0)
      point2.sub(point1)
      distance += point2.length()
    }

    for (let i = 0; i < points.length - 1; ++i)
    {
      point1.set(points[i].x, points[i].y, 0)
      point2.set(points[i + 1].x, points[i + 1].y, 0)

      direction.subVectors(point2, point1)
      segDistance = direction.length()

      if (i === 0)
      {
        direction.normalize()
        direction.cross(FORWARD)
        direction.multiplyScalar(points[i].scale * 0.01)
      }
      else
      {
        direction.copy(direction2)
      }

      if (i < points.length - 2)
      {
        point3.set(points[i + 2].x, points[i + 2].y, 0)
        direction2.subVectors(point3, point2)
        direction2.normalize()
        direction2.cross(FORWARD)
        direction2.multiplyScalar(points[i+1].scale * 0.01)
        direction2.lerp(direction, 0.5)
      }
      else
      {
        direction2.copy(direction)
      }

      let uvStart = accumDistance
      accumDistance += segDistance / distance
      let uvEnd = accumDistance

      // Tri 1
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y)
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y)
      this.vertexPositions.push(point1.x - direction.x, point1.y - direction.y)

      this.uvs.push(uvStart, 0,
                    uvEnd, 1,
                    uvStart, 1)



      // Tri 2
      this.vertexPositions.push(point2.x - direction2.x, point2.y - direction2.y)
      this.vertexPositions.push(point1.x + direction.x, point1.y + direction.y)
      this.vertexPositions.push(point2.x + direction2.x, point2.y + direction2.y)

      this.uvs.push(uvEnd, 1,
                    uvStart, 0,
                    uvEnd, 0)
    }

    this.hasDoneInitialUpdate = false
  }
  initialUpdate() {
    super.initialUpdate()
    this.createVertexBuffer({name: "a_uv", list: this.uvs, size: 2})
  }

}

window.CanvasShaderProcessor = CanvasShaderProcessor
