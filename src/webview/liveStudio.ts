import * as vscode from 'vscode';
import {
    hupuQueryLiveActivityKey,
    hupusingleMatch,
    hupuQueryLiveTextList,
    hupuQueryHotLineList,
} from '../api/index';

export default class LiveStudioWebView {

    public static readonly viewType = 'liveStudio';

    public static currentPanel: LiveStudioWebView | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];
    public static panel: vscode.WebviewPanel;
    public static resPostDetail: any = {};

    private constructor(
        context: vscode.ExtensionContext,
        panel: vscode.WebviewPanel,
        data: MatchParams,
    ) {
        this._panel = panel;
        this._context = context;

        this.getMatchData(context, data);

        // 接收 webview 发送的消息
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'showHotline':
                        context.globalState.update('liveStudio-showHotline', message.data);
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
        clearTimeout(this.singleMatch.timer);
        clearTimeout(this.liveText.timer);
        clearTimeout(this.hotline.timer);
        LiveStudioWebView.currentPanel = undefined;
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    currentMatchInfo: MatchInfo = {
        status: 0,
        result: {
            matchStatus: '',
            matchId: '',
            matchTime: '',
        }
    };

    currentParams: LiveParams = {
        matchId: '',
        liveActivityKeyStr: '',
    };

    singleMatch: UpdateObject = {
        timer: 0,
        duration: 10000,
        api: hupusingleMatch,
    };

    liveText: UpdateObject = {
        timer: 0,
        duration: 5000,
        api: hupuQueryLiveTextList,
    };

    hotline: UpdateObject = {
        timer: 0,
        duration: 5000,
        api: hupuQueryHotLineList,
    };

    /**
     * 获取数据
     * @param data 
     */
    async getMatchData(context: vscode.ExtensionContext, data: MatchParams) {

        let showHotline = context.globalState.get('liveStudio-showHotline');
        if (showHotline === undefined) {
            context.globalState.update('liveStudio-showHotline', '1');
            showHotline = '1';
        }

        this._panel.webview.postMessage({
            command: 'showHotline',
            data: showHotline,
        });

        this._panel.webview.postMessage({
            command: 'singleMatch',
            data: data,
        });

        this._panel.webview.postMessage({
            command: 'liveText',
            data: [],
        });

        this._panel.webview.postMessage({
            command: 'hotline',
            data: [],
        });

        const resLiveKey: any = await hupuQueryLiveActivityKey(data.matchId);
        LiveStudioWebView.hideLoading();

        this.currentMatchInfo = {
            result: {
                matchStatus: '',
            }
        };

        this.currentParams = {
            matchId: data.matchId,
            liveActivityKeyStr: encodeURIComponent(resLiveKey.result.liveActivityKey),
        };

        this.init(this.currentParams);
    }

    async init(params: LiveParams) {
        await this.handleSingleMatch(this.singleMatch, params);
        this.handleLiveStudio(this.liveText, params, (res: { result: Array<LiveTextResult> }) => {
            this._panel?.webview?.postMessage({
                command: 'liveText',
                data: res.result,
            });
        });
        this.handleLiveStudio(this.hotline, params, (res: { result: Array<HotlineResult> }) => {
            this._panel?.webview?.postMessage({
                command: 'hotline',
                data: res.result,
            });
        });
    }

    refreshSingleMatch(obj: UpdateObject) {
        clearTimeout(obj.timer);
        obj.timer = setTimeout(() => {
            this.handleSingleMatch(obj, this.currentParams);
        }, obj.duration);
    }

    async handleSingleMatch(obj: UpdateObject, params: LiveParams) {
        if (LiveStudioWebView.currentPanel) {
            const res = await this.requestSingleMatch(obj, params);
            if (res) {
                this.currentMatchInfo = res;
                if (res?.result?.matchStatus === 'NOTSTARTED') {
                    const matchTime = res.result.matchTime;
                    if (matchTime && matchNotStarted(matchTime)) {
                        if (LiveStudioWebView.currentPanel) {
                            this.refreshSingleMatch(obj);
                        }
                    } else {
                        // TODO 没到提前15分钟
                    }
                } else if (res?.result?.matchStatus === 'INPROGRESS') {
                    if (LiveStudioWebView.currentPanel) {
                        this.refreshSingleMatch(obj);
                    }
                }
                this._panel?.webview?.postMessage({
                    command: 'singleMatch',
                    data: res.result,
                });
            } else {
                this.init(params);
            }
        }
    }

    async requestSingleMatch(obj: UpdateObject, params: LiveParams) {
        const res = await obj.api(params.matchId);
        if (res?.status === 200) {
            return res;
        } else {
            return null;
        }
    }

    async handleLiveStudio(obj: UpdateObject, params: LiveParams, callback?: Function) {
        if (this.currentMatchInfo?.result?.matchStatus === 'COMPLETED') {
            // 已结束，只请求一次
            if (LiveStudioWebView?.currentPanel?._panel.visible) {
                this.requestLive(obj, params, callback);
            }
        } else if (this.currentMatchInfo?.result?.matchStatus === 'INPROGRESS') {
            // 进行中，不断轮询
            if (LiveStudioWebView.currentPanel) {
                this.refreshLive(obj, params, callback);
            }
            if (LiveStudioWebView?.currentPanel?._panel.visible) {
                this.requestLive(obj, params, callback);
            }
        } else if (this.currentMatchInfo?.result?.matchStatus === 'NOTSTARTED') {
            // 未开始，开始前15分钟开始不断轮询
            if (this.currentMatchInfo?.result?.matchTime && matchNotStarted(this.currentMatchInfo.result.matchTime)) {
                if (LiveStudioWebView.currentPanel) {
                    this.refreshLive(obj, params, callback);
                }
                if (LiveStudioWebView?.currentPanel?._panel.visible) {
                    this.requestLive(obj, params, callback);
                }
            }
        }
    }

    async requestLive(obj: UpdateObject, params: LiveParams, callback?: Function) {
        const res = await obj.api(params);
        if (res?.status === 200) {
            if (callback) {
                callback(res);
            } else {
                return res;
            }
        } else {
            setTimeout(() => {
                console.log('请求没有响应，3秒后重新搞一下');
                this.requestLive(obj, params, callback);
            }, 3000);
        }
    }

    refreshLive(obj: UpdateObject, params: LiveParams, callback?: Function) {
        clearTimeout(obj.timer);
        obj.timer = setTimeout(() => {
            this.handleLiveStudio(obj, params, callback);
        }, obj.duration);
    }

    public static forceCloseWebview() {
        if (LiveStudioWebView.currentPanel) {
            clearTimeout(LiveStudioWebView.currentPanel.singleMatch.timer);
            clearTimeout(LiveStudioWebView.currentPanel.liveText.timer);
            clearTimeout(LiveStudioWebView.currentPanel.hotline.timer);
            LiveStudioWebView.currentPanel._panel?.dispose();
            LiveStudioWebView.currentPanel = undefined;
        }
    }

    public static showLoading() {
        LiveStudioWebView.currentPanel?._panel.webview.postMessage({
            command: 'showLoading',
        });
    }

    public static hideLoading() {
        LiveStudioWebView.currentPanel?._panel.webview.postMessage({
            command: 'hideLoading',
        });
    }

    public static createOrShow(context: vscode.ExtensionContext, data: MatchParams) {

        let column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        data.title = `${data.awayTeamName} - ${data.homeTeamName}`;

        LiveStudioWebView.resPostDetail = data;

        // 如果已经打开了一个窗口，则直接刷新窗口内容，不用重新再打开一个新的
        if (LiveStudioWebView.currentPanel) {
            column = LiveStudioWebView.currentPanel._panel.viewColumn;
            LiveStudioWebView.currentPanel._panel.reveal(column);
            LiveStudioWebView.showLoading();
            LiveStudioWebView.currentPanel._panel.title = data.title;
            LiveStudioWebView.currentPanel.getMatchData(context, data);
            return;
        }

        // 如果没有创建过就直接创建
        LiveStudioWebView.panel = vscode.window.createWebviewPanel(
            // 标识面板类型，面板 id
            LiveStudioWebView.viewType,
            // 标题
            data.title,
            // 当前活动窗口旁边打开 || 如果编辑器没有活动窗口，则新打开一个
            column || vscode.ViewColumn.One,
            // 配置项
            getWebviewOptions(context.extensionUri),
        );

        // 渲染 webview 
        LiveStudioWebView.panel.webview.html = this._getHtmlForWebview(LiveStudioWebView.panel.webview, context.extensionUri);

        LiveStudioWebView.currentPanel = new LiveStudioWebView(context, LiveStudioWebView.panel, data);
    }

    private static _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', LiveStudioWebView.viewType, 'main.js'));
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));
        const stylesIndexUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'resources', 'webview', LiveStudioWebView.viewType, 'index.css'));


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
			<body id="hupumoyu-body" class="hupumoyu-body hupumoyu-postDetail">

                <div data-target="content" class="ls-title-box" data-id="ls-title-box">
                    <a href="javascript:;" data-id="ls-title-setting" class="ls-title-setting"></a>
                    <span class="ls-title" data-id="ls-title"></span>
                </div>

                <div data-target="content" class="ls-content-box" data-id="ls-content-box">
                    <div class="ls-content" data-id="ls-content-live">
                        <div class="ls-content-title">直播间</div>
                        <div class="ls-content-wrap ls-live-box"></div>
                    </div>
                    <div class="ls-content" data-id="ls-content-hotline">
                        <div class="ls-content-title">热线</div>
                        <div class="ls-content-wrap ls-hotline-box"></div>
                    </div>
                </div>
                
                <div class="fake-content" id="fakeContent"></div>
           
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

function matchNotStarted(matchTime: string) {
    return new Date().getTime() + 1000 * 60 * 15 >= new Date(matchTime).getTime();
};

interface LiveParams {
    matchId: string;
    liveActivityKeyStr: string;
}

interface MatchParams {
    title?: string;
    matchId: string;
    awayTeamName: string;
    homeTeamName: string;
}

interface MatchInfo {
    status?: number;
    result?: {
        matchStatus?: string;
        matchId?: string;
        matchTime?: string;
    }
}

interface UpdateObject {
    timer: ReturnType<typeof setTimeout> | any,
    duration: number,
    command?: string,
    api: Function,
}

interface LiveTextResult {
    nickName: string;
    content: string;
}
interface HotlineResult {
    username: string;
    content: string;
}