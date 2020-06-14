const GALLERY_ENTRIES = [
  {name: "birdcup_c", displayName: "Flying Bird Cup", description: "Virtual Reality Animated Ceramics."},
  {name: "hubs_avatar", displayName:"Hubs Avatar", description: "Mozilla Hubs Avatar from the Mozilla Reality team. Click here to draw your own hubs avatar!"},
  {name: "meredith", displayName: "Meredith", description: "Meredith the Moose" },
  {name: "paper", displayName: "Paper Template", description: "A paper sketching starter template. Best used with the detail pencil and medium-high opacity gray brush."},
  {name: "painting", displayName: "Paint Brush Example", description: "A sample painting with VARTISTE's node composition system showing how to get a paint brush effect using the bump map."},
  {name: "ai_style", displayName: 'AI Style Transfer', description: "A template to get started using AI style transfer for painting."}
]

class Gallery {
  constructor(el)
  {
    this.el = el
    this.el.innerHTML = require('./gallery.html.slm')
    this.el.querySelectorAll('.gallery-entry').forEach(entry => {
      let name = entry.getAttribute('entry')
      entry.setAttribute('href', "index.html?load=" + require(`../gallery/${name}.vartiste`))

      try {
        entry.querySelector('.preview').setAttribute('src', require(`advanced-image-loader!../gallery/${name}.png?width=200`))
      }
      catch(e)
      {
        console.error(e)
      }
    })
  }
}

module.exports = {GALLERY_ENTRIES, Gallery}
