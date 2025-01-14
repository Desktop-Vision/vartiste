import shortid from 'shortid'
import {THREED_MODES} from "./layer-modes.js"
import {Util} from "./util.js"
import {Pool} from "./pool.js"
import {OutputNode, Layer} from './layer.js'

Util.registerComponentSystem('skeletonator-system', {
  schema: {
    lockLength: {default: false},
  }
})

AFRAME.registerComponent('skeletonator', {
  schema: {
    recording: {default: true},
    frameCount: {default: 50},
    recordFrameCount: {default: false},
    hideSkeleton: {default: false},
    useTracks: {default: false},
  },
  init() {
    Pool.init(this)
    window.Skeletonator = this
    this.system = this.el.sceneEl.systems['skeletonator-system']
    this.system.skeletonator = this
    this.system.skeletonatorEl = this.el

    this.mesh = this.el.getObject3D('mesh').getObjectByProperty("type", "SkinnedMesh")
    this.allBones = []

    let rootBone
    if (this.mesh)
    {
      rootBone = this.mesh.skeleton.bones[0]
      this.allBones = this.allBones.concat(this.mesh.skeleton.bones)
    }
    else
    {
      rootBone = new THREE.Bone();
      rootBone.name = "root";
      Compositor.meshRoot.add(rootBone)
      this.allBones.push(rootBone)
      // Util.positionObject3DAtTarget(rootBone, Compositor.meshRoot)
      // Util.applyMatrix(Compositor.meshRoot.matrixWorld, rootBone)
      // Compositor.meshRoot.matrix.identity()
      // Util.applyMatrix(Compositor.meshRoot.matrix, Compositor.meshRoot)
    }
    this.rootBone = rootBone

    this.meshes = []

    console.log("Converting meshes to skinned mesh")
    for (let mesh of Compositor.nonCanvasMeshes)
    {
      if (mesh.type === 'SkinnedMesh') {
        this.meshes.push(mesh)
        continue
      }

      var position = mesh.geometry.attributes.position;

      var skinIndices = [];
      var skinWeights = [];

      for ( var i = 0; i < position.count; i ++ ) {

      	var skinIndex = 1;
      	var skinWeight = 1.0;

      	skinIndices.push( skinIndex, 0, 0, 0 );
      	skinWeights.push( skinWeight, 0, 0, 0 );

      }

      mesh.geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
      mesh.geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );

      let skinnedMesh = new THREE.SkinnedMesh(mesh.geometry, mesh.material)
      skinnedMesh.name = mesh.name
      if (skinnedMesh.name == "")
      {
        skinnedMesh.name = shortid.generate()
      }
      skinnedMesh.el = mesh.el

      let mat = this.pool('mat', THREE.Matrix4)

      mat.copy(mesh.matrix)
      let parent = mesh.parent
      let localRootBone = rootBone

      while (parent)
      {
        if (Util.traverseFind(parent, o => o === rootBone)) break;
        if (parent.isBone) {
          localRootBone = parent
          break;
        }
        mat.premultiply(parent.matrix)
        parent = parent.parent
      }

      let inv = this.pool('inv', THREE.Matrix4)
      inv.copy(mat).invert()

      console.log("mat", mat.elements)

      let meshRootBone = new THREE.Bone
      this.allBones.push(meshRootBone)
      meshRootBone.name = skinnedMesh.name + "_root"
      localRootBone.add(meshRootBone)
      Util.positionObject3DAtTarget(meshRootBone, mesh)

      skinnedMesh.bind(new THREE.Skeleton([localRootBone, meshRootBone], [new THREE.Matrix4, new THREE.Matrix4]), new THREE.Matrix4)

      meshRootBone.add(skinnedMesh)
      Util.positionObject3DAtTarget(skinnedMesh, mesh)
      mesh.parent.remove(mesh)

      this.meshes.push(skinnedMesh)
      if (!this.mesh) this.mesh = skinnedMesh
    }

    this.el.classList.remove('canvas')
    this.el.classList.remove('clickable')

    let controlPanelRoot = document.createElement('a-entity')
    controlPanelRoot.innerHTML = require('./partials/skeletonator-control-panel.html.slm')
    let controlPanel = controlPanelRoot.querySelector('*[shelf]')
    controlPanel.skeletonator = this
    controlPanel.setAttribute('skeletonator-control-panel', "")

    document.querySelector('#left-shelf').append(controlPanel)
    this.controlPanel = controlPanel

    Util.whenLoaded(controlPanel, () => {
      controlPanel.querySelector('*[shelf-summoner]').components['shelf-summoner'].update()
      controlPanel.querySelector('*[shelf-summoner]').components['shelf-summoner'].summon()
    })

    this.setupBones()

    this.onFrameChange = this.onFrameChange.bind(this)
    Compositor.el.addEventListener('framechanged', this.onFrameChange)

    if (Compositor.el.skeletonatorSavedSettings)
    {
      this.load(Compositor.el.skeletonatorSavedSettings)
    }

    Compositor.el.setAttribute('compositor', {skipDrawing: true})

    this.skeletonHelper = new THREE.SkeletonHelper(this.rootBone)
    this.el.sceneEl.object3D.add(this.skeletonHelper)

    Util.whenLoaded(Object.values(this.boneToHandle), () => this.updateHandles())
  },
  update(oldData)
  {
    if (!this.skinningMaterial) return;

    if (this.data.hideSkeleton)
    {
      this.skinningMaterial.opacity = 1.0
      this.skeletonHelper.visible = false
      Compositor.component.data.skipDrawing = false
      for (let handle of Object.values(this.boneToHandle))
      {
        handle.object3D.visible = false
      }
    }
    else
    {
      this.skinningMaterial.opacity = 0.5
      this.skeletonHelper.visible = true
      Compositor.component.data.skipDrawing = true
      for (let handle of Object.values(this.boneToHandle))
      {
        handle.object3D.visible = true
      }
    }

    this.el.sceneEl.emit('refreshobjects')
  },
  tick(t, dt) {
    if (!this.el.classList.contains("canvas"))
    {
      if (!this.skinningMaterial)
      {
        // this.skinningMaterial = new THREE.MeshStandardMaterial({
        //   skinning: true,
        //   transparent: true,
        //   opacity: 0.5
        // })

        let oldMaterial = Compositor.material
        this.skinningMaterial = Compositor.material.clone()
        this.skinningMaterial.skinning = true
        this.skinningMaterial.transparent = true
        this.skinningMaterial.opacity = 0.5
        this.skinningMaterial.needsUpdate = true

        // for (let mode of ["map"].concat(THREED_MODES))
        // {
        //   if (oldMaterial[mode])
        //   {
        //     this.skinningMaterial[mode] = oldMaterial[mode]
        //   }
        // }
      }

      for (let mesh of this.meshes)
      {
        if (mesh.material === this.skinningMaterial) continue
        mesh.material = this.skinningMaterial
      }
    }
  },
  pause() {
    this.el.classList.add('canvas')
    Compositor.el.removeEventListener('framechanged', this.onFrameChange)
    Compositor.el.setAttribute('compositor', {skipDrawing: false})

    console.log("Pausing Skeletonator")

    for (let mesh of this.meshes)
    {
      mesh.material = Compositor.material
      console.log("M", mesh.material === Compositor.material, mesh.material, Compositor.material)
    }

    this.skeletonHelper.visible = false

    for (let handle of Object.values(this.boneToHandle))
    {
      handle.object3D.visible = false
    }

    for (let el of document.querySelectorAll('*[raycaster]'))
    {
      el.components.raycaster.refreshObjects()
    }
  },
  play() {
    this.el.classList.remove('canvas')
    Compositor.el.addEventListener('framechanged', this.onFrameChange)
    Compositor.el.setAttribute('compositor', {skipDrawing: true})
    for (let mesh of this.meshes)
    {
      mesh.material = this.skinningMaterial
      mesh.isSkinnedMesh = true
    }

    this.skeletonHelper.visible = true

    for (let handle of Object.values(this.boneToHandle))
    {
      handle.object3D.visible = true
    }

    for (let el of document.querySelectorAll('*[raycaster]'))
    {
      el.components.raycaster.refreshObjects()
    }
  },
  load(obj) {
    console.log("Loading saved skeletonator")
    this.el.setAttribute('skeletonator', {frameCount: obj.frameCount})
    if ('boneTracks' in obj) {
      for (let bone in this.boneTracks)
      {
        if (!(bone in obj.boneTracks))
        {
          console.warn("No such saved bone", bone)
          continue
        }
        this.boneTracks[bone] = {}
        for (let frame in obj.boneTracks[bone])
        {
          this.boneTracks[bone][frame] = new THREE.Matrix4().fromArray(obj.boneTracks[bone][frame].elements)
        }
      }
    }
  },
  setupBones() {
    this.boneToHandle = {}
    this.boneTracks = {}

    for (let bone of this.mesh.skeleton.bones)
    {
      if (bone.name in this.boneToHandle) continue;

      this.el.append(this.addBoneHierarchy(bone))
    }

    this.setActiveBone(this.mesh.skeleton.bones[0])
  },
  addBoneHierarchy(bone)
  {
    console.log("Adding bone", bone)
    let handle = document.createElement('a-entity')
    handle.setAttribute('bone-handle', "")
    handle.classList.add("clickable")
    handle.bone = bone
    handle.skeletonator = this
    this.boneToHandle[bone.name] = handle
    this.boneTracks[bone.name] = {}

    handle.addEventListener('click', e => {
      this.setActiveBone(bone)
      e.stopPropagation()
    })

    for (let child of bone.children)
    {
      handle.append(this.addBoneHierarchy(child))
    }

    return handle
  },
  updateHandles() {
    this.el.querySelectorAll('*[bone-handle]').forEach(handle => handle.components['bone-handle'].resetToBone())
  },
  renameBone(bone, newName) {
    console.log("Renaming bone", bone, newName)
    if (newName in this.boneToHandle)
    {
      throw new Error(`Name ${newName} already taken`)
    }

    this.boneToHandle[newName] = this.boneToHandle[bone.name]
    this.boneTracks[newName] = this.boneTracks[bone.name]
    delete this.boneToHandle[bone.name]
    delete this.boneTracks[bone.name]
    bone.name = newName
  },
  deleteBone(bone) {
    bone.parent.remove(bone)
    this.allBones.splice(this.allBones.indexOf(bone), 1)
    this.boneToHandle[bone.name].parentEl.removeChild(this.boneToHandle[bone.name])
    delete this.boneToHandle[bone.name]
    delete this.boneTracks[bone.name]
    if (this.activeBone == bone)
    {
      this.activeBone = undefined
    }
  },
  setActiveBone(bone) {
    console.log("Setting active bone to", bone)
    if (this.activeBone) {
      this.boneToHandle[this.activeBone.name].setAttribute('material', {color: '#c9f0f2'})
    }

    this.activeBone = bone
    if (this.activeBone)
    {
      this.boneToHandle[this.activeBone.name].setAttribute('material', {color: '#f5363f'})
    }
    this.el.emit('activebonechanged', {activeBone: this.activeBone})
  },
  nodesFromBones() {
    let i = 0
    for (let boneName in this.boneToHandle)
    {
      if (Compositor.component.allNodes.some(n => n.name == boneName)) continue

      let node = new OutputNode(Compositor.component)
      node.name = boneName
      node.shelfMatrix.makeScale(0.1, 0.1, 0.1)
      node.shelfMatrix.setPosition(0.4, i++ * 0.4, 0.0)
      Compositor.component.el.emit('nodeadded', {node})
    }
  },
  skinFromNodes() {
    console.log("Skin From Nodes")
    for (let mesh of this.meshes)
    {
      console.log("Skinning", mesh.name)
      let vertexUvs = mesh.geometry.attributes.uv
      let uv = new THREE.Vector2()

      var skinIndices = [];
      var skinWeights = [];

      let canvasByName = {}

      for (let node of Compositor.component.allNodes)
      {
        if (node.name) {
          if (!node.inputs.canvas) continue
          if (!node.inputs.canvas.canvas) {
            console.warn("No canvas for", node)
            continue
          }

          canvasByName[node.name] = node.inputs.canvas.canvas
        }
      }

      console.log("Canvas by name", canvasByName)

      let bones = mesh.skeleton.bones

      let rootBone = Math.max(bones.indexOf(mesh.parent), 0)

      console.log("Root Bone", rootBone)

      for (let vi = 0; vi < vertexUvs.count; vi ++ )
      {
        uv.fromBufferAttribute(vertexUvs, vi)

        let topFour = [
          {idx: rootBone, weight: 0},
          {idx: rootBone, weight: 0},
          {idx: rootBone, weight: 0},
          {idx: rootBone, weight: 0},
        ]

        let anySet = false;



        for (let i in bones)
        {
          let bone = bones[i]
          if (!(bone.name in canvasByName)) {
          //   console.log("No canvas for", bone.name)
            continue
          }
          let canvas = canvasByName[bone.name]
          let color = canvas.getContext('2d').getImageData(Math.round(uv.x * canvas.width), Math.round(uv.y * canvas.height), 1, 1)
          let alpha = color.data[3] / 255.0
          // console.log("Sampled", JSON.stringify(color.s), bone.name)
          if (alpha > topFour[3].weight)
          {
            topFour[3].idx = i
            topFour[3].weight = alpha
            topFour.sort((a,b) => - (a.weight - b.weight))
            anySet = true
          }
        }

        if (!anySet)
        {
          topFour[0].weight = 1
        }

        let norm = topFour[0].weight + topFour[1].weight + topFour[2].weight + topFour[3].weight

        if (norm < 1.0)
        {
          topFour[3].idx = rootBone
          topFour[3].weight = 1.0 - norm
          norm = 1.0
        }

        if (topFour[1].weight == 0) topFour[1].idx = 0
        if (topFour[2].weight == 0) topFour[2].idx = 0
        if (topFour[3].weight == 0) topFour[3].idx = 0

        skinIndices.push(topFour[0].idx, topFour[1].idx, topFour[2].idx, topFour[3].idx)
        skinWeights.push(topFour[0].weight / norm, topFour[1].weight / norm, topFour[2].weight / norm, topFour[3].weight / norm)
      }

      mesh.geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
      mesh.geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );
      mesh.geometry.attributes.skinIndex.needsUpdate = true
      mesh.geometry.attributes.skinWeight.needsUpdate = true
    }
  },
  nodesFromSkin({onlyUsedBones = false} = {}) {
    let proc = new CanvasShaderProcessor({source: require('./shaders/vertex-baker.glsl'), vertexShader: require('./shaders/weight-baker.vert')})
    let layersForBone = {}

    for (let node of Compositor.component.allNodes)
    {
      if (node.inputs && node.inputs.canvas)
      {
        layersForBone[node.name] = node.inputs.canvas
      }
    }

    let needsDilation = new Set()

    for (let mesh of this.meshes)
    {
      if (mesh.type !== 'SkinnedMesh') continue;

      let geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;

      let bonesUsed = new Set(geometry.attributes.skinIndex.array)

      console.log("Deskinning", mesh.name)

      for (let i = 0; i < mesh.skeleton.bones.length; ++i)
      {
        if (!bonesUsed.has(i)) continue;

        let bone = mesh.skeleton.bones[i]
        if (!(bone.name in layersForBone))
        {
          let layer = new Layer(Compositor.component.width, Compositor.component.height)
          layer.visible = false
          layer.shelfMatrix.makeScale(0.2, 0.2, 0.2)
          layer.shelfMatrix.setPosition(-0.2, Object.values(layersForBone).length, 0)
          Compositor.component.addLayer(Compositor.component.layers.length, {layer})
          layersForBone[bone.name] = layer
          let outputNode = new OutputNode(Compositor.component)
          outputNode.name = bone.name

          outputNode.shelfMatrix.makeScale(0.1, 0.1, 0.1)
          outputNode.shelfMatrix.setPosition(0.45, Object.values(layersForBone).length - 1 + 0.05, 0)
          outputNode.connectInput(layer, {type: 'canvas'})
          Compositor.component.el.emit('nodeadded', {node: outputNode})
          Compositor.el.emit('nodeconnectionschanged', {node: outputNode})
        }
        let destinationCanvas = layersForBone[bone.name].canvas
        proc.setInputCanvas(destinationCanvas)


        proc.vertexPositions = geometry.attributes.uv.array
        proc.hasDoneInitialUpdate = false

        proc.createVertexBuffer({name: "a_boneWeights", list: geometry.attributes.skinWeight.array, size: geometry.attributes.skinWeight.itemSize})
        proc.createVertexBuffer({name: "a_boneIndices", list: geometry.attributes.skinIndex.array, size: geometry.attributes.skinIndex.itemSize})

        proc.setUniform('u_boneIndex', 'uniform1f',i)

        proc.initialUpdate()

        proc.update()

        let ctx = destinationCanvas.getContext("2d")
        ctx.drawImage(proc.canvas,
                      0, 0, proc.canvas.width, proc.canvas.height,
                      0, 0, destinationCanvas.width, destinationCanvas.height)

        if (destinationCanvas.touch) destinationCanvas.touch()

        needsDilation.add(destinationCanvas)
      }
    }

    for (let canvas of needsDilation)
    {
      this.el.sceneEl.systems['canvas-fx'].applyFX('dilate', canvas)
    }

    if (!onlyUsedBones)
    {
      console.log("Adding unused bones")
      this.nodesFromBones()
    }
  },
  keyframe(bone) {
    let frameIdx = this.currentFrameIdx()

    if (this.data.useTracks)
    {
      this.currentAnimation.keyframe(bone, frameIdx)
    }
    else
    {
      if (!this.boneTracks[bone.name])
      {
        this.boneTracks[bone.name] = {}
      }

      if (!(frameIdx in this.boneTracks[bone.name]))
      {
        this.boneTracks[bone.name][frameIdx] = new THREE.Matrix4()
        if (!Compositor.component.isPlayingAnimation)
        {
          this.el.emit('keyframeadded', {bone, frame: frameIdx})
        }
      }
      bone.updateMatrix()
      this.boneTracks[bone.name][frameIdx].copy(bone.matrix)
    }
  },
  currentFrameIdx() {
    return Compositor.component.currentFrame % this.data.frameCount
  },
  frameIdx(idx) {
    idx = idx % this.data.frameCount
    if (idx < 0) idx = this.data.frameCount + idx
    return idx
  },
  onFrameChange() {
    let frameIdx = this.currentFrameIdx()
    for (let bone of this.allBones)
    {
      if (this.boneToHandle[bone.name].is("grabbed")) continue

      let boneFrameIdx = frameIdx

      if (!(bone.name in this.boneTracks))
      {
        continue
        // this.boneTracks[bone.name] = {}
      }

      // while (!(boneFrameIdx in this.boneTracks[bone.name]) && boneFrameIdx > 0)
      // {
      //   boneFrameIdx--
      // }

      if (boneFrameIdx in this.boneTracks[bone.name])
      {
        Util.applyMatrix(this.boneTracks[bone.name][boneFrameIdx], bone)
        this.boneToHandle[bone.name].components['bone-handle'].resetToBone()
      }
      else if (Object.keys(this.boneTracks[bone.name]).length === 0)
      {
        continue
      }
      else if (Object.keys(this.boneTracks[bone.name]).length === 1)
      {
        Util.applyMatrix(Object.values(this.boneTracks[bone.name])[0], bone)
        this.boneToHandle[bone.name].components['bone-handle'].resetToBone()
      }
      else
      {
        let frameIndices = Object.keys(this.boneTracks[bone.name])
        let frameCount = this.data.frameCount
        let l = frameIndices.length
        let startFrame = 0
        let endFrame = l
        if (frameIndices[0] > boneFrameIdx)
        {
          startFrame = frameIndices[l - 1]
          endFrame = frameIndices[0] + frameCount
        }
        else if (frameIndices[l - 1] < boneFrameIdx)
        {
          startFrame = frameIndices[l - 1]
          endFrame = frameIndices[0] + frameCount
        }
        else
        {
          for (startFrame = boneFrameIdx; startFrame >= 0; startFrame--)
          {
            if (startFrame in this.boneTracks[bone.name]) break
          }
          for (endFrame = boneFrameIdx; endFrame <= this.data.frameCount; endFrame++)
          {
            if (endFrame in this.boneTracks[bone.name]) break
          }
        }


        let interp = THREE.Math.mapLinear(boneFrameIdx, startFrame, endFrame, 0.0, 1.0)

        Util.interpTransformMatrices(interp, this.boneTracks[bone.name][startFrame % frameCount], this.boneTracks[bone.name][endFrame % frameCount], {
          result: bone.matrix
        })
        Util.applyMatrix(bone.matrix, bone)
        this.boneToHandle[bone.name].components['bone-handle'].resetToBone()
      }
    }
  },
  bakeAnimations({name, wrap = true} = {}) {
    let tracks = []
    let fps = Compositor.component.data.frameRate
    for (let bone of this.mesh.skeleton.bones)
    {
      if (Object.keys(this.boneTracks[bone.name]).length == 0) continue

      let times = []
      let positionValues = []
      let rotationValues = []
      let scaleValues = []
      let position = new THREE.Vector3
      let rotation = new THREE.Quaternion
      let scale = new THREE.Vector3
      for (let i in this.boneTracks[bone.name])
      {
        times.push(i / fps)

        let matrix = this.boneTracks[bone.name][i]

        matrix.decompose(position, rotation, scale)
        positionValues = positionValues.concat(position.toArray())
        rotationValues = rotationValues.concat(rotation.toArray())
        scaleValues = scaleValues.concat(scale.toArray())
      }

      if (wrap)
      {
        times.push(this.data.frameCount / fps)
        let matrix = Object.values(this.boneTracks[bone.name]).find(b => b)

        matrix.decompose(position, rotation, scale)
        positionValues = positionValues.concat(position.toArray())
        rotationValues = rotationValues.concat(rotation.toArray())
        scaleValues = scaleValues.concat(scale.toArray())
      }

      let positionTrack = new THREE.VectorKeyframeTrack(`${bone.name}.position`, times, positionValues)
      let scaleTrack = new THREE.VectorKeyframeTrack(`${bone.name}.scale`, times, scaleValues)
      let rotationTrack = new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, rotationValues)
      tracks.push(positionTrack)
      tracks.push(rotationTrack)
      tracks.push(scaleTrack)
    }
    let animationContainer = Compositor.meshRoot || this.rootBone
    if (!('animations' in animationContainer))
    {
      animationContainer.animations = []
    }
    animationContainer.animations.push(new THREE.AnimationClip(name || shortid.generate(), (this.data.frameCount - 1) / fps, tracks))
  },
  bakeToGeometry() {
    let seenGeometries = new Set()
    let p = new THREE.Vector3()
    for (let mesh of this.meshes)
    {
      if (seenGeometries.has(mesh.geometry)) continue

      let attribute = mesh.geometry.attributes.position
      for (let i = 0; i < attribute.count; ++i)
      {
        mesh.boneTransform(i, p)
        attribute.setXYZ(i, p.x, p.y, p.z)
      }
      attribute.needsUpdate = true

      seenGeometries.add(mesh.geometry)
    }

    // Bake to skeelton?
    let bones = []
    Compositor.meshRoot.traverse(b => { if (b.type === 'Bone') bones.push(b) })

    for (let mesh of this.meshes)
    {
      mesh.updateMatrixWorld()
      mesh.bind(new THREE.Skeleton(bones
        , bones.map(b => {
        let idx = mesh.skeleton.bones.indexOf(b)
        let m = new THREE.Matrix4() // Don't pool this one, it's copied
        b.updateMatrixWorld()
        m.copy(b.matrixWorld)
        m.invert()
        m.multiply(mesh.matrixWorld)
        return m
      })
    ), new THREE.Matrix4)
    }
  },
  bakeMorphTarget(name) {
    let seenGeometries = {}
    let p = new THREE.Vector3()
    let o = new THREE.Vector3()
    for (let mesh of this.meshes)
    {
      let geometry = mesh.geometry
      if (!(geometry.uuid in seenGeometries))
      {
        let attribute = geometry.attributes.position.clone()

        for (let i = 0; i < attribute.count; ++i)
        {
          mesh.boneTransform(i, p)
          if (geometry.morphTargetsRelative)
          {
            o.fromBufferAttribute(geometry.attributes.position, i)
            p.sub(o)
          }
          attribute.setXYZ(i, p.x, p.y, p.z)
        }
        attribute.needsUpdate = true

        if (!geometry.morphAttributes) geometry.morphAttributes = {}
        if (!geometry.morphAttributes['position']) geometry.morphAttributes['position'] = []
        geometry.morphAttributes['position'].push(attribute)
        seenGeometries[geometry.uuid] = geometry.morphAttributes['position'].length - 1

        // geometry.id = new THREE.BufferGeometry().id // I wish....
      }

      if (!mesh.morphTargetDictionary) mesh.morphTargetDictionary = {}
      if (!mesh.morphTargetInfluences) mesh.morphTargetInfluences = []
      mesh.morphTargetDictionary[name] = seenGeometries[geometry.uuid]
      mesh.morphTargetInfluences[seenGeometries[geometry.uuid]] = 0
    }

    // Work around https://github.com/mrdoob/three.js/pull/20845
    let clonedGeometries = {}
    for (let mesh of this.meshes)
    {
      let geometry = mesh.geometry
      if (!(geometry.uuid in seenGeometries)) continue
      if (!(geometry.uuid in clonedGeometries))
      {
        clonedGeometries[geometry.uuid] = geometry.clone()
      }

      mesh.geometry = clonedGeometries[geometry.uuid]
    }
  }
})

