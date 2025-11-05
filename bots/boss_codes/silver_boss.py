import sys

# Silver Boss - Avec abilities
turn = 0
while True:
    turn += 1
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())
    
    my_pacs = []
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
    
    visible_pellet_count = int(input())
    pellets = []
    for i in range(visible_pellet_count):
        x, y, value = [int(j) for j in input().split()]
        pellets.append((x, y, value))
    
    commands = []
    for pac_id, px, py, ptype, speed, cd in my_pacs:
        # Utiliser SPEED tous les 10 tours si disponible
        if cd == 0 and turn % 10 == 0:
            commands.append(f"SPEED {pac_id}")
        elif pellets:
            target = max(pellets, key=lambda p: p[2] * 10 - abs(p[0]-px) - abs(p[1]-py))
            commands.append(f"MOVE {pac_id} {target[0]} {target[1]}")
    
    print(" | ".join(commands) if commands else "MOVE 0 1 1")
