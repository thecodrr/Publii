<template>
    <div class="sidebar-sync">
        <a href="#" class="sidebar-preview-link" @click="gitSync">
            Sync repo
        </a>

        <a
            href="#"
            class="sidebar-preview-link"
            @click="renderPreview"
        >
            Preview your changes
        </a>

        <a
            href="#"
            :class="cssClasses"
            @click.prevent.stop="syncWebsite"
        >
            <span v-pure-html="icon" class="sidebar-sync-link-icon"></span>
            <span>{{ status }}</span>
        </a>
        <a 
            v-if="hasSyncDate && websiteUrl"
            :href="websiteUrl"
            target="_blank"
            class="sidebar-sync-date">
            
                <template v-if="!hasManualDeploy">
                    Last sync: <span>{{ syncDate }}</span>
                    <icon
                        size="xs"
                        name="external-link"/>
                </template>
                <template v-if="hasManualDeploy">
                    Last rendered: <span>{{ syncDate }}</span>
                    <icon
                        size="xs"
                        name="external-link"/>
                </template>
           
        </a>
    </div>
</template>

<script>
import fs from "fs";
import SidebarIcons from "./configs/sidebar-icons.js";

export default {
    name: "sidebar-sync-button",
    data: function() {
        return {
            icon: SidebarIcons.DEFAULT,
            redirectTo: "sync"
        };
    },
    computed: {
        cssClasses: function() {
            return {
                "sidebar-sync-link": true
            };
        },
        status: function() {
            let status = this.$store.state.components.sidebar.status;

            if (status !== false) {
                if (!this.checkDeploymentConfig()) {
                    this.redirectTo = "site-settings";
                    this.icon = SidebarIcons.NO_CONFIG;
                    return "Provide access data";
                }

                switch (status) {
                    case "preparing":
                        this.redirectTo = "sync";
                        this.icon = SidebarIcons.PREPARING;
                        return "Preparing files";
                    case "prepared":
                        this.redirectTo = "sync";
                        this.icon = SidebarIcons.PREPARED;
                        return "Prepared to upload";
                    case "not-prepared":
                        this.redirectTo = "sync";
                        this.icon = SidebarIcons.NOT_PREPARED;
                        return "Preparation error";
                    case "syncing":
                        this.redirectTo = "sync";
                        this.icon = SidebarIcons.SYNCING;
                        return "Sync in progress";
                    case "synced":
                    case "not-synced":
                        this.redirectTo = "sync";
                        this.icon = SidebarIcons.NOT_SYNCED;
                        return "Sync your website";
                }
            } else if (!this.checkDeploymentConfig()) {
                this.redirectTo = "site-settings";
                this.icon = SidebarIcons.PROVIDE_ACCESS;
                return "Configure Server";
            } else {
                this.redirectTo = "sync";
                this.icon = SidebarIcons.SYNC;
                return "Sync your website";
            }

            this.redirectTo = "sync";
            return "Site is in sync";
        },
        hasSyncDate: function() {
            if (!this.$store.state.currentSite.config) {
                return false;
            }

            return !!this.$store.state.currentSite.config.syncDate;
        },
        syncDate: function() {
            let syncDate = this.$store.state.currentSite.config.syncDate;

            if(this.$store.state.app.config.timeFormat && this.$store.state.app.config.timeFormat == 24) {
                return this.$moment(syncDate).format('MMM DD, YYYY HH:mm');
            } else {
                return this.$moment(syncDate).format('MMM DD, YYYY hh:mm A');
            }
        },
        hasManualDeploy () {
            return this.$store.state.currentSite.config.deployment.protocol === 'manual';
        },
        websiteUrl () { 
            return this.$store.state.currentSite.config.domain;
        },
        syncInProgress () {
            return this.$store.state.components.sidebar.syncInProgress;
        }
    },
    methods: {
        gitSync: function() {
            this.$bus.$emit("git-sync-popup-display");
        },
        renderPreview: function() {
            if (!this.$store.state.currentSite.config.theme) {
                let siteName = this.$store.state.currentSite.config.name;

                this.$bus.$emit("confirm-display", {
                    message:
                        "You haven't selected any theme. Please go to the Settings and select the theme first.",
                    okLabel: "Go to settings",
                    okClick: () => {
                        this.$router.push(`/site/${siteName}/settings/`);
                    }
                });
                return;
            }

            if (
                this.$store.state.app.config.previewLocation !== "" &&
                !fs.existsSync(this.$store.state.app.config.previewLocation)
            ) {
                this.$bus.$emit("confirm-display", {
                    message:
                        "The preview catalog does not exist. Please go to the App Settings and select the correct preview directory first.",
                    okLabel: "Go to app settings",
                    okClick: () => {
                        this.$router.push(`/app-settings/`);
                    }
                });
                return;
            }

            this.$bus.$emit("rendering-popup-display");
        },
        syncWebsite: function(e) {
            if (e.screenX === 0 && e.screenY === 0) {
                return;
            }

            if (this.redirectTo === "sync") {
                if (!this.$store.state.currentSite.config.theme) {
                    let siteName = this.$store.state.currentSite.config.name;

                    this.$bus.$emit("confirm-display", {
                        message:
                            "You haven't selected any theme. Please go to the Settings and select the theme first.",
                        okLabel: "Go to settings",
                        okClick: () => {
                            this.$router.push(`/site/${siteName}/settings/`);
                        }
                    });
                    return;
                }

                this.$bus.$emit("sync-popup-display");
            } else if (this.redirectTo === "site-settings") {
                let siteName = this.$store.state.currentSite.config.name;

                this.$router.push({
                    path: "/site/" + siteName + "/settings/server"
                });
            }
        },
        checkDeploymentConfig() {
            let config = this.$store.state.currentSite.config;

            if (!config || !config.deployment) {
                return false;
            }

            if (
                config.deployment.protocol === "" ||
                config.deployment.domain === ""
            ) {
                return false;
            }

            return true;
        }
    }
};
</script>

