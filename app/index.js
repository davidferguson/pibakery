/*
 * PiBakery 2.0.0 - The easy to use setup tool for Raspberry Pi
 * Copyright (C) 2019  David Ferguson <david@pibakery.org>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict'

var fs = require('fs-extra')
var webFrame = require('electron').webFrame
var dialog = require('electron').remote.dialog
var path = require('path')
var sdcard = require('../lib/sdcard.js')
var ui = require('../lib/ui.js')
var imgmanager = require('../lib/imgmanager.js')
var blocks = require('../lib/blocks.js')
var multifs = require('../lib/multifs.js')

// disable zooming
webFrame.setVisualZoomLevelLimits(1, 1)
webFrame.setLayoutZoomLevelLimits(0, 0)


/*
 * -------------------------------CODE FOR WRITING------------------------------
 */
function writeClicked () {
  // show the chooser window, but don't populate it yet
  ui.showSdChooser(beginImageWrite)

  // keep updating the sd chooser while the sd chooser is still open
  updateSdChooser()
}


function updateSdChooser () {
  // do nothing if the SD chooser is closed
  if (!ui.sdChooserOpen) {
    return
  }

  // get available images
  imgmanager.getImages(function (error, images) {
    if (error) {
      console.error(error)
      return
    }

    if (ui.sdChooserOpen) {
      // update the select element
      ui.updateSdChooser(null, images)

      // get available sd cards
      updateSDChooserSDs()
    }
  })
}


function updateSDChooserSDs() {
  // get available sd cards
  sdcard.getSDs(function sdCallback (error, cards) {
    if (error) {
      console.error(error)
      return
    }

    if (!ui.sdChooserOpen) {
      return
    }

    // update the chooser and run this function again if the chooser is open
    ui.updateSdChooser(cards, null)
    setTimeout(updateSDChooserSDs, 5000)
  })
}


// callback when a new image is chosen by the user
ui.imageChosenCallback = function (newImage) {
  // add this to the imgmanager list of images
  imgmanager.addImage(newImage)
}


function beginImageWrite (drive, os) {
  // show the writer window
  ui.showSdWriter('Writing to SD')

  // start the write
  sdcard.write(os.path, drive, {
    progress: writeImageProgress,
    error: function (error) {
      writeImageError(error, 'Write Error')
    },
    done: writeImageDone
  })

  ui.updateProgress(false, false, 'Waiting for Authentication...')
}


function writeImageDone (state, drive) {
  writeImageProgress({text:'Searching for remount path...'})
  // when the write is done, get the mountpoint of the /boot partition
  sdcard.getRemountPath(drive, function mountpointCallback (error, mountpoint) {
    if (error) {
      writeImageError(error, 'Write Error')
      return
    }

    installPiBakery(mountpoint, function () {
      // perform the cleanup
      writeImageProgress({text:'Cleaning up...'})
      sdcard.cleanup(drive, mountpoint, writeComplete)
    })
  })
}


function writeComplete (error, drive) {
  if (error) {
    writeImageError(error, 'Write Error')
    return
  }

  // sd image has been written, /boot has been mounted, script have been written, kpartx has been removed (if it was used)
  ui.showSdComplete('Write Complete')
}

/*
 * -----------------------------END CODE FOR WRITING----------------------------
 */




/*
 * ------------------------------CODE FOR EDITING------------------------------
 */

function updateClicked () {
  ui.showDriveChooser(beginImageUpdate, 'Update Existing SD Card', 'Update')

  // update the update chooser
  updateUpdateChooser()
}


function updateUpdateChooser () {
  // get available sd cards
  sdcard.getRaspbianSDs(function sdCallback (error, cards) {
    if (error) {
      console.error(error)
      return
    }

    // exit if the choose has been closed
    if (!ui.updateChooserOpen) {
      return
    }

    // update the chooser and run this function again if the chooser is open
    ui.updateUpdateChooser(cards)
    setTimeout(updateUpdateChooser, 5000)
  })
}

function beginImageUpdate (drive) {
  // show the updater window
  ui.showSdWriter('Updating SD')

  // get mountpoints
  var mountpoints = []
  for (var i = 0; i < drive.mountpoints.length; i++) {
    mountpoints.push(path.join(drive.mountpoints[i].path, 'bootcode.bin'))
  }

  // see which one(s) exist
  multifs.exists(mountpoints, function (error, exists) {
    if (error) {
      writeImageError(error, 'Update Error')
      return
    }

    if (exists.length === 0) {
      writeImageError(null, 'Update Error')
      return
    }

    // get the mountpoint, and write PiBakery to it
    var mountpoint = path.join(mountpoints[0], '../') // remove the 'bootcode.bin' part
    installPiBakery(mountpoint, updateComplete)
  })
}


