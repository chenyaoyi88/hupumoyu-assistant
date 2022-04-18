import * as vscode from 'vscode';
import * as path from 'path';
import {
    hupuScheduleList,
    hupuStandings,
    hupuStats,
    hupuBoxscore,
} from '../api/index';

import LiveStudioWebView from '../webview/liveStudio';
import CommonWebView from '../webview/common';
import IndexCommands from '../commands';

interface BoxscoreWebView {
    webview: CommonWebView | null;
    timer: ReturnType<typeof setTimeout> | any;
    duration: number;
}
export default class NBATreeView {

    // 比赛数据
    boxscore: BoxscoreWebView = {
        webview: null,
        timer: 0,
        duration: 10000,
    };

    // 战绩/数据排名
    standingWebview: CommonWebView | null = null;

    _onDidChangeTreeData: vscode.EventEmitter<any> = new vscode.EventEmitter();
    // 刷新控制器
    scheduleListTimer: NodeJS.Timer | any = null;
    // 接口返回的数据
    resHupuScheduleList: any = {};
    // 每10秒刷新一次
    scheduleListRefreshDuration: number = 1000 * 10;

    public static _treeView?: vscode.TreeView<any>;

    refresh(forceUpdate?: boolean) {
        this.stopRefresh();
        if (forceUpdate) {
            this._onDidChangeTreeData.fire(null);
        } else {
            if (isCurrentGameFinish(this.resHupuScheduleList)) {
                // 当天比赛未开始或已全部结束
            } else {
                this.scheduleListTimer = setTimeout(() => {
                    this._onDidChangeTreeData.fire(null);
                }, this.scheduleListRefreshDuration);
            }
        }
    }

    stopRefresh() {
        clearTimeout(this.scheduleListTimer);
    }

    async selectRankType(context: vscode.ExtensionContext) {
        const target = await vscode.window.showQuickPick(
            [
                { label: '战绩排行', value: 'standings' },
                { label: '数据排行', value: 'players' },
            ],
            {
                title: '请选择要查看的数据类型板块',
                placeHolder: '请选择要查看的数据类型板块'
            },
        );

        if (target) {
            this.standingWebview?.createOrShow(
                context,
                'standings',
                {
                    title: target.label,
                },
                (isReload: boolean) => {
                    let data = {};
                    if (target.value === 'players') {
                        data = {
                            statsUrl: '/stats/players',
                        };
                    }
                    this.getStandingData(data, isReload);
                },
                (message: any) => {
                    switch (message.command) {
                        case 'statsUrl':
                            this.getStandingData({
                                statsUrl: message.data,
                            }, true);
                            break;
                        default:
                    }
                },
            );
        }
    }

    /**
     * 获取战绩/数据排名数据
     * @param data 请求参数
     * @param isReload 是否显示loading
     */
    async getStandingData(data: { statsUrl?: string }, isReload?: boolean) {
        // 延时打开，不然还打不开
        setTimeout(async () => {
            if (this.standingWebview?._panel) {
                let requestApi: Function = data.statsUrl ? hupuStats : hupuStandings;
                if (isReload) {
                    this.standingWebview.showLoading();
                }
                const res = await requestApi(data.statsUrl);
                this.standingWebview.hideLoading();
                // 发送消息到 webview 执行
                this.standingWebview?._panel.webview.postMessage({
                    command: 'updateStandings',
                    data: res,
                });
            }
        }, 100);
    }

    /**
     * 获取当场比赛数据
     * @param data 请求参数
     * @param isReload 是否显示loading
     */
    async getBoxscoreData(data: any, isReload?: boolean) {
        this.refreshBoxscoreData(data);
        if (isReload) {
            this.boxscore.webview?.showLoading();
        }
        const res = await hupuBoxscore(data);
        this.boxscore.webview?.hideLoading();
        // 发送消息到 webview 执行
        this.boxscore.webview?._panel?.webview?.postMessage({
            command: 'updateBoxscore',
            data: res,
        });
    }

    /**
     * 刷新当场比赛数据
     * @param data 请求参数
     */
    refreshBoxscoreData(data: any) {
        if (this.boxscore.webview?._panel) {
            clearTimeout(this.boxscore.timer);
            this.boxscore.timer = setTimeout(() => {
                if (this.boxscore.webview?._panel) {
                    this.getBoxscoreData(data);
                }
            }, this.boxscore.duration);
        }
    }

