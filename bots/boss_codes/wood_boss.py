import sys

# Wood Boss - Stratégie greedy basique
while True:
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())
    
    my_pacs = []
    for i in range(visible_pac_count):
        inputs = input().split()
        pac_id = int(inputs[0])
        mine = inputs[1] != "0"
        x, y = int(inputs[2]), int(inputs[3])
        if mine:
            my_pacs.append((pac_id, x, y))
    
    visible_pellet_count = int(input())
    pellets = []
    for i in range(visible_pellet_count):
        x, y, value = [int(j) for j in input().split()]
        pellets.append((x, y, value))
    
    # Prioriser les super pellets
    pellets.sort(key=lambda p: -p[2])
    
    commands = []
    for pac_id, px, py in my_pacs:
        if pellets:
            target = pellets.pop(0)
            commands.append(f"MOVE {pac_id} {target[0]} {target[1]}")
    
    print(" | ".join(commands) if commands else "MOVE 0 1 1")
