import { SdmContext, SoftwareDeliveryMachine } from "@atomist/sdm";
import { Attachment, SlackMessage } from "@atomist/slack-messages";
import { doWithRepos } from "./doWithRepos";
import { buttonForCommand, FingerprintData, logger, RepoRef } from "@atomist/automation-client";
import { FeatureUpdateListener } from "../FeatureUpdateListener";
import { ComparisonPolicy, Feature } from "../Feature";

/**
 * Put a button on each project to add the feature
 * @param {FeatureUpdateInvocation<any>} fui
 * @return {Promise<void>}
 * @constructor
 */
export const OfferToRolloutFeatureToEligibleProjects: FeatureUpdateListener = async fui => {
    logger.info("Better than ideal feature %s found: value is %s vs %s",
        fui.valueInProject.name,
        fui.feature.summary(fui.valueInProject),
        fui.feature.summary(fui.ideal));
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
