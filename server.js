if (process.env.APP_STATE === 'PROD') console.log = function() {}
const PORT = process.env.PORT || 8081;
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
	maxHttpBufferSize: 5e7,	//50MB
	connectionStateRecovery: {
		maxDisconnectionDuration: 2 * 60 * 1000,
		skipMiddlewares: true,
	}
});

app.use(express.static('public'));

const users = [];

function findUser(socketID = socket.id){
	return users[users.findIndex((obj) => {return obj.id == socketID})];
}

io.on('connection', socket => {
	socket.on('new-user', userData => {
		if (!findUser(socket.id)){
			let user = { name: userData.name, id: socket.id, connectionTime: userData.connectionTime };
			users.push(user);
			socket.broadcast.emit('user-connected', userData.name);
			io.sockets.emit('usersList', users);
			console.log(`${userData.name} connected`);
		}
	});
	socket.on('req-users', () => {
		io.to(socket.id).emit('usersList', users);
	});
	socket.on('send-chat-message', ({ messageBody, timeStamp }) => {
		const user = findUser(socket.id);
		if (user) socket.broadcast.emit('chat-message', { senderName: user.name, senderID: socket.id, messageBody, timeStamp });
	});
	socket.on('send-file', async ({ appendType, fileType, fileName, payload, timeStamp }) => {
		const user = findUser(socket.id);
		if (user){
			if (appendType == 'inlineMedia') await socket.broadcast.emit('inline-media', { senderName: user.name, senderID: socket.id, fileType, payload, timeStamp });
			else await socket.broadcast.emit('file', { senderName: user.name, senderID: socket.id, fileType, fileName, payload, timeStamp });
		}
	});
	socket.on('send-call-request', ({ peerID, callType, timeStamp }) => {
		const user = findUser(socket.id);
		if (user) socket.broadcast.emit('call-request', { senderName: user.name, senderID: socket.id, peerID, callType, timeStamp });
	});
	socket.on('send-end-call', ({ socketID }) => {
		if (findUser(socketID)) socket.to(socketID).emit('end-call');
	});
	socket.on('disconnect', () => {
		const userIndex = users.findIndex((obj) => {return obj.id == socket.id});
		if (users[userIndex]){
			socket.broadcast.emit('user-disconnected', users[userIndex]);
			console.log(`${users[userIndex].name} disconnected`);
			users.splice(userIndex, 1);
			io.sockets.emit('usersList', users);
		}
	});
})

server.listen(PORT, () => {
	console.log("Listening on " + PORT);
});