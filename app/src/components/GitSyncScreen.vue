<template>
    <div class="screen">
        <div class="splashscreen">
            <h1 class="title">
                <img src="../assets/svg/logo.svg" alt="Publii logo" />
            </h1>

            <div class="license">
                <h3>There are {{ changesCount }} new changes upstream.</h3>
                <p>
                    Syncing...
                </p>

                <p-button :onClick="restartApp" :disabled="!isSynced">
                    Restart Publii
                </p-button>
            </div>
        </div>
    </div>
</template>

<script>
import { ipcRenderer, shell, remote } from "electron";
import gitP, { SimpleGit } from "simple-git/promise";

export default {
    name: "gitsyncscreen",
    data: function() {
        return {
            isSynced: false,
            changesCount: 0
        };
    },
    computed: {},
    beforeDestroy: function() {
        ipcRenderer.removeAllListeners("app-license-accepted");
    },
    mounted: async function() {
        const gitPath = `${this.$store.state.app.config.sitesLocation}`;
        const git = gitP({
            baseDir: gitPath,
            binary: "git",
            maxConcurrentProcesses: 6
        });
        const status = await git.status();
        this.changesCount = status.behind;
        await git.pull();
        this.isSynced = true;
    },
    methods: {
        restartApp: function() {
            remote.app.relaunch();
            remote.app.exit();
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../scss/variables.scss";

/*
 * Splashscreen component
 */
.splashscreen {
    left: 50%;
    position: absolute;
    text-align: center;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
}

.title {
    height: 81px;
    margin: 1.5rem auto;
    width: 206px;

    img {
        display: block;
        height: 81px;
        width: 206px;
    }
}

.version {
    color: var(--gray-4);
    font-size: 1.5rem;
    font-weight: 400;
}

.license {
    -webkit-app-region: no-drag;
    color: var(--gray-4);
    font-weight: 400;
    margin-top: 5rem;
}

.accept {
    -webkit-app-region: no-drag;
    font-weight: bold;
    height: 3.6rem;
    line-height: 3.4rem;
    margin-top: 1rem;
    padding: 0 2rem;
}
</style>
