import * as vscode from 'vscode';
import { hupuBxjModule } from '../api';
import PostDetailWebView from './postDetail';
import IndexCommands from '../commands';

let myStatusBarItem: vscode.StatusBarItem;
export default class BxjViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'bxjTreeView';

    public static _webView?: vscode.WebviewView;

    private _view?: vscode.WebviewView;

    private _extensionUri: vscode.Uri;

    private _context: vscode.ExtensionContext;
    // 分类板块
    private categoriesModule = [];
    // 当前选择的板块内容
    private currentSelectedModuleData: any = {};
    // 最近看过的板块，最多只保留20个
    private static maxLastviewedLength: number = 20;

    statusBarPostIndex: number = -1;

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
        const bxjRefresh = vscode.commands.registerCommand(
            'bxjTreeView.refresh',
            async () => {
                this.refresh(context);
            },
        );

        const bxjPrePage = vscode.commands.registerCommand(
            'bxjTreeView.prevPage',
            async () => {
                this.pageChange(this.currentSelectedModuleData, context, false);
            },
        );

        const bxjNextPage = vscode.commands.registerCommand(
            'bxjTreeView.nextPage',
            async () => {
                this.pageChange(this.currentSelectedModuleData, context, true);
            },
        );

        const bxjSwitch = vscode.commands.registerCommand(
            'bxjTreeView.switch',
            async () => {
                if (this.categoriesModule.length) {
                    this.moduleChange(context, this.categoriesModule);
                } else {
                    vscode.window.showInformationMessage('获取论坛板块数据失败');
                }
            },
        );

        const bxjSettings = vscode.commands.registerCommand(
            'bxjTreeView.settings',
            async () => {
                this.setSettings(context);
            },
        );

        const bxjCurrentModulePost = vscode.commands.registerCommand('bxjTreeView.currentModulePost', async () => {
            this.currentModulePost(context);
        });

        const bxjStatusBarNextPost = vscode.commands.registerCommand('bxjTreeView.statusBarNext', async () => {
            if (this.currentSelectedModuleData?.list?.length) {
                const postList = this.currentSelectedModuleData.list;
                this.statusBarPostIndex++;
                if (this.statusBarPostIndex > postList.length) {
                    this.statusBarPostIndex = 0;
                }
                this.showStatusBarPost(context);
            }
        });

        const bxjStatusBarPrevPost = vscode.commands.registerCommand('bxjTreeView.statusBarPrev', async () => {
            if (this.currentSelectedModuleData?.list?.length) {
                const postList = this.currentSelectedModuleData.list;
                this.statusBarPostIndex--;
                if (this.statusBarPostIndex < 0) {
                    this.statusBarPostIndex = postList.length - 1;
                }
                this.showStatusBarPost(context);
            }
        });

        context.subscriptions.push(bxjRefresh);
        context.subscriptions.push(bxjPrePage);
        context.subscriptions.push(bxjNextPage);
        context.subscriptions.push(bxjSwitch);
        context.subscriptions.push(bxjSettings);
        context.subscriptions.push(bxjCurrentModulePost);
        context.subscriptions.push(bxjStatusBarNextPost);
        context.subscriptions.push(bxjStatusBarPrevPost);
    }

    showStatusBarPost(context: vscode.ExtensionContext) {
        const postItem = this.currentSelectedModuleData.list[this.statusBarPostIndex];
        if (postItem) {
            postItem.text = `${postItem.title} 【阅:${postItem.read}/${postItem.lights ? `高亮:${postItem.lights}` : ''}/${postItem.replies ? `回复:${postItem.replies}` : ''}】`;
            if (myStatusBarItem) {
                myStatusBarItem.text = postItem.text;
            } else {
                myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
                myStatusBarItem.command = 'bxjTreeView.statusBarPostClick';
                context.subscriptions.push(myStatusBarItem);
                myStatusBarItem.text = postItem.text;
            }
            myStatusBarItem.show();
        }
    }

    // 获取当前板块帖子
    async currentModulePost(context: vscode.ExtensionContext) {
        let aQuickPick = [];
        let currentModule: PostModule = { label: '', value: '', pageNo: 0 };
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

    // 步行街设置
    async setSettings(context: vscode.ExtensionContext) {
        if (context.globalState.get('bxj-settings-showPostImgs') === undefined) {
            context.globalState.update('bxj-settings-showPostImgs', true);
        }

        const quickPickList = [];

        let postImgsSetting = context.globalState.get('bxj-settings-showPostImgs');
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
                this.setOptions({ context, key: 'bxj-settings-showPostImgs', show: false, msg: '帖子图片' });
                break;
            case 'showPostImgs':
                this.setOptions({ context, key: 'bxj-settings-showPostImgs', show: true, msg: '帖子图片' });
                break;
            default:
        }
    }

    setOptions(options: any) {
        options.context.globalState.update(options.key, options.show);
        vscode.window.showInformationMessage(options.msg + '已设置为：' + (options.show ? '【显示】' : '【隐藏】'));
        if (options.command) {
            this._view?.webview.postMessage({
                command: options.command,
                data: options.show,
            });
        }
    }

    async switchPostType(context: vscode.ExtensionContext, currentModule: PostModule) {
        const label: string = currentModule.label.split('-')[0];
        const value: string = currentModule.value.split('-')[0];
        const target: any = await vscode.window.showQuickPick(
            [
                {
                    label: label,
                    value: value,
                },
                {
                    label: label + '-24小时热帖',
                    value: value + '-hot',
                },
                {
                    label: label + '-最新发表',
                    value: value + '-postdate',
                }
            ],
            {
                title: '切换',
                placeHolder: '下面是可选择设置的项'
            },
        );
        if (target) {
            this.getModuleData(context, target);
        }
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
                label: '全部分类',
                value: 'all-categories',
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
     * @param categoriesModule 分类板块
     */
    async moduleChange(
        context: vscode.ExtensionContext,
        categoriesModule: Array<PostModule>
    ) {
        const lastviewedList: Array<PostModule> = this.getLastViewedModule();
        const target = await vscode.window.showQuickPick(
            [
                {
                    label: '全部分类',
                    value: 'all-categories',
                    detail: `下面显示的是最近看过的 ${BxjViewProvider.maxLastviewedLength} 板块`,
                },
                ...lastviewedList,
            ],
            {
                title: '请选择要切换的板块',
                placeHolder: '请选择要切换的板块'
            },
        );

        if (target) {
            if (target.value === 'all-categories') {
                // 选择其他板块
                this.multStepInput(context, categoriesModule);
            } else {
                // 选择当前板块
                this.getModuleData(context, target);
            }
        }
    }

    /**
     * 选择板块
     * @param context 
     * @param categoriesModule 分类板块
     */
    async multStepInput(context: vscode.ExtensionContext, categoriesModule: Array<PostModule>) {
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
                    const currentModule: PostModule = {
                        label: aItem[0].label,
                        value: aItem[0].value,
                        pageNo: 0,
                    };
                    this.getModuleData(context, currentModule);
                }
            }
        });

        // 返回按钮
        pick.onDidTriggerButton(() => {
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
    getCurrentModule(context: vscode.ExtensionContext): PostModule {
        return context.globalState.get('bxj-current-module') || {
            label: '步行街主干道',
            value: 'bxj',
            pageNo: 0,
        };
    }

    // 刷新
    refresh(context: vscode.ExtensionContext) {
        const currentModule: PostModule = this.getCurrentModule(context);
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
        const currentModule: PostModule = this.getCurrentModule(context);
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
            this.getModuleData(context, currentModule, false);
        } else {
            vscode.window.showInformationMessage(currentModule.label + '数据只有一页');
        }
    }

    // 设置最近查看过的板块
    setLastViewedMoudule(currentModule: PostModule, resetPageNo: boolean = true) {
        if (currentModule?.label && currentModule?.value) {
            // 删除多余的属性
            delete currentModule.description;
            if (resetPageNo) {
                delete currentModule.pageNo;
            }

            const lastviewedList: Array<PostModule> = this._context.globalState.get('bxj-lastviewed-module') || [];
            if (lastviewedList?.length) {
                // 有缓存数据
                let index = -1;
                for (let i = 0; i < lastviewedList.length; i++) {
                    if (lastviewedList[i].value === currentModule.value) {
                        index = i;
                        break;
                    }
                }
                if (index === -1) {
                    // 没找到，在数组前面插入
                    lastviewedList.unshift(currentModule);
                } else {
                    // 找到了，放在最前面
                    const insertModule: PostModule = lastviewedList.splice(index, 1)[0];
                    delete insertModule?.description;
                    lastviewedList.unshift(insertModule);
                }
                // 最多保存 20 个
                if (lastviewedList.length > BxjViewProvider.maxLastviewedLength) {
                    lastviewedList.length = BxjViewProvider.maxLastviewedLength;
                }
                this._context.globalState.update('bxj-lastviewed-module', lastviewedList);
            } else {
                // 没有缓存数据，直接添加
                this._context.globalState.update('bxj-lastviewed-module', [currentModule]);
            }
        }
    }

    // 获取最近查看过的板块
    getLastViewedModule(): Array<PostModule> {
        return this._context.globalState.get('bxj-lastviewed-module') || [];
    }

    /**
     * 获取当前板块数据
     * @param context 
     */
    async getCurrentModuleData(context: vscode.ExtensionContext) {
        const currentModule: PostModule = this.getCurrentModule(context);
        const currentSelectedModuleData = await this.getModuleData(context, currentModule);
        return currentSelectedModuleData;
    }

    async getModuleData(context: vscode.ExtensionContext, currentModule: PostModule, resetPageNo: boolean = true) {
        // 本地缓存更新当前选择的板块
        context.globalState.update('bxj-current-module', currentModule);
        // 加入到最近看过的板块
        this.setLastViewedMoudule(currentModule, resetPageNo);
        this._view?.webview.postMessage({
            command: 'showLoading',
        });
        let resBxjModule: { topic?: any, pageData?: any } = {};
        try {
            const value = currentModule.pageNo ? `${currentModule.value}-${currentModule.pageNo}` : currentModule.value;

            vscode.window.setStatusBarMessage('请求获取论坛板块', 3000);

            resBxjModule = await hupuBxjModule(value);

            vscode.window.setStatusBarMessage('获取论坛板块成功', 3000);

            // 保存起来其他地方用
            this.currentSelectedModuleData = JSON.parse(JSON.stringify(resBxjModule));
            this.currentSelectedModuleData.currentModule = currentModule;

            // 处理一下数据格式
            if (resBxjModule.topic || resBxjModule.pageData) {
                const resFormatData = this.setAllModule(resBxjModule);
                // 保存起来别的地方用，分类板块
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

        IndexCommands.receiveWebviewMessage('bxj', webviewView);

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
                case 'switchType':
                    this.switchPostType(this._context, this.currentSelectedModuleData.currentModule);
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
				
				<title>标题</title>
			</head>
			<body id="hupumoyu-bxj">

                <div data-id="hupumoyu-module-title-box" class="hupumoyu-module-title">
                    <span class="hupumoyu-module-title-main" data-id="hupumoyu-module-title"></span>
                    <span data-id="hupumoyu-module-title-btn" class="hupumoyu-module-title-btn"></span>
                </div>
                <div id="hupumoyu-module-list-box" class="hupumoyu-module-list-box hupumoyu-module-list-box_delayed">
                    <ul id="hupumoyu-module-list" class="hupumoyu-module-list"></ul>
                </div>
                <div id="hupumoyu-module-page" class="hupumoyu-module-page"></div>

                <script src="${scriptCommonUri}"></script>
				<script src="${scriptUri}"></script>
			</body>
			</html>`;
    }
}

// 论坛板块
interface PostModule {
    // 板块名称
    label: string;
    // 板块地址
    value: string;
    // 页码
    pageNo?: number;
    // 描述，例如多少热度
    description?: string;
}