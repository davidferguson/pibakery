/*
    PiBakery - The easiest way to setup a Raspberry Pi
    Copyright (C) 2016-2018  David Ferguson

    This file is part of PiBakery.

    PiBakery is free software: you can redistribute it and/or modify it under
		the terms of the GNU General Public License as published by the Free
		Software Foundation, either version 3 of the License, or (at your option)
		any later version.

    PiBakery is distributed in the hope that it will be useful, but WITHOUT ANY
		WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
		FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
		details.

    You should have received a copy of the GNU General Public License along with
		PiBakery. If not, see <http://www.gnu.org/licenses/>.

    PiBakery uses Google Blockly which is licensed under the Apache License
		Version 2.0, a copy of which can be found in the file ./app/blockly/LICENSE

    PiBakery uses Win32DiskImager (Image Writer for Windows) which is licensed
		under the GNU General Public License as published by the Free Software
		Foundation, version 2 or later, a copy of which can be found in the file
		./CommandLineDiskImager/GPL-2

    PiBakery uses p7zip which is licensed under the GNU General Public License
		as published by the Free Software Foundation, version 2.1 or later, a copy
		of which can be found in the file p7zip-license.txt

    PiBakery uses 7zip (7za) which is licensed under the GNU Lesser General
		Public License as published by the Free Software Foundation, version 2.1 or
		later, a copy of which can be found in the file 7zip-license.txt
*/

'use strict'

var extractProgress

var drivelist = require('drivelist')
var imageWrite = require('resin-image-write')
var exec = require('child_process').exec
var execSync = require('child_process').execSync
var dialog = require('electron').remote.dialog
var request = require('request')
var fs = require('fs-extra')
var isOnline = require('is-online')
var umount = require('umount')
var shellParser = require('node-shell-parser')
var scanner = require('drivelist-scan')
var path = require('path')
var wget = require('wget-improved')
var md5File = require('md5-file')
var extract = require('extract-zip')
var chmod = require('chmod')
var df = require('node-df')
var ipcRenderer = require('electron').ipcRenderer

var writeTryCount = 0
var workspace = false
var validation = []
var firstBoot = true
var currentMode = 'write'
var piBakeryPath
var tempBlocks = []
var blockSupportedOs = {}
var categoryTypeText = ['hat']
var categoryTypeColour = [20]

/**
  * @desc checks that the os and blocks exist, and sets up PiBakery
  * @return null
*/
function getOsPath () {
  if (process.platform == 'darwin') {
    // Mac stores the OS in Application Support
    return path.normalize('/Library/Application Support/PiBakery/os/')
  }
  else if (process.platform == 'win32' || process.platform == 'linux') {
    // Windows stores the OS in install directory
    return path.normalize(__dirname + '/../os/')
  }else {
    return null
  }
}

/**
  * @desc checks that the os and blocks exist, and sets up PiBakery
  * @return null
*/
function initialise () {
  checkInstalledOperatingSystsms(function () {
    fs.stat(path.normalize(__dirname + '/../pibakery-blocks/info.json'), function (error, stats) {
      if (error) {
        console.error(error)
        fixBlocks()
        return
      }
      document.getElementById('blockly_editor').style.display = 'block'
      document.getElementsByClassName('spinner')[0].style.display = 'none'
      document.getElementById('credits').style.display = 'none'
      workspace = Blockly.inject('blockly_editor', {toolbox: document.getElementById('toolbox')})
      workspace.addChangeListener(validateBlocks)
      loadBlocks()
      document.getElementById('flashSD').addEventListener('click', writeToSd)
      document.getElementById('importRecipe').addEventListener('click', importRecipe)
      document.getElementById('exportRecipe').addEventListener('click', exportRecipe)
      checkForRaspbianUpdates(function () {
        checkForBlockUpdates()
      })
      // implement copy and paste in Blockly
      ipcRenderer.on('paste', function (event, clipboard) {
        document.getElementsByClassName('blocklyHtmlInput')[0].value = clipboard
      })
      ipcRenderer.on('testBlock', function (event) {
        importTestBlock(dialog.showOpenDialog({properties: ['openDirectory']})[0])
      })
    })
  })
}

initialise()

/**
  * @desc called by initialise, checks to see which operating systems in
  * images.json are installed, and writes that back to images.json
  * @param function cb - callback
  * @return null
*/
function checkInstalledOperatingSystsms (cb) {
  fs.readFile(path.normalize(getOsPath() + 'images.json'), 'utf8', function (error, data) {
    if (error) {
      alert('Internal PiBakery Error: ' + error)
      console.error(error)
      return
    }
    data = JSON.parse(data)
    var length = data.length
    var processed = 0
    for (var i = 0; i < data.length; i++) {
      checkOs(data, i, function () {
        processed++
        if (processed == length) {
          data = JSON.stringify(data)
          fs.writeFile(path.normalize(getOsPath() + 'images.json'), data, function (error) {
            if (error) {
              alert('Internal PiBakery Error: ' + error)
              console.error(error)
              return
            }
            cb()
          })
        }
      })
    }
  })
}

/**
  * @desc called by checkInstalledOperatingSystsms, checks to see if a single os
  * is installed and modifies the installed key accordingly.
  * @param object data - the data extracted from images.json, changes depending
  * on whether the OS is installed or not
  * @param number i - the current index we are processing
  * @param function cb - callback
  * @return null
*/
function checkOs (data, i, cb) {
  var filepath = data[i].filename
  fs.stat(path.normalize(getOsPath() + filepath), function (error, stat) {
    if (error) {
      data[i].installed = false
    } else {
      data[i].installed = true
    }
    cb()
  })
}

/**
  * @desc redownloads the blocks if they hasn't been found by initialise()
  * @return null
*/
function fixBlocks () {
  isOnline().then(function(online) {

    var hider = document.createElement('div')
    hider.setAttribute('id', 'hider')
    document.body.appendChild(hider)

    var writeDiv = document.createElement('div')
    writeDiv.setAttribute('id', 'writingMessage')
    var title = document.createElement('p')
    title.setAttribute('id', 'writeProgressTitle')
    title.innerHTML = 'PiBakery Error'
    var writeAnimationDiv = document.createElement('p')
    writeAnimationDiv.setAttribute('class', 'infoParagraph')
    writeAnimationDiv.innerText = 'PiBakery has encounted an error on starting up, as it is unable to find the blocks that make up PiBakery.'
    var writeAnimationDiv2 = document.createElement('p')
    writeAnimationDiv2.setAttribute('class', 'infoParagraph')
    if ((! error) && online) {
      writeAnimationDiv2.innerText = 'PiBakery can attempt to fix this for you. If this error persists, please reinstall PiBakery.'
    }else {
      writeAnimationDiv2.innerText = 'PiBakery can attempt to fix this for you, if you connect to the internet. Otherwise, please reinstall PiBakery.'
    }
    writeDiv.appendChild(title)
    writeDiv.appendChild(writeAnimationDiv)
    writeDiv.appendChild(writeAnimationDiv2)

    if ((! error) && online) {
      var writeButton = document.createElement('button')
      writeButton.setAttribute('id', 'writeButton')
      writeButton.innerHTML = 'Attempt Fix'
      writeButton.addEventListener('click', function () {
        request.get('https://raw.githubusercontent.com/davidferguson/pibakery-blocks/master/info.json', function (error, response, body) {
          if (error) {
            console.error(error)
            return
          }
          if (response.statusCode == 200) {
            var compressedHash = JSON.parse(body).compressedMD5
            var downloadUrl = JSON.parse(body).downloadUrl
            var newBlocksVersion = JSON.parse(body).version

            hider.parentNode.removeChild(hider)
            writeDiv.parentNode.removeChild(writeDiv)
            updateBlocks(downloadUrl, compressedHash, body, 1)
          }
        })
      })
    }

    var closeButton = document.createElement('button')
    closeButton.setAttribute('id', 'closeButton')
    closeButton.innerHTML = 'Close'
    closeButton.addEventListener('click', function () {
      hider.parentNode.removeChild(hider)
      writeDiv.parentNode.removeChild(writeDiv)
    })

    writeDiv.appendChild(closeButton)
    writeDiv.appendChild(writeButton)
    document.body.appendChild(writeDiv)
  })
}

