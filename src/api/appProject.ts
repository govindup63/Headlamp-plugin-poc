import { makeCustomResourceClass } from '@kinvolk/headlamp-plugin/lib/K8s/crd';

export interface AppProjectDestination {
  server?: string;
  name?: string;
  namespace: string; // may contain wildcards e.g. "team-acme-*"
}

export interface ArgoAppProjectSpec {
  description?: string;
  destinations?: AppProjectDestination[];
  sourceRepos?: string[];
  sourceNamespaces?: string[]; // app-in-any-namespace governance
}

export interface ArgoAppProjectJSON {
  apiVersion: 'argoproj.io/v1alpha1';
  kind: 'AppProject';
  metadata: { name: string; namespace: string };
  spec: ArgoAppProjectSpec;
}

export const ArgoAppProject = makeCustomResourceClass({
  apiInfo: [{ group: 'argoproj.io', version: 'v1alpha1' }],
  isNamespaced: true,
  singularName: 'appproject',
  pluralName: 'appprojects',
  kind: 'AppProject',
});
