import { AddCloudFoundryManifest } from "../pack/pcf/addCloudFoundryManifest";
import * as slack from "@atomist/slack-messages/SlackMessages";
import { buttonForCommand } from "@atomist/automation-client/spi/message/MessageClient";
import { Fix } from "@atomist/automation-client/operations/review/ReviewResult";
import { SdmContext } from "@atomist/sdm";

/*
export function actionButton(
    text: string,
    command: Fix,
    sc: SdmContext,
    slackOptions?: Partial<slack.Attachment>) {
    // TODO button options

    const attachment: slack.Attachment = {
        text,
        fallback: text,
        ...slackOptions,
        actions: [buttonForCommand({text},
            AddCloudFoundryManifest.name,
            {"targets.owner": inv.id.owner, "targets.repo": inv.id.repo},
        ),
        ],
    };
    const message: slack.SlackMessage = {
        attachments: [attachment],
    };
    return sc.addressChannels(message);
}


actionButton("I want coffee", { command: "coffee", params: { foo: "yes"}}, null);

*/