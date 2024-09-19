import * as vscode from 'vscode';
import { getAllTopicList, getModuleListByTopicId, hupuSearchInfo } from '../api';
import PostDetailWebView from './postDetail';
import IndexCommands from '../commands';
import { filterHtml } from '../utils';

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
    // 当前选择的板块内容
    private currentSelectTopicInfo: CurrentSelectTopicInfo = {
        label: '步行街主干道',
        topicId: 1,
        page: 0,
        nextCursor: '',
        list: [],
    };
    // 最近看过的板块，最多只保留20个
    private static maxLastviewedLength: number = 20;

    // 搜索关键字
    private keyword: string = '';

    statusBarPostIndex: number = -1;

    constructor(
        context: vscode.ExtensionContext
    ) {

        this._context = context;
        this._extensionUri = context.extensionUri;

        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(BxjViewProvider.viewType, this)
        );

        // 获取当前板块数据，有本地缓存先拿本地缓存的，没有就默认步行街主干道
        this.currentSelectTopicInfo = context.globalState.get('bxj-current-topicInfo') || {
            label: '步行街主干道',
            topicId: 1,
            page: 0,
            nextCursor: '',
            list: [],
        };
        this.getCurrentTopicData();
        this.getAllTopicList();
        this.setClickCommands();
    }

    removeOldData () {
        const lastviewedList: Array<CurrentSelectTopicInfo> = this._context.globalState.get('bxj-lastviewed-module') || [];
    }

    setClickCommands() {
        const bxjRefresh = vscode.commands.registerCommand(
            'bxjTreeView.refresh',
            async () => {
                if (this.currentSelectTopicInfo.topicId === -1) {
                    // 搜索
                    this.searchByKeyword();
                } else {
                    // 模块
                    this.getCurrentTopicData();
                }
            },
        );

        const bxjPrePage = vscode.commands.registerCommand(
            'bxjTreeView.prevPage',
            async () => {
                this.pageChange(false);
            },
        );

        const bxjNextPage = vscode.commands.registerCommand(
            'bxjTreeView.nextPage',
            async () => {
                this.pageChange(true);
            },
        );

        const bxjSearch = vscode.commands.registerCommand(
            'bxjTreeView.search',
            async () => {
                this.handleSearch();
            },
        );

        const bxjSwitch = vscode.commands.registerCommand(
            'bxjTreeView.switch',
            async () => {
                if (this.categoriesModule.length) {
                    this.moduleChange();
                } else {
                    vscode.window.showInformationMessage('获取论坛板块数据失败');
                }
            },
        );

        const bxjSettings = vscode.commands.registerCommand(
            'bxjTreeView.settings',
            async () => {
                this.setSettings(this._context);
            },
        );

        const bxjCurrentModulePost = vscode.commands.registerCommand('bxjTreeView.currentModulePost', async () => {
            this.currentModulePost();
        });

        const bxjStatusBarNextPost = vscode.commands.registerCommand('bxjTreeView.statusBarNext', async () => {
            if (this.currentSelectedModuleData?.list?.length) {
                const postList = this.currentSelectedModuleData.list;
                this.statusBarPostIndex++;
                if (this.statusBarPostIndex > postList.length) {
                    this.statusBarPostIndex = 0;
                }
                this.showStatusBarPost(this._context);
            }
        });

        const bxjStatusBarPrevPost = vscode.commands.registerCommand('bxjTreeView.statusBarPrev', async () => {
            if (this.currentSelectedModuleData?.list?.length) {
                const postList = this.currentSelectedModuleData.list;
                this.statusBarPostIndex--;
                if (this.statusBarPostIndex < 0) {
                    this.statusBarPostIndex = postList.length - 1;
                }
                this.showStatusBarPost(this._context);
            }
        });

        this._context.subscriptions.push(bxjRefresh);
        this._context.subscriptions.push(bxjPrePage);
        this._context.subscriptions.push(bxjNextPage);
        this._context.subscriptions.push(bxjSearch);
        this._context.subscriptions.push(bxjSwitch);
        this._context.subscriptions.push(bxjSettings);
        this._context.subscriptions.push(bxjCurrentModulePost);
        this._context.subscriptions.push(bxjStatusBarNextPost);
        this._context.subscriptions.push(bxjStatusBarPrevPost);
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
    async currentModulePost() {
        if (this.currentSelectTopicInfo?.list?.length) {
            const aQuickPick = this.currentSelectTopicInfo?.list.map((item: any) => {
                item.label = item.title;
                item.detail = `${item.recommendNum ? `推荐：` + item.recommendNum : ''}  ${item.replies ? `回复：` + item.replies : ''}`;
                return item;
            });
            const target: any = await vscode.window.showQuickPick(
                aQuickPick,
                {
                    title: `${this.currentSelectTopicInfo?.label} ${this.currentSelectTopicInfo.page ? this.currentSelectTopicInfo.page : ''}`,
                    placeHolder: '请选择要查看的帖子'
                },
            );
            if (target) {
                PostDetailWebView.createOrShow(this._context, target);
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

    async handleSearch () {
        const keyword = await vscode.window.showInputBox({
            value: this.keyword || '',
            placeHolder: '请输入搜索关键字',
        });
        this.keyword = keyword || '';
        this.searchByKeyword();
    }

    async searchByKeyword () {
        if (this.keyword) {
            this._view?.webview.postMessage({
                command: 'showLoading',
            });
            try {
                const res: any = await hupuSearchInfo(this.keyword);
                this._view?.webview.postMessage({
                    command: 'hideLoading',
                });
                // console.log('搜索结果', res);
                if (res && res.data && res.data.result) {
                    this.currentSelectTopicInfo.topicId = -1;
                    this.currentSelectTopicInfo.label = `【${this.keyword}】相关`;
                    for (let item of res.data.result.data) {
                        item.url = `https://m.hupu.com/bbs/${item.id}`;
                        item.tid = item.id;
                        item.title = filterHtml(item.title);
                    }
                    this.currentSelectTopicInfo.list = res.data.result.data || [];
                    this._view?.webview.postMessage({
                        command: 'updatePostList',
                        data: {
                            ...this.currentSelectTopicInfo,
                            noPage: true,
                        },
                    });
                }
            } catch (error) {
                console.log('搜索报错', error);
                this._view?.webview.postMessage({
                    command: 'hideLoading',
                });
            }
        }
    }

    async switchPostType(context: vscode.ExtensionContext, currentModule: PostModule) {
        // const label: string = currentModule.label.split('-')[0];
        // const value: string = currentModule.value.split('-')[0];
        // const target: any = await vscode.window.showQuickPick(
        //     [
        //         {
        //             label: label,
        //             value: value,
        //         },
        //         {
        //             label: label + '-24小时热帖',
        //             value: value + '-hot',
        //         },
        //         {
        //             label: label + '-最新发表',
        //             value: value + '-postdate',
        //         }
        //     ],
        //     {
        //         title: '切换',
        //         placeHolder: '下面是可选择设置的项'
        //     },
        // );
        // if (target) {
        //     this.getCurrentTopicData(context, target);
        // }
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

    async moduleChange() {
        const lastviewedList: Array<CurrentSelectTopicInfo> = this._context.globalState.get('bxj-lastviewed-module') || [];
        const allcategories: any = [
            {
                label: '全部分类',
                value: 'all-categories',
                detail: `下面显示的是最近看过的 ${BxjViewProvider.maxLastviewedLength} 板块`,
            },
        ];
        // 过滤掉重复的
        for (let item of lastviewedList) {
            if (!(allcategories.some((item1: any) => item1.value === item.topicId))) {
                allcategories.push(item);
            }
        }
        const target: any = await vscode.window.showQuickPick(
            allcategories,
            {
                title: '请选择要切换的板块',
                placeHolder: '请选择要切换的板块'
            },
        );

        if (target) {
            if (target.value === 'all-categories') {
                // 选择其他板块
                this.multStepInput();
            } else {
                // 选择当前板块
                this.getCurrentTopicData(target);
            }
        }
    }

    async multStepInput() {
        const pick = vscode.window.createQuickPick();
        pick.title = '请选择你想看的板块';
        pick.step = 1;
        pick.items = this.categoriesModule;
        pick.totalSteps = 2;
        let currentSelectedItem = { label: '' };
        pick.onDidChangeSelection((aItem: any) => {
            if (pick.step === 1) {
                // 切换到第二步
                pick.step = 2;
                // 选择专区
                pick.title = '请选择你想看的专区';
                // 加载子版块选项
                pick.items = aItem[0].topicList;
                // 记录当前选择的板块（用于后退时切换回来）
                currentSelectedItem = aItem[0];
                // 显示后退按钮
                pick.buttons = [vscode.QuickInputButtons.Back];
            } else if (pick.step === 2) {
                if (aItem[0]) {
                    // console.log('选择模块', aItem[0]);
                    pick.hide();
                    aItem[0].page = 0;
                    aItem[0].list = [];
                    aItem[0].nextCursor = '';
                    this.getCurrentTopicData(aItem[0]);
                }
            }
        });
        // 返回按钮
        pick.onDidTriggerButton(() => {
            pick.title = '请选择你想看的板块';
            pick.step = 1;
            pick.items = this.categoriesModule;
            pick.activeItems = [currentSelectedItem];
            pick.buttons = [];
        });
        pick.show();
    }

    /**
     * 切换上一页/下一页
     * @param context 
     * @param pageCtrl true 下一页 false 上一页
     */
    pageChange(pageCtrl?: boolean) {
        if (!this.currentSelectTopicInfo.topicId) {
            vscode.window.showInformationMessage('未选中任何板块');
            return;
        }
        if (this.currentSelectTopicInfo.page) {
            // 非第一页
            if (pageCtrl) {
                this.currentSelectTopicInfo.page++;
            } else {
                this.currentSelectTopicInfo.page--;
            }
        } else {
            // 第一页
            this.currentSelectTopicInfo.page = 0;
            if (pageCtrl) {
                this.currentSelectTopicInfo.page++;
            } else {
                vscode.window.showInformationMessage('当前已经是第一页了');
            }
        }
        this.getCurrentTopicData();
    }

    // 设置最近查看过的板块
    setLastViewedMoudule() {
        if (this.currentSelectTopicInfo?.label && this.currentSelectTopicInfo?.topicId) {
            const lastviewedList: Array<CurrentSelectTopicInfo> = this._context.globalState.get('bxj-lastviewed-module') || [];
            if (lastviewedList?.length) {
                // 有缓存数据
                let index = -1;
                for (let i = 0; i < lastviewedList.length; i++) {
                    if (lastviewedList[i].topicId === this.currentSelectTopicInfo.topicId) {
                        index = i;
                        break;
                    }
                }
                if (index === -1) {
                    // 没找到，在数组前面插入
                    lastviewedList.unshift(this.currentSelectTopicInfo);
                } else {
                    // 找到了，放在最前面
                    const currentSelectTopicInfo: CurrentSelectTopicInfo = lastviewedList.splice(index, 1)[0];
                    lastviewedList.unshift(currentSelectTopicInfo);
                }
                // 最多保存 20 个
                if (lastviewedList.length > BxjViewProvider.maxLastviewedLength) {
                    lastviewedList.length = BxjViewProvider.maxLastviewedLength;
                }
                this._context.globalState.update('bxj-lastviewed-module', lastviewedList);
            } else {
                // 没有缓存数据，直接添加
                this._context.globalState.update('bxj-lastviewed-module', [this.currentSelectTopicInfo]);
            }
        }
    }

    // 获取当前板块数据
    async getCurrentTopicData(currentSelectTopicInfo?: CurrentSelectTopicInfo) {
        if (currentSelectTopicInfo) {
            this.currentSelectTopicInfo = currentSelectTopicInfo;
        }
        // 本地缓存更新当前选择的板块
        this._context.globalState.update('bxj-current-topicInfo', this.currentSelectTopicInfo);
        // 加入到最近看过的板块
        this.setLastViewedMoudule();
        this._view?.webview.postMessage({
            command: 'showLoading',
        });
        try {
            vscode.window.setStatusBarMessage('请求获取论坛板块', 3000);
            const resGetModuleListByTopicId: ResCurrentTopicList = await getModuleListByTopicId({
                topicId: this.currentSelectTopicInfo.topicId,
                page: this.currentSelectTopicInfo.page || 0,
                cursor: this.currentSelectTopicInfo.nextCursor || '',
            });
            vscode.window.setStatusBarMessage('获取论坛板块成功', 3000);

            // 保存起来其他地方用
            const backupData = JSON.parse(JSON.stringify(resGetModuleListByTopicId));
            this.currentSelectTopicInfo.nextCursor = backupData.nextCursor;
            this.currentSelectTopicInfo.list = backupData.topicThreads;

            // 如果有数据再发送到 webview 刷新展示
            if (this.currentSelectTopicInfo.list?.length) {
                this._view?.webview.postMessage({
                    command: 'updatePostList',
                    data: this.currentSelectTopicInfo,
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
    }

    // 获取所有板块
    async getAllTopicList() {
        this.categoriesModule = await getAllTopicList();
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
                    this.pageChange(false);
                    break;
                case 'nextPage':
                    this.pageChange(true);
                    break;
                case 'postSelected':
                    const data = JSON.parse(decodeURIComponent(res.data));
                    // data.tid = 627929088;
                    // data.url = 'https://m.hupu.com/bbs/627929088';
                    // data.title = '【直播】Ning王看解说杯：BSYY绝对的野鸡教练！绝对没看过Ning的复盘';
                    PostDetailWebView.createOrShow(this._context, data);
                    break;
                // case 'switchType':
                //     this.switchPostType(this._context, this.currentSelectTopicInfo);
                //     break;
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
interface ResCurrentTopicList {
    // 话题列表
    topicThreads: Array<any>,
    // 请求下一页需要用到的参数
    nextCursor: string;
}

interface CurrentSelectTopicInfo {
    // 板块名称
    label: string;
    // 板块id
    topicId: number;
    // 当前页
    page?: number;
    // 描述，例如多少热度
    nextCursor?: string;
    // 当前页的数据
    list?: Array<any>;
}