<style lang="scss">
@import "../scss/variables.scss";

.sidebar {
    &-sync {
        bottom: 3rem;
        left: 4rem;
        position: absolute;
        right: 4rem;

        &-icon {
            fill: var(--white);
        }

        &-date {
            color: var(--sidebar-link-color);
            display: block;
            font-size: 1.2rem;
            height: 16px; // svg icon height
            letter-spacing: -.025em;
            margin-top: 1.2rem;
            opacity: var(--sidebar-link-opacity);
            text-align: center;

            &:hover {
                color: var(--sidebar-link-hover-color);
                opacity: 1;
            }

            &:focus {
                color: var(--sidebar-link-color);
            }

            & > svg {
                left: 3px;
                position: relative;
                top: 2px;
            }
        }

        &-link {
            align-items: center;
            background: var(--sidebar-sync-btn-bg);
            border-radius: 3px;
            color: var(--sidebar-sync-btn-color);
            display: flex;
            font-size: 1.6rem;
            font-weight: 500;
            justify-content: center;
            padding: 1.4rem 2.4rem;
            position: relative;

            // sync cloud icon
            .sidebar-sync-icon {
                height: 2.2rem;
                display: inherit;
                width: 3rem;

                path {
                    fill: var(--white);
                    transition: var(--transition);
                }

                polygon {
                    fill: var(--primary-color);
                    transition: var(--transition);
                }
            }

            &:active .sidebar-sync-icon,
            &:focus .sidebar-sync-icon,
            &:hover .sidebar-sync-icon {
                path {
                    fill: var(--white);
                }

                polygon {
                    fill: $color-helper-6;
                }
            }

            // .sidebar-sync-icon {
            //     &.is-animated {
            //         polygon {
            //             animation: pulse 1s infinite;
            //         }
            //     }
            // }
            
            // interjection mark icon
            .sidebar-interjection-icon {
                display: block;
                height: 2.3rem;
                width: 2.4rem;

                path {
                    fill: var(--white);
                }
            }

            &:active,
            &:focus,
            &:hover {
                background: $color-helper-6;
                color: var(--white);

                .sidebar-sync-icon {
                    fill: $color-helper-6;
                }
            }

            &-icon {
                display: block;
                height: 100%;
                margin-right: 1.2rem;
                width: auto;
            }
        }

        &-synced {
        }
        &-not-synced {
        }
        &-preparing,
        &-prepared,
        &-syncing {
        }
        &-not-prepared,
        &-noftp {
        }

        &-preparing {
            display: block;
            height: 2.1rem;
            width: 2.1rem;

            & > span {
                animation: spin 0.9s infinite linear;
                border-top: 2px solid rgba(255, 255, 255, 0.2);
                border-right: 2px solid rgba(255, 255, 255, 0.2);
                border-bottom: 2px solid rgba(255, 255, 255, 0.2);
                border-left: 2px solid var(--white);
                border-radius: 50%;
                display: inline-block;
                height: 2.1rem;
                width: 2.1rem;

                &::after {
                    border-radius: 50%;
                    content: "";
                    display: block;
                }
            }
        }

        &-in-progress {
            .sidebar-sync-link, .sidebar-sync-date, .sidebar-preview-website {
               opacity: 0;
               transition: .35s cubic-bezier(.17,.67,.13,1.05) .35s all;     
               visibility: hidden; 
            }
        }
    }

    &-preview-link {
        border: 2px solid var(--sidebar-preview-btn-border-color);
        border-radius: 3px;
        color: var(--sidebar-preview-btn-color) !important;
        display: block;
        margin-bottom: 1rem;
        padding: 1.2rem 2.4rem;
        text-align: center;

        & > span {
            display: inline-block;
            width: 3.2rem;
        }

        &:hover {
            border-color: var(
                --sidebar-preview-btn-border-hover-color
            ) !important;
            color: var(--sidebar-preview-btn-hover-color) !important;
        }

        &.is-disabled {
            opacity: 0.75;
            pointer-events: none;
        }
    }
}

.minimized-sync {
    &-in-progress {
        .progress-message {
            color: white;
            position: initial;
        }

        .progress-wrapper {
            min-height: 50px;
            padding: 0;           
        }

        .progress {
            background-color: var(--sidebar-preview-btn-border-color);
            height: 4px;

            &-bar {
                height: 4px;
            }
        }
    }   

    &-error {
         font-size: 1.3rem;
    }

    
}

@keyframes pulse {
    from {
        transform: translateY(50%);
        opacity: 1;
    }
    to {
        transform: translateY(-200%);
        opacity: 0.5;
    }
}

@keyframes spin {
    100% {
        transform: rotate(360deg);
    }
}
</style>
