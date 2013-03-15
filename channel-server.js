var app = require('http').createServer(handler)
  , io = require('socket.io').listen(app)
  , fs = require('fs')
    
app.listen(80);    

function handler (req, res) {
  fs.readFile(__dirname + '/chat.html',
      function (err, data) {
	if (err) {
	  res.writeHead(500);
	  return res.end('Error loading chat.html');
	}

	res.writeHead(200);
	res.end(data);
      });
}

io.sockets.on('connection', function (socket) {
  
  socket.on('join', function (room) {
    if (Array.isArray(room)) {
      var i;
      for (i = 0; i < room.length; ++i) {
	console.log('join room ' + room[i]);
	socket.join(room[i]);
      }
    } else if (typeof room === 'string') {
      console.log('join room ' + room);
      socket.join(room);
    }
  });

  socket.on('leave', function (room) {
    if (typeof room === 'string') {
      console.log('leave room ' + room);
      socket.leave(room);
    }
  });

  socket.on('post', function (data) {
    io.sockets.in(data.room).emit('publish', data);
  });

});
