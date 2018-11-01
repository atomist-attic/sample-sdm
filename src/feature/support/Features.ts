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

import { ComparisonPolicy, Feature, } from "../Feature";
import {
    CodeInspectionRegistration,
    PushImpactListenerRegistration,
    RepoListenerInvocation,
    SdmContext,
    SdmListener,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { buttonForCommand, FingerprintData, logger, RepoRef, } from "@atomist/automation-client";
import { FeatureStore } from "../FeatureStore";
import { Attachment, SlackMessage, } from "@atomist/slack-messages";
import { Enabler, GoalsToCustomize, } from "../Enabler";
import { Store } from "../Store";
import { doWithRepos } from "./doWithRepos";

/**
 * Integrate a number of features with an SDM
 */
export class Features implements Enabler {

    private readonly features: Feature[];

    private readonly featureUpdateListeners: FeatureUpdateListener[] = [];

    /**
     * Enable these features on the given SDM
     */
    public enable(sdm: SoftwareDeliveryMachine, goals: GoalsToCustomize = {}): void {
        sdm.addCodeInspectionCommand(this.listFeaturesCommand());
        logger.info("Enabling %d features with goals: %j", this.features.length, goals);
        this.features
            .filter(f => !!f.apply)
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

    public addFeatureUpdateListener(ful: FeatureUpdateListener) {
        this.featureUpdateListeners.push(ful);
    }

    /**
     * Enable this feature on the SDM and well-known goals
     * @param {SoftwareDeliveryMachine} sdm
     * @param {Feature} f
     * @param {GoalsToCustomize} goals
     */
    private enableFeature(sdm: SoftwareDeliveryMachine,
                          f: Feature,
                          goals: GoalsToCustomize) {
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
        sdm.addCommand<{ key: string }>({
            name: rolloutCommandName,
            listener: async ci => {
                const ideal = await this.store.load(ci.parameters.key);
                if (!ideal) {
                    throw new Error(`Internal error: No feature with key ${ci.parameters.key}`);
                }
                await this.featureStore.setIdeal(ideal);
                return rolloutQualityOrderedFeatureToDownstreamProjects(f, ideal, transformName, sdm, ci);
            }
        });
        if (!!goals.codeInspectionGoal) {
            logger.info("Registering inspection goal");
            goals.codeInspectionGoal.with(f.inspection);
        }
        if (!!goals.pushImpactGoal) {
            logger.info("Registering push impact goal");
            // Register a push reaction when a project with this features changes
            goals.pushImpactGoal.with(this.listenAndRolloutUpgrades(sdm, f, rolloutCommandName));
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
    private listenAndRolloutUpgrades(sdm: SoftwareDeliveryMachine,
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
                        const valueInProject = await feature.projectFingerprinter(pu.project);
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
                    }
                } else {
                    logger.info("Feature %s doesn't support quality comparison", feature.name);
                }
            },
        };
    }

    constructor(private readonly store: Store,
                private readonly featureStore: FeatureStore,
                ...features: Feature[]) {
        this.features = features;
        this.addFeatureUpdateListener(OfferToRolloutFeatureToEligibleProjects);
    }

}

/**
 * Invocation when a feature has been upgraded in a project
 */
export interface FeatureUpdateInvocation<S extends FingerprintData = any> extends RepoListenerInvocation {

    store: Store;
    featureStore: FeatureStore;
    feature: Feature;
    ideal: S;
    valueInProject: S;
    rolloutCommandName: string;
}

export type FeatureUpdateListener = SdmListener<FeatureUpdateInvocation<any>>;

export const OfferToRolloutFeatureToEligibleProjects: FeatureUpdateListener = async fui => {
    logger.info("Better than ideal feature %s found: value is %s vs %s", fui.valueInProject.name, fui.feature.summary(fui.valueInProject), fui.feature.summary(fui.ideal));
    const stored = await fui.store.save(fui.valueInProject);
    const attachment: Attachment = {
        text: `Set new ideal for feature *${fui.feature.name}*: ${fui.feature.summary(fui.valueInProject)} vs existing ${fui.feature.summary(fui.ideal)}`,
        fallback: "accept feature",
        actions: [buttonForCommand({ text: `Accept feature ${fui.feature.name}?` },
            fui.rolloutCommandName, {
                key: stored,
            }),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    await fui.addressChannels(message);
};

/**
 * Roll out buttons in all repos to apply this version of the feature
 * @return {Promise<void>}
 */
async function rolloutQualityOrderedFeatureToDownstreamProjects<S extends FingerprintData>(feature: Feature<S>,
                                                                                       valueToUpgradeTo: S,
                                                                                       command: string,
                                                                                       sdm: SoftwareDeliveryMachine,
                                                                                       i: SdmContext) {
    logger.info("Rolling out command '%s' to apply feature %s", command, feature.name);
    return doWithRepos(sdm, i,
        async p => {
            const existingValue = await feature.projectFingerprinter(p);
            // Only upgrade if the project have a lower level of this feature
            if (!!existingValue && feature.compare(existingValue, valueToUpgradeTo, ComparisonPolicy.quality) < 0) {
                await offerFeatureToProject(feature, existingValue, valueToUpgradeTo, command, p.id, i);
            }
        });
}

/**
 * Offer the given feature value to the project with the given id
 * @param {Feature<S extends Fingerprint>} feature
 * @param existingValue value of the feature currently in this project
 * @param {S} valueToUpgradeTo
 * @param {string} command
 * @param {RepoRef} id
 * @param {SdmContext} i
 * @return {Promise<void>}
 */
async function offerFeatureToProject<S extends FingerprintData>(feature: Feature<S>,
                                                            existingValue: S,
                                                            valueToUpgradeTo: S,
                                                            command: string,
                                                            id: RepoRef,
                                                            i: SdmContext) {
    const attachment: Attachment = {
        text: `Accept new feature *${feature.name}*: ${feature.summary(valueToUpgradeTo)} vs existing ${feature.summary(existingValue)}?`,
        fallback: "accept feature",
        actions: [buttonForCommand({ text: `Accept feature ${feature.name}?` },
            command,
            { "targets.owner": id.owner, "targets.repo": id.repo },
        ),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    await i.context.messageClient.addressChannels(message, id.repo);
}
