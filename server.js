const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Stockage temporaire des messages
let messages = [];

// 1. Interface Web pour les visiteurs
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Envoyer un message</title>
      <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; margin: 0; }
        .box { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; }
        input { width: 80%; padding: 10px; margin-bottom: 10px; border: 1px solid #ccc; border-radius: 5px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2>Envoyer un message à l'hôte</h2>
        <input type="text" id="msg" placeholder="Écris ton message...">
        <br>
        <button onclick="envoyer()">Envoyer</button>
        <p id="statut" style="color: green;"></p>
      </div>

      <script>
        async function envoyer() {
          const input = document.getElementById('msg');
          const text = input.value.trim();
          if(!text) return;

          await fetch('/envoyer-web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
          });

          input.value = '';
          document.getElementById('statut').innerText = 'Message envoyé !';
          setTimeout(() => document.getElementById('statut').innerText = '', 3000);
        }
      </script>
    </body>
    </html>
  `);
});

// 2. Le web envoie un message au serveur
app.post('/envoyer-web', (req, res) => {
  const { message } = req.body;
  if (message) {
    messages.push(message);
    console.log("Nouveau message web :", message);
  }
  res.json({ success: true });
});

// 3. Python vient récupérer les nouveaux messages
app.get('/recuperer-messages', (req, res) => {
  const aEnvoyer = [...messages];
  messages = []; // Vide la liste après récupération
  res.json({ messages: aEnvoyer });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));
