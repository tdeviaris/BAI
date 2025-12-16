#!/usr/bin/env python3
"""
Script pour scraper les couvertures de livres depuis Amazon.fr
Utilise les URLs du fichier bibliotheque.json et sauvegarde les images dans img/books/

Nécessite: pip install requests beautifulsoup4 lxml pillow
"""

import json
import os
import sys
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).parent.parent
JSON_PATH = BASE_DIR / "data" / "bibliotheque.json"
IMG_DIR = BASE_DIR / "img" / "books"

# Headers pour simuler un navigateur
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}

def load_books():
    """Charge la liste des livres depuis le fichier JSON"""
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data.get('livres', [])
    except FileNotFoundError:
        print(f"❌ Fichier non trouvé: {JSON_PATH}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Erreur de lecture JSON: {e}")
        sys.exit(1)

def get_cover_url_from_amazon(url, expected_title, expected_author):
    """
    Scrape la page Amazon pour récupérer l'URL de la couverture
    Vérifie la cohérence du livre avec le titre et l'auteur attendus
    """
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'lxml')

        # Vérification : extraire le titre de la page
        page_title = None
        title_selectors = [
            '#productTitle',
            'h1.a-size-large',
            'span#ebooksProductTitle',
        ]

        for selector in title_selectors:
            title_elem = soup.select_one(selector)
            if title_elem:
                page_title = title_elem.get_text(strip=True)
                break

        # Vérification : extraire l'auteur de la page
        page_author = None
        author_selectors = [
            '.author .contributorNameID',
            '.author a.a-link-normal',
            'span.author a',
            '#bylineInfo .author a',
        ]

        for selector in author_selectors:
            author_elem = soup.select_one(selector)
            if author_elem:
                page_author = author_elem.get_text(strip=True)
                break

        # Comparer avec les valeurs attendues
        title_match = False
        author_match = False

        if page_title:
            # Normalisation pour comparaison souple
            normalized_page_title = page_title.lower().strip()
            normalized_expected = expected_title.lower().strip()

            # Vérifier si le titre contient ou est contenu dans l'attendu
            title_match = (normalized_expected in normalized_page_title or
                          normalized_page_title in normalized_expected)

        if page_author:
            normalized_page_author = page_author.lower().strip()
            normalized_expected_author = expected_author.lower().strip()

            # Vérifier si l'auteur correspond
            author_match = (normalized_expected_author in normalized_page_author or
                           normalized_page_author in normalized_expected_author)

        # Si on a trouvé un titre mais qu'il ne correspond pas
        if page_title and not title_match:
            print(f"  ⚠️  ATTENTION : Titre incohérent!")
            print(f"      Attendu : '{expected_title}'")
            print(f"      Trouvé  : '{page_title}'")
            return None, "ERREUR_TITRE"

        # Si on a trouvé un auteur mais qu'il ne correspond pas
        if page_author and not author_match:
            print(f"  ⚠️  ATTENTION : Auteur incohérent!")
            print(f"      Attendu : '{expected_author}'")
            print(f"      Trouvé  : '{page_author}'")
            return None, "ERREUR_AUTEUR"

        # Plusieurs sélecteurs possibles pour trouver l'image de couverture
        selectors = [
            '#imgBlkFront',  # Image principale du livre
            '#ebooksImgBlkFront',  # Pour les ebooks
            '#main-image',
            'img[data-a-dynamic-image]',  # Image avec data dynamique
            '.a-dynamic-image',
        ]

        cover_url = None

        for selector in selectors:
            img = soup.select_one(selector)
            if img:
                # Essayer différents attributs
                cover_url = img.get('src') or img.get('data-old-hires') or img.get('data-a-dynamic-image')

                # Si c'est un JSON dans data-a-dynamic-image
                if cover_url and cover_url.startswith('{'):
                    try:
                        images = json.loads(cover_url)
                        # Prendre la plus grande image
                        cover_url = max(images.keys(), key=lambda k: images[k][0] * images[k][1])
                    except:
                        pass

                if cover_url:
                    # Nettoyer l'URL (enlever les paramètres de taille)
                    if '._' in cover_url:
                        cover_url = cover_url.split('._')[0] + '.jpg'
                    break

        if not cover_url:
            # Chercher dans toutes les images
            all_imgs = soup.find_all('img', {'class': lambda x: x and 'bookImage' in x or 'imageBlock' in x})
            for img in all_imgs:
                src = img.get('src', '')
                if 'images-amazon.com/images/I/' in src:
                    cover_url = src
                    break

        if cover_url:
            print(f"  ✓ Vérifications OK - Titre: {page_title or 'N/A'}")
            print(f"                     Auteur: {page_author or 'N/A'}")

        return cover_url, None

    except requests.RequestException as e:
        print(f"  ⚠️  Erreur de requête: {e}")
        return None, "ERREUR_RESEAU"
    except Exception as e:
        print(f"  ⚠️  Erreur inattendue: {e}")
        return None, "ERREUR_INCONNUE"

