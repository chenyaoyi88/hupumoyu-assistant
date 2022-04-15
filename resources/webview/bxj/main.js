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
                    str += `<li data-id="hupumoyu-module-item" class="hupumoyu-module-item" data-info=${encodeURIComponent(JSON.stringify(item))} tabindex="1">${item.title}<span data-id="hupumoyu-module-item-desc" class="hupumoyu-module-item-desc">${read} ${lights} ${replies}</span></li>`;
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