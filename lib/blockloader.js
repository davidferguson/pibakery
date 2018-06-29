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
  load: load,
  validation: validation,
  blockMapper: blockMapper
}


var app = require('electron').app || require('electron').remote.app
var fs = require('fs-extra')
var path = require('path')

var blockDirectory = path.join(app.getPath('appData'), 'PiBakery/blocks')
var backupBlocks = path.join(__dirname, '../pibakery-blocks')

var workspace = {}
var blockMapper = {}
var validation = []
module.exports.blockMapper = blockMapper
module.exports.validation = validation


function load (workspace, toolbox, cb) {
  fs.stat(blockDirectory, function (error, stats) {
    // block directory doesn't exist - revert to backup blocks
    if (error) {
      loadFromDirectories([backupBlocks], workspace, toolbox, cb)
      return
    }

    // read the block directories and load them
    fs.readdir(blockDirectory, function (error, files) {
      if (error || files.length == 0) {
        // error or no directories - revert back to backup blocks
        loadFromDirectories([backupBlocks], workspace, toolbox, cb)
        return
      }

      for (var i = 0; i < files.length; i++) {
        files[i] = path.join(blockDirectory, files[i])
      }

      // load blocks from those directories
      loadFromDirectories(files, workspace, toolbox, function (error) {
        // either an error, or no blocks added
        if (error || Object.keys(blockMapper).length === 0) {
          loadFromDirectories([backupBlocks], workspace, toolbox, cb)
          return
        }
        cb(null)
      })
    })
  })
}


function loadFromDirectories (directories, workspace, toolbox, cb, count) {
  // first time calling? set count to 0
  if (typeof count === 'undefined') {
    count = 0
  }

  // done all directories? run callback
  if (count >= directories.length) {
    cb(null)
    return
  }

  var directory = directories[count]
  loadFromDirectory(directory, workspace, toolbox, function (error) {
    if (error) {
      // go onto next block
      loadFromDirectories(directories, workspace, toolbox, cb, (count + 1))
      return
    }

    loadFromDirectories(directories, workspace, toolbox, cb, (count + 1))
  })
}


function loadFromDirectory (directory, workspace, toolbox, cb) {
  // read the .json files from this directory
  readBlockFiles(directory, function (error, categoriesJSON, blocksJSON) {
    if (error) {
      cb(error)
      return
    }

    // load the categories from this directory
    loadCategories(categoriesJSON, toolbox)

    // load the blocks (async) from this directory
    loadBlocksAsync(blocksJSON, directory, toolbox, function (error) {
      if (error) {
        cb(error)
        return
      }

      // update the toolbox
      workspace.updateToolbox(toolbox)
      cb(null)
    })
  })
}


function readBlockFiles (directory, cb) {
  var blockFile = path.join(directory, 'info.json')
  var categoryFile = path.join(directory, 'categories.json')

  // read the block file
  fs.readFile(blockFile, 'utf8', function (error, blockInfo) {
    if (error) {
      cb(error)
      return
    }

    // also read the categories file
    fs.readFile(categoryFile, 'utf8', function (error, categoryInfo) {
      if (error) {
        cb(error)
        return
      }

      // get them both from JSON into javascript object
      try {
        var categoriesJSON = JSON.parse(categoryInfo).categories
        var blocksJSON = JSON.parse(blockInfo).loadOrder
      } catch (error) {
        cb(error)
        return
      }

      // return the JSON data
      cb(null, categoriesJSON, blocksJSON)
    })
  })
}


function loadCategories (categoriesJSON, toolbox) {
  // add in the custom categories
  for (var i = 0; i < categoriesJSON.length; i++) {
    categoriesJSON[categoriesJSON[i].name] = categoriesJSON[i].colour
    var newCategory = document.createElement('category')
    newCategory.setAttribute('name', categoriesJSON[i].display)
    newCategory.setAttribute('colour', categoriesJSON[i].colour)
    newCategory.setAttribute('id', categoriesJSON[i].name)
    toolbox.appendChild(newCategory)
  }
}


