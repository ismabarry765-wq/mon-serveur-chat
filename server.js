const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ==========================================
// 🌟 CONFIGURATION
// ==========================================
let users = {};
let conversations = {};

// ==========================================
// 🔌 SOCKET.IO - TEMPS RÉEL
// ==========================================
io.on('connection', (socket) => {
    console.log('🔌 Nouveau client connecté:', socket.id);

    // Rejoindre une salle de chat
    socket.on('join-room', (chatId) => {
        socket.join(chatId);
        console.log('📁 Client rejoint la salle:', chatId);
    });

    // 📩 Utilisateur envoie un message
    socket.on('user-message', (data) => {
        const { chatId, username, text } = data;
        
        if (!conversations[chatId]) {
            conversations[chatId] = { username, messages: [] };
        }

        // Ajouter le message
        conversations[chatId].messages.push({ 
            sender: username, 
            text: text,
            timestamp: new Date().toISOString()
        });

        // Message d'attente
        const waitingMsg = "Nexus IA réfléchit...";
        conversations[chatId].messages.push({ 
            sender: "Groq IA", 
            text: waitingMsg,
            timestamp: new Date().toISOString()
        });

        console.log('💬 Message de', username, ':', text);

        // 🔥 Diffuser à tous (admin + utilisateur)
        io.emit('new-message', {
            chatId,
            sender: username,
            text: text
        });

        // 🔥 Diffuser le message d'attente
        io.emit('new-message', {
            chatId,
            sender: "Groq IA",
            text: waitingMsg
        });
    });

    // 👑 Admin répond
    socket.on('admin-message', (data) => {
        const { chatId, text, admin } = data;
        
        if (!conversations[chatId]) {
            return;
        }

        // 🔥 Supprimer "Nexus IA réfléchit..."
        conversations[chatId].messages = conversations[chatId].messages.filter(
            m => !(m.sender === "Groq IA" && m.text === "Nexus IA réfléchit...")
        );

        // Ajouter la réponse
        conversations[chatId].messages.push({ 
            sender: admin || "Nexus IA", 
            text: text,
            isAdmin: true,
            timestamp: new Date().toISOString()
        });

        console.log('👑 Admin répond:', text);

        // 🔥 Diffuser à TOUS les clients (admin + utilisateur)
        io.emit('admin-reply', {
            chatId,
            sender: admin || "Nexus IA",
            text: text
        });
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log('🔌 Client déconnecté:', socket.id);
    });
});

