import * as vscode from 'vscode';
import {
    hupuStandings,
    hupuStats,
} from '../api/index';

export default class StandinsWebView {

    public static readonly viewType = 'standings';

    public static currentPanel: StandinsWebView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    private constructor(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        data: { title: string, statsUrl: string },
    ) {
        this._panel = panel;
        this._context = context;

        this.getContentData(data);

        // 接收 webview 发送的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'statsUrl':
                        this.getContentData({
                            statsUrl: message.data,
                        });
                        break;
                    default:
                }
            },
            null,
            this._disposables,
        );

        // 关闭打开的 webview ，在已打开列表中清除
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    public dispose() {
        if (StandinsWebView.currentPanel) {
            StandinsWebView.currentPanel = undefined;
            this._panel.dispose();
        }
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
    /**
     * 获取数据
     * @param data 
     */
    async getContentData(data: { statsUrl: string }) {
        // 延时打开，不然还打不开
        setTimeout(async () => {
            if (StandinsWebView.currentPanel) {
                let requestApi: Function = data.statsUrl ? hupuStats : hupuStandings;
                const res = await requestApi(data.statsUrl);
                StandinsWebView.hideLoading();
                // 发送消息到 webview 执行
                this._panel.webview.postMessage({
                    command: 'updateStandings',
                    data: res,
                });
            }
        }, 100);
    }

    public static forceCloseWebview() {
        if (StandinsWebView.currentPanel) {
            StandinsWebView.currentPanel._panel?.dispose();
            StandinsWebView.currentPanel = undefined;
        }
    }

    public static showLoading() {
        StandinsWebView.currentPanel?._panel.webview.postMessage({
            command: 'showLoading',
        });
    }

    public static hideLoading() {
        StandinsWebView.currentPanel?._panel.webview.postMessage({
            command: 'hideLoading',
        });
    }

    public static createOrShow(context: vscode.ExtensionContext, data: any) {

        let column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经打开了一个窗口，则直接刷新窗口内容，不用重新再打开一个新的
        if (StandinsWebView.currentPanel) {
            column = StandinsWebView.currentPanel._panel.viewColumn;
            StandinsWebView.currentPanel._panel.reveal(column);
            StandinsWebView.showLoading();
            StandinsWebView.currentPanel._panel.title = data.title;
            StandinsWebView.currentPanel.getContentData(data);
            return;
        }

        // 如果没有创建过就直接创建
        const panel = vscode.window.createWebviewPanel(
            // 标识面板类型，面板 id
            StandinsWebView.viewType,
            // 标题
            data.title,
            // 当前活动窗口旁边打开 || 如果编辑器没有活动窗口，则新打开一个
            column || vscode.ViewColumn.One,
            // 配置项
            getWebviewOptions(context.extensionUri),
        );

        // 渲染 webview 
        panel.webview.html = this._getHtmlForWebview(panel.webview, context.extensionUri);

        StandinsWebView.currentPanel = new StandinsWebView(context, panel, data);
    }

    private static _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', StandinsWebView.viewType, 'main.js'));
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));
        const stylesIndexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', StandinsWebView.viewType, 'index.css'));

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${stylesIndexUri}" rel="stylesheet">
				<link href="${styleCommonUri}" rel="stylesheet">

				<title>标题</title>
			</head>
			<body id="hupumoyu-body" class="hupumoyu-body">

                <div id="hupumoyu-content-box"></div>
           
                <script src="${scriptCommonUri}"></script>
				<script src="${scriptUri}"></script>
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