function loadBlocksAsync (blocks, directory, toolbox, cb, count) {
  if (typeof count === 'undefined') {
    count = 0
  }

  if (count >= blocks.length) {
    cb(null)
    return
  }

  var blockName = blocks[count]
  var jsonPath = path.join(directory, blockName, (blockName + '.json'))

  fs.readFile(jsonPath, 'utf8', function (error, data) {
    if (error) {
      cb(error)
      return
    }

    // parse the json
    try {
      var blockJSON = JSON.parse(data)
    } catch (error) {
      cb(error)
      return
    }

    // import this block
    importBlock(blockJSON, toolbox)

    // add this block to the path mapper
    var blockPath = path.join(directory, blockName)
    blockMapper[blockName] = blockPath

    // go load the next block
    loadBlocksAsync(blocks, directory, toolbox, cb, (count + 1))
  })
}


function importBlock (blockJSON, toolbox) {
  blockJSON.type = blockJSON.category

  // get the block properties
  var blockName = blockJSON.name
  var blockText = blockJSON.text
  var blockArgs = blockJSON.args
  var numArgs = blockArgs.length
  var supportedOperatingSystems = blockJSON.supportedOperatingSystems

  // get the block colour
  var blockColour = 0
  for (var i = 0; i < toolbox.children.length; i++) {
    if (toolbox.children[i].id === blockJSON.type) {
      blockColour = toolbox.children[i].getAttribute('colour')
    }
  }

  // create the blockly JSON object
  var blocklyBlock = {}
  blocklyBlock.id = blockName
  blocklyBlock.colour = blockColour
  blocklyBlock.helpUrl = blockJSON.longDescription
  blocklyBlock.tooltip = blockJSON.shortDescription

  // if the block has multiple lines, implement that in the blockly standard
  var currentCount = 0
  while (blockText.indexOf('\\n') !== -1) {
    blockText = blockText.replace('\\n', ('%' + (numArgs + 1 + currentCount)))
    currentCount++
  }
  blocklyBlock.message0 = blockText

  // loop through the arguments adding them to the blockly object
  blocklyBlock.args0 = []
  for (var i = 0; i < blockJSON.args.length; i++) {
    var newArg = {}
    var currentArg = blockJSON.args[i]
    if (currentArg.type === 'number' || currentArg.type === 'text') {
      newArg.type = 'field_input'
      newArg.name = i + 1
      newArg.text = currentArg.default
      validation.push({
        block: blockName,
        field: i + 1,
        max: currentArg.maxLength,
        type: currentArg.type
      })
    } else if (currentArg.type === 'menu') {
      newArg.type = 'field_dropdown'
      newArg.name = i + 1
      newArg.options = []
      for (var j = 0; j < currentArg.options.length; j++) {
        var currentOption = currentArg.options[j]
        var newOption = [currentOption, currentOption]
        newArg.options.push(newOption)
      }
    } else if (currentArg.type === 'check') {
      newArg.type = 'field_checkbox'
      newArg.name = i + 1
      newArg.checked = currentArg.default
    }
    blocklyBlock.args0.push(newArg)
  }
  for (var i = 0; i < currentCount; i++) {
    blocklyBlock.args0.push({type: 'input_dummy'})
  }
  blocklyBlock.previousStatement = true
  blocklyBlock.nextStatement = true

  // blocklyBlock has  been created - now we need to add it into PiBakery
  Blockly.Blocks[blockName] = {
    init: function () {
      this.jsonInit(blocklyBlock)
      this.setNextStatement(blockJSON.continue)
    }
  }

  // That's us finished with blocklyBlock - now go and creat the code generator
  Blockly.PiBakery[blockName] = function (block) {
    var code = '\n\tchmod 755 /boot/PiBakery/blocks/' + blockName + '/' + blockJSON.script
    code = code + '\n\t/boot/PiBakery/blocks/' + blockName + '/' + blockJSON.script + ' '
    for (var i = 0; i < blockJSON.args.length; i++) {
      var currentArg = bashEscape(block.getFieldValue(i + 1))
      if (currentArg === '') {
        currentArg = '""'
      }
      code = code + currentArg + ' '
    }
    code = code.slice(0, -1)
    if (blockJSON.network) {
      code = code + '\n\tNETWORK=True'
    }
    return code
  }

  // And the last thing to to is to add that block to the toolbox
  var newBlock = document.createElement('block')
  newBlock.setAttribute('type', blockName)
  document.getElementById(blockJSON.type).appendChild(newBlock)
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