function updateComplete (error) {
  if (error) {
    writeImageError(error, 'Update Error')
    return
  }

  // pibakery has been added to this sd card, scripts have veen written
  ui.showSdComplete('Update Complete')
}

/*
 * ----------------------------END CODE FOR EDITING----------------------------
 */


/*
 * ------------------------------CODE FOR LOADING------------------------------
 */

function loadClicked () {
  ui.showDriveChooser(loadFromSD, 'Load From SD Card', 'Load')

  // update the update chooser
  updateLoadChooser()
}


function updateLoadChooser () {
  // get available sd cards
  sdcard.getPiBakerySDs(function sdCallback (error, cards) {
    if (error) {
      console.error(error)
      return
    }

    // exit if the chooser has been closed
    if (!ui.updateChooserOpen) {
      return
    }

    // update the chooser and run this function again if the chooser is open
    ui.updateUpdateChooser(cards)
    setTimeout(updateLoadChooser, 5000)
  })
}

function loadFromSD (drive) {
  // show the updater window

  // get mountpoints
  var mountpoints = []
  for (var i = 0; i < drive.mountpoints.length; i++) {
    mountpoints.push(path.join(drive.mountpoints[i].path, 'PiBakery/blocks.xml'))
  }

  // see which one(s) exist
  multifs.exists(mountpoints, function (error, exists) {
    if (error) {
      ui.showSdWriter('Load Error')
      writeImageError(error, 'Load Error')
      throw error
      return
    }

    if (exists.length === 0) {
      ui.showSdWriter('Load Error')
      writeImageError(null, 'Load Error')
      return
    }

    // get the mountpoint, and write PiBakery to it
    var blockFile = exists[0]

    fs.readFile(blockFile, 'utf8', function (error, data) {
      if (error) {
        ui.showSdWriter('Load Error')
        writeImageError(null, 'Load Error')
        throw error
      }

      // load the blocks
      blocks.loadXml(data)

      // close the dialog
      ui.closeDialog()
    })
  })
}

/*
 * ----------------------------END CODE FOR LOADING----------------------------
 */


function installPiBakery (mountpoint, cb) {
  // we have the mountpoint, now write the scripts and blocks
  writeImageProgress({text:'Generating scripts...'})

  // get scripts
  var data = blocks.generateScript()

  // get blocks.xml
  data.xml = blocks.getXml()

  // write this data to the sd card
  sdcard.installPiBakery(mountpoint, data, {
    error: function (error) {
      writeImageError(error, 'Write Error')
    },
    progress: writeImageProgress,
    done: cb
  })
}

function writeImageProgress (state) {
  // when the write progress changes, update the UI
  var value = false
  var max = false
  var text = false

  if ('transferred' in state && 'length' in state) {
    value = state.transferred
    max = state.length
  }

  if ('text' in state) {
    text = state.text
  }

  ui.updateProgress(value, max, text)
}


function writeImageError (error, title) {
  // if we get an error, show the error UI
  var msg = "Can't write to SD card, error code "
  msg = msg + error.name + ' :: ' + error.message

  ui.showSdError(title, msg)

  console.error(error)
}





function importRecipe () {
  var options = {
    title: 'Choose XML Recipe to Import',
    filters: [
      {name: 'Recipe Files (*.xml)', extensions: ['xml']}
    ],
    properties: [
      'openFile'
    ]
  }
  var path = dialog.showOpenDialog(options)[0]

  fs.readFile(path, 'utf8', function (error, data) {
    if (error) {
      dialog.showErrorBox('XML Import Error', error.message)
      throw error
    }

    blocks.loadXml(data)
  })
}


function exportRecipe () {
  var options = {
    title: 'Export to XML Recipe',
    filters: [
      {name: 'Recipe Files (*.xml)', extensions: ['xml']}
    ]
  }
  var path = dialog.showSaveDialog(options)
  var xml = blocks.getXml()

  fs.writeFile(path, xml, function (error) {
    if (error) {
      dialog.showErrorBox('XML Export Error', error.message)
      throw error
    }
  })
}






/* BEGIN IMPORTING CODE HERE */

// setup blockly and import the blocks
blocks.inject(ui.elements.editor, ui.elements.toolbox)
blocks.loadBlocks(ui.elements.toolbox, finishLoad)

// called when blocks have finished loading, removes intro and shows workspace
function finishLoad (error) {
  if (error) {
    console.error(error)
    return
  }

  // add handlers to buttons
  ui.elements.writeBtn.addEventListener('click', writeClicked)
  ui.elements.updateBtn.addEventListener('click', updateClicked)
  ui.elements.loadBtn.addEventListener('click', loadClicked)
  ui.elements.importBtn.addEventListener('click', importRecipe)
  ui.elements.exportBtn.addEventListener('click', exportRecipe)
  // TODO - add import and export buttons

  // remove intro message and show blockly workspace
  ui.removeIntro()
  ui.showWorkspace()
}
