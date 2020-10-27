import EditorConfig from './../configs/postEditor.config.js';
import { ipcRenderer } from 'electron';
import Utils from './../../helpers/utils';

class EditorBridge {
    constructor(postID) {
        this.postID = postID;
        this.tinyMCECSSFiles = this.getTinyMCECSSFiles();
        this.customThemeEditorConfig = this.getCustomThemeEditorConfig();
        this.tinymceEditor = false;
        this.callbackForTinyMCE = false;
        this.postEditorInnerDragging = false;
        this.contentImageUploading = false;
        this.init();
    }

    updatePostID (newPostID) {
        this.postID = newPostID;
        let contentToUpdate = this.tinymceEditor.getContent().replace(/media\/posts\/temp/gmi, 'media/posts/' + this.postID + '/');
        this.tinymceEditor.setContent(contentToUpdate);
    }

    init() {
        let customFormats = this.loadCustomFormatsFromTheme();
        let editorConfig = Object.assign({}, EditorConfig, {
            setup: this.setupEditor.bind(this, customFormats),
            file_picker_callback: this.filePickerCallback.bind(this),
            content_css: this.tinyMCECSSFiles,
            style_formats: customFormats,
            statusbar: true,
            browser_spellcheck: window.app.$store.state.currentSite.config.spellchecking
        });

        // Remove style selector when there is no custom styles from the theme
        if(customFormats.length === 0) {
            editorConfig.toolbar2 = editorConfig.toolbar2.replace('styleselect', '');
        }

        editorConfig = Utils.deepMerge(editorConfig, window.app.$store.state.app.customConfig.tinymce);

        if(this.customThemeEditorConfig) {
            editorConfig = Utils.deepMerge(editorConfig, this.customThemeEditorConfig);
        }

        tinymce.init(editorConfig);
    }

    focus () {
        this.tinymceEditor.focus();
    }

