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
    ComparisonPolicy,
    FeatureRegistration,
} from "./FeatureRegistration";
import {
    CodeInspectionRegistration,
    PushImpactListenerRegistration,
    SdmContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    FingerprintData,
    logger,
} from "@atomist/automation-client";
import { FeatureStore } from "./FeatureStore";
import {
    WellKnownGoals,
} from "./ExtensionPackCreator";
import { Store } from "./Store";
import {
    PossibleNewIdealFeatureInvocation,
    PossibleNewIdealFeatureListener,
} from "./PossibleNewIdealFeatureListener";
import {
    ButtonFeatureRolloutStrategy,
} from "./support/ButtonFeatureRolloutStrategy";

/**
 * Implemented by types that can roll out a version of a feature to many projects.
 */
export interface FeatureRolloutStrategy<S extends FingerprintData> {

    listener: PossibleNewIdealFeatureListener;

    rolloutFeatureToDownstreamProjects(what: {
        feature: FeatureRegistration<S>,
        valueToUpgradeTo: S,
        command: string,
        sdm: SoftwareDeliveryMachine,
        i: SdmContext
    }): Promise<void>;
}

/**
 * Integrate a number of features with an SDM. Exposes commands to list features,
 * as well as to react to pushes to cascade.
 */
export class FeatureManager {

    private readonly possibleNewIdealFeatureListeners: PossibleNewIdealFeatureListener[] = [];

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

    public addPossibleNewIdealFeatureListener(ful: PossibleNewIdealFeatureListener) {
        this.possibleNewIdealFeatureListeners.push(ful);
    }

    /**
     * Enable this feature on the SDM and well-known goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {FeatureRegistration} f
     * @param {WellKnownGoals} goals
     */
    private enableFeature(sdm: SoftwareDeliveryMachine,
                          f: FeatureRegistration,
                          goals: WellKnownGoals) {
        const transformName = `tr-${f.name.replace(" ", "_")}`;
        const rolloutCommandName = `rollout-${f.name.replace(" ", "_")}`;

        sdm.addCodeTransformCommand({
            name: transformName,
            intent: `ideal ${f.name}`,
            transform: async (p, ci) => {
                const ideal = await this.featureStore.ideal(f.name);
                if (!!ideal) {
                    return f.convergenceTransform(ideal)(p, ci);
                } else {
                    return ci.addressChannels(`No ideal found for feature ${f.name}`);
                }
            }
        });
        sdm.addCommand<{ storageKey: string }>({
            name: rolloutCommandName,
            listener: async ci => {
                const ideal = await this.store.load(ci.parameters.storageKey);
                if (!ideal) {
                    throw new Error(`Internal error: No feature with storageKey ${ci.parameters.storageKey}`);
                }
                await this.featureStore.setIdeal(ideal);
                return this.rolloutStrategy.rolloutFeatureToDownstreamProjects({
                    feature: f, valueToUpgradeTo: ideal, command: transformName, sdm, i: ci
                });
            }
        });
        if (!!goals.inspectGoal) {
            logger.info("Registering inspection goal");
            goals.inspectGoal.with(f.inspection);
        }
        if (!!goals.pushImpactGoal) {
            logger.info("Registering push impact goal");
            // Register a push reaction when a project with this features changes
            goals.pushImpactGoal.with(this.listenAndInvokeFeatureListeners(sdm, f, rolloutCommandName));
        }
        if (!!goals.fingerprintGoal) {
            logger.info("Registering fingerprinter");
            goals.fingerprintGoal.with(f.fingerprinterRegistration);
        }
    }

    /**
     * Listen to pushes to projects with this feature and roll out upgrades
     * to relevant downstream projects if the relevant version moves the ideal
     * @param {SoftwareDeliveryMachine} sdm
     * @param {FeatureRegistration} feature
     * @param rolloutCommandName command name to roll out the feature
     * @return {PushImpactListenerRegistration}
     */
    private listenAndInvokeFeatureListeners(sdm: SoftwareDeliveryMachine,
                                            feature: FeatureRegistration,
                                            rolloutCommandName: string): PushImpactListenerRegistration {
        return {
            name: `pi-${feature.name}`,
            pushTest: feature.isPresent,
            action: async pu => {
                logger.info("Push on project with feature %s", feature.name);
                if (feature.supportedComparisonPolicies.includes(ComparisonPolicy.quality)) {
                    const ideal = await this.featureStore.ideal(feature.name);
                    logger.info("Ideal feature %s value is %j", feature.name, ideal);
                    if (!!ideal) {
                        const valueInProject = await feature.projectFingerprinter(pu.project);
                        if (!valueInProject) {
                            logger.warn("Anomaly: PushTest should not have returned true as the feature isn't found: Project is %j", pu.project);
                            return;
                        }

                        if (feature.compare(ideal, valueInProject, ComparisonPolicy.quality) < 0) {
                            const stored = await this.store.save(valueInProject);
                            const fui: PossibleNewIdealFeatureInvocation = {
                                addressChannels: pu.addressChannels,
                                id: pu.id,
                                credentials: pu.credentials,
                                context: pu.context,
                                feature,
                                newValue: valueInProject,
                                ideal,
                                storageKeyOfNewValue: stored,
                                rolloutCommandName,
                            };

                            await Promise.all(this.possibleNewIdealFeatureListeners.map(ful => ful(fui)));
                        } else {
                            logger.info("Ideal feature %s value is %j, ours is %j and it's unremarkable", feature.name, ideal, valueInProject);
                        }
                    } else {
                        logger.info("No ideal found for feature %s", feature.name);
                    }
                } else {
                    logger.info("FeatureRegistration %s doesn't support quality comparison", feature.name);
                }
            },
        };
    }

    constructor(private readonly store: Store,
                private readonly featureStore: FeatureStore,
                private readonly features: FeatureRegistration[],
                private readonly rolloutStrategy: FeatureRolloutStrategy<any> = new ButtonFeatureRolloutStrategy(),
                featureUpdateListeners: PossibleNewIdealFeatureListener[] = []) {
        this.addPossibleNewIdealFeatureListener(this.rolloutStrategy.listener);
        featureUpdateListeners.forEach(ful =>
            this.addPossibleNewIdealFeatureListener(ful),
        );
    }

}
