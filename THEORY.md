# Theory of Operation #

# Introduction #

The Emularity is the capstone of multiple years of work by many individuals, both on the emulators themselves and the process to make them executable in browsers. As a result, there are a lot of conventions and unspoken assumptions about how the emulation systems work, which The Emularity is meant to make as non-intrusive as possible, but which make error correction and debugging somewhat more difficult than it might at first seem. This document is meant to explain how the systems work, providing hooks for users attempting to debug a non-functioning installation.

# In-Browser Emulation: The Approach #

For the current crop of in-browser emulators that Emularity loads, the process of creating them has been the same: take an existing, natively-coded emulator (MESS, MAME, DOSBOX) and, using the Emscripten compiler tools, convert the output to Javascript. The resulting javascript files, while much more obtuse and arcane, allow the larger development teams working on the original emulators to focus their attentions where they should be (making the most accurate and efficient browsers possible) and not where they shouldn't (hand-porting emulators to Javascript).

The resulting javascript emulators (JSMESS, JSMAME, EM-DOSBOX) draw into a canvas element in a web page, and semd the audio created by the emulated program to the new HTML5 audio APIs.

# Why Even Do This? #

The reason for this series of coding acrobatics is to provide portability and universal access to historical computing/computer environments. The load of configuing the emulators, adding the software, and providing the resulting emulation is taken away from the end user, requiring only a browser (nearly every system has one installed) to emulate the given software.
