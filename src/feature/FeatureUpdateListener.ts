import { FingerprintData } from "@atomist/automation-client";
import { Store } from "./Store";
import { FeatureStore } from "./FeatureStore";
import { RepoListenerInvocation, SdmListener } from "@atomist/sdm";
import { Feature } from "./Feature";

/**
 * Invocation when a feature has been upgraded in a project
 */
export interface FeatureUpdateInvocation<S extends FingerprintData = any> extends RepoListenerInvocation {

    store: Store;
    featureStore: FeatureStore;
    feature: Feature;
    ideal: S;
    valueInProject: S;
    rolloutCommandName: string;
}

export type FeatureUpdateListener = SdmListener<FeatureUpdateInvocation<any>>;
