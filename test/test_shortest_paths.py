"""
Tests for the similar-papers graph's shortest-path step.

connected_graph._shortest_paths() runs Dijkstra's algorithm from the
origin paper over an undirected graph whose edge cost is
max(0, 1 - w) for a blended weight w in [0, 1]. The Engine page and
thesis Appendix B state several properties of it; this file pins each
one:

    - the worked example (a fourth paper makes an indirect route win)
    - the exact condition under which an indirect route beats a
      direct edge:  w(o,m) + w(m,v) > 1 + w(o,v)
    - equal-cost ties keep the predecessor popped first (smaller id),
      and the result does not depend on the order of the edge list
    - distances equal an independent Bellman-Ford on random graphs, and
      every returned path really costs what the distance says
    - with the origin star present every distance is at most 1
    - nodes the origin cannot reach are omitted, never invented

Pure Python, no database, no models.
"""

import random
import unittest

from app.services.connected_graph import _shortest_paths

INF = float("inf")


def _cost(weight: float) -> float:
    return max(0.0, 1.0 - weight)


def _bellman_ford(start: int, edges, nodes) -> dict[int, float]:
    """Independent reference: relax every undirected edge V - 1 times."""
    distance = {node: INF for node in nodes}
    distance[start] = 0.0

    for _ in range(len(nodes) - 1):
        for source, target, weight in edges:
            cost = _cost(weight)

            if distance[source] + cost < distance[target]:
                distance[target] = distance[source] + cost

            if distance[target] + cost < distance[source]:
                distance[source] = distance[target] + cost

    return distance


class WorkedExampleTest(unittest.TestCase):
    """The Engine page's four-paper example (A=1 origin, B=2, C=3, D=4)."""

    EDGES = [
        [1, 2, 0.278],  # A-B   cost 0.722
        [1, 3, 0.764],  # A-C   cost 0.236
        [1, 4, 0.31],   # A-D   cost 0.690 (direct)
        [2, 3, 0.176],  # B-C   cost 0.824
        [3, 4, 0.82],   # C-D   cost 0.180
    ]

    def test_distances_and_paths(self):
        distances, paths = _shortest_paths(1, self.EDGES)

        self.assertEqual(
            distances,
            {1: 0.0, 2: 0.722, 3: 0.236, 4: 0.416},
        )
        self.assertEqual(paths[1], [1])
        self.assertEqual(paths[2], [1, 2])
        self.assertEqual(paths[3], [1, 3])
        # D is reached through C: 0.236 + 0.180 = 0.416 < 0.690.
        self.assertEqual(paths[4], [1, 3, 4])

    def test_the_three_paper_example_keeps_every_direct_edge(self):
        # A-B 0.278, A-C 0.764, B-C 0.176: routing through the other
        # paper never beats the direct edge from the origin.
        edges = [[1, 2, 0.278], [1, 3, 0.764], [2, 3, 0.176]]

        distances, paths = _shortest_paths(1, edges)

        self.assertEqual(distances, {1: 0.0, 2: 0.722, 3: 0.236})
        self.assertEqual(paths[2], [1, 2])
        self.assertEqual(paths[3], [1, 3])


class IndirectRouteConditionTest(unittest.TestCase):
    """
    Via m beats direct  <=>  (1 - w1) + (1 - w2) < 1 - wd
                        <=>  w1 + w2 > 1 + wd
    for origin o, intermediate m, target v (ids 1, 2, 3).
    """

    def _route(self, w_om: float, w_mv: float, w_ov: float):
        _, paths = _shortest_paths(
            1,
            [[1, 2, w_om], [2, 3, w_mv], [1, 3, w_ov]],
        )
        return paths[3]

    def test_indirect_wins_when_the_two_hops_are_strong_enough(self):
        # 0.6 + 0.6 = 1.20 > 1 + 0.19 = 1.19
        self.assertEqual(self._route(0.6, 0.6, 0.19), [1, 2, 3])

    def test_direct_wins_just_below_the_threshold(self):
        # 0.6 + 0.6 = 1.20 < 1 + 0.21 = 1.21
        self.assertEqual(self._route(0.6, 0.6, 0.21), [1, 3])

    def test_a_weak_direct_edge_still_beats_two_weak_hops(self):
        # 0.4 + 0.4 = 0.80 < 1.00: both routes are poor, direct is cheaper
        self.assertEqual(self._route(0.4, 0.4, 0.0), [1, 3])

    def test_the_condition_holds_on_a_grid(self):
        steps = [i / 20 for i in range(0, 21)]

        for w_om in steps:
            for w_mv in steps:
                for w_ov in steps:
                    margin = (w_om + w_mv) - (1.0 + w_ov)

                    if abs(margin) < 1e-6:
                        continue  # exact tie: tie-break rules apply

                    expected = [1, 2, 3] if margin > 0 else [1, 3]

                    self.assertEqual(
                        self._route(w_om, w_mv, w_ov),
                        expected,
                        (w_om, w_mv, w_ov),
                    )


