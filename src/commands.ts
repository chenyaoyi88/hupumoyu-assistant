import {
    window,
    commands,
    ExtensionContext,
    QuickInputButtons,
} from 'vscode';

import NBATreeView from './treeView/nba';
import BxjTreeView from './webview/bxj';
import LiveStudioWebView from './webview/liveStudio';
import PostDetailWebView from './webview/postDetail';

import {
    hupuQueryLiveActivityKey,
    hupusingleMatch,
    hupuQueryLiveTextList,
    hupuScheduleList,
} from './api/index';

import { findDiffList, addData } from './utils/index';

export default class IndexCommands {

    currentMatchInfo: any = {};

    singleMatchTimer: NodeJS.Timer | any;
    singleMatchRefreshDuration: number = 10000;

    oLiveText: any = {
        diffList: [],
        backupList: [],
        showList: [],
        addList: [],
        finishList: [],
        addIndex: -1,
        refreshTimer: null,
        addDataTimer: null,
        // 添加数据间隔
        showDataDuration: 3000,
        renderFn: hupuQueryLiveTextList,
        lock: false,
    };

    singleMatch: UpdateObject = {
        timer: 0,
        duration: 10000,
        command: 'singleMatch',
        api: hupusingleMatch,
    };

    liveText: UpdateObject = {
        timer: 0,
        duration: 5000,
        command: 'liveText',
        api: hupuQueryLiveTextList,
    };

    constructor(context: ExtensionContext) {
        const currentDayMatchList = commands.registerCommand('hupumoyu.currentDayMatchList', async (e: any) => {
            const res = await hupuScheduleList({
                showCurrentDate: true,
            });
            if (res.length) {
                const pick: any = await window.createQuickPick();
                const items = res.map((item: any) => ({
                    label: `${item.awayTeamName} ${item.awayScore} : ${item.homeScore} ${item.homeTeamName}`,
                    description: `${item.frontEndMatchStatus.desc}`,
                    ...item,
                }));
                pick.title = '当天的全部比赛';
                pick.step = 1;
                pick.totalSteps = 2;
                pick.items = items;
                let currentSelectedItem: any = {};
                pick.onDidChangeSelection((aItem: any) => {
                    if (pick.step === 1) {
                        // 切换到第二步
                        pick.step = 2;
                        // 选择专区
                        pick.title = '请选择';
                        // 加载子版块选项
                        pick.items = [
                            {
                                label: '在 webview 中观看文字直播',
                                value: 'liveStudio',
                                detail: '打开一个 webview 来观看，里面还有热线',
                            },
                            {
                                label: '在底部状态栏观看文字直播',
                                value: 'statusBarMessage',
                                detail: '每3秒滚动播放一条最新信息',
                            },
                        ];
                        // 记录当前选择的板块（用于后退时切换回来）
                        currentSelectedItem = aItem[0];
                        // 显示后退按钮
                        pick.buttons = [QuickInputButtons.Back];
                    } else if (pick.step === 2) {
                        if (aItem[0]) {
                            pick.hide();
                            switch (aItem[0].value) {
                                case 'liveStudio':
                                    this.getLiveStudioData(context, currentSelectedItem);
                                    break;
                                case 'statusBarMessage':
                                    this.getMatchData(currentSelectedItem);
                                    break;
                                default:
                            }
                        }
                    }
                });
                // 返回按钮
                pick.onDidTriggerButton(() => {
                    pick.title = '请选择你想看的板块';
                    pick.step = 1;
                    pick.items = items;
                    pick.activeItems = [currentSelectedItem];
                    pick.buttons = [];
                });
                pick.show();
            } else {
                window.showErrorMessage('获取当天比赛赛况失败，请重试');
            }
        });
        context.subscriptions.push(currentDayMatchList);

        // 快速切换回工作模式
        const bossComing = commands.registerCommand('hupumoyu.bossComing', (e: { extensionId: string }) => {
            // 关闭直播间
            LiveStudioWebView.forceCloseWebview();
            // 关闭步行街打开的帖子
            PostDetailWebView.forceCloseWebview();

            for (let webview in IndexCommands.webviewObject) {
                if (IndexCommands.webviewObject[webview]) {
                    IndexCommands.webviewObject[webview].dispose();
                }
            }

            // 如果左侧的板块的可见的，则切换到资源管理器界面
            if (NBATreeView?._treeView?.visible || BxjTreeView?._webView?.visible) {
                commands.executeCommand('workbench.view.explorer');
            }
        });
        context.subscriptions.push(bossComing);
    }