    setupEditor(customFormats, editor) {
        let self = this;
        this.tinymceEditor = editor;
        this.addEditorButtons();

        editor.on('init', () => {
            $('.tox-tinymce').append($('<div class="tinymce-overlay"><div><svg class="upload-icon" width="24" height="24" viewbox="0 0 24 24"> <path d="M11,19h2v2h-2V19z M12,4l-7,6.6L6.5,12L11,7.7V16h2V7.7l4.5,4.3l1.5-1.4L12,4z"/></svg>Drag image here</div></div>'));
            $('.tox-tinymce').addClass('is-loaded');
            this.initEditorDragNDropImages(editor);

            // Scroll the editor to bottom in order to avoid issues
            // with the text under gradient
            let iframe = document.getElementById('post-editor_ifr');
            
            iframe.contentWindow.window.document.body.addEventListener("keydown", function(e) {
                let selectedNode = $(editor.selection.getNode());
                let selectedNodeHeight = selectedNode.outerHeight();

                if(selectedNodeHeight > iframe.contentWindow.window.outerHeight * .75) {
                    selectedNodeHeight = 0;
                }

                let cursorPos = selectedNode.position().top + selectedNodeHeight;
                let iframeContentHeight = iframe.contentWindow.window.document.body.scrollHeight;

                if(cursorPos > iframeContentHeight - 150) {
                    iframe.contentWindow.scrollTo(0, iframeContentHeight);
                }
            }, false);

            // Support for dark mode
            iframe.contentWindow.window.document.querySelector('html').setAttribute('data-theme', window.app.$root.getCurrentAppTheme());

            // Add inline editors
            this.addInlineEditor(customFormats);
            this.addLinkEditor(iframe);

            this.tinymceEditor.once('keyup', e => {
                window.app.$bus.$emit('post-editor-possible-data-loss');
            });

            this.tinymceEditor.on('keyup', e => {
                if(e.keyCode !== 13 && e.keyCode !== 40) {
                    return;
                }

                let node = this.tinymceEditor.selection.getNode();

                if(
                    e.keyCode === 40 &&
                    node.tagName === 'PRE' &&
                    node.nextSibling === null
                ) {
                    this.tinymceEditor.execCommand('mceInsertContent', false, '<p></p>');
                    return;
                }

                if(
                    e.keyCode === 13 &&
                    node.tagName === 'P' &&
                    node.getAttribute('class')
                ) {
                    node.removeAttribute('class');
                    return;
                }

                if(
                    e.keyCode === 13 &&
                    node.tagName === 'P' &&
                    node.parentNode.tagName === 'BLOCKQUOTE' &&
                    node.previousSibling &&
                    node.previousSibling.tagName === 'P' &&
                    node.previousSibling.childNodes &&
                    node.previousSibling.childNodes[0] &&
                    node.previousSibling.childNodes[0].tagName === 'BR' &&
                    node.previousSibling.childNodes[0].getAttribute('data-mce-bogus') === '1' &&
                    node.nextSibling === null
                ) {
                    // get the element's parent node
                    let parent = node.parentNode;

                    if(parent.nextSibling) {
                        parent.parentNode.insertBefore(node, parent.nextSibling);
                        parent.removeChild(parent.lastChild);
                    } else {
                        parent.parentNode.appendChild(node);
                        parent.removeChild(parent.lastChild);
                    }

                    setTimeout(() => {
                        this.tinymceEditor.selection.select(parent.nextSibling, true);
                    }, 0);
                }
            });

            iframe.contentWindow.window.document.body.addEventListener("click", (e) => {
                let clickedElement = e.path[0];
                let showPopup = false;

                if(localStorage.getItem('publii-writers-panel') === null) {
                    localStorage.setItem('publii-writers-panel', 'opened');
                    window.app.$bus.$emit('writers-panel-open');
                }

                if(clickedElement.tagName === 'FIGCAPTION') {
                    return;
                }

                if(clickedElement.tagName === 'SCRIPT') {
                    let content = this.tinymceEditor.getContent({
                        source_view: true
                    });

                    window.app.$bus.$emit('source-code-editor-show', content, this.tinymceEditor);
                    return;
                }

                if(clickedElement.tagName === 'FIGURE') {
                    showPopup = true;
                } else if(e.path[1] && e.path[1].tagName === 'FIGURE') {
                    clickedElement = e.path[1];
                    showPopup = true;
                }

                if(clickedElement.tagName === 'A' || clickedElement.parentNode.tagName === 'A') {
                    let selection = iframe.contentWindow.window.getSelection();
                    selection.removeAllRanges();
                    let range = iframe.contentWindow.window.document.createRange();
                    
                    if (clickedElement.tagName === 'A') {
                        range.selectNode(clickedElement);
                    } else if (clickedElement.parentNode && clickedElement.parentNode.tagName === 'A') {
                        range.selectNode(clickedElement.parentNode);
                    }

                    selection.addRange(range);

                    if (this.checkInlineLinkTrigger(clickedElement)) {
                        window.app.$bus.$emit('update-link-editor', {
                            sel: selection,
                            text: clickedElement
                        });
                    }
                } else {
                    window.app.$bus.$emit('update-link-editor', {
                        sel: false,
                        text: false
                    });
                }

                if(
                    clickedElement.tagName === 'DIV' &&
                    clickedElement.getAttribute('class') &&
                    clickedElement.getAttribute('class').indexOf('gallery') !== -1
                ) {
                    window.app.$bus.$emit('update-gallery-popup', {
                        postID: this.postID,
                        galleryElement: clickedElement
                    });

                    window.app.$bus.$on('gallery-popup-updated', response => {
                        this.hideToolbarsOnCopy();

                        if(response) {
                            response.gallery.innerHTML = response.html;
                            response.gallery.setAttribute('data-is-empty', response.html === '&nbsp;');
                        }
                    });
                }
            });

            let linkToolbar = $('#link-toolbar');
            let inlineToolbar = $('#inline-toolbar');
            let lastScroll = -1;
            let hideToolbars = function (e) {
                if (linkToolbar.css('display') !== 'block' && inlineToolbar.css('display') !== 'block') {
                    return;
                }
                
                let iframeScrollOffset = iframe.contentWindow.document.body.parentNode.scrollTop;

                if (lastScroll !== -1 && Math.abs(iframeScrollOffset - lastScroll) > 20) {
                    lastScroll = -1;
                    linkToolbar.css('display', 'none');
                    inlineToolbar.css('display', 'none');
                } else if (lastScroll === -1) {
                    lastScroll = iframeScrollOffset;
                }
            };

            iframe.contentWindow.window.addEventListener("scroll", hideToolbars);

            $('#post-editor-fake-image-uploader').on('change', () => {
                if (!$('#post-editor-fake-image-uploader')[0].value) {
                    return;
                }

                setTimeout(() => {
                    if(this.callbackForTinyMCE) {
                        let filePath = false;

                        if($('#post-editor-fake-image-uploader')[0].files) {
                            filePath = $('#post-editor-fake-image-uploader')[0].files[0].path;
                        }

                        if(!filePath) {
                            return;
                        }

                        ipcRenderer.send('app-image-upload', {
                            id: this.postID,
                            site: window.app.$store.state.currentSite.config.name,
                            path: filePath,
                            imageType: 'contentImages'
                        });

                        ipcRenderer.once('app-image-uploaded', (event, data) => {
                            let imagePath = data.baseImage.url;
                            imagePath = imagePath.replace('file://', 'file:///');

                            this.callbackForTinyMCE(imagePath, {
                                alt: '',
                                dimensions: {
                                    height: data.baseImage.size[1],
                                    width: data.baseImage.size[0]
                                }
                            });
                        });

                        $('#post-editor-fake-image-uploader')[0].value = '';
                    }
                }, 50);
            });

            // Writers Panel
            let updateWritersPanel = function () {
                 window.app.$bus.$emit('writers-panel-refresh');
            };
            let throttledUpdate = Utils.debouncedFunction(updateWritersPanel, 1000);
            editor.on('setcontent beforeaddundo undo redo keyup', throttledUpdate);

            iframe.contentWindow.window.document.addEventListener('copy', () => {
                this.hideToolbarsOnCopy();
            });
        });

        editor.ui.registry.addButton('gallery', {
            icon: 'gallery',
            tooltip: "Insert Gallery",
            onAction: function () {
                editor.insertContent('<div class="gallery" data-is-empty="true" contenteditable="false"></div>');
            }
        });
    }

