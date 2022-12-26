const socket = io();

socket.on('error', function(message) {
    alert(message);
});
socket.on('success', function(message) {
    window.location.href = `/chat.html?username=${message.username}&room=${message.room}`
});

socket.on('register', function(message) {
    alert(message);
});

function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    socket.emit('login', { username, password });
}

function register() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    socket.emit('register', { username, password });
}
