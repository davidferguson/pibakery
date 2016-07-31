/*
    PiBakery - The easiest way to setup a Raspberry Pi
    Copyright (C) 2016  David Ferguson

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
var drivelistScanner = require('drivelist-scanner')
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

/**
  * @desc checks that the os and blocks exist, and sets up PiBakery
  * @return null
*/
function initialise () {
  fs.stat(path.normalize(__dirname + '/../os/raspbian-pibakery.img'), function (error, stats) {
    if (error) {
      console.error(error)
      fs.stat(path.normalize(__dirname + '/../os/info.json'), function (error, stats) {
        if (error) {
          console.error(error)
          fs.writeFile(path.normalize(__dirname + '/../os/info.json'), '', function (error) {
            if (error) {
              console.error(error)
              // Well, I have no idea what to do now. Reinstall?
              alert('Internal PiBakery Error - please reinstall')
              return
            }
            fixRaspbian(1)
            return
          })
        }else {
          fixRaspbian(1)
          return
        }
      })
    }
    fs.stat(path.normalize(__dirname + '/../os/info.json'), function (error, stats) {
      if (error) {
        console.error(error)
        fixRaspbian(2)
        return
      }
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
      })
    })
  })
}

initialise()

/**
  * @desc redownloads the OS if it hasn't been found by initialise()
  * @param string errorType - whether to redownload a specific version of the OS
  * @return null
*/
function fixRaspbian (errorType) {
  isOnline(function (error, online) {
    if (error) {
      console.error(error)
    }
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
    writeAnimationDiv.innerText = 'PiBakery has encounted an error on starting up, as it is unable to find the Raspbian operating system.'
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
        if (errorType == 1) {
          request.get('https://raw.githubusercontent.com/davidferguson/pibakery-raspbian/master/info.json', function (error, response, body) {
            if (error) {
              console.error(error)
              return
            }
            if (response.statusCode == 200) {
              var compressedHash = JSON.parse(body).compressedMD5
              var uncompressedHash = JSON.parse(body).uncompressedMD5
              var uncompressedSize = JSON.parse(body).uncompressedSize
              var downloadUrl = JSON.parse(body).downloadUrl

              hider.parentNode.removeChild(hider)
              writeDiv.parentNode.removeChild(writeDiv)
              updateRaspbian(downloadUrl, compressedHash, uncompressedHash, uncompressedSize, body, 1)
            }
          })
        }
        else if (errorType == 2) {
          title.innerHTML = 'Attempting Auto-Fix'
          writeAnimationDiv.setAttribute('class', '')
          writeAnimationDiv.innerText = ''
          writeAnimationDiv2.parentNode.removeChild(writeAnimationDiv2)
          writeButton.parentNode.removeChild(writeButton)
          closeButton.parentNode.removeChild(closeButton)

          var writeAnimation = document.createElement('img')
          writeAnimation.setAttribute('id', 'writeAnimation')
          writeAnimation.setAttribute('class', 'updateAnimation')
          writeAnimation.setAttribute('src', path.normalize(__dirname + '/img/updating.gif'))
          writeAnimationDiv.appendChild(writeAnimation)

          request.get('https://raw.githubusercontent.com/davidferguson/pibakery-raspbian/master/versions.json', function (error, response, body) {
            if (error) {
              console.error(error)
              alert('Unable to connect to server. Please try again later, or reinstall PiBakery.')
              return
            }
            if( (response.statusCode == 200) ) {
              var raspbianVersions = JSON.parse(body)
              md5File(path.normalize(__dirname + '/../os/raspbian-pibakery.img'), function (error, sum) {
                if (error) {
                  console.error(error)
                  alert('Unable to verify Raspbian. Please try again later, or reinstall PiBakery.')
                  return
                }
                for ( var i = 0; i < raspbianVersions.length; i++) {
                  if (raspbianVersions[i].hash == sum) {
                    fs.writeJson(path.normalize(__dirname + '/../os/info.json'), {version: raspbianVersions[i].version, uncompressedMD5: raspbianVersions[i].hash, raspbianDate: raspbianVersions[i].original}, function (error) {
                      if (error) {
                        console.error(error)
                        displayError('Auto-Fix Failed', 'Unable to update info file', 'Please reinstall PiBakery to fix this issue.')
                      }else {
                        title.innerHTML = 'Auto-Fix Successful'
                        writeAnimation.setAttribute('src', path.normalize(__dirname + '/img/success.png'))

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
                      }
                    })
                    return
                  }
                }
              })
            }
          })
        }
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
  * @desc redownloads the blocks if they hasn't been found by initialise()
  * @return null
*/
function fixBlocks () {
  isOnline(function (error, online) {
    if (error) {
      console.error(error)
    }
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
  fs.readFile(path.normalize(__dirname + '/../os/info.json'), 'utf8', function (error, data) {
    if (error) {
      console.error(error)
      return
    }
    var myOsVersion = JSON.parse(data).version
    request.get('https://raw.githubusercontent.com/davidferguson/pibakery-raspbian/master/info.json', function (error, response, body) {
      if (error) {
        console.error(error)
        return
      }
      if (response.statusCode == 200) {
        var newOsVersion = JSON.parse(body).version
        var compressedHash = JSON.parse(body).compressedMD5
        var uncompressedHash = JSON.parse(body).uncompressedMD5
        var uncompressedSize = JSON.parse(body).uncompressedSize
        var downloadUrl = JSON.parse(body).downloadUrl

        if (newOsVersion > myOsVersion) {
          var choice = dialog.showMessageBox(
            {
              type: 'question',
              buttons: ['Yes', 'No'],
              title: 'PiBakery Update',
              message: 'There is an update for Raspbian, the Raspberry Pi operating system. Although updating is not required, it is recommended.\nDo you want to update now?\nThis is a large file and could take several hours to download.'
            })
          if (choice == 0) {
            updateRaspbian(downloadUrl, compressedHash, uncompressedHash, uncompressedSize, body, 0)
          }
        }else {
          cb()
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
	* the info.json file that identifies the blocks
	* @param bool fixing - whether we are updating of fixing. 1 when fixing, and 0
	* when updating
  * @return null
*/
function updateBlocks (src, downloadHash, newBlocksInfo, fixing) {
  var writeDiv, title, writeAnimationDiv, writeAnimation, writeProgress

  isOnline(function (error, online) {
    if (error) {
      console.error(error)
      return
    }

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
                                    var blockTypes = ['software', 'network', 'setting', 'other']
                                    for ( var i = 0; i < blockTypes.length; i++) {
                                      var myNode = document.getElementById(blockTypes[i])
                                      while (myNode.firstChild){
                                        myNode.removeChild(myNode.firstChild)
                                      }
                                    }

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
  exec(binary + ' x -o"' + outputdir + '" "' + archive + '"', function (error, stdout, stderr) {
    callback(error)
  })
}

/**
  * @desc called by fixRaspbian and checkForRaspbianUpdates, used to download
	* the OS off GitHub
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
	* write the info.json os file
	* @param bool fixing - whether we are updating of fixing. 1 when fixing, and 0
	* when updating
  * @return null
*/
function updateRaspbian (src, raspbian7zHash, raspbianImgHash, extractedSize, newOsInfo, fixing) {
  var writeDiv, title, writeAnimationDiv, writeAnimation, writeProgress

  isOnline(function (error, online) {
    if (error) {
      console.error(error)
      return
    }

    var hider = document.createElement('div')
    hider.setAttribute('id', 'hider')
    document.body.appendChild(hider)

    writeDiv = document.createElement('div')
    writeDiv.setAttribute('id', 'writingMessage')
    title = document.createElement('p')
    title.setAttribute('id', 'writeProgressTitle')
    if (fixing) {
      title.innerHTML = 'Attempting Auto-Fix'
    }else {
      title.innerHTML = 'Updating Raspbian'
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
    writeProgress.setAttribute('max', 1.21)
    writeDiv.appendChild(writeProgress)
    document.body.appendChild(writeDiv)

    if (! online) {
      if (fixing) {
        alert('Unable to connect to server.\nTry again later, or reinstall PiBakery.')
      }else {
        alert('Unable to connect to server.\nTry updating later.')
      }
    }else {
      var saveName = path.normalize(__dirname + '/../os/raspbian-pibakery.7z')
      var raspbianDownload = wget.download(src, saveName, {})
      raspbianDownload.on('error', function (error) {
        console.error(error)
        if (fixing) {
          displayError('Auto-Fix Failed', 'Download Failed', 'Please try again, or reinstall PiBakery.')
        }else {
          displayError('Raspbian Update Failed', 'Download Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
        }
      })
      raspbianDownload.on('end', function (output) {
        md5File(saveName, function (error, sum) {
          if (error) {
            console.error(error)
            if (fixing) {
              displayError('Auto-Fix Failed', 'Download Corrupted', 'Please try again, or reinstall PiBakery.')
            }else {
              displayError('Raspbian Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
            }
          }else {
            if (sum != raspbian7zHash) {
              if (fixing) {
                displayError('Auto-Fix Failed', 'Download Corrupted', 'Please try again, or reinstall PiBakery.')
              }else {
                displayError('Raspbian Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
              }
            }else {
              var extractProgress
              extract7z(saveName, path.normalize(__dirname + '/../os/'), function (error) {
                clearInterval(extractProgress)
                if (error) {
                  console.error(error)
                  if (fixing) {
                    displayError('Auto-Fix Failed', 'Extract Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                  }else {
                    displayError('Raspbian Update Failed', 'Extract Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                  }
                }
                getExtractedPath(function (filepath) // find where the .7z has been saved
                {
                  if (! filepath) {
                    if (fixing) {
                      displayError('Auto-Fix Failed', 'Unable to locate 7z', 'Please try again, or reinstall PiBakery.')
                      return
                    }else {
                      displayError('Raspbian Update Failed', 'Unable to locate 7z', 'This might cause unexpected behaviour whilst using PiBakery.')
                      return
                    }
                  }
                  md5File(filepath, function (error, sum) {
                    if (error) {
                      console.error(error)
                      if (fixing) {
                        displayError('Auto-Fix Failed', 'Unable to verify download', 'Please try again, or reinstall PiBakery.')
                      }else {
                        displayError('Raspbian Update Failed', 'Unable to verify download', 'This might cause unexpected behaviour whilst using PiBakery.')
                      }
                    }
                    else if (sum != raspbianImgHash) {
                      if (fixing) {
                        displayError('Auto-Fix Failed', 'Download Failed', 'Please try again, or reinstall PiBakery.')
                      }else {
                        displayError('Raspbian Update Failed', 'Download Corrupted', 'This might cause unexpected behaviour whilst using PiBakery.')
                      }
                    }else {
                      fs.remove(saveName, function (error) // delete the 7z
                      {
                        if (error) {
                          console.error(error)
                          if (fixing) {
                            displayError('Auto-Fix Failed', 'Unable to remove 7z', 'Please try again, or reinstall PiBakery.')
                          }else {
                            displayError('Raspbian Update Failed', 'Unable to remove 7z', 'This might cause unexpected behaviour whilst using PiBakery.')
                          }
                        }else {
                          fs.remove(path.normalize(__dirname + '/../os/raspbian-pibakery.img'), function (error) // delete the old raspbian.img
                          {
                            if (error && (! fixing)) // if we're fixing the .img won't exist, so ignore this error.
                            {
                              console.error(error)
                              displayError('Raspbian Update Failed', 'Removal Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                            }else {
                              fs.rename(filepath, path.normalize(__dirname + '/../os/raspbian-pibakery.img'), function (error) // rename new-raspbian.img to raspbian.img
                              {
                                if (error) {
                                  console.error(error)
                                  if (fixing) {
                                    displayError('Auto-Fix Failed', 'Processing Failed', 'Please try again, or reinstall PiBakery.')
                                  }else {
                                    displayError('Raspbian Update Failed', 'Processing Failed', 'This might cause unexpected behaviour whilst using PiBakery.')
                                  }
                                }else {
                                  fs.writeFile(path.normalize(__dirname + '/../os/info.json'), newOsInfo, function (error) {
                                    if (error) {
                                      console.error(error)
                                      if (fixing) {
                                        displayError('Auto-Fix Failed', 'Unable to update info file', 'Please try again, or reinstall PiBakery.')
                                      }else {
                                        displayError('Raspbian Update Failed', 'Unable to update info file', 'This might cause unexpected behaviour whilst using PiBakery.')
                                      }
                                    }else {
                                      if (fixing) {
                                        title.innerHTML = 'Auto-Fix Successful'
                                        writeAnimation.setAttribute('src', path.normalize(__dirname + '/img/success.png'))

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
                                        title.innerHTML = 'Update Successful'
                                        writeAnimation.setAttribute('src', path.normalize(__dirname + '/img/success.png'))

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
                            }
                          })
                        }
                      })
                    }
                  })
                })
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
                })
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
function getExtractedPath (callback, currentNumber) {
  if (typeof currentNumber === 'undefined') { currentNumber = 0; }
  var paths = [
    path.normalize(__dirname + '/../os/raspbian-pibakery-new.img'),
    path.normalize(__dirname + '/../raspbian-pibakery-new.img')
  ]
  if (currentNumber >= paths.length) {
    callback(false)
    return
  }
  fs.stat(paths[currentNumber], function (error, stats) {
    if (error) {
      console.error(error)
      getExtractedPath(callback, currentNumber + 1)
    }else {
      callback(paths[currentNumber])
      return
    }
  })
}

var scanner = new drivelistScanner({interval: 1000})
scanner.on('add', function (drives) {
  setTimeout(function () {
    if (! workspace) {
      var loadedInterval = setInterval(function () {
        if (workspace) {
          clearInterval(loadedInterval)
          importExisting(drives)
        }
      }, 1000)
    }else {
      importExisting(drives)
    }
  }, 1000)
})
scanner.on('remove', function (drives) {
  if ((! drives.system) && (currentMode == 'update')) {
    if (currentMode = 'update') {
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
})

/**
  * @desc called when a new drive has been added, used to import blocks from an
	* existing pibakery SD card into the workspace to be edited
  * @param object drives - an object containing the info about the newly added
	* drive
  * @return null
*/
function importExisting (drives) {
  if ((drives.device) && (! drives.system) && (currentMode == 'write') && (Blockly.PiBakery.workspaceToCode(workspace) == '') && (! document.getElementById('hider')) && (drives.description != 'SuperDrive')) {
    getMountPoint(drives.device, function (darwinMnt) {
      if (process.platform == 'darwin') {
        piBakeryPath = path.normalize(darwinMnt + '/PiBakery/')
      }
      else if (process.platform == 'win32') {
        piBakeryPath = path.normalize(drives.mountpoint + '\\PiBakery\\')
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
            var firstboot = xmlData.getElementsByTagName('firstboot')

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
                                        for ( var x = 0; x < script[3].length; x++) {
                                          fs.copySync(path.normalize(__dirname + '/../pibakery-blocks/' + script[3][x]), path.normalize(piBakeryPath + 'blocks/' + script[3][x]))
                                        }
                                        alert('SD Card Updated')
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
          everyBootCode = everyBootCode + '\n' + currentLine.replace('\t', '') + ' >/dev/null 2>&1  || true'
          // everyBootCode = everyBootCode + "\necho $(expr $PERCENTAGE \\* " + everyBootCount + " )"
          everyBootCode = everyBootCode + '\necho XXX\necho $(expr $PERCENTAGE \\* ' + everyBootCount + ' )\necho "\\nProcessing Every Boot Script\\n\\nRunning Block: ' + currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0] + '"\necho XXX'
        }
        else if (codeType == 'firstBoot') {
          firstBootCount++
          firstBootCode = firstBootCode + '\n' + currentLine.replace('\t', '') + ' >/dev/null 2>&1 || true'
          // firstBootCode = firstBootCode + "\necho $(expr $PERCENTAGE \\* " + firstBootCount + " )"
          firstBootCode = firstBootCode + '\necho XXX\necho $(expr $PERCENTAGE \\* ' + firstBootCount + ' )\necho "\\nProcessing First Boot Script\\n\\nRunning Block: ' + currentLine.split('/boot/PiBakery/blocks/')[1].split('/')[0] + '"\necho XXX'
        }
        else if (codeType == 'nextBoot') {
          nextBootCount++
          nextBootCode = nextBootCode + '\n' + currentLine.replace('\t', '') + ' >/dev/null 2>&1 || true'
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
  var imageFile = path.normalize(__dirname + '/../os/raspbian-pibakery.img')

  createSdChooser(function (devicePath, name) {
    var choice = dialog.showMessageBox(
      {
        type: 'question',
        buttons: ['Yes', 'No'],
        title: 'Confirm Write',
        message: 'You have selected to write to "' + name + '".\nWriting will permanently erase any exisitng contents on "' + name + '"\nDo you wish to continue?'
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

  var sdWrite = imageWrite.write(devicePath, osStream, {check: false})
  sdWrite.on('progress', function (state) {
    document.getElementById('writeProgressbar').setAttribute('max', state.length)
    document.getElementById('writeProgressbar').setAttribute('value', state.transferred)
  })
  sdWrite.on('error', function (error) {
    console.error(error)
    displayError('SD Write Failed', (error.code + ': not able to write image\n' + error.errno), 'Please try writing to the SD card again.')
  })
  sdWrite.on('done', function (success) {
    // check to see if it's mounted again
    var count = 0
    var mountCheck = setInterval(function () {
      count++

      getMountPoint(devicePath, function (darwinMnt) {
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
            writeScripts(mountpoint)
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
            writeScripts(mountpoint)
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
function writeScripts (mountpoint) {
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
                          for ( var x = 0; x < script[3].length; x++) {
                            fs.copySync(path.normalize(__dirname + '/../pibakery-blocks/' + script[3][x]), path.normalize(mountpoint + 'PiBakery/blocks/' + script[3][x]))
                          }
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
  else if (process.platform == 'darwin') {
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
  else if (process.platform == 'darwin') {
    getDriveListMac(callback)
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

      var drives = shellParser(execSync('wmic logicaldisk get caption,volumename,drivetype', {stdio: [null, null, null]}).toString())

      for ( var x = 0; x < disks.length; x++) {
        for ( var y = 0; y < drives.length; y++) {
          if (drives[y].Caption == disks[x].mountpoint) {
            if ((! disks[x].system) && drives[y].DriveType == 2) {
              names.push(disks[x].mountpoint + ' - ' + drives[y].VolumeName)
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
	* with PiBakery on a apple machine
	* @param function callback - callback (object {names, paths})
  * @return null
*/
function getDriveListMac (callback) {
  var names = []
  var paths = []
  drivelist.list(function (error, disks) {
    if (error) {
      console.error(error)
      callback({names: [],paths: []})
    }else {
      var length = disks.length

      df(function (error, drives) {
        if (error) {
          console.error(error)
          callback({names: [],paths: []})
          return
        }

        for ( var x = 0; x < disks.length; x++) {
          if (disks[x].description == 'SuperDrive') {
            continue
          }

          for ( var y = 0; y < drives.length; y++) {
            if ((! disks[x].system) && drives[y].filesystem.indexOf(disks[x].device) != -1) {
              names.push(drives[y].mount.substr(9))
              paths.push(disks[x].device)
            }
          }
        }
        callback({names: names,paths: paths})
      })
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
function getMountPoint (device, callback) {
  if (process.platform == 'win32') {
    callback(false)
    return
  }
  else if (process.platform == 'darwin') {
    df(function (error, drives) {
      if (error) {
        console.error(error)
        callback({names: [],paths: []})
        return
      }

      for ( var i = 0; i < drives.length; i++) {
        if (drives[i].filesystem.indexOf(device) != -1) {
          callback(drives[i].mount)
          return
        }
      }
      callback(false)
    })
  }
}

/**
  * @desc called by writeToSd, creates the dialog and dropdown that allows the
	* user to choose what SD card to write to
	* @param function callback - callback (string chosenDevicePath, string chosenDeviceName)
  * @return null
*/
function createSdChooser (callback) {
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

    var writeButton = document.createElement('button')
    writeButton.disabled = (devices.names.length == 0)
    writeButton.setAttribute('id', 'writeButton')
    writeButton.innerHTML = 'Start Write'
    writeButton.addEventListener('click', function () {
      var chosenDevicePath = document.getElementById('sdChoice').options[document.getElementById('sdChoice').selectedIndex].value
      var chosenDeviceName = document.getElementById('sdChoice').options[document.getElementById('sdChoice').selectedIndex].innerHTML
      clearInterval(deviceUpdater)
      hider.removeEventListener('click', hiderClear)
      selectionDiv.parentNode.removeChild(selectionDiv)
      callback(chosenDevicePath, chosenDeviceName)
    })

    var closeButton = document.createElement('button')
    closeButton.setAttribute('id', 'closeButton')
    closeButton.innerHTML = 'Close'
    closeButton.addEventListener('click', hiderClear)

    var lineBreak = document.createElement('br')

    selectionDiv.appendChild(sdSelector)
    selectionDiv.appendChild(lineBreak)
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
}

/**
  * @desc called by initialise and updateBlocks, reads the block file and
	* iterates through all the blocks, calling importBlock on them
  * @return null
*/
function loadBlocks () {
  fs.readFile(path.normalize(__dirname + '/../pibakery-blocks/info.json'), 'utf8', function (error, blockInfo) {
    if (error) {
      console.error(error)
      alert('Not able to load blocks.\nIf this error persists, please reinstall PiBakery.')
    }else {
      var blocks = JSON.parse(blockInfo).loadOrder
      for ( var x = 0; x < blocks.length; x++) {
        var blockName = blocks[x]
        var jsonPath = path.normalize(__dirname + '/../pibakery-blocks/' + blockName + '/' + blockName + '.json')
        fs.readFile(jsonPath, 'utf8', function (error, data) {
          if (error) {
            console.error(error)
            alert("Error loading block '" + blockName + "'.\nIf this error persists, please reinstall PiBakery.")
          }else {
            importBlock(data)
          }
        })
      }
    }
  })
}

/**
  * @desc called by loadBlocks, parses the JSON of the block and import it into
	* pibakery (toolbox and script system)
	* @param string blockCode - the JSON data of the block being imported
  * @return null
*/
function importBlock (blockCode) {
  var typeText = ['hat', 'software', 'network', 'setting', 'other']
  var typeColour = [20, 120, 260, 210, 290]

  var blockDef
  var scriptDef

  // var blockJSON = JSON.parse(JSONescape(blockCode))
  var blockJSON = JSON.parse(blockCode)

  var blockName = blockJSON.name
  var blockText = blockJSON.text
  var blockColour = typeColour[typeText.indexOf(blockJSON.type)]
  var blockArgs = blockJSON.args
  var numArgs = blockArgs.length

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
				field: x+1,
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
  for( var i = 0; i < block.inputList.length; i++ ) {
    for( var j = 0; j < block.inputList[i].fieldRow.length; j++ ) {
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
function importRecipe () {
  var openPath = path.normalize(dialog.showOpenDialog(
    {
      title: 'Choose recipe file:',
      filters: [{ name: 'XML Files', extensions: ['xml'] }]
    }))

  if (openPath) {
    openPath = openPath[0]

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
      document.getElementById('flashSD').removeEventListener('click', writeToSd)
      document.getElementById('flashSD').addEventListener('click', updateSd)
      document.getElementById('flashSD').children[1].innerText = 'Update'
      document.getElementById('sdImage').src = 'img/update-sd.png'
      currentMode = 'update'
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

  var blocksXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace))

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
