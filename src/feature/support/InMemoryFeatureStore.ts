/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FeatureStore } from "../FeatureStore";
import { FingerprintData } from "@atomist/automation-client";
import { RemoteRepoRef } from "@atomist/automation-client";

export class InMemoryFeatureStore implements FeatureStore {

    private ideals: { [name: string]: FingerprintData } = {};

    public async ideal(name: string): Promise<FingerprintData | undefined> {
        return this.ideals[name];
    }

    public async setIdeal(f: FingerprintData): Promise<any> {
        this.ideals[f.name] = f;
    }

    public async store(id: RemoteRepoRef, f: FingerprintData): Promise<any> {
        throw new Error();
    }

    constructor(...ideals: FingerprintData[]) {
        for (const ideal of ideals) {
            this.ideals[ideal.name] = ideal;
        }
    }
}