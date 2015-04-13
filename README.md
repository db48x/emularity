# Welcome to the Emularity #
![Emularity](https://raw.githubusercontent.com/db48x/emularity/master/logo/emularity_light.png)
# Synopsis #

Emularity (also called "The Emularity") is a loader designed to be used with a family of in-browser emulation systems. It is meant to ease the use of in-browser-based javascript emulation by handling housekeeping functions, making it easy to embed emulators in your website, blogs, intranet or local filesystem. The components of each aspect of the software being emulated (including the .js emulator, the program files, and operating system) can be pulled from local filesystems or through URLs.

Emularity downloads the files you specify (with a Progress screen that shows both emulator logos and what is being loaded), arranges them to form a filesystem, constructs the necessary arguments for the emulator, and handles transitions to and from full-screen mode.

The Emularity system has been used by millions of users at the [Internet Archive](https://archive.org). 

# The Emulators #

Currently works with two emulators:

## JSMESS ##

[JSMESS](https://github.com/jsmess/jsmess) is a port of the Multi Emulator Super System (MESS) and the Multiple Arcade Machine Emulator (MAME) projects to Javascript. MESS and MAME support thousands of different machines including game consoles, arcade machines and computer platforms.

## EM-DOSBox ##

[EM-DOSBox](https://github.com/dreamlayers/em-dosbox/) is a port of DosBox to Javascript. DOSBox emulates an IBM PC compatible running DOS. There are two versions of this emulator, dosbox.js (Standard EM-DOSBOX) and dosbox-sync.js (EM-DOSBOX with considerations for in-program execution of other programs). 

# Known Bugs #

* documentation is quite poor
* splash screen doesn't always fit inside the canvas
* need to improve the download progress indicators
* browser feature detection for volume/mute/full-screen
* handling of aspect ratios, and their interaction with full-screen mode
* finish API for volume/mute/full-screen requests

