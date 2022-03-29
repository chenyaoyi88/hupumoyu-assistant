import * as vscode from 'vscode';

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

interface LiveTextList {
    commentId: string;
}

interface LiveTextObject {
    addIndex: number;
    showList: Array<any>;
    addList: Array<any>;
    diffList: Array<any>;
    backupList: Array<any>;
    finishList: Array<any>;
    lock: boolean;
    showDataDuration: number;
    addDataTimer: any;
}

export function findDiffList(oldList: Array<LiveTextList>, newList: Array<LiveTextList>) {
    let arr: Array<LiveTextList> = [];
    newList.forEach((item) => {
        if (oldList.every(item1 => item1.commentId !== item.commentId)) {
            arr.unshift(item);
        }
    });
    return arr;
}

export function addData(obj: LiveTextObject, callback?: Function) {
    obj.addIndex++;
    if (obj.addList[obj.addIndex]) {
        clearTimeout(obj.addDataTimer);
        obj.addDataTimer = setTimeout(() => {
            const item = obj.addList[obj.addIndex];
            obj.finishList.push(item);
            if (callback) {
                callback();
            } else {
                vscode.window.setStatusBarMessage(`${item.nickName}：${item.content}`);
            }
            addData(obj, callback);
        }, obj.showDataDuration);
    } else {
        obj.addIndex--;
        setTimeout(() => {
            addData(obj, callback);
        }, obj.showDataDuration);
    }
}

// 保留 2 位小数
export function saveDecimal(num: number, n: number = 2) {
    const str = num.toString();
    if (str.split('.').length > 1) {
        return (`${str.split('.')[0]}.${str.split('.')[1].substring(0, n).padEnd(n, '0')}`);
    } else {
        return (`${str.split('.')[0]}.${''.padEnd(n, '0')}`);
    }
};

// 正负符号
export function setPlusOrMinusTag(num: string | number) {
    if (Number(num) > 0) {
        return `+${num}`;
    } else {
        return num;
    }
}

export function stockInfoFormat(str: string) {
    const arr = [];
    const arr1 = str.split('var hq_str_');
    for (let item of arr1) {
        const aStockInfo: Array<any> = item.split('=') || [];
        if (aStockInfo[1]) {
            const aStockDetail = aStockInfo[1].replace(/"/g, '').replace(/;/g, '').split(',').map((
                item: string) => {
                return item.replace('\n', '');
            });
            if (aStockInfo[0].includes('sh') || aStockInfo[0].includes('sz')) {
                // 沪/深
                const json = {
                    '代码': aStockInfo[0].match(/\d+/g)[0],
                    '名称': aStockDetail[0],
                    '今开': saveDecimal(aStockDetail[1]),
                    '昨收': saveDecimal(aStockDetail[2]),
                    '最高': saveDecimal(aStockDetail[4]),
                    '最低': saveDecimal(aStockDetail[5]),
                    '现价': saveDecimal(aStockDetail[3]),
                    '涨跌': setPlusOrMinusTag(saveDecimal((aStockDetail[3] - aStockDetail[2]))),
                    '涨跌比': setPlusOrMinusTag(saveDecimal((1 - aStockDetail[2] / aStockDetail[3]) *
                        100)),
                };
                arr.push(json);
            } else if (aStockInfo[0].includes('hk')) {
                // 港
                const json = {
                    '代码': aStockInfo[0].match(/\d+/g)[0],
                    '名称': aStockDetail[1],
                    '今开': saveDecimal(aStockDetail[2]),
                    '昨收': saveDecimal(aStockDetail[3]),
                    '最高': saveDecimal(aStockDetail[4]),
                    '最低': saveDecimal(aStockDetail[5]),
                    '现价': saveDecimal(aStockDetail[6]),
                    '涨跌': setPlusOrMinusTag(saveDecimal((aStockDetail[6] - aStockDetail[3]))),
                    '涨跌比': setPlusOrMinusTag(saveDecimal((1 - aStockDetail[3] / aStockDetail[6]) *
                        100))
                };
                arr.push(json);
            } else if (aStockInfo[0].includes('gb')) {
                // 美
                const json = {
                    '代码': aStockInfo[0].split('_')[1],
                    '名称': aStockDetail[0],
                    '今开': saveDecimal(aStockDetail[5]),
                    '昨收': saveDecimal(aStockDetail[26]),
                    '最高': saveDecimal(aStockDetail[6]),
                    '最低': saveDecimal(aStockDetail[7]),
                    '现价': saveDecimal(aStockDetail[1]),
                    '涨跌': setPlusOrMinusTag(saveDecimal(aStockDetail[4])),
                    '涨跌比': setPlusOrMinusTag(aStockDetail[2]),
                };
                arr.push(json);
            } else {
                // 其他
                const json = {
                    '代码': aStockInfo[0].split('_')[1],
                    '名称': aStockDetail[0],
                    '今开': '',
                    '昨收': '',
                    '最高': '',
                    '最低': '',
                    '现价': saveDecimal(aStockDetail[1]),
                    '涨跌': setPlusOrMinusTag(saveDecimal(aStockDetail[2])),
                    '涨跌比': setPlusOrMinusTag(aStockDetail[3]),
                };
                arr.push(json);
            }
        }
    }
    return arr;
}