    constructor(context: vscode.ExtensionContext) {
        const treeView = vscode.window.createTreeView('nbaTreeView', {
            treeDataProvider: {
                onDidChangeTreeData: this._onDidChangeTreeData.event,
                getChildren: async (element: any) => {
                    if (element) {
                        // 有数据才启动轮询刷新
                        this.refresh();
                        const arr = [];
                        const tree = element;
                        for (let item in tree) {
                            arr.push(tree[item]);
                        }
                        return arr;
                    } else {
                        let res: any = await hupuScheduleList();
                        let tree = [];
                        if (res && res.result && res.result.gameList) {
                            tree = formatScheduleListData(context, res);
                        } else {
                            vscode.window.setStatusBarMessage('请求响应失败，重新发起请求', 5000);
                            this._onDidChangeTreeData.fire(null);
                            return;
                        }
                        const arr = [];
                        this.resHupuScheduleList = JSON.parse(JSON.stringify(res));
                        for (let item in tree) {
                            arr.push(tree[item]);
                        }
                        return arr;
                    }
                },
                getTreeItem: (element: any) => {
                    let treeItem = null;
                    if (typeof element === 'object') {
                        treeItem = element;
                    }
                    return treeItem;
                },
            },
            showCollapseAll: true
        });

        // 点击刷新赛事日程
        const clickRefreshCommand = vscode.commands.registerCommand(
            'nbaTreeView.refresh', () => {
                this.refresh(true);
            },
        );

        this.boxscore.webview = new CommonWebView();

        IndexCommands.receiveWebviewMessage('boxscore', this.boxscore.webview);

        // 点击当场赛事数据
        const clickScoreboxCommand = vscode.commands.registerCommand(
            'nbaTreeView.dataDetail', (e) => {
                const data = e.command.arguments[0];
                data.title = `${data.awayTeamName} ${data.awayScore || '-'} : ${data.homeScore || '-'} ${data.homeTeamName}`;

                this.boxscore.webview?.createOrShow(
                    context,
                    'boxscore',
                    data,
                    (isReload: boolean) => {
                        this.getBoxscoreData(data, isReload);
                    }
                );

            },
        );

        // 点击当场比赛
        const clickLiveStudioCommand = vscode.commands.registerCommand(
            'nbaTreeView.liveStudio',
            async (e: any) => {
                const data = e.command.arguments[0];
                if (data.matchStatus === 'COMPLETED') {
                    // 比赛已结束，不让看直播间
                    vscode.window.showInformationMessage('比赛结束了，直播间已关闭');
                } else {
                    // 比赛进行中/未开始
                    LiveStudioWebView.createOrShow(context, data);
                }
            },
        );

        this.standingWebview = new CommonWebView();

        IndexCommands.receiveWebviewMessage('standing', this.standingWebview);

        // 点击排名
        const clickRankCommand = vscode.commands.registerCommand(
            'nbaTreeView.standings',
            async () => {
                this.selectRankType(context);
            },
        );

        NBATreeView._treeView = treeView;

        context.subscriptions.push(treeView);
        context.subscriptions.push(clickRefreshCommand);
        context.subscriptions.push(clickScoreboxCommand);
        context.subscriptions.push(clickLiveStudioCommand);
        context.subscriptions.push(clickRankCommand);
    }
}

function formatScheduleListData(context: vscode.ExtensionContext, data: any) {
    const arr = [];
    const res = data.result;
    if (res.gameList && res.gameList.length) {
        for (let itemGameList of res.gameList) {
            const oDate = new Date();
            const localCurrentDate = `${oDate.getFullYear()}${`${oDate.getMonth() + 1}`.padStart(2, '0')}${`${oDate.getDate()}`.padStart(2, '0')}`;
            const currentDate = res.scheduleListStats ? (res.scheduleListStats.currentDate ? res.scheduleListStats.currentDate : localCurrentDate) : localCurrentDate;
            const matchDate = itemGameList.day;
            if (currentDate && matchDate) {
                let matchListLabel: string = '';
                const json: any = {
                    label: matchDate,
                    // 今天的比赛默认展开，其他日期比赛折叠
                    collapsibleState: currentDate === matchDate ? 2 : 1,
                };
                // 赛事描述（例如是否结束，进行中还剩几分钟）
                const matchDesc = (itemMatch: any) => {
                    let desc = '';
                    if (itemMatch.matchStatus === 'INPROGRESS' || itemMatch.matchStatus === 'NOTSTARTED') {
                        desc = itemMatch.frontEndMatchStatus ? (itemMatch.frontEndMatchStatus.desc || itemMatch.matchStatusChinese) : itemMatch.matchStatusChinese;
                    } else {
                        desc = itemMatch.matchStatusChinese;
                    }
                    return desc;
                };
                for (let itemMatch of itemGameList.matchList) {
                    if (matchListLabel.indexOf(itemMatch.competitionStageDesc) === -1) {
                        matchListLabel += itemMatch.competitionStageDesc;
                    }
                    const label = `${itemMatch.awayTeamName || ''} ${itemMatch.awayScore || '-'} : ${itemMatch.homeScore || '-'} ${itemMatch.homeTeamName || ''}`;
                    const description = matchDesc(itemMatch);
                    json[itemMatch.matchId] = {
                        label,
                        collapsibleState: 0,
                        description,
                        tooltip: `${label} ${description}`,
                        iconPath: itemMatch.matchStatus === 'INPROGRESS' ? context.asAbsolutePath(path.join('resources', 'images', 'basketball_ing.svg')) : null,
                        command: {
                            title: '',
                            command: 'nbaTreeView.currentMatchDetail',
                            arguments: [itemMatch],
                        },
                        contextValue: 'singleMatch',
                    };
                }
                if (matchListLabel.length) {
                    json.label = currentDate === matchDate ? `【${matchListLabel}】${matchDate}(今天)` : `【${matchListLabel}】${matchDate}`;
                }
                arr.push(json);
            }
        }
    } else {
        vscode.window.showErrorMessage('赛事日程列表没有返回');
    }
    return arr;
};

function isCurrentGameFinish(data: any) {
    let allGameFinished = false;
    let aFinishedCount = [];
    if (data.result && data.result.scheduleListStats) {
        const res = data.result;
        if (res.gameList && res.gameList.length) {
            for (let itemGameList of res.gameList) {
                if (res.scheduleListStats.currentDate === itemGameList.day) {
                    for (let item of itemGameList.matchList) {
                        if (item.matchStatus === 'COMPLETED') {
                            aFinishedCount.push(item);
                        }
                    }
                    if (itemGameList.matchList.length === aFinishedCount.length) {
                        allGameFinished = true;
                        break;
                    }
                }
            }
        }
    }
    return allGameFinished;
};