class DeterminismTest(unittest.TestCase):
    def test_equal_cost_routes_keep_the_smaller_predecessor_id(self):
        # 1 -> {2, 3} -> 4, every edge costs 0.5, so d(4) = 1.0 either way.
        edges = [[1, 2, 0.5], [1, 3, 0.5], [2, 4, 0.5], [3, 4, 0.5]]

        distances, paths = _shortest_paths(1, edges)

        self.assertEqual(distances[4], 1.0)
        self.assertEqual(paths[4], [1, 2, 4])

    def test_the_tie_follows_the_ids_not_the_edge_list(self):
        edges = [[1, 5, 0.5], [1, 3, 0.5], [5, 9, 0.5], [3, 9, 0.5]]

        _, paths = _shortest_paths(1, edges)

        self.assertEqual(paths[9], [1, 3, 9])

    def test_edge_order_does_not_change_the_result(self):
        rng = random.Random(7)
        edges = [
            [1, 2, 0.5], [1, 3, 0.5], [2, 4, 0.5], [3, 4, 0.5],
            [1, 5, 0.31], [4, 5, 0.9], [2, 5, 0.22],
        ]
        reference = _shortest_paths(1, edges)

        for _ in range(25):
            shuffled = list(edges)
            rng.shuffle(shuffled)
            self.assertEqual(_shortest_paths(1, shuffled), reference)

    def test_a_gain_below_the_tolerance_does_not_replace_the_first_route(self):
        # Node 2 (cost 0.5) is popped before node 3 (cost 0.6), so the
        # route 1-2-4 (total 1.0) is found first. The later route 1-3-4
        # is cheaper by only 5e-10, below the 1e-9 tolerance, so float
        # noise cannot flip the answer.
        edges = [
            [1, 2, 0.5],
            [1, 3, 0.4],
            [2, 4, 0.5],
            [3, 4, 0.6 + 5e-10],
        ]

        _, paths = _shortest_paths(1, edges)

        self.assertEqual(paths[4], [1, 2, 4])

    def test_a_real_gain_above_the_tolerance_does_replace_it(self):
        # Same shape, but the later route is cheaper by 5e-9 (> 1e-9).
        edges = [
            [1, 2, 0.5],
            [1, 3, 0.4],
            [2, 4, 0.5],
            [3, 4, 0.6 + 5e-9],
        ]

        _, paths = _shortest_paths(1, edges)

        self.assertEqual(paths[4], [1, 3, 4])


class CostRuleTest(unittest.TestCase):
    def test_a_weight_of_one_costs_nothing(self):
        distances, paths = _shortest_paths(1, [[1, 2, 1.0], [2, 3, 1.0]])

        self.assertEqual(distances, {1: 0.0, 2: 0.0, 3: 0.0})
        self.assertEqual(paths[3], [1, 2, 3])

    def test_a_weight_of_zero_costs_one(self):
        distances, _ = _shortest_paths(1, [[1, 2, 0.0]])

        self.assertEqual(distances[2], 1.0)

    def test_costs_are_clamped_so_they_are_never_negative(self):
        # A weight above 1 would give a negative cost without the clamp,
        # which would break Dijkstra's guarantee.
        distances, _ = _shortest_paths(1, [[1, 2, 1.7], [2, 3, 0.5]])

        self.assertEqual(distances[2], 0.0)
        self.assertEqual(distances[3], 0.5)

    def test_unreachable_nodes_are_omitted(self):
        distances, paths = _shortest_paths(1, [[1, 2, 0.5], [8, 9, 0.9]])

        self.assertEqual(set(distances), {1, 2})
        self.assertEqual(set(paths), {1, 2})

    def test_a_lone_origin_has_a_zero_length_path_to_itself(self):
        distances, paths = _shortest_paths(1, [])

        self.assertEqual(distances, {1: 0.0})
        self.assertEqual(paths, {1: [1]})


class AgainstBellmanFordTest(unittest.TestCase):
    """Random graphs shaped like the real ones: origin star + strong pairs."""

    def _random_graph(self, rng: random.Random):
        count = rng.randint(2, 12)
        nodes = rng.sample(range(1, 60), count)
        origin = nodes[0]

        edges = []
        for node in nodes[1:]:
            # the origin star is always present (weights may be 0)
            edges.append([origin, node, round(rng.random(), 4)])

        for index, left in enumerate(nodes[1:], start=1):
            for right in nodes[index + 1:]:
                if rng.random() < 0.5:
                    edges.append(
                        [left, right, round(rng.uniform(0.15, 1.0), 4)]
                    )

        return origin, nodes, edges

    def test_distances_match_bellman_ford_and_paths_cost_what_they_say(self):
        rng = random.Random(20261007)

        for _ in range(300):
            origin, nodes, edges = self._random_graph(rng)

            distances, paths = _shortest_paths(origin, edges)
            reference = _bellman_ford(origin, edges, nodes)

            self.assertEqual(set(distances), set(nodes))

            weight_of = {}
            for source, target, weight in edges:
                weight_of[(source, target)] = weight
                weight_of[(target, source)] = weight

            for node in nodes:
                self.assertAlmostEqual(
                    distances[node], reference[node], delta=1e-4
                )

                path = paths[node]
                self.assertEqual(path[0], origin)
                self.assertEqual(path[-1], node)
                self.assertEqual(len(path), len(set(path)))  # simple path

                length = sum(
                    _cost(weight_of[(a, b)])
                    for a, b in zip(path, path[1:])
                )
                self.assertAlmostEqual(length, distances[node], delta=1e-4)

    def test_with_the_origin_star_no_distance_exceeds_one(self):
        rng = random.Random(99)

        for _ in range(200):
            origin, nodes, edges = self._random_graph(rng)

            distances, _ = _shortest_paths(origin, edges)

            for node in nodes:
                self.assertLessEqual(distances[node], 1.0 + 1e-9)


if __name__ == "__main__":
    unittest.main()
