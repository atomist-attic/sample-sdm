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
import {
    RepoListenerInvocation,
    SdmListener,
} from "@atomist/sdm";
import { FeatureRegistration } from "./FeatureRegistration";

export interface FeatureInvocation<S extends FingerprintData> extends RepoListenerInvocation {

    /**
     * The feature we're concerned with
     */
    feature: FeatureRegistration;

    /**
     * The new value we've seen.
     */
    newValue: S;

    /***
     * Key in the store of our storageKeyOfNewValue value.
     * Useful to pass to command handlers.
     */
    storageKeyOfNewValue: string;

    /**
     * Name of the rollout command.
     */
    //rolloutCommandName: string;

}

/**
 * The feature may already be in the project
 * TODO what about getting old value
 */
export type FeatureListener = SdmListener<FeatureInvocation<any>>;
