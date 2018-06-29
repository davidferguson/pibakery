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

module.exports = {
  imageChosenCallback: null,

  sdChooserOpen: false,
  updateChooserOpen: false,
  loadChooserOpen: false,

  showSdChooser: showSdChooser,
  updateSdChooser: updateSdChooser,
  showSdWriter: showSdWriter,
  updateProgress: updateProgress,
  showSdError: showSdError,
  showSdComplete: showSdComplete,

  showDriveChooser: showDriveChooser,
  updateUpdateChooser: updateUpdateChooser,

  closeDialog: dialogCloseClicked,

  showBlockInfo: showBlockInfo,
  removeIntro: removeIntro,
  showWorkspace: showWorkspace,
  elements: {}
}

module.exports.elements = {
  editor: document.getElementById('blockly_editor'),
  toolbox: document.getElementById('toolbox'),
  writeBtn: document.getElementById('flashSD'),
  updateBtn: document.getElementById('updateSD'),
  loadBtn: document.getElementById('loadSD'),
  importBtn: document.getElementById('import'),
  exportBtn: document.getElementById('export'),
  settingsBtn: document.getElementById('settings')
}

var path = require('path')
var dialog = require('electron').remote.dialog


function showChooserDialog (title, btnText, sd, os, modifications, dialogWriteClicked) {
  var hiderElement = document.createElement('div')
  hiderElement.setAttribute('id', 'hider')

  var dialogElement = document.createElement('div')
  dialogElement.setAttribute('id', 'dialog')

  var titleElement = document.createElement('p')
  titleElement.setAttribute('id', 'dialogTitle')
  titleElement.innerText = title
  dialogElement.appendChild(titleElement)

  var tableElement = document.createElement('table')
  tableElement.setAttribute('id', 'dialogTable')
  dialogElement.appendChild(tableElement)

  if (sd) {
    var sdRowElement = document.createElement('tr')
    var sdTextColumnElement = document.createElement('td')
    var sdTextElement = document.createElement('span')
    sdTextElement.innerText = 'SD Card:'
    sdTextColumnElement.appendChild(sdTextElement)
    var sdChoiceColumnElement = document.createElement('td')
    var sdChoiceElement = document.createElement('select')
    sdChoiceElement.setAttribute('id', 'dialogSdChoice')
    sdChoiceElement.setAttribute('class', 'dialogChoice')
    var sdChoicePlaceholderElement = document.createElement('option')
    sdChoicePlaceholderElement.innerText = 'loading...'
    sdChoicePlaceholderElement.disabled = true
    sdChoicePlaceholderElement.selected = true
    sdChoiceElement.appendChild(sdChoicePlaceholderElement)
    sdChoiceColumnElement.appendChild(sdChoiceElement)
    sdRowElement.appendChild(sdTextColumnElement)
    sdRowElement.appendChild(sdChoiceColumnElement)
    tableElement.appendChild(sdRowElement)
  }

  if (os) {
    var osRowElement = document.createElement('tr')
    var osTextColumnElement = document.createElement('td')
    var osTextElement = document.createElement('span')
    osTextElement.innerText = 'Operating System:'
    osTextColumnElement.appendChild(osTextElement)
    var osChoiceColumnElement = document.createElement('td')
    var osChoiceElement = document.createElement('select')
    osChoiceElement.setAttribute('id', 'dialogOsChoice')
    osChoiceElement.setAttribute('class', 'dialogChoice')
    var osChoicePlaceholderElement = document.createElement('option')
    osChoicePlaceholderElement.innerText = 'loading...'
    osChoicePlaceholderElement.disabled = true
    osChoicePlaceholderElement.selected = true
    osChoiceElement.appendChild(osChoicePlaceholderElement)
    osChoiceColumnElement.appendChild(osChoiceElement)
    osRowElement.appendChild(osTextColumnElement)
    osRowElement.appendChild(osChoiceColumnElement)
    tableElement.appendChild(osRowElement)
  }

  var writeButtonElement = document.createElement('button')
  writeButtonElement.setAttribute('id', 'dialogWriteButton')
  writeButtonElement.setAttribute('class', 'dialogButton')
  writeButtonElement.disabled = true
  writeButtonElement.innerText = btnText
  writeButtonElement.addEventListener('click', dialogWriteClicked)
  dialogElement.appendChild(writeButtonElement)

  var closeButtonElement = document.createElement('button')
  closeButtonElement.setAttribute('id', 'dialogCloseButton')
  closeButtonElement.setAttribute('class', 'dialogButton')
  closeButtonElement.innerText = 'Close'
  closeButtonElement.addEventListener('click', dialogCloseClicked)
  dialogElement.appendChild(closeButtonElement)

  if (typeof modifications === 'function') {
    modifications(dialogElement)
  }

  document.body.appendChild(hiderElement)
  document.body.appendChild(dialogElement)
}


