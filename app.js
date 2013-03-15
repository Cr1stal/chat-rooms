var httpd = require('http').createServer(handler);
var io = require('socket.io').listen(httpd);
var fs = require('fs');
var room_number = 1;
var port = process.env.PORT | 8080;
httpd.listen(port);

function handler(req, res) {
  fs.readFile(__dirname + '/index.html',
      function(err,data) {
	if(err){
	  res.writeHead(500);
	  return res.end('Error loading index.html');
	}
	res.writeHead(200);
	res.end(data);
      });
}

// usernames which are currently connected to the chat
var usernames = {};

Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

function room (caption, current_person_size, max_person_size) {
  this.caption = caption;
  this.current_person_size = typeof current_person_size !== 'undefined' ? current_person_size : 0;
  this.max_person_size = typeof max_person_size !== 'undefined' ? max_person_size : 30;
  this.usernames = [];

  this.changeCaption = changeCaption;
  function changeCaption (caption) {
    this.caption = caption;
  }

  this.incrementPersonCount = incrementPersonCount;
  function incrementPersonCount () {
    this.current_person_size += 1;
  }

  this.decrementPersonCount = decrementPersonCount;
  function decrementPersonCount () {
    this.current_person_size -= 1;
  }

  this.is_available = is_available;
  function is_available () {
    return this.current_person_size < this.max_person_size;
  }

  this.addUsername = addUsername;
  function addUsername (username) {
    this.usernames.push(username);
  }

  this.deleteUsername = deleteUsername;
  function deleteUsername(username) {
    this.usernames.remove(this.usernames.indexOf(username));
  }
}

var room1 = new room("Природа");
var room2 = new room("Машины");
var room3 = new room("Небо");

// rooms which are currently available in chat
var rooms = [room1, room2, room3];

io.sockets.on('connection', function (socket) {

  socket.on('listroom', function () {
    socket.emit('listroom', rooms);
  });

  socket.on('new-room', function (caption) {
    rooms.push(new room(caption));
  });

  socket.on('userlist', function () {
    socket.emit('userlist', socket.room.usernames);
  });

  socket.on('canconnect', function (room_caption) {
    var roomd = new room("default");
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].caption == room_caption) {
	roomd = rooms[i];
	break;
      } 
    }
    socket.emit('canconnect', roomd.current_person_size < roomd.max_person_size);
  });

  // when the client emits 'adduser', this listens and executes
  socket.on('adduser', function(username, room_caption){
    // store the username in the socket session for this client
    socket.username = username;
    // store the room name in the socket session for this client
    var roomd = new room("default");
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].caption == room_caption) {
	roomd = rooms[i];
	break;
      } 
    }
    socket.room = roomd;
    socket.room.incrementPersonCount();
    socket.room.addUsername(username);
    // add the client's username to the global list
    usernames[username] = username;
    // send client to room 1
    socket.join(socket.room.caption);
    // echo to client they've connected
    socket.emit('updatechat', 'SERVER', 'вы присоединились к комнате ' + socket.room.caption);
    // echo to room 1 that a person has connected to their room
    socket.broadcast.to(socket.room.caption).emit('updatechat', 'SERVER', username + ' присоединился к этой комнате');
    io.sockets.in(socket.room.caption).emit('userlist', socket.room.usernames);
  });

  // when the client emits 'sendchat', this listens and executes
  socket.on('sendchat', function (data) {
    // we tell the client to execute 'updatechat' with 2 parameters
    io.sockets.in(socket.room.caption).emit('updatechat', socket.username, data);
  });

  socket.on('switchRoom', function(newroom){
    socket.leave(socket.room.caption);
    socket.room.deleteUsername(socket.username);
    socket.room.decrementPersonCount();
    io.sockets.in(socket.room.caption).emit('userlist', socket.room.usernames);
    socket.join(newroom);
    var roomd = new room("default");
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].caption == newroom) {
	roomd = rooms[i];
	break;
      } 
    }

    socket.emit('updatechat', 'SERVER', 'вы присоединились к комнате '+ newroom);
    // sent message to OLD room
    socket.broadcast.to(socket.room.caption).emit('updatechat', 'SERVER', socket.username+' вышел.');
    // update socket session room title
    socket.room = roomd;
    socket.room.incrementPersonCount();
    socket.room.addUsername(socket.username);
    io.sockets.in(socket.room.caption).emit('userlist', socket.room.usernames);
    socket.broadcast.to(socket.room.caption).emit('updatechat', 'SERVER', socket.username+' присоединился.');
  });


  // when the user disconnects.. perform this
  socket.on('disconnect', function(){
    if (socket.room != undefined) {
      // remove the username from global usernames list
      delete usernames[socket.username];
      // update list of users in chat, client-side
      io.sockets.emit('updateusers', usernames);
      // echo globally that this client has left
      socket.broadcast.emit('updatechat', 'SERVER', socket.username + ' вышел');
      socket.room.deleteUsername(socket.username);
      socket.room.decrementPersonCount();
      io.sockets.in(socket.room.caption).emit('userlist', socket.room.usernames);
      caption = socket.room.caption;
      socket.leave(caption);
    }
  });
});
