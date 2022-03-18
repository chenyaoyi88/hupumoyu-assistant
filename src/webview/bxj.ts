import * as vscode from 'vscode';
import { hupuBxjModule } from '../api';
import PostDetailWebView from './postDetail';

export default class BxjViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'bxjTreeView';

    public static _webView?: vscode.WebviewView;

    private _view?: vscode.WebviewView;

    private _extensionUri: vscode.Uri;

    private _context: vscode.ExtensionContext;
    // 热门板块
    private hotMoule = [];
    // 分类板块
    private categoriesModule = [];
    // 当前选择的板块内容
    private currentSelectedModuleData: any = {};

    constructor(
        context: vscode.ExtensionContext
    ) {

        this._context = context;
        this._extensionUri = context.extensionUri;

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(BxjViewProvider.viewType, this)
        );

        this.getCurrentModuleData(context);
        this.setClickCommands(context);
    }

    /**
     * 设置点击事件
     * @param context 
     */
    setClickCommands(context: vscode.ExtensionContext) {
        const bxjRefreshCommand = vscode.commands.registerCommand(
            'bxjTreeView.refresh',
            async () => {
                this.refresh(context);
            },
        );

        const bxjPrePageCommand = vscode.commands.registerCommand(
            'bxjTreeView.prevPage',
            async () => {
                this.pageChange(this.currentSelectedModuleData, context, false);
            },
        );

        const bxjNextPageCommand = vscode.commands.registerCommand(
            'bxjTreeView.nextPage',
            async () => {
                this.pageChange(this.currentSelectedModuleData, context, true);
            },
        );

        const bxjSwitchCommand = vscode.commands.registerCommand(
            'bxjTreeView.switch',
            async () => {
                if (this.hotMoule.length && this.categoriesModule.length) {
                    this.moduleChange(context, this.hotMoule, this.categoriesModule);
                } else {
                    vscode.window.showInformationMessage('获取论坛板块数据失败');
                }
            },
        );

        const bxjSettingsCommand = vscode.commands.registerCommand(
            'bxjTreeView.settings',
            async () => {
                this.setSettings(context);
            },
        );

        const bxjCurrentModulePostCommand = vscode.commands.registerCommand('bxjTreeView.currentModulePost', async () => {
            this.currentModulePost(context);
        });

        context.subscriptions.push(bxjRefreshCommand);
        context.subscriptions.push(bxjPrePageCommand);
        context.subscriptions.push(bxjNextPageCommand);
        context.subscriptions.push(bxjSwitchCommand);
        context.subscriptions.push(bxjSettingsCommand);
        context.subscriptions.push(bxjCurrentModulePostCommand);
    }

    // 获取当前板块帖子
    async currentModulePost(context: vscode.ExtensionContext) {
        let aQuickPick = [];
        let currentModule = { label: '', value: '', pageNo: 0 };
        if (this.currentSelectedModuleData?.list?.length) {
            aQuickPick = this.currentSelectedModuleData.list;
            currentModule = this.currentSelectedModuleData.currentModule;
        } else {
            const currentSelectedModuleData = await this.getCurrentModuleData(context);
            aQuickPick = currentSelectedModuleData.list;
            currentModule = currentSelectedModuleData.currentModule;
        }

        if (aQuickPick.length) {
            aQuickPick = aQuickPick.map((item: any) => {
                item.label = item.title;
                item.detail = `${item.read ? `阅读：` + item.read : ''}  ${item.lights ? `高亮：` + item.lights : ''}  ${item.replies ? `回复：` + item.replies : ''}`;
                return item;
            });

            currentModule = this.currentSelectedModuleData.currentModule;

            const target: any = await vscode.window.showQuickPick(
                aQuickPick,
                {
                    title: `${currentModule?.label} ${currentModule.pageNo ? currentModule.pageNo : ''}`,
                    placeHolder: '请选择要查看的帖子'
                },
            );

            if (target) {
                PostDetailWebView.createOrShow(context, target);
            }
        }
    }

    async setSettings(context: vscode.ExtensionContext) {
        if (context.globalState.get('bxj-settings-showPostImgs') === undefined) {
            context.globalState.update('bxj-settings-showPostImgs', true);
        }

        let postImgsSetting = context.globalState.get('bxj-settings-showPostImgs');

        const quickPickList = [];

        if (postImgsSetting) {
            quickPickList.push({
                label: '隐藏图片',
                value: 'hidePostImgs',
                description: '帖子打开的时候默认隐藏全部图片，点击图片后显示',
            });
        } else {
            quickPickList.push({
                label: '显示图片',
                value: 'showPostImgs',
                description: '帖子打开的时候默认显示全部图片，点击图片后隐藏',
            });
        }

        const target: any = await vscode.window.showQuickPick(
            quickPickList,
            {
                title: '摸鱼看帖时要设置东西',
                placeHolder: '下面是可选择设置的项'
            },
        );

        switch (target.value) {
            case 'hidePostImgs':
                this.showPostImgs(context, false);
                break;
            case 'showPostImgs':
                this.showPostImgs(context, true);
                break;
            default:
        }
    }

    showPostImgs(context: vscode.ExtensionContext, show: boolean) {
        context.globalState.update('bxj-settings-showPostImgs', show);
        vscode.window.showInformationMessage('帖子图片已设置为' + (show ? '显示' : '隐藏'));
    }

    /**
     * 设置板块数据
     * @param moduleData 
     */
    setAllModule(moduleData: any) {
        let hot = [];
        let categories = [];
        const res = {
            hot: [],
            categories: [],
        };
        if (moduleData.pageData) {
            hot = moduleData.pageData.hot;
            categories = moduleData.pageData.categories;
        } else if (moduleData.topic) {
            hot = moduleData.topic.hot;
            categories = moduleData.topic.categories;
        }

        if (hot.length) {
            const hotTemp = this.quickPickDataFormat(hot);
            hotTemp.unshift({
                label: '其他分类',
                value: 'other-categories',
                description: '找不到想看的板块可以在这里面找',
            });
            res.hot = hotTemp;
        }

        if (categories.length) {
            res.categories = this.quickPickDataFormat(categories);
        }
        return res;
    }

    /**
     * 整理数据格式
     * @param data 
     * @returns 
     */
    quickPickDataFormat(data: any) {
        for (let item of data) {
            if (item.topics && item.topics.length) {
                for (let childItem of item.topics) {
                    childItem.label = childItem.name;
                    childItem.value = childItem.url.replace('/', '');
                    childItem.description = childItem.countText;
                }
                item.label = item.name;
                item.value = item.url.replace('/', '');
                item.description = `${item.topicCount}个子版块`;
                const hotPost = Object.assign({}, item, {
                    label: item.name + '-全板热帖',
                    description: '',
                });
                item.topics.unshift(hotPost);
            } else {
                item.label = item.name;
                item.value = item.url.replace('/', '');
                item.description = item.countText;
            }
        }
        return data;
    }

    /**
     * 切换板块
     * @param context 
     * @param hotMoule 热门板块
     * @param categoriesModule 分类板块
     */
    async moduleChange(
        context: vscode.ExtensionContext,
        hotMoule: Array<any>,
        categoriesModule: Array<any>
    ) {
        if (hotMoule) {
            const target = await vscode.window.showQuickPick(
                hotMoule,
                {
                    title: '请选择要切换的板块',
                    placeHolder: '请选择要切换的板块'
                },
            );

            if (target) {
                if (target.value === 'other-categories') {
                    // 选择其他板块
                    this.multStepInput(context, categoriesModule);
                } else {
                    // 选择当前板块
                    this.getModuleData(context, target);
                }
            }
        }
    }

    /**
     * 选择板块
     * @param context 
     * @param categoriesModule 分类板块
     */
    async multStepInput(context: vscode.ExtensionContext, categoriesModule: Array<any>) {
        const pick = await vscode.window.createQuickPick();
        pick.title = '请选择你想看的板块';
        pick.step = 1;
        pick.items = categoriesModule;
        pick.totalSteps = 2;
        let currentSelectedItem = { label: '' };
        pick.onDidChangeSelection((aItem: any) => {
            if (pick.step === 1) {
                // 切换到第二步
                pick.step = 2;
                // 选择专区
                pick.title = '请选择你想看的专区';
                // 加载子版块选项
                pick.items = aItem[0].topics;
                // 记录当前选择的板块（用于后退时切换回来）
                currentSelectedItem = aItem[0];
                // 显示后退按钮
                pick.buttons = [vscode.QuickInputButtons.Back];
            } else if (pick.step === 2) {
                if (aItem[0]) {
                    pick.hide();
                    const currentModule = {
                        label: aItem[0].label,
                        value: aItem[0].value,
                        pageNo: 0,
                    };
                    this.getModuleData(context, currentModule);
                }
            }
        });
        // 返回按钮
        pick.onDidTriggerButton((item) => {
            pick.title = '请选择你想看的板块';
            pick.step = 1;
            pick.items = categoriesModule;
            pick.activeItems = [currentSelectedItem];
            pick.buttons = [];
        });
        pick.show();
    }

    /**
     * 获取当前板块参数
     * @param context 
     * @returns 
     */
    getCurrentModule(context: vscode.ExtensionContext): { label: string, value: string, pageNo: number } {
        return context.globalState.get('bxj-current-module') || {
            label: '步行街主干道',
            value: 'bxj',
            pageNo: 0,
        };
    }

    // 刷新
    refresh(context: vscode.ExtensionContext) {
        const currentModule: { label: string, value: string, pageNo: number } = this.getCurrentModule(context);
        currentModule.pageNo = 0;
        this.getModuleData(context, currentModule);
    }

    /**
     * 切换上一页/下一页
     * @param currentSelectedModuleData 模板返回的数据
     * @param context 
     * @param pageCtrl true 下一页 false 上一页
     */
    pageChange(
        currentSelectedModuleData: any,
        context: vscode.ExtensionContext,
        pageCtrl?: boolean
    ) {
        const currentModule: { label: string, value: string, pageNo: number } = this.getCurrentModule(context);
        if (!Object.keys(currentSelectedModuleData).length) {
            vscode.window.showInformationMessage('未选中任何板块');
            return;
        }
        if (currentSelectedModuleData.topic) {
            if (currentModule.pageNo) {
                // 非第一页
                if (pageCtrl) {
                    currentModule.pageNo++;
                } else {
                    currentModule.pageNo--;
                }
            } else {
                currentModule.pageNo = 0;
                // 第一页
                if (pageCtrl) {
                    currentModule.pageNo++;
                } else {
                    vscode.window.showInformationMessage('当前已经是第一页了');
                }
            }
            this.getModuleData(context, currentModule);
        } else {
            vscode.window.showInformationMessage(currentModule.label + '数据只有一页');
        }
    }

    /**
     * 获取当前板块数据
     * @param context 
     */
    async getCurrentModuleData(context: vscode.ExtensionContext) {
        const currentModule: { label: string, value: string } = this.getCurrentModule(context);
        const currentSelectedModuleData = await this.getModuleData(context, currentModule);
        return currentSelectedModuleData;
    }

    async getModuleData(context: vscode.ExtensionContext, currentModule: any) {
        // 本地缓存更新当前选择的板块
        context.globalState.update('bxj-current-module', currentModule);
        this._view?.webview.postMessage({
            command: 'showLoading',
        });
        let resBxjModule: { topic?: any, pageData?: any } = {};
        try {
            const value = currentModule.pageNo ? `${currentModule.value}-${currentModule.pageNo}` : currentModule.value;

            resBxjModule = await hupuBxjModule(value);

            vscode.window.setStatusBarMessage('获取论坛板块成功', 3000);

            // 保存起来其他地方用
            this.currentSelectedModuleData = JSON.parse(JSON.stringify(resBxjModule));
            this.currentSelectedModuleData.currentModule = currentModule;

            // 处理一下数据格式
            if (resBxjModule.topic || resBxjModule.pageData) {
                const resFormatData = this.setAllModule(resBxjModule);
                // 保存起来别的地方用，热门板块 和 分类板块
                this.hotMoule = resFormatData.hot;
                this.categoriesModule = resFormatData.categories;
            }
            let dataList = [];
            // webview 展示的数据
            if (resBxjModule.topic) {
                // 子版块的数据在 topic.threads.list 里面
                const res = resBxjModule.topic.threads;
                if (res && res.list && res.list.length) {
                    dataList = res.list;
                    this.currentSelectedModuleData.list = res.list;
                }
            } else if (resBxjModule.pageData) {
                // 热门板块的数据在 pageData.threads 里面
                const res = resBxjModule.pageData.threads;
                if (res && res.length) {
                    dataList = res;
                    this.currentSelectedModuleData.list = res;
                }
            }

            // 如果有数据再发送到 webview 刷新展示
            if (dataList && dataList.length) {
                this._view?.webview.postMessage({
                    command: 'updatePostList',
                    data: {
                        currentSelectedModuleData: this.currentSelectedModuleData,
                        currentModule,
                        list: dataList,
                    },
                });
            } else {
                vscode.window.showErrorMessage('论坛板块列表内容为空');
                this._view?.webview.postMessage({
                    command: 'hideLoading',
                });
            }
        } catch (error) {
            vscode.window.showErrorMessage('论坛版块内容获取失败');
            console.log(error);
            this._view?.webview.postMessage({
                command: 'hideLoading',
            });
        }
        return this.currentSelectedModuleData;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        BxjViewProvider._webView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(res => {
            switch (res.command) {
                case 'prevPage':
                    this.pageChange(this.currentSelectedModuleData, this._context, false);
                    break;
                case 'nextPage':
                    this.pageChange(this.currentSelectedModuleData, this._context, true);
                    break;
                case 'postSelected':
                    const data = JSON.parse(decodeURIComponent(res.data));
                    PostDetailWebView.createOrShow(this._context, data);
                    break;
                default:
                    PostDetailWebView.hideLoading();
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'bxj', 'main.js'));
        const scriptCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'common', 'js', 'common.js'));

        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'common', 'styles', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'common', 'styles', 'vscode.css'));
        const styleCommonUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'common', 'styles', 'common.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'webview', 'bxj', 'index.css'));


        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
				<link href="${styleMainUri}" rel="stylesheet">
				<link href="${styleCommonUri}" rel="stylesheet">
				
				<title>虎扑摸鱼</title>
			</head>
			<body id="hupumoyu-bxj">
                <div data-id="hupumoyu-module-title" class="hupumoyu-module-title"></div>
                <ul id="hupumoyu-module-list" class="hupumoyu-module-list"></ul>
                <div id="hupumoyu-module-page" class="hupumoyu-module-page"></div>

                <script src="${scriptCommonUri}"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}