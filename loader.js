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
                      dosbox: img("/images/dosbox.png"),
                      sae: img("/images/sae.png")
                    };
     } else {
       images = { ia: img("other_logos/ia-logo-150x150.png"),
                  mame: img("other_logos/mame.png"),
                  mess: img("other_logos/mame.png"),
                  dosbox: img("other_logos/dosbox.png"),
                  sae: img("other_logos/sae.png")
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

     var metadata, filelist, module, modulecfg, config_args, emulator_logo,
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
                                           splash.setTitle("Downloading game filelist...");
                                           return fetch_file('Game File List',
                                                             get_files_url(game),
                                                             'document', true);
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
                                           filelist = data;
                                           splash.setTitle("Downloading emulator metadata...");
                                           module = metadata.getElementsByTagName("emulator")
                                                            .item(0)
                                                            .textContent;
                                           return fetch_file('Emulator Metadata',
                                                             get_emulator_config_url(module),
                                                             'text', true);
                                         },
                                         function () {
                                           if (splash.failed_loading) {
                                             return;
                                           }
                                           splash.setTitle("Failed to download file list!");
                                           splash.failed_loading = true;
                                           reject(2);
                                         })
                                   .then(function (data) {
                                           if (splash.failed_loading) {
                                             return;
                                           }

                                           modulecfg = JSON.parse(data);
                                           var get_files;

                                           if (module && module.indexOf("dosbox") === 0) {
                                             emulator_logo = images.dosbox;
                                             cfgr = DosBoxLoader;
                                             get_files = get_dosbox_files;
                                           }
                                           else if (module && module.indexOf("sae-") === 0) {
                                             emulator_logo = images.sae;
                                             cfgr = SAELoader;
                                             get_files = get_sae_files;
                                           }
                                           else if (module) {
                                             emulator_logo = images.mame;
                                             cfgr = MAMELoader;
                                             get_files = get_mame_files;
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
                                                          cfgr.sampleRate(SAMPLE_RATE)];

                                           if (/archive\.org$/.test(document.location.hostname)) {
                                             cfgr.muted(!(typeof $ !== 'undefined' && $.cookie && $.cookie('unmute')))
                                           }

                                           if (module && module.indexOf("dosbox") === 0) {
                                             config_args.push(cfgr.startExe(metadata.getElementsByTagName("emulator_start")
                                                                                    .item(0)
                                                                                    .textContent));
                                           } else if (module && module.indexOf("sae-") === 0) {
                                             config_args.push(cfgr.model(modulecfg.driver),
                                                              cfgr.rom(modulecfg.bios_filenames));
                                           } else if (module) {
                                             config_args.push(cfgr.driver(modulecfg.driver),
                                                              cfgr.extraArgs(modulecfg.extra_args));
                                           }

                                           splash.setTitle("Downloading game data...");
                                           return Promise.all(get_files(cfgr, metadata, modulecfg, filelist));
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

     function get_dosbox_files(cfgr, emulator, modulecfg, filelist) {
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

     function get_mame_files(cfgr, metadata, modulecfg, filelist) {
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

       var ext = dict_from_xml(metadata).emulator_ext;
       var game_files = list_from_xml(filelist).map(function (node) {
                                                      if ("getAttribute" in node) {
                                                        var file = dict_from_xml(node);
                                                        file.name = node.getAttribute("name");
                                                        return file;
                                                      }
                                                      return null;
                                                    })
                                               .filter(function (file) {
                                                         return file && file.name.endsWith("." + ext);
                                                       });
       game_files.forEach(function (file, i) {
                            if (file) {
                              var title = "Game File ("+ (i+1) +" of "+ game_files.length +")";
                              files.push(cfgr.mountFile('/'+ file.name,
                                                        cfgr.fetchFile(title,
                                                                       get_zip_url(file.name,
                                                                                   get_item_name(game)))));
                              if (modulecfg.peripherals && modulecfg.peripherals[0]) {
                                files.push(cfgr.peripheral(modulecfg.peripherals[0],   // we're not pushing a file here
                                                           file.name));                // but that's ok
                              }
                            }
                          });
       files.push(cfgr.mountFile('/'+ modulecfg['driver'] + '.cfg',
                                 cfgr.fetchOptionalFile("CFG File",
                                                        get_other_emulator_config_url(module))));
       return files;
     }

     function get_sae_files(cfgr, metadata, modulecfg, filelist) {
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

       var ext = dict_from_xml(metadata).emulator_ext;
       var game_files = list_from_xml(filelist).map(function (node) {
                                                      if ("getAttribute" in node) {
                                                        var file = dict_from_xml(node);
                                                        file.name = node.getAttribute("name");
                                                        return file;
                                                      }
                                                      return null;
                                                    })
                                               .filter(function (file) {
                                                         return file && file.name.endsWith("." + ext);
                                                       });
       game_files.forEach(function (file, i) {
                            if (file) {
                              var title = "Game File ("+ (i+1) +" of "+ game_files.length +")";
                              files.push(cfgr.mountFile('/'+ file.name,
                                                        cfgr.fetchFile(title,
                                                                       get_zip_url(file.name,
                                                                                   get_item_name(game)))));
                              files.push(cfgr.floppy(0,             // we're not pushing a file here
                                                     file.name));   // but that's ok
                            }
                          });
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

     var get_files_url = function (game_path) {
       var path = game_path.split('/');
       return "//cors.archive.org/cors/"+ path[0] +"/"+ path[0] +"_files.xml";
     };

     var get_zip_url = function (game_path, item_path) {
       if (item_path) {
         return "//cors.archive.org/cors/"+ item_path +"/"+ game_path;
       }
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
     return { title: title, url: url, optional: false };
   };

   BaseLoader.fetchOptionalFile = function (title, url) {
     return { title: title, url: url, optional: true };
   };

   BaseLoader.localFile = function (title, data) {
     return { title: title, data: data };
   };

   /**
    * DosBoxLoader
    */
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
    * MAMELoader
    */
   function MAMELoader() {
     var config = Array.prototype.reduce.call(arguments, extend);
     config.emulator_arguments = build_mame_arguments(config.muted, config.mame_driver,
                                                      config.nativeResolution, config.sample_rate,
                                                      config.peripheral, config.extra_mame_args);
     return config;
   }
   MAMELoader.__proto__ = BaseLoader;

   MAMELoader.driver = function (driver) {
     return { mame_driver: driver };
   };

   MAMELoader.peripheral = function (peripheral, game) {
     var p = {}
     p[peripheral] = [game];
     return { peripheral: p };
   };

   MAMELoader.extraArgs = function (args) {
     return { extra_mame_args: args };
   };

   /**
    * SAELoader
    */

   function SAELoader() {
     var config = Array.prototype.reduce.call(arguments, extend);
     config.runner = SAERunner;
     return config;
   }
   SAELoader.__proto__ = BaseLoader;

   SAELoader.model = function (model) {
     return { amigaModel: model };
   }

   SAELoader.fastMemory = function (megabytes) {
     return { fast_memory: megabytes << 20 };
   }

   SAELoader.rom = function (filenames) {
     if (typeof filenames == "string")
       filenames = [filenames];
     return { rom: filenames[0], extRom: filenames[1] };
   };

   SAELoader.floppy = function (index, filename) {
     var f = {}
     f[index] = filename;
     return { floppy: f };
   };

   SAELoader.ntsc = function (v) {
     return { ntsc: !!v };
   }

   var build_mame_arguments = function (muted, driver, native_resolution, sample_rate, peripheral, extra_args) {
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

     if (peripheral) {
       for (var p in peripheral) {
         if (Object.prototype.propertyIsEnumerable.call(peripheral, p)) {
           args.push('-' + p,
                     '/emulator/'+ (peripheral[p][0].replace(/\//g,'_')))
         }
       }
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

    function SAERunner(canvas, game_data) {
      this._sae = new ScriptedAmigaEmulator();
      this._cfg = this._sae.getConfig();
      this._canvas = canvas;

      var model = null;
      switch (game_data.amigaModel) {
        case "A500": model = SAEC_Model_A500; break;
        case "A500P": model = SAEC_Model_A500P; break;
        case "A600": model = SAEC_Model_A600; break;
        case "A1000": model = SAEC_Model_A1000; break;
        case "A1200": model = SAEC_Model_A1200; break;
        case "A2000": model = SAEC_Model_A2000; break;
        case "A3000": model = SAEC_Model_A3000; break;
        case "A4000": model = SAEC_Model_A4000; break;
        case "A4000T": model = SAEC_Model_A4000T; break;
        /*  future. do not use. cd-emulation is not implemented yet.
        case "CDTV": model = SAEC_Model_CDTV; break;
        case "CD32": model = SAEC_Model_CD32; break; */
      }
      this._sae.setModel(model, 0);
      this._cfg.memory.z2FastSize = game_data.fastMemory || 2 << 20;
      this._cfg.floppy.speed = SAEC_Config_Floppy_Speed_Turbo;
      this._cfg.video.id = canvas.getAttribute("id");

      if (game_data.nativeResolution && game_data.nativeResolution.height == 360 && game_data.nativeResolution.width == 284)
      {
        this._cfg.video.hresolution = SAEC_Config_Video_HResolution_LoRes;
        this._cfg.video.vresolution = SAEC_Config_Video_VResolution_NonDouble;
        this._cfg.video.size_win.width = SAEC_Video_DEF_AMIGA_WIDTH; /* 360 */
        this._cfg.video.size_win.height = SAEC_Video_DEF_AMIGA_HEIGHT; /* 284 */
      }
      else if (game_data.nativeResolution && game_data.nativeResolution.height == 1440 && game_data.nativeResolution.width == 568)
      {
        this._cfg.video.hresolution = SAEC_Config_Video_HResolution_SuperHiRes;
        this._cfg.video.vresolution = SAEC_Config_Video_VResolution_Double;
        this._cfg.video.size_win.width = SAEC_Video_DEF_AMIGA_WIDTH << 2; /* 1440 */
        this._cfg.video.size_win.height = SAEC_Video_DEF_AMIGA_HEIGHT << 1; /* 568 */
      }
      else
      {
        this._cfg.video.hresolution = SAEC_Config_Video_HResolution_HiRes;
        this._cfg.video.vresolution = SAEC_Config_Video_VResolution_Double;
        this._cfg.video.size_win.width = SAEC_Video_DEF_AMIGA_WIDTH << 1; /* 720 */
        this._cfg.video.size_win.height = SAEC_Video_DEF_AMIGA_HEIGHT << 1; /* 568 */
      }

      this._cfg.memory.rom.name = game_data.rom;
      this._cfg.memory.rom.data = new Uint8Array(game_data.fs.readFileSync('/'+game_data.rom, null, flag_r).toArrayBuffer());
      this._cfg.memory.rom.size = this._cfg.memory.rom.data.length;

      if (game_data.extRom) {
        this._cfg.memory.extRom.name = game_data.extRom;
        this._cfg.memory.extRom.data = new Uint8Array(game_data.fs.readFileSync('/'+game_data.extRom, null, flag_r).toArrayBuffer());
        this._cfg.memory.extRom.size = this._cfg.memory.extRom.data.length;
      }

      this._cfg.floppy.drive[0].file.name = game_data.floppy[0];
      this._cfg.floppy.drive[0].file.data = new Uint8Array(game_data.fs.readFileSync('/'+game_data.floppy[0], null, flag_r).toArrayBuffer());
      this._cfg.floppy.drive[0].file.size = this._cfg.floppy.drive[0].file.data.length;
    }

    SAERunner.prototype.start = function () {
      var err = this._sae.start();
    }

    SAERunner.prototype.pause = function () {
      this._sae.pause();
    }

    SAERunner.prototype.stop = function () {
      this._sae.stop();
    }

    SAERunner.prototype.mute = function () {
      var err = this._sae.mute(true);
      if (err) {
        console.warn("unable to mute; SAE error number", err)
      }
    }

    SAERunner.prototype.unmute = function () {
      var err = this._sae.mute(false);
      if (err) {
        console.warn("unable to unmute; SAE error number", err)
      }
    }

    SAERunner.prototype.onStarted = function (func) {
      this._cfg.hook.event.started = func;
    };

    SAERunner.prototype.onReset = function (func) {
      this._cfg.hook.event.reseted = func;
    };

    SAERunner.prototype.requestFullScreen = function () {
      getfullscreenenabler().call(this._canvas);
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

     var runner;

     var muted = false;
     var SDL_PauseAudio;
     this.isMuted = function () { return muted; }
     this.mute = function () { return this.setMute(true); }
     this.unmute = function () { return this.setMute(false); }
     this.toggleMute = function () { return this.setMute(!muted); }
     this.setMute = function (state) {
       muted = state;
       if (runner) {
         if (state) {
           runner.mute();
         } else {
           runner.unmute();
         }
       }
       else {
         try {
           if (!SDL_PauseAudio)
             SDL_PauseAudio = Module.cwrap('SDL_PauseAudio', '', ['number']);
           SDL_PauseAudio(state);
         } catch (x) {
           console.log("Unable to change audio state:", x);
         }
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

     if (/archive\.org$/.test(document.location.hostname)) {
       document.getElementById("gofullscreen").addEventListener("click", this.requestFullScreen);
     }

     var css_resolution, scale, aspectRatio;
     // right off the bat we set the canvas's inner dimensions to
     // whatever it's current css dimensions are; this isn't likely to be
     // the same size that dosbox/jsmame will set it to, but it avoids
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
                        var inMemoryFS = new BrowserFS.FileSystem.InMemory();
                        // If the browser supports IndexedDB storage, mirror writes to that storage
                        // for persistence purposes.
                        if (BrowserFS.FileSystem.IndexedDB.isAvailable()) {
                          var AsyncMirrorFS = BrowserFS.FileSystem.AsyncMirror,
                              IndexedDB = BrowserFS.FileSystem.IndexedDB;
                          deltaFS = new AsyncMirrorFS(inMemoryFS,
                                                      new IndexedDB(function(e, fs) {
                                                                      if (e) {
                                                                        // we probably weren't given access;
                                                                        // private window for example.
                                                                        // don't fail completely, just don't
                                                                        // use indexeddb
                                                                        deltaFS = inMemoryFS;
                                                                        finish();
                                                                      } else {
                                                                        // Initialize deltaFS by copying files from async storage to sync storage.
                                                                        deltaFS.initialize(function (e) {
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
                          game_data.fs.initialize(function (e) {
                            if (e) {
                              console.error("Failed to initialize the OverlayFS:", e);
                              reject();
                            } else {
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
                        }
                      });
                    })
              .then(function (game_files) {
                      if (!game_data || splash.failed_loading) {
                        return null;
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
                        return null;
                      }
                      splash.spinning = true;
                      window.removeEventListener('keypress', k);
                      canvas.removeEventListener('click', c);
                      splash.splashElt.removeEventListener('click', c);

                      // Don't let arrow, pg up/down, home, end affect page position
                      blockSomeKeys();
                      setupFullScreen();
                      disableRightClickContextMenu(canvas);

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
                        return attach_script(game_data.emulatorJS);
                      } else {
                        splash.setTitle("Non-system disk or disk error");
                      }
                      return null;
                    },
                    function () {
                      if (!game_data || splash.failed_loading) {
                        return null;
                      }
                      splash.setTitle("Invalid media, track 0 bad or unusable");
                      splash.failed_loading = true;
                    })
              .then(function () {
                      if (!game_data || splash.failed_loading) {
                        return null;
                      }
                      if ("runner" in game_data) {
                        runner = new game_data.runner(canvas, game_data);
                        resizeCanvas(canvas, 1, game_data.nativeResolution, game_data.aspectRatio);
                        runner.onStarted(function () {
                                           splash.finished_loading = true;
                                           splash.hide();
                                         });
                        runner.onReset(function () {
                                         if (muted) {
                                           runner.mute();
                                         }
                                       });
                        runner.start();
                      }
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
                                               titleCell.innerHTML = title +" <span style=\"font-size: smaller\">"+ formatSize(e) +"</span>";
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
         table.style.width = "75%";
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
       titleCell.style.whiteSpace = "nowrap";
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
       return new Promise(function (resolve, reject) {
                            var newScript;
                            function loaded(e) {
                              if (e.target == newScript) {
                                newScript.removeEventListener("load", loaded);
                                newScript.removeEventListener("error", failed);
                                resolve();
                              }
                            }
                            function failed(e) {
                              if (e.target == newScript) {
                                newScript.removeEventListener("load", loaded);
                                newScript.removeEventListener("error", failed);
                                reject();
                              }
                            }
                            if (js_url) {
                              var head = document.getElementsByTagName('head')[0];
                              newScript = document.createElement('script');
                              newScript.addEventListener("load", loaded);
                              newScript.addEventListener("error", failed);
                              newScript.type = 'text/javascript';
                              newScript.src = js_url;
                              head.appendChild(newScript);
                            }
                          });
     }

     function getpointerlockenabler() {
       return canvas.requestPointerLock || canvas.mozRequestPointerLock || canvas.webkitRequestPointerLock;
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
       if (typeof Module == "object" && "requestFullScreen" in Module) {
         Module.requestFullScreen(1, 0);
       } else if (runner) {
         runner.requestFullScreen();
       }
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
   function getfullscreenenabler() {
     return canvas.requestFullScreen || canvas.webkitRequestFullScreen || canvas.mozRequestFullScreen;
   }

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
                                a[k] = extend(k in a ? a[k] : undefined, b[k]);
                              });
       return a;
     }
     return b;
   }

   function dict_from_xml(xml) {
     if (xml instanceof XMLDocument) {
       xml = xml.documentElement;
     }
     var dict = {};
     var len = xml.childNodes.length, i;
     for (i = 0; i < len; i++) {
       var node = xml.childNodes[i];
       dict[node.nodeName] = node.textContent;
     }
     return dict;
   }

   function list_from_xml(xml) {
     if (xml instanceof XMLDocument) {
       xml = xml.documentElement;
     }
     return Array.prototype.slice.call(xml.childNodes);
   }

   window.IALoader = IALoader;
   window.DosBoxLoader = DosBoxLoader;
   window.JSMESSLoader = MAMELoader; // depreciated; just for backwards compatibility
   window.JSMAMELoader = MAMELoader; // ditto
   window.MAMELoader = MAMELoader;
   window.SAELoader = SAELoader;
   window.Emulator = Emulator;
 })(typeof Promise === 'undefined' ? ES6Promise.Promise : Promise);

// legacy
var JSMESS = JSMESS || {};
JSMESS.ready = function (f) { f(); };
