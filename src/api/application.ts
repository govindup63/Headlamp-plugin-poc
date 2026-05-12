import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/K8s/crd';

// Argo CD Application sync states (status.sync.status enum)
export type SyncStatus = 'Synced' | 'OutOfSync' | 'Unknown';

// Argo CD Application health states (status.health.status enum)
export type HealthStatus =
  | 'Healthy'
  | 'Progressing'
  | 'Degraded'
  | 'Suspended'
  | 'Missing'
  | 'Unknown';

// A single Application source. Argo CD supports `spec.source` (singular,
// legacy) and `spec.sources` (plural, multi-source). When sources is set,
// the singular source is ignored.
export interface ApplicationSource {
  repoURL: string;
  path?: string;
  chart?: string;
  targetRevision?: string;
  helm?: { parameters?: Array<{ name: string; value: string }> };
  kustomize?: { images?: string[] };
  ref?: string;
}

export interface ApplicationDestination {
  server?: string; // cluster URL (e.g. https://kubernetes.default.svc)
  name?: string;   // cluster name registered in Argo CD
  namespace: string;
}

export interface ArgoApplicationSpec {
  project: string;
  source?: ApplicationSource;
  sources?: ApplicationSource[];
  destination: ApplicationDestination;
  syncPolicy?: {
    automated?: { prune?: boolean; selfHeal?: boolean; allowEmpty?: boolean };
    syncOptions?: string[];
  };
  ignoreDifferences?: Array<{ group?: string; kind: string; name?: string; jsonPointers?: string[] }>;
  revisionHistoryLimit?: number;
}

export interface ArgoApplicationStatus {
  sync?: { status?: SyncStatus; revision?: string; revisions?: string[] };
  health?: { status?: HealthStatus; message?: string };
  operationState?: {
    phase?: string;
    finishedAt?: string;
    syncResult?: { revision?: string; revisions?: string[] };
  };
  conditions?: Array<{ type: string; message: string; lastTransitionTime?: string }>;
  resources?: Array<{
    group?: string;
    version: string;
    kind: string;
    namespace?: string;
    name: string;
    status?: string;
    health?: { status?: string };
  }>;
  sourceType?: 'Helm' | 'Kustomize' | 'Directory' | 'Plugin' | string;
  sourceTypes?: string[];
}

export interface ArgoApplicationJSON {
  apiVersion: 'argoproj.io/v1alpha1';
  kind: 'Application';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
    uid?: string;
  };
  spec: ArgoApplicationSpec;
  status?: ArgoApplicationStatus;
}

// Build a typed KubeObject class for the Application CRD via the SDK's
// factory. Once instantiated, this class behaves like any built-in resource
// (Pod, Deployment, etc.) and works with useList / useGet through the same
// watch + cache layer Headlamp already runs.
export const ArgoApplication = makeCustomResourceClass({
  apiInfo: [{ group: 'argoproj.io', version: 'v1alpha1' }],
  isNamespaced: true,
  singularName: 'application',
  pluralName: 'applications',
  kind: 'Application',
});
