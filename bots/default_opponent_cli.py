"""CLI wrapper for the default opponent bot.

This script implements a minimal stdin/stdout protocol suitable for single-turn
execution (used by the engine when running the script per-turn). It selects the
first owned pac and moves it one step toward the nearest pellet when available,
otherwise prints STAY.

Usage: python3 bots/default_opponent_cli.py
"""

import sys

# --- init (read once)
width, height = [int(i) for i in input().split()]
for _ in range(height):
	_ = input()

# --- single turn (read one turn and decide)
while True:
	my_score, opponent_score = [int(i) for i in input().split()]
	visible_pac_count = int(input())
	pacs = []
	for _ in range(visible_pac_count):
		parts = input().split()
		pac_id = int(parts[0])
		mine = parts[1] != '0'
		x = int(parts[2])
		y = int(parts[3])
		pacs.append((pac_id, mine, x, y))
	visible_pellet_count = int(input())

	pellets = []
	for _ in range(visible_pellet_count):
		x, y, value = [int(j) for j in input().split()]
		pellets.append((x, y, value))

	# pick first owned pac (mine == True)
	owned = [p for p in pacs if p[1]]
	if owned:
		pac_id, _, px, py = owned[0]
		if pellets:
			# nearest by Manhattan distance
			nearest = min(pellets, key=lambda p: abs(p[0] - px) + abs(p[1] - py))
			# compute a single-step target toward the pellet
			dx = 0 if nearest[0] == px else (1 if nearest[0] > px else -1)
			dy = 0 if nearest[1] == py else (1 if nearest[1] > py else -1)
			tx = px + dx
			ty = py + dy
			action = f"MOVE {pac_id} {tx} {ty}"
		else:
			action = 'STAY'
	else:
		# no owned pacs visible -> STAY
		action = 'STAY'

	print(action, flush=True)
