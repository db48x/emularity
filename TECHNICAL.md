# Technical Information on use of the Emularity

To use this project you'll need to provide it with a canvas element, styled as necessary so that it has the correct size on screen (the emulated program will be scaled up automatically to fit, controlling for aspect ratio). You will also likely want to provide a simple UI for entering full-screen mode or muting the audio; these can simply call methods on the emulator when activated.

# Emulator API #

The `Emulator` constructor takes three arguments: a canvas element, an
optional set of callbacks, and a config (as detailed below) or a
function which returns a `Promise` of a config.

# Acquiring Emulators #

The Internet Archive is currently maintaining two sets of pre-built
emulators - one for MAME and one for EM-DOSBOX. They can be found at:

* [Emularity Engines: Arcade (MAME)](https://archive.org/details/emularity_engine_jsmame)
* [Emularity Engines: Computers and Consoles (MAME)](https://archive.org/details/emularity_engine_jsmess)
* [Emularity Engines: MS-DOS (EM-DOSBOX)](https://archive.org/details/emularity_engine_emdosbox)

Note that MESS and MAME used to be separate, if related,
projects. They've recently been combined into a single source code
repository and prjoject structure, and Emularity has changed to match.

Instructions for building these yourself will be added in the future.

[The Scripted Amiga Emulator](https://github.com/naTmeg/ScriptedAmigaEmulator)
is much simpler to build, as it is already written in Javascript.

# Configuration #

## Examples ##

### Arcade game ###

Loads the emulator for the arcade game 1943, and gives it a compressed
copy of the rom (which it loads from examples/1943.zip).

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new MAMELoader(MAMELoader.driver("1943"),
                                                 MAMELoader.nativeResolution(224, 256),
                                                 MAMELoader.scale(3),
                                                 MAMELoader.emulatorJS("emulators/mess1943.js"),
                                                 MAMELoader.mountFile("1943.zip",
                                                                      MAMELoader.fetchFile("Game File",
                                                                                           "examples/1943.zip"))))
      emulator.start({ waitAfterDownloading: true });

### Console game for Atari 2600 ###

Loads the emulator for the Atari 2600 console, and an image of a
catridge for Pitfall. Notice how we download the image, storing it in
a file, then set up a "cart" peripheral so that the emulator can find
it. We also load a configuration file that preconfigures some
keybindings needed to use the 2600.

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new MAMELoader(MAMELoader.driver("a2600"),
                                                 MAMELoader.nativeResolution(352, 223),
                                                 MAMELoader.scale(3),
                                                 MAMELoader.emulatorJS("emulators/messa2600.js"),
                                                 MAMELoader.mountFile("Pitfall_Activision_1982.bin",
                                                                      MAMELoader.fetchFile("Game File",
                                                                                           "examples/Pitfall_Activision_1982.bin")),
                                                 MAMELoader.mountFile("a2600.cfg",
                                                                      MAMELoader.fetchFile("Config File",
                                                                                           "examples/a2600.cfg")),
                                                 MAMELoader.peripheral("cart", "Pitfall_Activision_1982.bin")))
      emulator.start({ waitAfterDownloading: true });

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

### Amiga demo ###

The Amiga is interesting because several models had a split bios,
requiring two bios images. We have to download them both, and then
provide their names in the right order.

      var emulator = new Emulator(document.querySelector("#canvas"),
                                  null,
                                  new SAELoader(SAELoader.model("A500"),
                                                SAELoader.fastMemory(2),
                                                SAELoader.nativeResolution(720, 568),
                                                SAELoader.scale(2),
                                                SAELoader.emulatorJS("emulators/sae/scriptedamigaemulator.js"),
                                                SAELoader.mountFile("aros-amiga-m68k-rom.bin",
                                                                    SAELoader.fetchFile("Bios",
                                                                                        "examples/aros-amiga-m68k-rom.bin")),
                                                SAELoader.mountFile("aros-amiga-m68k-ext.bin",
                                                                    SAELoader.fetchFile("Bios",
                                                                                        "examples/aros-amiga-m68k-ext.bin")),
                                                SAELoader.rom(["aros-amiga-m68k-rom.bin", "aros-amiga-m68k-ext.bin"]),
                                                SAELoader.mountFile("Cool_Demos_17.2_1989_Razor_1911.adf",
                                                                    SAELoader.fetchFile("Game",
                                                                                        "examples/Cool_Demos_17.2_1989_Razor_1911.adf")),
                                                SAELoader.floppy(0, "Cool_Demos_17.2_1989_Razor_1911")))
      emulator.start({ waitAfterDownloading: true });


## Configuration API ##

Currently there are three supported emulators, JSMESS, EM-DOSBox and
SAE. JSMESS provides emulation for arcade games, consoles, and early
personal computers. As this emulator supports such a wide variety of
hardware it has been broken up into several dozen emulators each
supporting one machine lest the resulting javascript be intractably
large (60+ megabytes). EM-DOSBox provides emulation for software that
runs on x86 PCs using the DOS operating systems common to the era. SAE
emulates the Amiga computer system.

Each of these is configured by calling a constructor function and
providing it with arguments formed by calling static methods on that
same constructor. In principle this configuration is just an object
with various properties. Although the static methods are more
indirect, they are intended to allow autocompletion in IDEs to
function, and thus make writing them more convenient.

### Common ###

* `BaseLoader.emulatorJS(url)`
* `BaseLoader.emulatorWASM(url)`
* `BaseLoader.mountZip(drive, file)`
* `BaseLoader.mountFile(filename, file)`
* `BaseLoader.fetchFile(url)`
* `BaseLoader.fetchOptionalFile(url)`
* `BaseLoader.localFile(data)`

### MAME ###

* `MAMELoader.driver(driverName)`
* `MAMELoader.extraArgs(args)`
* `MAMELoader.peripheral(name, filename)`

### JSMESS ###

JSMESSLoader is merely a synonym for MAMELoader, and is provided so
that we don't break existing users.

### EM-DOSBox ###

* `DosBoxLoader.startExe(filename)`
* `DosBoxLoader.extraArgs(args)`

### SAE ###

* `SAELoader.model(modelname)`
* `SAELoader.fastMemory(megabytes)`
* `SAELoader.rom(filenames)`
* `SAELoader.floppy(index, filename)`
* `SAELoader.ntsc(boolean)`

## Internet Archive ##

There's also a helper for loading software from
[the Internet Archive](https://archive.org/), `IALoader`. IALoader
looks at the metadata associated with an Internet Archive item and
uses that to build the configuration for the emulator by calling
one of the other loaders as necessary.

## Examples ##

You need only supply the canvas element and the Internet Archive's
item name:

    var emulator = new IALoader(document.querySelector("#canvas"),
                                "Pitfall_Activision_1982");

# Runtime API #

Once you have an emulator object, there are several methods you can call.

* `start()`
* `requestFullScreen()`
* `mute()`
* `unmute()`
* `toggleMute()`
* `setSplashColors()`
* others…

# Splash Screen Styles #

By default, Emularity requires no stylesheet; it directly styles every
element that it creates instead. If you would like more control over
how the splash screen looks than is provided by the `setSplashColors`
method, pass `{ hasCustomCSS: true }` to the `start` method. All of
the splash screen elements will be unstyled, leaving the look up to
you. For reference, the default styles normally applied by Emularity
are approximately as follows:

```css
.emularity-splash-screen {
  color: white;
  background-color: black;
  position: absolute;
  top: 0;
  left: 0;
  right: 0
}
.emularity-splash-screen .emularity-splash-image {
  display: block;
  margin-left: auto;
  margin-right: auto
}
.emularity-splash-screen .emularity-splash-title {
  display: block;
  width: 100%;
  margin-top: 1em;
  margin-bottom: 1em;
  text-align: center;
  font: 24px sans-serif
}
.emularity-splash-screen .emularity-progress-indicator {
  color: white;
  background-color: black;
  width: 75%;
  margin-left: auto;
  margin-right: auto;
  border-collapse: separate;
  border-spacing: 2px
}
.emularity-splash-screen .emularity-progress-indicator tr {
  text-align: center
}
.emularity-splash-screen .emularity-progress-indicator td {
  position: relative;
  padding-top: 4px
}
.emularity-splash-screen .emularity-progress-indicator td.emularity-download-success {
  font-weight: bold;
  color: black;
  background-color: white
}
.emularity-splash-screen .emularity-progress-indicator td.emularity-download-failure {
  font-weight: bold;
  color: black;
  background-color: red
}
.emularity-splash-screen .emularity-progress-indicator td .emularity-download-title {
  white-space: nowrap
}
.emularity-splash-screen .emularity-progress-indicator td .emularity-download-status {
  position: absolute;
  left: .5em
}
```
