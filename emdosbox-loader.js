var Module = null;

function DOSBOX(canvas, module, game, precallback, callback, scale) {
  var js_data;
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
      var headID = document.getElementsByTagName('head')[0];
      var newScript = document.createElement('script');
      newScript.type = 'text/javascript';
      newScript.text = js_data;
      headID.appendChild(newScript);

      // see archive.js for the mute/unmute button/JS
      if (!($.cookie && $.cookie('unmute'))){
        setTimeout(function(){
          // someone moved it from 1st to 2nd!
          if (DOSBOX && typeof(DOSBOX.sdl_pauseaudio)!='undefined')
            DOSBOX.sdl_pauseaudio(1);
          else if (_SDL_PauseAudio)
            _SDL_PauseAudio(1);
        }, 3000); 
      }
    }
  };

  var build_mess_arguments = function (config) {
    LOADING_TEXT = 'Building arguments';
    var nr = config['native_resolution'];
    // see archive.js for the mute/unmute button/JS
    var muted = (!(typeof($.cookie)!='undefined'  &&  $.cookie('unmute')));    

    var args = [
      config['driver'],
      '-verbose',
      '-rompath','.',
      '-window',
      '-resolution', nr[0]+'x' + nr[1],
      '-nokeepaspect'
    ];

    if (config.autoboot) {
      args.push('-autoboot_command');
    }

    if (muted){
      args.push('-sound', 'none');
    } else if (SAMPLE_RATE) {
      args.push('-samplerate', SAMPLE_RATE);
    }
    
    if (game) {
      args.push('-' + config['peripherals'][0], game.replace(/\//g,'_'));
    }

    if (config['extra_args']) {
      args = args.concat(config['extra_args']);
    }

    return args;
  };

  var build_mame_arguments = function (config) {
    LOADING_TEXT = 'Building arguments';
    var nr = config['native_resolution'];
    // see archive.js for the mute/unmute button/JS
    var muted = (!(typeof($.cookie)!='undefined'  &&  $.cookie('unmute')));    

    var args = [
      config['driver'],
      '-verbose',
      '-rompath','.',
      '-window',
      '-resolution', nr[0]+'x' + nr[1],
      '-nokeepaspect'
    ];

    if (muted){
      args.push('-sound', 'none');
    } else if (SAMPLE_RATE) {
      args.push('-samplerate', SAMPLE_RATE);
    }

    if (config['extra_args']) {
      args = args.concat(config['extra_args']);
    }

    return args;
  };
  
  var get_game_name = function (game_path) {
    return game_path.split('/').pop();
  };

  var init_module = function() {
    LOADING_TEXT = 'Parsing config';
    var modulecfg = JSON.parse(moduledata);

    var game_file = null;
    var keymap    = null;

    var nr = modulecfg['native_resolution'];

    DOSBOX.width = nr[0] * scale;
    DOSBOX.height = nr[1] * scale;

    var use_mame = true;
    var arguments;

    if (use_mame) {
      arguments = build_mame_arguments(modulecfg);
    } else {
      arguments = build_mess_arguments(modulecfg);
    }

    Module = {
      arguments: arguments,
      screenIsReadOnly: true,
      print: (function() {
        return function(text) {
          console.log(text);
        };
      })(),
      canvas: canvas,
      noInitialRun: false,
      preInit: function() {
        LOADING_TEXT = 'Loading binary files into file system';
        // Load the downloaded binary files into the filesystem.
        if (game && !use_mame) {
            LOADING_TEXT = 'Loading game file into file system';
            Module['FS_createDataFile']('/', game.replace(/\//g,'_'), game_file, true, true);
        }
        Module['FS_createFolder']('/', 'cfg', true, true);
        Module['FS_createDataFile']('/cfg', modulecfg['driver'] + '.cfg', keymap, true, true);
        window.clearInterval(drawloadingtimer);        
        if (callback) {
          modulecfg.canvas = canvas;
          window.setTimeout(function() { callback(modulecfg); }, 0);
        }
      }
    };

    file_countdown = (game ? 1 : 0) + 2;

    if (game && !use_mame) {
      fetch_file('Game',
                 game,
                 function(data) { game_file = data; update_countdown(); });
    }

    fetch_file('Keymap',
               '//archive.org/cors/jsmess_config_v2/' + modulecfg['driver'] + '.cfg',
               function(data) { keymap = data; update_countdown(); },
               'text', true, true);
    fetch_file('Javascript',
               '//archive.org/cors/jsmess_engine_v2/' + modulecfg['js_filename'],
               function(data) { js_data = data; update_countdown(); },
               'text', true);
    
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
      window.setTimeout(function() {precallback()}, 0);
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
}
