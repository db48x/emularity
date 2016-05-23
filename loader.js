var Module = null;

(function (Promise) {
   /**
    * IALoader
    */
   function IALoader(canvas, game, callbacks, scale) {
     // IA actually gives us an object here, and we really ought to be
     // looking things up from it instead.
     if (typeof game !== 'string') {
       game = game.toString();
     }
     if (!callbacks || typeof callbacks !== 'object') {
       callbacks = { before_emulator: updateLogo,
                     before_run: callbacks };
     } else {
       if (typeof callbacks.before_emulator === 'function') {
         var func = callbacks.before_emulator;
         callbacks.before_emulator = function () {
                                       updateLogo();
                                       func();
                                     };
       } else {
         callbacks.before_emulator = updateLogo;
       }
     }

     function img(src) {
       var img = new Image();
       img.src = src;
       return img;
     }

     // yea, this is a hack
     if (/archive\.org$/.test(document.location.hostname)) {
       var images = { ia: img("/images/ialogo.png"),
                      mame: img("/images/mame.png"),
                      mess: img("/images/mame.png"),
                      dosbox: img("/images/dosbox.png")
                    };
     } else {
       images = { ia: img("other_logos/ia-logo-150x150.png"),
                  mame: img("other_logos/mame.png"),
                  mess: img("other_logos/mame.png"),
                  dosbox: img("other_logos/dosbox.png")
                };
     }

     function updateLogo() {
         if (emulator_logo) {
           emulator.setSplashImage(emulator_logo);
         }
     }

     var SAMPLE_RATE = (function () {
                          var audio_ctx = window.AudioContext || window.webkitAudioContext || false;
                          if (!audio_ctx) {
                            return false;
                          }
                          var sample = new audio_ctx;
                          return sample.sampleRate.toString();
                        }());

     var metadata, module, modulecfg, config_args, emulator_logo,
         emulator = new Emulator(canvas).setScale(scale)
                                        .setSplashImage(images.ia)
                                        .setLoad(loadFiles)
                                        .setCallbacks(callbacks);

     var cfgr;
     function loadFiles(fetch_file, splash) {
       splash.setTitle("Downloading game metadata...");
       return new Promise(function (resolve, reject) {
                            var loading = fetch_file('Game Metadata',
                                                     get_meta_url(game),
                                                     'document');
                            loading.then(function (data) {
                                           metadata = data;
                                           splash.setTitle("Downloading emulator metadata...");
                                           module = metadata.getElementsByTagName("emulator")
                                                            .item(0)
                                                            .textContent;
                                           return fetch_file('Emulator Metadata',
                                                             get_emulator_config_url(module),
                                                             'text', true);
                                         },
                                         function () {
                                           splash.setTitle("Failed to download IA item metadata!");
                                           splash.failed_loading = true;
                                           reject(1);
                                         })
                                   .then(function (data) {
                                           if (splash.failed_loading) {
                                             return;
                                           }

                                           modulecfg = JSON.parse(data);
                                           var mame = modulecfg &&
                                                      'arcade' in modulecfg &&
                                                      parseInt(modulecfg['arcade'], 10);
                                           var get_files;

                                           if (module && module.indexOf("dosbox") === 0) {
                                             emulator_logo = images.dosbox;
                                             cfgr = DosBoxLoader;
                                             get_files = get_dosbox_files;
                                           }
                                           else if (module) {
                                             if (mame) {
                                               emulator_logo = images.mame;
                                               cfgr = JSMAMELoader;
                                               get_files = get_mame_files;
                                             } else {
                                               emulator_logo = images.mess;
                                               cfgr = JSMESSLoader;
                                               get_files = get_mess_files;
                                             }
                                           }
                                           else {
                                             throw new Error("Unknown module type "+ module +"; cannot configure the emulator.");
                                           }

                                           var nr = modulecfg['native_resolution'];
                                           config_args = [cfgr.emulatorJS(get_js_url(modulecfg.js_filename)),
                                                          cfgr.locateAdditionalEmulatorJS(locateAdditionalJS),
                                                          cfgr.fileSystemKey(game),
                                                          cfgr.nativeResolution(nr[0], nr[1]),
                                                          cfgr.aspectRatio(nr[0] / nr[1]),
                                                          cfgr.sampleRate(SAMPLE_RATE),
                                                          cfgr.muted(!(typeof $ !== 'undefined' && $.cookie && $.cookie('unmute')))];

                                           if (module && module.indexOf("dosbox") === 0) {
                                               config_args.push(cfgr.startExe(metadata.getElementsByTagName("emulator_start")
                                                                                      .item(0)
                                                                                      .textContent));
                                           } else if (module) {
                                             config_args.push(cfgr.driver(modulecfg.driver),
                                                              cfgr.extraArgs(modulecfg.extra_args));
                                             if (modulecfg.peripherals && modulecfg.peripherals[0]) {
                                               config_args.push(cfgr.peripheral(modulecfg.peripherals[0],
                                                                                get_game_name(game)));
                                             }
                                           }

                                           splash.setTitle("Downloading game data...");
                                           return Promise.all(get_files(cfgr, metadata, modulecfg));
                                         },
                                         function () {
                                           if (splash.failed_loading) {
                                             return;
                                           }
                                           splash.setTitle("Failed to download emulator metadata!");
                                           splash.failed_loading = true;
                                           reject(2);
                                         })
                                   .then(function (game_files) {
                                           if (splash.failed_loading) {
                                             return;
                                           }
                                           resolve(cfgr.apply(null, extend(config_args, game_files)));
                                         },
                                         function () {
                                           if (splash.failed_loading) {
                                             return;
                                           }
                                           splash.setTitle("Failed to configure emulator!");
                                           splash.failed_loading = true;
                                           reject(3);
                                         });
                          });
     }

     function locateAdditionalJS(filename) {
       if ("file_locations" in modulecfg && filename in modulecfg.file_locations) {
         return get_js_url(modulecfg.file_locations[filename]);
       }
       throw new Error("Don't know how to find file: "+ filename);
     }

     function get_dosbox_files(cfgr, emulator, modulecfg) {
       // first get the urls
       var urls = [], files = [];
       var len = metadata.documentElement.childNodes.length, i;
       for (i = 0; i < len; i++) {
         var node = metadata.documentElement.childNodes[i];
         var m = node.nodeName.match(/^dosbox_drive_[a-zA-Z]$/);
         if (m) {
           urls.push(node);
         }
       }

       // and a count, then fetch them in
       var len = urls.length;
       for (i = 0; i < len; i++) {
         var node = urls[i],
             drive = node.nodeName.split('_')[2],
             title = 'Game File ('+ (i+1) +' of '+ (game ? len+1 : len) +')',
             url = get_zip_url(node.textContent);
         files.push(cfgr.mountZip(drive, cfgr.fetchFile(title, url)));
       }

       if (game) {
         var drive = 'c',
             title = 'Game File ('+ (i+1) +' of '+ (game ? len+1 : len) +')',
             url = get_zip_url(game);
         files.push(cfgr.mountZip(drive, cfgr.fetchFile(title, url)));
       }

       return files;
     }

     function get_mess_files(cfgr, metadata, modulecfg) {
       var files = [],
           bios_files = modulecfg['bios_filenames'];
       bios_files.forEach(function (fname, i) {
                            if (fname) {
                              var title = "Bios File ("+ (i+1) +" of "+ bios_files.length +")";
                              files.push(cfgr.mountFile('/'+ fname,
                                                        cfgr.fetchFile(title,
                                                                       get_bios_url(fname))));
                            }
                          });
       files.push(cfgr.mountFile('/'+ get_game_name(game),
                                 cfgr.fetchFile("Game File",
                                                get_zip_url(game))));
       files.push(cfgr.mountFile('/'+ modulecfg['driver'] + '.cfg',
                                 cfgr.fetchOptionalFile("CFG File",
                                                        get_other_emulator_config_url(module))));
       return files;
     }

     function get_mame_files(cfgr, metadata, modulecfg) {
       var files = [],
           bios_files = modulecfg['bios_filenames'];
       bios_files.forEach(function (fname, i) {
                            if (fname) {
                              var title = "Bios File ("+ (i+1) +" of "+ bios_files.length +")";
                              files.push(cfgr.mountFile('/'+ fname,
                                                        cfgr.fetchFile(title,
                                                                       get_bios_url(fname))));
                            }
                          });
       files.push(cfgr.mountFile('/'+ get_game_name(game),
                                 cfgr.fetchFile("Game File",
                                                get_zip_url(game))));
       files.push(cfgr.mountFile('/'+ modulecfg['driver'] + '.cfg',
                                 cfgr.fetchOptionalFile("CFG File",
                                                        get_other_emulator_config_url(module))));
       return files;
     }

     var get_item_name = function (game_path) {
       return game_path.split('/').shift();
     };

     var get_game_name = function (game_path) {
       return game_path.split('/').pop();
     };

     // NOTE: deliberately use cors.archive.org since this will 302 rewrite to iaXXXXX.us.archive.org/XX/items/...
     // and need to keep that "artificial" extra domain-ish name to avoid CORS issues with IE/Safari  (tracey@archive)
     var get_emulator_config_url = function (module) {
       return '//cors.archive.org/cors/emularity_engine_v1/' + module + '.json';
     };

     var get_other_emulator_config_url = function (module) {
       return '//cors.archive.org/cors/emularity_config_v1/' + module + '.cfg';
     };

     var get_meta_url = function (game_path) {
       var path = game_path.split('/');
       return "//cors.archive.org/cors/"+ path[0] +"/"+ path[0] +"_meta.xml";
     };

     var get_zip_url = function (game_path) {
       return "//cors.archive.org/cors/"+ game_path;
     };

     var get_js_url = function (js_filename) {
       return "//cors.archive.org/cors/emularity_engine_v1/"+ js_filename;
     };

     var get_bios_url = function (bios_filename) {
       return "//cors.archive.org/cors/emularity_bios_v1/"+ bios_filename;
     };

     function mountat (drive) {
       return function (data) {
         return { drive: drive,
                  mountpoint: "/" + drive,
                  data: data
                };
       };
     }

     return emulator;
   }

   /**
    * BaseLoader
    */
   function BaseLoader() {
     return Array.prototype.reduce.call(arguments, extend);
   }

   BaseLoader.canvas = function (id) {
     var elem = id instanceof Element ? id : document.getElementById(id);
     return { canvas: elem };
   };

   BaseLoader.emulatorJS = function (url) {
     return { emulatorJS: url };
   };

   BaseLoader.locateAdditionalEmulatorJS = function (func) {
     return { locateAdditionalJS: func };
   };

   BaseLoader.fileSystemKey = function (key) {
     return { fileSystemKey: key };
   };

   BaseLoader.nativeResolution = function (width, height) {
     if (typeof width !== 'number' || typeof height !== 'number')
       throw new Error("Width and height must be numbers");
     return { nativeResolution: { width: Math.floor(width), height: Math.floor(height) } };
   };

   BaseLoader.aspectRatio = function (ratio) {
     if (typeof ratio !== 'number')
       throw new Error("Aspect ratio must be a number");
     return { aspectRatio: ratio };
   };

   BaseLoader.sampleRate = function (rate) {
     return { sample_rate: rate };
   };

   BaseLoader.muted = function (muted) {
     return { muted: muted };
   };

   BaseLoader.mountZip = function (drive, file) {
     return { files: [{ drive: drive,
                        mountpoint: "/" + drive,
                        file: file
                      }] };
   };

   BaseLoader.mountFile = function (filename, file) {
     return { files: [{ mountpoint: filename,
                        file: file
                      }] };
   };

   BaseLoader.fetchFile = function (title, url) {
     return { title: title, url: url };
   };

   BaseLoader.fetchOptionalFile = function (title, url) {
     return { title: title, url: url, optional: true };
   };

   BaseLoader.localFile = function (title, data) {
     return { title: title, data: data };
   };

   function DosBoxLoader() {
     var config = Array.prototype.reduce.call(arguments, extend);
     config.emulator_arguments = build_dosbox_arguments(config.emulatorStart, config.files);
     return config;
   }
   DosBoxLoader.__proto__ = BaseLoader;

   DosBoxLoader.startExe = function (path) {
     return { emulatorStart: path };
   };

   /**
    * JSMESSLoader
    */
   function JSMESSLoader() {
     var config = Array.prototype.reduce.call(arguments, extend);
     config.emulator_arguments = build_mess_arguments(config.muted, config.mess_driver,
                                                      config.nativeResolution, config.sample_rate,
                                                      config.peripheral, config.extra_mess_args);
     config.needs_jsmess_webaudio = true;
     return config;
   }
   JSMESSLoader.__proto__ = BaseLoader;

   JSMESSLoader.driver = function (driver) {
     return { mess_driver: driver };
   };

   JSMESSLoader.peripheral = function (peripheral, game) {
     return { peripheral: [peripheral, game] };
   };

   JSMESSLoader.extraArgs = function (args) {
     return { extra_mess_args: args };
   };

   /**
    * JSMAMELoader
    */
   function JSMAMELoader() {
     var config = Array.prototype.reduce.call(arguments, extend);
     config.emulator_arguments = build_mame_arguments(config.muted, config.mess_driver,
                                                      config.nativeResolution, config.sample_rate,
                                                      config.extra_mess_args);
     config.needs_jsmess_webaudio = true;
     return config;
   }
   JSMAMELoader.__proto__ = BaseLoader;

   JSMAMELoader.driver = function (driver) {
     return { mess_driver: driver };
   };

   JSMAMELoader.extraArgs = function (args) {
     return { extra_mess_args: args };
   };

   var build_mess_arguments = function (muted, driver, native_resolution, sample_rate, peripheral, extra_args) {
     var args = [driver,
                 '-verbose',
                 '-rompath', 'emulator',
                 '-window',
                 '-nokeepaspect'];

     if (native_resolution && "width" in native_resolution && "height" in native_resolution) {
       args.push('-resolution', [native_resolution.width, native_resolution.height].join('x'));
     }

     if (muted) {
       args.push('-sound', 'none');
     } else if (sample_rate) {
       args.push('-samplerate', sample_rate);
     }

     if (peripheral && peripheral[0]) {
       args.push('-' + peripheral[0],
                 '/emulator/'+ (peripheral[1].replace(/\//g,'_')));
     }

     if (extra_args) {
       args = args.concat(extra_args);
     }

     return args;
   };

   var build_mame_arguments = function (muted, driver, native_resolution, sample_rate, extra_args) {
     var args = [driver,
                 '-verbose',
                 '-rompath', 'emulator',
                 '-window',
                 '-nokeepaspect'];

     if (native_resolution && "width" in native_resolution && "height" in native_resolution) {
       args.push('-resolution', [native_resolution.width, native_resolution.height].join('x'));
     }

     if (muted) {
       args.push('-sound', 'none');
     } else if (sample_rate) {
       args.push('-samplerate', sample_rate);
     }

     if (extra_args) {
       args = args.concat(extra_args);
     }

     return args;
   };

    var build_dosbox_arguments = function (emulator_start, files) {
      var args = ['-conf', '/emulator/dosbox.conf'];

      var len = files.length;
      for (var i = 0; i < len; i++) {
        if ('mountpoint' in files[i]) {
          args.push('-c', 'mount '+ files[i].drive +' /emulator'+ files[i].mountpoint);
        }
      }

      var path = emulator_start.split(/\\|\//); // I have LTS already
      args.push('-c', /^[a-zA-Z]:$/.test(path[0]) ? path.shift() : 'c:');
      var prog = path.pop();
      if (path && path.length)
        args.push('-c', 'cd '+ path.join('/'));
      args.push('-c', prog);

      return args;
    };

   /**
    * Emulator
    */
   function Emulator(canvas, callbacks, loadFiles) {
     if (typeof callbacks !== 'object') {
       callbacks = { before_emulator: null,
                     before_run: callbacks };
     }
     var js_url;
     var requests = [];
     var drawloadingtimer;
     // TODO: Have an enum value that communicates the current state of the emulator, e.g. 'initializing', 'loading', 'running'.
     var has_started = false;
     var loading = false;
     var defaultSplashColors = { foreground: 'white',
                                 background: 'black',
                                 failure: 'red' };
     var splash = { loading_text: "",
                    spinning: true,
                    finished_loading: false,
                    colors: defaultSplashColors,
                    table: null,
                    splashimg: new Image() };

     var SDL_PauseAudio;
     this.mute = function (state) {
       try {
         if (!SDL_PauseAudio)
           SDL_PauseAudio = Module.cwrap('SDL_PauseAudio', '', ['number']);
         SDL_PauseAudio(state);
       } catch (x) {
         console.log("Unable to change audio state:", x);
       }
       return this;
     };

     // This is the bare minimum that will allow gamepads to work. If
     // we don't listen for them then the browser won't tell us about
     // them.
     // TODO: add hooks so that some kind of UI can be displayed.
     window.addEventListener("gamepadconnected",
                             function (e) {
                               console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
                                           e.gamepad.index, e.gamepad.id,
                                           e.gamepad.buttons.length, e.gamepad.axes.length);
                             });

     window.addEventListener("gamepaddisconnected",
                             function (e) {
                               console.log("Gamepad disconnected from index %d: %s",
                                           e.gamepad.index, e.gamepad.id);
                             });

     var css_resolution, scale, aspectRatio;
     // right off the bat we set the canvas's inner dimensions to
     // whatever it's current css dimensions are; this isn't likely to be
     // the same size that dosbox/jsmess will set it to, but it avoids
     // the case where the size was left at the default 300x150
     if (!canvas.hasAttribute("width")) {
       var style = getComputedStyle(canvas);
       canvas.width = parseInt(style.width, 10);
       canvas.height = parseInt(style.height, 10);
     }

     this.setScale = function(_scale) {
       scale = _scale;
       return this;
     };

     this.setSplashImage = function(_splashimg) {
       if (_splashimg) {
         if (_splashimg instanceof Image) {
           if (splash.splashimg.parentNode) {
             splash.splashimg.src = _splashimg.src;
           } else {
             splash.splashimg = _splashimg;
           }
         } else {
           splash.splashimg.src = _splashimg;
         }
       }
       return this;
     };

     this.setCSSResolution = function(_resolution) {
       css_resolution = _resolution;
       return this;
     };

     this.setAspectRatio = function(_aspectRatio) {
       aspectRatio = _aspectRatio;
       return this;
     };

     this.setCallbacks = function(_callbacks) {
       if (typeof _callbacks !== 'object') {
         callbacks = { before_emulator: null,
                       before_run: _callbacks };
       } else {
         callbacks = _callbacks;
       }
       return this;
     };

     this.setSplashColors = function (colors) {
       splash.colors = colors;
       return this;
     };

     this.setLoad = function (loadFunc) {
       loadFiles = loadFunc;
       return this;
     };

     var start = function (options) {
       if (has_started)
         return false;
       has_started = true;
       if (typeof options !== 'object') {
         options = { waitAfterDownloading: false };
       }

       var k, c, game_data;
       setupSplash(canvas, splash);
       drawsplash();

       var loading;

       if (typeof loadFiles === 'function') {
         loading = loadFiles(fetch_file, splash);
       } else {
         loading = Promise.resolve(loadFiles);
       }
       loading.then(function (_game_data) {
                      return new Promise(function(resolve, reject) {
                        var deltaFS = new BrowserFS.FileSystem.InMemory();
                        // If the browser supports IndexedDB storage, mirror writes to that storage
                        // for persistence purposes.
                        if (BrowserFS.FileSystem.IndexedDB.isAvailable()) {
                          var AsyncMirrorFS = BrowserFS.FileSystem.AsyncMirrorFS,
                              IndexedDB = BrowserFS.FileSystem.IndexedDB;
                          deltaFS = new AsyncMirrorFS(deltaFS,
                                                      new IndexedDB(function(e, fs) {
                                                                      if (e) {
                                                                        // we probably weren't given access; private window for example. don't fail completely, just don't use indexeddb
                                                                        finish();
                                                                      } else {
                                                                        // Initialize deltaFS by copying files from async storage to sync storage.
                                                                        deltaFS.initialize(function(e) {
                                                                                             if (e) {
                                                                                               reject(e);
                                                                                             } else {
                                                                                               finish();
                                                                                             }
                                                                                           });
                                                                      }
                                                                    },
                                                                    "fileSystemKey" in _game_data ? _game_data.fileSystemKey
                                                                                                  : "emularity"));
                        } else {
                          finish();
                        }

                        function finish() {
                          game_data = _game_data;

                          // Any file system writes to MountableFileSystem will be written to the
                          // deltaFS, letting us mount read-only zip files into the MountableFileSystem
                          // while being able to "write" to them.
                          game_data.fs = new BrowserFS.FileSystem.OverlayFS(deltaFS,
                                                                            new BrowserFS.FileSystem.MountableFileSystem());
                          var Buffer = BrowserFS.BFSRequire('buffer').Buffer;

                          function fetch(file) {
                            if ('data' in file && file.data !== null && typeof file.data !== 'undefined') {
                              return Promise.resolve(file.data);
                            }
                            return fetch_file(file.title, file.url, 'arraybuffer', file.optional);
                          }

                          function mountat(drive) {
                            return function (data) {
                              if (data !== null) {
                                drive = drive.toLowerCase();
                                var mountpoint = '/'+ drive;
                                // Mount into RO MFS.
                                game_data.fs.getOverlayedFileSystems().readable.mount(mountpoint, BFSOpenZip(new Buffer(data)));
                              }
                            };
                          }

                          function saveat(filename) {
                            return function (data) {
                              if (data !== null) {
                                game_data.fs.writeFileSync('/'+ filename, new Buffer(data), null, flag_w, 0x1a4);
                              }
                            };
                          }
                          Promise.all(game_data.files
                                               .map(function (f) {
                                                      if (f && f.file) {
                                                        if (f.drive) {
                                                          return fetch(f.file).then(mountat(f.drive));
                                                        } else if (f.mountpoint) {
                                                          return fetch(f.file).then(saveat(f.mountpoint));
                                                        }
                                                      }
                                                      return null;
                                                    }))
                                               .then(resolve, reject);
                        }
                      });
                    })
              .then(function (game_files) {
                      if (!game_data || splash.failed_loading) {
                        return;
                      }
                      if (options.waitAfterDownloading) {
                        return new Promise(function (resolve, reject) {
                                             splash.setTitle("Press any key to continue...");
                                             splash.spinning = false;

                                             // stashes these event listeners so that we can remove them after
                                             window.addEventListener('keypress', k = keyevent(resolve));
                                             canvas.addEventListener('click', c = resolve);
                                             splash.splashElt.addEventListener('click', c);
                                           });
                      }
                      return Promise.resolve();
                    },
                    function () {
                      if (splash.failed_loading) {
                        return;
                      }
                      splash.setTitle("Failed to download game data!");
                      splash.failed_loading = true;
                    })
              .then(function () {
                      if (!game_data || splash.failed_loading) {
                        return;
                      }
                      splash.spinning = true;
                      window.removeEventListener('keypress', k);
                      canvas.removeEventListener('click', c);
                      splash.splashElt.removeEventListener('click', c);

                      // Don't let arrow, pg up/down, home, end affect page position
                      blockSomeKeys();
                      setupFullScreen();
                      disableRightClickContextMenu(canvas);
                      if (game_data.needs_jsmess_webaudio)
                        setup_jsmess_webaudio();

                      // Emscripten doesn't use the proper prefixed functions for fullscreen requests,
                      // so let's map the prefixed versions to the correct function.
                      canvas.requestPointerLock = getpointerlockenabler();

                      moveConfigToRoot(game_data.fs);
                      Module = init_module(game_data.emulator_arguments, game_data.fs, game_data.locateAdditionalJS,
                                           game_data.nativeResolution, game_data.aspectRatio);

                      if (callbacks && callbacks.before_emulator) {
                        try {
                          callbacks.before_emulator();
                        } catch (x) {
                          console.log(x);
                        }
                      }
                      if (game_data.emulatorJS) {
                        splash.setTitle("Launching Emulator");
                        attach_script(game_data.emulatorJS);
                      } else {
                        splash.setTitle("Non-system disk or disk error");
                      }
                    },
                    function () {
                      if (splash.failed_loading) {
                        return;
                      }
                      splash.setTitle("Invalid media, track 0 bad or unusable");
                      splash.failed_loading = true;
                    });
       return this;
     };
     this.start = start;

     var init_module = function(args, fs, locateAdditionalJS, nativeResolution, aspectRatio) {
       return { arguments: args,
                screenIsReadOnly: true,
                print: function (text) { console.log(text); },
                canvas: canvas,
                noInitialRun: false,
                locateFile: locateAdditionalJS,
                preInit: function () {
                           splash.setTitle("Loading game file(s) into file system");
                           // Re-initialize BFS to just use the writable in-memory storage.
                           BrowserFS.initialize(fs);
                           var BFS = new BrowserFS.EmscriptenFS();
                           // Mount the file system into Emscripten.
                           FS.mkdir('/emulator');
                           FS.mount(BFS, {root: '/'}, '/emulator');
                           splash.finished_loading = true;
                           splash.hide();
                           setTimeout(function () {
                                        resizeCanvas(canvas,
                                                     scale = scale || scale,
                                                     css_resolution = nativeResolution || css_resolution,
                                                     aspectRatio = aspectRatio || aspectRatio);
                                      });
                           if (callbacks && callbacks.before_run) {
                               window.setTimeout(function() { callbacks.before_run(); }, 0);
                           }
                         }
              };
     };

     var formatSize = function (event) {
       if (event.lengthComputable)
         return "("+ (event.total ? (event.loaded / event.total * 100).toFixed(0)
                                  : "100") +
                "%; "+ formatBytes(event.loaded) +
                " of "+ formatBytes(event.total) +")";
       return "("+ formatBytes(event.loaded) +")";
     };

     var formatBytes = function (bytes, base10) {
         if (bytes === 0)
           return "0 B";
         var unit = base10 ? 1000 : 1024,
             units = base10 ? ["B", "kB","MB","GB","TB","PB","EB","ZB","YB"]
                            : ["B", "KiB","MiB","GiB","TiB","PiB","EiB","ZiB","YiB"],
             exp = parseInt((Math.log(bytes) / Math.log(unit))),
             size = bytes / Math.pow(unit, exp);
         return size.toFixed(1) +' '+ units[exp];
     };

     var fetch_file = function (title, url, rt, optional) {
       var row = addRow(splash.table);
       var titleCell = row[0], statusCell = row[1];
       titleCell.textContent = title;
       return new Promise(function (resolve, reject) {
                            var xhr = new XMLHttpRequest();
                            xhr.open('GET', url, true);
                            xhr.responseType = rt || 'arraybuffer';
                            xhr.onprogress = function (e) {
                                               titleCell.textContent = title +" "+ formatSize(e);
                                             };
                            xhr.onload = function (e) {
                                           if (xhr.status === 200) {
                                             success();
                                             resolve(xhr.response);
                                           } else if (optional) {
                                             success();
                                             resolve(null);
                                           } else {
                                             failure();
                                             reject();
                                           }
                                         };
                            xhr.onerror = function (e) {
                                            if (optional) {
                                              success();
                                              resolve(null);
                                            } else {
                                              failure();
                                              reject();
                                            }
                                          };
                            function success() {
                              statusCell.textContent = "✔";
                              titleCell.textContent = title;
                              titleCell.style.fontWeight = 'bold';
                              titleCell.parentNode.style.backgroundColor = splash.getColor('foreground');
                              titleCell.parentNode.style.color = splash.getColor('background');
                            }
                            function failure() {
                              statusCell.textContent = "✘";
                              titleCell.textContent = title;
                              titleCell.style.fontWeight = 'bold';
                              titleCell.parentNode.style.backgroundColor = splash.getColor('failure');
                              titleCell.parentNode.style.color = splash.getColor('background');
                            }
                            xhr.send();
                          });
     };

     function keyevent(resolve) {
       return function (e) {
                if (e.which == 32) {
                  e.preventDefault();
                  resolve();
                }
              };
     };

     var resizeCanvas = function (canvas, scale, resolution, aspectRatio) {
       if (scale && resolution) {
         // optimizeSpeed is the standardized value. different
         // browsers support different values; they will all ignore
         // values that they don't understand.
         canvas.style.imageRendering = '-moz-crisp-edges';
         canvas.style.imageRendering = '-o-crisp-edges';
         canvas.style.imageRendering = '-webkit-optimize-contrast';
         canvas.style.imageRendering = 'optimize-contrast';
         canvas.style.imageRendering = 'crisp-edges';
         canvas.style.imageRendering = 'pixelated';
         canvas.style.imageRendering = 'optimizeSpeed';

         canvas.style.width = resolution.width * scale +'px';
         canvas.style.height = resolution.height * scale +'px';
         canvas.width = resolution.width;
         canvas.height = resolution.height;
       }
     };

     var clearCanvas = function () {
       var context = canvas.getContext('2d');
       context.fillStyle = splash.getColor('background');
       context.fillRect(0, 0, canvas.width, canvas.height);
       console.log("canvas cleared");
     };

     function setupSplash(canvas, splash) {
       splash.splashElt = document.getElementById("emularity-splash-screen");
       if (!splash.splashElt) {
         splash.splashElt = document.createElement('div');
         splash.splashElt.setAttribute('id', "emularity-splash-screen");
         splash.splashElt.style.position = 'absolute';
         splash.splashElt.style.top = canvas.offsetTop +'px';
         splash.splashElt.style.left = canvas.offsetLeft +'px';
         splash.splashElt.style.width = canvas.offsetWidth +'px';
         splash.splashElt.style.color = splash.getColor('foreground');
         splash.splashElt.style.backgroundColor = splash.getColor('background');
         canvas.parentElement.appendChild(splash.splashElt);
       }

       splash.splashimg.setAttribute('id', "emularity-splash-image");
       splash.splashimg.style.display = 'block';
       splash.splashimg.style.marginLeft = 'auto';
       splash.splashimg.style.marginRight = 'auto';
       splash.splashElt.appendChild(splash.splashimg);

       splash.titleElt = document.createElement('span');
       splash.titleElt.setAttribute('id', "emularity-splash-title");
       splash.titleElt.style.display = 'block';
       splash.titleElt.style.width = '100%';
       splash.titleElt.style.marginTop = "1em";
       splash.titleElt.style.marginBottom = "1em";
       splash.titleElt.style.textAlign = 'center';
       splash.titleElt.style.font = "24px sans-serif";
       splash.titleElt.textContent = " ";
       splash.splashElt.appendChild(splash.titleElt);

       var table = document.getElementById("dosbox-progress-indicator");
       if (!table) {
         table = document.createElement('table');
         table.setAttribute('id', "dosbox-progress-indicator");
         table.style.width = "50%";
         table.style.color = splash.getColor('foreground');
         table.style.backgroundColor = splash.getColor('background');
         table.style.marginLeft = 'auto';
         table.style.marginRight = 'auto';
         table.style.borderCollapse = 'separate';
         table.style.borderSpacing = "2px";
         splash.splashElt.appendChild(table);
       }
       splash.table = table;
     }

     splash.setTitle = function (title) {
       splash.titleElt.textContent = title;
     };

     splash.hide = function () {
       splash.splashElt.style.display = 'none';
     };

     splash.getColor = function (name) {
       return name in splash.colors ? splash.colors[name]
                                    : defaultSplashColors[name];
     };

     var addRow = function (table) {
       var row = table.insertRow(-1);
       row.style.textAlign = 'center';
       var cell = row.insertCell(-1);
       cell.style.position = 'relative';
       var titleCell = document.createElement('span');
       titleCell.textContent = '—';
       titleCell.style.verticalAlign = 'center';
       titleCell.style.minHeight = "24px";
       cell.appendChild(titleCell);
       var statusCell = document.createElement('span');
       statusCell.style.position = 'absolute';
       statusCell.style.left = "0";
       statusCell.style.paddingLeft = "0.5em";
       cell.appendChild(statusCell);
       return [titleCell, statusCell];
     };

     var drawsplash = function () {
       canvas.setAttribute('moz-opaque', '');
       if (!splash.splashimg.src) {
         splash.splashimg.src = "logo/emularity_color_small.png";
       }
     };

     function attach_script(js_url) {
         if (js_url) {
           var head = document.getElementsByTagName('head')[0];
           var newScript = document.createElement('script');
           newScript.type = 'text/javascript';
           newScript.src = js_url;
           head.appendChild(newScript);
         }
     }

     function getpointerlockenabler() {
       return canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
     }

     function getfullscreenenabler() {
       return canvas.webkitRequestFullScreen || canvas.mozRequestFullScreen || canvas.requestFullScreen;
     }

     this.isfullscreensupported = function () {
        return !!(getfullscreenenabler());
     };

     function setupFullScreen() {
       var self = this;
       var fullScreenChangeHandler = function() {
                                       if (!(document.mozFullScreenElement || document.fullScreenElement)) {
                                         resizeCanvas(canvas, scale, css_resolution, aspectRatio);
                                       }
                                     };
       if ('onfullscreenchange' in document) {
         document.addEventListener('fullscreenchange', fullScreenChangeHandler);
       } else if ('onmozfullscreenchange' in document) {
         document.addEventListener('mozfullscreenchange', fullScreenChangeHandler);
       } else if ('onwebkitfullscreenchange' in document) {
         document.addEventListener('webkitfullscreenchange', fullScreenChangeHandler);
       }
     };

     this.requestFullScreen = function () {
       Module.requestFullScreen(1, 0);
     };

     /**
       * Prevents page navigation keys such as page up/page down from
       * moving the page while the user is playing.
       */
     function blockSomeKeys() {
       function keypress (e) {
         if (e.which >= 33 && e.which <= 40) {
           e.preventDefault();
           return false;
         }
         return true;
       }
       window.onkeydown = keypress;
     }

     /**
       * Disables the right click menu for the given element.
       */
     function disableRightClickContextMenu(element) {
       element.addEventListener('contextmenu',
                                function (e) {
                                  if (e.button == 2) {
                                    // Block right-click menu thru preventing default action.
                                    e.preventDefault();
                                  }
                                });
     }
   };

   /**
    * misc
    */
   function BFSOpenZip(loadedData) {
       return new BrowserFS.FileSystem.ZipFS(loadedData);
   };

   // This is such a hack. We're not calling the BrowserFS api
   // "correctly", so we have to synthesize these flags ourselves
   var flag_r = { isReadable: function() { return true; },
                  isWriteable: function() { return false; },
                  isTruncating: function() { return false; },
                  isAppendable: function() { return false; },
                  isSynchronous: function() { return false; },
                  isExclusive: function() { return false; },
                  pathExistsAction: function() { return 0; },
                  pathNotExistsAction: function() { return 1; }
                };
   var flag_w = { isReadable: function() { return false; },
                  isWriteable: function() { return true; },
                  isTruncating: function() { return false; },
                  isAppendable: function() { return false; },
                  isSynchronous: function() { return false; },
                  isExclusive: function() { return false; },
                  pathExistsAction: function() { return 0; },
                  pathNotExistsAction: function() { return 3; }
                };

   /**
    * Searches for dosbox.conf, and moves it to '/dosbox.conf' so dosbox uses it.
    */
   function moveConfigToRoot(fs) {
     var dosboxConfPath = null;
     // Recursively search for dosbox.conf.
     function searchDirectory(dirPath) {
       fs.readdirSync(dirPath).forEach(function(item) {
         if (dosboxConfPath) {
           return;
         }
         // Avoid infinite recursion by ignoring these entries, which exist at
         // the root.
         if (item === '.' || item === '..') {
           return;
         }
         // Append '/' between dirPath and the item's name... unless dirPath
         // already ends in it (which always occurs if dirPath is the root, '/').
         var itemPath = dirPath + (dirPath[dirPath.length - 1] !== '/' ? "/" : "") + item,
             itemStat = fs.statSync(itemPath);
         if (itemStat.isDirectory(itemStat.mode)) {
           searchDirectory(itemPath);
         } else if (item === 'dosbox.conf') {
           dosboxConfPath = itemPath;
         }
       });
     }

     searchDirectory('/');

     if (dosboxConfPath !== null) {
       fs.writeFileSync('/dosbox.conf',
                        fs.readFileSync(dosboxConfPath, null, flag_r),
                        null, flag_w, 0x1a4);
     }
   };

   function extend(a, b) {
     if (a === null)
       return b;
     if (b === null)
       return a;
     var ta = typeof a,
         tb = typeof b;
     if (ta !== tb) {
       if (ta === 'undefined')
         return b;
       if (tb === 'undefined')
         return a;
       throw new Error("Cannot extend an "+ ta +" with an "+ tb);
     }
     if (Array.isArray(a))
       return a.concat(b);
     if (ta === 'object') {
       Object.keys(b).forEach(function (k) {
                                a[k] = extend(a[k], b[k]);
                              });
       return a;
     }
     return b;
   }

   function setup_jsmess_webaudio() {
     // jsmess web audio backend v0.3
     // katelyn gadd - kg at luminance dot org ; @antumbral on twitter
     //taisel working on it atm

     var jsmess_web_audio = (function () {

     var context = null;
     var gain_node = null;
     var eventNode = null;
     var sampleScale = 32766;
     var inputBuffer = new Float32Array(44100);
     var bufferSize = 44100;
     var start = 0;
     var rear = 0;
     var watchDogDateLast = null;
     var watchDogTimerEvent = null;

     function lazy_init () {
       //Make
       if (context) {
         //Return if already created:
         return;
       }
       if (typeof AudioContext != "undefined") {
         //Standard context creation:
         context = new AudioContext();
       }
       else if (typeof webkitAudioContext != "undefined") {
         //Older webkit context creation:
         context = new webkitAudioContext();
       }
       else {
         //API not found!
         return;
       }
       //Generate a volume control node:
       gain_node = context.createGain();
       //Set initial volume to 1:
       gain_node.gain.value = 1.0;
       //Connect volume node to output:
       gain_node.connect(context.destination);
       //Initialize the streaming event:
       init_event();
     };

     function init_event() {
         //Generate a streaming node point:
         if (typeof context.createScriptProcessor == "function") {
           //Current standard compliant way:
           eventNode = context.createScriptProcessor(4096, 0, 2);
         }
         else {
           //Deprecated way:
           eventNode = context.createJavaScriptNode(4096, 0, 2);
         }
         //Make our tick function the audio callback function:
         eventNode.onaudioprocess = tick;
         //Connect stream to volume control node:
         eventNode.connect(gain_node);
         //WORKAROUND FOR FIREFOX BUG:
         initializeWatchDogForFirefoxBug();
     };

     function initializeWatchDogForFirefoxBug() {
         //TODO: decide if we want to user agent sniff firefox here,
         //since Google Chrome doesn't need this:
         watchDogDateLast = (new Date()).getTime();
         if (watchDogTimerEvent === null) {
             watchDogTimerEvent = setInterval(function () {
                 var timeDiff = (new Date()).getTime() - watchDogDateLast;
                 if (timeDiff > 500) {
                     disconnect_old_event();
                     init_event();
                 }
             }, 500);
         }
     };

     function disconnect_old_event() {
         //Disconnect from audio graph:
         eventNode.disconnect();
         //IIRC there was a firefox bug that did not GC this event when nulling the node itself:
         eventNode.onaudioprocess = null;
         //Null the glitched/unused node:
         eventNode = null;
     };

     function set_mastervolume (
       // even though it's 'attenuation' the value is negative, so...
       attenuation_in_decibels
     ) {
       lazy_init();
       if (!context) return;

       // http://stackoverflow.com/questions/22604500/web-audio-api-working-with-decibels
       // seemingly incorrect/broken. figures. welcome to Web Audio
       // var gain_web_audio = 1.0 - Math.pow(10, 10 / attenuation_in_decibels);

       // HACK: Max attenuation in JSMESS appears to be 32.
       // Hit ' then left/right arrow to test.
       // FIXME: This is linear instead of log10 scale.
       var gain_web_audio = 1.0 + (+attenuation_in_decibels / +32);
       if (gain_web_audio < +0)
         gain_web_audio = +0;
       else if (gain_web_audio > +1)
         gain_web_audio = +1;

       gain_node.gain.value = gain_web_audio;
     };

     function update_audio_stream (
       pBuffer,           // pointer into emscripten heap. int16 samples
       samples_this_frame // int. number of samples at pBuffer address.
     ) {
       lazy_init();
       if (!context) return;

       for (
         var i = 0,
             l = samples_this_frame | 0;
         i < l;
         i++
       ) {
         var offset =
           // divide by sizeof(INT16) since pBuffer is offset
           //  in bytes
           ((pBuffer / 2) | 0) +
           ((i * 2) | 0);

         var left_sample = HEAP16[offset];
         var right_sample = HEAP16[(offset + 1) | 0];

         // normalize from signed int16 to signed float
         var left_sample_float = left_sample / sampleScale;
         var right_sample_float = right_sample / sampleScale;

         inputBuffer[rear++] = left_sample_float;
         inputBuffer[rear++] = right_sample_float;
         if (rear == bufferSize) {
           rear = 0;
         }
         if (start == rear) {
           start += 2;
           if (start == bufferSize) {
             start = 0;
           }
         }
       }
     };
     function tick (event) {
       //Find all output channels:
       for (var bufferCount = 0, buffers = []; bufferCount < 2; ++bufferCount) {
         buffers[bufferCount] = event.outputBuffer.getChannelData(bufferCount);
       }
       //Copy samples from the input buffer to the Web Audio API:
       for (var index = 0; index < 4096 && start != rear; ++index) {
         buffers[0][index] = inputBuffer[start++];
         buffers[1][index] = inputBuffer[start++];
         if (start == bufferSize) {
           start = 0;
         }
       }
       //Pad with silence if we're underrunning:
       while (index < 4096) {
         buffers[0][index] = 0;
         buffers[1][index++] = 0;
       }
       //Deep inside the bowels of vendors bugs,
       //we're using watchdog for a firefox bug,
       //where the user agent decides to stop firing events
       //if the user agent lags out due to system load.
       //Don't even ask....
       watchDogDateLast = (new Date()).getTime();
     }

     function get_context() {
       return context;
     };

     function sample_count() {
         //TODO get someone to call this from the emulator,
         //so the emulator can do proper audio buffering by
         //knowing how many samples are left:
         if (!context) {
             //Use impossible value as an error code:
             return -1;
         }
         var count = rear - start;
         if (start > rear) {
             count += bufferSize;
         }
         return count;
     }

     return {
       set_mastervolume: set_mastervolume,
       update_audio_stream: update_audio_stream,
       get_context: get_context,
       sample_count: sample_count
     };

     })();

     window.jsmess_set_mastervolume = jsmess_web_audio.set_mastervolume;
     window.jsmess_update_audio_stream = jsmess_web_audio.update_audio_stream;
     window.jsmess_sample_count = jsmess_web_audio.sample_count;
     window.jsmess_web_audio = jsmess_web_audio;
   }

   window.IALoader = IALoader;
   window.DosBoxLoader = DosBoxLoader;
   window.JSMESSLoader = JSMESSLoader;
   window.JSMAMELoader = JSMAMELoader;
   window.Emulator = Emulator;
 })(typeof Promise === 'undefined' ? ES6Promise.Promise : Promise);

// legacy
var JSMESS = JSMESS || {};
JSMESS.ready = function (f) { f(); };