Util.registerComponentSystem('bone-handle-system', {
  schema: {
    radius: {default: 0.02}
  },
  update(oldData) {
    if (typeof Skeletonator === 'undefined') return;

    if (this.data.radius !== oldData.radius)
    {
      for (let handle of Object.values(Skeletonator.boneToHandle))
      {
        handle.setAttribute('geometry', 'radius', this.data.radius)
      }
    }
  }
})

AFRAME.registerComponent("bone-handle", {
  events: {
    stateadded: function(e) {
      if (!e.target === this.el) return
      if (e.target.bone.name !== this.el.bone.name) return

      if (e.detail === 'grabbed')
      {
        this.stopGrabFrame = this.el.skeletonator.data.frameCount - 1 //this.el.skeletonator.frameIdx(this.el.skeletonator.currentFrameIdx() - 1)
        this.stopWrapsAround = false //(this.stopGrabFrame < this.el.skeletonator.currentFrameIdx())

        if (this.el.skeletonator.data.recordFrameCount) this.stopGrabFrame = Number.POSITIVE_INFINITY

        if (this.el.bone.parent.type === 'Bone' && this.el.skeletonator.system.data.lockLength)
        {
          // this.el.setAttribute('constrain-to-sphere', {innerRadius: this.el.bone.position.length(), outerRadius: this.el.bone.position.length(), })
          // if (!this.startingUp) this.startingUp = new THREE.Vector3
          // this.startingUp.set(0, 1, 0)
          // this.startingUp.applyQuaternion(this.el.parentEl.object3D.quaternion)
          this.startingPosition = this.startingPosition || new THREE.Vector3
          this.startingPosition.copy(this.el.object3D.position)
          this.el.sceneEl.systems.manipulator.installConstraint(this.el, this.trackParentConstraint, CONSTRAINT_PRIORITY)
          // this.el.parentEl.addState("constrained")
          // console.log("P", this.el.parentEl)

        }
        else
        {
          // this.el.removeAttribute('constrain-to-sphere')
          // this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.trackParentConstraint)
        }

        if (Compositor.component.isPlayingAnimation)
        {
          this.el.skeletonator.boneTracks[this.el.bone.name] = {}
          Compositor.component.jumpToFrame(0)
        }
      }
    },
    stateremoved: function(e) {
      if (!e.target === this.el) return
      if (e.target.bone.name !== this.el.bone.name) return

      if (e.detail === 'grabbed')
      {
        if (this.el.skeletonator.data.recordFrameCount)
        {
          this.el.skeletonator.el.setAttribute('skeletonator', {frameCount: Compositor.component.currentFrame, recordFrameCount: false})
        }

        this.el.sceneEl.systems.manipulator.removeConstraint(this.el, this.trackParentConstraint)
      }
    }
  },
  init() {
    Pool.init(this)
    this.system = this.el.sceneEl.systems['bone-handle-system']
    this.el.setAttribute('geometry', `primitive: tetrahedron; radius: ${this.system.data.radius}`)
    this.el.setAttribute('grab-options', 'showHand: false')
    if (this.el.skeletonator.activeBone == this.el.bone)
    {
      this.el.setAttribute('material', 'color: #f5363f; shader: standard')
    }
    else
    {
      this.el.setAttribute('material', 'color: #c9f0f2; shader: standard')
    }
    // this.el.setAttribute('tooltip', this.el.bone.name)
    this.el.bone.matrix.decompose(this.el.object3D.position,
                                  this.el.object3D.rotation,
                                  this.el.object3D.scale)

    this.trackParentConstraint = this.trackParentConstraint.bind(this)
    this.positioningHelper = new THREE.Object3D
    this.el.sceneEl.object3D.add(this.positioningHelper)
  },
  tick(t,dt) {
    let indicator = this.el.getObject3D('mesh')
    let scale = this.pool("scale", THREE.Vector3)
    indicator.getWorldScale(scale)
    indicator.scale.set(indicator.scale.x / scale.x, indicator.scale.y / scale.y, indicator.scale.z / scale.z)
    if (this.el.is("grabbed"))
    {
      this.el.object3D.matrix.decompose(this.el.bone.position, this.el.bone.rotation, this.el.bone.scale)

      if (this.el.skeletonator.data.recording)
      {
        if (Compositor.component.isPlayingAnimation)
        {
          if (this.stopWrapsAround && this.el.skeletonator.currentFrameIdx() < this.stopGrabFrame)
          {
            this.stopWrapsAround = false
          }

          if (!this.stopWrapsAround && Compositor.component.currentFrame >= this.stopGrabFrame)
          {
            this.el.grabbingManipulator.stopGrab()
            return
          }
        }

        this.el.skeletonator.keyframe(this.el.bone)
      }
    }
  },
  resetToBone()
  {
    if (this.el.is("grabbed")) return

    Util.positionObject3DAtTarget(this.el.object3D, this.el.bone)
    // this.el.bone.matrix.decompose(this.el.object3D.position,
    //                               this.el.object3D.rotation,
    //                               this.el.object3D.scale)
  },
  trackParentConstraint()
  {
    // Util.positionObject3DAtTarget(this.positioningHelper, this.el.object3D)
    this.el.object3D.position.copy(this.startingPosition)
    // this.el.object3D.up.set(0, 0, -1)
    // this.el.object3D.lookAt(this.positioningHelper.position)
    // this.el.object3D.up.set(0, 1, 0)

    return

    Util.positionObject3DAtTarget(this.positioningHelper)
    let obj = this.el.parentEl.object3D
    let up = this.startingUp
    obj.matrix.lookAt(obj.position, this.pool('center', THREE.Vector3), up)
    obj.quaternion.setFromRotationMatrix(obj.matrix)
    Util.positionObject3DAtTarget(this.el.object3D, this.positioningHelper)
    // // Util.applyMatrix(obj.matrix, obj)
    // let spherical = this.pool('spherical', THREE.Spherical)
    // spherical.setFromCartesianCoords(this.el.object3D.position.x, this.el.object3D.position.y, this.el.object3D.position.z)

  }
})

