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
    SdmContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    Attachment,
    SlackMessage,
} from "@atomist/slack-messages";
import { doWithRepos } from "./doWithRepos";
import {
    buttonForCommand,
    FingerprintData,
    logger,
    RepoRef,
} from "@atomist/automation-client";
import {
    ComparisonPolicy,
    FeatureRegistration,
} from "../FeatureRegistration";
import {
    PossibleNewIdealFeatureListener,
    rolloutBetterThanIdealFeatureListener,
} from "../PossibleNewIdealFeatureListener";
import {
    FeatureManager,
    transformToIdealCommandName,
} from "../FeatureManager";

/**
 * Put a button on each project to add the feature when an update
 * better than the ideal is detected
 */
export function enableButtonRollout(sdm: SoftwareDeliveryMachine, featureManager: FeatureManager): void {

    featureManager.addFeatureListener(
        rolloutBetterThanIdealFeatureListener(featureManager.store, featureManager.featureStore,
            newIdealListener()
        )
    );

    for (const feature of featureManager.features) {
        const rolloutCommandName = rolloutName(feature);

        // Set the ideal and roll out the feature
        sdm.addCommand<{ storageKey: string }>({
            name: rolloutCommandName,
            parameters: {
                storageKey: { description: "Storage key of the version of this feature we want to roll out" },
            },
            listener: async ci => {
                if (!ci.parameters.storageKey) {
                    throw new Error(`Internal error on command '${rolloutCommandName}': storageKey=${ci.parameters.storageKey}`);
                }
                const ideal = await featureManager.store.load(ci.parameters.storageKey);
                if (!ideal) {
                    throw new Error(`Internal error: No feature with storageKey=${ci.parameters.storageKey}`);
                }
                await featureManager.featureStore.setIdeal(ideal);
                return rolloutFeatureToDownstreamProjects({
                    feature,
                    valueToUpgradeTo: ideal,
                    transformCommandName: transformToIdealCommandName(feature),
                    sdm,
                    i: ci,
                });
            }
        });
    }
}

/**
 * Put a button on each project to add the feature
 */
function newIdealListener(): PossibleNewIdealFeatureListener {
    return async fui => {
        logger.info("Better than ideal feature %s found: value is %s vs %s. Stored at %s",
            fui.newValue.name,
            fui.feature.summary(fui.newValue),
            fui.feature.summary(fui.ideal),
            fui.storageKeyOfNewValue);
        const attachment: Attachment = {
            text: `Set new ideal for feature *${fui.feature.name}*: ${fui.feature.summary(fui.newValue)} vs existing ${fui.feature.summary(fui.ideal)}`,
            fallback: "accept feature",
            actions: [buttonForCommand({ text: `Accept feature ${fui.feature.name}` },
                rolloutName(fui.feature), {
                    storageKey: fui.storageKeyOfNewValue,
                }),
            ],
        };
        const message: SlackMessage = {
            attachments: [attachment],
        };
        logger.info("Slack message structure is %j", message);
        await fui.addressChannels(message);
    };
}

/**
 * Roll out buttons in all repos to convergenceTransform this version of the feature
 * @return {Promise<void>}
 */
async function rolloutFeatureToDownstreamProjects(what: {
    feature: FeatureRegistration<any>,
    valueToUpgradeTo: FingerprintData,
    transformCommandName: string,
    sdm: SoftwareDeliveryMachine,
    i: SdmContext
}): Promise<void> {
    logger.info("Rolling out command '%s' to convergenceTransform feature %s", what.transformCommandName, what.feature.name);
    return doWithRepos(what.sdm, what.i,
        async p => {
            const existingValue = await what.feature.projectFingerprinter(p);
            // Only upgrade if the project have a lower level of this feature
            if (!!existingValue && what.feature.compare(existingValue, what.valueToUpgradeTo, ComparisonPolicy.quality) < 0) {
                await offerFeatureToProject(what.feature, existingValue, what.valueToUpgradeTo, what.transformCommandName, p.id, what.i);
            }
        });
}

function rolloutName(feature: FeatureRegistration) {
    return `rollout-${feature.name.replace(" ", "_")}`;
}

/**
 * Offer the given feature value to the project with the given id
 * @param {FeatureRegistration<S extends Fingerprint>} feature
 * @param existingValue value of the feature currently in this project
 * @param {S} valueToUpgradeTo
 * @param {string} transformCommandName
 * @param {RepoRef} id
 * @param {SdmContext} i
 * @return {Promise<void>}
 */
async function offerFeatureToProject<S extends FingerprintData>(feature: FeatureRegistration<S>,
                                                                existingValue: S,
                                                                valueToUpgradeTo: S,
                                                                transformCommandName: string,
                                                                id: RepoRef,
                                                                i: SdmContext) {
    const attachment: Attachment = {
        text: `Accept new feature *${feature.name}*: ${feature.summary(valueToUpgradeTo)} vs existing ${feature.summary(existingValue)}?`,
        fallback: "accept feature",
        actions: [buttonForCommand({ text: `Accept feature ${feature.name}?` },
            transformCommandName,
            { "targets.owner": id.owner, "targets.repo": id.repo },
        ),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    await i.context.messageClient.addressChannels(message, id.repo);
}
