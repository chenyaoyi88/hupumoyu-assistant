import * as request from 'request';
import * as vscode from 'vscode';

export default function req(url: string, options?: { resJson?: Boolean, tipsName?: string }) {
    return new Promise((resolve, reject) => {
        if (options?.tipsName) {
            if (vscode.ExtensionMode.Development === 2) {
                console.log(options.tipsName, '开始请求');
                console.log('请求地址', url);
            }
        }
        request(url, {
            // 10 秒超时
            timeout: 10000,
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                let resData = {};
                if (options?.resJson === undefined || options?.resJson) {
                    resData = JSON.parse(body);
                    if (vscode.ExtensionMode.Development === 2) {
                        console.log(options?.tipsName, '接口响应', resData);
                    }
                } else {
                    resData = body;
                    if (vscode.ExtensionMode.Development === 2) {
                        console.log(options?.tipsName, '接口响应');
                    }
                }
                resolve(resData);
            } else {
                if (vscode.ExtensionMode.Development === 2) {
                    console.log(options?.tipsName, '请求错误', err);
                }
                reject(err);
            }
        });
    });
};