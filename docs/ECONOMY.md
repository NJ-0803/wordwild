# Town growth (replaces the old coins, orders and harvest economy, 2026-09-26)

There is nothing to harvest, spend, build or claim. The city grows with the words you log.

- **Points** (core/src/city.ts): saved word 3, practised word +2, secure word +5, finished puzzle +2, finished story scene +3. Derived from what you did, so it syncs and cannot be forged. Points only go up.
- **The plan** (`PLAN`, ~36 pieces): each threshold adds one piece to a planned Township-style city: your cottage, wheat seeds, street lamps, houses of different kinds, market, school, bakery, fountain, cafe, corn field, barn, playground, workshop, apartments, windmill, clinic, bandstand, farmhouse, hall, greenhouse, pond, library, clock tower and more. Ten words in one sitting builds a real neighbourhood; the whole plan is a few weeks of steady learning.
- **Stories** stay: each civic building (school, cafe, clinic...) opens its story scenes when it is built.
- **Kind by design:** the town never shrinks, missed days cost nothing, and the next piece is shown as a small construction site with its point cost.
- **Art:** the buildings are made in Blender (art/blender/city_lib.py and build_city.py, run headless) and exported to web/public/town/models/city. Windows glow after dark.
