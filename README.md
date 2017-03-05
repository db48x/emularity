# Welcome to the Emularity #
![Emularity](https://raw.githubusercontent.com/db48x/emularity/master/logo/emularity_light.png)

# Beta Warning #

The Emularity should be considered in beta. We welcome feedback and suggestions as we finish 1.0.

# Synopsis #

Emularity (also called "The Emularity") is a loader designed to be used with a family of in-browser emulation systems. It is meant to ease the use of in-browser-based javascript emulation by handling housekeeping functions, making it easy to embed emulators in your website, blogs, intranet or local filesystem. The components of each aspect of the software being emulated (including the .js emulator, the program files, and operating system) can be pulled from local filesystems or through URLs.

Emularity downloads the files you specify (with a progress screen that shows both emulator logos and what is being loaded), arranges them to form a filesystem, constructs the necessary arguments for the emulator, and handles transitions to and from full-screen mode.

The Emularity system has been used by millions of users at the [Internet Archive](https://archive.org).

# The Emulators #

Currently works with three emulators:

## MAME ##

[MAME](https://github.com/mamedev/mame) is a port of the Multiple Arcade Machine Emulator (MAME) projects to Javascript. MAME supports over a thousand different machines including game consoles, arcade machines and computer platforms.

## EM-DOSBox ##

[EM-DOSBox](https://github.com/dreamlayers/em-dosbox/) is a port of DosBox to Javascript. DOSBox emulates an IBM PC compatible running DOS. There are two versions of this emulator, dosbox.js (Standard EM-DOSBOX) and dosbox-sync.js (EM-DOSBOX with considerations for in-program execution of other programs).

## Scripted Amiga Emulator ##

[SAE](https://github.com/naTmeg/ScriptedAmigaEmulator) is a Javascript port of WinUAE by [naTmeg](https://github.com/naTmeg). It emulates most of the Amiga models that were released.

# Credits and Components #

Primary work on Emularity is by [Daniel Brooks](https://github.com/db48x), with contributions of code or concepts from [John Vilk](https://github.com/jvilk), Andre D, [Justin Kerk](https://github.com/DopefishJustin), [Vitorio Miliano](https://github.com/vitorio), and [Jason Scott](https://github.com/textfiles). Some of these contributions predate the Emularity git repository, unfortunately.

Emularity makes use of [BrowserFS](https://github.com/jvilk/BrowserFS) by [John Vilk](https://github.com/jvilk), an in-browser filesystem that emulates the Node JS filesystem API and supports storing and retrieving files from various backends.

It also utilizes [ES6-Promise](https://github.com/jakearchibald/es6-promise), a polyfill of the ES6 Promise API. Both are implemented and included without modification; consult these original repositories for information or verification.

# Some Open Issues #

* Documentation can be improved
* Splash Screen occasionally overflows canvas
* Progress bars can stand to be improved
* Should add browser-specific detections for unusual behaviors and volume/full-screen actions
* Handling of aspect ratios, and their interaction with full-screen mode
* Finish API for volume/mute/full-screen requests
