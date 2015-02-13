var ar = new Array(33,34,35,36,37,38,39,40);

function getfullscreenenabler() {
    return canvas.webkitRequestFullScreen || canvas.mozRequestFullScreen || canvas.requestFullScreen;
}

function isfullscreensupported() {
   return !!(getfullscreenenabler());
}

function gofullscreen() {
  Module.requestFullScreen(1,0);
}

function keypress(e) {
     if (typeof(loader_game)=='object'  &&  !loader_game.started)
         return true; // Don't ignore certain keys yet (until game started by "click to play")
  
     var key = e.which;
     if($.inArray(key,ar) > -1) {
         e.preventDefault(); //Don't let arrow, pg up/down, home, end affect page position
         return false;
     }
     return true;
}

window.onkeydown = keypress;

(function() {
  function get(name) {
    if(typeof(loader_game)=='object')
      return loader_game[name]; //alternate case where dont have CGI args to parse...
    if(name=(new RegExp('[?&]'+encodeURIComponent(name)+'=([^&]*)')).exec(location.search)) {
      return decodeURIComponent(name[1]);
    }
  }

  var games;
  var mess;
  var module;

  function getmodule() {
    module = get('module');
    module = module ? module : 'test';
  }

  function init() {
    getmodule();
    ready();
  }

  function ready() {
    var fullscreenbutton = document.getElementById('gofullscreen')
    if (fullscreenbutton) {
      if (isfullscreensupported()) {
        fullscreenbutton.addEventListener('click', gofullscreen);
        if ('onfullscreenchange' in document) {
          document.addEventListener('fullscreenchange', JSMESS.fullScreenChangeHandler);
        } else if ('onmozfullscreenchange' in document) {
          document.addEventListener('mozfullscreenchange', JSMESS.fullScreenChangeHandler);
        } else if ('onwebkitfullscreenchange' in document) {
          document.addEventListener('webkitfullscreenchange', JSMESS.fullScreenChangeHandler);
        }
      } else {
        fullscreenbutton.disabled = true;
      }
    }
    var canvas = document.getElementById('canvas');
    mess = new JSMESS(canvas)
      .setscale(get('scale') ? parseFloat(get('scale')) : 1)
      .setmodule(module)
    setgame(loader_game);
    if (get('autostart')) {
      mess.start();
    }
    // Gamepad text
    if (detectgamepadsupport()) {
      var gamepadDiv = document.getElementById('gamepadtext');
      gamepadDiv.innerHTML = "No gamepads detected. Press a button on a gamepad to use it.";
      listenforgamepads(function(gamepads, newgamepad) {
        var s = (gamepads.length === 1 ? '' : 's');
        gamepadDiv.innerHTML = gamepads.length + ' gamepad'+s+' detected. If the game does not ' +
                               'respond to your gamepad'+s+', refresh the browser and try again.';
        if (mess.hasStarted) {
          gamepadDiv.innerHTML += "<br />Restart MESS to use new gamepads.";
        }
      });
    }
  }

  function setgame(game) {
    game = (game == 'NONE') ? undefined : game;
    // NOTE: deliberately use cors.archive.org since this will 302 rewrite to iaXXXXX.us.archive.org/XX/items/...
    // and need to keep that "artificial" extra domain-ish name to avoid CORS issues with IE/Safari
    mess.setgame(game ? '//cors.archive.org/cors/'+ game : undefined);
  }

  function switchgame(e) {
    setgame(e.target.value);
  }

  // Firefox will not give us Joystick data unless we register this NOP
  // callback.
  // https://bugzilla.mozilla.org/show_bug.cgi?id=936104
  addEventListener("gamepadconnected", function() {});
  var getgamepads = navigator.getGamepads || navigator.webkitGamepads ||
    navigator.mozGamepads || navigator.gamepads || navigator.webkitGetGamepads;
  /**
   * Does the current browser support the Gamepad API?
   * Returns a boolean.
   */
  function detectgamepadsupport() {
    return typeof getgamepads === 'function';
  }
  // The timer that listens for gamepads, in case we ever want to stop it.
  var gamepadlistener;
  /**
   * Listens for new gamepads, and triggers the callback when it detects a
   * change.
   * The callback is passed an array of active gamepads.
   */
  function listenforgamepads(cb, freq) {
    // NOP if the browser doesn't support gamepads.
    if (!detectgamepadsupport()) return;
    // Map from gamepad id to gamepad information.
    var prevgamepads = {};
    // DEFAULT: Check gamepads every second.
    if (typeof freq === 'undefined') freq = 1000;
    gamepadlistener = setInterval(function() {
      // Browsers get cranky when you don't apply this on the navigator object.
      var gamepads = getgamepads.apply(navigator);
      var currentgamepads = {};
      var i;
      var hasChanged = false;
      for (i = 0; i < gamepads.length; i++) {
        var gamepad = gamepads[i];
        if (gamepad != null) {
          currentgamepads[gamepad.id] = gamepad;
          if (!prevgamepads.hasOwnProperty(gamepad.id)) {
            // Gamepad has been added.
            hasChanged = true;
          }
        }
      }

      // Has a gamepad been removed?
      if (!hasChanged) {
        for (var gamepadid in prevgamepads) {
          if (!currentgamepads.hasOwnProperty(gamepadid)) {
            hasChanged = true;
          }
        }
      }

      prevgamepads = currentgamepads;

      if (hasChanged) {
        // Actual gamepads, filtered from gamepads. Chrome puts empty items into
        // its gamepadlist.
        var actualgamepads = [];
        for (i = 0; i < gamepads.length; i++) {
          if (gamepads[i] != null) actualgamepads.push(gamepads[i]);
        }
        cb(actualgamepads);
      }
    }, freq);
  }

  window.addEventListener('load', init);
})();
