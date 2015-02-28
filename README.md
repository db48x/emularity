# Name #

js-emulators

# Synopsis #

The goal of this little project is to make it easy to embed a javascript-based emulator in your own webpage. It downloads the files you specify (with aprogress ui to show what is happening), arranges them to form a filesystem, constructs the necessary arguments for the emulator, handles transitions to and from full-screen mode, and detects and enables game pads.

To use this project you'll need to provide it with a canvas element, styled as necessary so that it has the correct size on screen (the program will be scaled up automatically to fit, controlling for aspect ratio). You will also likely want to provide a simple UI for entering full-screen mode or muting the audio; these can simply call methods on the emulator when activated.

# Examples #

## Arcade game ##

Loads the emulator for the arcade game 1943, and gives it a compressed copy of the rom (assumes that this is in games/1943.zip).

    var emulator = new Emulator("#canvas", null,
                                new JSMAMELoader(JSMAMELoader.driver("1943"),
                                                 JSMAMELoader.emulatorJS("emulators/mess1943.js.gz"),
                                                 JSMAMELoader.mountFile("1943.zip",
                                                                        JSMAMELoader.fetchFile("Game File", "games/1943.zip"))))

## Console game for Atari 2600 ##

Loads the emulator for the Atari 2600 console, and an image of a catridge for Pitfall. Notice how we download the image, storing it in a file, then set up a "cart" peripheral so that the emulator can find it. We also load a configuration file that preconfigures some keybindings needed to use the 2600.

    var emulator = new Emulator("#canvas", null,
                                new JSMESSLoader(JSMESSLoader.driver("a2600"),
                                                 JSMESSLoader.emulatorJS("emulators/messa2600.js.gz"),
                                                 JSMESSLoader.mountFile("atari_2600_pitfall_1983_cce_c-813.bin",
                                                                        JSMESSLoader.fetchFile("Game File",
                                                                                               "games/atari_2600_pitfall_1983_cce_c-813.bin")),
                                                 JSMESSLoader.mountFile("foo.cfg",
                                                                        JSMESSLoader.fetchFile("Config File",
                                                                                               "emulators/a2600.cfg")),
                                                 JSMESSLoader.peripheral("cart", "atari_2600_pitfall_1983_cce_c-813.bin")))

## DOS game ##

Here we load the dosbox emulator, and a zip file containing the game ZZT which we mount as the C drive. We also tell DosBox to immediately start running zzt.exe.

    var emulator = new Emulator("#canvas", null,
                                new DosBoxLoader(DosBoxLoader.emulatorJS("emulators/dosbox.js.gz"),
                                                 DosBoxLoader.mountZip("c", DosBoxLoader.fetchFile("Game File", "games/zzt.zip")),
                                                 DosBoxLoader.startExe("zzt.exe")))

# Configuration API #

Currently there are two supported emulators, JSMESS and EM-DosBox. JSMESS provides emulation for arcade games, consoles, and early personal computers. As this emulator supports such a wide variety of hardware it has been broken up into several dozen emulators each supporting one machine lest the resulting javascript be intractably large (60+ megabytes). EM-DosBox provides emulation for software that runs on x86 PCs using the DOS operating systems common to the era.

Each of these is configured by calling a constructor function and providing it with arguments formed by calling static methods on that same constructor.

## Common ##

* `emulatorJS(url)`
* `mountZip(drive, file)`
* `mountFile(filename, file)`
* `fetchFile(url)`
* `fetchOptionalFile(url)`
* `localFile(data)`

## JSMESS ##

* `driver(driverName)`
* `extraArgs(args)`
* `peripheral(name, filename)`

## JSMAME ##

* `driver(driverName)`
* `extraArgs(args)`

## EM-DosBox ##

* startExe(filename)

# Internet Archive #

There's also a helper for loading software from [the Internet Archive](https://archive.org/v2), `IALoader`. IALoader looks at the metadata associated with their items and uses that to build the configuration for the emulator.

## Examples ##

    var emulator = IALoader("#canvas", "atari_2600_pitfall_1983_cce_c-813/atari_2600_pitfall_1983_cce_c-813.bin");

# Known Bugs #

* splash screen doesn't always fit inside the canvas
* need to improve the download progress indicators
* browser feature detection for volume/mute/full-screen
* handling of aspect ratios, and their interaction with full-screen mode
* finish API for volume/mute/full-screen requests
