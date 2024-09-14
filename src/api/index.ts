import req from './request';
import * as cheerio from 'cheerio';
import { _context } from '../extension';

interface LiveOptions {
    matchId: string,
    liveActivityKeyStr: string,
}

// 赛事日程
export const hupuScheduleList = async (options?: { showCurrentDate: boolean }) => {
    try {
        const res: any = await req('https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/scheduleList?competitionTag=nba', {
            tipsName: '1-赛事日程',
        });
        if (options?.showCurrentDate) {
            if (res?.result?.gameList?.length) {
                for (let item of res.result.gameList) {
                    if (res.result.scheduleListStats.currentDate === item.day) {
                        return item.matchList;
                    }
                }
            } else {
                return res;
            }
        } else {
            return res;
        }
    } catch (error) {
        return {};
    }
};

// 直播参数
export const hupuQueryLiveActivityKey = async (matchId: string) => {
    try {
        const res = await req(`https://live-api.liangle.com/1/7.5.60/live/queryLiveActivityKey?competitionType=basketball&matchId=${matchId}`, {
            tipsName: '2-直播参数',
        });
        return res;
    } catch (error) {
        return {};
    }
};

// 直播间文字
export const hupuQueryLiveTextList = async ({
    matchId,
    liveActivityKeyStr
}: LiveOptions) => {
    try {
        const res = await req(`https://live-api.liangle.com/1/7.5.60/live/queryLiveTextList?matchId=${matchId}&liveActivityKeyStr=${liveActivityKeyStr}`, {
            resJson: true,
            tipsName: '3-直播间文字',
        });
        return res;
    } catch (error) {
        return {};
    }
};

// 直播间评论
export const hupuQueryHotLineList = async ({
    matchId,
    liveActivityKeyStr
}: LiveOptions) => {
    try {
        const res = await req(`https://live-api.liangle.com/1/7.5.60/live/queryHotLineList?matchId=${matchId}&liveActivityKeyStr=${liveActivityKeyStr}`, {
            tipsName: '4-直播间评论',
        });
        return res;
    } catch (error) {
        return {};
    }
};

// 帖子详情
export const hupuPostDetail = async (url: string) => {
    try {
        const body: any = await req(url, {
            resJson: false,
            tipsName: '6-帖子详情',
        });
        const $ = cheerio.load(body);
        const sResData: any = $('#__NEXT_DATA__').html() || '';
        const resData = sResData ? JSON.parse(sResData) : {};
        const retData = resData.props.pageProps;
        let postContent = retData.threadData.data.moduleConfigList.content.moduleContent.content;
        if (retData.threadData.data.video_info) {
            postContent += `
                <div class="header-video-wrapper">
                    <video class="hupu-post-video" poster="${retData.threadData.data.video_info.img}" src="${retData.threadData.data.video_info.src}" playsinline="" controls=""></video>
                </div>
            `;
        }
        const res = {
            author: retData.threadData.data.moduleConfigList.user.moduleContent.name || '',
            createTime: retData.threadData.data.moduleConfigList.user.moduleContent.time || '',
            title: retData.threadData.data.moduleConfigList.title.moduleContent.title || '',
            postContent,
            postLightReplyContent: retData.initialRepliesData.lightReplies,
            postGrayReplyContent: retData.initialRepliesData.initialReplies,
            url,
            tid: retData.threadData.data.basicInfo.tid,
        };

        if (_context?.extensionMode === 2) {
            console.log('6-帖子详情', res);
        }
        return res;
    } catch (error) {
        return null;
    }
};

interface HupuPostReplyRequestParams {
    tid: string;
    pid: string;
}

// 帖子评论
export const hupuPostReply = async ({
    tid,
    pid
}: HupuPostReplyRequestParams) => {
    try {
        // https://m.hupu.com/api/v2/bbs-reply-detail/627871645-27117
        const res = await req(`https://m.hupu.com/api/v2/bbs-reply-detail/${tid}-${pid}`, {
            tipsName: '7-帖子评论',
        });
        return res;
    } catch (error) {
        return {};
    }
};

