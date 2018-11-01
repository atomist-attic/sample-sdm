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

import {
    FingerprintData,
    RemoteRepoRef,
} from "@atomist/automation-client";

export interface FeatureStore {

    /**
     * Store the feature value for this project
     * @param {RemoteRepoRef} id
     * @param {Fingerprint} f
     * @return {Promise<any>}
     */
    store(id: RemoteRepoRef, f: FingerprintData): Promise<any>;

    /**
     * Set the ideal state of this feature
     * @param {Fingerprint} f
     * @return {Promise<any>}
     */
    setIdeal(f: FingerprintData): Promise<any>;

    /**
     * Return the ideal state of the feature with the given name,
     * or undefined if none is set
     * @param {string} name
     * @return {Promise<Fingerprint | undefined>}
     */
    ideal(name: string): Promise<FingerprintData | undefined>;

}
