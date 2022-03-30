// @ts-nocheck
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();
    const oldState = (vscode.getState());

    // 如果之前有值，则回填
    if (oldState && oldState.data) {
        setContent(oldState.data);
    }

    // 发送消息
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
            case 'updateBoxscore':
                hideLoading();
                setContent(data);
                break;
            default:
                hideLoading();
        }
    });

    function setContent(data) {
        vscode.setState({
            data,
        });
        const oBoxscore = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-content-box'));
        oBoxscore.innerHTML = data.content;
        showPostImgs(document.querySelectorAll('#hupumoyu-content-box img'));
    }

    function showPostImgs(aImgs) {
        const oldState = (vscode.getState());
        for (let i = 0; i < aImgs.length; i++) {
            if (!oldState.data.show) {
                aImgs[i].classList.add('hide');
            }
            aImgs[i].addEventListener('click', function (e) {
                this.classList.toggle('hide');
            }, false);
        }
    }
}());