// 获取所有板块列表
export const getAllTopicList = async () => {
    try {
        const body: any = await req(`https://m.hupu.com/zone`, {
            resJson: false,
            tipsName: '8-论坛版块',
        });
        const $ = cheerio.load(body);
        const sResData: any = $('#__NEXT_DATA__').html() || '';
        const resData = sResData ? JSON.parse(sResData) : {};
        const retData = resData.props.pageProps.data;
        if (_context?.extensionMode === 2) {
            console.log('8-论坛版块', retData);
        }
        for (let item of retData) {
            item.label = item.name;
            item.value = item.categoryId;
            if (item.topicList && item.topicList.length) {
                for (let item1 of item.topicList) {
                    item1.label = item1.topicName;
                    item1.value = item1.topicId;
                }
            }
        }
        return retData;
    } catch (error) {
        return {};
    }
};

// 获取当前板块列表
export const getModuleListByTopicId = async (options: {topicId: number, page: number, cursor: string}) => {
    try {
        console.log('请求参数', options);
        const url = `https://m.hupu.com/api/v2/bbs/topicThreads?topicId=${options.topicId}&page=${options.page}&cursor=${options.cursor}`;
        const res: any = await req(url, {
            resJson: true,
            tipsName: '100-获取当前板块列表',
        });
        return res.data;
    } catch (error) {
        return {};
    }
};


// 比赛数据
export const hupuBoxscore = async (options: any): Promise<any> => {
    try {
        const url = options.url || `https://nba.hupu.com/games/boxscore/${options.gdcId}`;
        const body: any = await req(url, {
            resJson: false,
            tipsName: '9-比赛数据',
        });
        const $ = cheerio.load(body, { ignoreWhitespace: true });
        const res = {
            content: '',
        };
        if ($('.gamecenter_content_l').html()?.includes('table_list_live')) {
            res.content = $('.gamecenter_content_l').html() || '';
        } else {
            const aListBox = $('.gamecenter_content_l .list_box .border_a');
            for (let i = 0; i < aListBox.length; i++) {
                const content = aListBox.eq(i)?.html();
                if (content?.includes(options.homeTeamName) || content?.includes(options.awayTeamName)) {
                    const url = aListBox.eq(i).find('.table_choose .d').attr('href');
                    return hupuBoxscore({ url });
                }
            }
        }
        if (_context?.extensionMode === 2) {
            console.log('9-比赛数据', res);
        }
        return res;
    } catch (error) {
        return {};
    }
};

// 当场比赛
export const hupusingleMatch = async (matchId: string) => {
    try {
        const res = await req(`https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/singleMatch?matchId=${matchId}`, {
            resJson: true,
            tipsName: '10-当场比赛',
        });
        return res;
    } catch (error) {
        return null;
    }
};

// 比赛数据
export const hupuStandings = async () => {
    try {
        const url = `https://nba.hupu.com/standings`;
        const body: any = await req(url, {
            resJson: false,
            tipsName: '11-排名',
        });
        const $ = cheerio.load(body);
        const res = {
            content: $('.rank_data').html() || '',
        };

        if (_context?.extensionMode === 2) {
            console.log('11-排名', res);
        }
        return res;
    } catch (error) {
        return null;
    }
};

// 数据排行
export const hupuStats = async (type: string) => {
    try {
        const url = `https://nba.hupu.com${type}`;
        const body: any = await req(url, {
            resJson: false,
            tipsName: '12-数据排行',
        });
        const $ = cheerio.load(body);
        const res = {
            content: $('#data_js').html() || '',
        };

        if (_context?.extensionMode === 2) {
            console.log('12-数据排行', res);
        }
        return res;
    } catch (error) {
        return null;
    }
};

// 球员数据
export const hupuPlayerMatchStats = async (matchId: string) => {
    try {
        const res = await req(`https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/playerMatchStats?matchId=${matchId}`, {
            resJson: true,
            tipsName: '13-球员数据',
        });
        return res;
    } catch (error) {
        return null;
    }
};

// 每节数据
export const hupuTeamMatchQuarterStats = async (matchId: string) => {
    try {
        const res = await req(`https://games.mobileapi.hupu.com/1/7.5.60/basketballapi/teamMatchQuarterStats?matchId=${matchId}`, {
            resJson: true,
            tipsName: '14-每节数据',
        });
        return res;
    } catch (error) {
        return null;
    }
};

// 搜索
export const hupuSearchInfo = async (options: { keyword: string }) => {
    try {
        const res = await req(`https://m.hupu.com/api/v2/search2?keyword=${encodeURIComponent(options.keyword)}&puid=0&type=posts&topicId=0&page=1`, {
            resJson: false,
            tipsName: '15-搜索',
        });
        return res;
    } catch (error) {
        return null;
    }
};
