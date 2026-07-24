import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog
import requests
import threading
import time
import base64
from io import BytesIO

try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import speech_recognition as sr
    HAS_SR = True
except ImportError:
    HAS_SR = False

SERVER_URL = "https://mon-serveur-chat.onrender.com"

conversations = {}
utilisateur_actif = None
images_cache = []

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
                    img = item.get("image")

                    if u not in conversations:
                        conversations[u] = {"chatId": cid, "messages": []}
                        liste_users.insert(tk.END, u)
                    
                    conversations[u]["chatId"] = cid
                    conversations[u]["messages"].append((f"👤 [{u}]", msg, img))

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
    images_cache.clear()

    for auteur, text, img_b64 in conversations[user]["messages"]:
        tag = "user_tag" if "👤" in auteur else "nexus_tag"
        zone_chat.insert(tk.END, f"\n{auteur} :\n", tag)
        if text:
            zone_chat.insert(tk.END, f" {text}\n", "msg_tag")
        
        if img_b64 and HAS_PIL:
            try:
                raw_data = base64.b64decode(img_b64.split(",")[1] if "," in img_b64 else img_b64)
                img = Image.open(BytesIO(raw_data))
                img.thumbnail((200, 200))
                photo = ImageTk.PhotoImage(img)
                images_cache.append(photo)
                zone_chat.image_insert(tk.END, image=photo)
                zone_chat.insert(tk.END, "\n")
            except Exception as e:
                zone_chat.insert(tk.END, " [Erreur affichage image]\n", "msg_tag")

    zone_chat.config(state=tk.DISABLED)
    zone_chat.yview(tk.END)

def corriger_avec_groq(texte, api_key):
    try:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        data = {
            "model": "llama-3.1-8b-instant",
            "messages": [
                {"role": "system", "content": "Tu es un correcteur d'orthographe. Corrige le texte sans ajouter de commentaires."},
                {"role": "user", "content": texte}
            ]
        }
        r = requests.post("https://api.groq.com/openai/v1/chat/completions", json=data, headers=headers, timeout=5)
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        pass
    return texte

def valider_et_envoyer():
    global utilisateur_actif
    texte = entree.get().strip()
    api_key = entree_groq.get().strip()

    if not texte or not utilisateur_actif:
        return

    if api_key:
        texte_corrige = corriger_avec_groq(texte, api_key)
        if texte_corrige.lower() != texte.lower():
            proposer_correction(texte, texte_corrige)
            return

    envoyer_final(texte)

def proposer_correction(original, corrige):
    popup = tk.Toplevel(fenetre)
    popup.title("Correction Groq")
    popup.geometry("450x240")
    popup.configure(bg="#1e1e2e")

    tk.Label(popup, text="Groq suggère une correction :", bg="#1e1e2e", fg="#ffffff", font=("Segoe UI", 11, "bold")).pack(pady=10)
    tk.Label(popup, text=corrige, bg="#313244", fg="#a6e3a1", font=("Segoe UI", 11), wraplength=380, pady=10).pack(fill=tk.X, padx=20)

    cadre_btn = tk.Frame(popup, bg="#1e1e2e")
    cadre_btn.pack(pady=15)

    tk.Button(cadre_btn, text="Oui", command=lambda: [popup.destroy(), envoyer_final(corrige)], bg="#a6e3a1", fg="#11111b", font=("Segoe UI", 10, "bold"), padx=15).pack(side=tk.LEFT, padx=10)
    tk.Button(cadre_btn, text="Non", command=lambda: [popup.destroy(), envoyer_final(original)], bg="#f38ba8", fg="#11111b", font=("Segoe UI", 10, "bold"), padx=15).pack(side=tk.RIGHT, padx=10)

