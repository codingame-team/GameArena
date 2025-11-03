# Recommandations d'hébergement pour GameArena

## Contexte

Application nécessitant :
- Plusieurs centaines d'utilisateurs simultanés
- Exécution intensive de matchs de bots dans l'arène
- Plusieurs dizaines de matchs par soumission de bot

## Solutions recommandées par ordre de priorité

### 1. Kubernetes sur cloud managé (Recommandé pour production)

**Plateformes** : GKE (Google), EKS (AWS), AKS (Azure)

**Avantages** :
- Scaling automatique des workers d'exécution de bots
- Isolation des matchs via pods éphémères
- Queue de jobs (Kubernetes Jobs/CronJobs) pour gérer les dizaines de matchs par soumission
- Limites CPU/mémoire par pod (protection contre bots malveillants)
- Load balancing natif pour le frontend/API
- Observabilité complète (Prometheus/Grafana)

**Inconvénients** :
- Courbe d'apprentissage importante
- Complexité opérationnelle initiale
- Coûts fixes plus élevés

**Coût estimé** : 600-1000€/mois

### 2. AWS ECS + Lambda (Hybride)

**Architecture** :
- ECS Fargate : API Flask + frontend statique
- Lambda + SQS : exécution des matchs (serverless)
- RDS PostgreSQL : base de données
- S3 : stockage des replays/logs

**Avantages** :
- Lambda = facturation à l'usage pour l'exécution des matchs
- SQS pour queue de matchs (résistant aux pics de charge)
- Pas de gestion de serveurs pour l'exécution
- Scaling automatique natif
- Bonne intégration avec l'écosystème AWS

**Inconvénients** :
- Temps de démarrage Lambda (cold start)
- Limite d'exécution Lambda (15 minutes max)
- Vendor lock-in AWS

**Coût estimé** : 450-850€/mois

### 3. Cloud Run (GCP) + Cloud Tasks

**Architecture** :
- Cloud Run : API Flask (auto-scaling 0→N instances)
- Cloud Tasks : orchestration des matchs
- Cloud SQL : PostgreSQL managé
- Cloud Storage : replays/logs

**Avantages** :
- Très simple à déployer (Dockerfile → production)
- Auto-scaling agressif (scale-to-zero)
- Pay-per-request
- Faible complexité opérationnelle
- Support natif des conteneurs Docker

**Inconvénients** :
- Moins de contrôle fin sur l'infrastructure
- Vendor lock-in GCP
- Limites de concurrency par instance

**Coût estimé** : 500-900€/mois

## Architecture détaillée recommandée

```
┌─────────────────┐
│  Frontend (CDN) │
│  (CloudFront/   │
│   Cloud CDN)    │
└────────┬────────┘
         │
┌────────▼────────────┐
│  Load Balancer      │
└────────┬────────────┘
         │
┌────────▼────────────┐
│  API Instances      │
│  (Flask)            │
│  3-5 instances      │
│  2-4 vCPU, 4-8GB    │
└────────┬────────────┘
         │
    ┌────┴────┬─────────────┬───────────────┐
    │         │             │               │
┌───▼────┐ ┌─▼──────────┐ ┌▼────────────┐ ┌▼────────────┐
│ Redis  │ │ PostgreSQL │ │  Job Queue  │ │   Storage   │
│ (cache │ │ (metadata) │ │ (RabbitMQ/  │ │  (S3/GCS)   │
│ session│ │            │ │  SQS/Tasks) │ │  replays    │
└────────┘ └────────────┘ └──────┬──────┘ └─────────────┘
                                  │
                         ┌────────▼────────┐
                         │  Worker Pool    │
                         │  (Bot Execution)│
                         │  10-50 workers  │
                         │  1-2 vCPU, 2-4GB│
                         │  Conteneurs     │
                         │  éphémères      │
                         └─────────────────┘
```

## Spécifications détaillées des composants

### Backend API

**Instances** :
- Nombre : 3-5 instances minimum (haute disponibilité)
- Specs : 2-4 vCPU, 4-8 GB RAM par instance
- Auto-scaling : CPU > 70% ou Request count > seuil
- Healthcheck : endpoint `/health` avec timeout 5s

**Technologies** :
- Flask avec Gunicorn (4-8 workers par instance)
- Nginx reverse proxy (optionnel si load balancer)

### Workers d'exécution de bots

**Isolation** :
- 1 match = 1 conteneur Docker éphémère
- Pool : 10-50 workers simultanés (ajustable selon charge)
- Specs par worker : 1-2 vCPU, 2-4 GB RAM
- Timeout : 30s-2min par match (selon jeu)
- Queue : FIFO avec priorités (arena > playground)

**Sécurité** :
```yaml
Limites Docker par conteneur :
  - mem_limit: 512MB
  - cpu_quota: 50000 (0.5 CPU)
  - network_disabled: true
  - pids_limit: 50
  - security_opt: ["no-new-privileges"]
  - read_only: true (sauf /tmp)
```

### Base de données

