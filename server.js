const express = require('express');
const cors = require('cors');

const app = express();

// Middleware pour autoriser les requêtes cross-origin (CORS) et parser le JSON
app.use(cors());
app.use(express.json());

// 1. Route de test (page d'accueil dans le navigateur)
app.get('/', (req, res) => {
  res.send('🚀 Serveur Chat IA en ligne et opérationnel sur Render !');
});

// 2. Route POST /chat (appelée par ai_gui.py)
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Le message ne peut pas être vide.' });
    }

    console.log(`[Message reçu] : ${userMessage}`);

    // --- LOGIQUE DE RÉPONSE ---
    // (Tu peux remplacer cette logique par un vrai appel à une API comme OpenAI, Gemini, etc.)
    const botReply = `J'ai bien reçu ton message : "${userMessage}"`;

    // Renvoie la réponse au format JSON avec la clé "reply"
    return res.json({ reply: botReply });

  } catch (error) {
    console.error('Erreur serveur :', error);
    return res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur.' });
  }
});

// Définition du port (Render attribue un port dynamiquement via process.env.PORT)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Le serveur tourne sur le port ${PORT}`);
});