def envoyer_final(texte, image_b64=None):
    global utilisateur_actif
    cid = conversations[utilisateur_actif]["chatId"]
    conversations[utilisateur_actif]["messages"].append((f"🌐 [Nexus AI -> {utilisateur_actif}]", texte, image_b64))
    afficher_messages_utilisateur(utilisateur_actif)
    entree.delete(0, tk.END)

    try:
        payload = {"username": utilisateur_actif, "chatId": cid, "reponse": texte, "image": image_b64}
        requests.post(f"{SERVER_URL}/repondre-humain", json=payload, timeout=5)
    except Exception as e:
        print("Erreur d'envoi :", e)

def joindre_image():
    if not utilisateur_actif:
        return
    file_path = filedialog.askopenfilename(filetypes=[("Images", "*.png;*.jpg;*.jpeg;*.webp")])
    if file_path:
        with open(file_path, "rb") as f:
            b64_str = "data:image/png;base64," + base64.b64encode(f.read()).decode('utf-8')
            envoyer_final("📷 [Image envoyée]", b64_str)

# Interface GUI
fenetre = tk.Tk()
fenetre.title("⚡ Panneau de Contrôle - Nexus AI")
fenetre.geometry("750x620")
fenetre.configure(bg="#1e1e2e")

cadre_haut = tk.Frame(fenetre, bg="#181825")
cadre_haut.pack(fill=tk.X, padx=5, pady=5)
tk.Label(cadre_haut, text="🔑 Clé API Groq :", bg="#181825", fg="#cdd6f4", font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT, padx=5)
entree_groq = tk.Entry(cadre_haut, bg="#313244", fg="#cdd6f4", show="*", font=("Segoe UI", 9), bd=0)
entree_groq.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4, padx=5)

cadre_gauche = tk.Frame(fenetre, bg="#181825", width=200)
cadre_gauche.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)
tk.Label(cadre_gauche, text="Utilisateurs", bg="#181825", fg="#cdd6f4", font=("Segoe UI", 11, "bold")).pack(pady=10)
liste_users = tk.Listbox(cadre_gauche, bg="#313244", fg="#cdd6f4", selectbackground="#6366f1", bd=0, font=("Segoe UI", 10))
liste_users.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
liste_users.bind("<<ListboxSelect>>", selectionner_utilisateur)

cadre_droite = tk.Frame(fenetre, bg="#1e1e2e")
cadre_droite.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)
lbl_status = tk.Label(cadre_droite, text="Sélectionne un utilisateur", bg="#1e1e2e", fg="#6c7086", font=("Segoe UI", 10, "bold"))
lbl_status.pack(pady=5)

zone_chat = scrolledtext.ScrolledText(cadre_droite, wrap=tk.WORD, bg="#181825", fg="#cdd6f4", font=("Segoe UI", 10), bd=0)
zone_chat.pack(padx=5, pady=5, fill=tk.BOTH, expand=True)
zone_chat.tag_config("user_tag", foreground="#89b4fa", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("nexus_tag", foreground="#a6e3a1", font=("Segoe UI", 10, "bold"))
zone_chat.tag_config("msg_tag", foreground="#cdd6f4")
zone_chat.config(state=tk.DISABLED)

cadre_saisie = tk.Frame(cadre_droite, bg="#1e1e2e")
cadre_saisie.pack(fill=tk.X, pady=5)

btn_img = tk.Button(cadre_saisie, text="+", command=joindre_image, bg="#313244", fg="white", font=("Segoe UI", 11, "bold"), bd=0, padx=10)
btn_img.pack(side=tk.LEFT, ipady=4, padx=(0, 5))

entree = tk.Entry(cadre_saisie, bg="#313244", fg="#cdd6f4", font=("Segoe UI", 11), bd=0)
entree.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=8, padx=(0, 5))
entree.bind("<Return>", lambda e: valider_et_envoyer())

btn = tk.Button(cadre_saisie, text="Envoyer ➔", command=valider_et_envoyer, bg="#6366f1", fg="white", font=("Segoe UI", 10, "bold"), bd=0, padx=15)
btn.pack(side=tk.RIGHT, ipady=6)

threading.Thread(target=ecouter_visiteurs, daemon=True).start()
fenetre.mainloop()