    extensionsPath () {
        return [
            'file:///',
            window.app.$store.state.currentSite.siteDir,
            '/input/themes/',
            window.app.$store.state.currentSite.config.theme,
            '/'
        ].join('');
    }

    getTinyMCECSSFiles () {
        let pathToEditorCSS = this.extensionsPath() + 'assets/css/editor.css';
        let customEditorCSS = pathToEditorCSS;

        return [
            'css/editor.css?v=0710',
            customEditorCSS
        ].join(',');
    }

    getCustomThemeEditorConfig () {
        // Add custom editor config
        let customEditorConfig = false;

        if(
            window.app.$store.state.currentSite.themeSettings &&
            window.app.$store.state.currentSite.themeSettings.extensions &&
            window.app.$store.state.currentSite.themeSettings.extensions.postEditorConfigOverride
        ) {
            let configOverridePath = this.extensionsPath() + 'tinymce.override.json';

            jQuery.ajax({
                url: configOverridePath,
                dataType: 'json',
                async: false,
                success: function(json) {
                    customEditorConfig = json;
                }
            });
        }

        return customEditorConfig;
    }

    loadCustomFormatsFromTheme() {
        let output = [];
        let customElements = [];
        let inlineElements = [
            'a', 'b', 'abbr', 'acronym', 'cite', 'dfn', 'kbd',
            'samp', 'time', 'var', 'bdo', 'br', 'big', 'code',
            'i', 'em', 'small','strong','span', 'tt', 'img',
            'map', 'object', 'q', 'script', 'sub', 'sup', 'button',
            'input', 'label', 'select', 'textarea'
        ];

        // Detect mode
        if(
            window.app.$store.state.currentSite.themeSettings &&
            window.app.$store.state.currentSite.themeSettings.customElementsMode &&
            window.app.$store.state.currentSite.themeSettings.customElementsMode === 'advanced'
        ) {
            output = JSON.parse(JSON.stringify(window.app.$store.state.currentSite.themeSettings.customElements));
            return output;
        }

        // Load custom elements
        if(
            window.app.$store.state.currentSite.themeSettings &&
            window.app.$store.state.currentSite.themeSettings.customElements
        ) {
            customElements = window.app.$store.state.currentSite.themeSettings.customElements;
        }

        if(customElements && customElements.length) {
            for(let i = 0; i < customElements.length; i++) {
                if(!customElements[i]) {
                    continue;
                }

                if(!customElements[i].tag && !customElements[i].selector) {
                    continue;
                }

                if(customElements[i].postEditor === false) {
                    continue;
                }

                let style = {
                    title: customElements[i].label,
                    classes: customElements[i].cssClasses
                };

                if(customElements[i].selector) {
                    style.selector = customElements[i].selector;
                } else {
                    if (inlineElements.indexOf(customElements[i].tag)) {
                        style.inline = customElements[i].tag;
                    } else {
                        style.block = customElements[i].tag;
                    }
                }

                output.push(style);
            }
        }

        return output;
    }

