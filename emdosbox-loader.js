var Module = null;

function DOSBOX(canvas, module, game, precallback, callback, scale) {
  var moduledata;
  var requests = [];
  var drawloadingtimer;
  var file_countdown;
  var spinnerrot = 0;
  var splashimg = new Image();
  var spinnerimg = new Image();
  var has_started = false;
  var loading = false;
  var LOADING_TEXT;

  var SAMPLE_RATE = (function () {
    var audio_ctx = window.AudioContext || window.webkitAudioContext || false;
    if (!audio_ctx) {
      return false;
    }
    var sample = new audio_ctx;
    return sample.sampleRate.toString();
  }());

  var can_start = function () {
    return !!canvas && !!module && !!game && !!scale && !has_started;
  };

  this.setscale = function(_scale) {
    scale = _scale;
    try_start();
    return this;
  };

  this.setprecallback = function(_precallback) {
    precallback = _precallback;
    return this;
  };

  this.setcallback = function(_callback) {
    callback = _callback;
    return this;
  };

  this.setmodule = function(_module) {
    module = _module;
    try_start();
    return this;
  };

  this.setgame = function(_game) {
    game = _game;
    try_start();
    return this;
  };

  var draw_loading_status = function() {
    var context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(splashimg, canvas.width / 2 - (splashimg.width / 2), canvas.height / 3 - (splashimg.height / 2));
    var spinnerpos = (canvas.height / 2 + splashimg.height / 2) + 16;
    context.save();
    context.translate((canvas.width / 2), spinnerpos);
    context.rotate(spinnerrot);
    context.drawImage(spinnerimg, -(64/2), -(64/2), 64, 64);
    context.restore();
    context.save();
    context.font = '18px sans-serif';
    context.fillStyle = 'Black';
    context.textAlign = 'center';
    context.fillText(LOADING_TEXT, canvas.width / 2, (canvas.height / 2) + (splashimg.height / 4));
    context.restore();
    spinnerrot += .25;
  };

  var progress_fetch_file = function(e) {
    if (e.lengthComputable) {
      e.target.progress = e.loaded / e.total;
      e.target.loaded = e.loaded;
      e.target.total = e.total;
      e.target.lengthComputable = e.lengthComputable;
    }
  };

  var fetch_file = function(title, url, cb, rt, raw, unmanaged) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = rt ? rt : 'arraybuffer';
    xhr.onload = function(e) {
      if (xhr.status != 200) {
        return;
      }
      if (!unmanaged) {
        xhr.progress = 1.0;
      }
      var ints = raw ? xhr.response : new Int8Array(xhr.response);
      cb(ints);
    };
    if (!unmanaged) {
      xhr.onprogress = progress_fetch_file;
      xhr.title = title;
      xhr.progress = 0;
      xhr.total = 0;
      xhr.loaded = 0;
      xhr.lengthComputable = false;
      requests.push(xhr);
    }
    xhr.send();
  };

  var update_countdown = function() {
    file_countdown -= 1;
    if (file_countdown <= 0) {
      loading = false;
      // see archive.js for the mute/unmute button/JS
      if (!($.cookie && $.cookie('unmute'))){
        setTimeout(function(){
          // someone moved it from 1st to 2nd!
          if (DOSBOX && typeof(DOSBOX.sdl_pauseaudio)!='undefined')
            DOSBOX.sdl_pauseaudio(1);
          else if (typeof _SDL_PauseAudio !== "undefined")
            _SDL_PauseAudio(1);
        }, 3000);
      }
    }
  };

  var build_dosbox_arguments = function (config, emulator_start) {
    LOADING_TEXT = 'Building arguments';
    return ['/dosprogram/'+ emulator_start];
  };

  var get_game_name = function (game_path) {
    return game_path.split('/').pop();
  };

  var get_meta_url = function (game_path) {
    var path = game_path.split('/');
    return "//archive.org/cors/"+ path[4] +"/"+ path[4] +"_meta.xml";
  };

  var init_module = function() {
    LOADING_TEXT = 'Parsing config';
    var modulecfg = JSON.parse(moduledata);

    var game_file = null,
        meta_file = null;

    var nr = modulecfg['native_resolution'];

    DOSBOX.width = nr[0] * scale;
    DOSBOX.height = nr[1] * scale;

    Module = {
      arguments: undefined,
      screenIsReadOnly: true,
      print: (function() {
        return function(text) {
          console.log(text);
        };
      })(),
      canvas: canvas,
      noInitialRun: false,
      preInit: function() {
        this.arguments = build_dosbox_arguments(modulecfg,
                                                meta_file.getElementsByTagName("emulator_start")
                                                         .item(0)
                                                         .textContent);
        LOADING_TEXT = 'Loading game file into file system';
        DOSBOX.BFSMountZip(game_file);
        window.clearInterval(drawloadingtimer);
        if (callback) {
          modulecfg.canvas = canvas;
          window.setTimeout(function() { callback(modulecfg); }, 0);
        }
      }
    };

    file_countdown = 2;

    fetch_file('Metadata',
               get_meta_url(game),
               function(data) { meta_file = data; update_countdown(); },
               'document', true);
    fetch_file('Game',
               game,
               function(data) { game_file = data; update_countdown(); });
  };

  var keyevent = function(e) {
    if (typeof(loader_game)=='object') return; // game will start with click-to-play instead of [SPACE] char
    if (e.which == 32) {
      e.preventDefault();
      start();
    }
  };

  var start = function() {
    window.removeEventListener('keypress', keyevent);
    canvas.removeEventListener('click', start);
    loading = true;
    drawloadingtimer = window.setInterval(draw_loading_status, 1000/60);
    if (precallback) {
      window.setTimeout(precallback, 0);
    }
    init_module();
    return this;
  };
  this.start = start;
  window.DOSBOXstart = start;//global hook to method (so can be invoked with a "click to play" image being clicked)

  var drawsplash = function() {
    var context = canvas.getContext('2d');
    splashimg.onload = function(){
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.drawImage(splashimg, canvas.width / 2 - (splashimg.width / 2), canvas.height / 3 - (splashimg.height / 2));
      context.font = '18px sans-serif';
      context.fillStyle = 'Black';
      context.textAlign = 'center';
      context.fillText('Press the SPACEBAR to start.', canvas.width / 2, (canvas.height / 2) + (splashimg.height / 2));
      context.textAlign = 'start';
      context.restore();
    };
    spinnerimg.onload = function() {
      splashimg.src = '/images/dosbox.png';;
    };
    spinnerimg.src = '/images/spinner.png';
  };

  var configLoaded = function (data) {
    moduledata = data;
    window.addEventListener('keypress', keyevent);
    canvas.addEventListener('click', start);
    drawsplash();
  };

  function try_start () {
    if (!can_start()) {
      return;
    }
    has_started = true;
    fetch_file('ModuleInfo', '//archive.org/cors/jsmess_engine_v2/' + module + '.json', configLoaded, 'text', true, true);
  }

  try_start();
}

