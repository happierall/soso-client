# Soso client
## Comfortable, fast, bidirectional protocol over websocket instead REST

[soso-server](https://github.com/happierall/soso-server)

###Install
```
  npm install --save soso-client

  // or use in browser with rawgit

  https://cdn.rawgit.com/happierall/soso-client/master/dist/soso-client.min.js
```

###Usage
```Javascript
  import Soso from 'soso-client'

  var soso = new Soso("ws://localhost:4000/soso")

  // Request
  soso.onopen = () => {

    soso.request("user", "retrieve", { id: 1 }).then(data => {
      console.log(data.response_map)
    })

  }

  // Just send
  soso.send("post", "like", { post_id: 5 })

  // Handle request from Server
  soso.handle("user", "CREATED", data => {
    console.log(data)
  })
```

```Javascript
  //Events
  soso.onopen = (e) => {}
  soso.onclose = (e) => {}
  soso.onmessage = (data) => {}
  soso.ondirectmsg = (data) => {}
  soso.onerror = (e) => {}

```

```Javascript
  // Disabled logs
  soso.log = false // Default true
```
