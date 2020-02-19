use itertools::Itertools;
use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::string::String;

/// Similar to Python's networkx Floyd Warshall implementation. Performs all-pairs shortest paths against a graph and returns a mapping of the shortest paths
pub fn floyd_warshall(graph: &DiGraphMap<i32, f64>) -> Result<BTreeMap<(i32, i32), f64>, String> {
    // TODO: use generics instead
    let mut mappings = BTreeMap::new();

    // initialize distances to self to 0
    for node in graph.nodes() {
        mappings.insert((node, node), 0.);
    }

    // add existing edges
    for (source, target, weight) in graph.all_edges() {
        mappings.insert((source, target), *weight);
    }

    // get the smallest distances seen so far
    let triangles = graph.nodes().permutations(3);

    for triangle in triangles {
        let k = triangle[0];
        let i = triangle[1];
        let j = triangle[2];
        let position = (i, j);

        let d_ik = match mappings.get(&(i, k)) {
            Some(d) => d,
            None => &std::f64::MAX,
        };
        let d_kj = match mappings.get(&(k, j)) {
            Some(d) => d,
            None => &std::f64::MAX,
        };

        let d_current = {
            match mappings.get(&position) {
                Some(d) => d,
                None => &std::f64::MAX,
            }
        };

        let d_new = d_current.min(*d_ik + *d_kj);

        if i == j && d_new < 0. {
            let error_message = format!(
                "negative cycle found on node ID {}: {} + {} = {}",
                i, d_ik, d_kj, d_new
            );
            return Err(error_message);
        }

        mappings.insert(position, d_new);
    }

    Ok(mappings)
}
