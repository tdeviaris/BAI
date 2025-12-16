#!/usr/bin/env python3
"""
Script pour créer des images de couverture placeholder pour les livres
Nécessite: pip install pillow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
DEST_DIR = "/Users/tdeviaris/Desktop/dev/BAI/img/books"
WIDTH = 400
HEIGHT = 600

# Couleurs par catégorie
COLORS = {
    "hasard": ("#FF0099", "#38BDF8"),
    "humanite": ("#38BDF8", "#22C55E"),
    "sociologie": ("#A855F7", "#F43F5E"),
    "semiotique": ("#FBBF24", "#FF0099"),
    "psychologie": ("#F43F5E", "#A855F7"),
    "philosophie": ("#22C55E", "#FBBF24"),
}

# Liste des livres
books = [
    ("hasard", "Antifragile", "Nassim Nicholas Taleb", "antifragile.jpg"),
    ("hasard", "Le Cygne Noir", "Nassim Nicholas Taleb", "cygne-noir.jpg"),
    ("hasard", "Le Hasard sauvage", "Nassim Nicholas Taleb", "hasard-sauvage.jpg"),
    ("hasard", "Jouer sa peau", "Nassim Nicholas Taleb", "jouer-sa-peau.jpg"),
    ("humanite", "Sapiens", "Yuval Noah Harari", "sapiens.jpg"),
    ("humanite", "Homo Deus", "Yuval Noah Harari", "homo-deus.jpg"),
    ("humanite", "21 Leçons pour\nle XXIème siècle", "Yuval Noah Harari", "21-lecons.jpg"),
    ("humanite", "Nexus", "Yuval Noah Harari", "nexus.jpg"),
    ("sociologie", "Sociologie générale\nVol. 1", "Pierre Bourdieu", "sociologie-generale.jpg"),
    ("sociologie", "Language and\nSymbolic Power", "Pierre Bourdieu", "language-symbolic-power.jpg"),
    ("sociologie", "Le vocabulaire de\nBourdieu", "C. Chauviré, O. Fontaine", "vocabulaire-bourdieu.jpg"),
    ("semiotique", "La Sémiotique\ndu langage", "Joseph Courtés", "semiotique-langage.jpg"),
    ("semiotique", "Sémiotique des\npassions", "Fontanille, Greimas", "semiotique-passions.jpg"),
    ("semiotique", "Introduction à la\nSémiologie", "Georges Mounin", "intro-semiologie.jpg"),
    ("semiotique", "La Sémiologie", "Luis J. Prieto", "la-semiologie.jpg"),
    ("psychologie", "Intuition", "Malcolm Gladwell", "intuition-gladwell.jpg"),
    ("psychologie", "Petit traité de\nmanipulation", "Joule, Beauvois", "petit-traite-manipulation.jpg"),
    ("psychologie", "Intuitions", "David O'Hare", "intuitions-ohare.jpg"),
    ("philosophie", "L'épistémologie", "Robert Blanché", "epistemologie.jpg"),
    ("philosophie", "Le rasoir d'Occam", "David Duncan", "rasoir-occam.jpg"),
    ("philosophie", "Le principe de\nsubsidiarité", "Chantal Millon-Delsol", "subsidiarite.jpg"),
    ("hasard", "Bienvenue en\nincertitude", "Philippe Silberzahn", "bienvenue-incertitude.jpg"),
    ("hasard", "La Synchronicité", "Kirby Surprise", "synchronicite.jpg"),
    ("hasard", "La voie de la\nsynchronicité", "Allan G. Hunter", "voie-synchronicite.jpg"),
    ("hasard", "Sérendipité", "Sylvie Catellin", "serendipite-catellin.jpg"),
    ("hasard", "C'est quoi la\nsérendipité?", "Bourcier, van Andel", "cest-quoi-serendipite.jpg"),
    ("psychologie", "La Vache pourpre", "Seth Godin", "vache-pourpre.jpg"),
    ("psychologie", "La Marque", "Benoît Heilbrunn", "la-marque.jpg"),
]

def create_cover(category, title, author, filename):
    """Crée une image de couverture pour un livre"""
    # Créer l'image avec un gradient
    img = Image.new('RGB', (WIDTH, HEIGHT), '#000000')
    draw = ImageDraw.Draw(img)

    # Gradient de couleur
    color1, color2 = COLORS.get(category, ("#38BDF8", "#FF0099"))

    # Dessiner un rectangle de fond avec effet gradient (simplifié)
    for y in range(HEIGHT):
        ratio = y / HEIGHT
        # Interpolation simple entre les deux couleurs
        r = int(int(color1[1:3], 16) * (1 - ratio) + int(color2[1:3], 16) * ratio)
        g = int(int(color1[3:5], 16) * (1 - ratio) + int(color2[3:5], 16) * ratio)
        b = int(int(color1[5:7], 16) * (1 - ratio) + int(color2[5:7], 16) * ratio)
        draw.rectangle([(0, y), (WIDTH, y + 1)], fill=(r, g, b))

    # Overlay semi-transparent
    overlay = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 100))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Essayer de charger une police système
    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 48)
        author_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 28)
    except:
        try:
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 48)
            author_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        except:
            title_font = ImageFont.load_default()
            author_font = ImageFont.load_default()

    # Dessiner le titre
    title_y = HEIGHT // 3
    for line in title.split('\n'):
        bbox = draw.textbbox((0, 0), line, font=title_font)
        text_width = bbox[2] - bbox[0]
        x = (WIDTH - text_width) // 2
        # Ombre
        draw.text((x + 2, title_y + 2), line, fill=(0, 0, 0, 180), font=title_font)
        # Texte
        draw.text((x, title_y), line, fill=(255, 255, 255, 255), font=title_font)
        title_y += 60

    # Dessiner l'auteur
    author_y = HEIGHT - 120
    for line in author.split('\n'):
        bbox = draw.textbbox((0, 0), line, font=author_font)
        text_width = bbox[2] - bbox[0]
        x = (WIDTH - text_width) // 2
        draw.text((x, author_y), line, fill=(255, 255, 255, 220), font=author_font)
        author_y += 35

    # Sauvegarder
    output_path = os.path.join(DEST_DIR, filename)
    img.save(output_path, 'JPEG', quality=85)
    print(f"✓ Créé: {filename}")

def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    print(f"Création des couvertures de livres dans {DEST_DIR}...")

    for category, title, author, filename in books:
        create_cover(category, title, author, filename)

    print(f"\n✓ {len(books)} couvertures créées avec succès!")

if __name__ == "__main__":
    main()
