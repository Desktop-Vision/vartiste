const settingsShelfHTML = require('./partials/settings-shelf.html.slm')
const {Util} = require('./util.js')

AFRAME.registerComponent('settings-shelf', {
  init() {
    this.system = this.el.sceneEl.systems['settings-system']
    this.el.innerHTML = settingsShelfHTML

    this.el.addEventListener('click', (e) => {
      let action = e.target.getAttribute("click-action") + 'Action';
      if (action in this)
      {
        this[action](e)
      }
      else if (action in this.system)
      {
        this.system[action]()
      }
    })
    this.el.querySelector('.project-name').addEventListener('editfinished', e=>{
      this.system.setProjectName(e.detail.value)
    })
    this.el.querySelector('.project-name').addEventListener('loaded', e => {
      e.target.setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    this.el.sceneEl.addEventListener('projectnamechanged', e => {
      this.el.querySelector('.project-name').setAttribute('text', {value: this.el.sceneEl.systems['settings-system'].projectName})
    })
    this.el.sceneEl.addEventListener('open-popup', e => {
      this.el.querySelector('.message').setAttribute('text', {value: `${e.detail}`})
    })

    document.getElementById('canvas-view').addEventListener('resized', e => {
      this.el.querySelector('.width').setAttribute('text', {value: e.detail.width})
      this.el.querySelector('.height').setAttribute('text', {value: e.detail.height})
    })

    if (!this.el.sceneEl.systems.sketchfab.loggedIn())
    {
      this.el.querySelector('.sketchfab-button').setAttribute('tooltip', "Log in to Sketchfab")
    }
  },
  newCompositionAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    console.log("Creating new composition", width, height, AFRAME.utils.styleParser.parse(e.target.getAttribute('size')), e.target.getAttribute('size'))
    width = parseInt(width)
    height = parseInt(height)

    compositor.layers.slice().forEach(layer => {
      compositor.deleteLayer(layer)
    })

    compositor.resize(width, height)

    let ctx = compositor.layers[0].canvas.getContext('2d')
    ctx.fillStyle = "#fff"
    ctx.fillRect(0,0,width,height)
    compositor.addLayer(1)
  },
  resampleAction(e) {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (e.target.hasAttribute('size'))
    {
      var {width, height} = AFRAME.utils.styleParser.parse(e.target.getAttribute('size'))
      width = parseInt(width)
      height = parseInt(height)
    }
    else
    {
      var width = parseInt(this.el.querySelector('.width').getAttribute('text').value)
      var height = parseInt(this.el.querySelector('.height').getAttribute('text').value)
    }

    if (!(Number.isInteger(width) && width > 0)) throw new Error(`Invalid composition width ${width}`)
    if (!(Number.isInteger(height) && height > 0)) throw new Error(`Invalid composition height ${height}`)

    compositor.resize(width, height, {resample: true})
  },
  toggleShadingAction() {
    let compositor = document.getElementById('canvas-view').components.compositor;

    if (compositor.el.getAttribute('material').shader === 'flat')
    {
      compositor.el.setAttribute('material', {shader: 'standard'})
    }
    else
    {
      compositor.el.setAttribute('material', {shader: 'flat'})
    }
  },
  toggleReferenceImportAction() {
    this.system.data.addReferences = !this.system.data.addReferences
  }
})


AFRAME.registerComponent('load-shelf', {
  init() {
    this.el.parentEl.addEventListener('popupshown', e => this.repopulate())
  },
  async repopulate() {
    console.log("Repopulating projects")
    let projectsEl = this.el.querySelector('.projects')
    projectsEl.innerHTML = ""
    let settings = this.el.sceneEl.systems['settings-system']
    let db = settings.openProjectsDB()
    let projects = await db.projects.orderBy('modified').primaryKeys()
    projects = projects.reverse()
    for (let i in projects)
    {
      let project = projects[i]
      let rowEl = document.createElement('a-entity')
      rowEl.innerHTML = require('./partials/load-project-row.html.slm')
      let nameEl = rowEl.querySelector('.name')
      Util.whenLoaded(nameEl, () => nameEl.setAttribute('text', {value: project}))
      rowEl.setAttribute('position', `-2 ${-i * 0.6 - 0.5} 0`)

      rowEl.addEventListener('click', e => {
        let action = e.target.getAttribute('click-action')
        if (!action) return
        this[action](project)
      })

      projectsEl.append(rowEl)
    }
  },
  open(project) {
    this.el.sceneEl.systems['settings-system'].loadFromBrowser(project)
  },
  async delete(project) {
    await this.el.sceneEl.systems['settings-system'].deleteFromBrowser(project)
    await this.repopulate()
  }
})
