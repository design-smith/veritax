import type { GraphNode } from "./graph-data";

export interface ClusterNode {
  id: string;
  count: number;
  memberIds: string[];
  position: { x: number; y: number };
}

export interface VirtualizedGraph {
  nodes: GraphNode[];
  clusters: ClusterNode[];
}

const CLUSTER_THRESHOLD = 60;
const CLUSTER_SIZE = 10; // nodes per cluster

/**
 * When there are more than CLUSTER_THRESHOLD nodes, groups them into spatial
 * clusters. Nodes whose cluster is in `expandedClusterIds` are shown individually.
 */
export function clusterNodes(
  nodes: GraphNode[],
  expandedClusterIds: Set<string>,
): VirtualizedGraph {
  if (nodes.length <= CLUSTER_THRESHOLD) {
    return { nodes, clusters: [] };
  }

  const visibleNodes: GraphNode[] = [];
  const clusters: ClusterNode[] = [];

  // Partition nodes into groups of CLUSTER_SIZE
  for (let i = 0; i < nodes.length; i += CLUSTER_SIZE) {
    const group = nodes.slice(i, i + CLUSTER_SIZE);
    const clusterId = `cluster-${Math.floor(i / CLUSTER_SIZE)}`;

    if (expandedClusterIds.has(clusterId)) {
      // Expanded — show individual nodes
      visibleNodes.push(...group);
    } else {
      // Collapsed — show as a single cluster node
      const centroid = group.reduce(
        (acc, n) => ({ x: acc.x + n.position.x / group.length, y: acc.y + n.position.y / group.length }),
        { x: 0, y: 0 },
      );
      clusters.push({
        id: clusterId,
        count: group.length,
        memberIds: group.map((n) => n.id),
        position: centroid,
      });
    }
  }

  return { nodes: visibleNodes, clusters };
}

/** Toggle a cluster's expanded state. */
export function expandCluster(
  expanded: Set<string>,
  clusterId: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(clusterId)) {
    next.delete(clusterId);
  } else {
    next.add(clusterId);
  }
  return next;
}
