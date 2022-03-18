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

// if (obj.addIndex) {
//     obj.diffList = findDiffList(obj.backupList || [], res.result);
//     obj.backupList = JSON.parse(JSON.stringify(res.result));
//     obj.addList = (obj.addList || []).concat(obj.diffList);

//     if (!obj.lock) {
//         obj.lock = true;
//         addData(obj);
//     }
// }