DOSBOX._readySet = false;

DOSBOX._readyList = [];

DOSBOX._runReadies = function() {
  if (DOSBOX._readyList) {
    for (var r=0; r < DOSBOX._readyList.length; r++) {
      DOSBOX._readyList[r].call(window, []);
    };
    DOSBOX._readyList = [];
  };
};

DOSBOX._readyCheck = function() {
  if (DOSBOX.running) {
    DOSBOX._runReadies();
  } else {
    DOSBOX._readySet = setTimeout(DOSBOX._readyCheck, 10);
  };
};

DOSBOX.ready = function(r) {
  if (DOSBOX.running) {
    r.call(window, []);
  } else {
    DOSBOX._readyList.push(function() { canvas.style.width = DOSBOX.width + 'px'; canvas.style.height = DOSBOX.height + 'px'; } );
    if (!(DOSBOX._readySet)) {
      DOSBOX._readyCheck();
    }
  };
}

DOSBOX.setScale = function() {
  Module.canvas.style.width = DOSBOX.width + 'px';
  Module.canvas.style.height = DOSBOX.height + 'px';
};

DOSBOX.fullScreenChangeHandler = function() {
  if (!(document.mozFullScreenElement || document.fullScreenElement)) {
      setTimeout(DOSBOX.setScale, 0);
  }
};

DOSBOX.BFSMountZip = function BFSMount(loadedData) {
    var zipfs = new BrowserFS.FileSystem.ZipFS(loadedData),
        mfs = new BrowserFS.FileSystem.MountableFileSystem(),
        memfs = new BrowserFS.FileSystem.InMemory();
    mfs.mount('/zip', zipfs);
    mfs.mount('/mem', memfs);
    BrowserFS.initialize(mfs);
    // Copy the read-only zip file contents to a writable in-memory storage.
    this.recursiveCopy('/zip', '/mem');
    // Re-initialize BFS to just use the writable in-memory storage.
    BrowserFS.initialize(memfs);
    // Mount the file system into Emscripten.
    var BFS = new BrowserFS.EmscriptenFS();
    FS.mkdir('/dosprogram');
    FS.mount(BFS, {root: '/'}, '/dosprogram');
};

// Helper function: Recursively copies contents from one folder to another.
DOSBOX.recursiveCopy = function recursiveCopy(oldDir, newDir) {
    var path = BrowserFS.BFSRequire('path'),
        fs = BrowserFS.BFSRequire('fs');
    copyDirectory(oldDir, newDir);
    function copyDirectory(oldDir, newDir) {
        if (!fs.existsSync(newDir)) {
            fs.mkdirSync(newDir);
        }
        fs.readdirSync(oldDir).forEach(function(item) {
            var p = path.resolve(oldDir, item),
                newP = path.resolve(newDir, item);
            if (fs.statSync(p).isDirectory()) {
                copyDirectory(p, newP);
            } else {
                copyFile(p, newP);
            }
        });
    }
    function copyFile(oldFile, newFile) {
        fs.writeFileSync(newFile, fs.readFileSync(oldFile));
    }
};
