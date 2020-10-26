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

var isElevated = require('is-elevated')
var electron = require('electron')
var Menu = electron.Menu
var ipcMain = electron.ipcMain
var elevate = require('./lib/elevate')
var electronLocalshortcut = require('electron-localshortcut')
var path = require('path')
var argv = require('yargs')(process.argv).argv


// receive message about starting rootwriter thread
ipcMain.on('rootwriter', function (event, imgPath, drive, socketPath) {
  // elevate this process, with the additional command line options
  var additionalArguments = [
    '--rootwriter',
    '--socketpath',
    socketPath,
    '--imgpath',
    imgPath,
    '--drive',
    drive,
    '--require',
    __filename
  ]
  elevate.require(additionalArguments, function (error) {
    if (error) {
      electron.dialog.showErrorBox('Elevation Error', error.message)
      //return process.exit(1)
    }
  })
})



/*
 * check for the '--rootwriter' argument, meaning that this shouldn't run the
 * full app, and should instead start the rootwriter thread
 */
if (argv.rootwriter) {
  launchRootWriter()
  return
}


/*
 * if it's Linux, and we're not running as root, then elevate the entire app
 * rather than just elevating the rootwriter, as linux has additional issues
 */
if (process.platform === 'linux') {
  isElevated(function (error, elevated) {
    if (error) {
      return callback(error)
    }

    if (!elevated) {
      // we're on linux, and not elevated, elevate the entire app
      elevate.require([], function (error) {
        if (error) {
          electron.dialog.showErrorBox('Elevation Error', 'Could not elevate PiBakery, you won\'t be able to write images.')
          launchPiBakery()
          return
        }
        return process.exit(0)
      })
      return
    }

    // we're elevated, continue as normal
    launchPiBakery()
    return
  })
}


// normal case, just run app as normal
if (process.platform === 'win32' || process.platform === 'darwin') {
  launchPiBakery()
}



function launchRootWriter () {
  if (process.platform === 'darwin') {
    // hide this app in the dock
    electron.app.dock.hide()
  }

  // get the command line arguments
  var socketPath = argv.socketpath
  var imgPath = argv.imgpath
  var drive = argv.drive
  drive = JSON.parse(drive)

  // launch the rootwriter program
  var rootwriter = require('./lib/rootwriter.js')

  // connect to the PiBakery program
  rootwriter.connect(socketPath, function () {
    // once connected, begin the write
    rootwriter.write(imgPath, drive, function writeComplete () {
      // quit this thread once the write is complete
      electron.app.quit()
    })
  })

  // don't run anything else
  return
}



function launchPiBakery () {
  var mainWindow = new electron.BrowserWindow({
    height: 480,
    width: 640,
    minHeight: 480,
    minWidth: 640,
    resizable: true,
    autoHideMenuBar: true,
    title: 'PiBakery'
    /* icon: 'app/img/icon.png' */
  })

  mainWindow.loadURL(path.join('file://', __dirname, '/app/index.html'))

  mainWindow.on('closed', function () {
    electron.app.quit()
  })

  electronLocalshortcut.register(mainWindow, 'CommandOrControl+Shift+I', function () {
    mainWindow.toggleDevTools()
  })

  electronLocalshortcut.register(mainWindow, 'CommandOrControl+V', function () {
    mainWindow.webContents.send('paste', electron.clipboard.readText())
  })

  electronLocalshortcut.register(mainWindow, 'CommandOrControl+Shift+Plus', function () {
    mainWindow.webContents.send('testBlock')
  })
  
  createMenu()
}


function createMenu () {
  var template = [
    {
      label: 'Edit',
      submenu: [
        {role: 'undo'},
        {role: 'redo'},
        {type: 'separator'},
        {role: 'cut'},
        {role: 'copy'},
        {role: 'paste'},
        {role: 'pasteandmatchstyle'},
        {role: 'delete'},
        {role: 'selectall'}
      ]
    },
    {
      role: 'window',
      submenu: [
        {role: 'minimize'}
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click () { electron.shell.openExternal('https://pibakery.org') }
        },
        {
          label: 'Report Issue',
          click () { electron.shell.openExternal('https://github.com/davidferguson/pibakery/issues/') }
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: electron.app.getName(),
      submenu: [
        {role: 'about'},
        {type: 'separator'},
        {role: 'services', submenu: []},
        {type: 'separator'},
        {role: 'hide'},
        {role: 'hideothers'},
        {role: 'unhide'},
        {type: 'separator'},
        {role: 'quit'}
      ]
    })

    // Edit menu
    template[1].submenu.push(
      {type: 'separator'},
      {
        label: 'Speech',
        submenu: [
          {role: 'startspeaking'},
          {role: 'stopspeaking'}
        ]
      }
    )

    // Window menu
    template[3].submenu = [
      {role: 'close'},
      {role: 'minimize'},
      {role: 'zoom'},
      {type: 'separator'},
      {role: 'front'}
    ]
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
