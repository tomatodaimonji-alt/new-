# NPC job equipment and unified item details

v348 gives NPC occupations weighted, stable preferences keyed by identity. Tradespeople keep recognizable cues without a required uniform: a merchant commonly wears a traditional coat, while another can keep a cloth tunic or an iron cuirass. Individual variations do not change on refresh. Existing explicit actor loadouts still override the defaults, so the same adventurer's equipment is used in town and after recruitment.

Weapons and armor use one detail order: name, description, type (including the armor slot), attack, defense, and current/max durability. Weapon speed and reach remain below. The fire wand shows actual remaining charges rather than fake durability. Non-equipment uses its existing detail. Positive defense is an integer (minimum 1) in both equipment displays and the player/NPC reduction paths; no defense stays zero. New armor uses existing equipment, trade, durability, and mesh functions.
