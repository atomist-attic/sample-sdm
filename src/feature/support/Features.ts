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
} from "../Feature";
import {
    CodeInspectionRegistration,
    PushImpactListenerInvocation,
    PushImpactListenerRegistration,
    SdmContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    buttonForCommand,
    Fingerprint,
    logger,
    RemoteRepoRef,
    RepoRef,
} from "@atomist/automation-client";
import { FeatureStore } from "../FeatureStore";
import {
    Attachment,
    SlackMessage,
} from "@atomist/slack-messages";
import {
    Enabler,
    GoalsToCustomize,
} from "../Enabler";
import { WithLoadedProject } from "@atomist/sdm/lib/spi/project/ProjectLoader";

/**
 * Integrate a number of features with an SDM
 */
export class Features implements Enabler {

    private readonly features: Feature[];

    /**
     * Enable these features on the given SDM
     */
    public enable(sdm: SoftwareDeliveryMachine, goals: GoalsToCustomize = {}): void {
        sdm.addCodeInspectionCommand(this.listFeaturesCommand());
        logger.info("Enabling %d features with goals: %j", this.features.length, goals);
        this.features
            .filter(f => !!f.apply)
            .forEach(f => enableFeature(sdm, this.store, f, goals));
    }

    private listFeaturesCommand(): CodeInspectionRegistration<Fingerprint[]> {
        return {
            name: "feature-list",
            intent: "list features",
            inspection: async p => {
                const scans = await Promise.all(
                    this.features.map(f => f.projectFingerprinter(p)));
                return scans
                    .filter(s => !!s)
                    .sort((a, b) => (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            },
            onInspectionResults: async (results, ci) => {
                for (const r of results) {
                    await ci.addressChannels(`Repo ${r.repoId.url}: \`${results.map(r => r.result.map(s => s.name))}\``);
                }
            },
        };
    }

    constructor(private readonly store: FeatureStore, ...features: Feature[]) {
        this.features = features;
    }

}

/**
 * Enable this feature on the well-known goals
 * @param {SoftwareDeliveryMachine} sdm
 * @param {FeatureStore} store
 * @param {Feature} f
 * @param {GoalsToCustomize} goals
 */
function enableFeature(sdm: SoftwareDeliveryMachine,
                       store: FeatureStore,
                       f: Feature,
                       goals: GoalsToCustomize) {
    const transformName = `tr-${f.name.replace(" ", "_")}`;
    sdm.addCodeTransformCommand({
        name: transformName,
        intent: `transform ${f.name}`,
        transform: f.apply(f.ideal),
    });
    if (!!goals.inspectGoal) {
        logger.info("Registering inspection goal");
        goals.inspectGoal.with(f.inspection);
    }
    if (!!goals.pushImpactGoal) {
        logger.info("Registering push impact goal");
        // Register a push reaction when a project with this features changes
        goals.pushImpactGoal.with(listenAndRolloutUpgrades(sdm, store, f, transformName));
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
 * @param {FeatureStore} store
 * @param {Feature} f
 * @param {string} transformName
 * @return {PushImpactListenerRegistration}
 */
function listenAndRolloutUpgrades(sdm: SoftwareDeliveryMachine,
                                  store: FeatureStore,
                                  f: Feature,
                                  transformName: string): PushImpactListenerRegistration {
    return {
        name: `pi-${f.name}`,
        pushTest: f.isPresent,
        action: async pu => {
            logger.info("Push on project with feature %s", f.name);
            if (f.supportedComparisonPolicies.includes(ComparisonPolicy.quality)) {
                const ideal = await store.ideal(f.name);
                logger.info("Ideal feature %s value is %j", f.name, ideal);
                if (!!ideal) {
                    const after = await f.projectFingerprinter(pu.project);
                    if (f.compare(ideal, after, ComparisonPolicy.quality) > 0) {
                        // TODO ask about setting ideal
                        await store.setIdeal(after);
                        return rolloutQualityOrderedFeatureToDownstreamProjects(f, ideal, transformName, sdm, pu);
                    } else {
                        logger.info("Ideal feature %s value is %j, ours is %j and it's fine", f.name, ideal, after);
                    }
                }
            } else {
                logger.info("Feature %s doesn't support quality comparison", f.name);
            }
        },
    };
}

/**
 * Roll out buttons in all repos to apply this version of the feature
 * @return {Promise<void>}
 */
async function rolloutQualityOrderedFeatureToDownstreamProjects<S extends Fingerprint>(feature: Feature<S>,
                                                                                       valueToUpgradeTo: S,
                                                                                       command: string,
                                                                                       sdm: SoftwareDeliveryMachine,
                                                                                       i: PushImpactListenerInvocation) {
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
async function offerFeatureToProject<S extends Fingerprint>(feature: Feature<S>,
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

/**
 * Perform a readonly action on all accessible repos in parallel
 * @param {SoftwareDeliveryMachine} sdm
 * @param {SdmContext} i
 * @param {WithLoadedProject<any>} action
 * @return {Promise<any>}
 */
async function doWithRepos(sdm: SoftwareDeliveryMachine,
                           i: SdmContext,
                           action: WithLoadedProject<any>): Promise<any> {
    const repos = await sdm.configuration.sdm.repoFinder(i.context);
    logger.info("doWithRepos working on %d repos", repos.length);
    await Promise.all(repos.map(id => {
        return sdm.configuration.sdm.projectLoader.doWithProject(
            { credentials: i.credentials, id: id as RemoteRepoRef, readOnly: true },
            action)
            .catch(err => {
                logger.warn("Project err: %s", err);
            });
    }));
}