# Technical Information on use of the Emularity

To use this project you'll need to provide it with a canvas element, styled as necessary so that it has the correct size on screen (the emulated program will be scaled up automatically to fit, controlling for aspect ratio). You will also likely want to provide a simple UI for entering full-screen mode or muting the audio; these can simply call methods on the emulator when activated.

# Emulator API #

The `Emulator` constructor takes three arguments: a canvas element, an
optional set of callbacks, and a config (as detailed below) or a
function which returns a `Promise` of a config.

# Acquiring Emulators #

The Internet Archive is currently maintaining three sets of emulators - one for JSMESS, one for JSMAME and one for EM-DOSBOX. They can be found at:

* [Emularity Engines: Arcade (JSMAME)](https://archive.org/details/emularity_engine_jsmame)
* [Emularity Engines: Computers and Consoles (JSMESS)](https://archive.org/details/emularity_engine_jsmess)
* [Emularity Engines: MS-DOS (EM-DOSBOX)](https://archive.org/details/emularity_engine_emdosbox)

# Configuration #

## Examples ##

### Arcade game ###

Loads the emulator for the arcade game 1943, and gives it a compressed
copy of the rom (which it loads from examples/1943.zip).

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new JSMAMELoader(JSMAMELoader.driver("1943"),
                                                   JSMAMELoader.nativeResolution(224, 256),
                                                   JSMAMELoader.emulatorJS("emulators/mess1943.js"),
                                                   JSMAMELoader.mountFile("1943.zip",
                                                                          JSMAMELoader.fetchFile("Game File",
                                                                                                 "examples/1943.zip"))))
      emulator.setScale(3);
      emulator.start({ waitAfterDownloading: true });

### Console game for Atari 2600 ###

Loads the emulator for the Atari 2600 console, and an image of a
catridge for Pitfall. Notice how we download the image, storing it in
a file, then set up a "cart" peripheral so that the emulator can find
it. We also load a configuration file that preconfigures some
keybindings needed to use the 2600.

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new JSMESSLoader(JSMESSLoader.driver("a2600"),
                                                   JSMESSLoader.nativeResolution(352, 223),
                                                   JSMESSLoader.emulatorJS("emulators/messa2600.js"),
                                                   JSMESSLoader.mountFile("Pitfall_Activision_1982.bin",
                                                                          JSMESSLoader.fetchFile("Game File",
                                                                                                 "examples/Pitfall_Activision_1982.bin")),
                                                   JSMESSLoader.mountFile("a2600.cfg",
                                                                          JSMESSLoader.fetchFile("Config File",
                                                                                                 "examples/a2600.cfg")),
                                                   JSMESSLoader.peripheral("cart", "Pitfall_Activision_1982.bin")))
      emulator.setScale(3).start({ waitAfterDownloading: true });

### DOS game ###

Here we load the DOSBox emulator, and a zip file containing the game
ZZT which we decompress and then mount as the C drive. We also tell
DosBox to immediately start running zzt.exe, which is inside the zip.

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new DosBoxLoader(DosBoxLoader.emulatorJS("emulators/dosbox.js"),
                                                   DosBoxLoader.nativeResolution(640, 400),
                                                   DosBoxLoader.mountZip("c",
                                                                         DosBoxLoader.fetchFile("Game File",
                                                                                                "examples/Zzt_1991_Epic_Megagames_Inc.zip")),
                                                   DosBoxLoader.startExe("zzt.exe")))
      emulator.start({ waitAfterDownloading: true });

## Configuration API ##

Currently there are two supported emulators, JSMESS and
EM-DOSBox. JSMESS provides emulation for arcade games, consoles, and
early personal computers. As this emulator supports such a wide
variety of hardware it has been broken up into several dozen emulators
each supporting one machine lest the resulting javascript be
intractably large (60+ megabytes). EM-DOSBox provides emulation for
software that runs on x86 PCs using the DOS operating systems common
to the era.

Each of these is configured by calling a constructor function and
providing it with arguments formed by calling static methods on that
same constructor.

### Common ###

* `emulatorJS(url)`
* `mountZip(drive, file)`
* `mountFile(filename, file)`
* `fetchFile(url)`
* `fetchOptionalFile(url)`
* `localFile(data)`

### JSMESS ###

* `driver(driverName)`
* `extraArgs(args)`
* `peripheral(name, filename)`

### JSMAME ###

* `driver(driverName)`
* `extraArgs(args)`

### EM-DOSBox ###

* `startExe(filename)`

## Internet Archive ##

There's also a helper for loading software from
[the Internet Archive](https://archive.org/v2), `IALoader`. IALoader
looks at the metadata associated with an Internet Archive item and
uses that to build the configuration for the emulator.

## Examples ##

    var emulator = new IALoader(document.querySelector("#canvas"),
                                "Pitfall_Activision_1982/Pitfall_Activision_1982.bin");

# Runtime API #

Once you have an emulator object, there are several methods you can call.

* `start()`
* `requestFullScreen()`
* `mute()`
* `setSplashColors()`
* others…
