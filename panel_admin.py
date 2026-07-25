import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import requests
import threading
import time
import os
import webbrowser
from datetime import datetime

# --- CONFIGURATION ---
SERVER_URL = "https://mon-serveur-chat.onrender.com"
ADMIN_NAME = "Nexus IA"

class NexusAdminGroq(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("🤖 Nexus Admin - Centre de Contrôle IA")
        self.geometry("1280x800")
        self.configure(bg="#0a0a0f")
        
        # Variables
        self.chat_actuel = None
        self.current_user = None
        self.questions_cache = []
        self.is_loading = False
        self.auto_refresh = True
        
        # Couleurs
        self.colors = {
            'bg_dark': '#0a0a0f',
            'bg_sidebar': '#14141a',
            'bg_chat': '#1a1a24',
            'bg_input': '#242433',
            'fg_primary': '#ffffff',
            'fg_secondary': '#8b8ba3',
            'accent': '#6c63ff',
            'accent_hover': '#7c73ff',
            'green': '#10b981',
            'red': '#ef4444',
            'yellow': '#f59e0b',
            'purple': '#8b5cf6'
        }
        
        self.creer_interface()
        self.demarrer_threads()

    def creer_interface(self):
        # === HEADER ===
        self.header = tk.Frame(self, bg=self.colors['bg_sidebar'], height=60)
        self.header.pack(side=tk.TOP, fill=tk.X)
        self.header.pack_propagate(False)
        
        # Logo et titre
        title_frame = tk.Frame(self.header, bg=self.colors['bg_sidebar'])
        title_frame.pack(side=tk.LEFT, padx=20, fill=tk.Y)
        
        tk.Label(title_frame, text="🤖 Nexus Admin", 
                font=("Segoe UI", 18, "bold"), 
                fg=self.colors['fg_primary'], 
                bg=self.colors['bg_sidebar']).pack(side=tk.LEFT)
        
        tk.Label(title_frame, text="v2.0", 
                font=("Segoe UI", 10), 
                fg=self.colors['fg_secondary'], 
                bg=self.colors['bg_sidebar']).pack(side=tk.LEFT, padx=8)
        
        # Statut
        status_frame = tk.Frame(self.header, bg=self.colors['bg_sidebar'])
        status_frame.pack(side=tk.RIGHT, padx=20, fill=tk.Y)
        
        self.status_dot = tk.Label(status_frame, text="●", 
                                   fg=self.colors['red'], 
                                   bg=self.colors['bg_sidebar'], 
                                   font=("Arial", 14))
        self.status_dot.pack(side=tk.LEFT, padx=5)
        
        self.lbl_status = tk.Label(status_frame, text="Hors-ligne", 
                                   fg=self.colors['fg_secondary'], 
                                   bg=self.colors['bg_sidebar'], 
                                   font=("Segoe UI", 10, "bold"))
        self.lbl_status.pack(side=tk.LEFT, padx=5)
        
        # Bouton vocal
        btn_vocal = tk.Button(self.header,
                            text="🎙️ Vocal",
                            bg=self.colors['yellow'],
                            fg="white",
                            font=("Segoe UI", 9, "bold"),
                            relief="flat",
                            padx=12,
                            pady=4,
                            cursor="hand2",
                            command=self.ouvrir_app_vocal)
        btn_vocal.pack(side=tk.RIGHT, padx=10)
        
        # === CONTENU PRINCIPAL ===
        main_container = tk.Frame(self, bg=self.colors['bg_dark'])
        main_container.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=2, pady=2)
        
        # === SIDEBAR ===
        self.sidebar = tk.Frame(main_container, bg=self.colors['bg_sidebar'], width=280)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y)
        self.sidebar.pack_propagate(False)
        
        # Titre sidebar
        sidebar_header = tk.Frame(self.sidebar, bg=self.colors['bg_sidebar'], height=40)
        sidebar_header.pack(fill=tk.X, padx=15, pady=10)
        
        tk.Label(sidebar_header, text="💬 Conversations", 
                fg=self.colors['fg_primary'], 
                bg=self.colors['bg_sidebar'], 
                font=("Segoe UI", 13, "bold")).pack(side=tk.LEFT)
        
        self.lbl_count = tk.Label(sidebar_header, text="0 actif", 
                                 fg=self.colors['fg_secondary'], 
                                 bg=self.colors['bg_sidebar'], 
                                 font=("Segoe UI", 9))
        self.lbl_count.pack(side=tk.RIGHT)
        
        # Liste des conversations
        self.chat_list = tk.Listbox(self.sidebar,
                                   bg=self.colors['bg_sidebar'],
                                   fg=self.colors['fg_primary'],
                                   font=("Segoe UI", 10),
                                   relief="flat",
                                   highlightthickness=0,
                                   selectbackground=self.colors['accent'],
                                   selectforeground="white",
                                   activestyle="none")
        self.chat_list.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        self.chat_list.bind("<<ListboxSelect>>", self.on_chat_selected)
        
        # Footer sidebar
        sidebar_footer = tk.Frame(self.sidebar, bg=self.colors['bg_sidebar'], height=50)
        sidebar_footer.pack(fill=tk.X, padx=15, pady=10)
        
        btn_refresh = tk.Button(sidebar_footer,
                              text="🔄 Rafraîchir",
                              bg=self.colors['bg_input'],
                              fg=self.colors['fg_primary'],
                              font=("Segoe UI", 9),
                              relief="flat",
                              cursor="hand2",
                              command=self.force_refresh)
        btn_refresh.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        btn_auto = tk.Button(sidebar_footer,
                            text="▶️ Auto",
                            bg=self.colors['bg_input'],
                            fg=self.colors['fg_primary'],
                            font=("Segoe UI", 9),
                            relief="flat",
                            cursor="hand2",
                            command=self.toggle_auto_refresh)
        btn_auto.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        # === ZONE CHAT ===
        self.chat_area = tk.Frame(main_container, bg=self.colors['bg_chat'])
        self.chat_area.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Header chat
        chat_header = tk.Frame(self.chat_area, bg=self.colors['bg_sidebar'], height=50)
        chat_header.pack(fill=tk.X)
        chat_header.pack_propagate(False)
        
        self.lbl_current_user = tk.Label(chat_header, 
                                        text="👤 Sélectionnez une conversation",
                                        fg=self.colors['fg_primary'],
                                        bg=self.colors['bg_sidebar'],
                                        font=("Segoe UI", 12, "bold"))
        self.lbl_current_user.pack(side=tk.LEFT, padx=20)
        
        # Info session
        self.lbl_session_info = tk.Label(chat_header,
                                        text="",
                                        fg=self.colors['fg_secondary'],
                                        bg=self.colors['bg_sidebar'],
                                        font=("Segoe UI", 9))
        self.lbl_session_info.pack(side=tk.LEFT, padx=10)
        
        # Boutons actions
        action_frame = tk.Frame(chat_header, bg=self.colors['bg_sidebar'])
        action_frame.pack(side=tk.RIGHT, padx=10)
        
        btn_force_ia = tk.Button(action_frame,
                                text="⚡ Forcer IA",
                                bg=self.colors['accent'],
                                fg="white",
                                font=("Segoe UI", 9, "bold"),
                                relief="flat",
                                padx=12,
                                pady=4,
                                cursor="hand2",
                                command=self.force_ia)
        btn_force_ia.pack(side=tk.LEFT, padx=2)
        
        # Zone d'affichage des messages
        self.txt_display = scrolledtext.ScrolledText(self.chat_area,
                                                     bg=self.colors['bg_chat'],
                                                     fg=self.colors['fg_primary'],
                                                     font=("Segoe UI", 10),
                                                     relief="flat",
                                                     wrap=tk.WORD,
                                                     padx=20,
                                                     pady=20)
        self.txt_display.pack(fill=tk.BOTH, expand=True)
        self.txt_display.config(state='disabled')
        
        # Configuration des tags pour les messages
        self.txt_display.tag_configure("user", 
                                      foreground="#8b8ba3",
                                      font=("Segoe UI", 9, "bold"))
        self.txt_display.tag_configure("ia", 
                                      foreground=self.colors['accent'],
                                      font=("Segoe UI", 9, "bold"))
        self.txt_display.tag_configure("admin", 
                                      foreground=self.colors['yellow'],
                                      font=("Segoe UI", 9, "bold"))
        self.txt_display.tag_configure("message", 
                                      foreground=self.colors['fg_primary'],
                                      font=("Segoe UI", 10))
        self.txt_display.tag_configure("timestamp", 
                                      foreground=self.colors['fg_secondary'],
                                      font=("Segoe UI", 8))
        
        # === ZONE D'ENTRÉE ===
        input_container = tk.Frame(self.chat_area, bg=self.colors['bg_sidebar'], height=70)
        input_container.pack(fill=tk.X)
        input_container.pack_propagate(False)
        
        input_wrapper = tk.Frame(input_container, bg=self.colors['bg_input'], padx=15, pady=8)
        input_wrapper.pack(fill=tk.X, padx=20, pady=10)
        
        self.ent_msg = tk.Entry(input_wrapper,
                               bg=self.colors['bg_input'],
                               fg=self.colors['fg_primary'],
                               font=("Segoe UI", 11),
                               relief="flat",
                               insertbackground=self.colors['fg_primary'])
        self.ent_msg.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)
        self.ent_msg.bind("<Return>", lambda e: self.send_message())
        
        btn_send = tk.Button(input_wrapper,
                            text="📤 Envoyer",
                            bg=self.colors['accent'],
                            fg="white",
                            font=("Segoe UI", 10, "bold"),
                            relief="flat",
                            padx=20,
                            pady=5,
                            cursor="hand2",
                            command=self.send_message)
        btn_send.pack(side=tk.RIGHT, padx=5)
        
        # Indicateur de chargement
        self.loading_label = tk.Label(input_container,
                                     text="",
                                     fg=self.colors['fg_secondary'],
                                     bg=self.colors['bg_sidebar'],
                                     font=("Segoe UI", 9, "italic"))
        self.loading_label.pack(side=tk.RIGHT, padx=20)

    def ouvrir_app_vocal(self):
        """Ouvre l'application vocale dans le navigateur"""
        dossier_actuel = os.path.dirname(os.path.abspath(__file__))
        chemin_html = os.path.join(dossier_actuel, "index.html")
        if os.path.exists(chemin_html):
            webbrowser.open(f"file://{chemin_html}")
        else:
            messagebox.showerror("Erreur", f"Fichier index.html introuvable")

    def toggle_auto_refresh(self):
        """Active/désactive le rafraîchissement automatique"""
        self.auto_refresh = not self.auto_refresh
        status = "▶️ Auto" if self.auto_refresh else "⏸️ Auto"
        # Mettre à jour le bouton
        for child in self.sidebar.winfo_children():
            if isinstance(child, tk.Frame):
                for btn in child.winfo_children():
                    if isinstance(btn, tk.Button) and "Auto" in btn.cget("text"):
                        btn.config(text=status)
                        break

    def check_server(self):
        """Vérifie l'état du serveur et récupère les conversations"""
        try:
            res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=3)
            if res.status_code == 200:
                self.status_dot.config(fg=self.colors['green'])
                self.lbl_status.config(text="En ligne", fg=self.colors['green'])
                data = res.json()
                self.questions_cache = data.get("questions", [])
                self.lbl_count.config(text=f"{len(self.questions_cache)} actif")
                self.update_listbox()
                return True
        except:
            self.status_dot.config(fg=self.colors['red'])
            self.lbl_status.config(text="Hors-ligne", fg=self.colors['red'])
        return False

    def update_listbox(self):
        """Met à jour la liste des conversations"""
        curr = self.chat_list.curselection()
        self.chat_list.delete(0, tk.END)
        for q in self.questions_cache:
            icon = "🎙️" if q.get("audio") else "💬"
            count = q.get("messageCount", 0)
            # Afficher le dernier message en aperçu
            last_msg = ""
            if q.get("messages") and len(q["messages"]) > 0:
                last = q["messages"][-1].get("text", "")[:25]
                if last:
                    last_msg = f" - {last}..."
            self.chat_list.insert(tk.END, f" {icon} {q['username']} ({count}){last_msg}")
        if curr and curr[0] < self.chat_list.size():
            self.chat_list.selection_set(curr[0])

    def on_chat_selected(self, event):
        """Gère la sélection d'une conversation"""
        sel = self.chat_list.curselection()
        if not sel:
            return
        try:
            data = self.questions_cache[sel[0]]
            self.chat_actuel = data["chatId"]
            self.current_user = data["username"]
            self.lbl_current_user.config(text=f"👤 {data['username']}")
            self.lbl_session_info.config(text=f"ID: {data['chatId'][:12]}...")
            self.refresh_chat_display()
        except IndexError:
            pass

    def refresh_chat_display(self):
        """Rafraîchit l'affichage des messages"""
        if not self.current_user:
            return
        try:
            res = requests.get(f"{SERVER_URL}/get-history?chatId={self.chat_actuel}&username={self.current_user}", timeout=5)
            if res.status_code == 200:
                data = res.json()
                messages = data.get("messages", [])
                self.txt_display.config(state='normal')
                self.txt_display.delete("1.0", tk.END)
                
                for m in messages:
                    sender = m.get("sender")
                    text = m.get("text")
                    timestamp = m.get("timestamp", "")
                    
                    # Formater le message
                    if sender == self.current_user:
                        tag = "user"
                        label = "👤"
                    elif sender == "Groq IA":
                        tag = "ia"
                        label = "🤖"
                    elif sender == "Admin":
                        tag = "admin"
                        label = "👑"
                    else:
                        tag = "user"
                        label = "💬"
                    
                    self.txt_display.insert(tk.END, f"{label} [{sender}] ", tag)
                    if timestamp:
                        self.txt_display.insert(tk.END, f"({timestamp}) ", "timestamp")
                    self.txt_display.insert(tk.END, f"\n{text}\n\n", "message")
                
                self.txt_display.config(state='disabled')
                self.txt_display.see(tk.END)
        except Exception as e:
            print(f"Erreur refresh: {e}")

    def send_message(self):
        """Envoie un message manuel"""
        msg = self.ent_msg.get().strip()
        if not msg or not self.chat_actuel:
            if not self.chat_actuel:
                messagebox.showwarning("Attention", "Sélectionnez une conversation d'abord")
            return
        try:
            self.loading_label.config(text="📤 Envoi en cours...")
            res = requests.post(f"{SERVER_URL}/repondre-humain", 
                              json={
                                  "chatId": self.chat_actuel,
                                  "reponse": msg,
                                  "admin": ADMIN_NAME
                              }, timeout=10)
            if res.status_code == 200:
                self.ent_msg.delete(0, tk.END)
                self.loading_label.config(text="✅ Message envoyé")
                self.after(2000, lambda: self.loading_label.config(text=""))
                self.refresh_chat_display()
            else:
                self.loading_label.config(text="❌ Erreur d'envoi")
        except Exception as e:
            self.loading_label.config(text=f"❌ {str(e)[:30]}")
            messagebox.showerror("Erreur", str(e))

    def force_ia(self):
        """Force une réponse de l'IA"""
        if not self.chat_actuel:
            messagebox.showwarning("Attention", "Sélectionnez une conversation")
            return
        try:
            self.loading_label.config(text="⚡ Génération IA forcée...")
            # Envoyer un message vide pour déclencher l'IA
            res = requests.post(f"{SERVER_URL}/message", 
                              json={
                                  "chatId": self.chat_actuel,
                                  "username": self.current_user,
                                  "text": "Génère une réponse automatique"
                              }, timeout=30)
            if res.status_code == 200:
                self.loading_label.config(text="✅ IA forcée")
                self.after(2000, lambda: self.loading_label.config(text=""))
                self.refresh_chat_display()
        except Exception as e:
            self.loading_label.config(text=f"❌ {str(e)[:30]}")

    def force_refresh(self):
        """Force le rafraîchissement"""
        self.loading_label.config(text="🔄 Rafraîchissement...")
        self.check_server()
        if self.current_user:
            self.refresh_chat_display()
        self.loading_label.config(text="✅ Rafraîchi")
        self.after(2000, lambda: self.loading_label.config(text=""))

    def demarrer_threads(self):
        """Démarre les threads de surveillance"""
        def loop():
            while True:
                try:
                    if self.auto_refresh:
                        self.check_server()
                        # Rafraîchir automatiquement l'affichage si une conversation est sélectionnée
                        if self.current_user:
                            self.refresh_chat_display()
                except:
                    pass
                time.sleep(3)
        
        thread = threading.Thread(target=loop, daemon=True)
        thread.start()

if __name__ == "__main__":
    app = NexusAdminGroq()
    app.mainloop()
