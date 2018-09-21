import { FeatureStore } from "../FeatureStore";
import { Fingerprint } from "@atomist/automation-client";
import { RemoteRepoRef } from "@atomist/automation-client";

export class InMemoryFeatureStore implements FeatureStore {

    private ideals: { [name: string]: Fingerprint } = {};

    public async ideal(name: string): Promise<Fingerprint | undefined> {
        return this.ideals[name];
    }

    public async setIdeal(f: Fingerprint): Promise<any> {
        this.ideals[f.name] = f;
    }

    public async store(id: RemoteRepoRef, f: Fingerprint): Promise<any> {
        throw new Error();
    }

    constructor(...ideals: Fingerprint[]) {
        for (const ideal of ideals) {
            this.ideals[ideal.name] = ideal;
        }
    }
}