    filePickerCallback(callback, value, meta) {
        // Provide image and alt text for the image dialog
        if (meta.filetype == 'image') {
            this.callbackForTinyMCE = callback;
            $('#post-editor-fake-image-uploader').trigger('click');
        } else {
            this.callbackForTinyMCE = false;
        }
    }

    addEditorButtons() {
        this.tinymceEditor.ui.registry.addButton("publiilink", {
            icon: 'link',
            tooltip: 'Insert/edit link',
            onAction: () => {
                let selectedNode = tinymce.activeEditor.selection.getNode();

                if (selectedNode.tagName === 'IMG' && selectedNode.parentNode && selectedNode.parentNode.tagName === 'A') {
                    window.app.$bus.$emit('init-link-popup', {
                        postID: this.postID,
                        selection: selectedNode.parentNode.outerHTML
                    });
                } else {
                    window.app.$bus.$emit('init-link-popup', {
                        postID: this.postID,
                        selection: tinymce.activeEditor.selection.getContent()
                    });
                }
            }
        });
        
        this.tinymceEditor.ui.registry.addButton("sourcecode", {
            icon: 'sourcecode',
            tooltip: "Source code",
            text: "HTML",
            onAction: () => {
                let content = this.tinymceEditor.getContent({
                    source_view: true
                });

                window.app.$bus.$emit('source-code-editor-show', content, this.tinymceEditor);
            }
        });

        this.tinymceEditor.ui.registry.addButton('readmore', {
            text: 'Read more',
            onAction: () => {
                this.tinymceEditor.insertContent('<hr id="read-more">' + "\n");
            }
        });
    }

    addInlineEditor(customFormats) {
        let iframe = document.getElementById('post-editor_ifr');
        let win = iframe.contentWindow.window;
        let doc = win.document;
        let body = doc.body;

        window.app.$bus.$emit('init-inline-editor', customFormats);

        $(doc.querySelector('html')).on('mouseup', (e) => {
            let sel = win.getSelection();
            let text = sel.toString();
            
            if (this.checkInlineTrigger(e.target)) {
                window.app.$bus.$emit('update-inline-editor', {
                    sel,
                    text
                });
            }
        });
    }

    checkInlineTrigger (target) {
        let excludedTags = ['FIGURE', 'FIGCAPTION', 'IMG'];

        if (excludedTags.indexOf(target.tagName) > -1) {
            return false;
        }

        if (target.tagName === 'DIV' && target.classList.contains('gallery')) {
            return false;
        }

        for ( ; target && target !== document; target = target.parentNode) {
            if (target.matches && target.matches('.post__toc')) {
                return false;
            }
        }

        return true;
    }

    checkInlineLinkTrigger (target) {
        for ( ; target && target !== document; target = target.parentNode) {
            if (target.matches && target.matches('.post__toc')) {
                return false;
            }
        }

        return true;
    }

    addLinkEditor(iframe) {
        window.app.$bus.$emit('init-link-editor', iframe);
    }

