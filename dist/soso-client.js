/**
 * SoSo v3.0.3
 * (c) 2016 Ruslan Ianberdin
 * @license MIT
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Soso = factory());
}(this, (function () { 'use strict';

var isWebSocket = function (constructor) {
    return constructor && constructor.CLOSING === 2;
};
var isGlobalWebSocket = function () {
    return typeof WebSocket !== 'undefined' && isWebSocket(WebSocket);
};
var getDefaultOptions = function () { return ({
    constructor: isGlobalWebSocket() ? WebSocket : null,
    maxReconnectionDelay: 10000,
    minReconnectionDelay: 1500,
    reconnectionDelayGrowFactor: 1.3,
    connectionTimeout: 4000,
    maxRetries: Infinity,
    debug: false,
}); };
var bypassProperty = function (src, dst, name) {
    Object.defineProperty(dst, name, {
        get: function () { return src[name]; },
        set: function (value) { src[name] = value; },
        enumerable: true,
        configurable: true,
    });
};
var initReconnectionDelay = function (config) {
    return (config.minReconnectionDelay + Math.random() * config.minReconnectionDelay);
};
var updateReconnectionDelay = function (config, previousDelay) {
    var newDelay = previousDelay * config.reconnectionDelayGrowFactor;
    return (newDelay > config.maxReconnectionDelay)
        ? config.maxReconnectionDelay
        : newDelay;
};
var LEVEL_0_EVENTS = ['onopen', 'onclose', 'onmessage', 'onerror'];
var reassignEventListeners = function (ws, oldWs, listeners) {
    Object.keys(listeners).forEach(function (type) {
        listeners[type].forEach(function (_a) {
            var listener = _a[0], options = _a[1];
            ws.addEventListener(type, listener, options);
        });
    });
    if (oldWs) {
        LEVEL_0_EVENTS.forEach(function (name) { ws[name] = oldWs[name]; });
    }
};
var ReconnectingWebsocket = function (url, protocols, options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    var ws;
    var connectingTimeout;
    var reconnectDelay = 0;
    var retriesCount = 0;
    var shouldRetry = true;
    var savedOnClose = null;
    var listeners = {};
    // require new to construct
    if (!(this instanceof ReconnectingWebsocket)) {
        throw new TypeError("Failed to construct 'ReconnectingWebSocket': Please use the 'new' operator");
    }
    // Set config. Not using `Object.assign` because of IE11
    var config = getDefaultOptions();
    Object.keys(config)
        .filter(function (key) { return options.hasOwnProperty(key); })
        .forEach(function (key) { return config[key] = options[key]; });
    if (!isWebSocket(config.constructor)) {
        throw new TypeError('Invalid WebSocket constructor. Set `options.constructor`');
    }
    var log = config.debug ? function () {
        var arguments$1 = arguments;

        var params = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            params[_i - 0] = arguments$1[_i];
        }
        return console.log.apply(console, ['RWS:'].concat(params));
    } : function () { };
    /**
     * Not using dispatchEvent, otherwise we must use a DOM Event object
     * Deferred because we want to handle the close event before this
     */
    var emitError = function (code, msg) { return setTimeout(function () {
        var err = new Error(msg);
        err.code = code;
        if (Array.isArray(listeners.error)) {
            listeners.error.forEach(function (_a) {
                var fn = _a[0];
                return fn(err);
            });
        }
        if (ws.onerror) {
            ws.onerror(err);
        }
    }, 0); };
    var handleClose = function () {
        log('close');
        retriesCount++;
        log('retries count:', retriesCount);
        if (retriesCount > config.maxRetries) {
            emitError('EHOSTDOWN', 'Too many failed connection attempts');
            return;
        }
        if (!reconnectDelay) {
            reconnectDelay = initReconnectionDelay(config);
        }
        else {
            reconnectDelay = updateReconnectionDelay(config, reconnectDelay);
        }
        log('reconnectDelay:', reconnectDelay);
        if (shouldRetry) {
            setTimeout(connect, reconnectDelay);
        }
    };
    var connect = function () {
        log('connect');
        var oldWs = ws;
        ws = new config.constructor(url, protocols);
        connectingTimeout = setTimeout(function () {
            log('timeout');
            ws.close();
            emitError('ETIMEDOUT', 'Connection timeout');
        }, config.connectionTimeout);
        log('bypass properties');
        for (var key in ws) {
            // @todo move to constant
            if (['addEventListener', 'removeEventListener', 'close', 'send'].indexOf(key) < 0) {
                bypassProperty(ws, _this, key);
            }
        }
        ws.addEventListener('open', function () {
            clearTimeout(connectingTimeout);
            log('open');
            reconnectDelay = initReconnectionDelay(config);
            log('reconnectDelay:', reconnectDelay);
            retriesCount = 0;
        });
        ws.addEventListener('close', handleClose);
        reassignEventListeners(ws, oldWs, listeners);
        // because when closing with fastClose=true, it is saved and set to null to avoid double calls
        ws.onclose = ws.onclose || savedOnClose;
        savedOnClose = null;
    };
    log('init');
    connect();
    this.close = function (code, reason, _a) {
        if (code === void 0) { code = 1000; }
        if (reason === void 0) { reason = ''; }
        var _b = _a === void 0 ? {} : _a, _c = _b.keepClosed, keepClosed = _c === void 0 ? false : _c, _d = _b.fastClose, fastClose = _d === void 0 ? true : _d, _e = _b.delay, delay = _e === void 0 ? 0 : _e;
        if (delay) {
            reconnectDelay = delay;
        }
        shouldRetry = !keepClosed;
        ws.close(code, reason);
        if (fastClose) {
            var fakeCloseEvent_1 = {
                code: code,
                reason: reason,
                wasClean: true,
            };
            // execute close listeners soon with a fake closeEvent
            // and remove them from the WS instance so they
            // don't get fired on the real close.
            handleClose();
            ws.removeEventListener('close', handleClose);
            // run and remove level2
            if (Array.isArray(listeners.close)) {
                listeners.close.forEach(function (_a) {
                    var listener = _a[0], options = _a[1];
                    listener(fakeCloseEvent_1);
                    ws.removeEventListener('close', listener, options);
                });
            }
            // run and remove level0
            if (ws.onclose) {
                savedOnClose = ws.onclose;
                ws.onclose(fakeCloseEvent_1);
                ws.onclose = null;
            }
        }
    };
    this.send = function (data) {
        ws.send(data);
    };
    this.addEventListener = function (type, listener, options) {
        if (Array.isArray(listeners[type])) {
            if (!listeners[type].some(function (_a) {
                var l = _a[0];
                return l === listener;
            })) {
                listeners[type].push([listener, options]);
            }
        }
        else {
            listeners[type] = [[listener, options]];
        }
        ws.addEventListener(type, listener, options);
    };
    this.removeEventListener = function (type, listener, options) {
        if (Array.isArray(listeners[type])) {
            listeners[type] = listeners[type].filter(function (_a) {
                var l = _a[0];
                return l !== listener;
            });
        }
        ws.removeEventListener(type, listener, options);
    };
};
var index = ReconnectingWebsocket;

