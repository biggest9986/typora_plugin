(() => {
    (() => {
        const css =`
        .container.svelte-1vhgd3o {
            position: relative;
            width: 100%;
            height: 40px
        }
        
        .tab-bar-container.svelte-1vhgd3o {
            position: fixed;
            top: 0;
            width: 100%;
            height: 40px;
            z-index: 1
        }
        
        .grab-container.svelte-pb8ij7 {
            height: 100%;
            width: fit-content
        }
        
        .tab-clone.svelte-pb8ij7 {
            pointer-events: none;
            width: fit-content;
            height: 40px;
            position: absolute;
            top: 0;
            z-index: 1000
        }
        
        .clone-container.svelte-pb8ij7 {
            position: relative
        }
        
        .container.svelte-pb8ij7 {
            background-color: var(--bg-color, white);
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            box-sizing: border-box;
            overflow-x: scroll
        }
        
        .container.svelte-pb8ij7::after {
            content: "";
            height: 100%;
            width: 100vw;
            background-color: var(--side-bar-bg-color, gray);
            border-bottom: solid 1px rgba(0, 0, 0, 0.07)
        }
        
        .invisible.svelte-pb8ij7 {
            opacity: 0
        }
        
        .container.svelte-pb8ij7:hover::-webkit-scrollbar-thumb {
            visibility: visible
        }
        
        .container.svelte-pb8ij7::-webkit-scrollbar {
            height: 5px
        }
        
        .container.svelte-pb8ij7::-webkit-scrollbar-thumb {
            height: 5px;
            background-color: var(----active-file-bg-color, gray);
            visibility: hidden
        }
        
        .container.svelte-1511mcd.svelte-1511mcd {
            background-color: var(--side-bar-bg-color, gray);
            height: 100%;
            min-width: 100px;
            position: relative;
            padding: 0 15px;
            padding-right: 10px;
            border-bottom: solid 1px rgba(0, 0, 0, 0.07);
            display: flex;
            align-items: center;
            justify-content: space-between;
            user-select: none;
            flex-shrink: 0;
            cursor: pointer
        }
        
        .name.svelte-1511mcd.svelte-1511mcd {
            max-width: 350px;
            padding-right: 15px;
            font-size: 14px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            pointer-events: none
        }
        
        .close-button.svelte-1511mcd.svelte-1511mcd {
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 5px
        }
        
        .container.svelte-1511mcd:hover>.close-button.svelte-1511mcd {
            visibility: visible !important
        }
        
        .close-icon.svelte-1511mcd.svelte-1511mcd {
            position: relative;
            width: 11px;
            height: 11px;
            display: flex;
            flex-direction: column;
            justify-content: center
        }
        
        .close-icon.svelte-1511mcd.svelte-1511mcd::before,
        .close-icon.svelte-1511mcd.svelte-1511mcd::after {
            content: "";
            position: absolute;
            width: 100%;
            height: 2px;
            background-color: var(--active-file-border-color, black)
        }
        
        .close-icon.svelte-1511mcd.svelte-1511mcd::before {
            transform: rotate(45deg)
        }
        
        .close-icon.svelte-1511mcd.svelte-1511mcd::after {
            transform: rotate(-45deg)
        }
        
        .close-button.svelte-1511mcd.svelte-1511mcd:hover {
            background-color: var(--active-file-bg-color, lightgray)
        }
        
        .active.svelte-1511mcd.svelte-1511mcd {
            border: solid 1px rgba(0, 0, 0, 0.07);
            border-bottom: none;
            background-color: var(--bg-color, white)
        }
        
        .active-indicator.svelte-1511mcd.svelte-1511mcd {
            position: absolute;
            top: -1px;
            left: -1px;
            width: calc(100% + 2px);
            height: 3px;
            background-color: var(--active-file-border-color, black)
        }
        
        .preview.svelte-1511mcd.svelte-1511mcd {
            font-style: italic !important
        }
        
        .single.svelte-1511mcd.svelte-1511mcd {
            visibility: hidden;
            opacity: 0
        }
        `
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        document.getElementsByTagName("head")[0].appendChild(style);

        const div = `
            <div class="container svelte-1vhgd3o">
                <div class="tab-bar-container svelte-1vhgd3o">
                    <div class="clone-container svelte-pb8ij7"></div>
                    <div class="container svelte-pb8ij7" style="width: calc(100vw - var(--sidebar-width, 0));">
                        <div class="grab-container svelte-pb8ij7">
                            <div class="container svelte-1511mcd active">
                                <div class="active-indicator svelte-1511mcd" style="display: block;"></div> <span
                                    class="name svelte-1511mcd">messing1.md</span> <span class="close-button svelte-1511mcd"
                                    style="visibility: visible;">
                                    <div class="close-icon svelte-1511mcd"></div>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
        const Div = document.createElement("div");
        Div.id = 'svelte-target';
        Div.innerHTML = div;
        document.getElementById("write-style").parentElement
            .insertBefore(Div, document.getElementById("write-style"));
    })()

    console.log("window_tab.js had been injected");
})()