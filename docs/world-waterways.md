# Field waterways

- An outdoor river should visibly reach a lake, the sea, or an existing river. A connected loop is also acceptable. Do not end a channel abruptly in open grass. A visibly authored spring pool may be the source.
- Connect water across authored map and chunk seams. Match the bank shape and water color across the join. The renderer's distance fade must not act as a river endpoint.
- Water geometry must match the walkability mask. A bridge may open a crossing, but decorative shoreline smoothing must not move the actual blocked-water tiles.
- For a new or changed waterway, check four-neighbor water connectivity across seams and check the bridge or ford separately. Check normal and reduced-detail renders from both sides of any stream boundary.