// ==========================================
// 🌐 INTERFACE UTILISATEUR
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nexus Chat IA - Par Ismaël</title>
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { background-color: #ffffff; color: #0d0d0d; display: flex; height: 100vh; overflow: hidden; }

            #auth-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; }
            .auth-box { background: #ffffff; padding: 40px; border-radius: 16px; width: 400px; box-shadow: 0 8px 40px rgba(0,0,0,0.2); text-align: center; }
            .auth-box h2 { margin-bottom: 24px; font-size: 1.5rem; font-weight: 700; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .auth-box input { width: 100%; padding: 12px 16px; margin-bottom: 14px; border: 2px solid #e5e7eb; border-radius: 10px; outline: none; font-size: 0.95rem; transition: border-color 0.2s; }
            .auth-box input:focus { border-color: #6366f1; }
            .auth-box button { width: 100%; padding: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; transition: transform 0.1s; font-size: 1rem; }
            .auth-box button:hover { transform: scale(1.02); }
            .auth-toggle { margin-top: 18px; font-size: 0.9rem; color: #6366f1; cursor: pointer; font-weight: 500; }
            .auth-toggle:hover { text-decoration: underline; }

            #toast { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 0.9rem; display: none; z-index: 1001; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            #toast.error { background: #ef4444; }

            #sidebar { width: 280px; background-color: #f7f7f8; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; transition: margin-left 0.3s ease; justify-content: space-between; }
            #sidebar.closed { margin-left: -280px; }
            .sidebar-top { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
            .sidebar-header { padding: 18px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
            .sidebar-header strong { font-size: 1.1rem; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .btn-new-chat { margin: 12px 16px; padding: 12px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 10px; font-weight: 600; cursor: pointer; text-align: left; transition: all 0.2s; }
            .btn-new-chat:hover { background: #f3f4f6; border-color: #6366f1; }
            .chat-list { flex: 1; overflow-y: auto; padding: 10px 16px; }
            .chat-item { padding: 12px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; margin-bottom: 6px; transition: background 0.2s; }
            .chat-item:hover { background: #e5e7eb; }
            .chat-item.active { background: #e5e7eb; font-weight: 600; }

            .profile-section { padding: 16px; border-top: 1px solid #e5e7eb; position: relative; background: #f7f7f8; }
            .profile-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 14px; background: #ffffff; border: 1px solid #d1d5db; border-radius: 10px; cursor: pointer; font-weight: 500; font-size: 0.9rem; transition: all 0.2s; }
            .profile-btn:hover { background: #f3f4f6; }
            .profile-menu { position: absolute; bottom: 80px; left: 16px; right: 16px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); display: none; flex-direction: column; overflow: hidden; z-index: 100; }
            .profile-menu.show { display: flex; }
            .profile-menu button { padding: 12px 16px; background: none; border: none; text-align: left; cursor: pointer; font-size: 0.9rem; width: 100%; transition: background 0.2s; }
            .profile-menu button:hover { background: #f3f4f6; }
            .profile-menu button.danger { color: #ef4444; }

            #main-content { flex: 1; display: flex; flex-direction: column; height: 100vh; background: #ffffff; }
            header { padding: 14px 24px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; background: #ffffff; }
            .toggle-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; padding: 6px; border-radius: 8px; transition: background 0.2s; }
            .toggle-btn:hover { background: #f3f4f6; }
            #chat-container { flex: 1; overflow-y: auto; padding: 30px 20px; display: flex; flex-direction: column; gap: 20px; max-width: 800px; width: 100%; margin: 0 auto; }
            
            .message { padding: 14px 20px; border-radius: 14px; max-width: 85%; line-height: 1.6; font-size: 0.95rem; animation: fadeIn 0.3s ease; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            .message.user { align-self: flex-end; background: #f3f4f6; color: #0d0d0d; border-bottom-right-radius: 4px; }
            .message.ai { align-self: flex-start; background: #f7f7f8; color: #0d0d0d; border-bottom-left-radius: 4px; }
            .message.admin { align-self: flex-start; background: #e0e7ff; color: #1e40af; border-bottom-left-radius: 4px; border-left: 3px solid #6366f1; }
            
            .typing-indicator {
                align-self: flex-start;
                background: #f7f7f8;
                padding: 12px 20px;
                border-radius: 14px;
                border-bottom-left-radius: 4px;
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 80px;
            }
            .typing-indicator span { color: #6b7280; font-size: 0.95rem; }
            .typing-dots { display: flex; gap: 4px; align-items: center; }
            .typing-dots span {
                width: 8px; height: 8px; background: #6366f1; border-radius: 50%;
                display: inline-block; animation: bounce 1.4s infinite ease-in-out;
            }
            .typing-dots span:nth-child(1) { animation-delay: 0s; }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }

            #input-container { padding: 16px 24px; background: #ffffff; border-top: 1px solid #e5e7eb; max-width: 800px; width: 100%; margin: 0 auto; }
            .input-box { display: flex; gap: 12px; border: 2px solid #e5e7eb; border-radius: 28px; padding: 6px 6px 6px 24px; transition: border-color 0.2s; }
            .input-box:focus-within { border-color: #6366f1; }
            input[type="text"] { flex: 1; border: none; outline: none; font-size: 1rem; background: transparent; }
            button.btn-send { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; padding: 10px 24px; border-radius: 24px; font-weight: 600; cursor: pointer; transition: transform 0.1s; }
            button.btn-send:hover { transform: scale(1.02); }

            @media (max-width: 768px) {
                #sidebar { width: 100%; position: fixed; height: 100vh; z-index: 999; }
                #sidebar.closed { margin-left: -100%; }
            }
        </style>
    </head>
    <body>
        <div id="toast">Notification</div>

        <div id="auth-modal">
            <div class="auth-box">
                <h2 id="auth-title">✨ Nexus IA</h2>
                <p style="color: #6b7280; margin-bottom: 20px; font-size: 0.9rem;">Créée par Ismaël ✨</p>
                <input type="text" id="auth-username" placeholder="Pseudo" autocomplete="username">
                <input type="password" id="auth-password" placeholder="Mot de passe" autocomplete="current-password">
                <button onclick="handleAuth()" id="auth-btn">Se connecter</button>
                <div class="auth-toggle" onclick="toggleAuthMode()" id="auth-toggle-btn">Pas encore de compte ? S'inscrire</div>
            </div>
        </div>

        <div id="sidebar">
            <div class="sidebar-top">
                <div class="sidebar-header">
                    <strong>✨ Nexus IA</strong>
                    <button class="toggle-btn" onclick="toggleSidebar()">✕</button>
                </div>
                <button class="btn-new-chat" onclick="newChat()">➕ Nouveau chat</button>
                <div class="chat-list" id="recent-chats">
                    <div class="chat-item active">💬 Discussion actuelle</div>
                </div>
            </div>

            <div class="profile-section">
                <div class="profile-menu" id="profile-menu">
                    <button onclick="openSettings()">⚙️ Paramètres</button>
                    <button onclick="logout()">🚪 Déconnexion</button>
                    <button class="danger" onclick="promptDeleteAccount()">🗑️ Supprimer le compte</button>
                </div>
                <div class="profile-btn" onclick="toggleProfileMenu()">
                    <span id="profile-name">👤 Mon Profil</span>
                    <span>▼</span>
                </div>
            </div>
        </div>

        <div id="main-content">
            <header>
                <button class="toggle-btn" onclick="toggleSidebar()">☰</button>
                <span style="font-size: 0.9rem; font-weight: 500; color: #4b5563;">💬 Conversation avec Nexus IA</span>
                <span style="font-size: 0.8rem; color: #6b7280;">par Ismaël</span>
                <span id="status-indicator" style="font-size:0.8rem; color:#10b981;">🟢 En ligne</span>
            </header>

            <div id="chat-container">
                <div style="text-align: center; color: #9ca3af; padding: 40px 0;">
                    <div style="font-size: 2rem; margin-bottom: 10px;">👋</div>
                    <div style="font-weight: 500;">Bienvenue sur Nexus IA</div>
                    <div style="font-size: 0.9rem; margin-top: 6px;">Commencez une conversation avec l'IA créée par Ismaël</div>
                </div>
            </div>

            <div id="input-container">
                <div class="input-box">
                    <input type="text" id="user-input" placeholder="Envoyer un message..." onkeydown="if(event.key==='Enter') sendMsg()">
                    <button class="btn-send" onclick="sendMsg()">Envoyer</button>
                </div>
            </div>
        </div>

        <script>
            // ==========================================
            // 🔌 SOCKET.IO - TEMPS RÉEL
            // ==========================================
            const socket = io();
            let isSignUp = false;
            let currentUser = localStorage.getItem('nexus_user') || null;
            let isTyping = false;
            
            let chatId = localStorage.getItem('nexus_chatId');
            if (!chatId) {
                chatId = "session_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
                localStorage.setItem('nexus_chatId', chatId);
            }

            // Rejoindre la salle de chat
            socket.emit('join-room', chatId);

            // 🔥 Écouter les nouveaux messages
            socket.on('new-message', (data) => {
                if (data.chatId === chatId) {
                    // Supprimer l'indicateur de frappe si présent
                    removeTypingIndicator();
                    
                    // Déterminer le type de message
                    let type = 'user';
                    if (data.sender === 'Groq IA') type = 'ai';
                    else if (data.sender === 'Nexus IA' || data.sender === 'Admin') type = 'admin';
                    
                    // Supprimer le message "réfléchit" si c'est une réponse admin
                    if (type === 'admin') {
                        const container = document.getElementById('chat-container');
                        const messages = container.querySelectorAll('.message.ai');
                        messages.forEach(msg => {
                            if (msg.textContent === 'Nexus IA réfléchit...') {
                                msg.remove();
                            }
                        });
                    }
                    
                    appendMsg(type, data.text);
                }
            });

            // 🔥 Écouter les réponses admin
            socket.on('admin-reply', (data) => {
                if (data.chatId === chatId) {
                    removeTypingIndicator();
                    
                    // Supprimer tous les "Nexus IA réfléchit..."
                    const container = document.getElementById('chat-container');
                    const messages = container.querySelectorAll('.message.ai');
                    messages.forEach(msg => {
                        if (msg.textContent === 'Nexus IA réfléchit...') {
                            msg.remove();
                        }
                    });
                    
                    appendMsg('admin', data.text);
                    showToast('📩 Nouvelle réponse de l\'admin !');
                }
            });

            // ==========================================
            // 📋 FONCTIONS DE L'INTERFACE
            // ==========================================
            window.onload = () => {
                if (currentUser) {
                    document.getElementById('auth-modal').style.display = 'none';
                    document.getElementById('profile-name').innerHTML = "👤 " + currentUser;
                    loadChatHistory();
                }
            };

            function showToast(text, isError = false) {
                const toast = document.getElementById('toast');
                toast.innerText = text;
                toast.className = isError ? 'error' : '';
                toast.style.display = 'block';
                setTimeout(() => { toast.style.display = 'none'; }, 3000);
            }

            function toggleSidebar() { 
                document.getElementById('sidebar').classList.toggle('closed'); 
            }

            function toggleProfileMenu() { 
                document.getElementById('profile-menu').classList.toggle('show'); 
            }

            function toggleAuthMode() {
                isSignUp = !isSignUp;
                document.getElementById('auth-title').innerText = isSignUp ? "✨ Créer un compte" : "✨ Connexion";
                document.getElementById('auth-btn').innerText = isSignUp ? "S'inscrire" : "Se connecter";
                document.getElementById('auth-toggle-btn').innerText = isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire";
            }

            async function handleAuth() {
                const username = document.getElementById('auth-username').value.trim();
                const password = document.getElementById('auth-password').value.trim();
                if (!username || !password) return showToast("Remplis tous les champs !", true);

                const endpoint = isSignUp ? '/api/register' : '/api/login';
                try {
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        currentUser = username;
                        localStorage.setItem('nexus_user', currentUser);
                        document.getElementById('profile-name').innerHTML = "👤 " + currentUser;
                        document.getElementById('auth-modal').style.display = 'none';
                        showToast(data.message || "Bienvenue sur Nexus IA ! 🎉");
                        loadChatHistory();
                    } else {
                        showToast(data.error, true);
                    }
                } catch (e) {
                    showToast("Erreur de connexion", true);
                }
            }

            function logout() {
                localStorage.removeItem('nexus_user');
                localStorage.removeItem('nexus_chatId');
                location.reload();
            }

            async function promptDeleteAccount() {
                const password = prompt("Confirme ton mot de passe :");
                if (!password) return;

                try {
                    const res = await fetch('/api/delete-account', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: currentUser, password })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        showToast("Compte supprimé !");
                        localStorage.removeItem('nexus_user');
                        localStorage.removeItem('nexus_chatId');
                        setTimeout(() => location.reload(), 1500);
                    } else {
                        showToast(data.error, true);
                    }
                } catch(e) {
                    showToast("Erreur de suppression", true);
                }
            }

            function openSettings() {
                toggleProfileMenu();
                alert(\`⚙️ Paramètres de \${currentUser}\\n\\nBienvenue sur Nexus IA !\\nCréé avec ❤️ par Ismaël\\n\\nVersion 3.0\`);
            }

            async function loadChatHistory() {
                try {
                    const res = await fetch(\`/get-history?chatId=\${chatId}&username=\${currentUser}\`);
                    if (res.ok) {
                        const data = await res.json();
                        const container = document.getElementById('chat-container');
                        
                        const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
                        
                        container.innerHTML = '';
                        data.messages.forEach(msg => {
                            let type = 'user';
                            if (msg.sender === 'Groq IA') type = 'ai';
                            else if (msg.sender === 'Nexus IA' || msg.sender === 'Admin') type = 'admin';
                            appendMsg(type, msg.text, false);
                        });
                        if (data.messages.length === 0) {
                            container.innerHTML = \`
                                <div style="text-align: center; color: #9ca3af; padding: 40px 0;">
                                    <div style="font-size: 2rem; margin-bottom: 10px;">👋</div>
                                    <div style="font-weight: 500;">Bienvenue sur Nexus IA</div>
                                    <div style="font-size: 0.9rem; margin-top: 6px;">Commencez une conversation avec l'IA créée par Ismaël</div>
                                </div>
                            \`;
                        }
                        
                        if (isAtBottom) {
                            container.scrollTop = container.scrollHeight;
                        }
                    }
                } catch(e) {}
            }

            function showTypingIndicator() {
                const container = document.getElementById('chat-container');
                const typingDiv = document.createElement('div');
                typingDiv.className = 'typing-indicator';
                typingDiv.id = 'typing-indicator';
                typingDiv.innerHTML = \`
                    <span>Nexus IA réfléchit</span>
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                \`;
                container.appendChild(typingDiv);
                container.scrollTop = container.scrollHeight;
                return typingDiv;
            }

            function removeTypingIndicator() {
                const indicator = document.getElementById('typing-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }

            async function sendMsg() {
                if (!currentUser) return showToast("Connecte-toi d'abord !", true);
                const input = document.getElementById('user-input');
                const text = input.value.trim();
                if (!text || isTyping) return;

                const container = document.getElementById('chat-container');
                if (container.children.length === 1 && container.children[0].style && container.children[0].style.textAlign === 'center') {
                    container.innerHTML = '';
                }

                appendMsg('user', text);
                input.value = '';
                isTyping = true;
                showTypingIndicator();

                // 🔥 Envoyer via Socket.IO
                socket.emit('user-message', {
                    chatId: chatId,
                    username: currentUser,
                    text: text
                });
            }

            function appendMsg(type, text, scroll = true) {
                const box = document.getElementById('chat-container');
                const div = document.createElement('div');
                div.className = 'message ' + type;
                if (text.includes('\\n')) {
                    div.style.whiteSpace = 'pre-line';
                }
                div.innerText = text;
                box.appendChild(div);
                if (scroll) {
                    box.scrollTop = box.scrollHeight;
                }
            }

            function newChat() {
                chatId = "session_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
                localStorage.setItem('nexus_chatId', chatId);
                socket.emit('join-room', chatId);
                document.getElementById('chat-container').innerHTML = \`
                    <div style="text-align: center; color: #9ca3af; padding: 40px 0;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">✨</div>
                        <div style="font-weight: 500;">Nouvelle conversation</div>
                        <div style="font-size: 0.9rem; margin-top: 6px;">Posez votre question à Nexus IA</div>
                    </div>
                \`;
                showToast("✨ Nouvelle conversation créée !");
            }

            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    sendMsg();
                }
            });
        </script>
    </body>
    </html>
    `);
});

// ==========================================
// 🚀 DASHBOARD ADMIN
// ==========================================
app.get('/groq', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - Nexus IA</title>
        <script src="https://cdn.socket.io/4.5.0/socket.io.min.js"></script>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            body { background: #f8fafc; color: #0d0d0d; display: flex; height: 100vh; overflow: hidden; }
            #sidebar { width: 320px; background: #ffffff; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; }
            .sidebar-header { padding: 18px 20px; border-bottom: 1px solid #e2e8f0; font-weight: 700; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; display: flex; justify-content: space-between; align-items: center; }
            .sidebar-header span:last-child { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 0.75rem; }
            .chat-list { flex: 1; overflow-y: auto; padding: 12px; }
            .chat-item { padding: 14px; border-radius: 10px; cursor: pointer; font-size: 0.9rem; margin-bottom: 8px; background: #f8fafc; border: 1px solid #e2e8f0; transition: all 0.2s; }
            .chat-item:hover { background: #f1f5f9; border-color: #6366f1; transform: translateX(4px); }
            .chat-item .badge { background: #6366f1; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; }
            #main-content { flex: 1; display: flex; flex-direction: column; height: 100vh; }
            header { padding: 18px 24px; border-bottom: 1px solid #e2e8f0; background: #ffffff; font-weight: 700; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: center; }
            header small { font-weight: 400; color: #6b7280; font-size: 0.85rem; }
            #monitor-container { flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 16px; max-width: 900px; width: 100%; margin: 0 auto; }
            .card { padding: 18px; border-radius: 12px; border: 1px solid #e2e8f0; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); animation: slideIn 0.3s ease; }
            @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .card-question { border-left: 4px solid #6366f1; }
            .card-response { border-left: 4px solid #10b981; background: #f0fdf4; }
            .card-admin { border-left: 4px solid #8b5cf6; background: #f5f3ff; }
            .card .timestamp { font-size: 0.75rem; color: #94a3b8; margin-top: 8px; }
            .admin-response-area { background: #ffffff; padding: 16px; border-radius: 12px; border: 2px solid #e2e8f0; margin-bottom: 16px; }
            .admin-response-area textarea { width: 100%; padding: 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 0.95rem; resize: vertical; font-family: inherit; transition: border-color 0.2s; }
            .admin-response-area textarea:focus { border-color: #6366f1; outline: none; }
            .admin-response-area .btn-group { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
            .admin-response-area .btn-group button { padding: 10px 24px; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: transform 0.1s; }
            .admin-response-area .btn-group button:hover { transform: scale(1.02); }
            .btn-send-reply { background: #6366f1; color: white; }
            .btn-clear { background: #ef4444; color: white; }
            .btn-refresh { background: #10b981; color: white; }
            .typing-dots { display: inline-flex; gap: 3px; margin-left: 8px; }
            .typing-dots span { width: 6px; height: 6px; background: #6366f1; border-radius: 50%; display: inline-block; animation: bounce 1.4s infinite ease-in-out; }
            .typing-dots span:nth-child(1) { animation-delay: 0s; }
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
            @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
            .status-online { color: #10b981; }
            .status-offline { color: #ef4444; }
        </style>
    </head>
    <body>
        <div id="sidebar">
            <div class="sidebar-header">
                <span>🤖 Activité Utilisateurs</span>
                <span id="status-indicator" class="status-online">● Live</span>
            </div>
            <div class="chat-list" id="users-list">
                <div style="padding: 20px; color: #94a3b8; text-align: center; font-size: 0.9rem;">En attente de discussions...</div>
            </div>
        </div>
        <div id="main-content">
            <header>
                <span>📊 Dashboard Admin <span id="user-count" style="font-size:0.8rem; font-weight:400;">(0 connecté)</span></span>
                <small>Répondre aux utilisateurs en temps réel</small>
            </header>
            <div id="monitor-container">
                <div style="text-align: center; color: #94a3b8; margin-top: 60px; font-size: 1rem;">
                    <div style="font-size: 3rem; margin-bottom: 16px;">📡</div>
                    <div style="font-weight: 500;">Sélectionnez une session à gauche</div>
                    <div style="font-size: 0.9rem; margin-top: 8px;">Répondez manuellement aux utilisateurs</div>
                </div>
            </div>
        </div>

        <script>
            // ==========================================
            // 🔌 SOCKET.IO - TEMPS RÉEL (ADMIN)
            // ==========================================
            const socket = io();
            let allSessions = [];
            let selectedChatId = null;
            let selectedUsername = null;

            // 🔥 Écouter les nouveaux messages
            socket.on('new-message', (data) => {
                // Rafraîchir la liste des sessions
                fetchActivity();
                
                // Si la session est sélectionnée, rafraîchir l'affichage
                if (selectedChatId === data.chatId) {
                    refreshCurrentSession();
                }
            });

            // 🔥 Écouter les réponses admin (pour les autres admins)
            socket.on('admin-reply', (data) => {
                fetchActivity();
                if (selectedChatId === data.chatId) {
                    refreshCurrentSession();
                }
            });

            // ==========================================
            // 📋 FONCTIONS
            // ==========================================
            async function fetchActivity() {
                try {
                    const res = await fetch('/recuperer-questions');
                    if (res.ok) {
                        const data = await res.json();
                        allSessions = data.questions || [];
                        renderUsersList();
                        document.getElementById('user-count').textContent = \`(\${allSessions.length} actif)\`;
                    }
                } catch(e) {}
            }

            function renderUsersList() {
                const list = document.getElementById('users-list');
                list.innerHTML = '';
                if (allSessions.length === 0) {
                    list.innerHTML = '<div style="padding: 20px; color: #94a3b8; text-align: center; font-size: 0.9rem;">Aucune activité pour l\'instant.</div>';
                    return;
                }
                allSessions.forEach(s => {
                    const div = document.createElement('div');
                    div.className = 'chat-item';
                    const msgCount = s.messages ? s.messages.length : 0;
                    const lastMsg = s.messages && s.messages.length > 0 ? s.messages[s.messages.length - 1].text.substring(0, 30) : '';
                    div.innerHTML = \`
                        <strong>👤 \${s.username}</strong>
                        <span class="badge">\${msgCount} msg</span>
                        <br><span style="font-size:0.75rem; color:#64748b;">\${lastMsg ? lastMsg + '...' : 'Nouvelle conversation'}</span>
                    \`;
                    div.onclick = () => showSessionDetails(s);
                    list.appendChild(div);
                });
            }

            function showSessionDetails(s) {
                selectedChatId = s.chatId;
                selectedUsername = s.username;
                const container = document.getElementById('monitor-container');
                container.innerHTML = \`
                    <div style="margin-bottom: 16px;">
                        <h3 style="color: #1e293b; display: flex; align-items: center; gap: 12px;">
                            <span>👤 \${s.username}</span>
                            <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 400;">Session: \${s.chatId.substring(0, 12)}...</span>
                        </h3>
                    </div>
                    <div class="admin-response-area">
                        <textarea id="admin-response" rows="3" placeholder="Écris ta réponse ici..."></textarea>
                        <div class="btn-group">
                            <button class="btn-send-reply" onclick="sendAdminReply()">📤 Envoyer la réponse</button>
                            <button class="btn-clear" onclick="clearAdminReply()">🗑️ Effacer</button>
                            <button class="btn-refresh" onclick="refreshCurrentSession()">🔄 Rafraîchir</button>
                        </div>
                    </div>
                    <hr style="border:1px solid #e2e8f0; margin:16px 0;">
                    <h4 style="color:#64748b; margin-bottom:12px;">📜 Historique des messages</h4>
                \`;

                if (!s.messages || s.messages.length === 0) {
                    container.innerHTML += '<div style="color: #94a3b8; text-align: center; padding: 40px;">Aucun message dans cette session</div>';
                    return;
                }

                s.messages.forEach(m => {
                    let cardClass = 'card-question';
                    let label = '❓ Question';
                    let senderLabel = m.sender;
                    if (m.sender === 'Groq IA') {
                        cardClass = 'card-response';
                        label = '🤖 Réponse IA';
                    } else if (m.sender === 'Nexus IA' || m.sender === 'Admin') {
                        cardClass = 'card-admin';
                        label = '👑 Admin';
                    }
                    const box = document.createElement('div');
                    box.className = 'card ' + cardClass;
                    box.innerHTML = \`
                        <strong>\${label} (\${senderLabel}) :</strong>
                        <br>\${m.text}
                        <div class="timestamp">\${new Date().toLocaleTimeString()}</div>
                    \`;
                    container.appendChild(box);
                });
            }

            async function sendAdminReply() {
                const textarea = document.getElementById('admin-response');
                const text = textarea.value.trim();
                if (!text || !selectedChatId) {
                    alert('Écris une réponse et sélectionne une conversation.');
                    return;
                }

                try {
                    // 🔥 Envoyer via Socket.IO
                    socket.emit('admin-message', {
                        chatId: selectedChatId,
                        text: text,
                        admin: 'Nexus IA'
                    });

                    textarea.value = '';
                    showToast('✅ Réponse envoyée en temps réel !');
                    
                    // Rafraîchir
                    setTimeout(() => {
                        refreshCurrentSession();
                        fetchActivity();
                    }, 500);
                    
                } catch(e) {
                    alert('❌ Erreur: ' + e.message);
                }
            }

            function showToast(msg) {
                // Créer un toast temporaire
                const toast = document.createElement('div');
                toast.style.cssText = \`
                    position: fixed; bottom: 20px; right: 20px;
                    background: #10b981; color: white;
                    padding: 12px 24px; border-radius: 8px;
                    font-weight: 600; z-index: 9999;
                    animation: slideIn 0.3s ease;
                \`;
                toast.textContent = msg;
                document.body.appendChild(toast);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }

            async function refreshCurrentSession() {
                if (!selectedUsername) return;
                try {
                    const res = await fetch('/get-history?chatId=' + selectedChatId + '&username=' + selectedUsername);
                    if (res.ok) {
                        const data = await res.json();
                        const session = allSessions.find(s => s.chatId === selectedChatId);
                        if (session) {
                            session.messages = data.messages;
                            showSessionDetails(session);
                        }
                    }
                } catch(e) {}
            }

            function clearAdminReply() {
                document.getElementById('admin-response').value = '';
            }

            // Rafraîchir toutes les 3 secondes
            setInterval(fetchActivity, 3000);
            fetchActivity();
        </script>
    </body>
    </html>
    `);
});

// ==========================================
// 🔐 API AUTHENTIFICATION
// ==========================================
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (users[username]) return res.status(400).json({ error: "Ce pseudo est déjà pris !" });
    users[username] = password;
    res.json({ message: "✅ Compte créé avec succès ! Bienvenue sur Nexus IA ✨" });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "❌ Identifiants incorrects" });
    }
    res.json({ message: \`✅ Bon retour \${username} ! 🎉\` });
});

app.post('/api/delete-account', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Champs manquants" });
    if (!users[username] || users[username] !== password) {
        return res.status(401).json({ error: "Mot de passe incorrect" });
    }
    delete users[username];
    Object.keys(conversations).forEach(key => {
        if (conversations[key].username === username) {
            delete conversations[key];
        }
    });
    res.json({ message: "Compte supprimé définitivement" });
});

// ==========================================
// 💬 API CONVERSATION (REST)
// ==========================================
app.get('/get-history', (req, res) => {
    const { chatId, username } = req.query;
    if (!chatId || !username) {
        return res.status(400).json({ error: "Paramètres manquants" });
    }

    const chat = conversations[chatId];
    if (!chat || chat.username !== username) {
        return res.json({ messages: [] });
    }

    res.json({ messages: chat.messages });
});

app.get('/recuperer-questions', (req, res) => {
    const questions = Object.keys(conversations).map(chatId => ({
        chatId,
        username: conversations[chatId].username,
        messages: conversations[chatId].messages,
        messageCount: conversations[chatId].messages.length
    }));
    res.json({ questions });
});

// ==========================================
// 🚀 DÉMARRAGE
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(\`
    ╔═══════════════════════════════════════════════════════╗
    ║     ✨ NEXUS IA 3.0 - SOCKET.IO ✨                  ║
    ╠═══════════════════════════════════════════════════════╣
    ║   🚀 Créé avec ❤️ par Ismaël                        ║
    ║   🌐 Interface : https://mon-server-chat.onrender.com ║
    ║   🛠️ Dashboard : https://mon-server-chat.onrender.com/groq ║
    ║   🔌 Socket.IO activé - Temps réel !                ║
    ╚═══════════════════════════════════════════════════════╝
    \`);
});