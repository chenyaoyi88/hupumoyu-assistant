import * as vscode from 'vscode';

export default class CommonWebView {

    _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];

    constructor() {
    }

    // 关闭后处理
    dispose() {
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    showLoading() {
        this._panel?.webview.postMessage({
            command: 'showLoading',
        });
    }

    hideLoading() {
        this._panel?.webview.postMessage({
            command: 'hideLoading',
        });
    }

    createOrShow(
        context: vscode.ExtensionContext,
        viewType: string,
        data: any,
        fnGetData?: Function,
        fnReceiveMessage?: Function,
    ) {

        let column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经打开了一个窗口，则直接刷新窗口内容，不用重新再打开一个新的
        if (this._panel) {
            column = this._panel.viewColumn;
            this._panel.reveal(column);
            this._panel.title = data.title;
            fnGetData && fnGetData(true);
            return;
        }

        // 如果没有创建过就直接创建
        const panel = vscode.window.createWebviewPanel(
            // 标识面板类型，面板 id
            viewType,
            // 标题
            data.title,
            // 当前活动窗口旁边打开 || 如果编辑器没有活动窗口，则新打开一个
            column || vscode.ViewColumn.One,
            // 配置项
            getWebviewOptions(context.extensionUri),
        );

        // 渲染 webview 
        panel.webview.html = this._getHtmlForWebview(panel.webview, context.extensionUri, viewType);

        // 接收 webview 发送的消息
        panel.webview.onDidReceiveMessage(
            async (message) => {
                fnReceiveMessage && fnReceiveMessage(message);
            },
            null,
            this._disposables,
        );

        // 关闭打开的 webview ，在已打开列表中清除
        panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel = panel;

        fnGetData && fnGetData();
    }

    _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri, viewType: string) {
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));

        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', viewType, 'main.js'));
        const stylesIndexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', viewType, 'index.css'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleCommonUri}" rel="stylesheet">
                ${stylesIndexUri ? `<link href="${stylesIndexUri}" rel="stylesheet">` : ''}
				
				<title>标题</title>
			</head>
			<body id="hupumoyu-body" class="hupumoyu-body">

                <div id="hupumoyu-content-box"></div>
           
                <script src="${scriptCommonUri}"></script>
				${scriptUri ? `<script src="${scriptUri}"></script>` : ''}
			</body>
			</html>`;
    }
}

function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // 可以使用脚本
        enableScripts: true,
        // 限制只能从指定目录加载资源
        localResourceRoots: [extensionUri],
    };
}
