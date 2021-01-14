<template>
    <div class="overlay as-page" v-if="isVisible">
        <div class="popup sync">
            <div v-if="isInSync && noIssues" class="sync-success">
                <h1>No changes to push.</h1>

                <div class="progress-bars-wrapper">
                    <progress-bar
                        :cssClasses="{
                            'sync-progress-bar': true,
                            'is-synced': true
                        }"
                        color="green"
                        :progress="100"
                        :stopped="false"
                        message=""
                    />
                </div>

                <div class="buttons">
                    <p-button
                        :onClick="close"
                        type="outline medium quarter-width"
                    >
                        OK
                    </p-button>
                </div>
            </div>

            <div v-if="properConfig && !isInSync" class="sync-todo">
                <div class="heading">
                    <h1>Synchronize with Git Repo</h1>
                    <p class="description">Remote: {{ gitRemoteUrl }}</p>

                    <h3>Files</h3>
                    <pre class="files-list">{{ files }}</pre>
                    <text-input
                        id="commitInput"
                        :type="'text'"
                        :value="commitMessage"
                        :spellcheck="true"
                        :placeholder="'Enter a commit message'"
                        ref="commitMessageInput"
                        :disabled="syncInProgress"
                    />
                </div>

                <div class="progress-bars-wrapper">
                    <progress-bar
                        :cssClasses="{ 'rendering-progress-bar': true }"
                        :color="syncingProgressColor"
                        :progress="syncingProgress"
                        :stopped="renderingProgressIsStopped"
                        :message="progressMessage"
                    />
                </div>

                <div class="buttons">
                    <p-button
                        :onClick="startSync"
                        :type="
                            syncInProgress
                                ? 'disabled medium quarter-width'
                                : 'medium quarter-width'
                        "
                        :disabled="syncInProgress"
                    >
                        Sync
                    </p-button>

                    <p-button
                        :onClick="close"
                        type="outline medium quarter-width"
                    >
                        Cancel
                    </p-button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ipcRenderer, shell } from "electron";
import Utils from "./../helpers/utils.js";
import gitP, { SimpleGit } from "simple-git/promise";

