// Constants taken from Argo CD's common/common.go.
// These three keys cover all three of Argo CD's resource tracking modes:
//   - label-only (default; capped at 63 chars, can truncate)
//   - annotation+label (annotation carries full id, label kept for selectors)
//   - annotation-only (newer, no length limit)
// The POC reads whichever is present so it works regardless of cluster config.
export const ARGO_INSTANCE_LABEL = 'app.kubernetes.io/instance';
export const ARGO_TRACKING_ANNOTATION = 'argocd.argoproj.io/tracking-id';

// Opt-in label that lets cluster operators explicitly claim an Application
// for a given Headlamp Project, useful when destinations are unusual.
export const HEADLAMP_PROJECT_ID_LABEL = 'headlamp.dev/project-id';

// Sentinel destination URL Argo CD uses for the cluster it itself runs in.
export const IN_CLUSTER_SERVER = 'https://kubernetes.default.svc';
