const ws = require('nodejs-websocket')

var options = {
  host: '192.168.1.132'
}

var artnet = require('artnet')(options);

const [, , _port] = process.argv
const port = _port || 3000

console.log('modv-integration', '|', 'WebSocket server on port', port)

/*
 * Find the color in the "middle" which can be mapped to the cyberpunk goggles regardless how big
 * the selected area in grab-canvas is
 */
const centerColor = dmxData => {
  const { colors } = dmxData
  let { selectionX } = dmxData
  let centerIndex = 0
  selectionX = parseInt(selectionX, 10)

  // Even number
  if (selectionX % 2 === 0) {
    centerIndex = Math.floor((colors.length / 3 + selectionX) / 2)
  } else { 
    centerIndex = Math.floor(colors.length / 3 / 2)
  }

  centerIndex *= 3
  const color = [colors[centerIndex], colors[centerIndex + 1], colors[centerIndex + 2]]

  return color
}


/*
 * Create a WebSocket server
 */
 const server = ws.createServer(connection => {

    console.log('modv-integration', '|', 'New connection by', connection.path)

    // Receive data
    connection.on('text', dmxData => {
      dmxData = JSON.parse(dmxData)

      const colorsLength = dmxData.colors.length;
      for(let i=0; i < colorsLength; i+=3) {
        const r = dmxData.colors[i];
        const g = dmxData.colors[i+1];
        const b = dmxData.colors[i+2];


        artnet.set(0, i+1, [r,g,b]);
      }

      // Broadcast to all connected clients
      server.connections.forEach(con => {

        if (con.readyState !== con.OPEN) {
          return
        }

        // The client connection came from luminave
        if (con.path === '/luminave') {
          con.sendText(JSON.stringify(dmxData))
        }

        // The client connection came from cyberpunk goggles
        if (con.path === '/cyberpunk') {
          // con.sendBinary(Uint8Array.from(centerColor(dmxData)))
          // artnet.set(0, 0, ...centerColor(dmxData));
        }
      })
    })

    /*
     * WebSocket Close Codes: https://www.iana.org/assignments/websocket/websocket.xml#close-code-number
     */
    connection.on('close', code => {
      console.log('modv-integration', '|', 'Connection closed by', connection.path, 'with code', code)
    })

    connection.on('error', error => {
      console.log('modv-integration', '|', 'Error by', connection.path, 'with code', error.code)

      if (error.code === 'EHOSTDOWN' || error.code === 'ETIMEDOUT' || error.code === 'EPIPE') {
        return
      }

      // Ignore ECONNRESET and re throw anything else
      if (error.code !== 'ECONNRESET') {
        throw error
      }
    })
}).listen(port, '0.0.0.0')
