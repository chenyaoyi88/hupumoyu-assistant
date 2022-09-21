(function () {
    const vscode = acquireVsCodeApi();
    const oldState = (vscode.getState());

    // 如果之前有值，则回填
    if (oldState && oldState.data) {
        updatePostList(oldState.data);
    }

    setModuleListHeight();

    window.addEventListener('resize', () => {
        setModuleListHeight();
    });

    window.addEventListener('message', event => {
        const message = event.data;
        const data = message.data;
        switch (message.command) {
            case 'showLoading':
                showLoading();
                break;
            case 'hideLoading':
                hideLoading();
                break;
            case 'updatePostList':
                hideLoading();
                updatePostList(data);
                break;
            default:
                hideLoading();
        }
    });

    document.querySelector('#hupumoyu-bxj').addEventListener('click', (e) => {
        const target = e.target;
        const id = target.dataset.id;
        if (id) {
            switch (id) {
                case 'hupumoyu-module-item':
                    vscode.postMessage({
                        command: 'postSelected',
                        data: target.dataset.info,
                    });
                    break;
                case 'hupumoyu-module-item-desc':
                    vscode.postMessage({
                        command: 'postSelected',
                        data: target.parentElement.dataset.info,
                    });
                    break;
                case 'hupumoyu-module-page-prev':
                    vscode.postMessage({
                        command: 'prevPage',
                    });
                    break;
                case 'hupumoyu-module-page-next':
                    vscode.postMessage({
                        command: 'nextPage',
                    });
                    break;
                case 'hupumoyu-module-title-btn':
                    vscode.postMessage({
                        command: 'switchType',
                    });
                    break;
                default:
            }
        }
    }, false);

    function setModuleListHeight() {
        const oModuleTitleBox = document.querySelector('[data-id="hupumoyu-module-title-box"]');
        const oModuleListBox = document.querySelector('#hupumoyu-module-list-box');
        const oModulePage = document.querySelector('#hupumoyu-module-page');
        oModuleListBox.style.height = window.innerHeight - oModuleTitleBox.offsetHeight - oModulePage.offsetHeight + 'px';
    }

    function updatePostList(data) {
        if (data) {
            vscode.setState({
                data,
            });

            const oModuleListBox = document.querySelector('#hupumoyu-module-list-box');
            const oModuleList = oModuleListBox.querySelector('#hupumoyu-module-list');

            if (data.currentModule && data.currentModule.label) {
                document.querySelector('[data-id="hupumoyu-module-title"]').innerHTML = `${data.currentModule.label}${data.currentModule.pageNo ? `（P${data.currentModule.pageNo}）` : ''}`;

                document.querySelector('#hupumoyu-module-page').innerHTML = `
                    <div class="hupumoyu-module-page-item prev" data-id="hupumoyu-module-page-prev">上一页</div>
                    <div class="hupumoyu-module-page-item next" data-id="hupumoyu-module-page-next">下一页</div>
                `;
            }

            if (data.list && data.list.length) {
                let str = '';
                for (let i = 0; i < data.list.length; i++) {
                    const item = data.list[i];
                    const read = item.read ? `阅读：${item.read}` : '';
                    const lights = item.lights ? `高亮：${item.lights}` : '';
                    const replies = item.replies ? `回复：${item.replies}` : '';
                    str += `<li data-id="hupumoyu-module-item" class="hupumoyu-module-item" data-info=${encodeURIComponent(JSON.stringify(item))} tabindex="1">${item.title}<span data-id="hupumoyu-module-item-desc" class="hupumoyu-module-item-desc">${read} ${lights} ${replies}</span><a class="hupumoyu-module-item-link" title="浏览器打开" href="https://bbs.hupu.com${item.url}" target="_blank" class="hupumoyu-module-item-icon"><svg t="1663724727885" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="25457" width="16" height="16"><path d="M810.68 810.664H213.32V213.336H480V128H213.32C166.382 128 128 166.394 128 213.336v597.328C128 857.606 166.382 896 213.32 896h597.36c46.938 0 85.32-38.394 85.32-85.336V544h-85.32v266.664zM576 128v85.336h174.948L319.998 644.266l59.732 59.732 430.952-430.94V448H896V128H576z" p-id="25458" fill="#bfbfbf"></path></svg></a></li>`;
                }
                oModuleList.innerHTML = str;

                // 回到顶部
                oModuleListBox.scrollTop = 0;
            }

            document.querySelector('[data-id="hupumoyu-module-title-btn"]').innerHTML = '更多';

            setModuleListHeight();
        }
    }
}());