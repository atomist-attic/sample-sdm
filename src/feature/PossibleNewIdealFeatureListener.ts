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

import { FingerprintData } from "@atomist/automation-client";
import { Store } from "./Store";
import { FeatureStore } from "./FeatureStore";
import {
    RepoListenerInvocation,
    SdmListener,
} from "@atomist/sdm";
import { FeatureRegistration } from "./FeatureRegistration";

/**
 * Invocation when we've seen a version of a feature in a project
 * that is better than our present team-wide ideal.
 */
export interface PossibleNewIdealFeatureInvocation<S extends FingerprintData = any> extends RepoListenerInvocation {

    store: Store;
    featureStore: FeatureStore;
    feature: FeatureRegistration;
    ideal: S;
    valueInProject: S;
    rolloutCommandName: string;
}

export type PossibleNewIdealFeatureListener = SdmListener<PossibleNewIdealFeatureInvocation<any>>;
