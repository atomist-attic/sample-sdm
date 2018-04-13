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

import { Project } from "@atomist/automation-client/project/Project";

import { File } from "@atomist/automation-client/project/File";
import { saveFromFilesAsync } from "@atomist/automation-client/project/util/projectUtils";
import * as _ from "lodash";
import * as sloc from "sloc";

export interface CodeStats {
    total: number;
    source: number;
    comment: number;
    single: number;
    block: number;
}

export interface FileReport {

    stats: CodeStats;

    file: File;
}

export class SlocReport {

    constructor(public fileReports: FileReport[]) {
    }

    get stats(): CodeStats {
        return {
            total: _.sum(this.fileReports.map(r => r.stats.total)),
            source: _.sum(this.fileReports.map(r => r.stats.source)),
            comment: _.sum(this.fileReports.map(r => r.stats.comment)),
            single: _.sum(this.fileReports.map(r => r.stats.single)),
            block: _.sum(this.fileReports.map(r => r.stats.block)),
        };
    }
}

/**
 * Use the sloc library to compute code statistics
 * @param {Project} p
 * @param {string} extension
 * @param {string} glob
 * @return {Promise<SlocReport>}
 */
export async function slocReport(p: Project, extension: string, glob?: string): Promise<SlocReport> {
    const globToUse = glob || `**/*.${extension}`;
    const fileReports = await saveFromFilesAsync<FileReport>(p, globToUse, async f => {
        const content = await f.getContent();
        const stats = sloc(content, extension);
        return {
            stats,
            file: f,
        };
    });
    return new SlocReport(fileReports);
}