/**
  * @desc called whenever blocks are moved around, checks to make sure the user
	* hasn't put the shutdown or reboot block with the oneveryboot startup
  * @param object event - passed from blockly
  * @return null
*/
function validateBlocks (event) {
  var code = window.Blockly.PiBakery.workspaceToCode(workspace)
  code = code.split('\n')

  var everyBootCode = ''
  var codeType = ''
  var neededBlocks = []
  var expectHat = true

  for ( var x = 0; x < code.length; x++) {
    var currentLine = code[x]
    if (currentLine.indexOf('\t') == 0 && expectHat == false) {
      if (codeType == 'everyBoot') {
        if (everyBootCode == '') {
          everyBootCode = currentLine.replace('\t', '')
        }else {
          everyBootCode = everyBootCode + '\n' + currentLine.replace('	', '')
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
  if ((everyBootCode.split('\n')[everyBootCode.split('\n').length - 1] == '/boot/PiBakery/blocks/shutdown/shutdown.sh') || (everyBootCode.split('\n')[everyBootCode.split('\n').length - 1] == '/boot/PiBakery/blocks/reboot/reboot.sh')) {
    workspace.getBlockById(event.blockId).unplug()
    workspace.getBlockById(event.blockId).bumpNeighbours_()
    alert("You can't put that block there.")
  }
}

/**
  * @desc called by initialise to see if there are updates to the blocks
  * @return null
*/
function checkForBlockUpdates () {
  fs.readFile(path.normalize(__dirname + '/../pibakery-blocks/info.json'), 'utf8', function (error, data) {
    if (error) {
      console.error(error)
      return
    }
    var myBlocksVersion = JSON.parse(data).version
    request.get('https://raw.githubusercontent.com/davidferguson/pibakery-blocks/master/info.json', function (error, response, body) {
      if (error) {
        console.error(error)
        return
      }
      if (response.statusCode == 200) {
        var compressedHash = JSON.parse(body).compressedMD5
        var downloadUrl = JSON.parse(body).downloadUrl
        var newBlocksVersion = JSON.parse(body).version

        if (newBlocksVersion > myBlocksVersion) {
          var choice = dialog.showMessageBox(
            {
              type: 'question',
              buttons: ['Yes', 'No'],
              title: 'PiBakery Update',
              message: 'There is an update for the blocks of PiBakery. Although updating is not required, it is recommended.\nDo you want to update now?\nThis may take a few minutes to complete.'
            })
          if (choice == 0) {
            updateBlocks(downloadUrl, compressedHash, body, 0)
          }
        }
      }
    })
  })
}

/**
  * @desc called by initialise to see if there are updates to raspbian
  * @param function cb - callback
  * @return null
*/
function checkForRaspbianUpdates (cb) {
  fs.readFile(path.normalize(getOsPath() + 'images.json'), 'utf8', function (error, data) {
    if (error) {
      console.error(error)
      return
    }
    var localImagesJson = JSON.parse(data)
    var installedImages = []
    var installedImagesIndexes = []
    for (var i = 0; i < localImagesJson.length; i++) {
      if (localImagesJson[i].installed) {
        installedImages.push(localImagesJson[i].filename)
        installedImagesIndexes.push(i)
      }
    }

    request.get('https://raw.githubusercontent.com/davidferguson/pibakery-raspbian/master/images.json', function (error, response, body) {
      if (error) {
        console.error(error)
        return
      }
      if (response.statusCode == 200) {
        var images = JSON.parse(body)
        for (var i = 0; i < images.length; i++) {
          var newOsVersion = images[i].version
          var newOsFilename = images[i].filename
          var index = installedImages.indexOf(newOsFilename)
          if (index == -1) {
            continue
          }
          var myOsVersion = localImagesJson[index].version
          var skipVersion = localImagesJson[index].skipVersion
          var newOsName = images[i].displayName

          if ((newOsVersion > myOsVersion) && (newOsVersion != skipVersion)) {
            var choice = dialog.showMessageBox({
              type: 'question',
              buttons: ['Update now', 'Remind me later', 'Skip update'],
              title: 'PiBakery Update',
              message: 'There is an update for "' + newOsName + '", the Raspberry Pi operating system.\nThis is a large file and could take several hours to download.'
            })
            if (choice == 0) {
              updateRaspbian(images[i])
            // updateRaspbian(downloadUrl, compressedHash, uncompressedHash, uncompressedSize, body, 0, compressedFilename, uncompressedFilename, newOsFilename, newOsVersion)
            } else if (choice == 2) {
              localImagesJson[index].skipVersion = newOsVersion
              data = JSON.stringify(localImagesJson)
              fs.writeFile(path.normalize(getOsPath() + 'images.json'), data, function (error) {
                if (error) {
                  console.error(error)
                }
              })
            }
            break
          }else if ((i + 1) == images.length) {
            cb()
          }
        }
      }
    })
  })
}

/**
  * @desc called by fixBlocks and checkForBlockUpdates, used to download the
	* blocks off GitHub.
  * @param string src - the URL of the zip blocks on GitHub
	* @param string downloadHash - the MD5 hash of the zip of the blocks. Used to
	* verify that the download was successful
	* @param string newBlocksInfo - the json info of the new blocks. Used to write
	* the --info.json-- images.json file that identifies the blocks
	* @param bool fixing - whether we are updating of fixing. 1 when fixing, and 0
	* when updating
  * @return null
*/
function updateBlocks (src, downloadHash, newBlocksInfo, fixing) {
  var writeDiv, title, writeAnimationDiv, writeAnimation, writeProgress

  isOnline().then(function(online) {

    if (! online) {
      if (fixing) {
        alert('Unable to connect to server.\nTry again later, or reinstall PiBakery.')
      }else {
        alert('Unable to connect to server.\nTry updating later.')
      }
    }else {
      var hider = document.createElement('div')
      hider.setAttribute('id', 'hider')
      document.body.appendChild(hider)

      writeDiv = document.createElement('div')
      writeDiv.setAttribute('id', 'writingMessage')
      title = document.createElement('p')
      title.setAttribute('id', 'writeProgressTitle')
      if (fixing) {
        title.innerHTML = 'Auto-Fixing Blocks'
      }else {
        title.innerHTML = 'Updating Blocks'
      }
      writeAnimationDiv = document.createElement('p')
      writeAnimation = document.createElement('img')
      writeAnimation.setAttribute('id', 'writeAnimation')
      writeAnimation.setAttribute('class', 'updateAnimation')
      writeAnimation.setAttribute('src', __dirname + '/img/updating.gif')
      writeAnimationDiv.appendChild(writeAnimation)
      writeDiv.appendChild(title)
      writeDiv.appendChild(writeAnimationDiv)
      writeProgress = document.createElement('progress')
      writeProgress.setAttribute('id', 'writeProgressbar')
      writeProgress.setAttribute('value', 0)
      writeProgress.setAttribute('max', 1.01)
      writeDiv.appendChild(writeProgress)
      document.body.appendChild(writeDiv)

      var saveName = path.normalize(__dirname + '/../pibakery-blocks.zip')
      var blocksDownload = wget.download(src, saveName, {})
      blocksDownload.on('error', function (error) {
        console.error(error)
        if (fixing) {
          displayError('Auto-Fix Failed', 'Download Failed', 'Please try again, or reinstall PiBakery.')
        }else {
          displayError('Blocks Update Failed', 'Download Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
        }
      })
      blocksDownload.on('end', function (output) {
        md5File(saveName, function (error, sum) {
          if (error) {
            console.error(error)
            if (fixing) {
              displayError('Auto-Fix Failed', 'Download Corrupted', 'Please try again, or reinstall PiBakery.')
            }else {
              displayError('Blocks Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
            }
          }else {
            if (sum != downloadHash) {
              if (fixing) {
                displayError('Auto-Fix Failed', 'Download Corrupted', 'Please try again, or reinstall PiBakery.')
              }else {
                displayError('Blocks Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
              }
            }else {
              extract(saveName, {dir: path.normalize(__dirname + '/../')}, function (error) {
                if (error) {
                  console.error(error)
                  if (fixing) {
                    displayError('Auto-Fix Failed', 'Extract Failed', 'Please try again, or reinstall PiBakery.')
                  }else {
                    displayError('Blocks Update Failed', 'Extract Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                  }
                }else {
                  fs.remove(path.normalize(__dirname + '/../pibakery-blocks'), function (error) {
                    if (error && (! fixing)) {
                      console.error(error)
                      displayError('Blocks Update Failed', 'Removal of old blocks failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                      return
                    }
                    fs.move(path.normalize(__dirname + '/../pibakery-blocks-new'), path.normalize(__dirname + '/../pibakery-blocks'), function (error) {
                      if (error) {
                        console.error(error)
                        if (fixing) {
                          displayError('Auto-Fix Failed', 'Replace Failed', 'Please try again, or reinstall PiBakery.')
                        }else {
                          displayError('Blocks Update Failed', 'Replace Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                        }
                      }else {
                        setTimeout(function () {
                          fs.remove(saveName, function (error) // delete the zip
                          {
                            if (error) {
                              console.error(error)
                              if (fixing) {
                                displayError('Auto-Fix Failed', 'Unable to remove ZIP', 'Please try again, or reinstall PiBakery.')
                              }else {
                                displayError('Blocks Update Failed', 'Unable to remove ZIP', 'This might cause unexpected behaviour whilst using PiBakery.')
                              }
                            }else {
                              fs.writeFile(path.normalize(__dirname + '/../pibakery-blocks/info.json'), newBlocksInfo, function (error) {
                                if (error) {
                                  console.error(error)
                                  if (fixing) {
                                    displayError('Auto-Fix Failed', 'Unable to finish updating', 'Please try again, or reinstall PiBakery.')
                                  }else {
                                    displayError('Blocks Update Failed', 'Unable to finish updating', 'This might cause unexpected behaviour whilst using PiBakery.')
                                  }
                                }else {
                                  if (fixing) {
                                    title.innerHTML = 'Auto-Fix Successful'
                                    writeAnimation.setAttribute('src', __dirname + '/img/success.png')

                                    writeProgress.parentNode.removeChild(writeProgress)

                                    var closeBtnDiv = document.createElement('p')
                                    closeBtnDiv.setAttribute('id', 'closeBtnDiv')
                                    var closeBtn = document.createElement('button')
                                    closeBtn.setAttribute('id', 'closeBtn')
                                    closeBtn.innerHTML = 'Close'
                                    closeBtn.addEventListener('click', function () {
                                      hider.parentNode.removeChild(hider)
                                      writeDiv.parentNode.removeChild(writeDiv)
                                      initialise()
                                    })
                                    closeBtnDiv.appendChild(closeBtn)
                                    writeDiv.appendChild(closeBtnDiv)
                                  }else {
                                    /*var blockTypes = ['software', 'network', 'setting', 'other']
                                    for ( var i = 0; i < blockTypes.length; i++) {
                                      var myNode = document.getElementById(blockTypes[i])
                                      while (myNode.firstChild){
                                        myNode.removeChild(myNode.firstChild)
                                      }
                                    }*/

                                    loadBlocks()
                                    title.innerHTML = 'Update Successful'
                                    writeAnimation.setAttribute('src', __dirname + '/img/success.png')

                                    writeProgress.parentNode.removeChild(writeProgress)

                                    var closeBtnDiv = document.createElement('p')
                                    closeBtnDiv.setAttribute('id', 'closeBtnDiv')
                                    var closeBtn = document.createElement('button')
                                    closeBtn.setAttribute('id', 'closeBtn')
                                    closeBtn.innerHTML = 'Close'
                                    closeBtn.addEventListener('click', function () {
                                      hider.parentNode.removeChild(hider)
                                      writeDiv.parentNode.removeChild(writeDiv)
                                    })
                                    closeBtnDiv.appendChild(closeBtn)
                                    writeDiv.appendChild(closeBtnDiv)
                                  }
                                }
                              })
                            }
                          })
                        }, 1000)
                      }
                    })
                  })
                }
              })
            }
          }
        })
      })
      blocksDownload.on('progress', function (progress) {
        writeProgress.setAttribute('value', progress)
      })
    }
  })
}

/**
  * @desc called whenever a block is right-clicked on, to show a short
	* description of that block
  * @param string info - the description of the block from the block's JSON file
  * @return null
*/
function showBlockInto (info) {
  var writeDiv, title, writeAnimationDiv, writeAnimation, writeProgress

  var hider = document.createElement('div')
  hider.setAttribute('id', 'hider')
  document.body.appendChild(hider)

  writeDiv = document.createElement('div')
  writeDiv.setAttribute('id', 'writingMessage')

  title = document.createElement('p')
  title.setAttribute('id', 'writeProgressTitle')
  title.innerHTML = 'Block Info'

  writeAnimationDiv = document.createElement('p')
  writeAnimationDiv.setAttribute('class', 'blockInfo')
  writeAnimationDiv.innerText = info
  writeDiv.appendChild(title)
  writeDiv.appendChild(writeAnimationDiv)
  document.body.appendChild(writeDiv)

  var closeBtnDiv = document.createElement('p')
  closeBtnDiv.setAttribute('id', 'closeBtnDiv')
  var closeBtn = document.createElement('button')
  closeBtn.setAttribute('id', 'closeBtn')
  closeBtn.innerHTML = 'Close'
  closeBtn.addEventListener('click', function () {
    document.getElementById('hider').parentNode.removeChild(document.getElementById('hider'))
    document.getElementById('writingMessage').parentNode.removeChild(document.getElementById('writingMessage'))
  })
  closeBtnDiv.appendChild(closeBtn)
  document.getElementById('writingMessage').appendChild(closeBtnDiv)
}

/**
  * @desc called by updateRaspbian to extract the 7z compressed raspbian IMG
  * @param string archive - the path to the 7z archive
	* @param string outputDir - the directory to extract the 7z to
	* @param function callback - callback (boolean error)
  * @return null
*/
function extract7z (archive, outputdir, callback) {
  if (process.platform == 'darwin') {
    var binary = '"' + path.normalize(__dirname + '/../7z') + '"'
  }
  else if (process.platform == 'win32') {
    var binary = '"' + path.normalize(__dirname + '/../7z.exe') + '"'
  }
  else if (process.platform == 'linux') {
    var binary = '7za'
  }
  exec(binary + ' x -o"' + outputdir + '" "' + archive + '"', function (error, stdout, stderr) {
    callback(error)
  })
}

/**
  * @desc called by checkForRaspbianUpdates, used to download the OS off GitHub
  * @param string src - the URL of the 7z raspbian-pibakery on GitHub
	* @param string raspbian7zHash - the MD5 hash of the 7z of the OS. Used to
	* verify that the download was successful
	* @param string raspbianImgHash - the MD5 hash of the IMG of the OS. Used to
	* verify that the extract was successful
	* @param string raspbianImgHash - the MD5 hash of the IMG of the OS. Used to
	* verify that the extract was successful
	* @param integer extractedSize - the number of bytes of the extracted OS. Used
	* to update the progress bar
	* @param string newOsInfo - the JSON info of the version of raspbian. Used to
	* write the --info.json-- images.json os file
	* @param bool fixing - whether we are updating of fixing. 1 when fixing, and 0
	* when updating
  * @param string compressedFilename - the filename of the compressed file once
  * downloaded
  * @param string uncompressedFilename - the filename that the compressed file
  * will extract to
  * @return null
*/
// function updateRaspbian (src, raspbian7zHash, raspbianImgHash, extractedSize, newOsInfo, fixing, compressedFilename, uncompressedFilename, finalFilename, newOsVersion) {
function updateRaspbian (osJsonInfo) {
  var src = osJsonInfo.downloadUrl
  var raspbian7zHash = osJsonInfo.compressedMD5
  var raspbianImgHash = osJsonInfo.uncompressedMD5
  var extractedSize = osJsonInfo.uncompressedSize
  // newOsInfo and fixing
  var compressedFilename = osJsonInfo.compressedFilename
  var uncompressedFilename = osJsonInfo.uncompressedFilename
  var finalFilename = osJsonInfo.filename
  var newOsVersion = osJsonInfo.version

  var writeDiv, title, writeAnimationDiv, writeAnimation, writeProgress, writeDetailedProgress

  isOnline().then(function(online) {

    var hider = document.createElement('div')
    hider.setAttribute('id', 'hider')
    document.body.appendChild(hider)

    writeDiv = document.createElement('div')
    writeDiv.setAttribute('id', 'writingMessage')
    title = document.createElement('p')
    title.setAttribute('id', 'writeProgressTitle')
    title.innerHTML = 'Updating ' + osJsonInfo.displayName
    writeAnimationDiv = document.createElement('p')
    writeAnimation = document.createElement('img')
    writeAnimation.setAttribute('id', 'writeAnimation')
    writeAnimation.setAttribute('class', 'updateAnimation')
    writeAnimation.setAttribute('src', __dirname + '/img/updating.gif')
    writeAnimationDiv.appendChild(writeAnimation)
    writeDiv.appendChild(title)
    writeDiv.appendChild(writeAnimationDiv)
    writeProgress = document.createElement('progress')
    writeProgress.setAttribute('id', 'writeProgressbar')
    writeProgress.setAttribute('value', 0)
    writeProgress.setAttribute('max', 1.3)
    writeDiv.appendChild(writeProgress)
    writeDetailedProgress = document.createElement('p')
    writeDetailedProgress.setAttribute('id', 'writeDetailedProgress')
    writeDetailedProgress.innerText = 'Connecting to server...'
    writeDiv.appendChild(writeDetailedProgress)
    document.body.appendChild(writeDiv)

    if (! online) {
      alert('Unable to connect to server.\nTry updating later.')
    }else {
      var saveName = path.normalize(getOsPath() + compressedFilename)
      var raspbianDownload = wget.download(src, saveName, {})
      writeDetailedProgress.innerText = 'Downloading compressed file...'
      raspbianDownload.on('error', function (error) {
        console.error(error)
        displayError('OS Update Failed', 'Download Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
      })
      raspbianDownload.on('end', function (output) {
        writeDetailedProgress.innerText = 'Verifying compressed file...'
        md5File(saveName, function (error, sum) {
          if (error) {
            console.error(error)
            displayError('OS Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
          }else {
            if (sum != raspbian7zHash) {
              displayError('OS Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
            }else {
              writeDetailedProgress.innerText = 'Extracting file...'
              var extractProgress
              extract7z(saveName, path.normalize(getOsPath()), function (error) {
                clearInterval(extractProgress)
                if (error) {
                  console.error(error)
                  displayError('OS Update Failed', 'Extract Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                }
                getExtractedPath(function (filepath) // find where the .7z has been saved
                {
                  if (! filepath) {
                    displayError('OS Update Failed', 'Unable to locate 7z', 'This might cause unexpected behaviour whilst using PiBakery.')
                    return
                  }
                  writeDetailedProgress.innerText = 'Verifying extracted file...'
                  md5File(filepath, function (error, sum) {
                    if (error) {
                      console.error(error)
                      displayError('OS Update Failed', 'Unable to verify download', 'This might cause unexpected behaviour whilst using PiBakery.')
                    }
                    else if (sum != raspbianImgHash) {
                      displayError('OS Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
                    }else {
                      writeDetailedProgress.innerText = 'Removing temporary files...'
                      fs.remove(saveName, function (error) // delete the 7z
                      {
                        if (error) {
                          console.error(error)
                          displayError('OS Update Failed', 'Unable to remove 7z', 'This might cause unexpected behaviour whilst using PiBakery.')
                        }else {
                          fs.remove(path.normalize(getOsPath() + finalFilename), function (error) // delete the old raspbian.img
                          {
                            if (error && (! fixing)) // if we're fixing the .img won't exist, so ignore this error.
                            {
                              console.error(error)
                              displayError('OS Update Failed', 'Removal Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                            }else {
                              fs.rename(filepath, path.normalize(getOsPath() + finalFilename), function (error) // rename new-raspbian.img to raspbian.img
                              {
                                if (error) {
                                  console.error(error)
                                  displayError('OS Update Failed', 'Processing Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                                }else {
                                  fs.readFile(path.normalize(getOsPath() + 'images.json'), 'utf8', function (error, data) {
                                    if (error) {
                                      console.error(error)
                                      return
                                    }
                                    data = JSON.parse(data)
                                    for (var i = 0; i < data.length; i++) {
                                      if (data[i].filename == finalFilename) {
                                        data[i].version = newOsVersion
                                      }
                                    }
                                    data = JSON.stringify(data)
                                    fs.writeFile(path.normalize(getOsPath() + 'images.json'), data, function (error) {
                                      if (error) {
                                        console.error(error)
                                        displayError('OS Update Failed', 'Unable to update info file', 'This might cause unexpected behaviour whilst using PiBakery.')
                                      }else {
                                        title.innerHTML = 'Update Successful'
                                        writeAnimation.setAttribute('src', path.normalize(__dirname + '/img/success.png'))

                                        writeProgress.parentNode.removeChild(writeProgress)
                                        writeDetailedProgress.parentNode.removeChild(writeDetailedProgress)

                                        var closeBtnDiv = document.createElement('p')
                                        closeBtnDiv.setAttribute('id', 'closeBtnDiv')
                                        var closeBtn = document.createElement('button')
                                        closeBtn.setAttribute('id', 'closeBtn')
                                        closeBtn.innerHTML = 'Close'
                                        closeBtn.addEventListener('click', function () {
                                          hider.parentNode.removeChild(hider)
                                          writeDiv.parentNode.removeChild(writeDiv)
                                        })
                                        closeBtnDiv.appendChild(closeBtn)
                                        writeDiv.appendChild(closeBtnDiv)
                                      }
                                    })
                                  })
                                }
                              })
                            }
                          })
                        }
                      })
                    }
                  })
                }, uncompressedFilename)
              })
              extractProgress = setInterval(function () {
                getExtractedPath(function (filepath) {
                  if (filepath) {
                    fs.stat(filepath, function (error, stats) {
                      if (!error) {
                        var percentage = stats.size / extractedSize
                        writeProgress.setAttribute('value', 1 + (percentage * 0.2))
                      }
                    })
                  }
                }, uncompressedFilename)
              }, 1000)
            }
          }
        })
      })
      raspbianDownload.on('progress', function (progress) {
        writeProgress.setAttribute('value', progress)
      })
    }
  })
}

/**
  * @desc called by updateRaspbian x2 and getExtractedPath, find the path of the
	* OS that has been extracted with extract7z()
  * @param function callback - callback (string extractedPath)
	* @param number currentNumber - the current loop getExtractedPath is on
  * @return null
*/
function getExtractedPath (callback, filepath, currentNumber) {
  if (typeof currentNumber === 'undefined') { currentNumber = 0; }
  var paths = [
    path.normalize(getOsPath() + filepath),
    path.normalize(getOsPath() + '../' + filepath)
  ]
  if (currentNumber >= paths.length) {
    callback(false)
    return
  }
  fs.stat(paths[currentNumber], function (error, stats) {
    if (error) {
      console.error(error)
      getExtractedPath(callback, filepath, currentNumber + 1)
    }else {
      callback(paths[currentNumber])
      return
    }
  })
}

scanner.driveAdded = function (drive) {
  if (drive.mountpoints.length === 0) {
    return
  }
  console.log('added', drive)
  setTimeout(function () {
    if (! workspace) {
      var loadedInterval = setInterval(function () {
        if (workspace) {
          clearInterval(loadedInterval)
          importExisting(drive)
        }
      }, 1000)
    }else {
      importExisting(drive)
    }
  }, 1000)
}

scanner.driveRemoved = function (drive) {
  console.log('removed', drive)
  if (currentMode == 'update') {
    var blockFile = piBakeryPath + 'blocks.xml'
    fs.stat(blockFile, function (error, stat) {
      if (error) {
        console.error(error)
        if (!! document.getElementById('onnextboot')) {
          document.getElementById('hat').removeChild(document.getElementById('onnextboot'))
          var newBlock = document.createElement('block')
          newBlock.setAttribute('id', 'onfirstboot')
          newBlock.setAttribute('type', 'onfirstboot')
          document.getElementById('hat').appendChild(newBlock)
        }
        workspace.updateToolbox(document.getElementById('toolbox'))
        Blockly.mainWorkspace.clear()
        currentMode = 'write'
        firstBoot = true
        document.getElementById('flashSD').addEventListener('click', writeToSd)
        document.getElementById('flashSD').removeEventListener('click', updateSd)
        document.getElementById('flashSD').children[1].innerText = 'Write'
        document.getElementById('sdImage').src = 'img/write-to-sd.png'
      }
    })
  }
}

// start the scaner with a 5 second delay between scans
scanner.begin(5000)

/**
  * @desc called when a new drive has been added, used to import blocks from an
	* existing pibakery SD card into the workspace to be edited
  * @param object drives - an object containing the info about the newly added
	* drive
  * @return null
*/
function importExisting (drives) {
  if ((drives.device) && (! drives.system) && (currentMode == 'write') && (Blockly.PiBakery.workspaceToCode(workspace) == '') && (! document.getElementById('hider')) && (drives.description != 'SuperDrive')) {
    getMountPoint(drives.device, drives.mountpoints[0].path, 0, function (darwinMnt, __i) {
      if (process.platform == 'darwin' || process.platform == 'linux') {
        if (!darwinMnt) {
          return
        }
        piBakeryPath = path.normalize(darwinMnt + '/PiBakery/')
      }
      else if (process.platform == 'win32') {
        piBakeryPath = path.normalize(drives.mountpoints[0].path + '\\PiBakery\\')
      }
      var blockFile = piBakeryPath + 'blocks.xml'
      fs.readFile(blockFile, 'utf8', function (error, data) {
        if (error) {
          console.error(error)
        }else {
          var choice = dialog.showMessageBox(
            {
              type: 'question',
              buttons: ['No', 'Yes'],
              defaultId: 0,
              title: 'Update Existing SD Card',
              message: 'It has been detected that you have an SD card connected that has been used with PiBakery before.\nDo you want to load in the existing configuration from this card, so that you can make changes to it?'
            })
          if (choice == 1) {
            Blockly.mainWorkspace.clear()
            var parser = new DOMParser()
            var xmlData = parser.parseFromString(data, 'text/xml')
            var firstboot = xmlData.getElementsByTagName('firstboot')[0]

            firstBoot = (firstboot.innerText == '1')

            if (firstBoot) {
              if (!! document.getElementById('onnextboot')) {
                document.getElementById('hat').removeChild(document.getElementById('onnextboot'))
                var newBlock = document.createElement('block')
                newBlock.setAttribute('id', 'onfirstboot')
                newBlock.setAttribute('type', 'onfirstboot')
                document.getElementById('hat').appendChild(newBlock)
              }
            }else {
              if (!! document.getElementById('onfirstboot')) {
                document.getElementById('hat').removeChild(document.getElementById('onfirstboot'))
                var newBlock = document.createElement('block')
                newBlock.setAttribute('id', 'onnextboot')
                newBlock.setAttribute('type', 'onnextboot')
                document.getElementById('hat').appendChild(newBlock)
              }
            }
            workspace.updateToolbox(document.getElementById('toolbox'))
            Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(data), workspace)
            document.getElementById('flashSD').removeEventListener('click', writeToSd)
            document.getElementById('flashSD').addEventListener('click', updateSd)
            document.getElementById('flashSD').children[1].innerText = 'Update'
            document.getElementById('sdImage').src = 'img/update-sd.png'
            currentMode = 'update'
          }
        }
      })
    })
  }
}

/**
  * @desc called when the "update" button is clicked (top right of PiBakery),
	* updates an existing pibakery installation on an SD card
  * @return null
*/
function updateSd () {
  var blockFile = piBakeryPath + 'blocks.xml'
  fs.stat(path.normalize(blockFile), function (error, stat) {
    if (error) {
      console.error(error)
    }else {
      fs.remove(path.normalize(piBakeryPath + 'blocks/'), function (error) {
        if (error) {
          console.error(error)
          console.error('folder remove failed')
          alert('SD Card Update Failed')
        }else {
          var script = generateScript()
          fs.remove(path.normalize(piBakeryPath + 'everyBoot.sh'), function (error) {
            if (error) {
              console.error(error)
              console.error('cant remove everyBoot')
              alert('SD Card Update Failed')
            }else {
              fs.remove(path.normalize(piBakeryPath + 'firstBoot.sh'), function (error) {
                if (error) {
                  console.error(error)
                  console.error('cant remove firstBoot')
                  alert('SD Card Update Failed')
                }else {
                  fs.remove(path.normalize(piBakeryPath + 'blocks.xml'), function (error) {
                    if (error) {
                      console.error(error)
                      console.error('cant remove xml')
                      alert('SD Card Update Failed')
                    }else {
                      writeNetworkEnabler(piBakeryPath, script[4], function () {
                        writeEnablerFiles(piBakeryPath, function () {
                          fs.writeFile(path.normalize(piBakeryPath + 'everyBoot.sh'), script[0], function (error) {
                            if (error) {
                              console.error(error)
                              console.error('cant write everyBoot')
                              alert('SD Card Update Failed')
                            }else {
                              fs.writeFile(path.normalize(piBakeryPath + 'firstBoot.sh'), script[1], function (error) {
                                if (error) {
                                  console.error(error)
                                  console.error('cant write firstBoot')
                                  alert('SD Card Update Failed')
                                }else {
                                  fs.writeFile(path.normalize(piBakeryPath + 'nextBoot.sh'), script[2], function (error) {
                                    if (error) {
                                      console.error(error)
                                      console.error('cant write nextboot')
                                      alert('SD Card Update Failed')
                                    }else {
                                      var blocksXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))

                                      var xmlElement = (new window.DOMParser()).parseFromString(blocksXml, 'text/xml')
                                      var firstboot = xmlElement.createElement('firstboot')
                                      if (firstBoot) {
                                        firstboot.appendChild(xmlElement.createTextNode('1'))
                                      }else {
                                        firstboot.appendChild(xmlElement.createTextNode('0'))
                                      }
                                      xmlElement.getElementsByTagName('xml')[0].appendChild(firstboot)

                                      blocksXml = new XMLSerializer().serializeToString(xmlElement)

                                      fs.writeFile(path.normalize(piBakeryPath + 'blocks.xml'), blocksXml, function (error) {
                                        if (error) {
                                          console.error(error)
                                        }

                                        copyBlocks(script[3], path.normalize(piBakeryPath + 'blocks/'), function (error) {
                                          if (error) {
                                            console.error('error copying blocks to SD', error)
                                            alert('Error updating SD. Please try again.')
                                            return
                                          }
                                          alert('SD Card Updated')
                                        })
                                      /*for ( var x = 0; x < script[3].length; x++) {
                                        fs.copySync(path.normalize(__dirname + '/../pibakery-blocks/' + script[3][x]), path.normalize(piBakeryPath + 'blocks/' + script[3][x]))
                                      }
                                      alert('SD Card Updated')*/
                                      })
                                    }
                                  })
                                }
                              })
                            }
                          })
                        })
                      })
                    }
                  })
                }
              })
            }
          })
        }
      })
    }
  })
}

/**
  * @desc called by writeScripts and updateSd - copies the block folders to the
  * SD card
	* @param array blockArray - array of block names that need to be copied
  * @param string piBakeryPath - mount path of the SD to copy to
  * @param function callback - (error)
  * @param number currentNumber - current block we're copying
  * @return null
*/
function copyBlocks (blockArray, piBakeryPath, callback, currentNumber) {
  if (typeof currentNumber === 'undefined') {
    currentNumber = 0
  }

  if (typeof blockArray == 'undefined' || blockArray.length == 0) {
    callback(false)
    return
  }

  var blockFolder
  blockFolder = path.normalize(__dirname + '/../pibakery-blocks/' + blockArray[currentNumber])

  for ( var y = 0; y < tempBlocks.length; y++) {
    if (tempBlocks[y][0] == blockArray[currentNumber]) {
      blockFolder = tempBlocks[y][1]
    }
  }

  fs.copy(blockFolder, path.normalize(piBakeryPath + blockArray[currentNumber]), function (error) {
    if (error) {
      callback(error)
      return
    }
    if (currentNumber + 1 == blockArray.length) {
      callback(false)
    } else {
      copyBlocks(blockArray, piBakeryPath, callback, currentNumber + 1)
    }
  })
}

/**
  * @desc called by writeScripts and updateSd, generates the files that are
	* written to the SD card
  * @return array [everyBootCode, firstBootCode, nextBootCode, neededBlocks,
	* waitForNetwork] - the every boot script, the first boot script, the next
	* boot script, the list of blocks needed to be copied, and whether PiBakery
	* should wait for a network connection before running the scripts
*/
function generateScript () {
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

  return [everyBootCode, firstBootCode, nextBootCode, neededBlocks, waitForNetwork]
}

/**
  * @desc called by many functions, used to display an error box
  * @param string titleMsg - the title of the error
	* @param string errorMsg - a more detailed description of the error
	* @param string behaviourMsg - a description of what the user should do next
  * @return null
*/
function displayError (titleMsg, errorMsg, behaviourMsg) {
  var title = document.getElementById('writeProgressTitle')
  var writeAnimation = document.getElementById('writeAnimation')
  var writeProgress = document.getElementById('writeProgressbar')
  var writeDiv = document.getElementById('writingMessage')
  var hiderDiv = document.getElementById('hider')

  if (title.innerHTML != titleMsg) {
    title.innerHTML = titleMsg

    var errorMessage = document.createElement('p')
    errorMessage.setAttribute('class', 'infoParagraph')
    errorMessage.setAttribute('style', 'margin-top: -5px; font-style: italic;')
    errorMessage.innerHTML = 'Error: ' + errorMsg
    writeDiv.appendChild(errorMessage)

    var behaviourMessage = document.createElement('p')
    behaviourMessage.setAttribute('class', 'infoParagraph')
    behaviourMessage.innerHTML = behaviourMsg
    writeDiv.appendChild(behaviourMessage)

    var reinstallMessage = document.createElement('p')
    reinstallMessage.setAttribute('class', 'infoParagraph')
    reinstallMessage.innerHTML = 'If this error persists, please reinstall PiBakery.'
    writeDiv.appendChild(reinstallMessage)

    writeAnimation.parentNode.removeChild(writeAnimation)
    writeProgress.parentNode.removeChild(writeProgress)
    if (!!document.getElementById('writeDetailedProgress')) {
      document.getElementById('writeDetailedProgress').parentNode.removeChild(document.getElementById('writeDetailedProgress'))
    }

    var closeBtnDiv = document.createElement('p')
    closeBtnDiv.setAttribute('id', 'closeBtnDiv')

    var closeBtn = document.createElement('button')
    closeBtn.setAttribute('id', 'closeBtn')
    closeBtn.innerHTML = 'Close'
    closeBtn.addEventListener('click', function () {
      hiderDiv.parentNode.removeChild(hiderDiv)
      writeDiv.parentNode.removeChild(writeDiv)
    })
    closeBtnDiv.appendChild(closeBtn)

    writeDiv.appendChild(closeBtnDiv)
  }
}

/**
  * @desc called when the "Write" button is clicked in the top right, used to
	* start the write process
  * @return null
*/
function writeToSd () {
  writeTryCount = 0
  var imageFile = path.normalize(getOsPath() + 'raspbian-pibakery.img')

  createSdChooser(function (devicePath, name, operatingSystemFilename) {
    if (operatingSystemFilename) {
      var imageFile = path.normalize(getOsPath() + operatingSystemFilename)
    }
    var choice = dialog.showMessageBox(
      {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Write',
        message: 'You have selected to write to "' + name + '".\nWriting will permanently erase any existing contents on "' + name + '"\nDo you wish to continue?'
      })

    if (choice == 0) {
      // Show the "writing" animation
      var writeDiv = document.createElement('div')
      writeDiv.setAttribute('id', 'writingMessage')
      var title = document.createElement('p')
      title.setAttribute('id', 'writeProgressTitle')
      title.innerHTML = 'Writing to SD'
      var writeAnimationDiv = document.createElement('p')
      var writeAnimation = document.createElement('img')
      writeAnimation.setAttribute('id', 'writeAnimation')
      writeAnimation.setAttribute('class', 'updateAnimation')
      writeAnimation.setAttribute('src', __dirname + '/img/writing.gif')
      writeAnimationDiv.appendChild(writeAnimation)
      writeDiv.appendChild(title)
      writeDiv.appendChild(writeAnimationDiv)
      var writeProgress = document.createElement('progress')
      writeProgress.setAttribute('id', 'writeProgressbar')
      writeProgress.setAttribute('value', 0)
      writeProgress.setAttribute('max', 10000)
      writeDiv.appendChild(writeProgress)
      document.body.appendChild(writeDiv)

      // unmount the device
      if (process.platform == 'win32') {
        writeImage(imageFile, devicePath, name[0])
      }else {
        umount.umount(devicePath, function (error, stdout, stderr) {
          if (error) {
            console.error(error)
            displayError('SD Write Failed', "Can't unmount SD", 'Please try writing to the SD card again.')
          }else {
            writeImage(imageFile, devicePath, name)
          }
        })
      }
    }else {
      document.getElementById('hider').parentNode.removeChild(document.getElementById('hider'))
    }
  })
}

/**
  * @desc called by writeImage - only called when running on a mac, used to
	* write the image using resin to the SD
  * @param string imageFile - the path to the file to be written
	* @param string devicePath - the "/dev/diskX" path to the SD being written to
  * @return null
*/
function writeImageMac (imageFile, devicePath) {
  var osStream = fs.createReadStream(imageFile)
  osStream.length = fs.statSync(imageFile).size

  var sdWrite = imageWrite.write(devicePath, osStream, {
    check: false,
    size: fs.statSync(imageFile).size
  })

  sdWrite.on('progress', function (state) {
    document.getElementById('writeProgressbar').setAttribute('max', state.length)
    document.getElementById('writeProgressbar').setAttribute('value', state.transferred)
  })
  sdWrite.on('error', function (error) {
    console.error(error)
    displayError('SD Write Failed', (error.code + ': not able to write image\n' + error.errno), 'Please try writing to the SD card again.')
  })
  sdWrite.on('done', function (success) {
    if (process.platform == 'linux') {
      var deviceName = devicePath.substr(devicePath.indexOf('/', 1) + 1)

      execSync('mkdir -p /tmp/PiBakery/', {stdio: [null, null, null]}).toString()
      execSync('kpartx -a -s ' + devicePath, {stdio: [null, null, null]}).toString()

      // check to see if we can mount it
      var count = 0
      var mountCheck = setInterval(function () {
        count++

        if (count > 60) {
          clearInterval(mountCheck)
          displayError('SD Write Failed', "Can't find SD", 'Please try writing to the SD card again.')
          return
        }

        exec('mount /dev/mapper/' + deviceName + '1 /tmp/PiBakery', function (error, stdout, stderr) {
          if (error && count > 60) {
            console.error("Can't find SD card:", error)
            clearInterval(mountCheck)
            displayError('SD Write Failed', "Can't find SD", 'Please try writing to the SD card again.')
          }else {
            clearInterval(mountCheck)
            writeScripts(path.normalize('/tmp/PiBakery/'), deviceName)
          }
        })
      }, 2000)
      return
    }

    // check to see if it's mounted again
    var count = 0
    var mountCheck = setInterval(function () {
      count++

      getMountPoint(devicePath, '', 0, function (darwinMnt, __) {
        if (! darwinMnt) {
          if (count > 60) {
            clearInterval(mountCheck)
            console.error("Can't find SD card:")
            displayError('SD Write Failed', "Can't find SD", 'Please try writing to the SD card again.')
          }
          return
        }

        clearInterval(mountCheck)
        var mountpoint = path.normalize(darwinMnt + '/')

        fs.stat(mountpoint, function (error, stats) {
          if (error) {
            if (count > 60) {
              console.error("Can't find SD card:", error)
              clearInterval(mountCheck)
              displayError('SD Write Failed', "Can't find SD", 'Please try writing to the SD card again.')
            }
          }else {
            clearInterval(mountCheck)
            writeScripts(mountpoint, '')
          }
        })
      })
    }, 1000)
  })
}

/**
  * @desc called by writeImage - only called when running on windows, uses
	* CommandLineDiskImager (Win32DiskImager modification) to write the image to
	* the SD
  * @param string imageFile - the path to the file to be written
	* @param string devicePath - the device path to the SD being written to
	* @param string letter - the letter the SD is mounted on
  * @return null
*/
function writeImageWin (imageFile, devicePath, letter) {
  var sdWrite = exec('"' + path.normalize(__dirname + '\\..\\CommandLineDiskImager\\CommandLineDiskImager.exe') + '" "' + imageFile + '" ' + letter)
  sdWrite.on('close', function (code) {
    if (code != 0) {
      var errorMsg = [
        '',
        'Internal Error - not enough arguments',
        "Internal Error - can't find .img",
        "Can't find SD card",
        'Invalid handle value for volume',
        "Can't get lock on volume",
        "Can't unmount volume",
        'Internal Error - invalid handle value for file',
        'Invalid handle value for disk',
        'Not enough space on SD card',
        'Internal Error - sector data is null',
        'Error whilst writing',
        'Internal Error - not able to get number of sectors'
      ]
      var errorSuggestions = [
        '',
        'Please try writing again, or reinstalling PiBakery',
        'Please try writing again, or reinstall PiBakery',
        'Make sure that no other program is using the SD card',
        'Make sure that no other program is using the SD card',
        'Make sure that no other program is using the SD card',
        'Make sure that no other program is using the SD card',
        'Please try writing again, or reinstalling PiBakery',
        'Make sure that no other program is using the SD card',
        'Please use a larger SD card',
        'Please try writing again, or reinstalling PiBakery',
        'Please try writing again, or reinstalling PiBakery',
        'Please try writing again, or reinstalling PiBakery'
      ]
      displayError('SD Write Failed', errorMsg[code], errorSuggestions[code])
    }else {
      var count = 0
      var mountCheck = setInterval(function () {
        count++
        var mountpoint = path.normalize(letter + ':\\')

        fs.stat(mountpoint, function (error, stats) {
          if (error) {
            if (count > 60) {
              clearInterval(mountCheck)
              console.error("Can't find SD card:", error)
              displayError('SD Write Failed', "Can't find SD", 'Please try writing to the SD card again.')
            }
          }else {
            clearInterval(mountCheck)
            writeScripts(mountpoint, '')
          }
        })
      }, 1000)
    }
  })
  sdWrite.stdout.on('data', function (output) {
    if ((! output.indexOf('into - writing file') == 0) && (output.indexOf('/') != -1)) {
      document.getElementById('writeProgressbar').setAttribute('max', output.split('/')[1])
      document.getElementById('writeProgressbar').setAttribute('value', output.split('/')[0])
    }
  })
}

/**
  * @desc called by writeImageMac and writeImageWin, writes the PiBakery scripts
	* and files to the mounted SD
  * @param string mountpoint - the current mount point of the newly mounted SD
  * @return null
*/
function writeScripts (mountpoint, linuxDevice) {
  var script = generateScript()

  fs.mkdir(path.normalize(mountpoint + 'PiBakery'), '0744', function (error) {
    if (error) {
      console.error("Can't create PiBakery folder:", error)
      displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
    }else {
      writeNetworkEnabler((path.normalize(mountpoint + 'PiBakery/')), script[4], function () {
        writeEnablerFiles((path.normalize(mountpoint + 'PiBakery/')), function () {
          fs.writeFile(path.normalize(mountpoint + 'PiBakery/everyBoot.sh'), script[0], function (error) {
            if (error) {
              console.error("Can't write everyBoot script:", error)
              displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
            }else {
              fs.writeFile(path.normalize(mountpoint + 'PiBakery/firstBoot.sh'), script[1], function (error) {
                if (error) {
                  console.error("Can't write firstBoot script:", error)
                  displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
                }else {
                  fs.writeFile(path.normalize(mountpoint + 'PiBakery/nextBoot.sh'), script[2], function (error) {
                    if (error) {
                      console.error("Can't write nextBoot script:", error)
                      displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
                    }else {
                      var blocksXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))

                      var xmlElement = (new window.DOMParser()).parseFromString(blocksXml, 'text/xml')
                      var firstboot = xmlElement.createElement('firstboot')
                      firstboot.appendChild(xmlElement.createTextNode('1'))
                      xmlElement.getElementsByTagName('xml')[0].appendChild(firstboot)

                      blocksXml = new XMLSerializer().serializeToString(xmlElement)

                      fs.writeFile(path.normalize(mountpoint + 'PiBakery/blocks.xml'), blocksXml, function (error) {
                        if (error) {
                          console.error("Can't write blocks xml:", error)
                          displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
                        }else {
                          copyBlocks(script[3], path.normalize(mountpoint + 'PiBakery/blocks/'), function (error) {
                            if (error) {
                              console.error("Can't copy blocks to SD", error)
                              displayError('SD Write Failed', "Can't write PiBakery blocks", 'Please try writing to the SD card again.')
                              return
                            }
                            unmountLinuxDrive(linuxDevice)

                            document.getElementById('writeProgressTitle').innerHTML = 'Write Successful'
                            document.getElementById('writeAnimation').setAttribute('src', path.normalize(__dirname + '/img/success.png'))
                            document.getElementById('writeProgressbar').parentNode.removeChild(document.getElementById('writeProgressbar'))

                            var closeBtnDiv = document.createElement('p')
                            closeBtnDiv.setAttribute('id', 'closeBtnDiv')

                            var closeBtn = document.createElement('button')
                            closeBtn.setAttribute('id', 'closeBtn')
                            closeBtn.innerHTML = 'Close'
                            closeBtn.addEventListener('click', function () {
                              document.getElementById('hider').parentNode.removeChild(document.getElementById('hider'))
                              document.getElementById('writingMessage').parentNode.removeChild(document.getElementById('writingMessage'))
                            })
                            closeBtnDiv.appendChild(closeBtn)

                            document.getElementById('writingMessage').appendChild(closeBtnDiv)

                            var hiderClear = function () {
                              document.getElementById('hider').parentNode.removeChild(document.getElementById('hider'))
                              document.getElementById('writingMessage').parentNode.removeChild(document.getElementById('writingMessage'))
                            }
                            document.getElementById('hider').addEventListener('click', hiderClear)
                          })
                        /*for ( var x = 0; x < script[3].length; x++) {
                          fs.copySync(path.normalize(__dirname + '/../pibakery-blocks/' + script[3][x]), path.normalize(mountpoint + 'PiBakery/blocks/' + script[3][x]))
                        }*/
                        }
                      })
                    }
                  })
                }
              })
            }
          })
        })
      })
    }
  })
}

/**
  * @desc called by writeScripts, unmounts and removes the PiBakery loopback
	* devices that are created on linux in order to write the PiBakery scripts
  * @param string deviceName - the name of the device, eg 'sdb' or 'sdc'
  * @return null
*/
function unmountLinuxDrive (deviceName) {
  if (process.platform == 'linux') {
    execSync('umount /tmp/PiBakery/', {stdio: [null, null, null]})
    execSync('kpartx -d /dev/' + deviceName, {stdio: [null, null, null]})
  }
}

/**
  * @desc called by writeScripts, updateSD and itself, writes the PiBakery wait
	* for network enabler files to the mounted SD
  * @param string mountpoint - the current mount point of the newly mounted SD
	* @param string waitForNetwork - the array of whether we should wait for
	* network connection before running each script
	* @param function callback - callback ()
	* @param integer count - the current repetition of the function. Starts off as
	* undefined
  * @return null
*/
function writeNetworkEnabler (mountpoint, waitForNetwork, callback, count) {
  var fileNames = ['EveryBoot', 'FirstBoot', 'NextBoot']
  if (!count) {
    count = 0
  }
  else if (count == 3) {
    callback()
    return
  }

  // remove the file to prevent conflicts when updating sd cards (ignoring errors, as the file might not exist)
  fs.remove(path.normalize(mountpoint + 'waitForNetwork' + fileNames[count]), function (error) {
    if (waitForNetwork[count]) {
      // and if it needs network, write the file
      fs.writeFile(path.normalize(mountpoint + 'waitForNetwork' + fileNames[count]), '', function (error) {
        if (error && error.code == 'ENOENT') {
          console.error("Can't write waitForNetwork enable file:", error)
          displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
          return
        }
        writeNetworkEnabler(mountpoint, waitForNetwork, callback, count + 1)
      })
    }else {
      writeNetworkEnabler(mountpoint, waitForNetwork, callback, count + 1)
    }
  })
}

/**
  * @desc called by writeScripts, updateSD and itself, writes the PiBakery wait
	* for network enabler files to the mounted SD
  * @param string mountpoint - the current mount point of the newly mounted SD
	* @param function callback - callback ()
  * @return null
*/
function writeEnablerFiles (mountpoint, callback) {
  var counter = 0

  if (firstBoot) {
    fs.writeFile(path.normalize(mountpoint + 'runFirstBoot'), '', function (error) {
      if (error && error.code == 'ENOENT') {
        console.error("Can't write firstBoot enable file:", error)
        displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
        return
      }
      callback()
    })
  }else {
    fs.writeFile(path.normalize(mountpoint + 'runNextBoot'), '', function (error) {
      if (error && error.code == 'ENOENT') {
        console.error("Can't write nextBoot enable file:", error)
        displayError('SD Write Failed', "Can't write PiBakery scripts", 'Please try writing to the SD card again.')
        return
      }
      callback()
    })
  }
}

/**
  * @desc called by writeToSD, calls the platform appropriate function
	* @param string imageFile - the path to the file to be written
	* @param string devicePath - the device path to the SD being written to
	* @param string letter - the letter the SD is mounted on
  * @return null
*/
function writeImage (imageFile, devicePath, letter) {
  if (process.platform == 'win32') {
    writeImageWin(imageFile, devicePath, letter)
  }
  else if (process.platform == 'darwin' || process.platform == 'linux') {
    writeImageMac(imageFile, devicePath)
  }
}

/**
  * @desc called by createSdChooser, calls the platform appropriate function
	* @param function callback - callback (object {names, paths})
  * @return null
*/
function getDriveList (callback) {
  if (process.platform == 'win32') {
    getDriveListWin(callback)
  }
  else if (process.platform == 'darwin' || process.platform == 'linux') {
    getDriveListNix(callback)
  }
}

/**
  * @desc called by getDriveList, gets the list of drives suitable for using
	* with PiBakery on a windows machine
	* @param function callback - callback (object {names, paths})
  * @return null
*/
function getDriveListWin (callback) {
  var names = []
  var paths = []
  drivelist.list(function (error, disks) {
    if (error) {
      console.error(error)
      callback({names: [],paths: []})
    }else {
      var length = disks.length

      var drives = shellParser(execSync('C:\\Windows\\System32\\wbem\\wmic logicaldisk get caption,volumename,drivetype', {stdio: [null, null, null]}).toString())

      for ( var x = 0; x < disks.length; x++) {
        for ( var y = 0; y < drives.length; y++) {
          // if (drives[y].Caption == disks[x].mountpoint) {
          if (typeof disks[x].mountpoints[0] != "undefined" && drives[y].Caption == disks[x].mountpoints[0].path) {
            if ((! disks[x].system) && drives[y].DriveType == 2) {
              // names.push(disks[x].mountpoint + ' - ' + drives[y].VolumeName)
              names.push(disks[x].mountpoints[0].path + ' - ' + drives[y].VolumeName)
              paths.push(disks[x].device)
            }
          }
        }
      }
      callback({names: names,paths: paths})
    }
  })
}

/**
  * @desc called by getDriveList, gets the list of drives suitable for using
	* with PiBakery on a Mac or Linux machine
	* @param function callback - callback (object {names, paths})
  * @return null
*/
function getDriveListNix (callback) {
  var names = []
  var paths = []
  drivelist.list(function (error, disks) {
    if (error) {
      console.error(error)
      callback({names: [],paths: []})
    }else {
      for ( var i = 0; i < disks.length; i++) {
        if (process.platform == 'darwin') {
          // skip the DVD drive on Mac
          if (disks[i].description == 'SuperDrive') {
            continue
          }
        }

        if (disks[i].mountpoints.length == 0) {
          continue
        }

        // getMountPoint(disks[i].device, disks[i].mountpoint, i, function (mntPoint, j) {
        getMountPoint(disks[i].device, disks[i].mountpoints[0].path, i, function (mntPoint, j) {
          if ((!disks[j].system) && mntPoint) {
            // only add the device if it isn't already in the list, or if it is in the list but the current loop device name is shorter then overwrite the longer name
            if (paths.indexOf(disks[j].device) == -1) {
              names.push(mntPoint.substr(mntPoint.lastIndexOf('/') + 1))
              paths.push(disks[j].device)
            } else if (paths.indexOf(disks[j].device) != -1 && names[paths.indexOf(disks[j].device)].length > mntPoint.substr(mntPoint.lastIndexOf('/') + 1).length) {
              names[paths.indexOf(disks[j].device)] = mntPoint.substr(mntPoint.lastIndexOf('/') + 1)
            }
          }
          if (j + 1 == disks.length) {
            callback({names: names, paths: paths})
            return
          }
        })
      }
    }
  })
}

/**
  * @desc called by importExisting and writeImageMac, gets the current
	* mountpoint of the device on a mac platform. Gives false if used on windows
	* @param string device - the "/dev/diskX" device path of the SD card device
	* @param function callback - callback (object {names, paths})
  * @return null
*/
function getMountPoint (device, mountpoint, counterPassthrough, callback) {
  if (process.platform == 'win32') {
    callback(false, counterPassthrough)
    return
  } else if (process.platform == 'darwin') {
    df(function (error, drives) {
      if (error) {
        console.error(error)
        return
      }

      for ( var i = 0; i < drives.length; i++) {
        if (drives[i].filesystem.indexOf(device) != -1) {
          callback(drives[i].mount, counterPassthrough)
          return
        }
      }
      callback(false, counterPassthrough)
    })
  } else if (process.platform == 'linux') {
    // if (mountpoint == '' || typeof currentNumber === 'undefined') {
    // use the df method if we haven't been given the mountpoint
    df(function (error, drives) {
      if (error) {
        console.error(error)
        return
      }

      for ( var i = 0; i < drives.length; i++) {
        if (drives[i].filesystem.indexOf(device) != -1) {
          callback(drives[i].mount, counterPassthrough)
          return
        }
      }
      callback(false, counterPassthrough)
    })
  /*} else {
    if (mountpoint.indexOf(',') != -1) {
      mountpoint = mountpoint.split(',')
      for (var i = 0; i < mountpoint.length; i++) {
        callback(mountpoint[i], counterPassthrough)
      }
    } else {
      callback(mountpoint, counterPassthrough)
    }
  }*/
  }
}

/**
  * @desc called by writeToSd, creates the dialog and dropdown that allows the
	* user to choose what SD card to write to
	* @param function callback - callback (string chosenDevicePath, string chosenDeviceName)
  * @return null
*/
function createSdChooser (callback) {
  getOsList(function (operatingSystems) {
    getDriveList(function (devices) {
      var sdNames = devices.names
      var sdPaths = devices.paths

      var hider = document.createElement('div')
      hider.setAttribute('id', 'hider')
      var hiderClear = function () {
        clearInterval(deviceUpdater)
        hider.parentNode.removeChild(hider)
        selectionDiv.parentNode.removeChild(selectionDiv)
      }
      hider.addEventListener('click', hiderClear)

      var selectionDiv = document.createElement('div')
      selectionDiv.setAttribute('id', 'sdSelector')

      var sdSelector = document.createElement('select')
      sdSelector.setAttribute('id', 'sdChoice')
      for ( var x = 0; x < sdNames.length; x++) {
        var sdChoice = document.createElement('option')
        sdChoice.setAttribute('value', sdPaths[x])
        sdChoice.innerHTML = sdNames[x]
        sdSelector.appendChild(sdChoice)
      }

      var osSelector = document.createElement('select')
      osSelector.setAttribute('id', 'osChoice')
      osSelector.addEventListener('change', function () {
        var chosenOperatingSystem = document.getElementById('osChoice').options[document.getElementById('osChoice').selectedIndex].value
        var chosenOperatingSystemName = document.getElementById('osChoice').options[document.getElementById('osChoice').selectedIndex].innerHTML
        var blocksRequired = generateScript()[3]
        var compatible = true
        var message = 'Some of the blocks you are using are not fully compatible with ' + chosenOperatingSystemName + ':\n'
        for (var i = 0; i < blocksRequired.length; i++) {
          if (blockSupportedOs[blocksRequired[i]].indexOf(chosenOperatingSystem) == -1) {
            compatible = false
            message = message + '\n' + blocksRequired[i]
          }
        }
        if (!compatible) {
          alert(message)
        }
      })
      for ( var x = 0; x < operatingSystems.length; x++) {
        var osChoice = document.createElement('option')
        osChoice.setAttribute('value', operatingSystems[x].filename)
        osChoice.innerHTML = operatingSystems[x].displayName
        osSelector.appendChild(osChoice)
      }

      var writeButton = document.createElement('button')
      writeButton.disabled = (devices.names.length == 0)
      writeButton.setAttribute('id', 'writeButton')
      writeButton.innerHTML = 'Start Write'
      writeButton.addEventListener('click', function () {
        var chosenOperatingSystem = document.getElementById('osChoice').options[document.getElementById('osChoice').selectedIndex].value
        var chosenDevicePath = document.getElementById('sdChoice').options[document.getElementById('sdChoice').selectedIndex].value
        var chosenDeviceName = document.getElementById('sdChoice').options[document.getElementById('sdChoice').selectedIndex].innerHTML
        clearInterval(deviceUpdater)
        hider.removeEventListener('click', hiderClear)
        selectionDiv.parentNode.removeChild(selectionDiv)
        callback(chosenDevicePath, chosenDeviceName, chosenOperatingSystem)
      })

      var closeButton = document.createElement('button')
      closeButton.setAttribute('id', 'closeButton')
      closeButton.innerHTML = 'Close'
      closeButton.addEventListener('click', hiderClear)

      // selectionDiv.appendChild(sdSelector)
      // selectionDiv.appendChild(osSelector)

      var selectionTable = document.createElement('table')
      selectionTable.setAttribute('id', 'selectionTable')

      var sdRow = document.createElement('tr')
      selectionTable.appendChild(sdRow)
      var sdTextColumn = document.createElement('td')
      sdRow.appendChild(sdTextColumn)
      var sdText = document.createElement('span')
      sdText.innerText = 'SD Card:'
      sdTextColumn.appendChild(sdText)
      var sdSelectColumn = document.createElement('td')
      sdRow.appendChild(sdSelectColumn)
      sdSelectColumn.appendChild(sdSelector)

      var osRow = document.createElement('tr')
      selectionTable.appendChild(osRow)
      var osTextColumn = document.createElement('td')
      osRow.appendChild(osTextColumn)
      var osText = document.createElement('span')
      osText.innerText = 'Operating System:'
      osText.style.paddingRight = '7px'
      osTextColumn.appendChild(osText)
      var osSelectColumn = document.createElement('td')
      osRow.appendChild(osSelectColumn)
      osSelectColumn.appendChild(osSelector)

      selectionDiv.appendChild(selectionTable)
      selectionDiv.appendChild(closeButton)
      selectionDiv.appendChild(writeButton)
      document.body.appendChild(hider)
      document.body.appendChild(selectionDiv)

      var deviceUpdater = setInterval(function () {
        getDriveList(function (devices) {
          writeButton.disabled = (devices.names.length == 0)

          var sdNames = devices.names
          var sdPaths = devices.paths

          var sdSelector = document.getElementById('sdChoice')
          if (! sdSelector) {
            return
          }

          var currentDevices = []
          var changedList = false
          for (var i = 0; i < sdSelector.children.length; i++) {
            if (sdPaths.indexOf(sdSelector.children[i].value) == -1) {
              sdSelector.removeChild(sdSelector.children[i])
              sdPaths.splice(i, 1)
              sdNames.splice(i, 1)
              changedList = true
            }else {
              currentDevices.push(sdSelector.children[i].value)
            }
          }

          for ( var x = 0; x < sdNames.length; x++) {
            if (currentDevices.indexOf(sdPaths[x]) == -1) {
              var sdChoice = document.createElement('option')
              sdChoice.setAttribute('value', sdPaths[x])
              sdChoice.innerHTML = sdNames[x]
              sdSelector.appendChild(sdChoice)
              sdSelector.value = sdPaths[x]
              changedList = true
            }
          }
          if (changedList) {
            sdSelector.blur()
          }
        })
      }, 1000)
    })
  })
}

function getOsList (cb) {
  fs.readFile(path.normalize(getOsPath() + 'images.json'), 'utf8', function (error, data) {
    if (error) {
      console.error(error)
      return
    }
    var localImagesJson = JSON.parse(data)
    var installedImages = []
    for (var i = 0; i < localImagesJson.length; i++) {
      if (localImagesJson[i].installed) {
        installedImages.push(localImagesJson[i])
      }
    }
    cb(installedImages)
  })
}

/**
  * @desc called by initialise and updateBlocks, reads the block file and
	* iterates through all the blocks, calling importBlock on them
  * @return null
*/
function loadBlocks () {
  fs.readFile(path.normalize(__dirname + '/../pibakery-blocks/info.json'), 'utf8', function (error, blockInfo) {
    // new block loader - updatable categories
    fs.readFile(path.normalize(__dirname + '/../pibakery-blocks/categories.json'), 'utf8', function (error, categoryInfo) {
      // if we can use custom categories
      if (error) {
        console.error(error)
        alert('Not able to load blocks.\nIf this error persists, please reinstall PiBakery.')
      }else {
        var categories = JSON.parse(categoryInfo).categories
        var blocks = JSON.parse(blockInfo).loadOrder

        // delete the default categories
        var currentCategories = document.getElementById('toolbox').children
        for ( var x = currentCategories.length - 1; x != 0; x--) {
          if (currentCategories[x].id != 'hat') {
            currentCategories[x].parentNode.removeChild(currentCategories[x])
          }
        }

        // add the custom categories
        for ( var x = 0; x < categories.length; x++) {
          categoryTypeText.push(categories[x].name)
          categoryTypeColour.push(categories[x].colour)
          var newCategory = document.createElement('category')
          newCategory.setAttribute('name', categories[x].display)
          newCategory.setAttribute('colour', categories[x].colour)
          newCategory.setAttribute('id', categories[x].name)
          document.getElementById('toolbox').appendChild(newCategory)
        }

        // asyncLoadBlocks(blocks, categoryTypeText, categoryTypeColour, 0)
        asyncLoadBlocks(blocks, 0)
      }
    })
  })
}

/**
  * @desc called by loadBlocks, loops and loads the blocks in order, so they are
  * in the correct order in the toolbox
	* @param array blocks - the array of block names to import
  * @param array categoryTypeText - the array of category names
  * @param array categoryTypeColour - the array of category colours
  * @param integer x - the current repetition
  * @return null
*/
// function asyncLoadBlocks(blocks, categoryTypeText, categoryTypeColour, x) {
function asyncLoadBlocks (blocks, x) {
  if (x == blocks.length) {
    return
  }
  var blockName = blocks[x]
  var jsonPath = path.normalize(__dirname + '/../pibakery-blocks/' + blockName + '/' + blockName + '.json')
  fs.readFile(jsonPath, 'utf8', function (error, data) {
    if (error) {
      console.error(error)
      alert("Error loading block '" + blockName + "'.\nIf this error persists, please reinstall PiBakery.")
    }else {
      importBlock(data, categoryTypeText, categoryTypeColour)
      asyncLoadBlocks(blocks, x + 1)
    }
  })
}

/**
  * @desc called by asyncLoadBlocks, parses the JSON of the block and import it
  * into pibakery (toolbox and script system)
	* @param string blockCode - the JSON data of the block being imported
  * @param array typeText - the array of category names
  * @param array typeColour - the array of category colours
  * @return null
*/
function importBlock (blockCode, typeText, typeColour) {
  if (typeof typeText === 'undefined') { typeText = ['hat', 'software', 'network', 'setting', 'other']; }
  if (typeof typeColour === 'undefined') { typeColour = [20, 120, 260, 210, 290]; }
  // var typeText = ['hat', 'software', 'network', 'setting', 'other']
  // var typeColour = [20, 120, 260, 210, 290]

  var blockDef
  var scriptDef

  // var blockJSON = JSON.parse(JSONescape(blockCode))
  var blockJSON = JSON.parse(blockCode)

  if (typeText.indexOf(blockJSON.category) != -1) {
    blockJSON.type = blockJSON.category
  }

  var blockName = blockJSON.name
  var blockText = blockJSON.text
  var blockColour = typeColour[typeText.indexOf(blockJSON.type)]
  var blockArgs = blockJSON.args
  var numArgs = blockArgs.length
  var supportedOperatingSystems = blockJSON.supportedOperatingSystems

  blockSupportedOs[blockName] = supportedOperatingSystems

  var blocklyBlock = {}
  blocklyBlock.id = blockName
  blocklyBlock.colour = blockColour
  blocklyBlock.helpUrl = blockJSON.longDescription
  blocklyBlock.tooltip = blockJSON.shortDescription

  // blocklyBlock.message0 = blockText.replace(/\\n/g, ("%" + (numArgs+1)))
  var currentCount = 0
  while(blockText.indexOf('\\n') != -1){
    blockText = blockText.replace('\\n', ('%' + (numArgs + 1 + currentCount)))
    currentCount++
  }
  blocklyBlock.message0 = blockText

  blocklyBlock.args0 = []
  for ( var x = 0; x < blockJSON.args.length; x++) {
    var newArg = {}
    var currentArg = blockJSON.args[x]
    if (currentArg.type == 'number' || currentArg.type == 'text') {
      newArg.type = 'field_input'
      newArg.name = x + 1
      newArg.text = currentArg.default
      validation.push({
        block: blockName,
        field: x + 1,
        max: currentArg.maxLength,
        type: currentArg.type
      })
    }
    else if (currentArg.type == 'menu') {
      newArg.type = 'field_dropdown'
      newArg.name = x + 1
      newArg.options = []
      for ( var y = 0; y < currentArg.options.length; y++) {
        var currentOption = currentArg.options[y]
        var newOption = [currentOption, currentOption]
        newArg.options.push(newOption)
      }
    }
    else if (currentArg.type == 'check') {
      newArg.type = 'field_checkbox'
      newArg.name = x + 1
      newArg.checked = currentArg.default
    }
    blocklyBlock.args0.push(newArg)
  }
  for ( var x = 0; x < currentCount; x++) {
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

  // That's us finished with blocklyBlock - it's now ready! Now go and creat the code generator...
  Blockly.PiBakery[blockName] = function (block) {
    var args = []
    var code = '\n\tchmod 755 /boot/PiBakery/blocks/' + blockName + '/' + blockJSON.script
    code = code + '\n\t/boot/PiBakery/blocks/' + blockName + '/' + blockJSON.script + ' '
    for ( var x = 0; x < blockJSON.args.length; x++) {
      var currentArg = bashEscape(block.getFieldValue(x + 1))
      if (currentArg == '') {
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
  // And then update the toolbox to include the new block. Technically this shouldn't be run multiple times, but it's just easier to do that.
  workspace.updateToolbox(document.getElementById('toolbox'))
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
  for ( var i = 0; i < block.inputList.length; i++) {
    for ( var j = 0; j < block.inputList[i].fieldRow.length; j++) {
      if (block.inputList[i].fieldRow[j].text_ == value) {
        for ( var k = 0; k < validation.length; k++) {
          if (validation[k].block == block.type && validation[k].field == block.inputList[i].fieldRow[j].name) {
            if (validation[k].type == 'number') {
              value = value.replace(/[^0-9]/g, '')
            }
            if (validation[k].max != 0) {
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
  * @desc called when the import button in the top right is clicked, used to
  * generate the xml file of the workspace so the user can save their script
  * @return null
*/
function importRecipe (openPath) {
  if (typeof openPath != 'string') {
    openPath = dialog.showOpenDialog({
      title: 'Choose recipe file:',
      filters: [{ name: 'XML Files', extensions: ['xml'] }]
    })
  }

  if (openPath) {
    if (typeof openPath != 'string') {
      openPath = path.normalize(openPath[0])
    }

    Blockly.mainWorkspace.clear()
    fs.readFile(openPath, 'utf8', function (error, data) {
      if (error) {
        console.error(error)
        alert('There was an error opening the recipe.\nPlease try again.')
        return false
      }

      var parser = new DOMParser()
      var blockXml = parser.parseFromString(data, 'text/xml')
      var blocks = blockXml.getElementsByTagName('block')

      if (firstBoot) {
        for ( var i = 0; i < blocks.length; i++) {
          if (blocks[i].getAttribute('type') == 'onnextboot') {
            blocks[i].setAttribute('type', 'onfirstboot')
          }
        }
      }else {
        for ( var i = 0; i < blocks.length; i++) {
          if (blocks[i].getAttribute('type') == 'onfirstboot') {
            blocks[i].setAttribute('type', 'onnextboot')
          }
        }
      }

      data = new XMLSerializer().serializeToString(blockXml)

      workspace.updateToolbox(document.getElementById('toolbox'))
      Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(data), workspace)
    })
  }
}

/**
  * @desc called when the export button in the top right is clicked, used to
  * import an existing xml file so the user can load saved scripts
  * @return null
*/
function exportRecipe () {
  if (Blockly.PiBakery.workspaceToCode(workspace) == '') {
    alert('There are no blocks to export.')
    return
  }

  var blocksXml = Blockly.Xml.domToPrettyText(Blockly.Xml.workspaceToDom(workspace))

  var savePath = path.normalize(dialog.showSaveDialog(
    {
      title: 'Save recipe to file:',
      filters: [{ name: 'XML Files', extensions: ['xml'] }],
      defaultPath: 'recipe.xml'
    }))

  if (savePath) {
    fs.writeFile(savePath, blocksXml, function (error) {
      if (error) {
        console.error(error)
        alert('There was an error saving your recipe.\nPlease try again.')
        return
      }
      chmod(savePath, { read: true, write: true })
    })
  }
}

/**
  * @desc called when blockly generates the script (importBlock), used to escape
  * quotes in the bash script that is generated
	* @param string arg - the argument that needs bash escaping
  * @return string - the bash escaped argument
*/
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

// Used to support drag-and-drop files onto PiBakery. XML files will be opened
// as PiBakery recipes, and folders will be imported as temporary blocks
document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}
document.ondragleave = document.ondrop = (ev) => {
  ev.preventDefault()
}
document.body.ondrop = (ev) => {
  ev.preventDefault()
  var filepath = ev.dataTransfer.files[0].path
  if (filepath.endsWith('.xml')) {
    // import the xml file
    importRecipe(filepath)
  }else {
    importTestBlock(filepath)
  }
}

function importTestBlock (filepath) {
  fs.stat(filepath, function (error, stats) {
    if (error) {
      alert("Block import error, can't find folder: " + error)
      console.error(error)
      return
    }
    if (stats.isDirectory()) {
      if (process.platform == 'win32') {
        var folderName = filepath.split('\\').slice(-1)[0]
        var jsonFile = path.normalize(filepath + '\\' + folderName + '.json')
      }else {
        var folderName = filepath.split('/').slice(-1)[0]
        var jsonFile = path.normalize(filepath + '/' + folderName + '.json')
      }
      fs.stat(jsonFile, function (error, stats) {
        if (error) {
          alert("Block import error, can't find JSON file: " + error)
          console.error(error)
        }else {
          if (process.platform == 'win32') {
            var blocksFolder = '\\..\\pibakery-blocks\\'
          }else {
            var blocksFolder = '/../pibakery-blocks/'
          }
          fs.stat(path.normalize(__dirname + blocksFolder + folderName), function (error, stats) {
            if (error) {
              console.error(error)
            }else {
              var choice = dialog.showMessageBox(
                {
                  type: 'question',
                  buttons: ['Yes', 'No'],
                  title: 'Block Conflict',
                  message: 'The block you are trying to import conflicts with a block already imported into PiBakery. Do you want to overwrite the existing block?'
                })
              if (choice == 1) {
                return
              } else {
                fs.removeSync(path.normalize(__dirname + blocksFolder + folderName))
              }
            }
            tempBlocks.push([folderName, filepath])
            fs.readFile(jsonFile, 'utf8', function (error, data) {
              if (error) {
                alert("Block import error, can't read JSON file: " + error)
                console.error(error)
              }else {
                importBlock(data)
                workspace.updateToolbox(document.getElementById('toolbox'))
                alert("Imported Block. '" + folderName + "' will be available to use until you next restart PiBakery.")
              }
            })
          })
        }
      })
    }
  })
}
