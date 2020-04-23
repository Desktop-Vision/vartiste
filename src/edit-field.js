import {Util} from './util.js'
AFRAME.registerComponent('edit-field', {
  dependencies: ["text", 'popup-button'],
  schema: {
    tooltip: {type: 'string'},
    type: {type: 'string', default: 'number'},
    target: {type: 'selector'},
    component: {type: 'string'},
    property: {type: 'string'}
  },
  init() {
    this.numpad = this.el.components['popup-button'].popup
    let {numpad} = this

    numpad.addEventListener('click', e => this.buttonClicked(e))

    this.el.addEventListener('popuplaunched', e => {
      numpad.querySelector('.value').setAttribute('text', {value: this.el.getAttribute('text').value})
      numpad.setAttribute('visible', true)
      if (this.data.type === 'number')
      {
        this.setValue("")
      }
    })
  },
  update(oldData) {
    this.el.setAttribute('popup-button', {
      icon: "#asset-lead-pencil",
      tooltip: this.data.tooltip,
      popup: (this.data.type === 'string' ? "keyboard" : "numpad")
    })

    if (this.data.target !== oldData.target)
    {
      if (oldData.target)
      {
        oldData.target.removeEventListener('componentchanged', this.componentchangedlistener)
      }

      if (this.data.target)
      {
        this.componentchangedlistener = (e) => {
          if (e.detail.name === this.data.component)
          {
            this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
          }
        }
        this.data.target.addEventListener('componentchanged', this.componentchangedlistener)

        Util.whenLoaded([this.numpad, this.el, this.data.target], () => {
          this.setValue(this.data.target.getAttribute(this.data.component)[this.data.property].toString(), {update: false})
        })
      }
    }
  },
  setValue(value, {update=true} = {}) {
    this.numpad.querySelector('.value').setAttribute('text', {value})
    this.el.setAttribute('text', {value})
    if (update && this.data.target)
    {
      this.data.target.setAttribute(this.data.component, {[this.data.property]: value})
    }
  },
  buttonClicked(e) {
    console.log(e)
    let o = e.target.object3D
    let parentVisible = true
    o.traverseAncestors(a => parentVisible = parentVisible && a.visible)

    console.log("parentVisible", o.visible, parentVisible, e.detail.cursorEl.components.raycaster.objects.indexOf(e.target.object3D))
    let numpad = this.numpad
    if (e.target.hasAttribute('action'))
    {
      this[e.target.getAttribute('action')](e)
    }
    else if (e.target.hasAttribute('text'))
    {
      let buttonValue = e.target.getAttribute('text').value
      let existingValue = this.el.getAttribute('text').value
      this.setValue(existingValue + buttonValue)
    }
  },
  backspace(e) {
    this.setValue(this.el.getAttribute('text').value.slice(0, -1))
  },
  ok(e) {
    this.el.components['popup-button'].closePopup()
    this.el.emit("editfinished", {value: this.el.getAttribute('text').value})
  },
  clear(e) {
    this.setValue("")
  }
})

AFRAME.registerComponent('popup-button', {
  dependencies: ["text"],
  schema: {
    tooltip: {type: 'string'},
    icon: {type: 'string', default: '#asset-lead-pencil'},
    popup: {type: 'string', default: "numpad"},
    scale: {type: 'vec3', default: '1 1 1'},
    deferred: {type: 'boolean', default: false}
  },
  init() {
    let editButton
    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.setAttribute('text', {align: 'right'})
      let width = this.el.getAttribute('text').width

      editButton = document.createElement('a-entity')
      editButton.setAttribute('position', `${width / 2 + 0.3} 0 0`)
      editButton.setAttribute('icon-button', this.data.icon)
      this.el.append(editButton)
      editButton.addEventListener('click', e => this.launchPopup())
    }
    else
    {
      editButton = this.el
      this.el.addEventListener('click', e => {
        if (e.target === editButton) this.launchPopup()
      })
    }
    this.editButton = editButton

    let popup = document.createElement('a-entity')
    this.popup = popup

    popup.setAttribute('position', '0 0 0.1')
    popup.setAttribute('visible', 'false')

    if (!this.el.hasAttribute('icon-button'))
    {
      this.el.append(popup)
    }
    else {
      this.el.parentEl.append(popup)
    }

    popup.addEventListener('click', e => {
      if (!e.target.hasAttribute('popup-action')) return

      this[e.target.getAttribute('popup-action') + "Popup"]()
    })
  },
  update(oldData) {
    if (this.data.tooltip)
    {
      this.editButton.setAttribute('tooltip', this.data.tooltip)
    }
    if (this.data.popup !== oldData.popup)
    {
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
    }
    if (!this.popupLoaded && !this.data.deferred)
    {
      console.log("Initing popup", this.data.deferred, this.data);
      this.popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
  },
  launchPopup() {
    let popup = this.popup
    if (!this.popupLoaded)
    {
      popup.innerHTML = require(`./partials/${this.data.popup}.html.slm`)
      this.popupLoaded = true
    }
    popup.setAttribute('position', '0 0 0.1')
    popup.object3D.updateMatrixWorld()
    let invScale =  popup.object3D.parent.getWorldScale(new THREE.Vector3())
    invScale.x = this.data.scale.x / invScale.x
    invScale.y = this.data.scale.y / invScale.y
    invScale.z = this.data.scale.z / invScale.z
    popup.object3D.scale.copy(invScale)

    popup.setAttribute('visible', true)
    this.el.sceneEl.emit('refreshobjects')
    this.el.emit('popuplaunched')
    popup.emit('popupshown')
  },
  closePopup() {
    this.popup.setAttribute('visible', false)
    this.popup.setAttribute('position', '0 -999999 0.1')
  }
})
