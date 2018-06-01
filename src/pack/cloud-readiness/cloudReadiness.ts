import { ExtensionPack } from "@atomist/sdm";
import { FileIoImportReviewer } from "../../blueprint/code/review/java/fileIoImportReviewer";
import { ImportDotStarReviewer } from "../../blueprint/code/review/java/importDotStarReviewer";
import { ProvidedDependencyReviewer } from "../../blueprint/code/review/java/maven/providedDependencyReviewer";
import { HardCodedPropertyReviewer } from "../../blueprint/code/review/java/spring/hardcodedPropertyReviewer";
import { CloudReadinessIssueManager } from "./cloudReadinessIssueManager";

export const CloudReadinessChecks: ExtensionPack = {
    name: "CloudReadiness",
    vendor: "Atomist",
    version: "0.1.0",
    configure: softwareDeliveryMachine =>
        softwareDeliveryMachine
            .addReviewerRegistrations(
                HardCodedPropertyReviewer,
                ProvidedDependencyReviewer,
                FileIoImportReviewer,
                ImportDotStarReviewer,
            )
            .addReviewListeners(CloudReadinessIssueManager),
};
