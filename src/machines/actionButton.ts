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