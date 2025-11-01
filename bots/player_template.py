import sys
import math

# Grab the pellets as fast as you can!

# width: size of the grid
# height: top left corner is (x=0, y=0)
width, height = [int(i) for i in input().split()]
for i in range(height):
    row = input()  # one line of the grid: space " " is floor, pound "#" is wall

# game loop
while True:
    my_score, opponent_score = [int(i) for i in input().split()]
    visible_pac_count = int(input())  # all your pacs and enemy pacs in sight
    for i in range(visible_pac_count):
        inputs = input().split()
        pac_id = int(inputs[0])  # pac number (unique within a team)
        mine = inputs[1] != "0"  # true if this pac is yours
        x = int(inputs[2])  # position in the grid
        y = int(inputs[3])  # position in the grid
        type_id = inputs[4]  # unused in wood leagues
        speed_turns_left = int(inputs[5])  # unused in wood leagues
        ability_cooldown = int(inputs[6])  # unused in wood leagues
    visible_pellet_count = int(input())  # all pellets in sight
    for i in range(visible_pellet_count):
        # value: amount of points this pellet is worth
        x, y, value = [int(j) for j in input().split()]

    # Write an action using print
    # To debug: print("Debug messages...", file=sys.stderr, flush=True)

    # MOVE <pacId> <x> <y>
    print("MOVE 0 3 2")
