import os
import time
import requests
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Prompt

console = Console()
# Remplace cette URL par l'adresse exacte de ton serveur Render
SERVER_URL = "https://mon-serveur-chat.onrender.com"
MON_PSEUDO = "Nexus ia"

def effacer_ecran():
    console.clear()

def afficher_interface(questions):
    table = Table(show_header=True, header_style="bold magenta", expand=True)
    table.add_column("N°", style="bold yellow", width=4)
    table.add_column("Utilisateur", style="bold cyan", width=14)
    table.add_column("Dernier Message", style="white")
    table.add_column("Type", style="green", width=10)

    if not questions:
        table.add_row("-", "---", "Aucun nouveau message reçu", "---")
    else:
        for idx, item in enumerate(questions, 1):
            u = item.get("username", "Inconnu")
            msg = item.get("message", "")
            audio = "🎙️ Vocal" if item.get("audio") else "💬 Texte"
            table.add_row(str(idx), u, msg, audio)

    panel = Panel(
        table,
        title=f"[bold green]📱 NEXUS AI MOBILE - Admin: {MON_PSEUDO} 📱[/bold green]",
        subtitle="[bold yellow][1-9] Ouvrir chat | [r] Recherche | [q] Quitter | [Entrée] Actualiser[/bold yellow]"
    )
    return panel

def rafraichir():
    try:
        res = requests.get(f"{SERVER_URL}/recuperer-questions", timeout=3)
        if res.status_code == 200:
            return res.json().get("questions", [])
    except Exception:
        pass
    return []

def afficher_historique(destinataire):
    try:
        res = requests.get(f"{SERVER_URL}/chats/{destinataire}", timeout=5)
        chats = res.json().get("chats", [])
        
        table = Table(show_header=True, header_style="bold cyan", expand=True)
        table.add_column("Auteur", width=16)
        table.add_column("Message")

        if chats:
            messages = chats[0].get("messages", [])
            for m in messages:
                auteur = m.get("sender", "Inconnu")
                texte = m.get("text", "")
                
                if "groq" in auteur.lower():
                    nom_affiche = "[bold yellow]🤖 Groq (Auto)[/bold yellow]"
                elif auteur.lower() in [MON_PSEUDO.lower(), "admin", "nexus ai", "nexus ia"]:
                    nom_affiche = f"[bold green]🤖 {MON_PSEUDO}[/bold green]"
                else:
                    nom_affiche = f"[bold magenta]👤 {auteur}[/bold magenta]"
                
                table.add_row(nom_affiche, texte)
        else:
            table.add_row("---", "Aucune discussion trouvée.")

        console.print(Panel(table, title=f"💬 DISCUSSION : [bold yellow]{destinataire}[/bold yellow]"))
        return chats
    except Exception as e:
        console.print(f"[bold red]Erreur chargement historique : {e}[/bold red]")
        return []

def session_discussion(destinataire):
    while True:
        effacer_ecran()
        chats = afficher_historique(destinataire)
        
        console.print("\n[bold yellow]💡 Tape ton message, '/ia' pour faire répondre Groq, ou [Entrée] pour actualiser[/bold yellow]")
        console.print("[bold red]💡 Tape 'q' pour quitter cette conversation[/bold red]\n")
        
        reponse = Prompt.ask("💬 Ta réponse (/ia pour Groq)", default="").strip()

        # Quitter la discussion
        if reponse.lower() == 'q':
            break

        # Rafraîchissement manuel par touche Entrée
        if not reponse:
            continue

        # Traitement de la réponse
        if chats:
            cid = chats[0]["id"]
            est_commande_ia = (reponse.lower() == '/ia')
            
            payload = {
                "username": destinataire, 
                "chatId": cid, 
                "reponse": reponse,
                "admin": MON_PSEUDO,
                "forceIa": est_commande_ia
            }
            try:
                requests.post(f"{SERVER_URL}/repondre-humain", json=payload, timeout=5)
                if est_commande_ia:
                    console.print("[bold yellow]🤖 Demande transmise à Groq...[/bold yellow]")
                else:
                    console.print(f"[bold green]✅ Message envoyé ![/bold green]")
            except Exception as e:
                console.print(f"[bold red]Erreur d'envoi : {e}[/bold red]")
        else:
            console.print(f"[bold red]❌ Impossible d'envoyer, chat introuvable.[/bold red]")
        
        time.sleep(1.5)

if __name__ == "__main__":
    while True:
        try:
            questions = rafraichir()
            effacer_ecran()
            console.print(afficher_interface(questions))
            
            action = Prompt.ask("\n[bold green]Choix[/bold green]", default="").strip()

            # Sélection directe par numéro (1-9)
            if action.isdigit():
                idx = int(action) - 1
                if 0 <= idx < len(questions):
                    destinataire = questions[idx].get("username")
                    if destinataire:
                        session_discussion(destinataire)
                else:
                    console.print("[bold red]Numéro invalide ![/bold red]")
                    time.sleep(1)

            # Recherche manuelle
            elif action.lower() == "r":
                destinataire = Prompt.ask("👉 Pseudo de la personne").strip()
                if destinataire:
                    session_discussion(destinataire)

            # Quitter l'application
            elif action.lower() == "q":
                console.print("[bold yellow]Fermeture du panneau...[/bold yellow]")
                break

        except KeyboardInterrupt:
            console.print("\n[bold yellow]Fermeture...[/bold yellow]")
            break