AFRAME.registerComponent("skeletonator-control-panel", {
  init() {
    Pool.init(this)
    this.el.querySelector('.globe-control')['redirect-grab'] = this.el.skeletonator.el
    this.el.addEventListener('click', e => {
      console.log("click", e)
      if (e.target.hasAttribute('click-action'))
      {
        let action = e.target.getAttribute('click-action')
        if (action in this) this[action](e)
      }
    })
    this.el.skeletonator.el.addEventListener('activebonechanged', e => {
      this.el.querySelector('.bone-name').setAttribute('text', {value: e.detail.activeBone.name})
    })
    this.el.querySelector('.bone-name').addEventListener('editfinished', e => {

      this.el.skeletonator.renameBone(this.el.skeletonator.activeBone, e.target.getAttribute('text').value)
    })
    Util.whenLoaded(this.el, () => {
      let frameText = this.el.querySelector('.frame-counter')
      Compositor.el.addEventListener('framechanged', e => {
        frameText.setAttribute('text', 'value', `Frame ${e.detail.frame}`)
      })
      frameText.setAttribute('text', 'value', `Frame ${Compositor.component.currentFrame}`)
    })
  },
  restPose() {
    this.el.skeletonator.mesh.skeleton.pose()
    this.el.skeletonator.updateHandles()
  },
  recordAnimation() {
    let numberOfFrames = 10
    let duration = numberOfFrames / Compositor.component.data.frameRate
    this.el.skeletonator.data.recording = true
  },
  bakeAnimations() {
    this.el.skeletonator.bakeAnimations({name: this.el.querySelector('.action-name').getAttribute('text').value})
  },
  bakeMorphTarget() {
    this.el.skeletonator.bakeMorphTarget(this.el.querySelector('.action-name').getAttribute('text').value)
  },
  exportSkinnedMesh() {
    for (let mesh of this.el.skeletonator.meshes) { mesh.material = Compositor.material }
    this.el.sceneEl.systems["settings-system"].export3dAction(Compositor.meshRoot)
  },
  clearTracks() {
    for (let bone in this.el.skeletonator.boneTracks)
    {
      this.el.skeletonator.boneTracks[bone.name] = {}
    }
  },
  bakeSkeleton(newSkeleton = false) {
    let bones = []
    Compositor.meshRoot.traverse(b => { if (b.type === 'Bone') bones.push(b) })

    for (let mesh of this.el.skeletonator.meshes)
    {
      mesh.updateMatrixWorld()
      mesh.bind(new THREE.Skeleton(bones
        , bones.map(b => {
        let idx = mesh.skeleton.bones.indexOf(b)
        if (b === this.el.skeletonator.rootBone || b === mesh.parent) return mesh.skeleton.boneInverses[idx]
        let m = new THREE.Matrix4() // Don't pool this one, it's copied
        b.updateMatrixWorld()
        m.copy(b.matrixWorld)
        m.invert()
        m.multiply(mesh.matrixWorld)
        return m
      })
    ), new THREE.Matrix4)
    }
  },
  puppeteer() {
    this.el.sceneEl.systems['avatar'].setAvatarModel(Compositor.meshRoot)
  },
  deleteActiveBone() {
    this.el.skeletonator.deleteBone(this.el.skeletonator.activeBone)
  },
  clearActiveBoneTracks() {
    this.el.skeletonator.boneTracks[this.el.skeletonator.activeBone.name] = {}
  },
  skinFromNodes() {
    this.el.skeletonator.skinFromNodes()
  },
  nodesFromSkin() {
    this.el.skeletonator.nodesFromSkin()
  },
  nodesFromBones() {
    this.el.skeletonator.nodesFromBones()
  },
  bakeToGeometry() {
    this.el.skeletonator.bakeToGeometry()
  },
  closeSkeletonator() {
    this.el.skeletonator.pause()
    this.el.object3D.visible = false
  },
  autoRigAPose() {
    if (Skeletonator.el.hasAttribute('ossos-biped-rig'))
    {
      Skeletonator.el.removeAttribute('ossos-biped-rig')
      return;
    }
    Skeletonator.el.setAttribute('ossos-biped-rig', 'restPoseType: A')
  },
  autoRigTPose() {
    if (Skeletonator.el.hasAttribute('ossos-biped-rig'))
    {
      Skeletonator.el.removeAttribute('ossos-biped-rig')
      return;
    }
    Skeletonator.el.setAttribute('ossos-biped-rig', 'restPoseType: T')
  }
})

