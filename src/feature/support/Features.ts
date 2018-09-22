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

    private listFeaturesCommand(): CodeInspectionRegistration<string[]> {
        return {
            name: "feature-list",
            intent: "list features",
            inspection: async p => {
                const scans = await Promise.all(this.features.map(f => f.projectFingerprinter(p)));
                return scans.map(s => s.name).sort();
            },
            onInspectionResults: async (results, ci) => {
                for (const r of results) {
                    await ci.addressChannels(`Repo ${r.repoId.url}: \`${results.map(r => r.result)}\``)
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
 * Listen to pushes of relevant projects and roll out upgrades
 * to relevant downstream projects
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
                        // TODO ask
                        await store.setIdeal(after);
                        return rolloutToDownstreamProjects(f, ideal, transformName, sdm, pu);
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
async function rolloutToDownstreamProjects<S extends Fingerprint>(feature: Feature<S>,
                                                                  valueToUpgradeTo: S,
                                                                  command: string,
                                                                  sdm: SoftwareDeliveryMachine,
                                                                  i: PushImpactListenerInvocation) {
    logger.info("Rolling out command '%s' to apply feature %s", command, feature.name);
    return doWithRepos(sdm, i,
        async p => {
            const found = await feature.projectFingerprinter(p);
            // Only upgrade if they have a lower level of this feature
            if (!!found && feature.compare(found, valueToUpgradeTo, ComparisonPolicy.quality) < 0) {
                const attachment: Attachment = {
                    text: `Accept new feature *${feature.name}*: ${feature.summary(valueToUpgradeTo)}?`,
                    fallback: "accept feature",
                    actions: [buttonForCommand({ text: `Accept feature ${feature.name}?` },
                        command,
                        { "targets.owner": p.id.owner, "targets.repo": p.id.repo },
                    ),
                    ],
                };
                const message: SlackMessage = {
                    attachments: [attachment],
                };
                await i.context.messageClient.addressChannels(message, p.id.repo);
            }
        });
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
    await Promise.all(repos.map(id => {
        return sdm.configuration.sdm.projectLoader.doWithProject(
            { credentials: i.credentials, id: id as RemoteRepoRef, readOnly: true },
            action);
    }));
}
