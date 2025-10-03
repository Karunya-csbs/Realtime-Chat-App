const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const PORT = 3000;

// In-memory storage
let users = {};
let messages = [];

// Load messages from JSON if exists
if (fs.existsSync('data.json')) {
    messages = JSON.parse(fs.readFileSync('data.json', 'utf8'));
}

// Create HTTP server
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './public/index.html';
    else filePath = './public' + req.url;

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Initialize Socket.io
const io = new Server(server);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Send previous messages
    socket.emit('loadMessages', messages);

    // Handle joining
    socket.on('join', (username) => {
        users[socket.id] = { username, online: true };
        io.emit('userList', Object.values(users).map(u => u.username));
        io.emit('message', { user: 'System', text: `${username} joined the chat.` });
    });

    // Handle new message
    socket.on('chatMessage', (msg) => {
        const user = users[socket.id];
        if (!user) return;

        // create unique id for message
        const id = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
        const message = { id, user: user.username, text: msg, timestamp: new Date() };
        messages.push(message);

        // Save messages to JSON for persistence
        fs.writeFileSync('data.json', JSON.stringify(messages, null, 2));

        io.emit('message', message);
    });

    // Handle delete request
    socket.on('deleteMessage', (id) => {
        const user = users[socket.id];
        if (!user) return;

        const idx = messages.findIndex(m => m.id === id);
        if (idx === -1) return;

        const target = messages[idx];
        // only owner can delete their message
        if (target.user !== user.username) return;

        // remove and persist
        messages.splice(idx, 1);
        fs.writeFileSync('data.json', JSON.stringify(messages, null, 2));

        // notify all clients to remove the message
        io.emit('deleteMessage', id);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.emit('message', { user: 'System', text: `${user.username} left the chat.` });
            delete users[socket.id];
            io.emit('userList', Object.values(users).map(u => u.username));
        }
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
