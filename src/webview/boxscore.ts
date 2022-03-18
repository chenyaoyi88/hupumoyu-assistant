import * as vscode from 'vscode';
import { hupuBoxscore } from '../api/index';

export default class BoxscoreWebView {

    public static readonly viewType = 'boxscore';

    public static currentPanel: BoxscoreWebView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;

    timer: ReturnType<typeof setTimeout> | any = 0;
    refreshDuration: number = 10000;

    private constructor(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        data: BoxscoreInitData,
    ) {
        this._panel = panel;
        this._context = context;

        this.getBoxscoreData(data);

        // 接收 webview 发送的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getPostReply':
                        break;
                    default:
                }
            },
            null,
            []
        );

        // 关闭打开的 webview ，在已打开列表中清除
        this._panel.onDidDispose(() => {
            if (BoxscoreWebView.currentPanel) {
                BoxscoreWebView.currentPanel = undefined;
                this._panel.dispose();
            }
        });
    }

    /**
     * 获取数据
     * @param data 
     */
    async getBoxscoreData(data: BoxscoreInitData) {
        this.refreshData(data);
        const res = await hupuBoxscore(data.gdcId);
        BoxscoreWebView.hideLoading();
        // 发送消息到 webview 执行
        this._panel.webview.postMessage({
            command: 'updateBoxscore',
            data: res,
        });
    }

    refreshData(data: BoxscoreInitData) {
        if (BoxscoreWebView.currentPanel) {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                if (BoxscoreWebView.currentPanel) {
                    this.getBoxscoreData(data);
                }
            }, this.refreshDuration);
        }
    }

    public static forceCloseWebview() {
        if (BoxscoreWebView.currentPanel) {
            BoxscoreWebView.currentPanel._panel?.dispose();
            BoxscoreWebView.currentPanel = undefined;
        }
    }

    public static showLoading() {
        BoxscoreWebView.currentPanel?._panel.webview.postMessage({
            command: 'showLoading',
        });
    }

    public static hideLoading() {
        BoxscoreWebView.currentPanel?._panel.webview.postMessage({
            command: 'hideLoading',
        });
    }

    public static createOrShow(context: vscode.ExtensionContext, data: { title: string; gdcId: string }) {

        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经打开了一个窗口，则直接刷新窗口内容，不用重新再打开一个新的
        if (BoxscoreWebView.currentPanel) {
            BoxscoreWebView.currentPanel._panel.reveal(column);
            BoxscoreWebView.showLoading();
            BoxscoreWebView.currentPanel._panel.title = data.title;
            BoxscoreWebView.currentPanel.getBoxscoreData(data);
            return;
        }

        // 如果没有创建过就直接创建
        const panel = vscode.window.createWebviewPanel(
            // 标识面板类型，面板 id
            BoxscoreWebView.viewType,
            // 标题
            data.title,
            // 当前活动窗口旁边打开 || 如果编辑器没有活动窗口，则新打开一个
            column || vscode.ViewColumn.One,
            // 配置项
            getWebviewOptions(context.extensionUri),
        );

        // 渲染 webview 
        panel.webview.html = this._getHtmlForWebview(panel.webview, context.extensionUri);

        BoxscoreWebView.currentPanel = new BoxscoreWebView(context, panel, data);
    }

    private static _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', BoxscoreWebView.viewType, 'main.js'));
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));
        const stylesIndexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', BoxscoreWebView.viewType, 'index.css'));


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

                <div id="hupumoyu-boxscore-box"></div>
           
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

interface BoxscoreInitData {
    gdcId: string;
}