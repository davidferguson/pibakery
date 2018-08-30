/*
 * PiBakery 2.0.0 - The easy to use setup tool for Raspberry Pi
 * Copyright (C) 2018  David Ferguson <david@pibakery.org>
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
  inject: inject,
  loadBlocks: loadBlocks,
  validateField: validateField,
  generateScript: generateScript,
  getXml: getXml,
  loadXml: loadXml
}


var pd = require('pretty-data').pd
var fs = require('fs-extra')
var path = require('path')
var blockloader = require('./blockloader.js')
var blockupdates = require('./blockupdates.js')
var blocktransform = require('./blocktransform.js')


var workspace = {}
var categories = {}

var validation = blockloader.validation
var blockMapper = blockloader.blockMapper


function loadBlocks (toolbox, cb) {
  // check and perform update if necessary
  blockupdates.update(function (error) {
    if (error) {
      console.error(error)
    }

    // load the blocks
    blockloader.load(workspace, toolbox, cb)
  })
}


function inject (editor, toolbox) {
  //module.exports.workspace = Blockly.inject(editor, {toolbox: toolbox})
  workspace = Blockly.inject(editor, {toolbox: toolbox})
  //module.exports.workspace.addChangeListener(validateBlocks)
  workspace.addChangeListener(validateBlocks)
}


function bashEscape (arg) {
  // Thanks to creationix on GitHub
  var safePattern = /^[a-z0-9_\/\-.,?:@#%^+=\[\]]*$/i
  var safeishPattern = /^[a-z0-9_\/\-.,?:@#%^+=\[\]{}|&()<>; *']*$/i
  if (safePattern.test(arg)) {
    return arg
  }
  if (safeishPattern.test(arg)) {
    return '"' + arg + '"'
  }
  return "'" + arg.replace(/'+/g, function (val) {
    if (val.length < 3) {
      return "'" + val.replace(/'/g, "\\'") + "'"
    }
    return '\'"' + val + '"\''
  }) + "'"
}


/**
  * @desc called every time a block field is edited, checks to see if the input
  * to the block is valid for that block
  * @param object block - the block object that contains all the info about the
  * block that has been edited, including info about the block's fields
  * @param string value - the current value of the field being edited
  * @return null
*/
function validateField (block, value) {
  for (var i = 0; i < block.inputList.length; i++) {
    for (var j = 0; j < block.inputList[i].fieldRow.length; j++) {
      if (block.inputList[i].fieldRow[j].text_ === value) {
        for (var k = 0; k < validation.length; k++) {
          if (validation[k].block === block.type && validation[k].field === block.inputList[i].fieldRow[j].name) {
            if (validation[k].type === 'number') {
              value = value.replace(/[^0-9]/g, '')
            }
            if (validation[k].max !== 0) {
              if (value.length > validation[k].max) {
                return value.substring(0, validation[k].max)
              }
            }
          }
        }
      }
    }
  }
  return value
}


/**
  * @desc called whenever blocks are moved around, checks to make sure the user
	* hasn't put the shutdown or reboot block with the oneveryboot startup
  * @param object event - passed from blockly
  * @return null
*/
function validateBlocks (event) {
  // generate the code for the blocks
  //var code = window.Blockly.PiBakery.workspaceToCode(module.exports.workspace)
  var code = window.Blockly.PiBakery.workspaceToCode(workspace)
  code = code.split('\n')

  var everyBootCode = ''
  var codeType = ''
  var expectHat = true

  // move the code sections into their variables (firstboot, everyboot, etc.)
  for (var i = 0; i < code.length; i++) {
    var currentLine = code[i]
    if (currentLine.indexOf('\t') === 0 && expectHat === false) {
      if (codeType === 'everyBoot') {
        if (everyBootCode === '') {
          everyBootCode = currentLine.replace('\t', '')
        } else {
          everyBootCode = everyBootCode + '\n' + currentLine.replace('	', '')
        }
      }
    } else if (currentLine === '_pibakery-oneveryboot') {
      codeType = 'everyBoot'
      expectHat = false
    } else if (currentLine === '_pibakery-onfirstboot') {
      codeType = 'firstBoot'
      expectHat = false
    } else if (currentLine === '_pibakery-onnextboot') {
      codeType = 'nextBoot'
      expectHat = false
    } else if (currentLine === '') {
      expectHat = true
    }
  }

  // check to see if the shutdown or reboot block has been used with everyboot
  if ((everyBootCode.split('\n')[everyBootCode.split('\n').length - 1] === '/boot/PiBakery/blocks/shutdown/shutdown.sh') ||
      (everyBootCode.split('\n')[everyBootCode.split('\n').length - 1] === '/boot/PiBakery/blocks/reboot/reboot.sh')) {
    //module.exports.workspace.getBlockById(event.blockId).unplug()
    workspace.getBlockById(event.blockId).unplug()
    //module.exports.workspace.getBlockById(event.blockId).bumpNeighbours_()
    workspace.getBlockById(event.blockId).bumpNeighbours_()
    // alert("You can't put that block there.")
  }
}


