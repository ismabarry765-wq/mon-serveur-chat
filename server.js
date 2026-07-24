const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

// Augmentation de la limite JSON pour supporter l'envoi d'images et audio en base64
app.use(express.json({ limit: '50mb' }));

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
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>Nexus AI</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background-color: #f7f7f8; color: #353740; height: 100vh; height: 100dvh; display: flex; overflow: hidden; }
        
        #auth-screen { position: fixed; inset: 0; background: #ffffff; display: flex; justify-content: center; align-items: center; z-index: 100; padding: 20px; }
        .auth-box { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); border: 1px solid #e5e5e5; width: 100%; max-width: 360px; text-align: center; }
        .auth-box h2 { margin-bottom: 20px; font-size: 1.4rem; }
        .auth-box input { width: 100%; padding: 12px; margin-bottom: 12px; border: 1px solid #d9d9e3; border-radius: 8px; outline: none; font-size: 16px; }
        .auth-box button { width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 1rem; }
        .toggle-link { font-size: 0.85rem; color: #6366f1; cursor: pointer; text-decoration: underline; margin-top: 15px; display: block; }

        #app-screen { display: none; width: 100%; height: 100%; flex-direction: row; position: relative; }
        
        .sidebar { width: 260px; background: #f9f9fb; border-right: 1px solid #e5e5e5; display: flex; flex-direction: column; padding: 12px; transition: transform 0.3s ease; z-index: 50; }
        .btn-new-chat { background: #ffffff; border: 1px solid #d9d9e3; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 500; margin-bottom: 15px; }
        .chat-list { flex: 1; overflow-y: auto; }
        .chat-item { padding: 12px; border-radius: 6px; cursor: pointer; font-size: 0.9rem; margin-bottom: 4px; }
        .chat-item:hover, .chat-item.active { background: #eaeaec; }
        .user-footer { border-top: 1px solid #d9d9e3; padding-top: 12px; display: flex; justify-content: space-between; align-items: center; }

        .main-chat { flex: 1; display: flex; flex-direction: column; background: #ffffff; width: 100%; position: relative; }
        .chat-header { height: 55px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; padding: 0 15px; font-weight: 600; justify-content: space-between; }
        .btn-menu { display: none; background: none; border: none; font-size: 1.4rem; cursor: pointer; margin-right: 10px; }
        
        .messages-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
        .msg-row { display: flex; gap: 10px; max-width: 800px; margin: 0 auto; width: 100%; }
        .avatar { width: 32px; height: 32px; border-radius: 6px; display: flex; justify-content: center; align-items: center; font-weight: bold; color: white; flex-shrink: 0; font-size: 0.85rem; }
        .avatar.user { background: #5436da; }
        .avatar.nexus { background: #6366f1; }
        .msg-content { font-size: 0.95rem; line-height: 1.4; padding-top: 4px; word-break: break-word; flex: 1; }
        .msg-img { max-width: 250px; max-height: 250px; border-radius: 8px; margin-top: 5px; display: block; border: 1px solid #ddd; }
        
        /* Zone de saisie et pièces jointes */
        .input-container { padding: 12px 15px; background: #ffffff; border-top: 1px solid #f0f0f0; display: flex; justify-content: center; }
        .input-box { width: 100%; max-width: 800px; position: relative; display: flex; align-items: center; gap: 6px; }
        .input-box input[type="text"] { flex: 1; padding: 12px 14px; border: 1px solid #d9d9e3; border-radius: 10px; outline: none; font-size: 16px; }
        
        .btn-action { background: #f0f0f0; border: 1px solid #d9d9e3; color: #333; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .btn-action:hover { background: #e0e0e0; }
        .btn-send { background: #6366f1; color: white; border: none; width: 40px; height: 40px; border-radius: 10px; cursor: pointer; font-size: 1rem; }
        .btn-send:hover { background: #4f46e5; }

        /* Overlay Glisser-Déposer */
        #drop-overlay { display: none; position: absolute; inset: 0; background: rgba(99, 102, 241, 0.15); border: 3px dashed #6366f1; z-index: 30; pointer-events: none; justify-content: center; align-items: center; font-weight: bold; color: #6366f1; font-size: 1.2rem; }

        #settings-modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); justify-content: center; align-items: center; z-index: 200; padding: 20px; }
        .modal-box { background: white; padding: 20px; border-radius: 12px; width: 100%; max-width: 320px; text-align: center; }
        .modal-box button { width: 100%; padding: 12px; margin-top: 10px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }

        @media (max-width: 768px) {
          .btn-menu { display: block; }
          .sidebar { position: absolute; left: 0; top: 0; bottom: 0; transform: translateX(-100%); width: 280px; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
          .sidebar.open { transform: translateX(0); }
          .overlay-sidebar { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 40; }
          .overlay-sidebar.open { display: block; }
        }
      </style>
    </head>
    <body>

      <div id="auth-screen">
        <div class="auth-box">
          <h2 id="auth-title">Connexion à Nexus AI</h2>
          <input type="text" id="username" placeholder="Nom d'utilisateur">
          <input type="password" id="password" placeholder="Mot de passe">
          <button id="auth-btn" onclick="submitAuth()">Se connecter</button>
          <div class="toggle-link" id="toggle-auth" onclick="toggleAuthMode()">Pas de compte ? S'inscrire</div>
        </div>
      </div>

      <div id="app-screen">
        <div class="overlay-sidebar" id="overlay" onclick="toggleMenu()"></div>
        <div class="sidebar" id="sidebar">
          <button class="btn-new-chat" onclick="nouveauChat(); toggleMenu();">+ Nouveau message</button>
          <div class="chat-list" id="chat-list"></div>
          <div class="user-footer">
            <span id="logged-user-name" style="font-weight: 600;"></span>
            <button style="background:none; border:none; color:#6366f1; cursor:pointer; font-weight:bold;" onclick="ouvrirParametres()">⚙️ Paramètres</button>
          </div>
        </div>

        <div class="main-chat" id="drag-zone">
          <div id="drop-overlay">🖼️ Dépose ton image ici !</div>
          <div class="chat-header">
            <div style="display:flex; align-items:center;">
              <button class="btn-menu" onclick="toggleMenu()">☰</button>
              <span>🌐 Nexus AI</span>
            </div>
          </div>
          <div class="messages-container" id="messages"></div>
          <div class="input-container">
            <div class="input-box">
              <button class="btn-action" title="Ajouter une image" onclick="document.getElementById('file-input').click()">+</button>
              <input type="file" id="file-input" accept="image/*" style="display:none;" onchange="envoyerImage(this.files[0])">
              
              <button class="btn-action" id="btn-vocal" title="Enregistrer un vocal" onclick="toggleEnregistrementVocal()">🎙️</button>

              <input type="text" id="prompt-input" placeholder="Envoyer un message..." onkeydown="if(event.key==='Enter') envoyerMessage()">
              <button class="btn-send" onclick="envoyerMessage()">➔</button>
            </div>
          </div>
        </div>
      </div>

      <div id="settings-modal">
        <div class="modal-box">
          <h3>Paramètres du Compte</h3>
          <button style="background:#e5e7eb; color:#374151;" onclick="deconnexion()">Se déconnecter</button>
          <button style="background:#ef4444; color:white;" onclick="supprimerCompte()">Supprimer le compte</button>
          <button style="background:none; color:#6b7280; margin-top:15px;" onclick="fermerParametres()">Fermer</button>
        </div>
      </div>

      <script>
        let isLogin = true;
        let currentUser = null;
        let currentChatId = null;
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;

        const notifSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

        window.onload = () => {
          const savedUser = localStorage.getItem('nexus_user');
          if (savedUser) {
            currentUser = savedUser;
            document.getElementById('logged-user-name').innerText = currentUser;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';
            chargerChats();
          }
          setupDragAndDrop();
        };

        function toggleMenu() {
          document.getElementById('sidebar').classList.toggle('open');
          document.getElementById('overlay').classList.toggle('open');
        }

        function toggleAuthMode() {
          isLogin = !isLogin;
          document.getElementById('auth-title').innerText = isLogin ? "Connexion à Nexus AI" : "Inscription à Nexus AI";
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
            localStorage.setItem('nexus_user', u);
            document.getElementById('logged-user-name').innerText = u;
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('app-screen').style.display = 'flex';
            chargerChats();
          } else {
            alert(data.message);
          }
        }

        function ouvrirParametres() { document.getElementById('settings-modal').style.display = 'flex'; }
        function fermerParametres() { document.getElementById('settings-modal').style.display = 'none'; }

        function deconnexion() {
          localStorage.removeItem('nexus_user');
          currentUser = null;
          currentChatId = null;
          fermerParametres();
          document.getElementById('auth-screen').style.display = 'flex';
          document.getElementById('app-screen').style.display = 'none';
        }

        async function supprimerCompte() {
          if (!confirm("Voulez-vous vraiment supprimer votre compte ?")) return;
          await fetch('/delete-account', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username: currentUser })
          });
          deconnexion();
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
              item.onclick = () => { ouvrirChat(chat.id); if(window.innerWidth <= 768) toggleMenu(); };
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
          (data.messages || []).forEach(m => afficherMessage(m.sender, m.text, m.image));
          chargerChats();
        }

        function afficherMessage(sender, text, image = null) {
          const container = document.getElementById('messages');
          const row = document.createElement('div');
          row.className = 'msg-row';
          const avClass = sender === 'user' ? 'user' : 'nexus';
          const avText = sender === 'user' ? 'U' : 'N';
          
          let contentHtml = '';
          if(text) contentHtml += '<div>' + text + '</div>';
          if(image) contentHtml += '<img src="' + image + '" class="msg-img" />';

          row.innerHTML = '<div class="avatar ' + avClass + '">' + avText + '</div><div class="msg-content">' + contentHtml + '</div>';
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

        // --- Envoi d'images ---
        function envoyerImage(file) {
          if(!file || !currentChatId) return;
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64Image = e.target.result;
            afficherMessage('user', '📷 [Image envoyée]', base64Image);
            await fetch('/envoyer-web', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ username: currentUser, chatId: currentChatId, message: '📷 [Image reçue]', image: base64Image })
            });
          };
          reader.readAsDataURL(file);
        }

        // --- Glisser-Déposer (Drag & Drop) ---
        function setupDragAndDrop() {
          const zone = document.getElementById('drag-zone');
          const overlay = document.getElementById('drop-overlay');

          window.addEventListener('dragover', (e) => { e.preventDefault(); overlay.style.display = 'flex'; });
          overlay.addEventListener('dragleave', (e) => { e.preventDefault(); overlay.style.display = 'none'; });
          overlay.addEventListener('drop', (e) => {
            e.preventDefault();
            overlay.style.display = 'none';
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              envoyerImage(e.dataTransfer.files[0]);
            }
          });
        }

        // --- Enregistreur Vocal ---
        async function toggleEnregistrementVocal() {
          const btn = document.getElementById('btn-vocal');
          if(!isRecording) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              mediaRecorder = new MediaRecorder(stream);
              audioChunks = [];
              mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                afficherMessage('user', '🎙️ [Message vocal envoyé...]');
                
                // Envoi du vocal
                const reader = new FileReader();
                reader.onloadend = async () => {
                  await fetch('/envoyer-web', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ username: currentUser, chatId: currentChatId, message: '🎙️ [Vocal vocal reçu]', audio: reader.result })
                  });
                };
                reader.readAsDataURL(audioBlob);
              };
              mediaRecorder.start();
              isRecording = true;
              btn.innerText = '⏹️';
              btn.style.background = '#ef4444';
              btn.style.color = 'white';
            } catch(err) {
              alert("Accès au micro refusé ou indisponible.");
            }
          } else {
            mediaRecorder.stop();
            isRecording = false;
            btn.innerText = '🎙️';
            btn.style.background = '#f0f0f0';
            btn.style.color = '#333';
          }
        }

        setInterval(async () => {
          if(!currentUser || !currentChatId) return;
          try {
            const res = await fetch('/recuperer-reponse/' + currentUser + '/' + currentChatId);
            const data = await res.json();
            if (data.reponse || data.image) {
              afficherMessage('nexus', data.reponse, data.image);
              try { notifSound.play(); } catch(e){}
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

app.post('/delete-account', (req, res) => {
  const { username } = req.body;
  delete users[username];
  delete histories[username];
  res.json({ success: true });
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
  const { username, chatId, message, image, audio } = req.body;
  const list = histories[username] || [];
  const chat = list.find(c => c.id === chatId);
  if(chat) {
    if(chat.messages.length === 0) chat.title = message.substring(0, 20) + '...';
    chat.messages.push({ sender: 'user', text: message, image, audio });
  }
  questionsWeb.push({ username, chatId, message, image, audio });
  res.json({ success: true });
});

app.get('/recuperer-questions', (req, res) => {
  const q = [...questionsWeb];
  questionsWeb = [];
  res.json({ questions: q });
});

app.post('/repondre-humain', (req, res) => {
  const { username, chatId, reponse, image } = req.body;
  const list = histories[username] || [];
  const chat = list.find(c => c.id === chatId);
  if(chat) {
    chat.messages.push({ sender: 'nexus', text: reponse, image });
  }
  reponsesHumain.push({ username, chatId, reponse, image });
  res.json({ success: true });
});

app.get('/recuperer-reponse/:username/:chatId', (req, res) => {
  const { username, chatId } = req.params;
  const index = reponsesHumain.findIndex(r => r.username === username && r.chatId === chatId);
  if(index !== -1) {
    const rep = reponsesHumain.splice(index, 1)[0];
    return res.json({ reponse: rep.reponse, image: rep.image });
  }
  res.json({ reponse: null, image: null });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Nexus AI actif sur le port ${PORT}`));
