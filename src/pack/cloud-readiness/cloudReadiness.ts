import { ExtensionPack } from "@atomist/sdm";
import { FileIoImportReviewer } from "../../reviewer/java/fileIoImportReviewer";
import { ImportDotStarReviewer } from "../../reviewer/java/importDotStarReviewer";
import { ProvidedDependencyReviewer } from "../../reviewer/java/maven/providedDependencyReviewer";
import { HardCodedPropertyReviewer } from "../../reviewer/java/spring/hardcodedPropertyReviewer";
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
