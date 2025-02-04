let VERSION = require('./toolkit/package.json').version
console.log("including VARTISTE toolkit", VERSION)

if (document.currentScript)
{
  window.VARTISTE_TOOLKIT_URL = document.currentScript.src.split('/').slice(0, -1).join("/")
}

if (window.VARTISTE_TOOLKIT && window.VARTISTE_TOOLKIT.assetUrl)
{
  window.VARTISTE_TOOLKIT_URL = VARTISTE_TOOLKIT.assetUrl
}

window.VARTISTE_TOOLKIT = Object.assign({
  includeFiles: undefined,
  excludeFiles: [],
  includeComponents: undefined,
  excludeComponents: [],
  includeCompositor: false,
  replaceTextWithTroikaText: 'auto',
  required_assets: [
    "./shelf.png",
    "./hand-right.png",
    "./matcap.jpg",
    "./hand.glb",
    "./close-circle-outline.png",
    "./reset-orientation.jpg",
    "./button.glb",
    "./headset.glb",
    "./lead-pencil.png"
  ]
}, window.VARTISTE_TOOLKIT || {})

VARTISTE_TOOLKIT.excludeFiles = VARTISTE_TOOLKIT.excludeFiles.map(f => f.match(/\.?\/?(.*?)(\.?js)?$/)[1])
if (VARTISTE_TOOLKIT.includeFiles) VARTISTE_TOOLKIT.includeFiles = VARTISTE_TOOLKIT.includeFiles.map(f => f.match(/\.?\/?(.*?)(\.?js)?$/)[1])

// Compatibility
if (!THREE.Matrix4.prototype.invert) {
  THREE.Matrix4.prototype.invert = function() { return this.getInverse(this)}
}

const {loadAsset, loadAllAssets} = require('./assets.js')

const originalRegisterComponent = AFRAME.registerComponent
const originalRegisterSystem = AFRAME.registerSystem

AFRAME.registerComponent = function (name, opt) {
  if (VARTISTE_TOOLKIT.includeComponents && !VARTISTE_TOOLKIT.includeComponents.includes(name)) return;
  if (VARTISTE_TOOLKIT.excludeComponents.includes(name)) return;
  return originalRegisterComponent.call(this, name, opt)
}

AFRAME.registerSystem = function (name, opt) {
  if (VARTISTE_TOOLKIT.includeComponents && !VARTISTE_TOOLKIT.includeComponents.includes(name)) return;
  if (VARTISTE_TOOLKIT.excludeComponents.includes(name)) return;
  return originalRegisterSystem.call(this, name, opt)
}

function checkFile (rawName) {
  let name = rawName.match(/\.?\/?(.*?)(\.?js)?$/)[1]
  if (VARTISTE_TOOLKIT.includeFiles && !VARTISTE_TOOLKIT.includeFiles.includes(name)) return false;
  if (VARTISTE_TOOLKIT.excludeFiles.includes(name)) return false;
  return true;
}

