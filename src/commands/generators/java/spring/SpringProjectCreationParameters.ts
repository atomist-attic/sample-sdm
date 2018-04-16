/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { MappedParameter, MappedParameters, Parameter } from "@atomist/automation-client";
import { GitHubNameRegExp } from "@atomist/automation-client/operations/common/params/gitHubPatterns";
import { JavaIdentifierRegExp } from "@atomist/sdm";
import { camelize } from "tslint/lib/utils";
import { JavaGeneratorConfig } from "../JavaGeneratorConfig";
import { JavaProjectCreationParameters } from "../JavaProjectCreationParameters";

/**
 * Parameters for creating Spring Boot apps.
 */
export class SpringProjectCreationParameters extends JavaProjectCreationParameters {

    @MappedParameter(MappedParameters.SlackUserName)
    public screenName: string;

    @Parameter({
        displayName: "Class Name",
        description: "name for the service class",
        ...JavaIdentifierRegExp,
        required: false,
    })
    public serviceClassName: string;

    @Parameter({
        displayName: "Seed repo",
        description: "Seed repo",
        ...GitHubNameRegExp,
        minLength: 1,
        maxLength: 50,
        required: false,
    })
    public seed: string = "spring-rest-seed";

    constructor(config: JavaGeneratorConfig) {
        super();
        this.source.owner = config.seedOwner;
        this.seed = config.seedRepo;
        this.groupId = config.groupId;
        this.addAtomistWebhook = config.addAtomistWebhook;
    }

    public bindAndValidate() {
        super.bindAndValidate();
        this.source.repo = this.seed;
        this.serviceClassName = !!this.serviceClassName ?
            toInitialCap(this.serviceClassName) :
            toInitialCap(camelize(this.artifactId));
    }

}

function toInitialCap(s: string) {
    return s.charAt(0).toUpperCase() + s.substr(1);
}