    hideToolbarsOnCopy() {
        $('#link-toolbar').css('display', 'none');
        $('#inline-toolbar').css('display', 'none');
    }

    initEditorDragNDropImages(editor) {
        let editorArea = $('.tox-tinymce');
        let postEditor = $('.post-editor');
        let hoverState = false;
        let tinymceOverlay = $('.tinymce-overlay');

        postEditor.on('dragover', () => {
            if(!this.postEditorInnerDragging && !$('.popup.gallery-popup').length) {
                hoverState = true;
                editorArea.addClass('is-hovered');
            }
        });

        tinymceOverlay.on('dragover', e => {
            if(!this.postEditorInnerDragging && !$('.popup.gallery-popup').length) {
                hoverState = true;
                editorArea.addClass('is-hovered');
            }
        });

        postEditor.on('dragleave', () => {
            hoverState = false;

            setTimeout(() => {
                if(!hoverState) {
                    editorArea.removeClass('is-hovered');
                }
            }, 250);
        });

        document.getElementById('post-editor_ifr').contentWindow.addEventListener("dragover", e => {
            if(!this.postEditorInnerDragging) {
                e.preventDefault();
                e.stopPropagation();
                editorArea.addClass('is-hovered');
            }
        }, false);

        document.getElementById('post-editor_ifr').contentWindow.addEventListener('mousedown', () => {
            this.postEditorInnerDragging = true;
        });

        document.getElementById('post-editor_ifr').contentWindow.addEventListener('mouseup', () => {
            this.postEditorInnerDragging = false;
        });

        document.getElementById('post-editor_ifr').contentWindow.addEventListener('mouseout', () => {
            this.postEditorInnerDragging = false;
        });

        editorArea.on('dragover', this.fileDragOver.bind(this));
        editorArea.on('drop', this.editorFileSelect.bind(this));
    }

    fileDragOver (e) {
        if(!this.postEditorInnerDragging) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
            e.originalEvent.dataTransfer.dropEffect = 'copy';
        }
    }

    editorFileSelect (e) {
        e.originalEvent.stopPropagation();
        e.originalEvent.preventDefault();

        let files = e.originalEvent.dataTransfer.files;
        let siteName = window.app.$store.state.currentSite.config.name;

        if(this.postEditorInnerDragging) {
            return;
        }

        if(!files[0] || !files[0].path) {
            $('.tox-tinymce').removeClass('is-hovered');
            $('.tox-tinymce').removeClass('is-loading-image');
            $('.tinymce-overlay').text('Drag your image here');

            this.contentImageUploading = false;
            return;
        }

        $('.tox-tinymce').addClass('is-loading-image');
        $('.tinymce-overlay').html('<div><div class="loader"><span></span></div> ' + 'Upload in progress</div>');

        ipcRenderer.send('app-image-upload', {
            "id": this.postID,
            "site": siteName,
            "path": files[0].path
        });

        this.contentImageUploading = true;

        ipcRenderer.once('app-image-uploaded', (event, data) => {            
            if(data.baseImage && data.baseImage.size && data.baseImage.size[0] && data.baseImage.size[1]) {
                tinymce.activeEditor.insertContent('<p><img alt="" class="post__image" height="' + data.baseImage.size[1] + '" width="' + data.baseImage.size[0] + '" src="' + data.baseImage.url + '"/></p>');
            } else {
                tinymce.activeEditor.insertContent('<p><img alt="" src="' + data.url + '" class="post__image" /></p>');
            }

            $('.tox-tinymce').removeClass('is-hovered');
            $('.tox-tinymce').removeClass('is-loading-image');
            $('.tinymce-overlay').html('<div><svg class="upload-icon" width="24" height="24" viewbox="0 0 24 24"> <path d="M11,19h2v2h-2V19z M12,4l-7,6.6L6.5,12L11,7.7V16h2V7.7l4.5,4.3l1.5-1.4L12,4z"/></svg>Drag image here</div>');

            this.contentImageUploading = false;
        });
    }

    reloadEditor () {
        this.tinymceEditor.once('keyup', e => {
            window.app.$bus.$emit('post-editor-possible-data-loss');
        });
    }
}

export default EditorBridge;