**Type** : PostgreSQL managé (RDS/Cloud SQL/Azure Database)

**Specs** :
- 4 vCPU, 16 GB RAM minimum
- SSD storage : 100-500 GB
- Réplication : Read replicas pour les classements/stats
- Backup : automatique quotidien avec rétention 7-30 jours
- Connection pooling : PgBouncer (max 100-200 connexions)

**Optimisations** :
- Index sur `user_id`, `bot_id`, `created_at`, `match_id`
- Partitioning des tables de matchs par date
- VACUUM automatique

### Cache et Queue

**Redis** :
- Usage : sessions utilisateurs, cache classements, rate limiting
- Specs : 2-4 GB RAM, persistance AOF
- Réplication : master-replica pour HA

**Queue de jobs** :
- Options : RabbitMQ, AWS SQS, GCP Cloud Tasks, Azure Service Bus
- Dead letter queue pour gestion des échecs
- Retry policy : 3 tentatives avec backoff exponentiel

## Système de priorités pour les matchs

### Configuration recommandée

```python
# Priorités dans la queue
PRIORITY_ARENA_SUBMISSION = 1      # Haute priorité (validation soumission)
PRIORITY_ARENA_RANKING = 5         # Priorité moyenne (recalcul ranking)
PRIORITY_PLAYGROUND = 10           # Basse priorité (tests utilisateurs)

# Batch processing pour soumissions arène
# 1 soumission = N matchs contre différents adversaires
# → 1 job parent qui spawn N workers en parallèle
# → Agrégation des résultats à la fin

# Rate limiting par utilisateur
RATE_LIMITS = {
    'arena_submissions': '5/hour',      # 5 soumissions max par heure
    'playground_executions': '100/hour', # 100 tests par heure
    'api_requests': '1000/hour'          # Limite générale API
}

# Cooldown entre soumissions
COOLDOWN_ARENA_SUBMISSION = 10  # 10 secondes
```

## Sécurité et isolation

### Renforcement de l'exécution Docker

```python
# Dans docker_runner.py
container = client.containers.run(
    image='gamearena-bot:latest',
    
    # Limites ressources
    mem_limit='512m',              # Limite mémoire stricte
    memswap_limit='512m',          # Pas de swap
    cpu_quota=50000,               # 0.5 CPU max
    cpu_period=100000,
    
    # Isolation réseau
    network_disabled=True,         # Pas d'accès réseau
    
    # Limites processus
    pids_limit=50,                 # Max 50 processus
    
    # Sécurité
    security_opt=['no-new-privileges'],
    cap_drop=['ALL'],              # Drop toutes les capabilities
    read_only=True,                # Filesystem read-only
    tmpfs={'/tmp': 'size=64M'},    # Tmpfs limité pour /tmp
    
    # Timeout
    stop_timeout=5,
    
    # Auto-cleanup
    auto_remove=True,
    detach=True
)
```

### Monitoring et alertes

**Métriques critiques** :
- Latence API (p50, p95, p99)
- Taux d'erreur API
- Queue depth (nombre de jobs en attente)
- Temps d'exécution des matchs
- Utilisation CPU/RAM workers
- Taux d'échec des matchs
- Nombre d'utilisateurs actifs simultanés

**Alertes** :
- Queue depth > 1000 jobs
- Taux d'erreur API > 5%
- Latence p99 > 2s
- Worker pool saturation > 90%
- Database connection pool > 80%

**Outils** :
- Prometheus + Grafana (Kubernetes)
- CloudWatch (AWS)
- Cloud Monitoring (GCP)
- Datadog/New Relic (multi-cloud)

## Comparatif des coûts détaillés

### Option 1 : Kubernetes (GKE/EKS/AKS)

| Composant | Specs | Coût mensuel |
|-----------|-------|--------------|
| Control plane | Managé | 75-150€ |
| Node pool API (3 nodes) | 2 vCPU, 8GB | 150-250€ |
| Node pool Workers (5 nodes) | 2 vCPU, 8GB | 250-400€ |
| PostgreSQL managé | 4 vCPU, 16GB | 100-200€ |
| Redis managé | 2GB | 30-50€ |
| Load Balancer | - | 20-40€ |
| Storage (1TB) | SSD | 40-80€ |
| Bandwidth (500GB) | - | 40-80€ |
| **Total** | | **700-1250€/mois** |

### Option 2 : Serverless (AWS Lambda + ECS)

| Composant | Specs | Coût mensuel |
|-----------|-------|--------------|
| ECS Fargate API (2 tasks) | 2 vCPU, 4GB | 100-150€ |
| Lambda exécutions | 10M invocations/mois | 200-400€ |
| RDS PostgreSQL | db.t3.large | 100-180€ |
| ElastiCache Redis | cache.t3.small | 30-50€ |
| SQS | 5M messages | 10-20€ |
| S3 Storage (1TB) | - | 25-40€ |
| CloudWatch | Logs + metrics | 30-60€ |
| **Total** | | **500-900€/mois** |