def download_image(url, output_path):
    """Télécharge une image depuis une URL"""
    try:
        response = requests.get(url, headers=HEADERS, timeout=10, stream=True)
        response.raise_for_status()

        with open(output_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return True
    except Exception as e:
        print(f"  ❌ Échec du téléchargement: {e}")
        return False

def main():
    print("🔍 Scraping des couvertures Amazon.fr...\n")

    # Créer le dossier de destination
    IMG_DIR.mkdir(parents=True, exist_ok=True)

    # Charger les livres
    books = load_books()
    print(f"📚 {len(books)} livres trouvés dans {JSON_PATH}\n")

    success_count = 0
    skip_count = 0
    fail_count = 0
    error_count = 0
    errors = []

    for i, book in enumerate(books, 1):
        titre = book.get('titre', 'Sans titre')
        auteur = book.get('auteur', 'Auteur inconnu')
        image = book.get('image', '')
        url_amazon = book.get('url_amazon', '')

        if not url_amazon:
            print(f"{i}. ⏭️  {titre} - Pas d'URL Amazon")
            skip_count += 1
            continue

        # Extraire le nom du fichier depuis le champ image
        if image:
            filename = Path(image).name
            output_path = IMG_DIR / filename
        else:
            print(f"{i}. ⚠️  {titre} - Pas de nom de fichier image défini")
            skip_count += 1
            continue

        # Vérifier si l'image existe déjà
        if output_path.exists():
            file_size = output_path.stat().st_size
            # Si le fichier fait plus de 5KB, on considère qu'il est valide
            if file_size > 5000:
                print(f"{i}. ✓ {titre} - Image déjà présente ({file_size // 1024}KB)")
                success_count += 1
                continue
            else:
                print(f"{i}. 🔄 {titre} - Image trop petite ({file_size}B), re-téléchargement...")

        print(f"{i}. 📥 {titre}")
        print(f"    Auteur: {auteur}")
        print(f"    URL: {url_amazon}")

        # Scraper l'URL de la couverture avec vérification
        cover_url, error_code = get_cover_url_from_amazon(url_amazon, titre, auteur)

        if error_code:
            print(f"  ❌ Erreur: {error_code}")
            errors.append({
                'titre': titre,
                'auteur': auteur,
                'url': url_amazon,
                'erreur': error_code
            })
            error_count += 1
            fail_count += 1
            time.sleep(2)
            continue

        if not cover_url:
            print(f"  ❌ Impossible de trouver l'image de couverture")
            fail_count += 1
            time.sleep(2)
            continue

        print(f"    Image trouvée: {cover_url[:80]}...")

        # Télécharger l'image
        if download_image(cover_url, output_path):
            file_size = output_path.stat().st_size
            print(f"  ✅ Téléchargé: {filename} ({file_size // 1024}KB)")
            success_count += 1
        else:
            fail_count += 1

        # Délai entre les requêtes pour ne pas surcharger Amazon
        time.sleep(2)

    print("\n" + "="*60)
    print(f"📊 Résumé:")
    print(f"  ✅ Succès: {success_count}")
    print(f"  ⏭️  Ignorés: {skip_count}")
    print(f"  ❌ Échecs: {fail_count}")
    if error_count > 0:
        print(f"  ⚠️  Erreurs de cohérence: {error_count}")
    print(f"  📁 Images dans: {IMG_DIR}")
    print("="*60)

    # Afficher le détail des erreurs de cohérence
    if errors:
        print("\n⚠️  ERREURS DE COHÉRENCE DÉTECTÉES:")
        print("="*60)
        for err in errors:
            print(f"\n❌ {err['titre']}")
            print(f"   Auteur: {err['auteur']}")
            print(f"   URL: {err['url']}")
            print(f"   Erreur: {err['erreur']}")
        print("\n" + "="*60)
        print("⚠️  Veuillez vérifier et corriger les URLs dans bibliotheque.json")
        print("="*60)

if __name__ == "__main__":
    main()