    static webviewObject: any = {
        boxscore: null,
        standing: null,
    };

    static receiveWebviewMessage(webviewName: string, webviewInstance: any) {
        IndexCommands.webviewObject[webviewName] = webviewInstance;
    }

    async getLiveStudioData(context: ExtensionContext, item: any) {
        if (item.matchStatus === 'COMPLETED') {
            window.showInformationMessage('比赛已结束');
        } else {
            LiveStudioWebView.createOrShow(context, item);
        }
    }

    async getMatchData(item: any) {

        const resLiveKey: any = await hupuQueryLiveActivityKey(item.matchId);

        const params = {
            matchId: item.matchId,
            liveActivityKeyStr: encodeURIComponent(resLiveKey.result.liveActivityKey),
        };

        await this.getSingleMatchData(params.matchId);

        if (this.currentMatchInfo?.result?.matchStatus === 'COMPLETED') {
            window.showInformationMessage('比赛已结束');
        } else {
            this.getData(
                this.liveText,
                params,
                (result: Array<any>) => {
                    if (this.oLiveText.addIndex) {
                        this.oLiveText.diffList = findDiffList(this.oLiveText.backupList || [], result);
                        this.oLiveText.backupList = JSON.parse(JSON.stringify(result));
                        this.oLiveText.addList = (this.oLiveText.addList || []).concat(this.oLiveText.diffList);
                        if (!this.oLiveText.lock) {
                            this.oLiveText.lock = true;
                            addData(this.oLiveText);
                        }
                    }
                },
            );
        }
    }

    async getSingleMatchData(matchId: string) {
        this.currentMatchInfo = await this.singleMatch.api(matchId);
        if (this.currentMatchInfo?.status === 200) {
            if (this.currentMatchInfo?.result?.matchStatus === 'NOTSTARTED') {
                const matchTime = this.currentMatchInfo.result.matchTime;
                if (matchTime && matchNotStarted(matchTime)) {
                    this.refreshSingleMatch(matchId);
                }
            } else if (this.currentMatchInfo?.result?.matchStatus === 'INPROGRESS') {
                this.refreshSingleMatch(matchId);
            }
        } else {
            window.showErrorMessage('请求失败，请重试');
        }
    }

    refreshSingleMatch(matchId: string) {
        clearTimeout(this.singleMatch.timer);
        this.singleMatch.timer = setTimeout(() => {
            this.getSingleMatchData(matchId);
        }, this.singleMatch.duration);
    }

    async getData(obj: UpdateObject, params: LiveParams, callback?: Function) {
        if (this.currentMatchInfo?.result?.matchStatus === 'INPROGRESS') {
            this.refreshData(obj, params, callback);
            try {
                const res = await obj.api(params);
                if (res?.status === 200) {
                    if (callback) {
                        callback(res.result);
                    } else {
                        return res.result;
                    }
                } else {
                    console.log('请求没有响应，重新搞一下');
                    this.getData(obj, params, callback);
                }
            } catch (error) {
                console.log('请求失败了，重新搞一下');
                this.getData(obj, params, callback);
            }
        }
    }

    refreshData(obj: any, params: LiveParams, callback?: Function) {
        clearTimeout(obj.timer);
        obj.timer = setTimeout(() => {
            this.getData(obj, params, callback);
        }, obj.duration);
    }
}

function matchNotStarted(matchTime: string) {
    return new Date().getTime() + 1000 * 60 * 15 >= new Date(matchTime).getTime();
};

interface LiveParams {
    matchId: string;
    liveActivityKeyStr: string;
}

interface UpdateObject {
    timer: NodeJS.Timer | any,
    duration: number,
    command: string,
    api: Function,
}
