# Welcome to the Emularity #
![Emularity](https://raw.githubusercontent.com/db48x/emularity/master/logo/emularity_light.png)
# Synopsis #

The goal of this little project is to make it easy to embed a
javascript-based emulator in your own webpage. It downloads the files
you specify (with aprogress ui to show what is happening), arranges
them to form a filesystem, constructs the necessary arguments for the
emulator, and handles transitions to and from full-screen mode.

# The Emulators #

Currently works with two emulators:

## JSMESS ##

[JSMESS](https://github.com/jsmess/jsmess) is a port of the Multi
Emulator Super System (MESS) and the Multiple Arcade Machine Emulator
(MAME) projects to Javascript. MESS and MAME support hundreds of
different machines; producing a single javascript file which supports
all of them turns out to be infeasible. Instead the JSMESS developers
have split each machine out into a separate js file.

## EM-DOSBox ##

[EM-DOSBox](https://github.com/dreamlayers/em-dosbox/) is a port of
DosBox to Javascript. DOSBox emulates an IBM PC compatible running
DOS. There are two versions of this emulator, dosbox.js and
dosbox-sync.js. Use the former by default, and the latter if you need
the emulator to support console input, batch files, or programs that
run other programs.

# Known Bugs #

* documentation is quite poor
* splash screen doesn't always fit inside the canvas
* need to improve the download progress indicators
* browser feature detection for volume/mute/full-screen
* handling of aspect ratios, and their interaction with full-screen mode
* finish API for volume/mute/full-screen requests