### Option 3 : Cloud Run (GCP)

| Composant | Specs | Coût mensuel |
|-----------|-------|--------------|
| Cloud Run API | 100M requests | 50-150€ |
| Cloud Run Workers | 5M exécutions longues | 300-500€ |
| Cloud SQL PostgreSQL | db-n1-standard-2 | 100-180€ |
| Memorystore Redis | 2GB | 30-50€ |
| Cloud Tasks | 5M tasks | 10-20€ |
| Cloud Storage (1TB) | - | 20-40€ |
| Cloud Logging | - | 30-60€ |
| **Total** | | **540-1000€/mois** |

## Recommandation finale

### Pour démarrer (MVP / 0-500 utilisateurs)

**Cloud Run (GCP)** ou **ECS Fargate + Lambda (AWS)**

**Raisons** :
- Simplicité de déploiement (Dockerfile → production en 10 min)
- Coûts prévisibles et ajustés à l'usage réel
- Scaling automatique sans configuration complexe
- Peu de maintenance opérationnelle
- Bonne documentation et support

**Checklist de déploiement** :
- [ ] Conteneuriser l'application (Dockerfile optimisé)
- [ ] Configurer la base de données managée
- [ ] Mettre en place Redis pour le cache
- [ ] Configurer la queue de jobs (SQS/Cloud Tasks)
- [ ] Implémenter le rate limiting
- [ ] Configurer les limites Docker strictes
- [ ] Mettre en place monitoring basique
- [ ] Tester la charge avec 100-200 utilisateurs simulés

### Pour la croissance (500+ utilisateurs)

**Kubernetes (GKE/EKS/AKS)**

**Raisons** :
- Contrôle total sur l'isolation et la sécurité
- Optimisation fine des coûts à grande échelle
- Meilleure observabilité (Prometheus/Grafana/Jaeger)
- Portabilité entre clouds (évite vendor lock-in)
- Scaling horizontal avancé (HPA, cluster autoscaler)
- Support de stratégies de déploiement complexes (blue/green, canary)

**Migration depuis serverless** :
1. Conteneurisation déjà faite ✓
2. Créer cluster Kubernetes
3. Déployer API avec Helm chart
4. Migrer workers vers Kubernetes Jobs
5. Configurer Ingress + cert-manager (HTTPS)
6. Mettre en place monitoring complet
7. Basculer le trafic progressivement (canary)

## Solutions à éviter

### ❌ VPS simple (DigitalOcean/OVH/Hetzner)

**Pourquoi** :
- Difficile de gérer l'isolation des bots
- Scaling manuel et lent
- Pas de haute disponibilité native
- Gestion des backups manuelle
- Risque de compromission du serveur entier

**Exception** : Acceptable pour prototype/démo uniquement

### ❌ Heroku

**Pourquoi** :
- Coûts prohibitifs pour workers intensifs (>1500€/mois facilement)
- Limites strictes sur l'exécution (30s timeout HTTP)
- Pas de support natif Docker avancé
- Scaling limité

### ❌ Serveur on-premise

**Pourquoi** :
- Complexité opérationnelle très élevée
- CAPEX important (matériel)
- Pas de scaling élastique
- Gestion de la connectivité/bande passante
- Maintenance physique

**Exception** : Si contraintes réglementaires strictes (données sensibles)

## Plan de migration progressif

### Phase 1 : MVP (Mois 1-3)
- Déploiement Cloud Run ou ECS Fargate
- Base de données managée
- Queue simple (SQS/Cloud Tasks)
- Monitoring basique
- Budget : 500-700€/mois

### Phase 2 : Croissance (Mois 4-6)
- Scaling horizontal API (5+ instances)
- Pool de workers dédié (10-20)
- Redis pour cache
- Monitoring avancé (métriques custom)
- Budget : 700-1000€/mois

### Phase 3 : Production (Mois 7-12)
- Migration vers Kubernetes (si besoin)
- Multi-région (réplication)
- CDN pour assets statiques
- CI/CD complet
- Tests de charge automatisés
- Budget : 1000-1500€/mois

## Checklist de sécurité

- [ ] Isolation réseau des conteneurs (network_disabled)
- [ ] Limites CPU/RAM strictes par conteneur
- [ ] Timeout d'exécution par match
- [ ] Rate limiting par utilisateur
- [ ] Validation des soumissions (analyse statique)
- [ ] Sandboxing renforcé (seccomp, AppArmor)
- [ ] Logs d'audit pour toutes les soumissions
- [ ] Scan des images Docker (Trivy, Snyk)
- [ ] Secrets management (Vault, Secrets Manager)
- [ ] HTTPS obligatoire (TLS 1.3)
- [ ] WAF pour l'API (CloudFlare, AWS WAF)
- [ ] DDoS protection

## Ressources et documentation

### Kubernetes
- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Security](https://kubernetes.io/docs/concepts/security/)

### Serverless
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)

### Docker Security
- [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)

### Monitoring
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)

---

**Dernière mise à jour** : 3 novembre 2025
