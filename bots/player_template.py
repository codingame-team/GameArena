"""Player bot template (stdin/stdout) for GameArena.

This skeleton reads the initial map (width, height, rows) once, then enters a
loop reading per-turn inputs and printing a single action.

The referee accepts a single-line action in one of the forms:
  - "STAY"
  - "MOVE <x> <y>"          (legacy)
  - "MOVE <pac_id> <x> <y>" (recommended: include pac id)

Example usage (print with flush=True):
  print("STAY", flush=True)
  print("MOVE 0 3 2", flush=True)  # move pac id 0 to absolute coords (3,2)

Use stderr prints for debugging: print('dbg', file=sys.stderr, flush=True)
"""

# --- init (read once)
# read width/height and the map rows (map lines are not used in this template,
# but are provided by the referee for completeness)
width, height = [int(i) for i in input().split()]
for _ in range(height):
    _ = input()

# --- optional persistent state
# memory = {}

# --- game loop
while True:
    # Read per-turn inputs
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())
    pacs = []  # list of tuples (pac_id, mine_bool, x, y)
    for _ in range(visible_pac_count):
        parts = input().split()
        pac_id = int(parts[0])
        mine = parts[1] != '0'
        x = int(parts[2]); y = int(parts[3])
        pacs.append((pac_id, mine, x, y))

    visible_pellet_count = int(input())
    pellets = []  # list of tuples (x,y,value)
    for _ in range(visible_pellet_count):
        x, y, value = [int(j) for j in input().split()]
        pellets.append((x, y, value))

    # --- Example decision: greedy move for the first owned pac (if any)
    my_pacs = [p for p in pacs if p[1]]
    if my_pacs and pellets:
        pac0 = my_pacs[0]
        pac_id, _, px, py = pac0
        # nearest pellet by Manhattan distance
        def mdist(a, b):
            return abs(a[0] - b[0]) + abs(a[1] - b[1])
        nearest = min(pellets, key=lambda t: mdist((px, py), (t[0], t[1])))
        dx = 0 if nearest[0] == px else (1 if nearest[0] > px else -1)
        dy = 0 if nearest[1] == py else (1 if nearest[1] > py else -1)
        tx = px + dx
        ty = py + dy
        # preferred format: include pac id
        print(f"MOVE {pac_id} {tx} {ty}", flush=True)
    else:
        # Nothing to do or no visible pellets
        print("STAY", flush=True)
