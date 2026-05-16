// Local re-declaration of the GraphSource shape used by registerMapSource.
// The published @kinvolk/headlamp-plugin SDK does not re-export the
// internal graph types under a public path; the shape is small enough
// that we declare what we need here.

import type { ReactNode } from 'react';

export type GraphNodeStatus = 'error' | 'success' | 'warning';

export interface GraphNode {
  id: string;
  label?: string;
  subtitle?: string;
  status?: GraphNodeStatus;
  icon?: ReactNode;
  nodes?: GraphNode[];
  // We keep this lax to avoid coupling to internals; Headlamp ignores
  // extra fields.
  [other: string]: any;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  [other: string]: any;
}

export type GraphSource = {
  id: string;
  label: string;
  icon?: ReactNode;
  isEnabledByDefault?: boolean;
} & {
  useData: () => { nodes?: GraphNode[]; edges?: GraphEdge[] } | null;
};
