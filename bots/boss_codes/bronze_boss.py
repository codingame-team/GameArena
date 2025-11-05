import sys
from collections import defaultdict

def manhattan(x1, y1, x2, y2):
    return abs(x1 - x2) + abs(y1 - y2)

# Bronze Boss - Coordination multi-pacs
visited = set()
while True:
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())
    
    my_pacs = []
    enemy_pacs = []
    for i in range(visible_pac_count):
        inputs = input().split()
        pac_id = int(inputs[0])
        mine = inputs[1] != "0"
        x, y = int(inputs[2]), int(inputs[3])
        if mine:
            my_pacs.append((pac_id, x, y))
        else:
            enemy_pacs.append((x, y))
    
    visible_pellet_count = int(input())
    pellets = []
    for i in range(visible_pellet_count):
        x, y, value = [int(j) for j in input().split()]
        pellets.append((x, y, value))
    
    commands = []
    assigned = set()
    
    for pac_id, px, py in my_pacs:
        visited.add((px, py))
        best = None
        best_score = -999999
        
        for tx, ty, value in pellets:
            if (tx, ty) in assigned:
                continue
            dist = manhattan(px, py, tx, ty)
            score = value * 10 - dist
            if score > best_score:
                best_score = score
                best = (tx, ty)
        
        if best:
            assigned.add(best)
            commands.append(f"MOVE {pac_id} {best[0]} {best[1]}")
        else:
            # Explorer
            tx, ty = (px + 3) % 30, (py + 2) % 15
            commands.append(f"MOVE {pac_id} {tx} {ty}")
    
    print(" | ".join(commands) if commands else "MOVE 0 1 1")