function SoSo( url ) {
  var this$1 = this;

  this.url = url
  this.log = true
  this.sock = new index( url )
  this.onmessage = null
  this.onopen = null
  this.ondirectmsg = null
  this.onclose = null
  this.onerror = null
  this.callbacks = {}
  this.routes = []

  this.sock.onmessage = function ( e ) {
    var resp = JSON.parse( e.data )
    if ( this$1.onmessage ) {
      this$1.onmessage( resp )
    }

    if ( resp.other.trans_id ) {
      this$1.callbacks[ resp.other.trans_id ]( resp )
      delete this$1.callbacks[ resp.other.trans_id ]
    } else {

      if ( this$1.ondirectmsg ) {
        this$1.ondirectmsg( resp )
      }

      for ( var i = 0; i < this$1.routes.length; i++ ) {
        var route = this$1.routes[ i ]
        if ( resp.model === route.mode && resp.action == route.action ) {
          route.func( resp )
        }
      }

    }

    if ( this$1.log ) {

      var time = ""
      if ( resp.other.sent_at ) {
        time = ( new Date().getTime() - resp.other.sent_at ) + "ms"
      }

      var size = getUTF8Size( e.data ) / 1024 // Kilobytes

      console.log( '[CHAN] <- ' +
        resp.model,
        resp.action,
        resp.log.code_str,
        resp.log.user_msg,
        resp.log.level_str,
        time, +size.toFixed( 3 ) + "kb" )

    }
  }
  this.sock.onopen = function (e) {
    if ( this$1.onopen ) {
      this$1.onopen( e )
    }
  }
  this.sock.onclose = function (e) {
    if ( this$1.onclose ) {
      this$1.onclose( e )
    }
  }
  this.sock.onerror = function (e) {
    if ( this$1.onerror ) {
      this$1.onerror( e )
    }
  }

}

