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

import { ButtonSpecification } from "@atomist/automation-client";
import {
    actionableButton,
    CommandRegistration,
} from "@atomist/sdm";
import * as slack from "@atomist/slack-messages";

/**
 * Simple function to present an action button to run a command
 * @param spec button spec
 * @param command Command to run
 * @param parameters parameters
 * @param {Partial<Attachment>} slackOptions
 * @return {Promise<any>}
 */
export function buttonMessage<T>(
    spec: ButtonSpecification,
    command: CommandRegistration<T>,
    parameters: Partial<T> = {},
    slackOptions?: Partial<slack.Attachment>): slack.SlackMessage {
    const attachment: slack.Attachment = {
        // text: spec.text,
        fallback: spec.text,
        ...slackOptions,
        actions: [actionableButton(
            spec,
            command,
            parameters,
        ),
        ],
    };
    return {
        // text: spec.text,
        attachments: [attachment],
    };
}
