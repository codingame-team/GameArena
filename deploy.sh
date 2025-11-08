#!/bin/bash
# Script de déploiement GameArena
# Usage: ./deploy.sh [dev|prod] [options]
# Options:
#   --host IP           Adresse IP du serveur Docker distant
#   --port PORT         Port SSH (défaut: 22) ou Docker (défaut: 2376 pour TLS)
#   --user USER         Utilisateur SSH (défaut: root)
#   --docker-host URI   Docker host URI (ssh://user@host:port, tcp://host:2376, etc.)
#   --tcp               Utiliser connexion TCP au lieu de SSH
#   --tls               Activer TLS pour connexion TCP (recommandé)
#   --cert-path PATH    Chemin vers les certificats TLS (défaut: ~/.docker)

set -e  # Exit on error

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration par défaut
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV="${1:-dev}"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"
REMOTE_HOST=""
REMOTE_PORT=""
REMOTE_USER="phili"
DOCKER_HOST_URI=""
REMOTE_MODE=false
AUTO_DEPLOY=false
USE_TCP=false
USE_TLS=false
CERT_PATH="${HOME}/.docker"

# ============================================
# Fonctions utilitaires
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour exécuter docker compose (local ou distant)
docker_compose() {
    if [ "$REMOTE_MODE" = true ]; then
        DOCKER_HOST="$DOCKER_HOST_URI" docker compose "$@"
    else
        docker compose "$@"
    fi
}

# Fonction pour exécuter des commandes sur le serveur distant
remote_exec() {
    if [ "$REMOTE_MODE" = true ]; then
        ssh -p "$REMOTE_PORT" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
    else
        eval "$@"
    fi
}

# Fonction pour copier des fichiers vers le serveur distant
remote_copy() {
    local src="$1"
    local dest="$2"
    
    if [ "$REMOTE_MODE" = true ]; then
        scp -P "$REMOTE_PORT" -r "$src" "${REMOTE_USER}@${REMOTE_HOST}:${dest}"
    else
        cp -r "$src" "$dest"
    fi
}

# ============================================
# Parsing des arguments
# ============================================

# Sauvegarder le nombre d'arguments avant parsing
ORIGINAL_ARGC=$#

# Ignorer le premier argument (ENV) si présent
if [ $# -gt 0 ]; then
    shift
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            REMOTE_HOST="$2"
            REMOTE_MODE=true
            AUTO_DEPLOY=true
            shift 2
            ;;
        --port)
            REMOTE_PORT="$2"
            AUTO_DEPLOY=true
            shift 2
            ;;
        --user)
            REMOTE_USER="$2"
            AUTO_DEPLOY=true
            shift 2
            ;;
        --docker-host)
            DOCKER_HOST_URI="$2"
            REMOTE_MODE=true
            AUTO_DEPLOY=true
            shift 2
            ;;
        --tcp)
            USE_TCP=true
            AUTO_DEPLOY=true
            shift
            ;;
        --tls)
            USE_TLS=true
            AUTO_DEPLOY=true
            shift
            ;;
        --cert-path)
            CERT_PATH="$2"
            AUTO_DEPLOY=true
            shift 2
            ;;
        *)
            log_error "Option inconnue: $1"
            echo "Usage: ./deploy.sh [dev|prod] [--host IP] [--port PORT] [--user USER] [--docker-host URI] [--tcp] [--tls] [--cert-path PATH]"
            exit 1
            ;;
    esac
done

# Construire DOCKER_HOST_URI si non fourni mais host spécifié
if [ -z "$DOCKER_HOST_URI" ] && [ -n "$REMOTE_HOST" ]; then
    if [ "$USE_TCP" = true ]; then
        # Déterminer le port par défaut selon TLS
        DEFAULT_PORT=2375  # Non sécurisé
        if [ "$USE_TLS" = true ]; then
            DEFAULT_PORT=2376  # Sécurisé avec TLS
        fi
        
        # Utiliser le port spécifié ou le port par défaut
        REMOTE_PORT="${REMOTE_PORT:-$DEFAULT_PORT}"
        
        if [ "$USE_TLS" = true ]; then
            # Connexion TCP sécurisée avec TLS
            DOCKER_HOST_URI="tcp://${REMOTE_HOST}:${REMOTE_PORT}"
            export DOCKER_TLS_VERIFY=1
            export DOCKER_CERT_PATH="$CERT_PATH"
            log_info "🔒 Connexion TCP+TLS: $DOCKER_HOST_URI"
            log_info "📁 Certificats: $CERT_PATH"
        else
            # Connexion TCP non sécurisée (déconseillé)
            DOCKER_HOST_URI="tcp://${REMOTE_HOST}:${REMOTE_PORT}"
            log_warning "⚠️  Connexion TCP non sécurisée! Utilisez --tls pour activer le chiffrement."
        fi
        REMOTE_MODE=true
    elif [ "$REMOTE_MODE" = true ]; then
        # Connexion SSH (par défaut)
        REMOTE_PORT="${REMOTE_PORT:-22}"
        DOCKER_HOST_URI="ssh://${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
        log_info "🔐 Connexion SSH: $DOCKER_HOST_URI"
    fi
