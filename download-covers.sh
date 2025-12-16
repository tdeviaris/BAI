#!/bin/bash

# Script pour télécharger les couvertures de livres
# Assurez-vous d'avoir curl installé

DEST_DIR="/Users/tdeviaris/Desktop/dev/BAI/img/books"
mkdir -p "$DEST_DIR"

echo "Téléchargement des couvertures de livres..."

# Nassim Nicholas Taleb
curl -L "https://m.media-amazon.com/images/I/71FPaUUSTEL._SY466_.jpg" -o "$DEST_DIR/antifragile.jpg"
curl -L "https://m.media-amazon.com/images/I/71vT0d5sJUL._SY466_.jpg" -o "$DEST_DIR/cygne-noir.jpg"
curl -L "https://m.media-amazon.com/images/I/71-vQGDP9TL._SY466_.jpg" -o "$DEST_DIR/hasard-sauvage.jpg"
curl -L "https://m.media-amazon.com/images/I/71K8c7EoSpL._SY466_.jpg" -o "$DEST_DIR/jouer-sa-peau.jpg"

# Yuval Noah Harari
curl -L "https://m.media-amazon.com/images/I/71Gu-B4BVkL._SY466_.jpg" -o "$DEST_DIR/sapiens.jpg"
curl -L "https://m.media-amazon.com/images/I/71aG+xDKSYL._SY466_.jpg" -o "$DEST_DIR/homo-deus.jpg"
curl -L "https://m.media-amazon.com/images/I/71JrB33QHHL._SY466_.jpg" -o "$DEST_DIR/21-lecons.jpg"
curl -L "https://m.media-amazon.com/images/I/81kGJJ5LbTL._SY466_.jpg" -o "$DEST_DIR/nexus.jpg"

# Pierre Bourdieu
curl -L "https://m.media-amazon.com/images/I/71pBX0ZAYBL._SY466_.jpg" -o "$DEST_DIR/sociologie-generale.jpg"
curl -L "https://m.media-amazon.com/images/I/71Y8kp9DHGL._SY466_.jpg" -o "$DEST_DIR/language-symbolic-power.jpg"
curl -L "https://m.media-amazon.com/images/I/51hxVx3KLNL._SY466_.jpg" -o "$DEST_DIR/vocabulaire-bourdieu.jpg"

# Sémiotique
curl -L "https://www.armand-colin.com/sites/default/files/styles/livre_page_edition/public/2022-07/9782200632946.jpg" -o "$DEST_DIR/semiotique-langage.jpg"
curl -L "https://m.media-amazon.com/images/I/51ZQN5YZKGL._SY466_.jpg" -o "$DEST_DIR/semiotique-passions.jpg"
curl -L "https://m.media-amazon.com/images/I/51YQH6X4YJL._SY466_.jpg" -o "$DEST_DIR/intro-semiologie.jpg"
curl -L "https://m.media-amazon.com/images/I/51CK8VDGX9L._SY466_.jpg" -o "$DEST_DIR/la-semiologie.jpg"

# Psychologie
curl -L "https://m.media-amazon.com/images/I/71lW95S1wiL._SY466_.jpg" -o "$DEST_DIR/intuition-gladwell.jpg"
curl -L "https://m.media-amazon.com/images/I/71gZwmYFBgL._SY466_.jpg" -o "$DEST_DIR/petit-traite-manipulation.jpg"
curl -L "https://m.media-amazon.com/images/I/71YpQ3ZZXZL._SY466_.jpg" -o "$DEST_DIR/intuitions-ohare.jpg"

# Philosophie
curl -L "https://m.media-amazon.com/images/I/51WpqNMF7TL._SY466_.jpg" -o "$DEST_DIR/epistemologie.jpg"
curl -L "https://m.media-amazon.com/images/I/71nNMYQ9nPL._SY466_.jpg" -o "$DEST_DIR/rasoir-occam.jpg"
curl -L "https://m.media-amazon.com/images/I/51BQZQP6HJL._SY466_.jpg" -o "$DEST_DIR/subsidiarite.jpg"

# Hasard & Incertitude (suite)
curl -L "https://m.media-amazon.com/images/I/71oJhBK+AFL._SY466_.jpg" -o "$DEST_DIR/bienvenue-incertitude.jpg"
curl -L "https://m.media-amazon.com/images/I/71xPp3KKEYL._SY466_.jpg" -o "$DEST_DIR/synchronicite.jpg"
curl -L "https://m.media-amazon.com/images/I/71mFLF6PUFL._SY466_.jpg" -o "$DEST_DIR/voie-synchronicite.jpg"
curl -L "https://m.media-amazon.com/images/I/51L0PJKR7QL._SY466_.jpg" -o "$DEST_DIR/serendipite-catellin.jpg"
curl -L "https://m.media-amazon.com/images/I/51+vYqjDCNL._SY466_.jpg" -o "$DEST_DIR/cest-quoi-serendipite.jpg"

# Marketing & Marques
curl -L "https://m.media-amazon.com/images/I/71wF0dTPa3L._SY466_.jpg" -o "$DEST_DIR/vache-pourpre.jpg"
curl -L "https://m.media-amazon.com/images/I/51Y9JPQMF8L._SY466_.jpg" -o "$DEST_DIR/la-marque.jpg"

echo "Téléchargement terminé! Les images sont dans $DEST_DIR"
