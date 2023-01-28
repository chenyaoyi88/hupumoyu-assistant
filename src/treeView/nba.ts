import * as vscode from 'vscode';
import * as path from 'path';
import {
    hupuScheduleList,
    hupuStandings,
    hupuStats,
    hupuBoxscore,
    hupuPlayerMatchStats,
    hupuTeamMatchQuarterStats,
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
        duration: 10 * 1000,
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

    resetPlayerTr(data: any, item: any) {
        let statsLink = `<a href="${`https://games.mobileapi.hupu.com/h5/showplayer?matchId=${data.matchId}&playerId=${item.playerId}&night=0`}" target="_blank"  style="text-decoration: none;">${item.name}${item.starter === 1 ? '<span style="text-decoration: none; color: #ffffff;">（首发）</span>' : ''}</a>`;
        if (item.playerId.includes('team-stats') || item.playerId.includes('team-shooting')) {
            statsLink = `<span style="text-decoration: none; color: #ffffff;">${item.alias}</span>`;
        }
        return `
        <tr style="background-color: rgb(255, 255, 255);">
            <td class="tdw-1 left">${statsLink}</td>
            <td>${item.position === null ? '-' : item.position}</td>
            <td>${item.mins === null ? '-' : item.mins}</td>
            <td>${item.pts === null ? '-' : item.pts}</td>
            <td>${item.reb === null ? '-' : item.reb}</td>
            <td>${item.asts === null ? '-' : item.asts}</td>
            <td>${item.twoPoints === null ? '-' : item.twoPoints}</td>
            <td>${item.threePoints === null ? '-' : item.threePoints}</td>
            <td>${item.ft === null ? '-' : item.ft}</td>
            <td>${item.efgp === null ? '-' : item.efgp}</td>
            <td>${item.tsp === null ? '-' : item.tsp}</td>
            <td>${item.stl === null ? '-' : item.stl}</td>
            <td>${item.to === null ? '-' : item.to}</td>
            <td>${item.blk === null ? '-' : item.blk}</td>
            <td>${item.blkr === null ? '-' : item.blkr}</td>
            <td>${item.oreb === null ? '-' : item.oreb}</td>
            <td>${item.dreb === null ? '-' : item.dreb}</td>
            <td>${item.foulr === null ? '-' : item.foulr}</td>
            <td>${item.pf === null ? '-' : item.pf}</td>
            <td>${item.plusMinus === null ? '-' : item.plusMinus}</td>
        </tr>`;
    }

    resetStatsData(resPlayStats: any, listName: string) {
        const teamShootingIndex = resPlayStats[listName].findIndex((item: any) => item.playerId.includes('team-shooting'));
        const teamShootingItem = resPlayStats[listName].splice(teamShootingIndex, 1);
        resPlayStats[listName].push(...teamShootingItem);
        const teamStatsIndex = resPlayStats[listName].findIndex((item: any) => item.playerId.includes('team-stats'));
        const teamStatsItem = resPlayStats[listName].splice(teamStatsIndex, 1);
        resPlayStats[listName].push(...teamStatsItem);
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

        if (data.matchStatus === 'COMPLETED') {
            // 如果比赛已经结束，则调用手机端数据接口展示，因为虎扑PC端页面在比赛结束后就销毁了
            const res1: any = await hupuPlayerMatchStats(data.matchId);
            const resPlayStats = res1.result;

            this.resetStatsData(resPlayStats, 'awayPlayers');
            this.resetStatsData(resPlayStats, 'homePlayers');

            let sTableStatsTd = '';
            let sTableStatsTr = '';
            let sTableAwayPlayerTr = '';
            let sTableHomePlayerTr = '';
            for (let item of resPlayStats.sortList) {
                sTableStatsTd += `<td>${item.name}</td>`;
            }
            sTableStatsTr = `
                <tr class="title bg_a" style="background-color: rgb(251, 251, 251);">
                <td class="left" width="180"><b>球员</b></td>
                <td width="35">位置</td>
                ${sTableStatsTd}
            </tr>`;

            for (let item of resPlayStats.awayPlayers) {
                sTableAwayPlayerTr += this.resetPlayerTr(data, item);
            }

            for (let item of resPlayStats.homePlayers) {
                sTableHomePlayerTr += this.resetPlayerTr(data, item);
            }

            const res2: any = await hupuTeamMatchQuarterStats(data.matchId);
            const resTeamQuarterStats = res2.result;
            let sAwayQuarterTitle = '';
            let sAwayQuarter = '';
            let sHomeQuarter = '';
            for (let i = 0; i < resTeamQuarterStats.awayQuarterScore.length; i++) {
                if (i > 3) {
                    sAwayQuarterTitle += `<td>加时${i - 3}</td>`;
                } else {
                    sAwayQuarterTitle += `<td>${i + 1}</td>`;
                }
                sAwayQuarter += `<td class="item-away-${i}">${resTeamQuarterStats.awayQuarterScore[i]}</td>`;
            }
            for (let i = 0; i < resTeamQuarterStats.homeQuarterScore.length; i++) {
                sHomeQuarter += `<td class="item-away-${i}">${resTeamQuarterStats.homeQuarterScore[i]}</td>`;
            }

            const res = {
                content: `<div class="gamecenter_content_l">
                <div class="box_a">
                    <div class="top_bg"></div>
                    <div class="team_vs">
                        <div class="team_vs_box">
                            <div class="team_a" style="margin-top: 20px;">
                                <div class="img">
                                    <a target="_blank" href="https://nba.hupu.com/teams"><img alt="${resPlayStats.awayTeamLogo}"
                                            src="${data.awayTeamLogo}" height="95"
                                            width="95"></a>
                                </div>
                                <div class="message">
                                    <h2>${data.awayScore}</h2>
                                    <p>
                                        <a href="https://nba.hupu.com/teams" target="_blank">${data.awayTeamName}</a>
                                    </p>
                                    <div>
                                        客队</div>
                                </div>
                            </div>
                            <div class="team_num">${data.frontEndMatchStatus.desc}</div>
                            <div class="team_b" style="margin-top: 20px;">
                                <div class="img">
                                    <a target="_blank" href="https://nba.hupu.com/teams"><img alt="${resPlayStats.homeTeamLogo}"
                                            src="${data.homeTeamLogo}" height="95"
                                            width="95"></a>
                                </div>
                                <div class="message">
                                    <h2>${data.homeScore}</h2>
                                    <p>
                                        <a href="https://nba.hupu.com/teams" target="_blank">${data.homeTeamName}</a>
                                    </p>
                                    <div>
                                        主队</div>
                                </div>
                            </div>
                        </div>
                        <div class="about_fonts clearfix">
                            <p class="time_f">开赛：${data.matchTime}</p>
                            <p class="consumTime">耗时：${data.costTime}</p>
                        </div>
                    </div>
                    <div class="yuece_num">
                        <div class="yuece_num_a">
                            <table class="itinerary_table">
                                <tbody>
                                    <tr class="title">
                                        <td></td>
                                        ${sAwayQuarterTitle}
                                        <td class="total">总分</td>
                                    </tr>
                                    <tr class="away_score">
                                        <td>${data.awayTeamName}</td>
                                        ${sAwayQuarter}
                                        <td class="item-away-total">
                                            ${data.awayScore}
                                        </td>
                                    </tr>
                                    <tr class="home_score">
                                        <td>${data.homeTeamName}</td>
                                        ${sHomeQuarter}
                                        <td class="item-home-total">
                                            ${data.homeScore}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="yuece_num_b">
                            <a target="_self" href="https://nba.hupu.com/games/boxscore/164013" class="d  on"><s></s>数据直播</a>
                            <a target="_self" href="https://nba.hupu.com/games/playbyplay/164013" class="b "><s></s>文字直播</a>
                            <a target="_blank" href="http://goto.hupu.com/?a=goClick&amp;id=2845" class="f"><s></s>手机直播</a>
                            <span class="a_1"><s></s>比赛战报</span>
                        </div>
                    </div>
                </div>
                <div class="table_list_live">
                    <div class="clearfix">
                        <h2>${data.awayTeamName}（客队）</h2>
                        <div class="tips_layes" style="color: rgb(153, 153, 153);">
                            ?<div class="tips_tems" style="display: none;">
                                <div class="post_tips">
                                </div>
                                <div class="fonts">
                                    +/- ：指球员在场上时球队的净胜分<br>PG ：控球后卫<br>SG ：得分后卫<br>G ：后卫<br>SF ：小前锋<br>PF ：大前锋<br>F ：前锋<br>G/F
                                    ：后卫/前锋<br>C ：中锋<br>F/C ：前锋/中锋<br>
                                </div>
                            </div>
                        </div>
                    </div>
                    <table id="J_away_content">
                        <tbody>
                            ${sTableStatsTr}
                            ${sTableAwayPlayerTr}
                        </tbody>
                    </table>
                </div>
                <div class="table_list_live">
                    <div class="clearfix">
                        <h2>${data.homeTeamName}（主队）</h2>
                        <div class="tips_layes" style="color: rgb(153, 153, 153);">
                            ?<div class="tips_tems" style="display: none;">
                                <div class="post_tips">
                                </div>
                                <div class="fonts">
                                    +/- ：指球员在场上时球队的净胜分<br>PG ：控球后卫<br>SG ：得分后卫<br>G ：后卫<br>SF ：小前锋<br>PF ：大前锋<br>F ：前锋<br>G/F
                                    ：后卫/前锋<br>C ：中锋<br>F/C ：前锋/中锋<br>
                                </div>
                            </div>
                        </div>
                    </div>
                    <table id="J_home_content">
                        <tbody>
                            ${sTableStatsTr}
                            ${sTableHomePlayerTr}
                        </tbody>
                    </table>
                </div>
                <div class="table_choose">
                    <a target="_self" href="https://nba.hupu.com/games/boxscore/164013" class="d on"><s></s>数据直播</a>
                    <a target="_blank" href="http://goto.hupu.com/?a=goClick&amp;id=2845" class="f"><s></s>手机直播</a>
                    <a target="_self" href="https://nba.hupu.com/games/playbyplay/164013" class="b"><s></s>文字直播</a>
                    <span class="a_1"><s></s>比赛战报</span>
                </div>
            </div>`,
            };

            this.boxscore.webview?.hideLoading();
            // 发送消息到 webview 执行
            this.boxscore.webview?._panel?.webview?.postMessage({
                command: 'updateBoxscore',
                data: res,
            });
        } else {
            const res = await hupuBoxscore(data);
            this.boxscore.webview?._panel?.webview?.postMessage({
                command: 'updateBoxscore',
                data: res,
            });
        }

        // const res = await hupuBoxscore(data);
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
                            if (typeof tree[item] === 'object') {
                                arr.push(tree[item]);
                            }
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
                    let treeItem: any = {};
                    if (typeof element === 'object') {
                        treeItem = {
                            label: element.label,
                            collapsibleState: element.collapsibleState,
                            description: element.description,
                            tooltip: element.tooltip,
                            contextValue: element.contextValue,
                        };
                        if (element.iconPath) {
                            treeItem.iconPath = element.iconPath;
                        }
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
                if (data.matchStatus === 'NOTSTARTED') {
                    vscode.window.showInformationMessage('比赛未开始，暂时无法赛事数据');
                } else {
                    data.title = `${data.awayTeamName} ${data.awayScore || '-'} : ${data.homeScore || '-'} ${data.homeTeamName}`;
                    this.boxscore.webview?.createOrShow(
                        context,
                        'boxscore',
                        data,
                        (isReload: boolean) => {
                            this.getBoxscoreData(data, isReload);
                        }
                    );
                }
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
                    const label = `${itemMatch.awayBigScore === null ? '' : `（${itemMatch.awayBigScore}）`}${itemMatch.awayTeamName || ''} ${itemMatch.awayScore || '-'} : ${itemMatch.homeScore || '-'} ${itemMatch.homeTeamName || ''}${itemMatch.homeBigScore === null ? '' : `（${itemMatch.homeBigScore}）`}`;
                    const description = matchDesc(itemMatch);

                    json[itemMatch.matchId] = {
                        label,
                        collapsibleState: 0,
                        description,
                        tooltip: `${label} ${description}`,
                        command: {
                            title: '',
                            arguments: [itemMatch],
                        },
                        contextValue: 'singleMatch',
                    };
                    if (itemMatch.matchStatus === 'INPROGRESS') {
                        json[itemMatch.matchId].iconPath = context.asAbsolutePath(path.join('resources', 'images', 'basketball_ing.svg'));
                    }
                }
                if (matchListLabel.length) {
                    json.label = currentDate === matchDate ? `【${matchListLabel}】${matchDate}（今天）` : `【${matchListLabel}】${matchDate}`;
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
