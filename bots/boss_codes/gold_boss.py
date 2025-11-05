import sys
import random

# Gold Boss - IA avancée
turn = 0
strategies = {}
while True:
    turn += 1
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())
    
    my_pacs = []
    enemies = []
    for i in range(visible_pac_count):
        inputs = input().split()
        pac_id = int(inputs[0])
        mine = inputs[1] != "0"
        x, y = int(inputs[2]), int(inputs[3])
        type_id = inputs[4]
        speed_left = int(inputs[5])
        ability_cd = int(inputs[6])
        if mine:
            my_pacs.append((pac_id, x, y, type_id, speed_left, ability_cd))
        else:
            enemies.append((x, y, type_id))
    
    visible_pellet_count = int(input())
    pellets = []
    for i in range(visible_pellet_count):
        x, y, value = [int(j) for j in input().split()]
        pellets.append((x, y, value))
    
    commands = []
    for pac_id, px, py, ptype, speed, cd in my_pacs:
        # Stratégie adaptative
        if not strategies.get(pac_id):
            strategies[pac_id] = random.choice(['aggressive', 'collector'])
        
        strategy = strategies[pac_id]
        
        if strategy == 'aggressive' and enemies and cd == 0:
            # SWITCH pour contrer l'ennemi le plus proche
            enemy = min(enemies, key=lambda e: abs(e[0]-px) + abs(e[1]-py))
            counter = {'ROCK': 'PAPER', 'PAPER': 'SCISSORS', 'SCISSORS': 'ROCK'}
            if enemy[2] in counter:
                commands.append(f"SWITCH {pac_id} {counter[enemy[2]]}")
            else:
                commands.append(f"MOVE {pac_id} {enemy[0]} {enemy[1]}")
        elif pellets:
            best = max(pellets, key=lambda p: p[2] * 15 - abs(p[0]-px) - abs(p[1]-py))
            if cd == 0 and abs(best[0]-px) + abs(best[1]-py) > 5:
                commands.append(f"SPEED {pac_id}")
            else:
                commands.append(f"MOVE {pac_id} {best[0]} {best[1]}")
    
    print(" | ".join(commands) if commands else "MOVE 0 1 1")
