import * as vscode from 'vscode';
import { hupuPostReply, hupuPostDetail } from '../api/index';

interface InitData {
    url: string;
}

export default class PostDetailWebView {

    public static readonly viewType = 'postDetailPanel';

    public static currentPanel: PostDetailWebView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;

    private constructor(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        data: InitData,
    ) {
        this._panel = panel;
        this._context = context;

        this.init(data);
    }

    // 初始化
    async init(data: InitData) {
        this.getPostDetailContent({
            postUrl: data.url,
            pageNo: 1,
        });

        // 接收 webview 发送的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getPostReply':
                        try {
                            const res: any = await hupuPostReply({
                                tid: message.content.tid,
                                pid: message.content.pid,
                            });
                            if (res.data && res.data.list && res.data.list.length) {
                                this._panel.webview.postMessage({
                                    command: 'postReply',
                                    data: res.data.list,
                                });
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage('获取回复评论请求失败');
                            console.log('获取回复评论失败', error);
                        }
                        break;
                    case 'pagechange':
                        try {
                            const pageNo = message.content.pageNo;
                            const tid = message.content.tid;
                            const postUrl = `/${tid}-${pageNo}.html`;

                            this.getPostDetailContent({
                                postUrl,
                                pageNo: pageNo,
                            });

                        } catch (error) {
                            vscode.window.showErrorMessage('翻页请求失败');
                            console.log(error);
                        }
                        break;
                }
            },
            null,
            []
        );

        // 关闭打开的 webview ，在已打开列表中清除
        this._panel.onDidDispose(() => {
            PostDetailWebView.currentPanel = undefined;
            this._panel.dispose();
        });
    }

    /**
     * 获取帖子内容
     * @param data 
     */
    async getPostDetailContent(data: { postUrl: string, pageNo: number }) {
        const resPostDetail: ResPostDetail | null = await hupuPostDetail(data.postUrl);
        this.hideLoading();
        if (resPostDetail) {
            resPostDetail.showPostImgs = this._context.globalState.get('bxj-settings-showPostImgs');
            resPostDetail.pageNo = data.pageNo;
            // 发送消息到 webview 执行
            this._panel.webview.postMessage({
                command: 'updatePostDetail',
                data: resPostDetail,
            });
        } else {
            vscode.window.showErrorMessage('帖子内容获取失败，请重试');
        }
    }

    public static forceCloseWebview() {
        if (PostDetailWebView.currentPanel) {
            PostDetailWebView.currentPanel._panel?.dispose();
            PostDetailWebView.currentPanel = undefined;
        }
    }

    public static showLoading() {
        PostDetailWebView.currentPanel?._panel.webview.postMessage({
            command: 'showLoading',
        });
    }

    public static hideLoading() {
        PostDetailWebView.currentPanel?._panel.webview.postMessage({
            command: 'hideLoading',
        });
    }

    showLoading() {
        this._panel.webview.postMessage({
            command: 'showLoading',
        });
    }

    hideLoading() {
        this._panel.webview.postMessage({
            command: 'hideLoading',
        });
    }

    public static createOrShow(context: vscode.ExtensionContext, data: PostDetailInitData) {

        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // 如果已经打开了一个窗口，则直接刷新窗口内容，不用重新再打开一个新的
        if (PostDetailWebView.currentPanel) {
            PostDetailWebView.currentPanel._panel.reveal(column);
            PostDetailWebView.currentPanel.showLoading();
            PostDetailWebView.currentPanel._panel.title = data.title;
            PostDetailWebView.currentPanel.getPostDetailContent({
                postUrl: data.url,
                pageNo: 1,
            });
            return;
        }

        // 如果没有创建过就直接创建
        const panel = vscode.window.createWebviewPanel(
            // 标识面板类型，面板 id
            PostDetailWebView.viewType,
            // 标题
            data.title,
            // 当前活动窗口旁边打开 || 如果编辑器没有活动窗口，则新打开一个
            column || vscode.ViewColumn.One,
            // 配置项
            getWebviewOptions(context.extensionUri),
        );

        // 渲染 webview 
        panel.webview.html = this._getHtmlForWebview(panel.webview, context.extensionUri);

        PostDetailWebView.currentPanel = new PostDetailWebView(context, panel, data);
    }

    private static _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'postDetail', 'main.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));
        const stylesIndexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'postDetail', 'index.css'));


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
			<body id="hupumoyu-postDetail" class="hupumoyu-postDetail">
                <!-- 内容 -->
                <div id="hupumoyu-content-box" class="hupumoyu-content-box hide">
                    <!-- 帖子标题 -->
                    <div id="hupumoyu-title" class="hupumoyu-title"></div>
                    <!-- 帖子内容 -->
                    <div class="hupumoyu-content-main" id="hupumoyu-content-main"></div>
                    <!-- 回帖亮了 -->
                    <div id="hupumoyu-content-light" class="hupumoyu-content-light">
                        <div class="hupumoyu-post-wrapper-title">这些回帖亮了</div>
                        <div class="hupumoyu-post-wrapper-content" id="lightReplyContent"></div>
                    </div>
                    <!-- 普通回帖 -->
                    <div id="hupumoyu-content-gray" class="hupumoyu-content-gray">
                        <div class="hupumoyu-post-wrapper-title">全部回帖</div>
                        <div class="hupumoyu-post-wrapper-content" id="grayReplyContent"></div>
                    </div>
                </div>
                <!-- 页码 -->
                <div class="hupumoyu-pagination-hide" id="hupumoyu-pagination-hide"></div>
                <div class="hupumoyu-pagination" id="hupumoyu-pagination"></div>
                <div id="hupumoyu-loading" class="hupumoyu-loading">加载中...</div>
           
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

interface PostDetailInitData {
    title: string;
    url: string;
}

interface ResPostDetail {
    showPostImgs?: boolean | undefined;
    pageNo?: number | string | undefined;
    userName: string;
    userTime: string;
    userTitle: string;
    postContent: string | null;
    postLightReplyContent: string | null;
    postGrayReplyContent: string | null;
    pagination: string | null;
    tid: string | undefined;
}