fi

# ============================================
# Vérifications préalables
# ============================================

check_requirements() {
    log_info "Vérification des prérequis..."
    
    if [ "$REMOTE_MODE" = true ]; then
        log_info "Mode distant: $DOCKER_HOST_URI"
        
        # Vérifier SSH
        if ! command -v ssh &> /dev/null; then
            log_error "SSH n'est pas installé"
            exit 1
        fi
        
        # Tester la connexion SSH
        log_info "Test de connexion SSH..."
        if ! ssh -p "$REMOTE_PORT" -o ConnectTimeout=5 "${REMOTE_USER}@${REMOTE_HOST}" "echo 'OK'" &> /dev/null; then
            log_error "Impossible de se connecter à ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
            log_error "Vérifiez que:"
            log_error "  1. Le serveur est accessible"
            log_error "  2. Votre clé SSH est configurée (ssh-copy-id ${REMOTE_USER}@${REMOTE_HOST})"
            exit 1
        fi
        log_success "Connexion SSH: OK"
        
        # Vérifier Docker sur le serveur distant
        if ! remote_exec "command -v docker &> /dev/null"; then
            log_error "Docker n'est pas installé sur le serveur distant"
            exit 1
        fi
        log_success "Docker distant: $(remote_exec 'docker --version')"
        
        # Vérifier Docker Compose sur le serveur distant
        if ! remote_exec "docker compose version &> /dev/null"; then
            log_error "Docker Compose n'est pas installé sur le serveur distant"
            exit 1
        fi
        log_success "Docker Compose distant: OK"
    else
        # Mode local
        log_info "Mode local"
        
        # Docker
        if ! command -v docker &> /dev/null; then
            log_error "Docker n'est pas installé"
            exit 1
        fi
        log_success "Docker: $(docker --version)"
        
        # Docker Compose
        if ! command -v docker compose &> /dev/null && ! docker compose version &> /dev/null; then
            log_error "Docker Compose n'est pas installé"
            exit 1
        fi
        log_success "Docker Compose: OK"
        
        # Vérifier que Docker daemon tourne
        if ! docker ps &> /dev/null; then
            log_error "Docker daemon n'est pas démarré"
            exit 1
        fi
        log_success "Docker daemon: Running"
    fi
}

# ============================================
# Configuration de l'environnement
# ============================================

setup_env() {
    log_info "Configuration de l'environnement: $ENV"
    
    # Copier .env.example si .env n'existe pas
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f ".env.docker.example" ]; then
            log_warning "Fichier .env manquant, copie depuis .env.docker.example"
            cp .env.docker.example "$ENV_FILE"
            log_warning "⚠️  IMPORTANT: Éditez .env et changez les secrets avant de lancer en production!"
        else
            log_error "Fichier .env.docker.example manquant"
            exit 1
        fi
    fi
    
    # Vérifier que les secrets ont été changés en prod
    if [ "$ENV" = "prod" ]; then
        if grep -q "change-this-secret-key-in-production" "$ENV_FILE"; then
            log_error "⚠️  SÉCURITÉ: Les secrets par défaut sont toujours dans .env!"
            log_error "Éditez .env et changez SECRET_KEY et JWT_SECRET_KEY avant de déployer en production"
            exit 1
        fi
        log_success "Secrets de production configurés"
    fi
}

# ============================================
# Build de l'image Docker
# ============================================

build_images() {
    log_info "Construction des images Docker..."
    
    if [ "$REMOTE_MODE" = true ]; then
        log_info "Copie des fichiers vers le serveur distant..."
        remote_exec "mkdir -p ~/gamearena"
        remote_copy "." "~/gamearena/"
        log_success "Fichiers copiés"
        
        log_info "Construction des images sur le serveur distant..."
        docker_compose -f "$COMPOSE_FILE" build --no-cache
        log_success "Images construites avec succès"
    else
        # Build l'image principale
        docker_compose -f "$COMPOSE_FILE" build --no-cache
        log_success "Images construites avec succès"
    fi
    
    # Build l'image bot (pour exécution des bots en Docker)
    if [ -f "runner/build_bot_image.sh" ]; then
        log_info "Construction de l'image gamearena-bot..."
        if [ "$REMOTE_MODE" = true ]; then
            remote_exec "cd ~/gamearena && bash runner/build_bot_image.sh"
        else
            bash runner/build_bot_image.sh
        fi
        log_success "Image gamearena-bot construite"
    else
        log_warning "Script runner/build_bot_image.sh manquant, image bot non construite"
    fi
}

# ============================================
# Démarrage des services
# ============================================

