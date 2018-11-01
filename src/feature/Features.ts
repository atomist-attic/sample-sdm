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
    Feature,
} from "./Feature";
import {
    CodeInspectionRegistration,
    ExtensionPack,
    metadata,
    PushImpactListenerRegistration,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    FingerprintData,
    logger,
} from "@atomist/automation-client";
import { FeatureStore } from "./FeatureStore";
import {
    ExtensionPackCreator,
    WellKnownGoals,
} from "./ExtensionPackCreator";
import { Store } from "./Store";
import {
    FeatureUpdateInvocation,
    FeatureUpdateListener,
} from "./FeatureUpdateListener";
import { OfferToRolloutFeatureToEligibleProjects } from "./support/buttonRollout";

/**
 * Integrate a number of features with an SDM. Exposes commands to list features,
 * as well as to react to pushes to cascade.
 */
export class Features implements ExtensionPackCreator {

    private readonly featureUpdateListeners: FeatureUpdateListener[] = [];

    /**
     * Create an extension pack
     */
    public createExtensionPack(goals: WellKnownGoals = {}): ExtensionPack {
        return {
            ...metadata(),
            vendor: "atomist",
            configure: sdm => {
                sdm.addCodeInspectionCommand(this.listFeaturesCommand());
                logger.info("Enabling %d features with goals: %j", this.features.length, goals);
                this.features
                    .filter(f => !!f.apply)
                    .forEach(f => this.enableFeature(sdm, f, goals));
            },
        };
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

    public addFeatureUpdateListener(ful: FeatureUpdateListener) {
        this.featureUpdateListeners.push(ful);
    }

    /**
     * Enable this feature on the SDM and well-known goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {Feature} f
     * @param {WellKnownGoals} goals
     */
    private enableFeature(sdm: SoftwareDeliveryMachine,
                          f: Feature,
                          goals: WellKnownGoals) {
        const transformName = `tr-${f.name.replace(" ", "_")}`;
        const rolloutCommandName = `rollout-${f.name.replace(" ", "_")}`;

        sdm.addCodeTransformCommand({
            name: transformName,
            intent: `ideal ${f.name}`,
            transform: async (p, ci) => {
                const ideal = await this.featureStore.ideal(f.name);
                if (!!ideal) {
                    return f.apply(ideal)(p, ci);
                } else {
                    return ci.addressChannels(`No ideal found for feature ${f.name}`);
                }
            }
        });
        // sdm.addCommand<{ key: string }>({
        //     name: rolloutCommandName,
        //     listener: async ci => {
        //         const ideal = await this.store.load(ci.parameters.key);
        //         if (!ideal) {
        //             throw new Error(`Internal error: No feature with key ${ci.parameters.key}`);
        //         }
        //         await this.featureStore.setIdeal(ideal);
        //         return rolloutQualityOrderedFeatureToDownstreamProjects(f, ideal, transformName, sdm, ci);
        //     }
        // });
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
     * @param {Feature} feature
     * @param rolloutCommandName command name to roll out the feature
     * @return {PushImpactListenerRegistration}
     */
    private listenAndInvokeFeatureListeners(sdm: SoftwareDeliveryMachine,
                                            feature: Feature,
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

                        let pom = await (await pu.project.getFile("pom.xml")).getContent();
                        logger.info("POM IS " + pom + " fingerprinter=" + feature.projectFingerprinter);

                        const valueInProject = await feature.projectFingerprinter(pu.project);

                        pom = await (await pu.project.getFile("pom.xml")).getContent();
                        logger.info("POM2 IS " + pom + " fingerprinter=" + feature.projectFingerprinter);

                        if (!valueInProject) {
                            logger.warn("Anomaly: PushTest should not have returned true as the feature isn't found: Project is %j", pu.project);
                            return;
                        }

                        if (feature.compare(ideal, valueInProject, ComparisonPolicy.quality) < 0) {
                            const fui: FeatureUpdateInvocation = {
                                addressChannels: pu.addressChannels,
                                id: pu.id,
                                credentials: pu.credentials,
                                context: pu.context,
                                featureStore: this.featureStore,
                                store: this.store,
                                feature,
                                valueInProject,
                                ideal,
                                rolloutCommandName,
                            };
                            await Promise.all(this.featureUpdateListeners.map(ful => ful(fui)));
                        } else {
                            logger.info("Ideal feature %s value is %j, ours is %j and it's unremarkable", feature.name, ideal, valueInProject);
                        }
                    } else {
                        logger.info("No ideal found for feature %s", feature.name);
                    }
                } else {
                    logger.info("Feature %s doesn't support quality comparison", feature.name);
                }
            },
        };
    }

    constructor(private readonly store: Store,
                private readonly featureStore: FeatureStore,
                private readonly features: Feature[],
                featureUpdateListeners: FeatureUpdateListener[] = [OfferToRolloutFeatureToEligibleProjects]) {
        featureUpdateListeners.forEach(ful =>
            this.addFeatureUpdateListener(ful),
        );
    }

}
