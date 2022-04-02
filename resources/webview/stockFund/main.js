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
            case 'updateStandings':
                hideLoading();
                setContent(data);
                break;
            default:
                hideLoading();
        }
    });

    document.querySelector('#hupumoyu-body').addEventListener('click', (e) => {
        if (e.target.nodeName === 'A') {
            vscode.postMessage({
                command: 'statsUrl',
                data: e.target.getAttribute('href'),
            });
        }
    });

    function setContent(data) {
        vscode.setState({
            data,
        });
        const oBoxContent = /** @type {HTMLElement} */ (document.getElementById('hupumoyu-content-box'));
        oBoxContent.innerHTML = data.content || '';
    }
}());