function showSdChooser (writeCallback) {
  module.exports.sdChooserOpen = true

  showChooserDialog('Write New SD Card', 'Write', true, true, function (dialog) {
    // any modifications go here
    dialog.style.height = '165px'
    dialog.style.marginTop = '-70px'
  }, function () {
    // write button pushed callback
    module.exports.sdChooserOpen = false

    var sdChoiceElement = document.getElementById('dialogSdChoice')
    var chosenDriveElement = sdChoiceElement.options[sdChoiceElement.selectedIndex]
    var chosenDrive = JSON.parse(chosenDriveElement.value)

    var osChoiceElement = document.getElementById('dialogOsChoice')
    var chosenOperatingSystemElement = osChoiceElement.options[osChoiceElement.selectedIndex]
    var chosenOs = {
      name: chosenOperatingSystemElement.innerHTML,
      path: chosenOperatingSystemElement.value
    }

    writeCallback(chosenDrive, chosenOs)
  })
}


function showDriveChooser (updateCallback, title, btn) {
  module.exports.updateChooserOpen = true

  showChooserDialog(title, btn, true, false, function (dialog) {
    // any modifications go here
    dialog.style.height = '150px'
    dialog.style.marginTop = '-65px'
  }, function () {
    // write button pushed callback
    module.exports.updateChooserOpen = false

    var sdChoiceElement = document.getElementById('dialogSdChoice')
    var chosenDriveElement = sdChoiceElement.options[sdChoiceElement.selectedIndex]
    var chosenDrive = JSON.parse(chosenDriveElement.value)

    updateCallback(chosenDrive)
  })
}


function updateUpdateChooser (drives) {
  if (drives) {
    var sdChoiceElement = document.getElementById('dialogSdChoice')

    // build up array of new drives
    var newDrives = []
    for (var i = 0; i < drives.length; i++) {
      var currentDrive = drives[i]
      var driveOptionElement = document.createElement('option')
      driveOptionElement.setAttribute('value', JSON.stringify(currentDrive))
      driveOptionElement.innerText = currentDrive.name
      newDrives.push(driveOptionElement)
    }

    updateSelectElement(sdChoiceElement, newDrives)
  }

  enableWriteButton(true, false)
}


function dialogCloseClicked () {
  if (module.exports.sdChooserOpen) {
    module.exports.sdChooserOpen = false
  } else if (module.exports.updateChooserOpen) {
    module.exports.updateChooserOpen = false
  }

  var hiderElement = document.getElementById('hider')
  var dialogElement = document.getElementById('dialog')

  hiderElement.parentNode.removeChild(hiderElement)
  dialogElement.parentNode.removeChild(dialogElement)
}


function optionsIndexOf (array, option) {
  // a form of indexOf for an array of <option> elements
  // checks the innerHTML and value
  for (var i = 0; i < array.length; i++) {
    var valuesEqual = array[i].value == option.value
    var innerHtmlEqual = array[i].innerHTML == option.innerHTML
    if (valuesEqual && innerHtmlEqual) {
      return i
    }
  }
  return -1
}


// element is <select> element to update
// newOptions is an ARRAY of <option> elements - the new ones
function updateSelectElement (element, newOptions) {
  // get current options as ARRAY (not HTMLCollection)
  var currentOptions = element.getElementsByTagName('option')
  currentOptions = Array.prototype.slice.call(currentOptions)

  // remove options that aren't necessary any more
  for (var i = 0; i < currentOptions.length; i++) {
    var needToRemoveOption = optionsIndexOf(newOptions, currentOptions[i]) == -1
    if (needToRemoveOption || currentOptions[i].value == 'chooseother') {
      element.removeChild(currentOptions[i])
      currentOptions.splice(i, 1)
    }
  }

  // add in new options
  for (var i = 0; i < newOptions.length; i++) {
    var needToAddOption = optionsIndexOf(currentOptions, newOptions[i]) == -1
    if (needToAddOption) {
      element.appendChild(newOptions[i])
    }
  }
}


function chooseNewImage (operatingSystems) {
  var osChoiceElement = document.getElementById('dialogOsChoice')

  var options = {
    title: 'Choose Operating System Image',
    filters: [
      {name: 'Image Files (*.img)', extensions: ['img']}
    ],
    properties: [
      'openFile'
    ]
  }
  var paths = dialog.showOpenDialog(options)

  if (paths === undefined) {
    // no path was chosen
    return
  }

  // a path was chosen
  var newPath = paths[0]

  // show the chooser
  document.getElementById('dialogOsChoice').style.display = "block"

  // run the callback
  module.exports.imageChosenCallback(newPath)

  // add the new path onto beginning of existing ones
  operatingSystems.pop()
  operatingSystems.unshift({
    display: path.basename(newPath),
    value: newPath
  })

  // re-run this function
  updateSdChooser(null, operatingSystems)
  osChoiceElement.value = newPath
  enableWriteButton(true, true)
  return
}