// generates the script of the blocks
// returns array [everyBootCode, firstBootCode, nextBootCode, neededBlocks,
// waitForNetwork] - the every boot script, the first boot script, the next
// boot script, the list of blocks needed to be copied, and whether PiBakery
// should wait for a network connection before running the scripts
function generateScript () {
  //var code = window.Blockly.PiBakery.workspaceToCode(module.exports.workspace)
  var code = window.Blockly.PiBakery.workspaceToCode(workspace)
  code = code.split('\n')

  var firstBootCode = ''
  var everyBootCode = ''
  var nextBootCode = ''

  var firstBootCount = 0
  var everyBootCount = 0
  var nextBootCount = 0

  var codeType = ''
  var neededBlocks = []
  var expectHat = true

  var networkRequiredPosition = [-1, -1, -1]
  var wifiPosition = [-1, -1, -1]
  var waitForNetwork = [false, false, false]

  for ( var x = 0; x < code.length; x++) {
    var currentLine = code[x]

    if (currentLine.indexOf('\t') == 0 && expectHat == false) {
      if (currentLine != '\tNETWORK=True') {
        // add the blockname to our list
        var blockName = currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0]
        if (neededBlocks.indexOf(blockName) == -1) {
          neededBlocks.push(blockName)
        }

        // actually generate the code (with whiptail dialogs as well)
        if (codeType == 'everyBoot') {
          everyBootCount++
          everyBootCode = everyBootCode + '\n' + currentLine.replace('\t', '') + ' >>/boot/PiBakery/everyboot.log 2>&1  || true'
          // everyBootCode = everyBootCode + "\necho $(expr $PERCENTAGE \\* " + everyBootCount + " )"
          everyBootCode = everyBootCode + '\necho XXX\necho $(expr $PERCENTAGE \\* ' + everyBootCount + ' )\necho "\\nProcessing Every Boot Script\\n\\nRunning Block: ' + currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0] + '"\necho XXX'
        }
        else if (codeType == 'firstBoot') {
          firstBootCount++
          firstBootCode = firstBootCode + '\n' + currentLine.replace('\t', '') + ' >>/boot/PiBakery/firstboot.log 2>&1 || true'
          // firstBootCode = firstBootCode + "\necho $(expr $PERCENTAGE \\* " + firstBootCount + " )"
          firstBootCode = firstBootCode + '\necho XXX\necho $(expr $PERCENTAGE \\* ' + firstBootCount + ' )\necho "\\nProcessing First Boot Script\\n\\nRunning Block: ' + currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0] + '"\necho XXX'
        }
        else if (codeType == 'nextBoot') {
          nextBootCount++
          nextBootCode = nextBootCode + '\n' + currentLine.replace('\t', '') + ' >>/boot/PiBakery/nextboot.log 2>&1 || true'
          // nextBootCode = nextBootCode + "\necho $(expr $PERCENTAGE \\* " + nextBootCount + " )"
          nextBootCode = nextBootCode + '\necho XXX\necho $(expr $PERCENTAGE \\* ' + nextBootCount + ' )\necho "\\nProcessing Next Boot Script\\n\\nRunning Block: ' + currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0] + '"\necho XXX'
        }

        // handle the waitForNetwork stuff
        if (blockName == 'wifisetup') {
          if (codeType == 'everyBoot') {
            wifiPosition[0] = everyBootCount
          }
          else if (codeType == 'firstBoot') {
            wifiPosition[1] = firstBootCount
          }
          else if (codeType == 'nextBoot') {
            wifiPosition[2] = nextBootCount
          }
        }
      }
      else if (currentLine == '\tNETWORK=True') {
        if (codeType == 'everyBoot') {
          networkRequiredPosition[0] = everyBootCount
        }
        else if (codeType == 'firstBoot') {
          networkRequiredPosition[1] = firstBootCount
        }
        else if (codeType == 'nextBoot') {
          networkRequiredPosition[2] = nextBootCount
        }
      }
    }
    else if (currentLine == '_pibakery-oneveryboot') {
      codeType = 'everyBoot'
      expectHat = false
    }
    else if (currentLine == '_pibakery-onfirstboot') {
      codeType = 'firstBoot'
      expectHat = false
    }
    else if (currentLine == '_pibakery-onnextboot') {
      codeType = 'nextBoot'
      expectHat = false
    }
    else if (currentLine == '') {
      expectHat = true
    }
  }

  if (firstBootCode != '') {
    firstBootCode = '#!/bin/bash\n\nPERCENTAGE=' + Math.floor(100 / firstBootCount) + '\n\n{' + firstBootCode + '\necho 100\n} | whiptail --title "PiBakery" --gauge "\\nProcessing First Boot Script\\n\\n\\n" 11 40 0'
  }else {
    firstBootCode = '#!/bin/bash'
  }

  if (everyBootCode != '') {
    everyBootCode = '#!/bin/bash\n\nPERCENTAGE=' + Math.floor(100 / everyBootCount) + '\n\n{' + everyBootCode + '\necho 100\n} | whiptail --title "PiBakery" --gauge "\\nProcessing Every Boot Script\\n\\n\\n" 11 40 0'
  }else {
    everyBootCode = '#!/bin/bash'
  }

  if (nextBootCode != '') {
    nextBootCode = '#!/bin/bash\n\nPERCENTAGE=' + Math.floor(100 / nextBootCount) + '\n\n{' + nextBootCode + '\necho 100\n} | whiptail --title "PiBakery" --gauge "\\nProcessing Next Boot Script\\n\\n\\n" 11 40 0'
  }else {
    nextBootCode = '#!/bin/bash'
  }

  // if we do need a network connection, and (there is not wifi) or (there is wifi but it's after we need network)
  if ((networkRequiredPosition[0] != -1) && (wifiPosition[0] == -1 || (wifiPosition[0] != -1 && networkRequiredPosition[0] < wifiPosition[0]))) {
    waitForNetwork[0] = true
  }

  if ((networkRequiredPosition[1] != -1) && (wifiPosition[1] == -1 || (wifiPosition[1] != -1 && networkRequiredPosition[1] < wifiPosition[1]))) {
    waitForNetwork[1] = true
  }

  if ((networkRequiredPosition[2] != -1) && (wifiPosition[2] == -1 || (wifiPosition[2] != -1 && networkRequiredPosition[2] < wifiPosition[2]))) {
    waitForNetwork[2] = true
  }

  // create the proper paths for the needed blocks
  var blockPaths = []
  for (var i = 0; i < neededBlocks.length; i++) {
    blockPaths.push(blockMapper[neededBlocks[i]])
  }

  return {
    everyBoot: everyBootCode,
    firstBoot: firstBootCode,
    nextBoot: nextBootCode,
    blocks: neededBlocks,
    blockPaths: blockPaths,
    waitForNetwork: waitForNetwork
  }
  //return [everyBootCode, firstBootCode, nextBootCode, neededBlocks, waitForNetwork]
}


function getXml () {
  // get the XML text version of the boot type

  // convert the blocks to xml
  var blocksXml = Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(workspace))

  // add in the xml element representing the firstboot status - legacy reasons
  var xmlElement = (new window.DOMParser()).parseFromString(blocksXml, 'text/xml')
  var firstboot = xmlElement.createElement('firstboot')
  firstboot.appendChild(xmlElement.createTextNode('0'))
  xmlElement.getElementsByTagName('xml')[0].appendChild(firstboot)

  // serialise the xml element to string
  blocksXml = new XMLSerializer().serializeToString(xmlElement)
  var prettyXml = pd.xml(blocksXml)
  return prettyXml
}


function loadXml (data) {
  // perform transformations on the blocks
  var xml = blocktransform.transform(data)

  // load it into blockly
  Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace)
}
