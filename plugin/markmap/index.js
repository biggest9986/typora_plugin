class markmapPlugin extends global._basePlugin {
    style = () => {
        let extra = "";
        if (this.config.USE_BUTTON) {
            extra = `
            .plugin-markmap-button {
                position: fixed;
                right: 78px;
                z-index: 9998;
                bottom: 50px;
                margin-left: 30px;
                font-size: 22px;
                text-align: center;
                color: var(--active-file-border-color, black);
            }
            
            .plugin-markmap-button .plugin-markmap-item {
                width: 35px;
                height: 35px;
                cursor: pointer;
                box-shadow: rgba(0, 0, 0, 0.07) 0px 0px 10px;
                border-radius: 4px;
            }
            
            .plugin-markmap-button .plugin-markmap-item:hover {
                background-color: var(--item-hover-bg-color, black);
            }
            `
        }

        const text = `
            #plugin-markmap {
                position: fixed;
                z-index: 9999;
                box-shadow: 0 4px 10px rgba(0, 0, 0, .5);
                background-color: #f8f8f8;
                display: none;
                transition: all 0.2s ease 0s;
            }
            
            .plugin-markmap-wrap {
                display: flex;
                flex-direction: row-reverse;
                width: 100%;
                height: 100%;
            }
            
            .plugin-markmap-grip {
                display: none;
                background-color: var(--active-file-border-color, black);
            }
            .plugin-markmap-grip::before {
                content: "";
                display: block;
                margin: auto;
            }
            
            .plugin-markmap-grip.grip-up { 
                padding: 4px 0;
                cursor: row-resize;
            }
            .plugin-markmap-grip.grip-up::before { 
                width: 24px; 
                border-top: 3px double var(--active-file-bg-color); 
            }
            
            .plugin-markmap-grip.grip-right { 
                padding: 0 4px; 
                cursor: col-resize;
            }
            .plugin-markmap-grip.grip-right::before {
                position: absolute;
                top: 50%;
                transform: translate(-50%, -50%);
                height: 24px; 
                border-left: 3px double var(--active-file-bg-color); 
            }
            
            ${extra}
            
            .plugin-markmap-header {
                margin: 0 0.5em;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            
            .plugin-markmap-icon {
                cursor: pointer;
                font-size: 1.3em;
                opacity: 0.5;
            }
            
            .plugin-markmap-icon:last-child {
                margin-top: auto;
                margin-bottom: 0.2em;
                font-size: 1.3em;
            }
            
            #plugin-markmap-svg {
                flex: 1;
            }
        `
        return {textID: "plugin-markmap-style", text: text}
    }

    html = () => {
        const modal = document.createElement("div");
        modal.id = 'plugin-markmap';
        modal.innerHTML = `
            <div class="plugin-markmap-wrap">
                <div class="plugin-markmap-header">
                    <div class="plugin-markmap-icon ion-close" action="close" ty-hint="关闭"></div>
                    <div class="plugin-markmap-icon ion-arrow-expand" action="expand" ty-hint="全屏"></div>
                    <div class="plugin-markmap-icon ion-arrow-move" action="move" ty-hint="移动"></div>
                    <div class="plugin-markmap-icon ion-cube" action="fit" ty-hint="重置窗口"></div>
                    <div class="plugin-markmap-icon ion-chevron-up" action="pinUp" ty-hint="固定到顶部"></div>
                    <div class="plugin-markmap-icon ion-chevron-right" action="pinRight" ty-hint="固定到右侧"></div>
                    <div class="plugin-markmap-icon ion-android-arrow-down-right" action="resize" ty-hint="拖动调整大小"></div>
                </div>
                <svg id="plugin-markmap-svg"></svg>
                <div class="plugin-markmap-grip grip-right"></div>
            </div>
            <div class="plugin-markmap-grip grip-up"></div>
        `;
        this.utils.insertDiv(modal);

        if (this.config.USE_BUTTON) {
            const button = document.createElement("div");
            button.className = "plugin-markmap-button";
            button.innerHTML = `<div class="plugin-markmap-item" ty-hint="思维导图"><i class="fa fa-code-fork"></i></div>`;
            this.utils.insertDiv(button);
        }
    }

    init = () => {
        this.transformer = null;
        this.Markmap = null;
        this.markmap = null;
        this.editor = null;

        this.modalOriginRect = null;
        this.contentOriginRect = null;
        this.pinUtils = {
            isPinUp: false,
            isPinRight: false,
            init: async () => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
                        this.contentOriginRect = this.entities.content.getBoundingClientRect();
                        resolve();
                    }, 200)
                })
            }
        }

        this.entities = {
            content: document.querySelector("content"),
            modal: document.querySelector("#plugin-markmap"),
            header: document.querySelector("#plugin-markmap .plugin-markmap-header"),
            gripUp: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-up"),
            gripRight: document.querySelector("#plugin-markmap .plugin-markmap-grip.grip-right"),
            svg: document.querySelector("#plugin-markmap-svg"),
            resize: document.querySelector('.plugin-markmap-icon[action="resize"]'),
            fullScreen: document.querySelector('.plugin-markmap-icon[action="expand"]'),
        }

        this.callArgs = [
            {
                arg_name: "根据当前大纲生成",
                arg_value: "current_toc"
            },
        ];
    }

    process = async () => {
        this.init();

        this.utils.decorate(
            () => File && File.editor && File.editor.library && File.editor.library.outline && File.editor.library.outline.updateOutlineHtml,
            "File.editor.library.outline.updateOutlineHtml",
            null,
            () => this.entities.modal.style.display === "block" && this.drawToc()
        )

        this.entities.content.addEventListener("transitionend", this.fit);
        this.entities.modal.addEventListener("transitionend", this.fit);

        const dragModal = (handleElement, withMetaKey) => {
            this.utils.dragFixedModal(
                handleElement, this.entities.modal, withMetaKey,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_DRAG);
                    this.waitUnpin();
                },
                null,
                () => this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_DRAG)
            );
        }

        // 提供两种拖拽的方式
        dragModal(this.entities.header.querySelector(`.plugin-markmap-icon[action="move"]`), false);
        dragModal(this.entities.modal, true);

        const getModalMinHeight = () => this.entities.header.firstElementChild.getBoundingClientRect().height * this.entities.header.childElementCount;
        const getModalMinWidth = () => {
            const {marginLeft, marginRight} = document.defaultView.getComputedStyle(this.entities.header);
            return parseInt(marginLeft) + parseInt(marginRight) + this.entities.header.getBoundingClientRect().width
        }

        // 自由移动时调整大小
        {
            let deltaHeight = 0;
            let deltaWidth = 0;
            this.utils.resizeFixedModal(
                this.entities.resize, this.entities.modal, true, true,
                (startX, startY, startWidth, startHeight) => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    deltaHeight = getModalMinHeight() - startHeight;
                    deltaWidth = getModalMinWidth() - startWidth;
                },
                (deltaX, deltaY) => {
                    deltaY = Math.max(deltaY, deltaHeight);
                    deltaX = Math.max(deltaX, deltaWidth);
                    return {deltaX, deltaY}
                },
                async () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    await this.waitUnpin();
                    await this.setFullScreenIcon(this.entities.fullScreen, false);
                }
            );
        }

        // 固定到顶部时调整大小
        {
            let contentStartTop = 0;
            let contentMinTop = 0;
            this.utils.resizeFixedModal(
                this.entities.gripUp, this.entities.modal, false, true,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    contentStartTop = this.entities.content.getBoundingClientRect().top;
                    contentMinTop = getModalMinHeight() + this.entities.header.getBoundingClientRect().top;
                },
                (deltaX, deltaY) => {
                    let newContentTop = contentStartTop + deltaY;
                    if (newContentTop < contentMinTop) {
                        newContentTop = contentMinTop;
                        deltaY = contentMinTop - contentStartTop;
                    }
                    this.entities.content.style.top = newContentTop + "px";
                    return {deltaX, deltaY}
                },
                () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    this.drawToc();
                }
            );
        }

        // 固定到右侧时调整大小
        {
            let contentStartRight = 0;
            let contentStartWidth = 0;
            let modalStartLeft = 0;
            let contentMaxRight = 0;
            this.utils.resizeFixedModal(
                this.entities.gripRight, this.entities.modal, true, false,
                () => {
                    this.cleanTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    const contentRect = this.entities.content.getBoundingClientRect();
                    contentStartRight = contentRect.right;
                    contentStartWidth = contentRect.width;
                    modalStartLeft = this.entities.modal.getBoundingClientRect().left;
                    contentMaxRight = this.entities.header.getBoundingClientRect().right - getModalMinWidth();
                },
                (deltaX, deltaY) => {
                    deltaX = -deltaX;
                    deltaY = -deltaY;
                    let newContentRight = contentStartRight - deltaX;
                    if (newContentRight > contentMaxRight) {
                        newContentRight = contentMaxRight;
                        deltaX = contentStartRight - contentMaxRight;
                    }
                    this.entities.content.style.right = newContentRight + "px";
                    this.entities.content.style.width = contentStartWidth - deltaX + "px";
                    this.entities.modal.style.left = modalStartLeft - deltaX + "px";
                    return {deltaX, deltaY}
                },
                () => {
                    this.rollbackTransition(!this.config.USE_ANIMATION_WHEN_RESIZE);
                    this.drawToc();
                }
            )
        }

        this.entities.header.addEventListener("click", ev => {
            const button = ev.target.closest(".plugin-markmap-icon");
            if (button) {
                const action = button.getAttribute("action");
                if (action !== "move" && action !== "resize" && this[action]) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.onButtonClick(action, button);
                }
            }
        })

        if (this.config.USE_BUTTON) {
            document.querySelector(".plugin-markmap-item").addEventListener("click", () => {
                (this.entities.modal.style.display === "") ? this.drawToc() : this.close();
            })
        }
    }

    call = async type => {
        if (type === "current_toc") {
            await this.drawToc();
        }
    }

    close = () => this.entities.modal.style.display = "";

    fit = () => this.markmap && this.markmap.fit();

    pinUp = async (draw = true) => {
        this.pinUtils.isPinUp = !this.pinUtils.isPinUp;
        if (this.pinUtils.isPinUp) {
            if (this.pinUtils.isPinRight) {
                await this.pinRight(false);
            }

            await this.pinUtils.init();
            const {top, height, width, left} = this.contentOriginRect;
            const newHeight = height / this.config.DEFAULT_HEIGHT_WHEN_PIN_UP;
            this.entities.modal.style.left = left + "px";
            this.entities.modal.style.width = width + "px";
            this.entities.modal.style.top = top + "px";
            this.entities.modal.style.height = newHeight + "px";
            this.entities.modal.style.boxShadow = "initial";

            this.entities.content.style.top = top + newHeight + "px";

            this.entities.gripUp.style.display = "block";
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.style.boxShadow = "";
            this.entities.content.style.top = this.contentOriginRect.top + "px";
            this.entities.gripUp.style.display = "";
        }
        if (draw) {
            await this.drawToc();
        }
    }

    pinRight = async (draw = true) => {
        this.pinUtils.isPinRight = !this.pinUtils.isPinRight;
        if (this.pinUtils.isPinRight) {
            if (this.pinUtils.isPinUp) {
                await this.pinUp(false);
            }

            await this.pinUtils.init();
            const {top, width, height, right} = this.contentOriginRect;
            const halfWidth = width / this.config.DEFAULT_WIDTH_WHEN_PIN_RIGHT;
            this.entities.modal.style.top = top + "px";
            this.entities.modal.style.right = right + "px";
            this.entities.modal.style.left = right - halfWidth + "px";
            this.entities.modal.style.height = height + "px";
            this.entities.modal.style.width = halfWidth + "px";
            this.entities.modal.style.boxShadow = "initial";

            this.entities.content.style.right = right - halfWidth + "px";
            this.entities.content.style.width = halfWidth + "px";

            document.querySelector("#write").style.width = "initial";

            this.entities.gripRight.style.display = "block";
        } else {
            this.setModalRect(this.modalOriginRect);
            this.entities.modal.style.boxShadow = "";
            this.entities.content.style.width = "";
            this.entities.content.style.right = "";
            document.querySelector("#write").style.width = "";
            this.entities.gripRight.style.display = "";
        }
        if (draw) {
            await this.drawToc();
        }
    }

    waitUnpin = async () => {
        if (this.pinUtils.isPinUp) {
            await this.pinUp();
        }
        if (this.pinUtils.isPinRight) {
            await this.pinRight();
        }
    }

    cleanTransition = (run = true) => (run) ? this.entities.modal.style.transition = "0s" : undefined
    rollbackTransition = (run = true) => (run) ? this.entities.modal.style.transition = "" : undefined

    onButtonClick = async (action, button) => {
        if (action !== "pinUp" && action !== "pinRight") {
            await this.waitUnpin();
        }
        await this[action](button);
    }

    expand = async button => {
        this.modalOriginRect = this.entities.modal.getBoundingClientRect();
        this.setModalRect(this.entities.content.getBoundingClientRect());
        await this.setFullScreenIcon(button, true);
    }

    shrink = async button => {
        this.setModalRect(this.modalOriginRect);
        await this.setFullScreenIcon(button, false)
    }

    setFullScreenIcon = async (button, fullScreen) => {
        if (fullScreen) {
            this.entities.modal.style.boxShadow = "initial";
            button.className = "plugin-markmap-icon ion-arrow-shrink";
            button.setAttribute("action", "shrink");
        } else {
            this.entities.modal.style.boxShadow = "";
            button.className = "plugin-markmap-icon ion-arrow-expand";
            button.setAttribute("action", "expand");
        }
        await this.drawToc();
    }

    setModalRect = rect => {
        if (!rect) return;
        const {left, top, height, width} = rect;
        this.entities.modal.style.left = left + "px";
        this.entities.modal.style.top = top + "px";
        this.entities.modal.style.height = height + "px";
        this.entities.modal.style.width = width + "px";
    }

    initModalRect = () => {
        const {left, width, height} = this.entities.content.getBoundingClientRect();
        this.entities.modal.style.left = left + width / 6 + "px";
        this.entities.modal.style.width = width * 2 / 3 + "px";
        this.entities.modal.style.height = height / 3 + "px";
    }

    drawToc = async () => {
        const toc = File.editor.nodeMap.toc;
        const headers = [];
        if (toc) {
            for (const header of toc["headers"]) {
                if (header && header["attributes"]) {
                    headers.push(header.attributes.pattern.replace("{0}", header.attributes.text));
                }
            }
            const md = headers.join("\n");
            await this.draw(md);
        }
    }

    draw = async md => {
        this.entities.modal.style.display = "block";
        if (this["transformer"] && this["Markmap"]) {
            await this.update(md);
        } else {
            this.initModalRect();
            await this.lazyLoad();
            await this.create(md);
        }
    }

    create = async md => {
        const {root} = this.transformer.transform(md);
        this.markmap = this.Markmap.create(this.entities.svg, null, root);
    }

    update = async md => {
        const {root} = this.transformer.transform(md);
        this.markmap.setData(root);
        await this.markmap.fit();
    }

    lazyLoad = async () => {
        if (this.transformer && this.Markmap) return;

        // markmap-lib太大了，我把他打包了
        const {markmapLib} = this.utils.requireFilePath("./plugin/markmap/resource/markmap-lib.js");
        await this.utils.insertScript("./plugin/markmap/resource/d3_6.js");
        await this.utils.insertScript("./plugin/markmap/resource/markmap-view.js");

        this.transformer = new markmapLib.Transformer();
        const {Markmap, loadCSS, loadJS} = markmap;
        this.Markmap = Markmap;
        const {styles, scripts} = this.transformer.getAssets();
        if (styles) loadCSS(styles);
        if (scripts) loadJS(scripts, {getMarkmap: () => markmap});
    }
}


module.exports = {
    plugin: markmapPlugin
};