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
