export default class SoSo {
  constructor( url, disableAutoInit ) {

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

  }

  init() {
    this.sock = new WebSocket(this.url)

    this.sock.onmessage = (e) => {
      var resp = JSON.parse(e.data)

      this.middleware.beforeReceiveExecute(resp)

      if (this.onmessage) {
        this.onmessage(resp)
      }

      if (resp.other.trans_id) {
        this.callbacks[resp.other.trans_id](resp)
        delete this.callbacks[resp.other.trans_id]
      } else {

        if (this.ondirectmsg) {
          this.ondirectmsg(resp)
        }

        for (var i = 0; i < this.routes.length; i++) {
          let route = this.routes[i]
          if (resp.model === route.model && resp.action == route.action) {
            route.func(resp)
          }
        }

      }

      if (this.log) {

        let time = ""
        if (resp.other.sent_at) {
          time = (new Date().getTime() - resp.other.sent_at) + "ms"
        }

        console.log('[CHAN] <-- ' +
          resp.model,
          resp.action,
          resp.log.code_str,
          resp.log.user_msg,
          resp.log.level_str,
          time, this.logData ? resp : '')

      }
    }

    this.sock.onopen = e => {
      if ( this.sock.readyState !== 1 ) {
        this.connected = false
      } else {
        this.connected = true
        this._resendOfflineRequests()
      }

      if (this.onopen) {
        this.onopen(e)
      }
    }

    this.sock.onclose = e => {
      this.connected = false

      setTimeout( () => {

        if (this.log) {
          console.log("[SOSO] trying recconecting")
        }
        this.init()

      }, 1000)

      if (this.onclose) {
        this.onclose(e)
      }
    }

    this.sock.onerror = e => {
      if (this.onerror) {
        this.onerror(e)
      }
    }
  }

  handle( model, action, func ) {

    this.routes.push({
      model, action, func
    })

  }

  get( model, data, other, log) {
    return this.request(model, 'get', data, other, log)
  }

  search( model, data, other, log) {
    return this.request(model,'search', data, other, log)
  }

  create( model, data, other, log) {
    return this.request(model, 'create', data, other, log)
  }

  update( model, data, other, log) {
    return this.request(model, 'update', data, other, log)
  }

  delete( model, data, other, log) {
    return this.request(model, 'delete', data, other, log)
  }

  flush( model, data, other, log) {
    return this.request(model, 'flush', data, other, log)
  }

  request( model, action, data = {}, other = {}, log = {} ) {
    return new Promise(resolve => {

      other.sent_at = new Date().getTime()
      other.trans_id = uuid()
      this.callbacks[other.trans_id] = resolve

      this._send( { model, action, data, log, other } )

    })
  }

  send( model, action, data = {}, other = {}, log = {} ) {

    this._send( { model, action, data, log, other } )

  }

  _send( data ) {

    if ( this.connected ) {

      this.middleware.beforeSendExecute( data )

      this.sock.send( JSON.stringify( data ) )

      if (this.log) {
        console.log('[CHAN] -->', data.model, data.action, this.logData ? data : '')
      }

    } else {

      if ( !this.cache.requests.find( item => {
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

  }

  _resendOfflineRequests() {

    if ( !this.connected ) {return}

    while ( this.cache.requests.length > 0 ) {
      this._send( this.cache.requests.pop() )
    }

  }

}


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

class Middleware {
  constructor( client ) {
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
  }

  beforeSend( callback ) {
    this.beforeSendList.push( callback )
  }

  beforeReceive( callback ) {
    this.beforeReceiveList.push( callback )
  }

  beforeSendExecute( data ) {
    this.beforeSendList.forEach( ( handler ) => {

      handler( data )

    })
  }

  beforeReceiveExecute( resp ) {
    this.beforeReceiveList.forEach( ( handler ) => {

      handler( resp )

    })
  }

}