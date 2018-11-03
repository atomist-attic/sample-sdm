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
    FeatureRegistration,
} from "./FeatureRegistration";
import {
    CodeInspectionRegistration,
    PushImpactListenerRegistration,
    SoftwareDeliveryMachine,
    WellKnownGoals,
} from "@atomist/sdm";
import {
    FingerprintData,
    logger,
} from "@atomist/automation-client";
import { FeatureStore } from "./FeatureStore";
import { Store } from "./Store";
import {
    FeatureInvocation,
    FeatureListener,
} from "./FeatureListener";

/**
 * Integrate a number of features with an SDM. Exposes commands to list features,
 * as well as to react to pushes to cascade.
 */
export class FeatureManager {

    private readonly featureListeners: FeatureListener[] = [];

    /**
     * Add the capabilities of this FeatureManager to the given SDM
     */
    public enable(sdm: SoftwareDeliveryMachine, goals: WellKnownGoals = {}): void {
        sdm.addCodeInspectionCommand(this.listFeaturesCommand());
        logger.info("Enabling %d features with goals: %j", this.features.length, goals);
        this.features
            .filter(f => !!f.convergenceTransform)
            .forEach(f => this.enableFeature(sdm, f, goals));
    }

    private listFeaturesCommand(): CodeInspectionRegistration<FingerprintData[]> {
        return {
            name: "feature-list",
            intent: "list features",
            inspection: async p => {
                const scans = await Promise.all(
                    this.features.map(f => f.projectFingerprinter(p)));
                return scans
                    .filter(s => !!s)
                    .sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0));
            },
            onInspectionResults: async (results, ci) => {
                for (const r of results) {
                    await ci.addressChannels(`Repo ${r.repoId.url}: \`${results.map(r => r.result.map(s => s.name))}\``);
                }
            },
        };
    }

    public addFeatureListener(ful: FeatureListener) {
        this.featureListeners.push(ful);
    }

    /**
     * Enable this feature on the SDM and well-known goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {FeatureRegistration} feature
     * @param {WellKnownGoals} goals
     */
    private enableFeature(sdm: SoftwareDeliveryMachine,
                          feature: FeatureRegistration,
                          goals: WellKnownGoals) {
        const transformCommandName = transformToIdealCommandName(feature);
        sdm.addCodeTransformCommand({
            name: transformCommandName,
            intent: `ideal ${feature.name}`,
            transform: async (p, ci) => {
                const ideal = await this.featureStore.ideal(feature.name);
                if (!!ideal) {
                    return feature.convergenceTransform(ideal)(p, ci);
                } else {
                    return ci.addressChannels(`No ideal found for feature ${feature.name}`);
                }
            }
        });
        if (!!goals.inspectGoal) {
            logger.info("Registering inspection goal");
            goals.inspectGoal.with(feature.inspection);
        }
        if (!!goals.pushImpactGoal) {
            logger.info("Registering push impact goal");
            // Register a push reaction when a project with this features changes
            goals.pushImpactGoal.with(this.listenAndInvokeFeatureListeners(sdm, feature));
        }
        if (!!goals.fingerprintGoal) {
            logger.info("Registering fingerprinter");
            goals.fingerprintGoal.with(feature.fingerprinterRegistration);
        }
    }

    /**
     * Listen to pushes to projects with this feature and roll out upgrades
     * to relevant downstream projects if the relevant version moves the ideal
     * @param {SoftwareDeliveryMachine} sdm
     * @param {FeatureRegistration} feature
     * @return {PushImpactListenerRegistration}
     */
    private listenAndInvokeFeatureListeners(sdm: SoftwareDeliveryMachine,
                                            feature: FeatureRegistration): PushImpactListenerRegistration {
        return {
            name: `pi-${feature.name}`,
            pushTest: feature.isPresent,
            action: async pu => {
                logger.info("Push on project with feature %s", feature.name);
                const valueInProject = await feature.projectFingerprinter(pu.project);
                if (!valueInProject) {
                    logger.warn("Anomaly: PushTest should not have returned true as the feature isn't found: Project is %j", pu.project);
                    return;
                }
                if (!valueInProject) {
                    logger.warn("Anomaly: PushTest should not have returned true as the feature isn't found: Project is %j", pu.project);
                    return;
                }
                const stored = await this.store.save(valueInProject);
                const fi: FeatureInvocation<any> = {
                    addressChannels: pu.addressChannels,
                    id: pu.id,
                    credentials: pu.credentials,
                    context: pu.context,
                    feature,
                    newValue: valueInProject,
                    storageKeyOfNewValue: stored,
                };
                await Promise.all(this.featureListeners.map(ful => ful(fi)));
            },
        };
    }

    constructor(public readonly store: Store,
                public readonly featureStore: FeatureStore,
                public readonly features: FeatureRegistration[],
                featureListeners: FeatureListener[] = []) {
        featureListeners.forEach(ful =>
            this.addFeatureListener(ful),
        );
    }

}

/**
 * Return the name of the command registered with the SDM to transform
 * projects to the ideal state of this feature
 * @param {FeatureRegistration} feature
 * @return {string}
 */
export function transformToIdealCommandName(feature: FeatureRegistration): string {
    return `tr-${feature.name.replace(" ", "_")}`;
}