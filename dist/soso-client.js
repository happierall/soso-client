/**
 * SoSo v3.2.0
 * (c) 2016 Ruslan Ianberdin
 * @license MIT
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Soso = factory());
}(this, (function () { 'use strict';

var SoSo = function SoSo( url, disableAutoInit ) {

  this.url = url
  this.log = true
  this.logData = true
  this.onmessage = null
  this.onopen = null
  this.ondirectmsg = null
  this.onclose = null
  this.onerror = null
  this.middleware = new Middleware(this)

  this.sock = null
  this.callbacks = {}
  this.routes = []
  this.connected = false
  this.cache = {
    requests: []
  }

  if ( !disableAutoInit ) {
    this.init()
  }

};

SoSo.prototype.init = function init () {
    var this$1 = this;

  this.sock = new WebSocket(this.url)

  this.sock.onmessage = function (e) {
    var resp = JSON.parse(e.data)

    this$1.middleware.beforeReceiveExecute(resp)

    if (this$1.onmessage) {
      this$1.onmessage(resp)
    }

    if (resp.other.trans_id) {
      this$1.callbacks[resp.other.trans_id](resp)
      delete this$1.callbacks[resp.other.trans_id]
    } else {

      if (this$1.ondirectmsg) {
        this$1.ondirectmsg(resp)
      }

      for (var i = 0; i < this$1.routes.length; i++) {
        var route = this$1.routes[i]
        if (resp.model === route.model && resp.action == route.action) {
          route.func(resp)
        }
      }

    }

    if (this$1.log) {

      var time = ""
      if (resp.other.sent_at) {
        time = (new Date().getTime() - resp.other.sent_at) + "ms"
      }

      console.log('[CHAN] <-- ' +
        resp.model,
        resp.action,
        resp.log.code_str,
        resp.log.user_msg,
        resp.log.level_str,
        time, this$1.logData ? resp : '')

    }
  }

  this.sock.onopen = function (e) {
    if ( this$1.sock.readyState !== 1 ) {
      this$1.connected = false
    } else {
      this$1.connected = true
      this$1._resendOfflineRequests()
    }

    if (this$1.onopen) {
      this$1.onopen(e)
    }
  }

  this.sock.onclose = function (e) {
    this$1.connected = false

    setTimeout( function () {

      if (this$1.log) {
        console.log("[SOSO] trying recconecting")
      }
      this$1.init()

    }, 1000)

    if (this$1.onclose) {
      this$1.onclose(e)
    }
  }

  this.sock.onerror = function (e) {
    if (this$1.onerror) {
      this$1.onerror(e)
    }
  }
};

SoSo.prototype.handle = function handle ( model, action, func ) {

  this.routes.push({
    model: model, action: action, func: func
  })

};

SoSo.prototype.get = function get ( model, data, other, log) {
  return this.request(model, 'get', data, other, log)
};

SoSo.prototype.search = function search ( model, data, other, log) {
  return this.request(model,'search', data, other, log)
};

SoSo.prototype.create = function create ( model, data, other, log) {
  return this.request(model, 'create', data, other, log)
};

SoSo.prototype.update = function update ( model, data, other, log) {
  return this.request(model, 'update', data, other, log)
};

SoSo.prototype.delete = function delete$1 ( model, data, other, log) {
  return this.request(model, 'delete', data, other, log)
};

SoSo.prototype.flush = function flush ( model, data, other, log) {
  return this.request(model, 'flush', data, other, log)
};

SoSo.prototype.request = function request ( model, action, data, other, log ) {
    var this$1 = this;
    if ( data === void 0 ) data = {};
    if ( other === void 0 ) other = {};
    if ( log === void 0 ) log = {};

  return new Promise(function (resolve) {

    other.sent_at = new Date().getTime()
    other.trans_id = uuid()
    this$1.callbacks[other.trans_id] = resolve

    this$1._send( { model: model, action: action, data: data, log: log, other: other } )

  })
};

SoSo.prototype.send = function send ( model, action, data, other, log ) {
    if ( data === void 0 ) data = {};
    if ( other === void 0 ) other = {};
    if ( log === void 0 ) log = {};


  this._send( { model: model, action: action, data: data, log: log, other: other } )

};

SoSo.prototype._send = function _send ( data ) {

  if ( this.connected ) {

    this.middleware.beforeSendExecute( data )

    this.sock.send( JSON.stringify( data ) )

    if (this.log) {
      console.log('[CHAN] -->', data.model, data.action, this.logData ? data : '')
    }

  } else {

    if ( !this.cache.requests.find( function (item) {
      if ( item.action === data.action &&
           item.model === data.model &&
           JSON.stringify(item.data) === JSON.stringify(data.data) ) {
        return true
      } else {
        return false
      }

    } ) ) {

      this.cache.requests.push(data)

    }

  }

};

SoSo.prototype._resendOfflineRequests = function _resendOfflineRequests () {
    var this$1 = this;


  if ( !this.connected ) {return}

  while ( this.cache.requests.length > 0 ) {
    this$1._send( this$1.cache.requests.pop() )
  }

};

// utils
var lut = []
for (var i = 0; i < 256; i++) {
  lut[i] = (i < 16 ? '0' : '') + (i).toString(16)
}

function uuid() {
  var d0 = Math.random() * 0xffffffff | 0
  var d1 = Math.random() * 0xffffffff | 0
  var d2 = Math.random() * 0xffffffff | 0
  var d3 = Math.random() * 0xffffffff | 0
  return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >>
      24 & 0xff] + '-' +
    lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] +
    lut[d1 >> 24 & 0xff] + '-' +
    lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] +
    lut[d2 >> 24 & 0xff] +
    lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 &
      0xff];
}

var Middleware = function Middleware( client ) {
  this.client = client
  this.beforeSendList = [
    /*
    {
      func(resp)
     }
    */
  ]
  this.beforeReceiveList = [
    /*
    {
      func(resp)
     }
    */
  ]
};

Middleware.prototype.beforeSend = function beforeSend ( callback ) {
  this.beforeSendList.push( callback )
};

Middleware.prototype.beforeReceive = function beforeReceive ( callback ) {
  this.beforeReceiveList.push( callback )
};

Middleware.prototype.beforeSendExecute = function beforeSendExecute ( data ) {
  this.beforeSendList.forEach( function ( handler ) {

    handler( data )

  })
};

Middleware.prototype.beforeReceiveExecute = function beforeReceiveExecute ( resp ) {
  this.beforeReceiveList.forEach( function ( handler ) {

    handler( resp )

  })
};

return SoSo;

})));