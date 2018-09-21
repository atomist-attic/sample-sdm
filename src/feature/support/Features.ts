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
    AutoCodeInspection, CodeInspectionRegistration, CommandHandlerRegistration, CommandRegistration,
    PushImpact,
    PushImpactListenerInvocation, PushImpactListenerRegistration,
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

/**
 * Integrate a number of features with an SDM
 */
export class Features {

    private readonly features: Feature[];

    /**
     * Enable these features on the given SDM
     */
    public enable(sdm: SoftwareDeliveryMachine, opts: {
        pushImpactGoal?: PushImpact,
        inspectGoal?: AutoCodeInspection,
    } = {}): void {
        sdm.addCodeInspectionCommand(this.listFeaturesCommand());

        this.features.filter(f => !!f.apply)
            .forEach(f => {
                logger.info("Enabling %d features: %j", this.features.length, opts);
                const transformName = `tr-${f.name}`;
                sdm.addCodeTransformCommand({
                    name: transformName,
                    intent: `transform ${f.name}`,
                    transform: f.apply(f.ideal),
                });
                if (!!opts.inspectGoal) {
                    logger.info("Registering inspection goal");
                    opts.inspectGoal.with(f.inspection);
                }
                if (!!opts.pushImpactGoal) {
                    logger.info("Registering push impact goal");
                    // Register a push reaction when a project with this features changes
                    opts.pushImpactGoal.with(rolloutOnUpgradeToProjectWithFeature(sdm, this.store, f, transformName));
                }
            });
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

function rolloutOnUpgradeToProjectWithFeature(sdm: SoftwareDeliveryMachine,
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
                        return rollout(f, ideal, transformName, sdm, pu);
                    }
                }
            } else {
                logger.info("Feature %s doesn't support quality comparison", f.name);
            }
        },
    };
}

/**
 * Roll out buttons in all repos
 * @param {Feature} feature
 * @param {SoftwareDeliveryMachine} sdm
 * @param {PushImpactListenerInvocation} i
 * @return {Promise<void>}
 */
async function rollout<S extends Fingerprint>(feature: Feature<S>,
                                              value: S,
                                              command: string,
                                              sdm: SoftwareDeliveryMachine,
                                              i: PushImpactListenerInvocation) {
    // TODO factor out iteration and put in sdm
    const repos = await sdm.configuration.sdm.repoFinder(i.context);
    for (const id of repos) {
        await sdm.configuration.sdm.projectLoader.doWithProject(
            { credentials: i.credentials, id: id as RemoteRepoRef, readOnly: false },
            async p => {
                const found = !!await feature.projectFingerprinter(p);
                if (found) {
                    const attachment: Attachment = {
                        text: `Accept new feature ${feature.name}: ${feature.summary(value)}?`,
                        fallback: "accept feature",
                        actions: [buttonForCommand({ text: `Accept feature ${feature.name}` },
                            command,
                            { "targets.owner": id.owner, "targets.repo": id.repo },
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
}

// function reviewerRegistration(f: Feature): ReviewerRegistration {
//     return {
//         name: f.name,
//         pushTest: f.isRelevant,
//         inspection: f.reviewer,
//     };
// }
