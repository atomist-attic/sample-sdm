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

import * as slack from "@atomist/slack-messages/SlackMessages";
import { buttonForCommand, ButtonSpecification } from "@atomist/automation-client/spi/message/MessageClient";
import { Fix } from "@atomist/automation-client/operations/review/ReviewResult";
import { AddressChannels } from "@atomist/sdm";

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
