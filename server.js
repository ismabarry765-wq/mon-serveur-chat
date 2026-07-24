import tkinter as tk
from tkinter import scrolledtext
import requests
import threading
import time

SERVER_URL = "https://mon-serveur-chat.onrender.com"
dernier_contexte = {}

def ecouter_visiteurs():
    global dernier_contexte
    while True:
        try:
            res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=5)
            if res.status_code == 200:
                questions = res.json().get("questions", [])
                for item in questions:
                    u = item.get("username")
                    cid = item.get("chatId")
                    msg = item.get("message")
                    
                    dernier_contexte = {"username": u, "chatId": cid}
                    
                    zone_chat.config(state=tk.NORMAL)
                    zone_chat.insert(tk.END, f"\n[{u}] : {msg}\n")
                    zone_chat.config(state=tk.DISABLED)
                    zone_chat.yview(tk.END)
        except Exception:
            pass
        time.sleep(1)

def repondre_en_tant_que_nia():
    global dernier_contexte
    texte = entree.get().strip()
    if not texte or not dernier_contexte:
        return

    zone_chat.config(state=tk.NORMAL)
    zone_chat.insert(tk.END, f"[Moi -> {dernier_contexte['username']}] : {texte}\n")
    zone_chat.config(state=tk.DISABLED)
    zone_chat.yview(tk.END)
    entree.delete(0, tk.END)

    try:
        payload = {
            "username": dernier_contexte["username"],
            "chatId": dernier_contexte["chatId"],
            "reponse": texte
        }
        requests.post(f"{SERVER_URL}/repondre-humain", json=payload, timeout=5)
    except Exception as e:
        print("Erreur d'envoi :", e)

# Interface Python
fenetre = tk.Tk()
fenetre.title("Panneau Secret - Contrôle de Nia")
fenetre.geometry("480x520")

zone_chat = scrolledtext.ScrolledText(fenetre, wrap=tk.WORD, state=tk.DISABLED)
zone_chat.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

cadre = tk.Frame(fenetre)
cadre.pack(fill=tk.X, padx=10, pady=10)

entree = tk.Entry(cadre)
entree.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
entree.bind("<Return>", lambda e: repondre_en_tant_que_nia())

btn = tk.Button(cadre, text="Répondre", command=repondre_en_tant_que_nia)
btn.pack(side=tk.RIGHT)

threading.Thread(target=ecouter_visiteurs, daemon=True).start()
fenetre.mainloop()
