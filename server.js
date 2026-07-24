const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let questionsWeb = [];
let reponsesHumain = [];

// Interface Web "Nia" (Style ChatGPT + Sauvegarde automatique)
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Nia - Assistant IA</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { background-color: #343541; color: #ececf1; display: flex; flex-direction: column; height: 100vh; }
        header { background: #202123; padding: 15px; text-align: center; font-size: 1.2rem; font-weight: bold; border-bottom: 1px solid #4d4d4f; }
        .chat-container { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
        .message { padding: 12px 16px; border-radius: 8px; max-width: 80%; line-height: 1.5; }
        .user { background-color: #343541; align-self: flex-end; border: 1px solid #565869; }
        .nia { background-color: #444654; align-self: flex-start; border: 1px solid #565869; }
        .input-area { background: #202123; padding: 20px; display: flex; gap: 10px; justify-content: center; }
        input { width: 70%; padding: 12px; border-radius: 6px; border: 1px solid #4d4d4f; background: #40414f; color: white; outline: none; }
        button { padding: 12px 20px; background: #10a37f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; }
        button:hover { background: #1a7f64; }
      </style>
    </head>
    <body>
      <header>⚡ Nia AI</header>
      <div id="chat" class="chat-container"></div>
      <div class="input-area">
        <input type="text" id="prompt" placeholder="Envoyer un message à Nia..." onkeydown="if(event.key==='Enter') envoyer()">
        <button onclick="envoyer()">Envoyer</button>
      </div>

      <script>
        const chat = document.getElementById('chat');

        // Charge l'historique enregistré dans le navigateur
        function chargerHistorique() {
          const sauvegarde = localStorage.getItem('nia_chat_history');
          if (sauvegarde) {
            chat.innerHTML = sauvegarde;
            chat.scrollTop = chat.scrollHeight;
          } else {
            ajouterMessage('nia', 'Bonjour ! Je suis Nia. Comment puis-je vous aider aujourd\'hui ?');
          }
        }

        function sauvegarderHistorique() {
          localStorage.setItem('nia_chat_history', chat.innerHTML);
        }

        function ajouterMessage(auteur, texte) {
          const div = document.createElement('div');
          div.className = 'message ' + auteur;
          div.innerText = (auteur === 'nia' ? 'Nia: ' : '') + texte;
          chat.appendChild(div);
          chat.scrollTop = chat.scrollHeight;
          sauvegarderHistorique();
        }

        async function envoyer() {
          const input = document.getElementById('prompt');
          const text = input.value.trim();
          if (!text) return;

          ajouterMessage('user', text);
          input.value = '';

          await fetch('/envoyer-web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });
        }

        // Vérification automatique des réponses envoyées par toi
        setInterval(async () => {
          try {
            const res = await fetch('/recuperer-reponse');
            const data = await res.json();
            if (data.reponse) {
              ajouterMessage('nia', data.reponse);
            }
          } catch(e) {}
        }, 1500);

        chargerHistorique();
      </script>
    </body>
    </html>
  `);
});

// Envoi du message par le visiteur
app.post('/envoyer-web', (req, res) => {
  if (req.body.message) questionsWeb.push(req.body.message);
  res.json({ success: true });
});

// Récupération des messages par ton script Python
app.get('/recuperer-questions', (req, res) => {
  const q = [...questionsWeb];
  questionsWeb = [];
  res.json({ questions: q });
});

// Envoi de ta réponse depuis Python
app.post('/repondre-humain', (req, res) => {
  if (req.body.reponse) reponsesHumain.push(req.body.reponse);
  res.json({ success: true });
});

// Transmission de ta réponse vers le navigateur du visiteur
app.get('/recuperer-reponse', (req, res) => {
  const rep = reponsesHumain.shift() || null;
  res.json({ reponse: rep });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur Nia prêt sur le port ${PORT}`));
