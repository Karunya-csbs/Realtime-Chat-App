const socket = io();

const messagesUl = document.getElementById('messages');
const userListUl = document.getElementById('user-list');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usernameInput = document.getElementById('username');
const joinBtn = document.getElementById('join-btn');

let username = '';

// Join via button or Enter
joinBtn.addEventListener('click', tryJoin);
usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryJoin();
});

function tryJoin() {
    const name = usernameInput.value.trim();
    if (!name) return;
    username = name;
    socket.emit('join', username);
    usernameInput.disabled = true;
    joinBtn.disabled = true;
    sendBtn.disabled = false;
    messageInput.focus();
}

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const msg = messageInput.value.trim();
    if (!msg || !username) return;
    socket.emit('chatMessage', msg);
    messageInput.value = '';
}

// Load previous messages
socket.on('loadMessages', (msgs) => {
    messagesUl.innerHTML = '';
    // ensure chronological order (oldest first)
    msgs.forEach(msg => appendMessage(msg));
    messagesUl.scrollTop = messagesUl.scrollHeight;
});

// Receive messages
socket.on('message', (msg) => {
    appendMessage(msg);
});

// Receive delete notifications
socket.on('deleteMessage', (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) el.remove();
});

// Update user list
socket.on('userList', (users) => {
    userListUl.innerHTML = '';
    users.forEach(u => {
        const li = document.createElement('li');
        li.textContent = u;
        userListUl.appendChild(li);
    });
});

function nameToColor(name) {
    // simple hash -> H value
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const h = Math.abs(hash) % 360;
    return `hsl(${h} 70% 45%)`;
}

function initials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] || '').toUpperCase() + (parts[1] ? parts[1][0].toUpperCase() : '');
}

function appendMessage(msg) {
    const li = document.createElement('li');
    li.id = `msg-${msg.id || ''}`; // id will exist for saved messages
    const wrapper = document.createElement('div');
    wrapper.className = 'message slide-in';

    const isSystem = msg.user === 'System';
    const isOwn = msg.user === username;

    if (isSystem) {
        wrapper.classList.add('system');
        wrapper.textContent = msg.text;
    } else {
        if (isOwn) wrapper.classList.add('own');

        // avatar
        const av = document.createElement('div');
        av.className = 'avatar';
        av.textContent = initials(msg.user);
        av.style.background = nameToColor(msg.user);
        wrapper.appendChild(av);

        const content = document.createElement('div');
        content.className = 'content';

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = msg.user;
        content.appendChild(meta);

        const text = document.createElement('div');
        text.textContent = msg.text;
        content.appendChild(text);

        const time = document.createElement('span');
        time.className = 'time';
        const t = msg.timestamp ? new Date(msg.timestamp) : new Date();
        time.textContent = t.toLocaleString();
        content.appendChild(time);

        wrapper.appendChild(content);

        // delete button (own messages)
        if (isOwn && msg.id) {
            const del = document.createElement('button');
            del.className = 'delete-btn';
            del.title = 'Delete message';
            del.textContent = 'Delete';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                socket.emit('deleteMessage', msg.id);
            });
            wrapper.appendChild(del);
        }
    }

    li.appendChild(wrapper);
    messagesUl.appendChild(li);
    messagesUl.scrollTop = messagesUl.scrollHeight;

    // optional: remove slide-in class after animation to avoid stacking styles
    setTimeout(() => wrapper.classList.remove('slide-in'), 400);
}