function updateSdChooser (drives, operatingSystems) {
  if (drives) {
    var sdChoiceElement = document.getElementById('dialogSdChoice')

    // build up array of new drives
    var newDrives = []
    for (var i = 0; i < drives.length; i++) {
      var currentDrive = drives[i]
      var driveOptionElement = document.createElement('option')
      driveOptionElement.setAttribute('value', JSON.stringify(currentDrive))
      driveOptionElement.innerText = currentDrive.name
      newDrives.push(driveOptionElement)
    }

    updateSelectElement(sdChoiceElement, newDrives)
  }

  if (operatingSystems) {
    var osChoiceElement = document.getElementById('dialogOsChoice')

    // if there are images, add an extra 'Choose Other' option
    if (operatingSystems.length != 0) {
      operatingSystems.push({
        display:'Choose Other',
        value: 'chooseother'
      })
    }

    // special case when there is no operating systems
    if (operatingSystems.length == 0) {
      // if there are none, then display a file chooser button

      // hide the selection box
      osChoiceElement.style.display = 'none'

      var buttonExists = !!(document.getElementById('buttonOsChoice'))

      if (!buttonExists) {
      // create a field and button instead
        var selectionField = document.createElement('input')
        selectionField.setAttribute('id', 'fieldOsChoice')
        selectionField.style.width = '154px'
        selectionField.style.marginRight = '5px'
        selectionField.readOnly = true
        selectionField.setAttribute('type', 'text')

        var selectionButton = document.createElement('button')
        selectionButton.setAttribute('id', 'buttonOsChoice')
        selectionButton.innerText =  'Choose'
        selectionButton.onclick = function () {
          chooseNewImage(operatingSystems)
          return
        }

        osChoiceElement.parentNode.appendChild(selectionField)
        osChoiceElement.parentNode.appendChild(selectionButton)
      }
    } else {
      // check if we previously set the chooser field/button
      var buttonExists = !!(document.getElementById('buttonOsChoice'))
      if (buttonExists) {
        // if it exists, delete the field and button
        var parent = document.getElementById('buttonOsChoice').parentNode
        parent.removeChild(document.getElementById('fieldOsChoice'))
        parent.removeChild(document.getElementById('buttonOsChoice'))
      }
    }


    // build up array of new operating systems
    var newOperatingSystems = []
    for (var i = 0; i < operatingSystems.length; i++) {
      var currentOs = operatingSystems[i]
      var operatingSystemOptionElement = document.createElement('option')
      operatingSystemOptionElement.setAttribute('value', currentOs.value)
      operatingSystemOptionElement.innerText = path.basename(currentOs.display)
      newOperatingSystems.push(operatingSystemOptionElement)
    }

    updateSelectElement(osChoiceElement, newOperatingSystems)

    // handle the 'Choose Other' option being selected in the dropdown
    osChoiceElement.onchange = function () {
      var selectedValue = osChoiceElement.options[osChoiceElement.selectedIndex].value
      if (selectedValue === 'chooseother') {
        // show the choose file dialog
        chooseNewImage(operatingSystems)
        return
      }
    }
  }

  enableWriteButton(true, true)
}


function enableWriteButton(drives, operatingSystems) {
  var osChoiceElement = document.getElementById('dialogOsChoice')
  var sdChoiceElement = document.getElementById('dialogSdChoice')

  var sdEnable = true
  var osEnable = true

  // if the selectors don't exist, then the write button shouldn't be enabled
  if ((!osChoiceElement && operatingSystems) || (!sdChoiceElement && drives)) {
    return
  }

  // check for values in the selectors
  if (drives) {
    sdEnable = sdChoiceElement.options.length > 0 && sdChoiceElement.options[0].innerText != 'loading...'
  }
  if (operatingSystems) {
    osEnable = sdChoiceElement.options.length > 0 && sdChoiceElement.options[0].innerText != 'loading...'
  }

  // check whether the write button should be enabled
  var writeButtonElement = document.getElementById('dialogWriteButton')
  var shouldEnable = sdEnable && osEnable
  if (shouldEnable) {
    writeButtonElement.disabled = false
  } else {
    writeButtonElement.disabled = true
  }
}


