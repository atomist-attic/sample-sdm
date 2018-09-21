import { Fingerprint, RemoteRepoRef } from "@atomist/automation-client";

export interface FeatureStore {

    store(id: RemoteRepoRef, f: Fingerprint): Promise<any>;

    setIdeal(f: Fingerprint): Promise<any>;

    ideal(name: string): Promise<Fingerprint | undefined>;

}