export default {
    name: "git-sync-popup",
    data: function() {
        return {
            isInSync: false,
            isVisible: false,
            gitRemoteUrl: "",
            noRemote: false,
            files: "",
            commitMessage: "",
            gitStatus: "",
            syncInProgress: false,
            progressMessage: "",
            syncingProgress: 0,
            syncingProgressColor: "blue",
            /**
             * @type {SimpleGit}
             */
            git: null,
            status: null,

            renderingInProgress: false,
            uploadInProgress: false,
            messageFromRenderer: "true",
            renderingProgress: 0,
            renderingProgressIsStopped: false,
            messageFromUploader: "",
            uploadingProgress: 0,
            uploadingProgressColor: "blue",
            uploadingProgressIsStopped: false,
            manualFilePath: "",
            uploadError: false,
            noIssues: true
        };
    },
    computed: {
        properConfig: function() {
            return !this.noServerConfig && !this.noDomainConfig;
        }
    },
    mounted: function() {
        this.$bus.$on("git-sync-popup-display", async config => {
            if (this.isVisible) {
                return;
            }

            this.isVisible = true;
            this.messageFromRenderer = "";
            this.renderingProgress = 0;
            this.renderingProgressColor = "blue";
            this.renderingProgressIsStopped = false;
            this.messageFromUploader = "";
            this.uploadingProgress = 0;
            this.uploadingProgressColor = "blue";
            this.uploadingProgressIsStopped = false;
            this.syncInProgress = false;
            this.manualFilePath = "";
            this.uploadError = false;
            this.noIssues = true;

            const gitPath = `${this.$store.state.app.config.sitesLocation}`;

            this.git = gitP({
                baseDir: gitPath,
                binary: "git",
                maxConcurrentProcesses: 6
            });
            this.status = await this.git.status();
            const remotes = await this.git.getRemotes(true);
            if (!remotes.length) {
                this.noRemote = true;
            } else {
                this.gitRemoteUrl = remotes[0].refs.push;
                this.isInSync = !this.status.ahead && this.status.isClean();
                this.files = this.status.files
                    .map(file => file.path)
                    .join("\n");
            }
            // console.log(status);
            // if (!status.ahead && status.isClean())
            //     this.$bus.$emit("confirm-display", {
            //         message: "No changes to sync."
            //     });
            // else {
            //     this.$bus.$emit("confirm-display", {
            //         message: `There are ${status.files.length} files to sync. Commit message:`,
            //         hasInput: true,
            //         okLabel: "Sync",
            //         okClick: async text => {

            //             //
            //             this.$bus.$emit("confirm-display", {
            //                 message: `Sync complete.`
            //             });
            //         }
            //     });
            // }
        });

        document.body.addEventListener("keydown", this.onDocumentKeyDown);
    },
    methods: {
        close: function() {
            this.isVisible = false;
        },
        startSync: async function() {
            this.syncInProgress = true;
            const commitMessage = this.$refs.commitMessageInput.content;
            if (!commitMessage) {
                this.syncInProgress = false;
                return alert("Please give a commit message.");
            }
            try {
                this.syncingProgressColor = "blue";

                this.progressMessage = "Commiting changes...";
                this.syncingProgress = 10;

                await this.git.add(this.status.not_added);
                await this.git.commit(commitMessage, { "-a": null });

                this.syncingProgress = 30;
                this.progressMessage = "Pushing changes to remote...";

                await this.git.push();

                this.syncingProgress = 100;
                this.progressMessage = "Done.";
                this.syncInProgress = false;
                this.syncingProgressColor = "red";
            } catch (e) {
                this.progressMessage = e.message;
                this.syncingProgressColor = "red";
                this.syncInProgress = false;
            }
        },
        onDocumentKeyDown(e) {
            if (e.code === "Enter" && this.isVisible && !this.syncInProgress) {
                this.onEnterKey();
            }
        },
        onEnterKey() {
            if (!this.isInSync) {
                this.startSync();
            }
        }
    },
    beforeDestroy: function() {
        this.$bus.$off("git-sync-popup-display");
        document.body.removeEventListener("keydown", this.onDocumentKeyDown);
    }
};
</script>

<style lang="scss" scoped>
@import "../scss/variables.scss";
@import "../scss/popup-common.scss";

.popup {
    background: none;
    max-width: $wrapper;
    overflow: visible;
    width: 100%;

    .description {
        color: var(--text-light-color);
        font-size: 1.4rem;
        line-height: 1.4;
        margin: auto;
        padding: 0 1rem;
        text-align: center;

        &.alert {
            background: var(--highlighted);
            border-radius: 0.2em;
            color: var(--text-primary-color);
            font-size: 1.5rem;
            margin-bottom: 3rem;
            padding: 1rem 2rem;
            text-align: left;
        }

        strong {
            color: var(--text-primary-color);
        }
    }

    .files-list {
        max-height: 120px;
        overflow: auto;
        background-color: #ebebeb;
        text-align: left;
        font-size: 12px;
        padding: 10px;
    }
}

.sync {
    svg {
        display: block;
        float: none;
        margin: 2.6rem auto;
    }
}

.message {
    color: var(--text-primary-color);
    font-weight: 400;
    margin: 0;
    padding: 4rem;
    position: relative;
    text-align: left;

    &.text-centered {
        text-align: center;
    }
}

.buttons {
    display: flex;
    justify-content: center;
    margin-top: 4rem;
    position: relative;
    text-align: center;
    top: 1px;
}

.progress-bars-wrapper {
    margin-top: 7rem;
    margin-bottom: -4rem;
    position: relative;

    .progress-wrapper + .progress-wrapper {
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
        z-index: 10;
    }
}
</style>