if (checkFile('./framework/fix-text-autoscaling-logging.js')) require('./framework/fix-text-autoscaling-logging.js')
if (checkFile('./framework/valve-index-controls') && !AFRAME.components['valve-index-controls']) require('./framework/valve-index-controls')
if (checkFile('./text')) require('./text')
if (checkFile('./shelf')) require('./shelf')
if (checkFile('./icon-button')) require('./icon-button')
if (checkFile('./edit-field')) require('./edit-field')
if (checkFile('./popup-shelf')) require('./popup-shelf')
if (checkFile('./tooltip')) require('./tooltip')
if (checkFile('./frame')) require('./frame')
if (checkFile('./optimization-components')) require('./optimization-components')
if (checkFile('./speech')) require('./speech')
if (checkFile('./matcap-shader')) require('./matcap-shader')
if (checkFile('./desktop-controls')) require('./desktop-controls')
if (checkFile('./manipulator')) require('./manipulator')
if (checkFile('./canvas-shader-processor')) require('./canvas-shader-processor')
if (checkFile('./canvas-updater')) require('./canvas-updater')
if (checkFile('./demo-overlay')) require('./demo-overlay')
if (checkFile('./joystick-directions')) require('./joystick-directions')
if (checkFile('./popup-shelf')) require('./popup-shelf')
if (checkFile('./smooth-controller')) require('./smooth-controller')
if (checkFile('./draw-canvas')) require('./draw-canvas')
if (checkFile('./hand-draw-tool')) require('./hand-draw-tool')
if (checkFile('./paint-system')) require('./paint-system')
if (checkFile('./color-picker')) require('./color-picker')
if (checkFile('./leap-hand')) require('./leap-hand')
if (checkFile('./hand-tracking')) require('./hand-tracking')
if (checkFile('./hdri-environment')) require('./hdri-environment')
if (checkFile('./fix-oculus-steamvr')) require('./fix-oculus-steamvr')
if (checkFile('./artist-positioning')) require('./artist-positioning')
if (checkFile('./canvas-fx')) require('./canvas-fx')
if (checkFile('./scalable-raycaster')) require('./scalable-raycaster')
if (checkFile('./webxr-input-profiles')) require('./webxr-input-profiles')
if (checkFile('./camera-capture')) require('./camera-capture')
if (checkFile('./physics')) require('./physics')
if (checkFile('./kromophone')) require('./kromophone')
if (checkFile('./pencil-tool')) require('./pencil-tool')
if (checkFile('./brush-editor')) require('./brush-editor')
if (checkFile('./avatar')) require('./avatar')
const {ButtonMaps, Axes, JoystickDirections} = require('./joystick-directions.js')
// require('./user-media')
const {Undo, UndoStack} = require('./undo')
const {Pool} = require('./pool')
const {MaterialTransformations} = require('./material-transformations')
window.VARTISTE = {}
VARTISTE.Util = require('./util.js').Util
const Color = require('color')
Object.assign(VARTISTE, {ButtonMaps, Axes, JoystickDirections, Pool, Undo, UndoStack, MaterialTransformations, VERSION, Color})

if (VARTISTE_TOOLKIT.includeCompositor)
{
  require('./compositor.js')
  VARTISTE.Compositor = Compositor

  if (checkFile('./settings-system')) require('./settings-system')
  if (checkFile('./file-upload')) require('./file-upload')
  if (checkFile('./busy')) require('./busy')
  if (checkFile('./brush-shelf')) require('./brush-shelf')
}

// Applies the base VARTISTE button mapping for the manipulator and rotation
AFRAME.registerComponent('vartiste-rotation-button-mapping', {
  dependencies: ['raycaster'],
  init() {
    let buttonMap = new ButtonMaps()

    buttonMap.setMap({
      'abutton': buttonMap.toggle('rotating'),
      'trackpad': buttonMap.toggle('rotating'),
      'thumbstick': buttonMap.toggle('orbiting')
    }, "grabbing")

    buttonMap.install(this)
  },
})

// Applies the VARTISTE user setup, including camera and controller components
AFRAME.registerComponent('vartiste-user-root', {
  schema: {
    // Object to use for positioning the user on position reset
    resetPositioner: {default: '#camera-reset-el'},
    speed: {default: 1.0},
  },
  init() {
    this.el.innerHTML = require('./partials/artist-root.html.slm')
    this.el.querySelector('#right-hand').setAttribute('joystick-turn', "target: #artist-root")
    this.el.sceneEl.setAttribute('artist-positioner', 'resetPositioner', this.data.resetPositioner)

    this.desktopControls = this.el.querySelector('*[desktop-controls]')
  },
  update(oldData) {
    VARTISTE.Util.whenLoaded(this.desktopControls, () => {
      this.desktopControls.setAttribute('wasd-controls', 'acceleration', this.data.speed)
    })
  }
})

AFRAME.registerComponent = originalRegisterComponent
AFRAME.registerSystem = originalRegisterSystem
