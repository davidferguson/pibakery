# PiBakery
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

You can then run PiBakery using
</br>
`npm start`

When PiBakery is run for the first time, it will give an error about not being able to find Raspbian. This is because Raspbian is the entire Raspberry Pi OS, and is too large to fit in the GitHub repository. By clicking `Attemp Auto-Fix` PiBakery will download Raspbian for you into the `os` directory. Once this download has completed, you're ready to start using PiBakery.
