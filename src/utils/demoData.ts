import { ArgoApplicationJSON } from '../api/application';
import { ArgoAppProjectJSON } from '../api/appProject';

// In-plugin demo data, used as a fallback when the live cluster proxy
// cannot reach applications.argoproj.io. Lets the POC render its full
// UI for design review. The shape exactly matches the real CRDs.
//
// Two apps that mirror the actual state on the Remotestar production
// cluster (so the demo feels real). One of them is OutOfSync to show
// the drift highlight.

export const demoApplications: ArgoApplicationJSON[] = [
  {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: 'remotestar-backend',
      namespace: 'argocd',
    },
    spec: {
      project: 'default',
      source: {
        repoURL: 'https://github.com/RemoteStar-AI/Gitops',
        path: '.',
        targetRevision: 'main',
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace: 'default',
      },
      syncPolicy: {
        automated: { prune: true, selfHeal: true },
      },
      ignoreDifferences: [
        { kind: 'Deployment', jsonPointers: ['/spec/replicas'] },
      ],
      revisionHistoryLimit: 10,
    },
    status: {
      sync: {
        status: 'Synced',
        revision: 'a3c1f8b9d23e4f5a6b7c8d9e0f1a2b3c4d5e6f7a',
      },
      health: { status: 'Healthy' },
      operationState: {
        phase: 'Succeeded',
        finishedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      sourceType: 'Directory',
      conditions: [],
    },
  },
  {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: 'secret-manager',
      namespace: 'argocd',
    },
    spec: {
      project: 'default',
      source: {
        repoURL: 'https://github.com/RemoteStar-AI/Gitops',
        path: 'secrets-management',
        targetRevision: 'main',
      },
      destination: {
        server: 'https://kubernetes.default.svc',
        namespace: 'external-secrets',
      },
      syncPolicy: { automated: { prune: false, selfHeal: false } },
      revisionHistoryLimit: 5,
    },
    status: {
      sync: {
        status: 'OutOfSync',
        revision: '9d4e0124a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0',
      },
      health: { status: 'Healthy' },
      operationState: {
        phase: 'Succeeded',
        finishedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      },
      sourceType: 'Helm',
      conditions: [
        {
          type: 'SyncError',
          message: 'Drift detected on values.yaml since last sync',
          lastTransitionTime: new Date(Date.now() - 60 * 1000).toISOString(),
        },
      ],
    },
  },
];

export const demoAppProjects: ArgoAppProjectJSON[] = [
  {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'AppProject',
    metadata: { name: 'default', namespace: 'argocd' },
    spec: {
      description: 'Default Argo CD project',
      destinations: [{ server: '*', namespace: '*' }],
      sourceRepos: ['*'],
    },
  },
];
