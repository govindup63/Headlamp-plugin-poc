// Map a managed Argo CD resource (kind + namespace + name) to a Headlamp
// router route name + params. Returning null means we don't have a known
// route for this kind, and the UI falls back to plain text.
//
// Route names are taken from frontend/src/lib/router/index.tsx in
// kubernetes-sigs/headlamp.

interface ManagedResource {
  kind: string;
  name: string;
  namespace?: string;
  group?: string;
}

interface RouteRef {
  routeName: string;
  params: { name: string; namespace?: string };
}

// Namespaced kinds use the kind name directly when it matches Headlamp's
// route naming (DaemonSet, StatefulSet, Deployment, Job, CronJob, Pod).
const KIND_TO_ROUTE: Record<string, string> = {
  Pod: 'Pod',
  Deployment: 'Deployment',
  StatefulSet: 'StatefulSet',
  DaemonSet: 'DaemonSet',
  Job: 'Job',
  CronJob: 'CronJob',
  Service: 'service',
  Endpoints: 'endpoint',
  EndpointSlice: 'endpointslice',
  Ingress: 'ingress',
  IngressClass: 'ingressclass',
  NetworkPolicy: 'networkPolicy',
  ConfigMap: 'configMap',
  Secret: 'secret',
  ServiceAccount: 'serviceAccount',
  Role: 'role',
  RoleBinding: 'roleBinding',
  ClusterRole: 'clusterRole',
  ClusterRoleBinding: 'clusterRoleBinding',
  PersistentVolume: 'persistentVolume',
  PersistentVolumeClaim: 'persistentVolumeClaim',
  Namespace: 'namespace',
  Node: 'node',
  HorizontalPodAutoscaler: 'horizontalPodAutoscaler',
  ReplicaSet: 'replicaSet',
  // CustomResourceDefinition itself
  CustomResourceDefinition: 'crd',
};

const CLUSTER_SCOPED = new Set([
  'PersistentVolume',
  'Namespace',
  'Node',
  'ClusterRole',
  'ClusterRoleBinding',
  'StorageClass',
  'CustomResourceDefinition',
  'IngressClass',
]);

export function resourceToRoute(r: ManagedResource): RouteRef | null {
  if (!r || !r.kind || !r.name) return null;
  const routeName = KIND_TO_ROUTE[r.kind];
  if (!routeName) return null;
  if (CLUSTER_SCOPED.has(r.kind)) {
    return { routeName, params: { name: r.name } };
  }
  if (!r.namespace) return null;
  return { routeName, params: { name: r.name, namespace: r.namespace } };
}
