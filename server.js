const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let users = {};          
let histories = {};      
let questionsWeb = [];
let reponsesHumain = [];

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nia AI</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
        body { background-color: #f7f7f8; color: #353740; height: 100vh; display: flex; }
        
        #auth-screen { position: fixed; inset: 0; background: #ffffff; display: flex; justify-content: center; align-items: center; z-index: 100; }
        .auth-box { background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #e5e5e5; width: 100%; max-width: 360px; text-align: center; }
        .auth-box h2 { margin-bottom: 20px; font-size: 1.5rem; }
        .auth-box input { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #d9d9e3; border-radius: 8px; outline: none; }
        .auth-box button { width: 100%; padding: 12px; background: #10a37f; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-bottom: 10px; }
        .toggle-link { font-size: 0.85rem; color: #10a37f; cursor: pointer; text-decoration: underline; }

        #app-screen { display: none; width: 100%; height: 100%; flex-direction: row; }
        .sidebar { width: 260px; background: #f0f0f0; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; padding: 12px; }
        .btn-new-chat { background: #ffffff; border: 1px solid #d9d9e3; padding: 10px; border-radius: 8px; cursor: pointer; font-weight: 500; margin-bottom: 15px; }
        .chat-list { flex: 1; overflow-y: auto; }
        .chat-item { padding: 10px; border-radius: 6px; cursor: pointer; font-size: 0.88rem; margin-bottom: 4px; }
        .chat-item:hover, .chat-item.active { background: #e3e3e3; }
        .user-footer { border-top: 1px solid #d9d9e3; padding-top: 12px; display: flex; justify-content: space-between; }

        .main-chat { flex: 1; display: flex; flex-direction: column; background: #ffffff; }
        .chat-header { height: 50px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; padding: 0 20px; font-weight: 600; }
        .messages-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .msg-row { display: flex; gap: 12px; max-width: 800px; margin: 0 auto; width: 100%; }
        .avatar { width: 32px; height: 32px; border-radius: 4px; display: flex; justify-content: center; align-items: center; font-weight: bold; color: white; flex-shrink: 0; }
        .avatar.user { background: #5436da; }
        .avatar.nia { background: #10a37f; }
        .msg-content { font-size: 0.95rem; line-height: 1.5; padding-top: 5px; }
        
        .input-container { padding: 20px; background: #ffffff; border-top: 1px solid #f0f0f0; display: flex; justify-content: center; }
        .input-box { width: 100%; max-width: 800px; position: relative; }
        .input-box input { width: 100%; padding: 14px 45px 14px 16px; border: 1px solid #d9d9e3; border-radius: 12px; outline: none; }
        .input-box button { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: #10a37f; color: white; border: none; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; }
      </style>
    </head>
    <body>

      <div id="auth-screen">
        <div class="auth-box">
          <h2 id="auth-title">Connexion à Nia</h2>
          <input type="text" id="username" placeholder="Nom d'utilisateur">
          <input type="password" id="password" placeholder="Mot de passe">
          <button id="auth-btn" onclick="submitAuth()">Se connecter</button>
          <div class="toggle-link" id="toggle-auth" onclick="toggleAuthMode()">Pas de compte ? S'inscrire</div>
        </div>
      </div>

      <div id="app-screen">
        <div class="sidebar">
          <button class="btn-new-chat" onclick="nouveauChat()">+ Nouveau message</button>
          <div class="chat-list" id="chat-list"></div>
          <div class="user-footer">
            <span id="logged-user-name" style="font-weight: 600;"></span>
            <button style="background:none; border:none; color:red; cursor:pointer;" onclick="deconnexion()">Déconnexion</button>
          </div>
        </div>
        <div class="main-chat">
          <div class="chat-header">⚡ Nia AI</div>
          <div class="messages-container" id="messages"></div>
          <div class="input-container">
            <div class="input-box">
              <input type="text" id="prompt-input" placeholder="Envoyer un message à Nia..." onkeydown="if(event.key==='Enter') envoyerMessage()">
              <button onclick="envoyerMessage()">➔</button>
            </div>
          </div>
        </div>
      </div>

      <script>
        let isLogin = true;
        let currentUser = null;
        let currentChatId = null;

        function toggleAuthMode() {
          isLogin = !isLogin;
          document.getElementById('auth-title').innerText = isLogin ? "Connexion à Nia" : "Inscription à Nia";
          document.getElementById('auth-btn').innerText = isLogin ? "Se connecter" : "S'inscrire";
          document.getElementById('toggle-auth').innerText = isLogin ? "Pas de compte ? S'inscrire" : "Déjà un compte ? Se connecter";
        }

        async function submitAuth() {
          const u = document.getElementById('username').value.trim();
          const p = document.getElementById('password').value.trim();
          if(!u || !p) return alert("Remplis tous les champs");

          const endpoint = isLogin ? '/login' : '/register';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: u, password: p })
          });
          const data = await res.json();

          if(data.success) {
            currentUser = u;
            document.getElementById('logged-user-name').innerText = u;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';
            chargerChats();
          } else {
            alert(data.message);
          }
        }

        function deconnexion() {
          currentUser = null;
          currentChatId = null;
          document.getElementById('auth-screen').style.display = 'flex';
          document.getElementById('app-screen').style.display = 'none';
        }

        async function chargerChats() {
          const res = await fetch('/chats/' + currentUser);
          const data = await res.json();
          const list = document.getElementById('chat-list');
          list.innerHTML = '';
          
          if(data.chats.length === 0) {
            nouveauChat();
          } else {
            data.chats.forEach(chat => {
              const item = document.createElement('div');
              item.className = 'chat-item ' + (chat.id === currentChatId ? 'active' : '');
              item.innerText = chat.title || 'Discussion';
              item.onclick = () => ouvrirChat(chat.id);
              list.appendChild(item);
            });
            if(!currentChatId && data.chats.length > 0) ouvrirChat(data.chats[0].id);
          }
        }

        async function nouveauChat() {
          const res = await fetch('/chats/new', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: currentUser })
          });
          const data = await res.json();
          currentChatId = data.chatId;
          await chargerChats();
          document.getElementById('messages').innerHTML = '';
        }

        async function ouvrirChat(id) {
          currentChatId = id;
          const res = await fetch('/chats/' + currentUser + '/' + id);
          const data = await res.json();
          const container = document.getElementById('messages');
          container.innerHTML = '';
          (data.messages || []).forEach(m => afficherMessage(m.sender, m.text));
          chargerChats();
        }

        function afficherMessage(sender, text) {
          const container = document.getElementById('messages');
          const row = document.createElement('div');
          row.className = 'msg-row';
          const avClass = sender === 'user' ? 'user' : 'nia';
          const avText = sender === 'user' ? 'U' : 'N';
          row.innerHTML = '<div class="avatar ' + avClass + '">' + avText + '</div><div class="msg-content">' + text + '</div>';
          container.appendChild(row);
          container.scrollTop = container.scrollHeight;
        }

        async function envoyerMessage() {
          const input = document.getElementById('prompt-input');
          const text = input.value.trim();
          if(!text || !currentChatId) return;

          afficherMessage('user', text);
          input.value = '';

          await fetch('/envoyer-web', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: currentUser, chatId: currentChatId, message: text })
          });
        }

        setInterval(async () => {
          if(!currentUser || !currentChatId) return;
          try {
            const res = await fetch('/recuperer-reponse/' + currentUser + '/' + currentChatId);
            const data = await res.json();
            if (data.reponse) {
              afficherMessage('nia', data.reponse);
            }
          } catch(e) {}
        }, 1500);
      </script>
    </body>
    </html>
  `);
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if(users[username]) return res.json({ success: false, message: "Nom d'utilisateur déjà pris." });
  users[username] = password;
  histories[username] = [];
  res.json({ success: true });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if(users[username] && users[username] === password) return res.json({ success: true });
  res.json({ success: false, message: "Identifiants incorrects." });
});

app.get('/chats/:username', (req, res) => {
  res.json({ chats: histories[req.params.username] || [] });
});

app.post('/chats/new', (req, res) => {
  const { username } = req.body;
  const newChat = { id: Date.now().toString(), title: 'Nouvelle discussion', messages: [] };
  if(!histories[username]) histories[username] = [];
  histories[username].unshift(newChat);
  res.json({ chatId: newChat.id });
});

app.get('/chats/:username/:chatId', (req, res) => {
  const list = histories[req.params.username] || [];
  const chat = list.find(c => c.id === req.params.chatId);
  res.json({ messages: chat ? chat.messages : [] });
});

app.post('/envoyer-web', (req, res) => {
  const { username, chatId, message } = req.body;
  const list = histories[username] || [];
  const chat = list.find(c => c.id === chatId);
  if(chat) {
    if(chat.messages.length === 0) chat.title = message.substring(0, 20) + '...';
    chat.messages.push({ sender: 'user', text: message });
  }
  questionsWeb.push({ username, chatId, message });
  res.json({ success: true });
});

app.get('/recuperer-questions', (req, res) => {
  const q = [...questionsWeb];
  questionsWeb = [];
  res.json({ questions: q });
});

app.post('/repondre-humain', (req, res) => {
  const { username, chatId, reponse } = req.body;
  const list = histories[username] || [];
  const chat = list.find(c => c.id === chatId);
  if(chat) {
    chat.messages.push({ sender: 'nia', text: reponse });
  }
  reponsesHumain.push({ username, chatId, reponse });
  res.json({ success: true });
});

app.get('/recuperer-reponse/:username/:chatId', (req, res) => {
  const { username, chatId } = req.params;
  const index = reponsesHumain.findIndex(r => r.username === username && r.chatId === chatId);
  if(index !== -1) {
    const rep = reponsesHumain.splice(index, 1)[0];
    return res.json({ reponse: rep.reponse });
  }
  res.json({ reponse: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));