SoSo.prototype.handle = function ( model, action, func ) {

  this.routes.push( {
    model: model,
    action: action,
    func: func
  } )

}

SoSo.prototype.request = function ( model, action, data,
  other, log ) {
  var this$1 = this;
  if ( data === void 0 ) data = {};
  if ( other === void 0 ) other = {};
  if ( log === void 0 ) log = {};

  return new Promise( function (resolve) {

    other.sent_at = new Date().getTime()
    other.trans_id = uuid()
    this$1.callbacks[ other.trans_id ] = resolve

    var str_data = JSON.stringify( {
      model: model,
      action: action,
      data: data,
      log: log,
      other: other
    } )

    this$1.sock.send( str_data )

    if ( this$1.log ) {

      var size = getUTF8Size( str_data ) / 1024 // Kilobytes

      console.log( '[CHAN] ?-> ' +
        model, action, +size.toFixed( 3 ) + "kb" )

    }

  } )
}

SoSo.prototype.send = function ( mode, action, data,
  other, log ) {
  if ( data === void 0 ) data = {};
  if ( other === void 0 ) other = {};
  if ( log === void 0 ) log = {};


  var str_data = JSON.stringify( {
    model: model,
    action: action,
    data: data,
    log: log,
    other: other
  } )

  this.sock.send( str_data )

  if ( this.log ) {

    var size = getUTF8Size( str_data ) / 1024 // Kilobytes

    console.log( '[CHAN] -> ' +
      model,
      action, +size.toFixed( 3 ) + "kb" )

  }

}

// utils
var lut = []
for ( var i = 0; i < 256; i++ ) {
  lut[ i ] = ( i < 16 ? '0' : '' ) + ( i ).toString( 16 )
}

function uuid() {
  var d0 = Math.random() * 0xffffffff | 0
  var d1 = Math.random() * 0xffffffff | 0
  var d2 = Math.random() * 0xffffffff | 0
  var d3 = Math.random() * 0xffffffff | 0
  return lut[ d0 & 0xff ] + lut[ d0 >> 8 & 0xff ] + lut[ d0 >> 16 & 0xff ] + lut[ d0 >>
      24 & 0xff ] + '-' +
    lut[ d1 & 0xff ] + lut[ d1 >> 8 & 0xff ] + '-' + lut[ d1 >> 16 & 0x0f | 0x40 ] +
    lut[ d1 >> 24 & 0xff ] + '-' +
    lut[ d2 & 0x3f | 0x80 ] + lut[ d2 >> 8 & 0xff ] + '-' + lut[ d2 >> 16 & 0xff ] +
    lut[ d2 >> 24 & 0xff ] +
    lut[ d3 & 0xff ] + lut[ d3 >> 8 & 0xff ] + lut[ d3 >> 16 & 0xff ] + lut[ d3 >> 24 &
      0xff ];
}

function getUTF8Size( str ) {
  return str.split( '' )
    .map( function ( ch ) {
      return ch.charCodeAt( 0 )
    } ).map( function ( uchar ) {
      // The reason for this is explained later in
      // the section “An Aside on Text Encodings”
      return uchar < 128 ? 1 : 2
    } ).reduce( function ( curr, next ) {
      return curr + next
    } )
}

return SoSo;

})));