<template>
    <div
        v-if="isVisible"
        class="overlay">
        <div class="popup popup-post-add">
            <div class="message">
                <h1>Insert Post</h1>
                <v-select
                    slot="field"
                    ref="postPagesSelect"
                    :options="postPages"
                    v-model="post"
                    :custom-label="customPostLabels"
                    :close-on-select="true"
                    :show-labels="false"
                    @select="closeDropdown('postPagesSelect')"
                    placeholder="Select post page"></v-select>

                <field label="Custom post title:">
                    <input
                        slot="field"
                        type="text"
                        :spellcheck="$store.state.currentSite.config.spellchecking"
                        v-model="postTitle"
                        class="link-popup-field-label" />
                </field>

                <field label="Custom post description:">
                    <input
                        slot="field"
                        type="text"
                        :spellcheck="$store.state.currentSite.config.spellchecking"
                        v-model="postDescription"
                        class="link-popup-field-label" />
                </field>

                <switcher
                    slot="field"
                    label="Set featured image as background"
                    v-model="setFeaturedImage" />
            </div>

            <div class="buttons">
                <p-button
                    type="medium no-border-radius half-width"
                    @click.native="setPost">
                    OK
                </p-button>

                <p-button
                    type="medium no-border-radius half-width cancel-popup"
                    @click.native="cancel">
                    Cancel
                </p-button>
            </div>
        </div>
    </div>
</template>

<script>
import { ipcRenderer } from 'electron';
import { read } from 'fs-extra';

export default {
    name: 'post-popup',
    data () {
        return {
            postID: 0,
            postTitle: "",
            postDescription: "",
            selection: null,
            isVisible: false,
            setFeaturedImage: true,
            post: null,
        };
    },
    computed: {
        postPages () {
            return this.$store.state.currentSite.posts.map(post => post.id);
        }
    },
    mounted () {
        this.$bus.$on('init-post-popup', config => {
            this.postID = config.postID;
            this.selection = config.selection;
            this.isVisible = true;
        });

        //this.loadFiles();
        this.$bus.$on('post-popup-updated', this.insertPost);
    },
    methods: {
        cleanPopup () {
            this.postID = 0;
            this.postTitle = "";
            this.postDescription = "";
            this.selection = null;
            this.post = null;
            this.setFeaturedImage = true;
        },
        customPostLabels (value) {
            return this.$store.state.currentSite.posts.filter(post => post.id === value).map(post => post.title)[0];
        },        
        closeDropdown (refID) {
            this.$refs[refID].isOpen = false;
        },
        insertPost (response) {
            if (!response) return;
            const {postID, postTitle, postDescription, setFeaturedImage} = response;
            // const post = this.$store.state.currentSite.posts.find(post => post.id === postID);
            // const additionalPostData = JSON.parse(post.additional_data);
            // Send request for a post to the back-end
            ipcRenderer.send('app-post-load', {
                'site': this.$store.state.currentSite.config.name,
                'id': postID
            });

            // Load post data
            ipcRenderer.once('app-post-loaded', (event, data) => {
                if (data) {
                    const post = data.posts[0];
                    const obj = {
                        title: postTitle,
                        description: postDescription,
                        // content: this.getPostContent(post.text),
                        url: '#INTERNAL_LINK#/post/' + postID,
                    };
                    let style = "";
                    if (setFeaturedImage) {
                        let imagePath = `${this.$store.state.currentSite.config.domain}/media/posts/${postID}/${data.featuredImage.url}`;
                        style = `style="background-image: url(${imagePath});"`;
                    }
                    let start = `<div contenteditable="false" data-is-empty="false" class="post-embed ${setFeaturedImage ? 'bg': ''}" ${style}>`;
                    let title = `<strong class="post-embed-title"><a href="${obj.url}">${obj.title}</a></strong>`;
                    let text = `<p>${obj.description}</p>`;
                    let continueReading = `<a class="post-embed-continue-reading" href="${obj.url}">Continue reading</a>`;
                    let end = `</div>`;
                    tinymce.activeEditor.selection.setContent(start + title + text + continueReading + end);
                }
            });
        },
        getPostContent(text) {
            let readMoreElement = `<hr id="read-more">`;
            let readMoreIndex = text.indexOf(readMoreElement) + readMoreElement.length;
            let doc = new DOMParser().parseFromString(text.substring(readMoreIndex, 500).trim() + "...</p>", 'text/html');
            return `<p>${doc.body.textContent || ""}</p>`;
        },
        setPost () {
            let response = {
                postID: this.post,
                postTitle: this.postTitle,
                postDescription: this.postDescription,
                setFeaturedImage: this.setFeaturedImage
            };
            this.cleanPopup();
            this.isVisible = false;
            this.$bus.$emit('post-popup-updated', response);
        },
        cancel () {
            this.cleanPopup();
            this.isVisible = false;
            this.$bus.$emit('post-popup-updated', false);
        },
    },
    beforeDestroy () {
        this.$bus.$off('init-post-popup');
        this.$bus.$off('post-popup-updated', this.addLink);
    }
}
</script>

<style lang="scss" scoped>
@import '../../scss/variables.scss';
@import '../../scss/popup-common.scss';

.overlay {
    z-index: 100005;
}

h1 {
    text-align: center;
}

.popup {   
    max-width: 60rem;
    min-width: 60rem;   
    padding: 4rem;   

    &.popup-post-add {
        overflow: visible;
    }

    .field {
        .switcher {
            float: left;
            top: -4px;
        }
    }
}

.message {
    color: var(--gray-4);
    font-size: 1.8rem;   
    padding: 0;    
}

.buttons {
    display: flex;
    margin: 4rem -4rem -4rem -4rem;
    position: relative;
    text-align: center;
    top: 1px;

    & > .button {
        border-radius: 0 0 0 .6rem;

        & + .button {
            border-radius: 0 0 .6rem 0;
        }
    }
}
</style>
