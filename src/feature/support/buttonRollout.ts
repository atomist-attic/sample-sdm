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
import { PossibleNewIdealFeatureListener } from "../PossibleNewIdealFeatureListener";
import {
    ComparisonPolicy,
    FeatureRegistration,
} from "../FeatureRegistration";
import { RollerOuter } from "../FeatureManager";

/**
 * Put a button on each project to add the feature
 * @param {PossibleNewIdealFeatureInvocation<any>} fui
 * @return {Promise<void>}
 * @constructor
 */
export const OfferToRolloutFeatureToEligibleProjects: PossibleNewIdealFeatureListener = async fui => {
    logger.info("Better than ideal feature %s found: value is %s vs %s",
        fui.newValue.name,
        fui.feature.summary(fui.newValue),
        fui.feature.summary(fui.ideal));
    const attachment: Attachment = {
        text: `Set new ideal for feature *${fui.feature.name}*: ${fui.feature.summary(fui.newValue)} vs existing ${fui.feature.summary(fui.ideal)}`,
        fallback: "accept feature",
        actions: [buttonForCommand({ text: `Accept feature ${fui.feature.name}?` },
            fui.rolloutCommandName, {
                key: fui.storageKeyOfNewValue,
            }),
        ],
    };
    const message: SlackMessage = {
        attachments: [attachment],
    };
    await fui.addressChannels(message);
};

export class ButtonRollerOuter implements RollerOuter<any> {

    /**
     * Roll out buttons in all repos to convergenceTransform this version of the feature
     * @return {Promise<void>}
     */
    public async rolloutFeatureToDownstreamProjects(what: {
        feature: FeatureRegistration<any>,
        valueToUpgradeTo: FingerprintData,
        command: string,
        sdm: SoftwareDeliveryMachine,
        i: SdmContext
    }): Promise<void> {
        logger.info("Rolling out command '%s' to convergenceTransform feature %s", what.command, what.feature.name);
        return doWithRepos(what.sdm, what.i,
            async p => {
                const existingValue = await what.feature.projectFingerprinter(p);
                // Only upgrade if the project have a lower level of this feature
                if (!!existingValue && what.feature.compare(existingValue, what.valueToUpgradeTo, ComparisonPolicy.quality) < 0) {
                    await offerFeatureToProject(what.feature, existingValue, what.valueToUpgradeTo, what.command, p.id, what.i);
                }
            });
    }
}

/**
 * Offer the given feature value to the project with the given id
 * @param {FeatureRegistration<S extends Fingerprint>} feature
 * @param existingValue value of the feature currently in this project
 * @param {S} valueToUpgradeTo
 * @param {string} command
 * @param {RepoRef} id
 * @param {SdmContext} i
 * @return {Promise<void>}
 */
async function offerFeatureToProject<S extends FingerprintData>(feature: FeatureRegistration<S>,
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
