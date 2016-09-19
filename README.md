# PiBakery

![Dependency Status](https://img.shields.io/david/davidferguson/pibakery.svg)
![devDependency Status](https://img.shields.io/david/dev/davidferguson/pibakery.svg?maxAge=2592000)

The blocks based, easy to use setup tool for Raspberry Pi

![PiBakery demo screen](http://pibakery.org/img/blocks-on-workspace.png)

PiBakery is a a blocks based drag and drop tool that allows you to customise and edit your Raspberry Pi without powering the Pi on. Simply insert your SD card into your computer, choose which features you want on your Pi, and hit **Write**. PiBakery will write the latest version of Raspbian to your SD card, with your customisations added too.

For more information see www.PiBakery.org or follow [@PiBakery](http://twitter.com/PiBakery) on Twitter.

</br>
---

# Installing from source

While it is recommended to install PiBakery from one of the downloads on www.PiBakery.org/download.html, you can also install PiBakery from source if you want to see how it works, or edit PiBakery in any way.

To install PiBakery from source, you'll need NodeJS and npm installed. Once you have them installed, clone the GitHub repository with
</br>
`git clone https://github.com/davidferguson/pibakery.git`

Change into the newly downloaded directory with
</br>
`cd pibakery`

And install the required node modules using
</br>
`npm install`
</br>
This will take a few minutes to complete.

If you're on macOS it's important you run `npm run setup` the first time [to create a folder inside Application Support](https://github.com/davidferguson/pibakery/issues/29) that will hold the operating system  .img files.

Then you'll need to download and extract the Raspberry Pi operating system (currently only raspbian and raspbian lite) .img files into the `os/` directory. If you're on Windows or Linux, the directory is inside the `pibakery` folder, and if you're on macOS, it's located `/Library/Application Support/PiBakery/os`. The operating systems can be downloaded in `.7z` format for the [pibakery-raspbian releases page](https://github.com/davidferguson/pibakery-raspbian/releases).

Lastly you'll need to create a file `images.json` inside the `os` folder which tells PiBakery which operating systems you have installed and available for use. Download the example file from [the pibakery-raspbian repo](https://raw.githubusercontent.com/davidferguson/pibakery-raspbian/master/images.json), save it as `images.json` into the `os` folder where you stored the .img files, and then change the values of the `installed` paramater for each of the operating systems depending on which ones you have installed.

You can then run PiBakery using
</br>
`npm start`
