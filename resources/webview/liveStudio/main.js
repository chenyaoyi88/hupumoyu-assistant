// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
(function () {
    const vscode = acquireVsCodeApi();
    const oldState = (vscode.getState());

    // 如果之前有值，则回填
    if (oldState && oldState.data) {
        console.log(oldState);
    }
    document.querySelector('#fakeContent').style.display = 'none';

    setModuleListHeight();

    window.addEventListener('resize', () => {
        setModuleListHeight();
    });

    document.querySelector('#hupumoyu-body').addEventListener('click', (e) => {
        switch (e.target.dataset.id) {
            case 'ls-title-setting':
                if (e.target.dataset.show === '1') {
                    e.target.dataset.show = '0';
                } else {
                    e.target.dataset.show = '1';
                }
                showHotline(e.target.dataset.show);
                vscode.postMessage({
                    command: 'showHotline',
                    data: e.target.dataset.show,
                });
                break;
            default:
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        const data = message.data;
        switch (message.command) {
            case 'showHotline':
                showHotline(data);
                break;
            case 'liveText':
                liveText(data);
                break;
            case 'hotline':
                hotline(data);
                break;
            case 'singleMatch':
                hideLoading();
                singleMatch(data);
                break;
            case 'switchMode':
                const aContent = document.querySelectorAll('[data-target="content"]');
                if (data.mode === 'bossComing') {
                    for (let i = 0; i < aContent.length; i++) {
                        aContent[i].classList.add('hide-content');
                    }
                    const fakeContent = document.querySelector('#fakeContent');
                    fakeContent.style.display = 'block';
                    if (!fakeContent.innerHTML) {
                        fakeContent.innerHTML = 'Hello world!';
                    }
                } else {
                    for (let i = 0; i < aContent.length; i++) {
                        aContent[i].classList.remove('hide-content');
                    }
                    document.querySelector('#fakeContent').style.display = 'none';
                }
                break;
            default:
                hideLoading();
        }
    });

    function showHotline(data) {
        const setting = document.querySelector('[data-id="ls-title-setting"]');
        const hotline = document.querySelector('[data-id="ls-content-hotline"]');
        setting.dataset.show = data;
        if (data === '1') {
            setting.innerHTML = '关闭热线';
            hotline.classList.remove('hide');
        } else {
            setting.innerHTML = '打开热线';
            hotline.classList.add('hide');
        }
    }

    function setModuleListHeight() {
        const oTitle = document.querySelector('[data-id="ls-title-box"]');
        const oContent = document.querySelector('[data-id="ls-content-box"]');
        oContent.style.height = window.innerHeight - oTitle.offsetHeight + 'px';
    }

    function singleMatch(data) {
        document.querySelector('[data-id="ls-title"]').innerHTML = `${data.awayTeamName} ${data.awayScore || '-'} : ${data.homeScore || '-'} ${data.homeTeamName} （${data.frontEndMatchStatus.desc}）`;
    }

    function liveText(list) {
        let str = '';
        for (let item of list) {
            str += `
            <div class="ls-content-item">
                <span class="ls-content-item-label">${item.nickName}：</span><span
                    class="ls-content-item-value">${item.content}</span>
            </div>`;
        }
        document.querySelector('.ls-live-box').innerHTML = str;
    }

    function hotline(list) {
        let str = '';
        for (let item of list) {
            str += `
            <div class="ls-content-item">${item.username}：${item.content}</div>`;
        }
        document.querySelector('.ls-hotline-box').innerHTML = str;
    }

}());