start_services() {
    log_info "Démarrage des services..."
    
    # Arrêter les conteneurs existants
    docker_compose -f "$COMPOSE_FILE" down
    
    # Démarrer en mode detached
    docker_compose -f "$COMPOSE_FILE" up -d
    
    # Attendre que le service soit prêt
    log_info "Attente du démarrage du service..."
    sleep 5
    
    # Vérifier le health check
    for i in {1..30}; do
        if docker_compose -f "$COMPOSE_FILE" ps | grep -q "healthy"; then
            log_success "Service démarré et healthy"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Timeout: le service n'est pas devenu healthy"
            docker_compose -f "$COMPOSE_FILE" logs --tail=50
            exit 1
        fi
        sleep 2
    done
}

# ============================================
# Initialisation de la base de données
# ============================================

init_database() {
    log_info "Initialisation de la base de données..."
    
    # Vérifier si la DB existe déjà
    if docker_compose -f "$COMPOSE_FILE" exec -T gamearena python3 -c "from app import app, db; from models import User; app.app_context().push(); print(User.query.count())" 2>/dev/null | grep -q "^[0-9]"; then
        log_info "Base de données déjà initialisée"
    else
        log_info "Création des tables..."
        docker_compose -f "$COMPOSE_FILE" exec -T gamearena python3 -c "from app import app, db; app.app_context().push(); db.create_all()"
        log_success "Tables créées"
    fi
}

# ============================================
# Affichage des informations
# ============================================

show_info() {
    log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_success "✅ GameArena déployé avec succès!"
    log_success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ "$REMOTE_MODE" = true ]; then
        log_info "🌐 URL: http://${REMOTE_HOST}:3000"
        log_info "📊 API: http://${REMOTE_HOST}:3000/api/referees"
        echo ""
        log_info "Commandes utiles (avec DOCKER_HOST):"
        echo "  - Voir les logs:        DOCKER_HOST=$DOCKER_HOST_URI docker compose logs -f"
        echo "  - Arrêter:              DOCKER_HOST=$DOCKER_HOST_URI docker compose down"
        echo "  - Redémarrer:           DOCKER_HOST=$DOCKER_HOST_URI docker compose restart"
        echo "  - Shell dans container: DOCKER_HOST=$DOCKER_HOST_URI docker compose exec gamearena bash"
        echo ""
        log_info "Ou via SSH:"
        echo "  - Se connecter:         ssh -p $REMOTE_PORT ${REMOTE_USER}@${REMOTE_HOST}"
        echo "  - Répertoire:           ~/gamearena"
    else
        log_info "🌐 URL: http://localhost:3000"
        log_info "📊 API: http://localhost:3000/api/referees"
        echo ""
        log_info "Commandes utiles:"
        echo "  - Voir les logs:        docker compose logs -f"
        echo "  - Arrêter:              docker compose down"
        echo "  - Redémarrer:           docker compose restart"
        echo "  - Reconstruire:         docker compose build --no-cache"
        echo "  - Shell dans container: docker compose exec gamearena bash"
    fi
    echo ""
    
    if [ "$ENV" = "dev" ]; then
        log_warning "Mode DÉVELOPPEMENT - Ne pas utiliser en production!"
    else
        log_info "Mode PRODUCTION"
        log_warning "Vérifiez la configuration de sécurité:"
        echo "  - Secrets changés dans .env"
        echo "  - CORS restreint aux domaines autorisés"
        echo "  - HTTPS configuré (via nginx)"
        echo "  - Sauvegardes automatiques configurées"
    fi
}

# ============================================
# Menu interactif
# ============================================

interactive_menu() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║     GameArena - Script de Déploiement  ║"
    echo "╚════════════════════════════════════════╝"
    echo ""
    echo "Environnement: $ENV"
    echo ""
    echo "Options:"
    echo "  1) Déploiement complet (build + start)"
    echo "  2) Build uniquement"
    echo "  3) Start uniquement"
    echo "  4) Arrêter les services"
    echo "  5) Voir les logs"
    echo "  6) Status des services"
    echo "  7) Quitter"
    echo ""
    read -p "Choix: " choice
    
    case $choice in
        1)
            check_requirements
            setup_env
            build_images
            start_services
            init_database
            show_info
            ;;
        2)
            check_requirements
            build_images
            log_success "Build terminé"
            ;;
        3)
            check_requirements
            start_services
            init_database
            show_info
            ;;
        4)
            log_info "Arrêt des services..."
            docker compose -f "$COMPOSE_FILE" down
            log_success "Services arrêtés"
            ;;
        5)
            docker compose -f "$COMPOSE_FILE" logs -f
            ;;
        6)
            docker compose -f "$COMPOSE_FILE" ps
            ;;
        7)
            log_info "Au revoir!"
            exit 0
            ;;
        *)
            log_error "Option invalide"
            exit 1
            ;;
    esac
}

# ============================================
# Main
# ============================================

main() {
    # Si des options sont passées (mode automatique), déploiement direct
    if [ "$AUTO_DEPLOY" = true ]; then
        check_requirements
        setup_env
        build_images
        start_services
        init_database
        show_info
    else
        # Sinon, menu interactif
        interactive_menu
    fi
}

main
