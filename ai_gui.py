import tkinter as tk
from tkinter import scrolledtext
import requests
import threading
import time

SERVER_URL = "https://mon-serveur-chat.onrender.com"

# Stockage local : { username: { chatId: ..., messages: [] } }
conversations = {}
utilisateur_actif = None

def ecouter_visiteurs():
    global utilisateur_actif
    while True:
        try:
            res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=5)
            if res.status_code == 200:
                questions = res.json().get("questions", [])
                for item in questions:
                    u = item.get("username")
                    cid = item.get("chatId")
                    msg = item.get("message")

                    if u not in conversations:
                        conversations[u] = {"chatId": cid, "messages": []}
                        liste_users.insert(tk.END, u)
                    
                    conversations[u]["chatId"] = cid
                    conversations[u]["messages"].append((f"👤 [{u}]", msg))

                    # Si on est sur cet utilisateur, rafraîchir la vue
                    if utilisateur_actif == u:
                        afficher_messages_utilisateur(u)
                    else:
                        lbl_status.config(text=f"💬 Nouveau message de {u} !", fg="#f38ba8")
        except Exception:
            pass
        time.sleep(1)

def selectionner_utilisateur(event):
    global utilisateur_actif
    selection = liste_users.curselection()
    if selection:
        user = liste_users.get(selection[0])
        utilisateur_actif = user
        lbl_status.config(text=f"Discussion avec : {user}", fg="#a6e3a1")
        afficher_messages_utilisateur(user)

def afficher_messages_utilisateur(user):
    zone_chat.config(state=tk.NORMAL)
    zone_chat.delete("1.0", tk.END)
    for auteur, text in conversations[user]["messages"]:
        tag = "user_tag" if "👤" in auteur else "nexus_tag"
        zone_chat.insert(tk.END, f"\n{auteur} :\n", tag)
        zone_chat.insert(tk.END, f" {text}\n", "msg_tag")
    zone_chat.config(state=tk.DISABLED)
    zone_chat.yview(tk.END)

def repondre_en_tant_que_nexus():
    global utilisateur_actif
    texte = entree.get().strip()
    if not texte or not utilisateur_actif:
        return

    cid = conversations[utilisateur_actif]["chatId"]
    conversations[utilisateur_actif]["messages"].append((f"🌐 [Nexus AI -> {utilisateur_actif}]", texte))
    afficher_messages_utilisateur(utilisateur_actif)
    entree.delete(0, tk.END)

    try:
        payload = {"username": utilisateur_actif, "chatId": cid, "reponse": texte}
        requests.post(f"{SERVER_URL}/repondre-humain", json=payload, timeout=5)
    except Exception as e:
        print("Erreur d'envoi :", e)

# --- Interface Panneau Secret Python ---
fenetre = tk.Tk()
fenetre.title("⚡ Panneau de Contrôle Multi-Users - Nexus AI")
fenetre.geometry("700x550")
fenetre.configure(bg="#1e1e2e")

# Barre latérale (Utilisateurs)
cadre_gauche = tk.Frame(fenetre, bg="#181825", width=200)
cadre_gauche.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)

lbl_users = tk.Label(cadre_gauche, text="Utilisateurs", bg="#181825", fg="#cdd6f4", font=("Segoe UI", 11, "bold"))
lbl_users.pack(pady=10)

liste_users = tk.Listbox(cadre_gauche, bg="#313244", fg="#cdd6f4", selectbackground="#6366f1", bd=0, font=("Segoe UI", 10))
liste_users.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
liste_users.bind("<<ListboxSelect>>", selectionner_utilisateur)

# Zone Droite (Chat)
cadre_droite = tk.Frame(fenetre, bg="#1e1e2e")
cadre_droite.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)

lbl_status = tk.Label(cadre_droite, text="Sélectionne un utilisateur à gauche", bg="#1e1e2e", fg="#6c7086", font=("Segoe UI", 10, "bold"))
lbl_status.pack(pady=5)

zone_chat = scrolledtext.ScrolledText(cadre_droite, wrap=tk.WORD, bg="#181825", fg="#cdd6f4", font=("Segoe UI", 10), bd=0)
zone_chat.pack(padx=5, pady=5, fill=tk.BOTH, expand=True)

zone_chat.tag_config("user_tag", foreground="#89b4fa", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("nexus_tag", foreground="#a6e3a1", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("msg_tag", foreground="#cdd6f4")
zone_chat.config(state=tk.DISABLED)

cadre_saisie = tk.Frame(cadre_droite, bg="#1e1e2e")
cadre_saisie.pack(fill=tk.X, pady=5)

entree = tk.Entry(cadre_saisie, bg="#313244", fg="#cdd6f4", font=("Segoe UI", 11), bd=0)
entree.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=8, padx=(0, 5))
entree.bind("<Return>", lambda e: repondre_en_tant_que_nexus())

btn = tk.Button(cadre_saisie, text="Envoyer ➔", command=repondre_en_tant_que_nexus, bg="#6366f1", fg="white", font=("Segoe UI", 10, "bold"), bd=0, padx=15)
btn.pack(side=tk.RIGHT, ipady=6)

threading.Thread(target=ecouter_visiteurs, daemon=True).start()
fenetre.mainloop()
