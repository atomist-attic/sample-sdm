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
    logger,
    Parameters,
} from "@atomist/automation-client";
import {
    CodeTransformRegistration,
    doWithFiles,
    GitProject,
    MessageClient,
    Parameter,
    ParametersInvocation,
    Project,
    ProjectFile,
} from "@atomist/sdm";
import * as minimatch from "minimatch";
import { CFamilyLanguageSourceFiles } from "../GlobPatterns";
import { RequestedCommitParameters } from "../support/RequestedCommitParameters";

/**
 * Default glob pattern matches all C family languages
 */
@Parameters()
export class AddHeaderParameters extends RequestedCommitParameters {

    @Parameter({required: false})
    public glob: string = CFamilyLanguageSourceFiles;

    @Parameter({required: false})
    public excludeGlob: string;

    @Parameter({required: false})
    public license: "apache" = "apache";

    @Parameter({required: false})
    public readonly successEmoji = ":carousel_horse:";

    constructor() {
        super("Add missing license headers");
    }

    get header(): string {
        switch (this.license) {
            case "apache" :
                return ApacheHeader;
            default :
                throw new Error(`'${this.license}' is not a supported license`);
        }
    }
}

/* tslint:disable */
export const ApacheHeader = `/*
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
 */`;

export async function addHeaderTransform(p: Project,
                                         ci: ParametersInvocation<AddHeaderParameters>): Promise<Project> {
    let headersAdded = 0;
    let matchingFiles = 0;
    let filesWithDifferentHeaders = [];
    await doWithFiles(p, ci.parameters.glob, async f => {
        if (ci.parameters.excludeGlob && ci.parameters.excludeGlob.split(",").some(p => minimatch(f.path, p))) {
            return;
        }
        ++matchingFiles;
        const content = await f.getContent();
        if (content.includes(ci.parameters.header)) {
            return;
        }
        if (hasDifferentHeader(ci.parameters.header, content)) {
            filesWithDifferentHeaders.push(f);
            return;
        }
        logger.info("Adding header of length %d to %s", ci.parameters.header.length, f.path);
        ++headersAdded;
        return f.setContent(ci.parameters.header + "\n\n" + content);
    });
    const sha: string = !!(p as GitProject).gitStatus ? (await (p as GitProject).gitStatus()).sha : p.id.sha;
    logger.info("%d files matched [%s]. %s headers added. %d files skipped", matchingFiles, ci.parameters.glob, headersAdded, matchingFiles - headersAdded);
    await reportAboutDifferentHeaders(ci.context.messageClient, filesWithDifferentHeaders);
    if (headersAdded > 0) {
        await ci.addressChannels(`*License header editor* on \`${sha.substring(0, 5)}\`: ${matchingFiles} files matched \`${ci.parameters.glob}\`. ` +
            `${headersAdded} headers added. ${matchingFiles - headersAdded} files skipped ${ci.parameters.successEmoji}`);
    }
    return p;
}

export const AddApacheLicenseHeaderTransform: CodeTransformRegistration<AddHeaderParameters> = {
    transform: addHeaderTransform,
    name: "addHeader",
    paramsMaker: AddHeaderParameters,
    transformPresentation: ci => ci.parameters.editMode,
};



function reportAboutDifferentHeaders(messageClient: MessageClient, offendingFiles: ProjectFile[]) {
    if (offendingFiles.length === 0) {
        return;
    }
    const message = offendingFiles.length === 1 ? `${offendingFiles[0].path} has a different header` :
        `Add Header autofix: ${offendingFiles.length} files have a different header`;
    return messageClient.respond(message);
}

function hasDifferentHeader(header: string, content: string): boolean {
    if (content.startsWith("/*")) {
        if (content.startsWith(header) || content.startsWith("/* tslint:disable */")) {
            // great
            return false;
        }
        logger.debug("I was looking for: " + header);
        logger.debug("This file here starts with: " + content.slice(0, 300));
        return true;
    }
}