AFRAME.registerComponent("new-bone-wand", {
  schema: {
    radius: {default: 0.03},
    tipRatio: {default: 0.2},
  },
  events: {
    click: function() { this.addBone(); }
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
    cylinder.setAttribute('material', 'side: double; src: #asset-shelf; metalness: 0.4; roughness: 0.7')
    cylinder.classList.add('clickable')
    cylinder.setAttribute('propogate-grab', "")
    this.el.append(cylinder)

    let tip = document.createElement('a-entity')
    tip.setAttribute('geometry', 'primitive: tetrahedron; radius: 0.02')
    tip.setAttribute('position', `0 -${cylinderHeight / 2 + tipHeight / 2} 0`)
    this.el.append(tip)
    this.tip = tip

    this.el.skeletonator = document.querySelector('*[skeletonator]').components['skeletonator']
  },
  addBone() {
    console.log("Add bone", this)
    console.log("Adding bone to", this.el.skeletonator.activeBone)
    let skeletonator = this.el.skeletonator
    let skeleton = this.el.skeletonator.mesh.skeleton

    this.tip.object3D.updateMatrixWorld()
    let destMat = this.pool('dest', THREE.Matrix4)
    destMat.copy(this.tip.object3D.matrixWorld)

    let scale = this.pool('scale', THREE.Vector3)
    scale.setFromMatrixScale(destMat)
    scale.set(1.0 / scale.x, 1.0 / scale.y, 1.0 / scale.z)
    destMat.scale(scale)

    let invMat = this.pool('inv', THREE.Matrix4)

    let activeBone = this.el.skeletonator.activeBone

    if (activeBone)
    {
      activeBone.updateMatrixWorld()
      invMat.copy(activeBone.matrixWorld).invert()
    }
    else
    {
      this.el.skeletonator.mesh.updateMatrixWorld()
      invMat.copy(this.el.skeletonator.mesh.matrixWorld).invert()
    }

    destMat.premultiply(invMat)

    let bone = new THREE.Bone()
    this.allBones.push(bone)
    bone.name = shortid.generate()
    Util.applyMatrix(destMat, bone)

    console.log("Bone", bone)

    if (activeBone)
    {
      activeBone.add(bone)
      skeletonator.boneToHandle[activeBone.name].append(skeletonator.addBoneHierarchy(bone))
    }
    else
    {
      skeleton.add(bone)
      skeletonator.el.append(skeletonator.addBoneHierarchy(bone))
    }

    skeletonator.setActiveBone(bone)

    // let bones = []
    // skeletonator.mesh.skeleton.bones[0].traverse(b => bones.push(b))
    // skeletonator.mesh.bind(new Three.Skeleton(bones), new THREE.Matrix4)
  }
})
