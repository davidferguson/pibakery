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

'use strict';

const fs = require('fs-extra');
const electron = require('electron');
const elevate = require('./elevate');
const electronLocalshortcut = require('electron-localshortcut');
const path = require("path");

electron.app.on('ready', function()
{
	elevate.require(electron.app, function(error)
	{
		if (error) {
			electron.dialog.showErrorBox('Elevation Error', error.message);
			return process.exit(1);
		}

		var mainWindow = new electron.BrowserWindow({
			height: 480,
			width: 640,
			minHeight: 480,
			minWidth: 640,
			resizable: true,
			'autoHideMenuBar': true,
			title: "PiBakery",
			icon: 'app/img/icon.png'
		});

		var extraParams = process.argv.length > 1 ? process.argv[1] : "";
		mainWindow.loadURL(path.normalize('file://' + __dirname + '/app/index.html?' + extraParams));

		mainWindow.on('closed', function ()
		{
			electron.app.quit();
		});

		electronLocalshortcut.register(mainWindow, 'CommandOrControl+Shift+I', function()
    {
      mainWindow.toggleDevTools();
    });
    electronLocalshortcut.register(mainWindow, 'CommandOrControl+V', function()
    {
      mainWindow.webContents.send('paste', electron.clipboard.readText());
    });
    electronLocalshortcut.register(mainWindow, 'CommandOrControl+Shift+Plus', function()
    {
      mainWindow.webContents.send('testBlock');
    });
  });
});
