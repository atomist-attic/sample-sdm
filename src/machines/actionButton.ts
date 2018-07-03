import { Fix } from "@atomist/automation-client/operations/review/ReviewResult";
import { buttonForCommand, ButtonSpecification } from "@atomist/automation-client/spi/message/MessageClient";
import { AddressChannels } from "@atomist/sdm";
import * as slack from "@atomist/slack-messages/SlackMessages";

/**
 * Simple function to present an action button to run a command
 * @param {ButtonSpecification & Fix & {addressChannels: AddressChannels}} spec
 * @param {Partial<Attachment>} slackOptions
 * @return {Promise<any>}
 */
export async function actionButton(
    spec: ButtonSpecification & Fix & { addressChannels: AddressChannels },
    slackOptions?: Partial<slack.Attachment>) {
    const attachment: slack.Attachment = {
        text: spec.text,
        fallback: spec.text,
        ...slackOptions,
        actions: [buttonForCommand(
            spec,
            spec.command,
            spec.params,
        ),
        ],
    };
    const message: slack.SlackMessage = {
        attachments: [attachment],
    };
    return spec.addressChannels(message);
}
