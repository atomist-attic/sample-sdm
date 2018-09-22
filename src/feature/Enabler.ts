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

import { AutoCodeInspection, Fingerprint as FingerprintGoal, PushImpact, SoftwareDeliveryMachine } from "@atomist/sdm";

// TODO moves along with extension pack

/**
 * Goals in use in an SDM that should be customized by an Enabler
 */
export interface GoalsToCustomize {

    pushImpactGoal?: PushImpact,
    inspectGoal?: AutoCodeInspection,
    fingerprintGoal?: FingerprintGoal,
}

/**
 * Enable the SDM with given capabilities including customization
 * of well-known goal instances
 */
export interface Enabler {

    /**
     * Enable a feature in the SDM with the given goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {GoalsToCustomize} goals
     */
    enable(sdm: SoftwareDeliveryMachine, goals: GoalsToCustomize): void;


}