function showSdWriter (title) {
  var dialogElement = document.getElementById('dialog')
  dialogElement.style.width = '250px'
  dialogElement.style.height = '185px'
  dialogElement.style.marginTop = '-83px'

  var tableElement = document.getElementById('dialogTable')
  var writeButtonElement = document.getElementById('dialogWriteButton')
  var closeButtonElement = document.getElementById('dialogCloseButton')
  dialogElement.removeChild(tableElement)
  dialogElement.removeChild(writeButtonElement)
  dialogElement.removeChild(closeButtonElement)

  /*var titleElement = document.createElement('p')
  titleElement.setAttribute('id', 'dialogTitle')
  titleElement.innerText = 'Writing to SD'
  dialogElement.appendChild(titleElement)*/
  var titleElement = document.getElementById('dialogTitle')
  titleElement.innerText = title

  var imageElement = document.createElement('img')
  imageElement.setAttribute('id', 'dialogImage')
  imageElement.setAttribute('src', path.join(__dirname, '../app/img/writing.gif'))
  imageElement = document.createElement('p').appendChild(imageElement)
  dialogElement.appendChild(imageElement)

  var progressElement = document.createElement('progress')
  progressElement.setAttribute('id', 'dialogProgress')
  progressElement.setAttribute('value', 0)
  progressElement.setAttribute('max', 10000)
  dialogElement.appendChild(progressElement)

  var progressTextElement = document.createElement('div')
  progressTextElement.setAttribute('id', 'dialogProgressText')
  progressTextElement.innerText = ''
  dialogElement.appendChild(progressTextElement)
}

function updateProgress (value, max, text) {
  if (value && max) {
    var progressElement = document.getElementById('dialogProgress')
    progressElement.setAttribute('max', max)
    progressElement.setAttribute('value', value)
  }

  if (typeof text === 'string') {
    var textElement = document.getElementById('dialogProgressText')
    textElement.innerText = text
  }
}

function showSdError (title, info) {
  var dialogElement = document.getElementById('dialog')

  var progressElement = document.getElementById('dialogProgress')
  dialogElement.removeChild(progressElement)

  var imageElement = document.getElementById('dialogImage')
  dialogElement.removeChild(imageElement)

  var progressTextElement = document.getElementById('dialogProgressText')
  dialogElement.removeChild(progressTextElement)

  var titleElement = document.getElementById('dialogTitle')
  titleElement.innerText = title

  var infoElement = document.createElement('p')
  infoElement.setAttribute('id', 'dialogInfo')
  infoElement.innerText = info
  dialogElement.appendChild(infoElement)

  var closeButtonElement = document.createElement('button')
  closeButtonElement.setAttribute('class', 'dialogButton')
  closeButtonElement.innerText = 'Close'
  closeButtonElement.addEventListener('click', dialogCloseClicked)
  dialogElement.appendChild(closeButtonElement)
}

function showSdComplete (title) {
  var dialogElement = document.getElementById('dialog')
  dialogElement.style.height = '175px'
  dialogElement.style.marginTop = '-88px'

  var progressElement = document.getElementById('dialogProgress')
  dialogElement.removeChild(progressElement)

  var progressTextElement = document.getElementById('dialogProgressText')
  dialogElement.removeChild(progressTextElement)

  var imageElement = document.getElementById('dialogImage')
  imageElement.setAttribute('src', path.join(__dirname, '../app/img/success.png'))

  var titleElement = document.getElementById('dialogTitle')
  titleElement.innerText = title

  var breakElement = document.createElement('br')
  dialogElement.appendChild(breakElement)

  var closeButtonElement = document.createElement('button')
  closeButtonElement.setAttribute('class', 'dialogButton')
  closeButtonElement.innerText = 'Close'
  closeButtonElement.addEventListener('click', dialogCloseClicked)
  dialogElement.appendChild(closeButtonElement)
}

function showBlockInfo () {
  // TODO - show the block info window
}

function removeIntro () {
  var spinner = document.getElementsByClassName('spinner')
  if (spinner.length < 0) {
    return new Error("pibakery ui - can't remove spinner - no spinners exist")
  }
  if (spinner.length !== 1) {
    return new Error("pibakery ui - can't remove spinner - more than one spinner exists")
  }
  spinner = spinner[0]
  spinner.style.display = 'none'

  var credits = document.getElementById('credits')
  if (!credits) {
    return new Error("pibakery ui - can't remove credits - can't find div")
  }
  credits.style.display = 'none'
}

function showWorkspace () {
  var blocklyEditor = document.getElementById('blockly_editor')
  if (!blocklyEditor) {
    return new Error("pibakery ui - can't show block editor - can't find block editor")
  }
  blocklyEditor.style.display = 'block'

  var toolbox = document.getElementById('toolbox')
  if (!toolbox) {
    return new Error("pibakery ui - can't show block editor - can't find toolbox")
  }
}
