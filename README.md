# PiBakery

[![Dependency Status](https://img.shields.io/david/davidferguson/pibakery.svg?maxAge=2592000)](https://david-dm.org/davidferguson/pibakery)
[![devDependency Status](https://img.shields.io/david/dev/davidferguson/pibakery.svg?maxAge=2592000)](https://david-dm.org/davidferguson/pibakery)

The blocks based, easy to use setup tool for Raspberry Pi

![PiBakery demo screen](http://pibakery.org/img/blocks-on-workspace.png#2)

PiBakery is a a blocks based drag and drop tool that allows you to customise and edit your Raspberry Pi without powering the Pi on. Simply insert your SD card into your computer, choose which features you want on your Pi, and hit **Write**. PiBakery will write the latest version of Raspbian to your SD card, with your customisations added too.

For more information see www.PiBakery.org or follow [@PiBakery](http://twitter.com/PiBakery) on Twitter.

</br>

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

You can then run PiBakery using
</br>
`npm start`

# PiBakery on Linux
PiBakery should run on Linux if you build from source, however you will need to have `kpartx` installed. Most distributions have these in package repositories, and in Debian/Ubuntu can be installed with
`sudo apt-get install kpartx`

----

# PiBakery v2
The latest version of PiBakery, *PiBakery v2*, is a complete re-write of the original application, with many additional features, including:

- PiBakery no longer bundles .img files in the installer/program. Instead, the user must supply their own Raspbian .img file. This means that any Raspbian-based .img can be used, with the possibility of other distros in the future
- Ability to edit **any** Raspbian SD card, not just ones that have been written with PiBakery
- More robust Linux support
- Ability to add multiple block sources, so the user can maintain their own block repo with their own custom blocks
- Importing of recipes (.xml files) created with older versions of PiBakery no longer fail, instead they are converted automatically into the new format
- The entire program no longer runs as root/admin. Instead, just the writer process is elevated when needed to be
- Modularised code to increase readability, and add option for command line mode in the future
