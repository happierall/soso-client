import ReconnectingWebsocket from 'reconnecting-websocket'

export default function SoSo( url ) {
  this.url = url
  this.log = true
  this.sock = new ReconnectingWebsocket( url )
  this.onmessage = null
  this.onopen = null
  this.ondirectmsg = null
  this.onclose = null
  this.onerror = null
  this.callbacks = {}
  this.routes = []

  this.sock.onmessage = ( e ) => {
    var resp = JSON.parse( e.data )
    if ( this.onmessage ) {
      this.onmessage( resp )
    }

    if ( resp.other.trans_id ) {
      this.callbacks[ resp.other.trans_id ]( resp )
      delete this.callbacks[ resp.other.trans_id ]
    } else {

      if ( this.ondirectmsg ) {
        this.ondirectmsg( resp )
      }

      for ( var i = 0; i < this.routes.length; i++ ) {
        let route = this.routes[ i ]
        if ( resp.model === route.mode && resp.action == route.action ) {
          route.func( resp )
        }
      }

    }

    if ( this.log ) {

      let time = ""
      if ( resp.other.sent_at ) {
        time = ( new Date().getTime() - resp.other.sent_at ) + "ms"
      }

      let size = getUTF8Size( e.data ) / 1024 // Kilobytes

      console.log( '[CHAN] <- ' +
        resp.model,
        resp.action,
        resp.log.code_str,
        resp.log.user_msg,
        resp.log.level_str,
        time, +size.toFixed( 3 ) + "kb" )

    }
  }
  this.sock.onopen = e => {
    if ( this.onopen ) {
      this.onopen( e )
    }
  }
  this.sock.onclose = e => {
    if ( this.onclose ) {
      this.onclose( e )
    }
  }
  this.sock.onerror = e => {
    if ( this.onerror ) {
      this.onerror( e )
    }
  }

}

SoSo.prototype.handle = function ( model, action, func ) {

  this.routes.push( {
    model,
    action,
    func
  } )

}

SoSo.prototype.request = function ( model, action, data = {},
  other = {}, log = {} ) {
  return new Promise( resolve => {

    other.sent_at = new Date().getTime()
    other.trans_id = uuid()
    this.callbacks[ other.trans_id ] = resolve

    let str_data = JSON.stringify( {
      model,
      action,
      log,
      request,
      other
    } )

    this.sock.send( str_data )

    if ( this.log ) {

      let size = getUTF8Size( str_data ) / 1024 // Kilobytes

      console.log( '[CHAN] ?-> ' +
        model, action, +size.toFixed( 3 ) + "kb" )

    }

  } )
}

SoSo.prototype.send = function ( mode, action, data = {},
  other = {}, log = {} ) {

  let str_data = JSON.stringify( {
    model,
    action,
    data,
    log,
    other
  } )

  this.sock.send( str_data )

  if ( this.log ) {

    let size = getUTF8Size( str_data ) / 1024 // Kilobytes

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
